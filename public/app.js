// ── Supabase client ───────────────────────────────────────────────────────────
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let currentUser = null;

// ── State ─────────────────────────────────────────────────────────────────────
let properties  = [];
let actuals     = [];
let selectedYear = 2026;
let statusFilter = '';
let addressFilter = '';
let sortOrder   = 'state';
let searchQuery = '';
let proformaTarget = 'add';
let proformaSheets = [];

// ── Constants ─────────────────────────────────────────────────────────────────
const MONTHS      = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const FULL_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MY_CUT      = 1 / 6;

// ── DOM ───────────────────────────────────────────────────────────────────────
const yearSelector = document.getElementById('yearSelector');

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setupLoginHandlers();

  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session) {
      currentUser = session.user;
      showApp();
    } else if (event === 'SIGNED_OUT') {
      currentUser = null;
      properties = [];
      actuals    = [];
      showLogin();
    }
  });

  supabaseClient.auth.getSession().then(({ data: { session } }) => {
    if (session) {
      currentUser = session.user;
      showApp();
    } else {
      showLogin();
    }
  });
});

function showLogin() {
  document.getElementById('loginScreen').style.display = 'flex';
}

function showApp() {
  document.getElementById('loginScreen').style.display = 'none';
  // Initialise the app once (guard against onAuthStateChange firing twice)
  if (!document.getElementById('yearSelector')._appReady) {
    document.getElementById('yearSelector')._appReady = true;
    initEventListeners();
    initGriInputs();
    initActualYearOptions();
    initImport();
    initProformaImport();
    loadData();
  } else {
    loadData();
  }
}

function setupLoginHandlers() {
  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email    = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const btn      = document.getElementById('loginBtn');
    const errEl    = document.getElementById('loginError');

    btn.disabled    = true;
    btn.textContent = 'Signing in…';
    errEl.textContent = '';

    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    btn.disabled    = false;
    btn.textContent = 'Sign In';
    if (error) errEl.textContent = error.message;
  });
}

// ── Data shape helpers ────────────────────────────────────────────────────────
function mapProperty(row) {
  return {
    id:       row.id,
    name:     row.name,
    address:  row.address,
    status:   row.status,
    commRate: row.comm_rate,
    note:     row.note,
    gri: (row.property_gri || []).map(g => ({
      id:         g.id,
      propertyId: g.property_id,
      year:       g.year,
      month:      g.month,
      amount:     g.amount
    }))
  };
}

function mapActual(row) {
  return { id: row.id, year: row.year, month: row.month, amount: row.amount, note: row.note };
}

// ── Event listeners ───────────────────────────────────────────────────────────
function initEventListeners() {
  yearSelector.addEventListener('change', (e) => {
    selectedYear = parseInt(e.target.value);
    renderAll(); // All GRI loaded; just re-render
  });

  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const viewId = tab.dataset.view;
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(viewId).classList.add('active');
    });
  });

  document.getElementById('searchInput').addEventListener('input', (e) => {
    searchQuery = e.target.value.trim();
    renderProperties();
  });

  document.getElementById('sortSelect').addEventListener('change', (e) => {
    sortOrder = e.target.value;
    renderProperties();
  });

  document.getElementById('statusFilter').addEventListener('change', (e) => {
    statusFilter = e.target.value;
    renderProperties();
  });

  document.getElementById('addressFilter').addEventListener('change', (e) => {
    addressFilter = e.target.value;
    renderProperties();
  });

  document.getElementById('addPropertyForm').addEventListener('submit', handleAddProperty);

  document.getElementById('closeEditModal').addEventListener('click', () => {
    document.getElementById('editPropertyModal').classList.remove('active');
  });
  document.getElementById('editPropertyForm').addEventListener('submit', handleEditProperty);
  document.getElementById('deletePropertyBtn').addEventListener('click', handleDeleteProperty);

  document.getElementById('addActualBtn').addEventListener('click', () => openActualModal());
  document.getElementById('closeActualModal').addEventListener('click', () => {
    document.getElementById('addActualModal').classList.remove('active');
  });
  document.getElementById('actualForm').addEventListener('submit', handleSaveActual);
  document.getElementById('deleteActualBtn').addEventListener('click', handleDeleteActual);

  document.getElementById('editPropertyModal').addEventListener('click', (e) => {
    if (e.target.id === 'editPropertyModal') e.target.classList.remove('active');
  });
  document.getElementById('addActualModal').addEventListener('click', (e) => {
    if (e.target.id === 'addActualModal') e.target.classList.remove('active');
  });

  document.getElementById('exportBtn').addEventListener('click', handleExport);
  document.getElementById('logoutBtn').addEventListener('click', () => supabaseClient.auth.signOut());
}

