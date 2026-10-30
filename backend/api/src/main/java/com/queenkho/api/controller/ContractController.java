package com.queenkho.api.controller;

import com.queenkho.api.service.FloorPlanService;
import com.queenkho.api.service.LateFeeService;
import com.queenkho.api.service.RenewalPolicyService;
import com.queenkho.api.dto.CustomerContractResponse;
import com.queenkho.api.entity.HeldGoods;
import com.queenkho.api.entity.RentalContract;
import com.queenkho.api.repository.HeldGoodsRepository;
import com.queenkho.api.repository.RentalContractRepository;
import com.queenkho.api.security.CurrentUser;
import com.queenkho.api.security.CurrentUserProvider;
import com.queenkho.api.security.OwnershipGuard;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/contracts")
public class ContractController {

    @Autowired
    private RentalContractRepository rentalContractRepository;

    @Autowired
    private HeldGoodsRepository heldGoodsRepository;

    @Autowired
    private org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    @Autowired
    private com.queenkho.api.service.ContractService contractService;

    @Autowired
    private com.queenkho.api.service.StaffTaskService staffTaskService;

    @Autowired
    private com.queenkho.api.service.LateFeeService lateFeeService;

    // PR-90: người thao tác lấy từ token; hợp đồng theo id phải thuộc khách / cơ sở của người gọi
    @Autowired
    private CurrentUserProvider currentUser;

    @Autowired
    private OwnershipGuard ownershipGuard;

    @Autowired
    private com.queenkho.api.service.PricingService pricingService;

    @Autowired
    private RenewalPolicyService renewalPolicyService;

    @Autowired
    private FloorPlanService floorPlanService;

    @ExceptionHandler(com.queenkho.api.exception.ContractException.class)
    public ResponseEntity<?> handleContractException(com.queenkho.api.exception.ContractException ex) {
        return ResponseEntity.status(ex.getStatus())
                .body(Map.of("error", ex.getCode(), "message", ex.getMessage()));
    }

