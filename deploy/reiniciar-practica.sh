#!/usr/bin/env bash
# =============================================================
# reiniciar-practica.sh — deja la base de PRÁCTICA (agencia_practica)
# como nueva: borra todo lo que hayas creado (tablas, vistas,
# procedimientos, triggers, datos) y carga las tablas y los datos de
# ejemplo. Úsalo antes de cada intento del simulacro de examen.
#
# Uso, como root en el VPS (hPanel → VPS → Terminal):
#   bash /var/www/diegorodriguezautos.com/deploy/reiniciar-practica.sh
#   bash /var/www/diegorodriguezautos.com/deploy/reiniciar-practica.sh --copia-del-sitio
#
# --copia-del-sitio: en lugar de los datos de ejemplo, copia los datos
# reales del inventario (sin las cuentas del panel). El sitio no se toca.
#
# Nunca toca la base del sitio (agencia_autos): el nombre de la base de
# práctica está fijo en este script. Guía: docs/14-examen-sql.md
# =============================================================
set -euo pipefail

DIR="${DIR:-/var/www/diegorodriguezautos.com}"
readonly PRACTICA="agencia_practica"   # fijo a propósito
readonly SITIO="agencia_autos"

ok()    { printf '\033[1;32m✔ %s\033[0m\n' "$*"; }
aviso() { printf '\033[1;31m! %s\033[0m\n' "$*"; }
falla() { aviso "$*"; exit 1; }

[ "$(id -u)" -eq 0 ] || falla "Corre este script como root (o con: sudo bash reiniciar-practica.sh)."
SQL="$(command -v mariadb || command -v mysql)" || falla "No se encontró MariaDB/MySQL. Primero corre deploy/instalar.sh."
DUMP="$(command -v mariadb-dump || command -v mysqldump)" || falla "No se encontró mariadb-dump/mysqldump."
"$SQL" -e "SELECT 1" >/dev/null 2>&1 || falla "La base de datos no responde (revisa: systemctl status mariadb)."
[ -f "$DIR/db/schema.sql" ] || falla "No se encontró $DIR/db/schema.sql."

case "${1:-}" in
  "") MODO="ejemplo" ;;
  --copia-del-sitio) MODO="sitio" ;;
  *) falla "Opción desconocida: $1  (usa: reiniciar-practica.sh [--copia-del-sitio])" ;;
esac

# Los permisos de los usuarios sobre agencia_practica (diego, practica...)
# se conservan: MariaDB los guarda aparte y vuelven a aplicar a la base nueva.
"$SQL" -e "DROP DATABASE IF EXISTS \`$PRACTICA\`; CREATE DATABASE \`$PRACTICA\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

if [ "$MODO" = "ejemplo" ]; then
  "$SQL" "$PRACTICA" < "$DIR/db/schema.sql"
  "$SQL" "$PRACTICA" < "$DIR/db/datos-ejemplo.sql"
  ok "Base '$PRACTICA' como nueva: tablas del sitio con los datos de ejemplo (8 autos, 3 clientes, 3 ventas, 5 pagos)"
else
  # Copia del sitio SIN la tabla de cuentas del panel (huellas de contraseñas)
  "$DUMP" --single-transaction --ignore-table="$SITIO.administradores" "$SITIO" | "$SQL" "$PRACTICA"
  "$SQL" "$PRACTICA" < "$DIR/db/schema.sql"   # crea vacía la tabla que se omitió
  ok "Base '$PRACTICA' con una COPIA de los datos reales (sin las cuentas del panel). El sitio no cambió."
fi

echo
echo "Entra a practicar con tu usuario (NO como root, así no puedes tocar el sitio por error):"
echo "  mariadb -u diego -p $PRACTICA"
if ! "$SQL" -N -e "SELECT 1 FROM mysql.db WHERE Db = '$PRACTICA' LIMIT 1" 2>/dev/null | grep -q 1; then
  aviso "Todavía no hay un usuario con permisos en $PRACTICA. Créalo una vez con:"
  echo "  bash $DIR/deploy/usuario-bd-visual.sh"
fi
