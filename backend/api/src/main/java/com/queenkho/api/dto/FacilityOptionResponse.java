package com.queenkho.api.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

// UC-08: 1 lựa chọn trong dropdown cơ sở — kèm FM ACTIVE hiện tại để FE khoá cơ sở đã có quản lý
@NoArgsConstructor
@AllArgsConstructor
@Getter
@Setter
public class FacilityOptionResponse {
    private Integer id;
    private String code;
    private String name;
    private String status;          // ACTIVE / INACTIVE
    private Integer managerId;      // null = chưa có FM ACTIVE
    private String managerName;
}
