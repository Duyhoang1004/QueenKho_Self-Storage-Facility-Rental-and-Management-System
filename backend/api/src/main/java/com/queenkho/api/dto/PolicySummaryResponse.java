package com.queenkho.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

// D-22: "Bảng phí & hoàn tiền" bằng số của chính đơn / hợp đồng — khách đọc chính sách ra tiền thật
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PolicySummaryResponse {
    private String termsVersion;
    private Integer policyVersion;
    private LocalDateTime policyFrozenAt;   // hợp đồng: ngày chốt chính sách (lúc đặt); đơn mới: null
    private String facilityName;
    private String unitTypeName;
    private BigDecimal monthlyPrice;
    private int months;
    private boolean forContract;
    private List<Section> sections;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Section {
        private String key;        // BOOKING / CANCEL / EARLY / ON_TIME / OVERDUE / REFUND
        private String title;
        private String subtitle;
        private List<Row> rows;
    }

    /** amount = null → dòng chữ; tone: KEEP (cơ sở giữ / khách trả) / REFUND (khách nhận lại) / null */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Row {
        private String label;
        private BigDecimal amount;
        private String note;
        private String tone;
        private boolean total;
    }
}
