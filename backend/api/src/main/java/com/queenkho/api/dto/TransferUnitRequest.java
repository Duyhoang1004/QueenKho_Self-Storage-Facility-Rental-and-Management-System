package com.queenkho.api.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

// BR-122: FM chuyển hợp đồng sang ô khác cùng loại, cùng cơ sở
@Getter
@Setter
@NoArgsConstructor
public class TransferUnitRequest {
    private String toUnitId;
    private String reasonType;          // FACILITY_ISSUE / CUSTOMER_REQUEST / REARRANGE
    private String reason;              // 10–500 ký tự
    private Boolean oldUnitMaintenance; // true → ô cũ chuyển sang Bảo trì (bắt buộc khi FACILITY_ISSUE)
}
