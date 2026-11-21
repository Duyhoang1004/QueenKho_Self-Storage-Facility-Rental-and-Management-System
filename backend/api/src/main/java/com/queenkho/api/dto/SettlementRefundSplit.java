package com.queenkho.api.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * D-23 / PR-O30: số tiền task hoàn tiền trả kho tách thành hoàn cọc + tiền thuê và bồi thường từng hồ sơ.
 * compensationOffset: phần bồi thường đã cấn trừ vào phí vượt cọc (không chi thành tiền).
 */
public record SettlementRefundSplit(Integer settlementId, Integer contractId, Integer roundNo, String settlementStatus,
                                    BigDecimal depositRentRefund, BigDecimal compensationPayout, BigDecimal compensationOffset,
                                    BigDecimal total, List<ClaimPart> claims) {

    public record ClaimPart(Integer id, String claimCode, String claimType, String status, BigDecimal amount) { }
}
