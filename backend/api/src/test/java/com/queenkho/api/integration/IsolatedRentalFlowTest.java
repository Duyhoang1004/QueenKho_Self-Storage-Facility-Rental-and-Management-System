package com.queenkho.api.integration;

import com.queenkho.api.ApiApplication;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.net.*;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.sql.*;
import java.time.*;
import java.util.*;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import static org.junit.jupiter.api.Assertions.*;

/** Actual Spring HTTP + SQL Server lifecycle, with a separate randomly named disposable DB.
 * No Docker, real VNPAY requests or SMTP needed. IPNs are signed with a test-only secret.
 * Never runs a database reset script against QueenKhoDB or the developer's current server.
 */
@Tag("sqlserver")
@Tag("flow")
@EnabledIfEnvironmentVariable(named = "QK_SQLSERVER_TEST_SERVER", matches = ".+")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class IsolatedRentalFlowTest {
    static final String SECRET = "isolated-flow-test-merchant-secret";
    static final String EVIDENCE = "https://example.invalid/evidence.jpg";
    final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    final Map<String, String> tokens = new HashMap<>();
    Connection master;
    Connection db;
    String database;
    String origin;
    ConfigurableApplicationContext application;

    @BeforeAll void startIsolatedApplication() throws Exception {
        String server = System.getenv("QK_SQLSERVER_TEST_SERVER");
        assertTrue(server.matches("[a-zA-Z0-9_.:-]+"), "Invalid test SQL Server address");
        String user = Objects.requireNonNull(System.getenv("QK_SQLSERVER_TEST_USER"));
        String password = Objects.requireNonNull(System.getenv("QK_SQLSERVER_TEST_PASSWORD"));
        String url = "jdbc:sqlserver://" + server + ";encrypt=true;trustServerCertificate=true;loginTimeout=5;";
        master = DriverManager.getConnection(url + "databaseName=master", user, password);
        database = "QueenKho_FlowTest_" + UUID.randomUUID().toString().replace("-", "");
        try (Statement s = master.createStatement()) { s.execute("CREATE DATABASE [" + database + "]"); }
        String testUrl = url + "databaseName=" + database;
        db = DriverManager.getConnection(testUrl, user, password);
        initializeOnlyTestDatabase();
        application = new SpringApplicationBuilder(ApiApplication.class).run(
                "--server.port=0", "--spring.datasource.url=" + testUrl,
                "--spring.datasource.username=" + user, "--spring.datasource.password=" + password,
                "--spring.jpa.show-sql=false", "--queenkho.mail.enabled=false",
                "--vnpay.hash-secret=" + SECRET, "--vnpay.tmn-code=TEST",
                "--logging.level.root=WARN", "--spring.main.banner-mode=off");
        origin = "http://localhost:" + application.getEnvironment().getProperty("local.server.port");
        tokens.put("customer", login("khachhang1@gmail.com"));
        tokens.put("other", login("khachhang2@gmail.com"));
        tokens.put("manager", login("fmtanbinh@gmail.com"));
        tokens.put("staff", login("stafftanbinh1@gmail.com"));
    }

    void initializeOnlyTestDatabase() throws Exception {
        assertTrue(database.matches("QueenKho_FlowTest_[a-f0-9]{32}"));
        String sql = Files.readString(Path.of("../../sql_script/QueenKho_full.sql"));
        int schemaStart = sql.indexOf("CREATE TABLE roles (");
        assertTrue(schemaStart > 0, "Expected schema marker missing: refuse to run reset script");
        String schemaAndSeed = sql.substring(schemaStart);
        // Reject any future database-level statement added after the schema marker.
        assertFalse(Pattern.compile("(?im)^\\s*(USE\\b|(?:CREATE|ALTER|DROP)\\s+DATABASE\\b)")
                .matcher(schemaAndSeed).find(), "Unsafe database-level command after schema marker");
        for (String batch : schemaAndSeed.split("(?im)^GO\\s*$")) {
            if (!batch.isBlank()) execute(batch);
        }
    }

    @AfterEach void releaseOnlyThisDisposableFixture() throws Exception {
        if (db != null && !db.isClosed()) {
            execute("UPDATE facility_tasks SET status='CANCELLED' WHERE status IN ('OPEN','IN_PROGRESS','OVERDUE')");
            execute("UPDATE reservations SET status='COMPLETED'");
            execute("UPDATE rental_contracts SET status='TERMINATED',access_pin_code=NULL,rfid_card_code=NULL");
            execute("UPDATE storage_units SET status='AVAILABLE'");
            execute("UPDATE payment_transactions SET status='FAILED' WHERE status='PENDING' AND payment_type IN ('DAMAGE_FEE','OVERSTAY_FEE')");
        }
    }

    @AfterAll void closeApplicationAndRemoveOnlyGeneratedDatabase() throws Exception {
        if (application != null) application.close();
        if (db != null) db.close();
        if (master != null) {
            try {
                if (database != null && database.matches("QueenKho_FlowTest_[a-f0-9]{32}")) {
                    try (Statement s = master.createStatement()) {
                        s.execute("ALTER DATABASE [" + database + "] SET SINGLE_USER WITH ROLLBACK IMMEDIATE");
                        s.execute("DROP DATABASE [" + database + "]");
                    }
                }
            } finally { master.close(); }
        }
    }

    void execute(String sql) throws Exception {
        try (Statement s = db.createStatement()) { s.execute(sql); }
    }

    String scalar(String sql) throws Exception {
        try (Statement s = db.createStatement(); ResultSet rs = s.executeQuery(sql)) {
            assertTrue(rs.next(), "No result for fixture query"); return rs.getString(1);
        }
    }

    static String field(String body, String name) {
        var match = Pattern.compile("\"" + name + "\"\\s*:\\s*(?:\"([^\"]*)\"|([0-9.]+))").matcher(body);
        assertTrue(match.find(), "Missing field " + name + " in business response");
        return match.group(1) != null ? match.group(1) : match.group(2);
    }

    String post(String path, String body, String role, int expected) throws Exception {
        var request = HttpRequest.newBuilder(URI.create(origin + path)).timeout(Duration.ofSeconds(20))
                .header("Content-Type", "application/json");
        if (role != null) request.header("Authorization", "Bearer " + tokens.get(role));
        var response = http.send(request.POST(HttpRequest.BodyPublishers.ofString(body)).build(), HttpResponse.BodyHandlers.ofString());
        assertEquals(expected, response.statusCode(), path + " failed: " + (response.statusCode() == 200 ? "" : response.body()));
        return response.body();
    }

    String login(String email) throws Exception {
        return field(post("/api/v1/auth/login", "{\"email\":\"" + email + "\",\"password\":\"123456\"}", null, 200), "token");
    }

    String confirmPayment(String reference, String amount) throws Exception {
        Map<String, String> parameters = new TreeMap<>(Map.of("vnp_TxnRef", reference,
                "vnp_Amount", new BigDecimal(amount).multiply(BigDecimal.valueOf(100)).toPlainString(),
                "vnp_ResponseCode", "00", "vnp_TransactionStatus", "00", "vnp_TransactionNo", "TEST-BANK-" + reference));
        String query = parameters.entrySet().stream().map(e -> URLEncoder.encode(e.getKey(), StandardCharsets.UTF_8)
                + "=" + URLEncoder.encode(e.getValue(), StandardCharsets.UTF_8)).collect(Collectors.joining("&"));
        Mac mac = Mac.getInstance("HmacSHA512");
        mac.init(new SecretKeySpec(SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA512"));
        String hash = HexFormat.of().formatHex(mac.doFinal(query.getBytes(StandardCharsets.UTF_8)));
        var response = http.send(HttpRequest.newBuilder(URI.create(origin + "/api/payments/vnpay/ipn?" + query
                + "&vnp_SecureHash=" + hash)).timeout(Duration.ofSeconds(20)).GET().build(), HttpResponse.BodyHandlers.ofString());
        assertEquals(200, response.statusCode());
        return field(response.body(), "RspCode");
    }

    record Rental(int reservation, int contract, String unit) {}

    Rental bookPayAssign(String insurance) throws Exception {
        String reservation = post("/api/v1/reservations", """
                {"customerId":9999,"facilityId":1,"unitTypeId":1,"startDate":"%s","durationMonths":3,
                 "acceptedTerms":true,"cccd":"079000000001","phone":"0900000000","insurancePlan":"%s"}
                """.formatted(LocalDate.now(), insurance), "customer", 201);
        int id = Integer.parseInt(field(reservation, "id"));
        assertEquals(scalar("SELECT id FROM users WHERE email='khachhang1@gmail.com'"),
                scalar("SELECT customer_id FROM reservations WHERE id=" + id), "Client cannot forge owner id");
        post("/api/payments/vnpay/create", "{\"reservationId\":" + id + "}", "other", 403);
        String payment = post("/api/payments/vnpay/create", "{\"reservationId\":" + id + "}", "customer", 200);
        assertEquals("00", confirmPayment(field(payment, "orderId"), field(payment, "amount")));
        assertEquals("02", confirmPayment(field(payment, "orderId"), field(payment, "amount")), "Duplicate IPN must be idempotent");
        String unit = scalar("SELECT TOP 1 id FROM storage_units WHERE facility_id=1 AND unit_type_id=1 AND status='AVAILABLE' ORDER BY id");
        post("/api/v1/reservations/" + id + "/assign", "{\"storageUnitId\":\"" + unit + "\"}", "manager", 200);
        int contract = Integer.parseInt(scalar("SELECT id FROM rental_contracts WHERE reservation_id=" + id));
        execute("UPDATE facility_tasks SET due_at=DATEADD(hour,1,SYSDATETIME()) WHERE contract_id=" + contract);
        return new Rental(id, contract, unit);
    }

    // UC-18: Staff nhận task CHECK_IN rồi lập biên bản tại quầy (check-in online đã bỏ 06/11/2026 — D-16)
    void counterCheckIn(Rental rental) throws Exception {
        String task = scalar("SELECT id FROM facility_tasks WHERE contract_id=" + rental.contract + " AND task_type='CHECK_IN'");
        post("/api/v1/staff-tasks/" + task + "/claim", "{}", "staff", 200);
        post("/api/v1/staff-tasks/" + task + "/check-in", """
                {"identityVerified":true,"unitEmpty":true,"unitClean":true,"lockIntact":true,
                 "customerSignatureConfirmed":true,"goodsChecked":true,
                 "accessPinCode":"%06d","rfidCardCode":"RFID-IT-%d","evidenceImages":["%s"]}
                """.formatted(rental.contract % 1_000_000, rental.contract, EVIDENCE), "staff", 200);
        assertEquals("ACTIVE", scalar("SELECT status FROM rental_contracts WHERE id=" + rental.contract));
        assertNotNull(scalar("SELECT access_pin_code FROM rental_contracts WHERE id=" + rental.contract));
    }

    @Test void bookingPaymentAssignmentAndCounterCheckIn() throws Exception {
        Rental r = bookPayAssign("ADVANCED");
        assertEquals("50000.00", scalar("SELECT insurance_premium_monthly FROM reservations WHERE id=" + r.reservation));
        counterCheckIn(r);
        assertEquals("COUNTER", scalar("SELECT check_in_method FROM handover_records WHERE contract_id=" + r.contract));
        assertEquals("OCCUPIED", scalar("SELECT status FROM storage_units WHERE id='" + r.unit + "'"));
    }

    @Test void renewalExtendsExistingPeriodAndKeepsUnit() throws Exception {
        Rental r = bookPayAssign("BASIC"); counterCheckIn(r);
        LocalDate oldEnd = LocalDate.parse(scalar("SELECT end_date FROM rental_contracts WHERE id=" + r.contract));
        String payment = post("/api/payments/vnpay/create-renewal",
                "{\"contractId\":" + r.contract + ",\"months\":3}", "customer", 200);
        assertEquals("00", confirmPayment(field(payment, "orderId"), field(payment, "amount")));
        assertEquals(oldEnd.plusMonths(3).toString(), scalar("SELECT end_date FROM rental_contracts WHERE id=" + r.contract));
        assertEquals(r.unit, scalar("SELECT storage_unit_id FROM rental_contracts WHERE id=" + r.contract));
    }

    @Test @Tag("regression")
    void B02_reissuingDebtLinkMustNotLoseSuccessfulOldAttempt() throws Exception {
        Rental r = bookPayAssign("BASIC"); counterCheckIn(r);
        execute("INSERT INTO payment_transactions(transaction_code,user_id,reservation_id,contract_id,payment_type,payment_method,status,amount) "
                + "SELECT 'TEST-DEBT-" + r.contract + "',customer_id,reservation_id,id,'DAMAGE_FEE','VNPAY','PENDING',250000 "
                + "FROM rental_contracts WHERE id=" + r.contract);
        String debt = scalar("SELECT id FROM payment_transactions WHERE transaction_code='TEST-DEBT-" + r.contract + "'");
        String first = post("/api/payments/vnpay/create-debt", "{\"paymentId\":" + debt + "}", "customer", 200);
        String second = post("/api/payments/vnpay/create-debt", "{\"paymentId\":" + debt + "}", "customer", 200);
        assertNotEquals(field(first, "orderId"), field(second, "orderId"));
        assertEquals("00", confirmPayment(field(first, "orderId"), field(first, "amount")),
                "The old valid payment attempt must still be reconciled or refunded");
    }

    @Test @Tag("regression")
    void B05_lateRenewalAfterTerminationMustBeRefundedNotApplied() throws Exception {
        Rental r = bookPayAssign("BASIC"); counterCheckIn(r);
        String oldEnd = scalar("SELECT end_date FROM rental_contracts WHERE id=" + r.contract);
        String payment = post("/api/payments/vnpay/create-renewal",
                "{\"contractId\":" + r.contract + ",\"months\":3}", "customer", 200);
        // Another workflow completed after link creation but before the bank callback.
        execute("UPDATE rental_contracts SET status='TERMINATED' WHERE id=" + r.contract);
        assertEquals("00", confirmPayment(field(payment, "orderId"), field(payment, "amount")));
        assertEquals(oldEnd, scalar("SELECT end_date FROM rental_contracts WHERE id=" + r.contract));
        assertEquals("1", scalar("SELECT COUNT(*) FROM payment_transactions WHERE transaction_code='REF-LATE-"
                + field(payment, "orderId") + "' AND status='PENDING'"));
    }

    @Test void checkoutInspectionAndRefundReleaseUnit() throws Exception {
        Rental r = bookPayAssign("BASIC"); counterCheckIn(r);
        post("/api/v1/contracts/" + r.contract + "/request-checkout", """
                {"checkoutDate":"%s","refundMethod":"CASH"}
                """.formatted(LocalDate.now().plusDays(1)), "customer", 200);
        String task = scalar("SELECT id FROM facility_tasks WHERE contract_id=" + r.contract + " AND task_type='CHECK_OUT' AND status='OPEN'");
        execute("UPDATE facility_tasks SET due_at=DATEADD(hour,1,SYSDATETIME()) WHERE id=" + task);
        post("/api/v1/staff-tasks/" + task + "/claim", "{}", "staff", 200);
        post("/api/v1/staff-tasks/" + task + "/check-out", """
                {"identityVerified":true,"unitEmpty":true,"unitClean":true,"lockIntact":true,
                 "customerSignatureConfirmed":true,"evidenceImages":["%s"]}
                """.formatted(EVIDENCE), "staff", 200);
        assertEquals("TERMINATED", scalar("SELECT status FROM rental_contracts WHERE id=" + r.contract));
        assertEquals("AVAILABLE", scalar("SELECT status FROM storage_units WHERE id='" + r.unit + "'"));
        String refund = scalar("SELECT id FROM facility_tasks WHERE contract_id=" + r.contract + " AND task_type='REFUND'");
        post("/api/v1/staff-tasks/" + refund + "/complete-refund",
                "{\"paymentMethod\":\"CASH\",\"cashReceiptConfirmed\":true}", "manager", 200);
        assertEquals("0", scalar("SELECT COUNT(*) FROM payment_transactions WHERE contract_id=" + r.contract + " AND payment_type='REFUND' AND status='PENDING'"));
    }

    @Test void supportCreatesStaffWorkAndResolvesForCustomer() throws Exception {
        Rental r = bookPayAssign("BASIC"); counterCheckIn(r);
        String ticket = post("/api/v1/support-requests", """
                {"contractId":%d,"issueType":"LOCK_ISSUE","description":"The lock cannot open with the current PIN"}
                """.formatted(r.contract), "customer", 201);
        String id = field(ticket, "id");
        String task = scalar("SELECT id FROM facility_tasks WHERE support_request_id=" + id);
        post("/api/v1/staff-tasks/" + task + "/claim", "{}", "staff", 200);
        post("/api/v1/staff-tasks/" + task + "/resolve-support",
                "{\"resolutionNote\":\"Lock repaired and tested with customer\"}", "staff", 200);
        assertEquals("RESOLVED", scalar("SELECT status FROM support_requests WHERE id=" + id));
    }

    @Test void damageInspectionDecisionAndPayoutRemainSeparateSteps() throws Exception {
        Rental r = bookPayAssign("BASIC"); counterCheckIn(r);
        String ticket = post("/api/v1/support-requests", """
                {"contractId":%d,"issueType":"GOODS_DAMAGE","description":"Water damaged the stored boxes",
                 "incidentDate":"%s","itemsDescription":"Two boxes with original invoices","claimedAmount":2000000,
                 "evidenceImages":["%s"]}
                """.formatted(r.contract, LocalDate.now(), EVIDENCE), "customer", 201);
        String ticketId = field(ticket, "id");
        String task = scalar("SELECT id FROM facility_tasks WHERE support_request_id=" + ticketId);
        post("/api/v1/staff-tasks/" + task + "/claim", "{}", "staff", 200);
        post("/api/v1/staff-tasks/" + task + "/resolve-support", """
                {"resolutionNote":"Water entry confirmed during inspection","preliminaryCause":"FACILITY","inspectionImages":["%s"]}
                """.formatted(EVIDENCE), "staff", 200);
        String claim = scalar("SELECT id FROM compensation_claims WHERE support_request_id=" + ticketId);
        assertEquals("INSPECTED", scalar("SELECT status FROM compensation_claims WHERE id=" + claim));
        post("/api/v1/claims/" + claim + "/decide", """
                {"liableParty":"FACILITY","assessedValue":2000000,"damagePercent":50,"unusableDays":1,
                 "resolution":"CONTINUE","note":"Inspection confirms responsibility of the facility"}
                """, "manager", 200);
        assertEquals("APPROVED", scalar("SELECT status FROM compensation_claims WHERE id=" + claim));
        post("/api/v1/claims/" + claim + "/pay", "{\"paymentMethod\":\"CASH\",\"cashReceiptConfirmed\":true}", "manager", 200);
        assertEquals("PAID", scalar("SELECT status FROM compensation_claims WHERE id=" + claim));
        assertEquals("1", scalar("SELECT COUNT(*) FROM payment_transactions WHERE contract_id=" + r.contract + " AND payment_type='COMPENSATION' AND status='SUCCESS'"));
    }

    @Test void overdueLiquidationRequiresContactAndGoodsInventoryBeforeRelease() throws Exception {
        Rental r = bookPayAssign("BASIC"); counterCheckIn(r);
        execute("UPDATE rental_contracts SET status='OVERDUE',start_date=DATEADD(month,-4,CAST(GETDATE() AS date)),"
                + "end_date=DATEADD(day,-16,CAST(GETDATE() AS date)) WHERE id=" + r.contract);
        post("/api/v1/contracts/" + r.contract + "/liquidate",
                "{\"note\":\"Overdue contract ready for liquidation\"}", "manager", 409);
        for (int attempt = 1; attempt <= 3; attempt++) {
            post("/api/v1/contracts/" + r.contract + "/overdue-contacts",
                    "{\"note\":\"Contact attempt " + attempt + ": customer did not respond\"}", "manager", 200);
        }
        post("/api/v1/contracts/" + r.contract + "/liquidate",
                "{\"note\":\"Repeated contact attempts exhausted; inventory required\"}", "manager", 200);
        assertEquals("LIQUIDATED", scalar("SELECT status FROM rental_contracts WHERE id=" + r.contract));
        assertEquals("MAINTENANCE", scalar("SELECT status FROM storage_units WHERE id='" + r.unit + "'"));
        String task = scalar("SELECT id FROM facility_tasks WHERE contract_id=" + r.contract + " AND maintenance_reason='LIQUIDATION'");
        post("/api/v1/staff-tasks/" + task + "/claim", "{}", "staff", 200);
        post("/api/v1/staff-tasks/" + task + "/complete-maintenance", """
                {"note":"Goods inventoried and moved into the holding area","noGoodsLeft":false,
                 "inventoryNote":"Two sealed boxes and one wooden shelf","witnessNote":"Manager Test and Staff Test witnessed opening",
                 "storageLocation":"Holding area H1","inventoryImages":["%s"]}
                """.formatted(EVIDENCE), "staff", 200);
        assertEquals("1", scalar("SELECT COUNT(*) FROM held_goods WHERE contract_id=" + r.contract));
        assertEquals("AVAILABLE", scalar("SELECT status FROM storage_units WHERE id='" + r.unit + "'"));
    }
}
