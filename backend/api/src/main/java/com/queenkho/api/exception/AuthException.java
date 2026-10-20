package com.queenkho.api.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

// UC-01 / PR-L1, PR-L2, PR-L3: lỗi đăng nhập có mã lỗi + HTTP status
@Getter
public class AuthException extends RuntimeException {

    private final HttpStatus status;
    private final String code;

    public AuthException(HttpStatus status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }
}
