package com.queenkho.api.service;

import java.math.BigDecimal;

/**
 * BR-128: cổng gọi API của đối tác bảo hiểm (cơ sở đã chi trả trước cho khách → lập hồ sơ đòi lại tiền hàng).
 * Bản hiện tại là {@link MockInsuranceProviderClient} (🔸 mô phỏng) — khi có đối tác thật chỉ cần thêm 1 implementation gọi HTTP.
 */
public interface InsuranceProviderClient {

    /** Gửi hồ sơ bồi thường → trả mã hồ sơ phía bảo hiểm, trạng thái SUBMITTED */
    InsuranceResult submitClaim(String claimCode, String plan, BigDecimal amount, String description);

    /** Bảo hiểm duyệt và chi trả (mô phỏng phản hồi webhook của đối tác) */
    InsuranceResult settleClaim(String insuranceRef, BigDecimal approvedAmount);

    record InsuranceResult(String ref, String status, BigDecimal amount, String message) {}
}
