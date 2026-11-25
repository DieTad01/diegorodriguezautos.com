# 17. Manual de comandos del proyecto

[← Volver al índice](README.md) · Proyecto: [16. Proyecto final · Taller de BD](16-proyecto-taller-bd.md)

Explica **cada comando** que usa el proyecto (`db/proyecto/`): qué hace, su forma general y el ejemplo real de tus archivos.

**Cómo leer la sintaxis:**

- `MAYÚSCULAS` son palabras de SQL.
- `minúsculas` las escribes tú (nombres de tablas, columnas, valores).
- `[entre corchetes]` es opcional.
- `a | b` significa "una u otra".
- En MariaDB no importa si escribes en mayúsculas o minúsculas; se usan mayúsculas solo para leer mejor.
- Toda instrucción SQL termina en `;`.

---

## 0. La terminal y el cliente de MariaDB

### Entrar y salir

| Comando | Qué hace |
|---|---|
| `ssh root@diegorodriguezautos.com` | Entra a tu VPS desde tu computadora (o usa hPanel → VPS → Terminal) |
| `mariadb` | Abre la consola de MariaDB como root (en el VPS root entra sin contraseña) |
| `mariadb agencia_proyecto` | Abre la consola ya dentro de esa base |
| `mariadb -u p_ana -p agencia_proyecto` | Entra como otro usuario; `-p` hace que pida la contraseña sin mostrarla |
| `exit` o `\q` | Sale de la consola |

### Opciones del cliente que usa el proyecto

| Opción | Qué hace | Ejemplo |
|---|---|---|
| `-e "SQL"` | Ejecuta esa instrucción y regresa a la terminal | `mariadb -e "SHOW DATABASES"` |
| `< archivo.sql` | Ejecuta todo un archivo | `mariadb < u1-ddl.sql` |
| `-t` | Muestra el resultado como tabla con bordes, también al guardarlo en un archivo | `mariadb -t -e "SELECT 1"` |
| `-vvv` | Imprime cada instrucción antes de su resultado. Así se arman las evidencias | En `ejecutar.sh` |
| `--force` | Si una instrucción falla, sigue con la siguiente (sin esto se detiene) | Los scripts de errores |
| `--default-character-set=utf8mb4` | Que los acentos y la ñ se vean bien | En todos los scripts |
| `-N` | Quita los encabezados de columnas | En el simulador |
| `--unbuffered` | Imprime cada resultado en cuanto sale, sin esperar al final | En el simulador, para ver quién espera |
| `--defaults-extra-file=archivo` | Lee usuario y contraseña de un archivo, para no escribirla en el comando | Pruebas de permisos |

### Dentro de la consola

| Comando | Qué hace |
|---|---|
| `SHOW DATABASES;` | Lista las bases |
| `USE agencia_proyecto;` | Cambia a esa base |
| `SHOW TABLES;` | Lista las tablas de la base actual |
| `DESCRIBE vehiculos;` | Columnas, tipos, llaves y valores por defecto |
| `consulta\G` | Muestra cada fila en vertical (en lugar de `;`) |
| `\c` | Cancela lo que llevas escrito |
| `source /ruta/archivo.sql` | Ejecuta un archivo desde la consola |
| Flecha ↑ | Recupera la instrucción anterior |

Si ves `->` en lugar de `MariaDB [...]>`, te falta el `;`. Escríbelo y presiona Enter.

### Los scripts del proyecto

| Comando | Qué hace |
|---|---|
| `bash db/proyecto/ejecutar.sh` | Borra y crea limpia `agencia_proyecto`, corre las unidades 1 a 5 y guarda las evidencias |
| `bash db/proyecto/ejecutar.sh --con-conectividad` | Lo mismo más la unidad 6 (JDBC y ODBC) |
| `bash db/proyecto/u4-simulador.sh` | Solo el simulador de concurrencia |
| `bash db/proyecto/u6-conectividad/probar.sh` | Solo la conectividad |
| `ls /root/evidencias-proyecto/` | Lista las evidencias |
| `less /root/evidencias-proyecto/u2-dml.txt` | Lee una evidencia: flechas para moverte, `/texto` para buscar, `q` para salir |
| `scp -r root@diegorodriguezautos.com:/root/evidencias-proyecto .` | **En tu computadora:** baja las evidencias |

Los comandos de `bash` llevan la ruta completa (`/var/www/diegorodriguezautos.com/db/proyecto/...`) o se corren desde `/var/www/diegorodriguezautos.com`.

---

## 1. DDL: definir la estructura

### Bases de datos

| Comando | Qué hace |
|---|---|
| `CREATE DATABASE [IF NOT EXISTS] nombre CHARACTER SET cs COLLATE col;` | Crea una base. `IF NOT EXISTS` evita el error si ya existe |
| `ALTER DATABASE nombre CHARACTER SET cs COLLATE col;` | Cambia el juego de caracteres por defecto |
| `DROP DATABASE [IF EXISTS] nombre;` | **Borra la base con todas sus tablas y datos.** No se puede deshacer |
| `SHOW DATABASES [LIKE 'patrón'];` | Lista las bases |

```sql
CREATE DATABASE IF NOT EXISTS prueba_ddl CHARACTER SET latin1 COLLATE latin1_swedish_ci;
ALTER DATABASE prueba_ddl CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
DROP DATABASE prueba_ddl;
```

