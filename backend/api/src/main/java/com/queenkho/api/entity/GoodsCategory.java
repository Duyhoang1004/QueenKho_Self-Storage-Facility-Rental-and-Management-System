package com.queenkho.api.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

// BR-131 (05/11/2026): danh mục loại hàng khách khai báo khi đặt kho — BOM quản lý
@Entity
@Table(name = "goods_categories")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class GoodsCategory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(nullable = false, length = 30)
    private String code;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(length = 300)
    private String description;

    // Chỉ gửi được ở kho lạnh / kho đông (vd thực phẩm)
    @Column(name = "requires_cold_storage", nullable = false)
    private Boolean requiresColdStorage = false;

    // Bắt buộc khách mô tả thêm (vd "Khác")
    @Column(name = "requires_note", nullable = false)
    private Boolean requiresNote = false;

    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder = 0;

    @Column(nullable = false, length = 20)
    private String status = "ACTIVE"; // ACTIVE / INACTIVE

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}
