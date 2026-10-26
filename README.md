# diegorodriguezautos.com

Website for **Diego Rodríguez**, digital sales advisor for **BYD and Chevrolet** in León, Guanajuato, Mexico (Blvd. Adolfo López Mateos 3431 Ote.): a public inventory page with location, map and click-to-call, plus an admin panel with per-person accounts to manage vehicles, and a read-only customer area (`/mi-cuenta`) where buyers see their purchases, payments and balance. The visual identity (black and gold) comes from the BYD | Chevrolet branding. Vehicle photos are linked from Google Drive, so no image files are stored on the server.

![Home page](docs/img/publico-portada.png)

## Tech stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | **HTML5, CSS3, vanilla JavaScript** (no framework, no build step) | Public inventory page and admin panel. DOM is built with `<template>` + `textContent` only. Dark theme driven by CSS custom properties |
| | **Google Maps** embed + directions link | Dealership location (the only third-party frame allowed by the CSP) |
| Backend | **Node.js** 20+ (developed on 22 LTS) | Runtime |
| | **Express** 5 | HTTP server, routing and static files (`public/` only) |
| | **mysql2** 3 (promise API) | MySQL driver with connection pooling and prepared statements (`execute` + `?` placeholders) |
| | **helmet** 8 | Security headers, including a strict Content-Security-Policy |
| | **dotenv** | Loads secrets from a non-committed `.env` file |
| | Node `crypto` (built-in) | `scrypt` password hashing and HMAC-SHA256 signed session cookies |
| Database | **MySQL** 8 or **MariaDB** 10.11+ (InnoDB, `utf8mb4`) | Vehicles, image links, customers, sales, payments and admin accounts, with foreign keys and `CHECK` constraints |
| Images | **Google Drive** share links | Stored as URLs only and normalized to Drive's thumbnail endpoint |
| Infrastructure | **Hostinger VPS** running Debian 13/12 or Ubuntu 24.04/22.04 | Hosting; `deploy/instalar.sh` installs everything in one command |
| | **Nginx** | Reverse proxy, login rate limiting, blocks dotfiles |
| | **PM2** | Keeps the Node process alive and restarts it on boot |
| | **Let's Encrypt** (Certbot) | Free HTTPS certificate with auto-renewal |
| | **UFW** | Firewall: only SSH, HTTP and HTTPS are open |
| SEO | Server-rendered vehicle pages, schema.org JSON-LD (`AutoDealer`, `Car`, `BreadcrumbList`), dynamic `sitemap.xml`, `robots.txt`, canonical URLs, Open Graph | Discoverability on Google and link previews |
| Testing | **node:test** (built-in test runner) | 43 security, account and SEO tests against a real MySQL test database |

## Architecture

```
Browser ──HTTPS──> Nginx (80/443) ──> Node.js + Express (127.0.0.1:3000) ──> MySQL (127.0.0.1:3306)
   │
   └── images are loaded directly from Google Drive (never through the VPS)
```

## Project structure

```
public/                  The only folder served to the internet
  index.html, admin.html
  img/                   Logo, favicon and social-share image
  css/styles.css
  js/comun.js, app.js, admin.js
src/                     Server code (never served)
  app.js                 Express app, security headers, error handling
  auth.js                Per-user admin login, signed session cookie, CSRF and brute-force protection
  db.js                  MySQL connection pool
  validacion.js          Whitelist input validation and image URL normalization
  vehiculos.js           All SQL queries (parameterized)
  sitio.js               Business details (address, phone) and URL slugs
  paginas/               Server-rendered pages: vehicle detail, privacy notice, 404 (all output escaped)
  routes/                Public API, admin API and server-rendered pages
db/schema.sql            Tables and constraints
db/datos-ejemplo.sql     Sample data for SQL practice
scripts/usuarios-admin.js  Manage admin accounts: list, add, reset password, sign out everywhere, remove
test/seguridad.test.js   Security test suite
deploy/nginx.conf        Nginx site configuration
docs/                    User manual and guides (Spanish)
```

## Security

- **SQL injection:** every query uses prepared statements; multiple statements are disabled; IDs, enums and numeric fields are strictly validated; `LIKE` wildcards are escaped. The production database user only has `SELECT, INSERT, UPDATE, DELETE`.
- **HTML injection / XSS:** no `innerHTML` anywhere; all data is rendered as text. Server-rendered pages escape every value (`esc()`), and JSON-LD escapes `<`, `>` and `&` so data can never close its `<script>` block. The CSP allows only same-origin scripts and styles, with no inline code.
- **Admin access control:** one account per person (developer, client…) stored in the `administradores` table with salted `scrypt` hashes; users can change their own password (current password required); an HMAC-signed cookie binding username and issue time that is `HttpOnly`, `Secure` and `SameSite=Strict` with an 8-hour expiry; changing a password or deleting an account revokes only that account's sessions immediately; constant-time responses for unknown users; Origin checks and JSON-only request bodies against CSRF; brute-force limits in both Node and Nginx.
- **Image links:** only `https://` URLs are accepted; `javascript:`, `data:` and `http:` are rejected.
- **Secrets:** stored only in `.env` on the server; `.gitignore` blocks env files, keys and database dumps.

