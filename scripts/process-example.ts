import { processCsvFile, ProcessorType } from "../src/process";
import fs from "fs";

// Get command-line arguments (node scripts/process-example.ts input.csv output.csv type)
const [input, output, typeArg] = process.argv.slice(2);

const inputFile = input || "example.csv";
const outputFile = output || "example.out.csv";
const type: ProcessorType = (typeArg as ProcessorType) || "binance";

console.log(
  `Processing ${inputFile} -> ${outputFile} using processor: ${type}`
);

processCsvFile(
  inputFile,
  outputFile,
  () => {
    console.log(fs.readFileSync(outputFile, "utf8"));
  },
  type
);
