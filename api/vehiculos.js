// =============================================================
// /api/vehiculos — puente entre el navegador y la base de datos
// Vercel convierte cada archivo de /api en una URL:
//   api/vehiculos.js  ->  https://tu-proyecto.vercel.app/api/vehiculos
// =============================================================
// const pool = require('../lib/db');

module.exports = async (req, res) => {
  // TODO: haz un SELECT con pool.query(...)
  // TODO: responde con res.status(200).json(filas)
  // TODO: si algo falla, responde con res.status(500).json({ error: '...' })

  res.status(200).json({ mensaje: 'API funcionando' });
};
