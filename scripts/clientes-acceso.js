// =============================================================
// clientes-acceso.js — acceso de los CLIENTES (compradores) a
// "Mi cuenta" (https://diegorodriguezautos.com/mi-cuenta)
//
// En el VPS se usa a través de deploy/clientes-acceso.sh:
//   ... listar                    clientes, si tienen acceso y su saldo
//   ... agregar                   registra un cliente nuevo (nombre, correo, teléfono)
//   ... acceso <correo>           le da acceso con una contraseña TEMPORAL
//                                 (también sirve si la olvidó)
//   ... quitar-acceso <correo>    ya no puede entrar (sus datos se quedan)
//
// La contraseña se pide sin mostrarse y solo se guarda su huella scrypt.
// El cliente la cambia en "Mi cuenta → Cambiar mi contraseña".
// =============================================================
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const ARCHIVO_ENV = process.env.ENV_FILE || path.join(__dirname, '..', '.env');
require('dotenv').config({ path: ARCHIVO_ENV, quiet: true });

const { hashPassword, problemaConPassword } = require('../src/auth');
const pool = require('../src/db');

const CORREO_VALIDO = /^[^\s@]{1,64}@[^\s@]{1,100}\.[^\s@]{2,}$/;

let lineasEntrada = null;
function preguntar(texto, oculto = false) {
  if (!process.stdin.isTTY) {
    if (!lineasEntrada) lineasEntrada = fs.readFileSync(0, 'utf8').split(/\r?\n/);
    process.stdout.write(texto + (oculto ? '\n' : ''));
    return Promise.resolve(lineasEntrada.shift() ?? '');
  }
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (oculto) rl._writeToOutput = () => {};
    process.stdout.write(texto);
    rl.question('', (respuesta) => {
      rl.close();
      if (oculto) process.stdout.write('\n');
      resolve(respuesta);
    });
  });
}

class ErrorUso extends Error {}
const falla = (mensaje) => { throw new ErrorUso(mensaje); };
// eslint-disable-next-line no-control-regex
const limpio = (t) => String(t || '').replace(/[\u0000-\u001f\u007f]/g, '').trim();

async function pedirCorreo(dado) {
  const email = limpio(dado ?? await preguntar('Correo del cliente: ')).toLowerCase();
  if (!CORREO_VALIDO.test(email) || email.length > 120) falla('Correo inválido.');
  return email;
}

async function buscar(email) {
  const [filas] = await pool.execute('SELECT id, nombre, email, password_hash FROM clientes WHERE email = ?', [email]);
  return filas[0] || null;
}

async function listar() {
  const [filas] = await pool.query(
    `SELECT c.id, c.nombre, c.email, c.password_hash IS NOT NULL AS acceso, c.ultimo_acceso,
            COUNT(DISTINCT v.id) AS compras,
            COALESCE(SUM(v.precio_final), 0) - COALESCE((SELECT SUM(p.monto) FROM pagos p JOIN ventas v2 ON v2.id = p.venta_id WHERE v2.cliente_id = c.id), 0) AS saldo
     FROM clientes c LEFT JOIN ventas v ON v.cliente_id = c.id
     GROUP BY c.id ORDER BY c.id`,
  );
  if (filas.length === 0) {
    console.log('No hay clientes registrados. Agrega uno con: agregar');
    return;
  }
  const fecha = (f) => (f ? new Date(f).toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City' }) : 'nunca');
  const dinero = (n) => `$${Number(n).toLocaleString('es-MX', { maximumFractionDigits: 2 })}`;
  const tabla = [['ID', 'NOMBRE', 'CORREO', 'ACCESO', 'COMPRAS', 'SALDO', 'ÚLTIMO ACCESO'],
    ...filas.map((f) => [String(f.id), f.nombre, f.email || '(sin correo)', f.acceso ? 'sí' : 'no',
      String(f.compras), dinero(f.saldo), f.acceso ? fecha(f.ultimo_acceso) : '-'])];
  const anchos = tabla[0].map((_, i) => Math.max(...tabla.map((fila) => fila[i].length)));
  for (const fila of tabla) console.log(fila.map((c, i) => c.padEnd(anchos[i])).join('   ').trimEnd());
}

async function agregar() {
  const nombre = limpio(await preguntar('Nombre completo: ')).slice(0, 100);
  if (nombre.length < 2) falla('Falta el nombre.');
  const email = await pedirCorreo();
  if (await buscar(email)) falla(`Ya hay un cliente con el correo ${email}.`);
  const telefono = limpio(await preguntar('Teléfono (opcional, Enter para omitir): ')).replace(/[^\d+ -]/g, '').slice(0, 20);
  const [r] = await pool.execute('INSERT INTO clientes (nombre, telefono, email) VALUES (?, ?, ?)', [nombre, telefono || null, email]);
  console.log(`✔ Cliente '${nombre}' registrado con id ${r.insertId}. Para darle acceso: acceso ${email}`);
}

async function acceso(dado) {
  const email = await pedirCorreo(dado);
  const cliente = await buscar(email);
  if (!cliente) falla(`No hay ningún cliente con el correo ${email}. Revisa con: listar  (o regístralo con: agregar)`);
  const clave = await preguntar(`Contraseña TEMPORAL para ${cliente.nombre} (mínimo 12 caracteres): `, true);
  const repetida = await preguntar('Repítela: ', true);
  const problema = problemaConPassword(email.split('@')[0], clave);
  if (problema) falla(problema.replace('el nombre de usuario', 'su correo'));
  if (clave !== repetida) falla('No coinciden. No se cambió nada.');
  await pool.execute('UPDATE clientes SET password_hash = ?, sesiones_desde = ? WHERE id = ?', [hashPassword(clave), Date.now(), cliente.id]);
  console.log(`✔ ${cliente.nombre} ya puede entrar en https://diegorodriguezautos.com/mi-cuenta con ${email}.`);
  console.log('  Dale la contraseña temporal en persona o por llamada, y pídele que la cambie al entrar.');
}

async function quitarAcceso(dado) {
  const email = await pedirCorreo(dado);
  const cliente = await buscar(email);
  if (!cliente) falla(`No hay ningún cliente con el correo ${email}.`);
  await pool.execute('UPDATE clientes SET password_hash = NULL, sesiones_desde = ? WHERE id = ?', [Date.now(), cliente.id]);
  console.log(`✔ ${cliente.nombre} ya no puede entrar a Mi cuenta (sus compras y pagos se conservan).`);
}

const COMANDOS = {
  listar: () => listar(),
  agregar: () => agregar(),
  acceso: (e) => acceso(e),
  'quitar-acceso': (e) => quitarAcceso(e),
};

(async () => {
  const [comando = 'listar', arg] = process.argv.slice(2);
  try {
    if (!COMANDOS[comando]) falla(`Comando desconocido '${comando}'. Usa: ${Object.keys(COMANDOS).join(', ')}`);
    await COMANDOS[comando](arg);
  } catch (err) {
    process.exitCode = 1;
    if (err instanceof ErrorUso) console.error(`✘ ${err.message}`);
    else if (err.code === 'ER_BAD_FIELD_ERROR') console.error('✘ Faltan columnas en la tabla clientes. Corre primero deploy/actualizar.sh.');
    else if (err.code === 'ECONNREFUSED' || err.code === 'ER_ACCESS_DENIED_ERROR') console.error(`✘ No se pudo conectar a la base de datos (${err.code}).`);
    else console.error(err);
  } finally {
    await pool.end();
  }
})();
