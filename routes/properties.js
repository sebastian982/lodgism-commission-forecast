const express = require('express');
const router = express.Router();
const db = require('../db/database');

// GET all properties with GRI data
router.get('/', (req, res) => {
  const year = req.query.year ? parseInt(req.query.year) : null;

  const properties = db.prepare(`
    SELECT * FROM properties ORDER BY name
  `).all();

  const gri = db.prepare(`
    SELECT * FROM property_gri ${year ? 'WHERE year = ?' : ''}
  `).all(year ? [year] : []);

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
  const property = db.prepare('SELECT * FROM properties WHERE id = ?').get(req.params.id);

  if (!property) {
    return res.status(404).json({ error: 'Property not found' });
  }

  const gri = db.prepare('SELECT * FROM property_gri WHERE propertyId = ?').all(req.params.id);

  res.json({ ...property, gri });
});

// POST create property
router.post('/', (req, res) => {
  const { name, market, status, commRate, note, gri } = req.body;

  const result = db.prepare(`
    INSERT INTO properties (name, market, status, commRate, note)
    VALUES (?, ?, ?, ?, ?)
  `).run(name, market, status || 'Active', commRate || 0.20, note || null);

  const propertyId = result.lastInsertRowid;

  // Insert GRI data if provided
  if (gri && Array.isArray(gri)) {
    const insertGRI = db.prepare(`
      INSERT INTO property_gri (propertyId, year, month, amount)
      VALUES (?, ?, ?, ?)
    `);

    gri.forEach(g => {
      insertGRI.run(propertyId, g.year, g.month, g.amount);
    });
  }

  const property = db.prepare('SELECT * FROM properties WHERE id = ?').get(propertyId);
  const griData = db.prepare('SELECT * FROM property_gri WHERE propertyId = ?').all(propertyId);

  res.status(201).json({ ...property, gri: griData });
});

// PUT update property
router.put('/:id', (req, res) => {
  const { name, market, status, commRate, note, gri } = req.body;
  const id = req.params.id;

  const existing = db.prepare('SELECT * FROM properties WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Property not found' });
  }

  db.prepare(`
    UPDATE properties
    SET name = ?, market = ?, status = ?, commRate = ?, note = ?, updatedAt = datetime('now')
    WHERE id = ?
  `).run(
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
      db.prepare(`
        INSERT INTO property_gri (propertyId, year, month, amount)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(propertyId, year, month)
        DO UPDATE SET amount = excluded.amount
      `).run(id, g.year, g.month, g.amount);
    });
  }

  const property = db.prepare('SELECT * FROM properties WHERE id = ?').get(id);
  const griData = db.prepare('SELECT * FROM property_gri WHERE propertyId = ?').all(id);

  res.json({ ...property, gri: griData });
});

// DELETE property
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM properties WHERE id = ?').run(req.params.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Property not found' });
  }

  res.json({ success: true });
});

module.exports = router;
