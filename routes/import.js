const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const { getDB, saveDB } = require('../db/database');

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    const allowedExtensions = ['.csv', '.xlsx', '.xls'];
    const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));

    if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV and Excel files are allowed'));
    }
  }
});

// POST /api/import - Import properties from CSV/XLSX
router.post('/', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const db = getDB();

    // Parse the file
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    // Find header row (look for "Property" column)
    let headerRowIndex = -1;
    for (let i = 0; i < Math.min(data.length, 10); i++) {
      const row = data[i];
      if (row && row[0] && String(row[0]).toLowerCase().includes('property')) {
        headerRowIndex = i;
        break;
      }
    }

    if (headerRowIndex === -1) {
      return res.status(400).json({
        error: 'Could not find header row. Expected columns: Property, Market, Status, Comm %, Jan-Dec'
      });
    }

    const headers = data[headerRowIndex].map(h => String(h || '').toLowerCase().trim());

    // Map column indices
    const colMap = {
      property: headers.findIndex(h => h.includes('property')),
      market: headers.findIndex(h => h.includes('market')),
      status: headers.findIndex(h => h.includes('status')),
      commRate: headers.findIndex(h => h.includes('comm') || h.includes('rate') || h.includes('%')),
      jan: headers.findIndex(h => h === 'jan'),
      feb: headers.findIndex(h => h === 'feb'),
      mar: headers.findIndex(h => h === 'mar'),
      apr: headers.findIndex(h => h === 'apr'),
      may: headers.findIndex(h => h === 'may'),
      jun: headers.findIndex(h => h === 'jun'),
      jul: headers.findIndex(h => h === 'jul'),
      aug: headers.findIndex(h => h === 'aug'),
      sep: headers.findIndex(h => h === 'sep'),
      oct: headers.findIndex(h => h === 'oct'),
      nov: headers.findIndex(h => h === 'nov'),
      dec: headers.findIndex(h => h === 'dec')
    };

    // Validate required columns
    if (colMap.property === -1 || colMap.market === -1) {
      return res.status(400).json({
        error: 'Missing required columns: Property and Market are required'
      });
    }

    // Get existing property names to check for duplicates
    const existingProperties = db.prepare('SELECT name FROM properties').all();
    const existingNames = new Set(existingProperties.map(p => p.name.toLowerCase().trim()));

    const results = {
      added: 0,
      skipped: 0,
      errors: []
    };

    // Process data rows (skip header and any title rows)
    for (let i = headerRowIndex + 1; i < data.length; i++) {
      const row = data[i];
      if (!row || !row[colMap.property]) continue;

      const propertyName = String(row[colMap.property]).trim();

      // Skip total/summary rows
      if (propertyName.toLowerCase().includes('total') ||
          propertyName.toLowerCase().includes('average') ||
          propertyName.toLowerCase().includes('avg')) {
        continue;
      }

      // Check for duplicates
      if (existingNames.has(propertyName.toLowerCase())) {
        results.skipped++;
        continue;
      }

      try {
        const market = row[colMap.market] ? String(row[colMap.market]).trim() : 'Unknown';
        const status = row[colMap.status] ? String(row[colMap.status]).trim() : 'Active';
        let commRate = 0.05; // Default 5%

        if (colMap.commRate !== -1 && row[colMap.commRate] !== undefined) {
          const rateVal = parseFloat(row[colMap.commRate]);
          // If rate is > 1, assume it's a percentage (e.g., 5 = 5%)
          commRate = rateVal > 1 ? rateVal / 100 : rateVal;
        }

        // Insert property
        const insertResult = db.prepare(
          'INSERT INTO properties (name, market, status, commRate) VALUES (?, ?, ?, ?)'
        ).run(propertyName, market, status, commRate);

        const propertyId = insertResult.lastInsertRowid;

        // Insert GRI data if monthly columns exist
        const monthCols = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        monthCols.forEach((month, idx) => {
          if (colMap[month] !== -1) {
            const amount = parseFloat(row[colMap[month]]) || 0;
            db.prepare(
              'INSERT INTO property_gri (propertyId, year, month, amount) VALUES (?, ?, ?, ?)'
            ).run(propertyId, 2026, idx + 1, amount);
          }
        });

        existingNames.add(propertyName.toLowerCase());
        results.added++;
      } catch (err) {
        results.errors.push(`Row ${i + 1}: ${err.message}`);
      }
    }

    saveDB();

    res.json({
      success: true,
      message: `Import complete: ${results.added} added, ${results.skipped} skipped (duplicates)`,
      ...results
    });

  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ error: error.message || 'Import failed' });
  }
});

module.exports = router;
