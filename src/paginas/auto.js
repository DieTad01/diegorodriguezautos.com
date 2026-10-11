// =============================================================
// auto.js — ficha de un vehículo (/autos/12-nissan-versa-2021)
// Se arma en el servidor para que Google lea título, precio y
// fotos sin ejecutar JavaScript. Todos los datos pasan por esc().
// =============================================================
const { esc, urlHttps } = require('./html');
const { pagina } = require('./layout');
const { URL_SITIO, NEGOCIO, rutaAuto } = require('../sitio');

const precioMx = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
const numeroMx = new Intl.NumberFormat('es-MX');
const TRANSMISION = { automatica: 'Automática', manual: 'Manual' };

function nombreAuto(v) {
  return `${v.marca} ${v.modelo} ${v.anio}`;
}

function descripcionMeta(v) {
  const partes = [
    `${nombreAuto(v)}${v.version ? ` ${v.version}` : ''} en venta en ${NEGOCIO.ciudad}, ${NEGOCIO.estadoCorto}`,
    `${precioMx.format(v.precio)} MXN`,
    `${numeroMx.format(v.kilometraje)} km`,
    TRANSMISION[v.transmision],
  ];
  const texto = `${partes.join(' · ')}. Asesoría con ${NEGOCIO.asesor}, tel. ${NEGOCIO.telefonoVisible}.`;
  return texto.length > 160 ? `${texto.slice(0, 157).trimEnd()}…` : texto;
}

function datosEstructurados(v, fotos, url) {
  const auto = {
    '@context': 'https://schema.org',
    '@type': 'Car',
    name: `${nombreAuto(v)}${v.version ? ` ${v.version}` : ''}`,
    url,
    brand: { '@type': 'Brand', name: v.marca },
    model: v.modelo,
    vehicleModelDate: String(v.anio),
    mileageFromOdometer: { '@type': 'QuantitativeValue', value: v.kilometraje, unitCode: 'KMT' },
    vehicleTransmission: TRANSMISION[v.transmision],
    itemCondition: v.kilometraje === 0 ? 'https://schema.org/NewCondition' : 'https://schema.org/UsedCondition',
    offers: {
      '@type': 'Offer',
      price: v.precio,
      priceCurrency: 'MXN',
      availability: v.estado === 'apartado' ? 'https://schema.org/LimitedAvailability' : 'https://schema.org/InStock',
      url,
      seller: { '@id': `${URL_SITIO}/#negocio` },
    },
  };
  if (v.version) auto.vehicleConfiguration = v.version;
  if (v.color) auto.color = v.color;
  if (v.descripcion) auto.description = v.descripcion;
  if (fotos.length) auto.image = fotos;

  const migas = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: `${URL_SITIO}/` },
      { '@type': 'ListItem', position: 2, name: 'Inventario', item: `${URL_SITIO}/#inventario` },
      { '@type': 'ListItem', position: 3, name: nombreAuto(v), item: url },
    ],
  };
  return [auto, migas];
}

function paginaAuto(v) {
  const ruta = rutaAuto(v);
  const url = URL_SITIO + ruta;
  const fotos = v.imagenes.map(urlHttps).filter(Boolean);
  const nombre = nombreAuto(v);

  const galeria = fotos.length
    ? `<div class="galeria-carril">${fotos.map((f, i) => `
          <img src="${esc(f)}" alt="${esc(`${nombre} – foto ${i + 1}`)}" width="1600" height="1200"
            referrerpolicy="no-referrer" ${i === 0 ? 'fetchpriority="high"' : 'loading="lazy"'}>`).join('')}
        </div>
        ${fotos.length > 1 ? `<p class="ayuda">${fotos.length} fotos · desliza para ver más</p>` : ''}`
    : '<div class="galeria-vacia">Sin foto</div>';

  const datos = [
    `${numeroMx.format(v.kilometraje)} km`,
    TRANSMISION[v.transmision],
    v.color,
  ].filter(Boolean).map((d) => `<li>${esc(d)}</li>`).join('');

  const contenido = `
  <main class="contenedor ficha">
    <nav class="migas" aria-label="Ruta de navegación">
      <a href="/">Inicio</a> <span aria-hidden="true">›</span>
      <a href="/#inventario">Inventario</a> <span aria-hidden="true">›</span>
      <span aria-current="page">${esc(nombre)}</span>
    </nav>

    <div class="ficha-grid">
      <div class="ficha-galeria">${galeria}</div>

      <div class="ficha-info">
        ${v.estado === 'apartado' ? '<span class="etiqueta etiqueta-ficha">Apartado</span>' : ''}
        <h1>${esc(nombre)}</h1>
        ${v.version ? `<p class="vehiculo-version">${esc(v.version)}</p>` : ''}
        <p class="ficha-precio">${esc(precioMx.format(v.precio))}</p>
        <ul class="vehiculo-datos">${datos}</ul>
        <div class="hero-acciones">
          <a class="boton" href="tel:${NEGOCIO.telefono}">Me interesa · Llamar</a>
          <a class="boton secundario" href="${esc(NEGOCIO.mapa)}" target="_blank" rel="noopener noreferrer">Cómo llegar</a>
        </div>
        <p class="ficha-lugar">
          <span class="dato-etiqueta">Dónde verlo</span>
          ${esc(NEGOCIO.calle)}, C.P. ${esc(NEGOCIO.cp)}, ${esc(NEGOCIO.ciudad)}, ${esc(NEGOCIO.estadoCorto)}<br>
          Asesor Digital: ${esc(NEGOCIO.asesor)} · <a href="tel:${NEGOCIO.telefono}">${esc(NEGOCIO.telefonoVisible)}</a>
        </p>
      </div>
    </div>

    ${v.descripcion ? `
    <section class="ficha-descripcion">
      <h2>Descripción</h2>
      <p>${esc(v.descripcion)}</p>
    </section>` : ''}

    <p><a href="/#inventario">← Ver todo el inventario</a></p>
  </main>`;

  return pagina({
    titulo: `${nombre}${v.version ? ` ${v.version}` : ''} en ${NEGOCIO.ciudad} · ${precioMx.format(v.precio)} | ${NEGOCIO.asesor}`,
    descripcion: descripcionMeta(v),
    ruta,
    imagen: fotos[0],
    jsonLd: datosEstructurados(v, fotos, url),
    contenido,
  });
}

module.exports = { paginaAuto };
