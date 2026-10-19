#!/usr/bin/env bash
# =============================================================
# usuario-bd-visual.sh — crea un usuario de MariaDB/MySQL para ver la
# base con un programa visual (DBeaver, HeidiSQL...) desde TU computadora,
# a través de un túnel SSH. El puerto 3306 sigue cerrado a internet.
#
# Uso, como root en el VPS:
#   bash /var/www/diegorodriguezautos.com/deploy/usuario-bd-visual.sh            # crear o cambiar contraseña
#   bash /var/www/diegorodriguezautos.com/deploy/usuario-bd-visual.sh --quitar diego
#
# Permisos que puede tener el usuario:
#   1) Solo VER la base del sitio (recomendado)    + todo en agencia_practica
#   2) Ver y EDITAR filas de la base del sitio      + todo en agencia_practica
# Nunca puede borrar tablas, ver las cuentas del panel ni tocar otras bases. Guía: docs/13-mariadb-visual.md
# =============================================================
set -euo pipefail

DIR="${DIR:-/var/www/diegorodriguezautos.com}"
DB_SITIO="agencia_autos"
DB_PRACTICA="agencia_practica"

ok()    { printf '\033[1;32m✔ %s\033[0m\n' "$*"; }
aviso() { printf '\033[1;31m! %s\033[0m\n' "$*"; }
falla() { aviso "$*"; exit 1; }

[ "$(id -u)" -eq 0 ] || falla "Corre este script como root (o con: sudo bash usuario-bd-visual.sh)."
SQL="$(command -v mariadb || command -v mysql)" || falla "No se encontró MariaDB/MySQL. Primero corre deploy/instalar.sh."
"$SQL" -e "SELECT 1" >/dev/null 2>&1 || falla "La base de datos no responde (revisa: systemctl status mariadb)."

valido() { [[ "$1" =~ ^[a-z][a-z0-9_]{2,31}$ ]] && ! [[ "$1" =~ ^(root|agencia_app|practica|mysql|mariadb|debian-sys-maint)$ ]]; }

# ---------- Quitar ----------
if [ "${1:-}" = "--quitar" ]; then
  U="${2:-}"
  valido "$U" || falla "Indica el usuario a quitar, por ejemplo: --quitar diego"
  "$SQL" -e "DROP USER IF EXISTS '$U'@'localhost';"
  ok "Usuario '$U' borrado de la base de datos. Los programas que lo usaban ya no pueden entrar."
  exit 0
fi

{ : </dev/tty; } 2>/dev/null || falla "Este script necesita una terminal para pedirte los datos."

# ---------- Datos ----------
read -rp "Nombre del usuario de base de datos [diego]: " U </dev/tty
U="${U:-diego}"
valido "$U" || falla "Usuario inválido: minúsculas, números y _ (3-32), empezando con letra. No uses root, agencia_app ni practica."

echo "¿Qué podrá hacer en la base del SITIO ($DB_SITIO)?"
echo "  1) Solo ver los datos (recomendado: los autos se editan en el panel /admin)"
echo "  2) Ver y editar filas (cuidado: un cambio aquí se ve de inmediato en la página)"
read -rp "Elige 1 o 2 [1]: " NIVEL </dev/tty
case "${NIVEL:-1}" in
  1) PERMISOS="SELECT"; TEXTO="solo ver" ;;
  2) PERMISOS="SELECT, INSERT, UPDATE, DELETE"; TEXTO="ver y editar filas" ;;
  *) falla "Opción inválida." ;;
esac

while :; do
  read -rsp "Contraseña para '$U' (mínimo 12 caracteres; no se ve al escribir): " C1 </dev/tty; echo
  read -rsp "Repítela: " C2 </dev/tty; echo
  if [ "${#C1}" -lt 12 ]; then aviso "Muy corta."; elif [ "$C1" != "$C2" ]; then aviso "No coinciden."; else break; fi
done
# Escapar \ y ' para meterla en SQL de forma segura
CLAVE_SQL="${C1//\\/\\\\}"; CLAVE_SQL="${CLAVE_SQL//\'/\\\'}"
unset C1 C2

# ---------- Base de práctica (si no existe, con tablas y datos de ejemplo) ----------
if [ -z "$("$SQL" -N -e "SHOW DATABASES LIKE '$DB_PRACTICA'")" ]; then
  "$SQL" -e "CREATE DATABASE \`$DB_PRACTICA\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
  "$SQL" "$DB_PRACTICA" < "$DIR/db/schema.sql"
  [ -f "$DIR/db/datos-ejemplo.sql" ] && "$SQL" "$DB_PRACTICA" < "$DIR/db/datos-ejemplo.sql"
  ok "Base de práctica '$DB_PRACTICA' creada con tablas y datos de ejemplo"
fi

# ---------- Usuario (por stdin: la contraseña no aparece en la lista de procesos) ----------
"$SQL" <<SQL
CREATE USER IF NOT EXISTS '$U'@'localhost' IDENTIFIED BY '$CLAVE_SQL';
ALTER USER '$U'@'localhost' IDENTIFIED BY '$CLAVE_SQL';
REVOKE ALL PRIVILEGES, GRANT OPTION FROM '$U'@'localhost';
GRANT ALL PRIVILEGES ON \`$DB_PRACTICA\`.* TO '$U'@'localhost';
SQL
# Base del sitio: permiso tabla por tabla, MENOS `administradores` (cuentas del
# panel): así este usuario nunca ve las huellas de contraseñas ni puede
# cambiarlas para entrar al panel. Si en el futuro hay tablas nuevas, vuelve a
# correr este script para incluirlas.
TABLAS="$("$SQL" -N -e "SELECT table_name FROM information_schema.tables WHERE table_schema = '$DB_SITIO' AND table_name <> 'administradores'")"
[ -n "$TABLAS" ] || falla "No se encontraron tablas en $DB_SITIO."
for T in $TABLAS; do
  [[ "$T" =~ ^[a-z_]+$ ]] || continue
  "$SQL" -e "GRANT $PERMISOS ON \`$DB_SITIO\`.\`$T\` TO '$U'@'localhost';"
done
"$SQL" -e "FLUSH PRIVILEGES;"
unset CLAVE_SQL
ok "Usuario '$U' listo: $TEXTO en $DB_SITIO (excepto las cuentas del panel), todo en $DB_PRACTICA"

# ---------- El puerto debe seguir cerrado a internet ----------
if command -v ss >/dev/null && ss -ltnH 2>/dev/null | awk '{print $4}' | grep -qE '^(0\.0\.0\.0|\[::\]|\*):3306$'; then
  aviso "OJO: la base escucha en todas las direcciones (puerto 3306 abierto). Debe ser solo 127.0.0.1:"
  echo "  en /etc/mysql/mariadb.conf.d/50-server.cnf pon  bind-address = 127.0.0.1  y corre  systemctl restart mariadb"
else
  ok "El puerto 3306 solo escucha dentro del servidor: se entra únicamente por túnel SSH"
fi

cat <<EOF

En tu programa visual (DBeaver, HeidiSQL...) crea una conexión MariaDB con:
  Pestaña principal:  Host 127.0.0.1 · Puerto 3306 · Base $DB_SITIO (o $DB_PRACTICA) · Usuario $U · tu contraseña
  Pestaña SSH:        Host diegorodriguezautos.com · Puerto 22 · Usuario root · Llave: tu id_ed25519
Paso a paso: docs/13-mariadb-visual.md
EOF
