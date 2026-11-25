package com.queenkho.api.service;

import com.queenkho.api.dto.MoneyLine;
import com.queenkho.api.entity.Reservation;
import com.queenkho.api.entity.StaffTask;
import com.queenkho.api.entity.UnitType;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

// Góp ý test 24/11/2026: số tiền rõ ràng (HĐ 3 tháng 11.065.000, hủy do lỗi cơ sở ngày thứ 2)
class TestFeedback2411Test {

    private static BigDecimal m(String v) { return new BigDecimal(v); }

    // 88.750 = 8.165.000 ÷ 92 ngày (24/11/2026 → 24/02/2027) × 1 ngày đã dùng
    @Test void faultTerminationNoteShowsDayArithmetic() {
        RefundBreakdown.RentBasis basis = new RefundBreakdown.RentBasis(m("8165000"), BigDecimal.ZERO, 3,
                LocalDate.of(2026, 11, 24), true, true, 1, m("2900000"), BigDecimal.ZERO, 0);
        List<MoneyLine> lines = RefundBreakdown.lines(m("2900000"), basis, m("8076250"),
                BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO);
        MoneyLine kept = lines.stream().filter(l -> MoneyLine.KEPT.equals(l.group())).findFirst().orElseThrow();
        assertEquals("Tiền thuê những ngày đã dùng", kept.label());
        assertEquals(0, kept.amount().compareTo(m("88750")));
        assertTrue(kept.note().startsWith("1 ngày đã dùng × 88.750đ/ngày (8.165.000đ ÷ 92 ngày của kỳ)"), kept.note());
        assertEquals(0, RefundBreakdown.totals(lines).net().compareTo(m("10976250")));
    }

    @Test void faultNoteFallsBackWithoutPeriodStart() {
        RefundBreakdown.RentBasis basis = new RefundBreakdown.RentBasis(m("8165000"), BigDecimal.ZERO, 3,
                null, true, true, 1, m("2900000"), BigDecimal.ZERO, 0);
        assertTrue(RefundBreakdown.faultDaysNote(basis, m("8165000"), m("88750")).startsWith("Chấm dứt do lỗi cơ sở"));
    }

    // PR-B14: popup "Số tiền đã đóng" — 8.700.000 − 5% − voucher 100.000 + bảo hiểm 0 + cọc 2.900.000 = 11.065.000
    @Test void bookingPaymentLinesAddUpToAmountPaid() {
        UnitType type = new UnitType();
        type.setBasePriceMonthly(m("2900000"));
        Reservation r = new Reservation();
        r.setUnitType(type);
        r.setDurationMonths(3);
        r.setRentDiscountPercent(5);
        r.setVoucherCode("NEWKHO");
        r.setVoucherDiscount(m("100000"));
        r.setInsurancePlan("BASIC");
        r.setInsurancePremiumMonthly(BigDecimal.ZERO);
        r.setDepositAmount(m("2900000"));
        List<MoneyLine> lines = ReservationService.bookingPaymentLines(r);
        BigDecimal total = lines.stream().map(MoneyLine::amount).reduce(BigDecimal.ZERO, BigDecimal::add);
        assertEquals(0, total.compareTo(m("11065000")));
        assertEquals(List.of("Tiền thuê 3 tháng", "Ưu đãi gói 3 tháng (−5%)", "Voucher NEWKHO",
                "Bảo hiểm hàng hoá — gói Cơ bản", "Tiền cọc"), lines.stream().map(MoneyLine::label).toList());
        assertEquals(0, lines.get(1).amount().compareTo(m("-435000")));
    }