- **`utf8mb4`** guarda cualquier carácter: acentos, ñ, emojis.
- **`utf8mb4_unicode_ci`** compara sin distinguir mayúsculas ni acentos al ordenar (`ci` = *case insensitive*).

### Tablas

```sql
CREATE TABLE nombre (
  columna TIPO [NOT NULL | NULL] [DEFAULT valor] [AUTO_INCREMENT],
  ...,
  PRIMARY KEY (columna),
  CONSTRAINT nombre_restriccion ...
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

`ENGINE=InnoDB` es el motor que permite llaves foráneas y transacciones.

**Tipos de datos del proyecto:**

| Tipo | Guarda | Ejemplo |
|---|---|---|
| `INT UNSIGNED` | Entero sin signo (0 a 4,294,967,295) | `id`, `kilometraje` |
| `SMALLINT UNSIGNED` | Entero pequeño (0 a 65,535) | `anio` |
| `DECIMAL(12,2)` | Número exacto: 12 dígitos, 2 decimales. **Siempre para dinero** (no `FLOAT`, que redondea) | `precio` |
| `VARCHAR(n)` | Texto de hasta `n` caracteres | `marca VARCHAR(50)` |
| `TEXT` | Texto largo | `descripcion` |
| `DATE` | Fecha `AAAA-MM-DD` | `fecha` de la venta |
| `TIMESTAMP` | Fecha y hora | `creado_en` |
| `ENUM('a','b')` | Solo uno de esos valores | `estado`, `metodo` |
| `BOOLEAN` | Verdadero o falso (en realidad 1/0) | `v_fin` en el cursor |

**Restricciones (constraints):**

| Restricción | Qué asegura | Ejemplo del proyecto |
|---|---|---|
| `PRIMARY KEY (col)` | Identifica cada fila: única y nunca vacía | `PRIMARY KEY (id)` |
| `AUTO_INCREMENT` | El número lo pone MariaDB (1, 2, 3…) | `id INT UNSIGNED NOT NULL AUTO_INCREMENT` |
| `NOT NULL` | La columna no puede quedar vacía | `marca VARCHAR(50) NOT NULL` |
| `DEFAULT valor` | Valor si no se escribe uno | `kilometraje INT UNSIGNED NOT NULL DEFAULT 0` |
| `UNIQUE (col)` | No se repite (`NULL` sí puede repetirse) | `CONSTRAINT uq_clientes_email UNIQUE (email)` |
| `CHECK (condición)` | Regla que todo dato debe cumplir | `CONSTRAINT chk_vehiculos_precio CHECK (precio >= 0)` |
| `FOREIGN KEY (col) REFERENCES tabla(col)` | El valor debe existir en la otra tabla | `FOREIGN KEY (cliente_id) REFERENCES clientes (id)` |
| `ON DELETE CASCADE` | Si se borra el padre, se borran los hijos | Borrar una venta borra sus pagos |

Ponerle **nombre** a cada restricción (`CONSTRAINT chk_...`) hace que los errores digan cuál falló y permite quitarla después.

### Índices

| Comando | Qué hace |
|---|---|
| `KEY nombre (col)` dentro de `CREATE TABLE` | Índice para buscar más rápido |
| `CREATE INDEX nombre ON tabla (col1, col2);` | Crea un índice |
| `CREATE UNIQUE INDEX nombre ON tabla (col);` | Índice que además no permite repetidos |
| `DROP INDEX nombre ON tabla;` | Quita un índice |

### Modificar tablas: `ALTER TABLE`

| Forma | Qué hace | Ejemplo del proyecto |
|---|---|---|
| `ADD COLUMN col TIPO [AFTER otra]` | Agrega una columna (en esa posición) | `ALTER TABLE asesores ADD COLUMN correo VARCHAR(120) NOT NULL AFTER nombre;` |
| `ADD COLUMN IF NOT EXISTS ...` | Igual, sin error si ya existe | En `u3-acceso.sql` |
| `MODIFY col TIPO_NUEVO` | Cambia el tipo. Repite **toda** la definición | `ALTER TABLE clientes MODIFY telefono VARCHAR(15) NULL;` |
| `RENAME COLUMN vieja TO nueva` | Renombra una columna | `ALTER TABLE clientes RENAME COLUMN creado_en TO registrado_en;` |
| `ADD CONSTRAINT ...` | Agrega una restricción | `ADD CONSTRAINT uq_asesores_correo UNIQUE (correo)` |
| `ADD INDEX nombre (cols)` | Agrega un índice | `ADD INDEX idx_vehiculos_marca_modelo (marca, modelo)` |
| Varias a la vez, separadas por comas | Un solo `ALTER` | `ADD COLUMN asesor_id ..., ADD CONSTRAINT fk_ventas_asesor ...` |

### Borrar y vaciar

| Comando | Qué hace |
|---|---|
| `TRUNCATE TABLE t;` | Vacía la tabla **y reinicia el contador** `AUTO_INCREMENT`. Es rápido |
| `DELETE FROM t;` | Borra filas (todas, sin `WHERE`). El contador **no** se reinicia |
| `DROP TABLE [IF EXISTS] t;` | Borra la tabla completa: estructura y datos |
| `CREATE TABLE nueva LIKE t;` | Crea una tabla vacía con la misma estructura |

### Ver la estructura

| Comando | Qué muestra |
|---|---|
| `DESCRIBE t;` | Columnas, tipos, `NULL`, llaves y valores por defecto |
| `SHOW CREATE TABLE t\G` | El `CREATE TABLE` completo, con todas las restricciones |
| `SELECT ... FROM information_schema.table_constraints WHERE table_schema = 'agencia_proyecto';` | Todas las restricciones de la base. `information_schema` es el **diccionario de datos**: tablas que describen a las demás |

---

## 2. DML: manipular los datos

### Insertar, actualizar y borrar

| Comando | Qué hace |
|---|---|
| `INSERT INTO t (c1, c2) VALUES (v1, v2), (v3, v4);` | Inserta una o varias filas |
| `INSERT INTO t SELECT ... ;` | Inserta el resultado de una consulta |
| `UPDATE t SET c1 = v1, c2 = v2 WHERE condición;` | Cambia filas. **Sin `WHERE` cambia todas** |
| `DELETE FROM t WHERE condición;` | Borra filas. **Sin `WHERE` borra todas** |
| `SELECT ROW_COUNT();` | Cuántas filas cambió el último `UPDATE` o `DELETE` |
| `SELECT LAST_INSERT_ID();` | El `id` que generó el último `INSERT` |

```sql
UPDATE vehiculos SET precio = ROUND(precio * 0.95, 2)
WHERE estado = 'disponible' AND anio <= 2023;
SELECT ROW_COUNT() AS autos_con_descuento;
```

> **Antes de un `UPDATE` o `DELETE`**, corre un `SELECT` con el mismo `WHERE` y revisa qué filas vas a tocar.

### Consultar: `SELECT`

```sql
SELECT [DISTINCT] columnas
FROM tabla
[WHERE condición]          -- filtra FILAS
[GROUP BY columnas]        -- agrupa
[HAVING condición]         -- filtra GRUPOS
[ORDER BY col [ASC|DESC]]  -- ordena (ASC por defecto)
[LIMIT n];                 -- solo las primeras n
```

| Parte | Ejemplo |
|---|---|
| `col AS alias` | `CONCAT(marca, ' ', modelo) AS auto` |
| `=`, `<>`, `<`, `>=` | `estado <> 'vendido'` |
| `BETWEEN a AND b` (incluye los extremos) | `precio BETWEEN 250000 AND 500000` |
| `IN (lista)` | `version IN ('RS', 'GS')` |
| `LIKE 'patrón'`: `%` = lo que sea, `_` = un carácter | `modelo LIKE 'S%'` (empieza con S) |
| `IS NULL` / `IS NOT NULL` (**nunca** `= NULL`) | `WHERE email IS NULL` |
| `AND`, `OR`, `NOT`, paréntesis | `estado = 'disponible' AND (precio < 300000 OR anio = 2025)` |
| `DISTINCT` | `SELECT DISTINCT marca FROM vehiculos` |
| `ORDER BY a, b DESC` | `ORDER BY marca ASC, anio DESC` |
| `LIMIT 3` | Los 3 primeros |

### Agregados y `GROUP BY`

| Función | Regresa |
|---|---|
| `COUNT(*)` | Cuántas filas |
| `COUNT(col)` | Cuántas filas con `col` no `NULL` |
| `SUM(col)` / `AVG(col)` | Suma / promedio |
| `MIN(col)` / `MAX(col)` | Menor / mayor |
| `GROUP_CONCAT(col ORDER BY col SEPARATOR ', ')` | Une los valores del grupo en un texto |

- **`GROUP BY marca`** junta las filas de cada marca y calcula los agregados por grupo.
- **`HAVING`** filtra grupos usando agregados; `WHERE` filtra filas antes de agrupar: `GROUP BY transmision HAVING COUNT(*) > 2`.
- **Todo lo del `SELECT` que no sea agregado** debe ir en el `GROUP BY`.

### Funciones de cadena

| Función | Ejemplo | Resultado |
|---|---|---|
| `UPPER(t)` / `LOWER(t)` | `UPPER('Aveo')` | `AVEO` |
| `CONCAT(a, b, ...)` | `CONCAT('BYD', ' ', 'Seal')` | `BYD Seal` |
| `CONCAT_WS(sep, a, b)` | `CONCAT_WS(' / ', 'BYD', 'Seal', 'AWD')` | `BYD / Seal / AWD` |
| `CHAR_LENGTH(t)` | `CHAR_LENGTH('Onix')` | `4` |
| `SUBSTRING(t, inicio, largo)` | `SUBSTRING('Chevrolet', 1, 3)` | `Che` |
| `SUBSTRING_INDEX(t, sep, n)` | `SUBSTRING_INDEX('Ana López', ' ', 1)` | `Ana` |
| `REPLACE(t, buscar, poner)` | `REPLACE('S10 Max', ' ', '-')` | `S10-Max` |
| `LPAD(t, largo, relleno)` | `LPAD(7, 5, '0')` | `00007` |
| `TRIM(t)` | `TRIM('  Aveo ')` | `Aveo` |
| `COALESCE(a, b)` | `COALESCE(email, 'sin correo')` | El primero que no sea `NULL` |

### Funciones de fecha

| Función | Ejemplo | Resultado |
|---|---|---|
| `CURDATE()` / `NOW()` | | Fecha de hoy / fecha y hora |
| `DATE_FORMAT(f, formato)` | `DATE_FORMAT('2026-08-14', '%d/%m/%Y')` | `14/08/2026` |
| `YEAR(f)`, `MONTH(f)`, `DAY(f)` | `YEAR('2026-08-14')` | `2026` |
| `MONTHNAME(f)`, `DAYNAME(f)` | Con `SET lc_time_names = 'es_MX';` | `agosto`, `viernes` |
| `DATEDIFF(f1, f2)` | `DATEDIFF('2026-12-31', '2026-08-14')` | `139` días |
| `DATE_ADD(f, INTERVAL n unidad)` | `DATE_ADD('2026-08-14', INTERVAL 1 YEAR)` | `2027-08-14` |

### Conversión y números

| Función | Ejemplo | Resultado |
|---|---|---|
| `CAST(valor AS tipo)` | `CAST(precio AS UNSIGNED)` | Sin decimales |
| `CONVERT(valor, tipo)` | `CONVERT(anio, CHAR)` | Como texto |
| `FORMAT(n, dec)` | `FORMAT(279900, 2)` | `279,900.00` |
| `ROUND(n, dec)` | `ROUND(precio * 0.95, 2)` | Redondeado a centavos |

### `JOIN`: combinar tablas

| Tipo | Regresa | Ejemplo del proyecto |
|---|---|---|
| `INNER JOIN` (o solo `JOIN`) | Solo las filas que coinciden en ambas tablas | Ventas con su cliente, auto y asesor |
| `LEFT JOIN` | **Todas** las de la izquierda; si no coinciden, `NULL` | Todos los clientes, aunque no hayan comprado |
| `RIGHT JOIN` | **Todas** las de la derecha | Todos los asesores, aunque no hayan vendido (Paola) |
| `CROSS JOIN` | Cada fila con cada fila (producto cartesiano) | Cada asesor con cada marca |
| Self join (una tabla consigo misma) | Comparar filas de la misma tabla | Autos más caros de la misma marca que el Aveo |

```sql
SELECT v.id, c.nombre, a.modelo
FROM ventas v
JOIN clientes c  ON c.id = v.cliente_id      -- ON: cómo se relacionan
JOIN vehiculos a ON a.id = v.vehiculo_id;
```

`ventas v` le pone un **alias** corto a la tabla. Con `LEFT JOIN`, cuenta con `COUNT(v.id)`, no con `COUNT(*)`: así un cliente sin compras da 0 y no 1.

### Subconsultas

| Tipo | Ejemplo |
|---|---|
| Escalar (un valor) | `WHERE precio > (SELECT AVG(precio) FROM vehiculos)` |
| `IN` (una lista) | `WHERE id IN (SELECT cliente_id FROM ventas WHERE precio_final > 400000)` |
| `EXISTS` / `NOT EXISTS` | `WHERE NOT EXISTS (SELECT 1 FROM ventas v WHERE v.cliente_id = c.id)` |
| Correlacionada (usa la fila de afuera) | `WHERE precio = (SELECT MAX(precio) FROM vehiculos b WHERE b.marca = a.marca)` |
| Tabla derivada (en el `FROM`, con alias) | `FROM (SELECT ...) AS t` |

### Variables y `SET`

| Comando | Qué hace |
|---|---|
| `SET @iva = 0.16;` | Variable de **sesión**: dura mientras estés conectado. Empieza con `@` |
| `SELECT COUNT(*), SUM(x) INTO @n, @total FROM ventas;` | Guarda resultados en variables |
| `SELECT @n, @total;` | Las usa |
| `SET lc_time_names = 'es_MX';` | Cambia una variable del sistema: meses en español |
| `DECLARE v INT DEFAULT 0;` | Variable **local**, solo dentro de un procedimiento (ver unidad 5) |

### Operadores de conjuntos

Las dos consultas deben tener el mismo número de columnas.

| Operador | Regresa |
|---|---|
| `UNION` | Las filas de ambas consultas, sin repetidos |
| `UNION ALL` | Las filas de ambas, con repetidos (más rápido) |
| `INTERSECT` | Solo las que están en **las dos** |
| `EXCEPT` | Las de la primera que **no** están en la segunda |

### Vistas

| Comando | Qué hace |
|---|---|
| `CREATE VIEW v AS SELECT ...;` | Guarda una consulta con nombre; se usa como tabla |
| `CREATE OR REPLACE VIEW v AS ...;` | La crea o la reemplaza |
| `ALTER VIEW v AS ...;` | Cambia su consulta |
| `DROP VIEW v;` | La borra (los datos no se tocan) |
| `... WITH CHECK OPTION` | En vistas que se actualizan, no deja cambiar una fila de forma que salga del filtro |
| `SHOW FULL TABLES WHERE Table_type = 'VIEW';` | Lista las vistas |
| `SHOW CREATE VIEW v\G` | Muestra su definición |

Una vista **no guarda datos**: cada vez que la consultas, corre su `SELECT` con los datos actuales.

---

## 3. Control de acceso

### Usuarios

Un usuario es `'nombre'@'host'`. `localhost` significa que solo puede entrar desde el mismo servidor.

| Comando | Qué hace |
|---|---|
| `CREATE USER 'u'@'localhost' IDENTIFIED BY 'contraseña';` | Crea un usuario |
| `ALTER USER 'u'@'localhost' IDENTIFIED BY 'nueva';` | Cambia su contraseña |
| `ALTER USER ... WITH MAX_QUERIES_PER_HOUR 100 MAX_USER_CONNECTIONS 2;` | Límites de uso |
| `ALTER USER ... ACCOUNT LOCK;` / `ACCOUNT UNLOCK;` | Bloquea o desbloquea la cuenta |
| `RENAME USER 'a'@'localhost' TO 'b'@'localhost';` | Renombra |
| `DROP USER [IF EXISTS] 'u'@'localhost';` | Borra |
| `SELECT user, host FROM mysql.user;` | Lista usuarios (la tabla interna `mysql.user`) |
| `SELECT USER(), CURRENT_USER();` | Con qué usuario entraste / con qué permisos estás actuando |

### Permisos: `GRANT` y `REVOKE`

```sql
GRANT permisos ON alcance TO 'u'@'localhost';
REVOKE permisos ON alcance FROM 'u'@'localhost';
```

| Permiso | Permite |
|---|---|
| `SELECT`, `INSERT`, `UPDATE`, `DELETE` | Leer y escribir filas |
| `EXECUTE` | Ejecutar procedimientos y funciones |
| `CREATE`, `ALTER`, `DROP` | Cambiar la estructura |
| `ALL PRIVILEGES` | Todo |

| Alcance (nivel) | Ejemplo del proyecto |
|---|---|
| Base completa | `GRANT SELECT ON agencia_proyecto.* TO 'p_consulta'@'localhost';` |
| Una tabla | `GRANT SELECT ON agencia_proyecto.vehiculos TO ...;` |
| Columnas | `GRANT SELECT (id, nombre) ON agencia_proyecto.clientes TO ...;` (no puede ver el correo) |
| Un procedimiento | `GRANT EXECUTE ON PROCEDURE agencia_proyecto.ventas_del_mes TO ...;` |
| Una función | `GRANT EXECUTE ON FUNCTION agencia_proyecto.saldo_venta TO ...;` |

| Comando | Qué hace |
|---|---|
| `SHOW GRANTS FOR 'u'@'localhost';` | Sus permisos. Ojo: también muestra la huella de la contraseña |
| `information_schema.table_privileges` / `column_privileges` | Los mismos permisos, sin la huella (así lo hace el proyecto) |
| `FLUSH PRIVILEGES;` | Recarga los permisos. Con `GRANT` no hace falta, pero no estorba |

**`DENY` no existe en MariaDB** (es de SQL Server). Aquí se otorga **solo** lo necesario y, si sobra algo, se quita con `REVOKE`.

### Roles

Un rol es un "paquete" de permisos que se da a varios usuarios.

| Comando | Qué hace |
|---|---|
| `CREATE ROLE rol_vendedor;` | Crea el rol |
| `GRANT SELECT ON agencia_proyecto.* TO rol_vendedor;` | Le da permisos al rol |
| `GRANT rol_vendedor TO 'p_vendedor'@'localhost';` | Le da el rol al usuario |
| `SET DEFAULT ROLE rol_vendedor FOR 'p_vendedor'@'localhost';` | Que el rol se active solo al entrar |
| `SET ROLE rol_vendedor;` | Activarlo a mano en la sesión actual |
| `SELECT CURRENT_ROLE();` | Qué rol tienes activo |
| `GRANT rol_vendedor TO rol_gerente;` | Un rol dentro de otro: el gerente hereda lo del vendedor |
| `DROP ROLE [IF EXISTS] rol;` | Borra el rol |

### Seguridad por fila (cada cliente ve lo suyo)

```sql
CREATE OR REPLACE SQL SECURITY DEFINER VIEW mis_compras AS
SELECT ... FROM ventas v JOIN clientes c ON c.id = v.cliente_id
WHERE c.usuario_bd = SUBSTRING_INDEX(USER(), '@', 1);
GRANT SELECT ON agencia_proyecto.mis_compras TO rol_cliente;
```

- **`USER()`** = quien inició sesión, por ejemplo `p_ana@localhost`. `SUBSTRING_INDEX(..., '@', 1)` deja solo `p_ana`.
- **`SQL SECURITY DEFINER`**: la vista corre con los permisos de quien la creó. Por eso Ana la puede leer aunque no tenga permiso en `ventas`.
- **La misma consulta da datos distintos a cada usuario.**

---

## 4. Concurrencia

### Transacciones

| Comando | Qué hace |
|---|---|
| `SELECT @@autocommit;` | `1` = cada instrucción se guarda sola (por defecto) |
| `SET autocommit = 0;` | Nada se guarda hasta `COMMIT` |
| `START TRANSACTION;` | Empieza una transacción explícita |
| `COMMIT;` | Guarda todo lo de la transacción |
| `ROLLBACK;` | Deshace todo lo de la transacción |
| `SAVEPOINT nombre;` | Marca un punto intermedio |
| `ROLLBACK TO SAVEPOINT nombre;` | Deshace solo lo posterior a esa marca |
| `START TRANSACTION READ ONLY;` | Transacción que solo puede leer |

**ACID:**

| Propiedad | Significa |
|---|---|
| Atomicidad | Todo o nada |
| Consistencia | Las reglas (restricciones) siempre se cumplen |
| Aislamiento | Una transacción no ve el trabajo a medias de otra |
| Durabilidad | Lo que se confirmó con `COMMIT` no se pierde |

### Niveles de aislamiento

```sql
SET [SESSION] TRANSACTION ISOLATION LEVEL nivel;   -- SESSION: para toda la sesión; sin SESSION: solo la siguiente transacción
SHOW SESSION VARIABLES LIKE '%isolation';
```

| Nivel | Lectura sucia | Lectura no repetible | Fantasmas |
|---|---|---|---|
| `READ UNCOMMITTED` | Sí ocurre | Sí | Sí |
| `READ COMMITTED` | No | Sí ocurre | Sí |
| `REPEATABLE READ` (**el de InnoDB por defecto**) | No | No | Casi nunca (InnoDB los evita en lecturas normales) |
| `SERIALIZABLE` | No | No | No |

- **Lectura sucia:** ves un cambio que la otra sesión todavía no confirma (y podría deshacer).
- **Lectura no repetible:** lees el mismo dato dos veces en tu transacción y cambió en medio.
- **Fantasma:** una segunda consulta trae filas que antes no existían.

### Bloqueos

| Comando | Qué hace |
|---|---|
| `SELECT ... FOR UPDATE;` | Bloqueo **exclusivo** de esas filas hasta tu `COMMIT`/`ROLLBACK`. Nadie más puede cambiarlas ni bloquearlas |
| `SELECT ... LOCK IN SHARE MODE;` | Bloqueo **compartido**: otros pueden leer, pero no cambiar |
| `... FOR UPDATE NOWAIT;` | Si la fila está bloqueada, falla al instante en lugar de esperar |
| `... FOR UPDATE SKIP LOCKED;` | Se salta las filas bloqueadas y regresa las demás |
| `LOCK TABLES t WRITE, t2 READ;` | Bloquea **tablas completas** (granularidad gruesa) |
| `UNLOCK TABLES;` | Las libera |
| `SET SESSION innodb_lock_wait_timeout = 1;` | Cuántos segundos esperar un bloqueo antes de rendirse (por defecto 50) |
| `SHOW GLOBAL STATUS LIKE 'Innodb_row_lock%';` | Estadísticas: cuántas veces se esperó y cuánto |
| `DO SLEEP(2);` | Espera 2 segundos. El simulador lo usa para que se vea el orden de los eventos |

| Error | Significa | Qué hacer |
|---|---|---|
| `1205 Lock wait timeout exceeded` | Esperaste un bloqueo más de lo permitido | Reintentar; que las transacciones sean cortas |
| `1213 Deadlock found` | Dos transacciones se esperaban mutuamente; MariaDB canceló una | Reintentar; bloquear las filas siempre en el mismo orden |

### Cómo leer el simulador (`u4-simulador.sh`)

```
04:25:05.78 [A] A leyó y BLOQUEÓ Onix = 1
04:25:06.28 [B] B: quiero leer Onix con FOR UPDATE (espero si está bloqueado)...
04:25:07.78 [B] B por fin leyó Onix = 0  -> ya no hay: no vende
04:25:07.78 [A] A: vendí el Onix y liberé el bloqueo
```

- **La hora** (con centésimas) dice cuándo pasó cada cosa.
- **`[A]` y `[B]`** son las dos sesiones, como dos vendedores en dos computadoras.
- En el ejemplo, B pidió el Onix a las 06.28 y lo recibió hasta las 07.78, justo cuando A liberó el bloqueo: **esperó 1.5 segundos**.

---

## 5. SQL procedural

### `DELIMITER`

Un procedimiento tiene varios `;` adentro. Para que la consola no lo corte en el primero, se cambia el terminador:

```sql
DELIMITER //
CREATE PROCEDURE ... BEGIN ... ; ... ; END //
DELIMITER ;
```

### Procedimientos

| Comando | Qué hace |
|---|---|
| `CREATE [OR REPLACE] PROCEDURE nombre(IN a INT, OUT b INT, INOUT c DECIMAL(12,2)) BEGIN ... END` | Crea el procedimiento |
| `IN` | Valor que entra (por defecto) |
| `OUT` | Valor que el procedimiento regresa en una variable |
| `INOUT` | Entra un valor y sale modificado |
| `CALL nombre(1, @resultado, @precio);` | Lo ejecuta; los `OUT`/`INOUT` se reciben en variables `@` |
| `ALTER PROCEDURE nombre COMMENT '...' SQL SECURITY DEFINER;` | Cambia sus **características** (no su código) |
| Cambiar el código | `CREATE OR REPLACE PROCEDURE` (o `DROP` + `CREATE`) |
| `DROP PROCEDURE [IF EXISTS] nombre;` | Lo borra |
| `COMMENT '...'` | Descripción visible en `information_schema.routines` |

```sql
SET @precio = 449800.00;
CALL aplicar_descuento(@precio, 5);   -- INOUT: @precio entra y sale con el 5% menos
SELECT @precio;                       -- 427310.00
```

### Dentro de `BEGIN ... END`

| Instrucción | Qué hace | Ejemplo del proyecto |
|---|---|---|
| `DECLARE v TIPO [DEFAULT x];` | Variable local (va al inicio del bloque) | `DECLARE v_mes INT DEFAULT 1;` |
| `SET v = expresión;` | Asigna | `SET v_mes = v_mes + 1;` |
| `SELECT col INTO v FROM ...;` | Guarda un resultado en la variable | `SELECT estado INTO v_estado FROM vehiculos WHERE id = p_vehiculo` |
| `IF c THEN ... ELSEIF c2 THEN ... ELSE ... END IF;` | Condición | Validar si el auto existe o ya se vendió |
| `CASE WHEN c THEN x ... ELSE y END` | Elegir un valor | `categoria_auto`: Económico / Intermedio / Premium |
| `etiqueta: LOOP ... LEAVE etiqueta; ... END LOOP;` | Ciclo que sale con `LEAVE` | Cursor de comisiones |
| `WHILE c DO ... END WHILE;` | Ciclo mientras se cumpla | `tabla_de_pagos` mes por mes |
| `CREATE OR REPLACE TEMPORARY TABLE t (...)` | Tabla que solo existe en tu sesión | Resultados de comisiones y del plan de pagos |
| `LAST_INSERT_ID()` | `id` del último `INSERT` | El número de la venta nueva |

### Cursores (recorrer filas una por una)

```sql
DECLARE v_fin BOOLEAN DEFAULT FALSE;
DECLARE cur CURSOR FOR SELECT id, nombre, comision FROM asesores;
DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_fin = TRUE;   -- cuando no hay más filas
OPEN cur;
ciclo: LOOP
  FETCH cur INTO v_id, v_nombre, v_comision;   -- toma la siguiente fila
  IF v_fin THEN LEAVE ciclo; END IF;
  ...
