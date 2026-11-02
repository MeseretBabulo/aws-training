// Asset Manager API — Express + built-in Node SQLite (no native deps).
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const DIST_DIR = path.join(ROOT, 'dist');
const PORT = Number(process.env.PORT) || 3001;
const APP_PIN = String(process.env.APP_PIN || '1234');

if (process.env.NODE_ENV === 'production' && !process.env.APP_PIN) {
  console.warn('WARNING: APP_PIN is not set — using default PIN 1234. Set APP_PIN in production.');
}

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ---------- Database ----------
const db = new DatabaseSync(path.join(DATA_DIR, 'asset_manager.db'));
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS owners (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS animal_types (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    key            TEXT    NOT NULL UNIQUE,
    category       TEXT    NOT NULL,
    name_am        TEXT    NOT NULL,
    name_en        TEXT    NOT NULL DEFAULT '',
    monthly_growth REAL    NOT NULL DEFAULT 0,
    sort_order     INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS records (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    date           TEXT    NOT NULL,
    receiver       TEXT    NOT NULL,
    phone          TEXT,
    location       TEXT    NOT NULL,
    category       TEXT    NOT NULL,
    animal_type    TEXT,
    quantity       INTEGER NOT NULL DEFAULT 1,
    buy_price      REAL    NOT NULL DEFAULT 0,
    forecast_price REAL    NOT NULL DEFAULT 0, -- legacy, no longer used (forecast is calculated)
    status         TEXT    NOT NULL DEFAULT 'held',
    photo          TEXT,
    notes          TEXT,
    owner_id       INTEGER,
    created_at     TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS assets (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    name           TEXT    NOT NULL,
    asset_type     TEXT    NOT NULL,
    location       TEXT    NOT NULL,
    date           TEXT,
    value          REAL    NOT NULL DEFAULT 0,
    forecast_value REAL    NOT NULL DEFAULT 0, -- legacy, no longer used
    photo          TEXT,
    notes          TEXT,
    owner_id       INTEGER,
    created_at     TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

// Migrate databases created by v1 (no owners)
for (const table of ['records', 'assets']) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes('owner_id')) db.exec(`ALTER TABLE ${table} ADD COLUMN owner_id INTEGER`);
}

// Default owners (renamable in Settings)
if (!db.prepare('SELECT COUNT(*) AS n FROM owners').get().n) {
  const ins = db.prepare('INSERT INTO owners (name, sort_order) VALUES (?, ?)');
  ['የራሴ', 'መሰረት', 'ትንሹ ልጄ'].forEach((n, i) => ins.run(n, i));
}

// Default animal types with monthly value growth % (editable in Settings)
if (!db.prepare('SELECT COUNT(*) AS n FROM animal_types').get().n) {
  const defaults = [
    ['cattle', 'calf', 'ጥጃ', 'Calf', 3],
    ['cattle', 'weaner', 'ጡት የተወ ጥጃ', 'Weaner', 3],
    ['cattle', 'yearling', 'የዓመት ጥጃ', 'Yearling', 2.5],
    ['cattle', 'heifer', 'ጊደር', 'Heifer', 2],
    ['cattle', 'cow', 'ላም', 'Cow', 1],
    ['cattle', 'bull', 'ኮርማ', 'Bull', 1.5],
    ['cattle', 'steer', 'ወይፈን', 'Steer', 2.5],
    ['cattle', 'bullock', 'በሬ', 'Bullock / Ox', 1.5],
    ['sheep', 'lamb', 'ጠቦት', 'Lamb', 4],
    ['sheep', 'ewe', 'እንስት በግ', 'Ewe', 1],
    ['sheep', 'ram', 'አውራ በግ', 'Ram', 2],
    ['sheep', 'wether', 'ሙክት በግ', 'Wether (castrated)', 3],
    ['goat', 'kid', 'የፍየል ግልገል', 'Kid', 4],
    ['goat', 'doe', 'እንስት ፍየል', 'Doe', 1],
    ['goat', 'buck', 'አውራ ፍየል', 'Buck', 2],
    ['goat', 'goat_wether', 'ሙክት ፍየል', 'Wether (castrated)', 3],
    ['other', 'donkey', 'አህያ', 'Donkey', 0.5],
    ['other', 'horse', 'ፈረስ', 'Horse', 0.5],
    ['other', 'mule', 'በቅሎ', 'Mule', 0.5],
    ['other', 'camel', 'ግመል', 'Camel', 0.5],
    ['other', 'chicken', 'ዶሮ', 'Chicken', 0],
  ];
  const ins = db.prepare(
    'INSERT INTO animal_types (category, key, name_am, name_en, monthly_growth, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
  );
  defaults.forEach((d, i) => ins.run(...d, i));
}

// Old rows without owner -> first owner
db.exec(`UPDATE records SET owner_id = (SELECT MIN(id) FROM owners) WHERE owner_id IS NULL;
         UPDATE assets  SET owner_id = (SELECT MIN(id) FROM owners) WHERE owner_id IS NULL;`);

// ---------- Validation ----------
const CATEGORIES = ['cattle', 'sheep', 'goat', 'other'];
const STATUSES = ['held', 'returned', 'sold', 'dead'];
const ASSET_TYPES = ['land', 'house', 'vehicle', 'equipment', 'crop', 'other'];

const str = (v, max = 200) => (v == null ? '' : String(v).trim().slice(0, max));
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};
const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v);
const ownerExists = (id) => !!db.prepare('SELECT 1 FROM owners WHERE id = ?').get(id);
const typeExists = (key, category) =>
  !!db.prepare('SELECT 1 FROM animal_types WHERE key = ? AND category = ?').get(key, category);

