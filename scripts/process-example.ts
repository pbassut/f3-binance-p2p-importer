import { processCsvFile } from "../src/process";
import fs from "fs";

// Get command-line arguments (node scripts/process-example.ts input.csv output.csv)
const [input, output] = process.argv.slice(2);

const inputFile = input || "example.csv";
const outputFile = output || "example.out.csv";

processCsvFile(inputFile, outputFile, () => {
  console.log(fs.readFileSync(outputFile, "utf8"));
});
