package com.queenkho.api.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.Immutable;

import java.time.LocalDateTime;

// Admin: 1 lần đăng nhập (thành công / thất bại) hoặc đăng xuất.
// Chỉ để đọc giống ActivityLog — việc ghi đi qua LoginHistoryService (JdbcTemplate),
// lỗi ghi lịch sử không được làm hỏng việc đăng nhập.
@Entity
@Immutable
@Table(name = "login_history")
@NoArgsConstructor
@Getter
@Setter
public class LoginHistory {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    // NULL khi gõ email không tồn tại trong hệ thống
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @Column(nullable = false, length = 255)
    private String email;

    // LOGIN_SUCCESS / LOGIN_FAILED / LOGOUT
    @Column(name = "event_type", nullable = false, length = 20)
    private String eventType;

    // INVALID_CREDENTIALS / ACCOUNT_LOCKED / ACCOUNT_DISABLED
    @Column(name = "failure_reason", length = 50)
    private String failureReason;

    @Column(name = "ip_address", length = 64)
    private String ipAddress;

    @Column(name = "user_agent", length = 300)
    private String userAgent;

    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private LocalDateTime createdAt;
}
