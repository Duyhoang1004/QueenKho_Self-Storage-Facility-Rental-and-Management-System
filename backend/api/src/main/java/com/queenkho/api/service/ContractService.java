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

        // UC-16 & UC-22: chỉ hợp đồng ACTIVE, OVERDUE, hoặc TERMINATION_PENDING (để dời ngày) mới được yêu cầu trả kho
        if (!"ACTIVE".equals(contract.getStatus()) && !"OVERDUE".equals(contract.getStatus()) && !"TERMINATION_PENDING".equals(contract.getStatus())) {
            throw new IllegalStateException("Hợp đồng không ở trạng thái có thể trả kho");
        }

        LocalDate checkoutDate = (request != null && request.getCheckoutDate() != null)
                ? request.getCheckoutDate() : contract.getEndDate();
        if (checkoutDate == null) {
            checkoutDate = LocalDate.now();
        }

        LocalDate today = LocalDate.now();
        if (checkoutDate.isBefore(today)) {
            throw new IllegalArgumentException("Ngày hẹn trả kho không thể là ngày trong quá khứ (" + checkoutDate + ").");
        }

        boolean isAlreadyPending = "TERMINATION_PENDING".equals(contract.getStatus());

        // Kiểm tra business rule:
        if (isAlreadyPending) {
            // Nếu đã ở trạng thái TERMINATION_PENDING, không được dời ngày muộn hơn ngày đã hẹn trước đó
            LocalDate prevCheckoutDate = null;
            try {
                var dueAtTimestamp = jdbcTemplate.queryForObject(
                        "SELECT TOP 1 due_at FROM facility_tasks WHERE contract_id = ? AND task_type = 'CHECK_OUT' AND status IN ('OPEN', 'IN_PROGRESS', 'OVERDUE') ORDER BY id DESC",
                        java.sql.Timestamp.class,
                        contract.getId());
                if (dueAtTimestamp != null) {
                    prevCheckoutDate = dueAtTimestamp.toLocalDateTime().toLocalDate();
                }
            } catch (Exception ignored) {
            }
            if (prevCheckoutDate == null) {
                prevCheckoutDate = contract.getEndDate();
            }

            if (prevCheckoutDate != null && checkoutDate.isAfter(prevCheckoutDate)) {
                throw new IllegalArgumentException("Không thể dời ngày qua sau ngày trả kho đã thực hiện trước đó (" + prevCheckoutDate + ").");
            }
        } else if ("ACTIVE".equals(contract.getStatus())) {
            // HĐ đang ACTIVE: Không được hẹn ngày trả kho vượt quá ngày kết thúc HĐ
            if (contract.getEndDate() != null && checkoutDate.isAfter(contract.getEndDate())) {
                throw new IllegalArgumentException("Không thể hẹn ngày trả kho sau ngày kết thúc hợp đồng (" + contract.getEndDate() + "). Vui lòng chọn ngày trước hạn hoặc thực hiện gia hạn hợp đồng.");
            }
        } else if ("OVERDUE".equals(contract.getStatus())) {
            // HĐ đang OVERDUE: Đã quá hạn nên chỉ được hẹn trả kho ngay trong ngày hôm nay
            if (checkoutDate.isAfter(today)) {
                throw new IllegalArgumentException("Hợp đồng đã quá hạn, quý khách chỉ có thể hẹn trả kho trong ngày hôm nay (" + today + ").");
            }
        }

        contract.setStatus("TERMINATION_PENDING");
        rentalContractRepository.save(contract);

        if (contract.getReservation() != null) {
            var res = contract.getReservation();
            res.setStatus("TERMINATION_PENDING");
            reservationRepository.save(res);
        }
        try {
            jdbcTemplate.update(
                    "UPDATE reservations SET status = 'TERMINATION_PENDING' WHERE id = (SELECT reservation_id FROM rental_contracts WHERE id = ?)",
                    contract.getId());
        } catch (Exception ignored) {
        }

        // Build notes
        StringBuilder noteBuilder = new StringBuilder();
        noteBuilder.append(isAlreadyPending ? "Dời ngày trả kho sang ngày: " : "Yêu cầu trả kho ngày: ").append(checkoutDate);
        if (request != null && request.getBankName() != null && !request.getBankName().isBlank()) {
            noteBuilder.append(" | Hoàn cọc STK: ").append(request.getBankAccountNumber())
                    .append(" (").append(request.getBankName()).append(" - ").append(request.getBankAccountName()).append(")");
        }
        if (request != null && request.getNotes() != null && !request.getNotes().isBlank()) {
            noteBuilder.append(" | Ghi chú: ").append(request.getNotes());
        }
        String noteStr = noteBuilder.toString();

        if (isAlreadyPending) {
            // Dời lịch task CHECK_OUT đang mở và cập nhật ghi chú
            staffTaskService.rescheduleOpenTasks(contract.getId(), "CHECK_OUT", checkoutDate);
            try {
                jdbcTemplate.update(
                        "UPDATE facility_tasks SET note = ? WHERE contract_id = ? AND task_type = 'CHECK_OUT' AND status IN ('OPEN', 'IN_PROGRESS', 'OVERDUE')",
                        noteStr, contract.getId());
            } catch (Exception ignored) {
            }
        } else {
            // UC-16: sinh task CHECK_OUT cho nhân viên (biên bản do nhân viên lập khi check-out),
            // ghi chú chứa thông tin hoàn cọc
            staffTaskService.createCheckOutTask(contract, checkoutDate, noteStr);
        }

        // Log activity
        String logDesc = (isAlreadyPending ? "Dời ngày hẹn checkout cho HĐ " : "Yêu cầu trả kho và hẹn ngày checkout cho HĐ ")
                + contract.getContractCode() + " vào ngày " + checkoutDate;
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

        String responseMsg = isAlreadyPending
                ? "Dời ngày trả kho thành công sang ngày " + checkoutDate + "."
                : "Yêu cầu trả kho đã được tiếp nhận. Nhân viên sẽ tiến hành kiểm tra khoang vào ngày đã hẹn.";

        return new RequestCheckoutResponse(
                contract.getId(),
                contract.getContractCode(),
                checkoutDate,
                "TERMINATION_PENDING",
                responseMsg
        );
    }

    @Transactional
    public java.util.Map<String, Object> cancelCheckout(Integer contractId) {
        RentalContract contract = rentalContractRepository.findDetailById(contractId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy hợp đồng"));

        if (!"TERMINATION_PENDING".equals(contract.getStatus())) {
            throw new IllegalStateException("Hợp đồng không ở trạng thái chờ trả kho để có thể hủy");
        }

        // Khôi phục trạng thái ACTIVE (hoặc OVERDUE nếu ngày kết thúc đã qua)
        String newStatus = "ACTIVE";
        if (contract.getEndDate() != null && contract.getEndDate().isBefore(LocalDate.now())) {
            newStatus = "OVERDUE";
        }
        contract.setStatus(newStatus);
        rentalContractRepository.save(contract);

        // Đồng bộ trạng thái đơn đặt chỗ về UNIT_ASSIGNED
        if (contract.getReservation() != null) {
            var res = contract.getReservation();
            res.setStatus("UNIT_ASSIGNED");
            reservationRepository.save(res);
        }
        try {
            jdbcTemplate.update(
                    "UPDATE reservations SET status = 'UNIT_ASSIGNED' WHERE id = (SELECT reservation_id FROM rental_contracts WHERE id = ?)",
                    contract.getId());
        } catch (Exception ignored) {
        }

        // Hủy task CHECK_OUT đang mở trong staff_tasks
        staffTaskService.cancelOpenTasks(contract.getId(), "CHECK_OUT");

        // Ghi activity log
        String logDesc = "Khách hàng hủy yêu cầu trả kho cho HĐ " + contract.getContractCode() + ". Hợp đồng trở lại trạng thái " + newStatus;
        try {
            jdbcTemplate.update(
                    "INSERT INTO activity_logs (user_id, action, target_entity, target_id, created_at) " +
                            "VALUES (?, ?, 'rental_contracts', ?, SYSDATETIME())",
                    contract.getCustomer().getId(),
                    logDesc,
                    contract.getId()
            );
        } catch (Exception ignored) {
        }

        return java.util.Map.of(
                "contractId", contract.getId(),
                "contractCode", contract.getContractCode(),
                "status", newStatus,
                "message", "Đã hủy yêu cầu trả kho thành công. Hợp đồng trở lại trạng thái đang hoạt động."
        );
    }

    // Tự động quét và cập nhật các hợp đồng ACTIVE đã hết hạn sang OVERDUE
    @Transactional
    public int markOverdueContracts() {
        return rentalContractRepository.markOverdueContracts(LocalDate.now());
    }
}

