const { Router } = require('express');
const multer = require('multer');
const { query, uuidv4 } = require('../db');
const { uploadImage, deleteImage, getImageUrl } = require('../minio');
const ollama = require('../ollama');
const { extractRecipeText } = require('../recipe-scraper');

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// ── Helpers ──────────────────────────────────────────────────────────────────

async function enrichRecipe(recipe) {
  const ingredients = query(
    'SELECT id, name, quantity, unit, sort_order FROM recipe_ingredients WHERE recipe_id = ? ORDER BY sort_order',
    [recipe.id]
  ).rows;

  const steps = query(
    'SELECT id, step_number, instruction FROM recipe_steps WHERE recipe_id = ? ORDER BY step_number',
    [recipe.id]
  ).rows;

  const persons = query(
    `SELECT p.id, p.name, rp.preference
     FROM recipe_persons rp
     JOIN persons p ON p.id = rp.person_id
     WHERE rp.recipe_id = ?`,
    [recipe.id]
  ).rows;

  let imageUrl = null;
  if (recipe.image_id) {
    try { imageUrl = await getImageUrl(recipe.image_id); } catch { /* MinIO nicht verfügbar */ }
  }

  let components;
  if (recipe.is_composed) {
    components = query(
      `SELECT r.id, r.name FROM recipe_components rc
       JOIN recipes r ON r.id = rc.component_recipe_id
       WHERE rc.composed_recipe_id = ? ORDER BY rc.sort_order`,
      [recipe.id]
    ).rows;
  }

  return {
    id: recipe.id,
    name: recipe.name,
    description: recipe.description,
    imageUrl,
    imageId: recipe.image_id,
    category: recipe.category || 'main',
    isComposed: !!recipe.is_composed,
    components,
    ingredients,
    steps,
    likedBy: persons.filter(p => p.preference === 'liked').map(p => ({ id: p.id, name: p.name })),
    dislikedBy: persons.filter(p => p.preference === 'disliked').map(p => ({ id: p.id, name: p.name })),
    createdAt: recipe.created_at,
  };
}

function saveIngredients(recipeId, ingredients) {
  query('DELETE FROM recipe_ingredients WHERE recipe_id = ?', [recipeId]);
  for (let i = 0; i < ingredients.length; i++) {
    const ing = ingredients[i];
    query(
      'INSERT INTO recipe_ingredients (id, recipe_id, name, quantity, unit, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
      [uuidv4(), recipeId, ing.name, ing.quantity || '', ing.unit || '', i]
    );
  }
}

function saveSteps(recipeId, steps) {
  query('DELETE FROM recipe_steps WHERE recipe_id = ?', [recipeId]);
  steps.forEach((instruction, i) => {
    query(
      'INSERT INTO recipe_steps (id, recipe_id, step_number, instruction) VALUES (?, ?, ?, ?)',
      [uuidv4(), recipeId, i + 1, typeof instruction === 'string' ? instruction : instruction.instruction]
    );
  });
}

function savePersonPreferences(recipeId, likedBy, dislikedBy) {
  query('DELETE FROM recipe_persons WHERE recipe_id = ?', [recipeId]);
  for (const personId of (likedBy || [])) {
    query('INSERT INTO recipe_persons (recipe_id, person_id, preference) VALUES (?, ?, ?)', [recipeId, personId, 'liked']);
  }
  for (const personId of (dislikedBy || [])) {
    query('INSERT INTO recipe_persons (recipe_id, person_id, preference) VALUES (?, ?, ?)', [recipeId, personId, 'disliked']);
  }
}

const normalizeCategory = category => (category === 'other' ? 'other' : 'main');

// ── GET /api/recipes ──────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { name, ingredient, category, composed } = req.query;
    // By default only "normal" recipes are listed — composed recipes (see
    // POST /composed) are hidden here and only surface in their own tab.
    const wantComposed = composed === 'true' || composed === '1';
    let sql = 'SELECT DISTINCT r.* FROM recipes r';
    const params = [];
    const conditions = ['r.is_composed = ?'];
    params.push(wantComposed ? 1 : 0);

    if (ingredient) {
      sql += ' JOIN recipe_ingredients ri ON ri.recipe_id = r.id AND ri.name LIKE ?';
      params.push(`%${ingredient}%`);
    }

    if (name) {
      conditions.push('r.name LIKE ?');
      params.push(`%${name}%`);
    }

    if (category) {
      conditions.push('r.category = ?');
      params.push(category);
    }

    sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY r.created_at DESC';
    const recipes = query(sql, params).rows;
    const enriched = await Promise.all(recipes.map(enrichRecipe));
    res.json(enriched);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Laden der Rezepte' });
  }
});

