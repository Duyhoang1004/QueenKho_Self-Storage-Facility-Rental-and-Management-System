package com.queenkho.api.controller;

import com.queenkho.api.exception.StaffTaskException;
import com.queenkho.api.security.CurrentUserProvider;
import com.queenkho.api.service.PolicySummaryService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Map;

// D-22: "Bảng phí & hoàn tiền" bằng số — trang đặt kho (đơn mới) và trang hợp đồng (chính sách đã chốt)
@RestController
@RequestMapping("/api/v1")
public class PolicySummaryController {

    private final PolicySummaryService policySummaryService;
    private final CurrentUserProvider currentUser;

    public PolicySummaryController(PolicySummaryService policySummaryService, CurrentUserProvider currentUser) {
        this.policySummaryService = policySummaryService;
        this.currentUser = currentUser;
    }

    @ExceptionHandler(StaffTaskException.class)
    public ResponseEntity<?> handle(StaffTaskException ex) {
        return ResponseEntity.status(ex.getStatus()).body(Map.of("error", ex.getCode(), "message", ex.getMessage()));
    }

    @GetMapping("/facilities/{id}/policy-summary")
    public ResponseEntity<?> forQuote(@PathVariable Integer id,
                                      @RequestParam Integer unitTypeId,
                                      @RequestParam(defaultValue = "1") Integer months,
                                      @RequestParam(required = false) String insurancePlan,
                                      @RequestParam(required = false) BigDecimal voucherDiscount) {
        return ResponseEntity.ok(policySummaryService.forQuote(id, unitTypeId, months, insurancePlan, voucherDiscount));
    }

    @GetMapping("/contracts/{id}/policy-summary")
    public ResponseEntity<?> forContract(@PathVariable Integer id) {
        return ResponseEntity.ok(policySummaryService.forContract(id, currentUser.require()));
    }
}
