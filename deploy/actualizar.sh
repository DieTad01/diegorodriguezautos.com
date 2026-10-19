#!/usr/bin/env bash
# =============================================================
# actualizar.sh — pone en línea la última versión de GitHub
#
# Uso, como root en el VPS:
#   bash /var/www/diegorodriguezautos.com/deploy/actualizar.sh           # última versión de la rama actual
#   bash /var/www/diegorodriguezautos.com/deploy/actualizar.sh main      # cambiarse a otra rama (p. ej. main)
#   bash /var/www/diegorodriguezautos.com/deploy/actualizar.sh --volver  # regresar a la versión anterior
#
# Antes de cambiar nada respalda la base de datos. Si la versión nueva
# no responde, regresa sola a la anterior. Nunca toca el .env ni los autos.
# =============================================================
set -euo pipefail
exec </dev/null

DIR="${DIR:-/var/www/diegorodriguezautos.com}"
USUARIO_APP="deploy"
APP_PM2="diegorodriguezautos"
DB_NOMBRE="agencia_autos"
ESTADO="${ESTADO:-/var/backups/diegorodriguezautos}"   # respaldos y versión anterior
RESPALDOS_A_GUARDAR=15

paso()  { printf '\n\033[1;33m==> %s\033[0m\n' "$*"; }
ok()    { printf '\033[1;32m✔ %s\033[0m\n' "$*"; }
aviso() { printf '\033[1;31m! %s\033[0m\n' "$*"; }
falla() { aviso "$*"; exit 1; }
como_app() { sudo -u "$USUARIO_APP" -H --preserve-env=http_proxy,https_proxy,HTTP_PROXY,HTTPS_PROXY,no_proxy,NO_PROXY,NODE_EXTRA_CA_CERTS,npm_config_cafile env "PATH=$PATH" bash -c "$1"; }
# Si algo falla de forma inesperada, decirlo (nunca detenerse en silencio)
trap 'aviso "Se detuvo inesperadamente en la línea $LINENO de $(basename "$0"). Copia todo lo de arriba y pídele ayuda a Claude."' ERR
git_app() { como_app "cd '$DIR' && git $*"; }

[ "$(id -u)" -eq 0 ] || falla "Corre este script como root (o con: sudo bash actualizar.sh)."
[ -d "$DIR/.git" ] || falla "El sitio no está instalado en $DIR. Primero corre deploy/instalar.sh."
SQL_CLIENTE="$(command -v mariadb || command -v mysql)" || falla "No se encontró el cliente de la base de datos."
DUMP="$(command -v mariadb-dump || command -v mysqldump)" || falla "No se encontró mariadb-dump/mysqldump."

ANTES="$(git_app "rev-parse HEAD")"
RAMA_ACTUAL="$(git_app "rev-parse --abbrev-ref HEAD")"

case "${1:-}" in
  --volver)
    [ -s "$ESTADO/version-anterior" ] || falla "No hay una versión anterior registrada todavía."
    DESTINO="$(cat "$ESTADO/version-anterior")"
    RAMA="$RAMA_ACTUAL"
    ;;
  -*) falla "Opción desconocida: $1  (usa: actualizar.sh [rama] | actualizar.sh --volver)" ;;
  *)
    RAMA="${1:-$RAMA_ACTUAL}"
    [[ "$RAMA" =~ ^[A-Za-z0-9._/-]+$ ]] || falla "Nombre de rama inválido: $RAMA"
    ;;
esac

# Nadie debe editar archivos directamente en el servidor: los cambios van por GitHub
CAMBIOS_LOCALES="$(git_app "status --porcelain --untracked-files=no")"
if [ -n "$CAMBIOS_LOCALES" ]; then
  aviso "Hay archivos modificados a mano en el servidor:"
  echo "$CAMBIOS_LOCALES"
  falla "Súbelos a GitHub o descártalos con:  sudo -u $USUARIO_APP git -C $DIR checkout -- .   y vuelve a correr este script."
fi

