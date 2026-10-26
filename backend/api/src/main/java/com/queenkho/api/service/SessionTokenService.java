package com.queenkho.api.service;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Kho phiên đăng nhập tối giản cho opaque token hiện có của dự án.
 * Token chỉ sống trong vòng đời tiến trình backend; khởi động lại backend thì khách đăng nhập lại.
 */
@Service
public class SessionTokenService {
    private final Map<String, Integer> sessions = new ConcurrentHashMap<>();

    public String create(Integer userId) {
        String token = UUID.randomUUID().toString();
        sessions.put(token, userId);
        return token;
    }

    public Integer requireUser(String authorizationHeader) {
        if (authorizationHeader == null || !authorizationHeader.startsWith("Bearer ")) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Vui lòng đăng nhập lại");
        }
        Integer userId = sessions.get(authorizationHeader.substring(7).trim());
        if (userId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Phiên đăng nhập không hợp lệ hoặc đã hết hạn");
        }
        return userId;
    }

    // PR-90: dùng trong AccessControlFilter — không ném lỗi, trả null nếu thiếu / sai token
    public Integer findUserId(String authorizationHeader) {
        String token = extractToken(authorizationHeader);
        return token == null ? null : sessions.get(token);
    }

    // Đăng xuất / tài khoản bị khoá giữa phiên → huỷ token
    public void revoke(String authorizationHeader) {
        String token = extractToken(authorizationHeader);
        if (token != null) {
            sessions.remove(token);
        }
    }

    private static String extractToken(String authorizationHeader) {
        if (authorizationHeader == null || !authorizationHeader.startsWith("Bearer ")) {
            return null;
        }
        String token = authorizationHeader.substring(7).trim();
        return token.isEmpty() ? null : token;
    }
}
