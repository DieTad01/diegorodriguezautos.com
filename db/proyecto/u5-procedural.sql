-- =============================================================
-- UNIDAD 5. SQL procedural
-- Cubre: 5.1 procedimientos almacenados (crear, modificar, permisos,
--        transacción dentro del procedimiento) · 5.2 funciones ·
--        5.3 triggers (NEW/OLD, integridad de un campo, actualizar
--        tablas relacionadas, bitácora, DROP TRIGGER)
-- Requiere u3-acceso.sql (otorga EXECUTE a los usuarios del proyecto).
-- =============================================================
USE agencia_proyecto;
SET lc_time_names = 'es_MX';

DELIMITER //

-- ---------- 5.2 Funciones ----------
CREATE OR REPLACE FUNCTION saldo_venta(p_venta INT) RETURNS DECIMAL(12,2)
READS SQL DATA
COMMENT 'Lo que falta por pagar de una venta'
BEGIN
  DECLARE v_total  DECIMAL(12,2);
  DECLARE v_pagado DECIMAL(12,2);
  SELECT precio_final INTO v_total FROM ventas WHERE id = p_venta;
  SELECT COALESCE(SUM(monto), 0) INTO v_pagado FROM pagos WHERE venta_id = p_venta;
  RETURN v_total - v_pagado;
END //

CREATE OR REPLACE FUNCTION precio_sin_iva(p_precio DECIMAL(12,2)) RETURNS DECIMAL(12,2)
DETERMINISTIC
COMMENT 'Los precios incluyen IVA del 16%'
BEGIN
  RETURN ROUND(p_precio / 1.16, 2);
END //

CREATE OR REPLACE FUNCTION categoria_auto(p_precio DECIMAL(12,2)) RETURNS VARCHAR(20)
DETERMINISTIC
BEGIN
  RETURN CASE
    WHEN p_precio < 300000 THEN 'Económico'
    WHEN p_precio < 600000 THEN 'Intermedio'
    ELSE 'Premium'
  END;
END //

-- ---------- 5.1 Procedimientos ----------
-- Consulta con parámetros de entrada
CREATE OR REPLACE PROCEDURE ventas_del_mes(IN p_anio INT, IN p_mes INT)
COMMENT 'Ventas de un mes con su saldo'
BEGIN
  SELECT v.id AS venta, v.fecha, c.nombre AS cliente, CONCAT(a.marca, ' ', a.modelo) AS auto,
         v.precio_final, saldo_venta(v.id) AS saldo
  FROM ventas v
  JOIN clientes c  ON c.id = v.cliente_id
  JOIN vehiculos a ON a.id = v.vehiculo_id
  WHERE YEAR(v.fecha) = p_anio AND MONTH(v.fecha) = p_mes
  ORDER BY v.fecha;
END //

-- Parámetro INOUT y variables locales
CREATE OR REPLACE PROCEDURE aplicar_descuento(INOUT p_precio DECIMAL(12,2), IN p_porcentaje DECIMAL(5,2))
BEGIN
  DECLARE v_descuento DECIMAL(12,2) DEFAULT 0;
  IF p_porcentaje < 0 OR p_porcentaje > 20 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El descuento debe estar entre 0 y 20%';
  END IF;
  SET v_descuento = ROUND(p_precio * p_porcentaje / 100, 2);
  SET p_precio = p_precio - v_descuento;
END //

-- Procedimiento con TRANSACCIÓN: registra una venta y su enganche.
-- Si algo falla, deshace todo (ROLLBACK) y avisa el error.
CREATE OR REPLACE PROCEDURE registrar_venta(
  IN  p_vehiculo  INT,
  IN  p_cliente   INT,
  IN  p_asesor    INT,
  IN  p_precio    DECIMAL(12,2),
  IN  p_enganche  DECIMAL(12,2),
  IN  p_metodo    VARCHAR(20),
  OUT p_venta     INT)
