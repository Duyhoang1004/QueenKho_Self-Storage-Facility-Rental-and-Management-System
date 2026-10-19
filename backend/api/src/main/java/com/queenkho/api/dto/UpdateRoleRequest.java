package com.queenkho.api.dto;

import lombok.*;

// UC-03: body của PUT /api/v1/admin/roles/{id} — chỉ sửa được mô tả (PR-A1)
@NoArgsConstructor
@AllArgsConstructor
@Getter
@Setter
public class UpdateRoleRequest {
    private String description;
}
