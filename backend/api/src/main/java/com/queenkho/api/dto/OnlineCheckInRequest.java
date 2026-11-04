package com.queenkho.api.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

// BR-124: khách tự check-in online tại ô kho (không cần gặp Staff ở quầy)
@Getter
@Setter
@NoArgsConstructor
public class OnlineCheckInRequest {
    private String cccd;                       // khớp CCCD đã lưu lúc đặt kho (PR-B5) = xác minh danh tính
    private Boolean unitEmpty;                 // khách tự kiểm tra: ô trống
    private Boolean unitClean;                 // ô sạch
    private Boolean lockIntact;                // khoá / cửa nguyên vẹn
    private Boolean prohibitedGoodsCommitted;  // cam kết không lưu hàng cấm, chất nguy hiểm
    private List<String> evidenceImages;       // BR-121: ảnh hiện trạng ô lúc nhận (1–10)
    private String notes;
}
