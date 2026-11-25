-- =============================================================
-- UNIDAD 3. Control de acceso
-- Cubre: 3.1 tipos de usuario · 3.2 crear/modificar/eliminar usuarios ·
--        3.3 privilegios (GRANT / REVOKE; DENY no existe en MariaDB) · 3.4 roles
-- Las contraseñas __CLAVE_...__ las reemplaza ejecutar.sh por unas
-- aleatorias (nunca se guardan en el repositorio).
-- =============================================================
USE agencia_proyecto;

-- Limpiar lo de una ejecución anterior
DROP USER IF EXISTS 'p_gerente'@'localhost', 'p_vendedor'@'localhost', 'p_ana'@'localhost',
                    'p_carlos'@'localhost', 'p_consulta'@'localhost', 'p_app'@'localhost',
                    'p_temporal'@'localhost', 'p_temporal2'@'localhost';
DROP ROLE IF EXISTS rol_gerente;
DROP ROLE IF EXISTS rol_vendedor;
DROP ROLE IF EXISTS rol_cliente;

-- ---------- 3.1 Tipos de usuario ----------
-- Administrador del servidor (root): todo. Usuarios de la aplicación: lo mínimo.
SELECT user, host, plugin AS autenticacion FROM mysql.user WHERE user IN ('root', 'mariadb.sys') ORDER BY user;

-- ---------- 3.2 Crear, modificar y eliminar usuarios ----------
CREATE USER 'p_temporal'@'localhost' IDENTIFIED BY '__CLAVE_TEMPORAL__';
ALTER USER 'p_temporal'@'localhost' IDENTIFIED BY '__CLAVE_TEMPORAL2__';                  -- cambiar contraseña
ALTER USER 'p_temporal'@'localhost' WITH MAX_QUERIES_PER_HOUR 100 MAX_USER_CONNECTIONS 2;  -- límites de uso
ALTER USER 'p_temporal'@'localhost' ACCOUNT LOCK;                                          -- bloquear cuenta
SELECT user, host, max_questions AS consultas_por_hora, max_user_connections AS conexiones,
       JSON_VALUE(Priv, '$.account_locked') AS bloqueada
FROM mysql.global_priv JOIN mysql.user USING (user, host) WHERE user = 'p_temporal';
ALTER USER 'p_temporal'@'localhost' ACCOUNT UNLOCK;
RENAME USER 'p_temporal'@'localhost' TO 'p_temporal2'@'localhost';                         -- renombrar
DROP USER 'p_temporal2'@'localhost';                                                       -- eliminar
SELECT COUNT(*) AS quedan_temporales FROM mysql.user WHERE user LIKE 'p\_temporal%';

-- Usuarios del proyecto
CREATE USER 'p_gerente'@'localhost'  IDENTIFIED BY '__CLAVE_GERENTE__';
CREATE USER 'p_vendedor'@'localhost' IDENTIFIED BY '__CLAVE_VENDEDOR__';
CREATE USER 'p_ana'@'localhost'      IDENTIFIED BY '__CLAVE_ANA__';
CREATE USER 'p_carlos'@'localhost'   IDENTIFIED BY '__CLAVE_CARLOS__';
CREATE USER 'p_consulta'@'localhost' IDENTIFIED BY '__CLAVE_CONSULTA__';
CREATE USER 'p_app'@'localhost'      IDENTIFIED BY '__CLAVE_APP__';      -- la usa la unidad 6 (JDBC/ODBC)

-- ---------- 3.3 Privilegios directos (GRANT / REVOKE) ----------
-- Nivel base de datos: solo lectura
GRANT SELECT ON agencia_proyecto.* TO 'p_consulta'@'localhost';
-- Nivel tabla: le quitamos una tabla completa (en MariaDB no hay DENY: se otorga
-- solo lo necesario, y se quita con REVOKE)
REVOKE SELECT ON agencia_proyecto.* FROM 'p_consulta'@'localhost';
GRANT SELECT ON agencia_proyecto.vehiculos TO 'p_consulta'@'localhost';
GRANT SELECT ON agencia_proyecto.asesores  TO 'p_consulta'@'localhost';
-- Nivel columna: de clientes solo puede ver nombre (no teléfono ni correo)
GRANT SELECT (id, nombre) ON agencia_proyecto.clientes TO 'p_consulta'@'localhost';
-- Sus permisos (consultando el diccionario; SHOW GRANTS mostraría la huella de la contraseña)
SELECT table_name AS tabla, privilege_type AS permiso FROM information_schema.table_privileges
WHERE grantee = "'p_consulta'@'localhost'" ORDER BY table_name;
SELECT table_name AS tabla, column_name AS columna, privilege_type AS permiso FROM information_schema.column_privileges
WHERE grantee = "'p_consulta'@'localhost'" ORDER BY column_name;

