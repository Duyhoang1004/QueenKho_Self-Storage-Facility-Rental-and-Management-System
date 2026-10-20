package com.queenkho.api.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

// UC-08: body của PUT /api/v1/admin/users/{id}. Không có email (không cho sửa — là tên đăng nhập).
// Với CUSTOMER: roleName / facilityId bị bỏ qua (chỉ sửa tên + SĐT).
@NoArgsConstructor
@AllArgsConstructor
@Getter
@Setter
public class UpdateUserRequest {
    private String fullName;
    private String phone;
    private String roleName;
    private Integer facilityId;
}
