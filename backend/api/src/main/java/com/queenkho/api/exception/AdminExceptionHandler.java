package com.queenkho.api.exception;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

// Bắt AdminException ở MỌI controller → AdminRoleController (UC-03), AdminUserController (UC-08),
// AdminLogController (UC-31) không phải mỗi cái viết lại 1 handler.
// Chỉ bắt đúng AdminException nên không ảnh hưởng lỗi của module khác.
@RestControllerAdvice
public class AdminExceptionHandler {

    @ExceptionHandler(AdminException.class)
    public ResponseEntity<Map<String, String>> handleAdminException(AdminException ex) {
        return ResponseEntity.status(ex.getStatus())
                .body(Map.of("error", ex.getCode(), "message", ex.getMessage()));
    }
}
