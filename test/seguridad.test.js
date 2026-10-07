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

const { hashPassword } = require('../src/auth');

process.env.NODE_ENV = 'test';
process.env.ADMIN_USER = 'admin';
process.env.ADMIN_PASSWORD_HASH = hashPassword('contraseña-de-prueba');
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
  for (const tabla of ['pagos', 'ventas', 'clientes', 'vehiculo_imagenes', 'vehiculos']) {
    await pool.query(`TRUNCATE TABLE ${tabla}`);
  }
  await pool.query('SET FOREIGN_KEY_CHECKS = 1');

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
    assert.doesNotMatch(html, /<script>|<script(?![^>]*\ssrc=)[^>]*>|\son[a-z]+=|style=|javascript:/i, pagina);
  }
});

test('XSS: la CSP solo permite scripts propios', async () => {
  const r = await peticion('/');
  const csp = r.headers.get('content-security-policy');
  assert.match(csp, /script-src 'self'(;|$)/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval/);
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
  const [expira, firma] = valor.split('.');
  const falsas = [
    `${nombre}=9999999999999.abc`,
    `${nombre}=${Number(expira) + 1000000}.${firma}`,
    `${nombre}=${expira}.${firma.slice(0, -1)}${firma.endsWith('A') ? 'B' : 'A'}`,
    `${nombre}=${Date.now() - 1000}.${firma}`,
  ];
  for (const falsa of falsas) {
    const r = await fetch(`${base}/api/admin/vehiculos`, { headers: { Cookie: falsa } });
    assert.equal(r.status, 401, falsa);
  }
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
  assert.equal(tablas.length, 5, 'todas las tablas siguen existiendo');
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
