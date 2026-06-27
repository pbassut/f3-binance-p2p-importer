import { describe, it, expect, vi, beforeEach } from "vitest";
import { EmailProcessorConfig, matchProcessor } from "./email-config";

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

  describe("matchProcessor (subject filtering)", () => {
    const nubankProcessors: EmailProcessorConfig[] = [
      {
        senderEmail: "todomundo@nubank.com.br",
        processorType: "csv",
        importerConfig: "nubank.json",
        subjectPattern: "Extrato da sua conta do Nubank",
      },
      {
        senderEmail: "todomundo@nubank.com.br",
        processorType: "csv",
        importerConfig: "nubank-creditcard.json",
        subjectPattern: "Extrato da fatura do Cartão Nubank",
      },
    ];

    it("matches the account-statement processor by subject", () => {
      const match = matchProcessor(
        nubankProcessors,
        "todomundo@nubank.com.br",
        "Extrato da sua conta do Nubank"
      );
      expect(match?.importerConfig).toBe("nubank.json");
    });

    it("matches the credit-card processor by subject", () => {
      const match = matchProcessor(
        nubankProcessors,
        "todomundo@nubank.com.br",
        "Extrato da fatura do Cartão Nubank"
      );
      expect(match?.importerConfig).toBe("nubank-creditcard.json");
    });

    it("skips emails from the sender with a non-matching subject", () => {
      const match = matchProcessor(
        nubankProcessors,
        "todomundo@nubank.com.br",
        "Promoção: ganhe pontos no Nubank"
      );
      expect(match).toBeUndefined();
    });

    it("skips emails from the sender with no subject when a pattern is required", () => {
      const match = matchProcessor(nubankProcessors, "todomundo@nubank.com.br");
      expect(match).toBeUndefined();
    });

    it("matches subject case-insensitively", () => {
      const match = matchProcessor(
        nubankProcessors,
        "TODOMUNDO@NUBANK.COM.BR",
        "extrato da sua CONTA do nubank"
      );
      expect(match?.importerConfig).toBe("nubank.json");
    });

    it("returns undefined for an unknown sender", () => {
      const match = matchProcessor(nubankProcessors, "spam@evil.com", "anything");
      expect(match).toBeUndefined();
    });

    it("accepts any subject when the processor has no subjectPattern", () => {
      const processors: EmailProcessorConfig[] = [
        { senderEmail: "alerts@itau.com.br", processorType: "itau", importerConfig: "itau.json" },
      ];
      const match = matchProcessor(processors, "alerts@itau.com.br", "whatever subject");
      expect(match?.importerConfig).toBe("itau.json");
    });

    it("prefers a specific subject match over a wildcard candidate", () => {
      const processors: EmailProcessorConfig[] = [
        { senderEmail: "a@b.com", processorType: "csv", importerConfig: "wildcard.json" },
        {
          senderEmail: "a@b.com",
          processorType: "csv",
          importerConfig: "specific.json",
          subjectPattern: "Statement",
        },
      ];
      expect(matchProcessor(processors, "a@b.com", "Monthly Statement")?.importerConfig).toBe(
        "specific.json"
      );
      // Falls back to wildcard when the subject doesn't match the specific pattern
      expect(matchProcessor(processors, "a@b.com", "Newsletter")?.importerConfig).toBe(
        "wildcard.json"
      );
    });
  });
});