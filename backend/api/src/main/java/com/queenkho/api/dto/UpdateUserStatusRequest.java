package com.queenkho.api.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

// UC-08: body của PATCH /api/v1/admin/users/{id}/status
@NoArgsConstructor
@AllArgsConstructor
@Getter
@Setter
public class UpdateUserStatusRequest {
    private String status;          // ACTIVE (mở lại) / LOCKED / DISABLED
    private String reason;          // bắt buộc khi LOCKED/DISABLED, <= 255 ký tự, chỉ lưu trong log
}
