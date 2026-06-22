let _db = null;

function getDb() {
  if (!_db) _db = require('./db');
  return _db;
}

function getSetting(key, fallback) {
  try {
    const row = getDb().query(`SELECT value FROM settings WHERE key = ?`, [key]).rows[0];
    return row?.value || fallback;
  } catch { return fallback; }
}

const OLLAMA_BASE = () => getSetting('ollama_url', process.env.OLLAMA_URL || 'http://localhost:11434');
const VISION_MODEL = () => getSetting('ollama_vision_model', process.env.OLLAMA_VISION_MODEL || 'llava:7b');
const TEXT_MODEL = () => getSetting('ollama_text_model', process.env.OLLAMA_TEXT_MODEL || 'llama3.2:3b');

// ── Model status tracking ─────────────────────────────────────────────────────

const modelStatus = {
  downloading: false,
  modelsReady: false,
  error: null,
};

function getStatus() {
  return { ...modelStatus };
}

async function isAvailable() {
  try {
    const { default: fetch } = await import('node-fetch');
    const res = await fetch(`${OLLAMA_BASE()}/api/tags`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function getInstalledModels() {
  try {
    const { default: fetch } = await import('node-fetch');
    const res = await fetch(`${OLLAMA_BASE()}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.models || []).map(m => m.name);
  } catch {
    return [];
  }
}

async function pullModel(modelName) {
  const { default: fetch } = await import('node-fetch');
  console.log(`[ollama] Lade Modell herunter: ${modelName} …`);
  // stream:false waits until the pull is fully complete
  const res = await fetch(`${OLLAMA_BASE()}/api/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: modelName, stream: false }),
    signal: AbortSignal.timeout(60 * 60 * 1000), // 60 min — large models take time
  });
  if (!res.ok) throw new Error(`Pull fehlgeschlagen (${res.status})`);
  await res.text(); // consume response body
  console.log(`[ollama] Modell bereit: ${modelName}`);
}

/**
 * Called once at startup. Checks which required models are installed and
 * downloads any that are missing. Updates modelStatus so the API can expose
 * the progress to the frontend.
 */
async function ensureModels() {
  if (!await isAvailable()) {
    console.log('[ollama] Nicht erreichbar — überspringe Modell-Setup');
    return;
  }

  const needed = [...new Set([VISION_MODEL(), TEXT_MODEL()])];
  const installed = await getInstalledModels();

  // Match by name prefix (e.g. "llava" covers "llava:7b" and "llava:latest")
  const missing = needed.filter(model => {
    const tag = model.includes(':') ? model : `${model}:latest`;
    return !installed.some(i => i === tag || i === model || i.startsWith(model.split(':')[0] + ':'));
  });

  if (missing.length === 0) {
    modelStatus.modelsReady = true;
    console.log(`[ollama] Alle Modelle verfügbar: ${needed.join(', ')}`);
    return;
  }

  console.log(`[ollama] Fehlende Modelle: ${missing.join(', ')} — starte Download …`);
  modelStatus.downloading = true;
  modelStatus.error = null;

  try {
    for (const model of missing) {
      await pullModel(model);
    }
    modelStatus.modelsReady = true;
    console.log('[ollama] Alle Modelle heruntergeladen und bereit');
  } catch (err) {
    modelStatus.error = err.message;
    console.error('[ollama] Fehler beim Herunterladen der Modelle:', err.message);
  } finally {
    modelStatus.downloading = false;
  }
}

async function parseRecipeFromImage(base64Image, mimeType) {
  const { default: fetch } = await import('node-fetch');
  const prompt = `Du bist ein Koch-Assistent. Analysiere das Bild und extrahiere das Rezept.
Antworte NUR mit einem gültigen JSON-Objekt in folgendem Format, ohne zusätzlichen Text:
{
  "name": "Name des Rezepts",
  "description": "Kurze Beschreibung (1-2 Sätze)",
  "ingredients": [{"name": "Zutat", "quantity": "Menge", "unit": "Einheit"}],
  "steps": ["Schritt 1", "Schritt 2"]
}`;

  const res = await fetch(`${OLLAMA_BASE()}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: VISION_MODEL(),
      prompt,
      images: [base64Image],
      stream: false,
    }),
    signal: AbortSignal.timeout(120000),
  });

  if (!res.ok) throw new Error(`Ollama Fehler: ${res.status}`);
  const data = await res.json();

  const jsonMatch = data.response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Kein gültiges JSON in der Antwort');
  return JSON.parse(jsonMatch[0]);
}

async function parseRecipeFromText(dictatedText) {
  const { default: fetch } = await import('node-fetch');
  const prompt = `Du bist ein Koch-Assistent. Strukturiere folgendes diktiertes Rezept in ein klares, lesbares Rezept.
Antworte NUR mit einem gültigen JSON-Objekt in folgendem Format, ohne zusätzlichen Text:
{
  "name": "Name des Rezepts",
  "description": "Kurze Beschreibung (1-2 Sätze)",
  "ingredients": [{"name": "Zutat", "quantity": "Menge", "unit": "Einheit"}],
  "steps": ["Schritt 1", "Schritt 2"]
}

Diktierter Text: ${dictatedText}`;

  const res = await fetch(`${OLLAMA_BASE()}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: TEXT_MODEL(),
      prompt,
      stream: false,
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) throw new Error(`Ollama Fehler: ${res.status}`);
  const data = await res.json();

  const jsonMatch = data.response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Kein gültiges JSON in der Antwort');
  return JSON.parse(jsonMatch[0]);
}

module.exports = { isAvailable, getStatus, ensureModels, parseRecipeFromImage, parseRecipeFromText };
