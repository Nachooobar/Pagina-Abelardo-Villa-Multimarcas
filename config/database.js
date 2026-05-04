// ============================================================
// Configuración de la Base de Datos SQLite
// ============================================================

const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, '..', 'database.db');
const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// ── Create Tables ──
db.exec(`
  CREATE TABLE IF NOT EXISTS autos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    marca TEXT NOT NULL,
    modelo TEXT NOT NULL,
    version TEXT DEFAULT '',
    anio INTEGER NOT NULL,
    precio REAL DEFAULT 0,
    moneda TEXT DEFAULT 'USD',
    kilometraje INTEGER DEFAULT 0,
    combustible TEXT DEFAULT 'Nafta',
    transmision TEXT DEFAULT 'Manual',
    color TEXT DEFAULT '',
    puertas INTEGER DEFAULT 4,
    motor TEXT DEFAULT '',
    descripcion TEXT DEFAULT '',
    condicion TEXT DEFAULT 'Usado',
    destacado INTEGER DEFAULT 0,
    activo INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS auto_imagenes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    auto_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    es_principal INTEGER DEFAULT 0,
    orden INTEGER DEFAULT 0,
    FOREIGN KEY (auto_id) REFERENCES autos(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// ── Create default admin user if none exists ──
const adminCount = db.prepare('SELECT COUNT(*) as count FROM admin_users').get();
if (adminCount.count === 0) {
  const hashedPassword = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO admin_users (username, password) VALUES (?, ?)').run('admin', hashedPassword);
  console.log('✅ Usuario admin creado: admin / admin123');
}

module.exports = db;
