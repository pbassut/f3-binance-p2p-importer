import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import path from "path";
import Papa from "papaparse";
import { processCsvFile } from "./process";

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
});

describe("Conversão de CSV", () => {
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

  it("deve conter Order Number, Created Time e Notes definidos", () => {
    for (const row of rows) {
      expect(row["Order Number"]).toBeTruthy();
      expect(row["Created Time"]).toBeTruthy();
      expect(row["Notes"]).not.toBeUndefined();
    }
  });

  it("deve montar Description corretamente para SELL", () => {
    for (const row of rows.filter((r) =>
      r["Description"].startsWith("Venda")
    )) {
      expect(/^Venda de USDT para Anon[A-D]$/.test(row["Description"])).toBe(
        true
      );
    }
  });

  it("deve montar Description corretamente para BUY", () => {
    for (const row of rows.filter((r) =>
      r["Description"].startsWith("Compra")
    )) {
      expect(/^Compra de USDT de AnonE$/.test(row["Description"])).toBe(true);
    }
  });

  it("Notes deve conter informações extras ou ser string vazia", () => {
    for (const row of rows) {
      expect(row["Notes"]).not.toBeUndefined();
      // Pode ser string vazia ou conter dados
      expect(typeof row["Notes"]).toBe("string");
    }
  });
});
