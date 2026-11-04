package com.queenkho.api.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CustomerContractResponse {
    private Integer contractId;
    private String contractCode;
    private Integer customerId;
    private String customerFullName;
    private String customerPhone;
    private String storageUnitId;
    private String unitTypeName;
    private BigDecimal areaSqm;
    private String floor;
    private String zone;
    private String roomNumber;
    private String status; // ACTIVE / OVERDUE / TERMINATED / LIQUIDATED
    private LocalDate startDate;
    private LocalDate endDate;
    private Integer billingCycleMonths;
    private BigDecimal depositHeldAmount;
    private String reservationCode;
    private String accessPinCode;
    private String rfidCardCode;
    private BigDecimal basePriceMonthly;
    private Integer reservationId;
    private BigDecimal totalPaid;     // 🌟 Tổng thực tế đã đóng
    private BigDecimal rentPaid;
    private LocalDate scheduledCheckoutDate; // 🌟 Ngày đã hẹn trả kho (nếu TERMINATION_PENDING)
    private Long overdueDays;                 // Số ngày trễ hạn
    private BigDecimal lateFeeAmount;         // Phí phạt trễ hạn tính theo chính sách
    private BigDecimal estimatedDepositRefund;// Tiền hoàn cọc ước tính sau khi trừ phạt
    private BigDecimal originalDeposit;
    private BigDecimal refundAmount;
    private BigDecimal damageFee;
    private Boolean isInspectionCompleted;    // 🌟 Đã hoàn tất biên bản nghiệm thu (CHECK_OUT)
    private BigDecimal depositRefund;         // 🌟 Tiền cọc hoàn lại sau khấu trừ
    private BigDecimal earlyRentRefund;       // 🌟 Tiền thuê các tháng còn lại được hoàn khi trả sớm (PR-O2)
    private Integer usedMonths;
    private BigDecimal breakFee;              // 🌟 Phí phạt trả kho sớm (1 tháng giá gốc)

    // === CÁC TRƯỜNG BỔ SUNG CHO UC-28 (LƯỢT 2) ===
    private BigDecimal maxLateFeeAmount;              // Mức trần phạt trễ hạn (50% cọc)
    private Boolean isMaxLateFeeReached;             // Đã chạm trần phạt 50% hay chưa
    private Boolean isPinLocked;                     // Trạng thái khóa PIN ở màn hình hiển thị
    private Boolean canLiquidate;                    // Đủ điều kiện thanh lý (quá hạn >= 30 ngày)
    private Integer liquidationDaysThreshold;        // Ngưỡng số ngày thanh lý (mặc định 30)
    private BigDecimal estimatedOverdueDepositRefund; // Cọc ước tính sau trừ phí trễ (= max(0, cọc - phí trễ))

    // === Flow 4 / 6 ===
    private Integer facilityId;                      // để FE lấy bảng giá / ưu đãi gia hạn của cơ sở
    private Boolean lateFeeWaived;                   // FM đã miễn phí trễ cho đợt quá hạn này
    private String lateFeeWaiverNote;

    // === UC-24 / Điều khoản xử lý tài sản ===
    private BigDecimal facilityDamageFee;            // Chi phí sự cố lỗi cơ sở (không tính khách)
    private String termsVersion;                     // Phiên bản điều khoản khách đã đồng ý (NULL = đơn cũ)
    private LocalDateTime termsAcceptedAt;

    // === PR-Q10: hàng lưu giữ sau thanh lý (NULL nếu không có) ===
    private String heldGoodsStatus;                  // HOLDING / RETURNED / SOLD / DESTROYED / HANDED_TO_AUTHORITY
    private LocalDate heldGoodsHoldUntil;
    private String heldGoodsLocation;

    // Thông tin đầy đủ để khách nhận diện đúng cơ sở và liên hệ khi đến nhận kho.
    private String facilityName;
    private String facilityAddress;
    private String facilityHotline;
    private String customerEmail;
    private String customerCccd;

    // PR-Q14: phí chiếm dụng khi OVERDUE (0 nếu đơn trước điều khoản v2)
    private BigDecimal overstayDailyAmount;
    private BigDecimal overstayFeeAmount;
    private BigDecimal totalOverdueCharge;           // phí trễ + phí chiếm dụng
    private BigDecimal amountBeyondDeposit;          // phần vượt cọc sẽ thành nợ nếu trả kho / bị thanh lý

    // PR-O12: NONE / PENDING / COMPLETED — cùng nguồn với danh sách "Kho của tôi" (RefundStatusService)
    private String refundStatus;

    // BR-125 (04/11/2026): bảo hiểm hàng hoá — gán sau constructor (giữ nguyên thứ tự tham số cũ)
    private String insurancePlan;
    private String insurancePlanLabel;
    private BigDecimal insurancePremiumMonthly;
    private BigDecimal declaredGoodsValue;
    private BigDecimal coverageCap;
    private Boolean insured;
    // BR-127: hồ sơ bồi thường cho phép chấm dứt hợp đồng không phí phá HĐ
    private Boolean faultTermination;

    public CustomerContractResponse(Integer contractId, String contractCode, Integer customerId, String customerFullName,
                                    String customerPhone, String storageUnitId, String unitTypeName, BigDecimal areaSqm,
                                    String floor, String zone, String roomNumber, String status, LocalDate startDate,
                                    LocalDate endDate, Integer billingCycleMonths, BigDecimal depositHeldAmount,
                                    String reservationCode, String accessPinCode, String rfidCardCode,
                                    BigDecimal basePriceMonthly, Integer reservationId, BigDecimal totalPaid,
                                    BigDecimal rentPaid, LocalDate scheduledCheckoutDate, Long overdueDays,
                                    BigDecimal lateFeeAmount, BigDecimal estimatedDepositRefund, BigDecimal originalDeposit,
                                    BigDecimal refundAmount, BigDecimal damageFee, Boolean isInspectionCompleted,
                                    BigDecimal depositRefund, BigDecimal earlyRentRefund, Integer usedMonths,
                                    BigDecimal breakFee, BigDecimal maxLateFeeAmount, Boolean isMaxLateFeeReached,
                                    Boolean isPinLocked, Boolean canLiquidate, Integer liquidationDaysThreshold,
                                    BigDecimal estimatedOverdueDepositRefund, Integer facilityId, Boolean lateFeeWaived,
                                    String lateFeeWaiverNote, BigDecimal facilityDamageFee, String termsVersion,
                                    LocalDateTime termsAcceptedAt, String heldGoodsStatus, LocalDate heldGoodsHoldUntil,
                                    String heldGoodsStorageLocation, String facilityName, String facilityAddress,
                                    String facilityHotline, String customerEmail, String customerCccd,
                                    BigDecimal overstayDailyAmount, BigDecimal overstayFeeAmount,
                                    BigDecimal totalOverdueCharge, BigDecimal amountBeyondDeposit, String refundStatus) {
        this(contractId, contractCode, customerId, customerFullName, customerPhone, storageUnitId, unitTypeName, areaSqm,
                floor, zone, roomNumber, status, startDate, endDate, billingCycleMonths, depositHeldAmount, reservationCode,
                accessPinCode, rfidCardCode, basePriceMonthly, reservationId, totalPaid, rentPaid, scheduledCheckoutDate,
                overdueDays, lateFeeAmount, estimatedDepositRefund, originalDeposit, refundAmount, damageFee,
                isInspectionCompleted, depositRefund, earlyRentRefund, usedMonths, breakFee, maxLateFeeAmount,
                isMaxLateFeeReached, isPinLocked, canLiquidate, liquidationDaysThreshold, estimatedOverdueDepositRefund,
                facilityId, lateFeeWaived, lateFeeWaiverNote, facilityDamageFee, termsVersion, termsAcceptedAt,
                heldGoodsStatus, heldGoodsHoldUntil, heldGoodsStorageLocation, facilityName, facilityAddress,
                facilityHotline, customerEmail, customerCccd, overstayDailyAmount, overstayFeeAmount, totalOverdueCharge,
                amountBeyondDeposit, refundStatus, null, null, null, null, null, null, null);
    }
}