    private CustomerContractResponse toDto(RentalContract rc) {
        var su = rc.getStorageUnit();
        var ut = su.getUnitType();

        // Tính tổng tiền thực tế đã đóng từ payment_transactions
        BigDecimal totalPaid = BigDecimal.ZERO;
        try {
            totalPaid = jdbcTemplate.queryForObject(
                    "SELECT COALESCE(SUM(amount), 0) FROM payment_transactions " +
                            "WHERE (contract_id = ? OR reservation_id = ?) AND status = 'SUCCESS' AND payment_type IN ('DEPOSIT', 'MONTHLY_RENT')",
                    BigDecimal.class,
                    rc.getId(), rc.getReservation().getId());
        } catch (Exception ignored) {
        }

        BigDecimal originalDeposit = (rc.getReservation() != null && rc.getReservation().getDepositAmount() != null)
                ? rc.getReservation().getDepositAmount()
                : (rc.getDepositHeldAmount() != null && rc.getDepositHeldAmount().compareTo(BigDecimal.ZERO) > 0
                        ? rc.getDepositHeldAmount()
                        : ut.getBasePriceMonthly());

        // Tiền thuê thực tế = Tổng đã đóng - Tiền cọc gốc
        BigDecimal deposit = (rc.getDepositHeldAmount() != null && rc.getDepositHeldAmount().compareTo(BigDecimal.ZERO) > 0)
                ? rc.getDepositHeldAmount()
                : (originalDeposit != null ? originalDeposit : BigDecimal.ZERO);
        BigDecimal rentPaid = totalPaid.compareTo(deposit) >= 0 ? totalPaid.subtract(deposit) : BigDecimal.ZERO;

        // Ngày hẹn trả kho nếu hợp đồng đang TERMINATION_PENDING
        java.time.LocalDate scheduledCheckoutDate = null;
        if ("TERMINATION_PENDING".equalsIgnoreCase(rc.getStatus())) {
            try {
                var dueAtTimestamp = jdbcTemplate.queryForObject(
                        "SELECT TOP 1 due_at FROM facility_tasks WHERE contract_id = ? AND task_type = 'CHECK_OUT' AND status IN ('OPEN', 'IN_PROGRESS', 'OVERDUE') ORDER BY id DESC",
                        java.sql.Timestamp.class,
                        rc.getId());
                if (dueAtTimestamp != null) {
                    scheduledCheckoutDate = dueAtTimestamp.toLocalDateTime().toLocalDate();
                }
            } catch (Exception ignored) {
            }
            if (scheduledCheckoutDate == null) {
                scheduledCheckoutDate = rc.getEndDate();
            }
        }

        LocalDate today = LocalDate.now(java.time.ZoneId.of("Asia/Ho_Chi_Minh"));

        // Tính phí trễ hạn và các chỉ số quá hạn cho UC-28 (LƯỢT 2)
        // Phí trễ và isPinLocked chỉ tính khi status = OVERDUE; các trạng thái khác trả 0 / false
        long overdueDays = 0L;
        BigDecimal lateFeeAmount = BigDecimal.ZERO;
        BigDecimal maxLateFeeAmount = BigDecimal.ZERO;
        Boolean isMaxLateFeeReached = false;
        Boolean isPinLocked = false;
        Boolean canLiquidate = false;
        Integer liquidationDaysThreshold = LateFeeService.DEFAULT_LIQUIDATION_DAYS;
        BigDecimal estimatedOverdueDepositRefund = deposit;
        BigDecimal estimatedDepositRefund = deposit;
        // PR-Q14: phí chiếm dụng
        BigDecimal overstayDailyAmount = BigDecimal.ZERO;
        BigDecimal overstayFeeAmount = BigDecimal.ZERO;
        BigDecimal totalOverdueCharge = BigDecimal.ZERO;
        BigDecimal amountBeyondDeposit = BigDecimal.ZERO;

        if ("OVERDUE".equalsIgnoreCase(rc.getStatus())) {
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
            estimatedDepositRefund = deposit.subtract(totalOverdueCharge);
            if (estimatedDepositRefund.compareTo(BigDecimal.ZERO) < 0) {
                estimatedDepositRefund = BigDecimal.ZERO;
            }
        }

        // Tính tổng tiền hoàn thực tế (từ giao dịch REFUND hoặc task REFUND của hợp đồng)
        BigDecimal refundAmount = BigDecimal.ZERO;
        try {
            refundAmount = jdbcTemplate.queryForObject(
                    "SELECT COALESCE(SUM(amount), 0) FROM payment_transactions " +
                            "WHERE (contract_id = ? OR reservation_id = ?) AND status IN ('SUCCESS', 'PENDING') AND payment_type = 'REFUND'",
                    BigDecimal.class,
                    rc.getId(), rc.getReservation().getId());
        } catch (Exception ignored) {
        }

        BigDecimal damageFee = BigDecimal.ZERO;
        try {
            damageFee = jdbcTemplate.queryForObject(
                    "SELECT COALESCE(SUM(estimated_cost), 0) FROM damage_cases WHERE contract_id = ? AND liable_party = 'CUSTOMER'",
                    BigDecimal.class,
                    rc.getId());
        } catch (Exception ignored) {
        }
        // PR-Q10: hàng của khách lưu giữ sau thanh lý (nếu có)
        HeldGoods heldGoods = heldGoodsRepository.findFirstByContract_IdOrderByIdDesc(rc.getId()).orElse(null);

        // UC-24: sự cố lỗi cơ sở — chỉ hiển thị cho khách biết, không trừ cọc
        BigDecimal facilityDamageFee = jdbcTemplate.queryForObject(
                "SELECT COALESCE(SUM(estimated_cost), 0) FROM damage_cases WHERE contract_id = ? AND liable_party = 'FACILITY'",
                BigDecimal.class,
                rc.getId());
        if (damageFee == null || damageFee.compareTo(BigDecimal.ZERO) == 0) {
            try {
                String refundNote = jdbcTemplate.queryForObject(
                        "SELECT TOP 1 note FROM facility_tasks WHERE contract_id = ? AND task_type = 'REFUND' ORDER BY id DESC",
                        String.class,
                        rc.getId());
                if (refundNote != null) {
                    java.util.regex.Matcher m = java.util.regex.Pattern.compile("(?:Phí hư hại|Phi hu hai|Ph\\? hu h\\?i|Sự cố:)\\s*([0-9.,]+)", java.util.regex.Pattern.CASE_INSENSITIVE).matcher(refundNote);
                    if (m.find()) {
                        String val = m.group(1).trim();
                        if (val.endsWith(".00")) val = val.substring(0, val.length() - 3);
                        val = val.replace(",", "").replace(".", "");
                        damageFee = new BigDecimal(val);
                    }
                }
            } catch (Exception ignored) {
            }
        }

        boolean isInspectionCompleted = false;
        LocalDate inspectionDate = today;
        try {
            Integer refundCount = jdbcTemplate.queryForObject(
                    "SELECT COUNT(1) FROM facility_tasks WHERE contract_id = ? AND task_type = 'REFUND' AND status != 'CANCELLED'",
                    Integer.class, rc.getId());
            Integer handoverCount = jdbcTemplate.queryForObject(
                    "SELECT COUNT(1) FROM handover_records WHERE contract_id = ? AND record_type = 'CHECK_OUT'",
                    Integer.class, rc.getId());
            isInspectionCompleted = (refundCount != null && refundCount > 0)
                    || (handoverCount != null && handoverCount > 0);

            var completedTs = jdbcTemplate.queryForObject(
                    "SELECT TOP 1 completed_at FROM facility_tasks WHERE contract_id = ? AND task_type = 'CHECK_OUT' AND completed_at IS NOT NULL ORDER BY id DESC",
                    java.sql.Timestamp.class, rc.getId());
            if (completedTs != null) {
                inspectionDate = completedTs.toLocalDateTime().toLocalDate();
            }
        } catch (Exception ignored) {
        }

        // Tính quyết toán hoàn tiền đầy đủ theo Business Rules (gồm cả hoàn tiền thuê trả sớm PR-O2)
        var calc = staffTaskService.calculateCheckoutRefund(rc, inspectionDate, damageFee);
        BigDecimal depositRefund = calc.getDepositRefund();
        BigDecimal earlyRentRefund = calc.getEarlyRentRefund();
        Integer usedMonths = calc.getUsedMonths();
        BigDecimal breakFee = calc.getBreakFee();

        if (isInspectionCompleted || "TERMINATED".equalsIgnoreCase(rc.getStatus())) {
            if (calc.getTotalRefundAmount() != null && calc.getTotalRefundAmount().compareTo(refundAmount) > 0) {
                refundAmount = calc.getTotalRefundAmount();
            }
        }

        int effectiveCycleMonths = calc.getCycleMonths();

        return new CustomerContractResponse(
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
                rc.getStatus(),
                rc.getStartDate(),
                rc.getEndDate(),
                effectiveCycleMonths,
                deposit,
                rc.getReservation().getReservationCode(),
                rc.getAccessPinCode(),
                rc.getRfidCardCode(),
                ut.getBasePriceMonthly(),
                rc.getReservation().getId(),
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
                depositRefund,
                earlyRentRefund,
                usedMonths,
                breakFee,
                maxLateFeeAmount,
                isMaxLateFeeReached,
                isPinLocked,
                canLiquidate,
                liquidationDaysThreshold,
                estimatedOverdueDepositRefund,
                su.getFacility() != null ? su.getFacility().getId() : null,
                Boolean.TRUE.equals(rc.getLateFeeWaived()) && "OVERDUE".equalsIgnoreCase(rc.getStatus()),
                rc.getLateFeeWaiverNote(),
                facilityDamageFee,
                rc.getReservation().getTermsVersion(),
                rc.getReservation().getTermsAcceptedAt(),
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
                amountBeyondDeposit);
    }

