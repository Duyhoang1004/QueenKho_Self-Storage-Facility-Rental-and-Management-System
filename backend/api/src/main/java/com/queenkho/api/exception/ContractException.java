package com.queenkho.api.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

/**
 * Ngoại lệ nghiệp vụ cho các thao tác liên quan đến Hợp đồng thuê kho (UC-28)
 */
@Getter
public class ContractException extends RuntimeException {

    private final HttpStatus status;
    private final String code;

    public ContractException(HttpStatus status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }
}

