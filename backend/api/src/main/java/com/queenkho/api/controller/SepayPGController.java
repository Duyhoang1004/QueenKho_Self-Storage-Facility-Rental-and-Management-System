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
}