function initGriInputs() {
  const container = document.getElementById('griInputs');
  MONTHS.forEach((month, idx) => {
    container.innerHTML += `
      <div class="gri-input">
        <label>${month}</label>
        <input type="number" id="gri${idx + 1}" step="0.01" min="0" value="0">
      </div>`;
  });
}

function initActualYearOptions() {
  const select = document.getElementById('actualYear');
  for (let year = 2025; year <= 2028; year++) {
    select.innerHTML += `<option value="${year}" ${year === 2026 ? 'selected' : ''}>${year}</option>`;
  }
}

// ── Data loading ──────────────────────────────────────────────────────────────
async function loadData() {
  try {
    const [{ data: propsData, error: propsErr }, { data: actualsData, error: actualsErr }] = await Promise.all([
      supabaseClient
        .from('properties')
        .select('*, property_gri(*)')
        .order('name'),
      supabaseClient
        .from('actuals')
        .select('*')
        .order('year', { ascending: false })
        .order('month', { ascending: false })
    ]);

    if (propsErr)   throw propsErr;
    if (actualsErr) throw actualsErr;

    properties = (propsData   || []).map(mapProperty);
    actuals    = (actualsData || []).map(mapActual);
    renderAll();
  } catch (err) {
    console.error('Failed to load data:', err);
  }
}

// ── Property CRUD ─────────────────────────────────────────────────────────────
async function handleAddProperty(e) {
  e.preventDefault();

  const gri = [];
  for (let i = 1; i <= 12; i++) {
    gri.push({ year: selectedYear, month: i, amount: parseFloat(document.getElementById(`gri${i}`).value) || 0 });
  }

  try {
    const { data: newProp, error: propErr } = await supabaseClient
      .from('properties')
      .insert({
        user_id:   currentUser.id,
        name:      document.getElementById('propName').value,
        address:   document.getElementById('propAddress').value,
        status:    document.getElementById('propStatus').value,
        comm_rate: parseFloat(document.getElementById('propCommRate').value),
        note:      document.getElementById('propNote').value || null
      })
      .select()
      .single();

    if (propErr) throw propErr;

    const { error: griErr } = await supabaseClient
      .from('property_gri')
      .insert(gri.map(g => ({ property_id: newProp.id, year: g.year, month: g.month, amount: g.amount })));

    if (griErr) throw griErr;

    e.target.reset();
    document.getElementById('propCommRate').value = '0.20';
    for (let i = 1; i <= 12; i++) document.getElementById(`gri${i}`).value = '0';
    document.querySelector('[data-view="properties"]').click();
    await loadData();
  } catch (err) {
    console.error('Failed to add property:', err);
    alert('Failed to add property: ' + err.message);
  }
}

async function handleEditProperty(e) {
  e.preventDefault();
  const id = parseInt(document.getElementById('editPropId').value);

  const gri = [];
  for (let i = 1; i <= 12; i++) {
    gri.push({ property_id: id, year: selectedYear, month: i, amount: parseFloat(document.getElementById(`editGri${i}`).value) || 0 });
  }

  try {
    const { error: propErr } = await supabaseClient
      .from('properties')
      .update({
        name:      document.getElementById('editPropName').value,
        address:   document.getElementById('editPropAddress').value,
        status:    document.getElementById('editPropStatus').value,
        comm_rate: parseFloat(document.getElementById('editPropCommRate').value),
        note:      document.getElementById('editPropNote').value || null
      })
      .eq('id', id);

    if (propErr) throw propErr;

    const { error: griErr } = await supabaseClient
      .from('property_gri')
      .upsert(gri, { onConflict: 'property_id,year,month' });

    if (griErr) throw griErr;

    document.getElementById('editPropertyModal').classList.remove('active');
    await loadData();
  } catch (err) {
    console.error('Failed to update property:', err);
    alert('Failed to update: ' + err.message);
  }
}

