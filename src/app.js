// =============================================================
// app.js — arma el servidor web (Express)
// Solo la carpeta public/ es visible desde internet. El código del
// servidor (src/), el .env y la base de datos nunca se publican.
// =============================================================
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const rutasVehiculos = require('./routes/vehiculos');
const rutasAdmin = require('./routes/admin');
const paginas = require('./routes/paginas');
const { URL_SITIO } = require('./sitio');

const PUBLICO = path.join(__dirname, '..', 'public');

function crearApp() {
  const app = express();
  const produccion = process.env.NODE_ENV === 'production';

  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback'); // Nginx está delante, en la misma máquina

  // Una sola dirección para Google: www.diegorodriguezautos.com -> diegorodriguezautos.com
  const hostCanonico = new URL(URL_SITIO).hostname;
  app.use((req, res, next) => {
    if (req.hostname === `www.${hostCanonico}`) {
      // Destino fijo (URL_SITIO) + ruta: no se puede usar para redirigir a otro sitio
      return res.redirect(301, URL_SITIO + req.originalUrl.replace(/^\/+/, '/'));
    }
    next();
  });

  // Cabeceras de seguridad. La CSP le dice al navegador que solo ejecute
  // scripts y estilos de este dominio: aunque alguien lograra meter
  // <script> en un dato, el navegador se negaría a ejecutarlo.
  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'https:'], // fotos desde Google Drive u otro https
        frameSrc: ['https://www.google.com'], // solo el mapa de Google Maps
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        ...(produccion ? { upgradeInsecureRequests: [] } : {}),
      },
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  }));

  app.use('/api', express.json({ limit: '50kb' }));
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.use('/api/vehiculos', rutasVehiculos);
  app.use('/api/admin', (req, res, next) => {
    res.set('X-Robots-Tag', 'noindex, nofollow');
    next();
  });
  app.use('/api/admin', rutasAdmin);
  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
  });

  app.get('/admin', (req, res) => {
    res.set('X-Robots-Tag', 'noindex, nofollow');
    res.sendFile(path.join(PUBLICO, 'admin.html'));
  });
  app.use(paginas.router);
  app.use(express.static(PUBLICO, {
    dotfiles: 'deny',
    setHeaders(res, ruta) {
      // Imágenes: 7 días en caché; CSS/JS: 1 hora; HTML: siempre revisar
      if (/[\\/]img[\\/]/.test(ruta)) res.set('Cache-Control', 'public, max-age=604800');
      else if (/\.(css|js)$/.test(ruta)) res.set('Cache-Control', 'public, max-age=3600');
      else res.set('Cache-Control', 'no-cache');
    },
  }));

  app.use((req, res) => {
    paginas.enviarHtml(res, paginas.paginaNoEncontrada(), 404);
  });

  // Nunca se manda al navegador el detalle del error (podría revelar SQL)
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido' });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Datos demasiado grandes' });
    if (err.status === 403 || err.status === 404) return paginas.enviarHtml(res, paginas.paginaNoEncontrada(), 404);
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
  });

  return app;
}

module.exports = crearApp;
