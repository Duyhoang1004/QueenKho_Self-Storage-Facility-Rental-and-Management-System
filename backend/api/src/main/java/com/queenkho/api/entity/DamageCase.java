package com.queenkho.api.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "damage_cases")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class DamageCase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "contract_id", nullable = false)
    private RentalContract contract;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "task_id", nullable = false)
    private StaffTask task;

    @Column(nullable = false, length = 150)
    private String title;

    @Column(length = 1000)
    private String description;

    @Column(name = "estimated_cost", nullable = false, precision = 12, scale = 2)
    private BigDecimal estimatedCost = BigDecimal.ZERO;

    // UC-24: CUSTOMER = lỗi khách (trừ cọc, vượt cọc thành nợ) / FACILITY = lỗi cơ sở (không tính khách)
    @Column(name = "liable_party", nullable = false, length = 20)
    private String liableParty = "CUSTOMER";

    @Column(name = "evidence_image_urls")
    private String evidenceImageUrls;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;
}