async function handleDeleteProperty() {
  const id = parseInt(document.getElementById('editPropId').value);
  if (!confirm('Are you sure you want to delete this property?')) return;

  const { error } = await supabaseClient.from('properties').delete().eq('id', id);
  if (error) { console.error(error); return; }

  document.getElementById('editPropertyModal').classList.remove('active');
  await loadData();
}

// ── Actuals CRUD ──────────────────────────────────────────────────────────────
function openActualModal(actual = null) {
  const modal     = document.getElementById('addActualModal');
  const form      = document.getElementById('actualForm');
  const title     = document.getElementById('actualModalTitle');
  const deleteBtn = document.getElementById('deleteActualBtn');

  form.reset();

  if (actual) {
    title.textContent = 'Edit Actual';
    document.getElementById('actualId').value     = actual.id;
    document.getElementById('actualYear').value   = actual.year;
    document.getElementById('actualMonth').value  = actual.month;
    document.getElementById('actualAmount').value = actual.amount;
    document.getElementById('actualNote').value   = actual.note || '';
    deleteBtn.style.display = 'block';
  } else {
    title.textContent = 'Add Actual';
    document.getElementById('actualId').value   = '';
    document.getElementById('actualYear').value = selectedYear;
    deleteBtn.style.display = 'none';
  }

  modal.classList.add('active');
}

async function handleSaveActual(e) {
  e.preventDefault();
  const id = document.getElementById('actualId').value;
  const payload = {
    year:   parseInt(document.getElementById('actualYear').value),
    month:  parseInt(document.getElementById('actualMonth').value),
    amount: parseFloat(document.getElementById('actualAmount').value),
    note:   document.getElementById('actualNote').value || null
  };

  try {
    if (id) {
      const { error } = await supabaseClient.from('actuals').update(payload).eq('id', parseInt(id));
      if (error) throw error;
    } else {
      const { error } = await supabaseClient.from('actuals').insert({ ...payload, user_id: currentUser.id });
      if (error) throw error;
    }
    document.getElementById('addActualModal').classList.remove('active');
    await loadData();
  } catch (err) {
    console.error('Failed to save actual:', err);
    alert('Failed to save: ' + err.message);
  }
}

async function handleDeleteActual() {
  const id = document.getElementById('actualId').value;
  if (!confirm('Are you sure you want to delete this actual?')) return;

  const { error } = await supabaseClient.from('actuals').delete().eq('id', parseInt(id));
  if (error) { console.error(error); return; }

  document.getElementById('addActualModal').classList.remove('active');
  await loadData();
}

// ── Export (client-side JSON download) ───────────────────────────────────────
function handleExport() {
  const data = JSON.stringify({ exportedAt: new Date().toISOString(), properties, actuals }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), {
    href:     url,
    download: `lodgism-backup-${new Date().toISOString().split('T')[0]}.json`
  });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Rendering ─────────────────────────────────────────────────────────────────
function renderAll() {
  renderDashboard();
  renderProperties();
  renderMonthlyTable();
  renderActuals();
  updateAddressFilter();
}

