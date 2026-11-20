package com.queenkho.api.dto;

import java.math.BigDecimal;

/**
 * D-22: 1 dòng của bảng "Bạn đã đóng − Cơ sở giữ lại (+ Bồi thường) = Hoàn".
 * group: PAID (khách đã đóng) / KEPT (cơ sở giữ lại; số âm = phần giảm) / ADDED (cơ sở trả thêm, vd bồi thường).
 */
public record MoneyLine(String group, String label, BigDecimal amount, String note) {
    public static final String PAID = "PAID";
    public static final String KEPT = "KEPT";
    public static final String ADDED = "ADDED";
}
