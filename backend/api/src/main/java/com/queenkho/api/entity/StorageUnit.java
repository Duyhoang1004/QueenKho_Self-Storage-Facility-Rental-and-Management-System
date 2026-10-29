package com.queenkho.api.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "storage_units")
@NoArgsConstructor
@AllArgsConstructor
@Getter
@Setter
public class StorageUnit {

    @Id
    @Column(length = 20)
    private String id;   // PK dạng chuỗi: "KV-TB-A101"

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "facility_id", nullable = false)
    private Facility facility;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "unit_type_id", nullable = false)
    private UnitType unitType;

    @Column(length = 20)
    private String floor;

    @Column(length = 20)
    private String zone;

    @Column(name = "room_number", length = 20)
    private String roomNumber;

    @Column(nullable = false, length = 30)
    private String status;  // AVAILABLE / RESERVED / OCCUPIED / MAINTENANCE

    // UC-06 mặt bằng: góc trên-trái + kích thước theo ô lưới (1 ô = 0.5m); null = chưa đặt trên mặt bằng
    @Column(name = "map_x")
    private Integer mapX;

    @Column(name = "map_y")
    private Integer mapY;

    @Column(name = "map_w")
    private Integer mapW;

    @Column(name = "map_h")
    private Integer mapH;

    @Column(name = "map_door", length = 10)
    private String mapDoor; // TOP / BOTTOM / LEFT / RIGHT

    public boolean isPlacedOnMap() {
        return mapX != null && mapY != null && mapW != null && mapH != null;
    }

    public void clearMapPosition() {
        mapX = null;
        mapY = null;
        mapW = null;
        mapH = null;
    }
}
