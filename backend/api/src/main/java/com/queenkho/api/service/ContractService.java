package com.queenkho.api.service;

import com.queenkho.api.dto.*;
import com.queenkho.api.entity.RentalContract;
import com.queenkho.api.entity.User;
import com.queenkho.api.exception.ContractException;
import com.queenkho.api.repository.RentalContractRepository;
import com.queenkho.api.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.text.NumberFormat;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import com.queenkho.api.entity.StaffTask;

@Service
public class ContractService {

    @Autowired
    private RentalContractRepository rentalContractRepository;

    @Autowired
    private com.queenkho.api.repository.ReservationRepository reservationRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private StaffTaskService staffTaskService;

    @Autowired
    private OverdueContractProcessor overdueContractProcessor;

    @Autowired
    private LateFeeService lateFeeService;

    @Autowired
    private com.queenkho.api.repository.StorageUnitRepository storageUnitRepository;

    @Autowired
    private com.queenkho.api.repository.StaffTaskRepository staffTaskRepository;


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
            // PR-O1: Cho phép hẹn từ ngày mai đến end_date + 5 ngày (ân hạn chuyển đồ, phí tính theo PR-O14)
            LocalDate maxAllowedDate = contract.getEndDate() != null ? contract.getEndDate().plusDays(5) : today.plusDays(30);
            if (checkoutDate.isAfter(maxAllowedDate)) {
                throw new IllegalArgumentException("Ngày hẹn trả kho không được vượt quá 5 ngày ân hạn sau khi hết hạn hợp đồng (" + maxAllowedDate + ").");
            }
        } else if ("OVERDUE".equals(contract.getStatus())) {
            // PR-O1: HĐ đang OVERDUE được hẹn trả kho trong 3 ngày tới
            LocalDate maxOverdueDate = today.plusDays(3);
            if (checkoutDate.isAfter(maxOverdueDate)) {
                throw new IllegalArgumentException("Hợp đồng đã quá hạn chỉ có thể hẹn trả kho trong tối đa 3 ngày tới (đến ngày " + maxOverdueDate + ").");
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

        // Build notes (PR-O3: Chuyển khoản hoặc Tiền mặt tại quầy)
        StringBuilder noteBuilder = new StringBuilder();
        noteBuilder.append(isAlreadyPending ? "Dời ngày trả kho sang ngày: " : "Yêu cầu trả kho ngày: ").append(checkoutDate);
        if (request != null && request.getBankName() != null && !request.getBankName().isBlank()) {
            noteBuilder.append(" | Hoàn cọc STK: ").append(request.getBankAccountNumber())
                    .append(" (").append(request.getBankName()).append(" - ").append(request.getBankAccountName()).append(")");
        } else {
            noteBuilder.append(" | Hoàn tiền: Nhận tiền mặt trực tiếp tại quầy");
        }
        if (request != null && request.getNotes() != null && !request.getNotes().isBlank()) {
            noteBuilder.append(" | Ghi chú: ").append(request.getNotes().trim());
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

        // Kiểm tra xem nhân viên đã hoàn tất nghiệm thu (CHECK_OUT) hoặc đã tạo task hoàn tiền (REFUND) chưa
        try {
            Integer refundCount = jdbcTemplate.queryForObject(
                    "SELECT COUNT(1) FROM facility_tasks WHERE contract_id = ? AND task_type = 'REFUND' AND status != 'CANCELLED'",
                    Integer.class, contract.getId());
            Integer handoverCount = jdbcTemplate.queryForObject(
                    "SELECT COUNT(1) FROM handover_records WHERE contract_id = ? AND record_type = 'CHECK_OUT'",
                    Integer.class, contract.getId());
            if ((refundCount != null && refundCount > 0) || (handoverCount != null && handoverCount > 0)) {
                throw new IllegalStateException("Khoang đã được nhân viên hoàn tất nghiệm thu bàn giao. Không thể hủy yêu cầu trả kho.");
            }
        } catch (IllegalStateException e) {
            throw e;
        } catch (Exception ignored) {
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
        staffTaskService.closeOpenSupportTicketsAndTasks(contract.getId());

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

    /**
     * Quét và xử lý tự động hợp đồng quá hạn (PR-Q1)
     * - Case 1: Hợp đồng ACTIVE có end_date < hôm nay -> chuyển OVERDUE (không có ân hạn nếu không hẹn trả kho)
     * - Case 2: Hợp đồng TERMINATION_PENDING có end_date + 5 ngày < hôm nay -> chuyển OVERDUE, hủy task CHECK_OUT, đơn về UNIT_ASSIGNED
     * - Ghi activity_logs bởi tài khoản 'system' (idempotent, không sinh log trùng trong cùng 1 ngày)
     */
    public static final java.time.ZoneId VIETNAM_ZONE = java.time.ZoneId.of("Asia/Ho_Chi_Minh");

    /**
     * Tự động quét và cập nhật các hợp đồng quá hạn (UC-28 / PR-Q1).
     * Mỗi hợp đồng được xử lý trong một Transaction riêng biệt thông qua bean
     * OverdueContractProcessor (tránh lỗi self-invocation, không rollback toàn bộ khi 1 HĐ lỗi).
     */
    public int markOverdueContracts() {
        LocalDate today = LocalDate.now(VIETNAM_ZONE);
        int totalUpdated = 0;

        // 1. Lấy ID của user 'system' (PR-A8)
        Integer systemUserId = null;
        try {
            List<Integer> ids = jdbcTemplate.query(
                    "SELECT id FROM users WHERE email = ?",
                    (rs, rowNum) -> rs.getInt("id"),
                    ActivityLogService.SYSTEM_EMAIL // UC-31: dùng chung 1 tài khoản system
            );
            if (!ids.isEmpty()) {
                systemUserId = ids.get(0);
            }
        } catch (Exception e) {
            System.err.println("[QueenKho Overdue Job] ⚠️ Lỗi truy vấn user system: " + e.getMessage());
        }

        if (systemUserId == null) {
            System.err.println("[QueenKho Overdue Job] ⚠️ CẢNH BÁO: Không tìm thấy tài khoản '" + ActivityLogService.SYSTEM_EMAIL + "' trong cơ sở dữ liệu. Bỏ qua ghi activity_logs để không ném lỗi.");
        }

        // =========================================================================
        // CASE 1: Hợp đồng ACTIVE có end_date < today -> chuyển OVERDUE (PR-Q1)
        // =========================================================================
        List<Map<String, Object>> activeExpired = jdbcTemplate.queryForList(
                "SELECT id, contract_code, end_date FROM rental_contracts WHERE status = 'ACTIVE' AND end_date < ?",
                today
        );

        for (Map<String, Object> row : activeExpired) {
            Integer contractId = ((Number) row.get("id")).intValue();
            String code = (String) row.get("contract_code");
            Object edObj = row.get("end_date");
            LocalDate endDate = edObj instanceof java.sql.Date ? ((java.sql.Date) edObj).toLocalDate()
                    : (edObj instanceof LocalDate ? (LocalDate) edObj : null);

            try {
                boolean updated = overdueContractProcessor.processActiveContract(contractId, code, endDate, systemUserId, today);
                if (updated) {
                    totalUpdated++;
                }
            } catch (Exception e) {
                System.err.println("[QueenKho Overdue Job] ❌ Lỗi xử lý HĐ ACTIVE ID " + contractId + ": " + e.getMessage());
            }
        }

        // =========================================================================
        // CASE 2: Hợp đồng TERMINATION_PENDING quá 5 ngày ân hạn (end_date + 5 < today) (PR-Q1)
        // =========================================================================
        List<Map<String, Object>> pendingExpired = jdbcTemplate.queryForList(
                "SELECT id, contract_code, end_date FROM rental_contracts " +
                        "WHERE status = 'TERMINATION_PENDING' AND end_date IS NOT NULL AND DATEADD(DAY, 5, end_date) < ?",
                today
        );

        for (Map<String, Object> row : pendingExpired) {
            Integer contractId = ((Number) row.get("id")).intValue();
            String code = (String) row.get("contract_code");

            try {
                boolean updated = overdueContractProcessor.processTerminationPendingContract(contractId, code, systemUserId, today);
                if (updated) {
                    totalUpdated++;
                }
            } catch (Exception e) {
                System.err.println("[QueenKho Overdue Job] ❌ Lỗi xử lý HĐ TERMINATION_PENDING ID " + contractId + ": " + e.getMessage());
            }
        }

        return totalUpdated;
    }

    /**
     * Lấy danh sách hợp đồng quá hạn của cơ sở do FM quản lý (UC-28 / PR-Q11)
     */
    /**
     * Lấy danh sách hợp đồng quá hạn hoặc đã thanh lý của cơ sở do FM quản lý (UC-28 / PR-Q11)
     */
    @Transactional(readOnly = true)
    public List<OverdueContractManagerResponse> getOverdueContractsForManager(Integer managerId, Integer facilityId, String statusParam) {
        if (managerId == null) {
            throw new ContractException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Thiếu thông tin người thao tác (managerId)");
        }
        User manager = userRepository.findById(managerId)
                .orElseThrow(() -> new ContractException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "Không tìm thấy tài khoản người thao tác"));

        String roleName = manager.getRole() != null ? manager.getRole().getName() : "";
        if (!"FACILITY_MANAGER".equals(roleName) && !"ADMIN".equals(roleName)) {
            throw new ContractException(HttpStatus.FORBIDDEN, "FORBIDDEN_ROLE", "Chỉ Quản lý cơ sở mới có quyền xem danh sách này");
        }

        Integer targetFacilityId = manager.getFacilityId();
        if ("ADMIN".equals(roleName) && facilityId != null) {
            targetFacilityId = facilityId;
        }

        if (targetFacilityId == null) {
            throw new ContractException(HttpStatus.BAD_REQUEST, "FACILITY_NOT_ASSIGNED", "Tài khoản Quản lý cơ sở chưa được gán cơ sở");
        }

        String targetStatus = "LIQUIDATED".equalsIgnoreCase(statusParam) ? "LIQUIDATED" : "OVERDUE";

        String sql = "SELECT " +
                "c.id AS contract_id, " +
                "c.contract_code, " +
                "u.full_name AS customer_name, " +
                "u.phone AS customer_phone, " +
                "su.id AS storage_unit_id, " +
                "ut.name AS unit_type_name, " +
                "c.end_date, " +
                "c.deposit_held_amount, " +
                "c.rental_policy_id, " +
                "c.status, " +
                "ISNULL(al.contact_count, 0) AS contact_count, " +
                "al.last_contact_at, " +
                "al.last_contact_action, " +
                "CASE WHEN EXISTS ( " +
                "    SELECT 1 FROM facility_tasks ft WHERE ft.contract_id = c.id AND ft.task_type = 'REFUND' " +
                ") THEN 1 ELSE 0 END AS refund_requested " +
                "FROM rental_contracts c " +
                "JOIN users u ON c.customer_id = u.id " +
                "JOIN storage_units su ON c.storage_unit_id = su.id " +
                "JOIN unit_types ut ON su.unit_type_id = ut.id " +
                "OUTER APPLY ( " +
                "    SELECT " +
                "        COUNT(1) AS contact_count, " +
                "        MAX(a.created_at) AS last_contact_at, " +
                "        (SELECT TOP 1 a2.action " +
                "         FROM activity_logs a2 " +
                "         WHERE a2.target_entity = 'rental_contracts' " +
                "           AND a2.target_id = CAST(c.id AS NVARCHAR(50)) " +
                "           AND LEFT(a2.action, 17) = '[OVERDUE_CONTACT]' " +
                "         ORDER BY a2.id DESC) AS last_contact_action " +
                "    FROM activity_logs a " +
                "    WHERE a.target_entity = 'rental_contracts' " +
                "      AND a.target_id = CAST(c.id AS NVARCHAR(50)) " +
                "      AND LEFT(a.action, 17) = '[OVERDUE_CONTACT]' " +
                ") al " +
                "WHERE su.facility_id = ? " +
                "  AND c.status = ? " +
                "ORDER BY c.end_date ASC, c.id ASC";

        return jdbcTemplate.query(sql, (rs, rowNum) -> {
            Integer contractId = rs.getInt("contract_id");
            String contractCode = rs.getString("contract_code");
            String customerName = rs.getString("customer_name");
            String customerPhone = rs.getString("customer_phone");
            String storageUnitId = rs.getString("storage_unit_id");
            String unitTypeName = rs.getString("unit_type_name");
            java.sql.Date edSql = rs.getDate("end_date");
            LocalDate endDate = edSql != null ? edSql.toLocalDate() : null;
            BigDecimal depositHeld = rs.getBigDecimal("deposit_held_amount");
            if (depositHeld == null) depositHeld = BigDecimal.ZERO;
            Integer policyId = rs.getObject("rental_policy_id") != null ? rs.getInt("rental_policy_id") : null;
            String status = rs.getString("status");
            boolean refundRequested = rs.getInt("refund_requested") == 1;

            int contactCount = rs.getInt("contact_count");
            java.sql.Timestamp lastContactTs = rs.getTimestamp("last_contact_at");
            LocalDateTime lastContactAt = lastContactTs != null ? lastContactTs.toLocalDateTime() : null;
            String lastContactAction = rs.getString("last_contact_action");

            String lastContactNote = null;
            if (lastContactAction != null) {
                String prefix = "[OVERDUE_CONTACT] HĐ " + contractCode + ": ";
                if (lastContactAction.startsWith(prefix)) {
                    lastContactNote = lastContactAction.substring(prefix.length());
                } else {
                    lastContactNote = lastContactAction;
                }
            }

            RentalContract dummyContract = new RentalContract();
            dummyContract.setId(contractId);
            dummyContract.setEndDate(endDate);
            dummyContract.setDepositHeldAmount(depositHeld);
            dummyContract.setRentalPolicyId(policyId);
            dummyContract.setStatus(status);

            LateFeeCalculationResult lateCalc = lateFeeService.calculateLateFee(dummyContract);

            BigDecimal lateFeeDisplay = lateCalc.getLateFeeAmount();
            boolean canLiquidate = lateCalc.isCanLiquidate();

            if ("LIQUIDATED".equalsIgnoreCase(status)) {
                canLiquidate = false;
                try {
                    List<BigDecimal> feeList = jdbcTemplate.query(
                            "SELECT amount FROM payment_transactions WHERE contract_id = ? AND payment_type = 'LATE_FEE' AND payment_method = 'DEPOSIT_OFFSET' ORDER BY id DESC",
                            (r, i) -> r.getBigDecimal("amount"),
                            contractId
                    );
                    if (!feeList.isEmpty() && feeList.get(0) != null) {
                        lateFeeDisplay = feeList.get(0);
                    }
                } catch (Exception ignored) {
                }
            }

            return OverdueContractManagerResponse.builder()
                    .contractId(contractId)
                    .contractCode(contractCode)
                    .customerName(customerName)
                    .customerPhone(customerPhone)
                    .storageUnitId(storageUnitId)
                    .unitTypeName(unitTypeName)
                    .endDate(endDate)
                    .overdueDays(lateCalc.getOverdueDays())
                    .lateFeeAmount(lateFeeDisplay)
                    .depositHeldAmount(depositHeld)
                    .canLiquidate(canLiquidate)
                    .liquidationDaysThreshold(lateCalc.getLiquidationDaysThreshold())
                    .contactCount(contactCount)
                    .lastContactNote(lastContactNote)
                    .lastContactAt(lastContactAt)
                    .refundRequested(refundRequested)
                    .status(status)
                    .build();
        }, targetFacilityId, targetStatus);
    }

    @Transactional(readOnly = true)
    public List<OverdueContractManagerResponse> getOverdueContractsForManager(Integer managerId, Integer facilityId) {
        return getOverdueContractsForManager(managerId, facilityId, "OVERDUE");
    }

    /**
     * Thêm nhật ký liên hệ khách hàng quá hạn (UC-28 / PR-Q11 / PR-A8)
     */
    @Transactional
    public void addOverdueContactLog(Integer contractId, CreateOverdueContactRequest request) {
        if (request == null || request.getManagerId() == null) {
            throw new ContractException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Thiếu thông tin người thao tác (managerId)");
        }
        if (request.getNote() == null || request.getNote().trim().isEmpty()) {
            throw new ContractException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Nội dung ghi chú liên hệ không được để trống");
        }
        if (request.getNote().trim().length() > 400) {
            throw new ContractException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Nội dung ghi chú không được vượt quá 400 ký tự");
        }

        User manager = userRepository.findById(request.getManagerId())
                .orElseThrow(() -> new ContractException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "Không tìm thấy tài khoản người thao tác"));

        String roleName = manager.getRole() != null ? manager.getRole().getName() : "";
        if (!"FACILITY_MANAGER".equals(roleName) && !"ADMIN".equals(roleName)) {
            throw new ContractException(HttpStatus.FORBIDDEN, "FORBIDDEN_ROLE", "Chỉ Quản lý cơ sở mới có quyền ghi chú liên hệ");
        }

        RentalContract contract = rentalContractRepository.findDetailById(contractId)
                .orElseThrow(() -> new ContractException(HttpStatus.NOT_FOUND, "CONTRACT_NOT_FOUND", "Không tìm thấy hợp đồng"));

        if (!"ADMIN".equals(roleName)) {
            Integer contractFacilityId = (contract.getStorageUnit() != null && contract.getStorageUnit().getFacility() != null)
                    ? contract.getStorageUnit().getFacility().getId() : null;
            if (manager.getFacilityId() == null || !manager.getFacilityId().equals(contractFacilityId)) {
                throw new ContractException(HttpStatus.FORBIDDEN, "FORBIDDEN_FACILITY", "Hợp đồng không thuộc cơ sở do bạn quản lý");
            }
        }

        if (!"OVERDUE".equalsIgnoreCase(contract.getStatus())) {
            throw new ContractException(HttpStatus.CONFLICT, "CONTRACT_NOT_OVERDUE", "Hợp đồng không ở trạng thái QUÁ HẠN (hiện tại: " + contract.getStatus() + ")");
        }

        String actionText = "[OVERDUE_CONTACT] HĐ " + contract.getContractCode() + ": " + request.getNote().trim();

        // Ghi trực tiếp vào activity_logs, ném lỗi và rollback nếu thất bại (không nuốt lỗi - ngoại lệ PR-A10)
        jdbcTemplate.update(
                "INSERT INTO activity_logs (user_id, action, target_entity, target_id, created_at) " +
                        "VALUES (?, ?, 'rental_contracts', ?, SYSDATETIME())",
                manager.getId(),
                actionText,
                String.valueOf(contract.getId())
        );
    }

    /**
     * Lấy danh sách nhật ký liên hệ của một hợp đồng quá hạn (UC-28 / PR-Q11 / PR-A8)
     */
    @Transactional(readOnly = true)
    public List<OverdueContactLogResponse> getOverdueContactLogs(Integer contractId, Integer managerId) {
        if (managerId == null) {
            throw new ContractException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Thiếu thông tin người thao tác (managerId)");
        }
        User manager = userRepository.findById(managerId)
                .orElseThrow(() -> new ContractException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "Không tìm thấy tài khoản người thao tác"));

        String roleName = manager.getRole() != null ? manager.getRole().getName() : "";
        if (!"FACILITY_MANAGER".equals(roleName) && !"ADMIN".equals(roleName)) {
            throw new ContractException(HttpStatus.FORBIDDEN, "FORBIDDEN_ROLE", "Chỉ Quản lý cơ sở mới có quyền xem danh sách này");
        }

        RentalContract contract = rentalContractRepository.findDetailById(contractId)
                .orElseThrow(() -> new ContractException(HttpStatus.NOT_FOUND, "CONTRACT_NOT_FOUND", "Không tìm thấy hợp đồng"));

        if (!"ADMIN".equals(roleName)) {
            Integer contractFacilityId = (contract.getStorageUnit() != null && contract.getStorageUnit().getFacility() != null)
                    ? contract.getStorageUnit().getFacility().getId() : null;
            if (manager.getFacilityId() == null || !manager.getFacilityId().equals(contractFacilityId)) {
                throw new ContractException(HttpStatus.FORBIDDEN, "FORBIDDEN_FACILITY", "Hợp đồng không thuộc cơ sở do bạn quản lý");
            }
        }

        String prefix = "[OVERDUE_CONTACT] HĐ " + contract.getContractCode() + ": ";

        return jdbcTemplate.query(
                "SELECT a.id, a.user_id, u.full_name AS manager_name, a.created_at, a.action " +
                        "FROM activity_logs a " +
                        "JOIN users u ON a.user_id = u.id " +
                        "WHERE a.target_entity = 'rental_contracts' AND a.target_id = ? " +
                        "  AND LEFT(a.action, 17) = '[OVERDUE_CONTACT]' " +
                        "ORDER BY a.id DESC",
                (rs, rowNum) -> {
                    String fullAction = rs.getString("action");
                    String note = fullAction;
                    if (fullAction != null && fullAction.startsWith(prefix)) {
                        note = fullAction.substring(prefix.length());
                    }
                    java.sql.Timestamp ts = rs.getTimestamp("created_at");
                    LocalDateTime createdAt = ts != null ? ts.toLocalDateTime() : null;
                    return OverdueContactLogResponse.builder()
                            .id(rs.getInt("id"))
                            .managerId(rs.getInt("user_id"))
                            .managerName(rs.getString("manager_name"))
                            .createdAt(createdAt)
                            .note(note)
                            .build();
                },
                String.valueOf(contractId)
        );
    }

    /**
     * Thanh lý hợp đồng quá hạn kéo dài (UC-28 / PR-Q8, PR-Q9, PR-Q10, D-09)
     */
    @Transactional
    public Map<String, Object> liquidateContract(Integer contractId, LiquidateContractRequest request) {
        if (request == null || request.getManagerId() == null) {
            throw new ContractException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Thiếu thông tin người thao tác (managerId)");
        }
        if (request.getNote() == null || request.getNote().trim().isEmpty() || request.getNote().trim().length() > 400) {
            throw new ContractException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Ghi chú thanh lý là bắt buộc và tối đa 400 ký tự");
        }

        User manager = userRepository.findById(request.getManagerId())
                .orElseThrow(() -> new ContractException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "Không tìm thấy tài khoản người thao tác"));

        String roleName = manager.getRole() != null ? manager.getRole().getName() : "";
        if (!"FACILITY_MANAGER".equals(roleName) && !"ADMIN".equals(roleName)) {
            throw new ContractException(HttpStatus.FORBIDDEN, "FORBIDDEN_ROLE", "Chỉ Quản lý cơ sở mới có quyền thực hiện thanh lý");
        }

        RentalContract contract = rentalContractRepository.findDetailById(contractId)
                .orElseThrow(() -> new ContractException(HttpStatus.NOT_FOUND, "CONTRACT_NOT_FOUND", "Không tìm thấy hợp đồng"));

        if (!"ADMIN".equals(roleName)) {
            Integer contractFacilityId = (contract.getStorageUnit() != null && contract.getStorageUnit().getFacility() != null)
                    ? contract.getStorageUnit().getFacility().getId() : null;
            if (manager.getFacilityId() == null || !manager.getFacilityId().equals(contractFacilityId)) {
                throw new ContractException(HttpStatus.FORBIDDEN, "FORBIDDEN_FACILITY", "Hợp đồng không thuộc cơ sở do bạn quản lý");
            }
        }

        if (!"OVERDUE".equalsIgnoreCase(contract.getStatus())) {
            throw new ContractException(HttpStatus.CONFLICT, "CONTRACT_NOT_OVERDUE", "Hợp đồng không ở trạng thái quá hạn (hiện tại: " + contract.getStatus() + ")");
        }

        var lateFeeCalc = lateFeeService.calculateLateFee(contract);
        if (!lateFeeCalc.isCanLiquidate()) {
            throw new ContractException(HttpStatus.CONFLICT, "LIQUIDATION_NOT_ALLOWED_YET",
                    "Hợp đồng chưa đủ số ngày để thanh lý (ngưỡng: " + lateFeeCalc.getLiquidationDaysThreshold() + " ngày, hiện tại: " + lateFeeCalc.getOverdueDays() + " ngày)");
        }

        BigDecimal depositHeld = contract.getDepositHeldAmount() != null ? contract.getDepositHeldAmount() : BigDecimal.ZERO;
        BigDecimal lateFee = lateFeeCalc.getLateFeeAmount(); // Đã trần 50% cọc
        BigDecimal remainingDeposit = depositHeld.subtract(lateFee).max(BigDecimal.ZERO);

        // 1. Cập nhật hợp đồng: LIQUIDATED, xóa pin & rfid, cập nhật deposit_held_amount
        contract.setStatus("LIQUIDATED");
        contract.setAccessPinCode(null);
        contract.setRfidCardCode(null);
        contract.setDepositHeldAmount(remainingDeposit);
        rentalContractRepository.save(contract);

        // 2. Cập nhật đơn đặt chỗ sang COMPLETED
        if (contract.getReservation() != null) {
            var res = contract.getReservation();
            res.setStatus("COMPLETED");
            reservationRepository.save(res);
        }

        // 3. Cập nhật ô kho sang MAINTENANCE
        if (contract.getStorageUnit() != null) {
            var unit = contract.getStorageUnit();
            unit.setStatus("MAINTENANCE");
            storageUnitRepository.save(unit);
        }

        // 4. Hủy task CHECK_OUT đang mở nếu có (UC-16)
        staffTaskService.cancelOpenTasks(contract.getId(), "CHECK_OUT");
        staffTaskService.closeOpenSupportTicketsAndTasks(contract.getId());

        // 5. Ghi 1 giao dịch payment_transactions loại LATE_FEE, phương thức DEPOSIT_OFFSET, trạng thái SUCCESS
        String feeTxnCode = "LATE-OFF-" + contract.getId() + "-" + (System.currentTimeMillis() % 100000);
        Integer customerId = contract.getCustomer() != null ? contract.getCustomer().getId() : null;
        Integer reservationId = contract.getReservation() != null ? contract.getReservation().getId() : null;
        jdbcTemplate.update(
                "INSERT INTO payment_transactions " +
                        "(transaction_code, user_id, reservation_id, contract_id, payment_type, payment_method, amount, status, paid_at) " +
                        "VALUES (?, ?, ?, ?, 'LATE_FEE', 'DEPOSIT_OFFSET', ?, 'SUCCESS', SYSDATETIME())",
                feeTxnCode, customerId, reservationId, contract.getId(), lateFee);

        // 6. Ghi activity_logs "[LIQUIDATION] HĐ <mã>: <note>" do chính FM ghi, KHÔNG nuốt lỗi ghi log
        String logAction = "[LIQUIDATION] HĐ " + contract.getContractCode() + ": " + request.getNote().trim();
        jdbcTemplate.update(
                "INSERT INTO activity_logs (user_id, action, target_entity, target_id, created_at) " +
                        "VALUES (?, ?, 'rental_contracts', ?, SYSDATETIME())",
                manager.getId(),
                logAction,
                String.valueOf(contract.getId())
        );

        return Map.of(
                "message", "Thanh lý hợp đồng thành công",
                "contractId", contract.getId(),
                "status", "LIQUIDATED",
                "lateFeeAmount", lateFee,
                "remainingDeposit", remainingDeposit
        );
    }

    /**
     * Tạo yêu cầu hoàn phần cọc còn lại sau khi thanh lý (UC-28 / PR-Q9)
     */
    @Transactional
    public Map<String, Object> refundRemainingDeposit(Integer contractId, Integer managerId) {
        if (managerId == null) {
            throw new ContractException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Thiếu thông tin người thao tác (managerId)");
        }
        User manager = userRepository.findById(managerId)
                .orElseThrow(() -> new ContractException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "Không tìm thấy tài khoản người thao tác"));

        String roleName = manager.getRole() != null ? manager.getRole().getName() : "";
        if (!"FACILITY_MANAGER".equals(roleName) && !"ADMIN".equals(roleName)) {
            throw new ContractException(HttpStatus.FORBIDDEN, "FORBIDDEN_ROLE", "Chỉ Quản lý cơ sở mới có quyền yêu cầu hoàn cọc");
        }

        RentalContract contract = rentalContractRepository.findDetailById(contractId)
                .orElseThrow(() -> new ContractException(HttpStatus.NOT_FOUND, "CONTRACT_NOT_FOUND", "Không tìm thấy hợp đồng"));

        if (!"ADMIN".equals(roleName)) {
            Integer contractFacilityId = (contract.getStorageUnit() != null && contract.getStorageUnit().getFacility() != null)
                    ? contract.getStorageUnit().getFacility().getId() : null;
            if (manager.getFacilityId() == null || !manager.getFacilityId().equals(contractFacilityId)) {
                throw new ContractException(HttpStatus.FORBIDDEN, "FORBIDDEN_FACILITY", "Hợp đồng không thuộc cơ sở do bạn quản lý");
            }
        }

        // Hợp đồng LIQUIDATED (409 CONTRACT_NOT_LIQUIDATED)
        if (!"LIQUIDATED".equalsIgnoreCase(contract.getStatus())) {
            throw new ContractException(HttpStatus.CONFLICT, "CONTRACT_NOT_LIQUIDATED", "Hợp đồng chưa được thanh lý (trạng thái: " + contract.getStatus() + ")");
        }

        // deposit_held_amount > 0 (409 NO_DEPOSIT_TO_REFUND)
        BigDecimal depositHeld = contract.getDepositHeldAmount();
        if (depositHeld == null || depositHeld.compareTo(BigDecimal.ZERO) <= 0) {
            throw new ContractException(HttpStatus.CONFLICT, "NO_DEPOSIT_TO_REFUND", "Hợp đồng không còn tiền cọc để hoàn trả");
        }

        // chưa có task REFUND nào của hợp đồng này (409 REFUND_ALREADY_REQUESTED)
        Integer existingTasks = jdbcTemplate.queryForObject(
                "SELECT COUNT(1) FROM facility_tasks WHERE contract_id = ? AND task_type = 'REFUND'",
                Integer.class,
                contractId
        );
        if (existingTasks != null && existingTasks > 0) {
            throw new ContractException(HttpStatus.CONFLICT, "REFUND_ALREADY_REQUESTED", "Đã có yêu cầu hoàn cọc cho hợp đồng này trước đó");
        }

        Integer facilityId = (contract.getStorageUnit() != null && contract.getStorageUnit().getFacility() != null)
                ? contract.getStorageUnit().getFacility().getId() : manager.getFacilityId();

        NumberFormat vndFmt = NumberFormat.getInstance(new Locale("vi", "VN"));
        String formattedRefund = vndFmt.format(depositHeld);
        String customerName = contract.getCustomer() != null ? contract.getCustomer().getFullName() : "";
        String customerPhone = contract.getCustomer() != null ? contract.getCustomer().getPhone() : "";

        // Ghi chú task đúng định dạng parser đọc được, chứa mã hợp đồng và số tiền hoàn.
        // TUYỆT ĐỐI không đưa mã đơn đặt chỗ (RES-...) vào ghi chú
        String refundNoteStr = "Hoàn tiền cọc thanh lý | HĐ: " + contract.getContractCode()
                + (customerName != null && !customerName.isBlank() ? " | Khách: " + customerName + (customerPhone != null && !customerPhone.isBlank() ? " (SĐT: " + customerPhone + ")" : "") : "")
                + " => Cọc hoàn: " + formattedRefund + "đ"
                + " => THỰC HOÀN " + formattedRefund + "đ | Quản lý yêu cầu hoàn cọc còn lại sau thanh lý";

        if (refundNoteStr.length() > 1000) {
            refundNoteStr = refundNoteStr.substring(0, 997) + "...";
        }

        LocalDateTime now = LocalDateTime.now(java.time.ZoneId.of("Asia/Ho_Chi_Minh"));
        LocalDateTime dueAt = now.plusHours(24);
        if (now.getDayOfWeek() == java.time.DayOfWeek.SUNDAY) {
            dueAt = now.plusDays(1).plusHours(24);
        } else if (dueAt.getDayOfWeek() == java.time.DayOfWeek.SUNDAY) {
            dueAt = dueAt.plusDays(1);
        }

        StaffTask refundTask = new StaffTask();
        refundTask.setFacilityId(facilityId);
        refundTask.setContract(contract);
        refundTask.setTaskType("REFUND");
        refundTask.setStatus("OPEN");
        refundTask.setStaff(manager);
        refundTask.setDueAt(dueAt);
        refundTask.setNote(refundNoteStr);
        staffTaskRepository.save(refundTask);

        // Tạo 1 giao dịch PENDING REFUND trong payment_transactions
        String refTxnCode = "REF-" + contract.getId() + "-" + (System.currentTimeMillis() % 100000);
        Integer customerId = contract.getCustomer() != null ? contract.getCustomer().getId() : null;
        jdbcTemplate.update(
                "INSERT INTO payment_transactions " +
                        "(transaction_code, user_id, reservation_id, contract_id, payment_type, payment_method, amount, status, paid_at) " +
                        "VALUES (?, ?, NULL, ?, 'REFUND', 'BANK_TRANSFER', ?, 'PENDING', NULL)",
                refTxnCode, customerId, contract.getId(), depositHeld);

        // KHÔNG tự đặt deposit_held_amount = 0 ở đây; trigger làm việc đó khi task hoàn tất.

        // Ghi activity log
        try {
            String action = "[REFUND_REQUEST] HĐ " + contract.getContractCode() + ": Quản lý " + manager.getFullName() + " tạo lệnh hoàn cọc còn lại " + formattedRefund + "đ (Task #" + refundTask.getId() + ")";
            jdbcTemplate.update(
                    "INSERT INTO activity_logs (user_id, action, target_entity, target_id, created_at) " +
                            "VALUES (?, ?, 'rental_contracts', ?, SYSDATETIME())",
                    manager.getId(), action, String.valueOf(contract.getId())
            );
        } catch (Exception e) {
            // Nuốt lỗi log refund_request per PR-A10
        }

        return Map.of(
                "message", "Đã tạo yêu cầu hoàn cọc thành công",
                "taskId", refundTask.getId(),
                "refundAmount", depositHeld
        );
    }
}

