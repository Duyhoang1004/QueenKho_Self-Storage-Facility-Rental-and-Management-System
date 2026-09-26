package com.queenkho.api.controller;

import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/payments/sepay-pg")
public class SepayPGController {

    private static final String MERCHANT_ID = "SP-TEST-BVAB264A";
    private static final String SECRET_KEY =
            "spsk_test_n1bw2dzDmSA2r7pDKrcVC35zLQPj7uFV";
    private static final String CHECKOUT_URL =
            "https://pay-sandbox.sepay.vn/v1/checkout/init";
    private static final String SUCCESS_URL =
            "http://localhost:5173/booking/confirmation";
    private static final String BOOKING_URL =
            "http://localhost:5173/tim-va-dat-kho";
    private static final Pattern INVOICE_PATTERN =
            Pattern.compile("^QK-RSV-(\\d+)-\\d+$");

    private final JdbcTemplate jdbcTemplate;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .followRedirects(HttpClient.Redirect.NEVER)
            .build();

    public SepayPGController(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public record CreatePaymentRequest(Integer reservationId) {}

    @PostMapping("/create")
    public Map<String, Object> createPayment(
            @RequestBody CreatePaymentRequest request) {

        if (request == null || request.reservationId() == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "reservationId is required");
        }

        Map<String, Object> reservation = findReservation(request.reservationId());
        String status = String.valueOf(reservation.get("status"));
        if (!"PENDING".equalsIgnoreCase(status)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "Reservation is not waiting for deposit");
        }

        BigDecimal amount = calculateFirstPayment(reservation);
        String amountText = amount.setScale(0, RoundingMode.UNNECESSARY)
                .toPlainString();
        String invoiceNumber = "QK-RSV-" + request.reservationId()
                + "-" + System.currentTimeMillis();

        LinkedHashMap<String, String> fields = new LinkedHashMap<>();
        fields.put("order_amount", amountText);
        fields.put("merchant", MERCHANT_ID);
        fields.put("currency", "VND");
        fields.put("operation", "PURCHASE");
        fields.put("order_description",
                "QueenKho first payment for reservation "
                        + request.reservationId());
        fields.put("order_invoice_number", invoiceNumber);
        fields.put("customer_id",
                String.valueOf(reservation.get("customer_id")));
        fields.put("success_url", SUCCESS_URL);
        fields.put("error_url", BOOKING_URL + "?payment=failed");
        fields.put("cancel_url", BOOKING_URL + "?payment=failed");
        fields.put("signature", sign(fields));

