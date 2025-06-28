"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processCsvFile = processCsvFile;
const fs_1 = __importDefault(require("fs"));
const papaparse_1 = __importDefault(require("papaparse"));
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
    const counterparty = row["Couterparty"] || "";
    if (type === "Buy") {
        description = `Compra de ${coin} de ${counterparty}`;
    }
    else if (type === "Sell") {
        description = `Venda de ${coin} para ${counterparty}`;
    }
    else {
        description = `${type} de ${coin} de/para ${counterparty}`;
    }
    const createdTime = row["Created Time"];
    const usedFields = [
        "Order Number",
        "Order Type",
        "Asset Type",
        "Couterparty",
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
    const csvData = fs_1.default.readFileSync(inputPath, "utf8");
    const parsed = papaparse_1.default.parse(csvData, { header: true, skipEmptyLines: true });
    const rows = parsed.data.map(transformRow);
    const csvOut = papaparse_1.default.unparse(rows, { header: true });
    fs_1.default.writeFileSync(outputPath, csvOut);
    if (cb)
        cb();
}
