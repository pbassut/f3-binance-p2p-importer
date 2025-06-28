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
