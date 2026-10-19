package com.queenkho.api.dto;

import lombok.*;

// UC-03: 1 vai trò + số người dùng (không tính tài khoản system)
@NoArgsConstructor
@AllArgsConstructor
@Getter
@Setter
public class RoleResponse {
    private Integer id;
    private String name;          // CUSTOMER, STAFF, FACILITY_MANAGER, BOM, ADMIN
    private String description;
    private long userCount;       // mọi trạng thái
    private long activeCount;     // chỉ ACTIVE
}
