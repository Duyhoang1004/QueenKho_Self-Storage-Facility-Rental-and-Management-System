package com.queenkho.api.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

// BR-134 (05/11/2026): kho tổng giữ hàng của khách quá hạn — không bán, khách đến nhận lại sau khi thanh toán
@Entity
@Table(name = "central_warehouses")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class CentralWarehouse {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(nullable = false, length = 300)
    private String address;

    @Column(length = 20)
    private String hotline;

    @Column(length = 500)
    private String note;

    @Column(nullable = false, length = 20)
    private String status = "ACTIVE"; // ACTIVE / INACTIVE

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}