END LOOP;
CLOSE cur;
```

El orden de las declaraciones es obligatorio: primero las variables, luego los cursores y al final los handlers.

### Errores: `SIGNAL` y handlers

| Instrucción | Qué hace |
|---|---|
| `SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'mensaje';` | Lanza **tu propio error** (sale como `ERROR 1644`) y detiene todo |
| `DECLARE EXIT HANDLER FOR SQLEXCEPTION, SQLWARNING BEGIN ROLLBACK; RESIGNAL; END;` | Si algo falla: deshace la transacción y avisa el error original |
| `DECLARE CONTINUE HANDLER FOR NOT FOUND ...` | Si no hay más filas: hace algo y **sigue** |
| `RESIGNAL;` | Vuelve a lanzar el error que se atrapó |

> **Por qué `SQLWARNING` también:** en modo estricto, un valor inválido en un `ENUM` llega con SQLSTATE `01000`, que es de la clase "advertencia", no "excepción". Con solo `SQLEXCEPTION`, ese error escapaba **sin** `ROLLBACK` y la venta se quedaba guardada. Lo detectaron las pruebas del proyecto.

### Funciones

```sql
CREATE OR REPLACE FUNCTION saldo_venta(p_venta INT) RETURNS DECIMAL(12,2)
READS SQL DATA
BEGIN
  ...
  RETURN v_total - v_pagado;
