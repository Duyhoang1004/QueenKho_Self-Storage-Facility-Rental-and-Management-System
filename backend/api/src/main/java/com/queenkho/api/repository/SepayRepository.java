package com.queenkho.api.repository;

import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.Map;

@Repository
public class SepayRepository {

    private final JdbcTemplate jdbcTemplate;

    public SepayRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public Map<String, Object> findReservation(Integer reservationId) {
        try {
            return jdbcTemplate.queryForMap(
                    "SELECT r.id, r.reservation_code, r.customer_id, r.deposit_amount, r.duration_months, r.status, ut.base_price_monthly " +
                    "FROM reservations r JOIN unit_types ut ON ut.id = r.unit_type_id WHERE r.id = ?",
                    reservationId);
        } catch (EmptyResultDataAccessException e) {
            return null;
        }
    }



    public void updateReservationToDepositPaid(Integer reservationId, BigDecimal depositAmount) {
        jdbcTemplate.update(
                "UPDATE reservations SET status = 'DEPOSIT_PAID', deposit_amount = ?, total_deposit_paid = ? WHERE id = ?",
                depositAmount, depositAmount, reservationId);
    }

    public void insertSuccessfulPayment(String transactionCode, Object userId, Integer reservationId, String paymentMethod, BigDecimal amount) {
        jdbcTemplate.update(
                "INSERT INTO payment_transactions (transaction_code, user_id, reservation_id, contract_id, payment_type, payment_method, amount, status, paid_at) " +
                "VALUES (?, ?, ?, NULL, 'DEPOSIT', ?, ?, 'SUCCESS', SYSDATETIME())",
                transactionCode, userId, reservationId, paymentMethod, amount);
    }

    public void insertLatePaymentForRefund(String transactionCode, Object userId, Integer reservationId, String paymentMethod, BigDecimal amount) {
        jdbcTemplate.update(
                "INSERT INTO payment_transactions (transaction_code, user_id, reservation_id, contract_id, payment_type, payment_method, amount, status, paid_at) " +
                "VALUES (?, ?, ?, NULL, 'LATE_PAYMENT', ?, ?, 'NEEDS_REFUND', SYSDATETIME())",
                transactionCode, userId, reservationId, paymentMethod, amount);
    }

    public void updateReservationToRefundPending(Integer reservationId) {
        jdbcTemplate.update("UPDATE reservations SET status = 'REFUND_PENDING' WHERE id = ?", reservationId);
    }
}
