// =============================================================
// usuarios-admin.js — cuentas del panel /admin (una por persona)
//
// En el VPS se usa a través de deploy/usuarios-admin.sh:
//   bash /var/www/diegorodriguezautos.com/deploy/usuarios-admin.sh listar
//   ... agregar [usuario]          crea una cuenta (pide nombre y contraseña)
//   ... contrasena [usuario]       cambia la contraseña y cierra sus sesiones
//   ... cerrar-sesiones <usuario>  saca a esa persona de todos sus dispositivos
//   ... quitar <usuario>           borra la cuenta (no deja borrar la última)
//
// Las contraseñas se piden sin mostrarse y nunca se guardan: solo su
// huella scrypt. Nada de esto queda en el historial de la terminal.
// =============================================================
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const RAIZ = path.join(__dirname, '..');
const ARCHIVO_ENV = process.env.ENV_FILE || path.join(RAIZ, '.env');
require('dotenv').config({ path: ARCHIVO_ENV, quiet: true });

const { hashPassword, problemaConPassword, migrarLegado } = require('../src/auth');
const pool = require('../src/db');

const USUARIO_VALIDO = /^[A-Za-z0-9._-]{3,50}$/;

// ---------- Preguntas en la terminal ----------
// Con teclado: una pregunta a la vez, la contraseña sin eco.
// Sin teclado (pruebas automáticas): lee las respuestas línea por línea.
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

async function pedirUsuario(dado) {
  const usuario = (dado ?? await preguntar('Usuario (3-50 letras, números, . _ -): ')).trim();
  if (!USUARIO_VALIDO.test(usuario)) falla('Usuario inválido: usa 3-50 letras, números, punto, guion o guion bajo (sin espacios ni acentos).');
  return usuario;
}

async function pedirClave(usuario) {
  const clave = await preguntar(`Contraseña para ${usuario} (mínimo 12 caracteres): `, true);
  const repetida = await preguntar('Repite la contraseña: ', true);
  const problema = problemaConPassword(usuario, clave);
  if (problema) falla(problema);
  if (clave !== repetida) falla('Las contraseñas no coinciden. No se cambió nada.');
  return hashPassword(clave);
}

async function buscar(usuario) {
  const [filas] = await pool.execute('SELECT id, usuario FROM administradores WHERE usuario = ?', [usuario]);
  return filas[0] || null;
}

async function total() {
  const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM administradores');
  return Number(n);
}

// Si no se dio usuario y solo hay una cuenta, se usa esa
async function usuarioExistente(dado) {
  if (!dado) {
    const [filas] = await pool.query('SELECT usuario FROM administradores ORDER BY id LIMIT 2');
    if (filas.length === 1) {
      console.log(`Cuenta: ${filas[0].usuario}`);
      return filas[0].usuario;
    }
    await listar();
  }
  const usuario = await pedirUsuario(dado);
  if (!(await buscar(usuario))) falla(`No existe la cuenta '${usuario}'. Revisa con: listar`);
  return usuario;
}

// ---------- Comandos ----------

async function listar() {
  const [filas] = await pool.query(
    'SELECT usuario, nombre, ultimo_acceso, creado_en FROM administradores ORDER BY id',
  );
  if (filas.length === 0) {
    console.log('No hay cuentas del panel. Crea una con: agregar');
    return;
  }
  const fecha = (f) => (f ? new Date(f).toLocaleString('es-MX', { timeZone: 'America/Mexico_City' }) : 'nunca');
  const tabla = [['USUARIO', 'NOMBRE', 'ÚLTIMO ACCESO', 'CREADA'],
    ...filas.map((f) => [f.usuario, f.nombre || '-', fecha(f.ultimo_acceso), fecha(f.creado_en)])];
  const anchos = tabla[0].map((_, i) => Math.max(...tabla.map((fila) => fila[i].length)));
  for (const fila of tabla) console.log(fila.map((celda, i) => celda.padEnd(anchos[i])).join('   ').trimEnd());
}

