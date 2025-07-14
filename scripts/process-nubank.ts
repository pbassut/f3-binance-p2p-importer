#!/usr/bin/env ts-node

import fs from "fs";
import path from "path";
import axios from "axios";
import FormData from "form-data";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

async function processNubankCsv(csvPath: string) {
  const configPath = path.join(__dirname, "..", "src", "importer-configs", "nubank.json");
  
  if (!fs.existsSync(csvPath)) {
    console.error(`CSV file not found: ${csvPath}`);
    process.exit(1);
  }
  
  if (!fs.existsSync(configPath)) {
    console.error(`Config file not found: ${configPath}`);
    process.exit(1);
  }
  
  const formData = new FormData();
  formData.append("importable", fs.createReadStream(csvPath));
  formData.append("json", fs.createReadStream(configPath));
  
  console.log(`Processing Nubank CSV: ${csvPath}`);
  console.log(`Using config: ${configPath}`);
  const url = `${process.env.FIREFLY_URL}/dataimporter/autoupload?secret=${encodeURIComponent(process.env.FIREFLY_SECRET!)}`;
  console.log(`Sending to: ${url}`);
  
  try {
    const response = await axios.post(
      url,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          Authorization: `Bearer ${process.env.FIREFLY_TOKEN}`,
          Accept: "application/json",
        },
        maxBodyLength: Infinity,
      }
    );
    
    console.log("Success! Firefly-III import response:", response.data);
  } catch (error: any) {
    console.error("Error sending to Firefly-III:", error.message);
    if (error.response) {
      console.error("Response data:", error.response.data);
      console.error("Response status:", error.response.status);
    }
  }
}

// Get CSV file path from command line argument
const csvPath = process.argv[2];
if (!csvPath) {
  console.error("Usage: npm run process:nubank <csv-file-path>");
  process.exit(1);
}

processNubankCsv(csvPath);