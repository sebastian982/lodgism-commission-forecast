const express = require('express');
const router = express.Router();
const db = require('../db/database');

// GET full JSON export
router.get('/', (req, res) => {
  const properties = db.prepare('SELECT * FROM properties ORDER BY id').all();
  const propertyGri = db.prepare('SELECT * FROM property_gri ORDER BY propertyId, year, month').all();
  const actuals = db.prepare('SELECT * FROM actuals ORDER BY year, month').all();

  // Group GRI by property
  const griByProperty = {};
  propertyGri.forEach(g => {
    if (!griByProperty[g.propertyId]) {
      griByProperty[g.propertyId] = [];
    }
    griByProperty[g.propertyId].push({
      year: g.year,
      month: g.month,
      amount: g.amount
    });
  });

  const propertiesWithGri = properties.map(p => ({
    ...p,
    gri: griByProperty[p.id] || []
  }));

  const exportData = {
    exportedAt: new Date().toISOString(),
    properties: propertiesWithGri,
    actuals
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=lodgism-backup-${new Date().toISOString().split('T')[0]}.json`);
  res.json(exportData);
});

module.exports = router;
