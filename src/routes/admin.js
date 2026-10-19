// =============================================================
// Rutas del administrador (todas requieren sesión, menos login)
//   POST   /api/admin/login
//   POST   /api/admin/logout
//   GET    /api/admin/sesion
//   POST   /api/admin/contrasena   (cambiar la propia contraseña)
//   GET    /api/admin/vehiculos
//   POST   /api/admin/vehiculos
//   PUT    /api/admin/vehiculos/:id
//   DELETE /api/admin/vehiculos/:id
//   POST   /api/admin/imagenes/previsualizar
// =============================================================
const express = require('express');
const auth = require('../auth');
const vehiculos = require('../vehiculos');
const { parsearId, validarVehiculo, normalizarUrlImagen, MAX_IMAGENES } = require('../validacion');

const router = express.Router();

router.use(auth.soloMismoOrigen);

router.post('/login', auth.limitarIntentos, async (req, res) => {
  if (!auth.secreto()) {
    return res.status(503).json({ error: 'El administrador no está configurado en el servidor' });
  }
  const { usuario, password } = req.body || {};
  const valido = typeof usuario === 'string' && typeof password === 'string'
    && usuario.length <= 100 && password.length <= 200
    ? await auth.autenticar(usuario, password) : null;
  if (!valido) {
    auth.registrarFallo(req.ip);
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  }
  auth.limpiarFallos(req.ip);
  auth.crearSesion(res, valido);
  res.json({ ok: true, usuario: valido });
});

router.post('/logout', (req, res) => {
  auth.cerrarSesion(res);
  res.json({ ok: true });
});

router.use(auth.requiereSesion);

router.get('/sesion', (req, res) => {
  res.json({ ok: true, usuario: req.admin });
});

// Cada quien cambia SU contraseña; se pide la actual (por si dejó la sesión abierta)
router.post('/contrasena', auth.limitarIntentos, async (req, res) => {
  const { actual, nueva } = req.body || {};
  if (typeof actual !== 'string' || typeof nueva !== 'string' || actual.length > 200 || nueva.length > 200) {
    return res.status(400).json({ error: 'Datos inválidos' });
  }
  const error = await auth.cambiarPassword(req.admin, actual, nueva);
  if (error) {
    if (error.startsWith('La contraseña actual')) auth.registrarFallo(req.ip);
    return res.status(400).json({ error });
  }
  auth.limpiarFallos(req.ip);
  auth.crearSesion(res, req.admin); // este dispositivo sigue dentro; los demás deben volver a entrar
  res.json({ ok: true });
});

router.get('/vehiculos', async (req, res) => {
  res.json(await vehiculos.listarTodos());
});

router.post('/vehiculos', async (req, res) => {
  const { datos, errores } = validarVehiculo(req.body);
  if (errores) return res.status(400).json({ error: 'Datos inválidos', detalles: errores });
  const id = await vehiculos.crear(datos);
  res.status(201).json({ id });
});

router.put('/vehiculos/:id', async (req, res) => {
  const id = parsearId(req.params.id);
  if (!id) return res.status(404).json({ error: 'Vehículo no encontrado' });
  const { datos, errores } = validarVehiculo(req.body);
  if (errores) return res.status(400).json({ error: 'Datos inválidos', detalles: errores });
  if (!(await vehiculos.actualizar(id, datos))) {
    return res.status(404).json({ error: 'Vehículo no encontrado' });
  }
  res.json({ id });
});

router.delete('/vehiculos/:id', async (req, res) => {
  const id = parsearId(req.params.id);
  if (!id) return res.status(404).json({ error: 'Vehículo no encontrado' });
  try {
    if (!(await vehiculos.eliminar(id))) {
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }
  } catch (err) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({
        error: 'Este vehículo tiene una venta registrada. Márcalo como "vendido" en lugar de borrarlo.',
      });
    }
    throw err;
  }
  res.status(204).end();
});

// Revisa los enlaces antes de guardar, para mostrar la vista previa
router.post('/imagenes/previsualizar', (req, res) => {
  const urls = req.body && req.body.urls;
  if (!Array.isArray(urls) || urls.length > MAX_IMAGENES) {
    return res.status(400).json({ error: `Envía una lista de hasta ${MAX_IMAGENES} enlaces` });
  }
  res.json(urls.map((entrada) => normalizarUrlImagen(entrada)));
});

module.exports = router;
