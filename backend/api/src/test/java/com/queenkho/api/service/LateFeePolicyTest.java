package com.queenkho.api.service;

import com.queenkho.api.entity.RentalContract;
import com.queenkho.api.entity.RentalPolicy;
import com.queenkho.api.entity.Reservation;
import com.queenkho.api.entity.StorageUnit;
import com.queenkho.api.entity.UnitType;
import com.queenkho.api.repository.RentalPolicyRepository;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.*;

class LateFeePolicyTest {

    // PR-Q14: HĐ ô 3.000.000đ/tháng (100.000đ/ngày), cọc 3.000.000, chính sách phí chiếm dụng 150%, điều khoản theo tham số
    private static RentalContract overdueContract(String termsVersion) {
        UnitType unitType = new UnitType();
        unitType.setBasePriceMonthly(new BigDecimal("3000000"));
        StorageUnit unit = new StorageUnit();
        unit.setUnitType(unitType);
        Reservation reservation = new Reservation();
        reservation.setTermsVersion(termsVersion);

        RentalContract contract = new RentalContract();
        contract.setRentalPolicyId(8);
        contract.setStorageUnit(unit);
        contract.setReservation(reservation);
        contract.setDepositHeldAmount(new BigDecimal("3000000"));
        contract.setEndDate(LocalDate.of(2026, 10, 1));
        contract.setStatus("OVERDUE");
        return contract;
    }

    private static LateFeeService serviceWithPolicy() {
        RentalPolicyRepository policies = mock(RentalPolicyRepository.class);
        RentalPolicy policy = new RentalPolicy();
        policy.setLateFeePercentPerDay(10);
        policy.setLateFeeMaxPercent(50);
        policy.setLiquidationDays(15);
        policy.setOverstayPercent(150);
        when(policies.findById(8)).thenReturn(Optional.of(policy));
        LateFeeService service = new LateFeeService();
        ReflectionTestUtils.setField(service, "rentalPolicyRepository", policies);
        return service;
    }

    @Test
    void overstayFeeHasNoCapAndAddsToLateFee() {
        LateFeeService service = serviceWithPolicy();

        // Quá hạn 20 ngày: phí trễ chạm trần 1.500.000 + chiếm dụng 20 × 150.000 = 3.000.000 → vượt cọc 1.500.000
        var result = service.calculateLateFee(overdueContract("v2"), LocalDate.of(2026, 10, 21));

        assertTrue(result.isOverstayApplied());
        assertEquals(0, result.getLateFeeAmount().compareTo(new BigDecimal("1500000")));
        assertEquals(0, result.getOverstayDailyAmount().compareTo(new BigDecimal("150000")));
        assertEquals(0, result.getOverstayFeeAmount().compareTo(new BigDecimal("3000000")));
        assertEquals(0, result.getTotalOverdueCharge().compareTo(new BigDecimal("4500000")));
        assertEquals(0, result.getAmountBeyondDeposit().compareTo(new BigDecimal("1500000")));
        assertEquals(0, result.getEstimatedDepositRefund().compareTo(BigDecimal.ZERO));
        assertTrue(result.isCanLiquidate()); // 20 > 15 ngày
    }

    @Test
    void waivedContractPaysOverstayAtPlainDailyRent() {
        LateFeeService service = serviceWithPolicy();
        RentalContract contract = overdueContract("v2");
        contract.setLateFeeWaived(true);

        var result = service.calculateLateFee(contract, LocalDate.of(2026, 10, 4));

        assertEquals(0, result.getLateFeeAmount().compareTo(BigDecimal.ZERO));
        assertEquals(100, result.getOverstayPercent());
        assertEquals(0, result.getOverstayFeeAmount().compareTo(new BigDecimal("300000")));
    }

    @Test
    void oldTermsHaveNoOverstayFee() {
        LateFeeService service = serviceWithPolicy();

        var result = service.calculateLateFee(overdueContract("v1"), LocalDate.of(2026, 10, 21));

        assertFalse(result.isOverstayApplied());
        assertEquals(0, result.getOverstayFeeAmount().compareTo(BigDecimal.ZERO));
        assertEquals(0, result.getTotalOverdueCharge().compareTo(new BigDecimal("1500000")));
        assertEquals(0, service.overstayFee(overdueContract(null), 10).compareTo(BigDecimal.ZERO));
    }

