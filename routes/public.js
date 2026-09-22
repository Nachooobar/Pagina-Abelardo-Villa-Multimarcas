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

    const nuevosIngresos = ultimos.slice(0, 8);

    res.render('index', {
      title: 'Abelardo Villa Multimarcas - Autos Usados Seleccionados y 0km',
      seoTitle: 'Abelardo Villa Multimarcas | Autos Usados Seleccionados y 0km en Santa Fe',
      seoDescription: 'Concesionaria multimarca en Rincón, Santa Fe con más de 40 años de trayectoria. Vehículos seleccionados, 0km, permutas y financiación personalizada.',
      destacados,
      ultimos,
      nuevosIngresos,
      marcas,
      anios,
      totalAutos: totalAutos ? totalAutos.total : 0,
      generateSlug
    });
  } catch (error) {
    console.error('Error en ruta HOME:', error);
    res.status(500).render('error', { 
      title: 'Error en el Servidor - Abelardo Villa Multimarcas', 
      seoDescription: 'Ha ocurrido un error al procesar tu solicitud.',
      error: error.message, 
      status: 500 
    });
  }
});

// ── CATÁLOGO (all vehicles with filters) ──
router.get('/catalogo', async (req, res) => {
  try {
    const { 
      marca, 
      modelo, 
      anio, 
      anio_min, 
      anio_max, 
      combustible, 
      transmision, 
      precio_min, 
      precio_max, 
      orden, 
      page, 
      condicion, 
      tipo 
    } = req.query;

    const currentPage = parseInt(page) || 1;
    const perPage = 12;
    const offset = (currentPage - 1) * perPage;

    let whereConditions = [db.isPg() ? "estado = 'disponible'" : "(activo = 1 OR estado = 'disponible')"];
    let params = [];

    // Filtro Condición (0km / Usado)
    if (condicion && condicion !== 'Todos' && condicion !== '') {
      whereConditions.push('condicion = ?');
      params.push(condicion);
    }

    // Filtro Tipo de Carrocería
    if (tipo && tipo !== 'Todos' && tipo !== '') {
      whereConditions.push('(modelo LIKE ? OR descripcion LIKE ?)');
      params.push(`%${tipo}%`, `%${tipo}%`);
    }

    // Filtro Marca
    if (marca && marca !== '') {
      whereConditions.push('marca = ?');
      params.push(marca);
    }

    // Filtro Modelo
    if (modelo && modelo.trim() !== '') {
      whereConditions.push('modelo LIKE ?');
      params.push(`%${modelo.trim()}%`);
    }

    // Filtro Año exacto o por rango
    if (anio && anio !== '') {
      whereConditions.push('anio = ?');
      params.push(parseInt(anio));
    } else {
      if (anio_min && anio_min !== '') {
        whereConditions.push('anio >= ?');
        params.push(parseInt(anio_min));
      }
      if (anio_max && anio_max !== '') {
        whereConditions.push('anio <= ?');
        params.push(parseInt(anio_max));
      }
    }

    // Filtro Combustible
    if (combustible && combustible !== '') {
      whereConditions.push('combustible = ?');
      params.push(combustible);
    }

    // Filtro Transmisión
    if (transmision && transmision !== '') {
      whereConditions.push('transmision LIKE ?');
      params.push(`%${transmision}%`);
    }

    // Filtro Rango de Precio
    if (precio_min && precio_min !== '') {
      whereConditions.push('precio >= ?');
      params.push(parseFloat(precio_min));
    }
    if (precio_max && precio_max !== '') {
      whereConditions.push('precio <= ?');
      params.push(parseFloat(precio_max));
    }

    const whereClause = whereConditions.join(' AND ');

    // Cláusula de ordenamiento
    let orderClause = 'created_at DESC';
    if (orden === 'precio_asc') orderClause = 'precio ASC';
    else if (orden === 'precio_desc') orderClause = 'precio DESC';
    else if (orden === 'km_asc') orderClause = 'kilometraje ASC';
    else if (orden === 'anio_desc') orderClause = 'anio DESC';
    else if (orden === 'anio_asc') orderClause = 'anio ASC';

    let totalResult;
    let autos = [];
    let marcas = [];
    let anios = [];
    let combustibles = [];
    let transmisiones = [];

    const baseFilter = db.isPg() ? "estado = 'disponible'" : "(activo = 1 OR estado = 'disponible')";

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

      marcas = await db.prepare(`SELECT DISTINCT marca FROM public.vehiculos WHERE ${baseFilter} ORDER BY marca ASC`).all();
      anios = await db.prepare(`SELECT DISTINCT anio FROM public.vehiculos WHERE ${baseFilter} ORDER BY anio DESC`).all();
      combustibles = await db.prepare(`SELECT DISTINCT combustible FROM public.vehiculos WHERE ${baseFilter} AND combustible IS NOT NULL ORDER BY combustible ASC`).all();
      transmisiones = await db.prepare(`SELECT DISTINCT transmision FROM public.vehiculos WHERE ${baseFilter} AND transmision IS NOT NULL ORDER BY transmision ASC`).all();
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

      marcas = await db.prepare(`SELECT DISTINCT marca FROM autos WHERE ${baseFilter} ORDER BY marca ASC`).all();
      anios = await db.prepare(`SELECT DISTINCT anio FROM autos WHERE ${baseFilter} ORDER BY anio DESC`).all();
      combustibles = await db.prepare(`SELECT DISTINCT combustible FROM autos WHERE ${baseFilter} AND combustible != '' ORDER BY combustible ASC`).all();
      transmisiones = await db.prepare(`SELECT DISTINCT transmision FROM autos WHERE ${baseFilter} AND transmision != '' ORDER BY transmision ASC`).all();
    }

    const totalAutos = totalResult ? parseInt(totalResult.total) || 0 : 0;
    const totalPages = Math.ceil(totalAutos / perPage) || 1;

    // Helper: generar array de chips activos para renderizar en la vista
    const activeChips = [];
    if (condicion && condicion !== 'Todos') activeChips.push({ key: 'condicion', label: 'Condición', value: condicion });
    if (marca) activeChips.push({ key: 'marca', label: 'Marca', value: marca });
    if (modelo) activeChips.push({ key: 'modelo', label: 'Modelo', value: modelo });
    if (tipo && tipo !== 'Todos') activeChips.push({ key: 'tipo', label: 'Tipo', value: tipo });
    if (anio) activeChips.push({ key: 'anio', label: 'Año', value: anio });
    if (anio_min) activeChips.push({ key: 'anio_min', label: 'Desde', value: anio_min });
    if (anio_max) activeChips.push({ key: 'anio_max', label: 'Hasta', value: anio_max });
    if (combustible) activeChips.push({ key: 'combustible', label: 'Combustible', value: combustible });
    if (transmision) activeChips.push({ key: 'transmision', label: 'Caja', value: transmision });
    if (precio_min) activeChips.push({ key: 'precio_min', label: 'Mín $', value: new Intl.NumberFormat('es-AR').format(precio_min) });
    if (precio_max) activeChips.push({ key: 'precio_max', label: 'Máx $', value: new Intl.NumberFormat('es-AR').format(precio_max) });

    res.render('catalogo', {
      title: 'Catálogo de Vehículos Usados y 0km - Abelardo Villa Multimarcas',
      seoTitle: 'Catálogo de Autos Usados y 0km | Abelardo Villa Multimarcas',
      seoDescription: 'Explorá nuestro stock de autos, camionetas y utilitarios usados y 0km en Santa Fe. Variedad de marcas, modelos y financiación a tu medida.',
      autos,
      marcas,
      anios,
      combustibles,
      transmisiones,
      activeChips,
      filtros: req.query,
      currentPage,
      totalPages,
      totalAutos,
      generateSlug
    });
  } catch (error) {
    console.error('Error en ruta CATÁLOGO:', error);
    res.status(500).render('error', { 
      title: 'Error en el Catálogo - Abelardo Villa Multimarcas', 
      seoDescription: 'No pudimos cargar el catálogo en este momento.',
      error: error.message, 
      status: 500 
    });
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
        return res.status(404).render('404', { 
          title: 'Vehículo no encontrado - Abelardo Villa Multimarcas',
          seoDescription: 'El vehículo que buscás no se encuentra disponible en nuestro catálogo actual.'
        });
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

      // 4 autos relacionados (misma marca o diferentes autos disponibles)
      relacionados = await db.prepare(`
        SELECT v.*, 
          CASE WHEN array_length(v.imagenes, 1) > 0 THEN v.imagenes[1] ELSE NULL END as imagen_principal,
          CASE WHEN array_length(v.imagenes, 1) > 0 THEN v.imagenes[1] ELSE NULL END as imagen_fallback
        FROM public.vehiculos v
        WHERE v.estado = 'disponible' AND v.id != ?
        ORDER BY (CASE WHEN v.marca = ? THEN 0 ELSE 1 END), RANDOM()
        LIMIT 4
      `).all([id, auto.marca]);
    } else {
      auto = await db.prepare('SELECT * FROM autos WHERE id = ?').get([id]);
      if (!auto) {
        return res.status(404).render('404', { 
          title: 'Vehículo no encontrado - Abelardo Villa Multimarcas',
          seoDescription: 'El vehículo que buscás no se encuentra disponible en nuestro catálogo actual.'
        });
      }

      imagenes = await db.prepare(`
        SELECT * FROM auto_imagenes WHERE auto_id = ? ORDER BY es_principal DESC, orden ASC
      `).all([id]);

      // 4 autos relacionados (misma marca o diferentes autos disponibles)
      relacionados = await db.prepare(`
        SELECT a.*, 
          (SELECT filename FROM auto_imagenes WHERE auto_id = a.id AND es_principal = 1 LIMIT 1) as imagen_principal,
          (SELECT filename FROM auto_imagenes WHERE auto_id = a.id ORDER BY es_principal DESC, orden ASC LIMIT 1) as imagen_fallback
        FROM autos a
        WHERE (a.activo = 1 OR a.estado = 'disponible') AND a.id != ?
        ORDER BY (CASE WHEN a.marca = ? THEN 0 ELSE 1 END), a.created_at DESC
        LIMIT 4
      `).all([id, auto.marca]);
    }

    const versionStr = auto.version ? ` ${auto.version}` : '';
    const fullUrl = `${req.protocol}://${req.get('host')}/auto/${generateSlug(auto.marca, auto.modelo)}-${auto.id}`;

    res.render('detalle', {
      title: `${auto.marca} ${auto.modelo}${versionStr} (${auto.anio}) - Abelardo Villa Multimarcas`,
      seoTitle: `${auto.marca} ${auto.modelo}${versionStr} (${auto.anio}) en Venta | Abelardo Villa Multimarcas`,
      seoDescription: `Comprá este ${auto.marca} ${auto.modelo} año ${auto.anio}. ${auto.kilometraje > 0 ? auto.kilometraje.toLocaleString('es-AR') + ' km' : '0km'}, combustible ${auto.combustible}, caja ${auto.transmision}. Financiación disponible en Santa Fe.`,
      auto,
      imagenes,
      relacionados,
      fullUrl,
      generateSlug
    });
  } catch (error) {
    console.error('Error en ruta DETALLE:', error);
    res.status(500).render('error', { 
      title: 'Error al Cargar Vehículo - Abelardo Villa Multimarcas', 
      seoDescription: 'Ocurrió un error al intentar mostrar los detalles del vehículo.',
      error: error.message, 
      status: 500 
    });
  }
});

