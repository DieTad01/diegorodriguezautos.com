// =============================================================
// Pruebas de seguridad: inyección SQL, inyección HTML (XSS),
// enlaces de imagen maliciosos, sesión, CSRF y archivos privados.
//
// Usa una base de datos de PRUEBA (nunca la del sitio):
//   cp .env.example .env.test   # y pon DB_NAME=agencia_test
//   npm test
// =============================================================
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.join(__dirname, '..', '.env.test'), quiet: true, override: true });

if (!/test/i.test(process.env.DB_NAME || '')) {
  console.error('npm test necesita un .env.test con DB_NAME de prueba (ej. agencia_test).');
  process.exit(1);
}

const { execFileSync } = require('child_process');
const { hashPassword } = require('../src/auth');

process.env.NODE_ENV = 'test';
delete process.env.ADMIN_USER;
delete process.env.ADMIN_PASSWORD_HASH;
process.env.SESSION_SECRET = 'x'.repeat(64);

const crearApp = require('../src/app');
const pool = require('../src/db');

let servidor;
let base;
let cookie;

async function peticion(ruta, { method = 'GET', body, headers = {}, conSesion = false } = {}) {
  const opciones = { method, headers: { ...headers }, redirect: 'manual' };
  if (body !== undefined) {
    opciones.body = typeof body === 'string' ? body : JSON.stringify(body);
    opciones.headers['Content-Type'] ??= 'application/json';
  }
  if (conSesion) opciones.headers.Cookie = cookie;
  const resp = await fetch(base + ruta, opciones);
  const texto = await resp.text();
  let json = null;
  try { json = JSON.parse(texto); } catch { /* no es JSON */ }
  return { status: resp.status, headers: resp.headers, texto, json };
}

const VEHICULO = {
  marca: 'Nissan', modelo: 'Versa', anio: 2021, version: 'Advance', precio: 265000,
  kilometraje: 38000, color: 'Blanco', transmision: 'automatica', descripcion: 'Prueba',
  estado: 'disponible', imagenes: [],
};

// Crea una cuenta del panel directamente en la tabla (como lo haría usuarios-admin.js)
async function crearCuenta(usuario, password) {
  await pool.execute(
    'INSERT INTO administradores (usuario, password_hash, sesiones_desde) VALUES (?, ?, ?)',
    [usuario, hashPassword(password), Date.now()],
  );
}

// Inicia sesión desde una IP nueva cada vez (los fallos a propósito no
// deben activar el bloqueo por fuerza bruta de otras pruebas)
let ipPrueba = 0;
async function entrar(usuario, password, ip = `10.7.${Math.floor(++ipPrueba / 250)}.${ipPrueba % 250}`) {
  const r = await peticion('/api/admin/login', { method: 'POST', body: { usuario, password }, headers: { 'X-Forwarded-For': ip } });
  return { ...r, cookie: r.status === 200 ? r.headers.get('set-cookie').split(';')[0] : null };
}

const conCookie = (c, ruta = '/api/admin/vehiculos') => fetch(base + ruta, { headers: { Cookie: c } });
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function contarVehiculos() {
  const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM vehiculos');
  return total;
}

before(async () => {
  const schema = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
  for (const sentencia of schema.replace(/^--.*$/gm, '').split(';').map((s) => s.trim()).filter(Boolean)) {
    await pool.query(sentencia);
  }
  await pool.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const tabla of ['pagos', 'ventas', 'clientes', 'vehiculo_imagenes', 'vehiculos', 'administradores']) {
    await pool.query(`TRUNCATE TABLE ${tabla}`);
  }
  await pool.query('SET FOREIGN_KEY_CHECKS = 1');
  await crearCuenta('admin', 'contraseña-de-prueba');

  servidor = crearApp().listen(0, '127.0.0.1');
  await new Promise((r) => servidor.once('listening', r));
  base = `http://127.0.0.1:${servidor.address().port}`;

  const login = await peticion('/api/admin/login', { method: 'POST', body: { usuario: 'admin', password: 'contraseña-de-prueba' } });
  assert.equal(login.status, 200);
  cookie = login.headers.get('set-cookie').split(';')[0];
  for (const marca of ['Nissan', 'Toyota']) {
    const r = await peticion('/api/admin/vehiculos', { method: 'POST', body: { ...VEHICULO, marca }, conSesion: true });
    assert.equal(r.status, 201);
  }
});

after(async () => {
  servidor.close();
  await pool.end();
});

// ---------------------------------------------------------------
// Inyección SQL
// ---------------------------------------------------------------

test('SQL: la búsqueda trata las comillas y comandos como texto', async () => {
  const ataques = [
    "' OR '1'='1",
    "' OR 1=1 -- ",
    "x' UNION SELECT id, marca, modelo, anio, version, precio, kilometraje, color, transmision, descripcion, estado FROM vehiculos -- ",
    "'; DROP TABLE vehiculos; -- ",
    "\\' OR 1=1 #",
    "' AND SLEEP(3) -- ",
  ];
  for (const q of ataques) {
    const inicio = Date.now();
    const r = await peticion(`/api/vehiculos?q=${encodeURIComponent(q)}`);
    assert.equal(r.status, 200, q);
    assert.deepEqual(r.json, [], `"${q}" no debe devolver vehículos`);
    assert.ok(Date.now() - inicio < 2000, `"${q}" no debe ejecutar SLEEP`);
  }
  assert.equal(await contarVehiculos(), 2, 'la tabla sigue intacta');
});

test('SQL: los comodines % y _ de LIKE se buscan literalmente', async () => {
  assert.deepEqual((await peticion('/api/vehiculos?q=%25')).json, []);
  assert.deepEqual((await peticion('/api/vehiculos?q=_')).json, []);
  assert.equal((await peticion('/api/vehiculos?q=Nissan')).json.length, 1);
});

test('SQL: parámetros repetidos o como arreglo se rechazan', async () => {
  assert.equal((await peticion('/api/vehiculos?q=a&q=b')).status, 400);
});

