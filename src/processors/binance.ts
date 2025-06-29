import fs from "fs";
import Papa from "papaparse";
import i18next from "i18next";
import path from "path";

// --- i18next Initialization ---
// Load translation files for English and Brazilian Portuguese
const enTranslations = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "../locales/en/translation.json"),
    "utf8"
  )
);
const ptBRTranslations = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "../locales/pt-BR/translation.json"),
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

/**
 * Represents a row from the input CSV.
 */
export interface InputRow {
  [key: string]: string;
}

/**
 * Represents a row in the output CSV.
 */
export type OutputRow = {
  "Order Number": string;
  Description: string;
  "Created Time": string;
  Notes: string;
  Amount?: string;
  Income: boolean;
  Expense: boolean;
};

/**
 * Normalize CSV row keys (trim, remove BOM, etc).
 */
function normalizeRowKeys(row: InputRow): InputRow {
  const normalized: InputRow = {};
  for (const key in row) {
    let cleanKey = key.replace(/^\u00000/, "").trim();
    normalized[cleanKey] = row[key];
  }
  return normalized;
}

/**
 * Build the Notes field by joining all unused fields as key-value pairs.
 */
function buildNotes(row: InputRow, usedFields: string[]): string {
  const notesObj: Record<string, string> = {};
  for (const key in row) {
    if (!usedFields.includes(key)) {
      notesObj[key] = row[key];
    }
  }
  return Object.entries(notesObj)
    .filter(([_, v]) => v && v.trim() !== "")
    .map(([k, v]) => i18next.t("{{key}}: {{value}}", { key: k, value: v }))
    .join(" | ");
}

/**
 * Transform a regular transaction row.
 */
function transformRow(row: InputRow): OutputRow {
  row = normalizeRowKeys(row);
  const orderNumber = row["Order Number"];
  const orderType = row["Order Type"];
  const asset = row["Asset Type"] || "";
  const counterparty = row["Couterparty"] || "";
  let description = "";
  let income = false;
  let expense = false;
  if (orderType === "Buy") {
    description = i18next.t("Buy {{asset}} from {{counterparty}}", {
      asset,
      counterparty,
    });
    income = false;
    expense = true;
  } else if (orderType === "Sell") {
    description = i18next.t("Sell {{asset}} to {{counterparty}}", {
      asset,
      counterparty,
    });
    income = true;
    expense = false;
  } else {
    description = i18next.t("{{orderType}} {{asset}} with {{counterparty}}", {
      orderType,
      asset,
      counterparty,
    });
  }
  const createdTime = row["Created Time"];
  const usedFields = [
    "Order Number",
    "Order Type",
    "Asset Type",
    "Couterparty",
    "Created Time",
    "Total Price",
    "Taker Fee",
  ];
  const notes = buildNotes(row, usedFields);
  return {
    "Order Number": orderNumber,
    Description: description,
    "Created Time": createdTime,
    Notes: notes,
    Amount: row["Total Price"],
    Income: income,
    Expense: expense,
  };
}

/**
 * Create a fee row if Taker Fee is present and > 0.
 * Fee rows are always Expense only.
 */
function createFeeRow(row: InputRow): OutputRow | null {
  row = normalizeRowKeys(row);
  const takerFee = row["Taker Fee"];
  if (takerFee && parseFloat(takerFee) > 0) {
    const orderType = row["Order Type"];
    const asset = row["Asset Type"] || "";
    const counterparty = row["Couterparty"] || "";
    let description = "";
    // For fee rows, always: Income = false, Expense = true
    const income = false;
    const expense = true;
    if (orderType === "Buy") {
      description = i18next.t("Tax of {{asset}} from {{counterparty}}", {
        asset,
        counterparty,
      });
    } else if (orderType === "Sell") {
      description = i18next.t("Tax of {{asset}} to {{counterparty}}", {
        asset,
        counterparty,
      });
    } else {
      description = i18next.t("Tax of {{asset}} with {{counterparty}}", {
        asset,
        counterparty,
      });
    }
    // Use the same notes as the main row
    const usedFields = [
      "Order Number",
      "Order Type",
      "Asset Type",
      "Couterparty",
      "Created Time",
      "Taker Fee",
    ];
    const notes = buildNotes(row, usedFields);
    // Amount is always negative for fee rows
    let amount = takerFee.startsWith("-") ? takerFee : `-${takerFee}`;
    return {
      "Order Number": row["Order Number"],
      Description: description,
      "Created Time": row["Created Time"],
      Notes: notes,
      Amount: amount,
      Income: income,
      Expense: expense,
    };
  }
  return null;
}

/**
 * Process a CSV file, transforming and writing the output.
 */
export function processCsvFile(
  inputPath: string,
  outputPath: string,
  cb?: () => void
) {
  const csvData = fs.readFileSync(inputPath, "utf8");
  const parsed = Papa.parse<InputRow>(csvData, {
    header: true,
    skipEmptyLines: true,
  });
  let rows: OutputRow[] = [];
  for (const row of parsed.data) {
    const mainRow = transformRow(row);
    rows.push(mainRow);
    const feeRow = createFeeRow(row);
    if (feeRow) {
      rows.push(feeRow);
    }
  }
  const outputHeader = [
    "Order Number",
    "Description",
    "Created Time",
    "Notes",
    "Amount",
    "Income",
    "Expense",
  ];
  const csvOut = Papa.unparse(rows, {
    header: true,
    columns: outputHeader,
  });
  fs.writeFileSync(outputPath, csvOut);
  if (cb) cb();
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
