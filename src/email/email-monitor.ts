import * as Imap from "imap";
import { simpleParser, ParsedMail, Attachment } from "mailparser";
import fs from "fs";
import path from "path";
import { processCsvFile, ProcessorType } from "../process";
import { EmailMonitorConfig, EmailProcessorConfig } from "./email-config";
import axios from "axios";
import * as FormData from "form-data";

export class EmailMonitor {
  private imap: Imap;
  private config: EmailMonitorConfig;
  private isMonitoring = false;
  private processedUids: Set<number> = new Set();

  constructor(config: EmailMonitorConfig) {
    this.config = config;
    this.imap = new Imap({
      user: config.user,
      password: config.password,
      host: config.host,
      port: config.port,
      tls: config.tls,
      tlsOptions: { rejectUnauthorized: false }
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.imap.on("ready", () => {
      console.log("IMAP connection ready");
      this.openInbox();
    });

    this.imap.on("error", (err: Error) => {
      console.error("IMAP error:", err);
    });

    this.imap.on("end", () => {
      console.log("IMAP connection ended");
      this.isMonitoring = false;
    });
  }

  private openInbox() {
    this.imap.openBox(this.config.mailbox, false, (err, box) => {
      if (err) {
        console.error("Error opening mailbox:", err);
        return;
      }
      console.log(`Mailbox "${this.config.mailbox}" opened`);
      this.searchUnprocessedEmails();
    });
  }

  private searchUnprocessedEmails() {
    // Search for unread emails with attachments
    this.imap.search(["UNSEEN", ["HEADER", "CONTENT-TYPE", "multipart"]], (err, uids) => {
      if (err) {
        console.error("Error searching emails:", err);
        return;
      }

      if (uids.length === 0) {
        console.log("No new emails with attachments found");
        return;
      }

      console.log(`Found ${uids.length} unread emails with potential attachments`);
      this.processEmails(uids);
    });
  }

  private processEmails(uids: number[]) {
    const fetch = this.imap.fetch(uids, {
      bodies: "",
      markSeen: true
    });

    fetch.on("message", (msg, seqno) => {
      console.log(`Processing message #${seqno}`);
      
      msg.on("body", (stream) => {
        simpleParser(stream, async (err, parsed) => {
          if (err) {
            console.error("Error parsing email:", err);
            return;
          }

          await this.handleParsedEmail(parsed, seqno);
        });
      });
    });

    fetch.on("error", (err) => {
      console.error("Fetch error:", err);
    });

    fetch.on("end", () => {
      console.log("Finished processing emails");
    });
  }

  private async handleParsedEmail(mail: ParsedMail, seqno: number) {
    const from = mail.from?.value[0]?.address;
    if (!from) {
      console.log(`Email #${seqno} has no sender address`);
      return;
    }

    const processorConfig = this.findProcessorConfig(from);
    if (!processorConfig) {
      console.log(`No processor configured for sender: ${from}`);
      return;
    }

    console.log(`Using ${processorConfig.processorType} processor for email from ${from}`);

    if (!mail.attachments || mail.attachments.length === 0) {
      console.log(`Email #${seqno} has no attachments`);
      return;
    }

    for (const attachment of mail.attachments) {
      if (attachment.filename?.endsWith(".csv")) {
        await this.processAttachment(attachment, processorConfig);
      }
    }
  }

  private findProcessorConfig(senderEmail: string): EmailProcessorConfig | undefined {
    return this.config.processors.find(
      (proc) => proc.senderEmail.toLowerCase() === senderEmail.toLowerCase()
    );
  }

  private async processAttachment(
    attachment: Attachment,
    processorConfig: EmailProcessorConfig
  ) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const tempInputPath = path.join(
      "uploads",
      `email-${timestamp}-${attachment.filename}`
    );
    const tempOutputPath = path.join(
      "uploads",
      `processed-${timestamp}-${attachment.filename}`
    );

    try {
      // Ensure uploads directory exists
      if (!fs.existsSync("uploads")) {
        fs.mkdirSync("uploads", { recursive: true });
      }

      // Save attachment to disk
      fs.writeFileSync(tempInputPath, attachment.content);
      console.log(`Saved attachment: ${tempInputPath}`);

      // Process the CSV file
      await new Promise<void>((resolve, reject) => {
        processCsvFile(
          tempInputPath,
          tempOutputPath,
          () => resolve(),
          processorConfig.processorType
        );
      });

      console.log(`Processed CSV: ${tempOutputPath}`);

      // Send to Firefly-III if configured
      if (process.env.FIREFLY_URL && process.env.FIREFLY_TOKEN) {
        await this.sendToFirefly(tempOutputPath, processorConfig);
      } else {
        // Move to output directory if Firefly is not configured
        const finalOutputPath = path.join(
          "output",
          `${timestamp}-${attachment.filename}`
        );
        if (!fs.existsSync("output")) {
          fs.mkdirSync("output", { recursive: true });
        }
        fs.copyFileSync(tempOutputPath, finalOutputPath);
        console.log(`Saved processed file to: ${finalOutputPath}`);
      }

      // Cleanup temp files
      fs.unlinkSync(tempInputPath);
      fs.unlinkSync(tempOutputPath);

    } catch (error) {
      console.error(`Error processing attachment ${attachment.filename}:`, error);
      // Cleanup on error
      if (fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
      if (fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath);
    }
  }

  private async sendToFirefly(
    csvPath: string,
    processorConfig: EmailProcessorConfig
  ) {
    const configPath = path.join(
      __dirname,
      "..",
      "importer-configs",
      processorConfig.importerConfig
    );

    const formData = new FormData();
    formData.append("csv", fs.createReadStream(csvPath));
    formData.append("config", fs.createReadStream(configPath));

    try {
      const response = await axios.post(
        `${process.env.FIREFLY_URL}/autoupload`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            Authorization: `Bearer ${process.env.FIREFLY_TOKEN}`,
            Accept: "application/json",
          },
          params: {
            secret: process.env.FIREFLY_SECRET,
          },
        }
      );

      console.log(`Firefly-III import response:`, response.data);
    } catch (error: any) {
      console.error("Error sending to Firefly-III:", error.message);
      throw error;
    }
  }

  start() {
    if (this.isMonitoring) {
      console.log("Email monitoring is already running");
      return;
    }

    console.log("Starting email monitor...");
    this.isMonitoring = true;
    this.imap.connect();

    // Set up periodic checking
    setInterval(() => {
      if (this.isMonitoring && this.imap.state === "authenticated") {
        console.log("Checking for new emails...");
        this.searchUnprocessedEmails();
      }
    }, this.config.checkIntervalMinutes * 60 * 1000);
  }

  stop() {
    console.log("Stopping email monitor...");
    this.isMonitoring = false;
    this.imap.end();
  }
}