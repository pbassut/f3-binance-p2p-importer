// Itau Credit Card CSV Processor

import fs from "fs";
import Papa from "papaparse";
import i18next from "i18next";

export interface InputRow {
  data: string;
  lançamento: string;
  valor: string;
}

export type OutputRow = {
  Date: string;
  Description: string;
  Amount: string;
  Expense: string;
  Income: string;
};

function toISODate(date: string): string {
  // Check if date is in DD/MM/YYYY format
  if (date.includes('/')) {
    const [d, m, y] = date.split('/');
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // Already in YYYY-MM-DD format
  return date;
}

function cleanDescription(desc: string): string {
  // Remove extra spaces and keep important info
  return desc
    .replace(/\s+/g, " ")
    .trim();
}

export function processCsvFile(
  inputPath: string,
  outputPath: string,
  cb?: () => void
) {
  // Read the CSV file
  const fileContent = fs.readFileSync(inputPath, "utf8");
  
  // Parse the CSV
  Papa.parse<InputRow>(fileContent, {
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      const rows: OutputRow[] = [];
      
      for (const row of results.data) {
        if (!row.data || !row.valor) continue;
        
        // Flip signal: Credit card transactions become income (negative values)
        const amount = row.valor;
        
        rows.push({
          Date: toISODate(row.data),
          Description: cleanDescription(row.lançamento || ""),
          Amount: amount,
          Expense: "", // Flipped: no longer expense
          Income: amount // Flipped: now income
        });
      }
      
      // Sort by Date descending (newest first)
      rows.sort((a, b) => b.Date.localeCompare(a.Date));
      
      // Write as UTF-8 CSV
      const csvOut = Papa.unparse(rows, {
        header: true,
        columns: ["Date", "Description", "Amount", "Expense", "Income"],
        delimiter: ","
      });
      
      fs.writeFileSync(outputPath, csvOut, "utf8");
      
      if (cb) cb();
    },
    error: (error: Error) => {
      console.error("Error parsing CSV:", error);
      throw error;
    }
  });
}

export function setI18nLanguage(lang: string) {
  if (!lang) return;
  if (i18next.language !== lang) {
    i18next.changeLanguage(lang);
  }
}