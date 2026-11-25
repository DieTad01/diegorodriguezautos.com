#!/usr/bin/env bash
# =============================================================
# PROYECTO FINAL · Taller de Base de Datos
# Ejecuta TODO el proyecto en la base agencia_proyecto y guarda la
# salida de cada unidad como evidencia en /root/evidencias-proyecto/.
#
# Uso, como root en el VPS (hPanel → VPS → Terminal):
#   bash /var/www/diegorodriguezautos.com/db/proyecto/ejecutar.sh
#   bash /var/www/diegorodriguezautos.com/db/proyecto/ejecutar.sh --con-conectividad   # + unidad 6 (instala Java y ODBC)
#
# - Solo toca la base agencia_proyecto (la borra y la crea limpia) y los
#   usuarios p_* / roles rol_* del proyecto. NUNCA la base del sitio.
# - Las contraseñas de los usuarios del proyecto se generan al azar y se
#   guardan en /root/proyecto-credenciales.env (solo root).
# =============================================================
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
readonly BD="agencia_proyecto"          # fijo a propósito
EVID="${EVID:-/root/evidencias-proyecto}"
CRED="${CRED:-/root/proyecto-credenciales.env}"   # fuera de la carpeta de evidencias

ok()    { printf '\033[1;32m✔ %s\033[0m\n' "$*"; }
paso()  { printf '\n\033[1;33m==> %s\033[0m\n' "$*"; }
aviso() { printf '\033[1;31m! %s\033[0m\n' "$*"; }
falla() { aviso "$*"; exit 1; }

[ "$(id -u)" -eq 0 ] || falla "Corre este script como root (o con: sudo bash ejecutar.sh)."
SQL="$(command -v mariadb || command -v mysql)" || falla "No se encontró MariaDB/MySQL."
"$SQL" -e "SELECT 1" >/dev/null 2>&1 || falla "La base de datos no responde (systemctl status mariadb)."
CONECTIVIDAD=0
[ "${1:-}" = "--con-conectividad" ] && CONECTIVIDAD=1

umask 077
install -d -m 700 "$EVID"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# Ejecuta un archivo .sql y guarda la evidencia (instrucción + resultado)
correr() { # correr archivo.sql evidencia.txt [--force]
  local archivo=$1 salida=$2; shift 2
  {
    echo "# $(basename "$archivo") — $(date '+%Y-%m-%d %H:%M:%S') — MariaDB $("$SQL" -N -e 'SELECT VERSION()')"
    "$SQL" --default-character-set=utf8mb4 -t -vvv "$@" < "$archivo" 2>&1
  } > "$EVID/$salida"
}

# ---------- Contraseñas aleatorias ----------
paso "Contraseñas de los usuarios del proyecto"
clave() { openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | cut -c1-20; }
{
  echo "# Usuarios del proyecto (base $BD). Generadas $(date '+%Y-%m-%d %H:%M')."
  for u in TEMPORAL TEMPORAL2 GERENTE VENDEDOR ANA CARLOS CONSULTA APP; do echo "CLAVE_$u=$(clave)"; done
} > "$CRED"
chmod 600 "$CRED"
# shellcheck disable=SC1090
. "$CRED"
ok "Guardadas en $CRED (solo root puede leerlas)"

# ---------- Base limpia ----------
paso "Base $BD desde cero"
"$SQL" -e "DROP DATABASE IF EXISTS \`$BD\`; CREATE DATABASE \`$BD\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
ok "Base creada"

paso "Unidad 1 · DDL"
correr "$DIR/u1-ddl.sql" u1-ddl.txt
ok "u1-ddl.txt"

paso "Unidad 2 · DML"
correr "$DIR/u2-dml.sql" u2-dml.txt
correr "$DIR/u2-errores-restricciones.sql" u2-errores-restricciones.txt --force
ok "u2-dml.txt · u2-errores-restricciones.txt (las 11 restricciones rechazando datos)"

