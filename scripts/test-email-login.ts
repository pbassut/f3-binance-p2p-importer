#!/usr/bin/env ts-node

import Imap from "imap";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

console.log("Testing Microsoft/Hotmail IMAP login...\n");

// Display connection info (with masked password)
console.log("Connection details:");
console.log(`Host: ${process.env.EMAIL_HOST}`);
console.log(`Port: ${process.env.EMAIL_PORT}`);
console.log(`TLS: ${process.env.EMAIL_TLS}`);
console.log(`User: ${process.env.EMAIL_USER}`);
console.log(`Password: ${process.env.EMAIL_PASSWORD ? '***' + process.env.EMAIL_PASSWORD.slice(-4) : 'NOT SET'}`);
console.log(`Mailbox: ${process.env.EMAIL_MAILBOX || 'INBOX'}\n`);

if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
  console.error("❌ Missing required environment variables!");
  console.error("Please ensure EMAIL_HOST, EMAIL_USER, and EMAIL_PASSWORD are set in .env");
  process.exit(1);
}

const imap = new Imap({
  user: process.env.EMAIL_USER,
  password: process.env.EMAIL_PASSWORD,
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || "993"),
  tls: process.env.EMAIL_TLS === "true",
  tlsOptions: { rejectUnauthorized: false },
  debug: console.log // Enable debug output
});

imap.once("ready", () => {
  console.log("\n✅ SUCCESS! IMAP connection ready");
  console.log("Authentication successful!\n");
  
  // Try to open the mailbox
  imap.openBox(process.env.EMAIL_MAILBOX || "INBOX", true, (err, box) => {
    if (err) {
      console.error("❌ Error opening mailbox:", err);
    } else {
      console.log(`📧 Mailbox opened successfully!`);
      console.log(`Total messages: ${box.messages.total}`);
      console.log(`New messages: ${box.messages.new}`);
      console.log(`Unread messages: ${box.messages.unseen || 'N/A'}`);
    }
    
    console.log("\nClosing connection...");
    imap.end();
  });
});

imap.once("error", (err: Error) => {
  console.error("\n❌ IMAP Error:", err.message);
  
  if (err.message.includes("LOGIN failed")) {
    console.error("\n🔐 Authentication failed. Common causes:");
    console.error("1. Incorrect password");
    console.error("2. Need to use an app-specific password");
    console.error("3. 2-factor authentication is required");
    console.error("\nFor Hotmail/Outlook:");
    console.error("- Go to https://account.microsoft.com/security");
    console.error("- Enable 2-factor authentication");
    console.error("- Create an app password under 'Advanced security options'");
    console.error("- Use the 16-character app password (without spaces) in .env");
  }
});

imap.once("end", () => {
  console.log("Connection ended");
});

console.log("Attempting to connect...\n");
imap.connect();