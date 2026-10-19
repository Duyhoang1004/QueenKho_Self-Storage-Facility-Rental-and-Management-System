package com.queenkho.api.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

// UC-03/08/31: lỗi nghiệp vụ của portal Admin — mang sẵn HTTP status + mã lỗi
@Getter
public class AdminException extends RuntimeException {

    private final HttpStatus status;
    private final String code;

    public AdminException(HttpStatus status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }
}
