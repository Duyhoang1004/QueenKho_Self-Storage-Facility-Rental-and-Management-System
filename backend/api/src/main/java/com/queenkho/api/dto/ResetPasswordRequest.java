package com.queenkho.api.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

// UC-08 / PR-A6: body của PUT /api/v1/admin/users/{id}/password
@NoArgsConstructor
@AllArgsConstructor
@Getter
@Setter
public class ResetPasswordRequest {
    private String newPassword;
}