Details and test coverage: [docs/06-seguridad.md](docs/06-seguridad.md).

## Getting started (local)

Requirements: Node.js 20+ and MySQL 8.

```bash
npm install
cp .env.example .env            # set NODE_ENV=development and your MySQL credentials
mysql -u root -p -e "CREATE DATABASE agencia_autos CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
mysql -u root -p agencia_autos < db/schema.sql
# set SESSION_SECRET in .env (the command to generate it is in the file)
npm run crear-admin             # create your admin account in the database
npm start                       # http://127.0.0.1:3000  and  http://127.0.0.1:3000/admin
```

## Scripts

| Command | Description |
|---|---|
| `npm start` | Start the server (`server.js`) |
| `npm run crear-admin` | Interactively create an admin account (hidden password prompt) |
| `npm run usuarios -- <listar\|agregar\|contrasena\|cerrar-sesiones\|quitar> [user]` | Manage admin accounts |
| `npm test` | Run the security tests (requires a `.env.test` pointing to a database whose name contains `test`) |

Server scripts (run as root on the VPS):

| Script | Description |
|---|---|
| `deploy/instalar.sh` | One-command install on Debian/Ubuntu: Nginx, MariaDB/MySQL, Node, PM2, firewall, HTTPS. Safe to re-run |
| `deploy/actualizar.sh` | Deploy the latest commit: database backup, install, health check, automatic rollback; `--volver` returns to the previous version |
| `deploy/diagnostico.sh` | Read-only health check: install, services, local responses, DNS vs. server IP, ports, firewall, TLS certificate and recent errors, with the fix for each failure |
| `deploy/usuarios-admin.sh` | Manage admin panel accounts (`listar`, `agregar`, `contrasena`, `cerrar-sesiones`, `quitar`) |
| `deploy/cambiar-admin.sh` | Shortcut for `usuarios-admin.sh contrasena`: reset one account's password and sign it out |
| `deploy/usuario-bd-visual.sh` | Create a MariaDB user for GUI clients (DBeaver, HeidiSQL) over an SSH tunnel: read-only or row-edit on the site DB, never the admin accounts table; full access to the practice DB |
| `deploy/clientes-acceso.sh` | Customer access to `/mi-cuenta`: `listar`, `agregar`, `acceso <email>` (temporary password), `quitar-acceso <email>` |
| `deploy/reiniciar-practica.sh` | Reset the practice database (`agencia_practica`) to the sample data, or to a copy of the live inventory without admin accounts (`--copia-del-sitio`); never touches the site database |
| `deploy/llave-github.sh` | Create a read-only deploy key (verifying GitHub's host key) so the server can pull from a private repository |

## Documentation (Spanish)

The full user manual lives in [`docs/`](docs/README.md):

1. [Public page](docs/01-pagina-publica.md): browsing, searching, photo gallery
2. [Admin panel](docs/02-panel-admin.md): login, add, edit, status and delete vehicles
3. [Photos from Google Drive](docs/03-fotos-google-drive.md): how to share and paste image links
4. [VPS installation](docs/04-instalacion-vps.md): DNS, MySQL, PM2, Nginx, HTTPS on Hostinger
5. [MySQL practice over SSH](docs/05-practica-mysql-ssh.md): separate practice database with solved exercises
6. [Security](docs/06-seguridad.md): protections and how they were tested
7. [Getting found on Google](docs/07-google.md): Search Console, sitemap, Business Profile and what is still missing
8. [Updating with git](docs/08-actualizar-con-git.md): branches, pull requests, deploying, rolling back, backups
9. [Access](docs/09-accesos.md): every account, password and key, how to rotate them, and making the repository private
10. [Inventory step by step](docs/10-inventario-paso-a-paso.md): day-to-day guide to add cars, upload photos via Google Drive (also from a phone) and update price or status
11. [Developer access](docs/11-acceso-desarrollador.md): your SSH key, GitHub, your panel account and how to give the client panel-only access
12. [Client guide](docs/12-guia-cliente.md) ([PDF](docs/guia-cliente.pdf)): for the business owner: sign in, change password, add cars and photos; no server details
13. [MariaDB with a GUI](docs/13-mariadb-visual.md): DBeaver/HeidiSQL over an SSH tunnel, port 3306 stays closed
14. [SQL exam prep](docs/14-examen-sql.md): how to reach the practice DB from Hostinger, cheat sheet, 100-point mock exam with verified answers
15. [Customer account](docs/15-mi-cuenta-clientes.md): buyers sign in at `/mi-cuenta` to see only their own purchases, payments and balance
