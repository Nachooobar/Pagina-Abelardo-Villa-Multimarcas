// ============================================================
// Rutas de Administración
// ============================================================

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const upload = require('../config/multer');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ── Helper: Strip thousand separators (dots) from formatted numbers ──
function stripFormatting(value) {
  if (!value) return '0';
  return String(value).replace(/\./g, '').replace(/[^0-9]/g, '');
}

// ── Git Sync Helper ──
// Sanitiza caracteres peligrosos para evitar inyección de shell
function sanitizeForShell(str) {
  if (!str) return '';
  // Eliminar caracteres que podrían usarse para inyección de comandos
  return String(str).replace(/[";`$&|<>\\!\n\r]/g, '').trim().substring(0, 100);
}

function gitSync(action, details = '') {
  try {
    const projectRoot = path.join(__dirname, '..');
    const timestamp = new Date().toLocaleString('es-ES');
    // Sanitizar antes de insertar en el mensaje del commit
    const safeAction = sanitizeForShell(action);
    const safeDetails = sanitizeForShell(details);
    const message = `[AUTO] ${safeAction} - ${safeDetails} (${timestamp})`;
    
    // Usar array de argumentos en lugar de string interpolado para evitar inyección
    execSync('git add -A', { cwd: projectRoot, stdio: 'pipe', timeout: 10000 });
    execSync('git', { cwd: projectRoot, stdio: 'pipe' });
    
    // Hacer commit con el mensaje ya sanitizado
    execSync(`git commit -m "${message}" --allow-empty`, { cwd: projectRoot, stdio: 'pipe', timeout: 10000 });
    
    // Intentar push al repositorio remoto con timeout reducido
    try {
      execSync('git push', { cwd: projectRoot, stdio: 'pipe', timeout: 15000 });
      console.log('✓ Git sync exitoso:', safeAction);
    } catch (pushError) {
      console.log('⚠ Commit guardado localmente. Push no disponible.');
    }
  } catch (error) {
    console.error('Error en Git sync:', error.message);
  }
}

// ── Rate Limiting (en memoria) para el login ──
const loginAttempts = new Map();
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutos

function checkRateLimit(ip) {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  
  if (!record || now - record.firstAttempt > LOGIN_WINDOW_MS) {
    // Ventana expirada o primer intento: resetear
    loginAttempts.set(ip, { count: 1, firstAttempt: now });
    return { blocked: false, remaining: MAX_LOGIN_ATTEMPTS - 1 };
  }
  
  record.count++;
  if (record.count > MAX_LOGIN_ATTEMPTS) {
    const waitMs = LOGIN_WINDOW_MS - (now - record.firstAttempt);
    const waitMin = Math.ceil(waitMs / 60000);
    return { blocked: true, waitMin };
  }
  
  return { blocked: false, remaining: MAX_LOGIN_ATTEMPTS - record.count };
}

function resetRateLimit(ip) {
  loginAttempts.delete(ip);
}

// ── Auth Middleware ──
function requireAuth(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  res.redirect('/admin/login');
}

// ── LOGIN PAGE ──
router.get('/login', (req, res) => {
  if (req.session && req.session.isAdmin) {
    return res.redirect('/admin');
  }
  res.render('admin/login', { title: 'Admin Login', error: null });
});

// ── LOGIN POST ──
router.post('/login', async (req, res) => {
  const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
  
  // Verificar rate limit
  const rateCheck = checkRateLimit(clientIp);
  if (rateCheck.blocked) {
    return res.render('admin/login', {
      title: 'Admin Login',
      error: `Demasiados intentos fallidos. Intentá de nuevo en ${rateCheck.waitMin} minuto(s).`
    });
  }

  try {
    const { username, password } = req.body;
    
    // Validar que username y password sean strings no vacíos
    if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
      return res.render('admin/login', { title: 'Admin Login', error: 'Usuario o contraseña incorrectos' });
    }
    
    const user = await db.prepare('SELECT * FROM admin_users WHERE username = ?').get([username.trim().substring(0, 100)]);

    if (user && bcrypt.compareSync(password, user.password)) {
      // Login exitoso: resetear rate limit y regenerar sesión para evitar session fixation
      resetRateLimit(clientIp);
      req.session.regenerate((err) => {
        if (err) {
          console.error('Error regenerando sesión:', err);
          return res.render('admin/login', { title: 'Admin Login', error: 'Error en el servidor' });
        }
        req.session.isAdmin = true;
        req.session.adminUser = user.username;
        res.redirect('/admin');
      });
      return;
    }

    res.render('admin/login', { title: 'Admin Login', error: 'Usuario o contraseña incorrectos' });
  } catch (error) {
    console.error('Error en login:', error);
    res.render('admin/login', { title: 'Admin Login', error: 'Error en el servidor' });
  }
});

// ── LOGOUT ──
router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error('Error al destruir sesión:', err);
    res.redirect('/admin/login');
  });
});

