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
}