END
```

| Palabra | Significa |
|---|---|
| `RETURNS tipo` | Qué tipo de dato regresa (una función regresa **un** valor) |
| `RETURN valor;` | Lo regresa |
| `DETERMINISTIC` | Con los mismos datos de entrada, siempre da lo mismo (`precio_sin_iva`) |
| `READS SQL DATA` | Lee tablas, pero no las cambia (`saldo_venta`) |
| `MODIFIES SQL DATA` | Cambia datos (`registrar_venta`) |

Se usa dentro de cualquier consulta: `SELECT id, saldo_venta(id) FROM ventas;`

**Procedimiento contra función:** el procedimiento se llama con `CALL`, puede regresar tablas y varios `OUT`. La función se usa dentro de un `SELECT` y regresa un solo valor.

### Triggers (desencadenadores)

```sql
CREATE [OR REPLACE] TRIGGER nombre
BEFORE | AFTER  INSERT | UPDATE | DELETE  ON tabla
FOR EACH ROW
BEGIN ... END
```

| Parte | Significa |
|---|---|
| `BEFORE` | Corre antes de guardar: puede **validar** (con `SIGNAL`) y **cambiar** `NEW` |
| `AFTER` | Corre después de guardar: para actualizar **otras** tablas o la bitácora |
| `NEW.col` | La fila nueva (en `INSERT` y `UPDATE`) |
| `OLD.col` | La fila anterior (en `UPDATE` y `DELETE`). Son las "tablas mágicas" `inserted`/`deleted` de SQL Server |
| `FOR EACH ROW` | Corre una vez por cada fila afectada |
| `DROP TRIGGER [IF EXISTS] nombre;` | Lo borra |
| `SHOW TRIGGERS;` | Lista los triggers |

| Trigger del proyecto | Momento | Para qué |
|---|---|---|
| `trg_pagos_valida` | BEFORE INSERT en `pagos` | Un pago no puede ser mayor que el saldo |
| `trg_vehiculos_limpia` | BEFORE UPDATE en `vehiculos` | Quita espacios y no deja cambiar el precio de un auto vendido |
| `trg_ventas_marca_vendido` | AFTER INSERT en `ventas` | Marca el auto como `vendido` y lo anota en la bitácora |
| `trg_ventas_cancela` | AFTER DELETE en `ventas` | Si se cancela la venta, el auto vuelve a `disponible` |
| `trg_vehiculos_bitacora` | AFTER UPDATE en `vehiculos` | Anota los cambios de precio y estado con el valor anterior (`OLD`) y el nuevo (`NEW`) |

### Ver los objetos procedurales

```sql
SELECT routine_type, routine_name FROM information_schema.routines WHERE routine_schema = 'agencia_proyecto';
SELECT trigger_name, action_timing, event_manipulation FROM information_schema.triggers WHERE trigger_schema = 'agencia_proyecto';
SHOW CREATE PROCEDURE registrar_venta\G
```

---

## 6. Conectividad

### JDBC (Java): `ConexionJDBC.java`

| Código | Qué hace |
|---|---|
| `jdbc:mariadb://127.0.0.1:3306/agencia_proyecto` | URL de conexión: driver, servidor, puerto y base |
| `DriverManager.getConnection(url, usuario, clave)` | Abre la conexión |
| `try (Connection cn = ...) { }` | try-with-resources: la cierra sola, aunque haya error |
| `cn.createStatement().executeQuery(sql)` | Ejecuta un `SELECT` fijo y regresa un `ResultSet` |
| `rs.next()` / `rs.getString("col")` / `rs.getBigDecimal("precio")` | Avanza fila por fila y lee columnas (`BigDecimal` para dinero) |
| `cn.prepareStatement("... WHERE nombre = ?")` + `ps.setString(1, valor)` | **PreparedStatement**: los datos van aparte del SQL, así no hay inyección |
| `ps.executeUpdate()` | Ejecuta `INSERT`/`UPDATE`/`DELETE` y regresa cuántas filas cambió |
| `Statement.RETURN_GENERATED_KEYS` + `ps.getGeneratedKeys()` | El `id` autoincrementable que se generó |
| `cn.prepareCall("{call registrar_venta(?, ?, ...)}")` | **CallableStatement**: ejecuta un procedimiento |
| `cs.registerOutParameter(7, Types.INTEGER)` + `cs.getInt(7)` | Recibe un parámetro `OUT` |
| `cn.prepareCall("{? = call saldo_venta(?)}")` | Llama una función |
| `cn.setAutoCommit(false)` / `cn.commit()` / `cn.rollback()` | Transacción desde Java |
| `SQLException e` → `e.getErrorCode()` | El error de MariaDB, por ejemplo `1142` (permiso negado) |
| `javac -cp conector.jar ConexionJDBC.java` | Compila incluyendo el conector |
| `java -cp .:conector.jar ConexionJDBC` | Ejecuta (en Windows, `;` en lugar de `:`) |

