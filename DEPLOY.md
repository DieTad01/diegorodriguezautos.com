# Despliegue en VPS (Hostinger) — diegorodriguezautos.com

Arquitectura en el VPS:

```
Navegador ──HTTPS──> Nginx (80/443) ──> Node + Express (127.0.0.1:3000) ──> MySQL (127.0.0.1:3306)
                                                                    Imágenes: Google Drive (no ocupan espacio en el VPS)
```

- Solo la carpeta `public/` es visible desde internet. `src/`, `db/`, `.env` y `node_modules/` nunca se publican.
- Node y MySQL solo escuchan en `127.0.0.1`: desde internet solo se llega por Nginx.
- Las credenciales viven **solo** en el archivo `.env` del servidor. Nunca en GitHub.

> Los comandos asumen Ubuntu 22.04/24.04 (la plantilla por defecto de Hostinger).
> Para practicar MySQL por SSH, ve a [GUIA-MYSQL-SSH.md](GUIA-MYSQL-SSH.md).

---

## 1. DNS (panel de Hostinger)

En **Dominios → diegorodriguezautos.com → DNS / Nameservers**:

| Tipo | Nombre | Apunta a            |
|------|--------|---------------------|
| A    | `@`    | IP pública del VPS  |
| A    | `www`  | IP pública del VPS  |

Borra cualquier otro registro `A`/`CNAME` de `@` o `www` que apunte a otro hosting. La propagación puede tardar desde minutos hasta unas horas.

## 2. Preparar el VPS

```bash
ssh root@IP_DEL_VPS

apt update && apt upgrade -y

# Usuario sin privilegios para la app (no correr todo como root)
adduser deploy
usermod -aG sudo deploy

# Firewall: solo SSH y web. El 3306 (MySQL) y el 3000 (Node) quedan cerrados.
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
```

> Recomendado: entra con llave SSH y desactiva el login por contraseña (ver la sección 1 de [GUIA-MYSQL-SSH.md](GUIA-MYSQL-SSH.md)).

## 3. Instalar Node.js, Nginx, MySQL y PM2

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs nginx mysql-server git
sudo npm install -g pm2
```

## 4. Subir el código

```bash
su - deploy
sudo mkdir -p /var/www && sudo chown deploy:deploy /var/www
cd /var/www
git clone https://github.com/DieTad01/diegorodriguezautos.com.git
cd diegorodriguezautos.com
npm ci --omit=dev
```

> Si el repositorio es privado, usa una *deploy key* de solo lectura (GitHub → Settings → Deploy keys) en vez de tu usuario y contraseña.

## 5. Base de datos del sitio

```bash
sudo mysql_secure_installation
sudo mysql
```

```sql
CREATE DATABASE agencia_autos CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'agencia_app'@'localhost' IDENTIFIED BY 'UNA_CONTRASEÑA_LARGA_Y_ALEATORIA';
-- Solo lo que la app necesita: leer y escribir filas.
-- Sin DROP, ALTER, CREATE ni GRANT: aunque hubiera una inyección SQL,
-- este usuario no podría borrar tablas.
GRANT SELECT, INSERT, UPDATE, DELETE ON agencia_autos.* TO 'agencia_app'@'localhost';
EXIT;
```

Crear las tablas (como root de MySQL, porque `agencia_app` no puede crear tablas):

```bash
sudo mysql agencia_autos < db/schema.sql
```

> Para generar una contraseña aleatoria: `openssl rand -base64 24`

## 6. Crear el `.env` (solo en el servidor)

```bash
cp .env.example .env
nano .env            # pon la contraseña de MySQL del paso 5
npm run crear-admin  # pide usuario y contraseña del panel; copia las 3 líneas que imprime al .env
chmod 600 .env       # solo el usuario deploy puede leerlo
```

## 7. Arrancar con PM2

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup        # copia y ejecuta el comando que imprime, para arrancar al reiniciar el VPS

curl http://127.0.0.1:3000/api/vehiculos   # debe responder [] (JSON)
```

## 8. Nginx

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/diegorodriguezautos.com
sudo ln -s /etc/nginx/sites-available/diegorodriguezautos.com /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

## 9. HTTPS gratis (Let's Encrypt)

Cuando el DNS ya apunte al VPS:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d diegorodriguezautos.com -d www.diegorodriguezautos.com --redirect
```

Certbot renueva el certificado solo (`systemctl list-timers | grep certbot`).

> **El panel `/admin` solo funciona con HTTPS.** En producción la cookie de sesión es `Secure` y el navegador no la manda por `http://`.

## 10. Usar el panel de administración

Entra a `https://diegorodriguezautos.com/admin` con el usuario del paso 6.

**Fotos desde Google Drive** (no se suben al VPS, solo se guarda el enlace):