function cleanRecord(b) {
  const r = {
    date: str(b.date, 10),
    receiver: str(b.receiver),
    phone: str(b.phone, 30),
    location: str(b.location),
    category: str(b.category, 20),
    animal_type: str(b.animal_type, 40),
    quantity: Math.max(1, Math.floor(num(b.quantity)) || 1),
    buy_price: num(b.buy_price),
    status: str(b.status, 20) || 'held',
    notes: str(b.notes, 2000),
    owner_id: Number(b.owner_id) || null,
  };
  const errors = [];
  if (!isDate(r.date)) errors.push('date');
  if (!r.receiver) errors.push('receiver');
  if (!r.location) errors.push('location');
  if (!CATEGORIES.includes(r.category)) errors.push('category');
  if (!typeExists(r.animal_type, r.category)) errors.push('animal_type');
  if (!STATUSES.includes(r.status)) errors.push('status');
  if (!ownerExists(r.owner_id)) errors.push('owner_id');
  return { data: r, errors };
}

function cleanAsset(b) {
  const a = {
    name: str(b.name),
    asset_type: str(b.asset_type, 20),
    location: str(b.location),
    date: isDate(str(b.date, 10)) ? str(b.date, 10) : null,
    value: num(b.value),
    notes: str(b.notes, 2000),
    owner_id: Number(b.owner_id) || null,
  };
  const errors = [];
  if (!a.name) errors.push('name');
  if (!a.location) errors.push('location');
  if (!ASSET_TYPES.includes(a.asset_type)) errors.push('asset_type');
  if (!ownerExists(a.owner_id)) errors.push('owner_id');
  return { data: a, errors };
}

function cleanOwner(b) {
  const o = { name: str(b.name, 80), sort_order: Math.floor(num(b.sort_order)) };
  return { data: o, errors: o.name ? [] : ['name'] };
}

function cleanAnimalType(b) {
  const t = {
    category: str(b.category, 20),
    name_am: str(b.name_am, 60),
    name_en: str(b.name_en, 60),
    monthly_growth: Math.min(100, num(b.monthly_growth)),
    sort_order: Math.floor(num(b.sort_order)),
  };
  const errors = [];
  if (!CATEGORIES.includes(t.category)) errors.push('category');
  if (!t.name_am && !t.name_en) errors.push('name_am');
  if (!t.name_am) t.name_am = t.name_en;
  return { data: t, errors };
}

