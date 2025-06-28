"use strict";
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const process_1 = require("./process");
const INPUT_DIR = "input";
const OUTPUT_DIR = "output";
if (!fs_1.default.existsSync(INPUT_DIR)) fs_1.default.mkdirSync(INPUT_DIR);
if (!fs_1.default.existsSync(OUTPUT_DIR)) fs_1.default.mkdirSync(OUTPUT_DIR);
// Processa arquivos já existentes ao iniciar
fs_1.default
  .readdirSync(INPUT_DIR)
  .filter((f) => f.endsWith(".csv"))
  .forEach((f) => {
    const filePath = path_1.default.join(INPUT_DIR, f);
    const outputPath = path_1.default.join(OUTPUT_DIR, f);
    (0, process_1.processCsvFile)(filePath, outputPath);
  });
fs_1.default.watch(INPUT_DIR, (eventType, filename) => {
  if (filename && filename.endsWith(".csv") && eventType === "rename") {
    const filePath = path_1.default.join(INPUT_DIR, filename);
    setTimeout(() => {
      if (fs_1.default.existsSync(filePath)) {
        const outputPath = path_1.default.join(OUTPUT_DIR, filename);
        (0, process_1.processCsvFile)(filePath, outputPath);
      }
    }, 500);
  }
});
console.log(`Monitorando a pasta '${INPUT_DIR}' por novos arquivos CSV...`);
