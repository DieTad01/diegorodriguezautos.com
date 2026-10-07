-- =============================================================
-- datos-ejemplo.sql — datos ficticios para practicar
-- Úsalo en la base de PRÁCTICA, no en la del sitio:
--   mysql -u practica -p agencia_practica < db/datos-ejemplo.sql
-- =============================================================

SET NAMES utf8mb4;

INSERT INTO vehiculos (marca, modelo, anio, version, precio, kilometraje, color, transmision, descripcion, estado) VALUES
  ('Nissan',     'Versa',   2021, 'Advance',     265000.00,  38000, 'Blanco', 'automatica', 'Único dueño, servicios de agencia.', 'disponible'),
  ('Volkswagen', 'Jetta',   2019, 'Trendline',   289000.00,  61000, 'Gris',   'manual',     'Llantas nuevas.',                    'disponible'),
  ('Toyota',     'Corolla', 2020, 'LE',          315000.00,  45000, 'Plata',  'automatica', NULL,                                 'vendido'),
  ('Chevrolet',  'Aveo',    2018, 'LT',          159000.00,  82000, 'Rojo',   'manual',     'Ideal para ciudad.',                 'vendido'),
  ('Honda',      'CR-V',    2022, 'Touring',     549000.00,  21000, 'Negro',  'automatica', 'Quemacocos, piel.',                  'apartado'),
  ('Mazda',      '3',       2021, 'i Sport',     335000.00,  33000, 'Azul',   'automatica', NULL,                                 'disponible'),
  ('Kia',        'Rio',     2020, 'EX',          219000.00,  57000, 'Blanco', 'automatica', NULL,                                 'disponible'),
  ('Ford',       'Ranger',  2019, 'XLT',         459000.00,  90000, 'Gris',   'manual',     'Doble cabina.',                      'vendido');

INSERT INTO clientes (nombre, telefono, email) VALUES
  ('Ana López',       '5512345678', 'ana@example.com'),
  ('Carlos Ruiz',     '5523456789', 'carlos@example.com'),
  ('María Fernández', '5534567890', NULL);

INSERT INTO ventas (vehiculo_id, cliente_id, fecha, precio_final) VALUES
  (3, 1, '2026-08-14', 305000.00),
  (4, 2, '2026-09-02', 155000.00),
  (8, 1, '2026-09-20', 450000.00);

INSERT INTO pagos (venta_id, fecha, monto, metodo) VALUES
  (1, '2026-08-14', 105000.00, 'transferencia'),
  (1, '2026-09-14', 100000.00, 'transferencia'),
  (2, '2026-09-02', 155000.00, 'efectivo'),
  (3, '2026-09-20', 150000.00, 'tarjeta'),
  (3, '2026-09-20', 200000.00, 'financiamiento');
