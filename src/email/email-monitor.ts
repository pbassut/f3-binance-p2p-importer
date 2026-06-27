import Imap from "imap";
import { simpleParser, ParsedMail, Attachment } from "mailparser";
import fs from "fs";
import path from "path";
import { processCsvFile, ProcessorType } from "../process";
import { EmailMonitorConfig, EmailProcessorConfig, matchProcessor } from "./email-config";
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

    const processors = this.config.processors;
    logger.info(
      `Searching for unread emails matching: ${processors.map(p => this.describeFilter(p)).join("; ")}`
    );

    // Search each processor's criteria separately and combine the results.
    // Including SUBJECT in the IMAP query means we never fetch (and therefore
    // never mark as seen) emails from a configured sender that don't match the
    // expected subject — e.g. Nubank marketing emails are left untouched.
    const allUids: number[] = [];
    let searchesCompleted = 0;

    processors.forEach(proc => {
      const criteria: any[] = [["UNSEEN"], ["FROM", proc.senderEmail]];
      if (proc.subjectPattern) {
        // IMAP SUBJECT is a case-insensitive substring match. For the precise
        // (regex) match we re-check the decoded subject after fetching.
        criteria.push(["SUBJECT", proc.subjectPattern]);
      }

      this.imap.search(criteria, (err, uids) => {
        if (err) {
          logger.error({ err }, `Error searching emails for ${this.describeFilter(proc)}`);
        } else {
          allUids.push(...uids);
        }

        searchesCompleted++;
        if (searchesCompleted === processors.length) {
          // Remove duplicates (a UID can match more than one filter)
          this.handleSearchResults(null, [...new Set(allUids)]);
        }
      });
    });
  }

  private describeFilter(proc: EmailProcessorConfig): string {
    return proc.subjectPattern
      ? `${proc.senderEmail} (subject "${proc.subjectPattern}")`
      : proc.senderEmail;
  }

  private handleSearchResults(err: Error | null, uids: number[]) {
    if (err) {
      logger.error({ err }, "Error searching unread emails");
      return;
    }

    if (uids.length === 0) {
      logger.info("Found 0 matching emails — nothing to process");
      return;
    }

    logger.info(`Found ${uids.length} matching email(s), fetching them now...`);
    this.processEmails(uids);
  }

  private processEmails(uids: number[]) {
    const total = uids.length;
    const pending: Promise<boolean>[] = [];

    const fetch = this.imap.fetch(uids, {
      bodies: "",
      markSeen: true  // This marks emails as read after fetching
    });

    fetch.on("message", (msg, seqno) => {
      msg.on("body", (stream: any) => {
        pending.push(
          new Promise<boolean>((resolve) => {
            simpleParser(stream, async (err: any, parsed: ParsedMail) => {
              if (err) {
                logger.error({ err }, "Error parsing email");
                resolve(false);
                return;
              }
              resolve(await this.handleParsedEmail(parsed, seqno));
            });
          })
        );
      });
    });

    fetch.on("error", (err) => {
      logger.error({ err }, "Fetch error");
    });

    fetch.on("end", () => {
      // Wait for all parse/process callbacks before reporting the summary,
      // otherwise this fires before the async work has finished.
      Promise.all(pending).then((results) => {
        const processed = results.filter(Boolean).length;
        const skipped = total - processed;
        logger.info(`Finished — processed ${processed}/${total} email(s), skipped ${skipped}`);
      });
    });
  }

  /** Returns true if at least one CSV attachment was processed. */
  private async handleParsedEmail(mail: ParsedMail, seqno: number): Promise<boolean> {
    const from = mail.from?.value[0]?.address;
    logger.info(
      `Email #${seqno} from ${from ?? "unknown"} — "${mail.subject ?? "(no subject)"}" ` +
        `(${mail.attachments?.length ?? 0} attachment(s))`
    );

    if (!from) {
      logger.warn(`Email #${seqno} has no sender address, skipping`);
      return false;
    }

    const processorConfig = this.findProcessorConfig(from, mail.subject);
    if (!processorConfig) {
      logger.warn(
        `Email #${seqno} skipped — no processor matches sender "${from}" ` +
          `with subject "${mail.subject ?? ""}"`
      );
      return false;
    }

    logger.info(
      `Using "${processorConfig.processorType}" processor (${processorConfig.importerConfig}) for email #${seqno}`
    );

    const csvAttachments = (mail.attachments ?? []).filter(a => a.filename?.endsWith(".csv"));
    if (csvAttachments.length === 0) {
      logger.warn(`Email #${seqno} has no CSV attachments, skipping`);
      return false;
    }

    for (const attachment of csvAttachments) {
      await this.processAttachment(attachment, processorConfig);
    }
    return true;
  }

  private findProcessorConfig(senderEmail: string, subject?: string): EmailProcessorConfig | undefined {
    return matchProcessor(this.config.processors, senderEmail, subject);
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
