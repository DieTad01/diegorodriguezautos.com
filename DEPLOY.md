# Despliegue en VPS (Hostinger) — diegorodriguezautos.com

Arquitectura en el VPS:

```
Navegador ──HTTPS──> Nginx (80/443) ──> Node + Express (127.0.0.1:3000) ──> MySQL (127.0.0.1:3306)
```

- `server.js` sirve `index.html`, `css/` y `js/`, y convierte cada archivo de `api/` en una ruta (`api/vehiculos.js` → `/api/vehiculos`), igual que Vercel.
- Node y MySQL solo escuchan en `127.0.0.1`: desde internet solo se llega por Nginx.
- Las credenciales viven **solo** en el archivo `.env` del servidor. Nunca en GitHub.

> Los comandos asumen Ubuntu 22.04/24.04 (la plantilla por defecto de Hostinger).

---

## 1. DNS (panel de Hostinger)

En **Dominios → diegorodriguezautos.com → DNS / Nameservers**:

| Tipo | Nombre | Apunta a            |
|------|--------|---------------------|
| A    | `@`    | IP pública del VPS  |
| A    | `www`  | IP pública del VPS  |

Borra cualquier otro registro `A`/`CNAME` de `@` o `www` que apunte al hosting compartido o a Vercel. La propagación puede tardar desde minutos hasta unas horas.

## 2. Preparar el VPS

```bash
ssh root@IP_DEL_VPS

apt update && apt upgrade -y

# Usuario sin privilegios para la app (no correr todo como root)
adduser deploy
usermod -aG sudo deploy

# Firewall: solo SSH y web. El puerto 3306 (MySQL) y el 3000 (Node) quedan cerrados.
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
```

> Recomendado: entra con llave SSH y desactiva el login por contraseña de root (`PermitRootLogin no`, `PasswordAuthentication no` en `/etc/ssh/sshd_config`).

## 3. Instalar Node.js, Nginx, MySQL y PM2

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs nginx mysql-server git
sudo npm install -g pm2
```

## 4. Base de datos

```bash
sudo mysql_secure_installation
sudo mysql
```

```sql
CREATE DATABASE agencia_autos CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'agencia_app'@'localhost' IDENTIFIED BY 'UNA_CONTRASEÑA_LARGA_Y_ALEATORIA';
-- Solo los permisos que la app necesita (nada de ALL PRIVILEGES ni root)
GRANT SELECT, INSERT, UPDATE, DELETE ON agencia_autos.* TO 'agencia_app'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

Para cargar tus tablas, sube el script SQL por `scp` (no lo subas a GitHub si tiene datos reales):

```bash
scp esquema.sql deploy@IP_DEL_VPS:~
ssh deploy@IP_DEL_VPS "sudo mysql agencia_autos < ~/esquema.sql && rm ~/esquema.sql"
```

## 5. Subir el código

```bash
su - deploy
sudo mkdir -p /var/www && sudo chown deploy:deploy /var/www
cd /var/www
git clone https://github.com/DieTad01/diegorodriguezautos.com.git
cd diegorodriguezautos.com
npm ci --omit=dev
```

> Si el repositorio es privado, usa una *deploy key* de solo lectura (GitHub → Settings → Deploy keys) en vez de tu usuario y contraseña.

## 6. Crear el `.env` (solo en el servidor)

```bash
cp .env.example .env
nano .env          # pon la contraseña real de MySQL
chmod 600 .env     # solo el usuario deploy puede leerlo
```

## 7. Arrancar con PM2

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup        # copia y ejecuta el comando que imprime, para arrancar al reiniciar el VPS

curl http://127.0.0.1:3000/api/vehiculos   # debe responder JSON
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

## 10. Actualizar el sitio después de un cambio

```bash
cd /var/www/diegorodriguezautos.com
git pull
npm ci --omit=dev
pm2 reload diegorodriguezautos
```

---

## Qué NUNCA debe ir al repositorio

`.gitignore` ya bloquea esto, pero revisa antes de cada `git add`:

- `.env` (contraseñas de MySQL y cualquier llave)
- Llaves SSH / certificados (`*.pem`, `*.key`, `id_rsa`…)
- Respaldos de la base de datos (`*.sql`, `*.dump`)
- `node_modules/`

Si alguna vez se sube un secreto por error, **cámbialo** (contraseña nueva en MySQL y en `.env`): borrarlo del repo no basta, porque queda en el historial de git.

## Problemas comunes

| Síntoma | Revisa |
|---|---|
| 502 Bad Gateway | `pm2 status` y `pm2 logs diegorodriguezautos` — Node no está corriendo |
| El dominio no carga | `dig +short diegorodriguezautos.com` debe dar la IP del VPS |
| Error de conexión a MySQL | Valores en `.env`; `sudo systemctl status mysql` |
| Certbot falla | El DNS aún no propaga, o el puerto 80 está cerrado en `ufw` |
