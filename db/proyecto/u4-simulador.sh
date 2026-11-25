#!/usr/bin/env bash
# =============================================================
# UNIDAD 4. Simulador de concurrencia con DOS sesiones a la vez
# (actividad A4.1.1). Dos vendedores (sesión A y sesión B) trabajan
# sobre la tabla existencias al mismo tiempo. Escenarios:
#   1. Lectura sucia           (READ UNCOMMITTED vs READ COMMITTED)
#   2. Lectura no repetible    (READ COMMITTED vs REPEATABLE READ)
#   3. Actualización perdida   (sin bloqueo vs SELECT ... FOR UPDATE)
#   4. Tiempo de espera de un bloqueo (ERROR 1205)
#   5. Interbloqueo / deadlock (ERROR 1213)
#   6. NOWAIT y SKIP LOCKED
#
# Uso, como root en el VPS (después de ejecutar.sh):
#   bash /var/www/diegorodriguezautos.com/db/proyecto/u4-simulador.sh
# Solo usa la base agencia_proyecto.
# =============================================================
set -uo pipefail

BD="agencia_proyecto"
SQL="$(command -v mariadb || command -v mysql)" || { echo "No se encontró MariaDB/MySQL."; exit 1; }
"$SQL" -e "USE $BD" 2>/dev/null || { echo "Falta la base $BD: corre primero db/proyecto/ejecutar.sh"; exit 1; }

titulo() { printf '\n\033[1;33m===== %s =====\033[0m\n' "$*"; }
nota()   { printf '\033[0;36m%s\033[0m\n' "$*"; }

# sesion A|B "SQL..."  → corre el SQL y antepone [A]/[B] y la hora a cada línea
sesion() {
  local nombre=$1; shift
  "$SQL" --default-character-set=utf8mb4 --unbuffered -N -B "$BD" -e "$*" 2>&1 \
    | while IFS= read -r linea; do
        case "$linea" in ''|-*) continue ;; esac   # quita separadores del cliente
        printf '%s [%s] %s\n' "$(date +%T.%2N)" "$nombre" "$linea"
      done
}

reiniciar() {
  "$SQL" "$BD" -e "CREATE TABLE IF NOT EXISTS existencias (modelo VARCHAR(40) NOT NULL PRIMARY KEY, unidades INT NOT NULL, CONSTRAINT chk_existencias CHECK (unidades >= 0)) ENGINE=InnoDB;
                   DELETE FROM existencias; INSERT INTO existencias VALUES ('Aveo', 3), ('Onix', 1), ('Dolphin Mini', 2);"
}

# ---------------------------------------------------------------
titulo "1. Lectura sucia (dirty read)"
nota "B baja el Onix a 0 SIN confirmar y luego se arrepiente (ROLLBACK). ¿Qué ve A mientras tanto?"
reiniciar
sesion B "START TRANSACTION; UPDATE existencias SET unidades = 0 WHERE modelo = 'Onix';
          SELECT 'B: cambié Onix a 0, sin COMMIT'; DO SLEEP(3); ROLLBACK; SELECT 'B: ROLLBACK (el 0 nunca existió)';" &
sleep 1
sesion A "SET SESSION TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
          SELECT CONCAT('A con READ UNCOMMITTED ve Onix = ', unidades, '  <- lectura SUCIA') FROM existencias WHERE modelo = 'Onix';
          SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED;
          SELECT CONCAT('A con READ COMMITTED ve Onix = ', unidades, '  <- solo lo confirmado') FROM existencias WHERE modelo = 'Onix';"
wait

# ---------------------------------------------------------------
titulo "2. Lectura no repetible (non-repeatable read)"
nota "A lee el Aveo dos veces en la MISMA transacción; entre las dos lecturas, B vende uno y confirma."
for nivel in "READ COMMITTED" "REPEATABLE READ"; do
  reiniciar
  sesion A "SET SESSION TRANSACTION ISOLATION LEVEL $nivel; START TRANSACTION;
            SELECT CONCAT('A ($nivel) 1a lectura: Aveo = ', unidades) FROM existencias WHERE modelo = 'Aveo';
            DO SLEEP(2);
            SELECT CONCAT('A ($nivel) 2a lectura: Aveo = ', unidades) FROM existencias WHERE modelo = 'Aveo';
            COMMIT;" &
  sleep 1
  sesion B "UPDATE existencias SET unidades = unidades - 1 WHERE modelo = 'Aveo'; SELECT 'B: vendí un Aveo (COMMIT automático)';"
  wait
done
nota "Con READ COMMITTED las dos lecturas difieren (3 y 2); con REPEATABLE READ, A ve siempre 3 dentro de su transacción."

