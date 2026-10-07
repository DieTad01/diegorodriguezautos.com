// =============================================================
// crear-admin.js — genera las líneas del .env para el administrador
//   npm run crear-admin
// Pide la contraseña sin mostrarla y sin dejarla en el historial.
// =============================================================
const crypto = require('crypto');
const readline = require('readline');
const { hashPassword } = require('../src/auth');

function preguntar(texto, oculto = false) {
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

(async () => {
  const usuario = (await preguntar('Usuario admin: ')).trim();
  const password = await preguntar('Contraseña (mín. 12 caracteres): ', true);
  const confirmacion = await preguntar('Repite la contraseña: ', true);

  if (!/^[A-Za-z0-9._-]{3,50}$/.test(usuario)) {
    console.error('Usuario inválido: usa 3-50 letras, números, punto, guion o guion bajo.');
    process.exit(1);
  }
  if (password.length < 12) {
    console.error('La contraseña debe tener al menos 12 caracteres.');
    process.exit(1);
  }
  if (password !== confirmacion) {
    console.error('Las contraseñas no coinciden.');
    process.exit(1);
  }

  console.log('\nCopia estas líneas en tu .env (reemplaza las que existan):\n');
  console.log(`ADMIN_USER=${usuario}`);
  console.log(`ADMIN_PASSWORD_HASH=${hashPassword(password)}`);
  console.log(`SESSION_SECRET=${crypto.randomBytes(32).toString('hex')}`);
  console.log('\nLuego reinicia: pm2 reload diegorodriguezautos');
})();
