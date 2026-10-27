package com.queenkho.api.service;

import com.queenkho.api.dto.HeldGoodsResponse;
import com.queenkho.api.dto.ResolveHeldGoodsRequest;
import com.queenkho.api.entity.HeldGoods;
import com.queenkho.api.entity.RentalContract;
import com.queenkho.api.entity.StaffTask;
import com.queenkho.api.entity.User;
import com.queenkho.api.exception.HeldGoodsException;
import com.queenkho.api.repository.HeldGoodsRepository;
import com.queenkho.api.repository.StaffTaskRepository;
import com.queenkho.api.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.NumberFormat;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * PR-Q10 — Điều khoản xử lý tài sản khi không trả kho: hàng của khách sau thanh lý.
 *  - Lập hồ sơ khi "Dọn xong" task dọn kho (StaffTaskService.completeMaintenanceTask), lưu giữ 60 ngày.
 *  - FM chốt 1 trong 4 cách: khách nhận lại (phải hết nợ) · bán thanh lý (hết hạn + khách đã đồng ý điều khoản)
 *    · tiêu huỷ (hết hạn) · giao cơ quan chức năng (bất cứ lúc nào: hàng cấm, giấy tờ tuỳ thân).
 *  - Bán thanh lý: tiền bán trừ nợ DAMAGE_FEE còn PENDING của khách, phần dư + cọc còn giữ → 1 task REFUND cho FM.
 */
@Service
public class HeldGoodsService {

    public static final int HOLD_DAYS = 60;
    private static final List<String> OUTCOMES = List.of("RETURNED", "SOLD", "DESTROYED", "HANDED_TO_AUTHORITY");
    private static final String IMG_DELIMITER = "\n|||\n";

    @Autowired
    private HeldGoodsRepository heldGoodsRepository;

    @Autowired
    private StaffTaskRepository staffTaskRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ActivityLogService activityLogService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    // ================== LẬP HỒ SƠ (gọi từ StaffTaskService khi "Dọn xong") ==================

    // Dữ liệu đã được StaffTaskService kiểm tra. Hạn lưu giữ tính từ ngày thanh lý (= ngày sinh task dọn kho).
    @Transactional
    public HeldGoods createFromCleanup(StaffTask task, RentalContract contract, User actor, String inventoryNote,
                                       List<String> images, String witnessNote, String storageLocation) {
        LocalDate liquidatedOn = task.getCreatedAt() != null ? task.getCreatedAt().toLocalDate() : LocalDate.now();
        HeldGoods goods = new HeldGoods();
        goods.setContract(contract);
        goods.setFacilityId(task.getFacilityId());
        goods.setTaskId(task.getId());
        goods.setInventoryNote(inventoryNote);
        goods.setEvidenceImageUrls(String.join(IMG_DELIMITER, images));
        goods.setWitnessNote(witnessNote);
        goods.setStorageLocation(storageLocation);
        goods.setStatus("HOLDING");
        goods.setHoldUntil(liquidatedOn.plusDays(HOLD_DAYS));
        goods.setCreatedBy(actor);
        HeldGoods saved = heldGoodsRepository.save(goods);

        activityLogService.log(actor.getId(),
                "[GOODS_HELD] Lập hồ sơ lưu giữ hàng HĐ " + contract.getContractCode() + " tại " + storageLocation
                        + ", lưu đến " + saved.getHoldUntil(),
                "held_goods", String.valueOf(saved.getId()));
        return saved;
    }

    // ================== DANH SÁCH (FM) ==================

    // scope HOLDING = đang lưu giữ, RESOLVED = đã xử lý
    @Transactional(readOnly = true)
    public List<HeldGoodsResponse> getBoard(Integer actorId, String scope) {
        User manager = requireManager(actorId);
        List<String> statuses = "RESOLVED".equalsIgnoreCase(scope)
                ? List.of("RETURNED", "SOLD", "DESTROYED", "HANDED_TO_AUTHORITY")
                : List.of("HOLDING");
        return heldGoodsRepository.findBoard(manager.getFacilityId(), statuses).stream()
                .map(this::toResponse)
                .toList();
    }

    // ================== XỬ LÝ (FM) ==================

