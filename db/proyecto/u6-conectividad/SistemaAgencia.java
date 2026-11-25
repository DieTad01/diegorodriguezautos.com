// =============================================================
// UNIDAD 6. Sistema de la agencia (Java + JDBC + procedimientos almacenados)
//
// Toda operación es una LLAMADA A PROCEDIMIENTO ({call ...}). El usuario
// de base de datos p_sistema SOLO tiene permiso EXECUTE: no puede leer ni
// escribir tablas directamente, así que el sistema no tiene otra forma de
// trabajar más que a través de los procedimientos (que validan todo).
//
//   Consulta:      buscar_vehiculos, listar_clientes, estado_cuenta, ventas_del_mes
//   Inserción:     alta_cliente, registrar_venta, registrar_pago
//   Actualización: actualizar_cliente, actualizar_precio, cambiar_estado_vehiculo
//   Eliminación:   cancelar_venta, baja_cliente
//
// Uso (lo prepara u6-conectividad/probar.sh):
//   java -cp .:conector.jar SistemaAgencia          menú interactivo
//   java -cp .:conector.jar SistemaAgencia --demo   recorre todas las operaciones
// Variables: PROYECTO_URL, PROYECTO_USUARIO (p_sistema), PROYECTO_CLAVE
// =============================================================
import java.math.BigDecimal;
import java.sql.CallableStatement;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.sql.Types;
import java.util.ArrayList;
import java.util.List;
import java.util.Scanner;

public class SistemaAgencia {

    private final Connection cn;
    private final Scanner entrada = new Scanner(System.in, "UTF-8");

    SistemaAgencia(Connection cn) {
        this.cn = cn;
    }

    public static void main(String[] args) throws SQLException {
        String url = System.getenv().getOrDefault("PROYECTO_URL", "jdbc:mariadb://127.0.0.1:3306/agencia_proyecto");
        String usuario = System.getenv().getOrDefault("PROYECTO_USUARIO", "p_sistema");
        String clave = System.getenv("PROYECTO_CLAVE");
        if (clave == null) {
            System.err.println("Falta la variable PROYECTO_CLAVE (la pone probar.sh).");
            System.exit(1);
        }
        try (Connection cn = DriverManager.getConnection(url, usuario, clave)) {
            SistemaAgencia sistema = new SistemaAgencia(cn);
            if (args.length > 0 && args[0].equals("--demo")) sistema.demo();
            else sistema.menu();
        }
    }

    // ======================= Menú interactivo =======================

    void menu() {
        while (true) {
            System.out.println("\n===== Agencia Diego Rodríguez · BYD | Chevrolet =====");
            System.out.println(" CONSULTA       1) Inventario   2) Clientes   3) Estado de cuenta   4) Ventas del mes");
            System.out.println(" INSERCIÓN      5) Alta de cliente   6) Registrar venta   7) Registrar pago");
            System.out.println(" ACTUALIZACIÓN  8) Actualizar cliente   9) Cambiar precio   10) Apartar/liberar auto");
            System.out.println(" ELIMINACIÓN    11) Cancelar venta   12) Baja de cliente");
            System.out.println(" 0) Salir");
            String opcion = pedir("Opción");
            try {
                switch (opcion) {
                    case "1" -> inventario(vacioANull(pedir("Marca (Enter = todas)")), decimalONull(pedir("Precio máximo (Enter = sin límite)")));
                    case "2" -> clientes();
                    case "3" -> estadoCuenta(entero(pedir("Id del cliente")));
                    case "4" -> ventasDelMes(entero(pedir("Año")), entero(pedir("Mes (1-12)")));
                    case "5" -> altaCliente(pedir("Nombre"), pedir("Teléfono"), pedir("Correo"));
                    case "6" -> registrarVenta(entero(pedir("Id del vehículo")), entero(pedir("Id del cliente")),
                            entero(pedir("Id del asesor")), decimal(pedir("Precio final")),
                            decimal(pedir("Enganche (0 si no hay)")), pedir("Método (efectivo/transferencia/tarjeta/financiamiento)"));
                    case "7" -> registrarPago(entero(pedir("Id de la venta")), decimal(pedir("Monto")), pedir("Método"));
                    case "8" -> actualizarCliente(entero(pedir("Id del cliente")), pedir("Teléfono nuevo (Enter = igual)"), pedir("Correo nuevo (Enter = igual)"));
                    case "9" -> actualizarPrecio(entero(pedir("Id del vehículo")), decimal(pedir("Precio nuevo")));
                    case "10" -> cambiarEstado(entero(pedir("Id del vehículo")), pedir("Estado (disponible/apartado)"));
                    case "11" -> cancelarVenta(entero(pedir("Id de la venta")));
                    case "12" -> bajaCliente(entero(pedir("Id del cliente")));
                    case "0" -> { return; }
                    default -> System.out.println("Opción no válida.");
                }
            } catch (SQLException e) {
                error(e);
            } catch (NumberFormatException e) {
                System.out.println("  ✘ Escribe un número válido.");
            }
        }
    }

