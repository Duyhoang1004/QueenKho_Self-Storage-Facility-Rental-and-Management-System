package com.queenkho.api.controller;

import com.queenkho.api.dto.SettlementActionRequest;
import com.queenkho.api.dto.SettlementAdjustRequest;
import com.queenkho.api.dto.SettlementCashPaymentRequest;
import com.queenkho.api.exception.StaffTaskException;
import com.queenkho.api.security.CurrentUserProvider;
import com.queenkho.api.service.CheckoutSettlementService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

// D-21 (PR-O19 → PR-O23): quyết toán trả kho — khách xác nhận / không đồng ý / thanh toán phần âm,
// Staff / FM thu tiền mặt, FM xử lý khiếu nại (sửa tiền, giữ nguyên, giao kiểm tra lại)
@RestController
@RequestMapping("/api/v1")
public class CheckoutSettlementController {

    private final CheckoutSettlementService settlementService;
    private final CurrentUserProvider currentUser;

    public CheckoutSettlementController(CheckoutSettlementService settlementService, CurrentUserProvider currentUser) {
        this.settlementService = settlementService;
        this.currentUser = currentUser;
    }

    @ExceptionHandler(StaffTaskException.class)
    public ResponseEntity<?> handle(StaffTaskException ex) {
        return ResponseEntity.status(ex.getStatus()).body(Map.of("error", ex.getCode(), "message", ex.getMessage()));
    }

    // Lỗi từ VnpayService.createDebtPayment (khoản nợ không còn chờ thanh toán...)
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<?> handle(ResponseStatusException ex) {
        return ResponseEntity.status(ex.getStatusCode())
                .body(Map.of("error", "PAYMENT_NOT_AVAILABLE", "message", String.valueOf(ex.getReason())));
    }

    // Khách (của mình), Staff / FM (cơ sở mình)
    @GetMapping("/contracts/{id}/settlement")
    public ResponseEntity<?> get(@PathVariable Integer id) {
        return ResponseEntity.ok(settlementService.getForContract(id, currentUser.require()));
    }

    // PR-O20 / PR-O21: khách xác nhận kết thúc hợp đồng (âm → trả kèm link VNPAY)
    @PostMapping("/contracts/{id}/settlement/confirm")
    public ResponseEntity<?> confirm(@PathVariable Integer id, HttpServletRequest http) {
        return ResponseEntity.ok(settlementService.confirm(id, currentUser.require(), http.getRemoteAddr()));
    }

    // PR-O22: khách không đồng ý biên bản / quyết toán
    @PostMapping("/contracts/{id}/settlement/dispute")
    public ResponseEntity<?> dispute(@PathVariable Integer id, @RequestBody SettlementActionRequest request) {
        return ResponseEntity.ok(settlementService.dispute(id, currentUser.require(), request));
    }

    // PR-O21: tạo lại link VNPAY khi đang chờ thanh toán phần âm
    @PostMapping("/contracts/{id}/settlement/pay")
    public ResponseEntity<?> pay(@PathVariable Integer id, HttpServletRequest http) {
        return ResponseEntity.ok(settlementService.pay(id, currentUser.require(), http.getRemoteAddr()));
    }

    // PR-O21: Staff / FM thu tiền mặt tại quầy
    @PostMapping("/contracts/{id}/settlement/cash-payment")
    public ResponseEntity<?> cashPayment(@PathVariable Integer id, @RequestBody SettlementCashPaymentRequest request) {
        return ResponseEntity.ok(settlementService.recordCashPayment(id, currentUser.require(), request));
    }

    // FM: danh sách quyết toán của cơ sở — group = ACTION (chờ FM) / CUSTOMER / PAYMENT / DONE / ALL
    @GetMapping("/settlements")
    public ResponseEntity<?> list(@RequestParam(required = false) String group) {
        return ResponseEntity.ok(settlementService.listForManager(currentUser.require(), group));
    }

    @PostMapping("/settlements/{id}/adjust")
    public ResponseEntity<?> adjust(@PathVariable Integer id, @RequestBody SettlementAdjustRequest request) {
        return ResponseEntity.ok(settlementService.adjust(id, currentUser.require(), request));
    }

    @PostMapping("/settlements/{id}/keep")
    public ResponseEntity<?> keep(@PathVariable Integer id, @RequestBody SettlementActionRequest request) {
        return ResponseEntity.ok(settlementService.keep(id, currentUser.require(), request));
    }

    @PostMapping("/settlements/{id}/recheck")
    public ResponseEntity<?> recheck(@PathVariable Integer id, @RequestBody SettlementActionRequest request) {
        return ResponseEntity.ok(settlementService.assignRecheck(id, currentUser.require(), request));
    }

    // 🔸 Demo: quyết toán dương chờ khách đủ 3 ngày → tự xác nhận ngay (PR-O23)
    @PostMapping("/dev/simulation/contracts/{id}/settlement-auto-confirm")
    public ResponseEntity<?> simulateAutoConfirm(@PathVariable Integer id) {
        return ResponseEntity.ok(settlementService.simulateAutoConfirm(id, currentUser.require()));
    }
}
