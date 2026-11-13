package com.queenkho.api.controller;

import com.queenkho.api.dto.TransferUnitRequest;
import com.queenkho.api.exception.StaffTaskException;
import com.queenkho.api.repository.RentalContractRepository;
import com.queenkho.api.security.CurrentUser;
import com.queenkho.api.security.CurrentUserProvider;
import com.queenkho.api.security.OwnershipGuard;
import com.queenkho.api.service.ContractService;
import com.queenkho.api.service.ContractViewService;
import com.queenkho.api.service.FloorPlanService;
import com.queenkho.api.service.PricingService;
import com.queenkho.api.service.RenewalPolicyService;
import com.queenkho.api.service.StaffTaskService;
import com.queenkho.api.service.UnitSensorService;
import com.queenkho.api.service.UnitTransferService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/contracts")
public class ContractController {

    // Các endpoint renewal-quote / unit-location / sensor-readings vẫn cần đọc entity hợp đồng
    @Autowired
    private RentalContractRepository rentalContractRepository;

    @Autowired
    private ContractService contractService;

    // Màn xem hợp đồng (GET /contracts, GET /contracts/{id}): ghép dữ liệu + dự tính hoàn cọc
    @Autowired
    private ContractViewService contractViewService;

    @Autowired
    private StaffTaskService staffTaskService;

    // PR-90: người thao tác lấy từ token; hợp đồng theo id phải thuộc khách / cơ sở của người gọi
    @Autowired
    private CurrentUserProvider currentUser;

    @Autowired
    private OwnershipGuard ownershipGuard;

    @Autowired
    private PricingService pricingService;

    @Autowired
    private RenewalPolicyService renewalPolicyService;

    @Autowired
    private FloorPlanService floorPlanService;

    @Autowired
    private UnitTransferService unitTransferService;

    @Autowired
    private UnitSensorService unitSensorService;

    @ExceptionHandler(com.queenkho.api.exception.ContractException.class)
    public ResponseEntity<?> handleContractException(com.queenkho.api.exception.ContractException ex) {
        return ResponseEntity.status(ex.getStatus())
                .body(Map.of("error", ex.getCode(), "message", ex.getMessage()));
    }

