package com.queenkho.api.service;

import com.queenkho.api.repository.PaymentRepository;
import com.queenkho.api.repository.RentalContractRepository;
import com.queenkho.api.repository.ReservationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

// UC-20 / PR-O9: khách trả khoản nợ phí sự cố qua VNPAY
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class VnpayDebtPaymentTest {

    private static final String SECRET = "TESTSECRET";

    @Mock PaymentRepository payments;
    @Mock RentalContractRepository contracts;
    @Mock ReservationRepository reservations;
    @Mock StaffTaskService staffTasks;
    @Mock PricingService pricing;
    @Mock JdbcTemplate jdbcTemplate;

    VnpayService service;

    @BeforeEach
    void setUp() {
        service = new VnpayService(payments, contracts, reservations, staffTasks, pricing, jdbcTemplate);
        ReflectionTestUtils.setField(service, "hashSecret", SECRET);
        ReflectionTestUtils.setField(service, "tmnCode", "TMN");
        ReflectionTestUtils.setField(service, "payUrl", "https://sandbox/pay");
        ReflectionTestUtils.setField(service, "returnUrl", "http://localhost/return");
        ReflectionTestUtils.setField(service, "frontendUrl", "http://localhost:5173");
    }

    private void debtRow(int userId, String status) {
        Map<String, Object> row = new HashMap<>();
        row.put("id", 70);
        row.put("user_id", userId);
        row.put("amount", new BigDecimal("250000.00"));
        row.put("status", status);
        row.put("payment_type", "DAMAGE_FEE");
        row.put("payment_method", "VNPAY");
        when(jdbcTemplate.queryForList(contains("FROM payment_transactions"), eq(70))).thenReturn(List.of(row));
    }

    // Ký giống VnpayService.verify để giả lập IPN hợp lệ
    private static Map<String, String> signed(Map<String, String> params) throws Exception {
        String query = new TreeMap<>(params).entrySet().stream()
                .map(e -> URLEncoder.encode(e.getKey(), StandardCharsets.UTF_8) + "=" + URLEncoder.encode(e.getValue(), StandardCharsets.UTF_8))
                .collect(Collectors.joining("&"));
        Mac mac = Mac.getInstance("HmacSHA512");
        mac.init(new SecretKeySpec(SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA512"));
        Map<String, String> result = new HashMap<>(params);
        result.put("vnp_SecureHash", HexFormat.of().formatHex(mac.doFinal(query.getBytes(StandardCharsets.UTF_8))));
        return result;
    }

    private Map<String, Object> pendingDebtPayment() {
        Map<String, Object> db = new HashMap<>();
        db.put("transaction_code", "QKFABC");
        db.put("payment_type", "DAMAGE_FEE");
        db.put("status", "PENDING");
        db.put("amount", new BigDecimal("250000.00"));
        db.put("user_id", 1);
        db.put("contract_id", 9);
        return db;
    }

    @Test
    @DisplayName("Tạo link trả nợ: đổi mã giao dịch của chính khoản nợ (không tạo dòng mới), đúng số tiền")
    void createDebtPaymentReusesDebtRow() {
        debtRow(1, "PENDING");
        Map<String, Object> result = service.createDebtPayment(70, 1, "127.0.0.1");

        assertTrue(((String) result.get("orderId")).startsWith("QKF"));
        assertEquals(0, new BigDecimal("250000").compareTo((BigDecimal) result.get("amount")));
        assertTrue(((String) result.get("payUrl")).contains("vnp_Amount=25000000"));
        verify(jdbcTemplate).update(contains("SET transaction_code = ?"), startsWith("QKF"), eq(70));
        verify(payments, never()).createPending(any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("Trả nợ của người khác → 403")
    void cannotPayOthersDebt() {
        debtRow(2, "PENDING");
        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () -> service.createDebtPayment(70, 1, "ip"));
        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
    }

    @Test
    @DisplayName("Khoản đã trả → 409")
    void alreadyPaidDebtRejected() {
        debtRow(1, "SUCCESS");
        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () -> service.createDebtPayment(70, 1, "ip"));
        assertEquals(HttpStatus.CONFLICT, ex.getStatusCode());
    }

    @Test
    @DisplayName("IPN thành công → khoản nợ SUCCESS + log [DEBT_PAID] (khách hết bị chặn đặt kho)")
    void ipnSuccessSettlesDebt() throws Exception {
        when(payments.findPayment("QKFABC", true)).thenReturn(pendingDebtPayment());
        when(payments.findPayment("QKFABC", false)).thenReturn(pendingDebtPayment());

        Map<String, String> result = service.receiveIpn(signed(Map.of(
                "vnp_TxnRef", "QKFABC", "vnp_Amount", "25000000",
                "vnp_ResponseCode", "00", "vnp_TransactionStatus", "00")));

        assertEquals("00", result.get("RspCode"));
        verify(payments).updatePayment("QKFABC", "SUCCESS");
        verify(jdbcTemplate).update(contains("INSERT INTO activity_logs"), eq(1), startsWith("[DEBT_PAID]"), any(), any());
    }

    @Test
    @DisplayName("Khách huỷ trên VNPAY → khoản nợ vẫn PENDING (không bị 'xoá nợ' thành FAILED)")
    void ipnFailureKeepsDebtPending() throws Exception {
        when(payments.findPayment("QKFABC", true)).thenReturn(pendingDebtPayment());

        Map<String, String> result = service.receiveIpn(signed(Map.of(
                "vnp_TxnRef", "QKFABC", "vnp_Amount", "25000000",
                "vnp_ResponseCode", "24", "vnp_TransactionStatus", "02")));

        assertEquals("00", result.get("RspCode"));
        verify(payments, never()).updatePayment(eq("QKFABC"), anyString());
    }

    @Test
    @DisplayName("VNPAY trả về sau thanh toán phí sự cố → về trang /thanh-toan của khách")
    void returnGoesToPaymentsPage() throws Exception {
        when(payments.findPayment("QKFABC", false)).thenReturn(pendingDebtPayment());
        String destination = service.returnDestination(signed(Map.of(
                "vnp_TxnRef", "QKFABC", "vnp_Amount", "25000000", "vnp_ResponseCode", "00")));
        assertTrue(destination.startsWith("http://localhost:5173/thanh-toan?orderId=QKFABC"));
    }
}
