# 14. Prepárate para tu examen de bases de datos (MySQL / MariaDB)

[← Volver al índice](README.md)

Tu VPS de Hostinger ya tiene MariaDB (compatible con MySQL) y una base solo para practicar: **`agencia_practica`**. Ahí puedes crear, borrar y romper lo que quieras: **el sitio real no se entera**. Antes de cada intento la dejas como nueva con un comando.

| Contenido | |
|---|---|
| [1. Entrar desde Hostinger](#1-entrar-desde-hostinger) | Una sola vez y luego en 1 minuto |
| [2. Cómo usar el simulacro](#2-cómo-usar-el-simulacro) | Tiempo, orden y puntos |
| [3. Acordeón](#3-acordeón) | La sintaxis que más sale en examen |
| [4. Simulacro de examen](#4-simulacro-de-examen) | 30 preguntas, 100 puntos (sin respuestas) |
| [5. Respuestas](#5-respuestas-y-resultados-esperados) | Con el resultado exacto que debes obtener |
| [6. Trampas típicas](#6-trampas-típicas-de-examen) | Lo que más baja calificación |
| [7. Si tu examen es en MySQL](#7-si-tu-examen-es-en-mysql-workbench) | Diferencias con MariaDB |

> Si necesitas más práctica por temas (6 niveles con respuestas), está en [5. Practicar MySQL por SSH](05-practica-mysql-ssh.md#4-ejercicios).

---

## 1. Entrar desde Hostinger

Tu dominio y tu servidor (VPS) están en Hostinger, pero la base **no** se maneja desde la sección *Dominios*. Se maneja dentro del VPS.

### Una sola vez: tu usuario de práctica

1. Abre **hPanel → VPS → Terminal** (se abre en el navegador). Si ya tienes tu llave SSH, también puedes entrar desde tu computadora con `ssh root@diegorodriguezautos.com`.
2. Crea tu usuario de base de datos:
   ```bash
   bash /var/www/diegorodriguezautos.com/deploy/usuario-bd-visual.sh
   ```
   - Usuario: Enter (queda `diego`).
   - Nivel: **1**.
   - Contraseña: la que quieras, mínimo 12 caracteres. **Anótala**: la usarás en cada práctica.

   Ese usuario puede **todo** en `agencia_practica`, pero no puede cambiar ni borrar nada del sitio real.

### Cada vez que practiques

```bash
# 1) Dejar la base de práctica como nueva (borra lo que hiciste antes)
bash /var/www/diegorodriguezautos.com/deploy/reiniciar-practica.sh

# 2) Entrar
mariadb -u diego -p agencia_practica
```

Te pide la contraseña (no se ve al escribir) y aparece:

```
MariaDB [agencia_practica]>
```

Ya puedes escribir SQL. Para salir: `exit`.

> **No practiques como root** (`sudo mariadb` o `mariadb` a secas). Root puede borrar la base del sitio con un solo error de dedo. Úsalo solo en la sección E del simulacro (usuarios), y solo sobre `agencia_practica`.

**¿Prefieres ventanas en lugar de terminal?** Conecta DBeaver con el mismo usuario `diego` ([13. MariaDB visual](13-mariadb-visual.md)). Para el examen conviene practicar también en terminal: ahí no hay botones que te ayuden.

**¿Quieres practicar con los autos reales del sitio** en lugar de los de ejemplo? Usa `reiniciar-practica.sh --copia-del-sitio`. Es una copia (sin las cuentas del panel): lo que hagas no cambia la página. Pero el simulacro de abajo está calculado con los **datos de ejemplo**.

### Comandos de la consola

| Comando | Qué hace |
|---|---|
| `SHOW TABLES;` | Lista las tablas |
| `DESCRIBE vehiculos;` | Columnas, tipos y llaves de una tabla |
| `SHOW CREATE TABLE ventas\G` | El `CREATE TABLE` completo, en vertical |
| `\c` | Cancela lo que llevas escrito |
| `source /root/mi-examen.sql` | Ejecuta un archivo de SQL |
| Flecha ↑ | Repite y edita la consulta anterior |

- Todo termina en `;`. Si la consola muestra `->`, te falta el `;`.
- Si los acentos salen como `�`, entra con `mariadb --default-character-set=utf8mb4 -u diego -p agencia_practica`.

### Las tablas

```
vehiculos 1───* vehiculo_imagenes          clientes 1───* ventas *───1 vehiculos
                                                              │
                                                              1
                                                              │
                                                              *
                                                            pagos
```

| Tabla | Columnas principales |
|---|---|
| `vehiculos` | `id`, `marca`, `modelo`, `anio`, `version`, `precio`, `kilometraje`, `color`, `transmision` (`automatica`/`manual`), `descripcion`, `estado` (`disponible`/`apartado`/`vendido`) |
| `clientes` | `id`, `nombre`, `telefono`, `email` |
| `ventas` | `id`, `vehiculo_id`, `cliente_id`, `fecha`, `precio_final` (un auto se vende **una** vez) |
| `pagos` | `id`, `venta_id`, `fecha`, `monto`, `metodo` (`efectivo`/`transferencia`/`tarjeta`/`financiamiento`) |

**Datos de ejemplo:**

| id | Auto | Año | Precio | Km | Transmisión | Estado |
|---|---|---|---|---|---|---|
| 1 | Nissan Versa | 2021 | 265,000 | 38,000 | automática | disponible |
| 2 | Volkswagen Jetta | 2019 | 289,000 | 61,000 | manual | disponible |
| 3 | Toyota Corolla | 2020 | 315,000 | 45,000 | automática | vendido |
| 4 | Chevrolet Aveo | 2018 | 159,000 | 82,000 | manual | vendido |
| 5 | Honda CR-V | 2022 | 549,000 | 21,000 | automática | apartado |
| 6 | Mazda 3 | 2021 | 335,000 | 33,000 | automática | disponible |
| 7 | Kia Rio | 2020 | 219,000 | 57,000 | automática | disponible |
| 8 | Ford Ranger | 2019 | 459,000 | 90,000 | manual | vendido |

Clientes: 1 Ana López, 2 Carlos Ruiz, 3 María Fernández. Ventas: Ana compró el Corolla y la Ranger; Carlos, el Aveo.

---

## 2. Cómo usar el simulacro

1. **Reinicia** la base (`reiniciar-practica.sh`).
2. Pon un cronómetro de **90 minutos**.
3. Resuelve **en orden**: las secciones B, C y D cambian datos que usan las siguientes.
4. Copia cada consulta que funcione en un archivo de texto en tu computadora: es tu "hoja de examen".
5. Al terminar, compara con la [sección 5](#5-respuestas-y-resultados-esperados). Cuenta como bien si **tu resultado es igual**, aunque tu SQL sea distinto.

| Sección | Tema | Puntos |
|---|---|---|
| A | Consultas: `SELECT`, filtros, agregados, `JOIN`, subconsultas | 36 |
| B | Modificar datos y transacciones | 15 |
| C | Crear y cambiar tablas; restricciones | 22 |
| D | Vistas, procedimientos, funciones y triggers | 22 |
| E | Usuarios, permisos y respaldos | 5 |
| | **Total** | **100** |

Repite el simulacro (reiniciando antes) hasta sacar **90 o más** en menos de 60 minutos.

---

## 3. Acordeón

**Consultar**

```sql
SELECT col1, col2 AS alias FROM tabla
WHERE cond AND/OR cond          -- =, <>, >, BETWEEN a AND b, IN (...), LIKE 'N%', IS NULL
GROUP BY col1                   -- una fila por grupo
HAVING COUNT(*) > 1             -- filtra GRUPOS (WHERE filtra filas)
ORDER BY col2 DESC              -- ASC por defecto
LIMIT 5;                        -- solo las primeras 5

-- Agregados: COUNT(*) · COUNT(col) (no cuenta NULL) · SUM · AVG · MIN · MAX
-- Funciones: CONCAT(a,' ',b) · ROUND(x,2) · COALESCE(x,0) · UPPER · YEAR(fecha) · NOW()
```

**Unir tablas**

```sql
SELECT ... FROM ventas v
JOIN clientes c ON c.id = v.cliente_id        -- INNER: solo los que coinciden
LEFT JOIN pagos p ON p.venta_id = v.id;       -- LEFT: todos los de la izquierda, aunque no coincidan (NULL)
```

**Subconsultas**

```sql
WHERE precio > (SELECT AVG(precio) FROM vehiculos)        -- un valor
WHERE id NOT IN (SELECT cliente_id FROM ventas)           -- una lista
WHERE EXISTS (SELECT 1 FROM ventas v WHERE v.cliente_id = c.id)
```

**Modificar datos**

```sql
INSERT INTO tabla (c1, c2) VALUES (v1, v2), (v3, v4);
UPDATE tabla SET c1 = v1 WHERE id = 5;       -- ¡sin WHERE cambia TODAS las filas!
DELETE FROM tabla WHERE id = 5;              -- ¡sin WHERE borra TODO!
START TRANSACTION; ... COMMIT;               -- o ROLLBACK para deshacer
SELECT LAST_INSERT_ID();                     -- id del último INSERT
SELECT ROW_COUNT();                          -- filas que cambió el último UPDATE/DELETE
```

**Estructura**

```sql
CREATE TABLE t (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(50) NOT NULL,
  precio DECIMAL(10,2) NOT NULL DEFAULT 0,
  tipo ENUM('a','b') NOT NULL,
  otro_id INT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_t_nombre (nombre),
  CONSTRAINT fk_t_otro FOREIGN KEY (otro_id) REFERENCES otra (id) ON DELETE CASCADE,
  CONSTRAINT chk_t_precio CHECK (precio >= 0)
) ENGINE=InnoDB;

ALTER TABLE t ADD COLUMN c VARCHAR(20) NULL AFTER nombre;
ALTER TABLE t MODIFY c VARCHAR(40) NOT NULL;
ALTER TABLE t DROP COLUMN c;
CREATE INDEX idx_t_tipo ON t (tipo);
DROP TABLE t;           -- borra tabla y datos
TRUNCATE TABLE t;       -- vacía la tabla y reinicia el AUTO_INCREMENT
```

**Vistas, procedimientos, funciones y triggers**

```sql
CREATE OR REPLACE VIEW v AS SELECT ...;

DELIMITER //
CREATE PROCEDURE p(IN x INT)
BEGIN
  SELECT ... WHERE id = x;
END //

CREATE FUNCTION f(x INT) RETURNS DECIMAL(12,2)
READS SQL DATA
BEGIN
  DECLARE r DECIMAL(12,2);
  SELECT ... INTO r FROM ... WHERE id = x;
  RETURN r;
END //

CREATE TRIGGER tr BEFORE INSERT ON t     -- BEFORE/AFTER · INSERT/UPDATE/DELETE
FOR EACH ROW
BEGIN
  IF NEW.precio < 0 THEN                 -- NEW = fila nueva · OLD = fila anterior
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Mensaje';
  END IF;
END //
DELIMITER ;

CALL p(1);   SELECT f(1);
SHOW TRIGGERS;   SHOW PROCEDURE STATUS WHERE Db = DATABASE();
DROP VIEW v; DROP PROCEDURE p; DROP FUNCTION f; DROP TRIGGER tr;
```

**Usuarios y respaldos** (como root)

```sql
CREATE USER 'u'@'localhost' IDENTIFIED BY 'contraseña';
GRANT SELECT, INSERT ON base.* TO 'u'@'localhost';
REVOKE INSERT ON base.* FROM 'u'@'localhost';
SHOW GRANTS FOR 'u'@'localhost';
DROP USER 'u'@'localhost';
```

```bash
mariadb-dump --routines --triggers base > respaldo.sql     # respaldar
mariadb otra_base < respaldo.sql                            # restaurar
```

---

## 4. Simulacro de examen

Base: `agencia_practica` recién reiniciada. Resuelve en orden. Las respuestas están en la sección 5: no las veas hasta terminar.

### Sección A: Consultas (36 puntos, 3 cada una)

**A1.** Marca, modelo, año y precio de los autos **disponibles**, del más caro al más barato.

**A2.** Marca, modelo y kilometraje de los autos **automáticos** con kilometraje **entre 30,000 y 60,000**.

**A3.** Marca y modelo de los autos que **no tienen descripción**.

**A4.** ¿Cuántos autos hay en cada **estado**? Ordena del estado con más autos al que tiene menos.

**A5.** Por cada **transmisión**: precio promedio (redondeado a 2 decimales), precio mínimo y precio máximo.

**A6.** Los **estados** cuyo precio promedio sea **mayor a 300,000**, con ese promedio.

**A7.** Cada venta con: número de venta, nombre del cliente, el auto como un solo texto (`Toyota Corolla`), precio final y fecha. Ordena por fecha.

**A8.** **Todos** los clientes con cuántas compras tienen y cuánto suman, **incluidos los que no han comprado** (con 0).

**A9.** Marca, modelo y precio de los autos cuyo precio es **mayor al promedio** de todos los autos.

**A10.** Las ventas que **no están liquidadas**: número de venta, precio final, total pagado y saldo.

**A11.** Nombre de los clientes que **nunca han comprado**, usando una subconsulta.

**A12.** Pagos de **septiembre de 2026** agrupados por método: cuántos pagos y el total, del total mayor al menor.

### Sección B: Modificar datos (15 puntos, 5 cada una)

**B1.** En **una transacción**: registra al cliente nuevo *Luis Torres* (tel. 4771234567, luis@example.com), véndele el **Mazda 3** (id 6) el 2026-10-20 en 330,000 y marca ese auto como **vendido**. Comprueba el resultado con una consulta.

**B2.** Sube **5%** el precio (redondeado a 2 decimales) de los autos **disponibles** del **2021 en adelante**. ¿Cuántas filas cambiaron? ¿Por qué no son 2?

**B3.** Dentro de una transacción, borra **todos** los pagos, comprueba que la tabla quedó vacía y **deshazlo**. Comprueba que los pagos volvieron.

### Sección C: Estructura y restricciones (22 puntos)

**C1.** (10 pts) Crea la tabla **`pruebas_manejo`** para agendar pruebas de manejo:
- `id` autoincrementable y llave primaria.
- `vehiculo_id` y `cliente_id`, obligatorios, con llaves foráneas. Si se borra el auto, se borran sus pruebas.
- `fecha_hora` obligatoria.
- `estado`: solo `agendada`, `realizada` o `cancelada`; por defecto `agendada`.
- `comentarios` opcional, hasta 255 caracteres.
- Un mismo auto no puede tener dos pruebas a la misma fecha y hora.

Luego agenda: el auto 1 para María (cliente 3) el 2026-10-28 a las 11:00, y el auto 7 para Carlos (cliente 2) el mismo día a las 12:30.

**C2.** (6 pts)
- Agrega a `clientes` la columna `ciudad` (hasta 60 caracteres, obligatoria, por defecto `León`), después de `email`.
- Cambia `telefono` para que acepte hasta 15 caracteres.
- Crea un índice sobre `vehiculos.anio`.

**C3.** (6 pts, 1 cada uno) Ejecuta cada instrucción. Todas deben **fallar**: anota el número de error y explica por qué.
1. `INSERT INTO pruebas_manejo (vehiculo_id, cliente_id, fecha_hora) VALUES (1, 3, '2026-10-28 11:00:00');`
2. `INSERT INTO pruebas_manejo (vehiculo_id, cliente_id, fecha_hora) VALUES (99, 1, '2026-11-01 10:00:00');`
3. `DELETE FROM clientes WHERE id = 1;`
4. `UPDATE vehiculos SET precio = -5 WHERE id = 1;`
5. `INSERT INTO ventas (vehiculo_id, cliente_id, fecha, precio_final) VALUES (3, 2, '2026-10-21', 300000);`
6. `INSERT INTO pruebas_manejo (vehiculo_id, cliente_id, fecha_hora, estado) VALUES (2, 1, '2026-11-02 10:00:00', 'pendiente');`

### Sección D: Vistas, procedimientos, funciones y triggers (22 puntos)

**D1.** (4 pts) Crea la vista **`vista_inventario`** con los autos **disponibles o apartados**: `id`, el auto como texto (`Kia Rio 2020`), precio y kilometraje. Consúltala ordenada por precio.

**D2.** (5 pts) Crea el procedimiento **`compras_de_cliente(p_cliente)`** que muestre las compras de un cliente: venta, auto, fecha y precio final. Llámalo para Ana (cliente 1).

**D3.** (5 pts) Crea la función **`saldo_venta(p_venta)`** que regrese cuánto falta por pagar de una venta. Úsala para ver el saldo de **todas** las ventas.

**D4.** (4 pts) Crea un trigger que, **al registrar una venta**, marque el auto como `vendido` automáticamente. Pruébalo vendiendo el **Kia Rio** (id 7) a María (cliente 3) el 2026-10-22 en 215,000, **sin** hacer tú el `UPDATE`.

**D5.** (4 pts) Crea un trigger que **impida registrar un pago mayor al saldo** de su venta, con el mensaje *"El pago es mayor que el saldo de la venta"*. Pruébalo:
- Un pago de 100,000 a la venta 1 debe **entrar**: liquida el saldo.
- Un pago de 1.00 a la venta 2 (ya liquidada) debe **rechazarse**.

### Sección E: Usuarios y respaldos (5 puntos)

Esta sección se hace como **root**: sal con `exit` y entra con `mariadb agencia_practica`. Ten cuidado: como root puedes tocar el sitio.

**E1.** (3 pts)
- Crea el usuario `consulta_examen` (contraseña a tu gusto) que solo pueda **leer** `agencia_practica` y **ejecutar** `compras_de_cliente`.
- Muestra sus permisos.
- Entra con él y comprueba que puede hacer `SELECT` pero no `UPDATE`.
- Quítale el permiso de lectura y, al final, **borra** el usuario.

**E2.** (2 pts)
- Respalda `agencia_practica` (con procedimientos y triggers) en `/root/practica.sql`.
- Restáuralo en una base nueva, `practica_copia`, y comprueba que tiene 5 ventas, 2 triggers y 2 rutinas.
- Borra `practica_copia`.

---

## 5. Respuestas y resultados esperados

Todas se probaron en orden, con la base recién reiniciada y entrando con el usuario de práctica (la sección E, como root). Tu SQL puede ser distinto: lo que cuenta es que el **resultado** sea el mismo.

### Sección A

**A1**
```sql
SELECT marca, modelo, anio, precio
FROM vehiculos
WHERE estado = 'disponible'
ORDER BY precio DESC;
```
```
+------------+--------+------+-----------+
| marca      | modelo | anio | precio    |
+------------+--------+------+-----------+
| Mazda      | 3      | 2021 | 335000.00 |
| Volkswagen | Jetta  | 2019 | 289000.00 |
| Nissan     | Versa  | 2021 | 265000.00 |
| Kia        | Rio    | 2020 | 219000.00 |
+------------+--------+------+-----------+
```

**A2**
```sql
SELECT marca, modelo, kilometraje
FROM vehiculos
WHERE kilometraje BETWEEN 30000 AND 60000
  AND transmision = 'automatica';
```
```
| Nissan | Versa   | 38000 |
| Toyota | Corolla | 45000 |
| Mazda  | 3       | 33000 |
| Kia    | Rio     | 57000 |
```

**A3**: `= NULL` **no** funciona; se usa `IS NULL`.
```sql
SELECT marca, modelo FROM vehiculos WHERE descripcion IS NULL;
```
```
| Toyota | Corolla |
| Mazda  | 3       |
| Kia    | Rio     |
```

**A4**
```sql
SELECT estado, COUNT(*) AS total
FROM vehiculos
GROUP BY estado
ORDER BY total DESC;
```
```
| disponible | 4 |
| vendido    | 3 |
| apartado   | 1 |
```

**A5**
```sql
SELECT transmision, ROUND(AVG(precio), 2) AS promedio, MIN(precio) AS minimo, MAX(precio) AS maximo
FROM vehiculos
GROUP BY transmision;
```
```
| automatica | 336600.00 | 219000.00 | 549000.00 |
| manual     | 302333.33 | 159000.00 | 459000.00 |
```

**A6**: la condición sobre un agregado va en `HAVING`, no en `WHERE`.
```sql
SELECT estado, ROUND(AVG(precio), 2) AS promedio
FROM vehiculos
GROUP BY estado
HAVING AVG(precio) > 300000;
```
```
| apartado | 549000.00 |
| vendido  | 311000.00 |
```

**A7**
```sql
SELECT v.id AS venta, c.nombre AS cliente, CONCAT(a.marca, ' ', a.modelo) AS auto,
       v.precio_final, v.fecha
FROM ventas v
JOIN clientes c  ON c.id = v.cliente_id
JOIN vehiculos a ON a.id = v.vehiculo_id
ORDER BY v.fecha;
```
```
| 1 | Ana López   | Toyota Corolla | 305000.00 | 2026-08-14 |
| 2 | Carlos Ruiz | Chevrolet Aveo | 155000.00 | 2026-09-02 |
| 3 | Ana López   | Ford Ranger    | 450000.00 | 2026-09-20 |
```

**A8**: con `JOIN` normal, María desaparecería. Se necesita `LEFT JOIN` y `COUNT(v.id)`; `COUNT(*)` le daría 1.
```sql
SELECT c.nombre, COUNT(v.id) AS compras, COALESCE(SUM(v.precio_final), 0) AS total_comprado
FROM clientes c
LEFT JOIN ventas v ON v.cliente_id = c.id
GROUP BY c.id, c.nombre
ORDER BY compras DESC, c.nombre;
```
```
| Ana López       | 2 | 755000.00 |
| Carlos Ruiz     | 1 | 155000.00 |
| María Fernández | 0 |      0.00 |
```

**A9**: el promedio es 323,750.
```sql
SELECT marca, modelo, precio
FROM vehiculos
WHERE precio > (SELECT AVG(precio) FROM vehiculos)
ORDER BY precio;
```
```
| Mazda | 3      | 335000.00 |
| Ford  | Ranger | 459000.00 |
| Honda | CR-V   | 549000.00 |
```

**A10**
```sql
SELECT v.id AS venta, v.precio_final, SUM(p.monto) AS pagado,
       v.precio_final - SUM(p.monto) AS saldo
FROM ventas v
JOIN pagos p ON p.venta_id = v.id
GROUP BY v.id, v.precio_final
HAVING SUM(p.monto) < v.precio_final;
```
```
| 1 | 305000.00 | 205000.00 | 100000.00 |
| 3 | 450000.00 | 350000.00 | 100000.00 |
```

**A11**
```sql
SELECT nombre FROM clientes
WHERE id NOT IN (SELECT cliente_id FROM ventas);
```
```
| María Fernández |
```

**A12**
```sql
SELECT metodo, COUNT(*) AS pagos, SUM(monto) AS total
FROM pagos
WHERE fecha BETWEEN '2026-09-01' AND '2026-09-30'
GROUP BY metodo
ORDER BY total DESC;
```
```
| financiamiento | 1 | 200000.00 |
| efectivo       | 1 | 155000.00 |
| tarjeta        | 1 | 150000.00 |
| transferencia  | 1 | 100000.00 |
```
El pago de transferencia del 14 de agosto no cuenta: es de agosto.

### Sección B

**B1**: `LAST_INSERT_ID()` da el id del cliente recién creado, sin que tengas que adivinarlo.
```sql
START TRANSACTION;
INSERT INTO clientes (nombre, telefono, email) VALUES ('Luis Torres', '4771234567', 'luis@example.com');
SET @cliente = LAST_INSERT_ID();
INSERT INTO ventas (vehiculo_id, cliente_id, fecha, precio_final) VALUES (6, @cliente, '2026-10-20', 330000.00);
UPDATE vehiculos SET estado = 'vendido' WHERE id = 6;
COMMIT;

SELECT v.id, c.nombre, a.modelo, a.estado
FROM ventas v
JOIN clientes c  ON c.id = v.cliente_id
JOIN vehiculos a ON a.id = v.vehiculo_id
WHERE a.id = 6;
```
```
| 4 | Luis Torres | 3 | vendido |
```

**B2**: **cambia 1 fila, no 2.** El Mazda (2021) ya no está disponible: lo vendiste en B1. Solo sube el Versa, de 265,000 a 278,250. Siempre revisa con un `SELECT` y el mismo `WHERE` **antes** del `UPDATE`.
```sql
SELECT id, modelo, precio FROM vehiculos WHERE estado = 'disponible' AND anio >= 2021;

UPDATE vehiculos SET precio = ROUND(precio * 1.05, 2)
WHERE estado = 'disponible' AND anio >= 2021;

SELECT ROW_COUNT() AS filas_cambiadas;   -- 1
```

**B3**
```sql
START TRANSACTION;
DELETE FROM pagos;
SELECT COUNT(*) FROM pagos;   -- 0
ROLLBACK;
SELECT COUNT(*) FROM pagos;   -- 5
```
> `ROLLBACK` solo deshace lo que está **dentro** de una transacción sin `COMMIT`. Un `DELETE` suelto (fuera de `START TRANSACTION`) se guarda al instante y no tiene vuelta atrás.

### Sección C

**C1**
```sql
CREATE TABLE pruebas_manejo (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  vehiculo_id INT UNSIGNED NOT NULL,
  cliente_id  INT UNSIGNED NOT NULL,
  fecha_hora  DATETIME     NOT NULL,
  estado      ENUM('agendada','realizada','cancelada') NOT NULL DEFAULT 'agendada',
  comentarios VARCHAR(255) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_prueba_auto_hora (vehiculo_id, fecha_hora),
  CONSTRAINT fk_prueba_vehiculo FOREIGN KEY (vehiculo_id) REFERENCES vehiculos (id) ON DELETE CASCADE,
  CONSTRAINT fk_prueba_cliente  FOREIGN KEY (cliente_id)  REFERENCES clientes (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO pruebas_manejo (vehiculo_id, cliente_id, fecha_hora) VALUES
  (1, 3, '2026-10-28 11:00:00'),
  (7, 2, '2026-10-28 12:30:00');

SELECT * FROM pruebas_manejo;
```
```
| 1 | 1 | 3 | 2026-10-28 11:00:00 | agendada | NULL |
| 2 | 7 | 2 | 2026-10-28 12:30:00 | agendada | NULL |
```
Puntos clave:
- Las llaves foráneas deben ser del **mismo tipo** que la columna a la que apuntan (`INT UNSIGNED`). Si no, sale el error 150, *"Foreign key constraint is incorrectly formed"*.
- El `estado` queda `agendada` sin escribirlo: eso hace el `DEFAULT`.

**C2**
```sql
ALTER TABLE clientes ADD COLUMN ciudad VARCHAR(60) NOT NULL DEFAULT 'León' AFTER email;
ALTER TABLE clientes MODIFY telefono VARCHAR(15) NULL;
CREATE INDEX idx_vehiculos_anio ON vehiculos (anio);

SELECT nombre, ciudad FROM clientes;                                  -- todos en León
SHOW INDEX FROM vehiculos WHERE Key_name = 'idx_vehiculos_anio';
```
> En `MODIFY` hay que repetir **toda** la definición de la columna. Si omites `NULL` o `NOT NULL`, puedes cambiarla sin querer.

**C3**

| # | Error | Por qué |
|---|---|---|
| 1 | `1062 Duplicate entry '1-2026-10-28 11:00:00'` | Rompe el `UNIQUE (vehiculo_id, fecha_hora)`: ese auto ya tiene prueba a esa hora |
| 2 | `1452 Cannot add or update a child row` | Llave foránea: no existe el auto 99 |
| 3 | `1451 Cannot delete or update a parent row` | Llave foránea: Ana tiene ventas que la usan |
| 4 | `4025 CONSTRAINT chk_vehiculos_precio failed` (MySQL: `3819`) | Rompe el `CHECK (precio >= 0)` |
| 5 | `1062 Duplicate entry '3' for key 'uq_ventas_vehiculo'` | El Corolla ya se vendió: un auto, una venta |
| 6 | `1265 Data truncated for column 'estado'` | `pendiente` no está en el `ENUM` |

### Sección D

**D1**
```sql
CREATE OR REPLACE VIEW vista_inventario AS
SELECT id, CONCAT(marca, ' ', modelo, ' ', anio) AS auto, precio, kilometraje
FROM vehiculos
WHERE estado IN ('disponible', 'apartado');

SELECT * FROM vista_inventario ORDER BY precio;
```
```
| 7 | Kia Rio 2020          | 219000.00 | 57000 |
| 1 | Nissan Versa 2021     | 278250.00 | 38000 |
| 2 | Volkswagen Jetta 2019 | 289000.00 | 61000 |
| 5 | Honda CR-V 2022       | 549000.00 | 21000 |
```
El Mazda ya no sale (lo vendiste en B1) y el Versa ya trae el aumento de B2: la vista siempre muestra los datos **actuales**.

**D2**: sin `DELIMITER`, la consola cortaría el procedimiento en el primer `;`.
```sql
DELIMITER //
CREATE PROCEDURE compras_de_cliente(IN p_cliente INT)
BEGIN
  SELECT v.id AS venta, CONCAT(a.marca, ' ', a.modelo) AS auto, v.fecha, v.precio_final
  FROM ventas v
  JOIN vehiculos a ON a.id = v.vehiculo_id
  WHERE v.cliente_id = p_cliente
  ORDER BY v.fecha;
END //
DELIMITER ;

CALL compras_de_cliente(1);
```
```
| 1 | Toyota Corolla | 2026-08-14 | 305000.00 |
| 3 | Ford Ranger    | 2026-09-20 | 450000.00 |
```

**D3**
```sql
DELIMITER //
CREATE FUNCTION saldo_venta(p_venta INT) RETURNS DECIMAL(12,2)
READS SQL DATA
BEGIN
  DECLARE v_total  DECIMAL(12,2);
  DECLARE v_pagado DECIMAL(12,2);
  SELECT precio_final INTO v_total FROM ventas WHERE id = p_venta;
  SELECT COALESCE(SUM(monto), 0) INTO v_pagado FROM pagos WHERE venta_id = p_venta;
  RETURN v_total - v_pagado;
END //
DELIMITER ;

SELECT id, precio_final, saldo_venta(id) AS saldo FROM ventas;
```
```
| 1 | 305000.00 | 100000.00 |
| 2 | 155000.00 |      0.00 |
| 3 | 450000.00 | 100000.00 |
| 4 | 330000.00 | 330000.00 |
```
`COALESCE(..., 0)` es la clave: la venta 4 no tiene pagos, `SUM` da `NULL`, y `330000 - NULL` sería `NULL`.

**D4**
```sql
DELIMITER //
CREATE TRIGGER trg_venta_marca_vendido
AFTER INSERT ON ventas
FOR EACH ROW
BEGIN
  UPDATE vehiculos SET estado = 'vendido' WHERE id = NEW.vehiculo_id;
END //
DELIMITER ;

INSERT INTO ventas (vehiculo_id, cliente_id, fecha, precio_final) VALUES (7, 3, '2026-10-22', 215000.00);
SELECT id, modelo, estado FROM vehiculos WHERE id = 7;
```
```
| 7 | Rio | vendido |
```

**D5**
```sql
DELIMITER //
CREATE TRIGGER trg_pago_no_excede
BEFORE INSERT ON pagos
FOR EACH ROW
BEGIN
  IF NEW.monto > saldo_venta(NEW.venta_id) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El pago es mayor que el saldo de la venta';
  END IF;
END //
DELIMITER ;

INSERT INTO pagos (venta_id, fecha, monto, metodo) VALUES (1, '2026-10-22', 100000.00, 'efectivo');  -- entra
SELECT saldo_venta(1);                                                                              -- 0.00
INSERT INTO pagos (venta_id, fecha, monto, metodo) VALUES (2, '2026-10-22', 1.00, 'efectivo');
```
```
ERROR 1644 (45000): El pago es mayor que el saldo de la venta
```
Tiene que ser `BEFORE`: con `AFTER` el pago ya se habría guardado.

### Sección E (como root)

**E1**
```sql
CREATE USER 'consulta_examen'@'localhost' IDENTIFIED BY 'Una-Contraseña-Larga-1';
GRANT SELECT ON agencia_practica.* TO 'consulta_examen'@'localhost';
GRANT EXECUTE ON PROCEDURE agencia_practica.compras_de_cliente TO 'consulta_examen'@'localhost';
SHOW GRANTS FOR 'consulta_examen'@'localhost';
```
En otra terminal: `mariadb -u consulta_examen -p agencia_practica`

| Prueba | Resultado |
|---|---|
| `SELECT COUNT(*) FROM vehiculos;` | Funciona (8) |
| `UPDATE vehiculos SET precio = precio WHERE id = 1;` | `ERROR 1142 UPDATE command denied` |
| `CALL compras_de_cliente(2);` | Funciona (el Aveo de Carlos) |
| `SELECT * FROM agencia_autos.vehiculos;` | `ERROR 1142 SELECT command denied`: no ve el sitio |

```sql
REVOKE SELECT ON agencia_practica.* FROM 'consulta_examen'@'localhost';   -- ya no puede leer
DROP USER 'consulta_examen'@'localhost';                                  -- ya no puede entrar (1045)
```

**E2** (en la terminal, fuera de la consola de MariaDB)
```bash
mariadb-dump --single-transaction --routines --triggers agencia_practica > /root/practica.sql
mariadb -e "CREATE DATABASE practica_copia CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
mariadb practica_copia < /root/practica.sql
mariadb -e "SELECT COUNT(*) FROM practica_copia.ventas"                                               # 5
mariadb -e "SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_schema = 'practica_copia'"  # 2
mariadb -e "SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = 'practica_copia'"  # 2
mariadb -e "DROP DATABASE practica_copia"
```
Sin `--routines`, la copia no trae el procedimiento ni la función. Los triggers sí vienen por defecto, pero ponerlo no estorba.

---

## 6. Trampas típicas de examen

| Trampa | Cómo evitarla |
|---|---|
| `UPDATE` o `DELETE` sin `WHERE` | Escribe primero el `SELECT` con el mismo `WHERE`, revisa las filas y luego cambia `SELECT ...` por `UPDATE`/`DELETE` |
| `WHERE columna = NULL` | Siempre `IS NULL` / `IS NOT NULL` |
| Filtrar un agregado con `WHERE` | `WHERE COUNT(*) > 1` da error: usa `HAVING` |
| Columnas en el `SELECT` que no están en el `GROUP BY` | Todo lo que no sea agregado debe ir en el `GROUP BY` |
| `JOIN` que "pierde" filas | Si deben salir todos (clientes sin compras), `LEFT JOIN` |
| `COUNT(*)` con `LEFT JOIN` | Cuenta 1 aunque no haya coincidencias: usa `COUNT(columna_de_la_derecha)` |
| `SUM` de nada da `NULL`, no 0 | `COALESCE(SUM(x), 0)` |
| `NOT IN` con una subconsulta que trae `NULL` | No regresa nada; filtra con `WHERE col IS NOT NULL` o usa `NOT EXISTS` |
| Comillas | Texto y fechas con comillas simples `'2026-09-01'`; números sin comillas |
| Procedimientos y triggers | `DELIMITER //` antes y `DELIMITER ;` después |
| Orden de borrado con llaves foráneas | Primero los hijos (`pagos` → `ventas`) y luego los padres (`clientes`, `vehiculos`) |
| `DROP` vs `DELETE` vs `TRUNCATE` | `DELETE` borra filas (con `WHERE`) · `TRUNCATE` vacía y reinicia el contador · `DROP` borra la tabla completa |

---

## 7. Si tu examen es en MySQL (Workbench)

Todo lo de esta guía funciona igual en MySQL 8, con estas diferencias:

| En tu VPS (MariaDB) | En MySQL |
|---|---|
| `mariadb -u diego -p` | `mysql -u diego -p` |
| `mariadb-dump` | `mysqldump` |
| Error `4025` al romper un `CHECK` | Error `3819` |
| Funciones y triggers se crean sin más | Si da `ERROR 1419`, falta permiso: `SET GLOBAL log_bin_trust_function_creators = 1;` (como root) |
| `CREATE OR REPLACE` en vistas, procedimientos y funciones | En vistas sí; en procedimientos y funciones usa `DROP PROCEDURE IF EXISTS ...;` antes del `CREATE` |

**En Workbench:**
- Ejecuta la línea donde está el cursor con **Ctrl + Enter**; todo el script, con **Ctrl + Shift + Enter**.
- Para procedimientos, funciones y triggers usa `DELIMITER` igual que aquí.
- Por defecto Workbench no deja hacer `UPDATE`/`DELETE` sin una llave en el `WHERE` (*safe updates*): es otra razón para poner siempre el `WHERE`.
