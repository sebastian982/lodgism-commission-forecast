// State
let properties = [];
let actuals = [];
let selectedYear = 2026;
let statusFilter = '';
let marketFilter = '';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FULL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// DOM Elements
const yearSelector = document.getElementById('yearSelector');
const tabs = document.querySelectorAll('.tab');
const views = document.querySelectorAll('.view');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  initGriInputs();
  initActualYearOptions();
  initImport();
  loadData();
});

function initEventListeners() {
  // Year selector
  yearSelector.addEventListener('change', (e) => {
    selectedYear = parseInt(e.target.value);
    loadData();
  });

  // Tab navigation
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const viewId = tab.dataset.view;
      tabs.forEach(t => t.classList.remove('active'));
      views.forEach(v => v.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(viewId).classList.add('active');
    });
  });

  // Filters
  document.getElementById('statusFilter').addEventListener('change', (e) => {
    statusFilter = e.target.value;
    renderProperties();
  });

  document.getElementById('marketFilter').addEventListener('change', (e) => {
    marketFilter = e.target.value;
    renderProperties();
  });

  // Add Property Form
  document.getElementById('addPropertyForm').addEventListener('submit', handleAddProperty);

  // Edit Property Modal
  document.getElementById('closeEditModal').addEventListener('click', () => {
    document.getElementById('editPropertyModal').classList.remove('active');
  });
  document.getElementById('editPropertyForm').addEventListener('submit', handleEditProperty);
  document.getElementById('deletePropertyBtn').addEventListener('click', handleDeleteProperty);

  // Actual Modal
  document.getElementById('addActualBtn').addEventListener('click', () => openActualModal());
  document.getElementById('closeActualModal').addEventListener('click', () => {
    document.getElementById('addActualModal').classList.remove('active');
  });
  document.getElementById('actualForm').addEventListener('submit', handleSaveActual);
  document.getElementById('deleteActualBtn').addEventListener('click', handleDeleteActual);

  // Close modals on backdrop click
  document.getElementById('editPropertyModal').addEventListener('click', (e) => {
    if (e.target.id === 'editPropertyModal') {
      e.target.classList.remove('active');
    }
  });
  document.getElementById('addActualModal').addEventListener('click', (e) => {
    if (e.target.id === 'addActualModal') {
      e.target.classList.remove('active');
    }
  });
}

function initGriInputs() {
  const container = document.getElementById('griInputs');
  MONTHS.forEach((month, idx) => {
    container.innerHTML += `
      <div class="gri-input">
        <label>${month}</label>
        <input type="number" id="gri${idx + 1}" step="0.01" min="0" value="0">
      </div>
    `;
  });
}

function initActualYearOptions() {
  const select = document.getElementById('actualYear');
  for (let year = 2025; year <= 2028; year++) {
    select.innerHTML += `<option value="${year}" ${year === 2026 ? 'selected' : ''}>${year}</option>`;
  }
}

// API Calls
async function loadData() {
  try {
    const [propsRes, actualsRes] = await Promise.all([
      fetch(`/api/properties?year=${selectedYear}`),
      fetch('/api/actuals')
    ]);
    properties = await propsRes.json();
    actuals = await actualsRes.json();
    renderAll();
  } catch (error) {
    console.error('Failed to load data:', error);
  }
}

async function handleAddProperty(e) {
  e.preventDefault();

  const gri = [];
  for (let i = 1; i <= 12; i++) {
    const amount = parseFloat(document.getElementById(`gri${i}`).value) || 0;
    gri.push({ year: selectedYear, month: i, amount });
  }

  const property = {
    name: document.getElementById('propName').value,
    market: document.getElementById('propMarket').value,
    status: document.getElementById('propStatus').value,
    commRate: parseFloat(document.getElementById('propCommRate').value),
    note: document.getElementById('propNote').value,
    gri
  };

  try {
    await fetch('/api/properties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(property)
    });
    e.target.reset();
    document.getElementById('propCommRate').value = '0.20';
    // Reset GRI inputs
    for (let i = 1; i <= 12; i++) {
      document.getElementById(`gri${i}`).value = '0';
    }
    // Switch to properties tab
    document.querySelector('[data-view="properties"]').click();
    loadData();
  } catch (error) {
    console.error('Failed to add property:', error);
  }
}

