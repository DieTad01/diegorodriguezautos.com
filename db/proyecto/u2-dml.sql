-- =============================================================
-- UNIDAD 2. Lenguaje de Manipulación de Datos (DML)
-- Cubre: 2.1 INSERT/DELETE/UPDATE · 2.2 SELECT · 2.3 funciones, GROUP BY,
--        ORDER BY · 2.4 JOIN · 2.5 subconsultas · 2.6 SET (variables y
--        operadores de conjuntos) · 2.7 vistas
-- =============================================================
USE agencia_proyecto;
SET lc_time_names = 'es_MX';   -- nombres de meses y días en español

-- ---------- 2.1.a INSERT: poblar la base ----------
INSERT INTO asesores (nombre, correo, comision) VALUES
  ('Diego Rodríguez', 'diego@agencia.mx', 2.00),
  ('Laura Méndez',    'laura@agencia.mx', 1.50),
  ('Jorge Salas',     'jorge@agencia.mx', 1.50),
  ('Paola Núñez',     'paola@agencia.mx', 1.00);   -- recién llegada: aún sin ventas

INSERT INTO vehiculos (marca, modelo, anio, version, precio, kilometraje, color, transmision, estado) VALUES
  ('Chevrolet', 'Aveo',          2024, 'LT',        279900.00,     0, 'Rojo',   'manual',     'disponible'),
  ('Chevrolet', 'Onix',          2024, 'Premier',   325000.00, 12000, 'Blanco', 'automatica', 'disponible'),
  ('Chevrolet', 'Tracker',       2025, 'RS',        459900.00,     0, 'Negro',  'automatica', 'disponible'),
  ('Chevrolet', 'Captiva',       2023, 'Premier',   489000.00, 25000, 'Gris',   'automatica', 'disponible'),
  ('Chevrolet', 'S10 Max',       2024, 'High Country', 699900.00, 8000, 'Plata', 'automatica', 'disponible'),
  ('BYD',       'Dolphin Mini',  2025, 'Plus',      358800.00,     0, 'Azul',   'automatica', 'disponible'),
  ('BYD',       'Seal',          2025, 'AWD',       849800.00,     0, 'Blanco', 'automatica', 'disponible'),
  ('BYD',       'Song Plus',     2024, 'DM-i',      669800.00,  5000, 'Gris',   'automatica', 'disponible'),
  ('BYD',       'Shark',         2025, 'GL',        899800.00,     0, 'Negro',  'automatica', 'disponible'),
  ('BYD',       'King',          2025, 'GS',        449800.00,     0, 'Plata',  'automatica', 'disponible'),
  ('Chevrolet', 'Groove',        2023, 'LT',        289000.00, 30000, 'Rojo',   'manual',     'disponible'),
  ('Chevrolet', 'Beat',          2021, 'LT',        169000.00, 61000, 'Blanco', 'manual',     'disponible');

INSERT INTO clientes (nombre, telefono, email) VALUES
  ('Ana López García',   '4771234567', 'ana@ejemplo.com'),
  ('Carlos Ruiz',        '4779876543', 'carlos@ejemplo.com'),
  ('María Fernández',    '4775551234', NULL),
  ('Roberto Hernández',  '4773334455', 'roberto@ejemplo.com'),
  ('Sofía Torres',       '4772223344', 'sofia@ejemplo.com'),
  ('Miguel Ángel Pérez', '4776667788', 'miguel@ejemplo.com');

INSERT INTO ventas (vehiculo_id, cliente_id, asesor_id, fecha, precio_final) VALUES
  (2,  1, 1, '2026-08-14', 318000.00),
  (6,  1, 1, '2026-10-02', 358800.00),
  (12, 2, 2, '2026-09-02', 165000.00),
  (8,  4, 1, '2026-09-20', 655000.00),
  (4,  5, 3, '2026-10-11', 480000.00),
  (10, 6, 2, '2026-11-03', 449800.00);

