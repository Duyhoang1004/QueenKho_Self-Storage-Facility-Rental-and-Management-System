package com.queenkho.api.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "facilities")
@NoArgsConstructor
@AllArgsConstructor
@Getter
@Setter
public class Facility {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(nullable = false, length = 100)
    private String city;

    @Column(nullable = false, length = 100)
    private String district;

    @Column(nullable = false, length = 255)
    private String address;

    @Column(length = 20)
    private String hotline;

    @Column(nullable = false, length = 30)
    private String status;  // ACTIVE / INACTIVE
}