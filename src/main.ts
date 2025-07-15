import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import axios from "axios";
import FormData from "form-data";
import { processCsvFile, setI18nLanguage, ProcessorType } from "./process";
import dotenv from "dotenv";
import { EmailMonitor } from "./email/email-monitor";
import { EmailMonitorConfig } from "./email/email-config";
import * as XLSX from "xlsx";

// Load environment variables from .env file
dotenv.config();

const app = express();
const upload = multer({ dest: path.join(__dirname, "../uploads") });

// Serve static files from the React app build
app.use(express.static(path.join(__dirname, "../frontend/dist")));

function convertXlsToCsv(xlsPath: string): string {
  console.log(`Converting XLS file to CSV: ${xlsPath}`);
  
  // Read the Excel file
  const workbook = XLSX.readFile(xlsPath);
  
  // Get the first worksheet
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  // Convert to CSV
  const csvContent = XLSX.utils.sheet_to_csv(worksheet);
  
  // Process the CSV to extract only transaction data
  const lines = csvContent.split('\n');
  const transactions: string[] = ['data,lançamento,valor']; // Header for output
  
  let inTransactionSection = false;
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Look for transaction header
    if (trimmedLine.startsWith('data,lançamento,') && trimmedLine.includes('valor')) {
      inTransactionSection = true;
      continue; // Skip the header line itself
    }
    
    // Stop at total lines or empty sections
    if (inTransactionSection && (
      trimmedLine.includes('total') || 
      trimmedLine === ',' || 
      trimmedLine === '' ||
      trimmedLine === ',,,'
    )) {
      inTransactionSection = false;
      continue;
    }
    
    // Collect transaction lines
    if (inTransactionSection && trimmedLine && !trimmedLine.startsWith(',')) {
      // Handle CSV with potential quoted values containing commas
      const dateMatch = line.match(/^(\d{2}\/\d{2}\/\d{4}),/);
      if (dateMatch) {
        const date = dateMatch[1];
        
        // Extract description and value using regex to handle quoted values
        const restOfLine = line.substring(dateMatch[0].length);
        
        // Try to match: description,,"quoted value" or description,,value or description,value
        const match = restOfLine.match(/^([^,]+),+["']?R?\$?\s*([\d,]+\.?\d*)["']?\s*$/);
        if (match) {
          const description = match[1].trim();
          const value = match[2].replace(/,/g, ''); // Remove thousand separators
          
          if (date && description && value) {
            transactions.push(`${date},${description},${value}`);
          }
        }
      }
    }
  }
  
  // Write to a temporary CSV file
  const csvPath = xlsPath + '.csv';
  fs.writeFileSync(csvPath, transactions.join('\n'), 'utf8');
  
  console.log(`XLS converted to CSV with ${transactions.length - 1} transactions: ${csvPath}`);
  return csvPath;
}

function detectProcessorType(filePath: string): ProcessorType {
  console.log(`Detecting processor type for file: ${filePath}`);
  const content = fs.readFileSync(filePath, "utf8");
  
  // Check for BOM
  const hasBOM = content.charCodeAt(0) === 0xFEFF;
  if (hasBOM) {
    console.log("BOM detected in file, removing it");
  }
  
  // Remove BOM if present
  const cleanContent = content.replace(/^\uFEFF/, '');
  const lines = cleanContent.split(/\r?\n/).slice(0, 20);
  
  console.log(`First line of file: ${lines[0]}`);
  
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.includes("order number") && lower.includes("order type")) {
      console.log("Detected Binance format");
      return "binance";
    }
    // Itau Credit Card: look for comma-delimited header with 'data,lançamento,valor'
    if (lower === "data,lançamento,valor" || (lower.includes("data,") && lower.includes("lançamento,") && lower.includes("valor") && !lower.includes(";"))) {
      console.log("Detected Itaú Credit Card format");
      return "itau-creditcard";
    }
    // Itau: look for a header with 'data;' and 'valor (r$)' (semicolon-delimited)
    if (lower.includes("data;") && lower.includes("valor (r$)")) {
      console.log("Detected Itaú format");
      return "itau";
    }
    // Deel: look for specific headers
    if (lower.includes("transaction id") && lower.includes("transaction type") && lower.includes("payment method")) {
      console.log("Detected Deel format");
      return "deel";
    }
    // Rico: look for semicolon-delimited headers with Data;Estabelecimento;Portador;Valor;Parcela
    if (lower.includes("data;estabelecimento;portador;valor;parcela")) {
      console.log("Detected Rico format");
      return "rico";
    }
  }
  console.log("No specific format detected, falling back to Binance");
  return "binance"; // fallback
}

