package com.queenkho.api.integration;

import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import java.util.*;
import java.util.regex.Pattern;
import static org.junit.jupiter.api.Assertions.*;

/** Real HTTP/DB smoke checks. Does not create bookings, payments or notifications.
 * Login/logout do record normal login history. Uses only explicitly supplied test credentials.
 * QK_API_BASE_URL includes /api/v1; QK_API_PASSWORD is the shared test-account password.
 */
@Tag("api")
@EnabledIfEnvironmentVariable(named = "QK_API_BASE_URL", matches = ".+")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class ApiAuthorizationSmokeTest {
    final HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    final Map<String, String> sessions = new HashMap<>();
    String base;

    @BeforeAll void loginTestRoles() throws Exception {
        base = System.getenv("QK_API_BASE_URL").replaceAll("/+$", "");
        assertTrue(base.startsWith("http://") || base.startsWith("https://"));
        String password = System.getenv("QK_API_PASSWORD");
        assertNotNull(password, "Set QK_API_PASSWORD; credentials are never printed");
        try {
            for (String role : List.of("CUSTOMER", "STAFF", "FACILITY_MANAGER", "BOM", "ADMIN")) {
                String email = System.getenv("QK_API_" + role + "_EMAIL");
                assertNotNull(email, "Set QK_API_" + role + "_EMAIL");
                var response = post("/auth/login", "{\"email\":\"" + json(email)
                        + "\",\"password\":\"" + json(password) + "\"}", null);
                assertEquals(200, response.statusCode(), "Test role could not log in: " + role);
                assertEquals(role, field(response.body(), "role"), "Wrong role in test fixture");
                sessions.put(role, field(response.body(), "token"));
            }
        } catch (Throwable ex) {
            logoutTestRoles();
            throw ex;
        }
    }

    @AfterAll void logoutTestRoles() throws Exception {
        for (String token : sessions.values()) {
            post("/auth/logout", "{}", token);
        }
        sessions.clear();
    }

    private static String json(String text) {
        return text.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private static String field(String json, String field) {
        var match = Pattern.compile("\"" + field + "\"\\s*:\\s*\"([^\"]+)\"").matcher(json);
        assertTrue(match.find(), "Missing response field: " + field);
        return match.group(1);
    }

    private HttpResponse<String> get(String path, String token) throws Exception {
        var builder = HttpRequest.newBuilder(URI.create(base + path)).timeout(Duration.ofSeconds(10));
        if (token != null) builder.header("Authorization", "Bearer " + token);
        return client.send(builder.GET().build(), HttpResponse.BodyHandlers.ofString());
    }

    private HttpResponse<String> post(String path, String body, String token) throws Exception {
        var builder = HttpRequest.newBuilder(URI.create(base + path)).timeout(Duration.ofSeconds(10))
                .header("Content-Type", "application/json");
        if (token != null) builder.header("Authorization", "Bearer " + token);
        return client.send(builder.POST(HttpRequest.BodyPublishers.ofString(body)).build(), HttpResponse.BodyHandlers.ofString());
    }

    @ParameterizedTest @CsvSource({
            "CUSTOMER,/reservations/my", "CUSTOMER,/payments/my", "CUSTOMER,/support-requests",
            "FACILITY_MANAGER,/reservations/pending", "FACILITY_MANAGER,/claims",
            "BOM,/claims", "BOM,/contracts/overdue-all", "ADMIN,/admin/users"})
    void authorizedRoleCanLoadItsBusinessData(String role, String path) throws Exception {
        assertEquals(200, get(path, sessions.get(role)).statusCode(), role + " " + path);
    }

    @ParameterizedTest @CsvSource({
            "CUSTOMER,/admin/users", "CUSTOMER,/claims", "CUSTOMER,/contracts/overdue-all",
            "STAFF,/admin/users", "STAFF,/claims", "BOM,/reservations/my", "ADMIN,/reservations/my"})
    void wrongRoleCannotReadBusinessData(String role, String path) throws Exception {
        assertEquals(403, get(path, sessions.get(role)).statusCode(), role + " " + path);
    }

    @Test void missingSessionCannotReadCustomerReservations() throws Exception {
        assertEquals(401, get("/reservations/my", null).statusCode());
    }

    @Test void expiredOrForgedSessionCannotReadCustomerReservations() throws Exception {
        assertEquals(401, get("/reservations/my", "invalid-test-token").statusCode());
    }

    @Test void publicInsuranceCatalogDoesNotRequireLogin() throws Exception {
        var response = get("/insurance-plans", null);
        assertEquals(200, response.statusCode());
        assertTrue(response.body().contains("PREMIUM"));
    }

    @Test void invalidLoginIsUnauthorizedRatherThanServerError() throws Exception {
        assertEquals(401, post("/auth/login",
                "{\"email\":\"nonexistent-business-test@example.invalid\",\"password\":\"invalid\"}", null).statusCode());
    }
}