    // GET /api/v1/contracts?managerId=3
    // GET /api/v1/contracts?facilityId=1
    // GET /api/v1/contracts?customerId=5 (customer xem HĐ của mình)
    // GET /api/v1/contracts?reservationId=1 (lấy HĐ theo đơn đặt chỗ)
    @GetMapping
    public ResponseEntity<?> getContracts(
            @RequestParam(required = false) Integer facilityId,
            @RequestParam(required = false) Integer managerId,
            @RequestParam(required = false) Integer customerId,
            @RequestParam(required = false) Integer reservationId) {
        CurrentUser user = currentUser.require();
        if (reservationId != null) {
            ownershipGuard.checkReservation(reservationId);
        }
        try {
            if (reservationId != null) {
                return rentalContractRepository.findByReservationId(reservationId)
                        .map(rc -> ResponseEntity.ok((Object) toDto(rc)))
                        .orElse(ResponseEntity.notFound().build());
            }
            List<RentalContract> contracts;
            if (user.hasRole("CUSTOMER")) {
                // Khách chỉ được xem hợp đồng của chính mình, bỏ qua facilityId / managerId nếu có
                contracts = rentalContractRepository.findAllByCustomerId(user.id());
            } else if (facilityId != null) {
                contracts = rentalContractRepository.findAllByFacilityId(facilityId);
            } else if (managerId != null) {
                contracts = rentalContractRepository.findAllByManagerId(managerId);
            } else if (customerId != null) {
                contracts = rentalContractRepository.findAllByCustomerId(customerId);
            } else {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "Cần truyền facilityId, managerId, customerId hoặc reservationId"));
            }
            return ResponseEntity.ok(contracts.stream().map(this::toDto).toList());
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // GET /api/v1/contracts/{id}
    @GetMapping("/{id}")
    public ResponseEntity<?> getContractDetail(@PathVariable Integer id) {
        ownershipGuard.checkContract(id);
        return rentalContractRepository.findDetailById(id)
                .map(rc -> ResponseEntity.ok((Object) toDto(rc)))
                .orElse(ResponseEntity.notFound().build());
    }


