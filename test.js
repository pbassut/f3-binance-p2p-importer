const fs = require("fs");
const path = require("path");
const Papa = require("papaparse");
const { processCsvFile } = require("./process");

const INPUT_DIR = "input";
const OUTPUT_DIR = "output";
const EXAMPLE_CSV = "example.csv";
const TEST_INPUT = path.join(INPUT_DIR, "test.csv");
const TEST_OUTPUT = path.join(OUTPUT_DIR, "test.csv");

// Prepara ambiente
if (!fs.existsSync(INPUT_DIR)) fs.mkdirSync(INPUT_DIR);
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);
if (fs.existsSync(TEST_INPUT)) fs.unlinkSync(TEST_INPUT);
if (fs.existsSync(TEST_OUTPUT)) fs.unlinkSync(TEST_OUTPUT);

// Copia o exemplo para a pasta de input
fs.copyFileSync(EXAMPLE_CSV, TEST_INPUT);

// Processa diretamente o arquivo de teste
processCsvFile(TEST_INPUT, TEST_OUTPUT, () => {
  // Lê e valida o output usando papaparse
  const csv = fs.readFileSync(TEST_OUTPUT, "utf8");
  const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });
  for (const row of parsed.data) {
    if (!row["Order Number"]) throw new Error("Order Number ausente");
    if (!row["Created Time"]) throw new Error("Created Time ausente");
    if (row["Notes"] === undefined) throw new Error("Notes ausente");
    // Validação do Description
    if (row["Description"].startsWith("Venda")) {
      if (!/^Venda de USDT para Anon[A-D]$/.test(row["Description"])) {
        throw new Error(
          "Description incorreta para SELL: " + row["Description"]
        );
      }
    } else if (row["Description"].startsWith("Compra")) {
      if (!/^Compra de USDT de AnonE$/.test(row["Description"])) {
        throw new Error(
          "Description incorreta para BUY: " + row["Description"]
        );
      }
    } else {
      throw new Error("Description não reconhecida: " + row["Description"]);
    }
  }
  console.log("Teste passou!");
  // Limpeza
  fs.unlinkSync(TEST_INPUT);
  fs.unlinkSync(TEST_OUTPUT);
});
