package com.queenkho.api.entity;

import jakarta.persistence.*;
import lombok.*;

// UC-06: Mặt bằng 1 tầng của cơ sở. name khớp storage_units.floor của cùng cơ sở.
@Entity
@Table(name = "facility_floors")
@NoArgsConstructor
@AllArgsConstructor
@Getter
@Setter
@Builder
public class FacilityFloor {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "facility_id", nullable = false)
    private Facility facility;

    @Column(nullable = false, length = 20)
    private String name;

    @Column(name = "grid_width", nullable = false)
    private Integer gridWidth;   // số ô lưới ngang (1 ô = 0.5m)

    @Column(name = "grid_height", nullable = false)
    private Integer gridHeight;  // số ô lưới dọc

    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder;
}
