package com.queenkho.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserProfileResponse {
    private Integer userId;
    private String email;
    private String fullName;
    private String phone;
    private String cccd;
    private String role;
    private Integer facilityId;
    private String facilityName;
    private String status;
    private LocalDateTime createdAt;
}
