const express = require('express');
const router = express.Router();
const { getDB } = require('../db/database');

// GET all actuals
router.get('/', (req, res) => {
  const db = getDB();
  const year = req.query.year ? parseInt(req.query.year) : null;

  const actuals = year
    ? db.prepare('SELECT * FROM actuals WHERE year = ? ORDER BY year DESC, month DESC').all(year)
    : db.prepare('SELECT * FROM actuals ORDER BY year DESC, month DESC').all();

  res.json(actuals);
});

// POST create actual
router.post('/', (req, res) => {
  const db = getDB();
  const { year, month, amount, note } = req.body;

  if (!year || !month || amount === undefined) {
    return res.status(400).json({ error: 'year, month, and amount are required' });
  }

  const result = db.prepare(
    'INSERT INTO actuals (year, month, amount, note) VALUES (?, ?, ?, ?)'
  ).run(year, month, amount, note || null);

  const actual = db.prepare('SELECT * FROM actuals WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(actual);
});

// PUT update actual
router.put('/:id', (req, res) => {
  const db = getDB();
  const { year, month, amount, note } = req.body;
  const id = parseInt(req.params.id);

  const existing = db.prepare('SELECT * FROM actuals WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Actual not found' });
  }

  db.prepare(
    'UPDATE actuals SET year = ?, month = ?, amount = ?, note = ? WHERE id = ?'
  ).run(
    year !== undefined ? year : existing.year,
    month !== undefined ? month : existing.month,
    amount !== undefined ? amount : existing.amount,
    note !== undefined ? note : existing.note,
    id
  );

  const actual = db.prepare('SELECT * FROM actuals WHERE id = ?').get(id);
  res.json(actual);
});

// DELETE actual
router.delete('/:id', (req, res) => {
  const db = getDB();
  const result = db.prepare('DELETE FROM actuals WHERE id = ?').run(parseInt(req.params.id));

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Actual not found' });
  }

  res.json({ success: true });
});

module.exports = router;
