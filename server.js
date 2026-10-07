// =============================================================
// server.js — servidor para correr el proyecto en un VPS
// En Vercel no se usa: Vercel ya convierte /api en URLs solo.
// Aquí hacemos lo mismo con Express:
//   api/vehiculos.js  ->  https://diegorodriguezautos.com/api/vehiculos
// =============================================================
require('dotenv').config({ quiet: true });

const fs = require('fs');
const path = require('path');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';

app.disable('x-powered-by');
app.set('trust proxy', 'loopback'); // Nginx está delante, en la misma máquina
app.use(express.json());

// Cada archivo de /api se vuelve una ruta, igual que en Vercel
const apiDir = path.join(__dirname, 'api');
for (const archivo of fs.readdirSync(apiDir)) {
  if (!archivo.endsWith('.js')) continue;
  const handler = require(path.join(apiDir, archivo));
  app.all(`/api/${path.basename(archivo, '.js')}`, async (req, res, next) => {
    try {
      await handler(req, res);
    } catch (err) {
      next(err);
    }
  });
}

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Solo se publican el HTML, css/ y js/. Nunca la raíz del proyecto,
// para que no se puedan descargar .env, lib/, package.json, etc.
const estaticos = { dotfiles: 'deny', index: false };
app.use('/css', express.static(path.join(__dirname, 'css'), estaticos));
app.use('/js', express.static(path.join(__dirname, 'js'), estaticos));
app.get(['/', '/index.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.use((req, res) => {
  res.status(404).send('No encontrado');
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(PORT, HOST, () => {
  console.log(`Servidor escuchando en http://${HOST}:${PORT}`);
});
