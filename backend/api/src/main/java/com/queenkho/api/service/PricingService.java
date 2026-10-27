package com.queenkho.api.service;

import com.queenkho.api.dto.FacilityPricingResponse;
import com.queenkho.api.dto.RenewalQuoteResponse;
import com.queenkho.api.entity.RentalContract;
import com.queenkho.api.entity.RentalPolicy;
import com.queenkho.api.repository.RentalPolicyRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;

/**
 * Flow 4 (D-08, PR-15): MỘT chỗ duy nhất tính tiền thuê theo gói từ chính sách BOM đặt ra.
 * Trước đây % ưu đãi viết cứng ở VnpayService, StaffTaskService, CreateReservationPage, ContractOptionsModal.
 *  - Đặt mới : % theo chính sách đang hiệu lực, CHỐT vào reservations.rent_discount_percent lúc tạo đơn.
 *  - Gia hạn : % theo chính sách đang hiệu lực lúc tạo link (gia hạn = mua kỳ mới).
 *  - Phí trễ : theo chính sách gắn hợp đồng (LateFeeService, PR-M5) — đã tính cả miễn phí trễ của FM.
 */
@Service
public class PricingService {

    public static final List<Integer> PACKAGES = List.of(1, 3, 6, 12);
    // Ưu đãi đặt kho online cố định (giữ nguyên như VNPAY đang thu)
    public static final BigDecimal WELCOME_VOUCHER = BigDecimal.valueOf(100_000);

    // Bảng mặc định khi cơ sở chưa có chính sách (giống giá trị DEFAULT trong SQL)
    private static final int[] DEFAULT_BOOKING = {0, 5, 10, 15};
    private static final int[] DEFAULT_RENEWAL = {0, 0, 5, 10};

    private final RentalPolicyRepository policies;
    private final LateFeeService lateFeeService;

    public PricingService(RentalPolicyRepository policies, LateFeeService lateFeeService) {
        this.policies = policies;
        this.lateFeeService = lateFeeService;
    }

    @Transactional(readOnly = true)
    public RentalPolicy activePolicy(Integer facilityId) {
        return facilityId == null ? null : policies.findByFacility_IdAndActiveTrue(facilityId).orElse(null);
    }

    // % ưu đãi gói đặt mới. Gói không chuẩn (2, 4, 5 tháng...) không có ưu đãi.
    public int bookingDiscountPercent(RentalPolicy policy, int months) {
        int index = PACKAGES.indexOf(months);
        if (index <= 0) {
            return 0;
        }
        if (policy == null) {
            return DEFAULT_BOOKING[index];
        }
        return switch (months) {
            case 3 -> policy.getBookingDiscount3m();
            case 6 -> policy.getBookingDiscount6m();
            default -> policy.getBookingDiscount12m();
        };
    }

    public int renewalDiscountPercent(RentalPolicy policy, int months) {
        int index = PACKAGES.indexOf(months);
        if (index <= 0) {
            return 0;
        }
        if (policy == null) {
            return DEFAULT_RENEWAL[index];
        }
        return switch (months) {
            case 3 -> policy.getRenewalDiscount3m();
            case 6 -> policy.getRenewalDiscount6m();
            default -> policy.getRenewalDiscount12m();
        };
    }

    // Đơn rất cũ chưa có snapshot → dùng bảng mặc định cũ (0/5/10/15)
    public int snapshotOrDefault(Integer snapshotPercent, int months) {
        return snapshotPercent != null ? snapshotPercent : bookingDiscountPercent(null, months);
    }

    public static BigDecimal discountAmount(BigDecimal monthlyPrice, int months, int percent) {
        return monthlyPrice.multiply(BigDecimal.valueOf(months))
                .multiply(BigDecimal.valueOf(percent))
                .divide(BigDecimal.valueOf(100), 0, RoundingMode.HALF_UP);
    }

    public static BigDecimal discountedRent(BigDecimal monthlyPrice, int months, int percent) {
        return monthlyPrice.multiply(BigDecimal.valueOf(months))
                .subtract(discountAmount(monthlyPrice, months, percent))
                .setScale(0, RoundingMode.HALF_UP);
    }

