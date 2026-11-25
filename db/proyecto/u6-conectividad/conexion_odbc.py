#!/usr/bin/env python3
# =============================================================
# UNIDAD 6. Conectividad con ODBC (MariaDB Connector/ODBC + pyodbc)
# Se conecta a agencia_proyecto con el usuario de aplicación p_app.
# Lo corre probar.sh, que pasa la contraseña por variable de entorno:
#   PROYECTO_USUARIO (por defecto p_app) · PROYECTO_CLAVE
# =============================================================
import os
import sys

import pyodbc

clave = os.environ.get("PROYECTO_CLAVE")
if not clave:
    sys.exit("Falta la variable PROYECTO_CLAVE (la pone probar.sh).")

# Conexión con el DSN "agencia_proyecto" (lo crea probar.sh en /etc/odbc.ini)
cadena = f"DSN=agencia_proyecto;UID={os.environ.get('PROYECTO_USUARIO', 'p_app')};PWD={clave}"
with pyodbc.connect(cadena, autocommit=True) as cn:
    print("1) Conectado con ODBC")
    print("   Driver:  ", cn.getinfo(pyodbc.SQL_DRIVER_NAME), cn.getinfo(pyodbc.SQL_DRIVER_VER))
    print("   Servidor:", cn.getinfo(pyodbc.SQL_DBMS_NAME), cn.getinfo(pyodbc.SQL_DBMS_VER))
    cur = cn.cursor()

    print("\n2) Ventas con saldo (vista vista_saldos)")
    for fila in cur.execute("SELECT venta, cliente, auto, precio_final, saldo FROM vista_saldos ORDER BY venta"):
        print(f"   Venta {fila.venta:<3} {fila.cliente:<22} {fila.auto:<20} ${fila.precio_final:>12,.2f}  saldo ${fila.saldo:>12,.2f}")

    print("\n3) Consulta con parámetros (?): autos de una marca y precio máximo")
    for fila in cur.execute("SELECT modelo, precio FROM vehiculos WHERE marca = ? AND precio <= ? ORDER BY precio",
                            "BYD", 700000):
        print(f"   {fila.modelo:<14} ${fila.precio:>12,.2f}")

    print("\n4) Procedimiento almacenado: ventas de octubre de 2026")
    cur.execute("{CALL ventas_del_mes(?, ?)}", 2026, 10)
    for fila in cur.fetchall():
        print(f"   {fila.fecha}  {fila.cliente:<22} {fila.auto:<20} saldo ${fila.saldo:>12,.2f}")
    while cur.nextset():   # un CALL regresa resultados extra: hay que consumirlos todos
        pass

    print("\n5) Transacción con rollback")
    cn.autocommit = False
    cur.execute("UPDATE vehiculos SET precio = 1 WHERE estado = 'disponible'")
    print("   Autos cambiados dentro de la transacción:", cur.rowcount)
    cn.rollback()
    print("   Tras rollback, autos a $1:", cur.execute("SELECT COUNT(*) FROM vehiculos WHERE precio = 1").fetchval())
    cn.autocommit = True