    // Lỗi nghiệp vụ từ StaffTaskService (chuyển ô, biên bản bàn giao...)
    @ExceptionHandler(StaffTaskException.class)
    public ResponseEntity<?> handleStaffTaskException(StaffTaskException ex) {
        return ResponseEntity.status(ex.getStatus())
                .body(Map.of("error", ex.getCode(), "message", ex.getMessage()));
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
        if (reservationId != null) {
            return contractViewService.getByReservation(reservationId)
                    .<ResponseEntity<?>>map(ResponseEntity::ok)
                    .orElse(ResponseEntity.notFound().build());
        }
        try {
            return ResponseEntity.ok(contractViewService.listForViewer(user, facilityId, managerId, customerId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // GET /api/v1/contracts/{id}
    @GetMapping("/{id}")
    public ResponseEntity<?> getContractDetail(@PathVariable Integer id) {
        ownershipGuard.checkContract(id);
        return contractViewService.getDetail(id)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }


    // UC-22: Khách hàng yêu cầu trả kho & hẹn ngày checkout
    @PostMapping("/{id}/request-checkout")
    public ResponseEntity<?> requestCheckout(@PathVariable Integer id,
            @RequestBody com.queenkho.api.dto.RequestCheckoutRequest request) {
        ownershipGuard.checkContract(id);
        try {
            return ResponseEntity.ok(contractService.requestCheckout(id, request));
        } catch (com.queenkho.api.exception.ContractException e) {
            throw e; // PR-O3: INVALID_REFUND_METHOD → 400 qua handler của controller
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

    // UC-22: xem trước tiền hoàn theo ngày hẹn trả kho (cùng công thức lúc nghiệm thu)
    @GetMapping("/{id}/checkout-refund-preview")
    public ResponseEntity<?> getCheckoutRefundPreview(
            @PathVariable Integer id,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate checkoutDate) {
        ownershipGuard.checkContract(id);
        return contractViewService.previewCheckoutRefund(id, checkoutDate)
                .map(r -> ResponseEntity.ok((Object) r))
                .orElse(ResponseEntity.notFound().build());
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

    // BR-121: biên bản nhận kho / trả kho kèm ảnh hiện trạng — khách xem của mình, Staff / FM xem của cơ sở
    @GetMapping("/{id}/handover-records")
    public ResponseEntity<?> getHandoverRecords(@PathVariable Integer id) {
        ownershipGuard.checkContract(id);
        return ResponseEntity.ok(staffTaskService.getHandoverRecords(id));
    }

    // BR-122: ô trống cùng loại, cùng cơ sở để FM chuyển hợp đồng sang
    @GetMapping("/{id}/transfer-options")
    public ResponseEntity<?> getTransferOptions(@PathVariable Integer id) {
        ownershipGuard.checkContract(id);
        return ResponseEntity.ok(unitTransferService.getTransferOptions(id));
    }

    // BR-129: nhiệt độ / độ ẩm ô của hợp đồng — `days` ngày quanh ngày `around` (mặc định: N ngày gần nhất)
    @GetMapping("/{id}/sensor-readings")
    public ResponseEntity<?> getSensorReadings(@PathVariable Integer id,
                                               @RequestParam(defaultValue = "3") int days,
                                               @RequestParam(required = false)
                                               @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
                                               LocalDate around) {
        ownershipGuard.checkContract(id);
        int window = Math.max(1, Math.min(days, 14));
        return rentalContractRepository.findDetailById(id)
                .map(rc -> ResponseEntity.ok((Object) unitSensorService.summary(rc.getStorageUnit().getId(),
                        around != null ? around.atTime(12, 0) : null, window)))
                .orElse(ResponseEntity.notFound().build());
    }

    // Flow 6 (04/11/2026): BOM xem hợp đồng quá hạn toàn chuỗi để miễn phí trễ (FM gọi thì chỉ thấy cơ sở mình)
    @GetMapping("/overdue-all")
    public ResponseEntity<?> getOverdueContractsChain(@RequestParam(required = false) Integer facilityId) {
        return ResponseEntity.ok(contractService.getOverdueContractsForChain(currentUser.require().id(), facilityId));
    }

    // BR-122: lịch sử chuyển ô của hợp đồng
    @GetMapping("/{id}/unit-transfers")
    public ResponseEntity<?> getUnitTransfers(@PathVariable Integer id) {
        ownershipGuard.checkContract(id);
        return ResponseEntity.ok(unitTransferService.getTransferHistory(id));
    }

    // BR-122: FM chuyển hợp đồng sang ô khác
    @PostMapping("/{id}/transfer-unit")
    public ResponseEntity<?> transferUnit(@PathVariable Integer id, @RequestBody TransferUnitRequest request) {
        ownershipGuard.checkContract(id);
        return ResponseEntity.ok(unitTransferService.transferUnit(id, currentUser.require().id(), request));
    }

    // Flow 6: FM miễn phí trễ cho hợp đồng quá hạn (chính sách cơ sở phải cho phép)
    @PostMapping("/{id}/waive-late-fee")
    public ResponseEntity<?> waiveLateFee(
            @PathVariable Integer id,
            @RequestBody(required = false) Map<String, Object> body) {
        String reason = body != null && body.get("reason") != null ? String.valueOf(body.get("reason")) : null;
        // (12/11/2026) waiveOverstay = true → miễn luôn phí chiếm dụng
        boolean waiveOverstay = body != null && Boolean.parseBoolean(String.valueOf(body.get("waiveOverstay")));
        return ResponseEntity.ok(contractService.waiveLateFee(id, currentUser.require().id(), reason, waiveOverstay));
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


