package com.queenkho.api.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@AllArgsConstructor
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
                storageUnitRoomNumber, refundEvidence, false, false);
    }
}
