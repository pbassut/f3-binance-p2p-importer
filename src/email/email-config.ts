import { ProcessorType } from "../process";

export interface EmailProcessorConfig {
  senderEmail: string;
  processorType: ProcessorType | "csv";
  importerConfig: string;
  subjectPattern?: string; // Optional regex pattern to match email subjects
}

export interface EmailMonitorConfig {
  host: string;
  port: number;
  tls: boolean;
  user: string;
  password: string;
  mailbox: string;
  checkIntervalMinutes: number;
  processors: EmailProcessorConfig[];
}

export const defaultEmailConfig: Partial<EmailMonitorConfig> = {
  port: 993,
  tls: true,
  mailbox: "INBOX",
  checkIntervalMinutes: 5,
  processors: []
};

/**
 * Selects the processor for an email, applying `subjectPattern` as a hard
 * filter. A candidate with a `subjectPattern` only matches when the email's
 * subject matches the pattern; a candidate without one accepts any subject.
 * Specific (pattern) matches win over wildcard (no-pattern) candidates.
 * Returns undefined when no candidate matches (the email should be skipped).
 */
export function matchProcessor(
  processors: EmailProcessorConfig[],
  senderEmail: string,
  subject?: string
): EmailProcessorConfig | undefined {
  const candidates = processors.filter(
    (proc) => proc.senderEmail.toLowerCase() === senderEmail.toLowerCase()
  );

  if (candidates.length === 0) {
    return undefined;
  }

  const specific = candidates.find(
    (c) => c.subjectPattern && subject && new RegExp(c.subjectPattern, "i").test(subject)
  );
  if (specific) {
    return specific;
  }

  return candidates.find((c) => !c.subjectPattern);
}