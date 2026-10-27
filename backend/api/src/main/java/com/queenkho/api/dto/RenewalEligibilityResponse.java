package com.queenkho.api.dto;

import java.time.LocalDate;
import java.util.List;

/**
 * PR-R10 / PR-R11: khách còn được gia hạn không, đang ở cửa sổ nào và hạn mới của từng gói.
 *  - window = PRIORITY : còn ≥ 3 ngày trước end_date → gia hạn tự do.
 *  - window = LATE     : sát hạn / đã hẹn trả kho / quá hạn → ô đang "sắp trống", chỉ gia hạn khi chưa ai cần ô.
 *  - window = CLOSED   : hợp đồng không ở trạng thái gia hạn được (PR-R1).
 */
public record RenewalEligibilityResponse(
        Integer contractId,
        String status,
        LocalDate endDate,
        LocalDate priorityDeadline,   // end_date − 3: hết ngày này mà chưa gia hạn thì ô mở cho người khác đặt trước
        long daysUntilDeadline,       // âm = đã qua hạn chót ưu tiên
        String window,
        boolean renewable,
        boolean unitReleasing,        // ô đang được tính "sắp trống" cho đơn đặt mới
        String blockedReason,
        List<PackageEndDate> packages
) {
    public record PackageEndDate(int months, LocalDate newEndDate) {}
}
