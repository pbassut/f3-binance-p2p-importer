# 📝 Preprocessing Requirements for Bank Statement (CSV)

**Objective:**  
Extract only **real banking transaction lines** from a CSV file exported from Itau, ignoring headers, balances, and metadata, and generate a new CSV with clean columns.

---

## 📥 Input

- **File format:** CSV (possibly with `latin1` encoding)
- **Delimiter:** semicolon (`;`)
- **Typical format:** exported from Itau Internet Banking
- **Example data header:**

```
date;description;branch/origin;amount (R$);balance (R$)
```

---

## 🧠 Extraction Logic

1. **Ignore everything before the line that starts with:**  
   `date;description`

2. **Select only lines with real transactions:**

   - Start with a date in the format `DD/MM/YYYY`
   - Contain a textual description (e.g., `PIX TRANSF`, `TED`, `UTILITY PAYMENT`)
   - Contain a numeric value in `amount (R$)` (positive or negative)
   - **Ignore lines** with descriptions such as:
     - `PREVIOUS BALANCE`
     - `TOTAL AVAILABLE BALANCE`
     - `TOTAL BALANCE` (including encoding errors)

3. **Process columns:**
   - Rename to:
     - `Date` (date in ISO format `YYYY-MM-DD`)
     - `Description` (no double spaces or special characters)
     - `Value` (converted from `-1.234,56` to `-1234.56`, using `.` as decimal separator)

---

## 📤 Expected Output

- **Format:** CSV
- **Encoding:** UTF-8
- **Delimiter:** comma (`,")

**Final columns:**

| Date       | Description        | Value   |
| ---------- | ------------------ | ------- |
| 2025-04-01 | UTILITY PAYMENT    | -996.92 |
| 2025-04-07 | PIX TRANSFER 05/04 | -900.00 |
| 2025-04-07 | INTEREST PAID      | 0.01    |
| ...        | ...                | ...     |

---

## 🛠️ Additional Rules

- Remove duplicate lines
- Sort by `Date` (optional)
- Handle encoding errors (e.g., lines with corrupted balance descriptions → discard)
