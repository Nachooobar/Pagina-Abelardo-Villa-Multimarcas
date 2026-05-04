// ============================================================
// Rutas Públicas
// ============================================================

const express = require('express');
const router = express.Router();
const db = require('../config/database');

// ── Helper: Generate slug ──
function generateSlug(marca, modelo) {
  return `${marca}-${modelo}`
    .toLowerCase()
    .replace(/[áàäâ]/g, 'a')
    .replace(/[éèëê]/g, 'e')
    .replace(/[íìïî]/g, 'i')
    .replace(/[óòöô]/g, 'o')
    .replace(/[úùüû]/g, 'u')
    .replace(/ñ/g, 'n')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// ── HOME ──
router.get('/', (req, res) => {
  // Get featured vehicles
  const destacados = db.prepare(`
    SELECT a.*, 
      (SELECT filename FROM auto_imagenes WHERE auto_id = a.id AND es_principal = 1 LIMIT 1) as imagen_principal,
      (SELECT filename FROM auto_imagenes WHERE auto_id = a.id ORDER BY es_principal DESC, orden ASC LIMIT 1) as imagen_fallback
    FROM autos a
    WHERE a.activo = 1 AND a.destacado = 1
    ORDER BY a.created_at DESC
    LIMIT 8
  `).all();

  // Get latest vehicles
  const ultimos = db.prepare(`
    SELECT a.*, 
      (SELECT filename FROM auto_imagenes WHERE auto_id = a.id AND es_principal = 1 LIMIT 1) as imagen_principal,
      (SELECT filename FROM auto_imagenes WHERE auto_id = a.id ORDER BY es_principal DESC, orden ASC LIMIT 1) as imagen_fallback
    FROM autos a
    WHERE a.activo = 1
    ORDER BY a.created_at DESC
    LIMIT 12
  `).all();

  // Get distinct brands, models, years for filters
  const marcas = db.prepare('SELECT DISTINCT marca FROM autos WHERE activo = 1 ORDER BY marca ASC').all();
  const anios = db.prepare('SELECT DISTINCT anio FROM autos WHERE activo = 1 ORDER BY anio DESC').all();

  const totalAutos = db.prepare('SELECT COUNT(*) as total FROM autos WHERE activo = 1').get();

  res.render('index', {
    title: 'Abelardo Villa Multimarcas - Concesionaria',
    destacados,
    ultimos,
    marcas,
    anios,
    totalAutos: totalAutos.total,
    generateSlug
  });
});

// ── CATÁLOGO (all vehicles with filters) ──
router.get('/catalogo', (req, res) => {
  const { marca, modelo, anio, combustible, precio_min, precio_max, orden, page } = req.query;
  const currentPage = parseInt(page) || 1;
  const perPage = 12;
  const offset = (currentPage - 1) * perPage;

  let whereConditions = ['a.activo = 1'];
  let params = [];

  if (marca) { whereConditions.push('a.marca = ?'); params.push(marca); }
  if (modelo) { whereConditions.push('a.modelo LIKE ?'); params.push(`%${modelo}%`); }
  if (anio) { whereConditions.push('a.anio = ?'); params.push(parseInt(anio)); }
  if (combustible) { whereConditions.push('a.combustible = ?'); params.push(combustible); }
  if (precio_min) { whereConditions.push('a.precio >= ?'); params.push(parseFloat(precio_min)); }
  if (precio_max) { whereConditions.push('a.precio <= ?'); params.push(parseFloat(precio_max)); }

  const whereClause = whereConditions.join(' AND ');

  let orderClause = 'a.created_at DESC';
  if (orden === 'precio_asc') orderClause = 'a.precio ASC';
  if (orden === 'precio_desc') orderClause = 'a.precio DESC';
  if (orden === 'anio_desc') orderClause = 'a.anio DESC';
  if (orden === 'anio_asc') orderClause = 'a.anio ASC';
  if (orden === 'km_asc') orderClause = 'a.kilometraje ASC';

  const totalResult = db.prepare(`SELECT COUNT(*) as total FROM autos a WHERE ${whereClause}`).get(...params);
  const totalPages = Math.ceil(totalResult.total / perPage);

  const autos = db.prepare(`
    SELECT a.*, 
      (SELECT filename FROM auto_imagenes WHERE auto_id = a.id AND es_principal = 1 LIMIT 1) as imagen_principal,
      (SELECT filename FROM auto_imagenes WHERE auto_id = a.id ORDER BY es_principal DESC, orden ASC LIMIT 1) as imagen_fallback
    FROM autos a
    WHERE ${whereClause}
    ORDER BY ${orderClause}
    LIMIT ? OFFSET ?
  `).all(...params, perPage, offset);

  const marcas = db.prepare('SELECT DISTINCT marca FROM autos WHERE activo = 1 ORDER BY marca ASC').all();
  const anios = db.prepare('SELECT DISTINCT anio FROM autos WHERE activo = 1 ORDER BY anio DESC').all();

  res.render('catalogo', {
    title: 'Catálogo de Vehículos - Abelardo Villa Multimarcas',
    autos,
    marcas,
    anios,
    filtros: req.query,
    currentPage,
    totalPages,
    totalAutos: totalResult.total,
    generateSlug
  });
});

// ── VEHICLE DETAIL ──
router.get('/auto/:slug-:id', (req, res) => {
  const { id } = req.params;

  const auto = db.prepare(`
    SELECT * FROM autos WHERE id = ? AND activo = 1
  `).get(id);

  if (!auto) {
    return res.status(404).render('404', { title: 'Vehículo no encontrado' });
  }

  const imagenes = db.prepare(`
    SELECT * FROM auto_imagenes WHERE auto_id = ? ORDER BY es_principal DESC, orden ASC
  `).all(id);

  // Related vehicles (same brand or type)
  const relacionados = db.prepare(`
    SELECT a.*, 
      (SELECT filename FROM auto_imagenes WHERE auto_id = a.id AND es_principal = 1 LIMIT 1) as imagen_principal,
      (SELECT filename FROM auto_imagenes WHERE auto_id = a.id ORDER BY es_principal DESC, orden ASC LIMIT 1) as imagen_fallback
    FROM autos a
    WHERE a.activo = 1 AND a.id != ? AND a.marca = ?
    ORDER BY RANDOM()
    LIMIT 4
  `).all(id, auto.marca);

  res.render('detalle', {
    title: `${auto.marca} ${auto.modelo} ${auto.anio} - Abelardo Villa Multimarcas`,
    auto,
    imagenes,
    relacionados,
    generateSlug
  });
});

// ── CONTACTO ──
router.get('/contacto', (req, res) => {
  res.render('contacto', { title: 'Contacto - Abelardo Villa Multimarcas' });
});

// ── NOSOTROS ──
router.get('/nosotros', (req, res) => {
  res.render('nosotros', { title: 'Nosotros - Abelardo Villa Multimarcas' });
});

module.exports = router;
