// ============================================================
// Configuración de la Base de Datos SQLite (sqlite3)
// ============================================================

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, '..', 'database.db');

// Crear conexión a la base de datos
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('✗ Error al conectar a la base de datos:', err.message);
    process.exit(1);
  }
});

// Habilitar foreign keys
db.run('PRAGMA foreign_keys = ON');

// ── Promisify database methods ──
const database = {
  all: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  },
  get: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },
  run: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    });
  },
  exec: (sql) => {
    return new Promise((resolve, reject) => {
      db.exec(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  },
  prepare: (sql) => {
    return {
      all: (params = []) => database.all(sql, params),
      get: (params = []) => database.get(sql, params),
      run: (params = []) => database.run(sql, params)
    };
  }
};

// ── Initialize database ──
database.exec(`
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
`).then(async () => {
  const adminCount = await database.get('SELECT COUNT(*) as count FROM admin_users');
  if (adminCount.count === 0) {
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    await database.run(
      'INSERT INTO admin_users (username, password) VALUES (?, ?)',
      ['admin', hashedPassword]
    );
    console.log('✓ Usuario admin creado: admin / admin123');
  }
  console.log('✓ Base de datos inicializada');
}).catch((err) => {
  console.error('✗ Error al inicializar BD:', err.message);
});

// Graceful shutdown
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) console.error('✗ Error al cerrar BD:', err);
    else console.log('✓ Conexión a BD cerrada');
  });
});

module.exports = database;
