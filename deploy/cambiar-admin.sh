#!/usr/bin/env bash
# =============================================================
# cambiar-admin.sh — cambia la contraseña de una cuenta del panel
# /admin y cierra las sesiones abiertas de ESA cuenta.
# (Atajo de: usuarios-admin.sh contrasena [usuario])
#
# Uso, como root en el VPS:
#   bash /var/www/diegorodriguezautos.com/deploy/cambiar-admin.sh            # si solo hay una cuenta
#   bash /var/www/diegorodriguezautos.com/deploy/cambiar-admin.sh cliente    # una cuenta en específico
#
# Para crear, listar o borrar cuentas: deploy/usuarios-admin.sh
# =============================================================
set -euo pipefail
exec bash "$(dirname "$0")/usuarios-admin.sh" contrasena "$@"
