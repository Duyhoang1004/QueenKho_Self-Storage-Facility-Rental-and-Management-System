package com.queenkho.api.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

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

    private String accessPinCode;  // 6 chữ số, lấy từ GET /staff-tasks/pin-suggestion
    private String rfidCardCode;   // mã in trên thẻ từ phát cho khách
    private String notes;
}
