package com.queenkho.api.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

// PR-Q10: lỗi nghiệp vụ khi xử lý hàng của khách lưu giữ sau thanh lý
@Getter
public class HeldGoodsException extends RuntimeException {

    private final HttpStatus status;
    private final String code;

    public HeldGoodsException(HttpStatus status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }
}
