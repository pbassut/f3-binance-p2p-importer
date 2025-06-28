import fs from "fs";
import Papa from "papaparse";
import i18next from "i18next";
import path from "path";

// Load translation files
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

export interface InputRow {
  [key: string]: string;
}

export type OutputRow = {
  "Order Number": string;
  "Order Type": string;
  Description: string;
  "Created Time": string;
  Notes: string;
  Amount?: string;
};

function normalizeRowKeys(row: InputRow): InputRow {
  const normalized: InputRow = {};
  for (const key in row) {
    let cleanKey = key.replace(/^\uFEFF/, "").trim();
    normalized[cleanKey] = row[key];
  }
  return normalized;
}

function transformRow(row: InputRow): OutputRow {
  row = normalizeRowKeys(row);
  const orderNumber = row["Order Number"];
  const orderType = row["Order Type"];
  let description = "";
  const asset = row["Asset Type"] || "";
  const counterparty = row["Couterparty"] || "";
  if (orderType === "Buy") {
    description = i18next.t("Buy {{asset}} from {{counterparty}}", {
      asset,
      counterparty,
    });
  } else if (orderType === "Sell") {
    description = i18next.t("Sell {{asset}} to {{counterparty}}", {
      asset,
      counterparty,
    });
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
  const notesObj: Record<string, string> = {};
  for (const key in row) {
    if (!usedFields.includes(key)) {
      notesObj[key] = row[key];
    }
  }
  const notes = Object.entries(notesObj)
    .filter(([_, v]) => v && v.trim() !== "")
    .map(([k, v]) => i18next.t("{{key}}: {{value}}", { key: k, value: v }))
    .join(" | ");
  return {
    "Order Number": orderNumber,
    "Order Type": orderType,
    Description: description,
    "Created Time": createdTime,
    Notes: notes,
    Amount: row["Total Price"],
  };
}

function createFeeRow(row: InputRow): OutputRow | null {
  row = normalizeRowKeys(row);
  const takerFee = row["Taker Fee"];
  if (takerFee && parseFloat(takerFee) > 0) {
    const orderType = row["Order Type"];
    const asset = row["Asset Type"] || "";
    const counterparty = row["Couterparty"] || "";
    let description = "";
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
    const notes = Object.entries(row)
      .filter(
        ([key]) =>
          ![
            "Order Number",
            "Order Type",
            "Asset Type",
            "Couterparty",
            "Created Time",
            "Taker Fee",
          ].includes(key)
      )
      .filter(([_, v]) => v && v.trim() !== "")
      .map(([k, v]) => i18next.t("{{key}}: {{value}}", { key: k, value: v }))
      .join(" | ");
    return {
      "Order Number": row["Order Number"],
      "Order Type": orderType,
      Description: description,
      "Created Time": row["Created Time"],
      Notes: notes,
      Amount: takerFee,
    };
  }
  return null;
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
    const mainRow = transformRow(row);
    rows.push(mainRow);
    const feeRow = createFeeRow(row);
    if (feeRow) {
      rows.push(feeRow);
    }
  }
  const outputHeader = [
    "Order Number",
    "Order Type",
    "Description",
    "Created Time",
    "Notes",
    "Amount",
  ];
  const csvOut = Papa.unparse(rows, {
    header: true,
    columns: outputHeader,
  });
  fs.writeFileSync(outputPath, csvOut);
  if (cb) cb();
}

// Utility to set i18next language
export function setI18nLanguage(lang: string) {
  if (!lang) return;
  if (i18next.language !== lang) {
    i18next.changeLanguage(lang);
  }
}
