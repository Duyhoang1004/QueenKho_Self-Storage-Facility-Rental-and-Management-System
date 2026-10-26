package com.queenkho.api.security;

import lombok.Getter;
import org.springframework.http.HttpStatus;

// PR-90: lỗi xác thực / phân quyền → { "error": code, "message": ... } (401 hoặc 403)
@Getter
public class AccessException extends RuntimeException {
    private final HttpStatus status;
    private final String code;

    public AccessException(HttpStatus status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public static AccessException unauthorized(String message) {
        return new AccessException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", message);
    }

    public static AccessException forbidden(String code, String message) {
        return new AccessException(HttpStatus.FORBIDDEN, code, message);
    }
}
