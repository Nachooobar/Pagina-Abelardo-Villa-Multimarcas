# Abelardo Villa Multimarcas - Guía de Modernización

## 📋 Resumen de Cambios

Este documento detalla la modernización del sitio bajo un esquema **Minimalista Tecnológico** (Black & White con acentos modernos en azul eléctrico).

---

## 🎨 Estética Visual

### Paleta de Colores
- **Fondo Principal**: `#0f0f0f` (Negro casi puro)
- **Texto Primario**: `#ffffff` (Blanco hueso)
- **Texto Secundario**: `#b3b3b3` (Gris claro)
- **Acento Principal**: `#00a8ff` (Azul Eléctrico) ← **IMPORTANTE**
- **Acento Secundario**: `#00d4ff` (Azul Claro)
- **Acento Alternativo**: `#ff0080` (Rosa Neón - opcional)

### Variables CSS Disponibles
```css
--primary: #000000
--accent: #00a8ff           /* Botones, enlaces, highlight */
--accent-secondary: #ff0080 /* CTA alternativo */
--accent-subtle: #00d4ff    /* Hover states */
--bg-dark: #0f0f0f
--text-primary: #ffffff
--text-secondary: #b3b3b3
--text-tertiary: #808080
```

---

## ⚙️ Configuración de Marca

### Archivo: `config/brand.js`

Este archivo centraliza toda la información de identidad de marca. **Edítalo directamente** para cambiar:

```javascript
module.exports = {
  name: 'Abelardo Villa Multimarcas',           // Nombre empresa
  tagline: 'Vehículos Seleccionados...',        // Eslogan
  description: 'Concesionaria multimarcas...', // Descripción larga
  bio: 'Somos una concesionaria...',             // Biografía corta
  
  contact: {
    whatsapp: {
      number: '5493425352093',                   // SIN + ni código país
      messages: {
        general: 'Hola! Me contacto...',
        vehicleInfo: (name) => `Hola, vi ${name}...`
      }
    },
    phone: '+54-3425-352093',
    email: 'contacto@abelardovilla.com.ar',
    maps: {
      url: 'https://maps.google.com/...',
      address: 'Ubicación a definir'
    }
  },
  
  social: {
    instagram: 'https://instagram.com/...',
    facebook: 'https://facebook.com/...',
  }
}
```

✅ **Los cambios aquí se reflejan automáticamente en:**
- Navbar
- Footer
- Meta tags (OpenGraph)
- Enlaces de WhatsApp dinámicos

---

## 🔗 Helpers de WhatsApp Dinámicos

### En Templates (EJS)

```ejs
<!-- Link de WhatsApp general -->
<a href="<%= getWhatsAppLink() %>">Contactar</a>

<!-- Link específico para un vehículo -->
<a href="<%= getWhatsAppLink('Toyota Corolla 2022') %>">Consultar</a>

<!-- Link para Coming Soon (inventario vacío) -->
<a href="<%= getWhatsAppComingSoon() %>">Notificarme</a>
```

### Funcionamiento
- Genera URL de WhatsApp automáticamente con el mensaje
- Codifica el mensaje en URL safe
- Número se obtiene de `config/brand.js`
- Disponible en TODAS las vistas sin importación extra

---

## 📱 Estado "Coming Soon"

### Cómo Funciona

El sitio **detecta automáticamente** si hay vehículos en el inventario:

1. **Middleware Global** (en `server.js`):
   ```javascript
   res.locals.inventoryStatus  // 'coming_soon' o 'available'
   res.locals.hasInventory     // boolean
   res.locals.totalInventoryCount  // número
   ```

2. **Vista index.ejs**:
   - Si `inventoryStatus === 'coming_soon'`: Muestra bloque elegante
   - Si hay inventario: Muestra catálogo normal

3. **Mensaje Personalizado**:
   ```
   "Nuestra selección exclusiva está entrando a pista.
    Contactanos para preventas personalizadas."
   ```