    @Transactional
    public HeldGoodsResponse resolve(Integer id, Integer actorId, ResolveHeldGoodsRequest request) {
        User manager = requireManager(actorId);
        HeldGoods goods = heldGoodsRepository.findDetailById(id)
                .orElseThrow(() -> new HeldGoodsException(HttpStatus.NOT_FOUND, "HELD_GOODS_NOT_FOUND", "Không tìm thấy hồ sơ lưu giữ hàng"));
        if (!goods.getFacilityId().equals(manager.getFacilityId())) {
            throw new HeldGoodsException(HttpStatus.FORBIDDEN, "FORBIDDEN_FACILITY", "Hồ sơ không thuộc cơ sở của bạn");
        }

        String outcome = request != null && request.getOutcome() != null ? request.getOutcome().trim().toUpperCase() : "";
        if (!OUTCOMES.contains(outcome)) {
            throw new HeldGoodsException(HttpStatus.BAD_REQUEST, "INVALID_INPUT",
                    "Cách xử lý phải là RETURNED, SOLD, DESTROYED hoặc HANDED_TO_AUTHORITY");
        }
        String note = request.getNote() != null ? request.getNote().trim() : "";
        if (note.length() < 10 || note.length() > 1000) {
            throw new HeldGoodsException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Ghi chú / biên bản bắt buộc, từ 10 đến 1000 ký tự");
        }
        if (!"HOLDING".equals(goods.getStatus())) {
            throw new HeldGoodsException(HttpStatus.CONFLICT, "HELD_GOODS_ALREADY_RESOLVED", "Hồ sơ này đã được xử lý trước đó");
        }

        RentalContract contract = goods.getContract();
        Integer customerId = contract.getCustomer() != null ? contract.getCustomer().getId() : null;
        boolean holdExpired = LocalDate.now().isAfter(goods.getHoldUntil());
        BigDecimal debt = customerDebt(customerId);

        BigDecimal proceeds = null;
        BigDecimal debtOffset = null;
        BigDecimal refund = null;

        switch (outcome) {
            case "RETURNED" -> {
                // Điều khoản mục 4: khách nhận lại sau khi thanh toán đủ các khoản còn nợ
                if (debt.compareTo(BigDecimal.ZERO) > 0) {
                    throw new HeldGoodsException(HttpStatus.CONFLICT, "CUSTOMER_HAS_DEBT",
                            "Khách còn nợ " + vnd(debt) + "đ — cần thanh toán hết trước khi nhận lại hàng");
                }
            }
            case "SOLD" -> {
                if (!holdExpired) {
                    throw new HeldGoodsException(HttpStatus.CONFLICT, "HOLD_NOT_EXPIRED",
                            "Chưa hết thời hạn lưu giữ (đến hết ngày " + goods.getHoldUntil() + ")");
                }
                if (termsVersion(contract) == null) {
                    throw new HeldGoodsException(HttpStatus.CONFLICT, "TERMS_NOT_ACCEPTED",
                            "Khách chưa đồng ý Điều khoản xử lý tài sản — không được bán, chỉ trả khách hoặc giao cơ quan chức năng");
                }
                if (request.getProceedsAmount() == null || request.getProceedsAmount().compareTo(BigDecimal.ZERO) < 0) {
                    throw new HeldGoodsException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Nhập số tiền bán thanh lý (≥ 0)");
                }
                proceeds = request.getProceedsAmount();
                debtOffset = proceeds.min(debt);
            }
            case "DESTROYED" -> {
                if (!holdExpired) {
                    throw new HeldGoodsException(HttpStatus.CONFLICT, "HOLD_NOT_EXPIRED",
                            "Chưa hết thời hạn lưu giữ (đến hết ngày " + goods.getHoldUntil() + ")");
                }
            }
            default -> {
                // HANDED_TO_AUTHORITY: hàng cấm / giấy tờ tuỳ thân — làm ngay, không chờ hết hạn
            }
        }

        // PR-Q15: phí lưu giữ hàng (khách đồng ý điều khoản v2). Thu theo thứ tự: tiền bán còn dư → cọc còn giữ
        // → (chỉ khi khách nhận lại) khách trả tại quầy. Không đủ thì cơ sở tự chịu phần thiếu, không sinh nợ mới.
        // Giao cho cơ quan chức năng (hàng cấm / giấy tờ) không tính phí.
        BigDecimal storageFee = "HANDED_TO_AUTHORITY".equals(outcome) ? BigDecimal.ZERO : storageFee(goods, LocalDate.now());
        boolean depositAvailable = includeRemainingDeposit(contract);
        BigDecimal depositHeld = depositAvailable ? contract.getDepositHeldAmount() : BigDecimal.ZERO;
        BigDecimal surplus = proceeds != null ? proceeds.subtract(debtOffset) : BigDecimal.ZERO;
        BigDecimal feeFromSale = storageFee.min(surplus);
        BigDecimal feeFromDeposit = storageFee.subtract(feeFromSale).min(depositHeld);
        BigDecimal feeAtCounter = storageFee.subtract(feeFromSale).subtract(feeFromDeposit);
        if ("RETURNED".equals(outcome) && feeAtCounter.compareTo(BigDecimal.ZERO) > 0
                && !Boolean.TRUE.equals(request.getStorageFeeCollected())) {
            throw new HeldGoodsException(HttpStatus.CONFLICT, "STORAGE_FEE_UNPAID",
                    "Khách cần trả phí lưu giữ còn thiếu " + vnd(feeAtCounter) + "đ tại quầy trước khi nhận lại hàng");
        }
        if (!"RETURNED".equals(outcome)) {
            feeAtCounter = BigDecimal.ZERO;
        }
        BigDecimal feeCharged = feeFromSale.add(feeFromDeposit).add(feeAtCounter);

        if ("SOLD".equals(outcome)) {
            // Tính phần hoàn trước khi UPDATE để lưu luôn vào hồ sơ
            refund = surplus.subtract(feeFromSale).add(depositHeld.subtract(feeFromDeposit));
        }

        // UPDATE có điều kiện status = HOLDING: chống bấm đúp / 2 người xử lý cùng lúc
        int updated = heldGoodsRepository.resolve(id, outcome, note, manager, proceeds, debtOffset, refund,
                storageFee.compareTo(BigDecimal.ZERO) > 0 ? feeCharged : null);
        if (updated == 0) {
            throw new HeldGoodsException(HttpStatus.CONFLICT, "HELD_GOODS_ALREADY_RESOLVED", "Hồ sơ này đã được xử lý trước đó");
        }

        recordStorageFee(contract, customerId, feeFromSale, "GOODS_SALE");
        recordStorageFee(contract, customerId, feeFromDeposit, "DEPOSIT_OFFSET");
        recordStorageFee(contract, customerId, feeAtCounter, "CASH");
        if (feeFromDeposit.compareTo(BigDecimal.ZERO) > 0) {
            jdbcTemplate.update("UPDATE rental_contracts SET deposit_held_amount = deposit_held_amount - ? WHERE id = ?",
                    feeFromDeposit, contract.getId());
        }

        if ("SOLD".equals(outcome)) {
            if (debtOffset.compareTo(BigDecimal.ZERO) > 0) {
                offsetDebts(customerId, debtOffset);
            }
            if (refund.compareTo(BigDecimal.ZERO) > 0) {
                createRefundTask(contract, manager, refund, surplus.subtract(feeFromSale));
            }
        }

        activityLogService.log(manager.getId(),
                "[GOODS_" + outcome + "] HĐ " + contract.getContractCode() + ": " + note
                        + (proceeds != null ? " (bán " + vnd(proceeds) + "đ, trừ nợ " + vnd(debtOffset) + "đ, hoàn khách " + vnd(refund) + "đ)" : "")
                        + (feeCharged.compareTo(BigDecimal.ZERO) > 0 ? " · phí lưu giữ " + vnd(feeCharged) + "đ" : ""),
                "held_goods", String.valueOf(id));

        return toResponse(heldGoodsRepository.findDetailById(id).orElseThrow());
    }

