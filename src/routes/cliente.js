// =============================================================
// Rutas de "Mi cuenta" para los clientes (compradores)
//   POST /api/cliente/login        correo + contraseña
//   POST /api/cliente/logout
//   GET  /api/cliente/estado       mis datos, compras (con saldo) y pagos
//   POST /api/cliente/contrasena   cambiar mi contraseña
// Todo es de SOLO LECTURA salvo la propia contraseña. El cliente_id
// de cada consulta sale de la sesión (req.clienteId), nunca del request.
// =============================================================
const express = require('express');
const auth = require('../auth');
const cuentas = require('../clientes-auth');
const pool = require('../db');

const router = express.Router();

router.use(auth.soloMismoOrigen);

router.post('/login', auth.limitarIntentos, async (req, res) => {
  if (!auth.secreto()) return res.status(503).json({ error: 'El acceso no está configurado en el servidor' });
  const { email, password } = req.body || {};
  const id = typeof email === 'string' && typeof password === 'string'
    && email.length <= 120 && password.length <= 200 && email.includes('@')
    ? await cuentas.autenticarCliente(email.trim(), password) : null;
  if (!id) {
    auth.registrarFallo(req.ip);
    return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
  }
  auth.limpiarFallos(req.ip);
  cuentas.crearSesionCliente(res, id);
  res.json({ ok: true });
});

router.post('/logout', (req, res) => {
  cuentas.cerrarSesionCliente(res);
  res.json({ ok: true });
});

router.use(cuentas.requiereCliente);

router.get('/estado', async (req, res) => {
  const id = req.clienteId;
  const [[cliente]] = await pool.execute('SELECT nombre, email FROM clientes WHERE id = ?', [id]);
  const [compras] = await pool.execute(
    `SELECT v.id AS venta, a.marca, a.modelo, a.anio, a.version, DATE_FORMAT(v.fecha, '%Y-%m-%d') AS fecha, v.precio_final,
            COALESCE(SUM(p.monto), 0) AS pagado
     FROM ventas v
     JOIN vehiculos a ON a.id = v.vehiculo_id
     LEFT JOIN pagos p ON p.venta_id = v.id
     WHERE v.cliente_id = ?
     GROUP BY v.id, a.marca, a.modelo, a.anio, a.version, v.fecha, v.precio_final
     ORDER BY v.fecha DESC, v.id DESC`,
    [id],
  );
  const [pagos] = await pool.execute(
    `SELECT p.venta_id AS venta, DATE_FORMAT(p.fecha, '%Y-%m-%d') AS fecha, p.monto, p.metodo
     FROM pagos p
     JOIN ventas v ON v.id = p.venta_id
     WHERE v.cliente_id = ?
     ORDER BY p.fecha DESC, p.id DESC`,
    [id],
  );
  res.json({
    cliente,
    compras: compras.map((c) => ({
      ...c,
      pagado: Number(c.pagado),
      saldo: Math.round((Number(c.precio_final) - Number(c.pagado)) * 100) / 100,
    })),
    pagos,
  });
});

router.post('/contrasena', auth.limitarIntentos, async (req, res) => {
  const { actual, nueva } = req.body || {};
  if (typeof actual !== 'string' || typeof nueva !== 'string' || actual.length > 200 || nueva.length > 200) {
    return res.status(400).json({ error: 'Datos inválidos' });
  }
  const error = await cuentas.cambiarPasswordCliente(req.clienteId, actual, nueva);
  if (error) {
    if (error.startsWith('La contraseña actual')) auth.registrarFallo(req.ip);
    return res.status(400).json({ error });
  }
  auth.limpiarFallos(req.ip);
  cuentas.crearSesionCliente(res, req.clienteId); // este dispositivo sigue dentro
  res.json({ ok: true });
});

module.exports = router;
