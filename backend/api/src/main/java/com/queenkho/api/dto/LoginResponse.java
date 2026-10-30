package com.queenkho.api.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class LoginResponse {
    private String token;
    private String role;
    private Integer userId;
    private String fullName;
    // UC-16: cơ sở của Staff/Facility Manager (null với Customer)
    private Integer facilityId;
    private String facilityName;
    private String phone;
    private String cccd;

    public LoginResponse(String token, String role, Integer userId, String fullName, Integer facilityId, String facilityName) {
        this(token, role, userId, fullName, facilityId, facilityName, null, null);
    }
}
