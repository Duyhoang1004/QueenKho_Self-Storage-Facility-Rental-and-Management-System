package com.queenkho.api.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

// PR-Q10: FM chốt cách xử lý hàng đang lưu giữ
@Getter
@Setter
@NoArgsConstructor
public class ResolveHeldGoodsRequest {
    private String outcome;            // RETURNED / SOLD / DESTROYED / HANDED_TO_AUTHORITY
    private String note;               // Bắt buộc 10–1000 ký tự (biên bản bàn giao / bán / huỷ, cơ quan nhận...)
    private BigDecimal proceedsAmount; // Bắt buộc khi SOLD (≥ 0)
    private Boolean storageFeeCollected; // PR-Q15: RETURNED mà cọc không đủ trả phí lưu giữ → FM xác nhận đã thu tại quầy
}
