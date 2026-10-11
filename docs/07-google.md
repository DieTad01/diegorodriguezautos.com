# 7. Aparecer en Google

[← Volver al índice](README.md)

El código ya tiene todo lo técnico para que Google entienda el sitio. Pero **Google no encuentra un sitio nuevo de inmediato**: hay pasos que solo puedes hacer tú desde tus cuentas. Esta guía los pone en orden.

## Lo que ya hace el sitio

| Qué | Para qué sirve | Dónde |
|---|---|---|
| Título y descripción de cada página, con "BYD", "Chevrolet" y "León" | Es el texto azul y gris que sale en los resultados de Google | `public/index.html`, `src/paginas/` |
| **Una página por auto** (`/autos/12-nissan-versa-2021`) | Cada auto puede salir solo en Google cuando alguien busca "Nissan Versa 2021 León". Se arma en el servidor para que Google la lea sin JavaScript | `src/paginas/auto.js` |
| `sitemap.xml` automático | Lista para Google de todas las páginas; se actualiza solo al agregar, editar o vender autos | `/sitemap.xml` |
| `robots.txt` | Le dice a Google qué no revisar (el panel admin) y dónde está el sitemap | `public/robots.txt` |
| Datos estructurados (schema.org) | Le dice a Google, en su idioma, quién eres (AutoDealer), dirección, teléfono, marcas, y de cada auto: precio, kilometraje, año y si está disponible | `public/index.html`, `src/paginas/auto.js` |
| Dirección canónica | Evita que Google vea páginas repetidas (`www.` se redirige a sin `www`; una sola dirección por auto) | `src/app.js`, `src/routes/paginas.js` |
| Autos vendidos responden "no encontrado" (404) | Google los quita de los resultados en lugar de mandar clientes a un auto que ya no está | `src/routes/paginas.js` |
| Vista previa al compartir (Open Graph) | Imagen y texto al pegar el link en WhatsApp/Facebook; cada auto muestra su primera foto | Todas las páginas |
| HTTPS, compresión, caché, imágenes diferidas | La velocidad y la seguridad cuentan para el ranking | `deploy/nginx.conf`, `src/app.js` |
| Diseño para celular | Google evalúa primero la versión de celular | `public/css/styles.css` |
| Aviso de privacidad | Requisito legal y señal de confianza | `/aviso-de-privacidad` |

## Lo que tienes que hacer tú (en este orden)

### 1. Publicar el sitio con HTTPS

Sigue [4. Instalación en el VPS](04-instalacion-vps.md) hasta el paso 9. Comprueba que `https://diegorodriguezautos.com` abre con el candado y que `https://diegorodriguezautos.com/sitemap.xml` muestra la lista.

### 2. Google Search Console (lo más importante)

Es la herramienta gratuita de Google para avisarle que tu sitio existe y ver cómo te encuentra la gente.

