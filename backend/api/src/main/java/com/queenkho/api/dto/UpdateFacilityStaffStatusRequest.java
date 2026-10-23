package com.queenkho.api.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

// UC-32: Body cho cập nhật trạng thái nhân viên (PATCH /api/v1/manager/staff/{id}/status)
@NoArgsConstructor
@AllArgsConstructor
@Getter
@Setter
public class UpdateFacilityStaffStatusRequest {
    private String status;  // ACTIVE (Mở khóa) / LOCKED (Tạm khóa)
    private String reason;  // Lý do (lưu vào log)
}