MODIFIES SQL DATA
COMMENT 'Venta + enganche en una sola transacción'
BEGIN
  DECLARE v_estado VARCHAR(20);
  -- SQLWARNING también: en modo estricto, un dato inválido (ej. un ENUM)
  -- llega como SQLSTATE 01000, que NO es SQLEXCEPTION
  DECLARE EXIT HANDLER FOR SQLEXCEPTION, SQLWARNING
  BEGIN
    ROLLBACK;
    RESIGNAL;            -- regresa el error original a quien llamó
  END;

  IF p_enganche > 0 AND p_metodo NOT IN ('efectivo', 'transferencia', 'tarjeta', 'financiamiento') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Método de pago no válido';
  END IF;

  START TRANSACTION;
    SELECT estado INTO v_estado FROM vehiculos WHERE id = p_vehiculo FOR UPDATE;   -- bloquea el auto
    IF v_estado IS NULL THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Ese vehículo no existe';
    ELSEIF v_estado = 'vendido' THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Ese vehículo ya está vendido';
    END IF;
    INSERT INTO ventas (vehiculo_id, cliente_id, asesor_id, fecha, precio_final)
    VALUES (p_vehiculo, p_cliente, p_asesor, CURDATE(), p_precio);
    SET p_venta = LAST_INSERT_ID();
    IF p_enganche > 0 THEN
      INSERT INTO pagos (venta_id, fecha, monto, metodo) VALUES (p_venta, CURDATE(), p_enganche, p_metodo);
    END IF;
  COMMIT;
END //

-- CURSOR + ciclo: comisión de cada asesor
CREATE OR REPLACE PROCEDURE calcular_comisiones()
COMMENT 'Recorre los asesores con un cursor'
BEGIN
  DECLARE v_fin      BOOLEAN DEFAULT FALSE;
  DECLARE v_id       INT;
  DECLARE v_nombre   VARCHAR(100);
  DECLARE v_comision DECIMAL(4,2);
  DECLARE v_vendido  DECIMAL(14,2);
  DECLARE cur CURSOR FOR SELECT id, nombre, comision FROM asesores ORDER BY id;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_fin = TRUE;

  CREATE OR REPLACE TEMPORARY TABLE tmp_comisiones (
    asesor VARCHAR(100), vendido DECIMAL(14,2), porcentaje DECIMAL(4,2), comision DECIMAL(12,2), nivel VARCHAR(10));

  OPEN cur;
  ciclo: LOOP
    FETCH cur INTO v_id, v_nombre, v_comision;
    IF v_fin THEN LEAVE ciclo; END IF;
    SELECT COALESCE(SUM(precio_final), 0) INTO v_vendido FROM ventas WHERE asesor_id = v_id;
    INSERT INTO tmp_comisiones VALUES (v_nombre, v_vendido, v_comision, ROUND(v_vendido * v_comision / 100, 2),
      CASE WHEN v_vendido >= 1000000 THEN 'Oro' WHEN v_vendido > 0 THEN 'Plata' ELSE 'Sin ventas' END);
  END LOOP;
  CLOSE cur;

  SELECT * FROM tmp_comisiones ORDER BY comision DESC;
END //

-- Ciclo WHILE: proyección de un crédito a N meses
CREATE OR REPLACE PROCEDURE tabla_de_pagos(IN p_venta INT, IN p_meses INT)
BEGIN
  DECLARE v_mes INT DEFAULT 1;
  DECLARE v_saldo DECIMAL(12,2);
  DECLARE v_pago DECIMAL(12,2);
  SET v_saldo = saldo_venta(p_venta);
  SET v_pago = ROUND(v_saldo / p_meses, 2);
  CREATE OR REPLACE TEMPORARY TABLE tmp_plan (mes INT, fecha DATE, pago DECIMAL(12,2), saldo_restante DECIMAL(12,2));
  WHILE v_mes <= p_meses DO
    SET v_saldo = GREATEST(v_saldo - v_pago, 0);
    INSERT INTO tmp_plan VALUES (v_mes, DATE_ADD(CURDATE(), INTERVAL v_mes MONTH), v_pago, v_saldo);
    SET v_mes = v_mes + 1;
  END WHILE;
  SELECT * FROM tmp_plan;
END //

