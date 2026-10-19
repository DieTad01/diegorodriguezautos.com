#!/usr/bin/env bash
# =============================================================
# usuarios-admin.sh — cuentas del panel /admin (una por persona)
#
# Uso, como root en el VPS (hPanel → VPS → Terminal):
#   bash /var/www/diegorodriguezautos.com/deploy/usuarios-admin.sh listar
#   bash .../usuarios-admin.sh agregar cliente        # cuenta nueva
#   bash .../usuarios-admin.sh contrasena cliente     # cambiar contraseña
#   bash .../usuarios-admin.sh cerrar-sesiones cliente
#   bash .../usuarios-admin.sh quitar cliente
#
# Las contraseñas se escriben sin que se vean y solo se guarda su
# huella cifrada en la base de datos. Nadie (ni tú) puede leerlas después.
# =============================================================
set -euo pipefail

DIR="${DIR:-/var/www/diegorodriguezautos.com}"
USUARIO_APP="deploy"

falla() { printf '\033[1;31m! %s\033[0m\n' "$*"; exit 1; }

[ -f "$DIR/.env" ] || falla "No existe $DIR/.env. Primero corre deploy/instalar.sh."
cd "$DIR"

# Corre como el usuario de la app (dueño del .env); con teclado si hay terminal
if [ "$(id -u)" -eq 0 ]; then
  CORRER=(sudo -u "$USUARIO_APP" -H env "PATH=$PATH" node "$DIR/scripts/usuarios-admin.js" "$@")
elif [ "$(id -un)" = "$USUARIO_APP" ]; then
  CORRER=(node "$DIR/scripts/usuarios-admin.js" "$@")
else
  falla "Corre este script como root (o con: sudo bash usuarios-admin.sh ...)."
fi

if { : </dev/tty; } 2>/dev/null; then
  "${CORRER[@]}" </dev/tty
else
  "${CORRER[@]}"
fi
