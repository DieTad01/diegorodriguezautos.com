#!/usr/bin/env bash
# =============================================================
# diagnostico.sh — revisa por qué no abre el sitio y dice qué hacer.
# No cambia nada; solo revisa.
#
# Uso, como root en el VPS (hPanel → VPS → Terminal):
#   curl -fsSLo diagnostico.sh https://raw.githubusercontent.com/DieTad01/diegorodriguezautos.com/claude/pensive-heisenberg-v62n8s/deploy/diagnostico.sh && bash diagnostico.sh
#   (o, si ya está instalado:  bash /var/www/diegorodriguezautos.com/deploy/diagnostico.sh)
# =============================================================
set -uo pipefail

DOMINIO="${DOMINIO:-diegorodriguezautos.com}"
DIR="${DIR:-/var/www/diegorodriguezautos.com}"
APP_PM2="diegorodriguezautos"
FALLAS=0

bien()  { printf '  \033[1;32m✔\033[0m %s\n' "$*"; }
mal()   { printf '  \033[1;31m✘ %s\033[0m\n' "$*"; FALLAS=$((FALLAS + 1)); }
hacer() { printf '    \033[1;33m→ %s\033[0m\n' "$*"; }
titulo(){ printf '\n\033[1m%s\033[0m\n' "$*"; }
activo() { # activo servicio  (con o sin systemd)
  if [ -d /run/systemd/system ]; then systemctl is-active --quiet "$1"; else pgrep -x "$2" >/dev/null; fi
}
ip_de() { getent ahostsv4 "$1" 2>/dev/null | awk 'NR==1{print $1}' || true; }

[ "$(id -u)" -eq 0 ] || { echo "Córrelo como root."; exit 1; }
# shellcheck disable=SC1091
. /etc/os-release 2>/dev/null || true
echo "Diagnóstico de $DOMINIO · ${PRETTY_NAME:-sistema desconocido} · $(date '+%F %T')"

# ---------- 1. ¿Está instalado? ----------
titulo "1. Instalación"
if [ -f "$DIR/server.js" ] && [ -f "$DIR/.env" ]; then
  bien "Sitio instalado en $DIR ($(sudo -u deploy git -C "$DIR" log -1 --format='%h %s' 2>/dev/null || echo 'versión desconocida'))"
else
  mal "El sitio NO está instalado en $DIR"
  hacer "Corre el instalador: curl -fsSLo instalar.sh https://raw.githubusercontent.com/DieTad01/diegorodriguezautos.com/claude/pensive-heisenberg-v62n8s/deploy/instalar.sh && bash instalar.sh"
fi

# ---------- 2. Servicios ----------
titulo "2. Servicios"
if activo nginx nginx; then bien "Nginx encendido"; else mal "Nginx apagado"; hacer "systemctl start nginx   (si falla: nginx -t para ver el error)"; fi
if activo mariadb mariadbd || activo mysql mysqld; then bien "Base de datos encendida"; else mal "Base de datos apagada"; hacer "systemctl start mariadb   (en Ubuntu: systemctl start mysql)"; fi
if command -v pm2 >/dev/null && sudo -u deploy -H env "PATH=$PATH" pm2 jlist 2>/dev/null | grep -q "\"name\":\"$APP_PM2\".*\"status\":\"online\""; then
  bien "Aplicación Node en línea (PM2)"
else
  mal "La aplicación Node NO está en línea"
  hacer "sudo -u deploy pm2 logs $APP_PM2 --lines 30   (para ver el error)"
  hacer "y luego: cd $DIR && sudo -u deploy pm2 start ecosystem.config.js && sudo -u deploy pm2 save"
fi

# ---------- 3. Respuestas dentro del servidor ----------
titulo "3. Respuestas dentro del servidor"
CODIGO_NODE="$(curl -s -o /dev/null -m 5 -w '%{http_code}' http://127.0.0.1:3000/ || true)"
[ "$CODIGO_NODE" = "200" ] && bien "Node responde (127.0.0.1:3000 → 200)" || { mal "Node no responde en 127.0.0.1:3000 (código: ${CODIGO_NODE:-ninguno})"; hacer "Revisa el punto 2 (PM2)"; }
CODIGO_API="$(curl -s -o /dev/null -m 5 -w '%{http_code}' http://127.0.0.1:3000/api/vehiculos || true)"
[ "$CODIGO_API" = "200" ] && bien "Inventario responde (conexión a la base de datos bien)" || { mal "El inventario falla (código: ${CODIGO_API:-ninguno}): casi siempre es la contraseña de la base en .env"; hacer "sudo -u deploy pm2 logs $APP_PM2 --lines 30"; }
CODIGO_NGINX="$(curl -s -o /dev/null -m 5 -w '%{http_code}' -H "Host: $DOMINIO" http://127.0.0.1/ || true)"
case "$CODIGO_NGINX" in
  200) bien "Nginx entrega el sitio por http" ;;
  301|308) bien "Nginx responde y redirige a https (código $CODIGO_NGINX)" ;;
  *) mal "Nginx no entrega el sitio (código: ${CODIGO_NGINX:-ninguno})"; hacer "Corre de nuevo: bash $DIR/deploy/instalar.sh" ;;
