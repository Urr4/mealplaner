const express = require('express');
const path = require('path');
const { initDb } = require('./db');
const { ensureBucket } = require('./minio-init');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// ── Lokaler Bild-Speicher ──────────────────────────────────
if ((process.env.STORAGE_TYPE || 'minio') === 'local') {
  const { BASE_DIR } = require('./local-storage');
  app.use('/images', express.static(BASE_DIR));
  console.log(`[storage] Bilder lokal unter ${BASE_DIR} (→ /images/…)`);
}

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/recipes', require('./routes/recipes'));
app.use('/api/persons', require('./routes/persons'));
app.use('/api/mealplan', require('./routes/mealplan'));
app.use('/api/settings', require('./routes/settings'));

// ── Frontend (im Prod-Modus statisch ausgeliefert) ────────────────────────────
if (process.env.NODE_ENV === 'production') {
  const staticPath = path.join(__dirname, '../../frontend/dist');
  // Assets (JS/CSS) have content-hash filenames → long cache is fine
  app.use(express.static(staticPath));
  // index.html must never be cached so the browser always gets the latest asset hashes
  app.get('*', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(staticPath, 'index.html'));
  });
}

// ── Start ─────────────────────────────────────────────────────────────────────
async function start() {
  await initDb();
  await ensureBucket();
  app.listen(PORT, () => {
    console.log(`[server] Mealplaner läuft auf Port ${PORT}`);
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[server] API: http://localhost:${PORT}/api`);
      console.log(`[server] Frontend: http://localhost:5173 (Vite)`);
    }
    // Kick off model download in the background — doesn't block server startup
    require('./ollama').ensureModels().catch(err =>
      console.error('[ollama] ensureModels Fehler:', err.message)
    );
  });
}

start().catch(err => {
  console.error('[server] Fehler beim Starten:', err);
  process.exit(1);
});

process.on('uncaughtException', err => {
  console.error('[server] Uncaught Exception — Server wird neu gestartet:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[server] Unhandled Rejection — Server wird neu gestartet:', reason);
  process.exit(1);
});