function renderDashboard() {
  let totalProjected = 0;
  const monthlyTotals = Array(12).fill(0);

  properties.forEach(prop => {
    prop.gri.filter(g => g.year === selectedYear).forEach(g => {
      const commission = g.amount * prop.commRate * MY_CUT;
      totalProjected += commission;
      monthlyTotals[g.month - 1] += commission;
    });
  });

  const yearActuals = actuals.filter(a => a.year === selectedYear);
  const ytdActual   = yearActuals.reduce((sum, a) => sum + a.amount, 0);
  const variance    = ytdActual - totalProjected;

  document.getElementById('totalProjected').textContent = formatCurrency(totalProjected);
  document.getElementById('ytdActual').textContent      = formatCurrency(ytdActual);

  const varianceEl = document.getElementById('variance');
  varianceEl.textContent = formatCurrency(variance);
  varianceEl.className   = 'stat-value ' + (variance >= 0 ? 'positive' : 'negative');

  document.getElementById('propertyCount').textContent = properties.length;

  renderChart(monthlyTotals);

  const activeCount = properties.filter(p => p.status === 'Active').length;
  const launchCount = properties.filter(p => p.status === 'In Launch').length;

  document.getElementById('portfolioCounts').innerHTML = `
    <div class="portfolio-item">
      <div class="label"><span class="dot active"></span><span>Active</span></div>
      <span class="count">${activeCount}</span>
    </div>
    <div class="portfolio-item">
      <div class="label"><span class="dot launch"></span><span>In Launch</span></div>
      <span class="count">${launchCount}</span>
    </div>`;

  const topEarners = properties.map(prop => {
    const total = prop.gri.filter(g => g.year === selectedYear)
      .reduce((sum, g) => sum + g.amount * prop.commRate * MY_CUT, 0);
    return { ...prop, totalCommission: total };
  }).sort((a, b) => b.totalCommission - a.totalCommission).slice(0, 5);

  document.getElementById('topEarners').innerHTML = topEarners.map(prop => `
    <div class="top-earner">
      <div>
        <div class="name">${prop.name}</div>
        <div class="market">${prop.address}</div>
      </div>
      <span class="amount">${formatCurrency(prop.totalCommission)}</span>
    </div>`).join('');
}

function renderChart(monthlyTotals) {
  const maxValue = Math.max(...monthlyTotals, 1);
  const container = document.getElementById('monthlyChart');

  container.innerHTML = monthlyTotals.map((value, idx) => {
    const height = (value / maxValue) * 88;
    return `
      <div class="chart-bar">
        <div class="chart-bar-area">
          <div class="chart-bar-value">${formatCurrency(value, true)}</div>
          <div class="chart-bar-fill" style="height: ${height}%"></div>
        </div>
        <div class="chart-bar-label">${MONTHS[idx]}</div>
      </div>`;
  }).join('');
}

function renderPropertyCard(prop) {
  const total = prop.gri.filter(g => g.year === selectedYear)
    .reduce((sum, g) => sum + g.amount * prop.commRate * MY_CUT, 0);
  return `
    <div class="property-card" onclick="openEditModal(${prop.id})">
      <div class="property-info">
        <span class="property-name">${prop.name}</span>
        <div class="property-meta">
          <span>${prop.address}</span>
          <span>${(prop.commRate * 100).toFixed(0)}% Lodgism rate</span>
        </div>
      </div>
      <div class="property-right">
        <div class="property-commission">
          <div class="amount">${formatCurrency(total)}</div>
          <div class="label">${selectedYear} projected</div>
        </div>
        <span class="badge ${prop.status === 'Active' ? 'active' : 'launch'}">${prop.status}</span>
      </div>
    </div>`;
}

function renderProperties() {
  let filtered = properties;

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(p => p.name.toLowerCase().includes(q) || p.address.toLowerCase().includes(q));
  }
  if (statusFilter)  filtered = filtered.filter(p => p.status  === statusFilter);
  if (addressFilter) filtered = filtered.filter(p => p.address === addressFilter);

  const container = document.getElementById('propertiesList');

  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty-state"><h3>No properties found</h3><p>Try adjusting your filters or add a new property.</p></div>`;
    return;
  }

  if (sortOrder === 'alphabetical') {
    const sorted = [...filtered].sort((a, b) => a.name.localeCompare(b.name));
    container.innerHTML = `<div class="state-properties">${sorted.map(renderPropertyCard).join('')}</div>`;
    return;
  }

  if (sortOrder === 'revenue') {
    const sorted = [...filtered].map(prop => {
      const total = prop.gri.filter(g => g.year === selectedYear)
        .reduce((sum, g) => sum + g.amount * prop.commRate * MY_CUT, 0);
      return { ...prop, totalCommission: total };
    }).sort((a, b) => b.totalCommission - a.totalCommission);
    container.innerHTML = `<div class="state-properties">${sorted.map(renderPropertyCard).join('')}</div>`;
    return;
  }

  const getState = (address) => {
    const parts = address.split(',');
    return parts.length > 1 ? parts[parts.length - 1].trim() : address;
  };

  const byState = {};
  filtered.forEach(prop => {
    const state = getState(prop.address);
    if (!byState[state]) byState[state] = [];
    byState[state].push(prop);
  });

  const sortedStates = Object.keys(byState).sort();
  sortedStates.forEach(state => byState[state].sort((a, b) => a.name.localeCompare(b.name)));

  const stateNames = { NH: 'New Hampshire', MA: 'Massachusetts', VT: 'Vermont', ME: 'Maine', CT: 'Connecticut', RI: 'Rhode Island' };

  container.innerHTML = sortedStates.map(state => `
    <div class="state-group">
      <div class="state-header">
        <span class="state-name">${stateNames[state] || state}</span>
        <span class="state-count">${byState[state].length} ${byState[state].length === 1 ? 'property' : 'properties'}</span>
      </div>
      <div class="state-properties">${byState[state].map(renderPropertyCard).join('')}</div>
    </div>`).join('');
}

