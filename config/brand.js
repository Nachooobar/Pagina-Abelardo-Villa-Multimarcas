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
      // Mensajes predefinidos
      messages: {
        general: '¡Hola! Me contacto desde la web. Quisiera más información.',
        inventory: 'Hola, vi que aún no tienen vehículos disponibles. ¿Cuándo lanzan el catálogo?',
        vehicleInfo: (vehicleName) => `Hola, vi el ${vehicleName} en la web y quiero más información.`
      }
    },
    phone: '+54-3425-352093',
    email: 'contacto@abelardovilla.com.ar',
    // Google Maps link
    maps: {
      url: 'https://maps.google.com/maps?q=Abelardo+Villa+Multimarcas',
      address: 'Ubicación a definir'
    }
  },
  
  // Redes Sociales
  social: {
    instagram: 'https://instagram.com/abelardo_raul_villa',
    facebook: 'https://www.facebook.com/www.abelardovillautos.com.ar/',
  },

  // SEO Defaults
  seo: {
    baseTitle: 'Abelardo Villa Multimarcas - Concesionaria de Vehículos',
    keywords: 'concesionaria,autos usados, autos, auto, vehículos usados, 0km, multimarcas, autos, financiación',
    ogImage: '/images/og-image.png'
  },

  // Breve Bio / Descripción
  bio: 'Somos una concesionaria multimarcas con más de 40 años en el mercado. Ofrecemos vehículos seleccionados, asesoría personalizada y las mejores opciones de financiación. 100% garantía en todas nuestras unidades.'
};
