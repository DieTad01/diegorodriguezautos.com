# Manual de uso — Diego Rodríguez Autos

Todo lo necesario para usar, administrar e instalar el sitio **diegorodriguezautos.com**.

| # | Guía | Para quién |
|---|---|---|
| 1 | [Página pública](01-pagina-publica.md) | Cualquier visitante: ver el inventario, buscar y ver fotos |
| 2 | [Panel de administración](02-panel-admin.md) | El administrador: entrar, agregar, editar, cambiar estado y borrar autos |
| 3 | [Fotos desde Google Drive](03-fotos-google-drive.md) | El administrador: cómo compartir y pegar los links de las fotos |
| 4 | [Instalación en el VPS](04-instalacion-vps.md) | Quien instala el sitio en Hostinger (DNS, MySQL, Nginx, HTTPS) |
| 5 | [Practicar MySQL por SSH](05-practica-mysql-ssh.md) | Práctica de SQL en una base separada, con ejercicios resueltos |
| 6 | [Seguridad](06-seguridad.md) | Qué protege al sitio (inyección SQL, HTML, sesión…) y cómo probarlo |
| 7 | [Aparecer en Google](07-google.md) | Search Console, sitemap, Perfil de Negocio y qué falta para que te encuentren |
| 8 | [Actualizar el sitio con git](08-actualizar-con-git.md) | Cómo hacer un cambio, publicarlo, regresar de versión y manejar respaldos |
| 9 | [Accesos](09-accesos.md) | Todas las cuentas, contraseñas y llaves; cómo cambiarlas; repositorio privado |

## Comandos del servidor (en hPanel → VPS → Terminal)

| Para | Comando |
|---|---|
| Publicar la última versión de GitHub | `bash /var/www/diegorodriguezautos.com/deploy/actualizar.sh` |
| Regresar a la versión anterior | `bash /var/www/diegorodriguezautos.com/deploy/actualizar.sh --volver` |
| Cambiar usuario o contraseña del panel `/admin` | `bash /var/www/diegorodriguezautos.com/deploy/cambiar-admin.sh` |
| Preparar el VPS para un repositorio privado | `bash /var/www/diegorodriguezautos.com/deploy/llave-github.sh` |
| Reinstalar o aplicar cambios de Nginx/HTTPS | `bash /var/www/diegorodriguezautos.com/deploy/instalar.sh` |
| **El sitio no abre: revisar todo y decir qué hacer** | `bash /var/www/diegorodriguezautos.com/deploy/diagnostico.sh` |
| Ver errores del sitio | `sudo -u deploy pm2 logs diegorodriguezautos` |

## Mapa del sitio

| Dirección | Qué es | ¿Quién entra? |
|---|---|---|
| `https://diegorodriguezautos.com/` | Inventario de autos | Todo el público |
| `https://diegorodriguezautos.com/autos/12-nissan-versa-2021` | Ficha de cada auto (una por vehículo, se crea sola) | Todo el público y Google |
| `https://diegorodriguezautos.com/aviso-de-privacidad` | Aviso de privacidad | Todo el público |
| `https://diegorodriguezautos.com/sitemap.xml` | Lista de páginas para Google (automática) | Buscadores |
| `https://diegorodriguezautos.com/admin` | Panel de administración | Solo con usuario y contraseña |

## Flujo general

```
 Administrador                          Servidor (VPS)                    Visitante
 ─────────────                          ──────────────                    ─────────
 1. Sube fotos a Google Drive
 2. Entra a /admin con su contraseña ──> revisa usuario y contraseña
 3. Llena el auto y pega los links  ──> valida los datos y los guarda
                                         en MySQL (solo el link)
                                                                     <── 4. Abre la página
                                         manda el inventario ──────────> 5. Ve los autos; las
                                                                            fotos se cargan
                                                                            directo de Drive
```

> Las fotos de autos en las capturas de este manual son **ilustraciones de ejemplo**. En el sitio real aparecerán tus fotos de Drive en esos mismos lugares.
