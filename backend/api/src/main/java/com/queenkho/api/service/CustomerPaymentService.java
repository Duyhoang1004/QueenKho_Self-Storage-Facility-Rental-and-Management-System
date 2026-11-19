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
            "LEFT JOIN compensation_claims cc ON cc.id = (" +
            "    SELECT TOP 1 cc2.id FROM compensation_claims cc2 " +
            "    WHERE p.payment_type = 'COMPENSATION' " +
            "      AND (" +
            "          (p.transaction_code LIKE 'BT-PAY-%-%' AND cc2.id = TRY_CAST(SUBSTRING(p.transaction_code, 8, CHARINDEX('-', p.transaction_code, 8) - 8) AS INT)) " +
            "          OR cc2.contract_id = p.contract_id " +
            "      ) " +
            "    ORDER BY cc2.id DESC" +
            ") " +
            "LEFT JOIN facility_tasks t ON t.id = (" +
            "    SELECT TOP 1 t2.id FROM facility_tasks t2 " +
            "    WHERE p.payment_type = 'REFUND' " +
            "      AND t2.task_type = 'REFUND' " +
            "      AND (" +
            "          (t2.contract_id IS NOT NULL AND t2.contract_id = p.contract_id) " +
            "          OR (r.reservation_code IS NOT NULL AND t2.note LIKE '%' + r.reservation_code + '%') " +
            "      ) " +
            "    ORDER BY t2.id DESC" +
            ") " +
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
                        "v.discount_type AS voucher_discount_type, v.discount_value AS voucher_discount_value, " +
                        "cc.goods_compensation, cc.penalty_amount AS claim_penalty_amount, cc.rent_refund_amount AS claim_rent_refund, " +
                        "cc.damage_percent, cc.decision_note, " +
                        "t.note AS task_note, c.deposit_held_amount, " +
                        "(SELECT SUM(p2.amount) FROM payment_transactions p2 WHERE p2.contract_id = p.contract_id AND p2.payment_type = 'DAMAGE_FEE' AND p2.payment_method = 'DEPOSIT_OFFSET') AS damage_offset, " +
                        "(SELECT SUM(p2.amount) FROM payment_transactions p2 WHERE p2.contract_id = p.contract_id AND p2.payment_type = 'LATE_FEE' AND p2.payment_method = 'DEPOSIT_OFFSET') AS late_fee_offset, " +
                        "(SELECT SUM(p2.amount) FROM payment_transactions p2 WHERE p2.contract_id = p.contract_id AND p2.payment_type = 'OVERSTAY_FEE' AND p2.payment_method = 'DEPOSIT_OFFSET') AS overstay_offset " +
                        MY_PAYMENTS + "ORDER BY p.id DESC",
                (rs, i) -> {
                    Timestamp paidAt = rs.getTimestamp("paid_at");
                    String paymentType = rs.getString("payment_type");
                    BigDecimal amount = rs.getBigDecimal("amount");
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

                    // Bóc tách chi tiết hoàn tiền & bồi thường
                    BigDecimal goodsCompensation = null;
                    BigDecimal penaltyCompensation = null;
                    BigDecimal rentRefundCompensation = null;
                    Integer damagePercent = null;
                    String compensationReason = null;

                    BigDecimal refundDepositAmount = null;
                    BigDecimal earlyRentRefund = null;
                    BigDecimal damageDeduction = null;
                    BigDecimal lateFeeDeduction = null;
                    BigDecimal overstayDeduction = null;
                    BigDecimal breakFeeDeduction = null;
                    String refundDescription = null;

                    if ("COMPENSATION".equalsIgnoreCase(paymentType)) {
                        goodsCompensation = rs.getBigDecimal("goods_compensation");
                        penaltyCompensation = rs.getBigDecimal("claim_penalty_amount");
                        rentRefundCompensation = rs.getBigDecimal("claim_rent_refund");
                        damagePercent = (Integer) rs.getObject("damage_percent");
                        compensationReason = rs.getString("decision_note");

                        if (goodsCompensation == null) {
                            goodsCompensation = amount != null ? amount : BigDecimal.ZERO;
                        }
                        if (penaltyCompensation == null) {
                            penaltyCompensation = BigDecimal.ZERO;
                        }
                        if (rentRefundCompensation == null) {
                            rentRefundCompensation = BigDecimal.ZERO;
                        }
                        if (damagePercent == null) {
                            damagePercent = 100;
                        }
                    } else if ("REFUND".equalsIgnoreCase(paymentType)) {
                        BigDecimal held = rs.getBigDecimal("deposit_held_amount");
                        if (held == null || held.compareTo(BigDecimal.ZERO) <= 0) {
                            held = depositAmount;
                        }
                        refundDepositAmount = held != null ? held : (amount != null ? amount : BigDecimal.ZERO);
                        damageDeduction = rs.getBigDecimal("damage_offset") != null ? rs.getBigDecimal("damage_offset") : BigDecimal.ZERO;
                        lateFeeDeduction = rs.getBigDecimal("late_fee_offset") != null ? rs.getBigDecimal("late_fee_offset") : BigDecimal.ZERO;
                        overstayDeduction = rs.getBigDecimal("overstay_offset") != null ? rs.getBigDecimal("overstay_offset") : BigDecimal.ZERO;
                        breakFeeDeduction = BigDecimal.ZERO;

                        BigDecimal netDepositAfterOffsets = refundDepositAmount
                                .subtract(damageDeduction)
                                .subtract(lateFeeDeduction)
                                .subtract(overstayDeduction);

                        if (amount != null && amount.compareTo(netDepositAfterOffsets) > 0) {
                            earlyRentRefund = amount.subtract(netDepositAfterOffsets);
                        } else {
                            earlyRentRefund = BigDecimal.ZERO;
                            if (amount != null && netDepositAfterOffsets.compareTo(amount) > 0) {
                                breakFeeDeduction = netDepositAfterOffsets.subtract(amount);
                            }
                        }
                        refundDescription = rs.getString("task_note");
                    }

                    return new CustomerPaymentsResponse.PaymentItem(
                            rs.getInt("id"),
                            rs.getString("transaction_code"),
                            rs.getString("bank_transaction_code"),
                            paymentType,
                            rs.getString("payment_method"),
                            amount,
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
                            voucherDiscountPercent,
                            goodsCompensation,
                            penaltyCompensation,
                            rentRefundCompensation,
                            damagePercent,
                            compensationReason,
                            refundDepositAmount,
                            earlyRentRefund,
                            damageDeduction,
                            lateFeeDeduction,
                            overstayDeduction,
                            breakFeeDeduction,
                            refundDescription);
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
