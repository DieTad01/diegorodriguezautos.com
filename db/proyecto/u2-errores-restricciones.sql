-- =============================================================
-- Evidencia de las RESTRICCIONES (unidad 1.2.b) en acción.
-- Cada instrucción DEBE fallar: se ejecuta con --force para ver todos
-- los errores seguidos. Ninguna cambia datos.
-- =============================================================
USE agencia_proyecto;
-- PRIMARY KEY duplicada
INSERT INTO clientes (id, nombre) VALUES (1, 'Duplicado');
-- UNIQUE: correo repetido
INSERT INTO clientes (nombre, email) VALUES ('Otra Ana', 'ana@ejemplo.com');
-- UNIQUE: el mismo auto vendido dos veces
INSERT INTO ventas (vehiculo_id, cliente_id, fecha, precio_final) VALUES (2, 3, '2026-11-20', 300000);
-- FOREIGN KEY: cliente que no existe
INSERT INTO ventas (vehiculo_id, cliente_id, fecha, precio_final) VALUES (1, 999, '2026-11-20', 300000);
-- FOREIGN KEY: borrar un cliente que tiene ventas
DELETE FROM clientes WHERE id = 1;
-- CHECK: precio negativo, año fuera de rango, comisión mayor a 10
UPDATE vehiculos SET precio = -1 WHERE id = 1;
INSERT INTO vehiculos (marca, modelo, anio, precio) VALUES ('Ford', 'T', 1908, 1000);
UPDATE asesores SET comision = 50 WHERE id = 1;
-- NOT NULL
INSERT INTO vehiculos (marca, modelo, anio, precio) VALUES (NULL, 'X', 2024, 1000);
-- ENUM: valor no permitido
INSERT INTO pagos (venta_id, fecha, monto, metodo) VALUES (1, '2026-11-20', 10, 'cheque');
-- WITH CHECK OPTION: la vista no deja mover un auto fuera de su filtro
UPDATE vista_disponibles SET estado = 'vendido' WHERE id = 1;
SELECT 'Fin: todas las instrucciones de arriba debieron fallar' AS resultado;
