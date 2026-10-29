package com.queenkho.api.entity;

import jakarta.persistence.*;
import lombok.*;

// UC-06: Vật cố định trên mặt bằng (lối đi, cửa vào, thang, văn phòng) — ô kho không được đè lên
@Entity
@Table(name = "floor_fixtures")
@NoArgsConstructor
@AllArgsConstructor
@Getter
@Setter
@Builder
public class FloorFixture {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "floor_id", nullable = false)
    private FacilityFloor floor;

    @Column(name = "fixture_type", nullable = false, length = 20)
    private String fixtureType; // AISLE / ENTRANCE / STAIRS / ELEVATOR / OFFICE

    @Column(length = 50)
    private String label;

    @Column(name = "map_x", nullable = false)
    private Integer mapX;

    @Column(name = "map_y", nullable = false)
    private Integer mapY;

    @Column(name = "map_w", nullable = false)
    private Integer mapW;

    @Column(name = "map_h", nullable = false)
    private Integer mapH;
}
