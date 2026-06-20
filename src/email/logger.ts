import pino from "pino";

/**
 * Shared application logger.
 *
 * Output is pretty-printed and human-readable with a local timestamp, e.g.
 *   [2026-06-20 14:30:45] INFO: Mailbox "INBOX" opened
 *
 * Set LOG_LEVEL (trace|debug|info|warn|error) to control verbosity;
 * defaults to "info".
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "SYS:yyyy-mm-dd HH:MM:ss",
      ignore: "pid,hostname",
    },
  },
});
