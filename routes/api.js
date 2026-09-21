// ============================================================
// API Routes (AJAX endpoints for dynamic filters)
// ============================================================

const express = require('express');
const router = express.Router();
const db = require('../config/database');

// ── Get models by brand ──
router.get('/modelos/:marca', async (req, res) => {
  try {
    const table = (db.isPg && db.isPg()) ? 'public.vehiculos' : 'autos';
    const statusCond = (db.isPg && db.isPg()) ? "estado = 'disponible'" : "(activo = 1 OR estado = 'disponible')";
    const modelos = await db.prepare(
      `SELECT DISTINCT modelo FROM ${table} WHERE ${statusCond} AND marca = ? ORDER BY modelo ASC`
    ).all([req.params.marca]);
    res.json(modelos);
  } catch (error) {
    console.error('Error en /modelos:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ── Get years by brand (optional model) ──
router.get('/anios', async (req, res) => {
  try {
    const { marca, modelo } = req.query;
    const table = (db.isPg && db.isPg()) ? 'public.vehiculos' : 'autos';
    const statusCond = (db.isPg && db.isPg()) ? "estado = 'disponible'" : "(activo = 1 OR estado = 'disponible')";
    let query = `SELECT DISTINCT anio FROM ${table} WHERE ${statusCond}`;
    let params = [];

    if (marca) { query += ' AND marca = ?'; params.push(marca); }
    if (modelo) { query += ' AND modelo = ?'; params.push(modelo); }

    query += ' ORDER BY anio DESC';
    const anios = await db.prepare(query).all(params);
    res.json(anios);
  } catch (error) {
    console.error('Error en /anios:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ── Search vehicles (for AJAX catalog) ──
router.get('/buscar', async (req, res) => {
  try {
    const { marca, modelo, anio, precio_min, precio_max, combustible, orden, page } = req.query;
    const currentPage = parseInt(page) || 1;
    const perPage = 12;
    const offset = (currentPage - 1) * perPage;

    const isPostgres = db.isPg && db.isPg();
    let where = [isPostgres ? "estado = 'disponible'" : "(activo = 1 OR estado = 'disponible')"];
    let params = [];

    if (marca) { where.push('marca = ?'); params.push(marca); }
    if (modelo) { where.push('modelo LIKE ?'); params.push(`%${modelo}%`); }
    if (anio) { where.push('anio = ?'); params.push(parseInt(anio)); }
    if (combustible) { where.push('combustible = ?'); params.push(combustible); }
    if (precio_min) { where.push('precio >= ?'); params.push(parseFloat(precio_min)); }
    if (precio_max) { where.push('precio <= ?'); params.push(parseFloat(precio_max)); }

    let orderClause = 'created_at DESC';
    if (orden === 'precio_asc') orderClause = 'precio ASC';
    if (orden === 'precio_desc') orderClause = 'precio DESC';
    if (orden === 'anio_desc') orderClause = 'anio DESC';
    if (orden === 'anio_asc') orderClause = 'anio ASC';

    const whereClause = where.join(' AND ');
    let total = 0;
    let autos = [];

    if (isPostgres) {
      const totalResult = await db.prepare(`SELECT COUNT(*) as total FROM public.vehiculos WHERE ${whereClause}`).get(params);
      total = totalResult ? totalResult.total : 0;
      autos = await db.prepare(`
        SELECT v.*, 
          CASE WHEN array_length(v.imagenes, 1) > 0 THEN v.imagenes[1] ELSE NULL END as imagen_principal,
          CASE WHEN array_length(v.imagenes, 1) > 0 THEN v.imagenes[1] ELSE NULL END as imagen_fallback
        FROM public.vehiculos v
        WHERE ${whereClause}
        ORDER BY ${orderClause}
        LIMIT ? OFFSET ?
      `).all([...params, perPage, offset]);
    } else {
      const totalResult = await db.prepare(`SELECT COUNT(*) as total FROM autos WHERE ${whereClause}`).get(params);
      total = totalResult ? totalResult.total : 0;
      autos = await db.prepare(`
        SELECT a.*, 
          (SELECT filename FROM auto_imagenes WHERE auto_id = a.id AND es_principal = 1 LIMIT 1) as imagen_principal,
          (SELECT filename FROM auto_imagenes WHERE auto_id = a.id ORDER BY es_principal DESC, orden ASC LIMIT 1) as imagen_fallback
        FROM autos a
        WHERE ${whereClause}
        ORDER BY ${orderClause}
        LIMIT ? OFFSET ?
      `).all([...params, perPage, offset]);
    }

    res.json({
      autos,
      total,
      currentPage,
      totalPages: Math.ceil(total / perPage)
    });
  } catch (error) {
    console.error('Error en /buscar:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
