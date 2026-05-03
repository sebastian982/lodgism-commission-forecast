/**
 * One-time migration: SQLite → Supabase
 *
 * Run AFTER:
 *   1. You've run supabase-schema.sql in the Supabase SQL Editor
 *   2. You've signed up at your hosted app URL (creates your auth.users row)
 *   3. You've found your User ID in Supabase Dashboard → Authentication → Users
 *
 * Usage:
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_KEY=your-service-role-key \
 *   USER_ID=your-uuid-from-auth-users \
 *   node db/migrate-to-supabase.js
 *
 * Use the SERVICE ROLE key (not anon key) — it bypasses RLS for the migration.
 * Find it in: Supabase Dashboard → Settings → API → service_role key
 */

const initSqlJs   = require('sql.js');
const fs          = require('fs');
const path        = require('path');

const { SUPABASE_URL, SUPABASE_SERVICE_KEY, USER_ID } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !USER_ID) {
  console.error('Missing env vars. Set SUPABASE_URL, SUPABASE_SERVICE_KEY, USER_ID.');
  process.exit(1);
}

// Dynamically import Supabase (it's an ESM-first package)
async function migrate() {
  const { createClient } = await import('@supabase/supabase-js');
  const db_supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false }
  });

  // Read SQLite
  const SQL = await initSqlJs();
  const dbPath = path.join(__dirname, '..', 'lodgism.db');
  const buf = fs.readFileSync(dbPath);
  const db = new SQL.Database(buf);

  const toObjects = (res) => {
    if (!res || !res.length) return [];
    const cols = res[0].columns;
    return res[0].values.map(row => {
      const obj = {};
      cols.forEach((c, i) => obj[c] = row[i]);
      return obj;
    });
  };

  const properties = toObjects(db.exec('SELECT * FROM properties ORDER BY id'));
  const allGri     = toObjects(db.exec('SELECT * FROM property_gri'));
  const allActuals = toObjects(db.exec('SELECT * FROM actuals'));

  let ok = 0, fail = 0;

  for (const p of properties) {
    const { data: inserted, error: pErr } = await db_supabase
      .from('properties')
      .insert({
        user_id:   USER_ID,
        name:      p.name,
        address:   p.address,
        status:    p.status,
        comm_rate: p.commRate,
        note:      p.note || null
      })
      .select('id')
      .single();

    if (pErr) { console.error(`  FAIL [${p.name}]:`, pErr.message); fail++; continue; }

    const griRows = allGri
      .filter(g => g.propertyId === p.id)
      .map(g => ({ property_id: inserted.id, year: g.year, month: g.month, amount: g.amount }));

    if (griRows.length) {
      const { error: gErr } = await db_supabase.from('property_gri').insert(griRows);
      if (gErr) console.error(`  GRI fail [${p.name}]:`, gErr.message);
    }

    console.log(`  ✓ ${p.name}`);
    ok++;
  }

  for (const a of allActuals) {
    const { error } = await db_supabase.from('actuals').insert({
      user_id: USER_ID, year: a.year, month: a.month, amount: a.amount, note: a.note || null
    });
    if (error) console.error(`  FAIL actual [${a.year}/${a.month}]:`, error.message);
  }

  console.log(`\nDone — ${ok} properties migrated, ${fail} failed. ${allActuals.length} actuals migrated.`);
}

migrate().catch(err => { console.error(err); process.exit(1); });