-- ---------- 5.1 Procedimientos CRUD (los usa el sistema en Java) ----------
-- Toda la operación de la agencia pasa por estos procedimientos: la
-- aplicación (usuario p_sistema) solo tiene permiso EXECUTE, nunca toca
-- las tablas directamente. Cada uno valida sus datos y avisa con SIGNAL.

-- CONSULTA: autos disponibles, con filtros opcionales (NULL = cualquiera)
CREATE OR REPLACE PROCEDURE buscar_vehiculos(IN p_marca VARCHAR(50), IN p_precio_max DECIMAL(12,2))
READS SQL DATA
COMMENT 'CONSULTA: inventario disponible o apartado'
BEGIN
  SELECT id, marca, modelo, anio, version, precio, kilometraje, estado, categoria_auto(precio) AS categoria
  FROM vehiculos
  WHERE estado <> 'vendido'
    AND (p_marca IS NULL OR marca = p_marca)
    AND (p_precio_max IS NULL OR precio <= p_precio_max)
  ORDER BY precio;
END //

-- CONSULTA: clientes con su número de compras y saldo
CREATE OR REPLACE PROCEDURE listar_clientes()
READS SQL DATA
COMMENT 'CONSULTA: clientes con compras y saldo'
BEGIN
  SELECT c.id, c.nombre, c.telefono, c.email,
         COUNT(v.id) AS compras,
         COALESCE(SUM(saldo_venta(v.id)), 0) AS saldo
  FROM clientes c LEFT JOIN ventas v ON v.cliente_id = c.id
  GROUP BY c.id, c.nombre, c.telefono, c.email
  ORDER BY c.nombre;
END //

-- CONSULTA: estado de cuenta de un cliente (2 resultados: compras y pagos)
CREATE OR REPLACE PROCEDURE estado_cuenta(IN p_cliente INT)
READS SQL DATA
COMMENT 'CONSULTA: compras y pagos de un cliente'
BEGIN
  IF NOT EXISTS (SELECT 1 FROM clientes WHERE id = p_cliente) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Ese cliente no existe';
  END IF;
  SELECT v.id AS venta, CONCAT(a.marca, ' ', a.modelo, ' ', a.anio) AS auto, v.fecha,
         v.precio_final, v.precio_final - saldo_venta(v.id) AS pagado, saldo_venta(v.id) AS saldo
  FROM ventas v JOIN vehiculos a ON a.id = v.vehiculo_id
  WHERE v.cliente_id = p_cliente ORDER BY v.fecha;
  SELECT p.id AS pago, p.venta_id AS venta, p.fecha, p.monto, p.metodo
  FROM pagos p JOIN ventas v ON v.id = p.venta_id
  WHERE v.cliente_id = p_cliente ORDER BY p.fecha, p.id;
END //

-- INSERCIÓN: alta de un cliente
CREATE OR REPLACE PROCEDURE alta_cliente(IN p_nombre VARCHAR(100), IN p_telefono VARCHAR(15), IN p_email VARCHAR(120), OUT p_id INT)
MODIFIES SQL DATA
COMMENT 'INSERCIÓN: registra un cliente nuevo'
BEGIN
  SET p_nombre = TRIM(p_nombre), p_email = NULLIF(LOWER(TRIM(p_email)), '');
  IF p_nombre IS NULL OR CHAR_LENGTH(p_nombre) < 3 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El nombre debe tener al menos 3 letras';
  END IF;
  IF p_email IS NOT NULL AND p_email NOT LIKE '%_@_%._%' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El correo no es válido';
  END IF;
  IF p_email IS NOT NULL AND EXISTS (SELECT 1 FROM clientes WHERE email = p_email) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Ya hay un cliente con ese correo';
  END IF;
  INSERT INTO clientes (nombre, telefono, email) VALUES (p_nombre, NULLIF(TRIM(p_telefono), ''), p_email);
  SET p_id = LAST_INSERT_ID();
END //

