// ============================================================
// Configuración de Marca - Abelardo Villa Multimarcas
// Centralización de identidad, contacto y comunicación
// ============================================================

module.exports = {
  // Información de la Empresa
  name: 'Abelardo Villa Multimarcas',
  tagline: 'Vehículos Seleccionados. Garantía Asegurada.',
  description: 'Concesionaria multimarcas oriunda de Santa Fe especializada en vehículos usados y 0km con las mejores opciones de financiación.',

  // Contacto
  contact: {
    whatsapp: {
      number: '5493425352093',
      countryCode: '+54',
      display: '(342) 535-2093',
      // Mensajes predefinidos
      messages: {
        general: '¡Hola! Me contacto desde la web de Abelardo Villa Multimarcas. Quisiera más información.',
        inventory: 'Hola, vi que aún no tienen vehículos disponibles. ¿Cuándo lanzan el catálogo?',
        vehicleInfo: (vehicleName) => `Hola, vi el ${vehicleName} en la web y quiero más información.`
      }
    },
    phone: '(342) 535-2093',
    phoneRaw: '+5493425352093',
    email: 'abelardoraul_villa@hotmail.com',
    // Horarios
    schedule: {
      weekdays: 'Lunes a Viernes: 10:00 a 19:00 hs',
      weekends: 'Sábados y Domingos: Cerrado',
      compact: 'Lun a Vie 10:00 - 19:00 hs'
    },
    // Google Maps link
    maps: {
      url: 'https://maps.app.goo.gl/WR7Adumr4MafSjJX9',
      address: 'Ruta 1 KM 5.5, Rincón, Santa Fe, Argentina'
    }
  },

  // Redes Sociales
  social: {
    instagram: 'https://instagram.com/abelardo_raul_villa',
    instagramHandle: '@abelardo_raul_villa',
    facebook: 'https://www.facebook.com/www.abelardovillautos.com.ar/',
  },

  // SEO Defaults
  seo: {
    baseTitle: 'Abelardo Villa Multimarcas - Autos Usados Seleccionados y 0km',
    defaultDescription: 'Concesionaria multimarca en Rincón, Santa Fe. Más de 40 años de trayectoria ofreciendo vehículos usados seleccionados y 0km con la mejor financiación y garantía.',
    keywords: 'concesionaria, autos usados, autos, auto, vehículos usados, 0km, multimarcas, Santa Fe, Rincón, financiación, permutas, Abelardo Villa',
    ogImage: '/images/logo.png',
    themeColor: '#0E1116'
  },

  // Breve Bio / Descripción
  bio: 'Concesionaria familiar con más de 40 años de trayectoria en Rincón y Santa Fe. Especialistas en vehículos usados seleccionados y 0km, con garantía, tasación justa y financiación a tu medida.'
};
