package com.queenkho.api.service;

import com.queenkho.api.dto.PolicySummaryResponse;
import com.queenkho.api.dto.PolicySummaryResponse.Row;
import com.queenkho.api.dto.PolicySummaryResponse.Section;
import com.queenkho.api.entity.Facility;
import com.queenkho.api.entity.RentalContract;
import com.queenkho.api.entity.RentalPolicy;
import com.queenkho.api.entity.Reservation;
import com.queenkho.api.entity.UnitType;
import com.queenkho.api.exception.StaffTaskException;
import com.queenkho.api.repository.FacilityRepository;
import com.queenkho.api.repository.RentalContractRepository;
import com.queenkho.api.repository.RentalPolicyRepository;
import com.queenkho.api.repository.UnitTypeRepository;
import com.queenkho.api.security.CurrentUser;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * D-22 (20/11/2026): "Bảng phí & hoàn tiền" — chính sách hiện ra cho khách bằng SỐ TIỀN của chính đơn / hợp đồng,
 * theo vòng đời thuê: lúc đặt → huỷ trước khi nhận kho → trả sớm → trả đúng hạn → quá hạn → hoàn tiền.
 * Số tính bằng đúng công thức hệ thống thu / hoàn thật (PR-M6, D-08, BR-32, PR-O2, PR-O2a, PR-Q3, PR-Q14 → PR-Q16, PR-O25).
 * Đơn mới: chính sách đang hiệu lực của cơ sở. Hợp đồng: chính sách đã chốt lúc đặt (PR-M5).
 */
@Service
public class PolicySummaryService {

    private final PricingService pricingService;
    private final UnitTypeRepository unitTypeRepository;
    private final FacilityRepository facilityRepository;
    private final RentalContractRepository contractRepository;
    private final RentalPolicyRepository policyRepository;

    public PolicySummaryService(PricingService pricingService, UnitTypeRepository unitTypeRepository,
                                FacilityRepository facilityRepository, RentalContractRepository contractRepository,
                                RentalPolicyRepository policyRepository) {
        this.pricingService = pricingService;
        this.unitTypeRepository = unitTypeRepository;
        this.facilityRepository = facilityRepository;
        this.contractRepository = contractRepository;
        this.policyRepository = policyRepository;
    }

    /** Các con số đầu vào của bảng phí */
    record Basis(BigDecimal price, BigDecimal deposit, int depositMonths, int months, int discountPercent,
                 BigDecimal voucher, String insuranceLabel, BigDecimal insuranceMonthly, RentalPolicy policy) {
        BigDecimal rent() {
            return PricingService.discountedRent(price, months, discountPercent).subtract(voucher).max(BigDecimal.ZERO);
        }

        BigDecimal insurance() {
            return insuranceMonthly.multiply(BigDecimal.valueOf(months));
        }

        BigDecimal total() {
            return deposit.add(rent()).add(insurance());
        }
    }

    /** Đơn mới (trang đặt kho) — chính sách đang hiệu lực của cơ sở */
    @Transactional(readOnly = true)
    public PolicySummaryResponse forQuote(Integer facilityId, Integer unitTypeId, Integer months, String insurancePlan,
                                          BigDecimal voucherDiscount) {
        Facility facility = facilityRepository.findById(facilityId)
                .orElseThrow(() -> new StaffTaskException(HttpStatus.NOT_FOUND, "FACILITY_NOT_FOUND", "Không tìm thấy cơ sở"));
        UnitType unitType = unitTypeRepository.findById(unitTypeId)
                .orElseThrow(() -> new StaffTaskException(HttpStatus.NOT_FOUND, "UNIT_TYPE_NOT_FOUND", "Không tìm thấy loại kho"));
        int m = months != null && months > 0 ? months : 1;
        RentalPolicy policy = pricingService.activePolicy(facilityId);
        int depositMonths = policy != null && policy.getDepositMonthMultiplier() != null && policy.getDepositMonthMultiplier() > 0
                ? policy.getDepositMonthMultiplier() : 1;
        BigDecimal price = nz(unitType.getBasePriceMonthly());
        InsurancePlan plan = InsurancePlan.of(insurancePlan);
        BigDecimal voucher = voucherDiscount != null && voucherDiscount.signum() > 0 ? voucherDiscount : BigDecimal.ZERO;
        Basis b = new Basis(price, price.multiply(BigDecimal.valueOf(depositMonths)), depositMonths, m,
                pricingService.bookingDiscountPercent(policy, m), voucher, plan.label(), plan.monthlyPremium(), policy);
        return build(b, facility.getName(), unitType.getName(), ReservationService.ASSET_TERMS_VERSION, false, null);
    }

