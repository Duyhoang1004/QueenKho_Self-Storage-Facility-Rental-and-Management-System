package com.queenkho.api.integration;

import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import java.nio.file.*;
import java.sql.*;
import java.util.UUID;
import java.util.regex.Pattern;
import static org.junit.jupiter.api.Assertions.*;

/** Executes the repository's REAL refund triggers against SQL Server, not H2 or mocks.
 * A disposable database is created with a random reserved name. Existing databases are never used.
 * Minimal tables supply the trigger contract; this is not a full application-context test.
 */
@Tag("sqlserver")
@EnabledIfEnvironmentVariable(named = "QK_SQLSERVER_TEST_SERVER", matches = ".+")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class SqlRefundTriggerBusinessTest {
    private String database;
    private Connection master;
    private Connection connection;

    @BeforeAll void createIsolatedDatabase() throws Exception {
        String server = System.getenv("QK_SQLSERVER_TEST_SERVER");
        if (!server.matches("[a-zA-Z0-9_.:-]+")) throw new IllegalArgumentException("Invalid test server");
        String user = System.getenv("QK_SQLSERVER_TEST_USER");
        String password = System.getenv("QK_SQLSERVER_TEST_PASSWORD");
        assertNotNull(user, "Set QK_SQLSERVER_TEST_USER");
        assertNotNull(password, "Set QK_SQLSERVER_TEST_PASSWORD");
        String url = "jdbc:sqlserver://" + server + ";encrypt=true;trustServerCertificate=true;loginTimeout=5;";
        master = DriverManager.getConnection(url + "databaseName=master", user, password);
        database = "QueenKho_Test_" + UUID.randomUUID().toString().replace("-", "");
        try (Statement s = master.createStatement()) { s.execute("CREATE DATABASE [" + database + "]"); }
        connection = DriverManager.getConnection(url + "databaseName=" + database, user, password);
        execute("CREATE TABLE reservations(id INT PRIMARY KEY,reservation_code NVARCHAR(50),status NVARCHAR(30))");
        execute("CREATE TABLE rental_contracts(id INT PRIMARY KEY,reservation_id INT,status NVARCHAR(30),deposit_held_amount DECIMAL(12,2))");
        execute("CREATE TABLE facility_tasks(id INT PRIMARY KEY,task_type NVARCHAR(30),contract_id INT,status NVARCHAR(30),note NVARCHAR(1000))");
        execute("CREATE TABLE payment_transactions(id INT PRIMARY KEY,transaction_code NVARCHAR(50),reservation_id INT,contract_id INT,"
                + "payment_type NVARCHAR(30),payment_method NVARCHAR(30),status NVARCHAR(30),amount DECIMAL(12,2),paid_at DATETIME2)");
    }

    @BeforeEach void beginTransaction() throws Exception {
        connection.setAutoCommit(false);
        execute("INSERT INTO reservations VALUES(20,'RES-TEST','UNIT_ASSIGNED')");
        execute("INSERT INTO rental_contracts VALUES(30,20,'ACTIVE',1000000)");
        execute("INSERT INTO facility_tasks VALUES(40,'REFUND',30,'OPEN','Mã gốc: QKR-OLD')");
        execute("INSERT INTO payment_transactions VALUES(50,'REF-LATE-QKR-OLD',20,30,'REFUND','BANK_TRANSFER','PENDING',500000,NULL)");
    }

    @AfterEach void rollback() throws Exception {
        if (connection != null) { connection.rollback(); connection.setAutoCommit(true); }
    }

    @AfterAll void removeOnlyOwnedDatabase() throws Exception {
        if (connection != null) connection.close();
        if (master != null) {
            try {
                // Verify the exact generated identifier before any DROP, including on setup failure.
                if (database != null && database.matches("QueenKho_Test_[a-f0-9]{32}")) {
                    try (Statement s = master.createStatement()) {
                        s.execute("ALTER DATABASE [" + database + "] SET SINGLE_USER WITH ROLLBACK IMMEDIATE");
                        s.execute("DROP DATABASE [" + database + "]");
                    }
                }
            } finally { master.close(); }
        }
    }

    private void execute(String sql) throws Exception {
        try (Statement s = connection.createStatement()) { s.execute(sql); }
    }

    private String scalar(String sql) throws Exception {
        try (Statement s = connection.createStatement(); ResultSet rs = s.executeQuery(sql)) {
            assertTrue(rs.next()); return rs.getString(1);
        }
    }

    private void installTriggers(String source) throws Exception {
        Path scripts = Path.of("../../sql_script").toAbsolutePath().normalize();
        String sql = Files.readString(scripts.resolve(source));
        for (String trigger : new String[]{"trg_facility_tasks_refund_sync", "trg_payment_transactions_refund_sync"}) {
            var matcher = Pattern.compile("(?ms)^CREATE OR ALTER TRIGGER " + trigger + "\\b.*?(?=^GO\\s*$)").matcher(sql);
            assertTrue(matcher.find(), "Missing trigger in " + source + ": " + trigger);
            execute(matcher.group());
        }
    }

    @ParameterizedTest @ValueSource(strings = {"QueenKho_full.sql", "QueenKho_TongHop.sql"})
    void B01_latePaymentRefundMustNotTerminateLiveRental(String source) throws Exception {
        installTriggers(source);
        execute("UPDATE facility_tasks SET status='COMPLETED' WHERE id=40");
        assertAll(() -> assertEquals("ACTIVE", scalar("SELECT status FROM rental_contracts WHERE id=30")),
                () -> assertEquals("1000000.00", scalar("SELECT deposit_held_amount FROM rental_contracts WHERE id=30")));
    }

    @ParameterizedTest @ValueSource(strings = {"QueenKho_full.sql", "QueenKho_TongHop.sql"})
    void normalCheckoutRefundMayCloseRentalAndClearDeposit(String source) throws Exception {
        installTriggers(source);
        execute("UPDATE rental_contracts SET status='TERMINATED' WHERE id=30");
        execute("UPDATE facility_tasks SET note='Đơn: RES-TEST',status='COMPLETED' WHERE id=40");
        assertEquals("TERMINATED", scalar("SELECT status FROM rental_contracts WHERE id=30"));
        assertEquals("0.00", scalar("SELECT deposit_held_amount FROM rental_contracts WHERE id=30"),
                "Completed ordinary refund must clear the deposit even if inspection already terminated the contract");
    }

    @ParameterizedTest @ValueSource(strings = {"QueenKho_full.sql", "QueenKho_TongHop.sql"})
    void liquidationMustKeepItsDistinctStatusAfterRefund(String source) throws Exception {
        installTriggers(source);
        execute("UPDATE rental_contracts SET status='LIQUIDATED' WHERE id=30");
        execute("UPDATE facility_tasks SET status='COMPLETED' WHERE id=40");
        assertEquals("LIQUIDATED", scalar("SELECT status FROM rental_contracts WHERE id=30"));
    }

    @ParameterizedTest @ValueSource(strings = {"QueenKho_full.sql", "QueenKho_TongHop.sql"})
    void successfulExcessRefundMustNotMarkActiveBookingRefunded(String source) throws Exception {
        installTriggers(source);
        execute("UPDATE payment_transactions SET status='SUCCESS' WHERE id=50");
        assertEquals("UNIT_ASSIGNED", scalar("SELECT status FROM reservations WHERE id=20"));
    }

    @ParameterizedTest @ValueSource(strings = {"QueenKho_full.sql", "QueenKho_TongHop.sql"})
    void completingNonRefundTaskCannotCloseRental(String source) throws Exception {
        installTriggers(source);
        execute("UPDATE facility_tasks SET task_type='SUPPORT',status='COMPLETED' WHERE id=40");
        assertEquals("ACTIVE", scalar("SELECT status FROM rental_contracts WHERE id=30"));
    }

    @ParameterizedTest @ValueSource(strings = {"QueenKho_full.sql", "QueenKho_TongHop.sql"})
    void unrelatedFailedRefundMustNotBecomeSuccessful(String source) throws Exception {
        installTriggers(source);
        execute("INSERT INTO payment_transactions VALUES(51,'REF-UNRELATED',20,30,'REFUND','BANK_TRANSFER','FAILED',200000,NULL)");
        execute("UPDATE facility_tasks SET note='Đơn: RES-TEST',status='COMPLETED' WHERE id=40");
        assertEquals("FAILED", scalar("SELECT status FROM payment_transactions WHERE id=51"));
    }
}
