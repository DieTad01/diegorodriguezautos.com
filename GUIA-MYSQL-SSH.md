# Guía: practicar MySQL por SSH en el VPS

Esta guía es para practicar SQL directamente en tu VPS de Hostinger, **sin riesgo de romper el sitio**. La idea clave:

| Base de datos | Usuario | Para qué |
|---|---|---|
| `agencia_autos` | `agencia_app` | La del sitio real. Solo lee y escribe filas. **No se practica aquí.** |
| `agencia_practica` | `practica` | Tu laboratorio. Puedes crear, borrar y romper lo que quieras. |

Las dos tienen las mismas tablas (`db/schema.sql`), así que lo que aprendas aplica directo al sitio.

---

## 1. Conectarte por SSH

### 1.1 Primera conexión (con contraseña)

La IP y la contraseña de root están en **hPanel → VPS → Vista general**. Desde tu computadora:

```bash
# Windows: usa PowerShell o Terminal. Mac/Linux: la Terminal.
ssh root@IP_DEL_VPS
```

La primera vez pregunta *"Are you sure you want to continue connecting?"*: escribe `yes`.

Si ya seguiste [DEPLOY.md](DEPLOY.md), entra mejor con el usuario `deploy` (no con root):

```bash
ssh deploy@IP_DEL_VPS
```

### 1.2 Usar una llave SSH (más seguro y sin escribir contraseña)

En **tu computadora** (no en el VPS):

```bash
ssh-keygen -t ed25519 -C "tu-correo"
# Enter para aceptar la ruta. Pon una frase de paso (passphrase) para proteger la llave.
```

Copia la llave **pública** al VPS:

```bash
# Mac / Linux
ssh-copy-id deploy@IP_DEL_VPS

# Windows (PowerShell)
type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh deploy@IP_DEL_VPS "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
```

> También puedes pegarla en **hPanel → VPS → Configuración → Claves SSH**.
> La llave **privada** (`id_ed25519`, sin `.pub`) nunca se comparte ni se sube a GitHub.

### 1.3 Atajo para no escribir la IP

En tu computadora crea o edita `~/.ssh/config` (Windows: `C:\Users\TU_USUARIO\.ssh\config`):

```
Host agencia
    HostName IP_DEL_VPS
    User deploy
    IdentityFile ~/.ssh/id_ed25519
```

Desde ahora basta con `ssh agencia`.

### 1.4 Apagar el acceso con contraseña (cuando la llave ya funcione)

Abre **otra** terminal y confirma que `ssh agencia` entra sin pedir la contraseña del servidor. Entonces, en el VPS:

```bash
sudo nano /etc/ssh/sshd_config.d/99-seguridad.conf
```

```
PermitRootLogin no
PasswordAuthentication no
```

```bash
sudo sshd -t && sudo systemctl reload ssh
```

> No cierres tu sesión actual hasta comprobar en otra terminal que sigues pudiendo entrar.

---

## 2. Crear tu base de práctica (una sola vez)

Ya conectado al VPS:

```bash
sudo mysql
```

```sql
CREATE DATABASE agencia_practica CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'practica'@'localhost' IDENTIFIED BY 'OTRA_CONTRASEÑA_DISTINTA';
-- Todo el poder, pero SOLO sobre la base de práctica
GRANT ALL PRIVILEGES ON agencia_practica.* TO 'practica'@'localhost';
-- Permite crear triggers sin ser root (si no, sale ERROR 1419 en el ejercicio 6.4)
SET PERSIST log_bin_trust_function_creators = 1;
EXIT;
```

Carga las tablas y los datos de ejemplo:

```bash
cd /var/www/diegorodriguezautos.com
mysql -u practica -p agencia_practica < db/schema.sql
mysql -u practica -p agencia_practica < db/datos-ejemplo.sql
```

Para no escribir la contraseña cada vez, guárdala en un archivo que solo tú puedes leer:

```bash
cat > ~/.my.cnf <<'EOF'
[client]
user=practica
password=OTRA_CONTRASEÑA_DISTINTA
database=agencia_practica
default-character-set=utf8mb4
EOF
chmod 600 ~/.my.cnf
```