    // UC-22: Khách hàng yêu cầu trả kho & hẹn ngày checkout
    @PostMapping("/{id}/request-checkout")
    public ResponseEntity<?> requestCheckout(@PathVariable Integer id,
            @RequestBody com.queenkho.api.dto.RequestCheckoutRequest request) {
        ownershipGuard.checkContract(id);
        try {
            return ResponseEntity.ok(contractService.requestCheckout(id, request));
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "INVALID_INPUT", "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "SERVER_ERROR", "message", e.getMessage()));
        }
    }

    // UC-22: Khách hàng hủy yêu cầu trả kho (hủy chờ trả kho)
    @PostMapping("/{id}/cancel-checkout")
    public ResponseEntity<?> cancelCheckout(@PathVariable Integer id) {
        ownershipGuard.checkContract(id);
        try {
            return ResponseEntity.ok(contractService.cancelCheckout(id));
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "INVALID_ACTION", "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "SERVER_ERROR", "message", e.getMessage()));
        }
    }

    // =========================================================================
    // UC-28: QUẢN LÝ HỢP ĐỒNG QUÁ HẠN (LƯỢT 2)
    // =========================================================================

    // GET /api/v1/contracts/manager/overdue?managerId=3&status=OVERDUE|LIQUIDATED
    @GetMapping("/manager/overdue")
    public ResponseEntity<?> getOverdueContractsForManager(
            @RequestParam(required = false) Integer managerId,
            @RequestParam(required = false) Integer userId,
            @RequestParam(required = false) Integer facilityId,
            @RequestParam(required = false, defaultValue = "OVERDUE") String status) {
        Integer effectiveManagerId = managerId != null ? managerId : userId;
        return ResponseEntity.ok(contractService.getOverdueContractsForManager(effectiveManagerId, facilityId, status));
    }

    // POST /api/v1/contracts/{id}/liquidate
    @PostMapping("/{id}/liquidate")
    public ResponseEntity<?> liquidateContract(
            @PathVariable Integer id,
            @RequestBody com.queenkho.api.dto.LiquidateContractRequest request) {
        if (request != null) {
            request.setManagerId(currentUser.require().id());
        }
        return ResponseEntity.ok(contractService.liquidateContract(id, request));
    }

