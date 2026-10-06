// =============================================================
// app.js — corre en el NAVEGADOR
// Aquí NO hay conexión a MySQL. Solo le pide datos a tu API
// (/api/vehiculos) y los pinta en el HTML.
// =============================================================

// 1) Pedir los vehículos a la API
async function cargarVehiculos() {
  // TODO: usa fetch('/api/vehiculos') y conviértelo a JSON
  // TODO: llama a mostrarVehiculos() con el resultado
}

// 2) Pintar los vehículos en el HTML
function mostrarVehiculos(vehiculos) {
  const contenedor = document.getElementById('lista-vehiculos');

  // TODO: recorre el arreglo y por cada vehículo crea un <div class="vehiculo">
}

// 3) Arrancar cuando la página termine de cargar
document.addEventListener('DOMContentLoaded', () => {
  cargarVehiculos();
});
