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

    // NULL khi khách tự check-in online (BR-124)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "staff_id")
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

    // BR-121: ảnh hiện trạng ô lúc bàn giao / nghiệm thu, ngăn bởi |||
    @Column(name = "evidence_image_urls")
    private String evidenceImageUrls;

    // BR-124: COUNTER (Staff lập tại quầy) / ONLINE (khách tự check-in trên app)
    @Column(name = "check_in_method", nullable = false)
    private String checkInMethod = "COUNTER";

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

}
