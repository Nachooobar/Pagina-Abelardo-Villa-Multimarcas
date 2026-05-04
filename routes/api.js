// ============================================================
// API Routes (AJAX endpoints for dynamic filters)
// ============================================================

const express = require('express');
const router = express.Router();
const db = require('../config/database');

// ── Get models by brand ──
router.get('/modelos/:marca', async (req, res) => {
  try {
    const modelos = await db.prepare(
      'SELECT DISTINCT modelo FROM autos WHERE activo = 1 AND marca = ? ORDER BY modelo ASC'
    ).all([req.params.marca]);
    res.json(modelos);
  } catch (error) {
    console.error('Error en /modelos:', error);
    res.status(500).json({ error: error.message });
  }
});

// ── Get years by brand (optional model) ──
router.get('/anios', async (req, res) => {
  try {
    const { marca, modelo } = req.query;
    let query = 'SELECT DISTINCT anio FROM autos WHERE activo = 1';
    let params = [];

    if (marca) { query += ' AND marca = ?'; params.push(marca); }
    if (modelo) { query += ' AND modelo = ?'; params.push(modelo); }

    query += ' ORDER BY anio DESC';
    const anios = await db.prepare(query).all(params);
    res.json(anios);
  } catch (error) {
    console.error('Error en /anios:', error);
    res.status(500).json({ error: error.message });
  }
});

// ── Search vehicles (for AJAX catalog) ──
router.get('/buscar', async (req, res) => {
  try {
    const { marca, modelo, anio, precio_min, precio_max, combustible, orden, page } = req.query;
    const currentPage = parseInt(page) || 1;
    const perPage = 12;
    const offset = (currentPage - 1) * perPage;

    let where = ['a.activo = 1'];
    let params = [];

    if (marca) { where.push('a.marca = ?'); params.push(marca); }
    if (modelo) { where.push('a.modelo LIKE ?'); params.push(`%${modelo}%`); }
    if (anio) { where.push('a.anio = ?'); params.push(parseInt(anio)); }
    if (combustible) { where.push('a.combustible = ?'); params.push(combustible); }
    if (precio_min) { where.push('a.precio >= ?'); params.push(parseFloat(precio_min)); }
    if (precio_max) { where.push('a.precio <= ?'); params.push(parseFloat(precio_max)); }

    let orderClause = 'a.created_at DESC';
    if (orden === 'precio_asc') orderClause = 'a.precio ASC';
    if (orden === 'precio_desc') orderClause = 'a.precio DESC';
    if (orden === 'anio_desc') orderClause = 'a.anio DESC';
    if (orden === 'anio_asc') orderClause = 'a.anio ASC';

    const whereClause = where.join(' AND ');
    const totalResult = await db.prepare(`SELECT COUNT(*) as total FROM autos a WHERE ${whereClause}`).get(params);
    const total = totalResult.total;

    const autos = await db.prepare(`
      SELECT a.*, 
        (SELECT filename FROM auto_imagenes WHERE auto_id = a.id AND es_principal = 1 LIMIT 1) as imagen_principal,
        (SELECT filename FROM auto_imagenes WHERE auto_id = a.id ORDER BY es_principal DESC, orden ASC LIMIT 1) as imagen_fallback
      FROM autos a
      WHERE ${whereClause}
      ORDER BY ${orderClause}
      LIMIT ? OFFSET ?
    `).all([...params, perPage, offset]);

    res.json({
      autos,
      total,
      currentPage,
      totalPages: Math.ceil(total / perPage)
    });
  } catch (error) {
    console.error('Error en /buscar:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
