-- =============================================================
-- schema.sql — tablas de la agencia
-- Uso (en el VPS, por SSH):
--   sudo mysql agencia_autos < db/schema.sql
-- No lleva CREATE DATABASE ni USE para poder cargarlo en
-- cualquier base (la del sitio o la de práctica).
-- =============================================================

SET NAMES utf8mb4;

-- Inventario de autos
CREATE TABLE IF NOT EXISTS vehiculos (
  id             INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  marca          VARCHAR(50)   NOT NULL,
  modelo         VARCHAR(60)   NOT NULL,
  anio           SMALLINT UNSIGNED NOT NULL,
  version        VARCHAR(80)   NULL,
  precio         DECIMAL(12,2) NOT NULL,
  kilometraje    INT UNSIGNED  NOT NULL DEFAULT 0,
  color          VARCHAR(30)   NULL,
  transmision    ENUM('automatica','manual') NOT NULL DEFAULT 'automatica',
  descripcion    TEXT          NULL,
  estado         ENUM('disponible','apartado','vendido') NOT NULL DEFAULT 'disponible',
  creado_en      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_vehiculos_estado (estado),
  KEY idx_vehiculos_marca_modelo (marca, modelo),
  CONSTRAINT chk_vehiculos_anio   CHECK (anio BETWEEN 1950 AND 2100),
  CONSTRAINT chk_vehiculos_precio CHECK (precio >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Fotos de cada auto. Solo se guarda el ENLACE (Google Drive u otro
-- sitio https); el archivo nunca se sube al servidor.
CREATE TABLE IF NOT EXISTS vehiculo_imagenes (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  vehiculo_id INT UNSIGNED NOT NULL,
  url         VARCHAR(500) NOT NULL,
  orden       TINYINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_imagenes_vehiculo (vehiculo_id, orden),
  CONSTRAINT fk_imagenes_vehiculo FOREIGN KEY (vehiculo_id)
    REFERENCES vehiculos (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Clientes que compran
CREATE TABLE IF NOT EXISTS clientes (
  id        INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre    VARCHAR(100) NOT NULL,
  telefono  VARCHAR(20)  NULL,
  email     VARCHAR(120) NULL,
  creado_en TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_clientes_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Una venta = un auto vendido a un cliente
CREATE TABLE IF NOT EXISTS ventas (
  id           INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  vehiculo_id  INT UNSIGNED  NOT NULL,
  cliente_id   INT UNSIGNED  NOT NULL,
  fecha        DATE          NOT NULL,
  precio_final DECIMAL(12,2) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ventas_vehiculo (vehiculo_id),
  KEY idx_ventas_cliente (cliente_id),
  CONSTRAINT fk_ventas_vehiculo FOREIGN KEY (vehiculo_id) REFERENCES vehiculos (id),
  CONSTRAINT fk_ventas_cliente  FOREIGN KEY (cliente_id)  REFERENCES clientes (id),
  CONSTRAINT chk_ventas_precio CHECK (precio_final >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Pagos (una venta puede pagarse en varias partes)
CREATE TABLE IF NOT EXISTS pagos (
  id       INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  venta_id INT UNSIGNED  NOT NULL,
  fecha    DATE          NOT NULL,
  monto    DECIMAL(12,2) NOT NULL,
  metodo   ENUM('efectivo','transferencia','tarjeta','financiamiento') NOT NULL,
  PRIMARY KEY (id),
  KEY idx_pagos_venta (venta_id),
  CONSTRAINT fk_pagos_venta FOREIGN KEY (venta_id) REFERENCES ventas (id) ON DELETE CASCADE,
  CONSTRAINT chk_pagos_monto CHECK (monto > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Usuarios del panel /admin (una cuenta por persona: tú, tu cliente...)
-- La contraseña NO se guarda: solo su huella scrypt.
-- sesiones_desde: las sesiones abiertas antes de este momento (ms) dejan
-- de valer; se actualiza al cambiar la contraseña.
CREATE TABLE IF NOT EXISTS administradores (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario        VARCHAR(50)  NOT NULL,
  nombre         VARCHAR(100) NULL,
  password_hash  VARCHAR(255) NOT NULL,
  sesiones_desde BIGINT UNSIGNED NOT NULL DEFAULT 0,
  ultimo_acceso  TIMESTAMP    NULL,
  creado_en      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_administradores_usuario (usuario)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
