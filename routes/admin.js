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
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username);

  if (user && bcrypt.compareSync(password, user.password)) {
    req.session.isAdmin = true;
    req.session.adminUser = user.username;
    return res.redirect('/admin');
  }

  res.render('admin/login', { title: 'Admin Login', error: 'Usuario o contraseña incorrectos' });
});

// ── LOGOUT ──
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin/login');
});

// ── DASHBOARD ──
router.get('/', requireAuth, (req, res) => {
  const totalAutos = db.prepare('SELECT COUNT(*) as count FROM autos').get().count;
  const totalActivos = db.prepare('SELECT COUNT(*) as count FROM autos WHERE activo = 1').get().count;
  const totalDestacados = db.prepare('SELECT COUNT(*) as count FROM autos WHERE destacado = 1').get().count;
  const totalImagenes = db.prepare('SELECT COUNT(*) as count FROM auto_imagenes').get().count;

  const ultimosAutos = db.prepare(`
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
});

// ── LIST ALL VEHICLES ──
router.get('/autos', requireAuth, (req, res) => {
  const { buscar, marca, condicion } = req.query;
  let where = ['1=1'];
  let params = [];

  if (buscar) {
    where.push('(a.marca LIKE ? OR a.modelo LIKE ? OR a.version LIKE ?)');
    params.push(`%${buscar}%`, `%${buscar}%`, `%${buscar}%`);
  }
  if (marca) { where.push('a.marca = ?'); params.push(marca); }
  if (condicion) { where.push('a.condicion = ?'); params.push(condicion); }

  const autos = db.prepare(`
    SELECT a.*,
      (SELECT filename FROM auto_imagenes WHERE auto_id = a.id ORDER BY es_principal DESC LIMIT 1) as imagen,
      (SELECT COUNT(*) FROM auto_imagenes WHERE auto_id = a.id) as total_imagenes
    FROM autos a
    WHERE ${where.join(' AND ')}
    ORDER BY a.created_at DESC
  `).all(...params);

  const marcas = db.prepare('SELECT DISTINCT marca FROM autos ORDER BY marca').all();

  res.render('admin/autos-list', {
    title: 'Gestión de Vehículos',
    autos,
    marcas,
    filtros: req.query
  });
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
router.post('/autos/nuevo', requireAuth, upload.array('imagenes', 20), (req, res) => {
  try {
    const { marca, modelo, version, anio, precio, moneda, kilometraje, combustible,
      transmision, color, puertas, motor, descripcion, condicion, destacado, activo } = req.body;

    const result = db.prepare(`
      INSERT INTO autos (marca, modelo, version, anio, precio, moneda, kilometraje, combustible,
        transmision, color, puertas, motor, descripcion, condicion, destacado, activo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      marca, modelo, version || '', parseInt(anio), parseFloat(precio) || 0, moneda || 'USD',
      parseInt(kilometraje) || 0, combustible || 'Nafta', transmision || 'Manual',
      color || '', parseInt(puertas) || 4, motor || '', descripcion || '',
      condicion || 'Usado', destacado ? 1 : 0, activo ? 1 : 1
    );

    const autoId = result.lastInsertRowid;

    // Save images
    if (req.files && req.files.length > 0) {
      const insertImg = db.prepare('INSERT INTO auto_imagenes (auto_id, filename, es_principal, orden) VALUES (?, ?, ?, ?)');
      req.files.forEach((file, index) => {
        insertImg.run(autoId, file.filename, index === 0 ? 1 : 0, index);
      });
    }

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
router.get('/autos/editar/:id', requireAuth, (req, res) => {
  const auto = db.prepare('SELECT * FROM autos WHERE id = ?').get(req.params.id);
  if (!auto) return res.redirect('/admin/autos');

  const imagenes = db.prepare('SELECT * FROM auto_imagenes WHERE auto_id = ? ORDER BY es_principal DESC, orden ASC').all(req.params.id);

  res.render('admin/auto-form', {
    title: `Editar: ${auto.marca} ${auto.modelo}`,
    auto,
    imagenes,
    error: null
  });
});

// ── EDIT POST ──
router.post('/autos/editar/:id', requireAuth, upload.array('imagenes', 20), (req, res) => {
  try {
    const { marca, modelo, version, anio, precio, moneda, kilometraje, combustible,
      transmision, color, puertas, motor, descripcion, condicion, destacado, activo } = req.body;

    db.prepare(`
      UPDATE autos SET
        marca = ?, modelo = ?, version = ?, anio = ?, precio = ?, moneda = ?,
        kilometraje = ?, combustible = ?, transmision = ?, color = ?, puertas = ?,
        motor = ?, descripcion = ?, condicion = ?, destacado = ?, activo = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      marca, modelo, version || '', parseInt(anio), parseFloat(precio) || 0, moneda || 'USD',
      parseInt(kilometraje) || 0, combustible || 'Nafta', transmision || 'Manual',
      color || '', parseInt(puertas) || 4, motor || '', descripcion || '',
      condicion || 'Usado', destacado ? 1 : 0, activo ? 1 : 0,
      req.params.id
    );

    // Add new images
    if (req.files && req.files.length > 0) {
      const existingCount = db.prepare('SELECT COUNT(*) as c FROM auto_imagenes WHERE auto_id = ?').get(req.params.id).c;
      const insertImg = db.prepare('INSERT INTO auto_imagenes (auto_id, filename, es_principal, orden) VALUES (?, ?, ?, ?)');
      req.files.forEach((file, index) => {
        insertImg.run(req.params.id, file.filename, existingCount === 0 && index === 0 ? 1 : 0, existingCount + index);
      });
    }

    res.redirect('/admin/autos');
  } catch (err) {
    console.error(err);
    res.redirect(`/admin/autos/editar/${req.params.id}`);
  }
});

// ── DELETE VEHICLE ──
router.post('/autos/eliminar/:id', requireAuth, (req, res) => {
  // Delete associated images from disk
  const imagenes = db.prepare('SELECT filename FROM auto_imagenes WHERE auto_id = ?').all(req.params.id);
  imagenes.forEach(img => {
    const filepath = path.join(__dirname, '..', 'public', 'uploads', 'autos', img.filename);
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }
  });

  // Delete from database
  db.prepare('DELETE FROM auto_imagenes WHERE auto_id = ?').run(req.params.id);
  db.prepare('DELETE FROM autos WHERE id = ?').run(req.params.id);

  res.redirect('/admin/autos');
});

// ── DELETE SINGLE IMAGE ──
router.post('/autos/imagen/eliminar/:imgId', requireAuth, (req, res) => {
  const img = db.prepare('SELECT * FROM auto_imagenes WHERE id = ?').get(req.params.imgId);
  if (img) {
    const filepath = path.join(__dirname, '..', 'public', 'uploads', 'autos', img.filename);
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }
    db.prepare('DELETE FROM auto_imagenes WHERE id = ?').run(req.params.imgId);

    // If it was the main image, set the next one as main
    if (img.es_principal) {
      const nextImg = db.prepare('SELECT id FROM auto_imagenes WHERE auto_id = ? ORDER BY orden ASC LIMIT 1').get(img.auto_id);
      if (nextImg) {
        db.prepare('UPDATE auto_imagenes SET es_principal = 1 WHERE id = ?').run(nextImg.id);
      }
    }
  }
  res.redirect('back');
});

// ── SET MAIN IMAGE ──
router.post('/autos/imagen/principal/:imgId', requireAuth, (req, res) => {
  const img = db.prepare('SELECT * FROM auto_imagenes WHERE id = ?').get(req.params.imgId);
  if (img) {
    db.prepare('UPDATE auto_imagenes SET es_principal = 0 WHERE auto_id = ?').run(img.auto_id);
    db.prepare('UPDATE auto_imagenes SET es_principal = 1 WHERE id = ?').run(req.params.imgId);
  }
  res.redirect('back');
});

// ── CHANGE PASSWORD ──
router.get('/config', requireAuth, (req, res) => {
  res.render('admin/config', { title: 'Configuración', success: null, error: null });
});

router.post('/config/password', requireAuth, (req, res) => {
  const { current_password, new_password, confirm_password } = req.body;
  const user = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(req.session.adminUser);

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
  db.prepare('UPDATE admin_users SET password = ? WHERE username = ?').run(hashed, req.session.adminUser);

  res.render('admin/config', { title: 'Configuración', success: 'Contraseña actualizada correctamente', error: null });
});

module.exports = router;