// ── 0KM SHORTCUT ──
router.get('/0km', (req, res) => {
  res.redirect('/catalogo?condicion=0km');
});

// ── VENDER / PERMUTAR ──
router.get('/vender-permutar', (req, res) => {
  res.render('vender-permutar', {
    title: 'Vender o Permutar tu Auto Usado - Abelardo Villa Multimarcas',
    seoTitle: 'Tasación y Permuta de Autos | Abelardo Villa Multimarcas',
    seoDescription: 'Tasamos tu auto usado en el acto. Tomamos permutas y gestionamos consignaciones con la mejor cotización y seguridad jurídica en Santa Fe.'
  });
});

// ── FINANCIACIÓN ──
router.get('/financiacion', (req, res) => {
  res.render('financiacion', {
    title: 'Financiación de Autos Usados y 0km - Abelardo Villa Multimarcas',
    seoTitle: 'Planes de Financiación de Vehículos | Abelardo Villa Multimarcas',
    seoDescription: 'Financiá tu próximo auto usado o 0km con mínimos requisitos, cuotas fijas en pesos y aprobación inmediata en Abelardo Villa Multimarcas.'
  });
});

// ── CONTACTO ──
router.get('/contacto', (req, res) => {
  res.render('contacto', { 
    title: 'Contacto y Ubicación - Abelardo Villa Multimarcas',
    seoTitle: 'Contacto y Ubicación en Rincón | Abelardo Villa Multimarcas',
    seoDescription: 'Ponete en contacto con Abelardo Villa Multimarcas. Visítanos en Ruta 1 KM 5.5, Rincón, Santa Fe o envianos un WhatsApp para una atención personalizada.'
  });
});