async function handleEditProperty(e) {
  e.preventDefault();

  const id = document.getElementById('editPropId').value;
  const gri = [];
  for (let i = 1; i <= 12; i++) {
    const amount = parseFloat(document.getElementById(`editGri${i}`).value) || 0;
    gri.push({ year: selectedYear, month: i, amount });
  }

  const property = {
    name: document.getElementById('editPropName').value,
    market: document.getElementById('editPropMarket').value,
    status: document.getElementById('editPropStatus').value,
    commRate: parseFloat(document.getElementById('editPropCommRate').value),
    note: document.getElementById('editPropNote').value,
    gri
  };

  try {
    await fetch(`/api/properties/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(property)
    });
    document.getElementById('editPropertyModal').classList.remove('active');
    loadData();
  } catch (error) {
    console.error('Failed to update property:', error);
  }
}

async function handleDeleteProperty() {
  const id = document.getElementById('editPropId').value;
  if (!confirm('Are you sure you want to delete this property?')) return;

  try {
    await fetch(`/api/properties/${id}`, { method: 'DELETE' });
    document.getElementById('editPropertyModal').classList.remove('active');
    loadData();
  } catch (error) {
    console.error('Failed to delete property:', error);
  }
}

function openActualModal(actual = null) {
  const modal = document.getElementById('addActualModal');
  const form = document.getElementById('actualForm');
  const title = document.getElementById('actualModalTitle');
  const deleteBtn = document.getElementById('deleteActualBtn');

  form.reset();

  if (actual) {
    title.textContent = 'Edit Actual';
    document.getElementById('actualId').value = actual.id;
    document.getElementById('actualYear').value = actual.year;
    document.getElementById('actualMonth').value = actual.month;
    document.getElementById('actualAmount').value = actual.amount;
    document.getElementById('actualNote').value = actual.note || '';
    deleteBtn.style.display = 'block';
  } else {
    title.textContent = 'Add Actual';
    document.getElementById('actualId').value = '';
    document.getElementById('actualYear').value = selectedYear;
    deleteBtn.style.display = 'none';
  }

  modal.classList.add('active');
}

async function handleSaveActual(e) {
  e.preventDefault();

  const id = document.getElementById('actualId').value;
  const actual = {
    year: parseInt(document.getElementById('actualYear').value),
    month: parseInt(document.getElementById('actualMonth').value),
    amount: parseFloat(document.getElementById('actualAmount').value),
    note: document.getElementById('actualNote').value
  };

  try {
    if (id) {
      await fetch(`/api/actuals/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(actual)
      });
    } else {
      await fetch('/api/actuals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(actual)
      });
    }
    document.getElementById('addActualModal').classList.remove('active');
    loadData();
  } catch (error) {
    console.error('Failed to save actual:', error);
  }
}

async function handleDeleteActual() {
  const id = document.getElementById('actualId').value;
  if (!confirm('Are you sure you want to delete this actual?')) return;

  try {
    await fetch(`/api/actuals/${id}`, { method: 'DELETE' });
    document.getElementById('addActualModal').classList.remove('active');
    loadData();
  } catch (error) {
    console.error('Failed to delete actual:', error);
  }
}

// Rendering
function renderAll() {
  renderDashboard();
  renderProperties();
  renderMonthlyTable();
  renderActuals();
  updateMarketFilter();
}