### ODBC: `conexion_odbc.py` y `probar.sh`

| Comando o código | Qué hace |
|---|---|
| `apt install unixodbc odbc-mariadb python3-pyodbc` | Administrador ODBC de Linux, driver de MariaDB y módulo de Python |
| `odbcinst -q -d` | Lista los **drivers** instalados (`[MariaDB Unicode]`) |
| `odbcinst -q -s` | Lista los **DSN** (orígenes de datos) configurados |
| `/etc/odbc.ini` | Donde se define el DSN `[agencia_proyecto]`: `Driver`, `Server`, `Port`, `Database` |
| `isql -b -v agencia_proyecto usuario clave` | Cliente de línea de comandos de ODBC: se conecta por el DSN y ejecuta SQL |
| `pyodbc.connect("DSN=agencia_proyecto;UID=p_app;PWD=...")` | Conexión desde Python usando el DSN |
| `cur.execute("SELECT ... WHERE marca = ? AND precio <= ?", "BYD", 700000)` | Consulta con parámetros `?` (sin inyección) |
| `cur.fetchall()` / `for fila in cur.execute(...)` | Lee los resultados; `fila.columna` |
| `cur.execute("{CALL ventas_del_mes(?, ?)}", 2026, 10)` | Llama un procedimiento |
| `while cur.nextset(): pass` | Consume los resultados extra que deja un `CALL`. Si no, sale `ERROR 2014 Commands out of sync` |
| `cn.autocommit = False` / `cn.rollback()` | Transacción desde Python |
| `cn.getinfo(pyodbc.SQL_DRIVER_NAME)` | Datos del driver y del servidor |

