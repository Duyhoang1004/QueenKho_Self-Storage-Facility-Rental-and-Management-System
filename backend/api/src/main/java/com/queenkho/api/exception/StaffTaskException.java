package com.queenkho.api.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

// UC-17: lỗi nghiệp vụ của task kèm HTTP status + mã lỗi.
// Cần riêng vì IllegalArgument/IllegalState chỉ map được 400,
// còn ở đây phải phân biệt 404 (không có task), 403 (sai cơ sở/sai role), 409 (bị người khác nhận trước)
@Getter
public class StaffTaskException extends RuntimeException {

    private final HttpStatus status;
    private final String code;

    public StaffTaskException(HttpStatus status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }
}
