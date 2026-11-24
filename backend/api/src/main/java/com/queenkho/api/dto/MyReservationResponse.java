package com.queenkho.api.dto;

import lombok.Getter;
import lombok.Setter;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Getter
public class MyReservationResponse {
    private Integer id;
    private String reservationCode;
    private String customerName;
    private String customerPhone;
    private String facilityName;
    private String facilityAddress;
    private String unitTypeName;
    private BigDecimal areaSqm;
    private String dimensions;
    private String storageUnitId;   // null cho tới khi FM gán ô kho (UC-14)
    private LocalDate startDate;
    private Integer durationMonths;
    private BigDecimal depositAmount;
    private String status;
    private LocalDateTime createdAt;
    private LocalDate endDate;
    private BigDecimal totalPaid; 
    private Integer contractId; 
    private String customerEmail;
    private String customerCccd;
    private String facilityHotline;
    private String storageUnitFloor;
    private String storageUnitZone;
    private String storageUnitRoomNumber;
    private RefundEvidenceResponse refundEvidence;
    // BR-141 (12/11/2026): ô đã gán đang bảo trì trước ngày nhận kho → khách chọn dời lịch hoặc huỷ hoàn 100%
    private boolean unitIssue;
    // BR-140: đang tạm ở ô kho khẩn cấp
    private boolean emergencyUnit;
    // Đã chọn ngày nhận mới sau sự cố; vẫn giữ quyền hủy theo lỗi cơ sở.
    private boolean unitIssueRescheduled;

    // 23/11/2026 — PR-B13: chi tiết huỷ đơn để khách xem lại số tiền sẽ nhận (đơn huỷ trước khi có hợp đồng)
    @Setter
    private LocalDateTime cancelledAt;
    @Setter
    private String cancellationTier;
    @Setter
    private BigDecimal cancellationPenaltyAmount;
    @Setter
    private BigDecimal cancellationRefundAmount;

    // Góp ý test 24/11 (PR-B14): popup "Số tiền đã đóng" — cách ra con số lúc đặt kho + giao dịch VNPAY
    @Setter
    private List<MoneyLine> paymentLines;
    @Setter
    private List<Map<String, Object>> paymentTransactions;

    // Constructor đầy đủ (thay @AllArgsConstructor để thêm trường chi tiết huỷ đơn mà không đổi lời gọi cũ)
    public MyReservationResponse(Integer id,
                                 String reservationCode,
                                 String customerName,
                                 String customerPhone,
                                 String facilityName,
                                 String facilityAddress,
                                 String unitTypeName,
                                 BigDecimal areaSqm,
                                 String dimensions,
                                 String storageUnitId,
                                 LocalDate startDate,
                                 Integer durationMonths,
                                 BigDecimal depositAmount,
                                 String status,
                                 LocalDateTime createdAt,
                                 LocalDate endDate,
                                 BigDecimal totalPaid,
                                 Integer contractId,
                                 String customerEmail,
                                 String customerCccd,
                                 String facilityHotline,
                                 String storageUnitFloor,
                                 String storageUnitZone,
                                 String storageUnitRoomNumber,
                                 RefundEvidenceResponse refundEvidence,
                                 boolean unitIssue,
                                 boolean emergencyUnit,
                                 boolean unitIssueRescheduled) {
        this.id = id;
        this.reservationCode = reservationCode;
        this.customerName = customerName;
        this.customerPhone = customerPhone;
        this.facilityName = facilityName;
        this.facilityAddress = facilityAddress;
        this.unitTypeName = unitTypeName;
        this.areaSqm = areaSqm;
        this.dimensions = dimensions;
        this.storageUnitId = storageUnitId;
        this.startDate = startDate;
        this.durationMonths = durationMonths;
        this.depositAmount = depositAmount;
        this.status = status;
        this.createdAt = createdAt;
        this.endDate = endDate;
        this.totalPaid = totalPaid;
        this.contractId = contractId;
        this.customerEmail = customerEmail;
        this.customerCccd = customerCccd;
        this.facilityHotline = facilityHotline;
        this.storageUnitFloor = storageUnitFloor;
        this.storageUnitZone = storageUnitZone;
        this.storageUnitRoomNumber = storageUnitRoomNumber;
        this.refundEvidence = refundEvidence;
        this.unitIssue = unitIssue;
        this.emergencyUnit = emergencyUnit;
        this.unitIssueRescheduled = unitIssueRescheduled;
    }

    // Constructor cũ (trước 12/11/2026) — 2 cờ BR-140/141 mặc định false
    public MyReservationResponse(Integer id, String reservationCode, String customerName, String customerPhone,
                                 String facilityName, String facilityAddress, String unitTypeName, BigDecimal areaSqm,
                                 String dimensions, String storageUnitId, LocalDate startDate, Integer durationMonths,
                                 BigDecimal depositAmount, String status, LocalDateTime createdAt, LocalDate endDate,
                                 BigDecimal totalPaid, Integer contractId, String customerEmail, String customerCccd,
                                 String facilityHotline, String storageUnitFloor, String storageUnitZone,
                                 String storageUnitRoomNumber, RefundEvidenceResponse refundEvidence) {
        this(id, reservationCode, customerName, customerPhone, facilityName, facilityAddress, unitTypeName, areaSqm,
                dimensions, storageUnitId, startDate, durationMonths, depositAmount, status, createdAt, endDate, totalPaid,
                contractId, customerEmail, customerCccd, facilityHotline, storageUnitFloor, storageUnitZone,
                storageUnitRoomNumber, refundEvidence, false, false, false);
    }
}
