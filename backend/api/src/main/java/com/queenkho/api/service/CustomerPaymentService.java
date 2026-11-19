package com.queenkho.api.service;

import com.queenkho.api.dto.CustomerPaymentsResponse;
import com.queenkho.api.entity.RentalContract;
import com.queenkho.api.repository.RentalContractRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Timestamp;
import java.util.List;

/**
 * UC-20 (đổi phạm vi theo PR-50): khách xem MỌI giao dịch của mình + các khoản cần trả.
 *  - Khoản nợ phí sự cố (DAMAGE_FEE / VNPAY / PENDING) → trả ngay qua VNPAY (VnpayService.createDebtPayment).
 *  - Hợp đồng quá hạn → trả bằng cách gia hạn (tiền thuê + phí trễ) ở trang hợp đồng.
 */
@Service
public class CustomerPaymentService {

    private final JdbcTemplate jdbcTemplate;
    private final RentalContractRepository contracts;
    private final LateFeeService lateFeeService;

    public CustomerPaymentService(JdbcTemplate jdbcTemplate, RentalContractRepository contracts,
                                  LateFeeService lateFeeService) {
        this.jdbcTemplate = jdbcTemplate;
        this.contracts = contracts;
        this.lateFeeService = lateFeeService;
    }

    // Giao dịch "của khách": do khách đứng tên, hoặc gắn với đơn / hợp đồng của khách
    private static final String MY_PAYMENTS =
            "FROM payment_transactions p " +
            "LEFT JOIN rental_contracts c ON c.id = p.contract_id " +
            "LEFT JOIN reservations r ON r.id = COALESCE(p.reservation_id, c.reservation_id) " +
            "LEFT JOIN facilities f ON f.id = r.facility_id " +
            "LEFT JOIN unit_types ut ON ut.id = r.unit_type_id " +
            "LEFT JOIN vouchers v ON v.id = r.voucher_id OR (r.voucher_id IS NULL AND v.code = r.voucher_code) " +
            "WHERE p.user_id = ? OR r.customer_id = ? OR c.customer_id = ? ";

