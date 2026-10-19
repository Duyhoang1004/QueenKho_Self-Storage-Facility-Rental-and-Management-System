package com.queenkho.api.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

/**
 * Ngoại lệ nghiệp vụ cho các thao tác Đặt chỗ (UC-10, PR-B1, PR-B2, PR-Q12)
 */
@Getter
public class ReservationException extends RuntimeException {

    private final HttpStatus status;
    private final String code;

    public ReservationException(HttpStatus status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }
}

