package com.queenkho.api.service;

import com.queenkho.api.entity.Facility;
import com.queenkho.api.entity.RentalContract;
import com.queenkho.api.entity.StorageUnit;
import com.queenkho.api.entity.UnitType;
import com.queenkho.api.exception.ContractException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

// PR-R10 / PR-R11: gia hạn báo trước 3 ngày + ô "sắp trống"
class RenewalPolicyServiceTest {

    private final LocalDate today = LocalDate.now(LateFeeService.VIETNAM_ZONE);
    private JdbcTemplate jdbcTemplate;
    private RenewalPolicyService service;
    private RentalContract contract;

    @BeforeEach
    void setUp() {
        jdbcTemplate = mock(JdbcTemplate.class);
        service = new RenewalPolicyService(jdbcTemplate);

        Facility facility = new Facility();
        facility.setId(1);
        UnitType unitType = new UnitType();
        unitType.setId(2);
        StorageUnit unit = new StorageUnit();
        unit.setFacility(facility);
        unit.setUnitType(unitType);
        contract = new RentalContract();
        contract.setId(9);
        contract.setStorageUnit(unit);
        contract.setStatus("ACTIVE");

        freeNow(0);
        otherReleasing(List.of());
    }

    // ô AVAILABLE − đơn đang giữ suất của cơ sở 1 / loại 2
    private void freeNow(int free) {
        when(jdbcTemplate.queryForObject(contains("FROM storage_units WHERE facility_id"), eq(Integer.class),
                any(), any(), any(), any())).thenReturn(free);
    }

    @SuppressWarnings("unchecked")
    private void otherReleasing(List<LocalDate> dates) {
        when(jdbcTemplate.query(contains("release_date"), any(RowMapper.class), any(), any(), any(), any()))
                .thenReturn(dates);
    }

    @Test
    @DisplayName("Còn ≥ 3 ngày → PRIORITY, gia hạn tự do, hạn mới nối tiếp end_date")
    void priorityWindow() {
        contract.setEndDate(today.plusDays(10));

        var result = service.checkEligibility(contract);

        assertEquals("PRIORITY", result.window());
        assertTrue(result.renewable());
        assertFalse(result.unitReleasing());
        assertEquals(today.plusDays(7), result.priorityDeadline());
        assertEquals(today.plusDays(10).plusMonths(1), result.packages().get(0).newEndDate());
        verify(jdbcTemplate, never()).queryForObject(anyString(), eq(Integer.class), any(), any(), any(), any());
    }

    @Test
    @DisplayName("Đúng ngày end_date − 3 vẫn còn ưu tiên; sang ngày end_date − 2 là cửa sổ muộn")
    void deadlineIsInclusive() {
        contract.setEndDate(today.plusDays(3));
        assertEquals("PRIORITY", service.checkEligibility(contract).window());

        contract.setEndDate(today.plusDays(2));
        assertEquals("LATE", service.checkEligibility(contract).window());
    }

    @Test
    @DisplayName("Cửa sổ muộn, chưa ai cần ô → vẫn gia hạn được")
    void lateButUnitNotNeeded() {
        contract.setEndDate(today.plusDays(1));

        var result = service.checkEligibility(contract);

        assertEquals("LATE", result.window());
        assertTrue(result.renewable());
        assertTrue(result.unitReleasing());
        assertDoesNotThrow(() -> service.assertRenewable(contract));
    }

    @Test
    @DisplayName("Cửa sổ muộn, có đơn đang trông vào ô này → 409 RENEWAL_UNIT_RESERVED")
    void lateAndUnitReserved() {
        contract.setEndDate(today.plusDays(1));
        freeNow(-1); // 1 đơn đã cọc mà không còn ô trống → đang trông vào ô sắp trống

        var result = service.checkEligibility(contract);

        assertFalse(result.renewable());
        assertNotNull(result.blockedReason());
        ContractException ex = assertThrows(ContractException.class, () -> service.assertRenewable(contract));
        assertEquals("RENEWAL_UNIT_RESERVED", ex.getCode());
    }

    @Test
    @DisplayName("Đơn đang chờ đã có ô sắp trống KHÁC đáp ứng → khách cũ vẫn gia hạn được")
    void otherReleasingUnitCoversWaitingBooking() {
        contract.setStatus("OVERDUE");
        contract.setEndDate(today.minusDays(4));
        freeNow(-1);
        otherReleasing(List.of(today.plusDays(2)));

        var result = service.checkEligibility(contract);

        assertTrue(result.renewable());
        // Quá hạn → kỳ mới tính từ hôm nay (PR-R3)
        assertEquals(today.plusMonths(3), result.packages().get(1).newEndDate());
    }

    @Test
    @DisplayName("Hợp đồng đã kết thúc → CLOSED")
    void closedContract() {
        contract.setStatus("TERMINATED");
        contract.setEndDate(today.minusDays(1));

        var result = service.checkEligibility(contract);

        assertEquals("CLOSED", result.window());
        assertFalse(result.renewable());
        assertTrue(result.packages().isEmpty());
    }

    @Test
    @DisplayName("Ô sắp trống chỉ tính cho đơn có ngày nhận ≥ ngày ô trống; ngày sớm nhất bỏ qua các suất đang thiếu")
    void releasingSlotsByStartDate() {
        otherReleasing(List.of(today.plusDays(5), today.plusDays(9)));

        assertEquals(0, service.countReleasingBy(1, 2, today.plusDays(4)));
        assertEquals(1, service.countReleasingBy(1, 2, today.plusDays(5)));
        assertEquals(2, service.countReleasingBy(1, 2, today.plusDays(30)));

        assertNull(service.earliestSlotDate(1, 2, 1));                       // còn ô ngay
        assertEquals(today.plusDays(5), service.earliestSlotDate(1, 2, 0));  // hết ô → ô sắp trống đầu tiên
        assertEquals(today.plusDays(9), service.earliestSlotDate(1, 2, -1)); // đã thiếu 1 suất → ô thứ hai
        assertNull(service.earliestSlotDate(1, 2, -2));
    }

    @Test
    @DisplayName("isReleasing: OVERDUE / TERMINATION_PENDING luôn sắp trống; ACTIVE chỉ khi đã qua end_date − 3")
    void releasingRule() {
        assertTrue(RenewalPolicyService.isReleasing("OVERDUE", today.minusDays(1), today));
        assertTrue(RenewalPolicyService.isReleasing("TERMINATION_PENDING", today.plusDays(20), today));
        assertFalse(RenewalPolicyService.isReleasing("ACTIVE", today.plusDays(3), today));
        assertTrue(RenewalPolicyService.isReleasing("ACTIVE", today.plusDays(2), today));
        assertFalse(RenewalPolicyService.isReleasing("PENDING_CHECK_IN", today, today));
    }
}
