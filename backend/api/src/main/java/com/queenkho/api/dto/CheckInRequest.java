package com.queenkho.api.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

// UC-18: nội dung biên bản bàn giao khi Staff check-in cho khách
@Getter
@Setter
@NoArgsConstructor
public class CheckInRequest {
    // Checklist — cả 5 mục phải true
    private Boolean identityVerified;            // đã xác minh CCCD
    private Boolean unitEmpty;                   // ô kho trống
    private Boolean unitClean;                   // ô kho sạch
    private Boolean lockIntact;                  // khoá nguyên vẹn
    private Boolean customerSignatureConfirmed;  // khách đã ký biên bản
    // PR-C7 / BR-132 (05/11/2026): mục 6 — đã kiểm tra hàng mang vào khớp loại hàng khai báo, không có hàng cấm
    private Boolean goodsChecked;
    // Đã đối chiếu hàng thực tế với giá trị/chứng từ khách khai lúc đặt kho.
    private Boolean goodsValueVerified;
    // MATCHED = khớp khai báo; ADJUSTED = staff đề xuất giá trị khác để khách xác nhận trong CI_DRAFT.
    private String goodsValueAssessment;
    private BigDecimal assessedGoodsValue;
    private String goodsValueAssessmentNote;

    private String accessPinCode;  // 6 chữ số, lấy từ GET /staff-tasks/pin-suggestion
    private String rfidCardCode;   // mã in trên thẻ từ phát cho khách
    private String notes;

    // BR-121: ảnh hiện trạng ô lúc bàn giao (≥ 1, tối đa 10) — căn cứ khi có tranh chấp lúc trả kho
    private List<String> evidenceImages;

    // One photo for each of the five staff inspection items, keyed by checklist field.
    private Map<String, String> checklistEvidence;

    // Server sets this only while completing a customer-approved draft.
    private Integer approvalId;
}
