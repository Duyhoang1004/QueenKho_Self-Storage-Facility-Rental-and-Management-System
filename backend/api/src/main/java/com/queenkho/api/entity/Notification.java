package com.queenkho.api.entity;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * Đối tượng Notification lưu trữ tạm thời trong bộ nhớ (In-Memory RAM).
 * Tắt chương trình là dữ liệu tự động giải phóng, không lưu vào Database.
 */
@NoArgsConstructor
@Getter
@Setter
public class Notification {
    private Integer id;
    private Integer userId;
    private User user;
    private String title;
    private String message;
    private String type;
    private String targetUrl;
    private Boolean isRead = false;
    private LocalDateTime createdAt = LocalDateTime.now();

    public Notification(User user, String title, String message, String type, String targetUrl) {
        this.user = user;
        this.userId = user != null ? user.getId() : null;
        this.title = title;
        this.message = message;
        this.type = type;
        this.targetUrl = targetUrl;
        this.isRead = false;
        this.createdAt = LocalDateTime.now();
    }

    public Notification(Integer userId, String title, String message, String type, String targetUrl) {
        this.userId = userId;
        this.title = title;
        this.message = message;
        this.type = type;
        this.targetUrl = targetUrl;
        this.isRead = false;
        this.createdAt = LocalDateTime.now();
    }
}
