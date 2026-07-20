const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

let _db = null;
let _dbPath = null;

function saveDb() {
  const data = _db.export();
  const tmp = _dbPath + '.tmp';
  fs.writeFileSync(tmp, Buffer.from(data));
  fs.renameSync(tmp, _dbPath);
}

function migrate() {
  _db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS persons (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS recipes (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      image_id    TEXT,
      category    TEXT NOT NULL DEFAULT 'main' CHECK(category IN ('main', 'other')),
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS recipe_ingredients (
      id         TEXT PRIMARY KEY,
      recipe_id  TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
      name       TEXT NOT NULL,
      quantity   TEXT NOT NULL DEFAULT '',
      unit       TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS recipe_steps (
      id          TEXT PRIMARY KEY,
      recipe_id   TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
      step_number INTEGER NOT NULL,
      instruction TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recipe_persons (
      recipe_id  TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
      person_id  TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
      preference TEXT NOT NULL CHECK(preference IN ('liked', 'disliked')),
      PRIMARY KEY (recipe_id, person_id)
    );

    CREATE TABLE IF NOT EXISTS meal_plan (
      position  INTEGER PRIMARY KEY,
      recipe_id TEXT,
      no_match  INTEGER NOT NULL DEFAULT 0
    );
  `);

  // Backfill `category` for databases created before this column existed.
  const columns = _db.exec("PRAGMA table_info(recipes)");
  const hasCategory = columns.length > 0 && columns[0].values.some(row => row[1] === 'category');
  if (!hasCategory) {
    _db.exec(`ALTER TABLE recipes ADD COLUMN category TEXT NOT NULL DEFAULT 'main' CHECK(category IN ('main', 'other'))`);
  }
}

function query(sql, params = []) {
  const upper = sql.trimStart().toUpperCase();
  const isRead = upper.startsWith('SELECT') || upper.startsWith('WITH');

  if (isRead) {
    const stmt = _db.prepare(sql);
    const rows = [];
    if (params.length > 0) stmt.bind(params);
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return { rows, rowCount: rows.length };
  }

  _db.run(sql, params);
  const rowCount = _db.getRowsModified();
  saveDb();
  return { rows: [], rowCount };
}

async function initDb() {
  if (_db) return;

  _dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/mealplaner.db');
  fs.mkdirSync(path.dirname(_dbPath), { recursive: true });

  const SQL = await initSqlJs();

  try {
    const buf = fs.readFileSync(_dbPath);
    _db = new SQL.Database(buf);
    console.log(`[db] Datenbank geladen von ${_dbPath}`);
  } catch {
    _db = new SQL.Database();
    console.log('[db] Neue Datenbank erstellt');
  }

  migrate();
  saveDb();
  console.log(`[db] Bereit — gespeichert unter ${_dbPath}`);
}

module.exports = { initDb, query, uuidv4 };