Ahora `mysql` a secas entra directo a tu práctica.

---

## 3. Moverte dentro de MySQL

```bash
mysql            # con ~/.my.cnf
mysql -u practica -p agencia_practica   # sin ~/.my.cnf
```

| Comando | Qué hace |
|---|---|
| `SHOW TABLES;` | Lista las tablas |
| `DESCRIBE vehiculos;` | Columnas y tipos de una tabla |
| `SHOW CREATE TABLE ventas\G` | El `CREATE TABLE` completo (llaves, restricciones) |
| `SELECT ... \G` | Muestra cada fila en vertical (útil con muchas columnas) |
| `\c` | Cancela lo que llevas escrito |
| `source archivo.sql` | Ejecuta un archivo |
| `exit` | Salir |

> Todo comando SQL termina en `;`. Si MySQL muestra `->` es que le falta el `;`.
> Si los acentos salen como `�`, entra con `mysql --default-character-set=utf8mb4` (o agrégalo a `~/.my.cnf` como arriba).

**Diagrama de las tablas:**

```
vehiculos 1───* vehiculo_imagenes
    │
    1
    │
    0..1
  ventas *───1 clientes
    │
    1
    │
    *
  pagos
```

- Un vehículo puede tener muchas imágenes y **a lo mucho una** venta (`UNIQUE vehiculo_id`).
- Un cliente puede tener muchas ventas. Una venta puede tener muchos pagos.

---

## 4. Ejercicios

Intenta cada uno antes de abrir la respuesta. Los resultados de ejemplo corresponden a `db/datos-ejemplo.sql`.

### Nivel 1: SELECT básico

**1.1** Todos los vehículos disponibles, del más barato al más caro.

<details><summary>Respuesta</summary>

```sql
SELECT id, marca, modelo, anio, precio
FROM vehiculos
WHERE estado = 'disponible'
ORDER BY precio ASC;
```
4 filas, empieza con el Kia Rio (219,000).
</details>

**1.2** Los 3 vehículos con menos kilometraje.

<details><summary>Respuesta</summary>

```sql
SELECT marca, modelo, kilometraje
FROM vehiculos
ORDER BY kilometraje
LIMIT 3;
```
</details>

**1.3** Autos entre 2019 y 2020 que cuesten menos de 300,000.

<details><summary>Respuesta</summary>

```sql
SELECT marca, modelo, anio, precio
FROM vehiculos
WHERE anio BETWEEN 2019 AND 2020
  AND precio < 300000;
```
</details>

**1.4** Vehículos cuya marca empiece con "M" o "N", y los que no tienen descripción.

<details><summary>Respuesta</summary>

```sql
SELECT marca, modelo FROM vehiculos WHERE marca LIKE 'M%' OR marca LIKE 'N%';

SELECT marca, modelo FROM vehiculos WHERE descripcion IS NULL;
```
> Ojo: `descripcion = NULL` **nunca** funciona; siempre `IS NULL`.
</details>

### Nivel 2: Funciones de agregado

**2.1** ¿Cuántos vehículos hay en cada estado?

<details><summary>Respuesta</summary>

```sql
SELECT estado, COUNT(*) AS total
FROM vehiculos
GROUP BY estado;
```
disponible 4, apartado 1, vendido 3.
</details>

**2.2** Precio promedio, mínimo y máximo del inventario que no se ha vendido.

<details><summary>Respuesta</summary>

```sql
SELECT ROUND(AVG(precio), 2) AS promedio, MIN(precio) AS minimo, MAX(precio) AS maximo
FROM vehiculos
WHERE estado <> 'vendido';
```
</details>

**2.3** Colores que se repiten en más de un vehículo. (Pista: `HAVING`)

<details><summary>Respuesta</summary>

```sql
SELECT color, COUNT(*) AS total
FROM vehiculos
GROUP BY color
HAVING COUNT(*) > 1;
```
Blanco y Gris (2 cada uno). `WHERE` filtra **filas** antes de agrupar; `HAVING` filtra **grupos** después.
</details>

### Nivel 3: JOIN

