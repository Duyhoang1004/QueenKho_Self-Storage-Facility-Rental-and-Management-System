package com.queenkho.api.security;

import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

// PR-90: AccessException ném từ bất kỳ controller nào (OwnershipGuard) → 401/403 đúng format chung
@RestControllerAdvice
@Order(Ordered.HIGHEST_PRECEDENCE)
public class AccessExceptionHandler {

    @ExceptionHandler(AccessException.class)
    public ResponseEntity<Map<String, String>> handle(AccessException ex) {
        return ResponseEntity.status(ex.getStatus())
                .body(Map.of("error", ex.getCode(), "message", ex.getMessage()));
    }
}
