package com.queenkho.api.controller;

import com.queenkho.api.dto.MyReservationResponse;
import com.queenkho.api.dto.RefundEvidenceResponse;
import com.queenkho.api.service.ReservationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Integration layer: Spring MVC JSON binding + AccessControlFilter + token identity.
 * ReservationService is mocked, so DB calculation is covered separately by unit/service tests.
 */
class CustomerRefundEvidenceApiContractTest extends SecuredMvcFixture {
    private final ReservationService reservationService = mock(ReservationService.class);

    @BeforeEach
    void setUp() throws Exception {
        var controller = new ReservationController();
        ReflectionTestUtils.setField(controller, "reservationService", reservationService);
        ReflectionTestUtils.setField(controller, "currentUser", currentUser);
        ReflectionTestUtils.setField(controller, "ownershipGuard", ownership);
        controllers(controller);
        login("CUSTOMER");
    }

    private MyReservationResponse refundedReservation() {
        return new MyReservationResponse(
                80, "RES-REFUND-80", "Khách Test", "0900000000", "QueenKho Tân Bình", "Tân Bình",
                "Mini M", BigDecimal.valueOf(2), "1m × 2m", null, LocalDate.of(2026, 11, 20), 1,
                new BigDecimal("1000000"), "REFUNDED", LocalDateTime.of(2026, 11, 1, 9, 0), null,
                new BigDecimal("1000000"), null, "customer@example.test", "079000000001", "1900 0000",
                null, null, null,
                new RefundEvidenceResponse(501, "BANK_TRANSFER", "REF-80", "FT-80", new BigDecimal("1000000"),
                        LocalDateTime.of(2026, 11, 2, 10, 30), "/uploads/refund-80.jpg", "FM đã hoàn tiền"));
    }

