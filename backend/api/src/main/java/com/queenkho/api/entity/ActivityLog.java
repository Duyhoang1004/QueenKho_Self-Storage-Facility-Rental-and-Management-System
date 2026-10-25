package com.queenkho.api.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.Immutable;

import java.time.LocalDateTime;

// UC-31: 1 dòng nhật ký hoạt động.
// Entity này CHỈ để đọc (PR-07: không sửa / xoá log). Việc ghi vẫn đi qua ActivityLogService (JdbcTemplate)
// để lỗi ghi log không kéo theo rollback nghiệp vụ (PR-A10).
// @Immutable: Hibernate không bao giờ sinh UPDATE cho entity này, kể cả khi lỡ gọi setter trong transaction.
@Entity
@Immutable
@Table(name = "activity_logs")
@NoArgsConstructor
@Getter
@Setter
public class ActivityLog {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    // Người thực sự thao tác (PR-A8). LAZY: chỉ JOIN khi query cần — query danh sách tự JOIN FETCH.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    // Nội dung, mở đầu bằng mã nghiệp vụ "[CHECK_IN] ..." (PR-A10)
    @Column(nullable = false, length = 500)
    private String action;

    // Tên bảng của đối tượng bị tác động: users, reservations, rental_contracts...
    @Column(name = "target_entity", length = 50)
    private String targetEntity;

    // String vì storage_units có PK dạng chuỗi
    @Column(name = "target_id", length = 50)
    private String targetId;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;
}