function renderDashboard() {
  // Calculate totals
  let totalProjected = 0;
  const monthlyTotals = Array(12).fill(0);

  properties.forEach(prop => {
    const yearGri = prop.gri.filter(g => g.year === selectedYear);
    yearGri.forEach(g => {
      const commission = g.amount * prop.commRate;
      totalProjected += commission;
      monthlyTotals[g.month - 1] += commission;
    });
  });

  // YTD Actuals
  const yearActuals = actuals.filter(a => a.year === selectedYear);
  const ytdActual = yearActuals.reduce((sum, a) => sum + a.amount, 0);
  const variance = ytdActual - totalProjected;

  // Update stat cards
  document.getElementById('totalProjected').textContent = formatCurrency(totalProjected);
  document.getElementById('ytdActual').textContent = formatCurrency(ytdActual);

  const varianceEl = document.getElementById('variance');
  varianceEl.textContent = formatCurrency(variance);
  varianceEl.className = 'stat-value ' + (variance >= 0 ? 'positive' : 'negative');

  document.getElementById('propertyCount').textContent = properties.length;

  // Render chart
  renderChart(monthlyTotals);

  // Portfolio counts
  const activeCount = properties.filter(p => p.status === 'Active').length;
  const launchCount = properties.filter(p => p.status === 'In Launch').length;

  document.getElementById('portfolioCounts').innerHTML = `
    <div class="portfolio-item">
      <div class="label">
        <span class="dot active"></span>
        <span>Active</span>
      </div>
      <span class="count">${activeCount}</span>
    </div>
    <div class="portfolio-item">
      <div class="label">
        <span class="dot launch"></span>
        <span>In Launch</span>
      </div>
      <span class="count">${launchCount}</span>
    </div>
  `;

  // Top earners
  const propCommissions = properties.map(prop => {
    const yearGri = prop.gri.filter(g => g.year === selectedYear);
    const totalCommission = yearGri.reduce((sum, g) => sum + (g.amount * prop.commRate), 0);
    return { ...prop, totalCommission };
  }).sort((a, b) => b.totalCommission - a.totalCommission).slice(0, 5);

  document.getElementById('topEarners').innerHTML = propCommissions.map(prop => `
    <div class="top-earner">
      <div>
        <div class="name">${prop.name}</div>
        <div class="market">${prop.market}</div>
      </div>
      <span class="amount">${formatCurrency(prop.totalCommission)}</span>
    </div>
  `).join('');
}

function renderChart(monthlyTotals) {
  const maxValue = Math.max(...monthlyTotals, 1);
  const container = document.getElementById('monthlyChart');

  container.innerHTML = monthlyTotals.map((value, idx) => {
    const height = (value / maxValue) * 100;
    return `
      <div class="chart-bar">
        <div class="chart-bar-value">${formatCurrency(value, true)}</div>
        <div class="chart-bar-fill" style="height: ${height}%"></div>
        <div class="chart-bar-label">${MONTHS[idx]}</div>
      </div>
    `;
  }).join('');
}

