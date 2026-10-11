// =============================================================
// layout.js — esqueleto HTML de las páginas que arma el servidor
// (ficha de cada auto, aviso de privacidad, 404).
// El encabezado y el pie son los mismos que en public/index.html:
// si cambias uno, cambia el otro.
// =============================================================
const { esc, jsonSeguro } = require('./html');
const { URL_SITIO, NEGOCIO } = require('../sitio');

function encabezado() {
  return `
  <header class="sitio">
    <div class="contenedor barra">
      <a class="logo" href="/" aria-label="Inicio">
        <picture>
          <source srcset="/img/logo-byd-chevrolet.webp" type="image/webp">
          <img src="/img/logo-byd-chevrolet.png" alt="BYD | Chevrolet" width="580" height="125">
        </picture>
      </a>
      <nav>
        <a href="/#inventario">Inventario</a>
        <a href="/#ubicacion">Ubicación</a>
        <a class="boton-llamar" href="tel:${NEGOCIO.telefono}">Llamar</a>
      </nav>
    </div>
  </header>`;
}

function pie() {
  return `
  <footer class="sitio">
    <div class="contenedor pie">
      <picture>
        <source srcset="/img/logo-byd-chevrolet.webp" type="image/webp">
        <img class="pie-logo" src="/img/logo-byd-chevrolet.png" alt="BYD | Chevrolet" width="580" height="125" loading="lazy">
      </picture>
      <div>
        <p class="oro">Seguimos avanzando contigo.</p>
        <p>${esc(NEGOCIO.calle)}, C.P. ${esc(NEGOCIO.cp)}, ${esc(NEGOCIO.ciudad)}, ${esc(NEGOCIO.estadoCorto)}, México</p>
        <p>${esc(NEGOCIO.asesor)} · Asesor Digital · <a href="tel:${NEGOCIO.telefono}">${esc(NEGOCIO.telefonoVisible)}</a></p>
        <p><a href="/aviso-de-privacidad">Aviso de privacidad</a></p>
      </div>
    </div>
  </footer>`;
}

/**
 * @param {object} p
 * @param {string} p.titulo        <title> (texto plano, se escapa aquí)
 * @param {string} p.descripcion   meta description (texto plano)
 * @param {string} [p.ruta]        ruta canónica, ej. "/autos/1-nissan-versa-2021"
 * @param {string} [p.imagen]      imagen para compartir (URL absoluta)
 * @param {object[]} [p.jsonLd]    datos estructurados schema.org
 * @param {boolean} [p.noindex]    true para que Google no la indexe (404)
 * @param {string} p.contenido     HTML del <main> (YA escapado por quien lo arma)
 */
function pagina({ titulo, descripcion, ruta, imagen, jsonLd = [], noindex = false, contenido }) {
  const canonica = ruta ? URL_SITIO + ruta : null;
  const img = imagen || `${URL_SITIO}/img/compartir.jpg`;
  return `<!DOCTYPE html>
<html lang="es-MX">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(titulo)}</title>
  <meta name="description" content="${esc(descripcion)}">
  <meta name="robots" content="${noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large'}">
  ${canonica ? `<link rel="canonical" href="${esc(canonica)}">` : ''}
  <meta name="theme-color" content="#050608">
  <link rel="icon" type="image/png" href="/img/favicon.png">
  <link rel="apple-touch-icon" href="/img/apple-touch-icon.png">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="es_MX">
  <meta property="og:site_name" content="${esc(NEGOCIO.nombre)}">
  ${canonica ? `<meta property="og:url" content="${esc(canonica)}">` : ''}
  <meta property="og:title" content="${esc(titulo)}">
  <meta property="og:description" content="${esc(descripcion)}">
  <meta property="og:image" content="${esc(img)}">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="stylesheet" href="/css/styles.css">
  ${jsonLd.map((d) => `<script type="application/ld+json">${jsonSeguro(d)}</script>`).join('\n  ')}
</head>
<body>
${encabezado()}
${contenido}
${pie()}
</body>
</html>`;
}

module.exports = { pagina };
