-- =============================================================
-- UNIDAD 1. Lenguaje de Definición de Datos (DDL)
-- Proyecto: Agencia Diego Rodríguez (BYD | Chevrolet)
-- Cubre: 1.1 SGBD · 1.2 crear BD · 1.2.a modificar/eliminar BD ·
--        1.2.b restricciones · 1.2.c modificar tablas · 1.2.d DROP/TRUNCATE
-- Se ejecuta como root con ejecutar.sh (crea la base agencia_proyecto).
-- =============================================================

-- ---------- 1.1 El SGBD instalado ----------
SELECT VERSION() AS version_mariadb, @@character_set_server AS juego_caracteres, @@datadir AS carpeta_de_datos;

-- ---------- 1.2.a Crear, modificar y eliminar una base de datos ----------
-- Base de prueba para demostrar el ciclo completo
CREATE DATABASE IF NOT EXISTS prueba_ddl CHARACTER SET latin1 COLLATE latin1_swedish_ci;
SELECT schema_name, default_character_set_name, default_collation_name
FROM information_schema.schemata WHERE schema_name = 'prueba_ddl';
ALTER DATABASE prueba_ddl CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;   -- modificar
SELECT schema_name, default_character_set_name, default_collation_name
FROM information_schema.schemata WHERE schema_name = 'prueba_ddl';
DROP DATABASE prueba_ddl;                                                       -- eliminar
SHOW DATABASES LIKE 'prueba_ddl';                                               -- ya no existe

-- La base del proyecto (ejecutar.sh la borra y crea limpia antes de este script)
USE agencia_proyecto;

-- ---------- 1.2 / 1.2.b Esquema con restricciones ----------
-- PRIMARY KEY, FOREIGN KEY, UNIQUE, CHECK, NOT NULL, DEFAULT, ENUM, AUTO_INCREMENT

CREATE TABLE vehiculos (
  id             INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  marca          VARCHAR(50)   NOT NULL,
  modelo         VARCHAR(60)   NOT NULL,
  anio           SMALLINT UNSIGNED NOT NULL,
  version        VARCHAR(80)   NULL,
  precio         DECIMAL(12,2) NOT NULL,
  kilometraje    INT UNSIGNED  NOT NULL DEFAULT 0,
  color          VARCHAR(30)   NULL,
  transmision    ENUM('automatica','manual') NOT NULL DEFAULT 'automatica',
  estado         ENUM('disponible','apartado','vendido') NOT NULL DEFAULT 'disponible',
  creado_en      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_vehiculos_estado (estado),
  CONSTRAINT chk_vehiculos_anio   CHECK (anio BETWEEN 1950 AND 2100),
  CONSTRAINT chk_vehiculos_precio CHECK (precio >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE clientes (
  id        INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre    VARCHAR(100) NOT NULL,
  telefono  VARCHAR(20)  NULL,
  email     VARCHAR(120) NULL,
  creado_en TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT uq_clientes_email UNIQUE (email)                       -- restricción UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ventas (
  id           INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  vehiculo_id  INT UNSIGNED  NOT NULL,
  cliente_id   INT UNSIGNED  NOT NULL,
  fecha        DATE          NOT NULL,
  precio_final DECIMAL(12,2) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ventas_vehiculo (vehiculo_id),                      -- índice UNIQUE: un auto, una venta
  CONSTRAINT fk_ventas_vehiculo FOREIGN KEY (vehiculo_id) REFERENCES vehiculos (id),
  CONSTRAINT fk_ventas_cliente  FOREIGN KEY (cliente_id)  REFERENCES clientes (id),
  CONSTRAINT chk_ventas_precio CHECK (precio_final >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE pagos (
  id       INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  venta_id INT UNSIGNED  NOT NULL,
  fecha    DATE          NOT NULL,
  monto    DECIMAL(12,2) NOT NULL,
  metodo   ENUM('efectivo','transferencia','tarjeta','financiamiento') NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_pagos_venta FOREIGN KEY (venta_id) REFERENCES ventas (id) ON DELETE CASCADE,
  CONSTRAINT chk_pagos_monto CHECK (monto > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SHOW TABLES;

-- ---------- 1.2.c Modificación del esquema (ALTER TABLE) ----------
-- Nueva entidad: los asesores que venden (modificación del esquema lógico)
CREATE TABLE asesores (
  id      INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre  VARCHAR(100) NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE asesores ADD COLUMN correo VARCHAR(120) NOT NULL AFTER nombre;        -- agregar columna
ALTER TABLE asesores ADD CONSTRAINT uq_asesores_correo UNIQUE (correo);           -- agregar restricción
ALTER TABLE asesores ADD COLUMN comision DECIMAL(4,2) NOT NULL DEFAULT 1.50,
                     ADD CONSTRAINT chk_asesores_comision CHECK (comision BETWEEN 0 AND 10);
ALTER TABLE ventas ADD COLUMN asesor_id INT UNSIGNED NULL AFTER cliente_id,       -- relacionar tablas
                   ADD CONSTRAINT fk_ventas_asesor FOREIGN KEY (asesor_id) REFERENCES asesores (id);
ALTER TABLE clientes MODIFY telefono VARCHAR(15) NULL;                            -- cambiar tipo
ALTER TABLE clientes RENAME COLUMN creado_en TO registrado_en;                    -- renombrar columna
ALTER TABLE vehiculos ADD COLUMN descripcion TEXT NULL AFTER estado;
ALTER TABLE vehiculos ADD INDEX idx_vehiculos_marca_modelo (marca, modelo);       -- agregar índice
CREATE UNIQUE INDEX uq_asesores_nombre ON asesores (nombre);                      -- índice UNIQUE
DROP INDEX uq_asesores_nombre ON asesores;                                        -- y quitarlo

DESCRIBE asesores;
DESCRIBE ventas;
SHOW CREATE TABLE ventas\G

-- Tabla para la unidad 5 (bitácora de cambios con triggers)
CREATE TABLE bitacora (
  id        INT UNSIGNED NOT NULL AUTO_INCREMENT,
  tabla     VARCHAR(30)  NOT NULL,
  accion    ENUM('INSERT','UPDATE','DELETE') NOT NULL,
  detalle   VARCHAR(255) NOT NULL,
  usuario   VARCHAR(80)  NOT NULL DEFAULT (CURRENT_USER()),
  fecha     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- 1.2.d Eliminación: TRUNCATE vs DROP ----------
CREATE TABLE temporal (id INT AUTO_INCREMENT PRIMARY KEY, dato VARCHAR(10));
INSERT INTO temporal (dato) VALUES ('a'), ('b'), ('c');
TRUNCATE TABLE temporal;                          -- vacía y reinicia el AUTO_INCREMENT
INSERT INTO temporal (dato) VALUES ('d');
SELECT * FROM temporal;                           -- el id vuelve a empezar en 1
DROP TABLE temporal;                              -- borra la tabla completa
DROP TABLE IF EXISTS temporal;                    -- IF EXISTS: no falla si ya no existe

-- ---------- Las restricciones en el diccionario de datos ----------
SELECT table_name AS tabla, constraint_name AS restriccion, constraint_type AS tipo
FROM information_schema.table_constraints
WHERE table_schema = 'agencia_proyecto'
ORDER BY table_name, constraint_type, constraint_name;