    /** Hợp đồng đã ký — chính sách đã chốt lúc đặt (PR-M5), số tiền theo đơn đã chốt */
    @Transactional(readOnly = true)
    public PolicySummaryResponse forContract(Integer contractId, CurrentUser actor) {
        RentalContract c = contractRepository.findDetailById(contractId)
                .orElseThrow(() -> new StaffTaskException(HttpStatus.NOT_FOUND, "CONTRACT_NOT_FOUND", "Không tìm thấy hợp đồng"));
        checkAccess(c, actor);
        Reservation r = c.getReservation();
        RentalPolicy policy = c.getRentalPolicyId() != null ? policyRepository.findById(c.getRentalPolicyId()).orElse(null) : null;
        if (policy == null && c.getStorageUnit() != null && c.getStorageUnit().getFacility() != null) {
            policy = pricingService.activePolicy(c.getStorageUnit().getFacility().getId());
        }
        BigDecimal price = PricingService.contractMonthlyPrice(c);
        int months = r != null && r.getDurationMonths() != null && r.getDurationMonths() > 0 ? r.getDurationMonths()
                : (c.getBillingCycleMonths() != null && c.getBillingCycleMonths() > 0 ? c.getBillingCycleMonths() : 1);
        BigDecimal deposit = r != null && r.getDepositAmount() != null && r.getDepositAmount().signum() > 0
                ? r.getDepositAmount() : nz(c.getDepositHeldAmount());
        int depositMonths = price.signum() > 0 ? deposit.divide(price, 0, RoundingMode.HALF_UP).intValue() : 1;
        int discount = r != null ? pricingService.snapshotOrDefault(r.getRentDiscountPercent(), months) : 0;
        BigDecimal voucher = r != null && r.getVoucherDiscount() != null ? r.getVoucherDiscount() : BigDecimal.ZERO;
        InsurancePlan plan = InsurancePlan.of(r != null ? r.getInsurancePlan() : null);
        BigDecimal insuranceMonthly = PricingService.insurancePremiumMonthly(c);
        Basis b = new Basis(price, deposit, Math.max(1, depositMonths), months, discount, voucher, plan.label(),
                insuranceMonthly, policy);
        String facilityName = c.getStorageUnit() != null && c.getStorageUnit().getFacility() != null
                ? c.getStorageUnit().getFacility().getName() : null;
        String unitTypeName = r != null && r.getUnitType() != null ? r.getUnitType().getName() : null;
        return build(b, facilityName, unitTypeName, r != null ? r.getTermsVersion() : null, true,
                r != null ? r.getCreatedAt() : null);
    }

    private PolicySummaryResponse build(Basis b, String facilityName, String unitTypeName, String termsVersion,
                                        boolean forContract, LocalDateTime frozenAt) {
        List<Section> sections = new ArrayList<>();
        sections.add(bookingSection(b, forContract));
        if (!forContract) sections.add(cancelSection(b));
        sections.add(earlySection(b));
        sections.add(onTimeSection(b));
        sections.add(overdueSection(b, termsVersion));
        sections.add(refundSection());
        return PolicySummaryResponse.builder()
                .termsVersion(termsVersion)
                .policyVersion(b.policy() != null ? b.policy().getVersion() : null)
                .policyFrozenAt(frozenAt)
                .facilityName(facilityName)
                .unitTypeName(unitTypeName)
                .monthlyPrice(money(b.price()))
                .months(b.months())
                .forContract(forContract)
                .sections(sections)
                .build();
    }

    // ① Lúc đặt
    private Section bookingSection(Basis b, boolean forContract) {
        List<Row> rows = new ArrayList<>();
        rows.add(row("Tiền cọc", b.deposit(), b.depositMonths() + " tháng giá niêm yết · hoàn lại khi trả kho", null));
        String rentNote = b.months() + " tháng × " + vnd(b.price())
                + (b.discountPercent() > 0 ? " · giảm " + b.discountPercent() + "%" : "")
                + (b.voucher().signum() > 0 ? " · voucher −" + vnd(b.voucher()) : "");
        rows.add(row("Tiền thuê " + b.months() + " tháng", b.rent(), rentNote, null));
        if (b.insurance().signum() > 0) {
            rows.add(row("Bảo hiểm hàng hoá " + b.insuranceLabel(), b.insurance(), vnd(b.insuranceMonthly()) + "/tháng", null));
        }
        rows.add(total(forContract ? "Bạn đã trả" : "Bạn trả khi đặt", b.total(), null));
        return section("BOOKING", forContract ? "① Lúc đặt kho" : "① Lúc đặt", null, rows);
    }

