package com.queenkho.api.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "users")
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Getter
@Setter
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "facility_id")
    private Integer facilityId;

    @ManyToOne
    @JoinColumn(name = "role_id", nullable = false)
    private Role role;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(name = "password_hash", nullable = false)
    private String password;

    @Column(name = "full_name", nullable = false, length = 100)
    private String fullName;

    @Column(nullable = false, length = 20)
    private String phone;

    @Column(length = 20)
    private String cccd;

    @Column(nullable = false, length = 30)
    private String status;

    // UC-08: ngày tạo — cột có DEFAULT SYSDATETIME() trong DB.
    // insertable/updatable = false: Hibernate KHÔNG gửi cột này khi INSERT/UPDATE (gửi NULL thì DB không áp DEFAULT).
    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;
}
