package com.queenkho.api.service;

import com.queenkho.api.dto.UnitScheduleResponse;
import com.queenkho.api.entity.StorageUnit;
import com.queenkho.api.repository.RentalContractRepository;
import com.queenkho.api.repository.StorageUnitRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import static com.queenkho.api.service.BusinessFixtures.unit;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * D-18 (08/11/2026): ô kho tính theo lịch — kịch bản giảng viên: khách A thuê 1 năm, 2 tháng sau mới nhận kho;
 * khách B thuê 1 tháng, nhận tuần sau → B được gán vào đúng ô của A trong 2 tháng trống đó.
 */
class UnitScheduleServiceTest {

    final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    final StorageUnitRepository units = mock(StorageUnitRepository.class);
    final RentalContractRepository contracts = mock(RentalContractRepository.class);
    final List<UnitScheduleService.Booking> bookings = new ArrayList<>();

    // Lịch đọc từ danh sách trong test thay cho SQL
    final UnitScheduleService service = new UnitScheduleService(jdbc, units, contracts) {
        @Override
        public List<Booking> bookingsOfFacility(Integer facilityId) {
            return List.copyOf(bookings);
        }

        @Override
        public List<Booking> bookingsOfUnit(String unitId) {
            return bookings.stream().filter(b -> b.unitId().equals(unitId)).toList();
        }
    };

    final LocalDate today = UnitScheduleService.today();

    UnitScheduleService.Booking booking(String unitId, int id, String status, LocalDate start, int months, boolean mayRenew) {
        LocalDate end = start.plusMonths(months);
        return new UnitScheduleService.Booking(unitId, id, "HD-" + id, 100 + id, "RES-" + id, "Khach " + id, status,
                start, end, end.plusDays(UnitScheduleService.CLEANUP_DAYS), mayRenew);
    }

    @Test
    @DisplayName("Khoảng nửa mở: ô trả ngày D thì khách sau nhận được đúng ngày D; to = null là vô hạn")
    void overlapIsHalfOpen() {
        LocalDate d = LocalDate.of(2027, 1, 10);
        assertFalse(UnitScheduleService.overlaps(d.minusDays(5), d, d, d.plusDays(5)));
        assertTrue(UnitScheduleService.overlaps(d.minusDays(5), d.plusDays(1), d, d.plusDays(5)));
        assertTrue(UnitScheduleService.overlaps(d, null, d.plusYears(3), d.plusYears(4)));
        assertEquals(LocalDate.of(2027, 2, 12), UnitScheduleService.rangeEnd(d, 1));
    }

    @Test
    @DisplayName("GV: ô đã gán cho A (nhận sau 2 tháng) vẫn gán được cho B thuê 1 tháng từ tuần sau")
    void shortBookingFitsBeforeFutureBooking() {
        StorageUnit x = unit("KV-X", 1, 1);
        bookings.add(booking("KV-X", 1, "PENDING_CHECK_IN", today.plusMonths(2), 12, false));

        LocalDate bStart = today.plusDays(7);
        assertTrue(service.isUnitFree(x, bStart, UnitScheduleService.rangeEnd(bStart, 1), null),
                "B trả ô (cộng 2 ngày dọn) trước ngày A nhận kho");
        LocalDate longStart = today.plusDays(7);
        List<UnitScheduleService.Block> clash = service.conflicts(x, longStart, UnitScheduleService.rangeEnd(longStart, 2), null);
        assertEquals(1, clash.size(), "Thuê 2 tháng thì đè lên ngày A nhận kho");
        assertTrue(UnitScheduleService.describe(clash.get(0)).contains("HD-1"));
    }

    @Test
    @DisplayName("Dời lịch đơn đã tới ngày nhận kho: ô OCCUPIED do chính hợp đồng đó không bị coi là có khách khác")
    void excludedContractDoesNotBlockItsOwnOccupiedUnit() {
        StorageUnit x = unit("KV-X", 1, 1);
        x.setStatus("OCCUPIED");
        bookings.add(booking("KV-X", 1, "PENDING_CHECK_IN", today.minusDays(1), 1, false));

        assertTrue(service.conflicts(x, today, UnitScheduleService.rangeEnd(today, 1), 1).isEmpty());
        assertFalse(service.conflicts(x, today, UnitScheduleService.rangeEnd(today, 1), 99).isEmpty(), "hợp đồng khác thì vẫn trùng");
    }

    @Test
    @DisplayName("Đếm suất: ô có hợp đồng tương lai vẫn là 1 suất cho khoảng trống trước đó; ô đang thuê còn gia hạn được thì không")
    void freeSlotsUseDateRanges() {
        StorageUnit x = unit("KV-X", 1, 1);
        StorageUnit y = unit("KV-Y", 1, 1);
        y.setStatus("OCCUPIED");
        when(units.findByFacility_Id(1)).thenReturn(List.of(x, y));
        bookings.add(booking("KV-X", 1, "PENDING_CHECK_IN", today.plusMonths(2), 12, false));
        // Y: khách đang thuê, hết hạn sau 10 ngày nhưng còn quyền gia hạn → chưa biết ngày trả
        bookings.add(booking("KV-Y", 2, "ACTIVE", today.minusMonths(1).plusDays(10), 1, true));

        assertEquals(1, service.freeSlots(1, 1, today.plusDays(7), 1), "chỉ X (trước ngày A nhận)");
        assertEquals(0, service.freeSlots(1, 1, today.plusDays(7), 3), "3 tháng thì đè lên A, Y chưa biết ngày trả");
    }

