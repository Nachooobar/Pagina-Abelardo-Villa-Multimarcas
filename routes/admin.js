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

// ── Git Sync Helper ──
function gitSync(action, details = '') {
  try {
    const projectRoot = path.join(__dirname, '..');
    const timestamp = new Date().toLocaleString('es-ES');
    const message = `[AUTO] ${action} - ${details || ''} (${timestamp})`;
    
    // Agregar cambios a Git
    execSync('git add -A', { cwd: projectRoot, stdio: 'pipe' });
    
    // Hacer commit
    execSync(`git commit -m "${message}" --allow-empty`, { cwd: projectRoot, stdio: 'pipe' });
    
    // Intentar push al repositorio remoto
    try {
      execSync('git push', { cwd: projectRoot, stdio: 'pipe', timeout: 5000 });
      console.log('✓ Git sync exitoso:', message);
    } catch (pushError) {
      console.log('⚠ Commit guardado localmente. Push no disponible:', pushError.message);
    }
  } catch (error) {
    console.error('Error en Git sync:', error.message);
  }
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
  try {
    const { username, password } = req.body;
    const user = await db.prepare('SELECT * FROM admin_users WHERE username = ?').get([username]);

    if (user && bcrypt.compareSync(password, user.password)) {
      req.session.isAdmin = true;
      req.session.adminUser = user.username;
      return res.redirect('/admin');
    }

    res.render('admin/login', { title: 'Admin Login', error: 'Usuario o contraseña incorrectos' });
  } catch (error) {
    console.error('Error en login:', error);
    res.render('admin/login', { title: 'Admin Login', error: 'Error en el servidor' });
  }
});

// ── LOGOUT ──
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin/login');
});

// ── DASHBOARD ──
router.get('/', requireAuth, async (req, res) => {
  try {
    const totalAutos = (await db.prepare('SELECT COUNT(*) as count FROM autos').get()).count;
    const totalActivos = (await db.prepare('SELECT COUNT(*) as count FROM autos WHERE activo = 1').get()).count;
    const totalDestacados = (await db.prepare('SELECT COUNT(*) as count FROM autos WHERE destacado = 1').get()).count;
    const totalImagenes = (await db.prepare('SELECT COUNT(*) as count FROM auto_imagenes').get()).count;

    const ultimosAutos = await db.prepare(`
      SELECT a.*, 
        (SELECT filename FROM auto_imagenes WHERE auto_id = a.id ORDER BY es_principal DESC LIMIT 1) as imagen
      FROM autos a
      ORDER BY a.created_at DESC LIMIT 5
    `).all();

    res.render('admin/dashboard', {
      title: 'Panel de Administración',
      stats: { totalAutos, totalActivos, totalDestacados, totalImagenes },
      ultimosAutos
    });
  } catch (error) {
    console.error('Error en dashboard:', error);
    res.status(500).render('error', { title: 'Error', error: error.message, status: 500 });
  }
});

