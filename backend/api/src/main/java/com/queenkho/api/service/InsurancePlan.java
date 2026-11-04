package com.queenkho.api.service;

import java.math.BigDecimal;

/**
 * BR-125 (04/11/2026, góp ý giảng viên "có bảo hiểm không"): gói bảo hiểm hàng hoá khách chọn khi đặt kho.
 *  - BASIC    : miễn phí, cơ sở tự chịu, trần 20 triệu — không có bên bảo hiểm.
 *  - ADVANCED : 50.000đ / tháng, trần 200 triệu — có đối tác bảo hiểm (cơ sở chi trả trước rồi đòi lại).
 *  - PREMIUM  : 120.000đ / tháng, trần 500 triệu — có đối tác bảo hiểm.
 * Khách không khai báo giá trị hàng → trần chỉ 5 triệu (không có căn cứ giá trị).
 * 🔸 Mức phí / trần cố định trong code (chưa cho BOM chỉnh).
 */
public enum InsurancePlan {
    BASIC("Cơ bản", BigDecimal.ZERO, BigDecimal.valueOf(20_000_000L), false),
    ADVANCED("Nâng cao", BigDecimal.valueOf(50_000L), BigDecimal.valueOf(200_000_000L), true),
    PREMIUM("Cao cấp", BigDecimal.valueOf(120_000L), BigDecimal.valueOf(500_000_000L), true);

    public static final BigDecimal NO_DECLARATION_CAP = BigDecimal.valueOf(5_000_000L);
    public static final BigDecimal MAX_DECLARED_VALUE = BigDecimal.valueOf(10_000_000_000L);

    private final String label;
    private final BigDecimal monthlyPremium;
    private final BigDecimal coverageLimit;
    private final boolean insured;

    InsurancePlan(String label, BigDecimal monthlyPremium, BigDecimal coverageLimit, boolean insured) {
        this.label = label;
        this.monthlyPremium = monthlyPremium;
        this.coverageLimit = coverageLimit;
        this.insured = insured;
    }

    public String label() { return label; }
    public BigDecimal monthlyPremium() { return monthlyPremium; }
    public BigDecimal coverageLimit() { return coverageLimit; }
    /** Có đối tác bảo hiểm đứng sau (ADVANCED / PREMIUM) — bất khả kháng vẫn được bồi thường, cơ sở đòi lại bên bảo hiểm */
    public boolean insured() { return insured; }

    /** Đơn cũ / giá trị lạ → BASIC */
    public static InsurancePlan of(String code) {
        if (code == null) return BASIC;
        try {
            return valueOf(code.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return BASIC;
        }
    }

    /** Trần bồi thường hàng = min(giá trị khai báo, trần gói); không khai báo → min(5 triệu, trần gói) */
    public BigDecimal coverageCap(BigDecimal declaredValue) {
        if (declaredValue == null || declaredValue.signum() <= 0) {
            return NO_DECLARATION_CAP.min(coverageLimit);
        }
        return declaredValue.min(coverageLimit);
    }
}
