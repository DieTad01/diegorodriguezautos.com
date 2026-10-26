// =============================================================
// mi-cuenta.js — "Mi cuenta" de los clientes: entrar, ver compras,
// pagos y saldo, y cambiar la propia contraseña. Solo lectura.
// Todos los datos se ponen con textContent (nunca innerHTML).
// =============================================================

const $ = (id) => document.getElementById(id);
const JSON_HEADERS = { 'Content-Type': 'application/json' };
const METODO = { efectivo: 'Efectivo', transferencia: 'Transferencia', tarjeta: 'Tarjeta', financiamiento: 'Financiamiento' };
const dinero = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 });
const fechaLarga = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

function formatoFecha(texto) {
  const f = new Date(`${texto}T00:00:00Z`);
  return Number.isNaN(f.getTime()) ? texto : fechaLarga.format(f);
}

// ---------- Sesión ----------

function mostrarLogin() {
  $('seccion-cuenta').hidden = true;
  $('btn-salir').hidden = true;
  $('seccion-login').hidden = false;
  cerrarFormContrasena();
  $('form-login').email.focus();
}

function manejarError(err, destino) {
  if (err.status === 401) return mostrarLogin();
  destino.textContent = err.message;
}

async function cargarCuenta() {
  try {
    const datos = await pedirJson('/api/cliente/estado');
    pintar(datos);
    $('seccion-login').hidden = true;
    $('seccion-cuenta').hidden = false;
    $('btn-salir').hidden = false;
  } catch (err) {
    if (err.status === 401) mostrarLogin();
    else {
      $('seccion-login').hidden = false;
      $('error-login').textContent = err.message;
    }
  }
}

$('form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const datos = new FormData(e.target);
  $('error-login').textContent = '';
  try {
    await pedirJson('/api/cliente/login', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ email: datos.get('email'), password: datos.get('password') }),
    });
    e.target.reset();
    await cargarCuenta();
  } catch (err) {
    $('error-login').textContent = err.message;
  }
});

$('btn-salir').addEventListener('click', async () => {
  await pedirJson('/api/cliente/logout', { method: 'POST', headers: JSON_HEADERS, body: '{}' }).catch(() => {});
  mostrarLogin();
});

// ---------- Mostrar compras y pagos ----------

function celda(tr, etiqueta, texto, clase) {
  const td = crear('td', texto, clase);
  td.setAttribute('data-etiqueta', etiqueta); // para la vista en celular
  tr.append(td);
  return td;
}

function pintar({ cliente, compras, pagos }) {
  const nombre = (cliente && cliente.nombre) || '';
  $('saludo').textContent = nombre ? `Hola, ${nombre.split(' ')[0]}` : 'Mi cuenta';
  $('correo-cliente').textContent = (cliente && cliente.email) || '';

  const total = compras.reduce((s, c) => s + Number(c.precio_final), 0);
  const pagado = compras.reduce((s, c) => s + Number(c.pagado), 0);
  const saldo = compras.reduce((s, c) => s + Number(c.saldo), 0);
  $('total-compras').textContent = dinero.format(total);
  $('total-pagado').textContent = dinero.format(pagado);
  $('total-saldo').textContent = dinero.format(saldo);
  $('total-saldo').closest('.dato').classList.toggle('liquidado', saldo <= 0);

  const autoDeVenta = new Map();
  const cuerpoCompras = $('tabla-compras').querySelector('tbody');
  cuerpoCompras.replaceChildren();
  for (const c of compras) {
    const auto = `${c.marca} ${c.modelo} ${c.anio}${c.version ? ` ${c.version}` : ''}`;
    autoDeVenta.set(c.venta, `${c.marca} ${c.modelo}`);
    const tr = document.createElement('tr');
    celda(tr, 'Vehículo', auto, 'principal');
    celda(tr, 'Fecha', formatoFecha(c.fecha));
    celda(tr, 'Precio', dinero.format(c.precio_final));
    celda(tr, 'Pagado', dinero.format(c.pagado));
    const td = celda(tr, 'Saldo', c.saldo > 0 ? dinero.format(c.saldo) : 'Liquidado');
    td.classList.add(c.saldo > 0 ? 'pendiente' : 'pagado');
    cuerpoCompras.append(tr);
  }
  $('sin-compras').hidden = compras.length > 0;
  $('tabla-compras').closest('.tabla-scroll').hidden = compras.length === 0;

  const cuerpoPagos = $('tabla-pagos').querySelector('tbody');
  cuerpoPagos.replaceChildren();
  for (const p of pagos) {
    const tr = document.createElement('tr');
    celda(tr, 'Fecha', formatoFecha(p.fecha), 'principal');
    celda(tr, 'Vehículo', autoDeVenta.get(p.venta) || `Compra ${p.venta}`);
    celda(tr, 'Método', METODO[p.metodo] || p.metodo);
    celda(tr, 'Monto', dinero.format(p.monto));
    cuerpoPagos.append(tr);
  }
  $('sin-pagos').hidden = pagos.length > 0;
  $('tabla-pagos').closest('.tabla-scroll').hidden = pagos.length === 0;
}

// ---------- Cambiar mi contraseña ----------

const formContrasena = $('form-contrasena');

function cerrarFormContrasena() {
  formContrasena.reset();
  formContrasena.hidden = true;
  $('error-contrasena').textContent = '';
}

$('btn-contrasena').addEventListener('click', () => {
  formContrasena.hidden = false;
  formContrasena.actual.focus();
});
$('btn-cancelar-contrasena').addEventListener('click', cerrarFormContrasena);

formContrasena.addEventListener('submit', async (e) => {
  e.preventDefault();
  const { actual, nueva, repetida } = formContrasena;
  $('error-contrasena').textContent = '';
  if (nueva.value !== repetida.value) {
    $('error-contrasena').textContent = 'La contraseña nueva y su repetición no coinciden.';
    return;
  }
  try {
    await pedirJson('/api/cliente/contrasena', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ actual: actual.value, nueva: nueva.value }),
    });
    cerrarFormContrasena();
    $('estado-cuenta').textContent = 'Contraseña cambiada. Úsala la próxima vez que entres.';
  } catch (err) {
    manejarError(err, $('error-contrasena'));
  }
});

// ---------- Arranque ----------

document.addEventListener('DOMContentLoaded', cargarCuenta);
