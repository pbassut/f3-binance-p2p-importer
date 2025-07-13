# F3 Binance P2P Importer - Codebase Documentation

## Project Overview

F3 Binance P2P Importer is a full-stack web application designed to convert CSV files from various financial sources (Binance P2P, Itaú Bank, Deel) into a format compatible with Firefly-III, an open-source personal finance manager. The application provides multiple processing capabilities:
- Web interface for manual file uploads
- Command-line processing
- **Automatic email monitoring** for processing CSV attachments

## Architecture

### Technology Stack

**Backend:**
- Node.js with TypeScript
- Express.js server
- NestJS dependencies (for future migration)
- CSV processing with csv-parse, csv-stringify, and PapaParse
- i18next for internationalization
- Multer for file uploads
- Axios for HTTP requests
- IMAP email monitoring with node-imap
- Email parsing with mailparser

**Frontend:**
- React 19 with TypeScript
- Material-UI (MUI) for UI components
- Vite as build tool
- Axios for API communication

**Testing:**
- Vitest for unit tests
- Playwright for end-to-end tests

**Infrastructure:**
- Docker support (Dockerfile and docker-compose.yml)
- Environment variables via dotenv

## Directory Structure

```
f3-binance-p2p-importer/
├── src/                      # Backend source code
│   ├── main.ts              # Express server entry point
│   ├── process.ts           # Core processing logic orchestrator
│   ├── processors/          # CSV processors for each source
│   │   ├── binance.ts       # Binance P2P processor
│   │   ├── itau.ts          # Itaú bank processor
│   │   └── deel.ts          # Deel payments processor
│   ├── email/               # Email monitoring components
│   │   ├── email-config.ts  # Email configuration types
│   │   └── email-monitor.ts # Email monitoring service
│   ├── importer-configs/    # Firefly-III importer configurations
│   │   ├── binance.json
│   │   ├── itau.json
│   │   └── deel.json
│   └── locales/             # i18n translation files
│       ├── en/
│       └── pt-BR/
├── frontend/                # React frontend application
│   ├── src/
│   │   └── App.tsx         # Main React component
│   ├── dist/               # Built frontend files
│   └── vite.config.ts      # Vite configuration
├── e2e/                    # End-to-end tests
├── input/                  # CSV input directory (manual processing)
├── output/                 # Processed CSV output directory
├── uploads/                # Temporary file uploads (web interface)
├── sample-csv/             # Example CSV files for testing
└── requirements/           # Documentation for CSV formats
```

## Core Components

### 1. Main Server (`src/main.ts`)

Express server that:
- Serves the React frontend from `/frontend/dist`
- Exposes `/api/upload` endpoint for file processing
- Detects CSV format automatically (Binance, Itaú, or Deel)
- Processes uploaded files and forwards to Firefly-III Data Importer
- **Initializes email monitoring service** if configured
- Requires environment variables: `FIREFLY_TOKEN`, `FIREFLY_URL`, `FIREFLY_SECRET`
- Optional email variables: `EMAIL_HOST`, `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_PROCESSORS`

### 2. Process Orchestrator (`src/process.ts`)

Central processing module that:
- Initializes i18next for translations
- Provides a unified interface for all processors
- Routes processing to appropriate processor based on type
- Manages language settings for localized output

### 3. CSV Processors

#### Binance Processor (`src/processors/binance.ts`)
- **Input**: Order Number, Order Type, Asset Type, Total Price, etc.
- **Output**: Order Number, Description, Created Time, Notes, Amount, Income, Expense
- **Features**:
  - Handles Buy/Sell orders with localized descriptions
  - Creates separate fee rows for Taker fees
  - Aggregates unused columns into Notes field

#### Itaú Processor (`src/processors/itau.ts`)
- **Input**: Semicolon-delimited Brazilian bank statement
- **Output**: Date, Description, Value
- **Features**:
  - Filters out balance rows (SALDO)
  - Converts date format (DD/MM/YYYY → YYYY-MM-DD)
  - Handles Brazilian number format (comma decimals)
  - Cleans descriptions and removes duplicates

