#!/usr/bin/env bash
# =============================================================
# llave-github.sh — prepara el VPS para descargar el código de un
# repositorio PRIVADO, con una "deploy key" de solo lectura.
# Córrelo ANTES de poner el repositorio en privado.
#
# Uso, como root en el VPS:
#   bash /var/www/diegorodriguezautos.com/deploy/llave-github.sh
# =============================================================
set -euo pipefail

DIR="${DIR:-/var/www/diegorodriguezautos.com}"
USUARIO_APP="deploy"
REPO_SSH="${REPO_SSH:-git@github.com:DieTad01/diegorodriguezautos.com.git}"
LLAVE="/home/$USUARIO_APP/.ssh/github_deploy"
# Huella oficial de GitHub (docs.github.com → "GitHub's SSH key fingerprints")
HUELLA_GITHUB="SHA256:+DiY3wvvV6TuJJhbpZisF/zLDA0zPMSvHdkr4UvCOqU"

paso()  { printf '\n\033[1;33m==> %s\033[0m\n' "$*"; }
ok()    { printf '\033[1;32m✔ %s\033[0m\n' "$*"; }
aviso() { printf '\033[1;31m! %s\033[0m\n' "$*"; }
falla() { aviso "$*"; exit 1; }
como_app() { sudo -u "$USUARIO_APP" -H bash -c "$1"; }

[ "$(id -u)" -eq 0 ] || falla "Corre este script como root."
[ -d "$DIR/.git" ] || falla "El sitio no está instalado en $DIR."

command -v ssh-keygen >/dev/null || DEBIAN_FRONTEND=noninteractive apt-get install -y -qq openssh-client >/dev/null

paso "1/4 Llave del servidor"
install -d -m 700 -o "$USUARIO_APP" -g "$USUARIO_APP" "/home/$USUARIO_APP/.ssh"
if [ ! -f "$LLAVE" ]; then
  como_app "ssh-keygen -q -t ed25519 -N '' -C 'vps-diegorodriguezautos (solo lectura)' -f '$LLAVE'"
  ok "Llave creada"
else
  ok "La llave ya existía"
fi

paso "2/4 Verificando que github.com sea el GitHub real"
HOSTS="/home/$USUARIO_APP/.ssh/known_hosts"
ENCONTRADA="$(ssh-keyscan -t ed25519 github.com 2>/dev/null || true)"
[ -n "$ENCONTRADA" ] || falla "No se pudo contactar a github.com por SSH (puerto 22)."
HUELLA="$(ssh-keygen -lf - <<<"$ENCONTRADA" | awk '{print $2}')"
[ "$HUELLA" = "$HUELLA_GITHUB" ] || falla "La huella de github.com ($HUELLA) NO coincide con la oficial. No continúes y revisa tu red."
grep -qF "$ENCONTRADA" "$HOSTS" 2>/dev/null || echo "$ENCONTRADA" >> "$HOSTS"
cat > "/home/$USUARIO_APP/.ssh/config" <<EOF
Host github.com
  IdentityFile $LLAVE
  IdentitiesOnly yes
EOF
chown "$USUARIO_APP:$USUARIO_APP" "$HOSTS" "/home/$USUARIO_APP/.ssh/config"
chmod 600 "$HOSTS" "/home/$USUARIO_APP/.ssh/config"
ok "Huella verificada: $HUELLA"

paso "3/4 Agrega esta llave en GitHub"
echo "  1. Abre: https://github.com/DieTad01/diegorodriguezautos.com/settings/keys"
echo "  2. Add deploy key → Title: VPS Hostinger → pega la línea de abajo."
echo "  3. NO marques 'Allow write access' (el servidor solo necesita leer)."
echo
cat "$LLAVE.pub"
echo
if { : </dev/tty; } 2>/dev/null; then read -rp "  Presiona Enter cuando la hayas agregado... " _ </dev/tty; fi

paso "4/4 Probando el acceso"
SALIDA="$(como_app "ssh -o BatchMode=yes -T git@github.com" 2>&1 || true)"
echo "$SALIDA" | grep -q "successfully authenticated" || falla "GitHub no aceptó la llave todavía. Respuesta: $SALIDA"
como_app "cd '$DIR' && git remote set-url origin '$REPO_SSH' && git fetch -q origin"
ok "El servidor descarga el código por SSH con la llave de solo lectura."
echo "  Ya puedes poner el repositorio en privado: GitHub → Settings → General → Danger Zone → Change visibility."
