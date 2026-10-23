package com.queenkho.api.repository;

import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.Map;

@Repository
public class PaymentRepository {

    private final JdbcTemplate jdbcTemplate;

    public PaymentRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public Map<String, Object> findReservation(Integer reservationId) {
        return findReservation(reservationId, false);
    }

    public Map<String, Object> findReservation(Integer reservationId, boolean lock) {
        try {
            return jdbcTemplate.queryForMap(
                    "SELECT r.id, r.reservation_code, r.customer_id, r.facility_id, r.deposit_amount, " +
                    "r.duration_months, r.status, r.created_at, ut.base_price_monthly " +
                    "FROM reservations r " + (lock ? "WITH (UPDLOCK, ROWLOCK) " : "") +
                    "JOIN unit_types ut ON ut.id = r.unit_type_id WHERE r.id = ?",
                    reservationId);
        } catch (EmptyResultDataAccessException e) {
            return null;
        }
    }



    public void updateReservationToDepositPaid(Integer reservationId, BigDecimal depositAmount) {
        jdbcTemplate.update(
                "UPDATE reservations SET status = 'DEPOSIT_PAID', total_deposit_paid = ? WHERE id = ?",
                depositAmount, reservationId);
    }



    public void createPending(String ref, Object userId, Integer reservationId, Integer contractId,
                              String type, BigDecimal amount) {
        createPending(ref, userId, reservationId, contractId, type, amount, null);
    }

    public void createPending(String ref, Object userId, Integer reservationId, Integer contractId,
                              String type, BigDecimal amount, Integer renewalMonths) {
        jdbcTemplate.update("INSERT INTO payment_transactions " +
                        "(transaction_code, user_id, reservation_id, contract_id, payment_type, payment_method, amount, renewal_months, status) " +
                        "VALUES (?, ?, ?, ?, ?, 'VNPAY', ?, ?, 'PENDING')",
                ref, userId, reservationId, contractId, type, amount, renewalMonths);
    }

    public Map<String, Object> findPayment(String ref, boolean lock) {
        String sql = "SELECT * FROM payment_transactions " + (lock ? "WITH (UPDLOCK, ROWLOCK) " : "") +
                "WHERE transaction_code = ? AND payment_method = 'VNPAY'";
        try {
            return jdbcTemplate.queryForMap(sql, ref);
        } catch (EmptyResultDataAccessException e) {
            return null;
        }
    }

    public Map<String, Object> paymentStatus(String ref) {
        try {
            return jdbcTemplate.queryForMap("SELECT p.status, p.payment_type, r.status AS reservation_status, " +
                    "(SELECT TOP 1 rp.status FROM payment_transactions rp " +
                    " WHERE rp.transaction_code = CONCAT('REF-LATE-', p.transaction_code)) AS refund_status " +
                    "FROM payment_transactions p JOIN reservations r ON r.id = p.reservation_id " +
                    "WHERE p.transaction_code = ? AND p.payment_method = 'VNPAY'", ref);
        } catch (EmptyResultDataAccessException e) {
            return null;
        }
    }

    public void failPendingReservationPayments(Integer reservationId) {
        jdbcTemplate.update(
                "UPDATE payment_transactions SET status = 'FAILED', paid_at = NULL " +
                "WHERE reservation_id = ? AND payment_method = 'VNPAY' AND payment_type = 'DEPOSIT' AND status = 'PENDING'",
                reservationId);
    }

    public void failPendingRenewalPayments(Integer contractId) {
        jdbcTemplate.update(
                "UPDATE payment_transactions SET status = 'FAILED', paid_at = NULL " +
                "WHERE contract_id = ? AND payment_method = 'VNPAY' " +
                "AND payment_type IN ('MONTHLY_RENT', 'LATE_FEE') AND status = 'PENDING'",
                contractId);
    }

    public void updatePayment(String ref, String status) {
        jdbcTemplate.update("UPDATE payment_transactions SET status = ?, paid_at = CASE WHEN ? = 'FAILED' THEN NULL ELSE SYSDATETIME() END " +
                "WHERE transaction_code = ? AND payment_method = 'VNPAY'", status, status, ref);
    }

    public void updateReservationToCancelled(Integer reservationId) {
        jdbcTemplate.update("UPDATE reservations SET status = 'CANCELLED' WHERE id = ?", reservationId);
    }
}

