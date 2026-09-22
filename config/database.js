// ============================================================
// Configuración de la Base de Datos (Dual: Supabase PostgreSQL o SQLite)
// ============================================================

require('dotenv').config();
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database.db');
const localDb = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('✗ Error al conectar a SQLite local:', err.message);
  } else {
    console.log(`✓ Base de datos SQLite conectada: ${dbPath}`);
  }
});

localDb.run('PRAGMA foreign_keys = ON');
localDb.run('PRAGMA journal_mode = WAL');

const sqliteWrapper = {
  isPg: false,
  all: (sql, params = []) => new Promise((resolve, reject) => localDb.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []))),
  get: (sql, params = []) => new Promise((resolve, reject) => localDb.get(sql, params, (err, row) => err ? reject(err) : resolve(row))),
  run: (sql, params = []) => new Promise((resolve, reject) => {
    localDb.run(sql, params, function(err) { err ? reject(err) : resolve({ id: this.lastID, changes: this.changes }) })
  }),
  exec: (sql) => new Promise((resolve, reject) => localDb.exec(sql, err => err ? reject(err) : resolve())),
  prepare: (sql) => ({
    all: (params = []) => sqliteWrapper.all(sql, params),
    get: (params = []) => sqliteWrapper.get(sql, params),
    run: (params = []) => sqliteWrapper.run(sql, params)
  }),
  vacuum: () => new Promise((resolve, reject) => localDb.run('VACUUM', err => err ? reject(err) : resolve())),
  close: () => new Promise(resolve => localDb.close(() => resolve()))
};

let activeDb = sqliteWrapper;
let pool = null;

function adaptPgQuery(sql) {
  let i = 1;
  let adaptedSql = sql.replace(/\?/g, () => `$${i++}`);
  if (adaptedSql.trim().toUpperCase().startsWith('INSERT') && !adaptedSql.toUpperCase().includes('RETURNING ID')) {
    adaptedSql += ' RETURNING id';
  }
  return adaptedSql;
}

// Interfaz proxy de base de datos
const database = {
  isPg: () => activeDb.isPg,
  all: (...args) => activeDb.all(...args),
  get: (...args) => activeDb.get(...args),
  run: (...args) => activeDb.run(...args),
  exec: (...args) => activeDb.exec(...args),
  prepare: (...args) => activeDb.prepare(...args),
  vacuum: (...args) => activeDb.vacuum(...args),
  close: (...args) => activeDb.close(...args)
};

