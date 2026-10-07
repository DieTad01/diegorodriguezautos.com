// =============================================================
// admin.js — panel de administración (corre en el NAVEGADOR)
// La seguridad real está en el servidor: aquí solo se arma la
// interfaz. Todos los datos se pintan con textContent.
// =============================================================

const $ = (id) => document.getElementById(id);
const seccionLogin = $('seccion-login');
const seccionPanel = $('seccion-panel');
const form = $('form-vehiculo');
const estadoPanel = $('estado-panel');

let vehiculos = [];
let editandoId = null;

const JSON_HEADERS = { 'Content-Type': 'application/json' };

// ---------- Sesión ----------

function mostrarLogin() {
  seccionPanel.hidden = true;
  $('btn-salir').hidden = true;
  seccionLogin.hidden = false;
  $('form-login').usuario.focus();
}

function mostrarPanel() {
  seccionLogin.hidden = true;
  seccionPanel.hidden = false;
  $('btn-salir').hidden = false;
  cargarVehiculos();
}

// Si la sesión expiró, cualquier petición devuelve 401
function manejarError(err, destino) {
  if (err.status === 401) {
    mostrarLogin();
    return;
  }
  destino.textContent = err.message;
}

$('form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const datos = new FormData(e.target);
  $('error-login').textContent = '';
  try {
    await pedirJson('/api/admin/login', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ usuario: datos.get('usuario'), password: datos.get('password') }),
    });
    e.target.reset();
    mostrarPanel();
  } catch (err) {
    $('error-login').textContent = err.message;
  }
});

$('btn-salir').addEventListener('click', async () => {
  await pedirJson('/api/admin/logout', { method: 'POST', headers: JSON_HEADERS, body: '{}' }).catch(() => {});
  mostrarLogin();
});

// ---------- Lista ----------

async function cargarVehiculos() {
  estadoPanel.textContent = 'Cargando…';
  try {
    vehiculos = await pedirJson('/api/admin/vehiculos');
    pintarTabla();
    estadoPanel.textContent = vehiculos.length ? '' : 'Aún no hay vehículos. Agrega el primero.';
  } catch (err) {
    manejarError(err, estadoPanel);
  }
}

function pintarTabla() {
  const filas = vehiculos.map((v) => {
    const fila = crear('tr');

    const celdaFoto = crear('td');
    const portada = urlSegura(v.imagenes[0]);
    if (portada) {
      const img = crear('img', null, 'miniatura');
      img.src = portada;
      img.alt = '';
      img.loading = 'lazy';
      img.referrerPolicy = 'no-referrer';
      celdaFoto.append(img);
    } else {
      celdaFoto.append(crear('span', 'Sin foto', 'sin-foto-chica'));
    }

    const celdaNombre = crear('td');
    celdaNombre.append(crear('strong', titulo(v)), crear('br'),
      crear('small', [v.version, `${v.imagenes.length} foto(s)`].filter(Boolean).join(' · ')));

    const celdaEstado = crear('td');
    celdaEstado.append(crear('span', ESTADO[v.estado], `estado-${v.estado}`));

    const editar = crear('button', 'Editar', 'secundario');
    editar.type = 'button';
    editar.addEventListener('click', () => abrirFormulario(v));
    const borrar = crear('button', 'Borrar', 'peligro');
    borrar.type = 'button';
    borrar.addEventListener('click', () => borrarVehiculo(v));
    const botones = crear('div', null, 'acciones');
    botones.append(editar, borrar);
    const celdaAcciones = crear('td');
    celdaAcciones.append(botones);

    fila.append(celdaFoto, celdaNombre, crear('td', formatoPrecio.format(v.precio)), celdaEstado, celdaAcciones);
    return fila;
  });
  $('tabla-vehiculos').replaceChildren(...filas);
}