function openEditModal(id) {
  const prop = properties.find(p => p.id === id);
  if (!prop) return;

  document.getElementById('editPropId').value       = prop.id;
  document.getElementById('editPropName').value     = prop.name;
  document.getElementById('editPropAddress').value  = prop.address;
  document.getElementById('editPropStatus').value   = prop.status;
  document.getElementById('editPropCommRate').value = prop.commRate;
  document.getElementById('editPropNote').value     = prop.note || '';

  const container = document.getElementById('editGriInputs');
  const yearGri   = prop.gri.filter(g => g.year === selectedYear);

  container.innerHTML = MONTHS.map((month, idx) => {
    const rec    = yearGri.find(g => g.month === idx + 1);
    const amount = rec ? rec.amount : 0;
    return `<div class="gri-input"><label>${month}</label><input type="number" id="editGri${idx + 1}" step="0.01" min="0" value="${amount}"></div>`;
  }).join('');

  document.getElementById('editPropertyModal').classList.add('active');
}

function renderMonthlyTable() {
  const thead = document.querySelector('#monthlyTable thead');
  const tbody = document.querySelector('#monthlyTable tbody');

  thead.innerHTML = `<tr><th>Property</th>${MONTHS.map(m => `<th>${m}</th>`).join('')}<th>Total</th></tr>`;

  const monthlyTotals = Array(12).fill(0);
  let grandTotal = 0;

  const rows = properties.map(prop => {
    const yearGri = prop.gri.filter(g => g.year === selectedYear);
    let rowTotal  = 0;

    const cells = MONTHS.map((_, idx) => {
      const rec        = yearGri.find(g => g.month === idx + 1);
      const commission = rec ? rec.amount * prop.commRate * MY_CUT : 0;
      monthlyTotals[idx] += commission;
      rowTotal += commission;
      return `<td>${formatCurrency(commission, true)}</td>`;
    }).join('');

    grandTotal += rowTotal;
    return `<tr><td>${prop.name}</td>${cells}<td>${formatCurrency(rowTotal, true)}</td></tr>`;
  }).join('');

  const totalCells = monthlyTotals.map(t => `<td>${formatCurrency(t, true)}</td>`).join('');
  tbody.innerHTML = rows + `<tr class="total-row"><td>Total</td>${totalCells}<td>${formatCurrency(grandTotal, true)}</td></tr>`;
}

function renderActuals() {
  const yearActuals = actuals.filter(a => a.year === selectedYear);

  const forecastByMonth = {};
  properties.forEach(prop => {
    prop.gri.filter(g => g.year === selectedYear).forEach(g => {
      forecastByMonth[g.month] = (forecastByMonth[g.month] || 0) + g.amount * prop.commRate * MY_CUT;
    });
  });

  const actualsByMonth = {};
  yearActuals.forEach(a => {
    actualsByMonth[a.month] = (actualsByMonth[a.month] || 0) + a.amount;
  });

  document.getElementById('actualsComparison').innerHTML = `
    <div class="comparison-card">
      <h4>Forecast vs Actual (${selectedYear})</h4>
      ${MONTHS.map((month, idx) => {
        const forecast = forecastByMonth[idx + 1] || 0;
        const actual   = actualsByMonth[idx + 1]  || 0;
        const variance = actual - forecast;
        if (forecast === 0 && actual === 0) return '';
        return `
          <div class="comparison-row">
            <span class="comparison-label">${month}</span>
            <span class="comparison-value forecast">${formatCurrency(forecast, true)}</span>
            <span class="comparison-value actual">${formatCurrency(actual, true)}</span>
            <span class="comparison-value variance ${variance >= 0 ? 'positive' : 'negative'}">${variance >= 0 ? '+' : ''}${formatCurrency(variance, true)}</span>
          </div>`;
      }).join('')}
    </div>`;

  const container = document.getElementById('actualsList');
  if (actuals.length === 0) {
    container.innerHTML = `<div class="empty-state"><h3>No actuals recorded</h3><p>Click "Add Actual" to record commission payments received.</p></div>`;
    return;
  }

  container.innerHTML = actuals.map(actual => `
    <div class="actual-item" onclick="openActualModal(${JSON.stringify(actual).replace(/"/g, '&quot;')})">
      <div class="actual-info">
        <span class="actual-date">${FULL_MONTHS[actual.month - 1]} ${actual.year}</span>
        ${actual.note ? `<span class="actual-note">${actual.note}</span>` : ''}
      </div>
      <span class="actual-amount">${formatCurrency(actual.amount)}</span>
    </div>`).join('');
}

