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
                    "r.duration_months, r.status, r.created_at, r.rent_discount_percent, ut.base_price_monthly " +
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
            return jdbcTemplate.queryForMap("SELECT p.status, p.payment_type, p.amount AS payment_amount, p.paid_at, " +
                    "p.bank_transaction_code, p.reservation_id, r.reservation_code, r.start_date, r.duration_months, r.deposit_amount, r.storage_unit_id, " +
                    "r.status AS reservation_status, u.full_name AS customer_name, u.phone AS customer_phone, " +
                    "u.email AS customer_email, u.cccd AS customer_cccd, f.name AS facility_name, " +
                    "f.address AS facility_address, f.hotline AS facility_hotline, ut.name AS unit_type_name, " +
                    "ut.area_sqm, ut.dimensions, su.floor AS storage_unit_floor, su.zone AS storage_unit_zone, " +
                    "su.room_number AS storage_unit_room_number, " +
                    "(SELECT TOP 1 rp.status FROM payment_transactions rp " +
                    " WHERE rp.transaction_code = CONCAT('REF-LATE-', p.transaction_code)) AS refund_status " +
                    "FROM payment_transactions p " +
                    "LEFT JOIN reservations r ON r.id = p.reservation_id " +
                    "LEFT JOIN users u ON u.id = r.customer_id " +
                    "LEFT JOIN facilities f ON f.id = r.facility_id " +
                    "LEFT JOIN unit_types ut ON ut.id = r.unit_type_id " +
                    "LEFT JOIN storage_units su ON su.id = r.storage_unit_id " +
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
                "AND payment_type IN ('MONTHLY_RENT', 'LATE_FEE', 'OVERSTAY_FEE') AND status = 'PENDING' AND (payment_type <> 'OVERSTAY_FEE' OR renewal_months IS NOT NULL)",
                contractId);
    }

    public void updatePayment(String ref, String status) {
        updatePayment(ref, status, null);
    }

    public void updatePayment(String ref, String status, String bankTransactionCode) {
        jdbcTemplate.update("UPDATE payment_transactions SET status = ?, " +
                "paid_at = CASE WHEN ? = 'FAILED' THEN NULL ELSE SYSDATETIME() END, " +
                "bank_transaction_code = COALESCE(?, bank_transaction_code) " +
                "WHERE transaction_code = ? AND payment_method = 'VNPAY'", status, status, bankTransactionCode, ref);
    }

    public void updateReservationToCancelled(Integer reservationId) {
        jdbcTemplate.update("UPDATE reservations SET status = 'CANCELLED' WHERE id = ?", reservationId);
    }
}
