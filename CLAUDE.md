# Lodgism Commission Forecast

Personal dashboard to track projected and actual commission earnings from short-term rental properties.

## Quick Start
npm start                    # Runs on http://localhost:3000
rm lodgism.db && npm start   # Reset and re-seed database

## Project Structure
├── server.js           # Express server, mounts API routes
├── db/database.js      # SQLite (sql.js) database, seeding logic
├── routes/
│   ├── properties.js   # CRUD for properties and GRI data
│   ├── actuals.js      # CRUD for actual commission payments
│   ├── export.js       # JSON export endpoint
│   └── import.js       # CSV/XLSX import endpoint
├── public/
│   ├── index.html      # Single-page app shell
│   ├── app.js          # Frontend state management and rendering
│   └── styles.css      # Lodgism-branded theme (purple/white)
└── lodgism.db          # SQLite database file (auto-created)

## Database Schema
- properties: id, name, market, status, commRate, note, createdAt, updatedAt
- property_gri: id, propertyId, year, month, amount (monthly GRI projections)
- actuals: id, year, month, amount, note (actual commission payments received)

## Key Patterns
- sql.js (WebAssembly SQLite) for Node 24 compatibility
- Commission = GRI amount × commRate
- Properties grouped by state (NH/MA), sorted alphabetically
- Status: "Active" or "In Launch"
- Commission rates stored as decimals (0.05 = 5%)

## Data Source
Excel file: ~/Desktop/Claude Code Main Folder/Lodgism_Commission_Forecast_2026.xlsx
- 26 properties (21 Active, 5 In Launch)
- Markets: NH (Bristol, Alton, Lincoln, etc.) and MA (Mashpee, Harwichport, etc.)
- Commission rates: 1.6% to 5%

## API Endpoints
GET  /api/properties?year=2026  - List properties with GRI data
POST /api/properties            - Create property with GRI
PUT  /api/properties/:id        - Update property
DELETE /api/properties/:id      - Delete property
GET  /api/actuals               - List actual payments
POST /api/actuals               - Record actual payment
POST /api/import                - Import CSV/XLSX (multipart/form-data)
GET  /api/export                - Export all data as JSON

## Branding
- Primary color: #7C3AED (purple)
- Font: Inter
- Light theme with white background
- Logo: House icon + "LODGISM" text
