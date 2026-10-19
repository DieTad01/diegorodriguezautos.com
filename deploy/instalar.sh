#!/usr/bin/env bash
# =============================================================
# instalar.sh — instala o actualiza diegorodriguezautos.com en un
# VPS Debian 13 / 12 o Ubuntu 24.04 / 22.04 (Hostinger).
# Hace todo lo de docs/04-instalacion-vps.md.
#
# Uso, como root en la terminal del VPS (hPanel → VPS → Terminal):
#   curl -fsSLo instalar.sh https://raw.githubusercontent.com/DieTad01/diegorodriguezautos.com/claude/pensive-heisenberg-v62n8s/deploy/instalar.sh
#   bash instalar.sh
#
# Se puede correr las veces que quieras (por ejemplo, para actualizar
# el sitio): no borra datos ni cambia contraseñas que ya existan.
# =============================================================
set -euo pipefail

DOMINIO="${DOMINIO:-diegorodriguezautos.com}"
REPO="${REPO:-https://github.com/DieTad01/diegorodriguezautos.com.git}"
# Rama: la que pidas; si ya está instalado, la que ya usa el servidor; si no, la de por defecto
RAMA_INSTALADA="$(sed -n 's#^ref: refs/heads/##p' "${DIR:-/var/www/diegorodriguezautos.com}/.git/HEAD" 2>/dev/null || true)"
RAMA="${RAMA:-${RAMA_INSTALADA:-claude/pensive-heisenberg-v62n8s}}"
DIR="${DIR:-/var/www/diegorodriguezautos.com}"
USUARIO_APP="deploy"
DB_NOMBRE="agencia_autos"
DB_USUARIO="agencia_app"
APP_PM2="diegorodriguezautos"
# Solo para probar el script en un contenedor sin systemd ni firewall
SIN_SISTEMA="${SIN_SISTEMA:-0}"

paso()  { printf '\n\033[1;33m==> %s\033[0m\n' "$*"; }
ok()    { printf '\033[1;32m✔ %s\033[0m\n' "$*"; }
aviso() { printf '\033[1;31m! %s\033[0m\n' "$*"; }
falla() { aviso "$*"; exit 1; }
como_app() { sudo -u "$USUARIO_APP" -H --preserve-env=http_proxy,https_proxy,HTTP_PROXY,HTTPS_PROXY,no_proxy,NO_PROXY,NODE_EXTRA_CA_CERTS,npm_config_cafile env "PATH=$PATH" bash -c "$1"; }
hay_terminal() { [ -r /dev/tty ] && [ -w /dev/tty ] && { : </dev/tty; } 2>/dev/null; }

# Ningún comando lee del teclado salvo las preguntas (que usan /dev/tty).
# Así, si el script se corre con "curl ... | bash", apt/npm/git no se
# "comen" el resto del script ni lo que escribas antes de tiempo.
exec </dev/null

# ---------- 0. Revisiones ----------
[ "$(id -u)" -eq 0 ] || falla "Corre este script como root (o con: sudo bash instalar.sh)."
# shellcheck disable=SC1090
. "${OS_RELEASE:-/etc/os-release}"   # OS_RELEASE: solo para pruebas
case "${ID:-}" in
  debian) DB_PAQUETE="mariadb-server"; DB_SERVICIO="mariadb"; DB_NOMBRE_VISIBLE="MariaDB" ;;  # Debian trae MariaDB (compatible con MySQL)
  ubuntu) DB_PAQUETE="mysql-server";   DB_SERVICIO="mysql";   DB_NOMBRE_VISIBLE="MySQL" ;;
  *) falla "Este instalador es para Debian o Ubuntu y tu VPS tiene: ${PRETTY_NAME:-desconocido}." ;;
esac
ok "Sistema: ${PRETTY_NAME:-$ID} · base de datos: $DB_NOMBRE_VISIBLE"

if command -v ss >/dev/null; then
  OCUPA_80="$(ss -ltnpH 'sport = :80' 2>/dev/null | grep -v nginx || true)"
  if [ -n "$OCUPA_80" ]; then
    aviso "El puerto 80 ya lo usa otro programa:"
    echo "$OCUPA_80"
    falla "Tu VPS parece tener una plantilla con panel (Apache, OpenLiteSpeed, CyberPanel...). Reinstálalo con la plantilla 'Debian 13' o 'Ubuntu 24.04' sin panel (hPanel → VPS → Sistema operativo) y vuelve a correr este script."
  fi