// ── NOSOTROS ──
router.get('/nosotros', (req, res) => {
  res.render('nosotros', { 
    title: 'Nosotros (+40 años de trayectoria) - Abelardo Villa Multimarcas',
    seoTitle: 'Conocé Nuestra Historia (+40 Años) | Abelardo Villa Multimarcas',
    seoDescription: 'Más de 40 años de trayectoria familiar en Rincón, Santa Fe. Garantía, seriedad, transparencia y pasión por los automóviles.'
  });
});

// ── POLÍTICA DE PRIVACIDAD ──
router.get('/privacidad', (req, res) => {
  res.render('privacidad', {
    title: 'Política de Privacidad y Términos - Abelardo Villa Multimarcas',
    seoTitle: 'Política de Privacidad | Abelardo Villa Multimarcas',
    seoDescription: 'Información sobre la privacidad y el tratamiento seguro de datos personales en Abelardo Villa Multimarcas.'
  });
});

// ── DESIGN SYSTEM (solo desarrollo) ──
router.get('/design-system', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).render('404', { 
      title: 'Página no encontrada - Abelardo Villa Multimarcas', 
      seoDescription: 'La página solicitada no existe.',
      path: req.path 
    });
  }
  res.render('design-system', { 
    title: 'Design System — Abelardo Villa Multimarca',
    seoDescription: 'Sistema de diseño centralizado, tokens y catálogo de componentes UI.'
  });
});

