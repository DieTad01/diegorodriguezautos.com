#!/usr/bin/env bash
# =============================================================
# UNIDAD 6. Prueba de conectividad JDBC y ODBC (actividad A6.1)
# Uso, como root en el VPS, después de db/proyecto/ejecutar.sh:
#   bash /var/www/diegorodriguezautos.com/db/proyecto/u6-conectividad/probar.sh
# Instala (si faltan) Java, el conector ODBC de MariaDB y pyodbc; descarga
# el conector JDBC verificando su huella; compila y ejecuta ambos programas.
# =============================================================
set -euo pipefail
cd "$(dirname "$0")"

CREDENCIALES="${CREDENCIALES:-/root/proyecto-credenciales.env}"
JDBC_VERSION="3.5.1"
JDBC_SHA1="1151269d76927b782351eaa15e981c56abc7717f"
JAR="/opt/mariadb-jdbc/mariadb-java-client-$JDBC_VERSION.jar"

[ -r "$CREDENCIALES" ] || { echo "No encuentro $CREDENCIALES: corre primero db/proyecto/ejecutar.sh"; exit 1; }
# shellcheck disable=SC1090
. "$CREDENCIALES"
export PROYECTO_USUARIO="p_app" PROYECTO_CLAVE="$CLAVE_APP"

echo "==> Instalando lo necesario (solo la primera vez)"
faltan=()
command -v javac >/dev/null || faltan+=(default-jdk-headless)
command -v isql  >/dev/null || faltan+=(unixodbc)
dpkg -s odbc-mariadb  >/dev/null 2>&1 || faltan+=(odbc-mariadb)
python_con_pyodbc() { for py in /usr/bin/python3 /usr/bin/python3.[0-9] /usr/bin/python3.[0-9][0-9]; do [ -x "$py" ] && "$py" -c "import pyodbc" 2>/dev/null && { echo "$py"; return; }; done; }
[ -n "$(python_con_pyodbc)" ] || faltan+=(python3-pyodbc)
if [ "${#faltan[@]}" -gt 0 ]; then
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "${faltan[@]}" >/dev/null
fi
if [ ! -f "$JAR" ] || [ "$(sha1sum "$JAR" | cut -d' ' -f1)" != "$JDBC_SHA1" ]; then
  install -d /opt/mariadb-jdbc
  curl -fsSL -o "$JAR.tmp" "https://repo1.maven.org/maven2/org/mariadb/jdbc/mariadb-java-client/$JDBC_VERSION/mariadb-java-client-$JDBC_VERSION.jar"
  [ "$(sha1sum "$JAR.tmp" | cut -d' ' -f1)" = "$JDBC_SHA1" ] || { rm -f "$JAR.tmp"; echo "La huella del conector JDBC no coincide: no se usa."; exit 1; }
  mv "$JAR.tmp" "$JAR"
fi

# DSN de ODBC (sin contraseña: esa se da al conectar)
DRIVER="$(odbcinst -q -d | grep -m1 -i mariadb | tr -d '[]')"
[ -n "$DRIVER" ] || { echo "No se encontró el driver ODBC de MariaDB."; exit 1; }
if ! grep -q '^\[agencia_proyecto\]' /etc/odbc.ini 2>/dev/null; then
  cat >> /etc/odbc.ini <<INI

[agencia_proyecto]
Description = Proyecto Taller de BD - agencia
Driver      = $DRIVER
Server      = 127.0.0.1
Port        = 3306
Database    = agencia_proyecto
CHARSET     = utf8mb4
INI
fi

echo; echo "==> ODBC: driver y DSN registrados"
odbcinst -q -d
odbcinst -q -s
echo; echo "==> ODBC con isql (cliente de línea de comandos de unixODBC)"
echo "SELECT marca, COUNT(*) AS autos FROM vehiculos GROUP BY marca" | isql -b -v agencia_proyecto "$PROYECTO_USUARIO" "$PROYECTO_CLAVE"

echo; echo "==> ODBC desde Python (pyodbc)"
"$(python_con_pyodbc)" conexion_odbc.py

echo; echo "==> JDBC desde Java"
TMP="$(mktemp -d)"
javac -encoding UTF-8 -d "$TMP" -cp "$JAR" ConexionJDBC.java
java -Dstdout.encoding=UTF-8 -Dfile.encoding=UTF-8 -cp "$TMP:$JAR" ConexionJDBC
rm -rf "$TMP"
