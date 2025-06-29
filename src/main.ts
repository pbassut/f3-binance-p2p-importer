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
  const firstLine = fs.readFileSync(filePath, "utf8").split(/\r?\n/)[0];
  if (firstLine.includes("Order Number") && firstLine.includes("Order Type")) {
    return "binance";
  }
  if (
    firstLine.toLowerCase().includes("data;") ||
    firstLine.toLowerCase().includes("lançamentos")
  ) {
    return "itau";
  }
  return "binance"; // fallback
}

// API endpoint for file upload and forwarding to Firefly-III Data Importer
app.post("/api/upload", upload.single("file"), async (req, res) => {
  const { token, fireflyUrl, secret } = req.body;
  setI18nLanguage("pt-BR");
  if (!req.file) {
    return res
      .status(400)
      .json({ success: false, message: "No file uploaded" });
  }
  if (!token || !fireflyUrl || !secret) {
    return res.status(400).json({
      success: false,
      message: "Missing Firefly token, URL, or secret",
    });
  }
  const inputPath = req.file.path;
  const outputPath = inputPath + ".out.csv";
  const processorType = detectProcessorType(inputPath);
  try {
    // Process the uploaded file to the correct format
    await new Promise<void>((resolve, reject) => {
      processCsvFile(inputPath, outputPath, resolve, processorType);
    });

    // Path to the config file
    const configPath = path.join(
      __dirname,
      "importer-configs",
      "binance-p2p.json"
    );

    // Prepare form data
    const formData = new FormData();
    formData.append("importable", fs.createReadStream(outputPath));
    formData.append("json", fs.createReadStream(configPath));

    const url = `${fireflyUrl.replace(
      /\/$/,
      ""
    )}/dataimporter/autoupload?secret=${encodeURIComponent(secret)}`;
    console.log("posting to", url);
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
    res.json({ success: true, firefly: fireflyRes.data, processorType });
  } catch (err) {
    fs.unlink(inputPath, () => {});
    fs.unlink(outputPath, () => {});
    const error = err as any;
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
