package com.queenkho.api.controller;

import com.queenkho.api.dto.CustomerPaymentsResponse;
import com.queenkho.api.service.CustomerPaymentService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** MVC/security contract for the customer's payment page. */
class CustomerPaymentApiContractTest extends SecuredMvcFixture {
    private final CustomerPaymentService payments = mock(CustomerPaymentService.class);

    @BeforeEach
    void setUp() throws Exception {
        controllers(new PaymentController(payments, currentUser));
        login("CUSTOMER");
    }

    private CustomerPaymentsResponse paymentPage() {
        var debt = new CustomerPaymentsResponse.PaymentItem(
                91, "DEBT-91", "FT-91", "DAMAGE_FEE", "VNPAY", new BigDecimal("250000"), "PENDING",
                LocalDateTime.of(2026, 11, 11, 10, 0), null, 20, "RES-20", 30, "HD-30", "Tân Bình", "Mini M");
        var refund = new CustomerPaymentsResponse.PaymentItem(
                92, "REF-92", "FT-92", "REFUND", "BANK_TRANSFER", new BigDecimal("1000000"), "SUCCESS",
                LocalDateTime.of(2026, 11, 11, 11, 0), null, 20, "RES-20", 30, "HD-30", "Tân Bình", "Mini M");
        return new CustomerPaymentsResponse(
                new CustomerPaymentsResponse.Summary(new BigDecimal("3000000"), new BigDecimal("1000000"),
                        BigDecimal.ZERO, new BigDecimal("250000"), BigDecimal.ZERO),
                List.of(debt), List.of(), List.of(debt, refund));
    }

    @Test
    void customerReceivesDebtSummaryAndActionableDebtItem() throws Exception {
        when(payments.getMyPayments(42)).thenReturn(paymentPage());

        mvc.perform(get("/api/v1/payments/my").header("Authorization", TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.summary.totalPaid").value(3000000))
                .andExpect(jsonPath("$.summary.totalRefunded").value(1000000))
                .andExpect(jsonPath("$.summary.outstandingDebt").value(250000))
                .andExpect(jsonPath("$.debts[0].id").value(91))
                .andExpect(jsonPath("$.debts[0].paymentType").value("DAMAGE_FEE"))
                .andExpect(jsonPath("$.debts[0].status").value("PENDING"));
        verify(payments).getMyPayments(42);
    }

    @Test
    void suppliedCustomerIdIsIgnoredBecauseEndpointHasNoCustomerParameter() throws Exception {
        when(payments.getMyPayments(42)).thenReturn(paymentPage());

        mvc.perform(get("/api/v1/payments/my").header("Authorization", TOKEN).param("customerId", "999"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.debts[0].transactionCode").value("DEBT-91"));
        verify(payments).getMyPayments(42);
        verify(payments, never()).getMyPayments(999);
    }

    @Test
    void emptyPaymentScreenSerializesEmptyListsInsteadOfNull() throws Exception {
        when(payments.getMyPayments(42)).thenReturn(new CustomerPaymentsResponse(
                new CustomerPaymentsResponse.Summary(BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO),
                List.of(), List.of(), List.of()));

        mvc.perform(get("/api/v1/payments/my").header("Authorization", TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.debts").isArray())
                .andExpect(jsonPath("$.debts").isEmpty())
                .andExpect(jsonPath("$.overdueContracts").isArray())
                .andExpect(jsonPath("$.transactions").isArray());
    }

    @Test
    void anonymousCallerCannotReadDebtOrRefundHistory() throws Exception {
        mvc.perform(get("/api/v1/payments/my"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("UNAUTHORIZED"));
        verifyNoInteractions(payments);
    }

    @ParameterizedTest
    @ValueSource(strings = {"STAFF", "FACILITY_MANAGER", "BOM", "ADMIN"})
    void nonCustomerRoleCannotReadCustomerPaymentPage(String role) throws Exception {
        login(role);

        mvc.perform(get("/api/v1/payments/my").header("Authorization", TOKEN))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("FORBIDDEN_ROLE"));
        verifyNoInteractions(payments);
    }
}
