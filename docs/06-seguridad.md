# 6. Seguridad

[← Volver al índice](README.md)

## Control de acceso al panel

- **Una cuenta por persona** (tabla `administradores`): tú y tu cliente entran cada quien con la suya. Las contraseñas **no se guardan**: solo su hash `scrypt` con sal propia. Se manejan con `deploy/usuarios-admin.sh` y cada quien puede cambiar la suya desde el panel (pidiendo la actual).
- Un usuario inexistente tarda lo mismo y da el mismo mensaje que una contraseña mala: no se puede averiguar qué cuentas existen.
- La cookie lleva el **usuario y la hora** firmados juntos: no se puede cambiar el nombre para hacerse pasar por otra cuenta. Cambiar la contraseña de una cuenta o borrarla invalida **solo sus** sesiones, al instante.
- Al entrar se crea una **cookie de sesión firmada** (HMAC-SHA256) que:
  - es `HttpOnly`: JavaScript no puede leerla, ni uno inyectado;
  - es `Secure`: solo viaja por HTTPS;
  - es `SameSite=Strict`: otros sitios no pueden usarla;
  - expira en 8 horas y no se puede alterar ni inventar sin `SESSION_SECRET`.
- **Todas** las rutas `/api/admin/*` (listar, crear, editar, borrar, previsualizar) rechazan con `401` si no hay sesión válida.
- **Fuerza bruta:** 5 intentos fallidos por IP cada 15 minutos (Node) y 10 por minuto (Nginx).

## Qué protege a este proyecto

| Ataque | Protección | Dónde |
|---|---|---|
| Inyección SQL | Todas las consultas usan parámetros `?` (`pool.execute`); `multipleStatements` apagado; IDs solo dígitos; comodines de `LIKE` escapados; tipos estrictos (no se aceptan objetos ni arreglos donde va texto); el usuario MySQL del sitio no tiene `DROP`/`ALTER` | `src/vehiculos.js`, `src/db.js`, `src/validacion.js` |
| Inyección HTML / XSS | Los datos se pintan con `textContent` y `<template>`, nunca con `innerHTML`; CSP que solo permite scripts propios (sin scripts en línea); la API solo responde JSON con `nosniff` | `public/js/`, `src/app.js` |
| Inyección HTML en páginas del servidor (fichas `/autos/…`) | Todo dato pasa por `esc()` (texto y atributos); el JSON-LD escapa `<`, `>` y `&` para que nada cierre el `<script>`; las fotos se publican solo si son `https://` | `src/paginas/html.js`, `src/paginas/auto.js` |
| Redirección abierta | La redirección de `www` usa una dirección fija (`SITIO_URL`), nunca el `Host` que manda el navegador | `src/app.js` |
| Enlaces de imagen maliciosos | Solo `https://`; se rechazan `javascript:`, `data:`, `http:`, usuario/contraseña en la URL; Drive se normaliza a miniatura | `src/validacion.js` |
| Robo / falsificación de sesión | Cookie firmada, `HttpOnly`, `Secure`, `SameSite=Strict`, 8 h | `src/auth.js` |
| CSRF (otro sitio actuando como tú) | `SameSite=Strict` + revisión de `Origin`/`Sec-Fetch-Site` + solo JSON | `src/auth.js` |
| Fuerza bruta al login | Límite por IP en Node + `limit_req` en Nginx | `src/auth.js`, `deploy/nginx.conf` |
| Contaminación de prototipos (`__proto__`) | El servidor solo lee los campos esperados, nunca mezcla el JSON recibido | `src/validacion.js` |
| Descarga de `.env` / código | Solo se sirve `public/`; Nginx bloquea archivos ocultos | `src/app.js`, `deploy/nginx.conf` |
| Errores que revelan SQL | El navegador solo recibe "Error interno"; el detalle va al log | `src/app.js` |
| Clickjacking | `frame-ancestors 'none'` | `src/app.js` |

## Lo que se probó en el panel de administración

