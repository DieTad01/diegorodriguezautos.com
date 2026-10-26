// =============================================================
// auth.js — inicio de sesión del administrador
// - Una cuenta por persona (tabla `administradores`).
// - La contraseña NO se guarda: solo su hash scrypt.
// - La sesión es una cookie firmada con HMAC (no se puede falsificar
//   sin SESSION_SECRET), HttpOnly (JavaScript no la lee) y
//   SameSite=Strict (otros sitios no pueden usarla: anti-CSRF).
// =============================================================
const crypto = require('crypto');

const COOKIE = 'sesion_admin';
const DURACION_MS = 8 * 60 * 60 * 1000; // 8 horas
const LONGITUD_HASH = 64;
const CLAVE_MIN = 12;
const CLAVE_MAX = 200;

// ---------- Contraseñas ----------

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, LONGITUD_HASH);
  return `scrypt:${salt.toString('base64url')}:${hash.toString('base64url')}`;
}

function verificarPassword(password, guardado) {
  const partes = typeof guardado === 'string' ? guardado.split(':') : [];
  if (partes.length !== 3 || partes[0] !== 'scrypt') return false;
  const salt = Buffer.from(partes[1], 'base64url');
  const esperado = Buffer.from(partes[2], 'base64url');
  if (esperado.length !== LONGITUD_HASH) return false;
  const calculado = crypto.scryptSync(password, salt, LONGITUD_HASH);
  return crypto.timingSafeEqual(calculado, esperado);
}

// Reglas para una contraseña nueva; devuelve el problema o null si está bien
function problemaConPassword(usuario, clave) {
  if (typeof clave !== 'string' || clave.length < CLAVE_MIN) return `La contraseña debe tener al menos ${CLAVE_MIN} caracteres.`;
  if (clave.length > CLAVE_MAX) return `La contraseña puede tener máximo ${CLAVE_MAX} caracteres.`;
  if (clave.toLowerCase().includes(String(usuario).toLowerCase())) return 'La contraseña no debe contener el nombre de usuario.';
  return null;
}

// Compara textos sin filtrar por tiempo cuántos caracteres coinciden
function igualSeguro(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

// ---------- Usuarios ----------
// Cada persona tiene su propia cuenta en la tabla `administradores`.
// Compatibilidad: si la tabla está VACÍA y el .env aún trae
// ADMIN_USER/ADMIN_PASSWORD_HASH (versión anterior), ese usuario puede
// entrar. En cuanto existe una cuenta en la tabla, el .env se ignora
// (así, borrar una cuenta nunca "revive" la del .env).

// Huella de relleno: si el usuario no existe se verifica contra ella,
// así una respuesta no tarda distinto según exista o no el usuario.
const HASH_RELLENO = hashPassword(crypto.randomBytes(16).toString('hex'));

function secreto() {
  const s = process.env.SESSION_SECRET;
  return s && s.length >= 32 ? s : null;
}

async function usuarioLegado() {
  const { ADMIN_USER, ADMIN_PASSWORD_HASH } = process.env;
  if (!ADMIN_USER || !ADMIN_PASSWORD_HASH) return null;
  const pool = require('./db');
  const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM administradores');
  return Number(total) === 0 ? { usuario: ADMIN_USER, hash: ADMIN_PASSWORD_HASH } : null;
}

// Pasa el usuario del .env de la versión anterior a la tabla, con la MISMA
// contraseña, si la tabla está vacía. Corre al arrancar el sitio y antes de
// cada comando de usuarios-admin.js. El .env no se toca (si se regresa a la
// versión anterior con --volver, esa versión lo sigue encontrando).
// Devuelve el usuario migrado o null.
async function migrarLegado() {
  const { ADMIN_USER, ADMIN_PASSWORD_HASH } = process.env;
  if (!ADMIN_USER || !/^[A-Za-z0-9._-]{3,50}$/.test(ADMIN_USER) || !/^scrypt:/.test(ADMIN_PASSWORD_HASH || '')) return null;
  const pool = require('./db');
  // Solo si no hay ninguna cuenta: así nunca "revive" una cuenta que se borró
  const [r] = await pool.execute(
    `INSERT INTO administradores (usuario, password_hash, sesiones_desde)
     SELECT ?, ?, 0 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM administradores)`,
    [ADMIN_USER, ADMIN_PASSWORD_HASH],
  );
  return r.affectedRows === 1 ? ADMIN_USER : null;
}

async function buscarAdmin(usuario) {
  const pool = require('./db');
  const [filas] = await pool.execute(
    'SELECT id, usuario, password_hash, sesiones_desde FROM administradores WHERE usuario = ?',
    [usuario],
  );
  return filas[0] || null;
}

// Devuelve el nombre de usuario si usuario+contraseña son correctos; si no, null
async function autenticar(usuario, password) {
  const fila = await buscarAdmin(usuario);
  if (fila) {
    if (!verificarPassword(password, fila.password_hash)) return null;
    const pool = require('./db');
    await pool.execute('UPDATE administradores SET ultimo_acceso = NOW() WHERE id = ?', [fila.id]);
    return fila.usuario;
  }
  const legado = await usuarioLegado();
  if (legado && igualSeguro(usuario, legado.usuario)) {
    return verificarPassword(password, legado.hash) ? legado.usuario : null;
  }
  verificarPassword(password, HASH_RELLENO); // mismo tiempo que con un usuario real
  return null;
}

// Cambia la contraseña de una cuenta (pidiendo la actual) y cierra sus
// sesiones en otros dispositivos. Devuelve null si salió bien, o el error.
async function cambiarPassword(usuario, actual, nueva) {
  const fila = await buscarAdmin(usuario);
  if (!fila) return 'Esta cuenta todavía está en el .env: en el servidor corre deploy/actualizar.sh y vuelve a intentar.';
  if (!verificarPassword(actual, fila.password_hash)) return 'La contraseña actual no es correcta.';
  const problema = problemaConPassword(usuario, nueva);
  if (problema) return problema;
  if (nueva === actual) return 'La contraseña nueva debe ser distinta de la actual.';
  const pool = require('./db');
  await pool.execute('UPDATE administradores SET password_hash = ?, sesiones_desde = ? WHERE id = ?',
    [hashPassword(nueva), Date.now(), fila.id]);
  return null;
}

// ---------- Cookie de sesión ----------
// Formato: usuario(base64url).emitida(ms).firma — la firma cubre usuario y fecha,
// así no se puede cambiar ninguno de los dos sin SESSION_SECRET.

function firmar(usuarioB64, emitida, clave) {
  return crypto.createHmac('sha256', clave).update(`admin.${usuarioB64}.${emitida}`).digest('base64url');
}

function crearSesion(res, usuario) {
  const usuarioB64 = Buffer.from(usuario).toString('base64url');
  const emitida = Date.now();
  res.cookie(COOKIE, `${usuarioB64}.${emitida}.${firmar(usuarioB64, emitida, secreto())}`, opcionesCookie(DURACION_MS));
}

function cerrarSesion(res) {
  res.clearCookie(COOKIE, opcionesCookie());
}

function opcionesCookie(maxAge) {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    ...(maxAge ? { maxAge } : {}),
  };
}

