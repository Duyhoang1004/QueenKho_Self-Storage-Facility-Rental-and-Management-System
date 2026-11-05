package com.queenkho.api.controller;

import com.queenkho.api.exception.ContractException;
import com.queenkho.api.service.VnpayService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.*;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class VnpayApiContractTest extends SecuredMvcFixture {
    final VnpayService payments = mock(VnpayService.class);

    @BeforeEach void setup() { controllers(new VnpayController(payments, sessions)); }

    @ParameterizedTest @ValueSource(strings = {"create", "create-renewal", "create-debt"})
    void anonymousCallerCannotCreateAnyPaymentLink(String route) throws Exception {
        mvc.perform(post("/api/payments/vnpay/" + route).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
        verifyNoInteractions(payments);
    }

    @ParameterizedTest @ValueSource(strings = {"STAFF", "FACILITY_MANAGER", "BOM", "ADMIN"})
    void nonCustomerCannotGeneratePaymentLink(String role) throws Exception {
        login(role);
        mvc.perform(post("/api/payments/vnpay/create").header("Authorization", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reservationId\":20}"))
                .andExpect(status().isForbidden());
        verifyNoInteractions(payments);
    }

    @Test void depositLinkUsesSessionIdentityAndRequestIp() throws Exception {
        login("CUSTOMER");
        when(payments.createReservation(eq(20), eq(42), anyString())).thenReturn(Map.of("paymentUrl", "https://sandbox.example.test/pay"));
        mvc.perform(post("/api/payments/vnpay/create").header("Authorization", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reservationId\":20,\"customerId\":999}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.paymentUrl").value("https://sandbox.example.test/pay"));
        verify(payments).createReservation(eq(20), eq(42), anyString());
    }

    @Test void renewalPassesRequestedCycleAndAuthenticatedUser() throws Exception {
        login("CUSTOMER");
        mvc.perform(post("/api/payments/vnpay/create-renewal").header("Authorization", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"contractId\":30,\"months\":6,\"userId\":999}"))
                .andExpect(status().isOk());
        verify(payments).createRenewal(eq(30), eq(6), eq(42), anyString());
    }

    @Test void debtLinkUsesPaymentIdAndAuthenticatedUser() throws Exception {
        login("CUSTOMER");
        mvc.perform(post("/api/payments/vnpay/create-debt").header("Authorization", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"paymentId\":50,\"userId\":999}"))
                .andExpect(status().isOk());
        verify(payments).createDebtPayment(eq(50), eq(42), anyString());
    }

    @Test void statusLookupIsScopedToAuthenticatedCustomer() throws Exception {
        login("CUSTOMER"); when(payments.status("TXN-1", 42)).thenReturn(Map.of("status", "PENDING"));
        mvc.perform(get("/api/payments/vnpay/status/TXN-1").header("Authorization", TOKEN).param("userId", "999"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("PENDING"));
        verify(payments).status("TXN-1", 42);
    }

    @Test void callbackRemainsPublicAndPreservesSignatureFields() throws Exception {
        when(payments.receiveIpn(anyMap())).thenReturn(Map.of("RspCode", "97", "Message", "Invalid signature"));
        mvc.perform(get("/api/payments/vnpay/ipn").param("vnp_TxnRef", "TXN-1").param("vnp_SecureHash", "bad"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.RspCode").value("97"));
        verify(payments).receiveIpn(argThat(params -> "TXN-1".equals(params.get("vnp_TxnRef"))
                && "bad".equals(params.get("vnp_SecureHash"))));
        verifyNoInteractions(sessions);
    }

    @Test void browserReturnRedirectsAndRunsLocalConfirmation() throws Exception {
        when(payments.returnDestination(anyMap())).thenReturn("http://localhost:5173/payment-result?orderId=TXN-1");
        mvc.perform(get("/api/payments/vnpay/return").param("vnp_TxnRef", "TXN-1"))
                .andExpect(status().isFound())
                .andExpect(header().string("Location", "http://localhost:5173/payment-result?orderId=TXN-1"));
        verify(payments).confirmLocalReturn(argThat(params -> "TXN-1".equals(params.get("vnp_TxnRef"))));
        verifyNoInteractions(sessions);
    }

    @ParameterizedTest @CsvSource({"403,Không được xem giao dịch", "404,Không tìm thấy giao dịch", "409,Giao dịch đã thanh toán"})
    void paymentErrorsKeepHttpStatusAndReadableBody(int code, String message) throws Exception {
        login("CUSTOMER");
        when(payments.status("TXN-1", 42)).thenThrow(new ResponseStatusException(HttpStatus.valueOf(code), message));
        mvc.perform(get("/api/payments/vnpay/status/TXN-1").header("Authorization", TOKEN))
                .andExpect(status().is(code)).andExpect(jsonPath("$.error").value("PAYMENT_ERROR"))
                .andExpect(jsonPath("$.message").value(message));
    }

    @Test void contractValidationErrorKeepsBusinessCode() throws Exception {
        login("CUSTOMER");
        when(payments.createRenewal(any(), any(), any(), anyString())).thenThrow(
                new ContractException(HttpStatus.BAD_REQUEST, "RENEWAL_BLOCKED", "Ô kho đã có khách đặt"));
        mvc.perform(post("/api/payments/vnpay/create-renewal").header("Authorization", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"contractId\":30,\"months\":3}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("RENEWAL_BLOCKED"));
    }

    @ParameterizedTest @ValueSource(strings = {"{", "[]", "{\"reservationId\":\"abc\"}"})
    void malformedPaymentRequestCannotReachService(String json) throws Exception {
        login("CUSTOMER");
        mvc.perform(post("/api/payments/vnpay/create").header("Authorization", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON).content(json))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(payments);
    }
}
