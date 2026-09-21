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
router.get('/', async (req, res) => {
  try {
    let destacados = [];
    let ultimos = [];
    let marcas = [];
    let anios = [];
    let totalAutos = { total: 0 };

    if (db.isPg()) {
      destacados = await db.prepare(`
        SELECT v.*, 
          CASE WHEN array_length(v.imagenes, 1) > 0 THEN v.imagenes[1] ELSE NULL END as imagen_principal,
          CASE WHEN array_length(v.imagenes, 1) > 0 THEN v.imagenes[1] ELSE NULL END as imagen_fallback
        FROM public.vehiculos v
        WHERE v.estado = 'disponible' AND v.destacado = true
        ORDER BY v.created_at DESC
        LIMIT 8
      `).all([]);

      ultimos = await db.prepare(`
        SELECT v.*, 
          CASE WHEN array_length(v.imagenes, 1) > 0 THEN v.imagenes[1] ELSE NULL END as imagen_principal,
          CASE WHEN array_length(v.imagenes, 1) > 0 THEN v.imagenes[1] ELSE NULL END as imagen_fallback
        FROM public.vehiculos v
        WHERE v.estado = 'disponible'
        ORDER BY v.created_at DESC
        LIMIT 12
      `).all([]);

      marcas = await db.prepare("SELECT DISTINCT marca FROM public.vehiculos WHERE estado = 'disponible' ORDER BY marca ASC").all([]);
      anios = await db.prepare("SELECT DISTINCT anio FROM public.vehiculos WHERE estado = 'disponible' ORDER BY anio DESC").all([]);
      totalAutos = await db.prepare("SELECT COUNT(*) as total FROM public.vehiculos WHERE estado = 'disponible'").get([]);
    } else {
      destacados = await db.prepare(`
        SELECT a.*, 
          (SELECT filename FROM auto_imagenes WHERE auto_id = a.id AND es_principal = 1 LIMIT 1) as imagen_principal,
          (SELECT filename FROM auto_imagenes WHERE auto_id = a.id ORDER BY es_principal DESC, orden ASC LIMIT 1) as imagen_fallback
        FROM autos a
        WHERE (a.activo = 1 OR a.estado = 'disponible') AND a.destacado = 1
        ORDER BY a.created_at DESC
        LIMIT 8
      `).all([]);

      ultimos = await db.prepare(`
        SELECT a.*, 
          (SELECT filename FROM auto_imagenes WHERE auto_id = a.id AND es_principal = 1 LIMIT 1) as imagen_principal,
          (SELECT filename FROM auto_imagenes WHERE auto_id = a.id ORDER BY es_principal DESC, orden ASC LIMIT 1) as imagen_fallback
        FROM autos a
        WHERE (a.activo = 1 OR a.estado = 'disponible')
        ORDER BY a.created_at DESC
        LIMIT 12
      `).all([]);

      marcas = await db.prepare("SELECT DISTINCT marca FROM autos WHERE (activo = 1 OR estado = 'disponible') ORDER BY marca ASC").all([]);
      anios = await db.prepare("SELECT DISTINCT anio FROM autos WHERE (activo = 1 OR estado = 'disponible') ORDER BY anio DESC").all([]);
      totalAutos = await db.prepare("SELECT COUNT(*) as total FROM autos WHERE (activo = 1 OR estado = 'disponible')").get([]);
    }

    res.render('index', {
      title: 'Abelardo Villa Multimarcas - Concesionaria Oficial',
      destacados,
      ultimos,
      marcas,
      anios,
      totalAutos: totalAutos ? totalAutos.total : 0,
      generateSlug
    });
  } catch (error) {
    console.error('Error en ruta HOME:', error);
    res.status(500).render('error', { title: 'Error', error: error.message, status: 500 });
  }
});