async function initSchema() {
  const isPostgres = activeDb.isPg;

  if (isPostgres) {
    // ── Esquema oficial Supabase para PostgreSQL (Regla 13) ──
    await activeDb.exec(`
      CREATE TABLE IF NOT EXISTS public.vehiculos (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        marca TEXT NOT NULL,
        modelo TEXT NOT NULL,
        version TEXT DEFAULT '',
        anio INTEGER NOT NULL,
        kilometraje INTEGER DEFAULT 0,
        combustible TEXT DEFAULT 'Nafta',
        transmision TEXT DEFAULT 'Manual',
        color TEXT DEFAULT '',
        puertas INTEGER DEFAULT 4,
        motor TEXT DEFAULT '',
        precio NUMERIC(15, 2) DEFAULT 0,
        moneda TEXT DEFAULT 'ARS',
        descripcion TEXT DEFAULT '',
        condicion TEXT DEFAULT 'Usado',
        estado TEXT DEFAULT 'disponible',
        destacado BOOLEAN DEFAULT false,
        activo INTEGER DEFAULT 1,
        tipo TEXT DEFAULT '',
        imagenes TEXT[] DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );

      ALTER TABLE public.vehiculos ADD COLUMN IF NOT EXISTS condicion TEXT DEFAULT 'Usado';
      ALTER TABLE public.vehiculos ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '';
      ALTER TABLE public.vehiculos ADD COLUMN IF NOT EXISTS puertas INTEGER DEFAULT 4;
      ALTER TABLE public.vehiculos ADD COLUMN IF NOT EXISTS motor TEXT DEFAULT '';
      ALTER TABLE public.vehiculos ADD COLUMN IF NOT EXISTS activo INTEGER DEFAULT 1;
      ALTER TABLE public.vehiculos ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT '';
      ALTER TABLE public.vehiculos ADD COLUMN IF NOT EXISTS imagenes TEXT[] DEFAULT '{}';

      CREATE INDEX IF NOT EXISTS idx_vehiculos_marca_modelo ON public.vehiculos (marca, modelo);
      CREATE INDEX IF NOT EXISTS idx_vehiculos_estado ON public.vehiculos (estado);

      CREATE TABLE IF NOT EXISTS admin_users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } else {
    // ── Esquema SQLite local con compatibilidad para estado e imágenes ──
    await activeDb.exec(`
      CREATE TABLE IF NOT EXISTS autos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        marca VARCHAR(255) NOT NULL,
        modelo VARCHAR(255) NOT NULL,
        version VARCHAR(255) DEFAULT '',
        anio INT NOT NULL,
        precio NUMERIC(15, 2) DEFAULT 0,
        moneda VARCHAR(10) DEFAULT 'ARS',
        kilometraje INT DEFAULT 0,
        combustible VARCHAR(50) DEFAULT 'Nafta',
        transmision VARCHAR(50) DEFAULT 'Manual',
        color VARCHAR(100) DEFAULT '',
        puertas INT DEFAULT 4,
        motor VARCHAR(255) DEFAULT '',
        descripcion TEXT,
        condicion VARCHAR(50) DEFAULT 'Usado',
        tipo VARCHAR(50) DEFAULT '',
        estado VARCHAR(50) DEFAULT 'disponible',
        destacado INTEGER DEFAULT 0,
        activo INTEGER DEFAULT 1,
        imagenes TEXT DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS auto_imagenes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        auto_id INT NOT NULL,
        filename VARCHAR(255) NOT NULL,
        es_principal INTEGER DEFAULT 0,
        orden INT DEFAULT 0,
        FOREIGN KEY (auto_id) REFERENCES autos(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS admin_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Intentar agregar columnas si la tabla ya existía previamente
    try { await activeDb.run("ALTER TABLE autos ADD COLUMN estado VARCHAR(50) DEFAULT 'disponible'"); } catch (e) {}
    try { await activeDb.run("ALTER TABLE autos ADD COLUMN imagenes TEXT DEFAULT '[]'"); } catch (e) {}
    try { await activeDb.run("ALTER TABLE autos ADD COLUMN tipo VARCHAR(50) DEFAULT ''"); } catch (e) {}
  }

  // ── Usuario Admin: crear o sincronizar con credenciales oficiales ──
  const ADMIN_USERNAME = 'admin';
  const ADMIN_PASSWORD = 'ABELARDO2096';

  const existingAdmin = await activeDb.get('SELECT * FROM admin_users WHERE username = ?', [ADMIN_USERNAME]);

  if (!existingAdmin) {
    const hashedPassword = bcrypt.hashSync(ADMIN_PASSWORD, 10);
    await activeDb.run(
      'INSERT INTO admin_users (username, password) VALUES (?, ?)',
      [ADMIN_USERNAME, hashedPassword]
    );
    console.log(`✓ Usuario admin asegurado: ${ADMIN_USERNAME}`);
  } else {
    const isCurrent = bcrypt.compareSync(ADMIN_PASSWORD, existingAdmin.password);
    if (!isCurrent) {
      const hashedPassword = bcrypt.hashSync(ADMIN_PASSWORD, 10);
      await activeDb.run(
        'UPDATE admin_users SET password = ? WHERE username = ?',
        [hashedPassword, ADMIN_USERNAME]
      );
      console.log(`✓ Contraseña del admin actualizada a la configuración segura.`);
    }
  }
}

// ── Iniciar conexión si DATABASE_URL existe ──
if (process.env.DATABASE_URL) {
  console.log('Detectada configuración DATABASE_URL. Conectando a Supabase (PostgreSQL)...');
  const { Pool } = require('pg');
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000
  });

  pool.connect()
    .then(async (client) => {
      console.log('✓ Base de datos PostgreSQL (Supabase) conectada exitosamente');
      client.release();

      activeDb = {
        isPg: true,
        all: async (sql, params = []) => {
          const { rows } = await pool.query(adaptPgQuery(sql), params);
          return rows;
        },
        get: async (sql, params = []) => {
          const { rows } = await pool.query(adaptPgQuery(sql), params);
          return rows[0] || null;
        },
        run: async (sql, params = []) => {
          const result = await pool.query(adaptPgQuery(sql), params);
          const insertedId = (result.rows && result.rows.length > 0 && result.rows[0].id) ? result.rows[0].id : null;
          return { id: insertedId, changes: result.rowCount };
        },
        exec: async (sql) => { await pool.query(sql); },
        prepare: (sql) => ({
          all: (params = []) => activeDb.all(sql, params),
          get: (params = []) => activeDb.get(sql, params),
          run: (params = []) => activeDb.run(sql, params)
        }),
        vacuum: () => Promise.resolve(),
        close: () => pool.end()
      };

      await initSchema();
    })
    .catch(async (err) => {
      console.warn('⚠️ No se pudo conectar a Supabase PostgreSQL (' + err.message + ').');
      console.log('🔄 Activando SQLite local como respaldo para mantener el sitio 100% operativo.');
      activeDb = sqliteWrapper;
      await initSchema();
    });
} else {
  console.log('Iniciando en modo local (SQLite)...');
  initSchema().catch(err => {
    console.error('✗ Error al inicializar SQLite local:', err.message);
  });
}

module.exports = database;