    // ② Huỷ trước khi nhận kho (BR-32, BR-32a) — cùng CancellationPolicyService
    private Section cancelSection(Basis b) {
        BigDecimal paid = b.total();
        BigDecimal half = percent(b.deposit(), CancellationPolicyService.PARTIAL_DEPOSIT_PENALTY_PERCENT);
        BigDecimal full = b.deposit();
        BigDecimal monthRent = paid.subtract(b.deposit()).max(BigDecimal.ZERO)
                .divide(BigDecimal.valueOf(Math.max(1, b.months())), 0, RoundingMode.HALF_UP);
        BigDecimal after = b.deposit().add(monthRent).min(paid);
        List<Row> rows = new ArrayList<>();
        rows.add(row("Trong 30 phút sau khi thanh toán", paid, "Hoàn toàn bộ (vẫn trước giờ hẹn)", "REFUND"));
        rows.add(row("Còn từ 48 giờ trở lên", paid, "Hoàn toàn bộ", "REFUND"));
        rows.add(row("Còn 24 – dưới 48 giờ", paid.subtract(half), "Giữ 50% cọc (" + vnd(half) + ")", "REFUND"));
        rows.add(row("Còn dưới 24 giờ", paid.subtract(full).max(BigDecimal.ZERO), "Giữ 100% cọc (" + vnd(full) + ")", "REFUND"));
        rows.add(row("Đã qua giờ hẹn mà chưa nhận kho", paid.subtract(after).max(BigDecimal.ZERO),
                "Giữ cọc + 1 tháng tiền thuê (" + vnd(after) + ")", "REFUND"));
        rows.add(row("Cơ sở không bàn giao được ô đúng hẹn", paid, "Hoàn toàn bộ", "REFUND"));
        return section("CANCEL", "② Huỷ trước khi nhận kho", "Số tiền bạn được hoàn lại", rows);
    }

    // ③ Đang thuê mà trả sớm (PR-O2, PR-O2a, BR-125) — cùng công thức StaffTaskService.earlyReturn
    private Section earlySection(Basis b) {
        List<Row> rows = new ArrayList<>();
        BigDecimal rentNet = b.rent();
        if (b.months() <= 1) {
            rows.add(row("Gói 1 tháng", b.deposit(), "Trả trước hạn chỉ hoàn cọc, không hoàn tiền thuê", "REFUND"));
        } else {
            for (int used : sampleMonths(b.months())) {
                BigDecimal rentRefund = rentNet.subtract(b.price().multiply(BigDecimal.valueOf(used))).subtract(b.price())
                        .max(BigDecimal.ZERO);
                rows.add(row("Trả sau " + used + " tháng", b.deposit().add(rentRefund),
                        "Cọc " + vnd(b.deposit()) + " + tiền thuê " + vnd(rentRefund), "REFUND"));
            }
            rows.add(row("Trả trong tháng cuối của kỳ", b.deposit(), "Chỉ hoàn cọc · không phí phá hợp đồng (PR-O2a)", "REFUND"));
        }
        rows.add(row("Cách tính tiền thuê được hoàn", null,
                "Tiền thuê đã đóng − số tháng đã dùng × giá niêm yết (thu hồi ưu đãi) − phí phá hợp đồng " + vnd(b.price())
                        + " (1 tháng). Tối thiểu 0, phần thiếu không trừ vào cọc.", null));
        if (b.insurance().signum() > 0) {
            rows.add(row("Phí bảo hiểm", null, "Không hoàn khi bạn tự trả sớm (BR-125)", null));
        }
        return section("EARLY", "③ Đang thuê mà trả sớm", "Số tiền bạn được hoàn lại (ví dụ)", rows);
    }

