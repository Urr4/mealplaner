const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');

const MAX_TEXT_LENGTH = 8000; // keep prompts small enough for local LLMs

/** Recursively searches a JSON-LD value for an object whose @type includes "Recipe". */
function findRecipeNode(node) {
  if (!node || typeof node !== 'object') return null;

  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findRecipeNode(item);
      if (found) return found;
    }
    return null;
  }

  const type = node['@type'];
  const types = Array.isArray(type) ? type : [type];
  if (types.some(t => typeof t === 'string' && t.toLowerCase().includes('recipe'))) {
    return node;
  }

  // Common containers: @graph, itemListElement, etc.
  for (const key of ['@graph', 'itemListElement']) {
    if (node[key]) {
      const found = findRecipeNode(node[key]);
      if (found) return found;
    }
  }

  return null;
}

/** Normalizes schema.org text-or-object fields (e.g. HowToStep) into a plain string. */
function toText(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(toText).filter(Boolean).join(' ');
  if (typeof value === 'object') return toText(value.text || value.name || '');
  return String(value);
}

/** Extracts schema.org Recipe JSON-LD data from HTML and renders it as plain text. */
function extractStructuredRecipeText(html) {
  const dom = new JSDOM(html);
  const scripts = [...dom.window.document.querySelectorAll('script[type="application/ld+json"]')];

  for (const script of scripts) {
    let data;
    try {
      data = JSON.parse(script.textContent || '');
    } catch {
      continue;
    }

    const recipe = findRecipeNode(data);
    if (!recipe) continue;

    const name = toText(recipe.name);
    const description = toText(recipe.description);

    const ingredients = recipe.recipeIngredient || recipe.ingredients || [];
    const ingredientLines = (Array.isArray(ingredients) ? ingredients : [ingredients])
      .map(toText).filter(Boolean);

    let instructions = recipe.recipeInstructions || [];
    if (typeof instructions === 'string') instructions = [instructions];
    const stepLines = (Array.isArray(instructions) ? instructions : [instructions])
      .map(toText).filter(Boolean);

    if (!ingredientLines.length && !stepLines.length) continue;

    const parts = [];
    if (name) parts.push(`Titel: ${name}`);
    if (description) parts.push(`Beschreibung: ${description}`);
    if (ingredientLines.length) parts.push(`Zutaten:\n${ingredientLines.map(l => `- ${l}`).join('\n')}`);
    if (stepLines.length) parts.push(`Zubereitung:\n${stepLines.map((l, i) => `${i + 1}. ${l}`).join('\n')}`);

    return parts.join('\n\n').slice(0, MAX_TEXT_LENGTH);
  }

  return null;
}

/** Falls back to extracting the main readable article text from the page. */
function extractReadableText(html, url) {
  const dom = new JSDOM(html, { url });
  const article = new Readability(dom.window.document).parse();
  if (!article?.textContent) return null;
  return article.textContent.trim().replace(/\n{3,}/g, '\n\n').slice(0, MAX_TEXT_LENGTH);
}

/**
 * Extracts a plain-text representation of a recipe from an HTML page.
 * Prefers structured schema.org Recipe JSON-LD data; falls back to Readability
 * article-text extraction. Returns null if no usable content could be found.
 */
function extractRecipeText(html, url) {
  const structured = extractStructuredRecipeText(html);
  if (structured) return structured;
  return extractReadableText(html, url);
}

module.exports = { extractRecipeText };
