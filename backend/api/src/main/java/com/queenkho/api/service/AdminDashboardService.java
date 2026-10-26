package com.queenkho.api.service;

import com.queenkho.api.dto.AdminDashboardResponse;
import com.queenkho.api.dto.AdminDashboardResponse.FacilityItem;
import com.queenkho.api.dto.AdminDashboardResponse.RoleCount;
import com.queenkho.api.entity.User;
import com.queenkho.api.repository.ActivityLogRepository;
import com.queenkho.api.repository.FacilityRepository;
import com.queenkho.api.repository.RoleRepository;
import com.queenkho.api.repository.UserRepository;
import com.queenkho.api.repository.UserRepository.RoleStatusCount;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

// UC-31: Trang tổng quan /admin — chỉ đọc, dùng lại repo của UC-03 / UC-08 và log của UC-31
@Service
public class AdminDashboardService {

    private static final int RECENT_LOG_LIMIT = 10;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private FacilityRepository facilityRepository;

    @Autowired
    private ActivityLogRepository activityLogRepository;

    @Autowired
    private AdminActivityLogService adminActivityLogService;

    @Autowired
    private AdminGuard adminGuard;

    @Autowired
    private com.queenkho.api.repository.LoginHistoryRepository loginHistoryRepository;

    @Transactional(readOnly = true)
    public AdminDashboardResponse getDashboard(Integer actorUserId) {
        adminGuard.requireActiveAdmin(actorUserId);

        // 1 query GROUP BY (role, status) của UC-03 → tự cộng ra các con số
        List<RoleStatusCount> counts = userRepository.countGroupByRoleAndStatus(ActivityLogService.SYSTEM_EMAIL);
        long total = sum(counts, null, null);
        long active = sum(counts, null, "ACTIVE");
        long locked = sum(counts, null, "LOCKED");
        long disabled = sum(counts, null, "DISABLED");

        // Đủ 5 role theo id (role chưa có ai vẫn hiện số 0)
        List<RoleCount> roles = roleRepository.findAll(Sort.by("id")).stream()
                .map(r -> new RoleCount(r.getName(), sum(counts, r.getName(), null), sum(counts, r.getName(), "ACTIVE")))
                .toList();

        // PR-A4: cơ sở đang hoạt động mà chưa có FM ACTIVE
        Set<Integer> managedFacilityIds = userRepository.findByRole_NameAndStatus("FACILITY_MANAGER", "ACTIVE").stream()
                .map(User::getFacilityId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        List<FacilityItem> withoutManager = facilityRepository.findByStatus("ACTIVE").stream()
                .filter(f -> !managedFacilityIds.contains(f.getId()))
                .map(f -> new FacilityItem(f.getId(), f.getCode(), f.getName()))
                .toList();

        long logsToday = activityLogRepository.countByCreatedAtGreaterThanEqual(LocalDate.now().atStartOfDay());

        AdminDashboardResponse response = new AdminDashboardResponse(total, active, locked, disabled, roles, withoutManager,
                logsToday, adminActivityLogService.getRecentLogs(RECENT_LOG_LIMIT), 0, 0);
        // Lịch sử đăng nhập hôm nay (đăng nhập sai nhiều → dấu hiệu dò mật khẩu)
        response.setLoginsToday(loginHistoryRepository.countByEventTypeAndCreatedAtGreaterThanEqual(
                "LOGIN_SUCCESS", LocalDate.now().atStartOfDay()));
        response.setFailedLoginsToday(loginHistoryRepository.countByEventTypeAndCreatedAtGreaterThanEqual(
                "LOGIN_FAILED", LocalDate.now().atStartOfDay()));
        return response;
    }

    // Cộng số user theo role / status (null = không lọc theo tiêu chí đó)
    private long sum(List<RoleStatusCount> counts, String roleName, String status) {
        return counts.stream()
                .filter(c -> roleName == null || roleName.equals(c.getRoleName()))
                .filter(c -> status == null || status.equals(c.getStatus()))
                .mapToLong(RoleStatusCount::getTotal)
                .sum();
    }
}