    // ④ Trả đúng hạn
    private Section onTimeSection(Basis b) {
        List<Row> rows = new ArrayList<>();
        rows.add(row("Hoàn cọc", b.deposit(), "Trừ phí sự cố do bạn gây ra (nếu có)", "REFUND"));
        rows.add(row("Phí sự cố", null, "Xác định bằng cách đối chiếu ảnh biên bản lúc nhận và lúc trả kho", null));
        return section("ON_TIME", "④ Trả kho đúng hạn", null, rows);
    }

    // ⑤ Quá hạn (PR-Q3, PR-Q14, PR-Q15, PR-Q16, D-20)
    private Section overdueSection(Basis b, String termsVersion) {
        RentalPolicy p = b.policy();
        BigDecimal ratePct = p != null && p.getLateFeePercentPerDay() != null ? BigDecimal.valueOf(p.getLateFeePercentPerDay())
                : LateFeeService.RATE_PER_DAY.multiply(BigDecimal.valueOf(100));
        BigDecimal maxPct = p != null && p.getLateFeeMaxPercent() != null ? BigDecimal.valueOf(p.getLateFeeMaxPercent())
                : LateFeeService.MAX_PERCENT.multiply(BigDecimal.valueOf(100));
        int overstayPct = p != null && p.getOverstayPercent() != null ? p.getOverstayPercent() : LateFeeService.DEFAULT_OVERSTAY_PERCENT;
        int movingPct = p != null && p.getGoodsMovingFeePercent() != null ? p.getGoodsMovingFeePercent()
                : LateFeeService.DEFAULT_GOODS_MOVING_FEE_PERCENT;
        int heldPct = p != null && p.getHeldGoodsFeePercent() != null ? p.getHeldGoodsFeePercent()
                : LateFeeService.DEFAULT_HELD_GOODS_FEE_PERCENT;

        BigDecimal latePerDay = percent(b.deposit(), ratePct);
        BigDecimal lateCap = percent(b.deposit(), maxPct);
        BigDecimal overstayPerDay = percent(LateFeeService.dailyRate(b.price()), BigDecimal.valueOf(overstayPct));
        BigDecimal moving = percent(b.price(), BigDecimal.valueOf(movingPct));
        BigDecimal storagePerDay = percent(LateFeeService.dailyRate(b.price()), BigDecimal.valueOf(heldPct));
        // Mốc tự cưỡng chế theo điều khoản đã ký: v5+ sau 5 ngày; v4 ngay ngày đầu; cũ hơn theo liquidation_days của chính sách
        int liquidationDays = termsVersion == null || LateFeeService.acceptsV5Terms(termsVersion) ? LateFeeService.V5_LIQUIDATION_DAYS
                : LateFeeService.isImmediateV4LiquidationTerms(termsVersion) ? 1
                : (p != null && p.getLiquidationDays() != null ? p.getLiquidationDays() : LateFeeService.DEFAULT_LIQUIDATION_DAYS);

        List<Row> rows = new ArrayList<>();
        rows.add(row("Phí trễ hạn", latePerDay, ratePct.stripTrailingZeros().toPlainString() + "% cọc / ngày · tối đa "
                + vnd(lateCap) + " (" + maxPct.stripTrailingZeros().toPlainString() + "% cọc)", "KEEP"));
        rows.add(row("Phí chiếm dụng ô", overstayPerDay,
                overstayPct + "% giá thuê ngày · mỗi ngày quá hạn, không giới hạn\n(Phí thuê ngày là tiền thuê kho 1 tháng / 30)", "KEEP"));
        if (liquidationDays > 3) {
            BigDecimal fees3 = latePerDay.multiply(BigDecimal.valueOf(3)).min(lateCap).add(overstayPerDay.multiply(BigDecimal.valueOf(3)));
            rows.add(row("Ví dụ quá hạn 3 ngày", fees3,
                    b.deposit().compareTo(fees3) >= 0 ? "Trừ vào cọc, cọc còn hoàn " + vnd(b.deposit().subtract(fees3))
                            : "Vượt cọc " + vnd(fees3.subtract(b.deposit())) + " — là khoản nợ", "KEEP"));
        }
        BigDecimal feesLiq = latePerDay.multiply(BigDecimal.valueOf(liquidationDays)).min(lateCap)
                .add(overstayPerDay.multiply(BigDecimal.valueOf(liquidationDays))).add(moving);
        rows.add(row("Quá hạn " + liquidationDays + " ngày: cưỡng chế dọn kho", feesLiq,
                "Phí trễ + chiếm dụng " + liquidationDays + " ngày + phí dọn & di dời " + vnd(moving) + " (" + movingPct + "% giá tháng)"
                        + (feesLiq.compareTo(b.deposit()) > 0 ? " · vượt cọc " + vnd(feesLiq.subtract(b.deposit())) + " là khoản nợ" : ""),
                "KEEP"));
        rows.add(row("Phí lưu giữ hàng ở kho tổng", storagePerDay, heldPct + "% giá thuê ngày · tới khi bạn nhận lại hàng, QueenKho không bán hàng", "KEEP"));
        if (termsVersion != null && !LateFeeService.acceptsV5Terms(termsVersion)) {
            rows.add(row("Lưu ý", null, "Hợp đồng theo điều khoản " + termsVersion + " đã ký: mốc cưỡng chế dọn kho là "
                    + liquidationDays + " ngày quá hạn", null));
        }
        return section("OVERDUE", "⑤ Quá hạn mà không trả kho", "Khoá mã ra vào từ ngày đầu quá hạn", rows);
    }

