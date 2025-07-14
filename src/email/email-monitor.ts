import Imap from "imap";
import { simpleParser, ParsedMail, Attachment } from "mailparser";
import fs from "fs";
import path from "path";
import { processCsvFile, ProcessorType } from "../process";
import { EmailMonitorConfig, EmailProcessorConfig } from "./email-config";
import axios from "axios";
import FormData from "form-data";

export class EmailMonitor {
  private imap: Imap;
  private config: EmailMonitorConfig;
  private isMonitoring = false;
  private processedUids: Set<number> = new Set();

  constructor(config: EmailMonitorConfig) {
    this.config = config;
    console.log(`Connecting to ${config.host}:${config.port} as ${config.user}`);
    this.imap = new Imap({
      user: config.user,
      password: config.password,
      host: config.host,
      port: config.port,
      tls: config.tls,
      tlsOptions: { rejectUnauthorized: false },
      authTimeout: 10000,
      connTimeout: 10000,
      debug: console.log
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
    console.log("Searching for unread emails from configured senders...");
    
    const senderEmails = this.config.processors.map(p => p.senderEmail);
    console.log("Looking for unread emails from:", senderEmails);
    
    if (this.config.processors.length === 0) {
      console.log("No email processors configured");
      return;
    }

    // Search for unread emails from the first configured sender
    const senderEmail = this.config.processors[0].senderEmail;
    console.log(`Searching for unread emails from: ${senderEmail}`);
    
    // Search for emails that are both UNSEEN (unread) and FROM the sender
    this.imap.search([["UNSEEN"], ["FROM", senderEmail]], (err, uids) => {
      if (err) {
        console.error("Error searching unread emails:", err);
        return;
      }

      if (uids.length === 0) {
        console.log("No unread emails found from configured senders");
        return;
      }

      console.log(`Found ${uids.length} unread emails from ${senderEmail}`);
      this.processEmails(uids);
    });
  }

  private processEmails(uids: number[]) {
    const fetch = this.imap.fetch(uids, {
      bodies: "",
      markSeen: true  // This marks emails as read after fetching
    });

    fetch.on("message", (msg, seqno) => {
      console.log(`Processing message #${seqno}`);
      
      msg.on("body", (stream: any) => {
        simpleParser(stream, async (err: any, parsed: ParsedMail) => {
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
    console.log(`\nProcessing email #${seqno}:`);
    console.log(`Subject: ${mail.subject}`);
    console.log(`From: ${mail.from?.text}`);
    console.log(`Date: ${mail.date}`);
    console.log(`Has attachments: ${mail.attachments && mail.attachments.length > 0}`);
    
    const from = mail.from?.value[0]?.address;
    if (!from) {
      console.log(`Email #${seqno} has no sender address`);
      return;
    }

    const processorConfig = this.findProcessorConfig(from, mail.subject);
    if (!processorConfig) {
      console.log(`No processor configured for sender: ${from}`);
      console.log(`Configured senders: ${this.config.processors.map(p => p.senderEmail).join(', ')}`);
      return;
    }

    console.log(`Using ${processorConfig.processorType} processor (${processorConfig.importerConfig}) for email from ${from}`);

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

  private findProcessorConfig(senderEmail: string, subject?: string): EmailProcessorConfig | undefined {
    const candidates = this.config.processors.filter(
      (proc) => proc.senderEmail.toLowerCase() === senderEmail.toLowerCase()
    );
    
    if (candidates.length === 0) {
      return undefined;
    }
    
    // If there's only one candidate, return it
    if (candidates.length === 1) {
      return candidates[0];
    }
    
    // If multiple candidates and we have a subject, try to match by subject pattern
    if (subject) {
      for (const candidate of candidates) {
        if (candidate.subjectPattern) {
          const regex = new RegExp(candidate.subjectPattern, 'i');
          if (regex.test(subject)) {
            return candidate;
          }
        }
      }
    }
    
    // Fallback to first candidate if no subject match
    return candidates[0];
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

      // Process the CSV file or pass through if processorType is "csv"
      if (processorConfig.processorType === "csv") {
        // For "csv" type, just copy the file without processing
        fs.copyFileSync(tempInputPath, tempOutputPath);
        console.log(`CSV passthrough: ${tempOutputPath}`);
      } else {
        await new Promise<void>((resolve, reject) => {
          processCsvFile(
            tempInputPath,
            tempOutputPath,
            () => resolve(),
            processorConfig.processorType as ProcessorType
          );
        });
        console.log(`Processed CSV: ${tempOutputPath}`);
      }

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
    formData.append("importable", fs.createReadStream(csvPath));
    formData.append("json", fs.createReadStream(configPath));

    const fireflyUrl = process.env.FIREFLY_URL!.replace(/\/$/, "");
    const secret = process.env.FIREFLY_SECRET!;
    const url = `${fireflyUrl}/dataimporter/autoupload?secret=${encodeURIComponent(secret)}`;
    
    try {
      const response = await axios.post(
        url,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            Authorization: `Bearer ${process.env.FIREFLY_TOKEN}`,
            Accept: "application/json",
          },
          maxBodyLength: Infinity,
        }
      );

      console.log(`Firefly-III import response:`, response.data);
    } catch (error: any) {
      console.error("Error sending to Firefly-III:", error.message);
      if (error.response) {
        console.error("Response status:", error.response.status);
        if (error.response.status === 500) {
          console.error("Server returned 500 Internal Server Error");
          // Log the error message if available in the response
          const errorMatch = error.response.data?.match(/<p class="text-danger">\s*([^<]+)\s*<\/p>/);
          if (errorMatch) {
            console.error("Server error message:", errorMatch[1]);
          }
        }
        console.error("Request URL:", error.config?.url);
      }
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