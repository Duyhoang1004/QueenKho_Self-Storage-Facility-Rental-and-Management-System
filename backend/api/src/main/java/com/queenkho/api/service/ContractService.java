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

@Service
public class ContractService {

    @Autowired
    private RentalContractRepository rentalContractRepository;

    @Autowired
    private com.queenkho.api.repository.ReservationRepository reservationRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private StaffTaskService staffTaskService;

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
            // UC-16: khách gia hạn → không trả kho nữa → huỷ task check-out đang mở
            staffTaskService.cancelOpenTasks(contract.getId(), "CHECK_OUT");
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

        // UC-16: chỉ hợp đồng đang thuê mới được yêu cầu trả kho
        if (!"ACTIVE".equals(contract.getStatus()) && !"OVERDUE".equals(contract.getStatus())) {
            throw new IllegalStateException("Hợp đồng không ở trạng thái có thể trả kho");
        }

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

        // Build notes
        StringBuilder noteBuilder = new StringBuilder();
        noteBuilder.append("HĐ: ").append(contract.getContractCode());
        if (contract.getCustomer() != null) {
            noteBuilder.append(" | Khách: ").append(contract.getCustomer().getFullName())
                    .append(" (SĐT: ").append(contract.getCustomer().getPhone() != null ? contract.getCustomer().getPhone() : "").append(")");
        }
        noteBuilder.append(" | Yêu cầu trả kho ngày: ").append(checkoutDate);
        if (request != null && request.getBankName() != null && !request.getBankName().isBlank()) {
            noteBuilder.append(" | Ngân hàng: ").append(request.getBankName().trim())
                    .append(" | STK: ").append(request.getBankAccountNumber() != null ? request.getBankAccountNumber().trim() : "")
                    .append(" | Chủ TK: ").append(request.getBankAccountName() != null ? request.getBankAccountName().trim().toUpperCase() : "");
        }
        if (request != null && request.getNotes() != null && !request.getNotes().isBlank()) {
            noteBuilder.append(" | Ghi chú: ").append(request.getNotes().trim());
        }
        String noteStr = noteBuilder.toString();

        // UC-16: sinh task CHECK_OUT cho nhân viên (biên bản do nhân viên lập khi check-out),
        // ghi chú chứa thông tin hoàn cọc
        staffTaskService.createCheckOutTask(contract, checkoutDate, noteStr);

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

