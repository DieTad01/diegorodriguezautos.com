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

const PUBLICO = path.join(__dirname, '..', 'public');

function crearApp() {
  const app = express();
  const produccion = process.env.NODE_ENV === 'production';

  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback'); // Nginx está delante, en la misma máquina

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
  app.use('/api/admin', rutasAdmin);
  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
  });

  app.get('/admin', (req, res) => {
    res.set('X-Robots-Tag', 'noindex, nofollow');
    res.sendFile(path.join(PUBLICO, 'admin.html'));
  });
  app.use(express.static(PUBLICO, { dotfiles: 'deny' }));

  app.use((req, res) => {
    res.status(404).type('text').send('No encontrado');
  });

  // Nunca se manda al navegador el detalle del error (podría revelar SQL)
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido' });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Datos demasiado grandes' });
    if (err.status === 403 || err.status === 404) return res.status(404).type('text').send('No encontrado');
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
  });

  return app;
}

module.exports = crearApp;
