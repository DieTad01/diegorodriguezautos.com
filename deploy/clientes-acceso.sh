#!/usr/bin/env bash
# =============================================================
# clientes-acceso.sh — acceso de los compradores a "Mi cuenta" (/mi-cuenta)
#
# Uso, como root en el VPS (hPanel → VPS → Terminal):
#   bash /var/www/diegorodriguezautos.com/deploy/clientes-acceso.sh listar
#   bash .../clientes-acceso.sh agregar                     # registrar un cliente nuevo
#   bash .../clientes-acceso.sh acceso ana@correo.com       # darle acceso (contraseña temporal)
#   bash .../clientes-acceso.sh quitar-acceso ana@correo.com
#
# Las contraseñas se escriben sin que se vean y solo se guarda su
# huella cifrada. El cliente cambia la suya al entrar a Mi cuenta.
# =============================================================
set -euo pipefail

DIR="${DIR:-/var/www/diegorodriguezautos.com}"
USUARIO_APP="deploy"

falla() { printf '\033[1;31m! %s\033[0m\n' "$*"; exit 1; }

[ -f "$DIR/.env" ] || falla "No existe $DIR/.env. Primero corre deploy/instalar.sh."
cd "$DIR"

# Corre como el usuario de la app (dueño del .env); con teclado si hay terminal
if [ "$(id -u)" -eq 0 ]; then
  CORRER=(sudo -u "$USUARIO_APP" -H env "PATH=$PATH" node "$DIR/scripts/clientes-acceso.js" "$@")
elif [ "$(id -un)" = "$USUARIO_APP" ]; then
  CORRER=(node "$DIR/scripts/clientes-acceso.js" "$@")
else
  falla "Corre este script como root (o con: sudo bash usuarios-admin.sh ...)."
fi

if { : </dev/tty; } 2>/dev/null; then
  "${CORRER[@]}" </dev/tty
else
  "${CORRER[@]}"
fi
