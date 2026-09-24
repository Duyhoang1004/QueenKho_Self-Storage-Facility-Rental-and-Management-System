package com.queenkho.api.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "unit_types")
@NoArgsConstructor
@AllArgsConstructor
@Getter
@Setter
public class UnitType {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(nullable = false, length = 100)
    private String name;
}