// Nubank CSV Pass-through Processor
// Simply copies the input CSV to output without any transformations

import fs from "fs";
import i18next from "i18next";

export interface InputRow {
  [key: string]: string;
}

export type OutputRow = InputRow;

/**
 * Process a CSV file by passing it through without any transformations.
 * This processor simply reads the input file and writes it to the output path.
 */
export function processCsvFile(
  inputPath: string,
  outputPath: string,
  cb?: () => void
) {
  try {
    const csvData = fs.readFileSync(inputPath, "utf8");
    fs.writeFileSync(outputPath, csvData, "utf8");
    if (cb) cb();
  } catch (error) {
    console.error(`Error processing Nubank CSV: ${error}`);
    throw error;
  }
}

/**
 * Utility to set i18next language.
 */
export function setI18nLanguage(lang: string) {
  if (!lang) return;
  if (i18next.language !== lang) {
    i18next.changeLanguage(lang);
  }
}
