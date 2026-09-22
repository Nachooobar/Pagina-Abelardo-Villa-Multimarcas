// ============================================================
// Abelardo Villa Multimarcas - Servidor Principal
// Node.js + Express + SQLite + EJS
// ============================================================

require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const brand = require('./config/brand');

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
const compression = require('compression');
app.use(compression());
app.use(express.static(path.join(__dirname, 'public'), { 
  maxAge: NODE_ENV === 'production' ? '1d' : 0 
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));

// ── Headers de seguridad HTTP ──
app.use((req, res, next) => {
  // Prevenir clickjacking
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  // Prevenir sniffing de MIME type
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Protección XSS del navegador (legado, pero útil para IE/Edge antiguos)
  res.setHeader('X-XSS-Protection', '1; mode=block');
  // Controlar información del referer
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Evitar que se almacenen páginas admin en caché del navegador
  if (req.path.startsWith('/admin')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
  }
  next();
});

// ── Sesiones ──
const SESSION_SECRET = process.env.SESSION_SECRET;
const HARDCODED_FALLBACK = 'abelardo-villa-multimarcas-secret-2024';
if (!SESSION_SECRET || SESSION_SECRET === HARDCODED_FALLBACK) {
  console.warn('⚠ ADVERTENCIA: SESSION_SECRET no configurado o usa el valor por defecto inseguro.');
  console.warn('   Configurá SESSION_SECRET en el archivo .env con una cadena aleatoria larga.');
}

app.use(session({
  secret: SESSION_SECRET || HARDCODED_FALLBACK,
  resave: false,
  saveUninitialized: false,
  cookie: { 
    maxAge: 1000 * 60 * 60 * 12,
    secure: NODE_ENV === 'production', // HTTPS obligatorio en producción
    httpOnly: true,
    sameSite: 'lax'
  }
}));

// ── Variables globales de respuesta ──
app.use((req, res, next) => {
  res.locals.currentYear = new Date().getFullYear();
  res.locals.isAdmin = req.session && req.session.isAdmin;
  res.locals.NODE_ENV = NODE_ENV;
  res.locals.currentPath = req.path;
  
  // ── Inyectar configuración de marca ──
  res.locals.brand = brand;
  
  // ── Helper: Generar link de WhatsApp ──
  res.locals.getWhatsAppLink = (vehicleName = null) => {
    const baseNumber = brand.contact.whatsapp.number;
    const baseURL = `https://wa.me/${baseNumber}?text=`;
    const message = vehicleName 
      ? encodeURIComponent(brand.contact.whatsapp.messages.vehicleInfo(vehicleName))
      : encodeURIComponent(brand.contact.whatsapp.messages.general);
    return baseURL + message;
  };
  
  // ── Helper: Generar link de WhatsApp para coming soon ──
  res.locals.getWhatsAppComingSoon = () => {
    const baseNumber = brand.contact.whatsapp.number;
    const baseURL = `https://wa.me/${baseNumber}?text=`;
    const message = encodeURIComponent(brand.contact.whatsapp.messages.inventory);
    return baseURL + message;
  };

  next();
});

// ── Middleware: Verificar estado del inventario ──
app.use(async (req, res, next) => {
  try {
    const sqlCount = (db.isPg && db.isPg())
      ? "SELECT COUNT(*) as count FROM public.vehiculos WHERE estado = 'disponible'"
      : "SELECT COUNT(*) as count FROM autos WHERE (activo = 1 OR estado = 'disponible')";
    const inventoryCount = await db.get(sqlCount);
    const count = inventoryCount ? (inventoryCount.count || 0) : 0;
    res.locals.inventoryStatus = count === 0 ? 'coming_soon' : 'available';
    res.locals.hasInventory = count > 0;
    res.locals.totalInventoryCount = count;
  } catch (error) {
    console.error('Error verificando inventario:', error);
    res.locals.inventoryStatus = 'available';
    res.locals.hasInventory = true;
    res.locals.totalInventoryCount = 0;
  }
  next();
});

// ── Middleware: SEO Dinámico ──
app.use((req, res, next) => {
  const originalRender = res.render;
  
  res.render = function(view, locals = {}) {
    // Establecer título por defecto si no existe
    if (!locals.seoTitle) {
      locals.seoTitle = brand.seo.baseTitle;
    }
    
    // Establecer descripción por defecto
    if (!locals.seoDescription) {
      locals.seoDescription = brand.description;
    }
    
    // Pasar al render original
    return originalRender.call(this, view, locals);
  };
  
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
async function gracefulShutdown(signal) {
  console.log(`\n⚠ ${signal} recibido. Cerrando servidor...`);
  server.close(async () => {
    console.log('✓ Servidor cerrado correctamente');
    try { await db.close(); } catch(e) { /* silencioso */ }
    process.exit(0);
  });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ── Manejo de errores no capturados ──
process.on('uncaughtException', (error) => {
  console.error('\n✗ Excepción no capturada:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('\n✗ Promise rechazada sin manejo:', reason);
});

// ── Exportar para testing (opcional) ──
module.exports = app;
