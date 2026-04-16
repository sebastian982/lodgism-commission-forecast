const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'lodgism.db');
let db = null;

// Initialize database
async function initDB() {
  const SQL = await initSqlJs();

  // Load existing database or create new
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS properties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      market TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Active',
      commRate REAL NOT NULL DEFAULT 0.20,
      note TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS property_gri (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      propertyId INTEGER NOT NULL,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      FOREIGN KEY (propertyId) REFERENCES properties(id) ON DELETE CASCADE,
      UNIQUE(propertyId, year, month)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS actuals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      amount REAL NOT NULL,
      note TEXT,
      createdAt TEXT DEFAULT (datetime('now'))
    )
  `);

  // Seed data if tables are empty
  const countResult = db.exec('SELECT COUNT(*) as count FROM properties');
  const propertyCount = countResult.length > 0 ? countResult[0].values[0][0] : 0;

  if (propertyCount === 0) {
    seedData();
  }

  saveDB();
  return db;
}

function saveDB() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

function seedData() {
  // Real property data from Lodgism portfolio (NH/MA markets)
  const seedProperties = [
    { name: '5 Cora Lane', market: 'Harwichport, MA', status: 'Active', commRate: 0.05, gri: [0, 0, 2059.02, 2502.6, 3636.3, 6553.8, 10450.72, 10830.16, 4837.2, 3361.95, 0, 0] },
    { name: '10 Cranberry Rd.', market: 'Keene, NH', status: 'Active', commRate: 0.025, gri: [2265, 2860, 3437, 1622, 6383, 7837, 9712, 9240, 5540, 7901, 5792, 4264] },
    { name: '11 Applecrest', market: 'Andover, NH', status: 'Active', commRate: 0.05, gri: [5506, 4375, 4444, 3603, 5105, 3287, 2960, 5729, 8731, 11810, 11325, 6560] },
    { name: '118 Cottage St.', market: 'Littleton, NH', status: 'Active', commRate: 0.025, gri: [2331, 2694, 785, 339, 2262, 4618, 5265, 5546, 3363, 5062, 1076, 2744] },
    { name: '120 Cottage St.', market: 'Littleton, NH', status: 'Active', commRate: 0.025, gri: [2331, 2694, 785, 339, 2262, 4618, 5265, 5546, 3363, 5062, 1076, 2744] },
    { name: '25 Lee Ave', market: 'Holland, MA', status: 'Active', commRate: 0.05, gri: [3248, 2427, 2428, 2774, 5946, 6576, 8519, 8314, 5883, 5904, 3760, 3852] },
    { name: '36 Lodge Rd D209', market: 'Lincoln, NH', status: 'Active', commRate: 0.05, gri: [4595, 5208, 3524, 810, 887, 2411, 4464, 5078, 2258, 3828, 1365, 3925] },
    { name: '36 Lodge Rd A203', market: 'Lincoln, NH', status: 'Active', commRate: 0.05, gri: [1732, 2002, 1276, 822, 1246, 1560, 2051, 2340, 1747, 2298, 1100, 1595] },
    { name: '45 Woody Island Road', market: 'Hopkinton, MA', status: 'Active', commRate: 0.016, gri: [5652, 6282, 4818, 5405, 3915, 4061, 4957, 6222, 7167, 8947, 10148, 9355] },
    { name: '56 Foxglove', market: 'Gilford, NH', status: 'Active', commRate: 0.023, gri: [4205.46, 5212.48, 2767.68, 1345.5, 3404.42, 6996, 12125.34, 10862.4, 3640.8, 3303.36, 2678.4, 5492.89] },
    { name: '59 Tracy Ln', market: 'Mashpee, MA', status: 'Active', commRate: 0.023, gri: [610.7, 665.28, 885.36, 1034.55, 3352.96, 5791.5, 9630.77, 9110.28, 3672.75, 2066.15, 1161.45, 930.93] },
    { name: '6A1 Summit Vista', market: 'Glen, NH', status: 'Active', commRate: 0.05, gri: [1500, 2000, 1500, 1000, 2000, 4000, 8000, 8000, 4000, 5000, 4000, 4000] },
    { name: '70 Timber Ridge Rd', market: 'Alton, NH', status: 'Active', commRate: 0.025, gri: [8496, 8836, 2704, 4707, 12789, 22729, 40902, 43162, 12472, 12586, 5934, 8579] },
    { name: '72 Chestnut', market: 'Gilford, NH', status: 'Active', commRate: 0.023, gri: [2751.56, 3776.92, 1301.69, 911.4, 3313.28, 7611, 13543.28, 12918.63, 4359.6, 3509.82, 1690.2, 3293.44] },
    { name: '114 Dover Rd.', market: 'Mashpee, MA', status: 'Active', commRate: 0.023, gri: [610.7, 665.28, 885.36, 1034.55, 3352.96, 5791.5, 9630.77, 9110.28, 3672.75, 2066.15, 1161.45, 930.93] },
    { name: '227 Teaticket Path', market: 'Mashpee, MA', status: 'Active', commRate: 0.023, gri: [594.89, 780.5, 898.38, 1076.1, 3941.49, 5989.8, 9689.05, 9276.75, 3861, 2119.47, 1228.5, 996.03] },
    { name: '285 Acapesket Rd.', market: 'Mashpee, MA', status: 'Active', commRate: 0.023, gri: [594.89, 780.5, 898.38, 1076.1, 3941.49, 5989.8, 9689.05, 9276.75, 3861, 2119.47, 1228.5, 996.03] },
    { name: '305 Monomoscoy', market: 'Mashpee, MA', status: 'Active', commRate: 0.04, gri: [0, 0, 0, 2373.9, 5596.74, 7457.1, 12303.9, 11424.12, 4276.8, 3705.12, 0, 0] },
    { name: '89 Lakeside Cottages', market: 'Bristol, NH', status: 'Active', commRate: 0.03, gri: [5821, 10405, 2900, 2449, 17167, 33219, 55316, 55125, 21093, 26696, 5052, 7867] },
    { name: '11 Highwood Road, unit 1', market: 'Lincoln, NH', status: 'Active', commRate: 0.04, gri: [5803, 7024, 4910, 1135, 1762, 2984, 6326, 6238, 2919, 4736, 2545, 4836] },
    { name: '137 Skimobile Road, unit 1', market: 'Conway, NH', status: 'Active', commRate: 0.04, gri: [6163, 8518, 3181, 1296, 2469, 5342, 9992, 11093, 4116, 7621, 3231, 5959] },
    { name: '58 Easterly Rd. #1', market: 'Lincoln, NH', status: 'In Launch', commRate: 0.025, gri: [0, 0, 0, 1085.4, 1691.36, 3864, 7320.96, 8031.48, 3845.4, 5937.12, 3654, 7703.5] },
    { name: '51 Skyview Ln. #1', market: 'Laconia, NH', status: 'In Launch', commRate: 0.05, gri: [0, 0, 0, 0, 2882, 8282, 13850, 12743, 4152, 3296, 1474, 3060] },
    { name: '13 Bull Hill Way', market: 'Waterville Valley, NH', status: 'In Launch', commRate: 0.05, gri: [0, 0, 0, 0, 2380, 5483, 8048, 8199, 2169, 5670, 3832, 9456] },
    { name: '122 Timber Ln.', market: 'Littleton, NH', status: 'In Launch', commRate: 0.05, gri: [0, 0, 0, 0, 3744, 4908, 8334, 7951, 4779, 7477, 3588, 4375] },
    { name: '12 Davis Rd.', market: 'Sanbornton, NH', status: 'In Launch', commRate: 0.05, gri: [0, 0, 0, 0, 2309, 4670, 7219, 7317, 2444, 3130, 849, 1023] }
  ];

  seedProperties.forEach((prop) => {
    db.run(
      'INSERT INTO properties (name, market, status, commRate) VALUES (?, ?, ?, ?)',
      [prop.name, prop.market, prop.status, prop.commRate]
    );

    const result = db.exec('SELECT last_insert_rowid() as id');
    const propertyId = result[0].values[0][0];

    prop.gri.forEach((amount, month) => {
      db.run(
        'INSERT INTO property_gri (propertyId, year, month, amount) VALUES (?, ?, ?, ?)',
        [propertyId, 2026, month + 1, amount]
      );
    });
  });

  // Seed actuals
  const seedActuals = [
    { year: 2026, month: 1, amount: 12450, note: 'January payments received' },
    { year: 2026, month: 2, amount: 11280, note: 'February payments' },
    { year: 2026, month: 3, amount: 14520, note: 'March - strong bookings' },
    { year: 2026, month: 4, amount: 8750, note: 'April partial - pending' },
    { year: 2025, month: 11, amount: 9800, note: 'November 2025' },
    { year: 2025, month: 12, amount: 15200, note: 'December 2025 - holiday season' }
  ];

  seedActuals.forEach(actual => {
    db.run(
      'INSERT INTO actuals (year, month, amount, note) VALUES (?, ?, ?, ?)',
      [actual.year, actual.month, actual.amount, actual.note]
    );
  });
}

// Helper function to convert query results to objects
function queryToObjects(result) {
  if (!result || result.length === 0) return [];
  const columns = result[0].columns;
  return result[0].values.map(row => {
    const obj = {};
    columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj;
  });
}

// Database wrapper methods for compatibility with better-sqlite3-style API
function getDB() {
  return {
    prepare: (sql) => ({
      all: (...params) => {
        try {
          const result = db.exec(sql, params.length > 0 ? params : undefined);
          return queryToObjects(result);
        } catch (e) {
          return [];
        }
      },
      get: (...params) => {
        try {
          const result = db.exec(sql, params.length > 0 ? params : undefined);
          const objects = queryToObjects(result);
          return objects.length > 0 ? objects[0] : undefined;
        } catch (e) {
          return undefined;
        }
      },
      run: (...params) => {
        try {
          db.run(sql, params.length > 0 ? params : undefined);
          const lastId = db.exec('SELECT last_insert_rowid() as id');
          const changes = db.exec('SELECT changes() as changes');
          saveDB();
          return {
            lastInsertRowid: lastId[0]?.values[0]?.[0] || 0,
            changes: changes[0]?.values[0]?.[0] || 0
          };
        } catch (e) {
          console.error('SQL Error:', e.message);
          return { lastInsertRowid: 0, changes: 0 };
        }
      }
    }),
    exec: (sql) => {
      db.run(sql);
      saveDB();
    }
  };
}

module.exports = { initDB, getDB, saveDB };