function leerCookie(req, nombre) {
  const cabecera = req.headers.cookie;
  if (!cabecera) return null;
  for (const parte of cabecera.split(';')) {
    const i = parte.indexOf('=');
    if (i > 0 && parte.slice(0, i).trim() === nombre) return parte.slice(i + 1).trim();
  }
  return null;
}

// Devuelve el usuario de una sesión válida, o null
async function sesionDe(req) {
  const clave = secreto();
  const valor = leerCookie(req, COOKIE);
  if (!clave || !valor) return null;
  const partes = valor.split('.');
  if (partes.length !== 3) return null;
  const [usuarioB64, emitida, firma] = partes;
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(usuarioB64) || !/^\d{13}$/.test(emitida)) return null;
  const esperada = Buffer.from(firmar(usuarioB64, emitida, clave));
  const recibida = Buffer.from(firma);
  if (esperada.length !== recibida.length || !crypto.timingSafeEqual(esperada, recibida)) return null;
  const ahora = Date.now();
  if (Number(emitida) + DURACION_MS < ahora || Number(emitida) > ahora + 60000) return null;

  const usuario = Buffer.from(usuarioB64, 'base64url').toString();
  const fila = await buscarAdmin(usuario);
  if (fila) return Number(emitida) >= Number(fila.sesiones_desde) ? fila.usuario : null;
  const legado = await usuarioLegado();
  return legado && legado.usuario === usuario ? usuario : null; // si se borró, ya no entra
}

// ---------- Middlewares ----------

async function requiereSesion(req, res, next) {
  const usuario = await sesionDe(req);
  if (!usuario) return res.status(401).json({ error: 'Inicia sesión' });
  req.admin = usuario;
  next();
}

// Anti-CSRF extra: las peticiones que modifican datos deben venir
// de esta misma página (no de un formulario en otro sitio).
function soloMismoOrigen(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD') return next();
  const origen = req.get('origin');
  if (origen) {
    let host = null;
    try {
      host = new URL(origen).host;
    } catch { /* origen inválido */ }
    if (host !== req.get('host')) return res.status(403).json({ error: 'Origen no permitido' });
  } else {
    const sitio = req.get('sec-fetch-site');
    if (sitio && sitio !== 'same-origin' && sitio !== 'none') {
      return res.status(403).json({ error: 'Origen no permitido' });
    }
  }
  if ((req.method === 'POST' || req.method === 'PUT') && !req.is('application/json')) {
    return res.status(415).json({ error: 'Se esperaba JSON' });
  }
  next();
}

// Frena ataques de fuerza bruta: 5 intentos fallidos por IP cada 15 min
const INTENTOS_MAX = 5;
const VENTANA_MS = 15 * 60 * 1000;
const intentos = new Map();

function limitarIntentos(req, res, next) {
  const ahora = Date.now();
  const registro = intentos.get(req.ip);
  if (registro && registro.hasta > ahora && registro.fallos >= INTENTOS_MAX) {
    res.set('Retry-After', String(Math.ceil((registro.hasta - ahora) / 1000)));
    return res.status(429).json({ error: 'Demasiados intentos. Espera 15 minutos.' });
  }
  next();
}

function registrarFallo(ip) {
  const ahora = Date.now();
  const registro = intentos.get(ip);
  if (!registro || registro.hasta <= ahora) intentos.set(ip, { fallos: 1, hasta: ahora + VENTANA_MS });
  else registro.fallos += 1;
  if (intentos.size > 10000) {
    for (const [clave, r] of intentos) if (r.hasta <= ahora) intentos.delete(clave);
  }
}

function limpiarFallos(ip) {
  intentos.delete(ip);
}

module.exports = {
  hashPassword,
  verificarPassword,
  problemaConPassword,
  secreto,
  autenticar,
  cambiarPassword,
  migrarLegado,
  crearSesion,
  cerrarSesion,
  sesionDe,
  requiereSesion,
  soloMismoOrigen,
  limitarIntentos,
  registrarFallo,
  limpiarFallos,
  // Para el acceso de clientes (src/clientes-auth.js)
  DURACION_MS,
  opcionesCookie,
  leerCookie,
  verificarRelleno: (password) => verificarPassword(password, HASH_RELLENO),
};