    // ================== PHÍ LƯU GIỮ (PR-Q15) ==================

    /** Số ngày đã lưu giữ tính đến asOf (tối đa đến hết hạn lưu giữ) */
    static long heldDays(HeldGoods goods, LocalDate asOf) {
        LocalDate start = goods.getHoldUntil().minusDays(HOLD_DAYS);
        LocalDate end = asOf.isAfter(goods.getHoldUntil()) ? goods.getHoldUntil() : asOf;
        return Math.max(0, ChronoUnit.DAYS.between(start, end));
    }

    /** Phí 1 ngày lưu giữ = giá ngày của ô cũ × held_goods_fee_percent; 0 nếu khách chưa đồng ý điều khoản v2 */
    BigDecimal storageFeePerDay(RentalContract contract) {
        if (!LateFeeService.acceptsOverstayTerms(termsVersion(contract))) return BigDecimal.ZERO;
        BigDecimal monthly = contract.getStorageUnit() != null && contract.getStorageUnit().getUnitType() != null
                ? contract.getStorageUnit().getUnitType().getBasePriceMonthly() : null;
        return LateFeeService.dailyRate(monthly).multiply(BigDecimal.valueOf(storageFeePercent(contract)))
                .divide(BigDecimal.valueOf(100), 0, RoundingMode.HALF_UP);
    }

