const express = require('express');
const path = require('path');
const { initDB, getDB } = require('./db/database');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize database and start server
async function start() {
  await initDB();

  // API Routes
  app.use('/api/properties', require('./routes/properties'));
  app.use('/api/actuals', require('./routes/actuals'));
  app.use('/api/export', require('./routes/export'));

  app.listen(PORT, async () => {
    console.log(`Server running at http://localhost:${PORT}`);
    const open = (await import('open')).default;
    open(`http://localhost:${PORT}`);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
