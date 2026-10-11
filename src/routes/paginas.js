// =============================================================
// Páginas que arma el servidor (para Google y para compartir):
//   GET /autos/:id-:slug          ficha de un vehículo
//   GET /aviso-de-privacidad      aviso de privacidad
//   GET /sitemap.xml              mapa del sitio para Google
// =============================================================
const fs = require('fs');
const path = require('path');
const express = require('express');
const vehiculos = require('../vehiculos');
const { parsearId } = require('../validacion');
const { URL_SITIO, NEGOCIO, rutaAuto } = require('../sitio');
const { esc } = require('../paginas/html');
const { pagina } = require('../paginas/layout');
const { paginaAuto } = require('../paginas/auto');

const router = express.Router();

const AVISO = fs.readFileSync(path.join(__dirname, '..', 'paginas', 'aviso-de-privacidad.html'), 'utf8')
  .replace(/<!--[\s\S]*?-->/, '');

function enviarHtml(res, html, status = 200) {
  res.status(status).set('Cache-Control', 'no-cache').type('html').send(html);
}

function paginaNoEncontrada() {
  return pagina({
    titulo: `Página no encontrada | ${NEGOCIO.nombre}`,
    descripcion: 'La página que buscas no existe o el vehículo ya se vendió.',
    noindex: true,
    contenido: `
  <main class="contenedor legal">
    <h1>No encontramos esta página</h1>
    <p>Puede que el vehículo ya se haya vendido o que el enlace esté incompleto.</p>
    <p><a class="boton" href="/#inventario">Ver inventario disponible</a></p>
  </main>`,
  });
}

router.get('/autos/:param', async (req, res) => {
  const m = /^(\d{1,10})(?:-[a-z0-9-]*)?$/.exec(req.params.param);
  const id = m && parsearId(m[1]);
  const vehiculo = id ? await vehiculos.obtenerPublico(id) : null;
  if (!vehiculo) return enviarHtml(res, paginaNoEncontrada(), 404);
  // Una sola dirección por auto: si el texto no coincide, redirige a la buena
  const canonica = rutaAuto(vehiculo);
  if (req.path !== canonica) return res.redirect(301, canonica);
  enviarHtml(res, paginaAuto(vehiculo));
});

router.get('/aviso-de-privacidad', (req, res) => {
  enviarHtml(res, pagina({
    titulo: `Aviso de privacidad | ${NEGOCIO.nombre}`,
    descripcion: `Aviso de privacidad integral de ${NEGOCIO.asesor}, asesor BYD y Chevrolet en ${NEGOCIO.ciudad}, ${NEGOCIO.estadoCorto}: qué datos tratamos, para qué y cómo ejercer tus derechos ARCO.`,
    ruta: '/aviso-de-privacidad',
    contenido: AVISO,
  }));
});

router.get(['/privacidad', '/aviso-privacidad'], (req, res) => res.redirect(301, '/aviso-de-privacidad'));

router.get('/sitemap.xml', async (req, res) => {
  const autos = await vehiculos.listarParaSitemap();
  const fecha = (d) => new Date(d).toISOString().slice(0, 10);
  const ultima = autos.reduce((max, a) => (a.actualizado_en > max ? a.actualizado_en : max), new Date(0));
  const urls = [
    { loc: `${URL_SITIO}/`, lastmod: autos.length ? fecha(ultima) : null },
    ...autos.map((a) => ({ loc: URL_SITIO + rutaAuto(a), lastmod: fecha(a.actualizado_en) })),
    { loc: `${URL_SITIO}/aviso-de-privacidad`, lastmod: null },
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`).join('\n')}
</urlset>
`;
  res.set('Cache-Control', 'public, max-age=3600').type('application/xml').send(xml);
});

module.exports = { router, paginaNoEncontrada, enviarHtml };