// ── CATÁLOGO (all vehicles with filters) ──
router.get('/catalogo', async (req, res) => {
  try {
    const { marca, modelo, anio, combustible, precio_min, precio_max, orden, page } = req.query;
    const currentPage = parseInt(page) || 1;
    const perPage = 12;
    const offset = (currentPage - 1) * perPage;

    let whereConditions = [db.isPg() ? "estado = 'disponible'" : "(activo = 1 OR estado = 'disponible')"];
    let params = [];

    if (marca) { whereConditions.push('marca = ?'); params.push(marca); }
    if (modelo) { whereConditions.push('modelo LIKE ?'); params.push(`%${modelo}%`); }
    if (anio) { whereConditions.push('anio = ?'); params.push(parseInt(anio)); }
    if (combustible) { whereConditions.push('combustible = ?'); params.push(combustible); }
    if (precio_min) { whereConditions.push('precio >= ?'); params.push(parseFloat(precio_min)); }
    if (precio_max) { whereConditions.push('precio <= ?'); params.push(parseFloat(precio_max)); }

    const whereClause = whereConditions.join(' AND ');

    let orderClause = 'created_at DESC';
    if (orden === 'precio_asc') orderClause = 'precio ASC';
    if (orden === 'precio_desc') orderClause = 'precio DESC';
    if (orden === 'anio_desc') orderClause = 'anio DESC';
    if (orden === 'anio_asc') orderClause = 'anio ASC';
    if (orden === 'km_asc') orderClause = 'kilometraje ASC';

    let totalResult;
    let autos = [];
    let marcas = [];
    let anios = [];

    if (db.isPg()) {
      totalResult = await db.prepare(`SELECT COUNT(*) as total FROM public.vehiculos WHERE ${whereClause}`).get(params);
      autos = await db.prepare(`
        SELECT v.*, 
          CASE WHEN array_length(v.imagenes, 1) > 0 THEN v.imagenes[1] ELSE NULL END as imagen_principal,
          CASE WHEN array_length(v.imagenes, 1) > 0 THEN v.imagenes[1] ELSE NULL END as imagen_fallback
        FROM public.vehiculos v
        WHERE ${whereClause}
        ORDER BY ${orderClause}
        LIMIT ? OFFSET ?
      `).all([...params, perPage, offset]);

      marcas = await db.prepare("SELECT DISTINCT marca FROM public.vehiculos WHERE estado = 'disponible' ORDER BY marca ASC").all();
      anios = await db.prepare("SELECT DISTINCT anio FROM public.vehiculos WHERE estado = 'disponible' ORDER BY anio DESC").all();
    } else {
      totalResult = await db.prepare(`SELECT COUNT(*) as total FROM autos WHERE ${whereClause}`).get(params);
      autos = await db.prepare(`
        SELECT a.*, 
          (SELECT filename FROM auto_imagenes WHERE auto_id = a.id AND es_principal = 1 LIMIT 1) as imagen_principal,
          (SELECT filename FROM auto_imagenes WHERE auto_id = a.id ORDER BY es_principal DESC, orden ASC LIMIT 1) as imagen_fallback
        FROM autos a
        WHERE ${whereClause}
        ORDER BY ${orderClause}
        LIMIT ? OFFSET ?
      `).all([...params, perPage, offset]);

      marcas = await db.prepare("SELECT DISTINCT marca FROM autos WHERE (activo = 1 OR estado = 'disponible') ORDER BY marca ASC").all();
      anios = await db.prepare("SELECT DISTINCT anio FROM autos WHERE (activo = 1 OR estado = 'disponible') ORDER BY anio DESC").all();
    }

    const totalPages = Math.ceil((totalResult ? totalResult.total : 0) / perPage);

    res.render('catalogo', {
      title: 'Catálogo de Vehículos - Abelardo Villa Multimarcas',
      autos,
      marcas,
      anios,
      filtros: req.query,
      currentPage,
      totalPages,
      totalAutos: totalResult ? totalResult.total : 0,
      generateSlug
    });
  } catch (error) {
    console.error('Error en ruta CATÁLOGO:', error);
    res.status(500).render('error', { title: 'Error', error: error.message, status: 500 });
  }
});

// ── VEHICLE DETAIL ──
router.get('/auto/:slug-:id', async (req, res) => {
  try {
    const { id } = req.params;
    let auto = null;
    let imagenes = [];
    let relacionados = [];

    if (db.isPg()) {
      auto = await db.prepare("SELECT * FROM public.vehiculos WHERE id = ?").get([id]);
      if (!auto) {
        return res.status(404).render('404', { title: 'Vehículo no encontrado' });
      }

      if (Array.isArray(auto.imagenes)) {
        imagenes = auto.imagenes.map((url, i) => ({
          id: i + 1,
          auto_id: auto.id,
          filename: url.replace('/uploads/autos/', ''),
          url,
          es_principal: i === 0 ? 1 : 0,
          orden: i
        }));
      }

      relacionados = await db.prepare(`
        SELECT v.*, 
          CASE WHEN array_length(v.imagenes, 1) > 0 THEN v.imagenes[1] ELSE NULL END as imagen_principal,
          CASE WHEN array_length(v.imagenes, 1) > 0 THEN v.imagenes[1] ELSE NULL END as imagen_fallback
        FROM public.vehiculos v
        WHERE v.estado = 'disponible' AND v.id != ? AND v.marca = ?
        ORDER BY RANDOM()
        LIMIT 4
      `).all([id, auto.marca]);
    } else {
      auto = await db.prepare('SELECT * FROM autos WHERE id = ?').get([id]);
      if (!auto) {
        return res.status(404).render('404', { title: 'Vehículo no encontrado' });
      }

      imagenes = await db.prepare(`
        SELECT * FROM auto_imagenes WHERE auto_id = ? ORDER BY es_principal DESC, orden ASC
      `).all([id]);

      relacionados = await db.prepare(`
        SELECT a.*, 
          (SELECT filename FROM auto_imagenes WHERE auto_id = a.id AND es_principal = 1 LIMIT 1) as imagen_principal,
          (SELECT filename FROM auto_imagenes WHERE auto_id = a.id ORDER BY es_principal DESC, orden ASC LIMIT 1) as imagen_fallback
        FROM autos a
        WHERE (a.activo = 1 OR a.estado = 'disponible') AND a.id != ? AND a.marca = ?
        ORDER BY RANDOM()
        LIMIT 4
      `).all([id, auto.marca]);
    }

    res.render('detalle', {
      title: `${auto.marca} ${auto.modelo} ${auto.anio} - Abelardo Villa Multimarcas`,
      auto,
      imagenes,
      relacionados,
      generateSlug
    });
  } catch (error) {
    console.error('Error en ruta DETALLE:', error);
    res.status(500).render('error', { title: 'Error', error: error.message, status: 500 });
  }
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