    // API công khai cho trang đặt kho / chi tiết hợp đồng
    @Transactional(readOnly = true)
    public FacilityPricingResponse facilityPricing(Integer facilityId) {
        RentalPolicy policy = activePolicy(facilityId);
        List<FacilityPricingResponse.PackageOption> booking = PACKAGES.stream()
                .map(m -> new FacilityPricingResponse.PackageOption(m, bookingDiscountPercent(policy, m))).toList();
        List<FacilityPricingResponse.PackageOption> renewal = PACKAGES.stream()
                .map(m -> new FacilityPricingResponse.PackageOption(m, renewalDiscountPercent(policy, m))).toList();
        if (policy == null) {
            return new FacilityPricingResponse(facilityId, null, 1, booking, renewal, WELCOME_VOUCHER,
                    24, 50, 10, 50, 30, true);
        }
        return new FacilityPricingResponse(facilityId, policy.getVersion(), policy.getDepositMonthMultiplier(),
                booking, renewal, WELCOME_VOUCHER, policy.getCancelFreeHours(), policy.getCancelFeePercent(),
                policy.getLateFeePercentPerDay(), policy.getLateFeeMaxPercent(), policy.getLiquidationDays(),
                policy.isAllowLateFeeWaiver());
    }

    /**
     * Flow 6: báo giá gia hạn — VnpayService.createRenewal dùng đúng hàm này để thu tiền.
     *  - OVERDUE            : + phí trễ theo chính sách gắn HĐ (0 nếu FM đã miễn) + phí chiếm dụng (PR-Q14).
     *  - TERMINATION_PENDING: + tiền thuê theo ngày cho ngày ân hạn 2 → 5 sau end_date (PR-O14).
     */
    @Transactional(readOnly = true)
    public RenewalQuoteResponse quoteRenewal(RentalContract contract, int months) {
        BigDecimal monthlyPrice = BigDecimal.ZERO;
        if (contract.getStorageUnit() != null && contract.getStorageUnit().getUnitType() != null
                && contract.getStorageUnit().getUnitType().getBasePriceMonthly() != null) {
            monthlyPrice = contract.getStorageUnit().getUnitType().getBasePriceMonthly();
        }
        Integer facilityId = contract.getStorageUnit() != null && contract.getStorageUnit().getFacility() != null
                ? contract.getStorageUnit().getFacility().getId() : null;
        int percent = renewalDiscountPercent(activePolicy(facilityId), months);

        BigDecimal subtotal = monthlyPrice.multiply(BigDecimal.valueOf(months)).setScale(0, RoundingMode.HALF_UP);
        BigDecimal discount = discountAmount(monthlyPrice, months, percent);
        BigDecimal rent = subtotal.subtract(discount);

        String status = contract.getStatus() != null ? contract.getStatus().toUpperCase() : "";
        BigDecimal lateFee = BigDecimal.ZERO;
        BigDecimal overstayFee = BigDecimal.ZERO;
        if ("OVERDUE".equals(status)) {
            var result = lateFeeService.calculateLateFee(contract);
            if (result != null && result.getLateFeeAmount() != null) {
                lateFee = result.getLateFeeAmount().setScale(0, RoundingMode.HALF_UP);
            }
            // PR-Q14: những ngày đã chiếm ô sau end_date không nằm trong kỳ mới → thu phí chiếm dụng cùng lần gia hạn
            if (result != null && result.getOverstayFeeAmount() != null) {
                overstayFee = result.getOverstayFeeAmount().setScale(0, RoundingMode.HALF_UP);
            }
        } else if ("TERMINATION_PENDING".equals(status) && contract.getEndDate() != null) {
            long daysPast = ChronoUnit.DAYS.between(contract.getEndDate(), LocalDate.now(LateFeeService.VIETNAM_ZONE));
            if (daysPast >= 2 && daysPast <= 5) {
                BigDecimal dailyRate = monthlyPrice.divide(BigDecimal.valueOf(30), 0, RoundingMode.HALF_UP);
                lateFee = dailyRate.multiply(BigDecimal.valueOf(daysPast - 1));
            }
        }
        boolean waived = Boolean.TRUE.equals(contract.getLateFeeWaived()) && "OVERDUE".equals(status);
        return new RenewalQuoteResponse(months, percent, monthlyPrice, subtotal, discount, rent, lateFee, waived,
                overstayFee, rent.add(lateFee).add(overstayFee).setScale(0, RoundingMode.HALF_UP));
    }
}
