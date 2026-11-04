package com.queenkho.api.controller;

import com.queenkho.api.dto.ClaimDecisionRequest;
import com.queenkho.api.dto.ClaimPaymentRequest;
import com.queenkho.api.exception.StaffTaskException;
import com.queenkho.api.security.CurrentUserProvider;
import com.queenkho.api.service.CompensationClaimService;
import com.queenkho.api.service.InsurancePlan;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.List;
import java.util.Map;

// BR-125 → BR-128: gói bảo hiểm (công khai) + hồ sơ bồi thường hàng hư / mất (FM xử lý, BOM xem)
@RestController
@RequestMapping("/api/v1")
public class CompensationClaimController {

    private final CompensationClaimService claimService;
    private final CurrentUserProvider currentUser;

    public CompensationClaimController(CompensationClaimService claimService, CurrentUserProvider currentUser) {
        this.claimService = claimService;
        this.currentUser = currentUser;
    }

    @ExceptionHandler(StaffTaskException.class)
    public ResponseEntity<?> handle(StaffTaskException ex) {
        return ResponseEntity.status(ex.getStatus()).body(Map.of("error", ex.getCode(), "message", ex.getMessage()));
    }

    // BR-125: danh sách gói bảo hiểm cho trang đặt kho
    @GetMapping("/insurance-plans")
    public ResponseEntity<List<Map<String, Object>>> insurancePlans() {
        return ResponseEntity.ok(Arrays.stream(InsurancePlan.values())
                .map(p -> Map.<String, Object>of(
                        "code", p.name(),
                        "label", p.label(),
                        "monthlyPremium", p.monthlyPremium(),
                        "coverageLimit", p.coverageLimit(),
                        "insured", p.insured(),
                        "noDeclarationCap", InsurancePlan.NO_DECLARATION_CAP.min(p.coverageLimit())))
                .toList());
    }

    // FM: hồ sơ cơ sở mình · BOM: toàn chuỗi (lọc facilityId)
    @GetMapping("/claims")
    public ResponseEntity<?> list(@RequestParam(required = false) Integer facilityId) {
        return ResponseEntity.ok(claimService.list(currentUser.require().id(), facilityId));
    }

    @GetMapping("/claims/{id:\\d+}")
    public ResponseEntity<?> detail(@PathVariable Integer id) {
        return ResponseEntity.ok(claimService.detail(id, currentUser.require().id()));
    }

    // BR-127: xem trước bảng tính bồi thường
    @PostMapping("/claims/{id}/quote")
    public ResponseEntity<?> quote(@PathVariable Integer id, @RequestBody ClaimDecisionRequest request) {
        return ResponseEntity.ok(claimService.quote(id, currentUser.require().id(), request));
    }

    @PostMapping("/claims/{id}/decide")
    public ResponseEntity<?> decide(@PathVariable Integer id, @RequestBody ClaimDecisionRequest request) {
        return ResponseEntity.ok(claimService.decide(id, currentUser.require().id(), request));
    }

    // BR-128: xác nhận đã chi trả cho khách (+ gửi hồ sơ bảo hiểm nếu gói có bảo hiểm)
    @PostMapping("/claims/{id}/pay")
    public ResponseEntity<?> pay(@PathVariable Integer id, @RequestBody ClaimPaymentRequest request) {
        return ResponseEntity.ok(claimService.pay(id, currentUser.require().id(), request));
    }
}
