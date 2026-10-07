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

## Mapa del sitio

| Dirección | Qué es | ¿Quién entra? |
|---|---|---|
| `https://diegorodriguezautos.com/` | Inventario de autos | Todo el público |
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