// API endpoint for file upload and forwarding to Firefly-III Data Importer
app.post("/api/upload", upload.single("file"), async (req, res) => {
  console.log("=== File upload endpoint hit ===");
  const token = process.env.FIREFLY_TOKEN;
  const fireflyUrl = process.env.FIREFLY_URL;
  const secret = process.env.FIREFLY_SECRET;
  
  setI18nLanguage("pt-BR");
  if (!req.file) {
    console.log("No file uploaded");
    return res
      .status(400)
      .json({ success: false, message: "No file uploaded" });
  }
  if (!token || !fireflyUrl || !secret) {
    console.log("Missing Firefly environment variables (FIREFLY_TOKEN, FIREFLY_URL, FIREFLY_SECRET)");
    return res.status(400).json({
      success: false,
      message: "Missing Firefly environment variables. Please set FIREFLY_TOKEN, FIREFLY_URL, and FIREFLY_SECRET",
    });
  }
  let inputPath = req.file.path;
  const originalName = req.file.originalname.toLowerCase();
  
  // Check if the file is an Excel file and convert it to CSV
  if (originalName.endsWith('.xls') || originalName.endsWith('.xlsx')) {
    console.log(`Excel file detected: ${originalName}`);
    inputPath = convertXlsToCsv(inputPath);
  }
  
  const outputPath = inputPath + ".out.csv";
  const processorType = detectProcessorType(inputPath);
  console.log(
    `File uploaded: ${inputPath}, detected processor: ${processorType}`
  );
  try {
    // Process the uploaded file to the correct format
    console.log(`Processing file with ${processorType} processor...`);
    await new Promise<void>((resolve, reject) => {
      processCsvFile(inputPath, outputPath, resolve, processorType);
    });
    console.log(`Processing complete: ${outputPath}`);
    // Path to the config file
    const configPath = path.join(
      __dirname,
      "importer-configs",
      `${processorType}.json`
    );
    console.log(`Using config file: ${configPath}`);
    // Prepare form data
    const formData = new FormData();
    formData.append("importable", fs.createReadStream(outputPath));
    formData.append("json", fs.createReadStream(configPath));
    const url = `${fireflyUrl.replace(
      /\/$/,
      ""
    )}/dataimporter/autoupload?secret=${encodeURIComponent(secret)}`;
    console.log(`Posting to Firefly: ${url}`);
    const fireflyRes = await axios.post(url, formData, {
      headers: {
        ...formData.getHeaders(),
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      maxBodyLength: Infinity,
    });
    fs.unlink(inputPath, () => {});
    fs.unlink(outputPath, () => {});
    console.log("Upload and import successful.");
    res.json({ success: true, firefly: fireflyRes.data, processorType });
  } catch (err) {
    fs.unlink(inputPath, () => {});
    fs.unlink(outputPath, () => {});
    const error = err as any;
    console.error("Error during upload or processing:", error);
    res
      .status(500)
      .json({ success: false, message: error.response?.data || error.message });
  }
});

// All other GET requests not handled before will return the React app
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/dist/index.html"));
});

// Initialize email monitor if configured
let emailMonitor: EmailMonitor | null = null;

if (process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASSWORD && process.env.EMAIL_DISABLED !== "true") {
  try {
    // Parse email processor configuration from environment
    const emailProcessors = process.env.EMAIL_PROCESSORS 
      ? JSON.parse(process.env.EMAIL_PROCESSORS)
      : [];

    const emailConfig: EmailMonitorConfig = {
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT || "993"),
      tls: process.env.EMAIL_TLS !== "false",
      user: process.env.EMAIL_USER,
      password: process.env.EMAIL_PASSWORD,
      mailbox: process.env.EMAIL_MAILBOX || "INBOX",
      checkIntervalMinutes: parseInt(process.env.EMAIL_CHECK_INTERVAL || "5"),
      processors: emailProcessors
    };

    emailMonitor = new EmailMonitor(emailConfig);
    emailMonitor.start();
    console.log("Email monitoring started");
  } catch (error) {
    console.error("Failed to start email monitoring:", error);
  }
} else {
  console.log("Email monitoring not configured. Set EMAIL_HOST, EMAIL_USER, and EMAIL_PASSWORD to enable.");
}

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("Shutting down gracefully...");
  if (emailMonitor) {
    emailMonitor.stop();
  }
  process.exit(0);
});

app.listen(3001, () => console.log("Test server running on 3001"));