    @Test
    void usesVersionAttachedToContractAndItsFeeCap() {
        RentalPolicyRepository policies = mock(RentalPolicyRepository.class);
        RentalPolicy signedVersion = new RentalPolicy();
        signedVersion.setLateFeePercentPerDay(12);
        signedVersion.setLateFeeMaxPercent(60);
        signedVersion.setLiquidationDays(45);
        when(policies.findById(8)).thenReturn(Optional.of(signedVersion));
        LateFeeService service = new LateFeeService();
        ReflectionTestUtils.setField(service, "rentalPolicyRepository", policies);

        RentalContract contract = new RentalContract();
        contract.setRentalPolicyId(8);
        contract.setDepositHeldAmount(new BigDecimal("1000000"));
        contract.setEndDate(LocalDate.of(2026, 10, 1));
        contract.setStatus("OVERDUE");

        var result = service.calculateLateFee(contract, LocalDate.of(2026, 10, 11));

        assertEquals(0, result.getLateFeeAmount().compareTo(new BigDecimal("600000")));
        assertEquals(45, result.getLiquidationDaysThreshold());
        assertEquals(0, result.getRatePerDay().compareTo(new BigDecimal("0.12")));
        verify(policies).findById(8);
    }

    @Test
    void allowsLiquidationOnlyAfterPolicyThreshold() {
        RentalPolicyRepository policies = mock(RentalPolicyRepository.class);
        RentalPolicy signedVersion = new RentalPolicy();
        signedVersion.setLateFeePercentPerDay(10);
        signedVersion.setLateFeeMaxPercent(50);
        signedVersion.setLiquidationDays(45);
        when(policies.findById(8)).thenReturn(Optional.of(signedVersion));
        LateFeeService service = new LateFeeService();
        ReflectionTestUtils.setField(service, "rentalPolicyRepository", policies);

        RentalContract contract = new RentalContract();
        contract.setRentalPolicyId(8);
        contract.setDepositHeldAmount(new BigDecimal("1000000"));
        contract.setEndDate(LocalDate.of(2026, 10, 1));
        contract.setStatus("OVERDUE");

        assertFalse(service.calculateLateFee(contract, LocalDate.of(2026, 11, 15)).isCanLiquidate());
        assertTrue(service.calculateLateFee(contract, LocalDate.of(2026, 11, 16)).isCanLiquidate());
    }

    @Test
    void waivedContractPaysNoLateFeeButKeepsOverdueDaysAndPinLock() {
        RentalPolicyRepository policies = mock(RentalPolicyRepository.class);
        RentalPolicy signedVersion = new RentalPolicy();
        signedVersion.setLateFeePercentPerDay(10);
        signedVersion.setLateFeeMaxPercent(50);
        signedVersion.setLiquidationDays(30);
        when(policies.findById(8)).thenReturn(Optional.of(signedVersion));
        LateFeeService service = new LateFeeService();
        ReflectionTestUtils.setField(service, "rentalPolicyRepository", policies);

        RentalContract contract = new RentalContract();
        contract.setRentalPolicyId(8);
        contract.setDepositHeldAmount(new BigDecimal("750000"));
        contract.setEndDate(LocalDate.of(2026, 10, 1));
        contract.setStatus("OVERDUE");
        contract.setLateFeeWaived(true);

        var result = service.calculateLateFee(contract, LocalDate.of(2026, 10, 4));

        assertEquals(0, result.getLateFeeAmount().compareTo(BigDecimal.ZERO));
        assertTrue(result.isLateFeeWaived());
        assertEquals(3, result.getOverdueDays());
        assertTrue(result.isPinLocked());
        assertFalse(result.isMaxLateFeeReached());
        assertEquals(0, result.getEstimatedDepositRefund().compareTo(new BigDecimal("750000")));
    }
}
