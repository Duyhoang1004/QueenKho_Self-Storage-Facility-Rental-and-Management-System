package com.queenkho.api.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ResolveSupportTaskRequest {
    private String resolutionNote;

    // BR-126: ticket hàng hư / mất → task hỗ trợ là việc kiểm tra hiện trường, bắt buộc ảnh + nguyên nhân sơ bộ
    private java.util.List<String> inspectionImages;
    private String preliminaryCause; // CUSTOMER / FACILITY / FORCE_MAJEURE / UNKNOWN

    public ResolveSupportTaskRequest(String resolutionNote) {
        this.resolutionNote = resolutionNote;
    }
}
