package com.queenkho.api.service;

import com.queenkho.api.dto.SimulateAccessRequest;
import com.queenkho.api.dto.UnitAccessLogResponse;
import com.queenkho.api.dto.UnitAccessSummaryResponse;
import com.queenkho.api.entity.RentalContract;
import com.queenkho.api.entity.StorageUnit;
import com.queenkho.api.repository.RentalContractRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.PreparedStatementCreator;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Collections;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class UnitAccessWorkflowTest {

    final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    final RentalContractRepository contracts = mock(RentalContractRepository.class);
    final UnitAccessService service = new UnitAccessService();

    @BeforeEach
    void setup() {
        ReflectionTestUtils.setField(service, "jdbcTemplate", jdbc);
        ReflectionTestUtils.setField(service, "rentalContractRepository", contracts);
    }

    RentalContract createContract(int id, String status, String pin, String rfid, String unitId, String roomNumber) {
        RentalContract c = new RentalContract();
        c.setId(id);
        c.setContractCode("HD-TEST-" + id);
        c.setStatus(status);
        c.setAccessPinCode(pin);
        c.setRfidCardCode(rfid);

        StorageUnit su = new StorageUnit();
        su.setId(unitId);
        su.setRoomNumber(roomNumber);
        c.setStorageUnit(su);

        when(contracts.findDetailById(id)).thenReturn(Optional.of(c));
        return c;
    }

    @Test
    void getAccessSummary_activeContract_notBlocked() {
        createContract(1, "ACTIVE", "123456", "RFID-001", "KV-TB-A101", "A101");
        when(jdbc.query(anyString(), any(RowMapper.class), eq(1))).thenReturn(Collections.emptyList());

        UnitAccessSummaryResponse summary = service.getAccessSummary(1);

        assertNotNull(summary);
        assertEquals("SMARTLOCK-A101", summary.getDeviceCode());
        assertFalse(summary.getIsAccessBlocked());
        assertNull(summary.getBlockReason());
        assertEquals("123456", summary.getCurrentPinCode());
        assertEquals("RFID-001", summary.getCurrentRfidCode());
    }

    @Test
    void getAccessSummary_overdueContract_isBlocked() {
        createContract(2, "OVERDUE", "123456", "RFID-002", "KV-TB-A102", "A102");
        when(jdbc.query(anyString(), any(RowMapper.class), eq(2))).thenReturn(Collections.emptyList());

        UnitAccessSummaryResponse summary = service.getAccessSummary(2);

        assertNotNull(summary);
        assertTrue(summary.getIsAccessBlocked());
        assertTrue(summary.getBlockReason().contains("quá hạn"));
    }

    @Test
    void simulateAccess_activeContract_pin_success() {
        createContract(1, "ACTIVE", "123456", "RFID-001", "KV-TB-A101", "A101");
        doAnswer(invocation -> {
            KeyHolder kh = invocation.getArgument(1);
            ReflectionTestUtils.setField(kh, "keyList", Collections.singletonList(Collections.singletonMap("GENERATED_KEY", 100L)));
            return 1;
        }).when(jdbc).update(any(PreparedStatementCreator.class), any(KeyHolder.class));

        SimulateAccessRequest req = SimulateAccessRequest.builder().accessMethod("PIN").isInvalid(false).build();
        UnitAccessLogResponse res = service.simulateAccess(1, req);

        assertNotNull(res);
        assertEquals("SUCCESS", res.getStatus());
        assertEquals("PIN", res.getAccessMethod());
        assertEquals("123456", res.getCredentialCode());
        assertNull(res.getFailureReason());
        assertTrue(res.getNotes().contains("Mở chốt"));
    }

    @Test
    void simulateAccess_overdueContract_pin_denied() {
        createContract(2, "OVERDUE", "123456", "RFID-002", "KV-TB-A102", "A102");
        doAnswer(invocation -> 1).when(jdbc).update(any(PreparedStatementCreator.class), any(KeyHolder.class));

        SimulateAccessRequest req = SimulateAccessRequest.builder().accessMethod("PIN").isInvalid(false).build();
        UnitAccessLogResponse res = service.simulateAccess(2, req);

        assertNotNull(res);
        assertEquals("DENIED", res.getStatus());
        assertTrue(res.getFailureReason().contains("quá hạn"));
        assertTrue(res.getNotes().contains("vẫn khóa"));
    }

    @Test
    void simulateAccess_overdueContract_rfid_denied() {
        createContract(2, "OVERDUE", "123456", "RFID-002", "KV-TB-A102", "A102");
        doAnswer(invocation -> 1).when(jdbc).update(any(PreparedStatementCreator.class), any(KeyHolder.class));

        SimulateAccessRequest req = SimulateAccessRequest.builder().accessMethod("RFID").isInvalid(false).build();
        UnitAccessLogResponse res = service.simulateAccess(2, req);

        assertNotNull(res);
        assertEquals("DENIED", res.getStatus());
        assertTrue(res.getFailureReason().contains("quá hạn"));
        assertTrue(res.getNotes().contains("vẫn khóa"));
    }

    @Test
    void simulateAccess_invalidCode_denied() {
        createContract(1, "ACTIVE", "123456", "RFID-001", "KV-TB-A101", "A101");
        doAnswer(invocation -> 1).when(jdbc).update(any(PreparedStatementCreator.class), any(KeyHolder.class));

        SimulateAccessRequest req = SimulateAccessRequest.builder().accessMethod("PIN").isInvalid(true).build();
        UnitAccessLogResponse res = service.simulateAccess(1, req);

        assertNotNull(res);
        assertEquals("DENIED", res.getStatus());
        assertEquals("MÃ_KHÔNG_HỢP_LỆ", res.getCredentialCode());
        assertTrue(res.getFailureReason().contains("không khớp"));
    }
}
