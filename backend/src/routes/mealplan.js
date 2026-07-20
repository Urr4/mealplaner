const { Router } = require('express');
const { query } = require('../db');
const { getImageUrl } = require('../minio');

const router = Router();

async function enrichRecipeSummary(recipe) {
  let imageUrl = null;
  if (recipe.image_id) {
    try { imageUrl = await getImageUrl(recipe.image_id); } catch { /* ignorieren */ }
  }
  const persons = query(
    `SELECT p.id, p.name, rp.preference FROM recipe_persons rp
     JOIN persons p ON p.id = rp.person_id WHERE rp.recipe_id = ?`,
    [recipe.id]
  ).rows;
  const ingredientCount = query(
    'SELECT COUNT(*) as cnt FROM recipe_ingredients WHERE recipe_id = ?', [recipe.id]
  ).rows[0]?.cnt || 0;

  return {
    id: recipe.id,
    name: recipe.name,
    description: recipe.description,
    imageUrl,
    ingredientCount,
    likedBy: persons.filter(p => p.preference === 'liked').map(p => ({ id: p.id, name: p.name })),
    dislikedBy: persons.filter(p => p.preference === 'disliked').map(p => ({ id: p.id, name: p.name })),
  };
}

// ── GET /api/mealplan/current ─────────────────────────────────────────────────
router.get('/current', async (req, res) => {
  try {
    const rows = query('SELECT position, recipe_id, no_match FROM meal_plan ORDER BY position').rows;
    if (!rows.length) return res.json([]);

    const result = await Promise.all(rows.map(async row => {
      if (row.no_match || !row.recipe_id) return { recipe: null, noMatch: true };
      const recipe = query('SELECT * FROM recipes WHERE id = ?', [row.recipe_id]).rows[0];
      if (!recipe) return { recipe: null, noMatch: true };
      return { recipe: await enrichRecipeSummary(recipe), noMatch: false };
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Laden des Wochenplans' });
  }
});

// ── POST /api/mealplan/generate ───────────────────────────────────────────────
// Body: { count: number, constraints: [{ personId, preference: 'liked'|'disliked', count }] }
// Only recipes marked as "Hauptmahlzeit" (category = 'main') are eligible for the meal plan.
router.post('/generate', async (req, res) => {
  try {
    const { count = 4, constraints = [] } = req.body;
    const allRecipes = query("SELECT * FROM recipes WHERE category = 'main'").rows;

    if (allRecipes.length === 0) {
      return res.status(400).json({ error: 'Keine Hauptmahlzeiten-Rezepte vorhanden. Bitte erst Rezepte anlegen.' });
    }

    const selectedIds = new Set();
    const entries = []; // { recipe | null, noMatch: boolean }

    function pickRandom(pool) {
      const available = pool.filter(r => !selectedIds.has(r.id));
      if (!available.length) return null;
      return available[Math.floor(Math.random() * available.length)];
    }

    // Apply constraints first — each unfilled constrained slot becomes noMatch
    for (const constraint of constraints) {
      const { personId, preference, count: constraintCount } = constraint;
      if (!personId || !constraintCount) continue;

      const matchingIds = query(
        'SELECT recipe_id FROM recipe_persons WHERE person_id = ? AND preference = ?',
        [personId, preference]
      ).rows.map(r => r.recipe_id);

      const pool = allRecipes.filter(r => matchingIds.includes(r.id));

      for (let i = 0; i < constraintCount && entries.length < count; i++) {
        const recipe = pickRandom(pool);
        if (recipe) {
          selectedIds.add(recipe.id);
          entries.push({ recipe, noMatch: false });
        } else {
          entries.push({ recipe: null, noMatch: true });
        }
      }
    }

    // Fill remaining slots randomly
    while (entries.length < count) {
      const recipe = pickRandom(allRecipes);
      if (!recipe) {
        entries.push({ recipe: null, noMatch: true });
        break;
      }
      selectedIds.add(recipe.id);
      entries.push({ recipe, noMatch: false });
    }

    // Persist to DB
    query('DELETE FROM meal_plan');
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      query(
        'INSERT INTO meal_plan (position, recipe_id, no_match) VALUES (?, ?, ?)',
        [i, entry.recipe ? entry.recipe.id : null, entry.noMatch ? 1 : 0]
      );
    }

    const result = await Promise.all(
      entries.map(async entry => ({
        recipe: entry.recipe ? await enrichRecipeSummary(entry.recipe) : null,
        noMatch: entry.noMatch,
      }))
    );

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Erstellen des Wochenplans' });
  }
});

// ── POST /api/mealplan/swap ───────────────────────────────────────────────────
// Body: { currentRecipeIds: string[], recipeIdToSwap: string, position: number, preference?: { personId, preference } }
router.post('/swap', async (req, res) => {
  try {
    const { currentRecipeIds, recipeIdToSwap, position, preferenceConstraint } = req.body;
    let pool = query("SELECT * FROM recipes WHERE category = 'main'").rows.filter(r => !currentRecipeIds.includes(r.id));

    if (preferenceConstraint?.personId) {
      const matchingIds = query(
        'SELECT recipe_id FROM recipe_persons WHERE person_id = ? AND preference = ?',
        [preferenceConstraint.personId, preferenceConstraint.preference]
      ).rows.map(r => r.recipe_id);
      const filtered = pool.filter(r => matchingIds.includes(r.id));
      if (filtered.length) pool = filtered;
    }

    if (!pool.length) {
      return res.status(400).json({ error: 'Keine weiteren Rezepte verfügbar' });
    }

    const replacement = pool[Math.floor(Math.random() * pool.length)];

    // Persist the swap
    if (position !== undefined) {
      query(
        'UPDATE meal_plan SET recipe_id = ?, no_match = 0 WHERE position = ?',
        [replacement.id, position]
      );
    }

    res.json(await enrichRecipeSummary(replacement));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Austauschen des Rezepts' });
  }
});

// ── POST /api/mealplan/shopping-list ─────────────────────────────────────────
// Body: { recipeIds: string[] }
router.post('/shopping-list', async (req, res) => {
  try {
    const { recipeIds } = req.body;
    if (!recipeIds?.length) return res.status(400).json({ error: 'Keine Rezepte angegeben' });

    const aggregated = {};
    for (const id of recipeIds) {
      const ingredients = query(
        'SELECT name, quantity, unit FROM recipe_ingredients WHERE recipe_id = ?', [id]
      ).rows;
      for (const ing of ingredients) {
        const key = `${ing.name.toLowerCase()}::${ing.unit.toLowerCase()}`;
        if (!aggregated[key]) {
          aggregated[key] = { name: ing.name, unit: ing.unit, quantities: [] };
        }
        if (ing.quantity) aggregated[key].quantities.push(ing.quantity);
      }
    }

    const items = Object.values(aggregated).map(item => {
      const nums = item.quantities.map(Number).filter(n => !isNaN(n) && n > 0);
      const quantity = nums.length === item.quantities.length && nums.length > 0
        ? String(nums.reduce((a, b) => a + b, 0))
        : item.quantities.join(' + ');
      return { name: item.name, quantity, unit: item.unit };
    });

    res.json({ items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Erstellen der Einkaufsliste' });
  }
});

module.exports = router;