    @Test
    @DisplayName("Ô bảo trì chặn từ hôm nay; khách đã gán trước trên ô đó bị báo trùng lịch để FM đổi ô")
    void maintenanceBlocksAndWarns() {
        StorageUnit x = unit("KV-X", 1, 1);
        x.setStatus("MAINTENANCE");
        bookings.add(booking("KV-X", 1, "PENDING_CHECK_IN", today.plusMonths(2), 12, false));

        assertFalse(service.isUnitFree(x, today.plusDays(7), today.plusDays(20), null));
        String warning = UnitScheduleService.scheduleWarning(x, bookings);
        assertNotNull(warning);
        assertTrue(warning.contains("bảo trì"));
        assertEquals(1, service.pendingCheckInsOnUnit("KV-X", null).size());
    }

    @Test
    @DisplayName("Lịch: khoảng trống giữa hợp đồng đang thuê và hợp đồng tương lai, khoảng cuối mở")
    void freeRangesBetweenBookings() {
        StorageUnit x = unit("KV-X", 1, 1);
        x.setStatus("OCCUPIED");
        UnitScheduleService.Booking current = booking("KV-X", 1, "ACTIVE", today.minusMonths(1), 2, false);
        UnitScheduleService.Booking future = booking("KV-X", 2, "PENDING_CHECK_IN", today.plusMonths(3), 1, false);
        List<UnitScheduleResponse.FreeRange> ranges = UnitScheduleService.freeRanges(
                UnitScheduleService.blocksOf(x, List.of(current, future), false, today), today, today.plusMonths(6));

        assertEquals(2, ranges.size());
        assertEquals(current.freeFrom(), ranges.get(0).getFrom());
        assertEquals(future.startDate(), ranges.get(0).getTo());
        assertEquals(future.freeFrom(), ranges.get(1).getFrom());
        assertNull(ranges.get(1).getTo(), "sau hợp đồng tương lai chưa ai đặt");
    }

    @Test
    @DisplayName("Hai hợp đồng trùng ngày trên cùng ô → cả hai bị đánh dấu trùng lịch")
    void overlappingBookingsAreConflicts() {
        StorageUnit x = unit("KV-X", 1, 1);
        when(units.findByFacility_Id(1)).thenReturn(List.of(x));
        bookings.add(booking("KV-X", 1, "ACTIVE", today.minusMonths(1), 3, false));
        bookings.add(booking("KV-X", 2, "PENDING_CHECK_IN", today.plusMonths(1), 6, false));

        UnitScheduleResponse schedule = service.getSchedule(1, today, today.plusMonths(6), null);
        assertEquals(2, schedule.getConflictCount());
        assertTrue(schedule.getUnits().get(0).isConflict());
    }

    @Test
    @DisplayName("Gợi ý ô: ô có khoảng trống vừa khít xếp trước ô trống dài")
    void candidatesPreferTightestGap() {
        StorageUnit open = unit("KV-OPEN", 1, 1);
        StorageUnit gap = unit("KV-GAP", 1, 1);
        when(units.findByFacility_IdAndUnitType_IdAndStatus(1, 1, "AVAILABLE")).thenReturn(List.of(open, gap));
        bookings.add(booking("KV-GAP", 1, "PENDING_CHECK_IN", today.plusMonths(2), 12, false));

        LocalDate start = today.plusDays(7);
        List<UnitScheduleService.Candidate> result = service.candidates(1, 1, start, UnitScheduleService.rangeEnd(start, 1), null, null);
        assertEquals(List.of("KV-GAP", "KV-OPEN"), result.stream().map(c -> c.unit().getId()).toList());
        assertEquals(today.plusMonths(2), result.get(0).freeUntil());
        assertNull(result.get(1).freeUntil());
    }

    @Test
    @DisplayName("Trạng thái ô: chỉ OCCUPIED khi hôm nay có khách ở thật; ô bảo trì giữ nguyên")
    void refreshUnitStatusFollowsToday() {
        StorageUnit x = unit("KV-X", 1, 1);
        x.setStatus("OCCUPIED");
        when(contracts.countOccupyingNow(eq("KV-X"), any())).thenReturn(0L);
        service.refreshUnitStatus(x);
        assertEquals("AVAILABLE", x.getStatus());

        when(contracts.countOccupyingNow(eq("KV-X"), any())).thenReturn(1L);
        service.refreshUnitStatus(x);
        assertEquals("OCCUPIED", x.getStatus());

        x.setStatus("MAINTENANCE");
        service.refreshUnitStatus(x);
        assertEquals("MAINTENANCE", x.getStatus());
    }

    @Test
    @DisplayName("PR-B4 (D-18): ngày nhận kho xa hơn 90 ngày → 400 START_DATE_TOO_FAR")
    void bookingLeadTimeIsCapped() {
        ReservationService.assertWithinBookingLead(today.plusDays(UnitScheduleService.MAX_BOOKING_LEAD_DAYS));
        var ex = assertThrows(com.queenkho.api.exception.ReservationException.class,
                () -> ReservationService.assertWithinBookingLead(today.plusDays(UnitScheduleService.MAX_BOOKING_LEAD_DAYS + 1)));
        assertEquals("START_DATE_TOO_FAR", ex.getCode());
    }
}
