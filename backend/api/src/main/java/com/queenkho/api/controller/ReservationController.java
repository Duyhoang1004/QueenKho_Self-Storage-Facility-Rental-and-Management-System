package com.queenkho.api.controller;

import com.queenkho.api.dto.CreateReservationRequest;
import com.queenkho.api.dto.CreateReservationResponse;
import com.queenkho.api.dto.MyReservationResponse;
import com.queenkho.api.dto.PendingReservationResponse;
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

    // UC-13
    @GetMapping("/pending")
    public ResponseEntity<List<PendingReservationResponse>> getPendingReservations(
            @RequestParam Integer facilityId) {
        return ResponseEntity.ok(reservationService.getPendingReservations(facilityId));
    }
}