    // PR-O31a: demo "khách tới đúng ngày hẹn" — nghiệm thu 24/11 nhưng chốt theo ngày hẹn 25/11; luồng thật = hôm nay
    @Test void inspectionUsesSimulatedAppointmentDate() {
        LocalDate today = LocalDate.of(2026, 11, 24);
        StaffTask task = new StaffTask();
        assertEquals(today, StaffTaskService.effectiveCheckoutDate(task, today));
        task.setSimulatedCheckoutDate(LocalDate.of(2026, 11, 25));
        assertEquals(LocalDate.of(2026, 11, 25), StaffTaskService.effectiveCheckoutDate(task, today));
        // Ngày hẹn giả lập đã qua (nghiệm thu muộn hơn) → theo ngày thực tế
        assertEquals(LocalDate.of(2026, 11, 26), StaffTaskService.effectiveCheckoutDate(task, LocalDate.of(2026, 11, 26)));
        assertEquals(today, StaffTaskService.effectiveCheckoutDate(null, today));
    }

    @Test void bookingLinesIncludePaidInsurance() {
        UnitType type = new UnitType();
        type.setBasePriceMonthly(m("1000000"));
        Reservation r = new Reservation();
        r.setUnitType(type);
        r.setDurationMonths(1);
        r.setInsurancePlan("ADVANCED");
        r.setInsurancePremiumMonthly(m("50000"));
        r.setDepositAmount(m("1000000"));
        List<MoneyLine> lines = ReservationService.bookingPaymentLines(r);
        BigDecimal total = lines.stream().map(MoneyLine::amount).reduce(BigDecimal.ZERO, BigDecimal::add);
        assertEquals(0, total.compareTo(m("2050000")));
        assertEquals(3, lines.size());
    }

    // Vấn đề 3 (25/11/2026): HĐ đang ở ô khẩn cấp (đã có task MAINTENANCE loại DAMAGE sửa ô gốc) bị cưỡng chế dọn kho
    // → vẫn phải sinh thêm task MAINTENANCE loại LIQUIDATION, giữ nguyên task bảo trì cũ
    @Test void liquidationCreatesCleanoutTaskEvenWhenDamageMaintenanceTaskIsOpen() {
        var repo = org.mockito.Mockito.mock(com.queenkho.api.repository.StaffTaskRepository.class);
        StaffTaskService svc = new StaffTaskService();
        org.springframework.test.util.ReflectionTestUtils.setField(svc, "staffTaskRepository", repo);

        com.queenkho.api.entity.Facility fac = new com.queenkho.api.entity.Facility();
        fac.setId(3);
        com.queenkho.api.entity.StorageUnit emergencyUnit = new com.queenkho.api.entity.StorageUnit();
        emergencyUnit.setId("KC-TD-E01");
        emergencyUnit.setFacility(fac);
        com.queenkho.api.entity.RentalContract contract = new com.queenkho.api.entity.RentalContract();
        contract.setId(69);
        contract.setContractCode("HD-DE6");
        contract.setStorageUnit(emergencyUnit);

        // Giả lập: hợp đồng đang có task MAINTENANCE (DAMAGE) mở, nhưng CHƯA có task LIQUIDATION mở
        org.mockito.Mockito.when(repo.existsByContractIdAndTaskTypeAndStatusIn(
                org.mockito.Mockito.eq(69), org.mockito.Mockito.eq("MAINTENANCE"), org.mockito.Mockito.anyList()))
                .thenReturn(true);
        org.mockito.Mockito.when(repo.existsByContractIdAndTaskTypeAndMaintenanceReasonAndStatusIn(
                org.mockito.Mockito.eq(69), org.mockito.Mockito.eq("MAINTENANCE"),
                org.mockito.Mockito.eq("LIQUIDATION"), org.mockito.Mockito.anyList()))
                .thenReturn(false);
        org.mockito.Mockito.when(repo.save(org.mockito.Mockito.any(StaffTask.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        StaffTask created = svc.createMaintenanceTask(contract, "LIQUIDATION",
                "Cưỡng chế dọn ô KC-TD-E01 của HĐ HD-DE6", true, null);
        assertNotNull(created, "Phải tạo được task dọn kho LIQUIDATION dù đã có task bảo trì DAMAGE đang mở");
        assertEquals("MAINTENANCE", created.getTaskType());
        assertEquals("LIQUIDATION", created.getMaintenanceReason());
    }
}
