import { ProcessorType } from "../process";

export interface EmailProcessorConfig {
  senderEmail: string;
  processorType: ProcessorType;
  importerConfig: string;
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