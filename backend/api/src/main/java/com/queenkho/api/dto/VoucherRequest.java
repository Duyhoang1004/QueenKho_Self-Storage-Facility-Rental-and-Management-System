package com.queenkho.api.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

// BR-25: BOM tạo / sửa voucher đặt kho
@Getter
@Setter
@NoArgsConstructor
public class VoucherRequest {
    private String code;               // 3–30 ký tự A-Z, 0-9 (tự viết HOA)
    private String name;
    private String discountType;       // FIXED / PERCENT
    private BigDecimal discountValue;  // số tiền (FIXED) hoặc % tiền thuê (PERCENT, 1–100)
    private BigDecimal maxDiscount;    // chỉ cho PERCENT, bỏ trống = không trần
    private Integer minMonths;         // 1 / 3 / 6 / 12
    private Integer facilityId;        // bỏ trống = mọi cơ sở
    private LocalDateTime startAt;
    private LocalDateTime endAt;       // bỏ trống = không hết hạn
    private Integer usageLimit;        // bỏ trống = không giới hạn
    private Integer perUserLimit;      // bỏ trống = không giới hạn
    private Boolean isDefault;         // true = tự áp khi khách không nhập mã (chỉ 1 mã mặc định)
}
