package com.queenkho.api.controller;

import com.queenkho.api.dto.SettlementActionRequest;
import com.queenkho.api.exception.StaffTaskException;
import com.queenkho.api.security.CurrentUserProvider;
import com.queenkho.api.service.RefundReceiptService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

// D-22 (PR-O25 → PR-O27): khách xác nhận đã nhận tiền hoàn / báo chưa nhận được
@RestController
@RequestMapping("/api/v1/refunds")
public class RefundReceiptController {

    private final RefundReceiptService receiptService;
    private final CurrentUserProvider currentUser;

    public RefundReceiptController(RefundReceiptService receiptService, CurrentUserProvider currentUser) {
        this.receiptService = receiptService;
        this.currentUser = currentUser;
    }

    @ExceptionHandler(StaffTaskException.class)
    public ResponseEntity<?> handle(StaffTaskException ex) {
        return ResponseEntity.status(ex.getStatus()).body(Map.of("error", ex.getCode(), "message", ex.getMessage()));
    }

    @GetMapping("/my")
    public ResponseEntity<?> my(@RequestParam(required = false) Integer contractId) {
        return ResponseEntity.ok(receiptService.listMine(currentUser.require(), contractId));
    }

    @PostMapping("/{taskId}/confirm")
    public ResponseEntity<?> confirm(@PathVariable Integer taskId) {
        return ResponseEntity.ok(receiptService.confirm(taskId, currentUser.require()));
    }

    // Body { reason } (10–500 ký tự)
    @PostMapping("/{taskId}/dispute")
    public ResponseEntity<?> dispute(@PathVariable Integer taskId, @RequestBody SettlementActionRequest request) {
        return ResponseEntity.ok(receiptService.dispute(taskId, currentUser.require(), request != null ? request.getReason() : null));
    }
}
