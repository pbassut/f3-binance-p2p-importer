import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import path from "path";
import Papa from "papaparse";
import { processCsvFile } from "../process";

const OUTPUT_DIR = "output";
const NUBANK_SAMPLE = path.join(__dirname, "../../sample-csv/nubank-sample.csv");
const NUBANK_OUT = path.join(OUTPUT_DIR, "nubank-test.out.csv");

beforeAll(() => {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);
});

afterAll(() => {
  if (fs.existsSync(NUBANK_OUT)) fs.unlinkSync(NUBANK_OUT);
});

describe("Nubank Processor", () => {
  it("should pass through CSV without modifications", () => {
    // Create a simple test CSV
    const testCsv = path.join(OUTPUT_DIR, "nubank-input.csv");
    const testOutput = path.join(OUTPUT_DIR, "nubank-output.csv");

    const inputData = `Data,Valor,Identificador,Descrição
02/02/2025,-50.00,679f9290-3dbf-4719-a890-f32d2ce05a8a,Compra no débito - Via Dutra
03/02/2025,-1000.00,67a0b150-81e6-4a77-a089-404f7bfecd3a,Transferência enviada pelo Pix`;

    fs.writeFileSync(testCsv, inputData, "utf8");

    processCsvFile(testCsv, testOutput, undefined, "nubank");

    const output = fs.readFileSync(testOutput, "utf8");
    expect(output).toBe(inputData);

    // Clean up
    fs.unlinkSync(testCsv);
    fs.unlinkSync(testOutput);
  });

  it("should preserve CSV structure and encoding", () => {
    const testCsv = path.join(OUTPUT_DIR, "nubank-encoding-test.csv");
    const testOutput = path.join(OUTPUT_DIR, "nubank-encoding-output.csv");

    const inputData = `Data,Valor,Identificador,Descrição
02/02/2025,-50.00,679f9290-3dbf-4719-a890-f32d2ce05a8a,Transferência Recebida - DEMERGE BRASIL FACILITADORA`;

    fs.writeFileSync(testCsv, inputData, "utf8");

    processCsvFile(testCsv, testOutput, undefined, "nubank");

    const output = fs.readFileSync(testOutput, "utf8");
    const parsed = Papa.parse(output, { header: true, skipEmptyLines: true });
    const rows = parsed.data as Record<string, string>[];

    expect(rows.length).toBe(1);
    expect(rows[0]["Data"]).toBe("02/02/2025");
    expect(rows[0]["Valor"]).toBe("-50.00");
    expect(rows[0]["Descrição"]).toContain("DEMERGE BRASIL");

    // Clean up
    fs.unlinkSync(testCsv);
    fs.unlinkSync(testOutput);
  });

  it("should handle multiple rows without modification", () => {
    const testCsv = path.join(OUTPUT_DIR, "nubank-multi-rows.csv");
    const testOutput = path.join(OUTPUT_DIR, "nubank-multi-output.csv");

    const inputData = `Data,Valor,Identificador,Descrição
02/02/2025,-50.00,679f9290-3dbf-4719-a890-f32d2ce05a8a,Compra no débito - Via Dutra
03/02/2025,-1000.00,67a0b150-81e6-4a77-a089-404f7bfecd3a,Transferência enviada pelo Pix
03/02/2025,39099.26,67a0d509-c72e-465d-abf1-d4389a431a91,Transferência Recebida`;

    fs.writeFileSync(testCsv, inputData, "utf8");

    processCsvFile(testCsv, testOutput, undefined, "nubank");

    const output = fs.readFileSync(testOutput, "utf8");
    const parsed = Papa.parse(output, { header: true, skipEmptyLines: true });
    const rows = parsed.data as Record<string, string>[];

    expect(rows.length).toBe(3);
    expect(rows[0]["Valor"]).toBe("-50.00");
    expect(rows[1]["Valor"]).toBe("-1000.00");
    expect(rows[2]["Valor"]).toBe("39099.26");

    // Clean up
    fs.unlinkSync(testCsv);
    fs.unlinkSync(testOutput);
  });

  it("should work with callback function", () => {
    const testCsv = path.join(OUTPUT_DIR, "nubank-callback.csv");
    const testOutput = path.join(OUTPUT_DIR, "nubank-callback-output.csv");

    const inputData = `Data,Valor,Identificador,Descrição
02/02/2025,-50.00,679f9290-3dbf-4719-a890-f32d2ce05a8a,Compra no débito`;

    fs.writeFileSync(testCsv, inputData, "utf8");

    let callbackExecuted = false;
    processCsvFile(testCsv, testOutput, () => {
      callbackExecuted = true;
    }, "nubank");

    expect(callbackExecuted).toBe(true);
    expect(fs.existsSync(testOutput)).toBe(true);

    // Clean up
    fs.unlinkSync(testCsv);
    fs.unlinkSync(testOutput);
  });

  it("should throw error if input file does not exist", () => {
    const nonExistentFile = path.join(OUTPUT_DIR, "non-existent.csv");
    const testOutput = path.join(OUTPUT_DIR, "nubank-error.csv");

    expect(() => {
      processCsvFile(nonExistentFile, testOutput, undefined, "nubank");
    }).toThrow();
  });
});
