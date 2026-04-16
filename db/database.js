const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'lodgism.db'));

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS properties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    market TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Active',
    commRate REAL NOT NULL DEFAULT 0.20,
    note TEXT,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS property_gri (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    propertyId INTEGER NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    amount REAL NOT NULL DEFAULT 0,
    FOREIGN KEY (propertyId) REFERENCES properties(id) ON DELETE CASCADE,
    UNIQUE(propertyId, year, month)
  );

  CREATE TABLE IF NOT EXISTS actuals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    amount REAL NOT NULL,
    note TEXT,
    createdAt TEXT DEFAULT (datetime('now'))
  );
`);

// Seed data if tables are empty
const propertyCount = db.prepare('SELECT COUNT(*) as count FROM properties').get();

if (propertyCount.count === 0) {
  const seedProperties = [
    { name: 'Mountain View Cabin', market: 'Asheville', status: 'Active', commRate: 0.20 },
    { name: 'Lakeside Retreat', market: 'Lake Tahoe', status: 'Active', commRate: 0.18 },
    { name: 'Downtown Loft', market: 'Austin', status: 'Active', commRate: 0.22 },
    { name: 'Beach House', market: 'San Diego', status: 'Active', commRate: 0.20 },
    { name: 'Ski Chalet', market: 'Park City', status: 'Active', commRate: 0.25 },
    { name: 'Desert Oasis', market: 'Scottsdale', status: 'Active', commRate: 0.18 },
    { name: 'Historic Brownstone', market: 'Boston', status: 'Active', commRate: 0.20 },
    { name: 'Vineyard Estate', market: 'Napa Valley', status: 'In Launch', commRate: 0.22 },
    { name: 'Coastal Cottage', market: 'Charleston', status: 'Active', commRate: 0.19 },
    { name: 'Modern Treehouse', market: 'Portland', status: 'Active', commRate: 0.21 },
    { name: 'Rustic Farmhouse', market: 'Vermont', status: 'Active', commRate: 0.18 },
    { name: 'Penthouse Suite', market: 'Miami', status: 'Active', commRate: 0.25 },
    { name: 'Canyon View', market: 'Sedona', status: 'In Launch', commRate: 0.20 },
    { name: 'River Lodge', market: 'Jackson Hole', status: 'Active', commRate: 0.22 },
    { name: 'Urban Studio', market: 'Seattle', status: 'Active', commRate: 0.17 },
    { name: 'Garden Villa', market: 'Savannah', status: 'Active', commRate: 0.19 },
    { name: 'Cliffside Manor', market: 'Big Sur', status: 'Active', commRate: 0.24 },
    { name: 'Forest Cabin', market: 'Smoky Mountains', status: 'Active', commRate: 0.20 },
    { name: 'Harbor House', market: 'Cape Cod', status: 'Active', commRate: 0.21 },
    { name: 'Adobe Retreat', market: 'Santa Fe', status: 'In Launch', commRate: 0.18 },
    { name: 'Lakefront Lodge', market: 'Lake George', status: 'Active', commRate: 0.19 },
    { name: 'City View Condo', market: 'Chicago', status: 'Active', commRate: 0.20 },
    { name: 'Oceanfront Paradise', market: 'Maui', status: 'Active', commRate: 0.28 },
    { name: 'Mountain Escape', market: 'Vail', status: 'Active', commRate: 0.23 },
    { name: 'Southern Charm', market: 'Nashville', status: 'Active', commRate: 0.20 },
    { name: 'Island Bungalow', market: 'Key West', status: 'In Launch', commRate: 0.22 }
  ];

  const insertProperty = db.prepare(`
    INSERT INTO properties (name, market, status, commRate)
    VALUES (@name, @market, @status, @commRate)
  `);

  const insertGRI = db.prepare(`
    INSERT INTO property_gri (propertyId, year, month, amount)
    VALUES (@propertyId, @year, @month, @amount)
  `);

  // GRI patterns for different property types (monthly amounts)
  const griPatterns = [
    [4200, 3800, 5500, 6200, 7800, 8500, 9200, 9500, 8800, 6500, 4800, 5200],
    [5500, 5200, 6800, 7500, 8200, 9800, 10500, 11000, 9500, 7200, 5800, 6200],
    [3200, 3500, 4200, 4800, 5500, 5800, 6200, 6500, 5500, 4500, 3800, 3500],
    [6800, 7200, 8500, 9200, 10500, 12000, 13500, 14000, 11500, 8800, 7500, 7200],
    [8500, 9200, 8800, 6500, 4200, 3500, 3800, 4200, 5500, 7200, 8800, 10500],
    [4500, 4800, 5500, 5200, 4800, 4200, 3800, 3500, 4200, 5200, 5500, 5000]
  ];

  const insertMany = db.transaction(() => {
    seedProperties.forEach((prop, idx) => {
      const result = insertProperty.run(prop);
      const propertyId = result.lastInsertRowid;
      const pattern = griPatterns[idx % griPatterns.length];

      // Add GRI for 2026
      pattern.forEach((amount, month) => {
        insertGRI.run({
          propertyId,
          year: 2026,
          month: month + 1,
          amount: amount + Math.floor(Math.random() * 500) - 250
        });
      });
    });
  });

  insertMany();
}

// Seed actuals if empty
const actualsCount = db.prepare('SELECT COUNT(*) as count FROM actuals').get();

if (actualsCount.count === 0) {
  const seedActuals = [
    { year: 2026, month: 1, amount: 12450, note: 'January payments received' },
    { year: 2026, month: 2, amount: 11280, note: 'February payments' },
    { year: 2026, month: 3, amount: 14520, note: 'March - strong bookings' },
    { year: 2026, month: 4, amount: 8750, note: 'April partial - pending' },
    { year: 2025, month: 11, amount: 9800, note: 'November 2025' },
    { year: 2025, month: 12, amount: 15200, note: 'December 2025 - holiday season' }
  ];

  const insertActual = db.prepare(`
    INSERT INTO actuals (year, month, amount, note)
    VALUES (@year, @month, @amount, @note)
  `);

  seedActuals.forEach(actual => insertActual.run(actual));
}

module.exports = db;
