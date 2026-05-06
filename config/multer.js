// ============================================================
// Configuración de Multer para subida de imágenes
// ============================================================

const multer = require('multer');
const path = require('path');

const fs = require('fs');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Si hay una ruta en .env se usa esa (útil en Hostinger para evitar borrados), de lo contrario la local
    const uploadPath = process.env.UPLOAD_PATH || path.join(__dirname, '..', 'public', 'uploads', 'autos');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `auto-${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp|gif/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten imágenes (JPG, PNG, WebP, GIF)'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB max
});

module.exports = upload;
