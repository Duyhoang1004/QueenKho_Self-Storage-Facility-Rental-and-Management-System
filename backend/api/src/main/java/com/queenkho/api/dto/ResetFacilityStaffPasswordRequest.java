package com.queenkho.api.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

// UC-32: Body cho đặt lại mật khẩu nhân viên (PUT /api/v1/manager/staff/{id}/password)
@NoArgsConstructor
@AllArgsConstructor
@Getter
@Setter
public class ResetFacilityStaffPasswordRequest {
    private String newPassword;
}

