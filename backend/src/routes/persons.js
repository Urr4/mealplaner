const { Router } = require('express');
const { query, uuidv4 } = require('../db');

const router = Router();

// ── GET /api/persons ──────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  try {
    const persons = query('SELECT id, name FROM persons ORDER BY name').rows;
    res.json(persons);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Laden der Personen' });
  }
});

// ── POST /api/persons ─────────────────────────────────────────────────────────
router.post('/', (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name ist erforderlich' });

    const existing = query('SELECT id FROM persons WHERE name = ?', [name.trim()]).rows;
    if (existing.length) return res.status(409).json({ error: 'Person existiert bereits' });

    const id = uuidv4();
    query('INSERT INTO persons (id, name) VALUES (?, ?)', [id, name.trim()]);
    res.status(201).json({ id, name: name.trim() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Erstellen der Person' });
  }
});

// ── DELETE /api/persons/:id ───────────────────────────────────────────────────
router.delete('/:id', (req, res) => {
  try {
    const rows = query('SELECT id FROM persons WHERE id = ?', [req.params.id]).rows;
    if (!rows.length) return res.status(404).json({ error: 'Person nicht gefunden' });

    query('DELETE FROM persons WHERE id = ?', [req.params.id]);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Löschen der Person' });
  }
});

module.exports = router;