-- INSERCIÓN: registrar un pago (el trigger trg_pagos_valida impide pagar de más)
CREATE OR REPLACE PROCEDURE registrar_pago(IN p_venta INT, IN p_monto DECIMAL(12,2), IN p_metodo VARCHAR(20), OUT p_saldo DECIMAL(12,2))
MODIFIES SQL DATA
COMMENT 'INSERCIÓN: registra un pago y regresa el saldo'
BEGIN
  IF NOT EXISTS (SELECT 1 FROM ventas WHERE id = p_venta) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Esa venta no existe';
  END IF;
  IF p_metodo NOT IN ('efectivo', 'transferencia', 'tarjeta', 'financiamiento') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Método de pago no válido';
  END IF;
  INSERT INTO pagos (venta_id, fecha, monto, metodo) VALUES (p_venta, CURDATE(), p_monto, p_metodo);
  SET p_saldo = saldo_venta(p_venta);
END //

-- ACTUALIZACIÓN: datos de contacto de un cliente (NULL = dejar igual)
CREATE OR REPLACE PROCEDURE actualizar_cliente(IN p_id INT, IN p_telefono VARCHAR(15), IN p_email VARCHAR(120))
MODIFIES SQL DATA
COMMENT 'ACTUALIZACIÓN: teléfono y correo de un cliente'
BEGIN
  SET p_email = NULLIF(LOWER(TRIM(p_email)), '');
  IF NOT EXISTS (SELECT 1 FROM clientes WHERE id = p_id) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Ese cliente no existe';
  END IF;
  IF p_email IS NOT NULL AND EXISTS (SELECT 1 FROM clientes WHERE email = p_email AND id <> p_id) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Ese correo ya lo tiene otro cliente';
  END IF;
  UPDATE clientes
  SET telefono = COALESCE(NULLIF(TRIM(p_telefono), ''), telefono),
      email    = COALESCE(p_email, email)
  WHERE id = p_id;
END //

-- ACTUALIZACIÓN: precio de un auto (el trigger lo anota en la bitácora y
-- no permite cambiar el de un auto vendido)
CREATE OR REPLACE PROCEDURE actualizar_precio(IN p_vehiculo INT, IN p_precio DECIMAL(12,2))
MODIFIES SQL DATA
COMMENT 'ACTUALIZACIÓN: precio de un vehículo'
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vehiculos WHERE id = p_vehiculo) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Ese vehículo no existe';
  END IF;
  IF p_precio IS NULL OR p_precio <= 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El precio debe ser mayor a cero';
  END IF;
  UPDATE vehiculos SET precio = p_precio WHERE id = p_vehiculo;
END //

-- ACTUALIZACIÓN: apartar o liberar un auto (vendido solo con registrar_venta)
CREATE OR REPLACE PROCEDURE cambiar_estado_vehiculo(IN p_vehiculo INT, IN p_estado VARCHAR(20))
MODIFIES SQL DATA
COMMENT 'ACTUALIZACIÓN: disponible <-> apartado'
BEGIN
  DECLARE v_actual VARCHAR(20);
  SELECT estado INTO v_actual FROM vehiculos WHERE id = p_vehiculo;
  IF v_actual IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Ese vehículo no existe';
  ELSEIF v_actual = 'vendido' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Un auto vendido solo cambia cancelando su venta';
  ELSEIF p_estado NOT IN ('disponible', 'apartado') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Estado no válido: usa disponible o apartado';
  END IF;
  UPDATE vehiculos SET estado = p_estado WHERE id = p_vehiculo;
END //

-- ELIMINACIÓN: cancelar una venta en UNA transacción (borra sus pagos y la
-- venta; el trigger trg_ventas_cancela regresa el auto a disponible)
CREATE OR REPLACE PROCEDURE cancelar_venta(IN p_venta INT)
MODIFIES SQL DATA
COMMENT 'ELIMINACIÓN: cancela una venta y sus pagos'
BEGIN
  DECLARE EXIT HANDLER FOR SQLEXCEPTION, SQLWARNING
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;
  IF NOT EXISTS (SELECT 1 FROM ventas WHERE id = p_venta) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Esa venta no existe';
  END IF;
  START TRANSACTION;
    DELETE FROM pagos  WHERE venta_id = p_venta;
    DELETE FROM ventas WHERE id = p_venta;
  COMMIT;
END //

