package com.queenkho.api.controller;

import com.queenkho.api.dto.CustomerContractResponse;
import com.queenkho.api.entity.RentalContract;
import com.queenkho.api.repository.RentalContractRepository;
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
    private org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    @Autowired
    private com.queenkho.api.service.ContractService contractService;

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

        // Tiền thuê thực tế = Tổng đã đóng - Tiền cọc đang giữ
        BigDecimal deposit = rc.getDepositHeldAmount() != null ? rc.getDepositHeldAmount() : BigDecimal.ZERO;
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

        // Tính số ngày trễ hạn và phí phạt trễ hạn nếu hợp đồng quá hạn
        long overdueDays = 0;
        BigDecimal lateFeePerDay = BigDecimal.valueOf(50000); // 50.000 VNĐ / ngày theo rental_policy
        try {
            Integer polFee = jdbcTemplate.queryForObject(
                    "SELECT late_fee_per_day FROM rental_policy WHERE facility_id = ?",
                    Integer.class,
                    su.getFacility().getId());
            if (polFee != null) {
                lateFeePerDay = BigDecimal.valueOf(polFee);
            }
        } catch (Exception ignored) {
        }

        LocalDate today = LocalDate.now();
        if (("OVERDUE".equalsIgnoreCase(rc.getStatus()) || "ACTIVE".equalsIgnoreCase(rc.getStatus()))
                && rc.getEndDate() != null && today.isAfter(rc.getEndDate())) {
            overdueDays = java.time.temporal.ChronoUnit.DAYS.between(rc.getEndDate(), today);
        }
        BigDecimal lateFeeAmount = lateFeePerDay.multiply(BigDecimal.valueOf(overdueDays));
        BigDecimal estimatedDepositRefund = deposit.subtract(lateFeeAmount);
        if (estimatedDepositRefund.compareTo(BigDecimal.ZERO) < 0) {
            estimatedDepositRefund = BigDecimal.ZERO;
        }

        // Tính tổng tiền hoàn cọc thực tế (nếu hợp đồng đã kết thúc hoặc có giao dịch REFUND)
        BigDecimal refundAmount = BigDecimal.ZERO;
        try {
            refundAmount = jdbcTemplate.queryForObject(
                    "SELECT COALESCE(SUM(amount), 0) FROM payment_transactions " +
                            "WHERE (contract_id = ? OR reservation_id = ?) AND status = 'SUCCESS' AND payment_type = 'REFUND'",
                    BigDecimal.class,
                    rc.getId(), rc.getReservation().getId());
        } catch (Exception ignored) {
        }

        BigDecimal originalDeposit = (rc.getReservation() != null && rc.getReservation().getDepositAmount() != null)
                ? rc.getReservation().getDepositAmount()
                : (rc.getDepositHeldAmount() != null && rc.getDepositHeldAmount().compareTo(BigDecimal.ZERO) > 0
                        ? rc.getDepositHeldAmount()
                        : ut.getBasePriceMonthly());

        BigDecimal damageFee = BigDecimal.ZERO;
        try {
            String refundNote = jdbcTemplate.queryForObject(
                    "SELECT TOP 1 note FROM facility_tasks WHERE contract_id = ? AND task_type = 'REFUND' ORDER BY id DESC",
                    String.class,
                    rc.getId());
            if (refundNote != null) {
                java.util.regex.Matcher m = java.util.regex.Pattern.compile("(?:Phí hư hại|Phi hu hai|Ph\\? hu h\\?i)\\s*([0-9.,]+)", java.util.regex.Pattern.CASE_INSENSITIVE).matcher(refundNote);
                if (m.find()) {
                    String val = m.group(1).replace(",", "").replace(".", "");
                    damageFee = new BigDecimal(val);
                }
            }
        } catch (Exception ignored) {
        }

        if (damageFee.compareTo(BigDecimal.ZERO) == 0 && originalDeposit != null && refundAmount != null
                && refundAmount.compareTo(BigDecimal.ZERO) > 0 && originalDeposit.compareTo(refundAmount) > 0) {
            damageFee = originalDeposit.subtract(refundAmount);
        }

        if ("TERMINATED".equals(rc.getStatus()) && (refundAmount == null || refundAmount.compareTo(BigDecimal.ZERO) == 0)) {
            if (originalDeposit != null) {
                refundAmount = originalDeposit.subtract(damageFee);
                if (refundAmount.compareTo(BigDecimal.ZERO) < 0) {
                    refundAmount = BigDecimal.ZERO;
                }
            }
        }

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
                rc.getBillingCycleMonths(),
                rc.getDepositHeldAmount(),
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
                damageFee);
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
        try {
            if (reservationId != null) {
                return rentalContractRepository.findByReservationId(reservationId)
                        .map(rc -> ResponseEntity.ok((Object) toDto(rc)))
                        .orElse(ResponseEntity.notFound().build());
            }
            List<RentalContract> contracts;
            if (facilityId != null) {
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
        return rentalContractRepository.findDetailById(id)
                .map(rc -> ResponseEntity.ok((Object) toDto(rc)))
                .orElse(ResponseEntity.notFound().build());
    }

    // UC-21: Khách hàng gia hạn hợp đồng thuê
    @PostMapping("/{id}/renew")
    public ResponseEntity<?> renewContract(@PathVariable Integer id,
            @RequestBody com.queenkho.api.dto.RenewContractRequest request) {
        try {
            return ResponseEntity.ok(contractService.renewContract(id, request));
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "INVALID_INPUT", "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "SERVER_ERROR", "message", e.getMessage()));
        }
    }

    // UC-22: Khách hàng yêu cầu trả kho & hẹn ngày checkout
    @PostMapping("/{id}/request-checkout")
    public ResponseEntity<?> requestCheckout(@PathVariable Integer id,
            @RequestBody com.queenkho.api.dto.RequestCheckoutRequest request) {
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
        try {
            return ResponseEntity.ok(contractService.cancelCheckout(id));
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "INVALID_ACTION", "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "SERVER_ERROR", "message", e.getMessage()));
        }
    }
}
