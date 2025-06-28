import { processCsvFile } from "../src/process";
import fs from "fs";

processCsvFile("example.csv", "example.out.csv", () => {
  console.log(fs.readFileSync("example.out.csv", "utf8"));
});
