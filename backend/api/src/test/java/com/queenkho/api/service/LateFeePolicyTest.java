package com.queenkho.api.service;

import com.queenkho.api.entity.RentalContract;
import com.queenkho.api.entity.RentalPolicy;
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