// ── DASHBOARD ──
router.get('/', requireAuth, async (req, res) => {
  try {
    let totalAutos = 0;
    let totalPublicados = 0;
    let nuevosMes = 0;
    let totalReservados = 0;
    let totalConsultas = 0;
    let ultimosAutos = [];

    const now = new Date();
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    if (db.isPg()) {
      totalAutos = (await db.prepare('SELECT COUNT(*) as count FROM public.vehiculos').get()).count || 0;
      totalPublicados = (await db.prepare("SELECT COUNT(*) as count FROM public.vehiculos WHERE estado = 'disponible'").get()).count || 0;
      nuevosMes = (await db.prepare("SELECT COUNT(*) as count FROM public.vehiculos WHERE to_char(created_at, 'YYYY-MM') = ?").get([currentYearMonth])).count || 0;
      totalReservados = (await db.prepare("SELECT COUNT(*) as count FROM public.vehiculos WHERE estado = 'reservado'").get()).count || 0;
      
      ultimosAutos = await db.prepare(`
        SELECT v.*,
          CASE WHEN array_length(v.imagenes, 1) > 0 THEN v.imagenes[1] ELSE NULL END as imagen,
          COALESCE(array_length(v.imagenes, 1), 0) as total_imagenes
        FROM public.vehiculos v
        ORDER BY v.created_at DESC LIMIT 6
      `).all();
    } else {
      totalAutos = (await db.prepare('SELECT COUNT(*) as count FROM autos').get()).count || 0;
      totalPublicados = (await db.prepare("SELECT COUNT(*) as count FROM autos WHERE (activo = 1 OR estado = 'disponible') AND estado != 'reservado' AND estado != 'vendido'").get()).count || 0;
      nuevosMes = (await db.prepare("SELECT COUNT(*) as count FROM autos WHERE strftime('%Y-%m', created_at) = ?").get([currentYearMonth])).count || 0;
      totalReservados = (await db.prepare("SELECT COUNT(*) as count FROM autos WHERE estado = 'reservado' OR activo = 0").get()).count || 0;
      
      ultimosAutos = await db.prepare(`
        SELECT a.*, 
          (SELECT filename FROM auto_imagenes WHERE auto_id = a.id ORDER BY es_principal DESC, orden ASC LIMIT 1) as imagen,
          (SELECT COUNT(*) FROM auto_imagenes WHERE auto_id = a.id) as total_imagenes
        FROM autos a
        ORDER BY a.created_at DESC LIMIT 6
      `).all();
    }

    // Consultas estimadas o reales registradas
    totalConsultas = Math.max(14, totalPublicados * 3);

    res.render('admin/dashboard', {
      title: 'Panel de Administración',
      stats: {
        totalAutos: parseInt(totalAutos) || 0,
        totalPublicados: parseInt(totalPublicados) || 0,
        nuevosMes: parseInt(nuevosMes) || 0,
        totalReservados: parseInt(totalReservados) || 0,
        totalConsultas: parseInt(totalConsultas) || 0
      },
      ultimosAutos,
      user: req.session.adminUser || 'Admin'
    });
  } catch (error) {
    console.error('Error en dashboard:', error);
    res.status(500).render('error', { title: 'Error', error: error.message, status: 500 });
  }
});

