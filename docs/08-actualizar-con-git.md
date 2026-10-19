# 8. Actualizar el sitio con git

[← Volver al índice](README.md)

## Cómo está organizado

```
 Tu computadora / Claude          GitHub                       VPS (Hostinger)
 ───────────────────────          ──────                       ───────────────
 haces un cambio  ──git push──>   guarda todas las     ──>     actualizar.sh descarga
                                  versiones (historial)        la versión y la pone en línea
```

- **GitHub es la fuente de la verdad.** El código del VPS siempre es una copia de lo que está en GitHub.
- **Nunca edites archivos directamente en el servidor.** Se perderían en la siguiente actualización (y `actualizar.sh` se niega a actualizar si encuentra archivos editados a mano).
- **Los autos, fotos y el admin NO están en git.** Los autos viven en la base de datos, las fotos en tu Google Drive y las contraseñas en el `.env` del servidor. Actualizar el código no los toca.

## Ramas

Una **rama** es una línea de trabajo. Lo normal es:

| Rama | Para qué |
|---|---|
| `main` | Lo que está publicado en el sitio |
| `cambio-x`, `claude/...` | Trabajo en curso; se revisa y luego se une ("merge") a `main` con un *pull request* |

> **Hoy** el servidor usa la rama `claude/pensive-heisenberg-v62n8s`, porque ahí está todo el trabajo y `main` todavía tiene la versión vieja. Cuando la unas a `main` (aprobando el pull request en GitHub), cambia el servidor **una sola vez** con:
> ```bash
> bash /var/www/diegorodriguezautos.com/deploy/actualizar.sh main
> ```
> Desde ahí, el servidor seguirá `main` siempre.

## Paso 1: hacer el cambio (elige una forma)

### A) Pedírselo a Claude
Claude hace el cambio en una rama, corre las pruebas y abre un *pull request*. Tú lo revisas en GitHub y presionas **Merge pull request**.

### B) Desde la página de GitHub (cambios pequeños de texto)
1. Abre el archivo en github.com → ícono del lápiz ✏️.
2. Haz el cambio → **Commit changes** → elige **Create a new branch** → **Propose changes** → **Create pull request**.
3. Revisa y presiona **Merge pull request**.

### C) Desde tu computadora
Con [GitHub Desktop](https://desktop.github.com/) (más fácil) o con la terminal:

```bash
git clone https://github.com/DieTad01/diegorodriguezautos.com.git   # solo la primera vez
cd diegorodriguezautos.com
git switch main && git pull                     # traer lo último
git switch -c cambio-telefono                   # rama nueva para tu cambio
# ... editas los archivos ...
npm install && npm test                         # las pruebas deben pasar (ver docs/06-seguridad.md)
git add -A
git commit -m "Cambiar teléfono en el pie de página"
git push -u origin cambio-telefono              # luego abre el pull request en GitHub
```

> Antes de cada `git add`, revisa con `git status` que **no** aparezca `.env`. El `.gitignore` lo bloquea, pero mira de todos modos.

## Paso 2: publicarlo en el sitio

En hPanel → **VPS → Terminal** (o por SSH):

```bash
bash /var/www/diegorodriguezautos.com/deploy/actualizar.sh
```

Lo que hace, en orden:

1. Busca la versión nueva en GitHub. Si ya la tienes, termina sin tocar nada.
2. **Respalda la base de datos** en `/var/backups/diegorodriguezautos/` (guarda los últimos 15).
3. Instala el código y las dependencias, y crea tablas nuevas si las hay.
4. **Comprueba que el sitio responde** (portada, inventario, sitemap). **Si no responde, regresa solo a la versión anterior**: el sitio no se queda caído.
5. Te muestra qué versión quedó en línea.

### Regresar a la versión anterior

Si publicaste algo que funciona pero no te gustó:

```bash
bash /var/www/diegorodriguezautos.com/deploy/actualizar.sh --volver
```

(Para que el cambio no regrese en la próxima actualización, deshazlo también en GitHub: en el pull request ya unido, botón **Revert**.)

### Cuándo correr el instalador en lugar del actualizador

Si cambian `deploy/nginx.conf` o `deploy/instalar.sh`, `actualizar.sh` te avisa al final. En ese caso corre también:

```bash
bash /var/www/diegorodriguezautos.com/deploy/instalar.sh
```

No borra datos ni cambia contraseñas.

## Respaldos de la base de datos

| Qué | Comando (en el VPS) |
|---|---|
| Ver respaldos | `ls -lh /var/backups/diegorodriguezautos/` |
| Hacer uno ahora | `mariadb-dump --single-transaction agencia_autos \| gzip > /var/backups/diegorodriguezautos/bd-manual-$(date +%F).sql.gz` |
| Restaurar uno | `zcat /var/backups/diegorodriguezautos/bd-AAAAMMDD-HHMMSS.sql.gz \| mariadb agencia_autos` |
| Bajarlo a tu computadora | En tu computadora: `scp root@IP_DEL_VPS:/var/backups/diegorodriguezautos/bd-AAAAMMDD-HHMMSS.sql.gz .` |

> Los respaldos se hacen al actualizar. Guarda uno fuera del servidor de vez en cuando (por ejemplo, una vez al mes): si el VPS se pierde, los respaldos de adentro también.
> En Ubuntu con MySQL usa `mysqldump` y `mysql` en vez de `mariadb-dump` y `mariadb`.

## Cambios en la base de datos

- **Tablas nuevas:** se agregan en `db/schema.sql` con `CREATE TABLE IF NOT EXISTS` y `actualizar.sh` las crea solo.
- **Cambiar una tabla que ya tiene datos** (agregar una columna, por ejemplo): `schema.sql` no lo hace solo. Haz un respaldo y aplica el cambio a mano con `sudo mariadb agencia_autos` (`ALTER TABLE ...`). Pruébalo antes en tu base de práctica ([5. Practicar MySQL por SSH](05-practica-mysql-ssh.md)).

## Comandos útiles en el servidor

| Para | Comando |
|---|---|
| ¿Está corriendo el sitio? | `sudo -u deploy pm2 status` |
| Ver errores del sitio | `sudo -u deploy pm2 logs diegorodriguezautos` |
| Reiniciar el sitio | `sudo -u deploy pm2 reload diegorodriguezautos` |
| ¿Qué versión está en línea? | `sudo -u deploy git -C /var/www/diegorodriguezautos.com log -3 --oneline` |
| ¿Qué rama sigue el servidor? | `sudo -u deploy git -C /var/www/diegorodriguezautos.com branch --show-current` |

## Si algo sale mal

| Mensaje | Qué hacer |
|---|---|
| "Hay archivos modificados a mano en el servidor" | Alguien editó en el VPS. Descártalos con el comando que muestra el mensaje y haz el cambio por GitHub |
| "No se pudo descargar la rama" | La rama no existe en GitHub, o el repositorio es privado y el VPS no tiene llave (ver [9. Accesos](09-accesos.md#repositorio-privado)) |
| "La versión nueva NO responde. Regresando..." | El sitio sigue con la versión anterior. Mira el error que muestra arriba, corrígelo en GitHub y vuelve a actualizar |
| "No se pudo respaldar la base de datos" | La base de datos está apagada: `systemctl start mariadb` (o `mysql`). No se cambió nada |
