package com.queenkho.api.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
public class UnitTypeException extends RuntimeException {

    private final HttpStatus status;
    private final String code;

    public UnitTypeException(HttpStatus status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }
}