function updateAddressFilter() {
  const addresses  = [...new Set(properties.map(p => p.address))].sort();
  const select     = document.getElementById('addressFilter');
  const current    = select.value;
  select.innerHTML = '<option value="">All Locations</option>' +
    addresses.map(a => `<option value="${a}" ${a === current ? 'selected' : ''}>${a}</option>`).join('');
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatCurrency(amount, short = false) {
  if (short && Math.abs(amount) >= 1000) return '$' + (amount / 1000).toFixed(1) + 'k';
  return '$' + amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// ── Bulk Import (browser-side XLSX parsing → Supabase) ────────────────────────
function initImport() {
  const importBtn   = document.getElementById('importBtn');
  const importModal = document.getElementById('importModal');
  const dropzone    = document.getElementById('importDropzone');
  const fileInput   = document.getElementById('importFileInput');

  importBtn.addEventListener('click', () => {
    document.getElementById('importStatus').style.display  = 'none';
    document.getElementById('importResult').style.display  = 'none';
    dropzone.style.display = 'block';
    importModal.classList.add('active');
  });

  document.getElementById('closeImportModal').addEventListener('click', () => importModal.classList.remove('active'));
  importModal.addEventListener('click', (e) => { if (e.target.id === 'importModal') importModal.classList.remove('active'); });

  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault(); dropzone.classList.remove('dragover');
    if (e.dataTransfer.files[0]) handleFileImport(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change', (e) => {
    if (e.target.files[0]) handleFileImport(e.target.files[0]);
    fileInput.value = '';
  });
}

async function handleFileImport(file) {
  const validExt = ['.csv', '.xlsx', '.xls'];
  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
  if (!validExt.includes(ext)) { showImportResult(false, 'Invalid file type. Please upload CSV or Excel.'); return; }

  document.getElementById('importDropzone').style.display = 'none';
  document.getElementById('importStatus').style.display   = 'block';

  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook    = XLSX.read(arrayBuffer, { type: 'array' });
    const sheet       = workbook.Sheets[workbook.SheetNames[0]];
    const data        = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    let headerRow = -1;
    for (let i = 0; i < Math.min(data.length, 10); i++) {
      if (data[i]?.[0] && String(data[i][0]).toLowerCase().includes('property')) { headerRow = i; break; }
    }
    if (headerRow === -1) throw new Error('Could not find header row. Expected columns: Property, Address, Status, Comm %, Jan–Dec');

    const headers = data[headerRow].map(h => String(h || '').toLowerCase().trim());
    const col = {
      property: headers.findIndex(h => h.includes('property')),
      address:  headers.findIndex(h => h.includes('address') || h.includes('market')),
      status:   headers.findIndex(h => h.includes('status')),
      commRate: headers.findIndex(h => h.includes('comm') || h.includes('rate') || h.includes('%')),
    };
    const monthCols = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']
      .map(m => headers.findIndex(h => h === m));

    if (col.property === -1) throw new Error('Missing required "Property" column');

    const existingNames = new Set(properties.map(p => p.name.toLowerCase().trim()));
    let added = 0, skipped = 0;
    const errors = [];

    for (let i = headerRow + 1; i < data.length; i++) {
      const row = data[i];
      if (!row?.[col.property]) continue;
      const name = String(row[col.property]).trim();
      if (!name || ['total','average','avg'].some(w => name.toLowerCase().includes(w))) continue;
      if (existingNames.has(name.toLowerCase())) { skipped++; continue; }

      try {
        const address  = col.address !== -1 && row[col.address] ? String(row[col.address]).trim() : '';
        const status   = col.status  !== -1 && row[col.status]  ? String(row[col.status]).trim()  : 'Active';
        let commRate   = 0.20;
        if (col.commRate !== -1 && row[col.commRate] != null) {
          const v = parseFloat(row[col.commRate]);
          commRate = v > 1 ? v / 100 : v;
        }

        const { data: newProp, error: pErr } = await supabaseClient
          .from('properties')
          .insert({ user_id: currentUser.id, name, address, status, comm_rate: commRate })
          .select().single();

        if (pErr) throw pErr;

        const griRows = monthCols
          .map((colIdx, monthIdx) => ({
            property_id: newProp.id, year: selectedYear, month: monthIdx + 1,
            amount: colIdx !== -1 ? (parseFloat(row[colIdx]) || 0) : 0
          }));

        await supabaseClient.from('property_gri').insert(griRows);
        existingNames.add(name.toLowerCase());
        added++;
      } catch (err) {
        errors.push(`Row ${i + 1}: ${err.message}`);
      }
    }

    await loadData();
    let msg = `Import complete: ${added} added, ${skipped} skipped (duplicates)`;
    if (errors.length) msg += `\n\nWarnings:\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? `\n…and ${errors.length - 5} more` : ''}`;
    showImportResult(true, msg);
  } catch (err) {
    showImportResult(false, err.message || 'Import failed');
  }

  document.getElementById('importStatus').style.display = 'none';
}

