-- Evidencia: los procedimientos y triggers RECHAZAN lo incorrecto (se corre con --force)
USE agencia_proyecto;
-- La transacción del procedimiento se deshace completa: el auto 2 ya está vendido
CALL registrar_venta(2, 3, 1, 300000, 50000, 'efectivo', @x);
-- Método de pago inválido: se rechaza antes de tocar nada
CALL registrar_venta(9, 3, 1, 899800, 100000, 'cheque', @x);
-- Falla A LA MITAD: la venta ya se insertó, pero el enganche es mayor que el
-- precio y el trigger de pagos lo rechaza. El manejador hace ROLLBACK de todo.
CALL registrar_venta(9, 3, 1, 899800, 999999, 'efectivo', @x);
SELECT COUNT(*) AS ventas_del_shark_debe_ser_0 FROM ventas WHERE vehiculo_id = 9;
SELECT estado AS shark_sigue_disponible FROM vehiculos WHERE id = 9;
-- Descuento fuera de rango
SET @p = 100000; CALL aplicar_descuento(@p, 50);
-- Pago mayor al saldo (trigger BEFORE INSERT)
INSERT INTO pagos (venta_id, fecha, monto, metodo) VALUES (3, CURDATE(), 1, 'efectivo');
-- Cambiar el precio de un auto vendido (trigger BEFORE UPDATE)
UPDATE vehiculos SET precio = 1 WHERE id = 2;
-- Cancelar una venta: el trigger AFTER DELETE regresa el auto a disponible
DELETE FROM ventas WHERE id = 6;
SELECT id, modelo, estado AS estado_tras_cancelar FROM vehiculos WHERE id = 10;
SELECT accion, detalle FROM bitacora ORDER BY id DESC LIMIT 2;
-- Procedimientos CRUD: validaciones
CALL alta_cliente('Al', NULL, NULL, @x);                       -- nombre muy corto
CALL alta_cliente('Otra Ana', NULL, 'ana@ejemplo.com', @x);    -- correo repetido
CALL alta_cliente('Sin Arroba', NULL, 'correo-malo', @x);      -- correo inválido
CALL actualizar_precio(2, 1000);                               -- auto vendido (lo frena el trigger)
CALL cambiar_estado_vehiculo(2, 'disponible');                 -- vendido: solo cancelando la venta
CALL registrar_pago(999, 10, 'efectivo', @x);                  -- venta inexistente
CALL baja_cliente(1);                                          -- tiene compras: se conserva el historial
CALL estado_cuenta(999);                                       -- cliente inexistente
-- Cancelar una venta: transacción que borra pagos y venta, y el auto vuelve a estar disponible
CALL cancelar_venta(4);
SELECT COUNT(*) AS pagos_de_la_venta_4 FROM pagos WHERE venta_id = 4;
SELECT id, modelo, estado AS estado_tras_cancelar FROM vehiculos WHERE id = 8;