    // ======================= Operaciones (solo procedimientos) =======================

    // CONSULTA
    void inventario(String marca, BigDecimal precioMax) throws SQLException {
        try (CallableStatement cs = cn.prepareCall("{call buscar_vehiculos(?, ?)}")) {
            if (marca == null) cs.setNull(1, Types.VARCHAR); else cs.setString(1, marca);
            if (precioMax == null) cs.setNull(2, Types.DECIMAL); else cs.setBigDecimal(2, precioMax);
            imprimirResultados(cs);
        }
    }

    void clientes() throws SQLException {
        try (CallableStatement cs = cn.prepareCall("{call listar_clientes()}")) {
            imprimirResultados(cs);
        }
    }

    void estadoCuenta(int cliente) throws SQLException {
        try (CallableStatement cs = cn.prepareCall("{call estado_cuenta(?)}")) {
            cs.setInt(1, cliente);
            imprimirResultados(cs);   // dos resultados: compras y pagos
        }
    }

    void ventasDelMes(int anio, int mes) throws SQLException {
        try (CallableStatement cs = cn.prepareCall("{call ventas_del_mes(?, ?)}")) {
            cs.setInt(1, anio);
            cs.setInt(2, mes);
            imprimirResultados(cs);
        }
    }

    // INSERCIÓN
    int altaCliente(String nombre, String telefono, String email) throws SQLException {
        try (CallableStatement cs = cn.prepareCall("{call alta_cliente(?, ?, ?, ?)}")) {
            cs.setString(1, nombre);
            cs.setString(2, telefono);
            cs.setString(3, email);
            cs.registerOutParameter(4, Types.INTEGER);
            cs.execute();
            int id = cs.getInt(4);
            System.out.println("  ✔ Cliente registrado con id " + id);
            return id;
        }
    }

    int registrarVenta(int vehiculo, int cliente, int asesor, BigDecimal precio, BigDecimal enganche, String metodo) throws SQLException {
        try (CallableStatement cs = cn.prepareCall("{call registrar_venta(?, ?, ?, ?, ?, ?, ?)}")) {
            cs.setInt(1, vehiculo);
            cs.setInt(2, cliente);
            cs.setInt(3, asesor);
            cs.setBigDecimal(4, precio);
            cs.setBigDecimal(5, enganche);
            cs.setString(6, metodo);
            cs.registerOutParameter(7, Types.INTEGER);
            cs.execute();
            int venta = cs.getInt(7);
            System.out.println("  ✔ Venta " + venta + " registrada (el auto quedó como vendido)");
            return venta;
        }
    }

    void registrarPago(int venta, BigDecimal monto, String metodo) throws SQLException {
        try (CallableStatement cs = cn.prepareCall("{call registrar_pago(?, ?, ?, ?)}")) {
            cs.setInt(1, venta);
            cs.setBigDecimal(2, monto);
            cs.setString(3, metodo);
            cs.registerOutParameter(4, Types.DECIMAL);
            cs.execute();
            System.out.printf("  ✔ Pago registrado. Saldo de la venta %d: $%,.2f%n", venta, cs.getBigDecimal(4));
        }
    }

