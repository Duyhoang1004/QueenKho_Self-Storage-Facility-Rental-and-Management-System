package com.queenkho.api.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

// UC-31: 1 dòng trong bảng nhật ký hoạt động (Admin)
@NoArgsConstructor
@AllArgsConstructor
@Getter
@Setter
public class ActivityLogResponse {
    private Integer id;
    private LocalDateTime createdAt;
    private Integer userId;
    private String userFullName;
    private String userEmail;
    private String userRole;          // CUSTOMER, STAFF, FACILITY_MANAGER, BOM, ADMIN
    private boolean systemAccount;    // true = job tự động (tài khoản system, PR-A8)
    private String actionCode;        // "CHECK_IN" tách từ "[CHECK_IN] ..."; null nếu log cũ chưa có mã
    private String content;           // nội dung đã bỏ phần [MÃ]
    private String targetEntity;      // users, reservations, rental_contracts...
    private String targetId;
}
