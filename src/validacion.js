// =============================================================
// validacion.js — revisa TODO lo que llega del navegador antes
// de tocar la base de datos. Lista blanca: solo se aceptan los
// campos, tipos y tamaños que esperamos; lo demás se rechaza.
// =============================================================

const ESTADOS = ['disponible', 'apartado', 'vendido'];
const TRANSMISIONES = ['automatica', 'manual'];
const MAX_IMAGENES = 15;

// Caracteres de control invisibles (menos tab y salto de línea)
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁦-⁩]/g;

function limpiarTexto(valor, { multilinea = false } = {}) {
  let texto = valor.normalize('NFC').replace(CONTROL, '');
  if (!multilinea) texto = texto.replace(/[\r\n\t]+/g, ' ');
  return texto.trim();
}

function texto(body, campo, errores, { max, requerido = false, multilinea = false }) {
  const valor = body[campo];
  if (valor === undefined || valor === null || valor === '') {
    if (requerido) errores.push(`${campo} es obligatorio`);
    return null;
  }
  if (typeof valor !== 'string') {
    errores.push(`${campo} debe ser texto`);
    return null;
  }
  const limpio = limpiarTexto(valor, { multilinea });
  if (requerido && limpio === '') errores.push(`${campo} es obligatorio`);
  if (limpio.length > max) errores.push(`${campo} admite máximo ${max} caracteres`);
  return limpio === '' ? null : limpio;
}

function entero(body, campo, errores, { min, max }) {
  const valor = body[campo];
  const cadena = typeof valor === 'number' || typeof valor === 'string' ? String(valor).trim() : '';
  if (!/^\d{1,10}$/.test(cadena) || Number(cadena) < min || Number(cadena) > max) {
    errores.push(`${campo} debe ser un número entero entre ${min} y ${max}`);
    return null;
  }
  return Number(cadena);
}

function opcion(body, campo, errores, opciones) {
  const valor = body[campo];
  if (!opciones.includes(valor)) {
    errores.push(`${campo} debe ser uno de: ${opciones.join(', ')}`);
    return null;
  }
  return valor;
}

// IDs de la URL (/vehiculos/:id): solo dígitos, nada de "1 OR 1=1"
function parsearId(valor) {
  if (typeof valor !== 'string' || !/^[1-9]\d{0,9}$/.test(valor)) return null;
  const id = Number(valor);
  return id <= 4294967295 ? id : null;
}

// En LIKE, % y _ son comodines: se escapan para que se busquen literal
function escaparLike(texto) {
  return texto.replace(/[\\%_]/g, '\\$&');
}

// ---------- Imágenes (Google Drive u otro enlace https) ----------

const DRIVE_ID = /^[A-Za-z0-9_-]{10,200}$/;

function idDeGoogleDrive(url) {
  const host = url.hostname.toLowerCase();
  if (host === 'drive.google.com' || host === 'docs.google.com') {
    if (/^\/drive\/(u\/\d+\/)?folders\//.test(url.pathname)) return { carpeta: true };
    const enRuta = url.pathname.match(/^\/file\/d\/([^/]+)/);
    const id = enRuta ? enRuta[1] : url.searchParams.get('id');
    return id ? { id } : {};
  }
  if (host === 'lh3.googleusercontent.com') {
    const m = url.pathname.match(/^\/d\/([^/=]+)/);
    return m ? { id: m[1] } : {};
  }
  return null;
}

// Convierte el enlace pegado por el admin en una URL segura para <img>.
// Devuelve { url } o { error }.
function normalizarUrlImagen(entrada) {
  if (typeof entrada !== 'string') return { error: 'debe ser texto' };
  const texto = entrada.trim();
  if (texto === '') return { error: 'está vacía' };
  if (texto.length > 500) return { error: 'es demasiado larga' };

  let url;
  try {
    url = new URL(texto);
  } catch {
    return { error: 'no es un enlace válido' };
  }
  // Bloquea javascript:, data:, file:, http: (sin cifrar), etc.
  if (url.protocol !== 'https:') return { error: 'debe empezar con https://' };
  if (url.username || url.password) return { error: 'no debe incluir usuario o contraseña' };

  const drive = idDeGoogleDrive(url);
  if (drive) {
    if (drive.carpeta) return { error: 'es una carpeta de Drive; comparte cada imagen por separado' };
    if (!drive.id || !DRIVE_ID.test(drive.id)) return { error: 'no se encontró el ID del archivo de Drive' };
    // Enlace de miniatura de Drive: se puede mostrar directo en <img>
    return { url: `https://drive.google.com/thumbnail?id=${drive.id}&sz=w1600` };
  }
  return { url: url.href };
}

function imagenes(body, errores) {
  const lista = body.imagenes === undefined ? [] : body.imagenes;
  if (!Array.isArray(lista)) {
    errores.push('imagenes debe ser una lista de enlaces');
    return [];
  }
  if (lista.length > MAX_IMAGENES) {
    errores.push(`máximo ${MAX_IMAGENES} imágenes por vehículo`);
    return [];
  }
  const urls = [];
  lista.forEach((entrada, i) => {
    const r = normalizarUrlImagen(entrada);
    if (r.error) errores.push(`Imagen ${i + 1}: el enlace ${r.error}`);
    else urls.push(r.url);
  });
  return urls;
}

function validarVehiculo(body) {
  const errores = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { errores: ['Se esperaba un objeto JSON'] };
  }
  const anioMax = new Date().getFullYear() + 1;
  const datos = {
    marca: texto(body, 'marca', errores, { max: 50, requerido: true }),
    modelo: texto(body, 'modelo', errores, { max: 60, requerido: true }),
    anio: entero(body, 'anio', errores, { min: 1950, max: anioMax }),
    version: texto(body, 'version', errores, { max: 80 }),
    precio: null,
    kilometraje: entero(body, 'kilometraje', errores, { min: 0, max: 2000000 }),
    color: texto(body, 'color', errores, { max: 30 }),
    transmision: opcion(body, 'transmision', errores, TRANSMISIONES),
    descripcion: texto(body, 'descripcion', errores, { max: 2000, multilinea: true }),
    estado: opcion(body, 'estado', errores, ESTADOS),
    imagenes: imagenes(body, errores),
  };

  const precio = typeof body.precio === 'number' || typeof body.precio === 'string'
    ? String(body.precio).trim() : '';
  if (/^\d{1,10}(\.\d{1,2})?$/.test(precio) && Number(precio) <= 9999999999.99) {
    datos.precio = Number(precio);
  } else {
    errores.push('precio debe ser un número positivo con máximo 2 decimales');
  }

  return errores.length ? { errores } : { datos };
}

module.exports = {
  ESTADOS,
  MAX_IMAGENES,
  limpiarTexto,
  parsearId,
  escaparLike,
  normalizarUrlImagen,
  validarVehiculo,
};
