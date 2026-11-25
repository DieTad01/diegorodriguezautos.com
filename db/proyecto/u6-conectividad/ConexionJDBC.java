// =============================================================
// UNIDAD 6. Conectividad con JDBC (MariaDB Connector/J)
// Se conecta a agencia_proyecto con el usuario de aplicación p_app
// (solo puede leer/escribir filas y ejecutar procedimientos).
//
// Lo corre u6-conectividad/probar.sh, que descarga el conector,
// compila y pasa la contraseña por variable de entorno (nunca escrita aquí):
//   PROYECTO_URL      (por defecto jdbc:mariadb://127.0.0.1:3306/agencia_proyecto)
//   PROYECTO_USUARIO  (por defecto p_app)
//   PROYECTO_CLAVE
// =============================================================
import java.math.BigDecimal;
import java.sql.CallableStatement;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Types;

public class ConexionJDBC {

    public static void main(String[] args) {
        String url = System.getenv().getOrDefault("PROYECTO_URL", "jdbc:mariadb://127.0.0.1:3306/agencia_proyecto");
        String usuario = System.getenv().getOrDefault("PROYECTO_USUARIO", "p_app");
        String clave = System.getenv("PROYECTO_CLAVE");
        if (clave == null) {
            System.err.println("Falta la variable PROYECTO_CLAVE (la pone probar.sh).");
            System.exit(1);
        }

        // try-with-resources: la conexión se cierra sola aunque haya error
        try (Connection cn = DriverManager.getConnection(url, usuario, clave)) {
            DatabaseMetaData meta = cn.getMetaData();
            System.out.println("1) Conectado con JDBC");
            System.out.println("   Servidor: " + meta.getDatabaseProductName() + " " + meta.getDatabaseProductVersion());
            System.out.println("   Driver:   " + meta.getDriverName() + " " + meta.getDriverVersion());
            System.out.println("   Usuario:  " + meta.getUserName());

            consultarInventario(cn);
            agregarCliente(cn, "Cliente JDBC", "jdbc@ejemplo.com");
            registrarVenta(cn);
            transaccionConRollback(cn);
            permisoNegado(cn);
        } catch (SQLException e) {
            System.err.println("Error de base de datos: " + e.getMessage() + " (código " + e.getErrorCode() + ")");
            System.exit(1);
        }
    }

    // SELECT con Statement y ResultSet
    static void consultarInventario(Connection cn) throws SQLException {
        System.out.println("\n2) Inventario disponible (Statement + ResultSet)");
        String sql = "SELECT id, CONCAT(marca, ' ', modelo) AS auto, anio, precio FROM vehiculos "
                   + "WHERE estado = 'disponible' ORDER BY precio LIMIT 5";
        try (Statement st = cn.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            while (rs.next()) {
                System.out.printf("   #%-3d %-24s %d  $%,.2f%n",
                        rs.getInt("id"), rs.getString("auto"), rs.getInt("anio"), rs.getBigDecimal("precio"));
            }
        }
    }

    // INSERT con PreparedStatement: los datos van como parámetros (?) → sin inyección SQL
    static void agregarCliente(Connection cn, String nombre, String email) throws SQLException {
        System.out.println("\n3) Alta de cliente (PreparedStatement)");
        try (PreparedStatement borrar = cn.prepareStatement("DELETE FROM clientes WHERE email = ? AND id NOT IN (SELECT cliente_id FROM ventas)")) {
            borrar.setString(1, email);
            borrar.executeUpdate();   // para poder correr el programa varias veces
        }
        String sql = "INSERT INTO clientes (nombre, telefono, email) VALUES (?, ?, ?)";
        try (PreparedStatement ps = cn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            ps.setString(1, nombre);
            ps.setString(2, "4770000000");
            ps.setString(3, email);
            ps.executeUpdate();
            try (ResultSet llaves = ps.getGeneratedKeys()) {
                if (llaves.next()) System.out.println("   Cliente '" + nombre + "' creado con id " + llaves.getLong(1));
            }
        }
        // Un intento de inyección se guarda como texto, no se ejecuta
        try (PreparedStatement ps = cn.prepareStatement("SELECT COUNT(*) FROM clientes WHERE nombre = ?")) {
            ps.setString(1, "' OR '1'='1");
            try (ResultSet rs = ps.executeQuery()) {
                rs.next();
                System.out.println("   Búsqueda con \"' OR '1'='1\": " + rs.getInt(1) + " resultados (la inyección no funciona)");
            }
        }
    }

    // CallableStatement: procedimiento con parámetro OUT y función
    static void registrarVenta(Connection cn) throws SQLException {
        System.out.println("\n4) Procedimiento almacenado (CallableStatement)");
        int vehiculo;
        try (Statement st = cn.createStatement();
             ResultSet rs = st.executeQuery("SELECT id FROM vehiculos WHERE estado = 'disponible' ORDER BY precio LIMIT 1")) {
            if (!rs.next()) {
                System.out.println("   No hay autos disponibles para vender.");
                return;
            }
            vehiculo = rs.getInt(1);
        }
        try (CallableStatement cs = cn.prepareCall("{call registrar_venta(?, ?, ?, ?, ?, ?, ?)}")) {
            cs.setInt(1, vehiculo);
            cs.setInt(2, 3);                               // cliente 3
            cs.setInt(3, 2);                               // asesora 2
            cs.setBigDecimal(4, new BigDecimal("250000.00"));
            cs.setBigDecimal(5, new BigDecimal("50000.00"));
            cs.setString(6, "tarjeta");
            cs.registerOutParameter(7, Types.INTEGER);
            cs.execute();
            int venta = cs.getInt(7);
            System.out.println("   Venta registrada con id " + venta + " (vehículo " + vehiculo + ")");
            try (CallableStatement f = cn.prepareCall("{? = call saldo_venta(?)}")) {
                f.registerOutParameter(1, Types.DECIMAL);
                f.setInt(2, venta);
                f.execute();
                System.out.printf("   Saldo pendiente (función saldo_venta): $%,.2f%n", f.getBigDecimal(1));
            }
        }
    }

    // Transacción controlada desde Java: commit/rollback
    static void transaccionConRollback(Connection cn) throws SQLException {
        System.out.println("\n5) Transacción con rollback");
        cn.setAutoCommit(false);
        try (Statement st = cn.createStatement()) {
            st.executeUpdate("UPDATE vehiculos SET precio = precio * 2 WHERE estado = 'disponible'");
            try (ResultSet rs = st.executeQuery("SELECT MIN(precio) FROM vehiculos WHERE estado = 'disponible'")) {
                rs.next();
                System.out.printf("   Dentro de la transacción, el más barato cuesta $%,.2f%n", rs.getBigDecimal(1));
            }
            cn.rollback();   // nos arrepentimos: nada se guarda
            try (ResultSet rs = st.executeQuery("SELECT MIN(precio) FROM vehiculos WHERE estado = 'disponible'")) {
                rs.next();
                System.out.printf("   Después del rollback vuelve a costar $%,.2f%n", rs.getBigDecimal(1));
            }
        } finally {
            cn.setAutoCommit(true);
        }
    }

    // El usuario de la aplicación tiene permisos mínimos (unidad 3)
    static void permisoNegado(Connection cn) {
        System.out.println("\n6) Permisos mínimos del usuario de la aplicación");
        try (Statement st = cn.createStatement()) {
            st.executeUpdate("DROP TABLE bitacora");
            System.out.println("   ¡Pudo borrar una tabla! (no debería)");
        } catch (SQLException e) {
            System.out.println("   DROP TABLE rechazado: " + e.getMessage());
        }
    }
}
