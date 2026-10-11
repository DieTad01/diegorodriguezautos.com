// =============================================================
// app.js — página pública (corre en el NAVEGADOR)
// Aquí no hay conexión a MySQL: solo le pide datos a la API
// (/api/vehiculos) y los pinta en el HTML con textContent.
// =============================================================

const lista = document.getElementById('lista-vehiculos');
const estadoLista = document.getElementById('estado-lista');
const plantilla = document.getElementById('tpl-vehiculo');
const dialogo = document.getElementById('detalle');

// La API manda la dirección de la ficha (/autos/12-nissan-versa-2021); solo se acepta ese formato
function rutaFicha(url) {
  return typeof url === 'string' && /^\/autos\/\d+(-[a-z0-9-]+)?$/.test(url);
}

// 1) Pedir los vehículos a la API
async function cargarVehiculos(busqueda = '') {
  estadoLista.textContent = 'Cargando…';
  const params = busqueda ? `?${new URLSearchParams({ q: busqueda })}` : '';
  try {
    const vehiculos = await pedirJson(`/api/vehiculos${params}`);
    mostrarVehiculos(vehiculos);
    if (vehiculos.length === 0) {
      estadoLista.textContent = busqueda ? 'No hay autos que coincidan con tu búsqueda.' : 'Pronto tendremos autos disponibles.';
    } else {
      estadoLista.textContent = '';
    }
  } catch {
    lista.replaceChildren();
    estadoLista.textContent = 'No se pudo cargar el inventario. Intenta de nuevo más tarde.';
  }
}

// 2) Pintar los vehículos en el HTML
function mostrarVehiculos(vehiculos) {
  const tarjetas = vehiculos.map((v) => {
    const tarjeta = plantilla.content.firstElementChild.cloneNode(true);
    const img = tarjeta.querySelector('img');
    const portada = urlSegura(v.imagenes[0]);
    if (portada) {
      img.src = portada;
      img.alt = titulo(v);
      tarjeta.querySelector('.sin-foto').remove();
    } else {
      img.remove();
    }
    if (v.estado === 'apartado') {
      const etiqueta = tarjeta.querySelector('.etiqueta');
      etiqueta.textContent = ESTADO.apartado;
      etiqueta.hidden = false;
    }
    const enlace = tarjeta.querySelector('.vehiculo-titulo a');
    enlace.textContent = titulo(v);
    if (rutaFicha(v.url)) enlace.href = v.url;
    tarjeta.querySelector('.vehiculo-version').textContent = v.version || '';
    tarjeta.querySelector('.vehiculo-precio').textContent = formatoPrecio.format(v.precio);
    tarjeta.querySelector('.dato-km').textContent = `${formatoNumero.format(v.kilometraje)} km`;
    tarjeta.querySelector('.dato-transmision').textContent = TRANSMISION[v.transmision] || '';
    const color = tarjeta.querySelector('.dato-color');
    if (v.color) color.textContent = v.color;
    else color.remove();
    tarjeta.querySelector('.vehiculo-foto').addEventListener('click', () => abrirDetalle(v));
    return tarjeta;
  });
  lista.replaceChildren(...tarjetas);
}

// 3) Ventana con todas las fotos y la descripción
function abrirDetalle(v) {
  const foto = dialogo.querySelector('.detalle-foto');
  const miniaturas = dialogo.querySelector('.detalle-miniaturas');
  const urls = v.imagenes.map(urlSegura).filter(Boolean);

  foto.hidden = urls.length === 0;
  if (urls.length) {
    foto.src = urls[0];
    foto.alt = titulo(v);
  }
  miniaturas.replaceChildren(...(urls.length > 1 ? urls.map((url, i) => {
    const boton = crear('button');
    boton.type = 'button';
    boton.setAttribute('aria-label', `Foto ${i + 1}`);
    const mini = crear('img');
    mini.src = url;
    mini.alt = '';
    mini.loading = 'lazy';
    mini.referrerPolicy = 'no-referrer';
    boton.append(mini);
    boton.addEventListener('click', () => { foto.src = url; });
    return boton;
  }) : []));

  dialogo.querySelector('.detalle-titulo').textContent = `${titulo(v)}${v.version ? ` · ${v.version}` : ''}`;
  dialogo.querySelector('.detalle-precio').textContent = formatoPrecio.format(v.precio);
  dialogo.querySelector('.detalle-datos').replaceChildren(
    crear('li', `${formatoNumero.format(v.kilometraje)} km`),
    crear('li', TRANSMISION[v.transmision] || ''),
    ...(v.color ? [crear('li', v.color)] : []),
    crear('li', ESTADO[v.estado] || ''),
  );
  dialogo.querySelector('.detalle-descripcion').textContent = v.descripcion || '';
  const ficha = dialogo.querySelector('.detalle-ficha');
  ficha.hidden = !rutaFicha(v.url);
  if (!ficha.hidden) ficha.href = v.url;
  dialogo.showModal();
}

dialogo.querySelector('.cerrar').addEventListener('click', () => dialogo.close());
dialogo.addEventListener('click', (e) => {
  if (e.target === dialogo) dialogo.close();
});

document.getElementById('form-busqueda').addEventListener('submit', (e) => {
  e.preventDefault();
  cargarVehiculos(document.getElementById('busqueda').value.trim());
});

// 4) Arrancar cuando la página termine de cargar
document.addEventListener('DOMContentLoaded', () => {
  cargarVehiculos();
});