paso "Unidad 3 · Control de acceso"
sed -e "s/__CLAVE_TEMPORAL__/$CLAVE_TEMPORAL/" -e "s/__CLAVE_TEMPORAL2__/$CLAVE_TEMPORAL2/" \
    -e "s/__CLAVE_GERENTE__/$CLAVE_GERENTE/"   -e "s/__CLAVE_VENDEDOR__/$CLAVE_VENDEDOR/" \
    -e "s/__CLAVE_ANA__/$CLAVE_ANA/"           -e "s/__CLAVE_CARLOS__/$CLAVE_CARLOS/" \
    -e "s/__CLAVE_CONSULTA__/$CLAVE_CONSULTA/" -e "s/__CLAVE_APP__/$CLAVE_APP/" \
    "$DIR/u3-acceso.sql" > "$TMP/u3.sql"
grep -Eq '__CLAVE_[A-Z0-9]+__' "$TMP/u3.sql" && falla "Quedó una contraseña sin reemplazar en u3-acceso.sql"
correr "$TMP/u3.sql" u3-acceso.txt
sed -i -E "s/IDENTIFIED BY '[^']*'/IDENTIFIED BY '********'/g" "$EVID/u3-acceso.txt"   # no dejar contraseñas en la evidencia
ok "u3-acceso.txt"

paso "Unidad 4 · Concurrencia"
correr "$DIR/u4-concurrencia.sql" u4-concurrencia.txt
ok "u4-concurrencia.txt"

paso "Unidad 5 · SQL procedural"
correr "$DIR/u5-procedural.sql" u5-procedural.txt
correr "$DIR/u5-errores.sql" u5-errores.txt --force
ok "u5-procedural.txt · u5-errores.txt"

# ---------- Pruebas de permisos entrando como cada usuario ----------
paso "Unidad 3 · Pruebas de permisos (entrando como cada usuario)"
como() { # como usuario CLAVE "SQL" → imprime el resultado
  local cnf="$TMP/$1.cnf"
  printf '[client]\nuser=%s\npassword=%s\n' "$1" "$2" > "$cnf"
  { "$SQL" --defaults-extra-file="$cnf" --default-character-set=utf8mb4 -t "$BD" -e "$3" 2>&1 || true; } | sed 's/ at line [0-9]*//'
}
prueba() { # prueba usuario CLAVE permitido|negado "descripción" "SQL"
  local salida resultado
  salida="$(como "$1" "$2" "$5" || true)"   # las negadas fallan a propósito
  if grep -q '^ERROR' <<<"$salida"; then resultado=negado; else resultado=permitido; fi
  if [ "$resultado" = "$3" ]; then printf '✔ %-11s %-9s %s\n' "$1" "$3" "$4"; else printf '✘ %-11s esperaba %s pero fue %s: %s\n' "$1" "$3" "$resultado" "$4"; fi
  sed 's/^/      /' <<<"$salida"
}
{
  echo "# Pruebas de permisos — $(date '+%Y-%m-%d %H:%M:%S')"
  echo "# ✔ = el servidor hizo lo esperado (permitir o negar)"
  echo
  prueba p_consulta "$CLAVE_CONSULTA" permitido "leer vehiculos"            "SELECT COUNT(*) AS autos FROM vehiculos"
  prueba p_consulta "$CLAVE_CONSULTA" permitido "leer solo id y nombre de clientes" "SELECT id, nombre FROM clientes LIMIT 3"
  prueba p_consulta "$CLAVE_CONSULTA" negado    "leer el correo (nivel columna)"    "SELECT email FROM clientes"
  prueba p_consulta "$CLAVE_CONSULTA" negado    "leer ventas (sin permiso de tabla)" "SELECT * FROM ventas"
  prueba p_consulta "$CLAVE_CONSULTA" permitido "reporte por procedimiento (SQL SECURITY DEFINER)" "CALL ventas_del_mes(2026, 10)"
  prueba p_consulta "$CLAVE_CONSULTA" negado    "modificar un precio"                "UPDATE vehiculos SET precio = 1 WHERE id = 1"
  prueba p_vendedor "$CLAVE_VENDEDOR" permitido "ver ventas"                         "SELECT COUNT(*) AS ventas FROM ventas"
  prueba p_vendedor "$CLAVE_VENDEDOR" permitido "cambiar estado de un auto (columna permitida)" "UPDATE vehiculos SET estado = 'apartado' WHERE id = 7"
  prueba p_vendedor "$CLAVE_VENDEDOR" negado    "cambiar la marca (columna no permitida)" "UPDATE vehiculos SET marca = 'X' WHERE id = 7"
  prueba p_vendedor "$CLAVE_VENDEDOR" negado    "borrar ventas"                      "DELETE FROM ventas WHERE id = 1"
  prueba p_vendedor "$CLAVE_VENDEDOR" negado    "crear tablas"                       "CREATE TABLE x (id INT)"
  prueba p_ana      "$CLAVE_ANA"      permitido "ver SUS compras (vista por fila)"   "SELECT * FROM mis_compras"
  prueba p_ana      "$CLAVE_ANA"      permitido "ver SUS pagos"                      "SELECT * FROM mis_pagos"
  prueba p_ana      "$CLAVE_ANA"      negado    "ver la tabla ventas"                "SELECT * FROM ventas"
  prueba p_ana      "$CLAVE_ANA"      negado    "cambiar su saldo"                   "UPDATE mis_compras SET precio_final = 1"
  prueba p_carlos   "$CLAVE_CARLOS"   permitido "la MISMA consulta da otros datos"   "SELECT * FROM mis_compras"
  prueba p_gerente  "$CLAVE_GERENTE"  permitido "todo en la base del proyecto"       "SELECT COUNT(*) AS ventas FROM ventas; SELECT CURRENT_ROLE() AS rol"
  prueba p_gerente  "$CLAVE_GERENTE"  permitido "comisiones (procedimiento con cursor)" "CALL calcular_comisiones()"
  prueba p_gerente  "$CLAVE_GERENTE"  negado    "entrar a la base del sitio real"    "SELECT * FROM agencia_autos.vehiculos LIMIT 1"
  prueba p_app      "$CLAVE_APP"      negado    "borrar una tabla (usuario de aplicación)" "DROP TABLE bitacora"
} > "$EVID/u3-pruebas-permisos.txt"
grep -c '^✔' "$EVID/u3-pruebas-permisos.txt" | xargs -I{} echo "  {} de $(grep -c '^[✔✘]' "$EVID/u3-pruebas-permisos.txt") pruebas como se esperaba"
if grep -q '^✘' "$EVID/u3-pruebas-permisos.txt"; then grep '^✘' "$EVID/u3-pruebas-permisos.txt"; aviso "Hay pruebas de permisos que no salieron como se esperaba"; fi
ok "u3-pruebas-permisos.txt"

