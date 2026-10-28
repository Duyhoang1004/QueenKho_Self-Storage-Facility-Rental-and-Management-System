package com.queenkho.api.service;

import com.queenkho.api.repository.*;
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
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class VnpayService {
    // UC-20 / PR-O9 / PR-Q14: khoản nợ khách tự trả online (phí sự cố vượt cọc, phí chiếm dụng vượt cọc)
    static final Set<String> DEBT_TYPES = Set.of("DAMAGE_FEE", "OVERSTAY_FEE");

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
    private final PricingService pricing;
    private final org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;
    private final RenewalPolicyService renewalPolicy;

    public VnpayService(PaymentRepository payments, RentalContractRepository contracts,
                        ReservationRepository reservations, StaffTaskService staffTasks,
                        PricingService pricing, org.springframework.jdbc.core.JdbcTemplate jdbcTemplate,
                        RenewalPolicyService renewalPolicy) {
        this.payments = payments;
        this.contracts = contracts;
        this.reservations = reservations;
        this.staffTasks = staffTasks;
        this.pricing = pricing;
        this.jdbcTemplate = jdbcTemplate;
        this.renewalPolicy = renewalPolicy;
    }

    @Transactional
    public Map<String, Object> createReservation(Integer id, Integer actorUserId, String ip) {
        var r = payments.findReservation(id);
        if (r == null || !"PENDING".equals(r.get("status"))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Đơn đặt chỗ không hợp lệ");
        }
        if (!Objects.equals(actorUserId, ((Number) r.get("customer_id")).intValue())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn không có quyền thanh toán đơn này");
        }

        // Khóa giao dịch trước rồi mới khóa đơn, cùng thứ tự với IPN để tránh deadlock.
        payments.failPendingReservationPayments(id);
        r = payments.findReservation(id, true);
        if (r == null || !"PENDING".equals(r.get("status"))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Đơn vừa được thanh toán hoặc không còn hiệu lực");
        }

        LocalDateTime createdAt = ((java.sql.Timestamp) r.get("created_at")).toLocalDateTime();
        LocalDateTime holdExpiresAt = createdAt.plusMinutes(15);
        if (!LocalDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh")).isBefore(holdExpiresAt)) {
            payments.failPendingReservationPayments(id);
            jdbcTemplate.update("UPDATE reservations SET status = 'EXPIRED' WHERE id = ? AND status = 'PENDING'", id);
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Đơn đã hết 15 phút giữ chỗ");
        }
        
        BigDecimal price = (BigDecimal) r.get("base_price_monthly");
        int m = ((Number) r.get("duration_months")).intValue();
        // Flow 4: % ưu đãi và tiền cọc đều lấy từ snapshot của đơn (chốt theo chính sách lúc tạo đơn — PR-M6)
        Integer snapshot = r.get("rent_discount_percent") == null ? null : ((Number) r.get("rent_discount_percent")).intValue();
        int discountPercent = pricing.snapshotOrDefault(snapshot, m);

        BigDecimal rent = PricingService.discountedRent(price, m, discountPercent);
        BigDecimal depositAmount = (BigDecimal) r.get("deposit_amount");
        BigDecimal netAmount = rent.add(depositAmount).subtract(PricingService.WELCOME_VOUCHER);

        return create("DEPOSIT", id, null, m, r.get("customer_id"), netAmount, depositAmount, ip, holdExpiresAt);
    }
    
    @Transactional
    public Map<String, Object> createRenewal(Integer id, Integer m, Integer actorUserId, String ip) {
        if (id == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy hợp đồng");
        }
        var c = contracts.findDetailById(id)
                         .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy hợp đồng"));
        if (c.getCustomer() == null || !Objects.equals(actorUserId, c.getCustomer().getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn không có quyền gia hạn hợp đồng này");
        }

        // PR-R1: Chỉ nhận số tháng 1, 3, 6, 12; giá trị khác trả 400 INVALID_INPUT
        if (m == null || (m != 1 && m != 3 && m != 6 && m != 12)) {
            throw new com.queenkho.api.exception.ContractException(HttpStatus.BAD_REQUEST, "INVALID_INPUT",
                    "Số tháng gia hạn không hợp lệ. Chỉ chấp nhận các gói 1, 3, 6, 12 tháng.");
        }

        // PR-R1: Chỉ cho gia hạn khi hợp đồng ACTIVE, TERMINATION_PENDING hoặc OVERDUE. Trạng thái khác trả 409 CONTRACT_NOT_RENEWABLE
        String status = c.getStatus() != null ? c.getStatus().toUpperCase() : "";
        if (!status.matches("ACTIVE|TERMINATION_PENDING|OVERDUE")) {
            throw new com.queenkho.api.exception.ContractException(HttpStatus.CONFLICT, "CONTRACT_NOT_RENEWABLE",
                    "Hợp đồng đang ở trạng thái " + c.getStatus() + ", không thể gia hạn.");
        }

        // Khóa giao dịch trước rồi khóa hợp đồng, cùng thứ tự với IPN.
        payments.failPendingRenewalPayments(id);
        jdbcTemplate.queryForObject(
                "SELECT id FROM rental_contracts WITH (UPDLOCK, ROWLOCK) WHERE id = ?",
                Integer.class, id);
        c = contracts.findDetailById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy hợp đồng"));
        status = c.getStatus() != null ? c.getStatus().toUpperCase() : "";
        if (!status.matches("ACTIVE|TERMINATION_PENDING|OVERDUE")) {
            throw new com.queenkho.api.exception.ContractException(HttpStatus.CONFLICT, "CONTRACT_NOT_RENEWABLE",
                    "Hợp đồng đang ở trạng thái " + c.getStatus() + ", không thể gia hạn.");
        }
        // PR-R10 / PR-R11: quá hạn chót gia hạn ưu tiên (end_date − 3) mà ô đã có khách khác đặt trước → 409
        renewalPolicy.assertRenewable(c);

        // Flow 6 / PR-Q6: báo giá dùng chung với màn hình (GET /contracts/{id}/renewal-quote) và CHỐT CỨNG
        // số tiền tại thời điểm tạo link: tiền thuê theo % ưu đãi gia hạn của BOM + phí trễ (0 nếu FM đã miễn)
        var quote = pricing.quoteRenewal(c, m);
        BigDecimal rentAmount = quote.rentAmount();
        BigDecimal lateFeeAmount = quote.lateFeeAmount();
        BigDecimal totalAmount = quote.totalAmount();

        // PR-Q6: Trong MỘT @Transactional, tạo sẵn 2 dòng PENDING trong payment_transactions:
        // (a) dòng chính loại MONTHLY_RENT, số tiền = tiền thuê các tháng gia hạn;
        // (b) dòng phụ loại LATE_FEE, số tiền = phí trễ chốt cứng (nếu phí trễ > 0).
        String ref = "QKR" + UUID.randomUUID().toString().replace("-", "").substring(0, 22).toUpperCase();

        Integer customerId = c.getCustomer() != null ? c.getCustomer().getId() : null;
        Integer reservationId = c.getReservation() != null ? c.getReservation().getId() : null;

        // PR-R5: link mới thay link cũ; tại mọi thời điểm chỉ có một giao dịch gia hạn PENDING.
        payments.createPending(ref, customerId, reservationId, id, "MONTHLY_RENT", rentAmount, m);

        // Tạo dòng phụ LATE_FEE nếu phí trễ > 0
        if (lateFeeAmount.compareTo(BigDecimal.ZERO) > 0) {
            String lateFeeRef = "LF" + ref;
            payments.createPending(lateFeeRef, customerId, reservationId, id, "LATE_FEE", lateFeeAmount, m);
        }

        // PR-Q14: dòng phụ OVERSTAY_FEE ("OS" + ref) cho phí chiếm dụng các ngày đã quá hạn
        BigDecimal overstayAmount = quote.overstayFeeAmount() != null ? quote.overstayFeeAmount() : BigDecimal.ZERO;
        if (overstayAmount.compareTo(BigDecimal.ZERO) > 0) {
            payments.createPending("OS" + ref, customerId, reservationId, id, "OVERSTAY_FEE", overstayAmount, m);
        }

        // vnp_TxnRef chỉ giữ mã của dòng chính (để khớp với callback URL hiện có). Tiền gửi sang VNPAY vnp_Amount là TỔNG (tiền thuê + phí trễ chốt cứng)
        return Map.of(
            "orderId", ref, 
            "payUrl", payUrl(ref, "RENEWAL", totalAmount, ip, null),
            "amount", totalAmount, 
            "depositAmount", BigDecimal.ZERO,
            "rentAmount", rentAmount,
            "lateFeeAmount", lateFeeAmount,
            "overstayFeeAmount", overstayAmount
        );
    }
    
    /**
     * UC-20 / PR-O9: khách trả khoản nợ phí sự cố (DAMAGE_FEE vượt cọc, đang PENDING) qua VNPAY.
     * Không tạo dòng mới: đổi transaction_code của chính khoản nợ sang mã mới → link mới thay link cũ,
     * khoản nợ luôn chỉ có 1 dòng. Trả lỗi / huỷ trên VNPAY → khoản nợ vẫn PENDING (không bị "xoá nợ").
     */
    @Transactional
    public Map<String, Object> createDebtPayment(Integer paymentId, Integer actorUserId, String ip) {
        if (paymentId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Thiếu khoản cần thanh toán");
        }
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                "SELECT id, user_id, amount, status, payment_type, payment_method, renewal_months FROM payment_transactions " +
                        "WITH (UPDLOCK, ROWLOCK) WHERE id = ?", paymentId);
        if (rows.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy khoản cần thanh toán");
        }
        var debt = rows.get(0);
        if (!Objects.equals(actorUserId, ((Number) debt.get("user_id")).intValue())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn không có quyền thanh toán khoản này");
        }
        // renewal_months != NULL → dòng phụ của link gia hạn đang chờ, không phải khoản nợ
        if (!DEBT_TYPES.contains(String.valueOf(debt.get("payment_type"))) || !"VNPAY".equals(debt.get("payment_method"))
                || !"PENDING".equals(debt.get("status")) || debt.get("renewal_months") != null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Khoản này không còn ở trạng thái chờ thanh toán");
        }
        String ref = "QKF" + UUID.randomUUID().toString().replace("-", "").substring(0, 20).toUpperCase();
        jdbcTemplate.update("UPDATE payment_transactions SET transaction_code = ? WHERE id = ?", ref, paymentId);
        BigDecimal amount = ((BigDecimal) debt.get("amount")).setScale(0, RoundingMode.HALF_UP);
        return Map.of(
            "orderId", ref,
            "payUrl", payUrl(ref, "DEBT", amount, ip, null),
            "amount", amount
        );
    }

    private Map<String, Object> create(String kind, Integer rId, Integer cId, Integer m, Object uId,
                                       BigDecimal amount, BigDecimal deposit, String ip, LocalDateTime expiresAt) {
        amount = amount.setScale(0, RoundingMode.HALF_UP);
        String prefix = "DEPOSIT".equals(kind) ? "QKD" : "QKR" + String.format("%02d", m);
        String ref = prefix + UUID.randomUUID().toString().replace("-", "").substring(0, 20).toUpperCase();
        
        payments.createPending(ref, uId, rId, cId, "DEPOSIT".equals(kind) ? "DEPOSIT" : "MONTHLY_RENT", amount);
        
        return Map.of(
            "orderId", ref, 
            "payUrl", payUrl(ref, kind, amount, ip, expiresAt),
            "amount", amount, 
            "depositAmount", deposit
        );
    }
    
    private String payUrl(String ref, String kind, BigDecimal amt, String ip, LocalDateTime maximumExpiry) {
        var p = new TreeMap<String, String>();
        p.put("vnp_Version", "2.1.0"); 
        p.put("vnp_Command", "pay"); 
        p.put("vnp_TmnCode", tmnCode); 
        p.put("vnp_CurrCode", "VND"); 
        p.put("vnp_TxnRef", ref);
        p.put("vnp_Amount", amt.multiply(BigDecimal.valueOf(100)).toPlainString()); 
        p.put("vnp_OrderType", "other"); 
        p.put("vnp_Locale", "vn");
        String orderInfo = switch (kind) {
            case "DEPOSIT" -> "Thanh toan ";
            case "DEBT" -> "Thanh toan phi su co ";
            default -> "Gia han ";
        };
        p.put("vnp_OrderInfo", orderInfo + ref);
        p.put("vnp_ReturnUrl", returnUrl); 
        p.put("vnp_IpAddr", ip != null ? ip : "127.0.0.1");
        
        var now = LocalDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh"));
        p.put("vnp_CreateDate", now.format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"))); 
        LocalDateTime expiry = now.plusMinutes(10);
        if (maximumExpiry != null && maximumExpiry.isBefore(expiry)) expiry = maximumExpiry;
        p.put("vnp_ExpireDate", expiry.format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss")));
        
        String query = p.entrySet().stream()
                        .map(e -> encode(e.getKey()) + "=" + encode(e.getValue()))
                        .collect(Collectors.joining("&"));
        return payUrl + "?" + query + "&vnp_SecureHash=" + sign(query);
    }
    
    public String returnDestination(Map<String, String> params) {
        verify(params); 
        String ref = params.getOrDefault("vnp_TxnRef", "");
        var p = payments.findPayment(ref, false);
        if (p == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy giao dịch");
        
        String path = switch (String.valueOf(p.get("payment_type"))) {
            case "DEPOSIT" -> "/booking/confirmation";
            case "DAMAGE_FEE", "OVERSTAY_FEE" -> "/thanh-toan";
            default -> "/kho-cua-toi/hop-dong/" + p.get("reservation_id");
        };
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
        String currentStatus = String.valueOf(db.get("status"));
        boolean vnpaySuccess = "00".equals(p.get("vnp_ResponseCode"))
                && "00".equals(p.get("vnp_TransactionStatus"));

        boolean isDebt = DEBT_TYPES.contains(String.valueOf(db.get("payment_type")));

        if (!vnpaySuccess) {
            if ("PENDING".equals(currentStatus) && isDebt) {
                // Khoản nợ không được chuyển FAILED — khách vẫn còn nợ, chỉ là lần trả này không thành công
                logPayment(db, "[VNPAY] Thanh toán phí sự cố " + ref + " không thành công; khoản nợ vẫn chờ thanh toán");
                return Map.of("RspCode", "00", "Message", "Success");
            }
            if ("PENDING".equals(currentStatus)) {
                updatePaymentGroup(ref, "FAILED");
                logPayment(db, "[VNPAY] Giao dịch " + ref + " thất bại; đơn vẫn giữ chỗ để thanh toán lại");
                return Map.of("RspCode", "00", "Message", "Success");
            }
            return Map.of("RspCode", "02", "Message", "Already confirmed");
        }

        if ("SUCCESS".equals(currentStatus)) {
            return Map.of("RspCode", "02", "Message", "Already confirmed");
        }

        // PR-B6 / PR-R5: giao dịch cũ đã FAILED nhưng VNPAY báo thành công muộn.
        // Ghi nhận tiền đã thu và chuyển toàn bộ sang quy trình hoàn tiền, không áp dụng đơn/gia hạn lần nữa.
        if ("FAILED".equals(currentStatus)) {
            updatePaymentGroup(ref, "SUCCESS");
            createLatePaymentRefund(ref, db, "IPN thành công về sau khi link đã hết hiệu lực hoặc đã được thay thế");
            return Map.of("RspCode", "00", "Message", "Success");
        }

        if (!"PENDING".equals(currentStatus)) {
            return Map.of("RspCode", "02", "Message", "Already confirmed");
        }

        if ("DEPOSIT".equals(db.get("payment_type")) && isReservationExpired(db)) {
            Integer reservationId = ((Number) db.get("reservation_id")).intValue();
            jdbcTemplate.update(
                    "UPDATE reservations SET status = 'EXPIRED' WHERE id = ? AND status = 'PENDING'",
                    reservationId);
            updatePaymentGroup(ref, "SUCCESS");
            createLatePaymentRefund(ref, db, "IPN thành công sau 15 phút giữ chỗ");
            return Map.of("RspCode", "00", "Message", "Success");
        }

        if (isDebt) {
            // UC-20: trả xong khoản nợ → khách hết bị chặn đặt kho mới (PR-Q12 đếm DAMAGE_FEE PENDING)
            updatePaymentGroup(ref, "SUCCESS");
            logPayment(db, "[DEBT_PAID] Khách thanh toán phí sự cố " + ((BigDecimal) db.get("amount")).setScale(0, RoundingMode.HALF_UP).toPlainString()
                    + "đ qua VNPAY (" + ref + ")");
            return Map.of("RspCode", "00", "Message", "Success");
        }

        String err = "DEPOSIT".equals(db.get("payment_type")) ? settleDeposit(ref, db) : settleRenewal(ref, db);

        if (err != null) {
            updatePaymentGroup(ref, "SUCCESS");
            createLatePaymentRefund(ref, db, err);
            return Map.of("RspCode", "00", "Message", "Success");
        }

        updatePaymentGroup(ref, "SUCCESS");
        logPayment(db, "[VNPAY] Thanh toán " + ref + " thành công");
        return Map.of("RspCode", "00", "Message", "Success");
    }
    
    private String settleDeposit(String ref, Map<String, Object> p) {
        Integer id = ((Number) p.get("reservation_id")).intValue(); 
        var r = payments.findReservation(id);
        
        if (r != null && "PENDING".equals(r.get("status"))) { 
            payments.updateReservationToDepositPaid(id, (BigDecimal) r.get("deposit_amount"));
            return null; 
        }
        return "Invalid status";
    }
    
    private String settleRenewal(String ref, Map<String, Object> p) {
        var c = contracts.findDetailById(((Number) p.get("contract_id")).intValue()).orElse(null);
        if (c == null) return "Không tìm thấy hợp đồng";
        
        String previousStatus = c.getStatus() != null ? c.getStatus().toUpperCase() : "";
        LocalDate today = LocalDate.now(LateFeeService.VIETNAM_ZONE);
        LocalDate currentEnd = "TERMINATION_PENDING".equals(previousStatus)
                ? today
                : (c.getEndDate() == null || c.getEndDate().isBefore(today) ? today : c.getEndDate());
        Object monthsValue = p.get("renewal_months");
        if (!(monthsValue instanceof Number)) return "Giao dịch gia hạn thiếu số tháng";
        int monthsToRenew = ((Number) monthsValue).intValue();
        if (monthsToRenew != 1 && monthsToRenew != 3 && monthsToRenew != 6 && monthsToRenew != 12) {
            return "Số tháng gia hạn không hợp lệ";
        }
        c.setEndDate(currentEnd.plusMonths(monthsToRenew));
        // Flow 6: miễn phí trễ chỉ áp dụng cho đợt quá hạn vừa kết thúc
        c.setLateFeeWaived(false);
        c.setLateFeeWaiverNote(null);

        if (c.getStatus().matches("(?i)OVERDUE|TERMINATION_PENDING")) { 
            c.setStatus("ACTIVE");
            // UC-16: khách gia hạn → huỷ task check-out đang mở
            staffTasks.cancelOpenTasks(c.getId(), "CHECK_OUT");
            if (c.getReservation() != null) {
                c.getReservation().setStatus("UNIT_ASSIGNED");
                reservations.save(c.getReservation()); 
            }
            if ("TERMINATION_PENDING".equals(previousStatus)) {
                jdbcTemplate.update(
                        "UPDATE facility_tasks SET status = 'CANCELLED' " +
                        "WHERE contract_id = ? AND task_type = 'REFUND' AND status IN ('OPEN', 'IN_PROGRESS', 'OVERDUE')",
                        c.getId());
                jdbcTemplate.update(
                        "UPDATE payment_transactions SET status = 'FAILED', paid_at = NULL " +
                        "WHERE contract_id = ? AND payment_type = 'REFUND' AND status = 'PENDING'",
                        c.getId());
            }
        }
        
        contracts.save(c); 

        // PR-A9 & PR-A10: Ghi nhật ký hoạt động gia hạn hợp đồng (nuốt lỗi để không làm hỏng giao dịch tiền)
        try {
            var lateFeeDb = payments.findPayment("LF" + ref, false);
            BigDecimal lateFeeAmount = (lateFeeDb != null && lateFeeDb.get("amount") != null)
                    ? (BigDecimal) lateFeeDb.get("amount")
                    : BigDecimal.ZERO;

            String lateFeeInfo = lateFeeAmount.compareTo(BigDecimal.ZERO) > 0
                    ? " (kèm phí phạt trễ " + lateFeeAmount.setScale(0, RoundingMode.HALF_UP).toPlainString() + "đ)"
                    : "";
            String action = "[RENEW] Gia hạn hợp đồng " + c.getContractCode() + " thêm " + monthsToRenew + " tháng qua VNPAY"
                    + lateFeeInfo + ". Hạn mới: " + c.getEndDate();

            Integer userId = c.getCustomer() != null ? c.getCustomer().getId() : null;
            if (userId != null) {
                String truncatedAction = action.length() > 500 ? action.substring(0, 500) : action;
                jdbcTemplate.update(
                        "INSERT INTO activity_logs (user_id, action, target_entity, target_id, created_at) " +
                                "VALUES (?, ?, 'rental_contracts', ?, SYSDATETIME())",
                        userId, truncatedAction, String.valueOf(c.getId())
                );
            }
        } catch (Exception e) {
            System.err.println("[VNPAY Renewal] ⚠️ Lỗi ghi activity_logs cho HĐ " + c.getId() + ": " + e.getMessage());
        }

        return null;
    }

    private boolean isReservationExpired(Map<String, Object> payment) {
        if (payment.get("reservation_id") == null) return true;
        var reservation = payments.findReservation(((Number) payment.get("reservation_id")).intValue(), true);
        if (reservation == null || !"PENDING".equals(reservation.get("status"))) return true;
        Object value = reservation.get("created_at");
        LocalDateTime createdAt = value instanceof java.sql.Timestamp timestamp
                ? timestamp.toLocalDateTime()
                : (LocalDateTime) value;
        return !LocalDateTime.now(LateFeeService.VIETNAM_ZONE).isBefore(createdAt.plusMinutes(15));
    }

    // Dòng chính + các dòng phụ đi kèm: "LF" + ref (phí trễ), "OS" + ref (phí chiếm dụng, PR-Q14)
    private static final List<String> SUB_PAYMENT_PREFIXES = List.of("LF", "OS");

    private void updatePaymentGroup(String ref, String status) {
        payments.updatePayment(ref, status);
        for (String prefix : SUB_PAYMENT_PREFIXES) {
            var sub = payments.findPayment(prefix + ref, true);
            if (sub != null) payments.updatePayment(prefix + ref, status);
        }
    }

    private BigDecimal subPaymentsAmount(String ref) {
        BigDecimal total = BigDecimal.ZERO;
        for (String prefix : SUB_PAYMENT_PREFIXES) {
            var sub = payments.findPayment(prefix + ref, false);
            if (sub != null && sub.get("amount") != null) {
                total = total.add((BigDecimal) sub.get("amount"));
            }
        }
        return total;
    }

    private BigDecimal paymentGroupAmount(String ref, Map<String, Object> payment) {
        BigDecimal total = ((BigDecimal) payment.get("amount")).add(subPaymentsAmount(ref));
        return total.setScale(0, RoundingMode.HALF_UP);
    }

    private void createLatePaymentRefund(String originalRef, Map<String, Object> payment, String reason) {
        String refundRef = "REF-LATE-" + originalRef;
        BigDecimal amount = paymentGroupAmount(originalRef, payment);
        Integer userId = ((Number) payment.get("user_id")).intValue();
        Integer reservationId = payment.get("reservation_id") == null
                ? null : ((Number) payment.get("reservation_id")).intValue();
        Integer contractId = payment.get("contract_id") == null
                ? null : ((Number) payment.get("contract_id")).intValue();

        Integer existingRefund = jdbcTemplate.queryForObject(
                "SELECT COUNT(1) FROM payment_transactions WHERE transaction_code = ?",
                Integer.class, refundRef);
        if (existingRefund != null && existingRefund > 0) return;
        jdbcTemplate.update(
                "INSERT INTO payment_transactions " +
                "(transaction_code, user_id, reservation_id, contract_id, payment_type, payment_method, amount, status, paid_at) " +
                "VALUES (?, ?, ?, ?, 'REFUND', 'BANK_TRANSFER', ?, 'PENDING', NULL)",
                refundRef, userId, reservationId, contractId, amount);

        Integer facilityId = null;
        if (reservationId != null) {
            facilityId = jdbcTemplate.queryForObject(
                    "SELECT facility_id FROM reservations WHERE id = ?", Integer.class, reservationId);
        } else if (contractId != null) {
            facilityId = jdbcTemplate.queryForObject(
                    "SELECT su.facility_id FROM rental_contracts rc JOIN storage_units su ON su.id = rc.storage_unit_id WHERE rc.id = ?",
                    Integer.class, contractId);
        }
        if (facilityId == null) throw new IllegalStateException("Không xác định được cơ sở để tạo task hoàn tiền");

        List<Integer> managers = jdbcTemplate.query(
                "SELECT TOP 1 u.id FROM users u JOIN roles r ON r.id = u.role_id " +
                "WHERE u.facility_id = ? AND r.name = 'FACILITY_MANAGER' AND u.status = 'ACTIVE' ORDER BY u.id",
                (rs, rowNum) -> rs.getInt(1), facilityId);
        Integer managerId = managers.isEmpty() ? null : managers.get(0);
        LocalDateTime dueAt = LocalDateTime.now(LateFeeService.VIETNAM_ZONE).plusHours(24);
        if (dueAt.getDayOfWeek() == java.time.DayOfWeek.SUNDAY) dueAt = dueAt.plusDays(1);

        String note = String.format(
                "[HOÀN TIỀN VNPAY VỀ MUỘN] Mã gốc: %s | Số tiền: %s VND | Lý do: %s",
                originalRef, amount.setScale(0, RoundingMode.HALF_UP).toPlainString(), reason);
        jdbcTemplate.update(
                "INSERT INTO facility_tasks (facility_id, task_type, contract_id, staff_id, status, due_at, note, created_at) " +
                "VALUES (?, 'REFUND', ?, ?, 'OPEN', ?, ?, SYSDATETIME())",
                facilityId, contractId, managerId, dueAt, note);

        if (reservationId != null && "DEPOSIT".equals(payment.get("payment_type"))) {
            jdbcTemplate.update(
                    "UPDATE reservations SET status = 'REFUND_PENDING' " +
                    "WHERE id = ? AND status IN ('PENDING', 'EXPIRED', 'CANCELLED')",
                    reservationId);
        }
        logPayment(payment, "[VNPAY] Đã tạo yêu cầu hoàn " + amount.toPlainString() + "đ cho giao dịch về muộn " + originalRef);
    }

    private void logPayment(Map<String, Object> payment, String action) {
        try {
            Integer userId = ((Number) payment.get("user_id")).intValue();
            Object targetId = payment.get("contract_id") != null ? payment.get("contract_id") : payment.get("reservation_id");
            String target = payment.get("contract_id") != null ? "rental_contracts" : "reservations";
            jdbcTemplate.update(
                    "INSERT INTO activity_logs (user_id, action, target_entity, target_id, created_at) " +
                    "VALUES (?, ?, ?, ?, SYSDATETIME())",
                    userId, action.length() > 500 ? action.substring(0, 500) : action, target, String.valueOf(targetId));
        } catch (Exception e) {
            System.err.println("[VNPAY] Không ghi được activity log: " + e.getMessage());
        }
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
            BigDecimal expectedAmount = (BigDecimal) db.get("amount");

            // PR-Q6 / PR-Q14: Đối soát tổng tiền: cộng các dòng phụ LATE_FEE ("LF" + ref) và OVERSTAY_FEE ("OS" + ref)
            String ref = (String) db.get("transaction_code");
            if (ref != null && ref.startsWith("QKR")) {
                expectedAmount = expectedAmount.add(subPaymentsAmount(ref));
            }

            BigDecimal expectedVnpAmount = expectedAmount.multiply(BigDecimal.valueOf(100));
            return receivedAmount.compareTo(expectedVnpAmount) == 0;
        } catch (Exception e) { 
            return false; 
        } 
    }
    
    public Map<String, Object> status(String ref, Integer actorUserId) {
        var payment = payments.findPayment(ref, false);
        if (payment == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy giao dịch");
        if (!Objects.equals(actorUserId, ((Number) payment.get("user_id")).intValue())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn không có quyền xem giao dịch này");
        }
        return payments.paymentStatus(ref); 
    }
}