test('SQL: el id en la URL solo acepta dígitos', async () => {
  for (const id of ['1 OR 1=1', "1'", '1;DROP TABLE vehiculos', '-1', '0', '1e3', '99999999999', '0x1']) {
    const r = await peticion(`/api/vehiculos/${encodeURIComponent(id)}`);
    assert.equal(r.status, 404, id);
    const d = await peticion(`/api/admin/vehiculos/${encodeURIComponent(id)}`, { method: 'DELETE', conSesion: true });
    assert.equal(d.status, 404, id);
  }
  assert.equal(await contarVehiculos(), 2);
});

test('SQL: el login no se salta con comillas', async () => {
  for (const usuario of ["admin' -- ", "' OR '1'='1", 'admin" OR "1"="1']) {
    const r = await peticion('/api/admin/login', { method: 'POST', body: { usuario, password: "' OR '1'='1" } });
    assert.equal(r.status, 401, usuario);
  }
});

test('SQL: los campos guardan las comillas tal cual, sin ejecutarlas', async () => {
  const marca = "Robert'); DROP TABLE vehiculos;--";
  const r = await peticion('/api/admin/vehiculos', { method: 'POST', body: { ...VEHICULO, marca }, conSesion: true });
  assert.equal(r.status, 201);
  const [[fila]] = await pool.execute('SELECT marca FROM vehiculos WHERE id = ?', [r.json.id]);
  assert.equal(fila.marca, marca);
  assert.equal(await contarVehiculos(), 3);
  await pool.execute('DELETE FROM vehiculos WHERE id = ?', [r.json.id]);
});

test('SQL: tipos inesperados (objetos, arreglos) se rechazan', async () => {
  const casos = [
    { marca: { toString: 'x' } },
    { marca: ['Nissan'] },
    { anio: '2021 OR 1=1' },
    { precio: '1e9' },
    { precio: -5 },
    { estado: "disponible' OR '1'='1" },
    { transmision: 'automatica; DROP TABLE vehiculos' },
  ];
  for (const cambio of casos) {
    const r = await peticion('/api/admin/vehiculos', { method: 'POST', body: { ...VEHICULO, ...cambio }, conSesion: true });
    assert.equal(r.status, 400, JSON.stringify(cambio));
  }
  assert.equal(await contarVehiculos(), 2);
});

test('SQL: los errores de base de datos no se muestran al usuario', async () => {
  const r = await peticion('/api/admin/vehiculos', { method: 'POST', body: '{"marca": ', conSesion: true });
  assert.equal(r.status, 400);
  assert.doesNotMatch(r.texto, /SQL|mysql|syntax|at .*\.js/i);
});

// ---------------------------------------------------------------
// Inyección HTML / XSS
// ---------------------------------------------------------------

test('XSS: el HTML se guarda como texto y la API responde JSON, no HTML', async () => {
  const marca = '<img src=x onerror=alert(1)>';
  const descripcion = '<script>alert(document.cookie)</script>';
  const r = await peticion('/api/admin/vehiculos', { method: 'POST', body: { ...VEHICULO, marca, descripcion }, conSesion: true });
  assert.equal(r.status, 201);
  const lista = await peticion('/api/vehiculos');
  assert.match(lista.headers.get('content-type'), /^application\/json/);
  assert.equal(lista.headers.get('x-content-type-options'), 'nosniff');
  const guardado = lista.json.find((v) => v.id === r.json.id);
  assert.equal(guardado.marca, marca);
  assert.equal(guardado.descripcion, descripcion);
  await pool.execute('DELETE FROM vehiculos WHERE id = ?', [r.json.id]);
});

