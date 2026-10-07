// =============================================================
// auth.js — inicio de sesión del administrador
// - La contraseña NO se guarda: solo su hash scrypt (en el .env).
// - La sesión es una cookie firmada con HMAC (no se puede falsificar
//   sin SESSION_SECRET), HttpOnly (JavaScript no la lee) y
//   SameSite=Strict (otros sitios no pueden usarla: anti-CSRF).
// =============================================================
const crypto = require('crypto');

const COOKIE = 'sesion_admin';
const DURACION_MS = 8 * 60 * 60 * 1000; // 8 horas
const LONGITUD_HASH = 64;

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

// Compara textos sin filtrar por tiempo cuántos caracteres coinciden
function igualSeguro(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

// ---------- Configuración ----------

function configuracion() {
  const { ADMIN_USER, ADMIN_PASSWORD_HASH, SESSION_SECRET } = process.env;
  if (!ADMIN_USER || !ADMIN_PASSWORD_HASH || !SESSION_SECRET || SESSION_SECRET.length < 32) {
    return null;
  }
  return { usuario: ADMIN_USER, hash: ADMIN_PASSWORD_HASH, secreto: SESSION_SECRET };
}

function credencialesValidas(usuario, password) {
  const config = configuracion();
  if (!config) return false;
  const usuarioOk = igualSeguro(usuario, config.usuario);
  // Se verifica la contraseña aunque el usuario esté mal (mismo tiempo)
  const passwordOk = verificarPassword(password, config.hash);
  return usuarioOk && passwordOk;
}

// ---------- Cookie de sesión ----------

function firmar(expira, secreto) {
  return crypto.createHmac('sha256', secreto).update(`admin.${expira}`).digest('base64url');
}

function crearSesion(res) {
  const { secreto } = configuracion();
  const expira = Date.now() + DURACION_MS;
  res.cookie(COOKIE, `${expira}.${firmar(expira, secreto)}`, opcionesCookie(DURACION_MS));
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

function sesionValida(req) {
  const config = configuracion();
  const valor = leerCookie(req, COOKIE);
  if (!config || !valor) return false;
  const [expira, firma] = valor.split('.');
  if (!/^\d{13}$/.test(expira || '') || !firma) return false;
  if (Number(expira) < Date.now()) return false;
  const esperada = Buffer.from(firmar(expira, config.secreto));
  const recibida = Buffer.from(firma);
  return esperada.length === recibida.length && crypto.timingSafeEqual(esperada, recibida);
}

// ---------- Middlewares ----------

function requiereSesion(req, res, next) {
  if (!sesionValida(req)) return res.status(401).json({ error: 'Inicia sesión' });
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
  configuracion,
  credencialesValidas,
  crearSesion,
  cerrarSesion,
  sesionValida,
  requiereSesion,
  soloMismoOrigen,
  limitarIntentos,
  registrarFallo,
  limpiarFallos,
};
