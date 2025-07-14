# Email Monitoring Setup Guide

## Important Note for Microsoft/Hotmail/Outlook.com Users

As of 2023, Microsoft has **disabled basic authentication** (username/password) for IMAP access to Outlook.com, Hotmail, and other Microsoft email services. This means:

- ❌ IMAP with passwords no longer works
- ❌ App-specific passwords don't work for IMAP
- ✅ Only OAuth 2.0 authentication is supported

### Alternatives for Microsoft Account Users

1. **Use Microsoft Graph API** (requires app registration in Azure)
2. **Switch to a different email provider** like Gmail
3. **Use manual CSV processing** instead of email monitoring

## Gmail Setup (Recommended)

Gmail still supports IMAP with app passwords:

1. Enable 2-factor authentication at https://myaccount.google.com/security
2. Generate an app password at https://myaccount.google.com/apppasswords
3. Update your `.env` file:

```env
EMAIL_HOST=imap.gmail.com
EMAIL_PORT=993
EMAIL_TLS=true
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-16-char-app-password
EMAIL_MAILBOX=INBOX
EMAIL_CHECK_INTERVAL=5
```

## Manual Processing Options

If email monitoring isn't working, you can:

### 1. Process CSV files directly:
```bash
npm run process:nubank /path/to/your/file.csv
```

### 2. Use the web interface:
```bash
npm run dev
```
Then open http://localhost:3001 and upload your CSV files.

## Email Processor Configuration

Configure which processor to use for each sender:

```env
EMAIL_PROCESSORS='[
  {
    "senderEmail": "todomundo@nubank.com.br",
    "processorType": "csv",
    "importerConfig": "nubank.json"
  }
]'
```

Processor types:
- `"csv"` - Pass through without processing
- `"binance"` - Process Binance P2P format
- `"itau"` - Process Itaú bank format
- `"deel"` - Process Deel payroll format