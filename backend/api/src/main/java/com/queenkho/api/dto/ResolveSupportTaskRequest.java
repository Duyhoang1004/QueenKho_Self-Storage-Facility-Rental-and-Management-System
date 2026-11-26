package com.queenkho.api.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ResolveSupportTaskRequest {
    private String resolutionNote;

    // Ảnh bằng chứng xử lý (sau khi dọn dẹp, sau khi sửa xong, biên bản kiểm tra...)
    private java.util.List<String> inspectionImages;

    // BR-126: ticket hàng hư / mất → nguyên nhân sơ bộ & giá trị hàng/thiệt hại Staff ước tính
    private String preliminaryCause; // CUSTOMER / FACILITY / FORCE_MAJEURE / UNKNOWN
    private BigDecimal staffAssessedValue;

    // Các trường xử lý chuyên biệt theo từng luồng
    private String actionTaken;        // Hành động đã thực hiện (FIXED_ON_SITE, PIN_RESET, CLEANED, PATROLLED...)
    private String securityLockStatus; // INTACT / TAMPERED (cho luồng an ninh)
    private String repairStatus;       // FIXED / ESCALATED_MAINTENANCE (cho luồng hạ tầng)

    public ResolveSupportTaskRequest(String resolutionNote) {
        this.resolutionNote = resolutionNote;
    }
}