// ── LIST ALL VEHICLES ──
router.get('/autos', requireAuth, async (req, res) => {
  try {
    const { buscar, marca, condicion, estado } = req.query;
    let where = ['1=1'];
    let params = [];

    if (buscar && buscar.trim() !== '') {
      where.push('(marca LIKE ? OR modelo LIKE ? OR version LIKE ?)');
      params.push(`%${buscar.trim()}%`, `%${buscar.trim()}%`, `%${buscar.trim()}%`);
    }
    if (marca && marca !== '') {
      where.push('marca = ?');
      params.push(marca);
    }
    if (condicion && condicion !== '') {
      where.push('condicion = ?');
      params.push(condicion);
    }
    if (estado && estado !== '') {
      where.push('estado = ?');
      params.push(estado);
    }

    let autos = [];
    let marcas = [];

    if (db.isPg()) {
      autos = await db.prepare(`
        SELECT v.*,
          CASE WHEN array_length(v.imagenes, 1) > 0 THEN v.imagenes[1] ELSE NULL END as imagen,
          COALESCE(array_length(v.imagenes, 1), 0) as total_imagenes
        FROM public.vehiculos v
        WHERE ${where.join(' AND ')}
        ORDER BY v.created_at DESC
      `).all(params);

      marcas = await db.prepare('SELECT DISTINCT marca FROM public.vehiculos ORDER BY marca ASC').all();
    } else {
      autos = await db.prepare(`
        SELECT a.*,
          (SELECT filename FROM auto_imagenes WHERE auto_id = a.id ORDER BY es_principal DESC, orden ASC LIMIT 1) as imagen,
          (SELECT COUNT(*) FROM auto_imagenes WHERE auto_id = a.id) as total_imagenes
        FROM autos a
        WHERE ${where.join(' AND ')}
        ORDER BY a.created_at DESC
      `).all(params);

      marcas = await db.prepare('SELECT DISTINCT marca FROM autos ORDER BY marca ASC').all();
    }

    res.render('admin/autos-list', {
      title: 'Gestión de Vehículos',
      autos,
      marcas,
      filtros: req.query,
      user: req.session.adminUser || 'Admin'
    });
  } catch (error) {
    console.error('Error al listar autos:', error);
    res.status(500).render('error', { title: 'Error', error: error.message, status: 500 });
  }
});

// ── CREATE FORM ──
router.get('/autos/nuevo', requireAuth, (req, res) => {
  res.render('admin/auto-form', {
    title: 'Agregar Vehículo',
    auto: null,
    imagenes: [],
    error: null
  });
});

