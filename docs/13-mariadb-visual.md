# 13. Ver y manejar MariaDB de forma visual

[← Volver al índice](README.md)

**Sí se puede, y sin instalar nada en el servidor.** Instalas un programa visual en **tu computadora** y se conecta a MariaDB por un **túnel SSH**: el mismo acceso cifrado que ya usas para la terminal. El puerto de la base (3306) **sigue cerrado** a internet.

```
Tu computadora                                   VPS
DBeaver ──(túnel SSH cifrado, puerto 22)──> sshd ──> MariaDB (127.0.0.1:3306)
```

## Qué opción usar

| Opción | ¿Recomendada? | Por qué |
|---|---|---|
| **DBeaver** (Windows, Mac, Linux), gratis | ✅ **Sí** | Visual y completo, trae túnel SSH y acepta tu llave `id_ed25519` tal cual |
| **HeidiSQL** (solo Windows), gratis | ✅ Sí | Más ligero; hecho por y para MariaDB |
| phpMyAdmin o Adminer instalados en el VPS | ❌ No | Pone una página de login a tu base en internet que los robots atacan todo el día, y hay que instalar y mantener PHP |
| Abrir el puerto 3306 a internet | ❌ Nunca | Cualquiera podría intentar adivinar contraseñas de la base |
| Plantilla de hPanel con panel (CloudPanel, CyberPanel…) | ❌ No | Cambiar de plantilla **reinstala el VPS y borra todo** (sitio, base, certificados) |

## 1. Requisito: tu llave SSH

Necesitas poder entrar al VPS con tu llave. Si `ssh root@diegorodriguezautos.com` ya entra sin pedir la contraseña del servidor, ya está. Si no, sigue los pasos 1 a 3 de [11. Tus accesos](11-acceso-desarrollador.md).

## 2. Crea tu usuario de base de datos (una vez)

En el VPS (hPanel → VPS → Terminal, o por SSH):

```bash
bash /var/www/diegorodriguezautos.com/deploy/usuario-bd-visual.sh
```

Te pregunta:

1. **Nombre del usuario.** Enter = `diego`.
2. **Qué podrá hacer en la base del sitio:**
   - **1) Solo ver** (recomendado). Los autos se editan en el panel `/admin`, que valida todo.
   - **2) Ver y editar filas.** Cuidado: un cambio aquí se ve de inmediato en la página y **no** pasa por las validaciones del panel.
3. **Contraseña,** dos veces. Mínimo 12 caracteres y no se ve al escribir. Es **distinta** a la del panel y a la de root.

| Lo que el usuario puede hacer | Nivel 1 | Nivel 2 |
|---|---|---|
| Ver autos, fotos, clientes, ventas y pagos del sitio | ✅ | ✅ |
| Cambiar o borrar filas del sitio | ❌ | ✅ |
| Ver o cambiar las **cuentas del panel** (`administradores`) | ❌ | ❌ |
| Borrar o cambiar tablas del sitio | ❌ | ❌ |
| Todo en `agencia_practica` (crear tablas, borrar, experimentar) | ✅ | ✅ |
| Otras bases (por ejemplo, la interna `mysql`) | ❌ | ❌ |

- Si `agencia_practica` no existe, el script la crea con las tablas y los datos de ejemplo de la [guía 5](05-practica-mysql-ssh.md).
- Vuelve a correr el script para **cambiar la contraseña o el nivel**.
- Para **borrar** el usuario: `bash /var/www/diegorodriguezautos.com/deploy/usuario-bd-visual.sh --quitar diego`

## 3. DBeaver paso a paso

