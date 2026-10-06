// =============================================================
// db.js — conexión a MySQL (corre en el SERVIDOR de Vercel)
// Nunca se manda al navegador, por eso aquí sí pueden ir
// las credenciales (leídas desde variables de entorno).
// =============================================================
const mysql = require('mysql2/promise');

// TODO: crea un pool de conexiones con mysql.createPool({ ... })
// Usa process.env para cada dato, NO escribas la contraseña aquí:
//   host     -> process.env.DB_HOST
//   port     -> process.env.DB_PORT
//   user     -> process.env.DB_USER
//   password -> process.env.DB_PASSWORD
//   database -> process.env.DB_NAME

// TODO: exporta el pool para usarlo en los archivos de /api
// module.exports = pool;