Las pruebas automáticas (`test/seguridad.test.js`, 34 pruebas) y una prueba en navegador real (Chromium) verificaron, **ya dentro del panel con sesión iniciada**:

- **Login:** usuarios y contraseñas como `' OR '1'='1`, `admin' -- `, `<script>…</script>`, objetos `{"$ne": null}`, arreglos y textos de 10,000 caracteres. Ninguno entra ni crea sesión.
- **Cada campo de texto** (marca, modelo, versión, color, descripción), **al crear y al editar**, con 14 ataques (todos los que caben en el largo máximo de cada campo): `'; DROP TABLE vehiculos; --`, `' UNION SELECT …`, `' AND SLEEP(5) …`, `<script>`, `<img onerror>`, `<svg onload>`, `<iframe>`, `javascript:`, plantillas `{{…}}`, etc. Todos se guardan **literalmente como texto**, no se borra ni se duplica ninguna fila, ninguna otra tabla cambia y las 5 tablas siguen existiendo.
- **Estado y transmisión:** solo aceptan exactamente sus opciones.
- **En el navegador:** con ataques en todos los campos, ni el panel (lista, formulario de edición, diálogo de confirmación al borrar) ni la página pública ejecutan nada; todo se ve como texto plano.
- **Sesión:** cookies inventadas, alteradas o vencidas no sirven; peticiones desde otro sitio se rechazan.
- **Fichas generadas en el servidor:** un auto con ataques en todos sus campos (`<script>`, `"><img onerror>`, `</script><script>`, comillas que intentan abrir atributos, `<iframe src="javascript:">`) y una foto `javascript:` metida directo en MySQL. La prueba compara la **estructura** de la página (etiquetas y atributos) con la misma página con datos normales: deben ser idénticas. Se comprobó que la prueba falla si se quita el escape en la descripción, en un atributo `alt` o en el JSON-LD. En Chromium, nada se ejecuta.

### Correr las pruebas

Necesitas una base de **prueba** (nunca la del sitio; el comando se niega a correr si el nombre de la base no contiene "test"):

```bash
sudo mysql -e "CREATE DATABASE agencia_test; CREATE USER 'agencia_test'@'localhost' IDENTIFIED BY 'otra-clave'; GRANT ALL ON agencia_test.* TO 'agencia_test'@'localhost';"
printf 'DB_USER=agencia_test\nDB_PASSWORD=otra-clave\nDB_NAME=agencia_test\n' > .env.test
npm test
```

## Reglas para quien modifique el código

1. **SQL:** siempre `pool.execute('… WHERE x = ?', [valor])`. Nunca `` `… WHERE x = ${valor}` ``.
2. **HTML:** siempre `elemento.textContent = valor`. Nunca `innerHTML` con datos. La prueba `XSS: el código del navegador nunca usa innerHTML` falla si alguien lo agrega.
3. **Nada de `<script>` ni `style=""` dentro del HTML:** la CSP los bloquea. Todo va en `public/js/` y `public/css/`.
4. **Nuevos campos:** agrégalos a la lista blanca de `validarVehiculo` en `src/validacion.js` con tipo y largo máximo.
5. Corre `npm test` antes de subir cambios.

## Qué NUNCA debe ir al repositorio

`.gitignore` ya bloquea esto, pero revisa antes de cada `git add`:

- `.env` y `.env.test` (contraseñas de MySQL, hash del admin, `SESSION_SECRET`)
- Llaves SSH / certificados (`*.pem`, `*.key`, `id_rsa`…)
- Respaldos de la base de datos (`*.sql`, `*.dump`, carpeta `respaldos/`). Solo se suben `db/schema.sql` y `db/datos-ejemplo.sql`
- `node_modules/`

Si alguna vez se sube un secreto por error, **cámbialo** (contraseña nueva en MySQL, `SESSION_SECRET` nuevo y `usuarios-admin.sh contrasena` para cada cuenta): borrarlo del repo no basta, porque queda en el historial de git.
