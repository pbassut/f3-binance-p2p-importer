import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import path from "path";
import Papa from "papaparse";
import { processCsvFile } from "./process";
import { createInstance } from "i18next";
import ptBrTranslation from "./locales/pt-BR/translation.json";

const INPUT_DIR = "input";
const OUTPUT_DIR = "output";
const EXAMPLE_CSV = "example.csv";
const TEST_INPUT = path.join(INPUT_DIR, "test.csv");
const TEST_OUTPUT = path.join(OUTPUT_DIR, "test.csv");

beforeAll(() => {
  if (!fs.existsSync(INPUT_DIR)) fs.mkdirSync(INPUT_DIR);
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);
});

afterAll(() => {
  if (fs.existsSync(TEST_INPUT)) fs.unlinkSync(TEST_INPUT);
  if (fs.existsSync(TEST_OUTPUT)) fs.unlinkSync(TEST_OUTPUT);
  // No cleanup needed for i18n instance
});

describe("CSV Conversion", () => {
  let rows: Record<string, string>[] = [];

  beforeAll(async () => {
    if (fs.existsSync(TEST_INPUT)) fs.unlinkSync(TEST_INPUT);
    if (fs.existsSync(TEST_OUTPUT)) fs.unlinkSync(TEST_OUTPUT);
    fs.copyFileSync(EXAMPLE_CSV, TEST_INPUT);
    await new Promise<void>((resolve, reject) => {
      processCsvFile(TEST_INPUT, TEST_OUTPUT, () => {
        try {
          const csv = fs.readFileSync(TEST_OUTPUT, "utf8");
          const parsed = Papa.parse(csv, {
            header: true,
            skipEmptyLines: true,
          });
          rows = parsed.data as Record<string, string>[];
          resolve();
        } catch (err) {
          reject(err);
        }
      });
    });
  });

  it("should have Order Number, Created Time, and Notes defined", () => {
    for (const row of rows) {
      expect(row["Order Number"]).toBeTruthy();
      expect(row["Created Time"]).toBeTruthy();
      expect(row["Notes"]).not.toBeUndefined();
    }
  });

  it("should build Description correctly for SELL", () => {
    for (const row of rows.filter((r) => r["Description"].startsWith("Sell"))) {
      expect(/^Sell USDT to Anon[A-D]$/.test(row["Description"])).toBe(true);
    }
  });

  it("should build Description correctly for BUY", () => {
    for (const row of rows.filter((r) => r["Description"].startsWith("Buy"))) {
      expect(/^Buy USDT from AnonE$/.test(row["Description"])).toBe(true);
    }
  });

  it("Notes should contain extra info or be an empty string", () => {
    for (const row of rows) {
      expect(row["Notes"]).not.toBeUndefined();
      // Pode ser string vazia ou conter dados
      expect(typeof row["Notes"]).toBe("string");
    }
  });
});

describe("pt-BR translations", () => {
  let i18n: ReturnType<typeof createInstance>;
  beforeAll(async () => {
    i18n = createInstance();
    await i18n.init({
      lng: "pt-BR",
      fallbackLng: "pt-BR",
      resources: {
        "pt-BR": { translation: ptBrTranslation },
      },
    });
  });

  it("should translate Buy", () => {
    expect(
      i18n.t("Buy {{asset}} from {{counterparty}}", {
        asset: "USDT",
        counterparty: "AnonE",
      })
    ).toBe("Compra de USDT de AnonE");
  });

  it("should translate Sell", () => {
    expect(
      i18n.t("Sell {{asset}} to {{counterparty}}", {
        asset: "USDT",
        counterparty: "AnonA",
      })
    ).toBe("Venda de USDT para AnonA");
  });

  it("should translate Tax", () => {
    expect(
      i18n.t("Tax of {{asset}} from {{counterparty}}", {
        asset: "USDT",
        counterparty: "AnonA",
      })
    ).toBe("Taxa de USDT de AnonA");
  });

  it("should translate generic key:value", () => {
    expect(
      i18n.t("{{key}}: {{value}}", { key: "Fiat Type", value: "BRL" })
    ).toBe("Fiat Type: BRL");
  });

  it("should have pt-BR translation resource loaded", () => {
    expect(ptBrTranslation["Buy {{asset}} from {{counterparty}}"]).toBe(
      "Compra de {{asset}} de {{counterparty}}"
    );
  });
});
