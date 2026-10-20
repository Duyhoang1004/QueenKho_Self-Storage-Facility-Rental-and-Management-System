package com.queenkho.api.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

// UC-08: body của POST /api/v1/admin/users
@NoArgsConstructor
@AllArgsConstructor
@Getter
@Setter
public class CreateUserRequest {
    private String fullName;
    private String email;
    private String phone;
    private String roleName;        // STAFF, FACILITY_MANAGER, BOM, ADMIN (PR-03)
    private Integer facilityId;     // bắt buộc với STAFF/FM, bỏ qua với BOM/ADMIN (PR-04)
    private String password;        // mật khẩu ban đầu, >= 6 ký tự
}
