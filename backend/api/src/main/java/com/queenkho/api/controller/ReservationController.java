package com.queenkho.api.controller;

import com.queenkho.api.dto.MyReservationResponse;
import com.queenkho.api.dto.PendingReservationResponse;
import com.queenkho.api.service.ReservationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/v1/reservations")
public class ReservationController {
    @Autowired
    private ReservationService reservationService;

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