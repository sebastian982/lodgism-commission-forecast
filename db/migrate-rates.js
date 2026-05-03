const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'lodgism.db');

const rates = {
  '5 Cora Lane': 0.30,
  '11 Applecrest': 0.30,
  '25 Lee Ave': 0.30,
  '36 Lodge Rd D209': 0.30,
  '36 Lodge Rd A203': 0.30,
  '6A1 Summit Vista': 0.30,
  '51 Skyview Ln. #1': 0.30,
  '13 Bull Hill Way': 0.30,
  '122 Timber Ln.': 0.30,
  '12 Davis Rd.': 0.30,
  '10 Cranberry Rd.': 0.15,
  '118 Cottage St.': 0.15,
  '120 Cottage St.': 0.15,
  '70 Timber Ridge Rd': 0.15,
  '58 Easterly Rd. #1': 0.15,
  '56 Foxglove': 0.14,
  '59 Tracy Ln': 0.14,
  '72 Chestnut': 0.14,
  '114 Dover Rd.': 0.14,
  '227 Teaticket Path': 0.14,
  '285 Acapesket Rd.': 0.14,
  '305 Monomoscoy': 0.24,
  '11 Highwood Road, unit 1': 0.24,
  '137 Skimobile Road, unit 1': 0.24,
  '89 Lakeside Cottages': 0.18,
  '45 Woody Island Road': 0.10,
};

async function migrate() {
  const SQL = await initSqlJs();
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);

  let updated = 0;
  let notFound = [];

  for (const [name, rate] of Object.entries(rates)) {
    db.run('UPDATE properties SET commRate = ? WHERE name = ?', [rate, name]);
    const changes = db.exec('SELECT changes() as c');
    const n = changes[0]?.values[0]?.[0] ?? 0;
    if (n > 0) {
      updated++;
    } else {
      notFound.push(name);
    }
  }

  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));

  console.log(`Updated ${updated}/${Object.keys(rates).length} properties.`);
  if (notFound.length) console.log('Not found:', notFound);
}

migrate().catch(console.error);
