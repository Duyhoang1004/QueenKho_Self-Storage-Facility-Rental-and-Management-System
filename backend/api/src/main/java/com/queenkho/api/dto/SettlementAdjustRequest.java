package com.queenkho.api.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.List;

// D-21 / PR-O22: FM sửa số tiền khi khách khiếu nại — chỉ được GIẢM (chi phí sự cố, đổi lỗi khách → lỗi cơ sở, miễn phí)
@Getter
@Setter
@NoArgsConstructor
public class SettlementAdjustRequest {
    private List<DamageAdjust> damages;
    private Boolean waiveLateFee;
    private Boolean waiveOverstayFee;
    private String note;

    @Getter
    @Setter
    @NoArgsConstructor
    public static class DamageAdjust {
        private Integer damageCaseId;
        private BigDecimal estimatedCost;
        private String liableParty;   // CUSTOMER / FACILITY
    }
}