async function agregar(dado) {
  const usuario = await pedirUsuario(dado);
  if (await buscar(usuario)) falla(`La cuenta '${usuario}' ya existe. Para cambiar su contraseña usa: contrasena ${usuario}`);
  // eslint-disable-next-line no-control-regex
  const nombre = (await preguntar('Nombre de la persona (opcional, Enter para omitir): ')).replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 100);
  const hash = await pedirClave(usuario);
  await pool.execute(
    'INSERT INTO administradores (usuario, nombre, password_hash, sesiones_desde) VALUES (?, ?, ?, ?)',
    [usuario, nombre || null, hash, Date.now()],
  );
  console.log(`✔ Cuenta '${usuario}' creada. Ya puede entrar en /admin.`);
}

async function contrasena(dado) {
  const usuario = await usuarioExistente(dado);
  const hash = await pedirClave(usuario);
  await pool.execute(
    'UPDATE administradores SET password_hash = ?, sesiones_desde = ? WHERE usuario = ?',
    [hash, Date.now(), usuario],
  );
  console.log(`✔ Contraseña de '${usuario}' cambiada. Sus sesiones abiertas se cerraron; las de otras cuentas siguen igual.`);
}

async function cerrarSesiones(dado) {
  const usuario = await usuarioExistente(dado);
  await pool.execute('UPDATE administradores SET sesiones_desde = ? WHERE usuario = ?', [Date.now(), usuario]);
  console.log(`✔ Se cerraron todas las sesiones de '${usuario}' (en todos sus dispositivos).`);
}

async function quitar(dado) {
  if (!dado) falla('Indica qué cuenta borrar, por ejemplo: quitar cliente');
  const usuario = await usuarioExistente(dado);
  if ((await total()) <= 1) falla('Es la única cuenta: no se puede borrar (te quedarías sin acceso). Crea otra primero.');
  const confirmacion = (await preguntar(`Escribe '${usuario}' para confirmar que la borras: `)).trim();
  if (confirmacion !== usuario) falla('No coincide. No se borró nada.');
  await pool.execute('DELETE FROM administradores WHERE usuario = ?', [usuario]);
  console.log(`✔ Cuenta '${usuario}' borrada. Si tenía una sesión abierta, ya no sirve.`);
}

// Pasa el usuario de la versión anterior (.env) a la tabla. También lo hace
// el sitio al arrancar y este script antes de cualquier comando.
async function migrar() {
  const usuario = await migrarLegado();
  if (usuario) console.log(`✔ La cuenta '${usuario}' ahora vive en la base de datos (misma contraseña).`);
}

// ---------- Inicio ----------

const COMANDOS = {
  listar: () => listar(),
  agregar: (u) => agregar(u),
  contrasena: (u) => contrasena(u),
  'cerrar-sesiones': (u) => cerrarSesiones(u),
  quitar: (u) => quitar(u),
  migrar: () => migrar(),
  'hay-alguno': async () => { process.exitCode = (await total()) > 0 ? 0 : 1; },
};

(async () => {
  const [comando = 'listar', usuario] = process.argv.slice(2);
  const accion = COMANDOS[comando];
  try {
    if (!accion) falla(`Comando desconocido '${comando}'. Usa: ${Object.keys(COMANDOS).filter((c) => c !== 'hay-alguno').join(', ')}`);
    // Primero, la cuenta de la versión anterior (si la hay): así crear otra
    // cuenta nunca deja fuera a quien entraba con el .env
    await migrar();
    await accion(usuario);
  } catch (err) {
    process.exitCode = 1;
    if (err instanceof ErrorUso) console.error(`✘ ${err.message}`);
    else if (err.code === 'ER_NO_SUCH_TABLE') console.error('✘ Falta la tabla administradores. Corre primero deploy/actualizar.sh (o carga db/schema.sql).');
    else if (err.code === 'ECONNREFUSED' || err.code === 'ER_ACCESS_DENIED_ERROR') console.error(`✘ No se pudo conectar a la base de datos (${err.code}). Revisa que esté encendida y el .env.`);
    else console.error(err);
  } finally {
    await pool.end();
  }
})();
