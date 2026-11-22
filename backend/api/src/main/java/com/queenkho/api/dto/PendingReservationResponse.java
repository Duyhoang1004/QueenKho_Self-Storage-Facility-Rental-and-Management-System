package com.queenkho.api.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class PendingReservationResponse {
    private Integer id;
    private String reservationCode;
    private String customerName;
    private String customerPhone;
    private String unitTypeName;
    private LocalDate startDate;
    private Integer durationMonths;
    private BigDecimal depositAmount;
    private LocalDateTime createdAt;
    private String staffNote;
    private String staffName;
    private Boolean noShowEligible;
    private Integer failedContactCount;
    private String noShowIneligibleReason;
    // BR-123: ưu tiên khách cũ + gói dài khi FM gán ô
    private Integer priorityScore;
    private Integer pastRentalCount;   // số hợp đồng trước đây khách đã nhận kho
    private String priorityLabel;
    // PR-X1 (08/11/2026): xem trước tiền No-Show (giữ cọc + 1 tháng thuê, hoàn phần còn lại)
    private BigDecimal totalPaid;
    private BigDecimal noShowPenaltyAmount;
    private BigDecimal noShowRefundAmount;
    // Vấn đề 2 (22/11/2026): khách đã tới / đã lập biên bản nháp nhưng quá hạn chưa hoàn tất → chỉ cho Dời lịch, khoá phạt No-Show
    private Boolean hasDraftHandover;

    public PendingReservationResponse(Integer id, String reservationCode, String customerName,
                                      String customerPhone, String unitTypeName, LocalDate startDate,
                                      Integer durationMonths, BigDecimal depositAmount, LocalDateTime createdAt,
                                      String staffNote, String staffName, Boolean noShowEligible,
                                      Integer failedContactCount, String noShowIneligibleReason,
                                      Integer priorityScore, Integer pastRentalCount, String priorityLabel,
                                      BigDecimal totalPaid, BigDecimal noShowPenaltyAmount, BigDecimal noShowRefundAmount) {
        this(id, reservationCode, customerName, customerPhone, unitTypeName, startDate, durationMonths, depositAmount,
                createdAt, staffNote, staffName, noShowEligible, failedContactCount, noShowIneligibleReason,
                priorityScore, pastRentalCount, priorityLabel, totalPaid, noShowPenaltyAmount, noShowRefundAmount, null);
    }

    public PendingReservationResponse(Integer id, String reservationCode, String customerName,
                                      String customerPhone, String unitTypeName, LocalDate startDate,
                                      Integer durationMonths, BigDecimal depositAmount, LocalDateTime createdAt,
                                      String staffNote, String staffName, Boolean noShowEligible,
                                      Integer failedContactCount, String noShowIneligibleReason) {
        this(id, reservationCode, customerName, customerPhone, unitTypeName, startDate, durationMonths, depositAmount,
                createdAt, staffNote, staffName, noShowEligible, failedContactCount, noShowIneligibleReason, null, null, null, null, null, null);
    }

    public PendingReservationResponse(Integer id, String reservationCode, String customerName,
                                      String customerPhone, String unitTypeName, LocalDate startDate,
                                      Integer durationMonths, BigDecimal depositAmount, LocalDateTime createdAt) {
        this(id, reservationCode, customerName, customerPhone, unitTypeName, startDate, durationMonths, depositAmount, createdAt, null, null, null, null, null);
    }
}