package com.queenkho.api.service;

import com.queenkho.api.repository.SepayRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class SepayService {

    private static final String SECRET_KEY = "spsk_test_n1bw2dzDmSA2r7pDKrcVC35zLQPj7uFV";
    private static final String MERCHANT_ID = "SP-TEST-BVAB264A";
    private static final String APP_URL = "http://localhost:5173";

    private final SepayRepository repository;

    public SepayService(SepayRepository repository) { this.repository = repository; }

    public Map<String, Object> createPayment(Integer reservationId) {
        Map<String, Object> res = repository.findReservation(reservationId);
        if (res == null || !"PENDING".equals(res.get("status"))) throw new RuntimeException("Invalid reservation");

        BigDecimal amount = calculateAmount(res);
        String resCode = String.valueOf(res.get("reservation_code"));

        LinkedHashMap<String, String> fields = new LinkedHashMap<>();
        fields.put("merchant", MERCHANT_ID);
        fields.put("currency", "VND");
        fields.put("order_amount", String.valueOf(amount.longValue()));
        fields.put("operation", "PURCHASE");
        fields.put("order_description", "Thanh toan don " + resCode);
        fields.put("order_invoice_number", resCode);
        fields.put("customer_id", String.valueOf(res.get("customer_id")));
        fields.put("success_url", APP_URL + "/booking/confirmation");
        fields.put("error_url", APP_URL + "/tim-va-dat-kho?payment=failed");
        fields.put("cancel_url", APP_URL + "/tim-va-dat-kho?payment=failed");
        fields.put("signature", sign(fields));

        return Map.of("fields", fields, "amount", amount, "depositAmount", res.get("base_price_monthly"));
    }

    @Transactional
    public Map<String, Object> confirmDevPayment(Map<String, Object> body) {
        Integer resId = Integer.valueOf(String.valueOf(body.get("reservationId")));
        Map<String, Object> res = repository.findReservation(resId);
        
        if (res != null) {
            String status = String.valueOf(res.get("status"));
            if ("PENDING".equals(status)) {
                repository.updateReservationToDepositPaid(resId, (BigDecimal) res.get("base_price_monthly"));
                repository.insertSuccessfulPayment("DEV-" + System.currentTimeMillis(), res.get("customer_id"), resId, "VIETQR", calculateAmount(res));
                return Map.of("success", true, "status", "DEPOSIT_PAID");
            } else if ("CANCELLED".equals(status)) {
                repository.insertLatePaymentForRefund("DEV-" + System.currentTimeMillis(), res.get("customer_id"), resId, "VIETQR", calculateAmount(res));
                repository.updateReservationToRefundPending(resId);
                return Map.of("success", true, "status", "REFUND_PENDING");
            }
            return Map.of("success", true, "status", status);
        }
        return Map.of("success", false);
    }

    private BigDecimal calculateAmount(Map<String, Object> res) {
        BigDecimal price = (BigDecimal) res.get("base_price_monthly");
        int months = ((Number) res.get("duration_months")).intValue();
        int discount = (months == 3) ? 5 : (months == 6) ? 10 : (months == 12) ? 15 : 0;
        BigDecimal rent = price.multiply(BigDecimal.valueOf(months));
        BigDecimal discAmt = rent.multiply(BigDecimal.valueOf(discount)).divide(BigDecimal.valueOf(100), 0, RoundingMode.HALF_UP);
        return rent.subtract(discAmt).add(price).subtract(new BigDecimal("100000"));
    }

    private String sign(Map<String, String> fields) {
        List<String> validKeys = List.of("order_amount", "merchant", "currency", "operation", "order_description", "order_invoice_number", "customer_id", "payment_method", "success_url", "error_url", "cancel_url");
        String text = fields.keySet().stream().filter(validKeys::contains).map(k -> k + "=" + fields.get(k)).collect(Collectors.joining(","));
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(SECRET_KEY.getBytes(), "HmacSHA256"));
            return Base64.getEncoder().encodeToString(mac.doFinal(text.getBytes()));
        } catch (Exception e) {
            throw new RuntimeException("Signature failed", e);
        }
    }
}
