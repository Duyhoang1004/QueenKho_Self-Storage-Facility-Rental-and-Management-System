package com.queenkho.api.dto;

import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

// PR-Q10: 1 hồ sơ hàng lưu giữ sau thanh lý (trang FM "Hàng đang lưu giữ")
@Getter
@Builder
public class HeldGoodsResponse {
    private Integer id;
    private Integer taskId;
    private Integer contractId;
    private String contractCode;
    private String customerName;
    private String customerPhone;
    private String storageUnitId;

    private String inventoryNote;
    private List<String> evidenceImages;
    private String witnessNote;
    private String storageLocation;

    private String status;
    private LocalDate holdUntil;
    private long daysLeft;             // âm = đã quá hạn lưu giữ
    private boolean holdExpired;
    private String termsVersion;       // NULL = đơn cũ chưa đồng ý điều khoản → không được bán
    private boolean canSell;           // hết hạn + đã đồng ý điều khoản
    private BigDecimal customerDebt;   // nợ DAMAGE_FEE / OVERSTAY_FEE còn PENDING của khách (phải trả trước khi nhận lại)
    private BigDecimal depositHeld;    // cọc còn giữ sau thanh lý

    private BigDecimal proceedsAmount;
    private BigDecimal debtOffsetAmount;
    private BigDecimal refundAmount;

    // PR-Q15: phí lưu giữ hàng (0 nếu khách chưa đồng ý điều khoản v2)
    private BigDecimal storageFeePerDay;
    private long heldDays;
    private BigDecimal estimatedStorageFee; // tạm tính đến hôm nay (chỉ khi đang HOLDING)
    private BigDecimal storageFeeAmount;    // đã tính khi chốt hồ sơ
    private String resolvedNote;
    private String resolvedByName;
    private LocalDateTime resolvedAt;
    private String createdByName;
    private LocalDateTime createdAt;
}
