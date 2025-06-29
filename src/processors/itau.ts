// Itau CSV Processor (stub)

import fs from "fs";
import Papa from "papaparse";
import i18next from "i18next";

export interface InputRow {
  [key: string]: string;
}

export type OutputRow = {
  Date: string;
  Description: string;
  Value: string;
};

function isTransactionLine(line: string[]): boolean {
  // Check if first column is a date in DD/MM/YYYY
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(line[0])) return false;
  // Check if value is a number (allow negative, comma decimal)
  if (!line[3] || !/^-?\d{1,3}(\.\d{3})*,\d{2}$/.test(line[3])) return false;
  // Ignore known balance/metadata descriptions
  const desc = (line[1] || "").toUpperCase();
  if (
    desc.includes("SALDO") ||
    desc.includes("BALANCE") ||
    desc.includes("DISPON") // encoding errors
  ) {
    return false;
  }
  return true;
}

function parseValue(val: string): string {
  // Convert -1.234,56 to -1234.56
  return val
    .replace(/\./g, "") // remove thousand sep
    .replace(",", ".");
}

function toISODate(date: string): string {
  // Convert DD/MM/YYYY to YYYY-MM-DD
  const [d, m, y] = date.split("/");
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

export function processCsvFile(
  inputPath: string,
  outputPath: string,
  cb?: () => void
) {
  // Read as latin1, output as utf8
  const raw = fs.readFileSync(inputPath, "latin1");
  const lines = raw.split(/\r?\n/);
  // Find header line
  const headerIdx = lines.findIndex((l) =>
    l.toLowerCase().startsWith("transactions;")
  );
  if (headerIdx === -1) throw new Error("No Itau data header found");
  const dataLines = lines.slice(headerIdx + 1);
  const rows: OutputRow[] = [];
  for (const line of dataLines) {
    if (!line.trim()) continue;
    const cols = line.split(";");
    if (!isTransactionLine(cols)) continue;
    // Remove double spaces and special chars from description
    let desc = (cols[1] || "")
      .replace(/\s+/g, " ")
      .replace(/[^\w\s\-.,/]/g, "")
      .trim();
    rows.push({
      Date: toISODate(cols[0]),
      Description: desc,
      Value: parseValue(cols[3]),
    });
  }
  // Remove duplicates
  const uniqueRows = Array.from(
    new Map(rows.map((r) => [JSON.stringify(r), r])).values()
  );
  // Sort by Date
  uniqueRows.sort((a, b) => a.Date.localeCompare(b.Date));
  // Write as UTF-8 CSV with comma delimiter
  const csvOut = Papa.unparse(uniqueRows, {
    header: true,
    columns: ["Date", "Description", "Value"],
    delimiter: ",",
  });
  fs.writeFileSync(outputPath, csvOut, "utf8");
  if (cb) cb();
}

export function setI18nLanguage(lang: string) {
  if (!lang) return;
  if (i18next.language !== lang) {
    i18next.changeLanguage(lang);
  }
}
