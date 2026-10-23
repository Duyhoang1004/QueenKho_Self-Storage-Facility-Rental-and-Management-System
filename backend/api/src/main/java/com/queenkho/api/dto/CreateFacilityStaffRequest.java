package com.queenkho.api.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

// UC-32: Body cho tạo mới nhân viên tại cơ sở (POST /api/v1/manager/staff)
@NoArgsConstructor
@AllArgsConstructor
@Getter
@Setter
public class CreateFacilityStaffRequest {
    private String fullName;
    private String email;
    private String phone;
    private String password;
}

