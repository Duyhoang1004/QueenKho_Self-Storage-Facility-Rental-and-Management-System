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
}