#### Deel Processor (`src/processors/deel.ts`)
- **Input**: Complex payroll CSV with transaction details
- **Output**: Transaction ID, Description, Date, Notes, Amount, Income, Expense
- **Features**:
  - Handles multiple transaction types (payment, withdrawal, advance)
  - Dynamic description generation
  - Income/Expense categorization based on amount

### 4. Frontend Application (`frontend/src/App.tsx`)

React application providing:
- File upload interface with drag-and-drop
- Material-UI based responsive design
- Real-time upload progress
- Success/error feedback
- Response details in expandable accordion

### 5. Email Monitoring Service

#### Email Monitor (`src/email/email-monitor.ts`)
- Monitors configured email inbox for new messages with CSV attachments
- Automatically processes attachments based on sender email
- Maps senders to specific processor types
- Forwards processed files to Firefly-III
- Features:
  - IMAP connection management
  - Periodic email checking (configurable interval)
  - Sender-based processor selection
  - Automatic cleanup of temporary files
  - Error handling and logging

#### Email Configuration (`src/email/email-config.ts`)
- Defines configuration schema for email monitoring
- Supports multiple sender-to-processor mappings
- Configurable check intervals and mailbox selection

### 6. Importer Configurations

JSON configurations for Firefly-III Data Importer:
- Version 3 format compatibility
- Role mappings for CSV columns
- Account mappings for categorization
- Duplicate detection settings

## Data Flow

### Manual Processing:
1. **File Upload**: User uploads CSV via web interface or places in `/input` directory
2. **Format Detection**: System analyzes CSV headers to determine source type
3. **Processing**: Appropriate processor transforms data to standard format
4. **Localization**: Descriptions generated in configured language (en/pt-BR)
5. **Output**: Processed CSV sent to Firefly-III or saved to `/output`
6. **Import**: Firefly-III Data Importer creates transactions

### Automatic Email Processing:
1. **Email Monitoring**: Service checks inbox periodically for new emails
2. **Attachment Detection**: Identifies emails with CSV attachments
3. **Sender Mapping**: Matches sender email to configured processor type
4. **Automatic Processing**: Uses mapped processor to transform CSV
5. **Firefly Import**: Sends processed data directly to Firefly-III
6. **Cleanup**: Removes temporary files after processing

## Development Scripts

```bash
# Development (concurrent backend + frontend)
npm run dev

# Build for production
npm run build

# Run tests
npm test           # Unit tests
npm run test:e2e   # E2E tests

# Manual CSV processing
npm run process:example
```

## Environment Configuration

### Required `.env` variables:
```
FIREFLY_TOKEN=<personal-access-token>
FIREFLY_URL=<data-importer-url>
FIREFLY_SECRET=<webhook-secret>
```

### Optional Email Monitoring variables:
```
EMAIL_HOST=<imap-server>
EMAIL_PORT=<port-number>
EMAIL_TLS=<true/false>
EMAIL_USER=<email-address>
EMAIL_PASSWORD=<email-password>
EMAIL_MAILBOX=<mailbox-name>
EMAIL_CHECK_INTERVAL=<minutes>
EMAIL_PROCESSORS='[
  {
    "senderEmail": "sender@example.com",
    "processorType": "binance|itau|deel",
    "importerConfig": "config-filename.json"
  }
]'
```

## Testing Strategy

### Unit Tests (Vitest)
- Located in `src/*.test.ts`
- Tests for processor logic and transformations
- Configured to exclude e2e and frontend tests

### E2E Tests (Playwright)
- Located in `e2e/*.spec.ts`
- Tests full upload workflow
- Runs against development server on port 5173
- Uses Chromium browser

## Key Design Principles

1. **Modularity**: Each processor is independent with shared interface
2. **Type Safety**: Full TypeScript coverage with strict mode
3. **Internationalization**: All user-facing text is translatable
4. **Error Resilience**: Graceful handling of malformed data
5. **Audit Trail**: Unused data preserved in Notes field
6. **Auto-detection**: Smart format detection reduces user friction

## Security Considerations

- File uploads handled securely with Multer
- Environment variables for sensitive configuration
- Temporary files cleaned up after processing
- No credentials stored in code or config files

## Future Enhancements

- NestJS migration (dependencies already included)
- Additional processor support
- Enhanced error reporting
- Batch processing capabilities
- Direct Firefly-III API integration options