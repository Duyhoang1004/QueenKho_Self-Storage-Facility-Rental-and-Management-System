package com.queenkho.api.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreateSupportRequestDto {
    private Integer contractId;
    private String issueType;   // LOCK_ISSUE, SECURITY, FACILITY_DAMAGE, CLEANING, OTHER, GOODS_DAMAGE, GOODS_LOSS
    private String description; // 10 - 1000 chars

    // BR-126: chỉ dùng cho GOODS_DAMAGE / GOODS_LOSS (hồ sơ bồi thường)
    private java.time.LocalDate incidentDate;
    private String itemsDescription;            // danh sách hàng + giá trị, 10–2000 ký tự
    private java.math.BigDecimal claimedAmount; // số tiền khách đề nghị bồi thường
    private java.util.List<String> evidenceImages; // ảnh hàng hư / hoá đơn (hàng hư bắt buộc ≥ 1)
}
