import fs from "fs";
import i18next from "i18next";
import path from "path";
import * as binance from "./processors/binance";
import * as itau from "./processors/itau";
import * as deel from "./processors/deel";

// --- i18next Initialization ---
// Load translation files for English and Brazilian Portuguese
const enTranslations = JSON.parse(
  fs.readFileSync(path.join(__dirname, "locales/en/translation.json"), "utf8")
);
const ptBRTranslations = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "locales/pt-BR/translation.json"),
    "utf8"
  )
);

if (!i18next.isInitialized) {
  i18next.init({
    lng: "pt-BR",
    fallbackLng: "pt-BR",
    resources: {
      en: { translation: enTranslations },
      "pt-BR": { translation: ptBRTranslations },
    },
  });
}

export type ProcessorType = "binance" | "itau" | "deel";

export type InputRow = binance.InputRow;
export type OutputRow = binance.OutputRow;

interface Processor {
  processCsvFile: (
    inputPath: string,
    outputPath: string,
    cb?: () => void
  ) => void;
  setI18nLanguage: (lang: string) => void;
}

function getProcessor(type: ProcessorType = "binance"): Processor {
  switch (type) {
    case "itau":
      return itau;
    case "deel":
      return deel;
    case "binance":
    default:
      return binance;
  }
}

export function processCsvFile(
  inputPath: string,
  outputPath: string,
  cb?: () => void,
  type: ProcessorType = "binance"
) {
  return getProcessor(type).processCsvFile(inputPath, outputPath, cb);
}

export function setI18nLanguage(lang: string, type: ProcessorType = "binance") {
  return getProcessor(type).setI18nLanguage(lang);
}
