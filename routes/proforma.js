const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const MONTH_ABBREVS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
const MONTH_FULL   = ['january','february','march','april','may','june','july','august','september','october','november','december'];

// Find which columns contain Jan-Dec by scanning for a header row with month labels.
// Returns an array of 12 column indices (in Jan-Dec order), or null if not found.
function findMonthColumns(data) {
  for (const row of data) {
    if (!row) continue;
    const cells = row.map(c => (c != null ? String(c).toLowerCase().trim() : ''));
    for (const names of [MONTH_ABBREVS, MONTH_FULL]) {
      const cols = names.map(m => cells.indexOf(m));
      if (cols.every(i => i !== -1)) return cols;
    }
  }
  return null;
}

// Given a row and the known month column indices, return 12 rounded values (0 for empty/non-numeric).
function valuesAtMonthCols(row, monthCols) {
  return monthCols.map(col => {
    const v = row[col];
    return (typeof v === 'number' && isFinite(v)) ? Math.round(v) : 0;
  });
}

// Fall back: collect the first 12 numeric values in a row (skips strings, nulls, NaN).
function first12Numerics(row) {
  const out = [];
  for (const cell of row) {
    if (typeof cell === 'number' && isFinite(cell)) {
      out.push(Math.round(cell));
      if (out.length === 12) break;
    }
  }
  return out;
}

router.post('/', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });

    const sheets = workbook.SheetNames.map(sheetName => {
      const ws = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
      const monthCols = findMonthColumns(data);

      const rows = [];
      for (const row of data) {
        if (!row || row.length === 0) continue;

        // Label = first cell whose string value has at least 2 non-whitespace characters
        const label = row.find(c => typeof c === 'string' && c.trim().length > 1);
        if (!label) continue;

        let values;
        if (monthCols) {
          values = valuesAtMonthCols(row, monthCols);
          if (values.every(v => v === 0)) continue;
        } else {
          values = first12Numerics(row);
          if (values.length < 12) continue;
        }

        rows.push({ label: label.trim(), values });
      }

      return { name: sheetName, rows };
    });

    res.json({ sheets });
  } catch (err) {
    console.error('Pro forma parse error:', err);
    res.status(500).json({ error: err.message || 'Failed to parse file' });
  }
});

module.exports = router;