    @Transactional(readOnly = true)
    public CustomerPaymentsResponse getMyPayments(Integer customerId) {
        if (customerId == null) {
            throw new IllegalArgumentException("Thiếu thông tin khách hàng");
        }
        List<CustomerPaymentsResponse.PaymentItem> transactions = jdbcTemplate.query(
                "SELECT p.id, p.transaction_code, p.bank_transaction_code, p.payment_type, p.payment_method, p.amount, p.status, p.paid_at, " +
                        "p.renewal_months, r.id AS reservation_id, r.reservation_code, p.contract_id, c.contract_code, " +
                        "f.name AS facility_name, ut.name AS unit_type_name, " +
                        "ut.base_price_monthly, r.duration_months, r.rent_discount_percent, r.voucher_code, r.voucher_discount, " +
                        "r.deposit_amount, r.insurance_plan, r.insurance_premium_monthly, " +
                        "v.discount_type AS voucher_discount_type, v.discount_value AS voucher_discount_value " +
                        MY_PAYMENTS + "ORDER BY p.id DESC",
                (rs, i) -> {
                    Timestamp paidAt = rs.getTimestamp("paid_at");
                    String paymentType = rs.getString("payment_type");
                    BigDecimal monthlyRentPrice = rs.getBigDecimal("base_price_monthly");
                    Integer durationMonths = (Integer) rs.getObject("duration_months");
                    Integer rentDiscountPercent = (Integer) rs.getObject("rent_discount_percent");
                    String voucherCode = rs.getString("voucher_code");
                    BigDecimal voucherDiscount = rs.getBigDecimal("voucher_discount");
                    BigDecimal depositAmount = rs.getBigDecimal("deposit_amount");
                    String insurancePlan = rs.getString("insurance_plan");
                    BigDecimal insuranceMonthly = rs.getBigDecimal("insurance_premium_monthly");
                    String voucherDiscountType = rs.getString("voucher_discount_type");
                    BigDecimal voucherDiscountValue = rs.getBigDecimal("voucher_discount_value");
                    Integer voucherDiscountPercent = null;
                    if ("PERCENT".equalsIgnoreCase(voucherDiscountType) && voucherDiscountValue != null) {
                        voucherDiscountPercent = voucherDiscountValue.intValue();
                    }

                    BigDecimal baseRentAmount = null;
                    BigDecimal rentDiscountAmount = null;
                    BigDecimal actualRentPaid = null;
                    BigDecimal insuranceAmount = null;

                    if ("DEPOSIT".equalsIgnoreCase(paymentType) && durationMonths != null && monthlyRentPrice != null) {
                        baseRentAmount = monthlyRentPrice.multiply(BigDecimal.valueOf(durationMonths));
                        if (rentDiscountPercent != null && rentDiscountPercent > 0) {
                            rentDiscountAmount = baseRentAmount.multiply(BigDecimal.valueOf(rentDiscountPercent))
                                    .divide(BigDecimal.valueOf(100), 0, RoundingMode.HALF_UP);
                        } else {
                            rentDiscountAmount = BigDecimal.ZERO;
                        }
                        actualRentPaid = baseRentAmount
                                .subtract(rentDiscountAmount)
                                .subtract(voucherDiscount != null ? voucherDiscount : BigDecimal.ZERO)
                                .max(BigDecimal.ZERO);
                        if (insuranceMonthly != null) {
                            insuranceAmount = insuranceMonthly.multiply(BigDecimal.valueOf(durationMonths));
                        }
                    }

                    return new CustomerPaymentsResponse.PaymentItem(
                            rs.getInt("id"),
                            rs.getString("transaction_code"),
                            rs.getString("bank_transaction_code"),
                            paymentType,
                            rs.getString("payment_method"),
                            rs.getBigDecimal("amount"),
                            rs.getString("status"),
                            paidAt != null ? paidAt.toLocalDateTime() : null,
                            (Integer) rs.getObject("renewal_months"),
                            (Integer) rs.getObject("reservation_id"),
                            rs.getString("reservation_code"),
                            (Integer) rs.getObject("contract_id"),
                            rs.getString("contract_code"),
                            rs.getString("facility_name"),
                            rs.getString("unit_type_name"),
                            monthlyRentPrice,
                            durationMonths,
                            baseRentAmount,
                            rentDiscountPercent,
                            rentDiscountAmount,
                            voucherCode,
                            voucherDiscount,
                            actualRentPaid,
                            depositAmount,
                            insurancePlan,
                            insuranceAmount,
                            voucherDiscountType,
                            voucherDiscountPercent);
                },
                customerId, customerId, customerId);

        BigDecimal totalPaid = BigDecimal.ZERO;
        BigDecimal totalRefunded = BigDecimal.ZERO;
        BigDecimal pendingRefund = BigDecimal.ZERO;
        BigDecimal outstandingDebt = BigDecimal.ZERO;
        BigDecimal depositOffset = BigDecimal.ZERO;
        for (CustomerPaymentsResponse.PaymentItem p : transactions) {
            BigDecimal amount = p.amount() != null ? p.amount() : BigDecimal.ZERO;
            boolean success = "SUCCESS".equals(p.status());
            // BR-128: tiền bồi thường cơ sở chi cho khách tính như tiền QueenKho trả lại khách
            if ("REFUND".equals(p.paymentType()) || "COMPENSATION".equals(p.paymentType())) {
                if (success) {
                    totalRefunded = totalRefunded.add(amount);
                } else if ("PENDING".equals(p.status())) {
                    pendingRefund = pendingRefund.add(amount);
                }
            } else if ("DEPOSIT_OFFSET".equals(p.paymentMethod())) {
                if (success) {
                    depositOffset = depositOffset.add(amount);
                }
            } else if (success) {
                totalPaid = totalPaid.add(amount);
            } else if (isDebt(p)) {
                outstandingDebt = outstandingDebt.add(amount);
            }
        }

        List<CustomerPaymentsResponse.PaymentItem> debts = transactions.stream().filter(CustomerPaymentService::isDebt).toList();

        List<CustomerPaymentsResponse.OverdueItem> overdue = contracts.findAllByCustomerId(customerId).stream()
                .filter(c -> "OVERDUE".equals(c.getStatus()))
                .map(this::toOverdueItem)
                .toList();

        return new CustomerPaymentsResponse(
                new CustomerPaymentsResponse.Summary(totalPaid, totalRefunded, pendingRefund, outstandingDebt, depositOffset),
                debts, overdue, transactions);
    }

    // Khoản nợ khách tự trả online: phí sự cố / phí chiếm dụng vượt cọc còn PENDING (PR-O9, PR-Q14).
    // renewal_months != NULL là dòng phụ của link gia hạn đang chờ, không phải nợ.
    static boolean isDebt(CustomerPaymentsResponse.PaymentItem p) {
        return ("DAMAGE_FEE".equals(p.paymentType()) || "OVERSTAY_FEE".equals(p.paymentType())) && "VNPAY".equals(p.paymentMethod()) && "PENDING".equals(p.status()) && p.renewalMonths() == null;
    }

    private CustomerPaymentsResponse.OverdueItem toOverdueItem(RentalContract c) {
        var late = lateFeeService.calculateLateFee(c);
        String facilityName = c.getStorageUnit() != null && c.getStorageUnit().getFacility() != null
                ? c.getStorageUnit().getFacility().getName() : null;
        return new CustomerPaymentsResponse.OverdueItem(
                c.getId(),
                c.getContractCode(),
                c.getReservation() != null ? c.getReservation().getId() : null,
                facilityName,
                late.getOverdueDays(),
                late.getLateFeeAmount(),
                late.isLateFeeWaived(),
                late.getOverstayFeeAmount());
    }
}