    // ACTUALIZACIÓN
    void actualizarCliente(int id, String telefono, String email) throws SQLException {
        try (CallableStatement cs = cn.prepareCall("{call actualizar_cliente(?, ?, ?)}")) {
            cs.setInt(1, id);
            cs.setString(2, vacioANull(telefono));
            cs.setString(3, vacioANull(email));
            cs.execute();
            System.out.println("  ✔ Cliente " + id + " actualizado");
        }
    }

    void actualizarPrecio(int vehiculo, BigDecimal precio) throws SQLException {
        try (CallableStatement cs = cn.prepareCall("{call actualizar_precio(?, ?)}")) {
            cs.setInt(1, vehiculo);
            cs.setBigDecimal(2, precio);
            cs.execute();
            System.out.printf("  ✔ Precio del vehículo %d: $%,.2f (quedó en la bitácora)%n", vehiculo, precio);
        }
    }

    void cambiarEstado(int vehiculo, String estado) throws SQLException {
        try (CallableStatement cs = cn.prepareCall("{call cambiar_estado_vehiculo(?, ?)}")) {
            cs.setInt(1, vehiculo);
            cs.setString(2, estado);
            cs.execute();
            System.out.println("  ✔ Vehículo " + vehiculo + " ahora está " + estado);
        }
    }

    // ELIMINACIÓN
    void cancelarVenta(int venta) throws SQLException {
        try (CallableStatement cs = cn.prepareCall("{call cancelar_venta(?)}")) {
            cs.setInt(1, venta);
            cs.execute();
            System.out.println("  ✔ Venta " + venta + " cancelada: se borraron sus pagos y el auto volvió a estar disponible");
        }
    }

    void bajaCliente(int id) throws SQLException {
        try (CallableStatement cs = cn.prepareCall("{call baja_cliente(?)}")) {
            cs.setInt(1, id);
            cs.execute();
            System.out.println("  ✔ Cliente " + id + " dado de baja");
        }
    }

    // ======================= Demostración automática =======================

    void demo() {
        titulo("Conexión");
        System.out.println("  Usuario: p_sistema (solo EXECUTE)");
        paso("¿Puede leer una tabla directamente?", () -> {
            try (var st = cn.createStatement(); var rs = st.executeQuery("SELECT * FROM clientes")) {
                System.out.println("  ✘ Pudo leer la tabla (no debería)");
            }
        });

        titulo("CONSULTA");
        paso("Inventario BYD de hasta $700,000", () -> inventario("BYD", new BigDecimal("700000")));
        paso("Clientes con compras y saldo", this::clientes);

        titulo("INSERCIÓN");
        int[] cliente = new int[1];
        int[] venta = new int[1];
        paso("Alta de cliente", () -> cliente[0] = altaCliente("Fernanda Ruiz", "4778889900", "fernanda@ejemplo.com"));
        paso("Alta con correo repetido (debe rechazarse)", () -> altaCliente("Otra Fernanda", null, "fernanda@ejemplo.com"));
        paso("Venta del auto más barato disponible a la nueva clienta, con enganche", () -> {
            int vehiculo = primerDisponible();
            venta[0] = registrarVenta(vehiculo, cliente[0], 1, new BigDecimal("270000.00"), new BigDecimal("70000.00"), "transferencia");
        });
        paso("Pago de $50,000", () -> registrarPago(venta[0], new BigDecimal("50000.00"), "efectivo"));
        paso("Pago mayor al saldo (lo frena el trigger)", () -> registrarPago(venta[0], new BigDecimal("999999.00"), "efectivo"));
        paso("Estado de cuenta de la clienta", () -> estadoCuenta(cliente[0]));

        titulo("ACTUALIZACIÓN");
        paso("Cambiar teléfono de la clienta", () -> actualizarCliente(cliente[0], "4770001122", null));
        paso("Bajar precio del vehículo 7 (BYD Seal)", () -> actualizarPrecio(7, new BigDecimal("829800.00")));
        paso("Apartar el vehículo 7", () -> cambiarEstado(7, "apartado"));
        paso("Cambiar el precio de un auto vendido (debe rechazarse)", () -> actualizarPrecio(2, new BigDecimal("1.00")));

        titulo("ELIMINACIÓN");
        paso("Dar de baja a una clienta con compras (debe rechazarse)", () -> bajaCliente(cliente[0]));
        paso("Cancelar su venta (transacción: pagos + venta)", () -> cancelarVenta(venta[0]));
        paso("Ahora sí, dar de baja a la clienta", () -> bajaCliente(cliente[0]));
        paso("Liberar el vehículo 7", () -> cambiarEstado(7, "disponible"));
        paso("Inventario final", () -> inventario(null, null));
    }

