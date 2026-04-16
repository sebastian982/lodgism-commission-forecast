# Lodgism Commission Forecast

Personal dashboard to track projected and actual commission earnings from short-term rental properties.

## Features

- Dashboard with stat cards, monthly bar chart, and top earners
- Property management with inline editing
- Monthly breakdown matrix (properties × 12 months)
- Actuals tracking with forecast vs actual comparison
- Year selector (2025-2028)
- JSON export for backup

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the server:
   ```bash
   node server.js
   ```

   The browser will automatically open to http://localhost:3000

## Tech Stack

- **Backend**: Express.js, better-sqlite3
- **Frontend**: Vanilla JavaScript SPA
- **Database**: SQLite (file-based)
- **Theme**: Dark green aesthetic

## API Endpoints

- `GET /api/properties` - List all properties with GRI data
- `POST /api/properties` - Create property
- `GET /api/properties/:id` - Get single property
- `PUT /api/properties/:id` - Update property
- `DELETE /api/properties/:id` - Delete property
- `GET /api/actuals` - List all actuals
- `POST /api/actuals` - Create actual
- `PUT /api/actuals/:id` - Update actual
- `DELETE /api/actuals/:id` - Delete actual
- `GET /api/export` - Full JSON backup