fi

# ---------- 1. Paquetes del sistema ----------
paso "1/9 Instalando paquetes (puede tardar unos minutos)"
export DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a
apt-get update -qq
apt-get install -y -qq curl git nginx "$DB_PAQUETE" ufw certbot python3-certbot-nginx openssl ca-certificates sudo iproute2 >/dev/null
ok "Nginx, $DB_NOMBRE_VISIBLE, Git y Certbot listos"

NODE_MAYOR="$(node -v 2>/dev/null | sed -E 's/^v([0-9]+).*/\1/' || echo 0)"
if [ "${NODE_MAYOR:-0}" -lt 20 ]; then
  # Node 22 del repositorio oficial; si no está disponible, el de la distribución (Debian 13 trae Node 20)
  if curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null 2>&1; then
    apt-get install -y -qq nodejs >/dev/null
  else
    apt-get install -y -qq nodejs npm >/dev/null
  fi
  NODE_MAYOR="$(node -v | sed -E 's/^v([0-9]+).*/\1/')"
  [ "$NODE_MAYOR" -ge 20 ] || falla "Se necesita Node.js 20 o más nuevo y se instaló $(node -v)."
fi
command -v pm2 >/dev/null || npm install -g pm2 --silent >/dev/null
ok "Node.js $(node -v) y PM2 listos"

# ---------- 2. Usuario sin privilegios para la app ----------
paso "2/9 Usuario '$USUARIO_APP' para correr el sitio"
id "$USUARIO_APP" >/dev/null 2>&1 || useradd --create-home --shell /bin/bash "$USUARIO_APP"
ok "Usuario listo (no tiene contraseña ni permisos de administrador)"

# ---------- 3. Código ----------
paso "3/9 Descargando el código (rama $RAMA)"
mkdir -p "$(dirname "$DIR")"
if [ -d "$DIR/.git" ]; then
  chown -R "$USUARIO_APP:$USUARIO_APP" "$DIR"
  como_app "cd '$DIR' && git fetch -q origin '$RAMA' && git checkout -q -B '$RAMA' 'origin/$RAMA'"
  ok "Código actualizado"
else
  mkdir -p "$DIR" && chown "$USUARIO_APP:$USUARIO_APP" "$DIR"
  como_app "git clone -q --branch '$RAMA' '$REPO' '$DIR'"
  ok "Código descargado en $DIR"
fi
como_app "cd '$DIR' && npm ci --omit=dev --no-audit --no-fund --silent"
ok "Dependencias instaladas ($(como_app "cd '$DIR' && git log -1 --format='%h %s'"))"

# ---------- 4. Base de datos ----------
paso "4/9 Base de datos $DB_NOMBRE_VISIBLE"
if [ "$SIN_SISTEMA" = 1 ]; then service "$DB_SERVICIO" start >/dev/null 2>&1 || true; else systemctl enable --now "$DB_SERVICIO" >/dev/null 2>&1; fi
# Cliente: en Debian se llama "mariadb" (puede no existir "mysql")
SQL_CLIENTE="$(command -v mariadb || command -v mysql)" || falla "No se encontró el cliente de $DB_NOMBRE_VISIBLE."
sql() { "$SQL_CLIENTE" "$@"; }
# Quitar usuarios anónimos y la base de prueba (lo que hace mysql_secure_installation)
sql -e "DROP USER IF EXISTS ''@'localhost'; DROP USER IF EXISTS ''@'%'; DROP USER IF EXISTS ''@'$(hostname)'; DROP DATABASE IF EXISTS test; FLUSH PRIVILEGES;"

ENV="$DIR/.env"
DB_PASSWORD=""
[ -f "$ENV" ] && DB_PASSWORD="$(sed -n 's/^DB_PASSWORD=//p' "$ENV" | head -1)"
case "$DB_PASSWORD" in ''|cambia-esta-contraseña) DB_PASSWORD="$(openssl rand -base64 32 | tr -dc 'A-Za-z0-9' | cut -c1-28)";; esac
[[ "$DB_PASSWORD" =~ ^[A-Za-z0-9]{16,}$ ]] || falla "La contraseña de la base de datos en $ENV tiene caracteres no esperados; cámbiala por letras y números."

