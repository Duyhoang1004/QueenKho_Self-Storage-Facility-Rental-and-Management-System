package com.queenkho.api.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
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

    // NULL chỉ ở biên bản check-in online cũ (BR-124, đã bỏ 06/11/2026 — D-16)
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

    // PR-C7 / BR-132 (05/11/2026): đã kiểm tra hàng mang vào khớp loại hàng khai báo, không có hàng cấm
    @Column(name = "is_prohibited_goods_committed", nullable = false)
    private Boolean prohibitedGoodsCommitted = false;

    @Column(name = "is_goods_value_verified", nullable = false)
    private Boolean goodsValueVerified = false;

    @Column(name = "goods_value_assessment", length = 20)
    private String goodsValueAssessment;

    @Column(name = "assessed_goods_value", precision = 18, scale = 2)
    private BigDecimal assessedGoodsValue;

    @Column(name = "goods_value_assessment_note", length = 1000)
    private String goodsValueAssessmentNote;

    @Column
    private String notes;

    // BR-121: ảnh hiện trạng ô lúc bàn giao / nghiệm thu, ngăn bởi |||
    @Column(name = "evidence_image_urls")
    private String evidenceImageUrls;

    // COUNTER (Staff lập tại quầy). ONLINE chỉ còn ở dữ liệu cũ — check-in online đã bỏ 06/11/2026 (D-16)
    @Column(name = "check_in_method", nullable = false)
    private String checkInMethod = "COUNTER";

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

}
