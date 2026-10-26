package com.queenkho.api.security;

import com.queenkho.api.config.CorsConfig;
import com.queenkho.api.service.SessionTokenService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * PR-90: cổng kiểm soát MỌI request vào /api/**. 3 bước:
 *  1. Tìm luật của API trong AccessPolicy (API chưa khai báo → 403).
 *  2. API cần đăng nhập → đọc token → người dùng ACTIVE (thiếu / sai token → 401).
 *  3. Vai trò không có trong nhóm quyền → 403. Hợp lệ → ghi đè id người thao tác + cơ sở theo token
 *     (IdentityRequestWrapper) rồi cho đi tiếp. Controller / service cũ vẫn nhận customerId, staffId... như trước.
 */
public class AccessControlFilter extends OncePerRequestFilter {

    private final AccessPolicy policy;
    private final SessionTokenService sessions;
    private final JdbcTemplate jdbcTemplate;

    public AccessControlFilter(AccessPolicy policy, SessionTokenService sessions, JdbcTemplate jdbcTemplate) {
        this.policy = policy;
        this.sessions = sessions;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        // Preflight CORS do Spring MVC trả lời; file tĩnh /uploads/** không cần đăng nhập
        return "OPTIONS".equalsIgnoreCase(request.getMethod()) || !path(request).startsWith("/api/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String path = path(request);
        Optional<AccessPolicy.Rule> rule = policy.match(request.getMethod(), path);
        if (rule.isEmpty()) {
            reject(request, response, HttpStatus.FORBIDDEN, "API_NOT_DECLARED",
                    "API này chưa được khai báo trong bảng phân quyền");
            return;
        }
        if (AccessPolicy.PUBLIC.equals(rule.get().groupCode())) {
            chain.doFilter(request, response);
            return;
        }

        String authorization = request.getHeader("Authorization");
        Integer userId = sessions.findUserId(authorization);
        UserRow row = userId == null ? null : loadUser(userId);
        if (row == null) {
            reject(request, response, HttpStatus.UNAUTHORIZED, "UNAUTHORIZED",
                    "Phiên đăng nhập không hợp lệ hoặc đã hết hạn, vui lòng đăng nhập lại");
            return;
        }
        if (!"ACTIVE".equals(row.status())) {
            // Tài khoản bị khoá / vô hiệu giữa phiên → huỷ token luôn
            sessions.revoke(authorization);
            reject(request, response, HttpStatus.UNAUTHORIZED, "ACCOUNT_LOCKED",
                    "Tài khoản đã bị khoá hoặc vô hiệu hoá, vui lòng liên hệ quản trị viên");
            return;
        }
        CurrentUser user = row.user();
        if (!policy.allows(rule.get(), user.role())) {
            String groupName = policy.group(rule.get().groupCode())
                    .map(AccessPolicy.PermissionGroup::name).orElse(rule.get().groupCode());
            reject(request, response, HttpStatus.FORBIDDEN, "FORBIDDEN_ROLE",
                    "Vai trò của bạn không được phép dùng chức năng: " + groupName);
            return;
        }

        request.setAttribute(CurrentUser.REQUEST_ATTRIBUTE, user);
        chain.doFilter(wrap(request, user, path), response);
    }

    // Tham số danh tính luôn lấy theo token. Staff / FM bị khoá vào cơ sở được gán.
    static IdentityRequestWrapper wrap(HttpServletRequest request, CurrentUser user, String path) {
        String id = String.valueOf(user.id());
        Map<String, String> params = new HashMap<>();
        Map<String, String> headers = new HashMap<>();
        params.put("actorUserId", id);
        headers.put("X-User-Id", id);
        // Màn nhật ký Admin dùng userId làm BỘ LỌC theo người (không phải người thao tác)
        if (!path.startsWith("/api/v1/admin/")) {
            params.put("userId", id);
        }
        switch (user.role()) {
            case "CUSTOMER" -> params.put("customerId", id);
            case "STAFF" -> params.put("staffId", id);
            case "FACILITY_MANAGER" -> params.put("managerId", id);
            default -> { }
        }
        if (user.isFacilityScoped() && user.facilityId() != null) {
            params.put("facilityId", String.valueOf(user.facilityId()));
            headers.put("X-Facility-Id", String.valueOf(user.facilityId()));
        }
        return new IdentityRequestWrapper(request, params, headers);
    }

    // package-private để unit test giả lập kết quả truy vấn
    record UserRow(CurrentUser user, String status) {}

    // JdbcTemplate thay vì JPA: filter chạy ngoài transaction, tránh lỗi lazy-load role
    private UserRow loadUser(Integer userId) {
        List<UserRow> rows = jdbcTemplate.query(
                "SELECT u.id, r.name AS role_name, u.facility_id, u.full_name, u.email, u.status " +
                        "FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?",
                (rs, i) -> new UserRow(
                        new CurrentUser(
                                rs.getInt("id"),
                                rs.getString("role_name"),
                                (Integer) rs.getObject("facility_id"),
                                rs.getString("full_name"),
                                rs.getString("email")),
                        rs.getString("status")),
                userId);
        return rows.isEmpty() ? null : rows.get(0);
    }

    private static String path(HttpServletRequest request) {
        String uri = request.getRequestURI();
        String context = request.getContextPath();
        return context != null && !context.isEmpty() && uri.startsWith(context) ? uri.substring(context.length()) : uri;
    }

    private static void reject(HttpServletRequest request, HttpServletResponse response,
                               HttpStatus status, String code, String message) throws IOException {
        // Lỗi trả từ filter chưa qua CORS của Spring MVC → tự thêm header để FE đọc được 401/403
        String origin = request.getHeader("Origin");
        if (origin != null && Arrays.asList(CorsConfig.ALLOWED_ORIGINS).contains(origin)) {
            response.setHeader("Access-Control-Allow-Origin", origin);
            response.setHeader("Access-Control-Allow-Credentials", "true");
            response.setHeader("Vary", "Origin");
        }
        response.setStatus(status.value());
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.getWriter().write("{\"error\":\"" + code + "\",\"message\":\"" + escape(message) + "\"}");
    }

    private static String escape(String text) {
        return text.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