// ---------- Photos ----------
// Client sends: a data URL (new photo), the existing "/uploads/..." path (unchanged), or null/"" (removed).
function savePhoto(input, oldPhoto) {
  if (typeof input === 'string' && input.startsWith('data:image/')) {
    const m = input.match(/^data:image\/(jpeg|png|webp);base64,(.+)$/);
    if (!m) throw Object.assign(new Error('Unsupported image'), { status: 400 });
    const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
    const name = `${crypto.randomBytes(16).toString('hex')}.${ext}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, name), Buffer.from(m[2], 'base64'));
    removePhoto(oldPhoto);
    return `/uploads/${name}`;
  }
  if (input === oldPhoto) return oldPhoto ?? null;
  removePhoto(oldPhoto);
  return null;
}

function removePhoto(p) {
  if (!p || !p.startsWith('/uploads/')) return;
  fs.rm(path.join(UPLOAD_DIR, path.basename(p)), { force: true }, () => {});
}

// ---------- App ----------
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '12mb' }));

const pinOk = (pin) => {
  const a = Buffer.from(String(pin || ''));
  const b = Buffer.from(APP_PIN);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

app.post('/api/login', (req, res) => {
  if (pinOk(req.body?.pin)) return res.json({ ok: true });
  res.status(401).json({ error: 'wrong_pin' });
});

app.use('/api', (req, res, next) => {
  if (pinOk(req.get('x-app-pin'))) return next();
  res.status(401).json({ error: 'unauthorized' });
});

/**
 * Generic CRUD router.
 * opts.photos      table has a photo column
 * opts.immutable   columns kept from the existing row on update
 * opts.onInsert    (data) => extra columns for INSERT
 * opts.inUse       (row) => true if the row may not be deleted
 */
function crud(table, clean, orderBy, opts = {}) {
  const router = express.Router();
  const getOne = db.prepare(`SELECT * FROM ${table} WHERE id = ?`);

  router.get('/', (req, res) => res.json(db.prepare(`SELECT * FROM ${table} ORDER BY ${orderBy}`).all()));

  router.get('/:id', (req, res) => {
    const row = getOne.get(req.params.id);
    row ? res.json(row) : res.status(404).json({ error: 'not_found' });
  });

  router.post('/', (req, res) => {
    const { data, errors } = clean(req.body || {});
    if (errors.length) return res.status(400).json({ error: 'invalid', fields: errors });
    if (opts.photos) data.photo = savePhoto(req.body.photo, null);
    Object.assign(data, opts.onInsert?.(data));
    const cols = Object.keys(data);
    const info = db
      .prepare(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`)
      .run(...cols.map((c) => data[c]));
    res.status(201).json(getOne.get(info.lastInsertRowid));
  });

  router.put('/:id', (req, res) => {
    const existing = getOne.get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'not_found' });
    const body = { ...req.body };
    for (const c of opts.immutable || []) body[c] = existing[c];
    const { data, errors } = clean(body);
    if (errors.length) return res.status(400).json({ error: 'invalid', fields: errors });
    if (opts.photos) data.photo = savePhoto(req.body.photo, existing.photo);
    const cols = Object.keys(data);
    const touch = opts.photos ? ', updated_at = CURRENT_TIMESTAMP' : '';
    db.prepare(`UPDATE ${table} SET ${cols.map((c) => `${c} = ?`).join(', ')}${touch} WHERE id = ?`).run(
      ...cols.map((c) => data[c]),
      existing.id,
    );
    res.json(getOne.get(existing.id));
  });

  router.delete('/:id', (req, res) => {
    const existing = getOne.get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'not_found' });
    if (opts.inUse?.(existing)) return res.status(409).json({ error: 'in_use' });
    db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(existing.id);
    if (opts.photos) removePhoto(existing.photo);
    res.json({ ok: true });
  });

  return router;
}

app.use('/api/records', crud('records', cleanRecord, 'date DESC, id DESC', { photos: true }));
app.use('/api/assets', crud('assets', cleanAsset, 'id DESC', { photos: true }));
app.use(
  '/api/owners',
  crud('owners', cleanOwner, 'sort_order, id', {
    inUse: (o) =>
      !!db.prepare('SELECT 1 FROM records WHERE owner_id = ? UNION SELECT 1 FROM assets WHERE owner_id = ?').get(o.id, o.id),
  }),
);
app.use(
  '/api/animal-types',
  crud('animal_types', cleanAnimalType, 'category, sort_order, id', {
    immutable: ['category'],
    onInsert: () => ({ key: `t_${crypto.randomBytes(5).toString('hex')}` }),
    inUse: (t) => !!db.prepare('SELECT 1 FROM records WHERE animal_type = ?').get(t.key),
  }),
);

// Photos (random, unguessable file names)
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '30d', immutable: true }));

// Built frontend (production)
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR, { index: false, maxAge: '1h' }));
  app.get('*', (req, res) => res.sendFile(path.join(DIST_DIR, 'index.html')));
}

app.use((err, req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'server_error' });
});

app.listen(PORT, () => console.log(`Asset Manager running on http://localhost:${PORT}`));
