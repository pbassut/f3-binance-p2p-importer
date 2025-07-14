#!/usr/bin/env ts-node

import dotenv from "dotenv";

// Load environment variables
dotenv.config();

console.log("OAuth2 IMAP for Personal Microsoft Accounts\n");

console.log("Unfortunately, implementing OAuth2 for IMAP with personal Microsoft accounts requires:");
console.log("1. Registering an application in Azure AD");
console.log("2. Implementing OAuth2 authorization flow");
console.log("3. Using the access token with IMAP XOAUTH2");
console.log("\nThis is complex and still requires app registration.\n");

console.log("✅ RECOMMENDED ALTERNATIVES:\n");

console.log("1. Use Gmail for email monitoring:");
console.log("   - Gmail still supports IMAP with app passwords");
console.log("   - No OAuth required for personal use");
console.log("   - Update .env with Gmail settings\n");

console.log("2. Manual CSV processing:");
console.log("   - Save Nubank CSV from your email");
console.log("   - Run: npm run process:nubank /path/to/nubank.csv\n");

console.log("3. Web upload interface:");
console.log("   - Run: npm run dev");
console.log("   - Upload CSV at http://localhost:3001\n");

console.log("4. Forward emails to Gmail:");
console.log("   - Set up forwarding from Hotmail to Gmail");
console.log("   - Configure email monitoring with Gmail account\n");

// Show current processor configuration
if (process.env.EMAIL_PROCESSORS) {
  console.log("Current email processor configuration:");
  const processors = JSON.parse(process.env.EMAIL_PROCESSORS);
  processors.forEach((p: any) => {
    console.log(`  - ${p.senderEmail} → ${p.processorType} (${p.importerConfig})`);
  });
}