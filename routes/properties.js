const express = require('express');
const router = express.Router();
const { getDB } = require('../db/database');

// GET all properties with GRI data
router.get('/', (req, res) => {
  const db = getDB();
  const year = req.query.year ? parseInt(req.query.year) : null;

  const properties = db.prepare('SELECT * FROM properties ORDER BY name').all();

  const gri = year
    ? db.prepare('SELECT * FROM property_gri WHERE year = ?').all(year)
    : db.prepare('SELECT * FROM property_gri').all();

  // Group GRI by property
  const griByProperty = {};
  gri.forEach(g => {
    if (!griByProperty[g.propertyId]) {
      griByProperty[g.propertyId] = [];
    }
    griByProperty[g.propertyId].push(g);
  });

  const result = properties.map(p => ({
    ...p,
    gri: griByProperty[p.id] || []
  }));

  res.json(result);
});

// GET single property
router.get('/:id', (req, res) => {
  const db = getDB();
  const property = db.prepare('SELECT * FROM properties WHERE id = ?').get(parseInt(req.params.id));

  if (!property) {
    return res.status(404).json({ error: 'Property not found' });
  }

  const gri = db.prepare('SELECT * FROM property_gri WHERE propertyId = ?').all(parseInt(req.params.id));

  res.json({ ...property, gri });
});

// POST create property
router.post('/', (req, res) => {
  const db = getDB();
  const { name, market, status, commRate, note, gri } = req.body;

  const result = db.prepare(
    'INSERT INTO properties (name, market, status, commRate, note) VALUES (?, ?, ?, ?, ?)'
  ).run(name, market, status || 'Active', commRate || 0.20, note || null);

  const propertyId = result.lastInsertRowid;

  // Insert GRI data if provided
  if (gri && Array.isArray(gri)) {
    gri.forEach(g => {
      db.prepare(
        'INSERT INTO property_gri (propertyId, year, month, amount) VALUES (?, ?, ?, ?)'
      ).run(propertyId, g.year, g.month, g.amount);
    });
  }

  const property = db.prepare('SELECT * FROM properties WHERE id = ?').get(propertyId);
  const griData = db.prepare('SELECT * FROM property_gri WHERE propertyId = ?').all(propertyId);

  res.status(201).json({ ...property, gri: griData });
});

// PUT update property
router.put('/:id', (req, res) => {
  const db = getDB();
  const { name, market, status, commRate, note, gri } = req.body;
  const id = parseInt(req.params.id);

  const existing = db.prepare('SELECT * FROM properties WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Property not found' });
  }

  db.prepare(
    "UPDATE properties SET name = ?, market = ?, status = ?, commRate = ?, note = ?, updatedAt = datetime('now') WHERE id = ?"
  ).run(
    name || existing.name,
    market || existing.market,
    status || existing.status,
    commRate !== undefined ? commRate : existing.commRate,
    note !== undefined ? note : existing.note,
    id
  );

  // Update GRI data if provided
  if (gri && Array.isArray(gri)) {
    gri.forEach(g => {
      // Try to update, if no rows changed, insert
      const updateResult = db.prepare(
        'UPDATE property_gri SET amount = ? WHERE propertyId = ? AND year = ? AND month = ?'
      ).run(g.amount, id, g.year, g.month);

      if (updateResult.changes === 0) {
        db.prepare(
          'INSERT INTO property_gri (propertyId, year, month, amount) VALUES (?, ?, ?, ?)'
        ).run(id, g.year, g.month, g.amount);
      }
    });
  }

  const property = db.prepare('SELECT * FROM properties WHERE id = ?').get(id);
  const griData = db.prepare('SELECT * FROM property_gri WHERE propertyId = ?').all(id);

  res.json({ ...property, gri: griData });
});

// DELETE property
router.delete('/:id', (req, res) => {
  const db = getDB();
  const id = parseInt(req.params.id);

  // Delete GRI data first
  db.prepare('DELETE FROM property_gri WHERE propertyId = ?').run(id);

  const result = db.prepare('DELETE FROM properties WHERE id = ?').run(id);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Property not found' });
  }

  res.json({ success: true });
});

module.exports = router;