**3.1** Cada venta con el nombre del cliente y el auto vendido.

<details><summary>Respuesta</summary>

```sql
SELECT v.id AS venta, v.fecha, c.nombre AS cliente,
       CONCAT(ve.marca, ' ', ve.modelo, ' ', ve.anio) AS vehiculo,
       v.precio_final
FROM ventas v
JOIN clientes  c  ON c.id  = v.cliente_id
JOIN vehiculos ve ON ve.id = v.vehiculo_id
ORDER BY v.fecha;
```
</details>

**3.2** Cuánto se ha pagado de cada venta y cuánto falta (saldo).

<details><summary>Respuesta</summary>

```sql
SELECT v.id AS venta, v.precio_final,
       COALESCE(SUM(p.monto), 0)                  AS pagado,
       v.precio_final - COALESCE(SUM(p.monto), 0) AS saldo
FROM ventas v
LEFT JOIN pagos p ON p.venta_id = v.id
GROUP BY v.id, v.precio_final;
```
Las ventas 1 y 3 deben 100,000 cada una; la 2 está liquidada. Sin `LEFT JOIN`, una venta sin ningún pago desaparecería del resultado.
</details>

**3.3** Clientes que todavía no han comprado nada.

<details><summary>Respuesta</summary>

```sql
SELECT c.nombre
FROM clientes c
LEFT JOIN ventas v ON v.cliente_id = c.id
WHERE v.id IS NULL;
```
María Fernández.
</details>

**3.4** Total vendido por mes.

<details><summary>Respuesta</summary>

```sql
SELECT DATE_FORMAT(fecha, '%Y-%m') AS mes, COUNT(*) AS ventas, SUM(precio_final) AS total
FROM ventas
GROUP BY mes
ORDER BY mes;
```
</details>

### Nivel 4: Subconsultas

**4.1** Vehículos más caros que el promedio.

<details><summary>Respuesta</summary>

```sql
SELECT marca, modelo, precio
FROM vehiculos
WHERE precio > (SELECT AVG(precio) FROM vehiculos);
```
</details>

**4.2** El cliente que más ha gastado.

<details><summary>Respuesta</summary>

```sql
SELECT c.nombre, SUM(v.precio_final) AS total
FROM clientes c
JOIN ventas v ON v.cliente_id = c.id
GROUP BY c.id, c.nombre
ORDER BY total DESC
LIMIT 1;
```
Ana López (755,000).
</details>

### Nivel 5: Modificar datos con transacciones

Una **transacción** agrupa cambios: o se guardan todos (`COMMIT`) o ninguno (`ROLLBACK`). Practica aquí sin miedo:

**5.1** Sube 5% el precio de todo lo disponible, revisa el resultado y **deshazlo**.

<details><summary>Respuesta</summary>

```sql
START TRANSACTION;
UPDATE vehiculos SET precio = ROUND(precio * 1.05, 2) WHERE estado = 'disponible';
SELECT marca, modelo, precio FROM vehiculos WHERE estado = 'disponible';
ROLLBACK;
SELECT marca, modelo, precio FROM vehiculos WHERE estado = 'disponible';  -- precios originales
```
> Regla de oro: antes de un `UPDATE` o `DELETE`, ejecuta un `SELECT` con el mismo `WHERE` para ver qué filas vas a tocar. Un `UPDATE` sin `WHERE` cambia **toda** la tabla.
</details>

**5.2** Registra una venta completa: María compra el Mazda 3 (id 6) con un enganche en efectivo. Son tres cambios que deben ir juntos.

<details><summary>Respuesta</summary>

```sql
START TRANSACTION;
INSERT INTO ventas (vehiculo_id, cliente_id, fecha, precio_final)
VALUES (6, 3, CURDATE(), 330000);
SET @venta = LAST_INSERT_ID();
INSERT INTO pagos (venta_id, fecha, monto, metodo)
VALUES (@venta, CURDATE(), 80000, 'efectivo');
UPDATE vehiculos SET estado = 'vendido' WHERE id = 6;
COMMIT;
```
</details>

**5.3** Provoca a propósito estos errores y lee qué dice MySQL. Así ves cómo la base protege la integridad de los datos:

