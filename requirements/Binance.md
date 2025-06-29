# 📝 Preprocessing Requirements for Binance P2P CSV

**Objective:**  
Extract and transform Binance P2P transaction CSVs for import into Firefly-III, generating a new CSV with clean, normalized columns and additional fee rows.

---

## 📥 Input

- **File format:** CSV (UTF-8 encoding)
- **Delimiter:** comma (`,")
- **Typical format:** exported from Binance P2P order history
- **Example data header:**

```
Order Number,Order Type,Asset Type,Couterparty,Created Time,Total Price,Taker Fee,...
```

---

## 🧠 Extraction & Transformation Logic

1. **Read all rows with headers as above.**
2. **For each transaction row:**
   - Normalize and trim all fields.
   - Build a `Description` field:
     - For `Order Type` = `Buy`: "Buy {Asset Type} from {Couterparty}"
     - For `Order Type` = `Sell`: "Sell {Asset Type} to {Couterparty}"
     - Otherwise: "{Order Type} {Asset Type} with {Couterparty}"
   - Build a `Notes` field by joining all unused columns as key-value pairs (e.g., `Fiat Type: BRL | Price: 5.70`).
   - Set `Amount` to `Total Price` (as a string).
   - Set `Income` and `Expense`:
     - If `Order Type` is `Sell`: `Income: true`, `Expense: false`
     - If `Order Type` is `Buy`: `Income: false`, `Expense: true`
   - For `Buy` transactions, `Amount` is negative.
3. **For each row with a nonzero `Taker Fee`:**
   - Add a fee row:
     - `Description`: "Tax of {Asset Type} to/from {Couterparty}" (depending on order type)
     - `Amount`: negative value of `Taker Fee`
     - `Income: false`, `Expense: true`
     - Same `Order Number`, `Created Time`, and `Notes` as the main row
4. **Output columns:**
   - `Order Number`, `Description`, `Created Time`, `Notes`, `Amount`, `Income`, `Expense`

---

## 📤 Expected Output

- **Format:** CSV
- **Encoding:** UTF-8
- **Delimiter:** comma (`,")

**Final columns:**

| Order Number | Description                | Created Time        | Notes          | Amount | Income  | Expense |
| ------------ | -------------------------- | ------------------- | -------------- | ------ | ------- | ------- | ----- |
| 10000000001  | Sell USDT to ExampleUser   | 2025-03-27 21:03:53 | Fiat Type: BRL | ...    | 1000.00 | true    | false |
| 10000000001  | Tax of USDT to ExampleUser | 2025-03-27 21:03:53 | Fiat Type: BRL | ...    | -0.05   | false   | true  |
| ...          | ...                        | ...                 | ...            | ...    | ...     | ...     |

---

## 🛠️ Additional Rules

- All fields are trimmed and normalized.
- Fee rows are always negative and marked as expenses.
- All unused columns are included in `Notes` as key-value pairs.
- The output is ready for direct import into Firefly-III.