**En Windows:** instala *MariaDB Connector/ODBC* y crea el DSN en el *Administrador de orígenes de datos ODBC*: Host `127.0.0.1`, puerto `3306`, base `agencia_proyecto`. Conéctate a través de un túnel SSH (como en [13. MariaDB visual](13-mariadb-visual.md)).

### La aplicación web (Node.js): `src/`

| Código | Qué hace |
|---|---|
| `mysql.createPool({...})` | Un **pool**: conexiones reutilizables para muchas visitas a la vez |
| `pool.execute('SELECT ... WHERE id = ?', [id])` | Consulta parametrizada (prepared statement) |
| `multipleStatements: false` | Impide `...; DROP TABLE ...` aunque alguien lograra inyectar texto |

---

## Errores frecuentes

| Error | Significa | Unidad |
|---|---|---|
| `1045 Access denied for user` | Usuario o contraseña incorrectos | 3 |
| `1046 No database selected` | Falta `USE base;` | — |
| `1048 Column 'x' cannot be null` | Rompe un `NOT NULL` | 1 |
| `1062 Duplicate entry` | Rompe una `PRIMARY KEY` o un `UNIQUE` | 1 |
| `1142 command denied ... for table` | No tienes ese permiso en esa tabla | 3 |
| `1143 command denied ... for column` | No tienes permiso en esa columna | 3 |
| `1205 Lock wait timeout exceeded` | Esperaste un bloqueo demasiado tiempo | 4 |
| `1213 Deadlock found` | Interbloqueo: MariaDB canceló tu transacción | 4 |
| `1265 Data truncated` | El valor no cabe o no está en el `ENUM` | 1 |
| `1369 CHECK OPTION failed` | El cambio saca la fila del filtro de la vista | 2 |
| `1451 Cannot delete or update a parent row` | Borras algo que otra tabla usa (llave foránea) | 1 |
| `1452 Cannot add or update a child row` | Apuntas a algo que no existe (llave foránea) | 1 |
| `1644` (con tu mensaje) | Un `SIGNAL` de tus procedimientos o triggers | 5 |
| `2014 Commands out of sync` | No consumiste todos los resultados de un `CALL` | 6 |
| `4025 CONSTRAINT ... failed` (MySQL: `3819`) | Rompe un `CHECK` | 1 |