function showImportResult(success, message) {
  const result = document.getElementById('importResult');
  document.getElementById('importDropzone').style.display = 'block';
  result.style.display = 'block';
  result.className = 'import-result ' + (success ? 'success' : 'error');
  result.innerHTML = `<h4>${success ? 'Import Successful' : 'Import Failed'}</h4><p>${message.replace(/\n/g, '<br>')}</p>`;
}

// ── Pro Forma Import (browser-side XLSX parsing) ──────────────────────────────
const MONTH_ABBREVS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
const MONTH_FULL    = ['january','february','march','april','may','june','july','august','september','october','november','december'];

function findMonthColumns(data) {
  for (const row of data) {
    if (!row) continue;
    const cells = row.map(c => (c != null ? String(c).toLowerCase().trim() : ''));
    for (const names of [MONTH_ABBREVS, MONTH_FULL]) {
      const cols = names.map(m => cells.indexOf(m));
      if (cols.every(i => i !== -1)) return cols;
    }
  }
  return null;
}

function parseProformaWorkbook(workbook) {
  return workbook.SheetNames.map(sheetName => {
    const ws   = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
    const monthCols = findMonthColumns(data);
    const rows = [];

    for (const row of data) {
      if (!row || row.length === 0) continue;
      const label = row.find(c => typeof c === 'string' && c.trim().length > 1);
      if (!label) continue;

      let values;
      if (monthCols) {
        values = monthCols.map(col => {
          const v = row[col];
          return (typeof v === 'number' && isFinite(v)) ? Math.round(v) : 0;
        });
        if (values.every(v => v === 0)) continue;
      } else {
        values = [];
        for (const cell of row) {
          if (typeof cell === 'number' && isFinite(cell)) {
            values.push(Math.round(cell));
            if (values.length === 12) break;
          }
        }
        if (values.length < 12) continue;
      }

      rows.push({ label: label.trim(), values });
    }

    return { name: sheetName, rows };
  });
}

function initProformaImport() {
  const fileInput = document.getElementById('proformaFileInput');

  document.getElementById('proformaBtn').addEventListener('click', () => {
    proformaTarget = 'add';
    fileInput.click();
  });

  document.getElementById('editProformaBtn').addEventListener('click', () => {
    proformaTarget = 'edit';
    fileInput.click();
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files[0]) handleProformaFile(e.target.files[0]);
    e.target.value = '';
  });

  document.getElementById('closeProformaModal').addEventListener('click', closeProformaModal);
  document.getElementById('proformaModal').addEventListener('click', (e) => {
    if (e.target.id === 'proformaModal') closeProformaModal();
  });

  document.getElementById('proformaSheetSelect').addEventListener('change', onProformaSheetChange);
  document.getElementById('proformaRowSelect').addEventListener('change', onProformaRowChange);
  document.getElementById('proformaConfirmBtn').addEventListener('click', confirmProformaImport);
}