    // POST /api/v1/contracts/{id}/refund-remaining-deposit
    @PostMapping("/{id}/refund-remaining-deposit")
    public ResponseEntity<?> refundRemainingDeposit(
            @PathVariable Integer id,
            @RequestBody(required = false) com.queenkho.api.dto.RefundDepositRequest request) {
        return ResponseEntity.ok(contractService.refundRemainingDeposit(id, currentUser.require().id()));
    }

    // Flow 6: báo giá 4 gói gia hạn (1/3/6/12 tháng) — đúng số tiền VNPAY sẽ thu
    @GetMapping("/{id}/renewal-quote")
    public ResponseEntity<?> getRenewalQuote(@PathVariable Integer id) {
        ownershipGuard.checkContract(id);
        return rentalContractRepository.findDetailById(id)
                .map(rc -> ResponseEntity.ok((Object) com.queenkho.api.service.PricingService.PACKAGES.stream()
                        .map(months -> pricingService.quoteRenewal(rc, months))
                        .toList()))
                .orElse(ResponseEntity.notFound().build());
    }

    // PR-R10 / PR-R11: còn gia hạn được không (hạn chót ưu tiên end_date − 3, ô đã có người đặt trước chưa) + hạn mới từng gói
    @GetMapping("/{id}/renewal-eligibility")
    public ResponseEntity<?> getRenewalEligibility(@PathVariable Integer id) {
        ownershipGuard.checkContract(id);
        return rentalContractRepository.findDetailById(id)
                .map(rc -> ResponseEntity.ok((Object) renewalPolicyService.checkEligibility(rc)))
                .orElse(ResponseEntity.notFound().build());
    }

    // UC-06: vị trí ô của hợp đồng trên mặt bằng (khách: HĐ còn giữ ô; Staff / FM: HĐ thuộc cơ sở của mình)
    @GetMapping("/{id}/unit-location")
    public ResponseEntity<?> getUnitLocation(@PathVariable Integer id) {
        ownershipGuard.checkContract(id);
        boolean customerView = currentUser.require().hasRole("CUSTOMER");
        return rentalContractRepository.findDetailById(id)
                .map(rc -> ResponseEntity.ok((Object) floorPlanService.getUnitLocation(rc, customerView)))
                .orElse(ResponseEntity.notFound().build());
    }

    // Flow 6: FM miễn phí trễ cho hợp đồng quá hạn (chính sách cơ sở phải cho phép)
    @PostMapping("/{id}/waive-late-fee")
    public ResponseEntity<?> waiveLateFee(
            @PathVariable Integer id,
            @RequestBody(required = false) Map<String, String> body) {
        String reason = body != null ? body.get("reason") : null;
        return ResponseEntity.ok(contractService.waiveLateFee(id, currentUser.require().id(), reason));
    }

    // POST /api/v1/contracts/{id}/overdue-contacts
    @PostMapping("/{id}/overdue-contacts")
    public ResponseEntity<?> addOverdueContact(
            @PathVariable Integer id,
            @RequestBody com.queenkho.api.dto.CreateOverdueContactRequest request) {
        if (request != null) {
            request.setManagerId(currentUser.require().id());
        }
        contractService.addOverdueContactLog(id, request);
        return ResponseEntity.ok(Map.of("message", "Đã ghi nhận nhật ký liên hệ thành công"));
    }

    // GET /api/v1/contracts/{id}/overdue-contacts?managerId=3
    @GetMapping("/{id}/overdue-contacts")
    public ResponseEntity<?> getOverdueContactLogs(
            @PathVariable Integer id,
            @RequestParam(required = false) Integer managerId,
            @RequestParam(required = false) Integer userId) {
        Integer effectiveManagerId = managerId != null ? managerId : userId;
        return ResponseEntity.ok(contractService.getOverdueContactLogs(id, effectiveManagerId));
    }
}


