package com.queenkho.api.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

// UC-31: số liệu trang tổng quan /admin (đều không tính tài khoản system)
@NoArgsConstructor
@AllArgsConstructor
@Getter
@Setter
public class AdminDashboardResponse {
    private long totalUsers;
    private long activeUsers;
    private long lockedUsers;
    private long disabledUsers;
    private List<RoleCount> roles;                         // đủ 5 role, kể cả role chưa có ai
    private List<FacilityItem> facilitiesWithoutManager;   // PR-A4: cơ sở ACTIVE chưa có FM ACTIVE
    private long logsToday;
    private List<ActivityLogResponse> recentLogs;          // 10 log mới nhất

    @NoArgsConstructor
    @AllArgsConstructor
    @Getter
    @Setter
    public static class RoleCount {
        private String role;
        private long total;
        private long active;
    }

    @NoArgsConstructor
    @AllArgsConstructor
    @Getter
    @Setter
    public static class FacilityItem {
        private Integer id;
        private String code;
        private String name;
    }
}