// ── LIST ALL VEHICLES ──
router.get('/autos', requireAuth, async (req, res) => {
  try {
    const { buscar, marca, condicion } = req.query;
    let where = ['1=1'];
    let params = [];

    if (buscar) {
      where.push('(a.marca LIKE ? OR a.modelo LIKE ? OR a.version LIKE ?)');
      params.push(`%${buscar}%`, `%${buscar}%`, `%${buscar}%`);
    }
    if (marca) { where.push('a.marca = ?'); params.push(marca); }
    if (condicion) { where.push('a.condicion = ?'); params.push(condicion); }

    const autos = await db.prepare(`
      SELECT a.*,
        (SELECT filename FROM auto_imagenes WHERE auto_id = a.id ORDER BY es_principal DESC LIMIT 1) as imagen,
        (SELECT COUNT(*) FROM auto_imagenes WHERE auto_id = a.id) as total_imagenes
      FROM autos a
      WHERE ${where.join(' AND ')}
      ORDER BY a.created_at DESC
    `).all(params);

    const marcas = await db.prepare('SELECT DISTINCT marca FROM autos ORDER BY marca').all();

    res.render('admin/autos-list', {
      title: 'Gestión de Vehículos',
      autos,
      marcas,
      filtros: req.query
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
      transmision, color, puertas, motor, descripcion, condicion, destacado, activo } = req.body;

    const result = await db.prepare(`
      INSERT INTO autos (marca, modelo, version, anio, precio, moneda, kilometraje, combustible,
        transmision, color, puertas, motor, descripcion, condicion, destacado, activo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run([
      marca, modelo, version || '', parseInt(anio), parseFloat(precio) || 0, moneda || 'USD',
      parseInt(kilometraje) || 0, combustible || 'Nafta', transmision || 'Manual',
      color || '', parseInt(puertas) || 4, motor || '', descripcion || '',
      condicion || 'Usado', destacado ? 1 : 0, activo ? 1 : 1
    ]);

    const autoId = result.id;

    // Save images
    if (req.files && req.files.length > 0) {
      req.files.forEach(async (file, index) => {
        await db.prepare('INSERT INTO auto_imagenes (auto_id, filename, es_principal, orden) VALUES (?, ?, ?, ?)')
          .run([autoId, file.filename, index === 0 ? 1 : 0, index]);
      });
    }

    // Sync to Git
    gitSync('NUEVO AUTO', `${marca} ${modelo} ${anio}`);

    res.redirect('/admin/autos');
  } catch (err) {
    console.error(err);
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
    const auto = await db.prepare('SELECT * FROM autos WHERE id = ?').get([req.params.id]);
    if (!auto) return res.redirect('/admin/autos');

    const imagenes = await db.prepare('SELECT * FROM auto_imagenes WHERE auto_id = ? ORDER BY es_principal DESC, orden ASC').all([req.params.id]);

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
      transmision, color, puertas, motor, descripcion, condicion, destacado, activo } = req.body;

    await db.prepare(`
      UPDATE autos SET
        marca = ?, modelo = ?, version = ?, anio = ?, precio = ?, moneda = ?,
        kilometraje = ?, combustible = ?, transmision = ?, color = ?, puertas = ?,
        motor = ?, descripcion = ?, condicion = ?, destacado = ?, activo = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run([
      marca, modelo, version || '', parseInt(anio), parseFloat(precio) || 0, moneda || 'USD',
      parseInt(kilometraje) || 0, combustible || 'Nafta', transmision || 'Manual',
      color || '', parseInt(puertas) || 4, motor || '', descripcion || '',
      condicion || 'Usado', destacado ? 1 : 0, activo ? 1 : 0,
      req.params.id
    ]);

    // Add new images
    if (req.files && req.files.length > 0) {
      const existingCount = (await db.prepare('SELECT COUNT(*) as c FROM auto_imagenes WHERE auto_id = ?').get([req.params.id])).c;
      req.files.forEach(async (file, index) => {
        await db.prepare('INSERT INTO auto_imagenes (auto_id, filename, es_principal, orden) VALUES (?, ?, ?, ?)')
          .run([req.params.id, file.filename, existingCount === 0 && index === 0 ? 1 : 0, existingCount + index]);
      });
    }

    // Sync to Git
    gitSync('ACTUALIZAR AUTO', `${marca} ${modelo} ${anio}`);

    res.redirect('/admin/autos');
  } catch (err) {
    console.error(err);
    res.redirect(`/admin/autos/editar/${req.params.id}`);
  }
});

// ── DELETE VEHICLE ──
router.post('/autos/eliminar/:id', requireAuth, async (req, res) => {
  try {
    // Get auto info before deleting
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

    // Sync to Git
    if (auto) {
      gitSync('ELIMINAR AUTO', `${auto.marca} ${auto.modelo} ${auto.anio}`);
    }

    res.redirect('/admin/autos');
  } catch (error) {
    console.error('Error al eliminar auto:', error);
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
    res.redirect('back');
  } catch (error) {
    console.error('Error al eliminar imagen:', error);
    res.redirect('back');
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
    res.redirect('back');
  } catch (error) {
    console.error('Error al cambiar imagen principal:', error);
    res.redirect('back');
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