-- La aplicación: leer y escribir filas, ejecutar procedimientos; nunca DROP/ALTER
GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON agencia_proyecto.* TO 'p_app'@'localhost';

-- ---------- 3.4 Roles ----------
CREATE ROLE rol_gerente;
CREATE ROLE rol_vendedor;
CREATE ROLE rol_cliente;

GRANT ALL PRIVILEGES ON agencia_proyecto.* TO rol_gerente;

GRANT SELECT ON agencia_proyecto.* TO rol_vendedor;
GRANT INSERT, UPDATE ON agencia_proyecto.clientes TO rol_vendedor;
GRANT INSERT ON agencia_proyecto.ventas TO rol_vendedor;
GRANT INSERT ON agencia_proyecto.pagos  TO rol_vendedor;
GRANT UPDATE (precio, estado) ON agencia_proyecto.vehiculos TO rol_vendedor;  -- solo esas columnas

-- Seguridad por fila: cada cliente ve SOLO sus compras y pagos
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS usuario_bd VARCHAR(30) NULL UNIQUE AFTER email;
UPDATE clientes SET usuario_bd = 'p_ana'    WHERE email = 'ana@ejemplo.com';
UPDATE clientes SET usuario_bd = 'p_carlos' WHERE email = 'carlos@ejemplo.com';

CREATE OR REPLACE SQL SECURITY DEFINER VIEW mis_compras AS
SELECT v.id AS venta, CONCAT(a.marca, ' ', a.modelo, ' ', a.anio) AS auto, v.fecha, v.precio_final,
       COALESCE(SUM(p.monto), 0) AS pagado, v.precio_final - COALESCE(SUM(p.monto), 0) AS saldo
FROM ventas v
JOIN clientes c  ON c.id = v.cliente_id
JOIN vehiculos a ON a.id = v.vehiculo_id
LEFT JOIN pagos p ON p.venta_id = v.id
WHERE c.usuario_bd = SUBSTRING_INDEX(USER(), '@', 1)
GROUP BY v.id, a.marca, a.modelo, a.anio, v.fecha, v.precio_final;

CREATE OR REPLACE SQL SECURITY DEFINER VIEW mis_pagos AS
SELECT p.venta_id AS venta, p.fecha, p.monto, p.metodo
FROM pagos p
JOIN ventas v   ON v.id = p.venta_id
JOIN clientes c ON c.id = v.cliente_id
WHERE c.usuario_bd = SUBSTRING_INDEX(USER(), '@', 1);

GRANT SELECT ON agencia_proyecto.mis_compras TO rol_cliente;
GRANT SELECT ON agencia_proyecto.mis_pagos   TO rol_cliente;

-- Asignar roles a usuarios (y que se activen al entrar)
GRANT rol_gerente  TO 'p_gerente'@'localhost';
GRANT rol_vendedor TO 'p_vendedor'@'localhost';
GRANT rol_cliente  TO 'p_ana'@'localhost', 'p_carlos'@'localhost';
SET DEFAULT ROLE rol_gerente  FOR 'p_gerente'@'localhost';
SET DEFAULT ROLE rol_vendedor FOR 'p_vendedor'@'localhost';
SET DEFAULT ROLE rol_cliente  FOR 'p_ana'@'localhost';
SET DEFAULT ROLE rol_cliente  FOR 'p_carlos'@'localhost';

-- Un rol también puede contener a otro rol
GRANT rol_vendedor TO rol_gerente;

FLUSH PRIVILEGES;

SHOW GRANTS FOR rol_vendedor;
SELECT User AS usuario, Role AS rol FROM mysql.roles_mapping WHERE User LIKE 'p\_%' OR User LIKE 'rol\_%' ORDER BY User;
SELECT user AS usuario, default_role AS rol_al_entrar FROM mysql.user WHERE user LIKE 'p\_%' ORDER BY user;
SELECT user AS rol_o_usuario, host, is_role FROM mysql.user WHERE user LIKE 'p\_%' OR user LIKE 'rol\_%' ORDER BY is_role DESC, user;
SELECT * FROM information_schema.applicable_roles;
