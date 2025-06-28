const fs = require("fs");
const Papa = require("papaparse");

function normalizeRowKeys(row) {
  const normalized = {};
  for (const key in row) {
    let cleanKey = key.replace(/^\uFEFF/, "").trim();
    normalized[cleanKey] = row[key];
  }
  return normalized;
}

function transformRow(row) {
  row = normalizeRowKeys(row);
  const orderNumber = row["Order Number"];
  let type = row["Order Type"];
  let description = "";
  const coin = row["Asset Type"] || "";
  const seller = row["Description"] || "";
  if (type === "Buy") {
    description = `Compra de ${coin} de ${seller}`;
  } else if (type === "Sell") {
    description = `Venda de ${coin} para ${seller}`;
  } else {
    description = `${type} de ${coin} de/para ${seller}`;
  }
  const createdTime = row["Created Time"];
  const usedFields = [
    "Order Number",
    "Order Type",
    "Asset Type",
    "Description",
    "Created Time",
  ];
  const notesObj = {};
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

function processCsvFile(inputPath, outputPath, cb) {
  const csvData = fs.readFileSync(inputPath, "utf8");
  const parsed = Papa.parse(csvData, { header: true, skipEmptyLines: true });
  const rows = parsed.data.map(transformRow);
  const csvOut = Papa.unparse(rows, { header: true });
  fs.writeFileSync(outputPath, csvOut);
  if (cb) cb();
}

module.exports = { processCsvFile };
