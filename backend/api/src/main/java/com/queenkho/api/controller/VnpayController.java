package com.queenkho.api.controller;

import com.queenkho.api.service.VnpayService;
import com.queenkho.api.service.SessionTokenService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.net.URI;
import java.util.Map;

@RestController
@RequestMapping("/api/payments/vnpay")
public class VnpayController {
    private final VnpayService service;
    private final SessionTokenService sessions;
    public VnpayController(VnpayService service, SessionTokenService sessions) {
        this.service = service;
        this.sessions = sessions;
    }
    public record ReservationRequest(Integer reservationId) {}
    public record RenewalRequest(Integer contractId, Integer months) {}
    @PostMapping("/create") public Map<String, Object> create(@RequestBody ReservationRequest request, HttpServletRequest http) {
        Integer userId = sessions.requireUser(http.getHeader("Authorization"));
        return service.createReservation(request.reservationId(), userId, http.getRemoteAddr());
    }
    @PostMapping("/create-renewal") public Map<String, Object> createRenewal(@RequestBody RenewalRequest request, HttpServletRequest http) {
        Integer userId = sessions.requireUser(http.getHeader("Authorization"));
        return service.createRenewal(request.contractId(), request.months(), userId, http.getRemoteAddr());
    }
    @GetMapping("/return") public ResponseEntity<Void> result(@RequestParam Map<String, String> params) {
        String destination = service.returnDestination(params);
        service.confirmLocalReturn(params);
        return ResponseEntity.status(302).location(URI.create(destination)).build();
    }
    @GetMapping("/ipn") public Map<String, String> ipn(@RequestParam Map<String, String> params) { return service.receiveIpn(params); }
    @GetMapping("/status/{txnRef}") public Map<String, Object> status(@PathVariable String txnRef, HttpServletRequest http) {
        Integer userId = sessions.requireUser(http.getHeader("Authorization"));
        return service.status(txnRef, userId);
    }

    @ExceptionHandler(com.queenkho.api.exception.ContractException.class)
    public ResponseEntity<?> handleContractException(com.queenkho.api.exception.ContractException ex) {
        return ResponseEntity.status(ex.getStatus())
                .body(Map.of("error", ex.getCode(), "message", ex.getMessage()));
    }
}

