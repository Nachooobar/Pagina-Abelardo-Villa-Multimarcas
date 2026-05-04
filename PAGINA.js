// ============================================================
// Abelardo Villa Multimarcas - Servidor Principal
// Node.js + Express + SQLite + EJS
// ============================================================

const express = require('express');
const path = require('path');
const session = require('express-session');
const db = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3000;

// ── View Engine ──
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ── Middleware ──
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: 'abelardo-villa-multimarcas-secret-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 4 } // 4 hours
}));

// ── Global template variables ──
app.use((req, res, next) => {
  res.locals.currentYear = new Date().getFullYear();
  res.locals.isAdmin = req.session && req.session.isAdmin;
  next();
});

// ── Routes ──
const publicRoutes = require('./routes/public');
const adminRoutes = require('./routes/admin');
const apiRoutes = require('./routes/api');

app.use('/', publicRoutes);
app.use('/admin', adminRoutes);
app.use('/api', apiRoutes);

// ── 404 Handler ──
app.use((req, res) => {
  res.status(404).render('404', { title: 'Página no encontrada' });
});

// ── Error Handler ──
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', { title: 'Error del servidor', error: err.message });
});

// ── Start Server ──
app.listen(PORT, () => {
  console.log(`\n🚗  Abelardo Villa Multimarcas`);
  console.log(`   Servidor corriendo en http://localhost:${PORT}`);
  console.log(`   Panel Admin: http://localhost:${PORT}/admin\n`);
});