// ── POST /api/recipes/composed ────────────────────────────────────────────────
// Combines several non-main recipes (e.g. "Kartoffelpüree" + "Schnitzel") into a
// single virtual main-dish recipe. Its ingredients/steps are copied from the
// selected components so it behaves exactly like a normal recipe everywhere
// else (meal plan, shopping list, printing) while being hidden from the
// regular recipe list.
router.post('/composed', async (req, res) => {
  try {
    const { name, componentRecipeIds } = req.body;
    if (!name) return res.status(400).json({ error: 'Name ist erforderlich' });
    if (!Array.isArray(componentRecipeIds) || componentRecipeIds.length < 2) {
      return res.status(400).json({ error: 'Mindestens zwei Rezepte auswählen' });
    }

    const components = componentRecipeIds.map(id => {
      const rows = query('SELECT * FROM recipes WHERE id = ?', [id]).rows;
      if (!rows.length) throw new Error(`Rezept ${id} nicht gefunden`);
      if (rows[0].category !== 'other' || rows[0].is_composed) {
        throw new Error(`Rezept "${rows[0].name}" ist keine gültige Zutat-Komponente (nur Sonstiges-Rezepte erlaubt)`);
      }
      return rows[0];
    });

    const id = uuidv4();
    query(
      'INSERT INTO recipes (id, name, description, category, is_composed) VALUES (?, ?, ?, ?, ?)',
      [id, name, '', 'main', 1]
    );

    let sortOrder = 0;
    let stepNumber = 0;
    for (let i = 0; i < components.length; i++) {
      const component = components[i];
      query(
        'INSERT INTO recipe_components (id, composed_recipe_id, component_recipe_id, sort_order) VALUES (?, ?, ?, ?)',
        [uuidv4(), id, component.id, i]
      );

      const ingredients = query(
        'SELECT name, quantity, unit FROM recipe_ingredients WHERE recipe_id = ? ORDER BY sort_order',
        [component.id]
      ).rows;
      for (const ing of ingredients) {
        query(
          'INSERT INTO recipe_ingredients (id, recipe_id, name, quantity, unit, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
          [uuidv4(), id, ing.name, ing.quantity || '', ing.unit || '', sortOrder++]
        );
      }

      const steps = query(
        'SELECT instruction FROM recipe_steps WHERE recipe_id = ? ORDER BY step_number',
        [component.id]
      ).rows;
      if (steps.length) {
        stepNumber++;
        query(
          'INSERT INTO recipe_steps (id, recipe_id, step_number, instruction) VALUES (?, ?, ?, ?)',
          [uuidv4(), id, stepNumber, `— ${component.name} —`]
        );
        for (const step of steps) {
          stepNumber++;
          query(
            'INSERT INTO recipe_steps (id, recipe_id, step_number, instruction) VALUES (?, ?, ?, ?)',
            [uuidv4(), id, stepNumber, step.instruction]
          );
        }
      }
    }

    const recipe = query('SELECT * FROM recipes WHERE id = ?', [id]).rows[0];
    res.status(201).json(await enrichRecipe(recipe));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Fehler beim Erstellen des zusammengesetzten Rezepts' });
  }
});

// ── POST /api/recipes ─────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { name, description, ingredients, steps, likedBy, dislikedBy, category } = req.body;
    if (!name) return res.status(400).json({ error: 'Name ist erforderlich' });

    const id = uuidv4();
    query('INSERT INTO recipes (id, name, description, category) VALUES (?, ?, ?, ?)', [id, name, description || '', normalizeCategory(category)]);
    if (ingredients?.length) saveIngredients(id, ingredients);
    if (steps?.length) saveSteps(id, steps);
    savePersonPreferences(id, likedBy, dislikedBy);

    const recipe = query('SELECT * FROM recipes WHERE id = ?', [id]).rows[0];
    res.status(201).json(await enrichRecipe(recipe));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Erstellen des Rezepts' });
  }
});

