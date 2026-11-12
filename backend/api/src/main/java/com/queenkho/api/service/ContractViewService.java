package com.queenkho.api.service;

import com.queenkho.api.dto.CustomerContractResponse;
import com.queenkho.api.entity.HeldGoods;
import com.queenkho.api.entity.RentalContract;
import com.queenkho.api.repository.HeldGoodsRepository;
import com.queenkho.api.repository.RentalContractRepository;
import com.queenkho.api.security.CurrentUser;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Màn xem hợp đồng (khách + FM): gom dữ liệu hợp đồng, tiền đã đóng, phí trễ / chiếm dụng,
 * dự tính hoàn cọc khi trả kho (UC-22/23), bảo hiểm, hàng lưu giữ... thành {@link CustomerContractResponse}.
 * Trước đây phần này nằm trong ContractController.toDto; tách xuống service để chạy trong 1 transaction chỉ đọc.
 * Công thức tiền vẫn dùng chung với lúc nghiệm thu thật: {@link StaffTaskService#calculateCheckoutRefund}.
 */
@Service
@Transactional(readOnly = true)
public class ContractViewService {

    private static final ZoneId VN_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    // Ghi chú task REFUND cũ có dạng "Phí hư hại 700.000" — dùng khi hợp đồng cũ chưa có damage_cases
    private static final Pattern LEGACY_DAMAGE_NOTE = Pattern.compile(
            "(?:Phí hư hại|Phi hu hai|Ph\\? hu h\\?i|Sự cố:)\\s*([0-9.,]+)", Pattern.CASE_INSENSITIVE);

    @Autowired
    private RentalContractRepository rentalContractRepository;

    @Autowired
    private HeldGoodsRepository heldGoodsRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private StaffTaskService staffTaskService;

    @Autowired
    private LateFeeService lateFeeService;

    @Autowired
    private RefundStatusService refundStatusService;

    @Autowired
    private RefundEvidenceService refundEvidenceService;

    @Autowired
    private OperationsCatalogService operationsCatalogService;

    @Autowired
    private HeldGoodsService heldGoodsService;

    // ── Truy vấn ────────────────────────────────────────────────────────────

    // GET /contracts/{id}
    public Optional<CustomerContractResponse> getDetail(Integer contractId) {
        return rentalContractRepository.findDetailById(contractId).map(this::toResponse);
    }

    // GET /contracts?reservationId=
    public Optional<CustomerContractResponse> getByReservation(Integer reservationId) {
        return rentalContractRepository.findByReservationId(reservationId).map(this::toResponse);
    }

    // GET /contracts?facilityId= | managerId= | customerId=
    // Khách chỉ được xem hợp đồng của chính mình, bỏ qua facilityId / managerId nếu có
    public List<CustomerContractResponse> listForViewer(CurrentUser user, Integer facilityId,
                                                        Integer managerId, Integer customerId) {
        List<RentalContract> contracts;
        if (user.hasRole("CUSTOMER")) {
            contracts = rentalContractRepository.findAllByCustomerId(user.id());
        } else if (facilityId != null) {
            contracts = rentalContractRepository.findAllByFacilityId(facilityId);
        } else if (managerId != null) {
            contracts = rentalContractRepository.findAllByManagerId(managerId);
        } else if (customerId != null) {
            contracts = rentalContractRepository.findAllByCustomerId(customerId);
        } else {
            throw new IllegalArgumentException("Cần truyền facilityId, managerId, customerId hoặc reservationId");
        }
        return contracts.stream().map(this::toResponse).toList();
    }

    // ── Ghép dữ liệu 1 hợp đồng ─────────────────────────────────────────────

    private CustomerContractResponse toResponse(RentalContract rc) {
        var su = rc.getStorageUnit();
        var ut = su.getUnitType();
        var reservation = rc.getReservation();
        String status = rc.getStatus();
        LocalDate today = LocalDate.now(VN_ZONE);

        // Tiền đã đóng (cọc + tiền thuê) từ payment_transactions
        BigDecimal totalPaid = sumPayments(rc, "status = 'SUCCESS' AND payment_type IN ('DEPOSIT', 'MONTHLY_RENT')");

        BigDecimal originalDeposit = (reservation != null && reservation.getDepositAmount() != null)
                ? reservation.getDepositAmount()
                : (isPositive(rc.getDepositHeldAmount()) ? rc.getDepositHeldAmount() : ut.getBasePriceMonthly());

        // Tiền thuê thực tế = Tổng đã đóng - Tiền cọc đang giữ
        BigDecimal deposit = isPositive(rc.getDepositHeldAmount())
                ? rc.getDepositHeldAmount()
                : (originalDeposit != null ? originalDeposit : BigDecimal.ZERO);
        BigDecimal rentPaid = totalPaid.compareTo(deposit) >= 0 ? totalPaid.subtract(deposit) : BigDecimal.ZERO;

        // Ngày hẹn trả kho nếu hợp đồng đang TERMINATION_PENDING (lấy từ task CHECK_OUT còn mở)
        LocalDate scheduledCheckoutDate = null;
        if ("TERMINATION_PENDING".equalsIgnoreCase(status)) {
            scheduledCheckoutDate = toDate(firstOrNull(
                    "SELECT TOP 1 due_at FROM facility_tasks WHERE contract_id = ? AND task_type = 'CHECK_OUT' "
                            + "AND status IN ('OPEN', 'IN_PROGRESS', 'OVERDUE') ORDER BY id DESC",
                    Timestamp.class, rc.getId()));
            if (scheduledCheckoutDate == null) {
                scheduledCheckoutDate = rc.getEndDate();
            }
        }

        // UC-28: phí trễ + PR-Q14 phí chiếm dụng — chỉ tính khi OVERDUE, hoặc đã hẹn trả nhưng end_date đã qua
        long overdueDays = 0L;
        BigDecimal lateFeeAmount = BigDecimal.ZERO;
        BigDecimal maxLateFeeAmount = BigDecimal.ZERO;
        boolean isMaxLateFeeReached = false;
        boolean isPinLocked = false;
        boolean canLiquidate = false;
        Integer liquidationDaysThreshold = LateFeeService.DEFAULT_LIQUIDATION_DAYS;
        BigDecimal estimatedOverdueDepositRefund = deposit;
        BigDecimal estimatedDepositRefund = deposit;
        BigDecimal overstayDailyAmount = BigDecimal.ZERO;
        BigDecimal overstayFeeAmount = BigDecimal.ZERO;
        BigDecimal totalOverdueCharge = BigDecimal.ZERO;
        BigDecimal amountBeyondDeposit = BigDecimal.ZERO;

        // (sửa 12/11/2026) Khách quá hạn rồi mới hẹn trả kho vẫn thấy phí trễ + phí chiếm dụng sẽ trừ vào cọc
        boolean pendingPastEnd = "TERMINATION_PENDING".equalsIgnoreCase(status)
                && rc.getEndDate() != null && today.isAfter(rc.getEndDate());
        if ("OVERDUE".equalsIgnoreCase(status) || pendingPastEnd) {
            var lateCalc = lateFeeService.calculateLateFee(rc);
            overstayDailyAmount = lateCalc.getOverstayDailyAmount();
            overstayFeeAmount = lateCalc.getOverstayFeeAmount();
            totalOverdueCharge = lateCalc.getTotalOverdueCharge();
            amountBeyondDeposit = lateCalc.getAmountBeyondDeposit();
            overdueDays = lateCalc.getOverdueDays();
            lateFeeAmount = lateCalc.getLateFeeAmount();
            maxLateFeeAmount = lateCalc.getMaxLateFeeAmount();
            isMaxLateFeeReached = lateCalc.isMaxLateFeeReached();
            isPinLocked = lateCalc.isPinLocked();
            canLiquidate = lateCalc.isCanLiquidate();
            liquidationDaysThreshold = lateCalc.getLiquidationDaysThreshold();
            estimatedOverdueDepositRefund = lateCalc.getEstimatedDepositRefund();
            estimatedDepositRefund = deposit.subtract(totalOverdueCharge).max(BigDecimal.ZERO);
        }

        // Tiền đã hoàn thực tế (giao dịch REFUND)
        BigDecimal refundAmount = sumPayments(rc, "status IN ('SUCCESS', 'PENDING') AND payment_type = 'REFUND'");

        // UC-24: sự cố lỗi khách trừ cọc; lỗi cơ sở chỉ hiển thị, không trừ
        BigDecimal damageFee = sumDamage(rc.getId(), "CUSTOMER");
        BigDecimal facilityDamageFee = sumDamage(rc.getId(), "FACILITY");
        if (damageFee.signum() == 0) {
            damageFee = legacyDamageFromRefundNote(rc.getId(), damageFee);
        }

        // PR-Q10: hàng của khách lưu giữ sau thanh lý (nếu có)
        HeldGoods heldGoods = heldGoodsRepository.findFirstByContract_IdOrderByIdDesc(rc.getId()).orElse(null);

        // Đã nghiệm thu trả kho chưa: có task REFUND hoặc biên bản CHECK_OUT
        boolean isInspectionCompleted = countOf(
                "SELECT COUNT(1) FROM facility_tasks WHERE contract_id = ? AND task_type = 'REFUND' AND status != 'CANCELLED'",
                rc.getId()) > 0
                || countOf("SELECT COUNT(1) FROM handover_records WHERE contract_id = ? AND record_type = 'CHECK_OUT'",
                rc.getId()) > 0;
        LocalDate completedAt = toDate(firstOrNull(
                "SELECT TOP 1 completed_at FROM facility_tasks WHERE contract_id = ? AND task_type = 'CHECK_OUT' "
                        + "AND completed_at IS NOT NULL ORDER BY id DESC",
                Timestamp.class, rc.getId()));
        LocalDate inspectionDate = completedAt != null ? completedAt : today;

        // Quyết toán hoàn tiền theo Business Rules (gồm hoàn tiền thuê trả sớm PR-O2) — cùng công thức lúc nghiệm thu
        var calc = staffTaskService.calculateCheckoutRefund(rc, inspectionDate, damageFee);
        boolean settled = isInspectionCompleted || "TERMINATED".equalsIgnoreCase(status);

        // Đã nghiệm thu mà trả trễ: lấy số phí trễ / chiếm dụng đã chốt trong quyết toán
        if (!"OVERDUE".equalsIgnoreCase(status) && !pendingPastEnd && settled && calc.isOverdueOrGrace()) {
            overdueDays = calc.getDaysPastEndDate();
            lateFeeAmount = orZero(calc.getGraceFee()).add(orZero(calc.getLateFee()));
            overstayFeeAmount = orZero(calc.getOverstayFee());
            totalOverdueCharge = lateFeeAmount.add(overstayFeeAmount);
            amountBeyondDeposit = orZero(calc.getOverstayDebtAmount());
        }
        if (settled && calc.getTotalRefundAmount() != null && calc.getTotalRefundAmount().compareTo(refundAmount) > 0) {
            refundAmount = calc.getTotalRefundAmount();
        }

        CustomerContractResponse dto = new CustomerContractResponse(
                rc.getId(),
                rc.getContractCode(),
                rc.getCustomer().getId(),
                rc.getCustomer().getFullName(),
                rc.getCustomer().getPhone(),
                su.getId(),
                ut.getName(),
                ut.getAreaSqm(),
                su.getFloor(),
                su.getZone(),
                su.getRoomNumber(),
                status,
                rc.getStartDate(),
                rc.getEndDate(),
                calc.getCycleMonths(),
                deposit,
                reservation.getReservationCode(),
                rc.getAccessPinCode(),
                rc.getRfidCardCode(),
                PricingService.contractMonthlyPrice(rc),
                reservation.getId(),
                totalPaid,
                rentPaid,
                scheduledCheckoutDate,
                overdueDays,
                lateFeeAmount,
                estimatedDepositRefund,
                originalDeposit,
                refundAmount,
                damageFee,
                isInspectionCompleted,
                calc.getDepositRefund(),
                calc.getEarlyRentRefund(),
                calc.getUsedMonths(),
                calc.getBreakFee(),
                maxLateFeeAmount,
                isMaxLateFeeReached,
                isPinLocked,
                canLiquidate,
                liquidationDaysThreshold,
                estimatedOverdueDepositRefund,
                su.getFacility() != null ? su.getFacility().getId() : null,
                Boolean.TRUE.equals(rc.getLateFeeWaived()) && ("OVERDUE".equalsIgnoreCase(status) || pendingPastEnd),
                rc.getLateFeeWaiverNote(),
                facilityDamageFee,
                reservation.getTermsVersion(),
                reservation.getTermsAcceptedAt(),
                heldGoods != null ? heldGoods.getStatus() : null,
                heldGoods != null ? heldGoods.getHoldUntil() : null,
                heldGoods != null ? heldGoods.getStorageLocation() : null,
                su.getFacility() != null ? su.getFacility().getName() : null,
                su.getFacility() != null ? su.getFacility().getAddress() : null,
                su.getFacility() != null ? su.getFacility().getHotline() : null,
                rc.getCustomer().getEmail(),
                rc.getCustomer().getCccd(),
                overstayDailyAmount,
                overstayFeeAmount,
                totalOverdueCharge,
                amountBeyondDeposit,
                refundStatusService.resolve(reservation.getId(), reservation.getReservationCode(), rc.getId()));

        // BR-125: gói bảo hiểm hàng hoá + trần bồi thường; BR-127: được chấm dứt không phí phá HĐ
        InsurancePlan plan = InsurancePlan.of(reservation.getInsurancePlan());
        dto.setInsurancePlan(plan.name());
        dto.setOverstayFeeWaived(Boolean.TRUE.equals(dto.getLateFeeWaived()) && Boolean.TRUE.equals(rc.getOverstayFeeWaived()));
        dto.setEmergencyUnit(su.isEmergencyUnit());
        dto.setInsurancePlanLabel(plan.label());
        dto.setInsurancePremiumMonthly(reservation.getInsurancePremiumMonthly());
        dto.setDeclaredGoodsValue(reservation.getDeclaredGoodsValue());
        dto.setCoverageCap(plan.coverageCap(reservation.getDeclaredGoodsValue()));
        dto.setInsured(plan.insured());
        dto.setFaultTermination(Boolean.TRUE.equals(rc.getFaultTermination()));
        dto.setGoodsCategories(operationsCatalogService.goodsLabels(reservation.getGoodsCategoryCodes()));
        dto.setGoodsDescription(reservation.getGoodsDescription());
        // BR-134: thanh lý rồi mà chưa có hồ sơ kho tổng → đang chờ nhân viên chuyển hàng
        dto.setCentralStorage(heldGoodsService.latestForContract(rc.getId()).orElse(null));
        dto.setRelocationPending("LIQUIDATED".equals(status) && dto.getCentralStorage() == null);
        dto.setRefundEvidence(refundEvidenceService.findCompleted(
                reservation.getId(), reservation.getReservationCode(), rc.getId()));
        return dto;
    }

    // ── Helper truy vấn ─────────────────────────────────────────────────────

    private BigDecimal sumPayments(RentalContract rc, String condition) {
        BigDecimal sum = jdbcTemplate.queryForObject(
                "SELECT COALESCE(SUM(amount), 0) FROM payment_transactions "
                        + "WHERE (contract_id = ? OR reservation_id = ?) AND " + condition,
                BigDecimal.class, rc.getId(), rc.getReservation().getId());
        return orZero(sum);
    }

    private BigDecimal sumDamage(Integer contractId, String liableParty) {
        BigDecimal sum = jdbcTemplate.queryForObject(
                "SELECT COALESCE(SUM(estimated_cost), 0) FROM damage_cases WHERE contract_id = ? AND liable_party = ?",
                BigDecimal.class, contractId, liableParty);
        return orZero(sum);
    }

    private int countOf(String sql, Integer contractId) {
        Integer count = jdbcTemplate.queryForObject(sql, Integer.class, contractId);
        return count != null ? count : 0;
    }

    // Câu SELECT TOP 1 có thể không có dòng nào → null (queryForObject sẽ ném lỗi khi rỗng)
    private <T> T firstOrNull(String sql, Class<T> type, Object... args) {
        List<T> rows = jdbcTemplate.queryForList(sql, type, args);
        return rows.isEmpty() ? null : rows.get(0);
    }

    // Hợp đồng cũ chưa có damage_cases: đọc số tiền sự cố từ ghi chú task REFUND gần nhất
    private BigDecimal legacyDamageFromRefundNote(Integer contractId, BigDecimal fallback) {
        String note = firstOrNull(
                "SELECT TOP 1 note FROM facility_tasks WHERE contract_id = ? AND task_type = 'REFUND' ORDER BY id DESC",
                String.class, contractId);
        if (note == null) {
            return fallback;
        }
        Matcher m = LEGACY_DAMAGE_NOTE.matcher(note);
        if (!m.find()) {
            return fallback;
        }
        String val = m.group(1).trim();
        if (val.endsWith(".00")) {
            val = val.substring(0, val.length() - 3);
        }
        try {
            return new BigDecimal(val.replace(",", "").replace(".", ""));
        } catch (NumberFormatException e) {
            return fallback;
        }
    }

    private static LocalDate toDate(Timestamp ts) {
        return ts != null ? ts.toLocalDateTime().toLocalDate() : null;
    }

    private static boolean isPositive(BigDecimal value) {
        return value != null && value.signum() > 0;
    }

    private static BigDecimal orZero(BigDecimal value) {
        return value != null ? value : BigDecimal.ZERO;
    }
}
