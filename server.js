// =============================================================
// server.js — punto de entrada: carga el .env y arranca el servidor
//   npm start   (en el VPS lo arranca PM2)
// =============================================================
require('dotenv').config({ quiet: true });

const crearApp = require('./src/app');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';

crearApp().listen(PORT, HOST, () => {
  console.log(`Servidor escuchando en http://${HOST}:${PORT}`);
});
