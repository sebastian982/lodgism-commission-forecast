/**
 * One-time migration: JSON backup → Supabase
 *
 * Usage:
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_KEY=your-service-role-key \
 *   node db/migrate-json.js /path/to/lodgism-backup.json
 *
 * Use the SERVICE ROLE key (not anon key) — it bypasses RLS.
 * Find it in: Supabase Dashboard → Settings → API → service_role key
 *
 * The script looks up sebastian@lodgism.com to get the user_id automatically.
 */

const fs   = require('fs');
const path = require('path');

const USER_EMAIL = 'sebastian@lodgism.com';

const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing env vars. Set SUPABASE_URL and SUPABASE_SERVICE_KEY.');
  process.exit(1);
}

const backupPath = process.argv[2];
if (!backupPath) {
  console.error('Usage: node db/migrate-json.js /path/to/backup.json');
  process.exit(1);
}

const resolvedPath = path.resolve(backupPath);
if (!fs.existsSync(resolvedPath)) {
  console.error(`File not found: ${resolvedPath}`);
  process.exit(1);
}

async function migrate() {
  const { createClient } = await import('@supabase/supabase-js');
  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false }
  });

  // ── 1. Look up user ID ───────────────────────────────────────────────────────
  console.log(`Looking up user: ${USER_EMAIL}`);
  const { data: { users }, error: listErr } = await db.auth.admin.listUsers();
  if (listErr) { console.error('Failed to list users:', listErr.message); process.exit(1); }

  const user = users.find(u => u.email === USER_EMAIL);
  if (!user) {
    console.error(`No user found with email ${USER_EMAIL}. Create your account in the app first.`);
    process.exit(1);
  }
  const userId = user.id;
  console.log(`  ✓ Found user — ID: ${userId}\n`);

  // ── 2. Read backup JSON ──────────────────────────────────────────────────────
  const backup = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
  const properties = backup.properties || [];
  const actuals    = backup.actuals    || [];
  console.log(`Backup contains ${properties.length} properties, ${actuals.length} actuals`);
  console.log(`Exported at: ${backup.exportedAt || 'unknown'}\n`);

  // ── 3. Migrate properties + GRI ─────────────────────────────────────────────
  let propOk = 0, propFail = 0;

  for (const p of properties) {
    const { data: inserted, error: pErr } = await db
      .from('properties')
      .insert({
        user_id:   userId,
        name:      p.name,
        address:   p.address  || '',
        status:    p.status   || 'Active',
        comm_rate: p.commRate ?? 0.20,
        note:      p.note     || null
      })
      .select('id')
      .single();

    if (pErr) {
      console.error(`  FAIL [${p.name}]: ${pErr.message}`);
      propFail++;
      continue;
    }

    const griRows = (p.gri || []).map(g => ({
      property_id: inserted.id,
      year:        g.year,
      month:       g.month,
      amount:      g.amount
    }));

    if (griRows.length) {
      const { error: gErr } = await db.from('property_gri').insert(griRows);
      if (gErr) console.error(`  GRI fail [${p.name}]: ${gErr.message}`);
    }

    console.log(`  ✓ ${p.name} (${griRows.length} GRI rows)`);
    propOk++;
  }

  // ── 4. Migrate actuals ───────────────────────────────────────────────────────
  let actOk = 0, actFail = 0;

  for (const a of actuals) {
    const { error } = await db.from('actuals').insert({
      user_id: userId,
      year:    a.year,
      month:   a.month,
      amount:  a.amount,
      note:    a.note || null
    });
    if (error) {
      console.error(`  FAIL actual [${a.year}/${a.month}]: ${error.message}`);
      actFail++;
    } else {
      actOk++;
    }
  }

  console.log(`\n── Summary ────────────────────────────────────────`);
  console.log(`Properties: ${propOk} inserted, ${propFail} failed`);
  console.log(`Actuals:    ${actOk} inserted, ${actFail} failed`);
  if (propFail === 0 && actFail === 0) console.log('\nAll done!');
}

migrate().catch(err => { console.error(err); process.exit(1); });
