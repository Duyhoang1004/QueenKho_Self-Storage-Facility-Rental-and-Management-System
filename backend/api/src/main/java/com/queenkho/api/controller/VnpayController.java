package com.queenkho.api.controller;

import com.queenkho.api.service.VnpayService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.net.URI;
import java.util.Map;

@RestController
@RequestMapping("/api/payments/vnpay")
public class VnpayController {
    private final VnpayService service;
    public VnpayController(VnpayService service) { this.service = service; }
    public record ReservationRequest(Integer reservationId) {}
    public record RenewalRequest(Integer contractId, Integer months) {}
    @PostMapping("/create") public Map<String, Object> create(@RequestBody ReservationRequest request, HttpServletRequest http) {
        return service.createReservation(request.reservationId(), http.getRemoteAddr());
    }
    @PostMapping("/create-renewal") public Map<String, Object> createRenewal(@RequestBody RenewalRequest request, HttpServletRequest http) {
        return service.createRenewal(request.contractId(), request.months(), http.getRemoteAddr());
    }
    @GetMapping("/return") public ResponseEntity<Void> result(@RequestParam Map<String, String> params) {
        String destination = service.returnDestination(params);
        service.confirmLocalReturn(params);
        return ResponseEntity.status(302).location(URI.create(destination)).build();
    }
    @GetMapping("/ipn") public Map<String, String> ipn(@RequestParam Map<String, String> params) { return service.receiveIpn(params); }
    @GetMapping("/status/{txnRef}") public Map<String, Object> status(@PathVariable String txnRef) { return service.status(txnRef); }
}
