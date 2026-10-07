// =============================================================
// Rutas públicas: el inventario que ve cualquier visitante
//   GET /api/vehiculos?q=texto   -> lista (sin los vendidos)
//   GET /api/vehiculos/:id       -> un vehículo
// =============================================================
const express = require('express');
const vehiculos = require('../vehiculos');
const { limpiarTexto, parsearId } = require('../validacion');

const router = express.Router();

router.get('/', async (req, res) => {
  const q = req.query.q;
  if (q !== undefined && typeof q !== 'string') {
    return res.status(400).json({ error: 'Búsqueda inválida' });
  }
  const busqueda = q ? limpiarTexto(q).slice(0, 80) : '';
  res.json(await vehiculos.listarPublicos({ busqueda }));
});

router.get('/:id', async (req, res) => {
  const id = parsearId(req.params.id);
  if (!id) return res.status(404).json({ error: 'Vehículo no encontrado' });
  const vehiculo = await vehiculos.obtenerPublico(id);
  if (!vehiculo) return res.status(404).json({ error: 'Vehículo no encontrado' });
  res.json(vehiculo);
});

module.exports = router;