INSERT INTO pagos (venta_id, fecha, monto, metodo) VALUES
  (1, '2026-08-14', 118000, 'transferencia'), (1, '2026-09-14', 100000, 'transferencia'), (1, '2026-10-14', 100000, 'efectivo'),
  (2, '2026-10-02', 158800, 'financiamiento'),
  (3, '2026-09-02', 165000, 'tarjeta'),
  (4, '2026-09-20', 300000, 'transferencia'), (4, '2026-10-20', 200000, 'financiamiento'),
  (5, '2026-10-11', 480000, 'financiamiento'),
  (6, '2026-11-03', 100000, 'efectivo');

-- INSERT ... SELECT: copiar datos de una consulta a otra tabla
CREATE TABLE vehiculos_respaldo LIKE vehiculos;
INSERT INTO vehiculos_respaldo SELECT * FROM vehiculos WHERE marca = 'BYD';
SELECT COUNT(*) AS respaldados FROM vehiculos_respaldo;

-- ---------- 2.1.c UPDATE ----------
UPDATE vehiculos SET estado = 'vendido' WHERE id IN (SELECT vehiculo_id FROM ventas);
UPDATE vehiculos SET estado = 'apartado' WHERE id = 3;
UPDATE vehiculos SET precio = ROUND(precio * 0.95, 2) WHERE estado = 'disponible' AND anio <= 2023;  -- 5% de descuento
SELECT ROW_COUNT() AS autos_con_descuento;

-- ---------- 2.1.b DELETE ----------
DELETE FROM vehiculos_respaldo WHERE anio < 2025;
SELECT ROW_COUNT() AS borrados;
DROP TABLE vehiculos_respaldo;

-- ---------- 2.2 SELECT ----------
SELECT id, marca, modelo, anio, precio, estado FROM vehiculos;
SELECT marca, modelo, precio FROM vehiculos WHERE estado = 'disponible' AND precio BETWEEN 250000 AND 500000;
SELECT marca, modelo FROM vehiculos WHERE modelo LIKE 'S%' OR version IN ('RS', 'GS');
SELECT nombre FROM clientes WHERE email IS NULL;
SELECT DISTINCT marca FROM vehiculos;

-- ---------- 2.3.b ORDER BY / LIMIT ----------
SELECT marca, modelo, precio FROM vehiculos ORDER BY precio DESC LIMIT 3;
SELECT marca, modelo, anio, precio FROM vehiculos ORDER BY marca ASC, anio DESC;

-- ---------- 2.3.a / 2.3.c GROUP BY y funciones de agregación ----------
SELECT marca,
       COUNT(*)              AS autos,
       ROUND(AVG(precio), 2) AS promedio,
       MIN(precio)           AS mas_barato,
       MAX(precio)           AS mas_caro,
       SUM(precio)           AS valor_total
FROM vehiculos
GROUP BY marca;

SELECT estado, COUNT(*) AS autos, GROUP_CONCAT(modelo ORDER BY modelo SEPARATOR ', ') AS modelos
FROM vehiculos GROUP BY estado;

SELECT transmision, COUNT(*) AS autos FROM vehiculos GROUP BY transmision HAVING COUNT(*) > 2;

-- ---------- 2.3.d Funciones de cadena ----------
SELECT UPPER(marca) AS marca, LOWER(modelo) AS modelo,
       CONCAT(marca, ' ', modelo, ' ', anio) AS nombre_completo,
       CONCAT_WS(' / ', marca, modelo, version) AS con_separador,
       CHAR_LENGTH(modelo) AS letras,
       SUBSTRING(marca, 1, 3) AS clave,
       REPLACE(modelo, ' ', '-') AS para_url,
       LPAD(id, 5, '0') AS folio
FROM vehiculos LIMIT 5;
SELECT nombre, SUBSTRING_INDEX(nombre, ' ', 1) AS primer_nombre, COALESCE(email, 'sin correo') AS correo FROM clientes;

-- ---------- 2.3.e Funciones de fecha ----------
SELECT CURDATE() AS hoy, NOW() AS ahora;
SELECT id AS venta, fecha,
       DATE_FORMAT(fecha, '%d/%m/%Y') AS fecha_mx,
       MONTHNAME(fecha) AS mes,
       DAYNAME(fecha) AS dia,
       YEAR(fecha) AS anio,
       DATEDIFF('2026-12-31', fecha) AS dias_al_fin_de_anio,
       DATE_ADD(fecha, INTERVAL 1 YEAR) AS fin_de_garantia
