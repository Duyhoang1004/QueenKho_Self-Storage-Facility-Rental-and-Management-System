package com.queenkho.api.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class RefundStatusServiceTest {
    final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    final RefundStatusService service = new RefundStatusService(jdbc);

    @BeforeEach void noTasksOrPayments() {
        when(jdbc.queryForMap(anyString(), eq(30), eq("%RES-20%"))).thenReturn(Map.of());
        when(jdbc.queryForList(anyString(), eq(String.class), eq(20), eq(30))).thenReturn(List.of());
    }

    @Test void openRefundTakesPrecedenceOverCompletedRefund() {
        when(jdbc.queryForMap(anyString(), eq(30), eq("%RES-20%")))
                .thenReturn(Map.of("open_count", 1L, "done_count", 2L));
        assertEquals("PENDING", service.resolve(20, "RES-20", 30));
        verify(jdbc, never()).queryForList(anyString(), eq(String.class), anyInt(), anyInt());
    }

    @Test void completedTaskDoesNotDependOnPaymentFallback() {
        when(jdbc.queryForMap(anyString(), eq(30), eq("%RES-20%")))
                .thenReturn(Map.of("open_count", 0, "done_count", 1));
        assertEquals("COMPLETED", service.resolve(20, "RES-20", 30));
        verify(jdbc, never()).queryForList(anyString(), eq(String.class), anyInt(), anyInt());
    }

    @ParameterizedTest
    @CsvSource({"SUCCESS,COMPLETED", "success,COMPLETED", "PENDING,PENDING", "pending,PENDING", "FAILED,NONE", "CANCELLED,NONE"})
    void noTaskUsesLatestRefundPayment(String payment, String expected) {
        when(jdbc.queryForList(anyString(), eq(String.class), eq(20), eq(30))).thenReturn(List.of(payment));
        assertEquals(expected, service.resolve(20, "RES-20", 30));
    }

    @Test void noRefundIsNotAssumedCompletedBecauseContractEnded() {
        assertEquals("NONE", service.resolve(20, "RES-20", 30));
    }

    @Test void sqlAggregateNullsFallBackToPayment() {
        Map<String, Object> counts = new HashMap<>();
        counts.put("open_count", null);
        counts.put("done_count", null);
        when(jdbc.queryForMap(anyString(), eq(30), eq("%RES-20%"))).thenReturn(counts);
        when(jdbc.queryForList(anyString(), eq(String.class), eq(20), eq(30))).thenReturn(List.of("SUCCESS"));
        assertEquals("COMPLETED", service.resolve(20, "RES-20", 30));
    }

    @ParameterizedTest @org.junit.jupiter.params.provider.NullAndEmptySource
    @org.junit.jupiter.params.provider.ValueSource(strings = {" ", "\t"})
    void missingIdentifiersNeverUseWildcardToMatchEveryRefund(String code) {
        when(jdbc.queryForMap(anyString(), eq(-1), eq("\u0000"))).thenReturn(Map.of());
        when(jdbc.queryForList(anyString(), eq(String.class), eq(-1), eq(-1))).thenReturn(List.of());
        assertEquals("NONE", service.resolve(null, code, null));
        verify(jdbc).queryForMap(anyString(), eq(-1), eq("\u0000"));
    }
}
