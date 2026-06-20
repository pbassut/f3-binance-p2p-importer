import Imap from "imap";
import { simpleParser, ParsedMail, Attachment } from "mailparser";
import fs from "fs";
import path from "path";
import { processCsvFile, ProcessorType } from "../process";
import { EmailMonitorConfig, EmailProcessorConfig } from "./email-config";
import { logger } from "./logger";
import axios from "axios";
import FormData from "form-data";

export class EmailMonitor {
  private imap: Imap;
  private config: EmailMonitorConfig;
  private isMonitoring = false;
  private processedUids: Set<number> = new Set();

  constructor(config: EmailMonitorConfig) {
    this.config = config;
    logger.info(`Connecting to ${config.host}:${config.port} as ${config.user}`);
    this.imap = new Imap({
      user: config.user,
      password: config.password,
      host: config.host,
      port: config.port,
      tls: config.tls,
      tlsOptions: { rejectUnauthorized: false },
      authTimeout: 10000,
      connTimeout: 10000,
      // Raw IMAP protocol chatter is logged at debug level only (set
      // LOG_LEVEL=debug to see it). Login lines are always suppressed to
      // avoid logging credentials.
      debug: (msg: string) => {
        if (msg.includes("LOGIN")) return;
        logger.debug(`IMAP » ${msg}`);
      },
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.imap.on("ready", () => {
      logger.info("Connected to mail server");
      this.openInbox();
    });

    this.imap.on("error", (err: Error) => {
      logger.error({ err }, "IMAP error");
      // Attempt to reconnect after timeout errors
      if (err.message.includes("ETIMEDOUT") && this.isMonitoring) {
        logger.warn("Connection timed out, reconnecting in 5s...");
        setTimeout(() => {
          if (this.isMonitoring) {
            this.imap.connect();
          }
        }, 5000); // Wait 5 seconds before reconnecting
      }
    });

    this.imap.on("end", () => {
      if (this.isMonitoring) {
        logger.warn("Connection closed, reconnecting in 10s...");
        setTimeout(() => {
          if (this.isMonitoring) {
            this.imap.connect();
          }
        }, 10000); // Wait 10 seconds before reconnecting
      } else {
        logger.info("Connection closed");
        this.isMonitoring = false;
      }
    });
  }

  private openInbox() {
    this.imap.openBox(this.config.mailbox, false, (err, box) => {
      if (err) {
        logger.error({ err }, "Error opening mailbox");
        return;
      }
      logger.info(`Mailbox "${this.config.mailbox}" opened`);
      this.searchUnprocessedEmails();
    });
  }

  private searchUnprocessedEmails() {
    if (this.config.processors.length === 0) {
      logger.warn("No email processors configured");
      return;
    }

    const senderEmails = [...new Set(this.config.processors.map(p => p.senderEmail))]; // Remove duplicates
    logger.info(`Checking for unread emails from: ${senderEmails.join(", ")}`);

    if (senderEmails.length === 1) {
      // Single sender search
      this.imap.search([["UNSEEN"], ["FROM", senderEmails[0]]], (err, uids) => {
        this.handleSearchResults(err, uids);
      });
    } else {
      // Multiple senders - search each one separately and combine results
      let allUids: number[] = [];
      let searchesCompleted = 0;

      senderEmails.forEach(senderEmail => {
        this.imap.search([["UNSEEN"], ["FROM", senderEmail]], (err, uids) => {
          if (err) {
            logger.error({ err }, `Error searching emails from ${senderEmail}`);
          } else {
            allUids.push(...uids);
          }

          searchesCompleted++;
          if (searchesCompleted === senderEmails.length) {
            // Remove duplicates and process
            const uniqueUids = [...new Set(allUids)];
            this.handleSearchResults(null, uniqueUids);
          }
        });
      });
    }
  }

  private handleSearchResults(err: Error | null, uids: number[]) {
    if (err) {
      logger.error({ err }, "Error searching unread emails");
      return;
    }

    if (uids.length === 0) {
      logger.info("No new emails to process");
      return;
    }

    logger.info(`Found ${uids.length} new email(s) to process`);
    this.processEmails(uids);
  }

  private processEmails(uids: number[]) {
    const fetch = this.imap.fetch(uids, {
      bodies: "",
      markSeen: true  // This marks emails as read after fetching
    });

    fetch.on("message", (msg, seqno) => {
      msg.on("body", (stream: any) => {
        simpleParser(stream, async (err: any, parsed: ParsedMail) => {
          if (err) {
            logger.error({ err }, "Error parsing email");
            return;
          }

          await this.handleParsedEmail(parsed, seqno);
        });
      });
    });

    fetch.on("error", (err) => {
      logger.error({ err }, "Fetch error");
    });

    fetch.on("end", () => {
      logger.info("Finished processing emails");
    });
  }

  private async handleParsedEmail(mail: ParsedMail, seqno: number) {
    const from = mail.from?.value[0]?.address;
    logger.info(
      `Email #${seqno} from ${from ?? "unknown"} — "${mail.subject ?? "(no subject)"}" ` +
        `(${mail.attachments?.length ?? 0} attachment(s))`
    );

    if (!from) {
      logger.warn(`Email #${seqno} has no sender address, skipping`);
      return;
    }

    const processorConfig = this.findProcessorConfig(from, mail.subject);
    if (!processorConfig) {
      logger.warn(
        `No processor configured for ${from} ` +
          `(configured: ${this.config.processors.map(p => p.senderEmail).join(", ")})`
      );
      return;
    }

    logger.info(
      `Using "${processorConfig.processorType}" processor (${processorConfig.importerConfig}) for ${from}`
    );

    if (!mail.attachments || mail.attachments.length === 0) {
      logger.warn(`Email #${seqno} has no attachments, skipping`);
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
      logger.info(`Saved attachment: ${attachment.filename}`);

      // Process the CSV file or pass through if processorType is "csv"
      if (processorConfig.processorType === "csv") {
        // For "csv" type, just copy the file without processing
        fs.copyFileSync(tempInputPath, tempOutputPath);
        logger.info("CSV passthrough (no transformation)");
      } else {
        await new Promise<void>((resolve, reject) => {
          processCsvFile(
            tempInputPath,
            tempOutputPath,
            () => resolve(),
            processorConfig.processorType as ProcessorType
          );
        });
        logger.info(`Processed CSV with "${processorConfig.processorType}" processor`);
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
        logger.info(`Saved processed file to: ${finalOutputPath}`);
      }

      // Cleanup temp files
      fs.unlinkSync(tempInputPath);
      fs.unlinkSync(tempOutputPath);

    } catch (error) {
      logger.error({ err: error }, `Error processing attachment ${attachment.filename}`);
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

      logger.info({ response: response.data }, "Firefly-III import succeeded");
    } catch (error: any) {
      logger.error(`Error sending to Firefly-III: ${error.message}`);
      if (error.response) {
        logger.error(`Response status: ${error.response.status}`);
        if (error.response.status === 500) {
          // Log the error message if available in the response
          const errorMatch = error.response.data?.match(/<p class="text-danger">\s*([^<]+)\s*<\/p>/);
          if (errorMatch) {
            logger.error(`Server error message: ${errorMatch[1]}`);
          } else {
            logger.error("Server returned 500 Internal Server Error");
          }
        }
        logger.error(`Request URL: ${error.config?.url}`);
      }
      throw error;
    }
  }

  start() {
    if (this.isMonitoring) {
      logger.info("Email monitoring is already running");
      return;
    }

    logger.info("Starting email monitor...");
    this.isMonitoring = true;
    this.imap.connect();

    // Set up periodic checking
    setInterval(() => {
      if (this.isMonitoring && this.imap.state === "authenticated") {
        logger.info("Checking for new emails...");
        this.searchUnprocessedEmails();
      }
    }, this.config.checkIntervalMinutes * 60 * 1000);
  }

  stop() {
    logger.info("Stopping email monitor...");
    this.isMonitoring = false;
    this.imap.end();
  }
}
