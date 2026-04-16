const express = require('express');
const path = require('path');
const open = require('open');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/properties', require('./routes/properties'));
app.use('/api/actuals', require('./routes/actuals'));
app.use('/api/export', require('./routes/export'));

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  open(`http://localhost:${PORT}`);
});
