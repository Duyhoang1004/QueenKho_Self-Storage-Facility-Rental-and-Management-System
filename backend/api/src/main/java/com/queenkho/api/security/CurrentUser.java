package com.queenkho.api.security;

// PR-90: người đang đăng nhập, lấy từ token (không tin id client gửi lên).
// AccessControlFilter đặt vào request attribute; controller / service đọc qua CurrentUserProvider.
public record CurrentUser(Integer id, String role, Integer facilityId, String fullName, String email) {

    public static final String REQUEST_ATTRIBUTE = "queenkho.currentUser";

    public boolean hasRole(String roleName) {
        return roleName.equals(role);
    }

    // STAFF và FACILITY_MANAGER chỉ làm việc trong cơ sở được gán
    public boolean isFacilityScoped() {
        return "STAFF".equals(role) || "FACILITY_MANAGER".equals(role);
    }
}