    BigDecimal storageFee(HeldGoods goods, LocalDate asOf) {
        return storageFeePerDay(goods.getContract()).multiply(BigDecimal.valueOf(heldDays(goods, asOf)));
    }

    private int storageFeePercent(RentalContract contract) {
        if (contract.getRentalPolicyId() == null) return LateFeeService.DEFAULT_HELD_GOODS_FEE_PERCENT;
        List<Integer> rows = jdbcTemplate.queryForList(
                "SELECT held_goods_fee_percent FROM rental_policy WHERE id = ?", Integer.class, contract.getRentalPolicyId());
        return rows == null || rows.isEmpty() || rows.get(0) == null
                ? LateFeeService.DEFAULT_HELD_GOODS_FEE_PERCENT : rows.get(0);
    }

    // Phí lưu giữ là doanh thu chiếm dụng → ghi OVERSTAY_FEE SUCCESS (method cho biết nguồn tiền)
    private void recordStorageFee(RentalContract contract, Integer customerId, BigDecimal amount, String method) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0 || customerId == null) return;
        Integer reservationId = contract.getReservation() != null ? contract.getReservation().getId() : null;
        jdbcTemplate.update(
                "INSERT INTO payment_transactions (transaction_code, user_id, reservation_id, contract_id, payment_type, " +
                        "payment_method, amount, status, paid_at) VALUES (?, ?, ?, ?, 'OVERSTAY_FEE', ?, ?, 'SUCCESS', SYSDATETIME())",
                "HG-" + method.charAt(0) + "-" + contract.getId() + "-" + (System.currentTimeMillis() % 100000),
                customerId, reservationId, contract.getId(), method, amount);
    }

    // ================== HELPERS ==================

    private User requireManager(Integer actorId) {
        if (actorId == null) {
            throw new HeldGoodsException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Thiếu thông tin người thao tác");
        }
        User user = userRepository.findById(actorId)
                .orElseThrow(() -> new HeldGoodsException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "Không tìm thấy tài khoản"));
        if (user.getRole() == null || !"FACILITY_MANAGER".equals(user.getRole().getName())) {
            throw new HeldGoodsException(HttpStatus.FORBIDDEN, "FORBIDDEN_ROLE", "Chỉ Quản lý cơ sở mới xử lý hàng lưu giữ");
        }
        return user;
    }

    // Nợ phí sự cố còn PENDING của khách (mọi hợp đồng) — giống điều kiện chặn đặt kho PR-Q12
    BigDecimal customerDebt(Integer customerId) {
        if (customerId == null) return BigDecimal.ZERO;
        BigDecimal debt = jdbcTemplate.queryForObject(
                "SELECT COALESCE(SUM(amount), 0) FROM payment_transactions WHERE payment_type IN ('DAMAGE_FEE', 'OVERSTAY_FEE') AND status = 'PENDING' AND renewal_months IS NULL " +
                        "AND (user_id = ? OR contract_id IN (SELECT id FROM rental_contracts WHERE customer_id = ?))",
                BigDecimal.class, customerId, customerId);
        return debt != null ? debt : BigDecimal.ZERO;
    }

    // Trừ nợ bằng tiền bán hàng, khoản cũ trước. Khoản trừ không hết thì tách: phần đã trả SUCCESS, phần còn lại vẫn PENDING.
    private void offsetDebts(Integer customerId, BigDecimal amount) {
        List<Map<String, Object>> debts = jdbcTemplate.queryForList(
                "SELECT id, amount, user_id, reservation_id, contract_id, payment_type FROM payment_transactions " +
                        "WHERE payment_type IN ('DAMAGE_FEE', 'OVERSTAY_FEE') AND status = 'PENDING' AND renewal_months IS NULL " +
                        "AND (user_id = ? OR contract_id IN (SELECT id FROM rental_contracts WHERE customer_id = ?)) ORDER BY id",
                customerId, customerId);
        BigDecimal remaining = amount;
        for (Map<String, Object> d : debts) {
            if (remaining.compareTo(BigDecimal.ZERO) <= 0) break;
            BigDecimal due = (BigDecimal) d.get("amount");
            Integer debtId = ((Number) d.get("id")).intValue();
            if (remaining.compareTo(due) >= 0) {
                jdbcTemplate.update("UPDATE payment_transactions SET status = 'SUCCESS', payment_method = 'GOODS_SALE', " +
                        "paid_at = SYSDATETIME() WHERE id = ? AND status = 'PENDING'", debtId);
                remaining = remaining.subtract(due);
            } else {
                jdbcTemplate.update("UPDATE payment_transactions SET amount = amount - ? WHERE id = ? AND status = 'PENDING'",
                        remaining, debtId);
                jdbcTemplate.update(
                        "INSERT INTO payment_transactions (transaction_code, user_id, reservation_id, contract_id, payment_type, " +
                                "payment_method, amount, status, paid_at) VALUES (?, ?, ?, ?, ?, 'GOODS_SALE', ?, 'SUCCESS', SYSDATETIME())",
                        "DMG-SALE-" + debtId + "-" + (System.currentTimeMillis() % 100000),
                        d.get("user_id"), d.get("reservation_id"), d.get("contract_id"),
                        d.get("payment_type") != null ? d.get("payment_type") : "DAMAGE_FEE", remaining);
                remaining = BigDecimal.ZERO;
            }
        }
    }

    // Cọc còn giữ sau thanh lý được gộp vào lần hoàn này nếu FM chưa tạo yêu cầu hoàn cọc riêng
    // (trigger trg_facility_tasks_refund_sync đặt deposit_held_amount = 0 khi task REFUND của HĐ hoàn tất)
    private boolean includeRemainingDeposit(RentalContract contract) {
        if (contract.getDepositHeldAmount() == null || contract.getDepositHeldAmount().compareTo(BigDecimal.ZERO) <= 0) {
            return false;
        }
        Integer refundTasks = jdbcTemplate.queryForObject(
                "SELECT COUNT(1) FROM facility_tasks WHERE contract_id = ? AND task_type = 'REFUND'", Integer.class, contract.getId());
        return refundTasks == null || refundTasks == 0;
    }

    // Task REFUND cho FM (PR-O12) + giao dịch REFUND PENDING — ghi chú đúng định dạng refundParser ở FE
    private void createRefundTask(RentalContract contract, User manager, BigDecimal refund, BigDecimal surplus) {
        String customerName = contract.getCustomer() != null ? contract.getCustomer().getFullName() : "";
        String customerPhone = contract.getCustomer() != null ? contract.getCustomer().getPhone() : "";
        BigDecimal depositPart = refund.subtract(surplus);
        String note = "Hoàn tiền bán thanh lý hàng | HĐ: " + contract.getContractCode()
                + (customerName != null && !customerName.isBlank()
                    ? " | Khách: " + customerName + (customerPhone != null && !customerPhone.isBlank() ? " (SĐT: " + customerPhone + ")" : "")
                    : "")
                + " => Dư tiền bán: " + vnd(surplus) + "đ"
                + (depositPart.compareTo(BigDecimal.ZERO) > 0 ? " + Cọc còn giữ: " + vnd(depositPart) + "đ" : "")
                + " => THỰC HOÀN " + vnd(refund) + "đ | Bán thanh lý hàng lưu giữ theo Điều khoản xử lý tài sản";
        if (note.length() > 1000) {
            note = note.substring(0, 997) + "...";
        }

        StaffTask task = new StaffTask();
        task.setFacilityId(manager.getFacilityId());
        task.setContract(contract);
        task.setTaskType("REFUND");
        task.setStatus("OPEN");
        task.setStaff(manager);
        task.setDueAt(refundDeadline(LocalDateTime.now()));
        task.setNote(note);
        staffTaskRepository.save(task);

        jdbcTemplate.update(
                "INSERT INTO payment_transactions (transaction_code, user_id, reservation_id, contract_id, payment_type, " +
                        "payment_method, amount, status, paid_at) VALUES (?, ?, NULL, ?, 'REFUND', 'BANK_TRANSFER', ?, 'PENDING', NULL)",
                "REF-SALE-" + contract.getId() + "-" + (System.currentTimeMillis() % 100000),
                contract.getCustomer().getId(), contract.getId(), refund);
    }

    // PR-93: hạn hoàn tiền 24h, không tính Chủ Nhật (giống ContractService.refundRemainingDeposit)
    private static LocalDateTime refundDeadline(LocalDateTime now) {
        LocalDateTime due = now.plusHours(24);
        if (now.getDayOfWeek() == DayOfWeek.SUNDAY) {
            due = now.plusDays(1).plusHours(24);
        } else if (due.getDayOfWeek() == DayOfWeek.SUNDAY) {
            due = due.plusDays(1);
        }
        return due;
    }

    private static String termsVersion(RentalContract contract) {
        return contract.getReservation() != null ? contract.getReservation().getTermsVersion() : null;
    }

    private HeldGoodsResponse toResponse(HeldGoods g) {
        RentalContract c = g.getContract();
        LocalDate today = LocalDate.now();
        boolean expired = today.isAfter(g.getHoldUntil());
        String terms = termsVersion(c);
        Integer customerId = c.getCustomer() != null ? c.getCustomer().getId() : null;
        return HeldGoodsResponse.builder()
                .id(g.getId())
                .taskId(g.getTaskId())
                .contractId(c.getId())
                .contractCode(c.getContractCode())
                .customerName(c.getCustomer() != null ? c.getCustomer().getFullName() : null)
                .customerPhone(c.getCustomer() != null ? c.getCustomer().getPhone() : null)
                .storageUnitId(c.getStorageUnit() != null ? c.getStorageUnit().getId() : null)
                .inventoryNote(g.getInventoryNote())
                .evidenceImages(parseImages(g.getEvidenceImageUrls()))
                .witnessNote(g.getWitnessNote())
                .storageLocation(g.getStorageLocation())
                .status(g.getStatus())
                .holdUntil(g.getHoldUntil())
                .daysLeft(ChronoUnit.DAYS.between(today, g.getHoldUntil()))
                .holdExpired(expired)
                .termsVersion(terms)
                .canSell("HOLDING".equals(g.getStatus()) && expired && terms != null)
                .customerDebt(customerDebt(customerId))
                .depositHeld(c.getDepositHeldAmount() != null ? c.getDepositHeldAmount() : BigDecimal.ZERO)
                .proceedsAmount(g.getProceedsAmount())
                .debtOffsetAmount(g.getDebtOffsetAmount())
                .refundAmount(g.getRefundAmount())
                .storageFeePerDay(storageFeePerDay(c))
                .heldDays(heldDays(g, today))
                .estimatedStorageFee("HOLDING".equals(g.getStatus()) ? storageFee(g, today) : null)
                .storageFeeAmount(g.getStorageFeeAmount())
                .resolvedNote(g.getResolvedNote())
                .resolvedByName(g.getResolvedBy() != null ? g.getResolvedBy().getFullName() : null)
                .resolvedAt(g.getResolvedAt())
                .createdByName(g.getCreatedBy() != null ? g.getCreatedBy().getFullName() : null)
                .createdAt(g.getCreatedAt())
                .build();
    }

    private static List<String> parseImages(String raw) {
        if (raw == null || raw.isBlank()) return Collections.emptyList();
        List<String> result = new ArrayList<>();
        for (String part : raw.split("\\R?\\|\\|\\|\\R?")) {
            if (!part.isBlank()) result.add(part.trim());
        }
        return result;
    }

    private static String vnd(BigDecimal amount) {
        return NumberFormat.getInstance(new Locale("vi", "VN")).format(amount != null ? amount : BigDecimal.ZERO);
    }
}
