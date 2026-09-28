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
}
