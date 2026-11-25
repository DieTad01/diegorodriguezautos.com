-- =============================================================
-- UNIDAD 4. Concurrencia
-- Cubre: 4.1 conceptos · 4.2 propiedades ACID · 4.3 grados de consistencia ·
--        4.4 niveles de aislamiento · 4.5 COMMIT, ROLLBACK y bloqueos
-- La parte con DOS sesiones simultáneas está en u4-simulador.sh.
-- =============================================================
USE agencia_proyecto;

-- Tabla para las demostraciones: unidades en existencia de cada modelo
CREATE TABLE IF NOT EXISTS existencias (
  modelo   VARCHAR(40) NOT NULL PRIMARY KEY,
  unidades INT NOT NULL,
  CONSTRAINT chk_existencias CHECK (unidades >= 0)
) ENGINE=InnoDB;
DELETE FROM existencias;
INSERT INTO existencias VALUES ('Aveo', 3), ('Onix', 1), ('Dolphin Mini', 2);

-- ---------- 4.2 ACID con una transacción explícita ----------
-- Atomicidad: o se hacen las dos cosas o ninguna
SELECT @@autocommit AS autocommit;          -- 1 = cada instrucción se guarda sola
START TRANSACTION;
UPDATE existencias SET unidades = unidades - 1 WHERE modelo = 'Aveo';
INSERT INTO bitacora (tabla, accion, detalle) VALUES ('existencias', 'UPDATE', 'Se apartó un Aveo');
COMMIT;                                      -- Durabilidad: ya quedó guardado
SELECT * FROM existencias WHERE modelo = 'Aveo';

-- ROLLBACK: deshacer todo
START TRANSACTION;
DELETE FROM existencias;
SELECT COUNT(*) AS filas_dentro_de_la_transaccion FROM existencias;
ROLLBACK;
SELECT COUNT(*) AS filas_despues_del_rollback FROM existencias;

-- Consistencia: una regla (CHECK unidades >= 0) nunca se rompe; si una
-- instrucción falla, la transacción decide qué hacer con lo demás
START TRANSACTION;
UPDATE existencias SET unidades = unidades - 1 WHERE modelo = 'Onix';   -- 1 → 0, válido
SAVEPOINT despues_del_onix;
UPDATE existencias SET unidades = unidades + 10 WHERE modelo = 'Dolphin Mini';
ROLLBACK TO SAVEPOINT despues_del_onix;     -- deshace solo lo posterior al savepoint
COMMIT;
SELECT * FROM existencias ORDER BY modelo;  -- Onix en 0, Dolphin Mini sin cambio

-- autocommit apagado: nada se guarda hasta COMMIT
SET autocommit = 0;
UPDATE existencias SET unidades = 99 WHERE modelo = 'Aveo';
ROLLBACK;
SET autocommit = 1;
SELECT unidades AS aveo_sigue_igual FROM existencias WHERE modelo = 'Aveo';

-- ---------- 4.3 / 4.4 Niveles de aislamiento ----------
SHOW SESSION VARIABLES LIKE '%isolation';                  -- por defecto en InnoDB: REPEATABLE-READ
SET SESSION TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;   -- grado 0/1: permite lecturas sucias
SHOW SESSION VARIABLES LIKE '%isolation';
SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED;     -- grado 2: solo lee lo confirmado
SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ;    -- grado 3: lecturas repetibles
SET SESSION TRANSACTION ISOLATION LEVEL SERIALIZABLE;       -- el más estricto
SHOW SESSION VARIABLES LIKE '%isolation';
SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ;
-- Para una sola transacción:
SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
START TRANSACTION READ ONLY;                                 -- transacción de solo lectura
SELECT SUM(unidades) AS total_unidades FROM existencias;
COMMIT;

-- ---------- 4.5 Bloqueos ----------
-- Bloqueo de FILA exclusivo (escritura) y compartido (lectura)
START TRANSACTION;
SELECT * FROM existencias WHERE modelo = 'Aveo' FOR UPDATE;          -- nadie más puede cambiarla
SELECT * FROM existencias WHERE modelo = 'Onix' LOCK IN SHARE MODE;  -- otros pueden leer, no cambiar
UPDATE existencias SET unidades = unidades - 1 WHERE modelo = 'Aveo';
COMMIT;                                                               -- aquí se liberan
-- Bloqueo de TABLA (granularidad gruesa)
LOCK TABLES existencias WRITE, bitacora WRITE;
UPDATE existencias SET unidades = unidades + 1 WHERE modelo = 'Aveo';
INSERT INTO bitacora (tabla, accion, detalle) VALUES ('existencias', 'UPDATE', 'Ajuste con LOCK TABLES');
UNLOCK TABLES;
-- Cuánto espera una transacción por un bloqueo antes de rendirse
SHOW SESSION VARIABLES LIKE 'innodb_lock_wait_timeout';
SHOW GLOBAL STATUS LIKE 'Innodb_row_lock%';
SELECT * FROM existencias ORDER BY modelo;
