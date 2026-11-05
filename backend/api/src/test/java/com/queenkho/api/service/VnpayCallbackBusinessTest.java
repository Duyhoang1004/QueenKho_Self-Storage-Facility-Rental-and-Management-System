package com.queenkho.api.service;

import com.queenkho.api.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.stream.Collectors;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static com.queenkho.api.service.BusinessFixtures.*;

class VnpayCallbackBusinessTest {
    static final String SECRET = "unit-test-secret-not-a-real-merchant-key";
    final PaymentRepository payments = mock(PaymentRepository.class);
    final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    final VnpayService service = new VnpayService(payments, mock(RentalContractRepository.class),
            mock(ReservationRepository.class), mock(StaffTaskService.class), mock(PricingService.class),
            jdbc, mock(RenewalPolicyService.class));
    Map<String, Object> row;

    @BeforeEach void setup() {
        ReflectionTestUtils.setField(service, "hashSecret", SECRET);
        ReflectionTestUtils.setField(service, "frontendUrl", "http://test.invalid");
        row = new HashMap<>(Map.of("transaction_code", "QKFTEST", "payment_type", "DAMAGE_FEE",
                "payment_method", "VNPAY", "status", "PENDING", "user_id", 10,
                "contract_id", 30, "amount", money("250000")));
        when(payments.findPayment("QKFTEST", true)).thenReturn(row);
        when(payments.findPayment("QKFTEST", false)).thenReturn(row);
    }

    Map<String, String> callback(String amount, String response) throws Exception {
        Map<String, String> p = new TreeMap<>(Map.of("vnp_TxnRef", "QKFTEST", "vnp_Amount", amount,
                "vnp_ResponseCode", response, "vnp_TransactionStatus", response, "vnp_TransactionNo", "test-bank-ref"));
        String query = p.entrySet().stream().map(e -> URLEncoder.encode(e.getKey(), StandardCharsets.UTF_8)
                + "=" + URLEncoder.encode(e.getValue(), StandardCharsets.UTF_8)).collect(Collectors.joining("&"));
        Mac mac = Mac.getInstance("HmacSHA512");
        mac.init(new SecretKeySpec(SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA512"));
        p.put("vnp_SecureHash", HexFormat.of().formatHex(mac.doFinal(query.getBytes(StandardCharsets.UTF_8))));
        return p;
    }

    @Test void invalidSignatureMustNotTouchPaymentOrDebt() {
        assertEquals("97", service.receiveIpn(Map.of("vnp_TxnRef", "QKFTEST", "vnp_SecureHash", "bad")).get("RspCode"));
        verifyNoInteractions(payments, jdbc);
    }

    @Test void validSignatureWithUnknownOrderIsNotAccepted() throws Exception {
        when(payments.findPayment("QKFTEST", true)).thenReturn(null);
        assertEquals("01", service.receiveIpn(callback("25000000", "00")).get("RspCode"));
        verify(payments, never()).updatePayment(anyString(), anyString(), anyString());
    }

    @ParameterizedTest @ValueSource(strings = {"0", "24999900", "25000100", "-1", "NaN"})
    void signatureDoesNotOverrideAmountValidation(String amount) throws Exception {
        assertEquals("04", service.receiveIpn(callback(amount, "00")).get("RspCode"));
        verify(payments, never()).updatePayment(anyString(), anyString(), anyString());
    }

    @Test void successfulDebtPaymentClearsDebtOnlyOnce() throws Exception {
        var p = callback("25000000", "00");
        assertEquals("00", service.receiveIpn(p).get("RspCode"));
        verify(payments).updatePayment("QKFTEST", "SUCCESS", "test-bank-ref");
        row.put("status", "SUCCESS");
        assertEquals("02", service.receiveIpn(p).get("RspCode"));
        verify(payments, times(1)).updatePayment("QKFTEST", "SUCCESS", "test-bank-ref");
    }

    @ParameterizedTest @ValueSource(strings = {"24", "01", "99"})
    void failedAttemptDoesNotEraseOutstandingDebt(String response) throws Exception {
        assertEquals("00", service.receiveIpn(callback("25000000", response)).get("RspCode"));
        verify(payments, never()).updatePayment(anyString(), anyString(), anyString());
        verify(payments, never()).updatePayment(anyString(), anyString());
    }

    @Test void customerCannotReadAnotherCustomersPaymentStatus() {
        assertThrows(ResponseStatusException.class, () -> service.status("QKFTEST", 99));
        verify(payments, never()).paymentStatus(anyString());
    }

    @Test void statusOfMissingPaymentIsNotFound() {
        when(payments.findPayment("missing", false)).thenReturn(null);
        assertEquals(404, assertThrows(ResponseStatusException.class,
                () -> service.status("missing", 10)).getStatusCode().value());
    }

    @Test void tamperingAfterSigningIsDetected() throws Exception {
        var p = callback("25000000", "00");
        p.put("vnp_Amount", "1");
        assertEquals("97", service.receiveIpn(p).get("RspCode"));
        verifyNoInteractions(payments);
    }
}