function renderProperties() {
  let filtered = properties;

  if (statusFilter) {
    filtered = filtered.filter(p => p.status === statusFilter);
  }
  if (marketFilter) {
    filtered = filtered.filter(p => p.market === marketFilter);
  }

  const container = document.getElementById('propertiesList');

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <h3>No properties found</h3>
        <p>Try adjusting your filters or add a new property.</p>
      </div>
    `;
    return;
  }

  // Extract state from market (e.g., "Bristol, NH" -> "NH")
  const getState = (market) => {
    const parts = market.split(',');
    return parts.length > 1 ? parts[parts.length - 1].trim() : market;
  };

  // Group by state
  const byState = {};
  filtered.forEach(prop => {
    const state = getState(prop.market);
    if (!byState[state]) byState[state] = [];
    byState[state].push(prop);
  });

  // Sort states alphabetically, then properties within each state
  const sortedStates = Object.keys(byState).sort();
  sortedStates.forEach(state => {
    byState[state].sort((a, b) => a.name.localeCompare(b.name));
  });

  // State full names
  const stateNames = {
    'NH': 'New Hampshire',
    'MA': 'Massachusetts',
    'VT': 'Vermont',
    'ME': 'Maine',
    'CT': 'Connecticut',
    'RI': 'Rhode Island'
  };

  container.innerHTML = sortedStates.map(state => {
    const stateProps = byState[state];
    const stateName = stateNames[state] || state;

    return `
      <div class="state-group">
        <div class="state-header">
          <span class="state-name">${stateName}</span>
          <span class="state-count">${stateProps.length} ${stateProps.length === 1 ? 'property' : 'properties'}</span>
        </div>
        <div class="state-properties">
          ${stateProps.map(prop => {
            const yearGri = prop.gri.filter(g => g.year === selectedYear);
            const totalCommission = yearGri.reduce((sum, g) => sum + (g.amount * prop.commRate), 0);

            return `
              <div class="property-card" onclick="openEditModal(${prop.id})">
                <div class="property-info">
                  <span class="property-name">${prop.name}</span>
                  <div class="property-meta">
                    <span>${prop.market}</span>
                    <span>${(prop.commRate * 100).toFixed(1)}% rate</span>
                  </div>
                </div>
                <div class="property-right">
                  <div class="property-commission">
                    <div class="amount">${formatCurrency(totalCommission)}</div>
                    <div class="label">${selectedYear} projected</div>
                  </div>
                  <span class="badge ${prop.status === 'Active' ? 'active' : 'launch'}">${prop.status}</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }).join('');
}

function openEditModal(id) {
  const prop = properties.find(p => p.id === id);
  if (!prop) return;

  document.getElementById('editPropId').value = prop.id;
  document.getElementById('editPropName').value = prop.name;
  document.getElementById('editPropMarket').value = prop.market;
  document.getElementById('editPropStatus').value = prop.status;
  document.getElementById('editPropCommRate').value = prop.commRate;
  document.getElementById('editPropNote').value = prop.note || '';

  // GRI inputs
  const container = document.getElementById('editGriInputs');
  const yearGri = prop.gri.filter(g => g.year === selectedYear);

  container.innerHTML = MONTHS.map((month, idx) => {
    const griRecord = yearGri.find(g => g.month === idx + 1);
    const amount = griRecord ? griRecord.amount : 0;
    return `
      <div class="gri-input">
        <label>${month}</label>
        <input type="number" id="editGri${idx + 1}" step="0.01" min="0" value="${amount}">
      </div>
    `;
  }).join('');

  document.getElementById('editPropertyModal').classList.add('active');
}

function renderMonthlyTable() {
  const thead = document.querySelector('#monthlyTable thead');
  const tbody = document.querySelector('#monthlyTable tbody');

  // Header
  thead.innerHTML = `
    <tr>
      <th>Property</th>
      ${MONTHS.map(m => `<th>${m}</th>`).join('')}
      <th>Total</th>
    </tr>
  `;

  // Body
  const monthlyTotals = Array(12).fill(0);
  let grandTotal = 0;

  const rows = properties.map(prop => {
    const yearGri = prop.gri.filter(g => g.year === selectedYear);
    let rowTotal = 0;

    const cells = MONTHS.map((_, idx) => {
      const griRecord = yearGri.find(g => g.month === idx + 1);
      const commission = griRecord ? griRecord.amount * prop.commRate : 0;
      monthlyTotals[idx] += commission;
      rowTotal += commission;
      return `<td>${formatCurrency(commission, true)}</td>`;
    }).join('');

    grandTotal += rowTotal;

    return `
      <tr>
        <td>${prop.name}</td>
        ${cells}
        <td>${formatCurrency(rowTotal, true)}</td>
      </tr>
    `;
  }).join('');

  // Total row
  const totalCells = monthlyTotals.map(t => `<td>${formatCurrency(t, true)}</td>`).join('');

  tbody.innerHTML = rows + `
    <tr class="total-row">
      <td>Total</td>
      ${totalCells}
      <td>${formatCurrency(grandTotal, true)}</td>
    </tr>
  `;
}

function renderActuals() {
  // Comparison cards
  const yearActuals = actuals.filter(a => a.year === selectedYear);

  // Calculate forecast by month
  const forecastByMonth = {};
  properties.forEach(prop => {
    const yearGri = prop.gri.filter(g => g.year === selectedYear);
    yearGri.forEach(g => {
      if (!forecastByMonth[g.month]) forecastByMonth[g.month] = 0;
      forecastByMonth[g.month] += g.amount * prop.commRate;
    });
  });

  // Group actuals by month
  const actualsByMonth = {};
  yearActuals.forEach(a => {
    if (!actualsByMonth[a.month]) actualsByMonth[a.month] = 0;
    actualsByMonth[a.month] += a.amount;
  });

  const comparisonContainer = document.getElementById('actualsComparison');
  comparisonContainer.innerHTML = `
    <div class="comparison-card">
      <h4>Forecast vs Actual (${selectedYear})</h4>
      ${MONTHS.map((month, idx) => {
        const forecast = forecastByMonth[idx + 1] || 0;
        const actual = actualsByMonth[idx + 1] || 0;
        const variance = actual - forecast;
        const varianceClass = variance >= 0 ? 'positive' : 'negative';

        if (forecast === 0 && actual === 0) return '';

        return `
          <div class="comparison-row">
            <span class="comparison-label">${month}</span>
            <span class="comparison-value forecast">${formatCurrency(forecast, true)}</span>
            <span class="comparison-value actual">${formatCurrency(actual, true)}</span>
            <span class="comparison-value variance ${varianceClass}">${variance >= 0 ? '+' : ''}${formatCurrency(variance, true)}</span>
          </div>
        `;
      }).join('')}
    </div>
  `;

  // Actuals list
  const container = document.getElementById('actualsList');

  if (actuals.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <h3>No actuals recorded</h3>
        <p>Click "Add Actual" to record commission payments received.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = actuals.map(actual => `
    <div class="actual-item" onclick="openActualModal(${JSON.stringify(actual).replace(/"/g, '&quot;')})">
      <div class="actual-info">
        <span class="actual-date">${FULL_MONTHS[actual.month - 1]} ${actual.year}</span>
        ${actual.note ? `<span class="actual-note">${actual.note}</span>` : ''}
      </div>
      <span class="actual-amount">${formatCurrency(actual.amount)}</span>
    </div>
  `).join('');
}

function updateMarketFilter() {
  const markets = [...new Set(properties.map(p => p.market))].sort();
  const select = document.getElementById('marketFilter');
  const currentValue = select.value;

  select.innerHTML = '<option value="">All Markets</option>' +
    markets.map(m => `<option value="${m}" ${m === currentValue ? 'selected' : ''}>${m}</option>`).join('');
}

// Helpers
function formatCurrency(amount, short = false) {
  if (short && Math.abs(amount) >= 1000) {
    return '$' + (amount / 1000).toFixed(1) + 'k';
  }
  return '$' + amount.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
}

// Import functionality
function initImport() {
  const importBtn = document.getElementById('importBtn');
  const importModal = document.getElementById('importModal');
  const closeImportModal = document.getElementById('closeImportModal');
  const dropzone = document.getElementById('importDropzone');
  const fileInput = document.getElementById('importFileInput');

  importBtn.addEventListener('click', () => {
    // Reset modal state
    document.getElementById('importStatus').style.display = 'none';
    document.getElementById('importResult').style.display = 'none';
    dropzone.style.display = 'block';
    importModal.classList.add('active');
  });

  closeImportModal.addEventListener('click', () => {
    importModal.classList.remove('active');
  });

  importModal.addEventListener('click', (e) => {
    if (e.target.id === 'importModal') {
      importModal.classList.remove('active');
    }
  });

  // Dropzone events
  dropzone.addEventListener('click', () => fileInput.click());

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) handleFileImport(file);
  });

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleFileImport(file);
    fileInput.value = ''; // Reset for re-upload of same file
  });
}

async function handleFileImport(file) {
  const dropzone = document.getElementById('importDropzone');
  const status = document.getElementById('importStatus');
  const result = document.getElementById('importResult');

  // Validate file type
  const validTypes = ['.csv', '.xlsx', '.xls'];
  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
  if (!validTypes.includes(ext)) {
    showImportResult(false, 'Invalid file type. Please upload a CSV or Excel file.');
    return;
  }

  // Show loading state
  dropzone.style.display = 'none';
  status.style.display = 'block';
  result.style.display = 'none';

  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/import', {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    if (response.ok && data.success) {
      let message = data.message;
      if (data.errors && data.errors.length > 0) {
        message += `\n\nWarnings:\n${data.errors.slice(0, 5).join('\n')}`;
        if (data.errors.length > 5) {
          message += `\n...and ${data.errors.length - 5} more`;
        }
      }
      showImportResult(true, message);
      loadData(); // Refresh the property list
    } else {
      showImportResult(false, data.error || 'Import failed');
    }
  } catch (error) {
    console.error('Import error:', error);
    showImportResult(false, 'Import failed: ' + error.message);
  }

  status.style.display = 'none';
}

function showImportResult(success, message) {
  const dropzone = document.getElementById('importDropzone');
  const result = document.getElementById('importResult');

  dropzone.style.display = 'block';
  result.style.display = 'block';
  result.className = 'import-result ' + (success ? 'success' : 'error');
  result.innerHTML = `
    <h4>${success ? 'Import Successful' : 'Import Failed'}</h4>
    <p>${message.replace(/\n/g, '<br>')}</p>
  `;
}

// Make openActualModal available globally for onclick
window.openActualModal = openActualModal;
