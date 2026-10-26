package com.queenkho.api.dto;

import java.time.LocalDateTime;

// Admin: 1 dòng lịch sử đăng nhập
public record LoginHistoryResponse(
        Integer id,
        Integer userId,
        String email,
        String fullName,
        String role,
        String eventType,       // LOGIN_SUCCESS / LOGIN_FAILED / LOGOUT
        String failureReason,   // INVALID_CREDENTIALS / ACCOUNT_LOCKED / ACCOUNT_DISABLED
        String ipAddress,
        String userAgent,
        LocalDateTime createdAt
) {}