esac
if ss -ltn 2>/dev/null | grep -q ':443 '; then
  CODIGO_TLS="$(curl -sk -o /dev/null -m 5 -w '%{http_code}' --resolve "$DOMINIO:443:127.0.0.1" "https://$DOMINIO/" || true)"
  [ "$CODIGO_TLS" = "200" ] && bien "HTTPS responde dentro del servidor" || mal "HTTPS escucha pero responde ${CODIGO_TLS:-nada}"
fi

# ---------- 4. DNS: ¿el dominio apunta a este VPS? ----------
titulo "4. Dominio (DNS)"
IP_VPS="$(curl -4 -fs -m 8 https://api.ipify.org || curl -4 -fs -m 8 https://ifconfig.me || true)"
IP_DOM="$(ip_de "$DOMINIO")"; IP_WWW="$(ip_de "www.$DOMINIO")"
echo "  IP de este VPS:        ${IP_VPS:-no se pudo saber}"
echo "  $DOMINIO apunta a:     ${IP_DOM:-(no resuelve)}"
echo "  www.$DOMINIO apunta a: ${IP_WWW:-(no resuelve)}"
if [ -n "$IP_VPS" ] && [ "$IP_DOM" = "$IP_VPS" ]; then
  bien "El dominio apunta a este VPS"
else
  mal "El dominio NO apunta a este VPS"
  hacer "hPanel → Dominios → $DOMINIO → DNS: edita el registro A de '@' con el valor ${IP_VPS:-<IP del VPS>} (TTL 300)"
  hacer "Si el dominio usa otros nameservers (no los de Hostinger), el cambio se hace donde estén"
fi
[ -n "$IP_VPS" ] && [ -n "$IP_WWW" ] && [ "$IP_WWW" != "$IP_VPS" ] && { mal "www apunta a otra IP"; hacer "El registro de 'www' debe ser CNAME a $DOMINIO o A con ${IP_VPS}"; }

# ---------- 5. Puertos y firewall ----------
titulo "5. Puertos y firewall"
ss -ltn 2>/dev/null | grep -q ':80 ' && bien "Puerto 80 escuchando" || { mal "Nada escucha en el puerto 80"; hacer "systemctl start nginx"; }
if command -v ufw >/dev/null; then
  ESTADO_UFW="$(ufw status 2>/dev/null)"
  if echo "$ESTADO_UFW" | grep -q "Status: active"; then
    echo "$ESTADO_UFW" | grep -qE '^80(/tcp)?\s+ALLOW' && bien "Firewall del VPS permite el puerto 80" || { mal "El firewall del VPS bloquea el 80"; hacer "ufw allow 80/tcp && ufw allow 443/tcp"; }
    echo "$ESTADO_UFW" | grep -qE '^443(/tcp)?\s+ALLOW' && bien "Firewall del VPS permite el puerto 443" || { mal "El firewall del VPS bloquea el 443"; hacer "ufw allow 443/tcp"; }
  else
    bien "Firewall del VPS (ufw) inactivo: no bloquea"
  fi
fi
echo "  Nota: Hostinger tiene además un firewall propio en hPanel → VPS → Seguridad → Firewall."
echo "        Si ahí hay reglas, deben permitir TCP 80 y 443 (y 22 para SSH)."

# ---------- 6. Certificado HTTPS ----------
titulo "6. Certificado HTTPS"
if [ -d "/etc/letsencrypt/live/$DOMINIO" ]; then
  VENCE="$(openssl x509 -enddate -noout -in "/etc/letsencrypt/live/$DOMINIO/cert.pem" 2>/dev/null | cut -d= -f2)"
  bien "Certificado instalado (vence: ${VENCE:-?}; se renueva solo)"
else
  mal "No hay certificado HTTPS: https:// no abrirá (y /admin no funciona sin él)"
  hacer "Cuando el punto 4 esté bien, corre: bash $DIR/deploy/instalar.sh  (lo saca solo)"
  hacer "Mientras tanto prueba entrar con http://$DOMINIO (sin la s)"
fi

# ---------- 7. Errores recientes ----------
titulo "7. Últimos errores registrados"
if [ -s /var/log/nginx/error.log ]; then echo "  Nginx:"; tail -n 5 /var/log/nginx/error.log | sed 's/^/    /'; fi
ERR_APP="/home/deploy/.pm2/logs/$APP_PM2-error.log"
[ -s "$ERR_APP" ] || ERR_APP="$(ls -1t /home/deploy/.pm2/logs/"$APP_PM2"-error*.log 2>/dev/null | head -1)"
if [ -n "$ERR_APP" ] && [ -s "$ERR_APP" ]; then echo "  Aplicación:"; tail -n 8 "$ERR_APP" | sed 's/^/    /'; else echo "  Aplicación: sin errores registrados"; fi

# ---------- Resumen ----------
echo
if [ "$FALLAS" -eq 0 ]; then
  printf '\033[1;32mTodo bien desde el servidor.\033[0m Si en tu navegador no abre: prueba en modo incógnito o desde los datos del celular (el DNS puede tardar en actualizarse en tu red).\n'
else
  printf '\033[1;31m%s problema(s) encontrado(s).\033[0m Corrige de arriba hacia abajo (el primero suele causar los demás).\n' "$FALLAS"
fi
echo "Copia todo este resultado y pégaselo a Claude si necesitas ayuda (no contiene contraseñas)."