1. Descarga **DBeaver Community** de [dbeaver.io/download](https://dbeaver.io/download/) e instálalo.
2. **Base de datos → Nueva conexión** (el enchufe con +) → elige **MariaDB** → **Siguiente**.
3. Pestaña **Principal** (*Main*):

   | Campo | Valor |
   |---|---|
   | Host | `127.0.0.1` |
   | Puerto | `3306` |
   | Base de datos | `agencia_autos` (o `agencia_practica` para practicar) |
   | Autenticación | *Database Native* |
   | Usuario | `diego` (el que creaste) |
   | Contraseña | La que pusiste en el script |

   > El host es `127.0.0.1` porque, del otro lado del túnel, la base está en el mismo servidor.

4. Pestaña **SSH** → marca **Usar túnel SSH** (*Use SSH Tunnel*):

   | Campo | Valor |
   |---|---|
   | Host/IP | `diegorodriguezautos.com` |
   | Puerto | `22` |
   | Usuario | `root` |
   | Método de autenticación | **Public Key** |
   | Llave privada | `C:\Users\TU_USUARIO\.ssh\id_ed25519` (Mac/Linux: `~/.ssh/id_ed25519`) |
   | Passphrase | La frase de tu llave |

5. **Probar conexión** (*Test Connection*). La primera vez DBeaver descarga el driver de MariaDB: acepta. Debe decir **Conectado**.
6. **Finalizar.** A la izquierda verás `agencia_autos` → **Tablas** → doble clic en `vehiculos` → pestaña **Datos**.

Para escribir consultas: clic derecho en la conexión → **Editor SQL** → **Nuevo script**, y ejecuta con `Ctrl + Enter`.

> DBeaver puede guardar la contraseña cifrada en tu computadora. Hazlo solo en **tu** computadora, nunca en una prestada.

## 4. HeidiSQL (alternativa en Windows)

1. Descárgalo de [heidisql.com](https://www.heidisql.com/download.php) e instálalo.
2. **Nueva** sesión → *Tipo de red*: **MariaDB or MySQL (SSH tunnel)**.
3. Pestaña **Configuración**: Host `127.0.0.1`, Usuario `diego`, Contraseña, Puerto `3306`.
4. Pestaña **Túnel SSH**:
   - *Ejecutable SSH*: `C:\Windows\System32\OpenSSH\ssh.exe`
   - *Host + puerto*: `diegorodriguezautos.com` · `22`
   - *Usuario*: `root`
   - *Archivo de llave privada*: tu `id_ed25519`
   - *Puerto local*: `3307`
5. **Abrir.**

## 5. Buenas costumbres

- **Practica en `agencia_practica`,** no en `agencia_autos`. Ahí puedes romper lo que quieras.
- **Antes de editar filas del sitio con el nivel 2,** toma un respaldo:
  ```bash
  mariadb-dump --single-transaction agencia_autos | gzip > /var/backups/diegorodriguezautos/manual-$(date +%F).sql.gz
  ```
  `actualizar.sh` también guarda uno en cada actualización.
- **En DBeaver, si vas a editar,** apaga **Auto-Commit** en la barra de herramientas (modo manual): los cambios no se guardan hasta que presionas **Commit**, y **Rollback** los deshace.
- **Los autos y fotos mejor desde el panel `/admin`.** El panel valida precios, años y links. DBeaver no.
- **Si ya no usas el programa:** `usuario-bd-visual.sh --quitar diego`.

## Si no conecta

| Mensaje | Qué pasa | Solución |
|---|---|---|
| *Auth fail* / *Permission denied (publickey)* en el SSH | El VPS no tiene tu llave pública, o la passphrase es otra | Comprueba `ssh root@diegorodriguezautos.com` en PowerShell; si falla, [guía 11, paso 2](11-acceso-desarrollador.md#2-ponla-en-el-vps) |
| *Access denied for user 'diego'@'localhost'* | Contraseña de la base equivocada, o el usuario no existe | Vuelve a correr `usuario-bd-visual.sh` (la cambia) |
| *Connection refused* en 127.0.0.1:3306 | MariaDB apagada | En el VPS: `systemctl start mariadb` |
| *SELECT command denied … administradores* | Es a propósito: las cuentas del panel no se ven desde aquí | Se manejan con `usuarios-admin.sh` |
| *UPDATE command denied* | Tu usuario es nivel 1 (solo ver) | Corre el script otra vez y elige nivel 2, si de verdad lo necesitas |
