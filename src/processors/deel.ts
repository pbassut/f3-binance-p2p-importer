import fs from "fs";
import Papa from "papaparse";
import i18next from "i18next";
import path from "path";

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

export interface InputRow {
  [key: string]: string;
}

export type OutputRow = {
  "Transaction ID": string;
  Description: string;
  "Date Requested": string;
  Notes: string;
  Amount?: string;
  Income: boolean;
  Expense: boolean;
};

function normalizeRowKeys(row: InputRow): InputRow {
  const normalized: InputRow = {};
  for (const key in row) {
    let cleanKey = key.replace(/^\ufeff/, "").trim();
    normalized[cleanKey] = row[key];
  }
  return normalized;
}

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

function transformRow(row: InputRow): OutputRow {
  row = normalizeRowKeys(row);
  
  const transactionId = row["ID"];
  const transactionType = row["Transaction Type"];
  const transactionAmount = parseFloat(row["Transaction Amount"] || "0");
  const client = row["Client"];
  const contractName = row["Contract Name"];
  const withdrawMethod = row["Withdraw Method"];
  
  let description = "";
  let income = false;
  let expense = false;

  switch (transactionType) {
    case "client_payment":
      description = i18next.t("Payment from {{client}} for {{contract}}", {
        client: client || "Client",
        contract: contractName || "Contract",
      });
      income = transactionAmount > 0;
      expense = transactionAmount < 0;
      break;
    
    case "withdrawal":
      description = i18next.t("Withdrawal via {{method}}", {
        method: withdrawMethod || "Bank Transfer",
      });
      income = transactionAmount > 0;
      expense = transactionAmount < 0;
      break;
    
    case "advance":
      description = i18next.t("Advance payment");
      income = transactionAmount > 0;
      expense = transactionAmount < 0;
      break;
    
    case "advance_repayment":
      description = i18next.t("Advance repayment");
      income = transactionAmount > 0;
      expense = transactionAmount < 0;
      break;
    
    default:
      description = i18next.t("{{type}} transaction", {
        type: transactionType || "Unknown",
      });
      income = transactionAmount > 0;
      expense = transactionAmount < 0;
  }

  const usedFields = [
    "ID",
    "Date Requested", 
    "Transaction Type",
    "Transaction Amount",
    "Currency",
    "Client",
    "Contract Name",
    "Withdraw Method",
  ];
  
  const notes = buildNotes(row, usedFields);

  return {
    "Transaction ID": transactionId,
    Description: description,
    "Date Requested": row["Date Requested"],
    Notes: notes,
    Amount: row["Transaction Amount"],
    Income: income,
    Expense: expense,
  };
}

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
    const transformedRow = transformRow(row);
    rows.push(transformedRow);
  }

  const outputHeader = [
    "Transaction ID",
    "Description", 
    "Date Requested",
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

export function setI18nLanguage(lang: string) {
  if (!lang) return;
  if (i18next.language !== lang) {
    i18next.changeLanguage(lang);
  }
}