1. Entra a [search.google.com/search-console](https://search.google.com/search-console) con tu cuenta de Google.
2. **Agregar propiedad** → elige **Dominio** → escribe `diegorodriguezautos.com`.
3. Google te da un registro **TXT**. En Hostinger: **Dominios → diegorodriguezautos.com → DNS** → *Agregar registro* → Tipo `TXT`, Nombre `@`, Valor: el texto de Google. Guarda.
4. Regresa a Search Console y presiona **Verificar** (si falla, espera unos minutos: el DNS tarda en propagarse).
5. Menú **Sitemaps** → escribe `sitemap.xml` → **Enviar**.
6. Menú **Inspección de URLs** → pega `https://diegorodriguezautos.com/` → **Solicitar indexación**. Haz lo mismo con 2 o 3 fichas de autos.

> Con la verificación por DNS no hay que tocar el código. Cubre también `www` y `http`.

**Cuánto tarda:** normalmente de unos días a un par de semanas en aparecer. En Search Console → *Rendimiento* verás con qué búsquedas te encuentran.

### 3. Bing (Bing, Copilot, DuckDuckGo, Yahoo)

En [bing.com/webmasters](https://www.bing.com/webmasters) → **Importar desde Google Search Console**. Toma 2 minutos y copia todo (incluido el sitemap).

### 4. Google Maps / Perfil de Negocio (búsquedas "cerca de mí")

Las búsquedas locales ("agencia Chevrolet León", "BYD cerca de mí") las domina el **Perfil de Negocio de Google** (la ficha con mapa, horario y reseñas).

- La agencia donde trabajas **muy probablemente ya tiene** su perfil en esa dirección. Las reglas de Google para profesionales individuales están pensadas para médicos, abogados o agentes inmobiliarios; varias guías indican que los **vendedores de una agencia no califican** para un perfil propio, y Google puede suspender perfiles duplicados en la misma dirección. **No crees uno propio sin confirmarlo** con la agencia y con las [reglas actuales de Google](https://support.google.com/business/answer/3038177?hl=es).
- Lo que sí puedes hacer: pedir a la agencia que en su perfil y en su sitio te mencionen como asesor y enlacen a `diegorodriguezautos.com`.

### 5. Enlaces hacia tu sitio

Google confía más en un sitio cuando otros lo enlazan:

- Pon `https://diegorodriguezautos.com` en tu **Facebook, Instagram, TikTok, WhatsApp Business** (campo "sitio web") y en la firma de tu correo.
- Comparte en redes las **fichas de cada auto** (`/autos/...`), no solo la portada: cada link compartido es una puerta de entrada.
- Si tienes perfiles en redes, pásame sus links: los agrego a los datos estructurados (`sameAs`) para que Google sepa que son tuyos.

### 6. Revisar que todo esté bien

| Herramienta | Qué revisa |
|---|---|
| [Prueba de resultados enriquecidos](https://search.google.com/test/rich-results) | Que Google lea bien los datos estructurados (pega la portada y una ficha) |
| [PageSpeed Insights](https://pagespeed.web.dev/) | Velocidad en celular y computadora |
| [Validador de schema.org](https://validator.schema.org/) | Los datos del negocio y de los autos |
| Search Console → *Páginas* | Qué páginas ya están en Google y por qué alguna no |

## Consejos para que los autos se encuentren más

- **Fotos reales y buenas** (fachada, interior, tablero, cajuela). La primera foto es la que sale al compartir.
- **Descripción de cada auto con palabras que la gente busca:** versión, equipamiento, "seminuevo", "único dueño", "a crédito", "León", "Guanajuato". Escríbela con tus palabras, no copies la de la marca.
- **Versión** siempre llena (Advance, LT, Touring…): la gente busca así.
- Marca como **Vendido** en cuanto se venda: el sitio lo quita de Google solo.
- Agrega autos seguido: Google visita más los sitios que cambian.

## Lo que todavía falta (necesito tus datos)

| Falta | Por qué importa |
|---|---|
| **Horario de atención** | Google lo muestra en resultados locales; va en los datos estructurados (`openingHours`) y en la sección Visítanos |
| **Correo de contacto** | Para el aviso de privacidad (solicitudes ARCO por escrito) y para los datos del negocio |
| **Nombre de la agencia** | Para decir en el sitio dónde estás ("asesor en Agencia X") y enlazar su perfil |
| **Links de tus redes sociales** | Se agregan como `sameAs` y en el pie de página |
| **WhatsApp** (si es el mismo número) | Botón "Escríbeme por WhatsApp", que en autos suele convertir más que la llamada |
| **Coordenadas exactas** (opcional) | Mejora la precisión del mapa en los datos estructurados |

> Google tiene resultados especiales con fotos y precio para inventarios de autos ("vehicle listings"), pero por ahora **solo funcionan en Estados Unidos**. Los datos de cada auto ya están en el formato que pide Google, así que si lo habilitan en México el sitio ya está listo.