    @Test
    void authenticatedCustomerReceivesCompleteRefundEvidenceInReservationDetailPayload() throws Exception {
        when(reservationService.getMyReservations(42)).thenReturn(List.of(refundedReservation()));

        mvc.perform(get("/api/v1/reservations/my").header("Authorization", TOKEN).param("customerId", "42"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].status").value("REFUNDED"))
                .andExpect(jsonPath("$[0].refundEvidence.taskId").value(501))
                .andExpect(jsonPath("$[0].refundEvidence.paymentMethod").value("BANK_TRANSFER"))
                .andExpect(jsonPath("$[0].refundEvidence.transactionCode").value("REF-80"))
                .andExpect(jsonPath("$[0].refundEvidence.bankTransactionCode").value("FT-80"))
                .andExpect(jsonPath("$[0].refundEvidence.amount").value(1000000))
                .andExpect(jsonPath("$[0].refundEvidence.evidenceImageUrl").value("/uploads/refund-80.jpg"))
                .andExpect(jsonPath("$[0].refundEvidence.note").value("FM đã hoàn tiền"));
    }

    @Test
    void pendingRefundDoesNotSerializeEvidenceDraft() throws Exception {
        var pending = new MyReservationResponse(
                81, "RES-PENDING-81", "Khách Test", "0900000000", "QueenKho Tân Bình", "Tân Bình",
                "Mini M", BigDecimal.valueOf(2), "1m × 2m", null, LocalDate.of(2026, 11, 20), 1,
                new BigDecimal("1000000"), "REFUND_PENDING", LocalDateTime.of(2026, 11, 1, 9, 0), null,
                new BigDecimal("1000000"), null, "customer@example.test", "079000000001", "1900 0000",
                null, null, null, null);
        when(reservationService.getMyReservations(42)).thenReturn(List.of(pending));

        mvc.perform(get("/api/v1/reservations/my").header("Authorization", TOKEN).param("customerId", "42"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].status").value("REFUND_PENDING"))
                .andExpect(jsonPath("$[0].refundEvidence").doesNotExist());
    }

    @Test
    void customerIdInQueryCannotBeSpoofedToReadAnotherCustomersRefundEvidence() throws Exception {
        when(reservationService.getMyReservations(42)).thenReturn(List.of(refundedReservation()));

        mvc.perform(get("/api/v1/reservations/my").header("Authorization", TOKEN).param("customerId", "999"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].reservationCode").value("RES-REFUND-80"));

        verify(reservationService).getMyReservations(eq(42));
        verify(reservationService, never()).getMyReservations(999);
    }

    @Test
    void unauthenticatedRequestCannotReadAnyRefundEvidence() throws Exception {
        mvc.perform(get("/api/v1/reservations/my").param("customerId", "42"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("UNAUTHORIZED"));
        verifyNoInteractions(reservationService);
    }

    @Test
    void authenticatedCustomerWithoutQueryParameterStillGetsOwnReservationList() throws Exception {
        when(reservationService.getMyReservations(42)).thenReturn(List.of(refundedReservation()));

        mvc.perform(get("/api/v1/reservations/my").header("Authorization", TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].reservationCode").value("RES-REFUND-80"));

        verify(reservationService).getMyReservations(42);
    }

    @Test
    void cashRefundEvidenceIsSerializedWithoutInventingBankTransferValues() throws Exception {
        MyReservationResponse cashRefund = new MyReservationResponse(
                82, "RES-CASH-82", "Khách Test", "0900000000", "QueenKho Tân Bình", "Tân Bình",
                "Mini M", BigDecimal.valueOf(2), "1m × 2m", null, LocalDate.of(2026, 11, 20), 1,
                new BigDecimal("1000000"), "REFUNDED", LocalDateTime.of(2026, 11, 1, 9, 0), null,
                new BigDecimal("1000000"), null, "customer@example.test", "079000000001", "1900 0000",
                null, null, null,
                new RefundEvidenceResponse(502, "CASH", "CASH-82", null, new BigDecimal("1000000"),
                        LocalDateTime.of(2026, 11, 2, 11, 0), null, "Khách đã ký nhận tiền mặt"));
        when(reservationService.getMyReservations(42)).thenReturn(List.of(cashRefund));

        mvc.perform(get("/api/v1/reservations/my").header("Authorization", TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].refundEvidence.paymentMethod").value("CASH"))
                .andExpect(jsonPath("$[0].refundEvidence.transactionCode").value("CASH-82"))
                .andExpect(jsonPath("$[0].refundEvidence.bankTransactionCode").doesNotExist())
                .andExpect(jsonPath("$[0].refundEvidence.evidenceImageUrl").doesNotExist())
                .andExpect(jsonPath("$[0].refundEvidence.note").value("Khách đã ký nhận tiền mặt"));
    }

    @Test
    void listKeepsEvidenceAttachedToTheCorrectReservationWhenMixedStatusesAreReturned() throws Exception {
        MyReservationResponse pending = new MyReservationResponse(
                83, "RES-PENDING-83", "Khách Test", "0900000000", "QueenKho Tân Bình", "Tân Bình",
                "Mini S", BigDecimal.ONE, "1m × 1m", null, LocalDate.of(2026, 11, 20), 1,
                new BigDecimal("500000"), "REFUND_PENDING", LocalDateTime.of(2026, 11, 1, 9, 0), null,
                new BigDecimal("500000"), null, "customer@example.test", "079000000001", "1900 0000",
                null, null, null, null);
        when(reservationService.getMyReservations(42)).thenReturn(List.of(pending, refundedReservation()));

        mvc.perform(get("/api/v1/reservations/my").header("Authorization", TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].reservationCode").value("RES-PENDING-83"))
                .andExpect(jsonPath("$[0].refundEvidence").doesNotExist())
                .andExpect(jsonPath("$[1].reservationCode").value("RES-REFUND-80"))
                .andExpect(jsonPath("$[1].refundEvidence.transactionCode").value("REF-80"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"STAFF", "FACILITY_MANAGER", "BOM", "ADMIN"})
    void nonCustomerRolesCannotReadCustomerRefundEvidence(String role) throws Exception {
        login(role);

        mvc.perform(get("/api/v1/reservations/my").header("Authorization", TOKEN).param("customerId", "42"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("FORBIDDEN_ROLE"));

        verifyNoInteractions(reservationService);
    }
}