sql <<SQL
CREATE DATABASE IF NOT EXISTS \`$DB_NOMBRE\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$DB_USUARIO'@'localhost' IDENTIFIED BY '$DB_PASSWORD';
ALTER USER '$DB_USUARIO'@'localhost' IDENTIFIED BY '$DB_PASSWORD';
GRANT SELECT, INSERT, UPDATE, DELETE ON \`$DB_NOMBRE\`.* TO '$DB_USUARIO'@'localhost';
FLUSH PRIVILEGES;
SQL
sql "$DB_NOMBRE" < "$DIR/db/schema.sql"
ok "Base '$DB_NOMBRE' y usuario '$DB_USUARIO' (solo leer/escribir filas) listos; tablas creadas"

# ---------- 5. Archivo .env (secretos, solo en el servidor) ----------
paso "5/9 Configuración secreta (.env)"
umask 077
if [ ! -f "$ENV" ]; then
  cat > "$ENV" <<EOF
NODE_ENV=production
SITIO_URL=https://$DOMINIO
PORT=3000
HOST=127.0.0.1
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=$DB_USUARIO
DB_PASSWORD=$DB_PASSWORD
DB_NAME=$DB_NOMBRE
ADMIN_USER=
ADMIN_PASSWORD_HASH=
SESSION_SECRET=
EOF
  ok ".env creado"
else
  ok ".env ya existía: se conserva"
fi

poner() { # poner CLAVE VALOR  (valores sin '|' ni saltos de línea)
  if grep -q "^$1=" "$ENV"; then sed -i "s|^$1=.*|$1=$2|" "$ENV"; else echo "$1=$2" >> "$ENV"; fi
}
poner DB_PASSWORD "$DB_PASSWORD"   # siempre igual a la que tiene MySQL
grep -q '^SESSION_SECRET=.\{32,\}' "$ENV" || poner SESSION_SECRET "$(openssl rand -hex 32)"

if ! grep -q '^ADMIN_PASSWORD_HASH=scrypt:' "$ENV"; then
  if hay_terminal; then
    echo "Crea el usuario del panel de administración (/admin)."
    while :; do
      read -rp "  Usuario (letras, números, . _ -): " ADMIN </dev/tty
      [[ "$ADMIN" =~ ^[A-Za-z0-9._-]{3,50}$ ]] && break
      aviso "Usuario inválido, intenta de nuevo."
    done
    while :; do
      read -rsp "  Contraseña (mínimo 12 caracteres): " CLAVE1 </dev/tty; echo
      read -rsp "  Repite la contraseña: " CLAVE2 </dev/tty; echo
      if [ "${#CLAVE1}" -lt 12 ]; then aviso "Muy corta."; elif [ "$CLAVE1" != "$CLAVE2" ]; then aviso "No coinciden."; else break; fi
    done
    HASH="$(cd "$DIR" && CLAVE="$CLAVE1" node -e "process.stdout.write(require('./src/auth').hashPassword(process.env.CLAVE))")"
    unset CLAVE1 CLAVE2
    poner ADMIN_USER "$ADMIN"
    poner ADMIN_PASSWORD_HASH "$HASH"
    ok "Administrador '$ADMIN' creado (la contraseña no se guarda, solo su huella cifrada)"
  else
    aviso "Sin terminal interactiva: crea el admin después con  cd $DIR && sudo -u $USUARIO_APP npm run crear-admin"
  fi
fi
chown "$USUARIO_APP:$USUARIO_APP" "$ENV"
chmod 600 "$ENV"
umask 022

# ---------- 6. Arrancar con PM2 ----------
paso "6/9 Arrancando el sitio con PM2"
como_app "cd '$DIR' && pm2 startOrReload ecosystem.config.js --update-env >/dev/null && pm2 save >/dev/null"
if [ "$SIN_SISTEMA" != 1 ]; then
  env "PATH=$PATH" pm2 startup systemd -u "$USUARIO_APP" --hp "/home/$USUARIO_APP" >/dev/null
fi
for _ in $(seq 1 20); do curl -fs -o /dev/null http://127.0.0.1:3000/api/vehiculos && break; sleep 1; done
curl -fsS -o /dev/null http://127.0.0.1:3000/api/vehiculos || { como_app "pm2 logs $APP_PM2 --lines 30 --nostream" || true; falla "El sitio no respondió. Arriba están los últimos mensajes del servidor."; }
ok "Node responde en 127.0.0.1:3000 y arranca solo si el VPS se reinicia"

# ---------- 7. Nginx ----------
paso "7/9 Nginx (recibe el tráfico del dominio)"
cp "$DIR/deploy/nginx.conf" "/etc/nginx/sites-available/$DOMINIO"
# Si el servidor no tiene IPv6, se quita esa línea para que Nginx pueda arrancar
[ -e /proc/net/if_inet6 ] || sed -i '/listen \[::\]:80;/d' "/etc/nginx/sites-available/$DOMINIO"
ln -sf "/etc/nginx/sites-available/$DOMINIO" "/etc/nginx/sites-enabled/$DOMINIO"
rm -f /etc/nginx/sites-enabled/default
nginx -t 2>/dev/null || { nginx -t; falla "La configuración de Nginx tiene un error."; }
if [ "$SIN_SISTEMA" = 1 ]; then nginx -s reload 2>/dev/null || nginx; else systemctl enable --now nginx >/dev/null 2>&1; systemctl reload nginx; fi
ok "Nginx listo"

# ---------- 8. Firewall ----------
paso "8/9 Firewall (solo SSH, HTTP y HTTPS)"
if [ "$SIN_SISTEMA" != 1 ]; then
  PUERTO_SSH="$(sshd -T 2>/dev/null | awk '/^port /{print $2; exit}')"
  ufw allow "${PUERTO_SSH:-22}/tcp" >/dev/null
  ufw allow 80/tcp >/dev/null
  ufw allow 443/tcp >/dev/null
  ufw --force enable >/dev/null
  ok "Abiertos: SSH (${PUERTO_SSH:-22}), 80 y 443. La base de datos (3306) y Node (3000) quedan cerrados"
else
  ok "(omitido en modo prueba)"
fi

# ---------- 9. HTTPS ----------
paso "9/9 HTTPS con Let's Encrypt"
IP_VPS="$(curl -4fs --max-time 10 https://api.ipify.org || true)"
# getent viene con cualquier Linux (no hace falta instalar dig); sigue los CNAME
ip_de() { getent ahostsv4 "$1" 2>/dev/null | awk 'NR==1{print $1}' || true; }
IP_DOM="$(ip_de "$DOMINIO")"
IP_WWW="$(ip_de "www.$DOMINIO")"
if [ "$SIN_SISTEMA" = 1 ]; then
  ok "(omitido en modo prueba)"
elif [ -n "$IP_VPS" ] && [ "$IP_DOM" = "$IP_VPS" ]; then
  DOMINIOS=(-d "$DOMINIO")
  [ "$IP_WWW" = "$IP_VPS" ] && DOMINIOS+=(-d "www.$DOMINIO") || aviso "www.$DOMINIO aún no apunta a este VPS; el certificado será solo para $DOMINIO (vuelve a correr el script cuando apunte)."
  CORREO=""
  if hay_terminal && [ ! -d /etc/letsencrypt/accounts ]; then
    read -rp "  Correo para avisos del certificado (Enter para omitir): " CORREO </dev/tty
  fi
  if [ -n "$CORREO" ]; then OPC_CORREO=(-m "$CORREO" --no-eff-email); else OPC_CORREO=(--register-unsafely-without-email); fi
  if certbot --nginx "${DOMINIOS[@]}" --redirect --agree-tos --non-interactive --keep-until-expiring "${OPC_CORREO[@]}"; then
    ok "HTTPS activo y se renueva solo"
  else
    aviso "Certbot falló. Revisa que el dominio apunte a $IP_VPS y vuelve a correr el script."
  fi
else
  aviso "El dominio aún no apunta a este VPS (dominio: ${IP_DOM:-sin registro}, VPS: ${IP_VPS:-desconocida})."
  echo "  En hPanel → Dominios → $DOMINIO → DNS: registros A de '@' y 'www' con valor ${IP_VPS:-<IP del VPS>}."
  echo "  Cuando propague (minutos a horas), vuelve a correr: bash instalar.sh"
fi

# ---------- Resumen ----------
printf '\n\033[1;32m===== Listo =====\033[0m\n'
echo "  Sitio:        https://$DOMINIO   (o http://${IP_VPS:-IP-del-VPS} mientras propaga el DNS)"
echo "  Panel admin:  https://$DOMINIO/admin   (solo funciona con HTTPS)"
echo "  Código:       $DIR   ·   Secretos: $ENV (no se sube a GitHub)"
echo "  Ver errores:  sudo -u $USUARIO_APP pm2 logs $APP_PM2"
echo "  Actualizar:   vuelve a correr  bash instalar.sh"
