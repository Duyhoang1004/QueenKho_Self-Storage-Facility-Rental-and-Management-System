package com.queenkho.api.service;

import com.queenkho.api.dto.RefundEvidenceResponse;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RefundEvidenceServiceTest {
    @Mock JdbcTemplate jdbc;

    @Test
    void completedContractRefundReturnsAllEvidenceFields() {
        LocalDateTime completedAt = LocalDateTime.of(2026, 11, 10, 8, 30);
        when(jdbc.queryForMap(contains("FROM facility_tasks"), eq(77), eq("%Đơn: RES-77%")))
                .thenReturn(Map.of(
                        "id", 501,
                        "evidence_image_url", "http://localhost:8080/uploads/refund.jpg",
                        "note", "FM đã đối soát",
                        "completed_at", Timestamp.valueOf(completedAt)));
        when(jdbc.queryForMap(contains("FROM payment_transactions"), eq(77), eq(7)))
                .thenReturn(Map.of(
                        "transaction_code", "REF-77",
                        "bank_transaction_code", "FT-999",
                        "payment_method", "BANK_TRANSFER",
                        "amount", new BigDecimal("1250000"),
                        "paid_at", Timestamp.valueOf(completedAt.plusSeconds(1))));

        RefundEvidenceResponse result = new RefundEvidenceService(jdbc).findCompleted(7, "RES-77", 77);

        assertNotNull(result);
        assertAll(
                () -> assertEquals(501, result.getTaskId()),
                () -> assertEquals("BANK_TRANSFER", result.getPaymentMethod()),
                () -> assertEquals("REF-77", result.getTransactionCode()),
                () -> assertEquals("FT-999", result.getBankTransactionCode()),
                () -> assertEquals(0, new BigDecimal("1250000").compareTo(result.getAmount())),
                () -> assertEquals(completedAt, result.getCompletedAt()),
                () -> assertEquals("http://localhost:8080/uploads/refund.jpg", result.getEvidenceImageUrl()),
                () -> assertEquals("FM đã đối soát", result.getNote()));
    }

    @Test
    void cancelledReservationWithoutContractMatchesReservationCodeAndPayment() {
        LocalDateTime paidAt = LocalDateTime.of(2026, 11, 10, 9, 0);
        Map<String, Object> task = new HashMap<>();
        task.put("id", 502);
        task.put("evidence_image_url", "/uploads/cancel-refund.jpg");
        task.put("note", "Đơn: RES-CANCEL | đã hoàn");
        task.put("completed_at", null);
        when(jdbc.queryForMap(contains("FROM facility_tasks"), isNull(), eq("%Đơn: RES-CANCEL%")))
                .thenReturn(task);
        when(jdbc.queryForMap(contains("FROM payment_transactions"), isNull(), eq(8)))
                .thenReturn(Map.of(
                        "transaction_code", "REF-CANCEL",
                        "bank_transaction_code", "FT-CANCEL",
                        "payment_method", "BANK_TRANSFER",
                        "amount", new BigDecimal("5000000"),
                        "paid_at", paidAt));

        RefundEvidenceResponse result = new RefundEvidenceService(jdbc).findCompleted(8, " RES-CANCEL ", null);

        assertNotNull(result);
        assertEquals(502, result.getTaskId());
        assertEquals("FT-CANCEL", result.getBankTransactionCode());
        assertEquals(paidAt, result.getCompletedAt());
    }

    @Test
    void pendingOrMissingRefundTaskNeverExposesEvidence() {
        when(jdbc.queryForMap(contains("status = 'COMPLETED'"), eq(77), eq("%Đơn: RES-77%")))
                .thenThrow(new EmptyResultDataAccessException(1));

        assertNull(new RefundEvidenceService(jdbc).findCompleted(7, "RES-77", 77));
        verify(jdbc, never()).queryForMap(contains("FROM payment_transactions"), any(), any());
    }

    @Test
    void legacyCompletedTaskWithoutPaymentStillReturnsImageAndManagerNote() {
        LocalDateTime completedAt = LocalDateTime.of(2026, 11, 9, 17, 15);
        when(jdbc.queryForMap(contains("FROM facility_tasks"), eq(77), eq("%Đơn: RES-77%")))
                .thenReturn(Map.of(
                        "id", 503,
                        "evidence_image_url", "/uploads/legacy.jpg",
                        "note", "Ghi chú FM",
                        "completed_at", completedAt));
        when(jdbc.queryForMap(contains("FROM payment_transactions"), eq(77), eq(7)))
                .thenThrow(new EmptyResultDataAccessException(1));

        RefundEvidenceResponse result = new RefundEvidenceService(jdbc).findCompleted(7, "RES-77", 77);

        assertNotNull(result);
        assertEquals(completedAt, result.getCompletedAt());
        assertEquals("/uploads/legacy.jpg", result.getEvidenceImageUrl());
        assertEquals("Ghi chú FM", result.getNote());
        assertNull(result.getPaymentMethod());
        assertNull(result.getTransactionCode());
    }

    @Test
    void missingIdentifiersCannotCreateBroadWildcardQuery() {
        RefundEvidenceService service = new RefundEvidenceService(jdbc);

        assertNull(service.findCompleted(null, " ", null));
        assertNull(service.findCompleted(0, null, null));
        verifyNoInteractions(jdbc);
    }

    @Test
    void contractLookupWithoutReservationCodeUsesNonMatchingSentinel() {
        when(jdbc.queryForMap(contains("FROM facility_tasks"), eq(77), eq("\u0000")))
                .thenThrow(new EmptyResultDataAccessException(1));

        assertNull(new RefundEvidenceService(jdbc).findCompleted(null, null, 77));
        verify(jdbc).queryForMap(contains("status = 'COMPLETED'"), eq(77), eq("\u0000"));
    }
}
