package com.queenkho.api.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.List;

// UC-23 & UC-24: nội dung biên bản nghiệm thu trả kho và danh sách sự cố hư hỏng (nếu có)
@Getter
@Setter
@NoArgsConstructor
public class CheckOutRequest {
    // 5 mục checklist
    private Boolean identityVerified;            // Bắt buộc đạt: đã xác minh CCCD
    private Boolean unitEmpty;                   // Bắt buộc đạt: ô kho trống hoàn toàn
    private Boolean unitClean;                   // Tình trạng: ô kho sạch sẽ (nếu false -> bắt buộc có damageCases)
    private Boolean lockIntact;                  // Tình trạng: khoá nguyên vẹn (nếu false -> bắt buộc có damageCases)
    private Boolean customerSignatureConfirmed;  // Bắt buộc đạt: khách đã ký biên bản nghiệm thu

    private String notes;

    // BR-121: ảnh hiện trạng ô lúc nghiệm thu (≥ 1, tối đa 10) — so với ảnh lúc nhận kho để biết lỗi do ai
    private List<String> evidenceImages;

    // UC-24: Danh sách sự cố hư hỏng phát sinh (rỗng nếu kho bình thường)
    private List<DamageItemRequest> damageCases;

    @Getter
    @Setter
    @NoArgsConstructor
    public static class DamageItemRequest {
        private String title;
        private String description;
        private BigDecimal estimatedCost;
        private String liableParty;          // Bắt buộc: CUSTOMER (lỗi khách, trừ cọc) / FACILITY (lỗi cơ sở)
        private List<String> evidenceImages; // Danh sách ảnh bằng chứng (URL hoặc base64 data URI)
    }
}
