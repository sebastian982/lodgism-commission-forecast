/**
 * Local development server — serves /public as a static site.
 * All data operations are handled by the Supabase JS client in the browser.
 *
 * Production: deploy the /public folder to Netlify, Vercel, or GitHub Pages.
 *   netlify deploy --dir=public --prod
 *   vercel --prod  (set outputDirectory=public in vercel.json)
 */

const express = require('express');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, async () => {
  console.log(`Dev server → http://localhost:${PORT}`);
  try {
    const open = (await import('open')).default;
    await open(`http://localhost:${PORT}`);
  } catch (_) {}
});