### Cómo Habilitar/Deshabilitar

**Opción 1: Agregar vehículos a BD**
```sql
INSERT INTO autos (marca, modelo, ..., activo) VALUES (..., 1);
```

**Opción 2: Forzar estado (desarrollo)**
Edita `server.js` en el middleware de inventario:
```javascript
// Para testing, comentar esta línea y descomentar abajo
res.locals.inventoryStatus = inventoryCount.count === 0 ? 'coming_soon' : 'available';
// res.locals.inventoryStatus = 'coming_soon'; // Forzar coming soon
```

---

## 🎯 SEO Dinámico

### Meta Tags Automáticos

Cada página genera dinámicamente:
- `<title>` - Título dinámico
- `<meta name="description">` - Descripción
- `<meta property="og:title">` - OpenGraph
- `<meta property="og:image">` - Imagen compartida

### En Rutas

```javascript
res.render('catalogo', {
  seoTitle: 'Catálogo de Vehículos - ' + brand.name,
  seoDescription: 'Explora nuestro catálogo con ' + totalAutos + ' vehículos...'
});
```

Si no especificas `seoTitle`, usa el default de `config/brand.js`.

---

## 📦 Estructura de Archivos Modificados

```
config/
├── brand.js ..................... ✨ NUEVO - Centralización de marca
└── database.js .................. (sin cambios)

server.js ........................ ✅ Actualizado con 3 middlewares

public/css/
└── style.css .................... ✅ Modernizado - Paleta minimalista

views/
├── index.ejs .................... ✅ Coming soon + dinámico
├── partials/
│   ├── header.ejs ............... ✅ Meta tags + brand inyectado
│   └── footer.ejs ............... ✅ Dinámico con brand
└── ... (otras vistas sin cambios)

routes/ .......................... ✅ Sin cambios
```

---

## 🚀 Personalización Avanzada

### Cambiar Acento Principal

En `public/css/style.css`, actualiza `:root`:
```css
--accent: #00a8ff;           /* Cambiar aquí */
--accent-secondary: #ff0080;
--accent-subtle: #00d4ff;
```

Esto afecta:
- Botones
- Enlaces
- Highlight de texto
- Badges
- Borders en hover

### Cambiar Tipografía

En `public/css/style.css`:
```css
@import url('https://fonts.googleapis.com/css2?family=...');

body {
  font-family: '...', sans-serif;  /* Cambiar aquí */
}
```

### Agregar Animaciones

```css
.hero-badge {
  animation: fadeInUp 0.8s ease-out;  /* Ejemplo */
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

---

## ✅ Checklist de Validación

- [x] Servidor inicia sin errores
- [x] Base de datos conecta
- [x] Rutas cargan correctamente
- [x] Brand config inyectado en res.locals
- [x] WhatsApp helpers disponibles
- [x] Coming soon state detecta inventario
- [x] CSS moderno aplicado
- [x] Meta tags dinámicos
- [x] Footer dinámico

---

## 🔧 Troubleshooting

### El WhatsApp link no funciona
✓ Verificar número en `config/brand.js` (sin + ni espacios)
✓ En templates, usar `<%= getWhatsAppLink() %>` (con <%=)
✓ Chrome: Si abre en nueva pestaña, está bien

### Coming soon no aparece
✓ Verificar BD tiene tabla `autos` sin registros
✓ O está `activo = 0` para todos
✓ Refrescar página (F5)

### Estilos no aplican
✓ Limpiar cache del navegador (Ctrl+Shift+Del)
✓ Verificar archivo CSS guarda cambios
✓ Dev tools > Elements: verificar classes

---

## 📞 Contacto y Soporte

Para personalización adicional, edita directamente:
1. `config/brand.js` - Identidad
2. `public/css/style.css` - Estilos
3. `views/` - Contenido visual

¡Todo está comentado y es fácil de mantener! 🎉

---

**Versión**: 1.0.0 | **Última actualización**: Mayo 2026
