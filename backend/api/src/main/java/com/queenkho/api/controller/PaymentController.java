package com.queenkho.api.controller;

import com.queenkho.api.dto.CustomerPaymentsResponse;
import com.queenkho.api.security.CurrentUserProvider;
import com.queenkho.api.service.CustomerPaymentService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

// UC-20: màn "Thanh toán" của khách hàng
@RestController
@RequestMapping("/api/v1/payments")
public class PaymentController {

    private final CustomerPaymentService customerPaymentService;
    private final CurrentUserProvider currentUser;

    public PaymentController(CustomerPaymentService customerPaymentService, CurrentUserProvider currentUser) {
        this.customerPaymentService = customerPaymentService;
        this.currentUser = currentUser;
    }

    // GET /api/v1/payments/my — khách lấy từ token, không nhận customerId
    @GetMapping("/my")
    public ResponseEntity<CustomerPaymentsResponse> getMyPayments() {
        return ResponseEntity.ok(customerPaymentService.getMyPayments(currentUser.require().id()));
    }
}