# ---------- 1. Traer la versión ----------
paso "1/5 Buscando la versión en GitHub"
if [ -z "${DESTINO:-}" ]; then
  git_app "fetch -q origin '$RAMA'" || falla "No se pudo descargar la rama '$RAMA' de GitHub (¿existe? ¿el VPS tiene acceso al repositorio?)."
  DESTINO="$(git_app "rev-parse 'origin/$RAMA'")"
fi
if [ "$DESTINO" = "$ANTES" ] && [ "$RAMA" = "$RAMA_ACTUAL" ]; then
  ok "Ya tienes la última versión: $(git_app "log -1 --format='%h %s'")"
  exit 0
fi
echo "  Actual: $(git_app "log -1 --format='%h %s (%cr)' $ANTES")"
echo "  Nueva:  $(git_app "log -1 --format='%h %s (%cr)' $DESTINO")"

# ---------- 2. Respaldo de la base de datos ----------
paso "2/5 Respaldando la base de datos"
install -d -m 700 "$ESTADO"
RESPALDO="$ESTADO/bd-$(date +%Y%m%d-%H%M%S).sql.gz"
if ! ( umask 077; "$DUMP" --single-transaction --routines --triggers "$DB_NOMBRE" | gzip > "$RESPALDO" ); then
  rm -f "$RESPALDO"
  falla "No se pudo respaldar la base de datos (¿está encendida? revisa: systemctl status mariadb mysql). No se cambió nada."
fi
# shellcheck disable=SC2012
ls -1t "$ESTADO"/bd-*.sql.gz 2>/dev/null | tail -n +$((RESPALDOS_A_GUARDAR + 1)) | xargs -r rm -f
ok "Respaldo: $RESPALDO ($(du -h "$RESPALDO" | cut -f1)). Se guardan los últimos $RESPALDOS_A_GUARDAR."

# ---------- 3. Poner la versión ----------
poner_version() { # poner_version COMMIT
  git_app "checkout -q -B '$RAMA' '$1'"
  como_app "cd '$DIR' && npm ci --omit=dev --no-audit --no-fund --silent"
  "$SQL_CLIENTE" "$DB_NOMBRE" < "$DIR/db/schema.sql"
  # Pasa el usuario del panel de la versión anterior (.env) a la tabla de cuentas
  if [ -f "$DIR/scripts/usuarios-admin.js" ]; then como_app "cd '$DIR' && node scripts/usuarios-admin.js migrar"; fi
  como_app "cd '$DIR' && pm2 startOrReload ecosystem.config.js --update-env >/dev/null && pm2 save >/dev/null"
}

responde() { # hasta 20 s para que portada, inventario y sitemap contesten
  local _ ruta
  for _ in $(seq 1 20); do
    for ruta in / /api/vehiculos /sitemap.xml; do
      curl -fs -o /dev/null "http://127.0.0.1:3000$ruta" || { sleep 1; continue 2; }
    done
    return 0
  done
  return 1
}

paso "3/5 Instalando la versión nueva"
poner_version "$DESTINO"
ok "Código, dependencias y tablas al día"

# ---------- 4. Comprobar que funciona (y si no, regresar) ----------
paso "4/5 Comprobando que el sitio responde"
if ! responde; then
  aviso "La versión nueva NO responde. Regresando a la anterior..."
  como_app "pm2 logs $APP_PM2 --lines 25 --nostream" || true
  RAMA="$RAMA_ACTUAL"
  poner_version "$ANTES"
  if responde; then
    falla "Se regresó a la versión anterior y el sitio sigue funcionando. Revisa los mensajes de arriba."
  else
    falla "Tampoco responde la versión anterior. Revisa: sudo -u $USUARIO_APP pm2 logs $APP_PM2"
  fi
fi
ok "Portada, inventario y sitemap responden"

# ---------- 5. Listo ----------
paso "5/5 Listo"
echo "$ANTES" > "$ESTADO/version-anterior"
if ! git_app "diff --quiet $ANTES $DESTINO -- deploy/nginx.conf deploy/instalar.sh"; then
  aviso "Cambió la configuración del servidor (Nginx o el instalador). Para aplicarla corre: bash $DIR/deploy/instalar.sh"
fi
ok "En línea: $(git_app "log -1 --format='%h %s'")"
echo "  Si algo no te gusta, regresa con:  bash $DIR/deploy/actualizar.sh --volver"
