// ============================================================
// Configuración de la Base de Datos PostgreSQL (Supabase)
// ============================================================

require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// Conexión a Supabase usando URL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Requerido por Supabase
});

pool.connect()
  .then(client => {
    console.log('✓ Base de datos PostgreSQL (Supabase) conectada');
    client.release();
  })
  .catch(err => {
    console.error('✗ Error al conectar a Supabase:', err.message);
    console.error('Por favor verifica tu DATABASE_URL en el archivo .env');
  });

// ── Función para adaptar consultas de SQLite (?) a PostgreSQL ($1, $2) ──
function adaptQuery(sql) {
  let i = 1;
  let adaptedSql = sql.replace(/\?/g, () => `$${i++}`);
  
  // Si es un INSERT, PostgreSQL necesita RETURNING id para devolver el ID insertado
  if (adaptedSql.trim().toUpperCase().startsWith('INSERT') && !adaptedSql.toUpperCase().includes('RETURNING ID')) {
    adaptedSql += ' RETURNING id';
  }
  return adaptedSql;
}

// ── Wrapper para mantener compatibilidad con la antigua SQLite ──
const database = {
  all: async (sql, params = []) => {
    const { rows } = await pool.query(adaptQuery(sql), params);
    return rows;
  },
  get: async (sql, params = []) => {
    const { rows } = await pool.query(adaptQuery(sql), params);
    return rows[0] || null;
  },
  run: async (sql, params = []) => {
    const adaptedSql = adaptQuery(sql);
    const result = await pool.query(adaptedSql, params);
    
    if (sql.toUpperCase().includes('INSERT') || sql.toUpperCase().includes('UPDATE') || sql.toUpperCase().includes('DELETE')) {
      console.log(`✓ Datos guardados: ${result.rowCount} fila(s) afectada(s)`);
    }
    
    // Si es insert y devuelve ID, lo capturamos
    const insertedId = (result.rows && result.rows.length > 0 && result.rows[0].id) ? result.rows[0].id : null;
    
    return { id: insertedId, changes: result.rowCount };
  },
  exec: async (sql) => {
    // pg no tiene problemas ejecutando múltiples sentencias simples si no tienen parámetros
    await pool.query(sql);
  },
  prepare: (sql) => {
    return {
      all: (params = []) => database.all(sql, params),
      get: (params = []) => database.get(sql, params),
      run: (params = []) => database.run(sql, params)
    };
  }
};

// ── Inicializar tablas (Sintaxis PostgreSQL) ──
database.exec(`
  CREATE TABLE IF NOT EXISTS autos (
    id SERIAL PRIMARY KEY,
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
    destacado SMALLINT DEFAULT 0,
    activo SMALLINT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS auto_imagenes (
    id SERIAL PRIMARY KEY,
    auto_id INT NOT NULL,
    filename VARCHAR(255) NOT NULL,
    es_principal SMALLINT DEFAULT 0,
    orden INT DEFAULT 0,
    FOREIGN KEY (auto_id) REFERENCES autos(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS admin_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`).then(async () => {
  const adminCount = await database.get('SELECT COUNT(*) as count FROM admin_users');
  // PostgreSQL devuelve count como string ('0') o int dependiendo del driver, validamos ambos:
  if (parseInt(adminCount.count) === 0) {
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    await database.run(
      'INSERT INTO admin_users (username, password) VALUES (?, ?)',
      ['admin', hashedPassword]
    );
    console.log('✓ Usuario admin creado: admin / admin123');
  }
  console.log('✓ Tablas de Supabase inicializadas');
}).catch((err) => {
  console.error('✗ Error al inicializar tablas Supabase:', err.message);
});

// Función mock para mantener compatibilidad
database.vacuum = () => Promise.resolve();

// Cerrar conexión
database.close = () => {
  return pool.end()
    .then(() => console.log('✓ Pool de Supabase cerrado correctamente'))
    .catch(err => console.error('✗ Error al cerrar pool de Supabase:', err));
};

module.exports = database;