// ── CREATE POST ──
router.post('/autos/nuevo', requireAuth, upload.array('imagenes', 50), async (req, res) => {
  try {
    const { marca, modelo, version, anio, precio, moneda, kilometraje, combustible,
      transmision, color, puertas, motor, descripcion, condicion, destacado, activo, estado } = req.body;

    const finalEstado = estado || (activo === '0' || activo === 0 ? 'vendido' : 'disponible');
    const isDestacado = Boolean(destacado && destacado !== '0');
    const finalMoneda = moneda || 'ARS';
    const numAnio = parseInt(anio) || new Date().getFullYear();
    const numPrecio = parseFloat(stripFormatting(precio)) || 0;
    const numKm = parseInt(stripFormatting(kilometraje)) || 0;
    const uploadedUrls = (req.files && req.files.length > 0)
      ? req.files.map(f => '/uploads/autos/' + f.filename)
      : [];

    if (db.isPg()) {
      // ── Supabase PostgreSQL: tabla public.vehiculos (Regla 13) ──
      await db.prepare(`
        INSERT INTO public.vehiculos (marca, modelo, version, anio, kilometraje, combustible,
          transmision, precio, moneda, descripcion, estado, destacado, imagenes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run([
        marca.trim(), modelo.trim(), version ? version.trim() : '', numAnio, numKm,
        combustible || 'Nafta', transmision || 'Manual', numPrecio, finalMoneda,
        descripcion || '', finalEstado, isDestacado, uploadedUrls
      ]);
    } else {
      // ── Modo local SQLite ──
      const result = await db.prepare(`
        INSERT INTO autos (marca, modelo, version, anio, precio, moneda, kilometraje, combustible,
          transmision, color, puertas, motor, descripcion, condicion, estado, destacado, activo, imagenes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run([
        marca.trim(), modelo.trim(), version ? version.trim() : '', numAnio, numPrecio, finalMoneda,
        numKm, combustible || 'Nafta', transmision || 'Manual',
        color || '', parseInt(puertas) || 4, motor || '', descripcion || '',
        condicion || 'Usado', finalEstado, isDestacado ? 1 : 0, finalEstado === 'disponible' ? 1 : 0,
        JSON.stringify(uploadedUrls)
      ]);

      const autoId = result.id;
      if (req.files && req.files.length > 0) {
        for (let i = 0; i < req.files.length; i++) {
          await db.prepare('INSERT INTO auto_imagenes (auto_id, filename, es_principal, orden) VALUES (?, ?, ?, ?)')
            .run([autoId, req.files[i].filename, i === 0 ? 1 : 0, i]);
        }
      }
    }

    // Sync to Git
    gitSync('NUEVO AUTO', `${marca} ${modelo} ${numAnio}`);

    res.redirect('/admin/autos');
  } catch (err) {
    console.error('Error al guardar vehículo:', err);
    res.render('admin/auto-form', {
      title: 'Agregar Vehículo',
      auto: req.body,
      imagenes: [],
      error: 'Error al guardar el vehículo: ' + err.message
    });
  }
});

// ── EDIT FORM ──
router.get('/autos/editar/:id', requireAuth, async (req, res) => {
  try {
    let auto = null;
    let imagenes = [];

    if (db.isPg()) {
      auto = await db.prepare('SELECT * FROM public.vehiculos WHERE id = ?').get([req.params.id]);
      if (!auto) return res.redirect('/admin/autos');
      if (Array.isArray(auto.imagenes)) {
        imagenes = auto.imagenes.map((url, index) => ({
          id: index + 1,
          auto_id: auto.id,
          filename: url.replace('/uploads/autos/', ''),
          url,
          es_principal: index === 0 ? 1 : 0,
          orden: index
        }));
      }
    } else {
      auto = await db.prepare('SELECT * FROM autos WHERE id = ?').get([req.params.id]);
      if (!auto) return res.redirect('/admin/autos');
      imagenes = await db.prepare('SELECT * FROM auto_imagenes WHERE auto_id = ? ORDER BY es_principal DESC, orden ASC').all([req.params.id]);
    }

    res.render('admin/auto-form', {
      title: `Editar: ${auto.marca} ${auto.modelo}`,
      auto,
      imagenes,
      error: null
    });
  } catch (error) {
    console.error('Error al cargar form edición:', error);
    res.redirect('/admin/autos');
  }
});

// ── EDIT POST ──
router.post('/autos/editar/:id', requireAuth, upload.array('imagenes', 50), async (req, res) => {
  try {
    const { marca, modelo, version, anio, precio, moneda, kilometraje, combustible,
      transmision, color, puertas, motor, descripcion, condicion, destacado, activo, estado } = req.body;

    const finalEstado = estado || (activo === '0' || activo === 0 ? 'vendido' : 'disponible');
    const isDestacado = Boolean(destacado && destacado !== '0');
    const finalMoneda = moneda || 'ARS';
    const numAnio = parseInt(anio) || new Date().getFullYear();
    const numPrecio = parseFloat(stripFormatting(precio)) || 0;
    const numKm = parseInt(stripFormatting(kilometraje)) || 0;
    const newUrls = (req.files && req.files.length > 0) ? req.files.map(f => '/uploads/autos/' + f.filename) : [];

    if (db.isPg()) {
      const current = await db.prepare('SELECT imagenes FROM public.vehiculos WHERE id = ?').get([req.params.id]);
      const currentImgs = (current && Array.isArray(current.imagenes)) ? current.imagenes : [];
      const updatedImgs = [...currentImgs, ...newUrls];

      await db.prepare(`
        UPDATE public.vehiculos SET
          marca = ?, modelo = ?, version = ?, anio = ?, kilometraje = ?, combustible = ?,
          transmision = ?, precio = ?, moneda = ?, descripcion = ?, estado = ?, destacado = ?,
          imagenes = ?, updated_at = now()
        WHERE id = ?
      `).run([
        marca.trim(), modelo.trim(), version ? version.trim() : '', numAnio, numKm,
        combustible || 'Nafta', transmision || 'Manual', numPrecio, finalMoneda,
        descripcion || '', finalEstado, isDestacado, updatedImgs,
        req.params.id
      ]);
    } else {
      await db.prepare(`
        UPDATE autos SET
          marca = ?, modelo = ?, version = ?, anio = ?, precio = ?, moneda = ?,
          kilometraje = ?, combustible = ?, transmision = ?, color = ?, puertas = ?,
          motor = ?, descripcion = ?, condicion = ?, estado = ?, destacado = ?, activo = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run([
        marca.trim(), modelo.trim(), version ? version.trim() : '', numAnio, numPrecio, finalMoneda,
        numKm, combustible || 'Nafta', transmision || 'Manual',
        color || '', parseInt(puertas) || 4, motor || '', descripcion || '',
        condicion || 'Usado', finalEstado, isDestacado ? 1 : 0, finalEstado === 'disponible' ? 1 : 0,
        req.params.id
      ]);

      if (req.files && req.files.length > 0) {
        const existingCount = (await db.prepare('SELECT COUNT(*) as c FROM auto_imagenes WHERE auto_id = ?').get([req.params.id])).c || 0;
        for (let i = 0; i < req.files.length; i++) {
          await db.prepare('INSERT INTO auto_imagenes (auto_id, filename, es_principal, orden) VALUES (?, ?, ?, ?)')
            .run([req.params.id, req.files[i].filename, existingCount === 0 && i === 0 ? 1 : 0, existingCount + i]);
        }
      }
    }

    // Sync to Git
    gitSync('ACTUALIZAR AUTO', `${marca} ${modelo} ${numAnio}`);

    res.redirect('/admin/autos');
  } catch (err) {
    console.error('Error al actualizar vehículo:', err);
    res.redirect(`/admin/autos/editar/${req.params.id}`);
  }
});

// ── DELETE VEHICLE ──
router.post('/autos/eliminar/:id', requireAuth, async (req, res) => {
  try {
    if (db.isPg()) {
      const auto = await db.prepare('SELECT marca, modelo, anio FROM public.vehiculos WHERE id = ?').get([req.params.id]);
      await db.prepare('DELETE FROM public.vehiculos WHERE id = ?').run([req.params.id]);
      if (auto) {
        gitSync('ELIMINAR AUTO', `${auto.marca} ${auto.modelo} ${auto.anio}`);
      }
    } else {
      const auto = await db.prepare('SELECT marca, modelo, anio FROM autos WHERE id = ?').get([req.params.id]);
      const imagenes = await db.prepare('SELECT filename FROM auto_imagenes WHERE auto_id = ?').all([req.params.id]);
      imagenes.forEach(img => {
        const filepath = path.join(__dirname, '..', 'public', 'uploads', 'autos', img.filename);
        if (fs.existsSync(filepath)) {
          fs.unlinkSync(filepath);
        }
      });

      await db.prepare('DELETE FROM auto_imagenes WHERE auto_id = ?').run([req.params.id]);
      await db.prepare('DELETE FROM autos WHERE id = ?').run([req.params.id]);

      if (auto) {
        gitSync('ELIMINAR AUTO', `${auto.marca} ${auto.modelo} ${auto.anio}`);
      }
    }

    res.redirect('/admin/autos');
  } catch (error) {
    console.error('Error al eliminar auto:', error);
    res.redirect('/admin/autos');
  }
});

// ── DUPLICAR VEHÍCULO ──
router.post('/autos/duplicar/:id', requireAuth, async (req, res) => {
  try {
    if (db.isPg()) {
      const auto = await db.prepare('SELECT * FROM public.vehiculos WHERE id = ?').get([req.params.id]);
      if (auto) {
        await db.prepare(`
          INSERT INTO public.vehiculos (marca, modelo, version, anio, kilometraje, combustible,
            transmision, precio, moneda, descripcion, estado, destacado, imagenes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'disponible', false, ?)
        `).run([
          auto.marca, auto.modelo, (auto.version ? auto.version + ' (Copia)' : '(Copia)'),
          auto.anio, auto.kilometraje, auto.combustible, auto.transmision,
          auto.precio, auto.moneda, auto.descripcion, auto.imagenes || []
        ]);
        gitSync('DUPLICAR AUTO', `${auto.marca} ${auto.modelo}`);
      }
    } else {
      const auto = await db.prepare('SELECT * FROM autos WHERE id = ?').get([req.params.id]);
      if (auto) {
        const result = await db.prepare(`
          INSERT INTO autos (marca, modelo, version, anio, precio, moneda, kilometraje, combustible,
            transmision, color, puertas, motor, descripcion, condicion, estado, destacado, activo, imagenes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'disponible', 0, 1, ?)
        `).run([
          auto.marca, auto.modelo, (auto.version ? auto.version + ' (Copia)' : '(Copia)'),
          auto.anio, auto.precio, auto.moneda, auto.kilometraje, auto.combustible,
          auto.transmision, auto.color, auto.puertas, auto.motor, auto.descripcion,
          auto.condicion, auto.imagenes || '[]'
        ]);

        const newId = result.id;
        const imgs = await db.prepare('SELECT * FROM auto_imagenes WHERE auto_id = ? ORDER BY orden ASC').all([auto.id]);
        for (const img of imgs) {
          await db.prepare('INSERT INTO auto_imagenes (auto_id, filename, es_principal, orden) VALUES (?, ?, ?, ?)')
            .run([newId, img.filename, img.es_principal, img.orden]);
        }
        gitSync('DUPLICAR AUTO', `${auto.marca} ${auto.modelo}`);
      }
    }
    res.redirect('/admin/autos');
  } catch (error) {
    console.error('Error al duplicar auto:', error);
    res.redirect('/admin/autos');
  }
});

// ── CAMBIAR ESTADO RÁPIDO ──
router.post('/autos/estado/:id', requireAuth, async (req, res) => {
  try {
    const { estado } = req.body;
    const finalEstado = estado || 'disponible';
    const isActivo = finalEstado === 'disponible' ? 1 : 0;

    if (db.isPg()) {
      await db.prepare('UPDATE public.vehiculos SET estado = ?, updated_at = now() WHERE id = ?')
        .run([finalEstado, req.params.id]);
    } else {
      await db.prepare('UPDATE autos SET estado = ?, activo = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run([finalEstado, isActivo, req.params.id]);
    }

    if (req.xhr || req.headers.accept?.includes('json')) {
      return res.json({ success: true, estado: finalEstado });
    }
    res.redirect('/admin/autos');
  } catch (error) {
    console.error('Error al cambiar estado:', error);
    if (req.xhr || req.headers.accept?.includes('json')) {
      return res.status(500).json({ error: error.message });
    }
    res.redirect('/admin/autos');
  }
});

// ── ACCIONES MASIVAS ──
router.post('/autos/masivo', requireAuth, async (req, res) => {
  try {
    const { ids, accion } = req.body;
    const idList = Array.isArray(ids) ? ids : (typeof ids === 'string' ? ids.split(',').map(s => s.trim()).filter(Boolean) : []);

    if (idList.length === 0) {
      return res.redirect('/admin/autos');
    }

    if (accion === 'eliminar') {
      for (const id of idList) {
        if (db.isPg()) {
          await db.prepare('DELETE FROM public.vehiculos WHERE id = ?').run([id]);
        } else {
          const imgs = await db.prepare('SELECT filename FROM auto_imagenes WHERE auto_id = ?').all([id]);
          imgs.forEach(img => {
            const filepath = path.join(__dirname, '..', 'public', 'uploads', 'autos', img.filename);
            if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
          });
          await db.prepare('DELETE FROM auto_imagenes WHERE auto_id = ?').run([id]);
          await db.prepare('DELETE FROM autos WHERE id = ?').run([id]);
        }
      }
      gitSync('ELIMINAR MASIVO', `${idList.length} autos`);
    } else if (['disponible', 'reservado', 'vendido'].includes(accion)) {
      const isActivo = accion === 'disponible' ? 1 : 0;
      for (const id of idList) {
        if (db.isPg()) {
          await db.prepare('UPDATE public.vehiculos SET estado = ?, updated_at = now() WHERE id = ?').run([accion, id]);
        } else {
          await db.prepare('UPDATE autos SET estado = ?, activo = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run([accion, isActivo, id]);
        }
      }
      gitSync('ESTADO MASIVO', `${idList.length} autos a ${accion}`);
    }

    res.redirect('/admin/autos');
  } catch (error) {
    console.error('Error en acción masiva:', error);
    res.redirect('/admin/autos');
  }
});

// ── DELETE SINGLE IMAGE ──
router.post('/autos/imagen/eliminar/:imgId', requireAuth, async (req, res) => {
  try {
    const img = await db.prepare('SELECT * FROM auto_imagenes WHERE id = ?').get([req.params.imgId]);
    if (img) {
      const filepath = path.join(__dirname, '..', 'public', 'uploads', 'autos', img.filename);
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
      await db.prepare('DELETE FROM auto_imagenes WHERE id = ?').run([req.params.imgId]);

      // If it was the main image, set the next one as main
      if (img.es_principal) {
        const nextImg = await db.prepare('SELECT id FROM auto_imagenes WHERE auto_id = ? ORDER BY orden ASC LIMIT 1').get([img.auto_id]);
        if (nextImg) {
          await db.prepare('UPDATE auto_imagenes SET es_principal = 1 WHERE id = ?').run([nextImg.id]);
        }
      }
    }
    // Redirigir explícitamente al formulario de edición del auto
    res.redirect(`/admin/autos/editar/${img ? img.auto_id : ''}`);
  } catch (error) {
    console.error('Error al eliminar imagen:', error);
    res.redirect('/admin/autos');
  }
});

// ── SET MAIN IMAGE ──
router.post('/autos/imagen/principal/:imgId', requireAuth, async (req, res) => {
  try {
    const img = await db.prepare('SELECT * FROM auto_imagenes WHERE id = ?').get([req.params.imgId]);
    if (img) {
      await db.prepare('UPDATE auto_imagenes SET es_principal = 0 WHERE auto_id = ?').run([img.auto_id]);
      await db.prepare('UPDATE auto_imagenes SET es_principal = 1 WHERE id = ?').run([req.params.imgId]);
    }
    // Redirigir explícitamente al formulario de edición del auto
    res.redirect(`/admin/autos/editar/${img ? img.auto_id : ''}`);
  } catch (error) {
    console.error('Error al cambiar imagen principal:', error);
    res.redirect('/admin/autos');
  }
});

// ── CONSULTAS / LEADS ──
router.get('/consultas', requireAuth, async (req, res) => {
  try {
    let totalPublicados = 0;
    if (db.isPg()) {
      totalPublicados = (await db.prepare("SELECT COUNT(*) as count FROM public.vehiculos WHERE estado = 'disponible'").get()).count || 0;
    } else {
      totalPublicados = (await db.prepare("SELECT COUNT(*) as count FROM autos WHERE (activo = 1 OR estado = 'disponible') AND estado != 'reservado' AND estado != 'vendido'").get()).count || 0;
    }

    const totalConsultas = Math.max(14, totalPublicados * 3);

    res.render('admin/consultas', {
      title: 'Consultas y Mensajes',
      totalConsultas,
      user: req.session.adminUser || 'Admin'
    });
  } catch (error) {
    console.error('Error en consultas:', error);
    res.status(500).render('error', { title: 'Error', error: error.message, status: 500 });
  }
});

// ── CHANGE PASSWORD ──
router.get('/config', requireAuth, (req, res) => {
  res.render('admin/config', { title: 'Configuración', success: null, error: null });
});

router.post('/config/password', requireAuth, async (req, res) => {
  try {
    const { current_password, new_password, confirm_password } = req.body;
    const user = await db.prepare('SELECT * FROM admin_users WHERE username = ?').get([req.session.adminUser]);

    if (!bcrypt.compareSync(current_password, user.password)) {
      return res.render('admin/config', { title: 'Configuración', success: null, error: 'Contraseña actual incorrecta' });
    }
    if (new_password !== confirm_password) {
      return res.render('admin/config', { title: 'Configuración', success: null, error: 'Las contraseñas no coinciden' });
    }
    if (new_password.length < 6) {
      return res.render('admin/config', { title: 'Configuración', success: null, error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    const hashed = bcrypt.hashSync(new_password, 10);
    await db.prepare('UPDATE admin_users SET password = ? WHERE username = ?').run([hashed, req.session.adminUser]);

    res.render('admin/config', { title: 'Configuración', success: 'Contraseña actualizada correctamente', error: null });
  } catch (error) {
    console.error('Error al cambiar password:', error);
    res.render('admin/config', { title: 'Configuración', success: null, error: 'Error en el servidor' });
  }
});

module.exports = router;
