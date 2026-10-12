package com.queenkho.api.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
@Setter
@Getter
@AllArgsConstructor
@NoArgsConstructor
@Entity
@Table(name = "handover_records")
public class HandoverRecord {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "contract_id", nullable = false)
    private RentalContract contract;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "staff_id", nullable = false)
    private User staff;

    @Column(nullable = false)
    private String recordType;

    @Column(name = "is_identity_verified")
    private Boolean identityVerified;

    @Column(name = "is_empty")
    private Boolean unitEmpty;

    @Column(name = "is_clean")
    private Boolean unitClean;

    @Column(name = "is_lock_intact")
    private Boolean lockIntact;

    @Column(name = "customer_signature_confirmed")
    private Boolean customerSignatureConfirmed;

    @Column
    private String notes;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

}
