package com.queenkho.api.service;

import com.queenkho.api.dto.FacilityPricingResponse;
import com.queenkho.api.dto.LateFeeCalculationResult;
import com.queenkho.api.dto.RenewalQuoteResponse;
import com.queenkho.api.entity.Facility;
import com.queenkho.api.entity.RentalContract;
import com.queenkho.api.entity.RentalPolicy;
import com.queenkho.api.entity.StorageUnit;
import com.queenkho.api.entity.UnitType;
import com.queenkho.api.repository.RentalPolicyRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

// Flow 4: % ưu đãi gói lấy từ chính sách BOM; báo giá gia hạn = số VNPAY thu
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PricingServiceTest {

    @Mock RentalPolicyRepository policies;
    @Mock LateFeeService lateFeeService;

    PricingService pricing;
    RentalPolicy policy;
    RentalContract contract;

    @BeforeEach
    void setUp() {
        pricing = new PricingService(policies, lateFeeService);
        policy = new RentalPolicy();
        policy.setVersion(2);
        policy.setDepositMonthMultiplier(2);
        policy.setCancelFeePercent(30);
        policy.setCancelFreeHours(48);
        policy.setLateFeePercentPerDay(5);
        policy.setLateFeeMaxPercent(50);
        policy.setLiquidationDays(30);
        policy.setBookingDiscount3m(7);
        policy.setBookingDiscount6m(12);
        policy.setBookingDiscount12m(20);
        policy.setRenewalDiscount3m(2);
        policy.setRenewalDiscount6m(6);
        policy.setRenewalDiscount12m(11);
        when(policies.findByFacility_IdAndActiveTrue(1)).thenReturn(Optional.of(policy));

        Facility facility = new Facility();
        facility.setId(1);
        UnitType type = new UnitType();
        type.setBasePriceMonthly(new BigDecimal("750000"));
        StorageUnit unit = new StorageUnit();
        unit.setFacility(facility);
        unit.setUnitType(type);
        contract = new RentalContract();
        contract.setStorageUnit(unit);
        contract.setStatus("ACTIVE");
        contract.setEndDate(LocalDate.now().plusDays(10));
    }

    @Test
    @DisplayName("% ưu đãi đặt mới / gia hạn đọc từ chính sách; gói 1 tháng và gói lẻ luôn 0%")
    void discountsComeFromPolicy() {
        assertEquals(0, pricing.bookingDiscountPercent(policy, 1));
        assertEquals(7, pricing.bookingDiscountPercent(policy, 3));
        assertEquals(12, pricing.bookingDiscountPercent(policy, 6));
        assertEquals(20, pricing.bookingDiscountPercent(policy, 12));
        assertEquals(0, pricing.bookingDiscountPercent(policy, 4));
        assertEquals(11, pricing.renewalDiscountPercent(policy, 12));
    }

    @Test
    @DisplayName("Chưa có chính sách → bảng mặc định cũ 0/5/10/15 (đặt mới) và 0/0/5/10 (gia hạn)")
    void defaultsWithoutPolicy() {
        assertEquals(5, pricing.bookingDiscountPercent(null, 3));
        assertEquals(15, pricing.bookingDiscountPercent(null, 12));
        assertEquals(0, pricing.renewalDiscountPercent(null, 3));
        assertEquals(10, pricing.renewalDiscountPercent(null, 12));
        assertEquals(10, pricing.snapshotOrDefault(null, 6));
        assertEquals(3, pricing.snapshotOrDefault(3, 6));
    }

    @Test
    @DisplayName("Tiền thuê sau ưu đãi: 750.000 × 3 tháng − 5% = 2.137.500")
    void discountedRent() {
        assertEquals(0, new BigDecimal("2137500").compareTo(PricingService.discountedRent(new BigDecimal("750000"), 3, 5)));
        assertEquals(0, new BigDecimal("112500").compareTo(PricingService.discountAmount(new BigDecimal("750000"), 3, 5)));
    }

    @Test
    @DisplayName("API giá công khai trả đủ gói + cọc + quy định huỷ theo chính sách đang hiệu lực")
    void facilityPricing() {
        FacilityPricingResponse response = pricing.facilityPricing(1);
        assertEquals(2, response.policyVersion());
        assertEquals(2, response.depositMonthMultiplier());
        assertEquals(4, response.bookingPackages().size());
        assertEquals(20, response.bookingPackages().get(3).discountPercent());
        assertEquals(48, response.cancelFreeHours());
        assertEquals(0, new BigDecimal("100000").compareTo(response.welcomeVoucher()));
    }

    @Test
    @DisplayName("Báo giá gia hạn HĐ đang thuê: 750.000 × 6 − 6% = 4.230.000, không phí trễ")
    void quoteActiveContract() {
        RenewalQuoteResponse quote = pricing.quoteRenewal(contract, 6);
        assertEquals(6, quote.discountPercent());
        assertEquals(0, new BigDecimal("4230000").compareTo(quote.rentAmount()));
        assertEquals(0, BigDecimal.ZERO.compareTo(quote.lateFeeAmount()));
        assertEquals(0, new BigDecimal("4230000").compareTo(quote.totalAmount()));
        verify(lateFeeService, never()).calculateLateFee(any());
    }

    @Test
    @DisplayName("Báo giá gia hạn HĐ quá hạn: cộng phí trễ theo LateFeeService")
    void quoteOverdueContractAddsLateFee() {
        contract.setStatus("OVERDUE");
        when(lateFeeService.calculateLateFee(contract)).thenReturn(
                LateFeeCalculationResult.builder().lateFeeAmount(new BigDecimal("225000")).build());
        RenewalQuoteResponse quote = pricing.quoteRenewal(contract, 1);
        assertEquals(0, new BigDecimal("975000").compareTo(quote.totalAmount()));
        assertFalse(quote.lateFeeWaived());
    }

    @Test
    @DisplayName("HĐ quá hạn đã được FM miễn phí trễ → báo giá đánh dấu đã miễn")
    void quoteWaivedContract() {
        contract.setStatus("OVERDUE");
        contract.setLateFeeWaived(true);
        when(lateFeeService.calculateLateFee(contract)).thenReturn(
                LateFeeCalculationResult.builder().lateFeeAmount(BigDecimal.ZERO).lateFeeWaived(true).build());
        RenewalQuoteResponse quote = pricing.quoteRenewal(contract, 1);
        assertTrue(quote.lateFeeWaived());
        assertEquals(0, new BigDecimal("750000").compareTo(quote.totalAmount()));
    }
}
