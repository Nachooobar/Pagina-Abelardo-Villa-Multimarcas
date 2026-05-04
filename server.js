// ============================================================
// Abelardo Villa Multimarcas - Servidor Principal
// Node.js + Express + SQLite + EJS
// ============================================================

const express = require('express');
const path = require('path');
const session = require('express-session');

// Configuración de entorno
const NODE_ENV = process.env.NODE_ENV || 'development';
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

// Cargar base de datos
let db;
try {
  db = require('./config/database');
  console.log('✓ Base de datos inicializada correctamente');
} catch (error) {
  console.error('✗ Error al inicializar la base de datos:', error.message);
  process.exit(1);
}

// Crear aplicación Express
const app = express();

// ── Configuración de vistas ──
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('env', NODE_ENV);
app.set('trust proxy', 1);

// ── Middlewares globales ──
app.use(express.static(path.join(__dirname, 'public'), { 
  maxAge: NODE_ENV === 'production' ? '1d' : 0 
}));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));

// ── Sesiones ──
app.use(session({
  secret: process.env.SESSION_SECRET || 'abelardo-villa-multimarcas-secret-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    maxAge: 1000 * 60 * 60 * 12,
    secure: false,
    httpOnly: true,
    sameSite: 'lax'
  }
}));

// ── Variables globales de respuesta ──
app.use((req, res, next) => {
  res.locals.currentYear = new Date().getFullYear();
  res.locals.isAdmin = req.session && req.session.isAdmin;
  res.locals.NODE_ENV = NODE_ENV;
  next();
});

// ── Logging de requests en desarrollo ──
if (NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });
}

// ── Cargar rutas ──
try {
  const publicRoutes = require('./routes/public');
  const adminRoutes = require('./routes/admin');
  const apiRoutes = require('./routes/api');

  app.use('/', publicRoutes);
  app.use('/admin', adminRoutes);
  app.use('/api', apiRoutes);

  console.log('✓ Rutas cargadas correctamente');
} catch (error) {
  console.error('✗ Error al cargar rutas:', error.message);
  process.exit(1);
}

// ── Manejador de rutas no encontradas (404) ──
app.use((req, res) => {
  res.status(404).render('404', { 
    title: 'Página no encontrada',
    path: req.path 
  });
});

// ── Manejador de errores global ──
app.use((err, req, res, next) => {
  const status = err.status || 500;
  const message = NODE_ENV === 'production' 
    ? 'Error del servidor. Por favor, intenta más tarde.'
    : err.message;

  console.error(`\n✗ [ERROR ${status}] ${new Date().toISOString()}`);
  console.error(`   Path: ${req.path}`);
  console.error(`   Message: ${err.message}`);
  console.error(`   Stack: ${err.stack}\n`);

  res.status(status).render('error', { 
    title: 'Error del servidor',
    error: message,
    status 
  });
});

// ── Iniciar servidor ──
const server = app.listen(PORT, HOST, () => {
  console.log(`
╔════════════════════════════════════════════════╗
║     🚗 Abelardo Villa Multimarcas              ║
╠════════════════════════════════════════════════╣
║ Estado: Servidor activo                        ║
║ URL: http://${HOST}:${PORT}                    ║
║ Admin: http://${HOST}:${PORT}/admin            ║
║ Entorno: ${NODE_ENV.toUpperCase()}                         ║
╚════════════════════════════════════════════════╝
  `);
});

// ── Manejo de cierre graceful ──
process.on('SIGTERM', () => {
  console.log('\n⚠ SIGTERM recibido. Cerrando servidor...');
  server.close(() => {
    console.log('✓ Servidor cerrado correctamente');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n⚠ SIGINT recibido. Cerrando servidor...');
  server.close(() => {
    console.log('✓ Servidor cerrado correctamente');
    process.exit(0);
  });
});

// ── Manejo de errores no capturados ──
process.on('uncaughtException', (error) => {
  console.error('\n✗ Excepción no capturada:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('\n✗ Promise rechazada sin manejo:', reason);
  process.exit(1);
});

// ── Exportar para testing (opcional) ──
module.exports = app;