    // Busca el auto disponible más barato usando el procedimiento de consulta
    int primerDisponible() throws SQLException {
        try (CallableStatement cs = cn.prepareCall("{call buscar_vehiculos(NULL, NULL)}")) {
            try (ResultSet rs = cs.executeQuery()) {
                while (rs.next()) {
                    if ("disponible".equals(rs.getString("estado"))) return rs.getInt("id");
                }
            }
        }
        throw new SQLException("No hay autos disponibles");
    }

    interface Accion { void correr() throws SQLException; }

    void paso(String texto, Accion accion) {
        System.out.println("\n▸ " + texto);
        try {
            accion.correr();
        } catch (SQLException e) {
            error(e);
        }
    }

    // ======================= Utilidades =======================

    // Imprime TODOS los resultados que regrese un procedimiento, como tabla
    void imprimirResultados(CallableStatement cs) throws SQLException {
        boolean hayResultado = cs.execute();
        while (true) {
            if (hayResultado) {
                try (ResultSet rs = cs.getResultSet()) {
                    imprimirTabla(rs);
                }
            } else if (cs.getUpdateCount() == -1) {
                break;
            }
            hayResultado = cs.getMoreResults();
        }
    }

    static void imprimirTabla(ResultSet rs) throws SQLException {
        ResultSetMetaData md = rs.getMetaData();
        int n = md.getColumnCount();
        List<String[]> filas = new ArrayList<>();
        String[] encabezado = new String[n];
        int[] ancho = new int[n];
        for (int i = 0; i < n; i++) {
            encabezado[i] = md.getColumnLabel(i + 1);
            ancho[i] = encabezado[i].length();
        }
        while (rs.next()) {
            String[] fila = new String[n];
            for (int i = 0; i < n; i++) {
                Object valor = rs.getObject(i + 1);
                fila[i] = valor == null ? "—" : valor instanceof BigDecimal bd ? String.format("%,.2f", bd) : String.valueOf(valor);
                ancho[i] = Math.max(ancho[i], fila[i].length());
            }
            filas.add(fila);
        }
        StringBuilder linea = new StringBuilder("  +");
        for (int a : ancho) linea.append("-".repeat(a + 2)).append('+');
        System.out.println(linea);
        imprimirFila(encabezado, ancho);
        System.out.println(linea);
        for (String[] f : filas) imprimirFila(f, ancho);
        System.out.println(linea);
        System.out.println("  " + filas.size() + (filas.size() == 1 ? " fila" : " filas"));
    }

    static void imprimirFila(String[] celdas, int[] ancho) {
        StringBuilder sb = new StringBuilder("  |");
        for (int i = 0; i < celdas.length; i++) sb.append(' ').append(String.format("%-" + ancho[i] + "s", celdas[i])).append(" |");
        System.out.println(sb);
    }

    static void error(SQLException e) {
        // Los mensajes de SIGNAL de los procedimientos y triggers llegan aquí
        String msg = e.getMessage().replaceFirst("^\\(conn=\\d+\\) ", "");
        System.out.println("  ✘ Rechazado por la base de datos: " + msg + " (código " + e.getErrorCode() + ")");
    }

    static void titulo(String t) {
        System.out.println("\n==================== " + t + " ====================");
    }

    String pedir(String texto) {
        System.out.print("  " + texto + ": ");
        return entrada.hasNextLine() ? entrada.nextLine().trim() : "0";
    }

    static String vacioANull(String s) { return s == null || s.isBlank() ? null : s.trim(); }
    static int entero(String s) { return Integer.parseInt(s.trim()); }
    static BigDecimal decimal(String s) { return new BigDecimal(s.trim().replace(",", "")); }
    static BigDecimal decimalONull(String s) { return s == null || s.isBlank() ? null : decimal(s); }
}
