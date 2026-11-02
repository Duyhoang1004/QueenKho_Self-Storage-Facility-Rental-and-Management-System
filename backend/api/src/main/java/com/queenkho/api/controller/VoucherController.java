package com.queenkho.api.controller;

import com.queenkho.api.dto.VoucherRequest;
import com.queenkho.api.exception.ReservationException;
import com.queenkho.api.security.CurrentUserProvider;
import com.queenkho.api.service.VoucherService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

// BR-25: voucher đặt kho — khách kiểm tra mã; BOM quản lý (quyền khai báo trong AccessPolicy)
@RestController
@RequestMapping("/api/v1")
public class VoucherController {

    private final VoucherService voucherService;
    private final CurrentUserProvider currentUser;

    public VoucherController(VoucherService voucherService, CurrentUserProvider currentUser) {
        this.voucherService = voucherService;
        this.currentUser = currentUser;
    }

    // GET /api/v1/vouchers/validate?code=HE2026&facilityId=1&unitTypeId=2&months=3 (code trống = mã mặc định)
    @GetMapping("/vouchers/validate")
    public ResponseEntity<?> validate(@RequestParam(required = false) String code,
                                      @RequestParam Integer facilityId,
                                      @RequestParam Integer unitTypeId,
                                      @RequestParam Integer months) {
        return ResponseEntity.ok(voucherService.preview(code, currentUser.require().id(), facilityId, unitTypeId, months));
    }

    @GetMapping("/bom/vouchers")
    public ResponseEntity<?> list() {
        return ResponseEntity.ok(voucherService.list());
    }

    @PostMapping("/bom/vouchers")
    public ResponseEntity<?> create(@RequestBody VoucherRequest request) {
        return ResponseEntity.ok(voucherService.create(request, currentUser.require().id()));
    }

    @PutMapping("/bom/vouchers/{id}")
    public ResponseEntity<?> update(@PathVariable Integer id, @RequestBody VoucherRequest request) {
        return ResponseEntity.ok(voucherService.update(id, request));
    }

    // body: { "status": "ACTIVE" | "INACTIVE" }
    @PatchMapping("/bom/vouchers/{id}/status")
    public ResponseEntity<?> setStatus(@PathVariable Integer id, @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(voucherService.setStatus(id, body != null ? body.get("status") : null));
    }

    @ExceptionHandler(ReservationException.class)
    public ResponseEntity<?> handle(ReservationException e) {
        return ResponseEntity.status(e.getStatus()).body(Map.of("error", e.getCode(), "message", e.getMessage()));
    }
}