    // ⑥ Hoàn tiền (PR-93, PR-O25 → PR-O27)
    private Section refundSection() {
        List<Row> rows = new ArrayList<>();
        rows.add(row("Thời hạn", null, "Trong 24 giờ làm việc (không tính Chủ Nhật) sau khi đủ điều kiện hoàn", null));
        rows.add(row("Chuyển khoản", null, "Bạn bấm \"Đã nhận được\" hoặc \"Chưa nhận được\" trong mục Thanh toán; không phản hồi sau "
                + RefundReceiptService.AUTO_CONFIRM_DAYS + " ngày coi như đã nhận", null));
        rows.add(row("Tiền mặt tại quầy", null, "Bạn ký phiếu chi khi nhận tiền", null));
        return section("REFUND", "⑥ Nhận tiền hoàn", null, rows);
    }

    /** Mốc ví dụ trả sớm: gói ≤ 4 tháng → mọi tháng; dài hơn → 1, 2, giữa kỳ, tháng áp chót */
    static List<Integer> sampleMonths(int months) {
        Set<Integer> s = new LinkedHashSet<>();
        if (months <= 4) {
            for (int i = 1; i < months; i++) s.add(i);
        } else {
            s.add(1);
            s.add(2);
            s.add(months / 2);
            s.add(months - 1);
        }
        return new ArrayList<>(s);
    }

    private void checkAccess(RentalContract c, CurrentUser actor) {
        Integer facilityId = c.getStorageUnit() != null && c.getStorageUnit().getFacility() != null
                ? c.getStorageUnit().getFacility().getId() : null;
        boolean ok = switch (actor.role()) {
            case "CUSTOMER" -> Objects.equals(c.getCustomer().getId(), actor.id());
            case "STAFF", "FACILITY_MANAGER" -> Objects.equals(facilityId, actor.facilityId());
            case "BOM", "ADMIN" -> true;
            default -> false;
        };
        if (!ok) {
            throw new StaffTaskException(HttpStatus.FORBIDDEN, "FORBIDDEN_CONTRACT", "Bạn không có quyền xem hợp đồng này");
        }
    }

    private static Section section(String key, String title, String subtitle, List<Row> rows) {
        return Section.builder().key(key).title(title).subtitle(subtitle).rows(rows).build();
    }

    private static Row row(String label, BigDecimal amount, String note, String tone) {
        return Row.builder().label(label).amount(amount != null ? money(amount) : null).note(note).tone(tone).build();
    }

    private static Row total(String label, BigDecimal amount, String note) {
        return Row.builder().label(label).amount(money(amount)).note(note).total(true).build();
    }

    private static BigDecimal percent(BigDecimal value, int pct) {
        return percent(value, BigDecimal.valueOf(pct));
    }

    private static BigDecimal percent(BigDecimal value, BigDecimal pct) {
        return nz(value).multiply(pct).divide(BigDecimal.valueOf(100), 0, RoundingMode.HALF_UP);
    }

    private static BigDecimal nz(BigDecimal v) {
        return v != null ? v : BigDecimal.ZERO;
    }

    private static BigDecimal money(BigDecimal v) {
        return nz(v).setScale(0, RoundingMode.HALF_UP);
    }

    private static String vnd(BigDecimal v) {
        return String.format("%,d", money(v).longValue()).replace(',', '.') + "đ";
    }
}
