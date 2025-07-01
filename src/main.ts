import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import axios from "axios";
import FormData from "form-data";
import { processCsvFile, setI18nLanguage, ProcessorType } from "./process";

const app = express();
const upload = multer({ dest: path.join(__dirname, "../uploads") });

// Serve static files from the React app build
app.use(express.static(path.join(__dirname, "../frontend/dist")));

function detectProcessorType(filePath: string): ProcessorType {
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/).slice(0, 20);
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.includes("order number") && lower.includes("order type")) {
      return "binance";
    }
    // Itau: look for a header with 'data;' and 'valor (r$)' (semicolon-delimited)
    if (lower.includes("data;") && lower.includes("valor (r$)")) {
      return "itau";
    }
  }
  return "binance"; // fallback
}

// API endpoint for file upload and forwarding to Firefly-III Data Importer
app.post("/api/upload", upload.single("file"), async (req, res) => {
  const { token, fireflyUrl, secret } = req.body;
  setI18nLanguage("pt-BR");
  if (!req.file) {
    console.log("No file uploaded");
    return res
      .status(400)
      .json({ success: false, message: "No file uploaded" });
  }
  if (!token || !fireflyUrl || !secret) {
    console.log("Missing Firefly token, URL, or secret");
    return res.status(400).json({
      success: false,
      message: "Missing Firefly token, URL, or secret",
    });
  }
  const inputPath = req.file.path;
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

app.listen(3001, () => console.log("Test server running on 3001"));