        HttpRequest sepayRequest = HttpRequest.newBuilder(URI.create(CHECKOUT_URL))
                .timeout(Duration.ofSeconds(20))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString(toFormBody(fields)))
                .build();

        try {
            HttpResponse<String> response = httpClient.send(
                    sepayRequest, HttpResponse.BodyHandlers.ofString());
            String location = response.headers()
                    .firstValue("Location")
                    .orElse(null);

            if (response.statusCode() < 300
                    || response.statusCode() >= 400
                    || location == null) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_GATEWAY,
                        "SePay did not return a checkout URL");
            }

            String payUrl = URI.create(CHECKOUT_URL)
                    .resolve(location)
                    .toString();
            return Map.of(
                    "payUrl", payUrl,
                    "amount", amount,
                    "depositAmount", reservation.get("base_price_monthly"));
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY, "SePay request was interrupted");
        } catch (java.io.IOException exception) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY, "Cannot connect to SePay Sandbox");
        }
    }

    @PostMapping("/ipn")
    @Transactional
    public Map<String, Object> receiveIpn(
            @RequestHeader(value = "X-Secret-Key", required = false)
            String receivedSecret,
            @RequestBody Map<String, Object> body) {

        if (!sameSecret(receivedSecret, SECRET_KEY)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,
                    "Invalid X-Secret-Key");
        }

        if (!"ORDER_PAID".equals(text(body, "notification_type"))) {
            return Map.of("success", true, "ignored", true);
        }

        Map<String, Object> order = object(body, "order");
        Map<String, Object> transaction = object(body, "transaction");
        if (!"CAPTURED".equals(text(order, "order_status"))
                || !"APPROVED".equals(
                        text(transaction, "transaction_status"))
                || !"PAYMENT".equals(
                        text(transaction, "transaction_type"))
                || !"VND".equals(text(order, "order_currency"))
                || !"VND".equals(
                        text(transaction, "transaction_currency"))) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Payment is not approved");
        }

        Integer reservationId = reservationIdFromInvoice(
                text(order, "order_invoice_number"));
        Map<String, Object> reservation = findReservation(reservationId);
        BigDecimal expectedAmount = calculateFirstPayment(reservation);
        BigDecimal receivedAmount = parseAmount(
                text(transaction, "transaction_amount"));
        BigDecimal orderAmount = parseAmount(
                text(order, "order_amount"));

        if (expectedAmount.compareTo(receivedAmount) != 0
                || expectedAmount.compareTo(orderAmount) != 0) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Payment amount does not match first payment");
        }

        String transactionCode =
                text(transaction, "transaction_id");
        if (transactionCode.isBlank() || transactionCode.length() > 50) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Invalid transaction id");
        }

        Integer existed = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM payment_transactions "
                        + "WHERE transaction_code = ?",
                Integer.class,
                transactionCode);
        if (existed != null && existed > 0) {
            return Map.of("success", true, "duplicate", true);
        }

        if (!"PENDING".equalsIgnoreCase(text(reservation, "status"))) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Reservation is not waiting for deposit");
        }

        BigDecimal depositAmount =
                (BigDecimal) reservation.get("base_price_monthly");

        jdbcTemplate.update(
                "UPDATE reservations "
                        + "SET status = 'DEPOSIT_PAID', deposit_amount = ?, "
                        + "total_deposit_paid = ? WHERE id = ?",
                depositAmount,
                depositAmount,
                reservationId);

        insertSuccessfulPayment(transactionCode, reservationId,
                reservation, transaction, receivedAmount);

        return Map.of("success", true);
    }

    private void insertSuccessfulPayment(
            String transactionCode,
            Integer reservationId,
            Map<String, Object> reservation,
            Map<String, Object> transaction,
            BigDecimal receivedAmount) {
        jdbcTemplate.update(
                "INSERT INTO payment_transactions "
                        + "(transaction_code, user_id, reservation_id, "
                        + "contract_id, payment_type, payment_method, amount, "
                        + "status, paid_at) "
                        + "VALUES (?, ?, ?, NULL, 'DEPOSIT', ?, ?, "
                        + "'SUCCESS', SYSDATETIME())",
                transactionCode,
                reservation.get("customer_id"),
                reservationId,
                normalizePaymentMethod(
                        text(transaction, "payment_method")),
                receivedAmount);
    }

    private Map<String, Object> findReservation(Integer reservationId) {
        try {
            return jdbcTemplate.queryForMap(
                    "SELECT r.customer_id, r.deposit_amount, "
                            + "r.duration_months, r.status, "
                            + "ut.base_price_monthly "
                            + "FROM reservations r "
                            + "JOIN unit_types ut ON ut.id = r.unit_type_id "
                            + "WHERE r.id = ?",
                    reservationId);
        } catch (EmptyResultDataAccessException exception) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND, "Reservation not found");
        }
    }

    private BigDecimal calculateFirstPayment(
            Map<String, Object> reservation) {
        BigDecimal monthlyPrice =
                (BigDecimal) reservation.get("base_price_monthly");
        int months = ((Number) reservation.get("duration_months")).intValue();

        int discountPercent = switch (months) {
            case 3 -> 5;
            case 6 -> 10;
            case 12 -> 15;
            default -> 0;
        };

        BigDecimal rentBeforeDiscount = monthlyPrice
                .multiply(BigDecimal.valueOf(months));
        BigDecimal packageDiscount = rentBeforeDiscount
                .multiply(BigDecimal.valueOf(discountPercent))
                .divide(BigDecimal.valueOf(100), 0, RoundingMode.HALF_UP);
        BigDecimal newCustomerVoucher = new BigDecimal("100000");

        BigDecimal firstPayment = rentBeforeDiscount
                .subtract(packageDiscount)
                .add(monthlyPrice)
                .subtract(newCustomerVoucher);

        if (firstPayment.signum() <= 0) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Invalid first payment amount");
        }
        return firstPayment;
    }

    private String sign(Map<String, String> fields) {
        List<String> signedFieldOrder = List.of(
                "order_amount", "merchant", "currency", "operation",
                "order_description", "order_invoice_number", "customer_id",
                "payment_method", "success_url", "error_url", "cancel_url");

        String signedText = signedFieldOrder.stream()
                .filter(fields::containsKey)
                .map(name -> name + "=" + fields.get(name))
                .collect(Collectors.joining(","));

        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(
                    SECRET_KEY.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return Base64.getEncoder().encodeToString(
                    mac.doFinal(signedText.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException("Cannot create SePay signature",
                    exception);
        }
    }

    private String toFormBody(Map<String, String> fields) {
        return fields.entrySet().stream()
                .map(entry -> encode(entry.getKey()) + "="
                        + encode(entry.getValue()))
                .collect(Collectors.joining("&"));
    }

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private Integer reservationIdFromInvoice(String invoiceNumber) {
        Matcher matcher = INVOICE_PATTERN.matcher(invoiceNumber);
        if (!matcher.matches()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Invalid invoice number");
        }
        return Integer.valueOf(matcher.group(1));
    }

    private BigDecimal parseAmount(String value) {
        try {
            return new BigDecimal(value);
        } catch (NumberFormatException exception) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Invalid transaction amount");
        }
    }

    private String text(Map<String, Object> source, String field) {
        Object value = source.get(field);
        return value == null ? "" : String.valueOf(value);
    }

    private Map<String, Object> object(
            Map<String, Object> source, String field) {
        Object value = source.get(field);
        if (!(value instanceof Map<?, ?> rawMap)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Missing IPN field: " + field);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        for (Map.Entry<?, ?> entry : rawMap.entrySet()) {
            result.put(String.valueOf(entry.getKey()), entry.getValue());
        }
        return result;
    }

    private String normalizePaymentMethod(String value) {
        if (value == null || value.isBlank()) {
            return "BANK_TRANSFER";
        }
        String normalized = value.trim().toUpperCase(Locale.ROOT);
        return normalized.length() <= 30
                ? normalized
                : normalized.substring(0, 30);
    }

    private boolean sameSecret(String received, String expected) {
        if (received == null || expected == null) {
            return false;
        }
        return MessageDigest.isEqual(
                received.getBytes(StandardCharsets.UTF_8),
                expected.getBytes(StandardCharsets.UTF_8));
    }

}
