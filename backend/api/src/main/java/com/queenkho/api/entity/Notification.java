package com.queenkho.api.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * BR-111: thông báo trong chuông — lưu bảng notifications (trước đây chỉ nằm trên RAM, restart BE là mất).
 * refKey: khoá chống gửi trùng cho thông báo do job sinh (vd nhắc gia hạn), NULL với thông báo thường.
 */
@Entity
@Table(name = "notifications")
@NoArgsConstructor
@Getter
@Setter
public class Notification {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "user_id", nullable = false)
    private Integer userId;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false, length = 1000)
    private String message;

    @Column(nullable = false, length = 30)
    private String type;

    @Column(name = "target_url", length = 300)
    private String targetUrl;

    @Column(name = "ref_key", length = 150)
    private String refKey;

    @Column(name = "is_read", nullable = false)
    private Boolean isRead = false;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public Notification(User user, String title, String message, String type, String targetUrl) {
        this(user != null ? user.getId() : null, title, message, type, targetUrl);
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