FROM ventas;
SELECT MONTHNAME(fecha) AS mes, COUNT(*) AS ventas, SUM(precio_final) AS vendido
FROM ventas GROUP BY YEAR(fecha), MONTH(fecha), MONTHNAME(fecha) ORDER BY YEAR(fecha), MONTH(fecha);

-- Conversión de tipos
SELECT CAST('2026-11-25' AS DATE) AS fecha, CAST(precio AS UNSIGNED) AS precio_entero,
       CONVERT(anio, CHAR) AS anio_texto, FORMAT(precio, 2) AS precio_formato
FROM vehiculos LIMIT 3;

-- ---------- 2.4 JOIN ----------
-- INNER JOIN de 4 tablas
SELECT v.id AS venta, c.nombre AS cliente, CONCAT(a.marca, ' ', a.modelo) AS auto,
       s.nombre AS asesor, v.fecha, v.precio_final
FROM ventas v
INNER JOIN clientes  c ON c.id = v.cliente_id
INNER JOIN vehiculos a ON a.id = v.vehiculo_id
INNER JOIN asesores  s ON s.id = v.asesor_id
ORDER BY v.fecha;

-- LEFT JOIN: todos los clientes, compren o no
SELECT c.nombre, COUNT(v.id) AS compras, COALESCE(SUM(v.precio_final), 0) AS total
FROM clientes c LEFT JOIN ventas v ON v.cliente_id = c.id
GROUP BY c.id, c.nombre ORDER BY total DESC;

-- RIGHT JOIN: todos los asesores, aunque no hayan vendido
SELECT s.nombre AS asesor, COUNT(v.id) AS ventas, COALESCE(SUM(v.precio_final), 0) AS vendido,
       ROUND(COALESCE(SUM(v.precio_final), 0) * s.comision / 100, 2) AS comision
FROM ventas v RIGHT JOIN asesores s ON s.id = v.asesor_id
GROUP BY s.id, s.nombre, s.comision;

-- Saldo por venta (JOIN + agregados)
SELECT v.id AS venta, c.nombre, v.precio_final, COALESCE(SUM(p.monto), 0) AS pagado,
       v.precio_final - COALESCE(SUM(p.monto), 0) AS saldo
FROM ventas v
JOIN clientes c ON c.id = v.cliente_id
LEFT JOIN pagos p ON p.venta_id = v.id
GROUP BY v.id, c.nombre, v.precio_final;

-- CROSS JOIN (producto cartesiano) y SELF JOIN
SELECT s.nombre AS asesor, m.marca FROM asesores s CROSS JOIN (SELECT DISTINCT marca FROM vehiculos) m ORDER BY 1, 2;
SELECT a.modelo AS auto, b.modelo AS mas_caro_de_la_misma_marca, b.precio
FROM vehiculos a JOIN vehiculos b ON b.marca = a.marca AND b.precio > a.precio
WHERE a.modelo = 'Aveo';

-- ---------- 2.5 Subconsultas ----------
SELECT marca, modelo, precio FROM vehiculos WHERE precio > (SELECT AVG(precio) FROM vehiculos);          -- escalar
SELECT nombre FROM clientes WHERE id IN (SELECT cliente_id FROM ventas WHERE precio_final > 400000);     -- IN
SELECT nombre FROM clientes c WHERE NOT EXISTS (SELECT 1 FROM ventas v WHERE v.cliente_id = c.id);      -- NOT EXISTS
SELECT marca, modelo, precio FROM vehiculos a
WHERE precio = (SELECT MAX(precio) FROM vehiculos b WHERE b.marca = a.marca);                          -- correlacionada
SELECT marca, ROUND(AVG(total), 2) AS venta_promedio
FROM (SELECT a.marca, v.precio_final AS total FROM ventas v JOIN vehiculos a ON a.id = v.vehiculo_id) AS t
GROUP BY marca;                                                                                         -- tabla derivada

