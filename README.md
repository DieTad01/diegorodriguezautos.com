# diegorodriguezautos.com

Sitio de la agencia de autos: inventario público + panel de administración.
HTML/CSS/JS en el navegador, Node.js + Express en el servidor, MySQL como base de datos.
Las fotos se enlazan desde Google Drive (no ocupan espacio en el servidor).

```
public/            Lo único visible desde internet (index.html, admin.html, css/, js/)
src/               Servidor: rutas, consultas SQL, validación, sesión del admin
db/schema.sql      Tablas (vehiculos, vehiculo_imagenes, clientes, ventas, pagos)
db/datos-ejemplo.sql  Datos ficticios para practicar
scripts/           crear-admin.js (genera el usuario del panel)
test/              Pruebas de seguridad (inyección SQL, XSS, CSRF, sesión…)
deploy/            Configuración de Nginx
```

## Guías

- **[DEPLOY.md](DEPLOY.md)**: subir el sitio al VPS de Hostinger (DNS, MySQL, PM2, Nginx, HTTPS) y tabla de protecciones de seguridad.
- **[GUIA-MYSQL-SSH.md](GUIA-MYSQL-SSH.md)**: conectarte por SSH y practicar MySQL en una base separada, con ejercicios resueltos.

## Correr en tu computadora

```bash
cp .env.example .env     # pon NODE_ENV=development y los datos de tu MySQL
npm install
npm run crear-admin      # copia las 3 líneas que imprime al .env
npm start                # http://127.0.0.1:3000  y  http://127.0.0.1:3000/admin
```

## Pruebas

```bash
npm test   # necesita un .env.test con una base de PRUEBA (ver DEPLOY.md)
```