<details><summary>Respuesta</summary>

```sql
-- Vender otra vez el mismo auto (UNIQUE) -> ERROR 1062 Duplicate entry
INSERT INTO ventas (vehiculo_id, cliente_id, fecha, precio_final) VALUES (6, 1, CURDATE(), 1);

-- Un cliente que no existe (FOREIGN KEY) -> ERROR 1452
INSERT INTO ventas (vehiculo_id, cliente_id, fecha, precio_final) VALUES (1, 999, CURDATE(), 1);

-- Precio negativo (CHECK) -> ERROR 3819
UPDATE vehiculos SET precio = -1 WHERE id = 1;

-- Borrar un auto que tiene venta (FOREIGN KEY) -> ERROR 1451
DELETE FROM vehiculos WHERE id = 3;

-- Estado que no existe (ENUM) -> ERROR 1265
UPDATE vehiculos SET estado = 'regalado' WHERE id = 1;
```
</details>

### Nivel 6: Vistas, índices, procedimientos y triggers

**6.1** Crea una **vista** con el saldo de cada venta y úsala como si fuera tabla.

<details><summary>Respuesta</summary>

```sql
CREATE OR REPLACE VIEW saldos AS
SELECT v.id AS venta, c.nombre AS cliente, v.precio_final,
       COALESCE(SUM(p.monto), 0) AS pagado,
       v.precio_final - COALESCE(SUM(p.monto), 0) AS saldo
FROM ventas v
JOIN clientes c ON c.id = v.cliente_id
LEFT JOIN pagos p ON p.venta_id = v.id
GROUP BY v.id, c.nombre, v.precio_final;

SELECT * FROM saldos WHERE saldo > 0;
```
</details>

**6.2** Mira con `EXPLAIN` si una consulta usa índice.

<details><summary>Respuesta</summary>

```sql
EXPLAIN SELECT * FROM vehiculos WHERE estado = 'disponible';  -- key: idx_vehiculos_estado
EXPLAIN SELECT * FROM vehiculos WHERE color = 'Blanco';       -- key: NULL (lee toda la tabla)

CREATE INDEX idx_vehiculos_color ON vehiculos (color);
EXPLAIN SELECT * FROM vehiculos WHERE color = 'Blanco';       -- ahora sí usa índice
DROP INDEX idx_vehiculos_color ON vehiculos;
```
Con 8 filas da igual, pero con miles la diferencia es enorme.
</details>

**6.3** Un **procedimiento almacenado** que devuelva los autos de una marca.

<details><summary>Respuesta</summary>

```sql
DELIMITER //
CREATE PROCEDURE autos_por_marca(IN p_marca VARCHAR(50))
BEGIN
  SELECT modelo, anio, precio, estado FROM vehiculos WHERE marca = p_marca;
END //
DELIMITER ;

CALL autos_por_marca('Nissan');
```
`DELIMITER` cambia el fin de comando a `//` para que los `;` de adentro no lo corten.
</details>

**6.4** Un **trigger** que marque el vehículo como vendido automáticamente al registrar una venta.

<details><summary>Respuesta</summary>

```sql
DELIMITER //
CREATE TRIGGER venta_marca_vendido
AFTER INSERT ON ventas
FOR EACH ROW
BEGIN
  UPDATE vehiculos SET estado = 'vendido' WHERE id = NEW.vehiculo_id;
END //
DELIMITER ;

INSERT INTO ventas (vehiculo_id, cliente_id, fecha, precio_final) VALUES (7, 2, CURDATE(), 215000);
SELECT id, marca, estado FROM vehiculos WHERE id = 7;  -- vendido
```
Si sale `ERROR 1419 ... SUPER privilege`, te faltó el `SET PERSIST log_bin_trust_function_creators = 1;` de la sección 2 (ejecútalo con `sudo mysql`).
</details>

---

## 5. Por qué el sitio usa `?` en las consultas (inyección SQL)

Puedes ver la inyección SQL con tus propios ojos en la base de práctica. Imagina que alguien escribe esto en el buscador:

```sql
SET @busqueda = "x' OR '1'='1";

-- MAL: armar el SQL pegando el texto del usuario
SET @sql = CONCAT("SELECT marca, modelo, precio FROM vehiculos WHERE marca = '", @busqueda, "'");
SELECT @sql;          -- mira la consulta que se formó: ... WHERE marca = 'x' OR '1'='1'
PREPARE q FROM @sql;
EXECUTE q;            -- ¡devuelve TODOS los vehículos!

-- BIEN: el valor va aparte como parámetro (?)
PREPARE q FROM 'SELECT marca, modelo, precio FROM vehiculos WHERE marca = ?';
EXECUTE q USING @busqueda;   -- 0 filas: busca una marca llamada literalmente "x' OR '1'='1"
DEALLOCATE PREPARE q;
```

Eso mismo hace el código del sitio (`src/vehiculos.js`): `pool.execute('... WHERE id = ?', [id])`. El texto del usuario **nunca** se vuelve parte del SQL.

---

## 6. Usar un programa gráfico (MySQL Workbench, DBeaver, TablePlus)

El puerto de MySQL (3306) está **cerrado** al internet a propósito. Para conectarte desde tu computadora usa un **túnel SSH**:

- En MySQL Workbench: *Connection Method* → **Standard TCP/IP over SSH**
  - SSH Hostname: `IP_DEL_VPS:22`, SSH Username: `deploy`, SSH Key File: tu `id_ed25519`
  - MySQL Hostname: `127.0.0.1`, Port: `3306`, Username: `practica`
- En DBeaver: pestaña **SSH** de la conexión, con los mismos datos.

O abre el túnel a mano y conéctate a `127.0.0.1:3307` desde cualquier programa:

```bash
ssh -N -L 3307:127.0.0.1:3306 agencia
```

> **Nunca** abras el 3306 en el firewall ni pongas `bind-address = 0.0.0.0`.

---

## 7. Respaldos

```bash
mkdir -p ~/respaldos

# Respaldar la práctica
mysqldump agencia_practica > ~/respaldos/practica-$(date +%F).sql

# Respaldar el sitio real (como root de MySQL)
sudo mysqldump --single-transaction agencia_autos > ~/respaldos/sitio-$(date +%F).sql

# Bajarlo a tu computadora (ejecutar en TU computadora)
scp agencia:~/respaldos/sitio-AAAA-MM-DD.sql .
```

> Los respaldos tienen datos reales: no los subas a GitHub (`.gitignore` ya bloquea `*.sql`).

---

## 8. Reiniciar la práctica

¿Rompiste algo? Empieza de cero:

```bash
mysql -e "DROP DATABASE agencia_practica; CREATE DATABASE agencia_practica CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql < /var/www/diegorodriguezautos.com/db/schema.sql
mysql < /var/www/diegorodriguezautos.com/db/datos-ejemplo.sql
```

¿Quieres practicar con una **copia** de los datos reales del sitio?

```bash
mysql -e "DROP DATABASE agencia_practica; CREATE DATABASE agencia_practica CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
sudo mysqldump --single-transaction agencia_autos | mysql
```

El sitio no se entera: trabajas sobre la copia.

---

## 9. Errores comunes

| Error | Significa |
|---|---|
| `ERROR 1045 Access denied` | Usuario o contraseña mal (o el usuario no existe) |
| `ERROR 1044 Access denied ... to database` | Ese usuario no tiene permiso en esa base: ¿estás usando `practica` en `agencia_autos`? |
| `ERROR 1046 No database selected` | Falta `USE agencia_practica;` |
| `ERROR 1062 Duplicate entry` | Rompe un `UNIQUE` (ej. vender el mismo auto dos veces) |
| `ERROR 1451 / 1452 foreign key constraint fails` | Borras algo que otra tabla usa / apuntas a algo que no existe |
| `ERROR 3819 Check constraint ... is violated` | Rompe una regla `CHECK` (ej. precio negativo) |
| `ERROR 1265 Data truncated` | Valor que no cabe en la columna o que no está en el `ENUM` |
| `ERROR 2002 Can't connect ... socket` | MySQL está apagado: `sudo systemctl start mysql` |
