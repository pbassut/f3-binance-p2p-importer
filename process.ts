import fs from "fs";
import Papa from "papaparse";

export interface InputRow {
  [key: string]: string;
}

export interface OutputRow {
  "Order Number": string;
  Description: string;
  "Created Time": string;
  Notes: string;
}

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
    description = `Buy ${asset} from ${counterparty}`;
  } else if (orderType === "Sell") {
    description = `Sell ${asset} to ${counterparty}`;
  } else {
    description = `${orderType} ${asset} with ${counterparty}`;
  }
  const createdTime = row["Created Time"];
  const usedFields = [
    "Order Number",
    "Order Type",
    "Asset Type",
    "Couterparty",
    "Created Time",
  ];
  const notesObj: Record<string, string> = {};
  for (const key in row) {
    if (!usedFields.includes(key)) {
      notesObj[key] = row[key];
    }
  }
  const notes = Object.entries(notesObj)
    .filter(([_, v]) => v && v.trim() !== "")
    .map(([k, v]) => `${k}: ${v}`)
    .join(" | ");
  return {
    "Order Number": orderNumber,
    Description: description,
    "Created Time": createdTime,
    Notes: notes,
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
  const rows = parsed.data.map(transformRow);
  const csvOut = Papa.unparse(rows, { header: true });
  fs.writeFileSync(outputPath, csvOut);
  if (cb) cb();
}