async function borrarVehiculo(v) {
  if (!confirm(`¿Borrar ${titulo(v)}? Esta acción no se puede deshacer.`)) return;
  try {
    await pedirJson(`/api/admin/vehiculos/${encodeURIComponent(v.id)}`, { method: 'DELETE' });
    await cargarVehiculos();
  } catch (err) {
    manejarError(err, estadoPanel);
  }
}

// ---------- Formulario ----------

function abrirFormulario(v = null) {
  editandoId = v ? v.id : null;
  form.reset();
  $('titulo-form').textContent = v ? `Editar ${titulo(v)}` : 'Nuevo vehículo';
  $('errores-form').replaceChildren();
  $('previsualizacion').replaceChildren();
  form.anio.max = new Date().getFullYear() + 1;
  if (v) {
    for (const campo of ['marca', 'modelo', 'anio', 'version', 'precio', 'kilometraje',
      'color', 'transmision', 'estado', 'descripcion']) {
      form[campo].value = v[campo] ?? '';
    }
    form.imagenes.value = v.imagenes.join('\n');
  }
  form.hidden = false;
  form.scrollIntoView({ behavior: 'smooth' });
  form.marca.focus();
}

function cerrarFormulario() {
  form.hidden = true;
  editandoId = null;
}

function enlacesDelFormulario() {
  return form.imagenes.value.split('\n').map((l) => l.trim()).filter(Boolean);
}

function mostrarErrores(lista) {
  $('errores-form').replaceChildren(...lista.map((texto) => crear('li', texto)));
}

$('btn-nuevo').addEventListener('click', () => abrirFormulario());
$('btn-cancelar').addEventListener('click', cerrarFormulario);

$('btn-previsualizar').addEventListener('click', async () => {
  const contenedor = $('previsualizacion');
  const enlaces = enlacesDelFormulario();
  if (enlaces.length === 0) {
    contenedor.replaceChildren(crear('p', 'No hay enlaces para previsualizar.', 'ayuda'));
    return;
  }
  try {
    const resultados = await pedirJson('/api/admin/imagenes/previsualizar', {
      method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ urls: enlaces }),
    });
    contenedor.replaceChildren(...resultados.map((r, i) => {
      const figura = crear('figure');
      const pie = crear('figcaption', `${i + 1}${i === 0 ? ' · portada' : ''}`);
      const url = !r.error && urlSegura(r.url);
      if (url) {
        const img = crear('img');
        img.src = url;
        img.alt = `Imagen ${i + 1}`;
        img.referrerPolicy = 'no-referrer';
        img.addEventListener('error', () => {
          img.replaceWith(crear('span', 'No se pudo cargar. ¿Está compartida como "Cualquier persona con el enlace"?', 'error'));
        });
        figura.append(img);
      } else {
        figura.append(crear('span', `El enlace ${r.error}`, 'error'));
      }
      figura.append(pie);
      return figura;
    }));
  } catch (err) {
    manejarError(err, contenedor);
  }
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const datos = {
    marca: form.marca.value,
    modelo: form.modelo.value,
    anio: form.anio.value,
    version: form.version.value,
    precio: form.precio.value,
    kilometraje: form.kilometraje.value,
    color: form.color.value,
    transmision: form.transmision.value,
    estado: form.estado.value,
    descripcion: form.descripcion.value,
    imagenes: enlacesDelFormulario(),
  };
  const url = editandoId ? `/api/admin/vehiculos/${encodeURIComponent(editandoId)}` : '/api/admin/vehiculos';
  try {
    await pedirJson(url, {
      method: editandoId ? 'PUT' : 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(datos),
    });
    cerrarFormulario();
    await cargarVehiculos();
  } catch (err) {
    if (err.status === 401) return mostrarLogin();
    mostrarErrores(err.detalles.length ? err.detalles : [err.message]);
  }
});

// ---------- Arranque ----------

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await pedirJson('/api/admin/sesion');
    mostrarPanel();
  } catch {
    mostrarLogin();
  }
});
