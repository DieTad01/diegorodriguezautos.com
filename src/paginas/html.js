// =============================================================
// html.js — escapar datos antes de meterlos en HTML generado en
// el servidor. TODO dato que venga de la base de datos o del
// usuario pasa por esc() o jsonSeguro(): así "<script>" se muestra
// como texto y nunca se ejecuta (inyección HTML / XSS).
// =============================================================

const ENTIDADES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

function esc(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, (c) => ENTIDADES[c]);
}

// JSON dentro de <script type="application/ld+json">: se escapan < > &
// para que un dato con "</script>" no pueda cerrar la etiqueta.
function jsonSeguro(objeto) {
  return JSON.stringify(objeto)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/[\u2028\u2029]/g, (c) => `\\u${c.charCodeAt(0).toString(16)}`);
}

// Solo URLs https (las fotos ya se validan al guardar; esto es una
// segunda capa por si algo llegara directo a la base de datos)
function urlHttps(url) {
  try {
    return new URL(url).protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

module.exports = { esc, jsonSeguro, urlHttps };
