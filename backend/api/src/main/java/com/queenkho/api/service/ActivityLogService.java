package com.queenkho.api.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

// UC-31 / PR-A9, PR-A10: chỗ ghi activity_logs dùng chung cho các chức năng Admin.
// (Các service cũ đang tự INSERT native — UC-31 sẽ gom dần về đây.)
@Service
public class ActivityLogService {

    // PR-A8: tài khoản của job tự động — không tính vào thống kê người dùng
    public static final String SYSTEM_EMAIL = "system@queenkho.local";

    private static final int ACTION_MAX_LENGTH = 500; // = độ dài cột activity_logs.action

    @Autowired
    private JdbcTemplate jdbcTemplate;

    // action nên mở đầu bằng mã nghiệp vụ, vd "[ROLE_UPDATE] ..." (PR-A10)
    public void log(Integer userId, String action, String targetEntity, String targetId) {
        String safeAction = action.length() > ACTION_MAX_LENGTH
                ? action.substring(0, ACTION_MAX_LENGTH - 1) + "…"
                : action;
        try {
            jdbcTemplate.update(
                    "INSERT INTO activity_logs (user_id, action, target_entity, target_id, created_at) " +
                    "VALUES (?, ?, ?, ?, SYSDATETIME())",
                    userId, safeAction, targetEntity, targetId);
        } catch (Exception e) {
            // PR-A10: lỗi ghi log KHÔNG được làm hỏng nghiệp vụ chính
            System.err.println("Warning: Failed to record activity_log: " + e.getMessage());
        }
    }
}