// ── ROBOTS.TXT ──
router.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send(`User-agent: *
Allow: /
Disallow: /admin
Disallow: /admin/
Disallow: /api/

Sitemap: https://abelardovillautos.com.ar/sitemap.xml
`);
});

// ── SITEMAP.XML ──
router.get('/sitemap.xml', async (req, res) => {
  try {
    const baseUrl = 'https://abelardovillautos.com.ar';
    const now = new Date().toISOString().split('T')[0];

    const staticPages = [
      { loc: '/', changefreq: 'daily', priority: '1.0' },
      { loc: '/catalogo', changefreq: 'daily', priority: '0.9' },
      { loc: '/catalogo?condicion=0km', changefreq: 'weekly', priority: '0.8' },
      { loc: '/vender-permutar', changefreq: 'monthly', priority: '0.7' },
      { loc: '/financiacion', changefreq: 'monthly', priority: '0.7' },
      { loc: '/nosotros', changefreq: 'monthly', priority: '0.6' },
      { loc: '/contacto', changefreq: 'monthly', priority: '0.6' },
      { loc: '/privacidad', changefreq: 'yearly', priority: '0.3' }
    ];

    let autos = [];
    if (db.isPg && db.isPg()) {
      autos = await db.prepare("SELECT id, marca, modelo, created_at, updated_at FROM public.vehiculos WHERE estado = 'disponible'").all();
    } else {
      autos = await db.prepare("SELECT id, marca, modelo, created_at, updated_at FROM autos WHERE activo = 1 OR estado = 'disponible'").all();
    }

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    staticPages.forEach(p => {
      xml += '  <url>\n';
      xml += `    <loc>${baseUrl}${p.loc}</loc>\n`;
      xml += `    <lastmod>${now}</lastmod>\n`;
      xml += `    <changefreq>${p.changefreq}</changefreq>\n`;
      xml += `    <priority>${p.priority}</priority>\n`;
      xml += '  </url>\n';
    });

    autos.forEach(auto => {
      const slug = generateSlug(auto.marca, auto.modelo);
      const lastmod = auto.updated_at ? new Date(auto.updated_at).toISOString().split('T')[0] : now;
      xml += '  <url>\n';
      xml += `    <loc>${baseUrl}/auto/${slug}-${auto.id}</loc>\n`;
      xml += `    <lastmod>${lastmod}</lastmod>\n`;
      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `    <priority>0.8</priority>\n`;
      xml += '  </url>\n';
    });

    xml += '</urlset>';

    res.header('Content-Type', 'application/xml');
    res.send(xml);
  } catch (error) {
    console.error('Error generando sitemap:', error);
    res.status(500).send('Error generating sitemap');
  }
});

module.exports = router;

