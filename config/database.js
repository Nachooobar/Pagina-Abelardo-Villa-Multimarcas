// ============================================================
// Configuración de la Base de Datos (Dual: Supabase o SQLite)
// ============================================================

require('dotenv').config();
const bcrypt = require('bcryptjs');

let database = {};

if (process.env.DATABASE_URL) {
  // ── MODO SUPABASE (PostgreSQL) ──
  console.log('Iniciando en modo nube (Supabase)...');
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  pool.connect()
    .then(client => {
      console.log('✓ Base de datos PostgreSQL (Supabase) conectada');
      client.release();
    })
    .catch(err => {
      console.error('✗ Error al conectar a Supabase:', err.message);
    });

  function adaptQuery(sql) {
    let i = 1;
    let adaptedSql = sql.replace(/\?/g, () => `$${i++}`);
    if (adaptedSql.trim().toUpperCase().startsWith('INSERT') && !adaptedSql.toUpperCase().includes('RETURNING ID')) {
      adaptedSql += ' RETURNING id';
    }
    return adaptedSql;
  }

  database = {
    all: async (sql, params = []) => {
      const { rows } = await pool.query(adaptQuery(sql), params);
      return rows;
    },
    get: async (sql, params = []) => {
      const { rows } = await pool.query(adaptQuery(sql), params);
      return rows[0] || null;
    },
    run: async (sql, params = []) => {
      const result = await pool.query(adaptQuery(sql), params);
      const insertedId = (result.rows && result.rows.length > 0 && result.rows[0].id) ? result.rows[0].id : null;
      return { id: insertedId, changes: result.rowCount };
    },
    exec: async (sql) => { await pool.query(sql); },
    prepare: (sql) => ({
      all: (params = []) => database.all(sql, params),
      get: (params = []) => database.get(sql, params),
      run: (params = []) => database.run(sql, params)
    }),
    vacuum: () => Promise.resolve(),
    close: () => pool.end()
  };

} else {
  // ── MODO LOCAL (SQLite) - Fallback para que no se caiga la web ──
  console.log('DATABASE_URL no detectada. Iniciando en modo local (SQLite)...');
  const sqlite3 = require('sqlite3').verbose();
  const path = require('path');
  const dbPath = path.join(__dirname, '..', 'database.db');
  
  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('✗ Error al conectar a SQLite:', err.message);
    } else {
      console.log(`✓ Base de datos SQLite conectada: ${dbPath}`);
    }
  });

  db.run('PRAGMA foreign_keys = ON');
  db.run('PRAGMA journal_mode = WAL');

  database = {
    all: (sql, params = []) => new Promise((resolve, reject) => db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []))),
    get: (sql, params = []) => new Promise((resolve, reject) => db.get(sql, params, (err, row) => err ? reject(err) : resolve(row))),
    run: (sql, params = []) => new Promise((resolve, reject) => {
      db.run(sql, params, function(err) { err ? reject(err) : resolve({ id: this.lastID, changes: this.changes }) })
    }),
    exec: (sql) => new Promise((resolve, reject) => db.exec(sql, err => err ? reject(err) : resolve())),
    prepare: (sql) => ({
      all: (params = []) => database.all(sql, params),
      get: (params = []) => database.get(sql, params),
      run: (params = []) => database.run(sql, params)
    }),
    vacuum: () => new Promise((resolve, reject) => db.run('VACUUM', err => err ? reject(err) : resolve())),
    close: () => new Promise(resolve => db.close(() => resolve()))
  };
}

// ── Inicializar tablas compartidas (Sintaxis compatible con ambas si ajustamos los tipos) ──
const isPg = !!process.env.DATABASE_URL;
const idType = isPg ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
const boolType = isPg ? 'SMALLINT' : 'INTEGER';

database.exec(`
  CREATE TABLE IF NOT EXISTS autos (
    id ${idType},
    marca VARCHAR(255) NOT NULL,
    modelo VARCHAR(255) NOT NULL,
    version VARCHAR(255) DEFAULT '',
    anio INT NOT NULL,
    precio NUMERIC(15, 2) DEFAULT 0,
    moneda VARCHAR(10) DEFAULT 'USD',
    kilometraje INT DEFAULT 0,
    combustible VARCHAR(50) DEFAULT 'Nafta',
    transmision VARCHAR(50) DEFAULT 'Manual',
    color VARCHAR(100) DEFAULT '',
    puertas INT DEFAULT 4,
    motor VARCHAR(255) DEFAULT '',
    descripcion TEXT,
    condicion VARCHAR(50) DEFAULT 'Usado',
    destacado ${boolType} DEFAULT 0,
    activo ${boolType} DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS auto_imagenes (
    id ${idType},
    auto_id INT NOT NULL,
    filename VARCHAR(255) NOT NULL,
    es_principal ${boolType} DEFAULT 0,
    orden INT DEFAULT 0,
    FOREIGN KEY (auto_id) REFERENCES autos(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS admin_users (
    id ${idType},
    username VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`).then(async () => {
  const adminCount = await database.get('SELECT COUNT(*) as count FROM admin_users');
  if (parseInt(adminCount.count) === 0) {
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    await database.run(
      'INSERT INTO admin_users (username, password) VALUES (?, ?)',
      ['admin', hashedPassword]
    );
    console.log('✓ Usuario admin creado: admin / admin123');
  }
}).catch((err) => {
  console.error('✗ Error al inicializar tablas:', err.message);
});

module.exports = database;