function closeProformaModal() {
  document.getElementById('proformaModal').classList.remove('active');
}

async function handleProformaFile(file) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook    = XLSX.read(arrayBuffer, { type: 'array' });
    proformaSheets    = parseProformaWorkbook(workbook);
    openProformaModal();
  } catch (err) {
    alert('Could not parse file: ' + err.message);
  }
}

function openProformaModal() {
  const sheetSelect = document.getElementById('proformaSheetSelect');
  sheetSelect.innerHTML = proformaSheets.map((s, i) => `<option value="${i}">${s.name}</option>`).join('');

  document.getElementById('proformaRowSection').style.display = 'none';
  document.getElementById('proformaNoRows').style.display     = 'none';
  document.getElementById('proformaConfirmBtn').style.display = 'none';

  document.getElementById('proformaModal').classList.add('active');
  onProformaSheetChange();
}

function onProformaSheetChange() {
  const sheetIdx = parseInt(document.getElementById('proformaSheetSelect').value);
  const rows     = proformaSheets[sheetIdx]?.rows || [];

  const rowSection   = document.getElementById('proformaRowSection');
  const noRows       = document.getElementById('proformaNoRows');
  const autoNotice   = document.getElementById('proformaAutoDetectNotice');
  const rowGroup     = document.getElementById('proformaRowGroup');
  const rowSelect    = document.getElementById('proformaRowSelect');
  const confirmBtn   = document.getElementById('proformaConfirmBtn');

  if (rows.length === 0) {
    rowSection.style.display = 'none';
    noRows.style.display     = 'block';
    confirmBtn.style.display = 'none';
    return;
  }

  noRows.style.display     = 'none';
  rowSection.style.display = 'block';

  const grossRow = rows.find(r => r.label.toLowerCase().includes('gross income'));
  if (grossRow) {
    autoNotice.style.display = 'flex';
    document.getElementById('proformaDetectedLabel').textContent = grossRow.label;
    rowGroup.style.display = 'none';
    renderProformaPreview(grossRow.values);
  } else {
    autoNotice.style.display = 'none';
    rowGroup.style.display   = 'block';
    rowSelect.innerHTML = rows.map((r, i) => `<option value="${i}">${r.label}</option>`).join('');
    renderProformaPreview(rows[0].values);
  }

  confirmBtn.style.display = 'block';
}

function onProformaRowChange() {
  const sheetIdx = parseInt(document.getElementById('proformaSheetSelect').value);
  const rowIdx   = parseInt(document.getElementById('proformaRowSelect').value);
  const row      = proformaSheets[sheetIdx]?.rows[rowIdx];
  if (row) renderProformaPreview(row.values);
}

function renderProformaPreview(values) {
  const preview = document.getElementById('proformaPreview');
  document.getElementById('proformaPreviewGrid').innerHTML = MONTHS.map((m, i) => `
    <div class="proforma-preview-cell">
      <span class="proforma-month">${m}</span>
      <span class="proforma-value">${formatCurrency(values[i] || 0)}</span>
    </div>`).join('');
  preview.style.display = 'block';
}

function confirmProformaImport() {
  const sheetIdx = parseInt(document.getElementById('proformaSheetSelect').value);
  const rows     = proformaSheets[sheetIdx]?.rows || [];
  const grossRow = rows.find(r => r.label.toLowerCase().includes('gross income'));

  const values = grossRow
    ? grossRow.values
    : (rows[parseInt(document.getElementById('proformaRowSelect').value)]?.values || []);

  const prefix = proformaTarget === 'edit' ? 'editGri' : 'gri';
  values.slice(0, 12).forEach((val, i) => {
    const input = document.getElementById(`${prefix}${i + 1}`);
    if (input) input.value = val;
  });

  closeProformaModal();
}

// Make functions available globally for inline onclick handlers
window.openActualModal = openActualModal;
window.openEditModal   = openEditModal;
