// =============================================================
// comun.js — utilidades compartidas por app.js y admin.js
//
// REGLA contra inyección HTML (XSS): los datos SIEMPRE se ponen con
// textContent o propiedades (img.src = ...). Nunca con innerHTML,
// porque innerHTML interpreta "<script>" o "<img onerror=...>".
// =============================================================

const formatoPrecio = new Intl.NumberFormat('es-MX', {
  style: 'currency', currency: 'MXN', maximumFractionDigits: 0,
});
const formatoNumero = new Intl.NumberFormat('es-MX');

const TRANSMISION = { automatica: 'Automática', manual: 'Manual' };
const ESTADO = { disponible: 'Disponible', apartado: 'Apartado', vendido: 'Vendido' };

// Crea un elemento con texto (seguro: usa textContent)
function crear(etiqueta, texto, clase) {
  const el = document.createElement(etiqueta);
  if (texto !== undefined && texto !== null) el.textContent = texto;
  if (clase) el.className = clase;
  return el;
}

// Solo se aceptan URLs https para imágenes (el servidor ya las valida)
function urlSegura(url) {
  try {
    return new URL(url).protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

function titulo(v) {
  return `${v.marca} ${v.modelo} ${v.anio}`;
}

async function pedirJson(url, opciones = {}) {
  const resp = await fetch(url, {
    credentials: 'same-origin',
    ...opciones,
    headers: { Accept: 'application/json', ...(opciones.headers || {}) },
  });
  const datos = resp.status === 204 ? null : await resp.json().catch(() => null);
  if (!resp.ok) {
    const error = new Error((datos && datos.error) || `Error ${resp.status}`);
    error.status = resp.status;
    error.detalles = datos && Array.isArray(datos.detalles) ? datos.detalles : [];
    throw error;
  }
  return datos;
}