1. Sube las fotos a una carpeta de tu Drive.
2. Clic derecho en **cada imagen** → *Compartir* → Acceso general: **"Cualquier persona con el enlace"** (Lector) → *Copiar enlace*.
3. En el panel, pega un enlace por línea en "Imágenes". La primera es la portada.
4. *Previsualizar imágenes* para confirmar que se ven. Si sale "No se pudo cargar", la imagen no está compartida como pública.

También acepta cualquier enlace directo `https://` a una imagen (por ejemplo, de otro servicio). Los enlaces de **carpetas** de Drive no sirven, y por seguridad se rechazan `http://`, `javascript:` y `data:`.

## 11. Actualizar el sitio después de un cambio

```bash
cd /var/www/diegorodriguezautos.com
git pull
npm ci --omit=dev
pm2 reload diegorodriguezautos
```

Si el cambio trae tablas o columnas nuevas en `db/schema.sql`, aplícalas con `sudo mysql agencia_autos`.

---

## Seguridad: qué protege a este proyecto

| Ataque | Protección | Dónde |
|---|---|---|
| Inyección SQL | Todas las consultas usan parámetros `?` (`pool.execute`); `multipleStatements` apagado; IDs solo dígitos; comodines de `LIKE` escapados; usuario MySQL sin `DROP`/`ALTER` | `src/vehiculos.js`, `src/db.js`, `src/validacion.js` |
| Inyección HTML / XSS | Los datos se pintan con `textContent` (nunca `innerHTML`); CSP que solo permite scripts propios; la API solo responde JSON con `nosniff` | `public/js/`, `src/app.js` |
| Enlaces de imagen maliciosos | Solo `https://`; se rechazan `javascript:`, `data:`, `http:`, usuario/contraseña en la URL; Drive se normaliza a miniatura | `src/validacion.js` |
| Robo / falsificación de sesión | Cookie firmada HMAC, `HttpOnly`, `Secure`, `SameSite=Strict`, expira en 8 h | `src/auth.js` |
| CSRF (otro sitio actuando como tú) | `SameSite=Strict` + revisión de `Origin` + solo JSON | `src/auth.js` |
| Fuerza bruta al login | 5 intentos fallidos por IP cada 15 min (Node) + límite en Nginx | `src/auth.js`, `deploy/nginx.conf` |
| Contraseña filtrada | Solo se guarda el hash scrypt en `.env` | `scripts/crear-admin.js` |
| Descarga de `.env` / código | Solo se sirve `public/`; Nginx bloquea archivos ocultos | `src/app.js`, `deploy/nginx.conf` |
| Errores que revelan SQL | El navegador solo recibe "Error interno"; el detalle va al log | `src/app.js` |
| Clickjacking | `frame-ancestors 'none'` | `src/app.js` |

Las pruebas automáticas de todo esto están en `test/seguridad.test.js`. Para correrlas necesitas una base de **prueba** (nunca la del sitio):

```bash
sudo mysql -e "CREATE DATABASE agencia_test; CREATE USER 'agencia_test'@'localhost' IDENTIFIED BY 'otra-clave'; GRANT ALL ON agencia_test.* TO 'agencia_test'@'localhost';"
printf 'DB_USER=agencia_test\nDB_PASSWORD=otra-clave\nDB_NAME=agencia_test\n' > .env.test
npm test
```

## Qué NUNCA debe ir al repositorio

`.gitignore` ya bloquea esto, pero revisa antes de cada `git add`:

- `.env` y `.env.test` (contraseñas de MySQL, hash del admin, `SESSION_SECRET`)
- Llaves SSH / certificados (`*.pem`, `*.key`, `id_rsa`…)
- Respaldos de la base de datos (`*.sql`, `*.dump`, carpeta `respaldos/`). Solo se suben `db/schema.sql` y `db/datos-ejemplo.sql`
- `node_modules/`

Si alguna vez se sube un secreto por error, **cámbialo** (contraseña nueva en MySQL, `npm run crear-admin` de nuevo): borrarlo del repo no basta, porque queda en el historial de git.

## Problemas comunes

| Síntoma | Revisa |
|---|---|
| 502 Bad Gateway | `pm2 status` y `pm2 logs diegorodriguezautos`: Node no está corriendo |
| El dominio no carga | `dig +short diegorodriguezautos.com` debe dar la IP del VPS |
| "Error interno" en la página | `pm2 logs`: casi siempre son datos de MySQL mal puestos en `.env` |
| `/admin` no deja entrar | ¿Ya hay HTTPS? ¿Copiaste las 3 líneas de `npm run crear-admin` y reiniciaste PM2? |
| "Demasiados intentos" | Espera 15 minutos (o `pm2 reload diegorodriguezautos`) |
| La foto de Drive no se ve | La imagen debe estar compartida como "Cualquier persona con el enlace" |
| Certbot falla | El DNS aún no propaga, o el puerto 80 está cerrado en `ufw` |
