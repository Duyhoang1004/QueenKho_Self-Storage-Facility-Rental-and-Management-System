package com.queenkho.api.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

// UC-08: 1 dòng trong bảng người dùng của Admin.
// Không có password — KHÔNG BAO GIỜ trả hash mật khẩu ra ngoài, dù đã mã hoá.
@NoArgsConstructor
@AllArgsConstructor
@Getter
@Setter
public class AdminUserResponse {
    private Integer id;
    private String fullName;
    private String email;
    private String phone;
    private String role;            // CUSTOMER, STAFF, FACILITY_MANAGER, BOM, ADMIN
    private String status;          // ACTIVE, LOCKED, DISABLED
    private Integer facilityId;     // null nếu không gắn cơ sở
    private String facilityCode;
    private String facilityName;
    private LocalDateTime createdAt;
}