-- ELIMINACIÓN: baja de un cliente (solo si no tiene compras: se conserva el historial)
CREATE OR REPLACE PROCEDURE baja_cliente(IN p_id INT)
MODIFIES SQL DATA
COMMENT 'ELIMINACIÓN: borra un cliente sin compras'
BEGIN
  IF NOT EXISTS (SELECT 1 FROM clientes WHERE id = p_id) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Ese cliente no existe';
  END IF;
  IF EXISTS (SELECT 1 FROM ventas WHERE cliente_id = p_id) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El cliente tiene compras: no se puede borrar';
  END IF;
  DELETE FROM clientes WHERE id = p_id;
END //

-- ---------- 5.3 Triggers ----------
-- Integridad de un campo: un pago nunca puede ser mayor que el saldo
CREATE OR REPLACE TRIGGER trg_pagos_valida
BEFORE INSERT ON pagos
FOR EACH ROW
BEGIN
  IF NEW.monto > saldo_venta(NEW.venta_id) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El pago es mayor que el saldo de la venta';
  END IF;
END //

-- Integridad: limpiar y validar datos antes de guardarlos (NEW se puede modificar en BEFORE)
CREATE OR REPLACE TRIGGER trg_vehiculos_limpia
BEFORE UPDATE ON vehiculos
FOR EACH ROW
BEGIN
  SET NEW.marca = TRIM(NEW.marca), NEW.modelo = TRIM(NEW.modelo);
  IF OLD.estado = 'vendido' AND NEW.precio <> OLD.precio THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No se cambia el precio de un auto vendido';
  END IF;
END //

-- Actualizar tablas relacionadas: al vender, el auto pasa a "vendido"
CREATE OR REPLACE TRIGGER trg_ventas_marca_vendido
AFTER INSERT ON ventas
FOR EACH ROW
BEGIN
  UPDATE vehiculos SET estado = 'vendido' WHERE id = NEW.vehiculo_id;
  INSERT INTO bitacora (tabla, accion, detalle, usuario)
  VALUES ('ventas', 'INSERT', CONCAT('Venta ', NEW.id, ': vehículo ', NEW.vehiculo_id, ' a cliente ', NEW.cliente_id, ' por $', NEW.precio_final), USER());
END //

-- Si se cancela una venta, el auto vuelve a estar disponible
CREATE OR REPLACE TRIGGER trg_ventas_cancela
AFTER DELETE ON ventas
FOR EACH ROW
BEGIN
  UPDATE vehiculos SET estado = 'disponible' WHERE id = OLD.vehiculo_id;
  INSERT INTO bitacora (tabla, accion, detalle, usuario)
  VALUES ('ventas', 'DELETE', CONCAT('Se canceló la venta ', OLD.id, ' del vehículo ', OLD.vehiculo_id), USER());
END //

-- Bitácora con OLD y NEW (en SQL Server serían las tablas "deleted" e "inserted")
CREATE OR REPLACE TRIGGER trg_vehiculos_bitacora
AFTER UPDATE ON vehiculos
FOR EACH ROW
BEGIN
  IF NEW.precio <> OLD.precio THEN
    INSERT INTO bitacora (tabla, accion, detalle, usuario)
    VALUES ('vehiculos', 'UPDATE', CONCAT(NEW.marca, ' ', NEW.modelo, ': precio $', OLD.precio, ' → $', NEW.precio), USER());
  END IF;
  IF NEW.estado <> OLD.estado THEN
    INSERT INTO bitacora (tabla, accion, detalle, usuario)
    VALUES ('vehiculos', 'UPDATE', CONCAT(NEW.marca, ' ', NEW.modelo, ': ', OLD.estado, ' → ', NEW.estado), USER());
  END IF;
END //

CREATE OR REPLACE TRIGGER trg_temporal BEFORE INSERT ON asesores FOR EACH ROW SET NEW.nombre = TRIM(NEW.nombre) //

DELIMITER ;

DROP TRIGGER trg_temporal;                                         -- 5.3.d borrar un trigger

-- Modificar un procedimiento: ALTER cambia sus características;
-- para cambiar el código se usa CREATE OR REPLACE
ALTER PROCEDURE ventas_del_mes COMMENT 'Ventas de un mes con su saldo (versión 2)' SQL SECURITY DEFINER;