paso "Unidad 4 · Simulador de concurrencia (2 sesiones, unos 20 segundos)"
bash "$DIR/u4-simulador.sh" 2>&1 | sed 's/\x1b\[[0-9;]*m//g' > "$EVID/u4-simulador.txt"
ok "u4-simulador.txt"

if [ "$CONECTIVIDAD" = 1 ]; then
  paso "Unidad 6 · Conectividad JDBC y ODBC"
  CREDENCIALES="$CRED" bash "$DIR/u6-conectividad/probar.sh" 2>&1 | grep -v 'Picked up' > "$EVID/u6-conectividad.txt"
  ok "u6-conectividad.txt"
fi

# ---------- Resumen ----------
printf '\n\033[1;32m===== Proyecto ejecutado =====\033[0m\n'
"$SQL" -t "$BD" -e "SELECT
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '$BD' AND table_type = 'BASE TABLE') AS tablas,
  (SELECT COUNT(*) FROM information_schema.views WHERE table_schema = '$BD') AS vistas,
  (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = '$BD' AND routine_type = 'PROCEDURE') AS procedimientos,
  (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = '$BD' AND routine_type = 'FUNCTION') AS funciones,
  (SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_schema = '$BD') AS triggers,
  (SELECT COUNT(*) FROM mysql.user WHERE user LIKE 'p\\_%') AS usuarios,
  (SELECT COUNT(*) FROM mysql.user WHERE is_role = 'Y' AND user LIKE 'rol\\_%') AS roles"
echo "Evidencias en $EVID:"
ls -1 "$EVID" | sed 's/^/  /'
[ "$CONECTIVIDAD" = 1 ] || echo "  (unidad 6: vuelve a correr con --con-conectividad, o: bash $DIR/u6-conectividad/probar.sh)"
echo "Bájalas a tu computadora:  scp -r root@diegorodriguezautos.com:$EVID ."
