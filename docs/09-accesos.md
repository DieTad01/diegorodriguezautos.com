# 9. Accesos: quién entra a qué y cómo protegerlo

[← Volver al índice](README.md)

## Mapa de accesos

Ordenados del más poderoso al menos: quien tiene el primero puede cambiar todos los demás.

| # | Acceso | Dónde se entra | Qué permite | Dónde está la clave | Cómo cambiarla | Si la pierdes |
|---|---|---|---|---|---|---|
| 1 | **Cuenta de Hostinger** | [hpanel.hostinger.com](https://hpanel.hostinger.com) | Todo: el VPS, el dominio y el DNS | Tu gestor de contraseñas | hPanel → Perfil → Seguridad | Recuperación por correo de Hostinger |
| 2 | **VPS como root** | hPanel → VPS → **Terminal**, o `ssh root@IP` | Todo lo del servidor: código, base de datos, `.env` | Llave SSH en tu computadora (o contraseña de root) | hPanel → VPS → Configuración → contraseña de root / claves SSH | Entra por la Terminal de hPanel y cámbiala ahí |
| 3 | **Cuenta de GitHub** | [github.com](https://github.com) | Cambiar el código que llegará al sitio | Tu gestor de contraseñas + 2FA | GitHub → Settings → Password and authentication | Recuperación de GitHub (guarda los códigos de recuperación de 2FA) |
| 4 | **Panel `/admin`** | `https://diegorodriguezautos.com/admin` | Agregar, editar y borrar autos | Solo tú la sabes; en el servidor solo hay una huella cifrada (`ADMIN_PASSWORD_HASH` en `.env`) | `bash /var/www/diegorodriguezautos.com/deploy/cambiar-admin.sh` | El mismo comando: no pide la contraseña anterior |
| 5 | **Base de datos (administrador)** | En el VPS: `sudo mariadb` | Todas las bases | No tiene contraseña: solo entra el root del VPS | — | — |
| 6 | **Base de datos (usuario del sitio)** | Solo lo usa el sitio | Leer y escribir filas; **no** puede borrar tablas | `DB_PASSWORD` en `.env` (aleatoria) | Ver [Cambiar la contraseña de la base](#cambiar-la-contraseña-de-la-base-del-sitio) | Igual |
| 7 | **Llave del VPS en GitHub** (si el repo es privado) | Automático en cada actualización | Solo **leer** el código | `/home/deploy/.ssh/github_deploy` | Bórrala en GitHub y vuelve a correr `llave-github.sh` | Igual |
| 8 | **Google** (Drive de las fotos, Search Console) | google.com | Las fotos publicadas y cómo te ve Google | Tu cuenta de Google + 2FA | Cuenta de Google → Seguridad | Recuperación de Google |

## Lo mínimo que debes hacer

1. **Activa la verificación en dos pasos (2FA)** en Hostinger, GitHub y Google. Es lo que más protege: aunque alguien robe una contraseña, no puede entrar.
2. **Usa un gestor de contraseñas** (Bitwarden, 1Password, el de Google o Apple) y una contraseña distinta para cada cosa.
3. **Entra al VPS con llave SSH** y apaga el acceso con contraseña ([5. Practicar MySQL por SSH](05-practica-mysql-ssh.md), sección 1).
4. **No compartas el usuario del panel.** Si alguien más necesita entrar un rato, cambia la contraseña después con `cambiar-admin.sh`.

## Panel de administración

- Hay **un solo usuario**. Su contraseña nunca se guarda: el servidor guarda una huella cifrada (scrypt) y compara contra ella.
- **5 intentos fallidos** desde la misma conexión bloquean el acceso **15 minutos**. Nginx agrega otro límite.
- La sesión dura **8 horas** y solo funciona por **HTTPS**.

### Cambiar el usuario o la contraseña (o si la olvidaste)

En el VPS:

```bash
bash /var/www/diegorodriguezautos.com/deploy/cambiar-admin.sh
```

Pide el usuario nuevo (Enter para dejar el mismo) y la contraseña nueva dos veces. Además **cierra todas las sesiones abiertas** en cualquier computadora o celular.

## Cambiar la contraseña de la base del sitio

Hazlo si crees que alguien vio el archivo `.env`:

```bash
sed -i 's/^DB_PASSWORD=.*/DB_PASSWORD=/' /var/www/diegorodriguezautos.com/.env   # la deja vacía
bash /var/www/diegorodriguezautos.com/deploy/instalar.sh                         # genera y aplica una nueva
```

El instalador ve que está vacía, crea una nueva aleatoria, la aplica en la base y la guarda en `.env`. No borra datos.

## Dónde están los secretos

| Secreto | Dónde | ¿En GitHub? |
|---|---|---|
| Contraseña de la base del sitio, huella del admin, `SESSION_SECRET` | `/var/www/diegorodriguezautos.com/.env` (solo lo lee el usuario `deploy`) | **No, nunca** (`.gitignore` lo bloquea) |
| Llave SSH de tu computadora | Tu computadora (`~/.ssh/id_ed25519`) | No |
| Llave de solo lectura del VPS para GitHub | `/home/deploy/.ssh/github_deploy` | Solo la parte **pública**, en Deploy keys |
| Respaldos de la base | `/var/backups/diegorodriguezautos/` (solo root) | No |
| Certificado HTTPS | `/etc/letsencrypt/` (lo maneja Certbot solo) | No |

**Si un secreto se filtra** (por ejemplo, se subió `.env` por error): cámbialo de inmediato. Borrarlo de GitHub no basta, porque queda en el historial.

- Contraseña de la base: ver arriba.
- Admin y `SESSION_SECRET`: `cambiar-admin.sh`.
- Llave del VPS: bórrala en GitHub → Settings → Deploy keys y vuelve a correr `llave-github.sh`.

## ¿Repositorio público o privado?

**Recomendación: ponlo en privado**, siguiendo los pasos de abajo en orden.

**No es por seguridad del código.** Se revisó que el repositorio **no tiene contraseñas ni secretos**, y el sitio está diseñado para ser seguro aunque el código sea público (así funcionan los proyectos de código abierto). Pero:

| A favor de privado | A favor de público |
|---|---|
| Es el sitio de tu negocio: nadie más necesita ver ni copiar tu diseño, textos o aviso de privacidad | Sirve como portafolio (por ejemplo, para mostrarlo en tu escuela o a un empleador) |
| Da menos pistas a quien quiera atacar el sitio (estructura, rutas como `/admin`, versiones) | Para el instalador de una sola línea (`curl ...`) no hace falta llave |
| El historial muestra nombres y correos de quien hizo cada cambio | |

Si necesitas que alguien lo vea (por ejemplo, tu profesor del taller), déjalo privado e **invítalo como colaborador**: GitHub → Settings → Collaborators → Add people. Puedes quitarlo cuando quieras.

### Repositorio privado

El VPS descarga el código de GitHub al actualizar. Si el repositorio es privado, **antes** de cambiarlo necesita una llave de solo lectura. Si no, las actualizaciones fallan.

1. En el VPS:
   ```bash
   bash /var/www/diegorodriguezautos.com/deploy/llave-github.sh
   ```
   - Crea una llave para el servidor.
   - Verifica que github.com sea el GitHub real (compara la huella oficial).
   - Te muestra una línea que empieza con `ssh-ed25519 ...`.
2. En GitHub → el repositorio → **Settings → Deploy keys → Add deploy key**:
   - Title: `VPS Hostinger`.
   - Key: pega la línea.
   - **No** marques "Allow write access".
3. Regresa a la terminal y presiona Enter. Debe decir **"El servidor descarga el código por SSH con la llave de solo lectura"**.
4. Ahora sí: GitHub → **Settings → General → Danger Zone → Change repository visibility → Make private**.
5. Prueba: `bash /var/www/diegorodriguezautos.com/deploy/actualizar.sh` debe decir "Ya tienes la última versión".

Después de hacerlo privado:

- El instalador ya no se puede descargar con `curl` desde GitHub; usa la copia del servidor: `bash /var/www/diegorodriguezautos.com/deploy/instalar.sh`.
- Para **instalar en un VPS nuevo** desde cero, descarga el repositorio en tu computadora, sube la carpeta al VPS o haz público el repositorio un momento.
- Claude puede seguir trabajando en él (la app de Claude en GitHub tiene acceso a tus repositorios privados si se lo diste).

## Revisión de accesos (cada 3 meses)

- [ ] GitHub → Settings → **Collaborators**: ¿solo quien debe?
- [ ] GitHub → Settings → **Deploy keys**: ¿solo la del VPS?
- [ ] GitHub → tu perfil → Settings → **Applications**: ¿reconoces todas las apps con acceso?
- [ ] hPanel → VPS → **Claves SSH**: ¿solo tus computadoras?
- [ ] ¿Sigue activo el 2FA en Hostinger, GitHub y Google?
- [ ] ¿Tienes un respaldo reciente de la base **fuera** del servidor?
