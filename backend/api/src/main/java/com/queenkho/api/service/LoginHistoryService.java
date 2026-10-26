package com.queenkho.api.service;

import com.queenkho.api.dto.LoginHistoryResponse;
import com.queenkho.api.dto.PageResponse;
import com.queenkho.api.entity.LoginHistory;
import com.queenkho.api.exception.AdminException;
import com.queenkho.api.repository.LoginHistoryRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

/**
 * Admin: lịch sử đăng nhập / đăng xuất.
 *  - Ghi bằng JdbcTemplate và NUỐT lỗi: ghi lịch sử hỏng không được chặn người dùng đăng nhập.
 *  - Không lưu mật khẩu; chỉ email gõ vào, kết quả, IP, trình duyệt.
 */
@Service
public class LoginHistoryService {

    public static final Set<String> EVENT_TYPES = Set.of("LOGIN_SUCCESS", "LOGIN_FAILED", "LOGOUT");
    private static final int DEFAULT_PAGE_SIZE = 20;
    private static final int MAX_PAGE_SIZE = 100;
    private static final LocalDateTime MIN_TIME = LocalDateTime.of(2000, 1, 1, 0, 0);
    private static final LocalDateTime MAX_TIME = LocalDateTime.of(9999, 1, 1, 0, 0);

    private final JdbcTemplate jdbcTemplate;
    private final LoginHistoryRepository repository;
    private final AdminGuard adminGuard;

    public LoginHistoryService(JdbcTemplate jdbcTemplate, LoginHistoryRepository repository, AdminGuard adminGuard) {
        this.jdbcTemplate = jdbcTemplate;
        this.repository = repository;
        this.adminGuard = adminGuard;
    }

    public void recordSuccess(Integer userId, String email, HttpServletRequest request) {
        record(userId, email, "LOGIN_SUCCESS", null, request);
    }

    // user_id lấy theo email (null nếu email không tồn tại)
    public void recordFailure(String email, String reason, HttpServletRequest request) {
        Integer userId = null;
        try {
            List<Integer> ids = jdbcTemplate.query("SELECT id FROM users WHERE email = ?", (rs, i) -> rs.getInt(1), email);
            userId = ids.isEmpty() ? null : ids.get(0);
        } catch (Exception ignored) {
        }
        record(userId, email, "LOGIN_FAILED", reason, request);
    }

    public void recordLogout(Integer userId, HttpServletRequest request) {
        try {
            String email = jdbcTemplate.queryForObject("SELECT email FROM users WHERE id = ?", String.class, userId);
            record(userId, email, "LOGOUT", null, request);
        } catch (Exception ignored) {
        }
    }

    private void record(Integer userId, String email, String eventType, String reason, HttpServletRequest request) {
        try {
            jdbcTemplate.update(
                    "INSERT INTO login_history (user_id, email, event_type, failure_reason, ip_address, user_agent) " +
                            "VALUES (?, ?, ?, ?, ?, ?)",
                    userId,
                    truncate(email == null || email.isBlank() ? "(trống)" : email.trim(), 255),
                    eventType,
                    reason,
                    truncate(clientIp(request), 64),
                    truncate(request != null ? request.getHeader("User-Agent") : null, 300));
        } catch (Exception e) {
            System.err.println("[LoginHistory] Không ghi được lịch sử đăng nhập: " + e.getMessage());
        }
    }

    @Transactional(readOnly = true)
    public PageResponse<LoginHistoryResponse> search(Integer actorUserId, String keyword, String eventType,
                                                     LocalDate fromDate, LocalDate toDate, int page, int size) {
        adminGuard.requireActiveAdmin(actorUserId);
        String type = eventType == null || eventType.isBlank() ? null : eventType.trim().toUpperCase();
        if (type != null && !EVENT_TYPES.contains(type)) {
            throw new AdminException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Loại sự kiện không hợp lệ: " + eventType);
        }
        if (fromDate != null && toDate != null && fromDate.isAfter(toDate)) {
            throw new AdminException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Từ ngày phải trước hoặc bằng đến ngày");
        }
        LocalDateTime from = fromDate == null ? MIN_TIME : fromDate.atStartOfDay();
        LocalDateTime to = toDate == null ? MAX_TIME : toDate.plusDays(1).atStartOfDay();
        int safePage = Math.max(page, 0);
        int safeSize = (size < 1 || size > MAX_PAGE_SIZE) ? DEFAULT_PAGE_SIZE : size;
        Page<LoginHistory> result = repository.search(from, to, type, escapeLike(keyword),
                PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.DESC, "createdAt").and(Sort.by(Sort.Direction.DESC, "id"))));
        List<LoginHistoryResponse> content = result.getContent().stream().map(LoginHistoryService::toResponse).toList();
        return new PageResponse<>(content, result.getNumber(), result.getSize(), result.getTotalElements(), result.getTotalPages());
    }

    private static LoginHistoryResponse toResponse(LoginHistory h) {
        return new LoginHistoryResponse(
                h.getId(),
                h.getUser() != null ? h.getUser().getId() : null,
                h.getEmail(),
                h.getUser() != null ? h.getUser().getFullName() : null,
                h.getUser() != null && h.getUser().getRole() != null ? h.getUser().getRole().getName() : null,
                h.getEventType(),
                h.getFailureReason(),
                h.getIpAddress(),
                h.getUserAgent(),
                h.getCreatedAt());
    }

    // IP thật của trình duyệt (qua proxy thì lấy IP đầu trong X-Forwarded-For)
    static String clientIp(HttpServletRequest request) {
        if (request == null) {
            return null;
        }
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private static String truncate(String value, int max) {
        return value == null || value.length() <= max ? value : value.substring(0, max);
    }

    // '[', '%', '_' là ký tự đặc biệt của LIKE trên SQL Server → escape bằng '\'
    private static String escapeLike(String keyword) {
        if (keyword == null || keyword.isBlank()) {
            return null;
        }
        return keyword.trim().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_").replace("[", "\\[");
    }
}
