// =============================================================
// vehiculos.js — todas las consultas SQL de vehículos
// Cada valor que viene del usuario va como parámetro (?), nunca
// pegado dentro del texto SQL.
// =============================================================
const pool = require('./db');
const { escaparLike } = require('./validacion');

const COLUMNAS = `id, marca, modelo, anio, version, precio, kilometraje, color,
  transmision, descripcion, estado`;

// Agrega a cada vehículo la lista de URLs de sus imágenes
async function conImagenes(vehiculos) {
  if (vehiculos.length === 0) return vehiculos;
  const ids = vehiculos.map((v) => v.id);
  // Un ? por cada id: (?, ?, ?) — los valores siguen yendo aparte
  const marcadores = ids.map(() => '?').join(', ');
  const [imagenes] = await pool.execute(
    `SELECT vehiculo_id, url FROM vehiculo_imagenes
     WHERE vehiculo_id IN (${marcadores})
     ORDER BY vehiculo_id, orden, id`,
    ids,
  );
  const porVehiculo = new Map(ids.map((id) => [id, []]));
  for (const img of imagenes) porVehiculo.get(img.vehiculo_id).push(img.url);
  return vehiculos.map((v) => ({ ...v, imagenes: porVehiculo.get(v.id) }));
}

// Inventario público: lo que no está vendido, con búsqueda opcional
async function listarPublicos({ busqueda } = {}) {
  let sql = `SELECT ${COLUMNAS} FROM vehiculos WHERE estado <> 'vendido'`;
  const params = [];
  if (busqueda) {
    sql += ` AND CONCAT_WS(' ', marca, modelo, version, anio) LIKE ?`;
    params.push(`%${escaparLike(busqueda)}%`);
  }
  sql += ' ORDER BY creado_en DESC, id DESC';
  const [filas] = await pool.execute(sql, params);
  return conImagenes(filas);
}

async function obtenerPublico(id) {
  const [filas] = await pool.execute(
    `SELECT ${COLUMNAS} FROM vehiculos WHERE id = ? AND estado <> 'vendido'`,
    [id],
  );
  const [vehiculo] = await conImagenes(filas);
  return vehiculo || null;
}

async function listarTodos() {
  const [filas] = await pool.execute(
    `SELECT ${COLUMNAS} FROM vehiculos ORDER BY creado_en DESC, id DESC`,
  );
  return conImagenes(filas);
}

async function guardarImagenes(conexion, vehiculoId, urls) {
  await conexion.execute('DELETE FROM vehiculo_imagenes WHERE vehiculo_id = ?', [vehiculoId]);
  for (const [orden, url] of urls.entries()) {
    await conexion.execute(
      'INSERT INTO vehiculo_imagenes (vehiculo_id, url, orden) VALUES (?, ?, ?)',
      [vehiculoId, url, orden],
    );
  }
}

function valores(d) {
  return [d.marca, d.modelo, d.anio, d.version, d.precio, d.kilometraje,
    d.color, d.transmision, d.descripcion, d.estado];
}

// Transacción: o se guarda el vehículo con todas sus imágenes, o nada
async function enTransaccion(trabajo) {
  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    const resultado = await trabajo(conexion);
    await conexion.commit();
    return resultado;
  } catch (err) {
    await conexion.rollback();
    throw err;
  } finally {
    conexion.release();
  }
}

async function crear(datos) {
  return enTransaccion(async (conexion) => {
    const [r] = await conexion.execute(
      `INSERT INTO vehiculos (marca, modelo, anio, version, precio, kilometraje,
         color, transmision, descripcion, estado)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      valores(datos),
    );
    await guardarImagenes(conexion, r.insertId, datos.imagenes);
    return r.insertId;
  });
}

async function actualizar(id, datos) {
  return enTransaccion(async (conexion) => {
    const [r] = await conexion.execute(
      `UPDATE vehiculos SET marca = ?, modelo = ?, anio = ?, version = ?, precio = ?,
         kilometraje = ?, color = ?, transmision = ?, descripcion = ?, estado = ?
       WHERE id = ?`,
      [...valores(datos), id],
    );
    if (r.affectedRows === 0) return false;
    await guardarImagenes(conexion, id, datos.imagenes);
    return true;
  });
}

async function eliminar(id) {
  const [r] = await pool.execute('DELETE FROM vehiculos WHERE id = ?', [id]);
  return r.affectedRows > 0;
}

module.exports = { listarPublicos, obtenerPublico, listarTodos, crear, actualizar, eliminar };