// ── GET /api/recipes/ollama/status ────────────────────────────────────────────
router.get('/ollama/status', async (req, res) => {
  const available = await ollama.isAvailable();
  const { downloading, modelsReady, error } = ollama.getStatus();

  // Self-heal: if ollama just became reachable but ensureModels never completed
  // (e.g. it was unreachable at container startup), kick it off now. Skip if a
  // previous attempt already failed — retrying automatically on every poll
  // would hammer the Ollama server with the same failing pull request. A fresh
  // attempt is triggered by saving Settings (see routes/settings.js) or a
  // backend restart.
  if (available && !modelsReady && !downloading && !error) {
    ollama.ensureModels().catch(err =>
      console.error('[ollama] ensureModels Fehler:', err.message)
    );
  }

  res.json({ available, downloading, modelsReady, error });
});

// ── GET /api/recipes/ingredients/canonical ────────────────────────────────────
router.get('/ingredients/canonical', (req, res) => {
  try {
    const rows = query(
      `SELECT LOWER(name) as name, LOWER(unit) as unit, COUNT(*) as cnt
       FROM recipe_ingredients
       WHERE name != '' AND unit != ''
       GROUP BY LOWER(name), LOWER(unit)
       ORDER BY LOWER(name), cnt DESC`
    ).rows;
    const canonical = {};
    for (const row of rows) {
      if (!canonical[row.name]) canonical[row.name] = row.unit;
    }
    res.json(canonical);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Laden der Einheiten' });
  }
});

// ── GET /api/recipes/units ────────────────────────────────────────────────────
router.get('/units', (req, res) => {
  try {
    const rows = query(
      `SELECT DISTINCT unit FROM recipe_ingredients WHERE unit != '' ORDER BY unit`
    ).rows;
    res.json(rows.map(r => r.unit));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Laden der Einheiten' });
  }
});

// ── POST /api/recipes/parse/image ─────────────────────────────────────────────
router.post('/parse/image', upload.single('file'), async (req, res) => {
  try {
    const { downloading } = ollama.getStatus();
    if (downloading) return res.status(503).json({ error: 'Nicht verfügbar, nötige Systeme werden installiert' });
    if (!await ollama.isAvailable()) {
      return res.status(503).json({ error: 'Das Feature ist nur verfügbar, wenn der PC eingeschaltet ist' });
    }
    const base64 = req.file.buffer.toString('base64');
    const result = await ollama.parseRecipeFromImage(base64, req.file.mimetype);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: `Fehler beim Analysieren des Bildes: ${err.message}` });
  }
});

// ── POST /api/recipes/parse/text ──────────────────────────────────────────────
router.post('/parse/text', async (req, res) => {
  try {
    const { downloading } = ollama.getStatus();
    if (downloading) return res.status(503).json({ error: 'Nicht verfügbar, nötige Systeme werden installiert' });
    if (!await ollama.isAvailable()) {
      return res.status(503).json({ error: 'Das Feature ist nur verfügbar, wenn der PC eingeschaltet ist' });
    }
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Text ist erforderlich' });
    const result = await ollama.parseRecipeFromText(text);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: `Fehler beim Verarbeiten des Textes: ${err.message}` });
  }
});

// ── POST /api/recipes/parse/url ───────────────────────────────────────────────
router.post('/parse/url', async (req, res) => {
  try {
    const { downloading } = ollama.getStatus();
    if (downloading) return res.status(503).json({ error: 'Nicht verfügbar, nötige Systeme werden installiert' });
    if (!await ollama.isAvailable()) {
      return res.status(503).json({ error: 'Das Feature ist nur verfügbar, wenn der PC eingeschaltet ist' });
    }

    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL ist erforderlich' });

    let parsedUrl;
    try {
      parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('invalid protocol');
    } catch {
      return res.status(400).json({ error: 'Rezept auslesen nicht möglich, weil die URL ungültig ist' });
    }

    const { default: fetch } = await import('node-fetch');
    let response;
    try {
      response = await fetch(parsedUrl.toString(), {
        redirect: 'follow',
        signal: AbortSignal.timeout(15000),
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MealplanerBot/1.0; +https://github.com/)',
          'Accept': 'text/html,application/xhtml+xml',
        },
      });
    } catch (err) {
      return res.status(502).json({ error: `Rezept auslesen nicht möglich, weil die Seite nicht erreichbar ist (${err.message})` });
    }

    if (!response.ok) {
      return res.status(502).json({ error: `Rezept auslesen nicht möglich, weil die Seite nicht erreichbar ist (Status ${response.status})` });
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('html')) {
      return res.status(422).json({ error: 'Rezept auslesen nicht möglich, weil die Seite keine HTML-Seite ist' });
    }

    const html = await response.text();

    let text;
    try {
      text = extractRecipeText(html, parsedUrl.toString());
    } catch (err) {
      console.error(err);
      text = null;
    }

    if (!text || text.trim().length < 150) {
      return res.status(422).json({ error: 'Rezept auslesen nicht möglich, weil auf der Seite kein Rezept gefunden wurde' });
    }

    try {
      const result = await ollama.parseRecipeFromWebpage(text);
      res.json(result);
    } catch (err) {
      return res.status(422).json({ error: `Rezept auslesen nicht möglich, weil ${err.message}` });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: `Fehler beim Auslesen des Rezepts: ${err.message}` });
  }
});

