// =============================================================
// sitio.js — datos del sitio que se repiten en varias páginas
// (y en los datos estructurados que lee Google)
// =============================================================

const URL_SITIO = (process.env.SITIO_URL || 'https://diegorodriguezautos.com').replace(/\/+$/, '');

const NEGOCIO = {
  nombre: 'Diego Rodríguez · Asesor BYD y Chevrolet',
  asesor: 'Diego Rodríguez',
  telefono: '+524777321263',
  telefonoVisible: '477 732 12 63',
  calle: 'Blvd. Adolfo López Mateos 3431 Ote.',
  colonia: '',
  cp: '37530',
  ciudad: 'León',
  estado: 'Guanajuato',
  estadoCorto: 'Gto.',
  pais: 'MX',
  marcas: ['BYD', 'Chevrolet'],
  mapa: 'https://www.google.com/maps/search/?api=1&query=Blvd.+Adolfo+L%C3%B3pez+Mateos+3431+Oriente%2C+37530+Le%C3%B3n%2C+Gto.%2C+M%C3%A9xico',
};

// "Nissan Versa 2021" -> "nissan-versa-2021" (sin acentos ni símbolos)
function slug(texto) {
  return String(texto)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '');
}

// Dirección de la ficha de un auto: /autos/12-nissan-versa-2021
function rutaAuto(v) {
  const s = slug(`${v.marca} ${v.modelo} ${v.anio}`);
  return s ? `/autos/${v.id}-${s}` : `/autos/${v.id}`;
}

module.exports = { URL_SITIO, NEGOCIO, slug, rutaAuto };
