package com.queenkho.api.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * UC-13 / UC-14: chi tiết 1 đơn đã cọc cho FM xem trước khi gán ô.
 * CCCD trả dạng che giữa (vd 079******123) — số đầy đủ chỉ đối chiếu khi khách đến nhận kho.
 */
public record ReservationManagerDetailResponse(
        Integer reservationId,
        String reservationCode,
        String status,
        LocalDateTime createdAt,
        // Khách hàng
        Integer customerId,
        String customerName,
        String customerPhone,
        String customerEmail,
        String customerCccdMasked,
        LocalDateTime customerSince,
        // Kho yêu cầu
        String facilityName,
        String unitTypeName,
        String dimensions,
        BigDecimal areaSqm,
        BigDecimal basePriceMonthly,
        // Lịch nhận + tiền
        LocalDate startDate,
        LocalDateTime expectedAppointmentTime,
        Integer durationMonths,
        Integer rentDiscountPercent,
        BigDecimal rentAmount,
        BigDecimal depositAmount,
        String voucherCode,
        BigDecimal voucherDiscount,
        BigDecimal totalPaid,
        // Giao dịch VNPAY đợt 1
        String transactionCode,
        String bankTransactionCode,
        LocalDateTime paidAt,
        // Điều khoản xử lý tài sản
        String termsVersion,
        LocalDateTime termsAcceptedAt,
        // Lịch sử thuê của khách
        int previousContracts,
        int activeContracts,
        BigDecimal pendingDebtAmount
) {
}