# ---------------------------------------------------------------
titulo "3. Actualización perdida (lost update)"
nota "Queda 1 Onix. A y B leen, ven 1, y cada uno guarda 'lo que leí - 1'."
reiniciar
sesion A "START TRANSACTION; SELECT unidades INTO @u FROM existencias WHERE modelo = 'Onix';
          SELECT CONCAT('A leyó Onix = ', @u); DO SLEEP(2);
          UPDATE existencias SET unidades = @u - 1 WHERE modelo = 'Onix'; COMMIT; SELECT 'A: vendí el Onix';" &
sleep 0.5
sesion B "START TRANSACTION; SELECT unidades INTO @u FROM existencias WHERE modelo = 'Onix';
          SELECT CONCAT('B leyó Onix = ', @u); DO SLEEP(2);
          UPDATE existencias SET unidades = @u - 1 WHERE modelo = 'Onix'; COMMIT; SELECT 'B: vendí el Onix';"
wait
sesion fin "SELECT CONCAT('Resultado: Onix = ', unidades, '  <- se vendió DOS veces el último auto (una venta se perdió)') FROM existencias WHERE modelo = 'Onix';"
nota "Solución: bloquear la fila al leerla (SELECT ... FOR UPDATE). B espera a que A termine:"
reiniciar
sesion A "START TRANSACTION; SELECT unidades INTO @u FROM existencias WHERE modelo = 'Onix' FOR UPDATE;
          SELECT CONCAT('A leyó y BLOQUEÓ Onix = ', @u); DO SLEEP(2);
          UPDATE existencias SET unidades = @u - 1 WHERE modelo = 'Onix'; COMMIT; SELECT 'A: vendí el Onix y liberé el bloqueo';" &
sleep 0.5
sesion B "SELECT 'B: quiero leer Onix con FOR UPDATE (espero si está bloqueado)...';
          START TRANSACTION; SELECT unidades INTO @u FROM existencias WHERE modelo = 'Onix' FOR UPDATE;
          SELECT CONCAT('B por fin leyó Onix = ', @u, IF(@u = 0, '  -> ya no hay: no vende', ''));
          COMMIT;"
wait
sesion fin "SELECT CONCAT('Resultado: Onix = ', unidades, '  <- correcto, nunca negativo ni vendido dos veces') FROM existencias WHERE modelo = 'Onix';"

# ---------------------------------------------------------------
titulo "4. Tiempo de espera de un bloqueo (lock wait timeout)"
nota "A bloquea el Aveo 4 segundos; B solo está dispuesta a esperar 1."
reiniciar
sesion A "START TRANSACTION; UPDATE existencias SET unidades = unidades - 1 WHERE modelo = 'Aveo';
          SELECT 'A: bloqueé el Aveo'; DO SLEEP(4); COMMIT; SELECT 'A: COMMIT';" &
sleep 1
sesion B "SET SESSION innodb_lock_wait_timeout = 1; SELECT 'B: intento cambiar el Aveo...';
          UPDATE existencias SET unidades = unidades - 1 WHERE modelo = 'Aveo';"
wait

# ---------------------------------------------------------------
titulo "5. Interbloqueo (deadlock)"
nota "A bloquea Aveo y luego quiere Onix; B bloquea Onix y luego quiere Aveo. MariaDB detecta el ciclo y cancela a una."
reiniciar
sesion A "START TRANSACTION; UPDATE existencias SET unidades = unidades - 1 WHERE modelo = 'Aveo';
          SELECT 'A: tengo Aveo, voy por Onix'; DO SLEEP(1.5);
          UPDATE existencias SET unidades = unidades - 1 WHERE modelo = 'Onix'; COMMIT; SELECT 'A: terminé';" &
sleep 0.3
sesion B "START TRANSACTION; UPDATE existencias SET unidades = unidades + 1 WHERE modelo = 'Onix';
          SELECT 'B: tengo Onix, voy por Aveo'; DO SLEEP(1.5);
          UPDATE existencias SET unidades = unidades + 1 WHERE modelo = 'Aveo'; COMMIT; SELECT 'B: terminé';"
wait

# ---------------------------------------------------------------
titulo "6. NOWAIT y SKIP LOCKED"
nota "A tiene bloqueado el Aveo. B no quiere esperar: NOWAIT falla al instante; SKIP LOCKED se salta la fila bloqueada."
reiniciar
sesion A "START TRANSACTION; SELECT 'A: bloqueé el Aveo' FROM existencias WHERE modelo = 'Aveo' FOR UPDATE; DO SLEEP(2); COMMIT;" &
sleep 0.5
sesion B "SELECT CONCAT('B con SKIP LOCKED ve: ', GROUP_CONCAT(modelo ORDER BY modelo)) FROM (SELECT modelo FROM existencias FOR UPDATE SKIP LOCKED) t;"
sesion B "SELECT modelo FROM existencias WHERE modelo = 'Aveo' FOR UPDATE NOWAIT;"
wait

reiniciar
printf '\n\033[1;32mSimulación terminada. La tabla existencias quedó como al inicio.\033[0m\n'
