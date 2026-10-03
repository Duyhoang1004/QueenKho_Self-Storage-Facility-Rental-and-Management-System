package com.queenkho.api.controller;

import com.queenkho.api.service.SepayService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/payments/sepay-pg")
public class SepayPGController {

    private final SepayService sepayService;

    public SepayPGController(SepayService sepayService) {
        this.sepayService = sepayService;
    }

    public record CreatePaymentRequest(Integer reservationId) {}

    @PostMapping("/create")
    public Map<String, Object> createPayment(@RequestBody CreatePaymentRequest request) {
        return sepayService.createPayment(request.reservationId());
    }



    @PostMapping("/confirm-dev")
    public Map<String, Object> confirmDevPayment(@RequestBody Map<String, Object> body) {
        return sepayService.confirmDevPayment(body);
    }

    public record CreateRenewalPaymentRequest(Integer contractId, Integer months) {}

    @PostMapping("/create-renewal")
    public Map<String, Object> createRenewalPayment(@RequestBody CreateRenewalPaymentRequest request) {
        return sepayService.createRenewalPayment(request.contractId(), request.months());
    }

    public record ConfirmRenewalPaymentRequest(Integer contractId, Integer months, String transactionCode) {}

    @PostMapping("/confirm-renewal")
    public Map<String, Object> confirmRenewalPayment(@RequestBody ConfirmRenewalPaymentRequest request) {
        return sepayService.confirmRenewalPayment(request.contractId(), request.months(), request.transactionCode());
    }
}