-- ---------- 5.1.c Permisos con procedimientos ----------
-- p_consulta NO puede leer ventas, pero sí ejecutar el reporte: el procedimiento
-- corre con los permisos de quien lo creó (SQL SECURITY DEFINER)
GRANT EXECUTE ON PROCEDURE agencia_proyecto.ventas_del_mes TO 'p_consulta'@'localhost';
GRANT EXECUTE ON PROCEDURE agencia_proyecto.registrar_venta TO rol_vendedor;
GRANT EXECUTE ON PROCEDURE agencia_proyecto.calcular_comisiones TO rol_gerente;
GRANT EXECUTE ON FUNCTION  agencia_proyecto.saldo_venta TO rol_vendedor;
-- El vendedor opera con los procedimientos CRUD (excepto cancelar y borrar, que son del gerente)
GRANT EXECUTE ON PROCEDURE agencia_proyecto.buscar_vehiculos   TO rol_vendedor;
GRANT EXECUTE ON PROCEDURE agencia_proyecto.listar_clientes    TO rol_vendedor;
GRANT EXECUTE ON PROCEDURE agencia_proyecto.estado_cuenta      TO rol_vendedor;
GRANT EXECUTE ON PROCEDURE agencia_proyecto.alta_cliente       TO rol_vendedor;
GRANT EXECUTE ON PROCEDURE agencia_proyecto.actualizar_cliente TO rol_vendedor;
GRANT EXECUTE ON PROCEDURE agencia_proyecto.registrar_pago     TO rol_vendedor;
GRANT EXECUTE ON PROCEDURE agencia_proyecto.cambiar_estado_vehiculo TO rol_vendedor;

-- ================= Pruebas =================
SELECT modelo, precio, precio_sin_iva(precio) AS sin_iva, categoria_auto(precio) AS categoria FROM vehiculos ORDER BY precio LIMIT 6;
SELECT id AS venta, precio_final, saldo_venta(id) AS saldo FROM ventas;

CALL ventas_del_mes(2026, 10);

SET @precio = 449800.00;
CALL aplicar_descuento(@precio, 5);
SELECT @precio AS precio_con_5_por_ciento;

-- Venta correcta: se guarda la venta, el enganche, y el trigger marca el auto
CALL registrar_venta(5, 3, 4, 690000.00, 200000.00, 'transferencia', @venta_nueva);
SELECT @venta_nueva AS venta_registrada, saldo_venta(@venta_nueva) AS saldo;
SELECT id, modelo, estado FROM vehiculos WHERE id = 5;

-- CRUD por procedimientos
CALL buscar_vehiculos('BYD', NULL);
CALL alta_cliente('  Laura Gómez ', '4771112233', 'Laura@Ejemplo.com', @nuevo);
SELECT @nuevo AS cliente_nuevo;
CALL actualizar_cliente(@nuevo, '4779990000', NULL);
CALL registrar_pago(@venta_nueva, 90000.00, 'efectivo', @saldo);
SELECT @saldo AS saldo_tras_pago;
CALL cambiar_estado_vehiculo(9, 'apartado');
CALL actualizar_precio(9, 879800.00);
CALL estado_cuenta(3);
CALL listar_clientes();
CALL baja_cliente(@nuevo);
SELECT COUNT(*) AS laura_ya_no_existe FROM clientes WHERE id = @nuevo;
CALL calcular_comisiones();
CALL tabla_de_pagos(@venta_nueva, 6);

-- Cambio de precio: queda en la bitácora con el valor anterior y el nuevo
UPDATE vehiculos SET precio = 299900.00 WHERE id = 1;
SELECT accion, detalle, usuario, fecha FROM bitacora ORDER BY id;

-- Objetos procedurales de la base
SELECT routine_type AS tipo, routine_name AS nombre, routine_comment AS descripcion
FROM information_schema.routines WHERE routine_schema = 'agencia_proyecto' ORDER BY routine_type, routine_name;
SELECT trigger_name AS trigger_, action_timing AS momento, event_manipulation AS evento, event_object_table AS tabla
FROM information_schema.triggers WHERE trigger_schema = 'agencia_proyecto' ORDER BY event_object_table, trigger_name;
