// =============================================================
// db.js — conexión a MySQL (solo corre en el servidor)
// Las credenciales salen del .env, nunca se escriben aquí.
//
// REGLA DE ORO contra inyección SQL: los datos del usuario SIEMPRE
// van como parámetros (?) en pool.execute(sql, [valores]).
// Nunca armes el SQL concatenando texto: `... WHERE id = ${id}`.
// =============================================================
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  charset: 'utf8mb4',
  connectionLimit: 10,
  waitForConnections: true,
  // Un solo comando por consulta: impide "...; DROP TABLE ..."
  multipleStatements: false,
  // DECIMAL llega como número (precio) en lugar de texto
  decimalNumbers: true,
});

module.exports = pool;
