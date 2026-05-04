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
  console.log(`✓ Base de datos conectada: ${dbPath}`);
});

// Habilitar foreign keys y optimizaciones para persistencia
db.run('PRAGMA foreign_keys = ON');
db.run('PRAGMA journal_mode = WAL'); // Write-Ahead Logging para mejor concurrencia
db.run('PRAGMA synchronous = FULL'); // Asegurar que se escriba en disco
db.run('PRAGMA cache_size = 10000'); // Caché para mejor performance

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
        if (err) {
          console.error('✗ Error en query:', err, 'SQL:', sql);
          reject(err);
        } else {
          // Log para confirmar que se guardó
          if (sql.toUpperCase().includes('INSERT') || sql.toUpperCase().includes('UPDATE') || sql.toUpperCase().includes('DELETE')) {
            console.log(`✓ Datos guardados: ${this.changes} fila(s) afectada(s)`);
          }
          resolve({ id: this.lastID, changes: this.changes });
        }
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
  const adminCount = await database.get('SELECT COUNT(*) as count FROM admin_users', []);
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

// ── Función para hacer VACUUM (optimizar la BD) ──
database.vacuum = () => {
  return new Promise((resolve, reject) => {
    db.run('VACUUM', (err) => {
      if (err) {
        console.error('✗ Error en VACUUM:', err);
        reject(err);
      } else {
        console.log('✓ Base de datos optimizada (VACUUM)');
        resolve();
      }
    });
  });
};

// ── Hacer VACUUM cada hora ──
setInterval(() => {
  database.vacuum().catch(err => console.error('Error en VACUUM automático:', err));
}, 60 * 60 * 1000);

// ── Graceful shutdown ──
process.on('SIGINT', async () => {
  console.log('\n✓ Cerrando aplicación...');
  try {
    await database.vacuum();
    db.close((err) => {
      if (err) console.error('✗ Error al cerrar BD:', err);
      else console.log('✓ Conexión a BD cerrada correctamente');
      process.exit(0);
    });
  } catch (error) {
    console.error('Error en shutdown:', error);
    process.exit(1);
  }
});

module.exports = database;
