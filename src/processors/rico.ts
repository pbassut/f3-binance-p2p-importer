// Rico CSV Processor - Passthrough with BOM removal

import fs from "fs";
import i18next from "i18next";

export interface InputRow {
  [key: string]: string;
}

export type OutputRow = InputRow;

export function processCsvFile(
  inputPath: string,
  outputPath: string,
  cb?: () => void
) {
  console.log(`Rico processor: Processing ${inputPath} -> ${outputPath}`);
  
  // Read the CSV file and remove BOM if present
  const csvContent = fs.readFileSync(inputPath, "utf8");
  const hasBOM = csvContent.charCodeAt(0) === 0xFEFF;
  if (hasBOM) {
    console.log("Rico processor: BOM detected, removing it");
  }
  const cleanContent = csvContent.replace(/^\uFEFF/, '');
  
  // Log first line for debugging
  const firstLine = cleanContent.split(/\r?\n/)[0];
  console.log(`Rico processor: First line: ${firstLine}`);
  
  // Write the content without BOM
  fs.writeFileSync(outputPath, cleanContent, "utf8");
  console.log(`Rico processor: File written successfully`);
  
  if (cb) cb();
}

export function setI18nLanguage(lang: string) {
  if (!lang) return;
  if (i18next.language !== lang) {
    i18next.changeLanguage(lang);
  }
}