// =============================================================
// clientes-auth.js — inicio de sesión de los CLIENTES (compradores)
// en "Mi cuenta". Es independiente del panel /admin:
// - Otra tabla (clientes), otra cookie (sesion_cliente) y otra firma
//   (prefijo "cliente."): una sesión de cliente nunca sirve en /admin
//   ni una de administrador aquí.
// - El cliente se identifica con su correo; la contraseña se guarda
//   solo como huella scrypt (igual que la de los administradores).
// - El id del cliente sale SIEMPRE de la cookie firmada, nunca de la
//   URL ni del formulario: así nadie puede ver las compras de otro.
// =============================================================
const crypto = require('crypto');
const auth = require('./auth');

const COOKIE = 'sesion_cliente';

const pool = () => require('./db');

// Devuelve el id del cliente si correo + contraseña son correctos; si no, null
async function autenticarCliente(email, password) {
  const [filas] = await pool().execute(
    'SELECT id, password_hash FROM clientes WHERE email = ?',
    [email],
  );
  const fila = filas[0];
  // Sin cuenta o sin acceso: se calcula igual una huella para tardar lo mismo
  if (!fila || !fila.password_hash) {
    auth.verificarRelleno(password);
    return null;
  }
  if (!auth.verificarPassword(password, fila.password_hash)) return null;
  await pool().execute('UPDATE clientes SET ultimo_acceso = NOW() WHERE id = ?', [fila.id]);
  return fila.id;
}

// ---------- Cookie: id.emitida.firma ----------

function firmar(id, emitida, clave) {
  return crypto.createHmac('sha256', clave).update(`cliente.${id}.${emitida}`).digest('base64url');
}

function crearSesionCliente(res, id) {
  const emitida = Date.now();
  res.cookie(COOKIE, `${id}.${emitida}.${firmar(id, emitida, auth.secreto())}`, auth.opcionesCookie(auth.DURACION_MS));
}

function cerrarSesionCliente(res) {
  res.clearCookie(COOKIE, auth.opcionesCookie());
}

// Devuelve el id del cliente de una sesión válida, o null
async function clienteDe(req) {
  const clave = auth.secreto();
  const valor = auth.leerCookie(req, COOKIE);
  if (!clave || !valor) return null;
  const partes = valor.split('.');
  if (partes.length !== 3) return null;
  const [id, emitida, firma] = partes;
  if (!/^[1-9]\d{0,9}$/.test(id) || !/^\d{13}$/.test(emitida)) return null;
  const esperada = Buffer.from(firmar(id, emitida, clave));
  const recibida = Buffer.from(firma);
  if (esperada.length !== recibida.length || !crypto.timingSafeEqual(esperada, recibida)) return null;
  const ahora = Date.now();
  if (Number(emitida) + auth.DURACION_MS < ahora || Number(emitida) > ahora + 60000) return null;

  // Si se le quitó el acceso, se borró o cambió su contraseña, la sesión deja de valer
  const [filas] = await pool().execute(
    'SELECT id, sesiones_desde FROM clientes WHERE id = ? AND password_hash IS NOT NULL',
    [Number(id)],
  );
  const fila = filas[0];
  return fila && Number(emitida) >= Number(fila.sesiones_desde) ? fila.id : null;
}

async function requiereCliente(req, res, next) {
  const id = await clienteDe(req);
  if (!id) return res.status(401).json({ error: 'Inicia sesión' });
  req.clienteId = id;
  next();
}

// Cambia la contraseña del propio cliente (pidiendo la actual); null si salió bien
async function cambiarPasswordCliente(id, actual, nueva) {
  const [filas] = await pool().execute('SELECT email, password_hash FROM clientes WHERE id = ?', [id]);
  const fila = filas[0];
  if (!fila || !fila.password_hash) return 'Tu cuenta no tiene acceso.';
  if (!auth.verificarPassword(actual, fila.password_hash)) return 'La contraseña actual no es correcta.';
  const usuario = String(fila.email || '').split('@')[0] || 'x';
  const problema = auth.problemaConPassword(usuario, nueva);
  if (problema) return problema.replace('el nombre de usuario', 'tu correo');
  if (nueva === actual) return 'La contraseña nueva debe ser distinta de la actual.';
  await pool().execute('UPDATE clientes SET password_hash = ?, sesiones_desde = ? WHERE id = ?',
    [auth.hashPassword(nueva), Date.now(), id]);
  return null;
}

module.exports = {
  autenticarCliente,
  crearSesionCliente,
  cerrarSesionCliente,
  clienteDe,
  requiereCliente,
  cambiarPasswordCliente,
};
