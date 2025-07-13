import { describe, it, expect, vi, beforeEach } from "vitest";
import { EmailProcessorConfig } from "./email-config";

// Mock all dependencies before importing the module under test
vi.mock("fs");
vi.mock("path");
vi.mock("imap");
vi.mock("mailparser");
vi.mock("axios");
vi.mock("form-data");
vi.mock("../process");

describe("EmailMonitor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Email processor configuration", () => {
    it("should match sender email case-insensitively", () => {
      const processors: EmailProcessorConfig[] = [
        {
          senderEmail: "binance@example.com",
          processorType: "binance",
          importerConfig: "binance.json"
        }
      ];

      const testEmail = "BINANCE@EXAMPLE.COM";
      const config = processors.find(
        (proc) => proc.senderEmail.toLowerCase() === testEmail.toLowerCase()
      );

      expect(config).toBeDefined();
      expect(config?.processorType).toBe("binance");
    });

    it("should return undefined for unknown sender", () => {
      const processors: EmailProcessorConfig[] = [
        {
          senderEmail: "binance@example.com",
          processorType: "binance",
          importerConfig: "binance.json"
        }
      ];

      const testEmail = "unknown@example.com";
      const config = processors.find(
        (proc) => proc.senderEmail.toLowerCase() === testEmail.toLowerCase()
      );

      expect(config).toBeUndefined();
    });
  });

  describe("Processor type mapping", () => {
    it("should support all processor types", () => {
      const processors: EmailProcessorConfig[] = [
        {
          senderEmail: "noreply@binance.com",
          processorType: "binance",
          importerConfig: "binance.json"
        },
        {
          senderEmail: "alerts@itau.com.br",
          processorType: "itau",
          importerConfig: "itau.json"
        },
        {
          senderEmail: "payments@deel.com",
          processorType: "deel",
          importerConfig: "deel.json"
        }
      ];

      expect(processors).toHaveLength(3);
      expect(processors.map(p => p.processorType)).toEqual(["binance", "itau", "deel"]);
    });
  });
});