test('XSS: el código del navegador nunca usa innerHTML ni similares', () => {
  const peligrosos = /\.innerHTML|\.outerHTML|insertAdjacentHTML|document\.write|\beval\(|new Function\(|setAttribute\(\s*['"]on/;
  for (const archivo of fs.readdirSync(path.join(__dirname, '..', 'public', 'js'))) {
    const codigo = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', archivo), 'utf8')
      .replace(/^\s*\/\/.*$/gm, '');
    assert.doesNotMatch(codigo, peligrosos, archivo);
  }
});

test('XSS: las páginas no tienen scripts ni estilos en línea (los bloquea la CSP)', () => {
  for (const pagina of ['index.html', 'admin.html']) {
    const html = fs.readFileSync(path.join(__dirname, '..', 'public', pagina), 'utf8');
    // Solo se permiten <script src="..."> y bloques de datos JSON-LD (no ejecutables)
    const sinJsonLd = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '');
    assert.doesNotMatch(sinJsonLd, /<script>|<script(?![^>]*\ssrc=)[^>]*>|\son[a-z]+=|style=|javascript:/i, pagina);
  }
});

test('XSS: la CSP solo permite scripts propios', async () => {
  const r = await peticion('/');
  const csp = r.headers.get('content-security-policy');
  assert.match(csp, /script-src 'self'(;|$)/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval/);
  assert.match(csp, /frame-src https:\/\/www\.google\.com(;|$)/, 'solo se permite el iframe del mapa');
});

// ---------------------------------------------------------------
// Imágenes por enlace (Google Drive u otro https)
// ---------------------------------------------------------------

test('Imágenes: enlaces de Google Drive se convierten a miniatura', async () => {
  const id = '1AbCdEfGhIjKlMnOpQrStUvWxYz012345';
  const r = await peticion('/api/admin/imagenes/previsualizar', {
    method: 'POST',
    conSesion: true,
    body: { urls: [
      `https://drive.google.com/file/d/${id}/view?usp=sharing`,
      `https://drive.google.com/open?id=${id}`,
      `https://drive.google.com/uc?export=view&id=${id}`,
      `https://lh3.googleusercontent.com/d/${id}`,
      'https://ejemplo.com/fotos/auto.jpg',
    ] },
  });
  assert.equal(r.status, 200);
  const esperado = `https://drive.google.com/thumbnail?id=${id}&sz=w1600`;
  assert.deepEqual(r.json.slice(0, 4).map((x) => x.url), [esperado, esperado, esperado, esperado]);
  assert.equal(r.json[4].url, 'https://ejemplo.com/fotos/auto.jpg');
});

test('Imágenes: se rechazan javascript:, data:, http:, carpetas y basura', async () => {
  const malos = [
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    ' javascript:alert(1)',
    'data:image/svg+xml,<svg onload=alert(1)>',
    'data:text/html,<script>alert(1)</script>',
    'http://ejemplo.com/auto.jpg',
    'file:///etc/passwd',
    '//evil.com/x.png',
    '"><script>alert(1)</script>',
    'https://usuario:clave@ejemplo.com/a.jpg',
    'https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz',
    "https://drive.google.com/file/d/abc'\"<>/view",
    `https://ejemplo.com/${'a'.repeat(600)}.jpg`,
  ];
  const r = await peticion('/api/admin/imagenes/previsualizar', { method: 'POST', conSesion: true, body: { urls: malos } });
  r.json.forEach((resultado, i) => assert.ok(resultado.error, `debió rechazar: ${malos[i]}`));

  const guardar = await peticion('/api/admin/vehiculos', {
    method: 'POST', conSesion: true, body: { ...VEHICULO, imagenes: ['javascript:alert(1)'] },
  });
  assert.equal(guardar.status, 400);
});

test('Imágenes: caracteres especiales en un enlace válido quedan codificados', async () => {
  const r = await peticion('/api/admin/imagenes/previsualizar', {
    method: 'POST', conSesion: true, body: { urls: ['https://ejemplo.com/a"><script>.jpg'] },
  });
  assert.doesNotMatch(r.json[0].url, /["<>]/);
});

test('Imágenes: guardar y editar reemplaza la lista en orden', async () => {
  const nuevo = await peticion('/api/admin/vehiculos', {
    method: 'POST', conSesion: true,
    body: { ...VEHICULO, imagenes: ['https://a.com/1.jpg', 'https://a.com/2.jpg'] },
  });
  await peticion(`/api/admin/vehiculos/${nuevo.json.id}`, {
    method: 'PUT', conSesion: true, body: { ...VEHICULO, imagenes: ['https://a.com/3.jpg'] },
  });
  const v = (await peticion(`/api/vehiculos/${nuevo.json.id}`)).json;
  assert.deepEqual(v.imagenes, ['https://a.com/3.jpg']);
  await peticion(`/api/admin/vehiculos/${nuevo.json.id}`, { method: 'DELETE', conSesion: true });
  const [[{ huerfanas }]] = await pool.query('SELECT COUNT(*) AS huerfanas FROM vehiculo_imagenes WHERE vehiculo_id = ?', [nuevo.json.id]);
  assert.equal(huerfanas, 0);
});

// ---------------------------------------------------------------
// Sesión del administrador y CSRF
// ---------------------------------------------------------------

test('Admin: sin sesión todo devuelve 401', async () => {
  assert.equal((await peticion('/api/admin/vehiculos')).status, 401);
  assert.equal((await peticion('/api/admin/vehiculos', { method: 'POST', body: VEHICULO })).status, 401);
  assert.equal((await peticion('/api/admin/vehiculos/1', { method: 'DELETE' })).status, 401);
});

test('Admin: una cookie inventada o alterada no sirve', async () => {
  const [nombre, valor] = cookie.split('=');
  const [usuarioB64, emitida, firma] = valor.split('.');
  assert.equal(Buffer.from(usuarioB64, 'base64url').toString(), 'admin');
  const otroUsuario = Buffer.from('otro').toString('base64url');
  const falsas = [
    `${nombre}=9999999999999.abc`,
    `${nombre}=${usuarioB64}.9999999999999.abc`,
    `${nombre}=${usuarioB64}.${Number(emitida) + 1000}.${firma}`,
    `${nombre}=${usuarioB64}.${emitida}.${firma.slice(0, -1)}${firma.endsWith('A') ? 'B' : 'A'}`,
    `${nombre}=${otroUsuario}.${emitida}.${firma}`,
    `${nombre}=${emitida}.${firma}`,
    `${nombre}=${usuarioB64}.${emitida}.${firma}.extra`,
    `${nombre}=${usuarioB64}.${emitida}`,
  ];
  for (const falsa of falsas) {
    const r = await fetch(`${base}/api/admin/vehiculos`, { headers: { Cookie: falsa } });
    assert.equal(r.status, 401, falsa);
  }
  assert.equal((await conCookie(cookie)).status, 200, 'la original sí sirve');
});

test('Admin: una cookie bien firmada pero vencida (más de 8 h) o con fecha futura no sirve', async () => {
  const crypto = require('crypto');
  // Cuenta sin "cerrar sesiones" previo, para que solo cuente la fecha de la cookie
  await pool.execute("INSERT INTO administradores (usuario, password_hash, sesiones_desde) VALUES ('antigua', ?, 0)", [hashPassword('clave-de-la-antigua')]);
  const u = Buffer.from('antigua').toString('base64url');
  const firmada = (emitida) => `sesion_admin=${u}.${emitida}.${crypto.createHmac('sha256', process.env.SESSION_SECRET).update(`admin.${u}.${emitida}`).digest('base64url')}`;
  try {
    assert.equal((await conCookie(firmada(Date.now() - 60 * 1000))).status, 200, 'control: reciente sí sirve');
    assert.equal((await conCookie(firmada(Date.now() - 9 * 60 * 60 * 1000))).status, 401, 'vencida');
    assert.equal((await conCookie(firmada(Date.now() + 60 * 60 * 1000))).status, 401, 'del futuro');
  } finally {
    await pool.query("DELETE FROM administradores WHERE usuario = 'antigua'");
  }
});

// ---------------------------------------------------------------
// Varias cuentas del panel (tú, tu cliente...)
// ---------------------------------------------------------------

test('Cuentas: cada persona entra con la suya y el panel sabe quién es', async () => {
  await crearCuenta('cliente1', 'clave-del-cliente-1');
  const a = await entrar('admin', 'contraseña-de-prueba');
  const c = await entrar('cliente1', 'clave-del-cliente-1');
  assert.equal(a.status, 200);
  assert.equal(c.status, 200);
  assert.equal(c.json.usuario, 'cliente1');
  const sesion = await (await conCookie(c.cookie, '/api/admin/sesion')).json();
  assert.equal(sesion.usuario, 'cliente1');
  // Cambiar el nombre dentro de la cookie del cliente por 'admin' no da acceso como admin
  const [nombreCookie, valor] = c.cookie.split('=');
  const resto = valor.slice(valor.indexOf('.'));
  const suplantada = `${nombreCookie}=${Buffer.from('admin').toString('base64url')}${resto}`;
  assert.equal((await conCookie(suplantada)).status, 401, 'suplantar a otra cuenta');
  // La contraseña de una cuenta no abre otra
  assert.equal((await entrar('cliente1', 'contraseña-de-prueba')).status, 401);
  assert.equal((await entrar('admin', 'clave-del-cliente-1')).status, 401);
  // Usuario inexistente: mismo mensaje que contraseña mala (no revela qué cuentas existen)
  const noExiste = await entrar('nadie', 'clave-del-cliente-1');
  const malaClave = await entrar('cliente1', 'otra-clave-cualquiera');
  assert.equal(noExiste.status, 401);
  assert.equal(noExiste.texto, malaClave.texto);
  const [[fila]] = await pool.query("SELECT ultimo_acceso FROM administradores WHERE usuario = 'cliente1'");
  assert.ok(fila.ultimo_acceso, 'se registra el último acceso');
});

test('Cuentas: cambiar la contraseña cierra solo las sesiones de esa cuenta', async () => {
  const a = await entrar('admin', 'contraseña-de-prueba');
  const c = await entrar('cliente1', 'clave-del-cliente-1');
  await espera(5);
  await pool.execute('UPDATE administradores SET password_hash = ?, sesiones_desde = ? WHERE usuario = ?',
    [hashPassword('clave-nueva-cliente-1'), Date.now(), 'cliente1']);
  assert.equal((await conCookie(c.cookie)).status, 401, 'la sesión vieja del cliente ya no sirve');
  assert.equal((await conCookie(a.cookie)).status, 200, 'la del admin sigue');
  assert.equal((await entrar('cliente1', 'clave-del-cliente-1')).status, 401, 'la contraseña vieja ya no sirve');
  const nueva = await entrar('cliente1', 'clave-nueva-cliente-1');
  assert.equal(nueva.status, 200);
  assert.equal((await conCookie(nueva.cookie)).status, 200);
});

test('Cuentas: borrar una cuenta invalida su sesión al instante', async () => {
  const c = await entrar('cliente1', 'clave-nueva-cliente-1');
  assert.equal((await conCookie(c.cookie)).status, 200);
  await pool.execute("DELETE FROM administradores WHERE usuario = 'cliente1'");
  assert.equal((await conCookie(c.cookie)).status, 401);
  assert.equal((await entrar('cliente1', 'clave-nueva-cliente-1')).status, 401);
});

test('Cuentas: cada quien cambia SU contraseña desde el panel, pidiendo la actual', async () => {
  await crearCuenta('cliente2', 'clave-cliente-dos-2');
  const otroDispositivo = await entrar('cliente2', 'clave-cliente-dos-2');
  const c = await entrar('cliente2', 'clave-cliente-dos-2');
  const cambiar = (body, cookieUsada = c.cookie, headers = {}) => peticion('/api/admin/contrasena', {
    method: 'POST', body, headers: { Cookie: cookieUsada, 'X-Forwarded-For': '10.8.8.8', ...headers },
  });
  assert.equal((await peticion('/api/admin/contrasena', { method: 'POST', body: { actual: 'x', nueva: 'y' } })).status, 401, 'sin sesión');
  assert.equal((await cambiar({ actual: 'clave-cliente-dos-2', nueva: 'clave-nueva-larga-22' }, c.cookie, { Origin: 'https://sitio-malo.com' })).status, 403, 'CSRF');
  assert.equal((await cambiar({ actual: 'clave-equivocada-1', nueva: 'clave-nueva-larga-22' })).status, 400, 'actual incorrecta');
  assert.equal((await cambiar({ actual: 'clave-cliente-dos-2', nueva: 'corta' })).status, 400, 'nueva corta');
  assert.equal((await cambiar({ actual: 'clave-cliente-dos-2', nueva: 'clave-cliente-dos-2' })).status, 400, 'igual a la actual');
  assert.equal((await cambiar({ actual: 'clave-cliente-dos-2', nueva: 'mi-cliente2-largo' })).status, 400, 'contiene el usuario');
  assert.equal((await cambiar({ actual: ['clave-cliente-dos-2'], nueva: { $ne: 1 } })).status, 400, 'tipos raros');
  assert.equal((await entrar('cliente2', 'clave-cliente-dos-2')).status, 200, 'nada de lo anterior la cambió');
  await espera(5);
  // Mandar "usuario: admin" no sirve para cambiar la de otra cuenta
  const ok = await cambiar({ usuario: 'admin', actual: 'clave-cliente-dos-2', nueva: 'clave-nueva-larga-22' });
  assert.equal(ok.status, 200);
  const cookieNueva = ok.headers.get('set-cookie').split(';')[0];
  assert.equal((await conCookie(cookieNueva)).status, 200, 'este dispositivo sigue dentro');
  assert.equal((await conCookie(otroDispositivo.cookie)).status, 401, 'los demás dispositivos salen');
  assert.equal((await entrar('cliente2', 'clave-cliente-dos-2')).status, 401, 'la vieja ya no sirve');
  assert.equal((await entrar('cliente2', 'clave-nueva-larga-22')).status, 200);
  assert.equal((await entrar('admin', 'contraseña-de-prueba')).status, 200, 'la del admin no cambió');
  assert.equal((await conCookie(cookie)).status, 200, 'ni se cerró su sesión');
  await pool.query("DELETE FROM administradores WHERE usuario = 'cliente2'");
});

test('Cuentas: el usuario del .env anterior solo vale mientras no haya cuentas en la tabla', async () => {
  process.env.ADMIN_USER = 'legado';
  process.env.ADMIN_PASSWORD_HASH = hashPassword('clave-del-legado-1');
  try {
    assert.equal((await entrar('legado', 'clave-del-legado-1')).status, 401, 'hay cuentas: el .env se ignora');
    const [respaldo] = await pool.query('SELECT * FROM administradores');
    await pool.query('DELETE FROM administradores');
    try {
      const l = await entrar('legado', 'clave-del-legado-1');
      assert.equal(l.status, 200, 'tabla vacía: compatibilidad con la versión anterior');
      assert.equal((await conCookie(l.cookie)).status, 200);
      await crearCuenta('nueva', 'clave-de-la-cuenta-nueva');
      assert.equal((await conCookie(l.cookie)).status, 401, 'en cuanto hay cuentas, la sesión del .env deja de valer');
    } finally {
      await pool.query('DELETE FROM administradores');
      for (const f of respaldo) {
        await pool.execute('INSERT INTO administradores (id, usuario, nombre, password_hash, sesiones_desde) VALUES (?, ?, ?, ?, ?)',
          [f.id, f.usuario, f.nombre, f.password_hash, f.sesiones_desde]);
      }
    }
  } finally {
    delete process.env.ADMIN_USER;
    delete process.env.ADMIN_PASSWORD_HASH;
  }
  assert.equal((await conCookie(cookie)).status, 200);
});

test('Cuentas: al arrancar, la cuenta del .env anterior pasa a la tabla con la misma contraseña (solo si está vacía)', async () => {
  const { migrarLegado } = require('../src/auth');
  const [respaldo] = await pool.query('SELECT * FROM administradores');
  process.env.ADMIN_USER = 'legado.dos';
  process.env.ADMIN_PASSWORD_HASH = hashPassword('clave-del-legado-dos');
  try {
    assert.equal(await migrarLegado(), null, 'con cuentas en la tabla no hace nada');
    await pool.query('DELETE FROM administradores');
    assert.equal(await migrarLegado(), 'legado.dos');
    assert.equal(await migrarLegado(), null, 'la segunda vez no duplica');
    delete process.env.ADMIN_USER;
    delete process.env.ADMIN_PASSWORD_HASH;
    const l = await entrar('legado.dos', 'clave-del-legado-dos');
    assert.equal(l.status, 200, 'entra con la misma contraseña, ya desde la tabla');
    await crearCuenta('cliente3', 'clave-del-cliente-3');
    assert.equal((await conCookie(l.cookie)).status, 200, 'crear otra cuenta ya no lo deja fuera');
  } finally {
    delete process.env.ADMIN_USER;
    delete process.env.ADMIN_PASSWORD_HASH;
    await pool.query('DELETE FROM administradores');
    for (const f of respaldo) {
      await pool.execute('INSERT INTO administradores (id, usuario, nombre, password_hash, sesiones_desde) VALUES (?, ?, ?, ?, ?)',
        [f.id, f.usuario, f.nombre, f.password_hash, f.sesiones_desde]);
    }
  }
  assert.equal((await conCookie(cookie)).status, 200);
});

test('Cuentas: el script usuarios-admin crea, rechaza y borra cuentas', () => {
  const script = path.join(__dirname, '..', 'scripts', 'usuarios-admin.js');
  const correr = (args, entrada = '', envExtra = {}) => {
    try {
      return { codigo: 0, salida: execFileSync(process.execPath, [script, ...args], {
        input: entrada, env: { ...process.env, ENV_FILE: path.join(__dirname, '..', '.env.test'), ...envExtra }, encoding: 'utf8', stdio: 'pipe',
      }) };
    } catch (err) {
      return { codigo: err.status, salida: String(err.stdout) + String(err.stderr) };
    }
  };
  assert.equal(correr(['agregar', 'script.prueba'], 'Persona\nclave-script-12345\nclave-script-12345\n').codigo, 0);
  assert.equal(correr(['agregar', 'script.prueba'], 'x\nclave-script-12345\nclave-script-12345\n').codigo, 1, 'duplicada');
  assert.equal(correr(['agregar', 'otra'], 'x\ncorta\ncorta\n').codigo, 1, 'contraseña corta');
  assert.equal(correr(['agregar', 'otra'], 'x\nclave-larga-uno-1\nclave-larga-dos-2\n').codigo, 1, 'no coinciden');
  assert.equal(correr(['agregar', "x' OR '1'='1"], '').codigo, 1, 'usuario con comillas');
  assert.match(correr(['listar']).salida, /script\.prueba\s+Persona/);
  assert.equal(correr(['quitar', 'script.prueba'], 'no\n').codigo, 1, 'sin confirmar no borra');
  assert.equal(correr(['quitar', 'script.prueba'], 'script.prueba\n').codigo, 0);
  assert.doesNotMatch(correr(['listar']).salida, /script\.prueba/);
  // migrar: el usuario del .env viejo NO se agrega si ya hay cuentas (no revive cuentas borradas)
  const legado = { ADMIN_USER: 'legado.viejo', ADMIN_PASSWORD_HASH: hashPassword('clave-del-legado-viejo') };
  assert.equal(correr(['migrar'], '', legado).codigo, 0);
  assert.doesNotMatch(correr(['listar']).salida, /legado\.viejo/);
});

test('Admin: la cookie es HttpOnly y SameSite=Strict', async () => {
  const r = await peticion('/api/admin/login', { method: 'POST', body: { usuario: 'admin', password: 'contraseña-de-prueba' } });
  const setCookie = r.headers.get('set-cookie');
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Strict/i);
});

test('CSRF: peticiones desde otro sitio se bloquean', async () => {
  const otro = await peticion('/api/admin/vehiculos', {
    method: 'POST', conSesion: true, body: VEHICULO, headers: { Origin: 'https://sitio-malo.com' },
  });
  assert.equal(otro.status, 403);
  const fetchSite = await peticion('/api/admin/vehiculos/1', {
    method: 'DELETE', conSesion: true, headers: { 'Sec-Fetch-Site': 'cross-site' },
  });
  assert.equal(fetchSite.status, 403);
  // Un <form> HTML no puede mandar JSON: se rechaza el formato de formulario
  const formulario = await peticion('/api/admin/vehiculos', {
    method: 'POST', conSesion: true, body: 'marca=x', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  assert.equal(formulario.status, 415);
  assert.equal(await contarVehiculos(), 2);
});

// ---------------------------------------------------------------
// Panel admin (detrás del control de acceso): inyección campo por campo
// ---------------------------------------------------------------

const ATAQUES_SQL = [
  "' OR '1'='1",
  "'; DROP TABLE vehiculos; --",
  '" OR ""="',
  "\\'; DELETE FROM vehiculos; #",
  "1' UNION SELECT @@version -- ",
  "x'); TRUNCATE ventas; --",
  "' AND SLEEP(5) AND '1'='1",
];
const ATAQUES_HTML = [
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  '"><svg onload=alert(1)>',
  "'><iframe src=//malo.com>",
  'javascript:alert(1)',
  '{{constructor.constructor("alert(1)")()}}',
  '<a href="javascript:alert(1)">x</a>',
];
const CAMPOS_TEXTO = { marca: 50, modelo: 60, version: 80, color: 30, descripcion: 2000 };

test('Admin: el login resiste inyección SQL/HTML y tipos raros', async () => {
  const intentos = [
    ...ATAQUES_SQL.map((a) => ({ usuario: a, password: a })),
    ...ATAQUES_HTML.map((a) => ({ usuario: a, password: a })),
    { usuario: 'admin', password: { $ne: null } },
    { usuario: { $gt: '' }, password: 'x' },
    { usuario: ['admin'], password: ['contraseña-de-prueba'] },
    { usuario: 'admin', password: 'x'.repeat(10000) },
    { usuario: 'admin' },
    {},
  ];
  // Se usa una IP distinta para no activar el bloqueo por fuerza bruta
  for (const body of intentos) {
    const r = await peticion('/api/admin/login', { method: 'POST', body, headers: { 'X-Forwarded-For': '10.9.9.9' } });
    assert.notEqual(r.status, 200, JSON.stringify(body).slice(0, 80));
    assert.equal(r.headers.get('set-cookie'), null, 'no debe crear sesión');
  }
});

test('Admin: cada campo guarda inyecciones SQL y HTML como texto, al crear y al editar', async () => {
  const antes = await contarVehiculos();
  const [[{ ventasAntes }]] = await pool.query('SELECT COUNT(*) AS ventasAntes FROM ventas');
  const base = await peticion('/api/admin/vehiculos', { method: 'POST', body: VEHICULO, conSesion: true });
  assert.equal(base.status, 201);

  for (const [campo, max] of Object.entries(CAMPOS_TEXTO)) {
    for (const ataque of [...ATAQUES_SQL, ...ATAQUES_HTML].filter((a) => a.length <= max)) {
      const datos = { ...VEHICULO, [campo]: ataque };
      const creado = await peticion('/api/admin/vehiculos', { method: 'POST', body: datos, conSesion: true });
      assert.equal(creado.status, 201, `crear ${campo}: ${ataque}`);
      const editado = await peticion(`/api/admin/vehiculos/${base.json.id}`, { method: 'PUT', body: datos, conSesion: true });
      assert.equal(editado.status, 200, `editar ${campo}: ${ataque}`);

      const [[fila]] = await pool.execute(`SELECT ${campo} AS valor FROM vehiculos WHERE id IN (?, ?) GROUP BY ${campo}`, [creado.json.id, base.json.id]);
      assert.equal(fila.valor, ataque.trim(), `${campo} debe guardarse literal (solo sin espacios en los extremos)`);
      await pool.execute('DELETE FROM vehiculos WHERE id = ?', [creado.json.id]);
    }
  }

  const lista = await peticion('/api/admin/vehiculos', { conSesion: true });
  assert.match(lista.headers.get('content-type'), /^application\/json/);
  assert.equal(await contarVehiculos(), antes + 1, 'ningún ataque borró ni duplicó filas');
  const [[{ ventasDespues }]] = await pool.query('SELECT COUNT(*) AS ventasDespues FROM ventas');
  assert.equal(ventasDespues, ventasAntes, 'ningún ataque tocó otras tablas');
  const [tablas] = await pool.query('SHOW TABLES');
  assert.equal(tablas.length, 6, 'todas las tablas siguen existiendo');
  await pool.execute('DELETE FROM vehiculos WHERE id = ?', [base.json.id]);
});

test('Admin: estado y transmisión solo aceptan sus opciones exactas', async () => {
  for (const ataque of [...ATAQUES_SQL, ...ATAQUES_HTML, 'DISPONIBLE', 'disponible ', null, 1, true]) {
    for (const campo of ['estado', 'transmision']) {
      const r = await peticion('/api/admin/vehiculos', { method: 'POST', body: { ...VEHICULO, [campo]: ataque }, conSesion: true });
      assert.equal(r.status, 400, `${campo}: ${ataque}`);
    }
  }
});

test('Admin: __proto__ en el JSON no contamina el servidor', async () => {
  const cuerpo = `{"__proto__": {"esAdmin": true}, "constructor": {"prototype": {"esAdmin": true}},
    ${JSON.stringify(VEHICULO).slice(1)}`;
  const r = await peticion('/api/admin/vehiculos', { method: 'POST', body: cuerpo, conSesion: true });
  assert.equal(r.status, 201);
  assert.equal({}.esAdmin, undefined);
  assert.equal(Object.prototype.esAdmin, undefined);
  await pool.execute('DELETE FROM vehiculos WHERE id = ?', [r.json.id]);
});

// ---------------------------------------------------------------
// Páginas para Google: ficha de cada auto, sitemap, robots, aviso
// ---------------------------------------------------------------

const http = require('node:http');
const { paginaAuto } = require('../src/paginas/auto');

// fetch no deja cambiar el Host; para probar www -> sin www se usa http
function conHost(ruta, host) {
  return new Promise((resolve, reject) => {
    const { port } = new URL(base);
    http.get({ host: '127.0.0.1', port, path: ruta, headers: { Host: host } }, (r) => {
      r.resume();
      resolve({ status: r.statusCode, location: r.headers.location });
    }).on('error', reject);
  });
}

function scripts(html) {
  return [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)].map((m) => ({ attrs: m[1], cuerpo: m[2] }));
}

// Lista de etiquetas con sus nombres de atributo, ignorando el texto y los valores.
// Los valores van entre comillas dobles y escapados, así que [^"]* los consume completos.
function estructura(html) {
  const sinDatos = html.replace(/(<script type="application\/ld\+json">)[\s\S]*?(<\/script>)/g, '$1$2');
  return [...sinDatos.matchAll(/<(\/?[a-zA-Z][\w-]*)((?:\s+[a-zA-Z-]+(?:="[^"]*")?)*)\s*\/?>/g)]
    .map((m) => `${m[1]}(${[...m[2].matchAll(/([a-zA-Z-]+)(?:="[^"]*")?/g)].map((x) => x[1]).join(',')})`);
}

test('SEO: la API da la dirección de la ficha y la ficha tiene título, canónica y JSON-LD', async () => {
  const lista = (await peticion('/api/vehiculos')).json;
  assert.ok(lista.length > 0);
  for (const v of lista) assert.match(v.url, /^\/autos\/\d+-[a-z0-9-]+$/);
  const v = lista[0];
  const r = await peticion(v.url);
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type'), /^text\/html/);
  assert.match(r.texto, new RegExp(`<link rel="canonical" href="https://diegorodriguezautos\\.com${v.url}">`));
  assert.match(r.texto, /<title>[^<]*León[^<]*<\/title>/);
  const datos = scripts(r.texto).map((x) => JSON.parse(x.cuerpo));
  const auto = datos.find((d) => d['@type'] === 'Car');
  assert.equal(auto.offers.price, v.precio);
  assert.equal(auto.offers.priceCurrency, 'MXN');
  assert.ok(datos.find((d) => d['@type'] === 'BreadcrumbList'));
});

test('SEO: dirección incorrecta redirige a la canónica; inexistente o vendido da 404 sin indexar', async () => {
  const v = (await peticion('/api/vehiculos')).json[0];
  const id = v.url.match(/\d+/)[0];
  for (const ruta of [`/autos/${id}`, `/autos/${id}-otro-texto`]) {
    const r = await peticion(ruta);
    assert.equal(r.status, 301, ruta);
    assert.equal(r.headers.get('location'), v.url);
  }
  for (const ruta of ['/autos/999999-x', '/autos/abc', "/autos/1'%20OR%201=1", '/autos/0', '/no-existe']) {
    const r = await peticion(ruta);
    assert.equal(r.status, 404, ruta);
    assert.match(r.texto, /<meta name="robots" content="noindex/);
  }
  const vendido = await peticion('/api/admin/vehiculos', { method: 'POST', body: { ...VEHICULO, estado: 'vendido' }, conSesion: true });
  assert.equal((await peticion(`/autos/${vendido.json.id}`)).status, 404);
  await pool.execute('DELETE FROM vehiculos WHERE id = ?', [vendido.json.id]);
});

test('XSS: la ficha generada en el servidor escapa todos los campos y el JSON-LD', async () => {
  const ataques = {
    marca: '<script>alert(1)</script>',
    modelo: '"><img src=x onerror=alert(2)>',
    version: '</script><script>alert(3)</script>',
    color: "' onmouseover='alert(4)",
    descripcion: '<iframe src="javascript:alert(5)"></iframe>\n</title><svg onload=alert(6)>',
  };
  const fotoBuena = 'https://ejemplo.com/foto.jpg';
  const r = await peticion('/api/admin/vehiculos', {
    method: 'POST', body: { ...VEHICULO, ...ataques, imagenes: [fotoBuena] }, conSesion: true,
  });
  assert.equal(r.status, 201);
  // Además, una foto maliciosa metida directo en MySQL (saltando la validación)
  await pool.execute('INSERT INTO vehiculo_imagenes (vehiculo_id, url, orden) VALUES (?, ?, 5)', [r.json.id, 'javascript:alert(7)']);

  const v = (await peticion('/api/vehiculos')).json.find((x) => x.id === r.json.id);
  assert.match(v.url, /^\/autos\/\d+-[a-z0-9-]+$/, 'la dirección solo lleva letras, números y guiones');
  const html = (await peticion(v.url)).texto;

  // Prueba estructural: la página con ataques debe tener EXACTAMENTE las mismas etiquetas
  // y atributos que la misma página con datos normales. Si un ataque lograra inyectar
  // una etiqueta (<script>, <img>…) o un atributo (onerror=…), la estructura cambiaría.
  const normal = paginaAuto({ ...VEHICULO, id: r.json.id, imagenes: [fotoBuena] });
  assert.ok(estructura(normal).length > 60, 'la comparación revisa la página completa');
  assert.deepEqual(estructura(html), estructura(normal));
  assert.ok(html.includes('&#39; onmouseover=&#39;alert(4)'), 'la comilla del color queda escapada');

  const tags = scripts(html);
  assert.ok(tags.length >= 2);
  for (const t of tags) {
    assert.equal(t.attrs, ' type="application/ld+json"', 'solo bloques de datos, ningún script ejecutable');
    assert.doesNotMatch(t.cuerpo, /<|>/, 'el JSON-LD no contiene < ni >, no puede cerrar la etiqueta');
  }
  const auto = tags.map((t) => JSON.parse(t.cuerpo)).find((d) => d['@type'] === 'Car');
  assert.equal(auto.brand.name, ataques.marca, 'el dato se conserva exacto dentro del JSON');
  assert.deepEqual(auto.image, [fotoBuena], 'la foto javascript: no se publica');
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), 'se muestra como texto');
  await pool.execute('DELETE FROM vehiculos WHERE id = ?', [r.json.id]);
});

test('SEO: sitemap.xml lista portada, fichas disponibles y aviso; no lista vendidos', async () => {
  const vendido = await peticion('/api/admin/vehiculos', { method: 'POST', body: { ...VEHICULO, estado: 'vendido' }, conSesion: true });
  const r = await peticion('/sitemap.xml');
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type'), /^application\/xml/);
  assert.match(r.texto, /^<\?xml version="1\.0" encoding="UTF-8"\?>\n<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  assert.match(r.texto, /<loc>https:\/\/diegorodriguezautos\.com\/<\/loc>/);
  assert.match(r.texto, /<loc>https:\/\/diegorodriguezautos\.com\/aviso-de-privacidad<\/loc>/);
  for (const v of (await peticion('/api/vehiculos')).json) {
    assert.ok(r.texto.includes(`<loc>https://diegorodriguezautos.com${v.url}</loc>`), v.url);
  }
  assert.doesNotMatch(r.texto, new RegExp(`/autos/${vendido.json.id}-`));
  await pool.execute('DELETE FROM vehiculos WHERE id = ?', [vendido.json.id]);
});

test('SEO: robots.txt bloquea el admin, deja la API pública y anuncia el sitemap', async () => {
  const r = await peticion('/robots.txt');
  assert.equal(r.status, 200);
  assert.match(r.texto, /^Disallow: \/admin$/m);
  assert.match(r.texto, /^Disallow: \/api\/admin\/$/m);
  assert.doesNotMatch(r.texto, /^Disallow: \/api\/?$/m, 'Google necesita /api/vehiculos para ver el inventario');
  assert.match(r.texto, /^Sitemap: https:\/\/diegorodriguezautos\.com\/sitemap\.xml$/m);
  assert.match((await peticion('/admin')).headers.get('x-robots-tag'), /noindex/);
});

test('SEO: la portada tiene título, descripción, canónica y datos del negocio válidos', async () => {
  const html = (await peticion('/')).texto;
  assert.match(html, /<html lang="es-MX">/);
  assert.match(html, /<title>[^<]*BYD y Chevrolet[^<]*León[^<]*<\/title>/);
  const desc = html.match(/<meta name="description" content="([^"]+)">/)[1];
  assert.ok(desc.length <= 160, `descripción de ${desc.length} caracteres`);
  assert.match(html, /<link rel="canonical" href="https:\/\/diegorodriguezautos\.com\/">/);
  assert.match(html, /<h1[^>]*>[^<]*BYD y Chevrolet en León/);
  assert.match(html, /href="\/aviso-de-privacidad"/);
  const datos = JSON.parse(scripts(html).find((t) => t.attrs.includes('ld+json')).cuerpo);
  const negocio = datos['@graph'].find((d) => d['@type'] === 'AutoDealer');
  assert.equal(negocio.address.postalCode, '37530');
  assert.equal(negocio.address.addressLocality, 'León');
  assert.equal(negocio.telephone, '+52 477 732 1263');
});

test('Privacidad: el aviso existe, cita la ley vigente y tiene dirección fija', async () => {
  const r = await peticion('/aviso-de-privacidad');
  assert.equal(r.status, 200);
  for (const texto of ['Responsable', 'Finalidades', 'ARCO', 'Secretaría Anticorrupción y Buen Gobierno', 'Cookies', '20 días hábiles']) {
    assert.ok(r.texto.includes(texto), texto);
  }
  assert.doesNotMatch(r.texto, /INAI/, 'el INAI ya no existe');
  assert.match(r.texto, /<link rel="canonical" href="https:\/\/diegorodriguezautos\.com\/aviso-de-privacidad">/);
  const viejo = await peticion('/privacidad');
  assert.equal(viejo.status, 301);
  assert.equal(viejo.headers.get('location'), '/aviso-de-privacidad');
});

test('SEO: www redirige al dominio sin www y no sirve para mandar a otro sitio', async () => {
  const r = await conHost('/autos/1-x?a=1', 'www.diegorodriguezautos.com');
  assert.equal(r.status, 301);
  assert.equal(r.location, 'https://diegorodriguezautos.com/autos/1-x?a=1');
  const raro = await conHost('//sitio-malo.com/x', 'www.diegorodriguezautos.com');
  assert.equal(raro.status, 301);
  assert.match(raro.location, /^https:\/\/diegorodriguezautos\.com\/sitio-malo\.com\/x$/);
});

// ---------------------------------------------------------------
// Archivos privados
// ---------------------------------------------------------------

test('Archivos: .env, código del servidor y SQL no se pueden descargar', async () => {
  const rutas = ['/.env', '/.env.test', '/.env.example', '/server.js', '/src/db.js', '/package.json',
    '/db/schema.sql', '/.git/config', '/node_modules/express/package.json',
    '/css/../.env', '/css/%2e%2e/.env', '/css/..%2f..%2f.env', '/%2e%2e/server.js'];
  for (const ruta of rutas) {
    const r = await fetch(base + ruta);
    assert.equal(r.status, 404, ruta);
    assert.doesNotMatch(await r.text(), /DB_PASSWORD|SESSION_SECRET|require\(/, ruta);
  }
});

// Va al final porque bloquea la IP de prueba
test('Fuerza bruta: después de 5 intentos fallidos el login se bloquea', async () => {
  let ultimo;
  for (let i = 0; i < 7; i++) {
    ultimo = await peticion('/api/admin/login', { method: 'POST', body: { usuario: 'admin', password: `mala-${i}` } });
  }
  assert.equal(ultimo.status, 429);
  const correcto = await peticion('/api/admin/login', { method: 'POST', body: { usuario: 'admin', password: 'contraseña-de-prueba' } });
  assert.equal(correcto.status, 429, 'ni con la contraseña correcta mientras dure el bloqueo');
});
