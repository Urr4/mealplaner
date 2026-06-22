const { Router } = require('express');
const { query } = require('../db');

const router = Router();

// ── GET /api/settings ─────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  try {
    const rows = query('SELECT key, value FROM settings').rows;
    const settings = {};
    for (const row of rows) settings[row.key] = row.value;
    res.json(settings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Laden der Einstellungen' });
  }
});

// ── PUT /api/settings ─────────────────────────────────────────────────────────
router.put('/', (req, res) => {
  try {
    const allowed = ['ollama_url', 'ollama_vision_model', 'ollama_text_model'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        query('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, req.body[key]]);
      }
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Speichern der Einstellungen' });
  }
});

module.exports = router;

