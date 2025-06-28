const fs = require("fs");
const path = require("path");
const { processCsvFile } = require("./process");

const INPUT_DIR = "input";
const OUTPUT_DIR = "output";

if (!fs.existsSync(INPUT_DIR)) fs.mkdirSync(INPUT_DIR);
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

// Processa arquivos já existentes ao iniciar
fs.readdirSync(INPUT_DIR)
  .filter((f) => f.endsWith(".csv"))
  .forEach((f) => {
    const filePath = path.join(INPUT_DIR, f);
    const outputPath = path.join(OUTPUT_DIR, f);
    processCsvFile(filePath, outputPath);
  });

fs.watch(INPUT_DIR, (eventType, filename) => {
  if (filename && filename.endsWith(".csv") && eventType === "rename") {
    const filePath = path.join(INPUT_DIR, filename);
    setTimeout(() => {
      if (fs.existsSync(filePath)) {
        const outputPath = path.join(OUTPUT_DIR, filename);
        processCsvFile(filePath, outputPath);
      }
    }, 500);
  }
});

console.log(`Monitorando a pasta '${INPUT_DIR}' por novos arquivos CSV...`);