-- ---------- 2.6 SET: variables ----------
SET @iva = 0.16;
SET @auto = 7;
SELECT modelo, precio, ROUND(precio / (1 + @iva), 2) AS precio_sin_iva, ROUND(precio - precio / (1 + @iva), 2) AS iva
FROM vehiculos WHERE id = @auto;
SELECT COUNT(*), SUM(precio_final) INTO @num_ventas, @total_vendido FROM ventas;   -- guardar resultados en variables
SELECT @num_ventas AS ventas, @total_vendido AS total, ROUND(@total_vendido / @num_ventas, 2) AS ticket_promedio;
-- (las variables locales con DECLARE están en la unidad 5, dentro de procedimientos)

-- ---------- 2.6 Operadores de conjuntos ----------
SELECT nombre, 'cliente' AS tipo FROM clientes
UNION
SELECT nombre, 'asesor' FROM asesores
ORDER BY tipo, nombre;
SELECT marca FROM vehiculos WHERE estado = 'vendido'
UNION ALL
SELECT marca FROM vehiculos WHERE estado = 'apartado';
SELECT modelo FROM vehiculos WHERE marca = 'BYD'
INTERSECT
SELECT a.modelo FROM vehiculos a JOIN ventas v ON v.vehiculo_id = a.id;   -- BYD que se vendieron
SELECT modelo FROM vehiculos WHERE marca = 'BYD'
EXCEPT
SELECT a.modelo FROM vehiculos a JOIN ventas v ON v.vehiculo_id = a.id;   -- BYD sin vender

-- ---------- 2.7 Vistas ----------
CREATE VIEW vista_inventario AS
SELECT id, CONCAT(marca, ' ', modelo, ' ', anio) AS auto, precio, estado
FROM vehiculos WHERE estado <> 'vendido';
SELECT * FROM vista_inventario ORDER BY precio;

CREATE OR REPLACE VIEW vista_inventario AS                       -- modificar (opción 1)
SELECT id, CONCAT(marca, ' ', modelo, ' ', anio) AS auto, precio, kilometraje, estado
FROM vehiculos WHERE estado <> 'vendido';
ALTER VIEW vista_inventario AS                                  -- modificar (opción 2)
SELECT id, CONCAT(marca, ' ', modelo, ' ', anio) AS auto, precio, kilometraje, transmision, estado
FROM vehiculos WHERE estado <> 'vendido';

CREATE VIEW vista_saldos AS
SELECT v.id AS venta, v.cliente_id, c.nombre AS cliente, CONCAT(a.marca, ' ', a.modelo) AS auto,
       v.precio_final, COALESCE(SUM(p.monto), 0) AS pagado,
       v.precio_final - COALESCE(SUM(p.monto), 0) AS saldo
FROM ventas v
JOIN clientes c  ON c.id = v.cliente_id
JOIN vehiculos a ON a.id = v.vehiculo_id
LEFT JOIN pagos p ON p.venta_id = v.id
GROUP BY v.id, v.cliente_id, c.nombre, a.marca, a.modelo, v.precio_final;
SELECT * FROM vista_saldos WHERE saldo > 0;

-- Vista actualizable con WITH CHECK OPTION: no deja salir filas del filtro
CREATE VIEW vista_disponibles AS
SELECT id, marca, modelo, precio, estado FROM vehiculos WHERE estado = 'disponible'
WITH CHECK OPTION;
UPDATE vista_disponibles SET precio = precio - 1000 WHERE id = 1;   -- permitido

CREATE VIEW vista_temporal AS SELECT 1 AS uno;
DROP VIEW vista_temporal;                                         -- borrar una vista

-- 2.7.1 Descripción de objetos de la base
SHOW FULL TABLES WHERE Table_type = 'VIEW';
SHOW CREATE VIEW vista_saldos\G
SELECT table_name, table_type, table_rows FROM information_schema.tables
WHERE table_schema = 'agencia_proyecto' ORDER BY table_type, table_name;
