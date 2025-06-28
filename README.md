# F-III Binance P2P Importer 🚀

> **Universal CSV Converter for Binance P2P to Firefly-III**

This project monitors a folder and automatically converts any CSV file exported from the Binance P2P area into a format accepted by [Firefly-III](https://www.firefly-iii.org/), making it easy to import financial data from different sources into your favorite finance manager.

## ✨ Features

- **Automatic monitoring:** just drop a CSV exported from Binance P2P into the `input/` folder and it will be converted to the `output/` folder.
- **Flexible conversion:** transforms the input CSV fields into a standard format, including Order Number, Description (with buy/sell logic), Created Time, and Notes.
- **Docker compatible:** easily run the converter in any environment.
- **Automated tests:** quality ensured with Vitest tests.

## 📦 How to use locally

1. Install dependencies:
   ```bash
   npm install
   ```
2. Export the CSV from the Binance P2P area and place it in the `input/` folder (e.g., `input/yourfile.csv`).
3. Run the converter:
   ```bash
   npx ts-node index.ts
   ```
4. The converted file will appear in the `output/` folder with the same name.

## 🐳 How to run with Docker

1. Build the image:
   ```bash
   docker build -t f-iii-binance-p2p-importer .
   ```
2. Run the container, mounting the current directory:
   ```bash
   docker run --rm -v $(pwd):/app f-iii-binance-p2p-importer
   ```

## 🔬 Tests

Run the automated tests with:

```bash
npm test
```

## 🔄 Customization

- Edit the `transformRow` function in `process.ts` to adapt the transformation logic for your bank or exchange.
- The **Description** field is automatically built based on the operation type and counterparty.
- The **Notes** field aggregates all other unused fields, making auditing easier.

## 💡 Example

Place a file exported from Binance P2P in `input/`:

```csv
Order Number,Order Type,Asset Type,Fiat Type,Total Price,Price,Quantity,Exchange rate,Maker Fee,Taker Fee,Couterparty,Status,Created Time
10000000000000000001,Sell,USDT,BRL,1000.00,5.70,175.00,0.00,,0.05,AnonA,Completed,2025-03-27 21:03:53
10000000000000000005,Buy,USDT,BRL,500.00,5.74,87.12,0.00,,0.05,AnonE,Completed,2025-03-29 10:00:00
```

And receive in `output/` a file ready to import into Firefly-III:

```csv
Order Number,Description,Created Time,Notes
10000000000000000001,"Venda de USDT para AnonA",2025-03-27 21:03:53,"Fiat Type: BRL | Total Price: 1000.00 | Price: 5.70 | Quantity: 175.00 | Exchange rate: 0.00 | Taker Fee: 0.05 | Status: Completed"
10000000000000000005,"Compra de USDT de AnonE",2025-03-29 10:00:00,"Fiat Type: BRL | Total Price: 500.00 | Price: 5.74 | Quantity: 87.12 | Exchange rate: 0.00 | Taker Fee: 0.05 | Status: Completed"
```

## 🤝 Contributing

Pull requests are welcome! Feel free to open issues or suggest improvements.

---

Made with ❤️ to make your financial life easier!
