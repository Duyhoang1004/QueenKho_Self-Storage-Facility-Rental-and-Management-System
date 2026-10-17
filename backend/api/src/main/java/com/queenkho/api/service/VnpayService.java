package com.queenkho.api.service;

import com.queenkho.api.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class VnpayService {
    @Value("${vnpay.tmn-code:}") private String tmnCode; 
    @Value("${vnpay.hash-secret:}") private String hashSecret;
    @Value("${vnpay.pay-url:https://sandbox.vnpayment.vn/paymentv2/vpcpay.html}") private String payUrl;
    @Value("${vnpay.return-url:http://localhost:8080/api/payments/vnpay/return}") private String returnUrl;
    @Value("${vnpay.frontend-url:http://localhost:5173}") private String frontendUrl;
    @Value("${vnpay.local-return-confirm:false}") private boolean localReturnConfirm;
    
    private final PaymentRepository payments; 
    private final RentalContractRepository contracts; 
    private final ReservationRepository reservations;
    private final StaffTaskService staffTasks;
    private final org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    public Map<String, Object> createReservation(Integer id, String ip) {
        var r = payments.findReservation(id);
        if (r == null || !"PENDING".equals(r.get("status"))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Đơn đặt chỗ không hợp lệ");
        }
        
        // PR-B8: Huỷ các giao dịch thanh toán PENDING cũ của đơn này trước khi tạo link mới
        jdbcTemplate.update("UPDATE payment_transactions SET status = 'FAILED' WHERE reservation_id = ? AND status = 'PENDING'", id);

        BigDecimal price = (BigDecimal) r.get("base_price_monthly");
        int m = ((Number) r.get("duration_months")).intValue();
        int discountPercent = (m == 3) ? 5 : (m == 6) ? 10 : (m == 12) ? 15 : 0;
        
        BigDecimal rent = price.multiply(BigDecimal.valueOf(m));
        BigDecimal discountAmount = rent.multiply(BigDecimal.valueOf(discountPercent))
                                        .divide(BigDecimal.valueOf(100), 0, RoundingMode.HALF_UP);
        BigDecimal deposit = r.get("deposit_amount") != null ? (BigDecimal) r.get("deposit_amount") : price;
        // PR-B9: Gỡ voucher, tổng trả = giá * số tháng * (1 - ưu đãi gói) + cọc
        BigDecimal netAmount = rent.subtract(discountAmount).add(deposit);
        
        return create("DEPOSIT", id, null, m, r.get("customer_id"), netAmount, deposit, ip);
    }
    
    public Map<String, Object> createRenewal(Integer id, Integer m, String ip) {
        var c = contracts.findDetailById(id)
                         .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy hợp đồng"));
                         
        // PR-R1: Chỉ gia hạn khi ACTIVE / TERMINATION_PENDING / OVERDUE
        if (!c.getStatus().matches("(?i)ACTIVE|TERMINATION_PENDING|OVERDUE")) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Hợp đồng không thể gia hạn (chỉ áp dụng cho HĐ Đang hiệu lực, Chờ trả kho hoặc Quá hạn)");
        }

        // PR-R2: BE chỉ nhận gói 1 / 3 / 6 / 12 tháng
        if (m == null || (m != 1 && m != 3 && m != 6 && m != 12)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Gói gia hạn chỉ chấp nhận 1, 3, 6 hoặc 12 tháng");
        }

        // PR-R5: Huỷ các giao dịch gia hạn PENDING cũ của hợp đồng này trước khi tạo link mới
        jdbcTemplate.update("UPDATE payment_transactions SET status = 'FAILED' WHERE contract_id = ? AND status = 'PENDING'", id);

        BigDecimal subtotal = c.getStorageUnit().getUnitType().getBasePriceMonthly().multiply(BigDecimal.valueOf(m));
        BigDecimal discount = m >= 12 ? new BigDecimal("0.10") : m >= 6 ? new BigDecimal("0.05") : BigDecimal.ZERO;
        BigDecimal finalAmount = subtotal.subtract(subtotal.multiply(discount)).setScale(0, RoundingMode.HALF_UP);
        
        return create("RENEWAL", c.getReservation().getId(), id, m, c.getCustomer().getId(), finalAmount, BigDecimal.ZERO, ip);
    }
    
    private Map<String, Object> create(String kind, Integer rId, Integer cId, Integer m, Object uId, BigDecimal amount, BigDecimal deposit, String ip) {
        amount = amount.setScale(0, RoundingMode.HALF_UP);
        String prefix = "DEPOSIT".equals(kind) ? "QKD" : "QKR" + String.format("%02d", m);
        String ref = prefix + UUID.randomUUID().toString().replace("-", "").substring(0, 20).toUpperCase();
        
        payments.createPending(ref, uId, rId, cId, "DEPOSIT".equals(kind) ? "DEPOSIT" : "MONTHLY_RENT", amount);
        
        return Map.of(
            "orderId", ref, 
            "payUrl", payUrl(ref, kind, amount, ip), 
            "amount", amount, 
            "depositAmount", deposit
        );
    }
    
    private String payUrl(String ref, String kind, BigDecimal amt, String ip) {
        var p = new TreeMap<String, String>();
        p.put("vnp_Version", "2.1.0"); 
        p.put("vnp_Command", "pay"); 
        p.put("vnp_TmnCode", tmnCode); 
        p.put("vnp_CurrCode", "VND"); 
        p.put("vnp_TxnRef", ref);
        p.put("vnp_Amount", amt.multiply(BigDecimal.valueOf(100)).toPlainString()); 
        p.put("vnp_OrderType", "other"); 
        p.put("vnp_Locale", "vn");
        p.put("vnp_OrderInfo", ("DEPOSIT".equals(kind) ? "Thanh toan " : "Gia han ") + ref); 
        p.put("vnp_ReturnUrl", returnUrl); 
        p.put("vnp_IpAddr", ip != null ? ip : "127.0.0.1");
        
        var now = LocalDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh"));
        p.put("vnp_CreateDate", now.format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"))); 
        p.put("vnp_ExpireDate", now.plusMinutes(10).format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss")));
        
        String query = p.entrySet().stream()
                        .map(e -> encode(e.getKey()) + "=" + encode(e.getValue()))
                        .collect(Collectors.joining("&"));
        return payUrl + "?" + query + "&vnp_SecureHash=" + sign(query);
    }
    
    public String returnDestination(Map<String, String> params) {
        verify(params); 
        String ref = params.getOrDefault("vnp_TxnRef", "");
        var p = payments.findPayment(ref, false);
        
        String path = "DEPOSIT".equals(p.get("payment_type")) ? "/booking/confirmation" : "/kho-cua-toi/hop-dong/" + p.get("reservation_id");
        return frontendUrl + path + "?orderId=" + encode(ref) + "&vnpResponse=" + encode(params.getOrDefault("vnp_ResponseCode", ""));
    }
    
    @Transactional 
    public void confirmLocalReturn(Map<String, String> p) {
        if (!localReturnConfirm) return;
        
        String responseCode = receiveIpn(p).get("RspCode").replace("02", "00");
        if (!p.containsKey("vnp_ResponseCode") || !"00".equals(responseCode)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Lỗi IPN");
        }
    }
    
    @Transactional 
    public Map<String, String> receiveIpn(Map<String, String> p) {
        try { 
            verify(p); 
        } catch (Exception e) { 
            return Map.of("RspCode", "97", "Message", "Invalid Checksum"); 
        }
        
        String ref = p.getOrDefault("vnp_TxnRef", ""); 
        var db = payments.findPayment(ref, true);
        
        if (db == null) return Map.of("RspCode", "01", "Message", "Not found");
        if (!same(p, db)) return Map.of("RspCode", "04", "Message", "Invalid amount");
        if (!"PENDING".equals(db.get("status"))) return Map.of("RspCode", "02", "Message", "Already confirmed");
        
        if (!"00".equals(p.get("vnp_ResponseCode")) || !"00".equals(p.get("vnp_TransactionStatus"))) { 
            payments.updatePayment(ref, "FAILED"); 
            // PR-B8: VNPAY lỗi / khách huỷ trên VNPAY → đơn vẫn giữ PENDING, cho phép khách bấm "Thanh toán lại" đến hết 15 phút.
            return Map.of("RspCode", "00", "Message", "Success"); 
        }
        
        String err = "DEPOSIT".equals(db.get("payment_type")) ? settleDeposit(ref, db) : settleRenewal(ref, db);
        
        if (err != null) return Map.of("RspCode", "02", "Message", err);
        
        payments.updatePayment(ref, "SUCCESS");
        return Map.of("RspCode", "00", "Message", "Success");
    }
    
    private String settleDeposit(String ref, Map<String, Object> p) {
        Integer id = ((Number) p.get("reservation_id")).intValue(); 
        var r = payments.findReservation(id);
        
        if (r != null && "PENDING".equals(r.get("status"))) { 
            BigDecimal deposit = r.get("deposit_amount") != null ? (BigDecimal) r.get("deposit_amount") : (BigDecimal) r.get("base_price_monthly");
            payments.updateReservationToDepositPaid(id, deposit); 
            return null; 
        }

        // PR-B6: IPN thành công về cho đơn đã hết hạn / huỷ -> giao dịch vẫn SUCCESS + tự tạo yêu cầu hoàn tiền (PR-O12)
        if (r != null && ("EXPIRED".equals(r.get("status")) || "CANCELLED".equals(r.get("status")))) {
            createLateRefundForReservation(r, (BigDecimal) p.get("amount"));
            return null;
        }

        return "Invalid status";
    }
    
    private String settleRenewal(String ref, Map<String, Object> p) {
        var c = contracts.findDetailById(((Number) p.get("contract_id")).intValue()).orElse(null);
        if (c == null) return "Không tìm thấy hợp đồng";
        
        // PR-R1 & PR-R5: Nếu HĐ không còn ở trạng thái có thể gia hạn, tạo yêu cầu hoàn tiền
        if (!c.getStatus().matches("(?i)ACTIVE|TERMINATION_PENDING|OVERDUE")) {
            createLateRefundForContract(c, (BigDecimal) p.get("amount"));
            return null;
        }

        LocalDate currentEnd = c.getEndDate() == null || c.getEndDate().isBefore(LocalDate.now()) ? LocalDate.now() : c.getEndDate();
        int monthsToRenew = Integer.parseInt(ref.substring(3, 5));
        c.setEndDate(currentEnd.plusMonths(monthsToRenew));
        
        if (c.getStatus().matches("(?i)OVERDUE|TERMINATION_PENDING")) { 
            c.setStatus("ACTIVE");
            // PR-R7: khách gia hạn → huỷ task check-out đang mở, chuyển đơn về UNIT_ASSIGNED
            staffTasks.cancelOpenTasks(c.getId(), "CHECK_OUT");
            c.getReservation().setStatus("UNIT_ASSIGNED");
            reservations.save(c.getReservation()); 
        }
        
        contracts.save(c); 
        return null;
    }

    private void createLateRefundForReservation(Map<String, Object> r, BigDecimal amount) {
        Integer resId = ((Number) r.get("id")).intValue();
        String resCode = (String) r.get("reservation_code");
        Object customerId = r.get("customer_id");

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime deadline = ReservationService.calculateRefundDeadline(now);

        Integer facilityId = null;
        try {
            facilityId = jdbcTemplate.queryForObject("SELECT facility_id FROM reservations WHERE id = ?", Integer.class, resId);
        } catch (Exception ignored) {}

        Integer managerId = null;
        if (facilityId != null) {
            try {
                managerId = jdbcTemplate.queryForObject(
                        "SELECT TOP 1 u.id FROM users u JOIN roles r ON u.role_id = r.id " +
                        "WHERE u.facility_id = ? AND r.name = 'FACILITY_MANAGER' AND u.status = 'ACTIVE'",
                        Integer.class, facilityId);
            } catch (Exception ignored) {}
        }

        String txnCode = "REF-" + resCode + "-LATE-" + (System.currentTimeMillis() % 10000);
        try {
            jdbcTemplate.update(
                    "INSERT INTO payment_transactions (transaction_code, reservation_id, user_id, amount, payment_type, payment_method, status, paid_at) " +
                    "VALUES (?, ?, ?, ?, 'REFUND', 'BANK_TRANSFER', 'PENDING', SYSDATETIME())",
                    txnCode, resId, customerId, amount);
        } catch (Exception ignored) {}

        String note = String.format(
                "[HOÀN TIỀN IPN MUỘN] Đơn %s thanh toán thành công sau khi đơn đã hết hạn/hủy. Số tiền cần hoàn: %s đ. Khách hàng ID: %s. Quản lý vui lòng liên hệ khách để thực hiện hoàn tiền.",
                resCode, amount != null ? amount.toPlainString() : "0", customerId);

        try {
            jdbcTemplate.update(
                    "INSERT INTO facility_tasks (facility_id, task_type, contract_id, staff_id, status, due_at, note, created_at) " +
                    "VALUES (?, 'REFUND', NULL, ?, 'OPEN', ?, ?, SYSDATETIME())",
                    facilityId, managerId, deadline, note);
        } catch (Exception ignored) {}
    }

    private void createLateRefundForContract(com.queenkho.api.entity.RentalContract c, BigDecimal amount) {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime deadline = ReservationService.calculateRefundDeadline(now);
        Integer facilityId = c.getStorageUnit() != null && c.getStorageUnit().getFacility() != null
                ? c.getStorageUnit().getFacility().getId() : null;

        Integer managerId = null;
        if (facilityId != null) {
            try {
                managerId = jdbcTemplate.queryForObject(
                        "SELECT TOP 1 u.id FROM users u JOIN roles r ON u.role_id = r.id " +
                        "WHERE u.facility_id = ? AND r.name = 'FACILITY_MANAGER' AND u.status = 'ACTIVE'",
                        Integer.class, facilityId);
            } catch (Exception ignored) {}
        }

        String txnCode = "REF-" + c.getContractCode() + "-LATE-" + (System.currentTimeMillis() % 10000);
        try {
            jdbcTemplate.update(
                    "INSERT INTO payment_transactions (transaction_code, contract_id, reservation_id, user_id, amount, payment_type, payment_method, status, paid_at) " +
                    "VALUES (?, ?, ?, ?, ?, 'REFUND', 'BANK_TRANSFER', 'PENDING', SYSDATETIME())",
                    txnCode, c.getId(), c.getReservation() != null ? c.getReservation().getId() : null,
                    c.getCustomer().getId(), amount);
        } catch (Exception ignored) {}

        String note = String.format(
                "[HOÀN TIỀN IPN MUỘN] Gia hạn hợp đồng %s nhận tiền sau khi hợp đồng đã đóng. Số tiền cần hoàn: %s đ. Khách hàng: %s (SĐT: %s).",
                c.getContractCode(), amount != null ? amount.toPlainString() : "0",
                c.getCustomer().getFullName(), c.getCustomer().getPhone());

        try {
            jdbcTemplate.update(
                    "INSERT INTO facility_tasks (facility_id, task_type, contract_id, staff_id, status, due_at, note, created_at) " +
                    "VALUES (?, 'REFUND', ?, ?, 'OPEN', ?, ?, SYSDATETIME())",
                    facilityId, c.getId(), managerId, deadline, note);
        } catch (Exception ignored) {}
    }
    
    private void verify(Map<String, String> p) {
        String query = new TreeMap<>(p).entrySet().stream()
                        .filter(e -> e.getKey().startsWith("vnp_") && !e.getKey().contains("SecureHash") && e.getValue() != null && !e.getValue().isEmpty())
                        .map(e -> encode(e.getKey()) + "=" + encode(e.getValue()))
                        .collect(Collectors.joining("&"));
                        
        String expectedHash = sign(query);
        String actualHash = p.getOrDefault("vnp_SecureHash", "").toLowerCase();
        
        if (!MessageDigest.isEqual(expectedHash.getBytes(StandardCharsets.US_ASCII), actualHash.getBytes(StandardCharsets.US_ASCII))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Sai chữ ký bảo mật");
        }
    }
    
    private String sign(String txt) {
        try { 
            var m = Mac.getInstance("HmacSHA512"); 
            m.init(new SecretKeySpec(hashSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA512")); 
            return HexFormat.of().formatHex(m.doFinal(txt.getBytes(StandardCharsets.UTF_8))); 
        } catch (Exception e) { 
            throw new IllegalStateException("Lỗi khởi tạo thuật toán ký", e); 
        }
    }
    
    private static String encode(String v) { 
        return URLEncoder.encode(v, StandardCharsets.UTF_8); 
    }
    
    private boolean same(Map<String, String> p, Map<String, Object> db) { 
        try { 
            BigDecimal receivedAmount = new BigDecimal(p.getOrDefault("vnp_Amount", "-1"));
            BigDecimal expectedAmount = ((BigDecimal) db.get("amount")).multiply(BigDecimal.valueOf(100));
            return receivedAmount.compareTo(expectedAmount) == 0;
        } catch (Exception e) { 
            return false; 
        } 
    }
    
    public Map<String, Object> status(String ref) { 
        return payments.paymentStatus(ref); 
    }
}
