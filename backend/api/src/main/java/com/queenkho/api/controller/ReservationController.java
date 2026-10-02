package com.queenkho.api.controller;

import com.queenkho.api.dto.CreateReservationRequest;
import com.queenkho.api.dto.CreateReservationResponse;
import com.queenkho.api.dto.MyReservationResponse;
import com.queenkho.api.service.ReservationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/reservations")
public class ReservationController {
    @Autowired
    private ReservationService reservationService;

    // UC-10: Tao don dat cho kho bai
    @PostMapping
    public ResponseEntity<?> createReservation(@RequestBody CreateReservationRequest request) {
        try {
            CreateReservationResponse response = reservationService.createReservation(request);
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "INVALID_INPUT", "message", e.getMessage()));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "BAD_REQUEST", "message", e.getMessage()));
        }
    }

    // UC-12
    @GetMapping("/my")
    public ResponseEntity<List<MyReservationResponse>> getMyReservations(
            @RequestParam Integer customerId) {
        return ResponseEntity.ok(reservationService.getMyReservations(customerId));
    }

    // UC-13: truyền facilityId hoặc managerId (chỉ cần một trong hai)
    @GetMapping("/pending")
    public ResponseEntity<?> getPendingReservations(
            @RequestParam(required = false) Integer facilityId,
            @RequestParam(required = false) Integer managerId) {
        try {
            return ResponseEntity.ok(reservationService.getPendingReservations(facilityId, managerId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "INVALID_INPUT", "message", e.getMessage()));
        }
    }

    // UC-14: Lấy danh sách kho trống
    @GetMapping("/{reservationId}/available-units")
    public ResponseEntity<?> getAvailableUnits(@PathVariable Integer reservationId) {
        try {
            return ResponseEntity.ok(reservationService.getAvailableUnitsForReservation(reservationId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "INVALID_INPUT", "message", e.getMessage()));
        }
    }

    // UC-14: Gán kho và tạo hợp đồng
    @PostMapping("/{reservationId}/assign")
    public ResponseEntity<?> assignStorageUnit(@PathVariable Integer reservationId, @RequestBody com.queenkho.api.dto.AssignUnitRequest request) {
        try {
            reservationService.assignStorageUnit(reservationId, request);
            return ResponseEntity.ok(Map.of("message", "Gán kho và tạo hợp đồng thành công"));
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "INVALID_INPUT", "message", e.getMessage()));
        }
    }
    // UC-15: Preview Cancel và Cancel Request
        @GetMapping("/{reservationId}/cancel-preview")
    public ResponseEntity<?> previewCancel(@PathVariable Integer reservationId) {
        try {
            return ResponseEntity.ok(reservationService.previewCancel(reservationId));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(java.util.Map.of("error", "INVALID_INPUT", "message", e.getMessage()));
        }
    }

    @PostMapping("/{reservationId}/cancel")
    public ResponseEntity<?> cancelReservation(@PathVariable Integer reservationId, @RequestBody com.queenkho.api.dto.CancelReservationRequest request) {
        try {
            reservationService.cancelReservation(reservationId, request);
            return ResponseEntity.ok(java.util.Map.of("message", "Hủy đơn đặt chỗ thành công"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(java.util.Map.of("error", "INVALID_INPUT", "message", e.getMessage()));
        }
    }
}