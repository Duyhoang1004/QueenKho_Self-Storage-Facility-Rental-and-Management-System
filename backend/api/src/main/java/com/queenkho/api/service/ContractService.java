package com.queenkho.api.service;

import com.queenkho.api.dto.RenewContractRequest;
import com.queenkho.api.dto.RenewContractResponse;
import com.queenkho.api.dto.RequestCheckoutRequest;
import com.queenkho.api.dto.RequestCheckoutResponse;
import com.queenkho.api.entity.RentalContract;
import com.queenkho.api.repository.RentalContractRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Service
public class ContractService {

    @Autowired
    private RentalContractRepository rentalContractRepository;

    @Autowired
    private com.queenkho.api.repository.ReservationRepository reservationRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Transactional
    public RenewContractResponse renewContract(Integer contractId, RenewContractRequest request) {
        RentalContract contract = rentalContractRepository.findDetailById(contractId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy hợp đồng"));

        int months = (request != null && request.getMonths() != null && request.getMonths() > 0)
                ? request.getMonths() : 1;

        LocalDate currentEnd = contract.getEndDate();
        LocalDate newEndDate;
        if (currentEnd == null || currentEnd.isBefore(LocalDate.now())) {
            newEndDate = LocalDate.now().plusMonths(months);
        } else {
            newEndDate = currentEnd.plusMonths(months);
        }

        BigDecimal baseMonthly = BigDecimal.ZERO;
        if (contract.getStorageUnit() != null && contract.getStorageUnit().getUnitType() != null) {
            baseMonthly = contract.getStorageUnit().getUnitType().getBasePriceMonthly();
            if (baseMonthly == null) {
                baseMonthly = BigDecimal.ZERO;
            }
        }

        BigDecimal subtotal = baseMonthly.multiply(BigDecimal.valueOf(months));
        BigDecimal discount = BigDecimal.ZERO;
        if (months >= 12) {
            discount = subtotal.multiply(BigDecimal.valueOf(0.10));
        } else if (months >= 6) {
            discount = subtotal.multiply(BigDecimal.valueOf(0.05));
        }
        BigDecimal amountPaid = subtotal.subtract(discount);

        contract.setEndDate(newEndDate);
        if ("OVERDUE".equalsIgnoreCase(contract.getStatus()) || "TERMINATION_PENDING".equalsIgnoreCase(contract.getStatus())) {
            contract.setStatus("ACTIVE");
            if (contract.getReservation() != null) {
                var res = contract.getReservation();
                res.setStatus("UNIT_ASSIGNED");
                reservationRepository.save(res);
            }
        }
        rentalContractRepository.save(contract);

        // Record payment transaction
        String method = (request != null && request.getPaymentMethod() != null && !request.getPaymentMethod().isBlank())
                ? request.getPaymentMethod() : "VIETQR";
        String txnCode = "RNW-" + contract.getContractCode() + "-" + (System.currentTimeMillis() % 100000);

        try {
            jdbcTemplate.update(
                    "INSERT INTO payment_transactions " +
                            "(transaction_code, user_id, reservation_id, contract_id, payment_type, payment_method, amount, status, paid_at) " +
                            "VALUES (?, ?, ?, ?, 'MONTHLY_RENT', ?, ?, 'SUCCESS', SYSDATETIME())",
                    txnCode,
                    contract.getCustomer().getId(),
                    contract.getReservation() != null ? contract.getReservation().getId() : null,
                    contract.getId(),
                    method,
                    amountPaid
            );
        } catch (Exception e) {
            // fallback if payment table insert encounters non-blocking error
        }

        // Log activity
        String logDesc = "Gia hạn hợp đồng " + contract.getContractCode() + " thêm " + months + " tháng. Hạn mới: " + newEndDate;
        try {
            jdbcTemplate.update(
                    "INSERT INTO activity_logs (user_id, action, target_entity, target_id, created_at) " +
                            "VALUES (?, ?, 'rental_contracts', ?, SYSDATETIME())",
                    contract.getCustomer().getId(),
                    logDesc,
                    contract.getId()
            );
        } catch (Exception e) {
            // ignore log error
        }

        return new RenewContractResponse(
                contract.getId(),
                contract.getContractCode(),
                newEndDate,
                months,
                amountPaid,
                "Gia hạn hợp đồng thành công"
        );
    }

    @Transactional
    public RequestCheckoutResponse requestCheckout(Integer contractId, RequestCheckoutRequest request) {
        RentalContract contract = rentalContractRepository.findDetailById(contractId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy hợp đồng"));

        LocalDate checkoutDate = (request != null && request.getCheckoutDate() != null)
                ? request.getCheckoutDate() : contract.getEndDate();
        if (checkoutDate == null) {
            checkoutDate = LocalDate.now();
        }

        contract.setStatus("TERMINATION_PENDING");
        rentalContractRepository.save(contract);

        if (contract.getReservation() != null) {
            var res = contract.getReservation();
            res.setStatus("TERMINATION_PENDING");
            reservationRepository.save(res);
        }

        // Find staff id for handover record
        Integer staffId = null;
        Integer facilityId = (contract.getStorageUnit() != null && contract.getStorageUnit().getFacility() != null)
                ? contract.getStorageUnit().getFacility().getId() : null;

        if (facilityId != null) {
            List<Integer> staffIds = jdbcTemplate.query(
                    "SELECT TOP 1 u.id FROM users u WHERE u.facility_id = ? AND u.status = 'ACTIVE'",
                    (rs, rowNum) -> rs.getInt(1),
                    facilityId
            );
            if (!staffIds.isEmpty()) {
                staffId = staffIds.get(0);
            }
        }
        if (staffId == null) {
            List<Integer> anyStaff = jdbcTemplate.query(
                    "SELECT TOP 1 u.id FROM users u WHERE u.status = 'ACTIVE'",
                    (rs, rowNum) -> rs.getInt(1)
            );
            staffId = !anyStaff.isEmpty() ? anyStaff.get(0) : 1;
        }

        // Build notes
        StringBuilder noteBuilder = new StringBuilder();
        noteBuilder.append("Yêu cầu trả kho ngày: ").append(checkoutDate);
        if (request != null && request.getBankName() != null && !request.getBankName().isBlank()) {
            noteBuilder.append(" | Hoàn cọc STK: ").append(request.getBankAccountNumber())
                    .append(" (").append(request.getBankName()).append(" - ").append(request.getBankAccountName()).append(")");
        }
        if (request != null && request.getNotes() != null && !request.getNotes().isBlank()) {
            noteBuilder.append(" | Ghi chú: ").append(request.getNotes());
        }
        String noteStr = noteBuilder.toString();

        try {
            jdbcTemplate.update(
                    "INSERT INTO handover_records " +
                            "(contract_id, staff_id, record_type, is_identity_verified, is_empty, is_clean, is_lock_intact, customer_signature_confirmed, notes, created_at) " +
                            "VALUES (?, ?, 'CHECK_OUT', 0, 1, 1, 1, 0, ?, SYSDATETIME())",
                    contract.getId(),
                    staffId,
                    noteStr
            );
        } catch (Exception e) {
            // fallback
        }

        // Log activity
        String logDesc = "Yêu cầu trả kho và hẹn ngày checkout cho HĐ " + contract.getContractCode() + " vào ngày " + checkoutDate;
        try {
            jdbcTemplate.update(
                    "INSERT INTO activity_logs (user_id, action, target_entity, target_id, created_at) " +
                            "VALUES (?, ?, 'rental_contracts', ?, SYSDATETIME())",
                    contract.getCustomer().getId(),
                    logDesc,
                    contract.getId()
            );
        } catch (Exception e) {
            // ignore log error
        }

        return new RequestCheckoutResponse(
                contract.getId(),
                contract.getContractCode(),
                checkoutDate,
                "TERMINATION_PENDING",
                "Yêu cầu trả kho đã được tiếp nhận. Nhân viên sẽ tiến hành kiểm tra khoang vào ngày đã hẹn."
        );
    }
}