// ── GET /api/recipes/:id ──────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const rows = query('SELECT * FROM recipes WHERE id = ?', [req.params.id]).rows;
    if (!rows.length) return res.status(404).json({ error: 'Rezept nicht gefunden' });
    res.json(await enrichRecipe(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Laden des Rezepts' });
  }
});

// ── PUT /api/recipes/:id ──────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const { name, description, ingredients, steps, likedBy, dislikedBy, category } = req.body;
    const existing = query('SELECT * FROM recipes WHERE id = ?', [req.params.id]).rows;
    if (!existing.length) return res.status(404).json({ error: 'Rezept nicht gefunden' });

    query('UPDATE recipes SET name = ?, description = ?, category = ? WHERE id = ?', [name, description || '', normalizeCategory(category), req.params.id]);
    if (ingredients !== undefined) saveIngredients(req.params.id, ingredients);
    if (steps !== undefined) saveSteps(req.params.id, steps);
    savePersonPreferences(req.params.id, likedBy, dislikedBy);

    const recipe = query('SELECT * FROM recipes WHERE id = ?', [req.params.id]).rows[0];
    res.json(await enrichRecipe(recipe));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Aktualisieren des Rezepts' });
  }
});

// ── DELETE /api/recipes/:id ───────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const rows = query('SELECT * FROM recipes WHERE id = ?', [req.params.id]).rows;
    if (!rows.length) return res.status(404).json({ error: 'Rezept nicht gefunden' });

    if (rows[0].image_id) {
      try { await deleteImage(rows[0].image_id); } catch { /* Bild löschen ignorieren */ }
    }

    query('DELETE FROM recipes WHERE id = ?', [req.params.id]);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Löschen des Rezepts' });
  }
});

// ── POST /api/recipes/:id/image ───────────────────────────────────────────────
router.post('/:id/image', upload.single('file'), async (req, res) => {
  try {
    const rows = query('SELECT * FROM recipes WHERE id = ?', [req.params.id]).rows;
    if (!rows.length) return res.status(404).json({ error: 'Rezept nicht gefunden' });

    if (rows[0].image_id) {
      try { await deleteImage(rows[0].image_id); } catch { /* altes Bild löschen */ }
    }

    const key = `recipes/${req.params.id}/${uuidv4()}`;
    await uploadImage(key, req.file.buffer, req.file.mimetype);
    query('UPDATE recipes SET image_id = ? WHERE id = ?', [key, req.params.id]);

    const recipe = query('SELECT * FROM recipes WHERE id = ?', [req.params.id]).rows[0];
    res.json(await enrichRecipe(recipe));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Hochladen des Bildes' });
  }
});

// ── DELETE /api/recipes/:id/image ─────────────────────────────────────────────
router.delete('/:id/image', async (req, res) => {
  try {
    const rows = query('SELECT * FROM recipes WHERE id = ?', [req.params.id]).rows;
    if (!rows.length) return res.status(404).json({ error: 'Rezept nicht gefunden' });

    if (rows[0].image_id) {
      try { await deleteImage(rows[0].image_id); } catch { /* ignorieren */ }
      query('UPDATE recipes SET image_id = NULL WHERE id = ?', [req.params.id]);
    }

    const recipe = query('SELECT * FROM recipes WHERE id = ?', [req.params.id]).rows[0];
    res.json(await enrichRecipe(recipe));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Löschen des Bildes' });
  }
});

module.exports = router;
