#!/usr/bin/env bash
# =============================================================
# cambiar-admin.sh — cambia el usuario y/o la contraseña del panel
# /admin. También cierra todas las sesiones abiertas (por si alguien
# más conocía la contraseña anterior).
#
# Uso, como root en el VPS:
#   bash /var/www/diegorodriguezautos.com/deploy/cambiar-admin.sh
# =============================================================
set -euo pipefail

DIR="${DIR:-/var/www/diegorodriguezautos.com}"
USUARIO_APP="deploy"
APP_PM2="diegorodriguezautos"
ENV="$DIR/.env"

ok()    { printf '\033[1;32m✔ %s\033[0m\n' "$*"; }
aviso() { printf '\033[1;31m! %s\033[0m\n' "$*"; }
falla() { aviso "$*"; exit 1; }

[ "$(id -u)" -eq 0 ] || falla "Corre este script como root (o con: sudo bash cambiar-admin.sh)."
[ -f "$ENV" ] || falla "No existe $ENV. Primero corre deploy/instalar.sh."
{ : </dev/tty; } 2>/dev/null || falla "Este script necesita una terminal para pedirte los datos."

ACTUAL="$(sed -n 's/^ADMIN_USER=//p' "$ENV" | head -1)"
echo "Usuario actual del panel: ${ACTUAL:-(ninguno)}"
while :; do
  read -rp "  Nuevo usuario (Enter = dejar '${ACTUAL}'): " ADMIN </dev/tty
  ADMIN="${ADMIN:-$ACTUAL}"
  [[ "$ADMIN" =~ ^[A-Za-z0-9._-]{3,50}$ ]] && break
  aviso "Usuario inválido: 3 a 50 letras, números, punto, guion o guion bajo."
done
while :; do
  read -rsp "  Nueva contraseña (mínimo 12 caracteres): " CLAVE1 </dev/tty; echo
  read -rsp "  Repite la contraseña: " CLAVE2 </dev/tty; echo
  if [ "${#CLAVE1}" -lt 12 ]; then aviso "Muy corta."; elif [ "$CLAVE1" != "$CLAVE2" ]; then aviso "No coinciden."; else break; fi
done

HASH="$(cd "$DIR" && CLAVE="$CLAVE1" node -e "process.stdout.write(require('./src/auth').hashPassword(process.env.CLAVE))")"
unset CLAVE1 CLAVE2

poner() { # poner CLAVE VALOR
  if grep -q "^$1=" "$ENV"; then sed -i "s|^$1=.*|$1=$2|" "$ENV"; else echo "$1=$2" >> "$ENV"; fi
}
poner ADMIN_USER "$ADMIN"
poner ADMIN_PASSWORD_HASH "$HASH"
poner SESSION_SECRET "$(openssl rand -hex 32)"   # invalida todas las sesiones abiertas
chown "$USUARIO_APP:$USUARIO_APP" "$ENV"
chmod 600 "$ENV"

sudo -u "$USUARIO_APP" -H env "PATH=$PATH" bash -c "cd '$DIR' && pm2 reload $APP_PM2 --update-env >/dev/null"
ok "Listo: usuario '$ADMIN' con contraseña nueva. Se cerraron todas las sesiones; entra de nuevo en /admin."
