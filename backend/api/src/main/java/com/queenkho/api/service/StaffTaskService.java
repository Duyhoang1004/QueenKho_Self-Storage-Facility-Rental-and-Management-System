package com.queenkho.api.service;

import com.queenkho.api.dto.CheckInRequest;
import com.queenkho.api.dto.CheckOutRequest;
import com.queenkho.api.dto.CompleteMaintenanceRequest;
import com.queenkho.api.dto.CompleteRefundRequest;
import com.queenkho.api.dto.ContactReportRequest;
import com.queenkho.api.dto.DamageCaseResponse;
import com.queenkho.api.dto.ExtendSupportTaskRequest;
import com.queenkho.api.dto.HandoverRecordResponse;
import com.queenkho.api.dto.RefundCalculationResult;
import com.queenkho.api.dto.ResolveSupportTaskRequest;
import com.queenkho.api.dto.StaffTaskDetailResponse;
import com.queenkho.api.dto.StaffTaskResponse;
import com.queenkho.api.entity.DamageCase;
import com.queenkho.api.entity.HandoverRecord;
import com.queenkho.api.entity.HeldGoods;
import com.queenkho.api.entity.RentalContract;
import com.queenkho.api.entity.StaffTask;
import com.queenkho.api.entity.StorageUnit;
import com.queenkho.api.entity.SupportRequest;
import com.queenkho.api.entity.User;
import com.queenkho.api.exception.StaffTaskException;
import com.queenkho.api.repository.DamageCaseRepository;
import com.queenkho.api.repository.FacilityRepository;
import com.queenkho.api.repository.HeldGoodsRepository;
import com.queenkho.api.repository.HandoverRecordRepository;
import com.queenkho.api.repository.RentalContractRepository;
import com.queenkho.api.repository.ReservationRepository;
import com.queenkho.api.repository.StaffTaskRepository;
import com.queenkho.api.repository.StorageUnitRepository;
import com.queenkho.api.repository.SupportRequestRepository;
import com.queenkho.api.repository.UserRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.security.SecureRandom;
import java.text.NumberFormat;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.Period;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

@Service
public class StaffTaskService {

    // Giờ đóng cửa: hạn chót của mọi task
    private static final LocalTime CLOSING_TIME = LocalTime.of(21, 0);
    // Các trạng thái được coi là "task chưa đóng" (kể cả quá hạn — Manager vẫn phải
    // xử lý)
    private static final List<String> OPEN_STATUSES = List.of("OPEN", "IN_PROGRESS", "OVERDUE");
    private static final List<String> VALID_STATUSES = List.of("OPEN", "IN_PROGRESS", "OVERDUE", "COMPLETED",
            "CANCELLED");

    // UC-18: hợp đồng "còn hiệu lực" — PIN / thẻ RFID của chúng không được cấp
    // trùng
    private static final List<String> LIVE_CONTRACT_STATUSES = List.of("ACTIVE", "OVERDUE", "TERMINATION_PENDING");
    private static final int PIN_MAX_ATTEMPTS = 20;
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String IMG_DELIMITER = "\n|||\n";
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter TS_FMT = DateTimeFormatter.ofPattern("HH:mm dd/MM/yyyy");
    // UC-24: ai chịu lỗi sự cố — CUSTOMER trừ cọc, FACILITY cơ sở tự chịu
    private static final List<String> LIABLE_PARTIES = List.of("CUSTOMER", "FACILITY");
    // PR-O10: số ngày cho task bảo trì (sửa chữa thường lâu hơn 1 ngày)
    private static final int MAINTENANCE_DUE_DAYS = 3;

    @Autowired
    private StaffTaskRepository staffTaskRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RentalContractRepository rentalContractRepository;

    @Autowired
    private FacilityRepository facilityRepository;

    @Autowired
    private HandoverRecordRepository handoverRecordRepository;

    @Autowired
    private DamageCaseRepository damageCaseRepository;

    @Autowired
    private StorageUnitRepository storageUnitRepository;

    @Autowired
    private ReservationRepository reservationRepository;

    @Autowired
    private SupportRequestRepository supportRequestRepository;

    @Autowired
    private ActivityLogService activityLogService;

    @Autowired
    private HeldGoodsService heldGoodsService;

    @Autowired
    private HeldGoodsRepository heldGoodsRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @PersistenceContext
    private EntityManager entityManager;

    // ================== SINH TASK (gọi từ service khác) ==================

    // UC-16: sinh task CHECK_IN — gọi trong UC-14 sau khi tạo hợp đồng
    @Transactional
    public void createCheckInTask(RentalContract contract) {
        // Ngày khách hẹn đến; không có giờ hẹn thì lấy ngày bắt đầu thuê
        LocalDate appointmentDate = contract.getStartDate();
        if (contract.getReservation() != null && contract.getReservation().getExpectedAppointmentTime() != null) {
            appointmentDate = contract.getReservation().getExpectedAppointmentTime().toLocalDate();
        }
        createTask(contract, "CHECK_IN", appointmentDate, null);
    }

    // UC-16: sinh task CHECK_OUT — gọi trong UC-22 khi khách yêu cầu trả kho
    @Transactional
    public void createCheckOutTask(RentalContract contract, LocalDate checkoutDate, String note) {
        createTask(contract, "CHECK_OUT", checkoutDate, note);
    }

    // UC-16: dời hạn task CHECK_IN khi đơn được dời lịch nhận kho (No-Show → gọi
    // được khách).
    // Task đã quá hạn thì mở lại: chưa ai nhận → OPEN, đã có người nhận →
    // IN_PROGRESS
    @Transactional
    public void rescheduleOpenTasks(Integer contractId, String taskType, LocalDate newAppointmentDate) {
        List<StaffTask> tasks = staffTaskRepository
                .findByContractIdAndTaskTypeAndStatusIn(contractId, taskType, OPEN_STATUSES);
        for (StaffTask task : tasks) {
            task.setDueAt(computeDueAt(newAppointmentDate));
            if ("OVERDUE".equals(task.getStatus())) {
                task.setStatus(task.getStaff() == null ? "OPEN" : "IN_PROGRESS");
            }
        }
        staffTaskRepository.saveAll(tasks);
    }

    // UC-16: huỷ task chưa đóng — gọi khi khách gia hạn (không trả kho nữa) hoặc
    // khi xử lý No-Show
    @Transactional
    public void cancelOpenTasks(Integer contractId, String taskType) {
        List<StaffTask> tasks = staffTaskRepository
                .findByContractIdAndTaskTypeAndStatusIn(contractId, taskType, OPEN_STATUSES);
        for (StaffTask task : tasks) {
            task.setStatus("CANCELLED");
        }
        staffTaskRepository.saveAll(tasks);
    }

    // PR-S8: Hợp đồng TERMINATED / LIQUIDATED -> đóng mọi ticket hỗ trợ còn mở và hủy task SUPPORT đang mở
    @Transactional
    public void closeOpenSupportTicketsAndTasks(Integer contractId) {
        if (contractId == null) return;
        try {
            jdbcTemplate.update(
                    "UPDATE support_requests SET status = 'CLOSED', closed_at = SYSDATETIME() " +
                            "WHERE contract_id = ? AND status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED')",
                    contractId);
            cancelOpenTasks(contractId, "SUPPORT");
        } catch (Exception ignored) {
        }
    }

    // PR-O10 / PR-Q9: sinh task MAINTENANCE cho ô cần sửa (nghiệm thu có sự cố) hoặc cần dọn (sau thanh lý).
    // Hạn 21:00 sau 3 ngày; ô quay về AVAILABLE khi task được đóng ("Sửa xong" / "Mở lại kho").
    // reason: DAMAGE (sự cố trả kho) / LIQUIDATION (dọn kho sau thanh lý — "Dọn xong" bắt buộc kiểm kê hàng, PR-Q10)
    @Transactional
    public void createMaintenanceTask(RentalContract contract, String reason, String note) {
        if (contract == null || contract.getStorageUnit() == null) return;
        if (staffTaskRepository.existsByContractIdAndTaskTypeAndStatusIn(contract.getId(), "MAINTENANCE", OPEN_STATUSES)) {
            return;
        }
        StaffTask task = new StaffTask();
        task.setFacilityId(contract.getStorageUnit().getFacility().getId());
        task.setContract(contract);
        task.setTaskType("MAINTENANCE");
        task.setMaintenanceReason(reason);
        task.setStatus("OPEN");
        task.setDueAt(computeDueAt(LocalDate.now().plusDays(MAINTENANCE_DUE_DAYS)));
        task.setNote(note != null && note.length() > 1000 ? note.substring(0, 997) + "..." : note);
        staffTaskRepository.save(task);
    }

    private void createTask(RentalContract contract, String taskType, LocalDate appointmentDate, String note) {
        // Chặn trùng: hợp đồng đã có task cùng loại đang mở thì thôi
        if (staffTaskRepository.existsByContractIdAndTaskTypeAndStatusIn(contract.getId(), taskType, OPEN_STATUSES)) {
            return;
        }

        StaffTask task = new StaffTask();
        task.setFacilityId(contract.getStorageUnit().getFacility().getId());
        task.setContract(contract);
        task.setTaskType(taskType);
        task.setStatus("OPEN");
        task.setDueAt(computeDueAt(appointmentDate));
        task.setNote(note);
        staffTaskRepository.save(task);
    }

    // Hạn = ngày hẹn lúc 21:00.
    // Nếu mốc đó đã qua (vd: Manager gán ô trễ) → trước 21h thì hạn hôm nay, sau
    // 21h thì hạn hôm sau.
    LocalDateTime computeDueAt(LocalDate appointmentDate) {
        LocalDateTime now = LocalDateTime.now();
        if (appointmentDate != null) {
            LocalDateTime due = appointmentDate.atTime(CLOSING_TIME);
            if (due.isAfter(now)) {
                return due;
            }
        }
        LocalDate day = now.toLocalTime().isBefore(CLOSING_TIME) ? now.toLocalDate() : now.toLocalDate().plusDays(1);
        return day.atTime(CLOSING_TIME);
    }

    // ================== UC-16: BẢNG CÔNG VIỆC ==================

    // readOnly = true: báo cho Hibernate là chỉ đọc → bỏ qua dirty checking, nhẹ
    // hơn
    @Transactional(readOnly = true)
    public List<StaffTaskResponse> getBoard(Integer facilityId, String status) {
        if (facilityId == null) {
            throw new IllegalArgumentException("Thiếu facilityId");
        }
        String normalizedStatus = null;
        if (status != null && !status.isBlank()) {
            normalizedStatus = status.trim().toUpperCase();
            if (!VALID_STATUSES.contains(normalizedStatus)) {
                throw new IllegalArgumentException("Trạng thái không hợp lệ: " + status);
            }
        }
        List<StaffTask> tasks = staffTaskRepository.findBoard(facilityId, normalizedStatus);
        if (tasks.isEmpty()) {
            return Collections.emptyList();
        }

        List<Integer> supportIds = tasks.stream()
                .map(StaffTask::getSupportRequestId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();

        Map<Integer, SupportRequest> supportMap = new HashMap<>();
        if (!supportIds.isEmpty()) {
            for (SupportRequest sr : supportRequestRepository.findByIdInWithDetails(supportIds)) {
                supportMap.put(sr.getId(), sr);
            }
        }

        List<StaffTaskResponse> responses = new ArrayList<>();
        for (StaffTask task : tasks) {
            SupportRequest sr = task.getSupportRequestId() != null ? supportMap.get(task.getSupportRequestId()) : null;
            responses.add(toResponse(task, sr));
        }

        // PR-34: Task SUPPORT khẩn (LOCK_ISSUE, SECURITY) đang mở nổi lên đầu bảng, sau đó sắp theo dueAt ASC
        responses.sort(Comparator
                .comparing((StaffTaskResponse r) -> {
                    boolean active = OPEN_STATUSES.contains(r.getStatus());
                    return !(active && r.isUrgent());
                })
                .thenComparing(StaffTaskResponse::getDueAt, Comparator.nullsLast(Comparator.naturalOrder())));

        return responses;
    }

    private StaffTaskResponse toResponse(StaffTask task) {
        SupportRequest sr = null;
        if (task.getSupportRequestId() != null) {
            sr = supportRequestRepository.findDetailById(task.getSupportRequestId()).orElse(null);
        }
        return toResponse(task, sr);
    }

    // Entity → DTO. Không trả thẳng entity ra API vì:
    // (1) quan hệ LAZY sẽ lỗi khi Jackson serialize, (2) lộ field không cần thiết
    // (password của User...)
    private StaffTaskResponse toResponse(StaffTask task, SupportRequest sr) {
        RentalContract contract = task.getContract() != null ? task.getContract() : (sr != null ? sr.getContract() : null);
        User staff = task.getStaff();
        StorageUnit unit = contract != null ? contract.getStorageUnit() : null;
        User customer = contract != null ? contract.getCustomer() : (sr != null ? sr.getCustomer() : null);

        String customerName = customer != null ? customer.getFullName() : null;
        String customerPhone = customer != null ? customer.getPhone() : null;
        String unitTypeName = unit != null && unit.getUnitType() != null ? unit.getUnitType().getName() : null;
        String contractCode = contract != null ? contract.getContractCode() : null;

        // Nếu contract null (ví dụ: task hoàn cọc hủy đơn) -> Tìm qua reservation hoặc parse note
        if (contract == null && task.getNote() != null) {
            java.util.regex.Matcher mRes = java.util.regex.Pattern.compile("Đơn:\\s*([A-Za-z0-9_-]+)").matcher(task.getNote());
            if (mRes.find()) {
                String resCode = mRes.group(1).trim();
                contractCode = resCode;
                java.util.Optional<com.queenkho.api.entity.Reservation> resOpt = reservationRepository.findByReservationCode(resCode);
                if (resOpt.isPresent()) {
                    com.queenkho.api.entity.Reservation res = resOpt.get();
                    if (res.getCustomer() != null) {
                        customerName = res.getCustomer().getFullName();
                        customerPhone = res.getCustomer().getPhone();
                    }
                    if (unitTypeName == null && res.getUnitType() != null) {
                        unitTypeName = res.getUnitType().getName();
                    }
                }
            }

            // Fallback parse từ note nếu không tìm thấy reservation
            if (customerName == null) {
                java.util.regex.Matcher mName = java.util.regex.Pattern.compile("Khách:\\s*([^|(]+)").matcher(task.getNote());
                if (mName.find()) {
                    customerName = mName.group(1).trim();
                }
            }
            if (customerPhone == null) {
                java.util.regex.Matcher mPhone = java.util.regex.Pattern.compile("SĐT:\\s*([^)]+)").matcher(task.getNote());
                if (mPhone.find()) {
                    customerPhone = mPhone.group(1).trim();
                }
            }
        }

        String taskNote = task.getNote();
        if (contract != null && "REFUND".equals(task.getTaskType())) {
            taskNote = buildEnrichedRefundNote(contract, taskNote, task.getCreatedAt() != null ? task.getCreatedAt().toLocalDate() : LocalDate.now());
        }

        boolean urgent = sr != null
                ? SupportRequestService.isUrgentIssue(sr.getIssueType())
                : ("SUPPORT".equals(task.getTaskType()) && taskNote != null && taskNote.contains("[KHẨN]"));

        return StaffTaskResponse.builder()
                .id(task.getId())
                .facilityId(task.getFacilityId())
                .taskType(task.getTaskType())
                .status(task.getStatus())
                .dueAt(task.getDueAt())
                .createdAt(task.getCreatedAt())
                .claimedAt(task.getClaimedAt())
                .completedAt(task.getCompletedAt())
                .note(taskNote)
                .evidenceImageUrl(task.getEvidenceImageUrl())
                .staffId(staff != null ? staff.getId() : null)
                .staffName(staff != null ? staff.getFullName() : null)
                .contractId(contract != null ? contract.getId() : null)
                .contractCode(contractCode)
                .contractStatus(contract != null ? contract.getStatus() : null)
                .customerName(customerName)
                .customerPhone(customerPhone)
                .storageUnitId(unit != null ? unit.getId() : null)
                .unitTypeName(unitTypeName)
                .supportRequestId(task.getSupportRequestId())
                .ticketCode(sr != null ? sr.getTicketCode() : null)
                .issueType(sr != null ? sr.getIssueType() : null)
                .urgent(urgent)
                .ticketStatus(sr != null ? sr.getStatus() : null)
                .ticketDescription(sr != null ? sr.getDescription() : null)
                .resolutionNote(sr != null ? sr.getResolutionNote() : null)
                .build();
    }

    // ================== UC-17: NHẬN VIỆC / GỠ NGƯỜI NHẬN ==================

    // UC-17: Staff / Manager nhận 1 task OPEN của cơ sở mình
    @Transactional
    public StaffTaskResponse claimTask(Integer taskId, Integer userId) {
        if (userId == null) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Thiếu thông tin người thao tác");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new StaffTaskException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "Không tìm thấy tài khoản"));
        StaffTask task = findTaskInFacility(taskId, user.getFacilityId());

        String role = user.getRole() != null ? user.getRole().getName() : "";
        if ("REFUND".equals(task.getTaskType())) {
            if (!"FACILITY_MANAGER".equals(role) && !"STAFF".equals(role) && !"ADMIN".equals(role)) {
                throw new StaffTaskException(HttpStatus.FORBIDDEN, "FORBIDDEN_ROLE", "Chỉ Quản lý hoặc Nhân viên mới được nhận task hoàn tiền");
            }
        } else {
            if (!"STAFF".equals(role)) {
                throw new StaffTaskException(HttpStatus.FORBIDDEN, "FORBIDDEN_ROLE", "Chỉ nhân viên mới được nhận việc này");
            }
        }

        int updated = staffTaskRepository.claim(task.getId(), user, LocalDateTime.now());
        if (updated == 0) {
            // UPDATE không ăn dòng nào → đọc lại để báo đúng lý do
            throw explainClaimFailure(taskId, userId);
        }

        // PR-34: Nếu là task SUPPORT thì ticket đi theo task (OPEN -> IN_PROGRESS)
        if ("SUPPORT".equals(task.getTaskType()) && task.getSupportRequestId() != null) {
            supportRequestRepository.findById(task.getSupportRequestId()).ifPresent(sr -> {
                if ("OPEN".equals(sr.getStatus())) {
                    sr.setStatus("IN_PROGRESS");
                    supportRequestRepository.save(sr);
                }
            });
        }

        // PR-A9: Ghi log nhận việc
        activityLogService.log(
                user.getId(),
                "[TASK_CLAIM] Nhân viên " + user.getFullName() + " nhận việc task #" + task.getId() + " (" + task.getTaskType() + ")",
                "facility_tasks",
                String.valueOf(task.getId())
        );

        return toResponse(staffTaskRepository.findById(taskId).orElseThrow());
    }

    // UC-17: Facility Manager gỡ nhân viên khỏi task đang xử lý → task về OPEN
    @Transactional
    public StaffTaskResponse unassignTask(Integer taskId, Integer managerId) {
        User manager = findUserWithRole(managerId, "FACILITY_MANAGER", "Chỉ quản lý cơ sở mới được gỡ người nhận");
        StaffTask task = findTaskInFacility(taskId, manager.getFacilityId());
        String prevStaffName = task.getStaff() != null ? task.getStaff().getFullName() : "nhân viên";

        int updated = staffTaskRepository.unassign(task.getId());
        if (updated == 0) {
            StaffTask current = staffTaskRepository.findById(taskId).orElseThrow();
            if ("OPEN".equals(current.getStatus())) {
                throw new StaffTaskException(HttpStatus.CONFLICT, "TASK_NOT_ASSIGNED", "Task chưa có người nhận");
            }
            if ("OVERDUE".equals(current.getStatus())) {
                throw new StaffTaskException(HttpStatus.CONFLICT, "TASK_OVERDUE",
                        "Task đã quá hạn, không thể gỡ người nhận");
            }
            throw new StaffTaskException(HttpStatus.CONFLICT, "TASK_NOT_UNASSIGNABLE",
                    "Task đã đóng, không thể gỡ người nhận");
        }

        // PR-34: Nếu là task SUPPORT thì ticket quay lại OPEN khi bị gỡ người nhận
        if ("SUPPORT".equals(task.getTaskType()) && task.getSupportRequestId() != null) {
            supportRequestRepository.findById(task.getSupportRequestId()).ifPresent(sr -> {
                if ("IN_PROGRESS".equals(sr.getStatus())) {
                    sr.setStatus("OPEN");
                    supportRequestRepository.save(sr);
                }
            });
        }

        // PR-A9: Ghi log gỡ người nhận
        activityLogService.log(
                manager.getId(),
                "[TASK_UNASSIGN] Quản lý " + manager.getFullName() + " gỡ " + prevStaffName + " khỏi task #" + task.getId() + " (" + task.getTaskType() + ")",
                "facility_tasks",
                String.valueOf(task.getId())
        );

        return toResponse(staffTaskRepository.findById(taskId).orElseThrow());
    }

    // Flow 5: loại task FM được giao cho nhân viên (REFUND là việc của chính FM)
    private static final List<String> ASSIGNABLE_TASK_TYPES = List.of("CHECK_IN", "CHECK_OUT", "SUPPORT", "MAINTENANCE");

    // Flow 5: Facility Manager giao task cho 1 nhân viên ACTIVE cùng cơ sở.
    // Task OPEN → IN_PROGRESS với người được giao; task IN_PROGRESS → đổi sang người mới.
    @Transactional
    public StaffTaskResponse assignTask(Integer taskId, Integer managerId, Integer staffId) {
        User manager = findUserWithRole(managerId, "FACILITY_MANAGER", "Chỉ quản lý cơ sở mới được giao việc");
        StaffTask task = findTaskInFacility(taskId, manager.getFacilityId());
        if (!ASSIGNABLE_TASK_TYPES.contains(task.getTaskType())) {
            throw new StaffTaskException(HttpStatus.CONFLICT, "TASK_NOT_ASSIGNABLE",
                    "Task hoàn tiền do quản lý tự xử lý, không giao cho nhân viên");
        }
        if (staffId == null) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Vui lòng chọn nhân viên nhận việc");
        }
        User staff = userRepository.findById(staffId)
                .orElseThrow(() -> new StaffTaskException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "Không tìm thấy nhân viên"));
        if (!"STAFF".equals(staff.getRole().getName())
                || !Objects.equals(staff.getFacilityId(), manager.getFacilityId())) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_STAFF",
                    "Chỉ giao được cho nhân viên thuộc cơ sở của bạn");
        }
        if (!"ACTIVE".equals(staff.getStatus())) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "STAFF_INACTIVE",
                    "Nhân viên " + staff.getFullName() + " đang bị khoá, không giao việc được");
        }
        if (task.getStaff() != null && staffId.equals(task.getStaff().getId())) {
            throw new StaffTaskException(HttpStatus.CONFLICT, "TASK_ALREADY_ASSIGNED",
                    "Task đang do " + staff.getFullName() + " phụ trách");
        }
        String previousStaffName = task.getStaff() != null ? task.getStaff().getFullName() : null;

        if (staffTaskRepository.assign(task.getId(), staff, LocalDateTime.now()) == 0) {
            StaffTask current = staffTaskRepository.findById(taskId).orElseThrow();
            if ("OVERDUE".equals(current.getStatus())
                    || (List.of("OPEN", "IN_PROGRESS").contains(current.getStatus())
                    && !current.getDueAt().isAfter(LocalDateTime.now()))) {
                throw new StaffTaskException(HttpStatus.CONFLICT, "TASK_OVERDUE",
                        "Task đã quá hạn, hãy gia hạn / dời lịch trước khi giao việc");
            }
            throw new StaffTaskException(HttpStatus.CONFLICT, "TASK_NOT_ASSIGNABLE", "Task đã đóng hoặc đã bị huỷ");
        }

        // PR-34: ticket hỗ trợ đi theo task (OPEN → IN_PROGRESS)
        if ("SUPPORT".equals(task.getTaskType()) && task.getSupportRequestId() != null) {
            supportRequestRepository.findById(task.getSupportRequestId()).ifPresent(sr -> {
                if ("OPEN".equals(sr.getStatus())) {
                    sr.setStatus("IN_PROGRESS");
                    supportRequestRepository.save(sr);
                }
            });
        }

        activityLogService.log(
                manager.getId(),
                "[TASK_ASSIGN] " + manager.getFullName() + " giao task #" + task.getId()
                        + " (" + task.getTaskType() + ") cho " + staff.getFullName()
                        + (previousStaffName != null ? " (thay " + previousStaffName + ")" : ""),
                "facility_tasks",
                String.valueOf(task.getId())
        );

        return toResponse(staffTaskRepository.findById(taskId).orElseThrow());
    }

    private User findUserWithRole(Integer userId, String role, String forbiddenMessage) {
        if (userId == null) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Thiếu thông tin người thao tác");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new StaffTaskException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND",
                        "Không tìm thấy tài khoản"));
        if (!role.equals(user.getRole().getName())) {
            throw new StaffTaskException(HttpStatus.FORBIDDEN, "FORBIDDEN_ROLE", forbiddenMessage);
        }
        return user;
    }

    // Task phải thuộc cùng cơ sở với người thao tác
    private StaffTask findTaskInFacility(Integer taskId, Integer facilityId) {
        StaffTask task = staffTaskRepository.findById(taskId)
                .orElseThrow(
                        () -> new StaffTaskException(HttpStatus.NOT_FOUND, "TASK_NOT_FOUND", "Không tìm thấy task"));
        if (facilityId == null || !facilityId.equals(task.getFacilityId())) {
            throw new StaffTaskException(HttpStatus.FORBIDDEN, "FORBIDDEN_FACILITY", "Task không thuộc cơ sở của bạn");
        }
        return task;
    }

    private StaffTaskException explainClaimFailure(Integer taskId, Integer staffId) {
        StaffTask current = staffTaskRepository.findById(taskId).orElseThrow();
        User owner = current.getStaff();
        if (owner != null) {
            String message = owner.getId().equals(staffId)
                    ? "Bạn đã nhận task này rồi"
                    : "Task đã được " + owner.getFullName() + " nhận trước";
            return new StaffTaskException(HttpStatus.CONFLICT, "TASK_ALREADY_CLAIMED", message);
        }
        // OVERDUE, hoặc còn OPEN nhưng đã qua hạn mà job chưa kịp chạy
        if ("OVERDUE".equals(current.getStatus())
                || ("OPEN".equals(current.getStatus()) && !current.getDueAt().isAfter(LocalDateTime.now()))) {
            return new StaffTaskException(HttpStatus.CONFLICT, "TASK_OVERDUE",
                    "Task đã quá hạn, chỉ quản lý cơ sở được xử lý");
        }
        return new StaffTaskException(HttpStatus.CONFLICT, "TASK_NOT_CLAIMABLE", "Task đã đóng hoặc đã bị huỷ");
    }

    // ================== UC-18: CHI TIẾT TASK + CHECK-IN & BIÊN BẢN BÀN GIAO
    // ==================

    // UC-18: chi tiết task — Staff hoặc Facility Manager cùng cơ sở được xem
    @Transactional(readOnly = true)
    public StaffTaskDetailResponse getTaskDetail(Integer taskId, Integer userId) {
        if (userId == null) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Thiếu thông tin người xem");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new StaffTaskException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND",
                        "Không tìm thấy tài khoản"));
        String role = user.getRole().getName();
        if (!"STAFF".equals(role) && !"FACILITY_MANAGER".equals(role)) {
            throw new StaffTaskException(HttpStatus.FORBIDDEN, "FORBIDDEN_ROLE",
                    "Bạn không có quyền xem công việc này");
        }
        StaffTask task = staffTaskRepository.findDetailById(taskId)
                .orElseThrow(
                        () -> new StaffTaskException(HttpStatus.NOT_FOUND, "TASK_NOT_FOUND", "Không tìm thấy task"));
        if (user.getFacilityId() == null || !user.getFacilityId().equals(task.getFacilityId())) {
            throw new StaffTaskException(HttpStatus.FORBIDDEN, "FORBIDDEN_FACILITY", "Task không thuộc cơ sở của bạn");
        }
        return toDetailResponse(task);
    }

    // UC-18: gợi ý 1 mã PIN 6 số chưa bị hợp đồng còn hiệu lực nào dùng.
    // Sinh ở backend vì chỉ backend kiểm tra được trùng; lúc lưu vẫn kiểm tra lại
    // (có thể bị người khác lấy mất giữa chừng)
    @Transactional(readOnly = true)
    public String suggestPin() {
        return suggestPinExcluding(null);
    }

    private String suggestPinExcluding(String currentPin) {
        for (int i = 0; i < PIN_MAX_ATTEMPTS; i++) {
            String pin = String.format("%06d", RANDOM.nextInt(1_000_000));
            if (currentPin != null && currentPin.equals(pin)) {
                continue;
            }
            if (!rentalContractRepository.existsByAccessPinCodeAndStatusIn(pin, LIVE_CONTRACT_STATUSES)) {
                return pin;
            }
        }
        throw new StaffTaskException(HttpStatus.CONFLICT, "PIN_UNAVAILABLE",
                "Không sinh được mã PIN, vui lòng thử lại");
    }

    // UC-18: Staff check-in cho khách + lập biên bản bàn giao.
    // Tất cả trong 1 transaction: ném exception ở bất kỳ bước nào → rollback hết
    // (kể cả câu UPDATE task)
    @Transactional
    public StaffTaskDetailResponse checkIn(Integer taskId, Integer staffId, CheckInRequest request) {
        User staff = findUserWithRole(staffId, "STAFF", "Chỉ nhân viên mới được check-in cho khách");
        StaffTask task = findTaskInFacility(taskId, staff.getFacilityId());
        if (!"CHECK_IN".equals(task.getTaskType())) {
            throw new StaffTaskException(HttpStatus.CONFLICT, "TASK_NOT_CHECK_IN", "Task này không phải task check-in");
        }

        // 1. Kiểm tra nội dung biên bản trước khi đụng vào DB
        validateCheckInRequest(request);

        // PR-C1 (sửa L-17): không bàn giao trước ngày khách hẹn nhận kho — hợp đồng tính tiền từ ngày đó
        LocalDate appointmentDate = task.getContract().getStartDate();
        if (task.getContract().getReservation() != null
                && task.getContract().getReservation().getExpectedAppointmentTime() != null) {
            appointmentDate = task.getContract().getReservation().getExpectedAppointmentTime().toLocalDate();
        }
        if (appointmentDate != null && LocalDate.now().isBefore(appointmentDate)) {
            throw new StaffTaskException(HttpStatus.CONFLICT, "CHECK_IN_TOO_EARLY",
                    "Khách hẹn nhận kho ngày " + appointmentDate.format(DATE_FMT)
                            + ", chưa được check-in trước ngày hẹn");
        }
        String pin = request.getAccessPinCode().trim();
        String rfid = request.getRfidCardCode().trim();
        String notes = request.getNotes() == null || request.getNotes().isBlank() ? null : request.getNotes().trim();

        // 2. Đóng task bằng UPDATE có điều kiện — chặn bấm 2 lần / task vừa bị huỷ /
        // vừa quá hạn
        LocalDateTime now = LocalDateTime.now();
        if (staffTaskRepository.completeCheckIn(taskId, staffId, now) == 0) {
            throw explainCheckInFailure(taskId, staffId);
        }

        // 3. Hợp đồng phải đang chờ check-in.
        // Đọc lại sau UPDATE vì clearAutomatically đã xoá cache Hibernate → entity cũ
        // không còn được theo dõi
        RentalContract contract = rentalContractRepository.findDetailById(task.getContract().getId())
                .orElseThrow(() -> new StaffTaskException(HttpStatus.NOT_FOUND, "CONTRACT_NOT_FOUND",
                        "Không tìm thấy hợp đồng"));
        if (!"PENDING_CHECK_IN".equals(contract.getStatus())) {
            throw new StaffTaskException(HttpStatus.CONFLICT, "CONTRACT_STATUS_INVALID",
                    "Hợp đồng không ở trạng thái chờ check-in");
        }

        // 4. PIN / thẻ RFID không trùng với hợp đồng còn hiệu lực
        if (rentalContractRepository.existsByAccessPinCodeAndStatusIn(pin, LIVE_CONTRACT_STATUSES)) {
            throw new StaffTaskException(HttpStatus.CONFLICT, "PIN_TAKEN",
                    "Mã PIN vừa bị cấp cho hợp đồng khác, hãy sinh mã mới");
        }
        if (rentalContractRepository.existsByRfidCardCodeAndStatusIn(rfid, LIVE_CONTRACT_STATUSES)) {
            throw new StaffTaskException(HttpStatus.CONFLICT, "RFID_TAKEN",
                    "Thẻ RFID này đang được dùng cho hợp đồng khác");
        }

        // 5. Lưu biên bản
        HandoverRecord record = new HandoverRecord();
        record.setContract(contract);
        // getReferenceById: chỉ cần khoá ngoại staff_id, không cần SELECT lại user
        record.setStaff(userRepository.getReferenceById(staffId));
        record.setRecordType("CHECK_IN");
        record.setIdentityVerified(true);
        record.setUnitEmpty(true);
        record.setUnitClean(true);
        record.setLockIntact(true);
        record.setCustomerSignatureConfirmed(true);
        record.setNotes(notes);
        handoverRecordRepository.save(record);

        // 6. Kích hoạt hợp đồng + cấp mã mở khoá
        contract.setStatus("ACTIVE");
        contract.setAccessPinCode(pin);
        contract.setRfidCardCode(rfid);
        rentalContractRepository.save(contract);

        // 7. Ghi log. Lỗi log không làm hỏng check-in
        try {
            jdbcTemplate.update(
                    "INSERT INTO activity_logs (user_id, action, target_entity, target_id, created_at) " +
                            "VALUES (?, ?, 'rental_contracts', ?, SYSDATETIME())",
                    staffId,
                    "[CHECK_IN] Check-in HĐ " + contract.getContractCode() + ", ô " + contract.getStorageUnit().getId(),
                    String.valueOf(contract.getId()));
        } catch (Exception e) {
            // bỏ qua lỗi ghi log
        }

        entityManager.flush();
        entityManager.clear();
        return toDetailResponse(staffTaskRepository.findDetailById(taskId).orElseThrow());
    }

    private void validateCheckInRequest(CheckInRequest request) {
        if (request == null) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Thiếu nội dung biên bản");
        }
        boolean allChecked = Boolean.TRUE.equals(request.getIdentityVerified())
                && Boolean.TRUE.equals(request.getUnitEmpty())
                && Boolean.TRUE.equals(request.getUnitClean())
                && Boolean.TRUE.equals(request.getLockIntact())
                && Boolean.TRUE.equals(request.getCustomerSignatureConfirmed());
        if (!allChecked) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "CHECKLIST_INCOMPLETE",
                    "Phải hoàn thành đủ 5 mục kiểm tra mới được bàn giao");
        }
        if (request.getAccessPinCode() == null || !request.getAccessPinCode().trim().matches("\\d{6}")) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Mã PIN phải gồm đúng 6 chữ số");
        }
        if (request.getRfidCardCode() == null || request.getRfidCardCode().isBlank()) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Vui lòng nhập mã thẻ RFID");
        }
        if (request.getRfidCardCode().trim().length() > 50) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Mã thẻ RFID tối đa 50 ký tự");
        }
        if (request.getNotes() != null && request.getNotes().trim().length() > 1000) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Ghi chú tối đa 1000 ký tự");
        }
    }

    // UPDATE không ăn dòng nào → đọc lại task để báo đúng lý do
    private StaffTaskException explainCheckInFailure(Integer taskId, Integer staffId) {
        StaffTask current = staffTaskRepository.findDetailById(taskId).orElseThrow();
        String status = current.getStatus();
        if ("COMPLETED".equals(status)) {
            return new StaffTaskException(HttpStatus.CONFLICT, "TASK_ALREADY_COMPLETED", "Task đã được check-in xong");
        }
        if ("OVERDUE".equals(status)) {
            return new StaffTaskException(HttpStatus.CONFLICT, "TASK_OVERDUE",
                    "Task đã quá hạn, không thể lập biên bản");
        }
        if ("IN_PROGRESS".equals(status)) {
            if (current.getStaff() == null || !current.getStaff().getId().equals(staffId)) {
                return new StaffTaskException(HttpStatus.CONFLICT, "TASK_NOT_YOURS",
                        "Task này do nhân viên khác phụ trách");
            }
            return new StaffTaskException(HttpStatus.CONFLICT, "TASK_OVERDUE",
                    "Task đã quá hạn, không thể lập biên bản");
        }
        if ("CANCELLED".equals(status)) {
            return new StaffTaskException(HttpStatus.CONFLICT, "TASK_NOT_IN_PROGRESS", "Task đã bị huỷ");
        }
        return new StaffTaskException(HttpStatus.CONFLICT, "TASK_NOT_IN_PROGRESS",
                "Bạn cần nhận việc trước khi lập biên bản");
    }

    // ================== UC-27: XỬ LÝ YÊU CẦU HỖ TRỢ (STAFF & FM) ==================

    /**
     * UC-27 / PR-S5: Nhân viên hoàn tất xử lý task SUPPORT.
     * Chỉ Staff đang giữ task IN_PROGRESS, chưa quá hạn, bắt buộc nhập kết quả xử lý (1-1000 ký tự).
     * 1 transaction: task COMPLETED; ticket RESOLVED + resolution_note + resolved_at; log.
     */
    @Transactional
    public StaffTaskDetailResponse resolveSupportTask(Integer taskId, Integer staffId, ResolveSupportTaskRequest request) {
        User staff = findUserWithRole(staffId, "STAFF", "Chỉ nhân viên mới được xử lý yêu cầu hỗ trợ");
        StaffTask task = findTaskInFacility(taskId, staff.getFacilityId());

        if (!"SUPPORT".equals(task.getTaskType())) {
            throw new StaffTaskException(HttpStatus.CONFLICT, "TASK_NOT_SUPPORT",
                    "Task này không phải task hỗ trợ khách hàng (SUPPORT)");
        }

        String resolutionNote = (request != null && request.getResolutionNote() != null)
                ? request.getResolutionNote().trim()
                : "";
        if (resolutionNote.isEmpty()) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_INPUT",
                    "Bắt buộc nhập kết quả xử lý sự cố (PR-S5)");
        }
        if (resolutionNote.length() > 1000) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_INPUT",
                    "Kết quả xử lý tối đa 1000 ký tự (PR-S5)");
        }

        Integer supportRequestId = task.getSupportRequestId();
        String oldNote = task.getNote() != null ? task.getNote() : "";

        LocalDateTime now = LocalDateTime.now();
        if (staffTaskRepository.completeSupport(taskId, staffId, now) == 0) {
            throw explainSupportFailure(taskId, staffId);
        }

        // Cập nhật note của task
        StaffTask updatedTask = staffTaskRepository.findById(taskId).orElseThrow();
        String appendedNote = oldNote + " | [Kết quả xử lý: " + resolutionNote + "]";
        if (appendedNote.length() > 1000) {
            appendedNote = appendedNote.substring(0, 997) + "...";
        }
        updatedTask.setNote(appendedNote);
        staffTaskRepository.save(updatedTask);

        // Cập nhật ticket sang RESOLVED
        String ticketCode = "#" + supportRequestId;
        if (supportRequestId != null) {
            SupportRequest sr = supportRequestRepository.findById(supportRequestId)
                    .orElseThrow(() -> new StaffTaskException(HttpStatus.NOT_FOUND, "TICKET_NOT_FOUND",
                            "Không tìm thấy ticket hỗ trợ liên kết"));
            sr.setStatus("RESOLVED");
            sr.setResolutionNote(resolutionNote);
            sr.setResolvedAt(now);
            supportRequestRepository.save(sr);
            ticketCode = sr.getTicketCode();
        }

        activityLogService.log(
                staff.getId(),
                "[SUPPORT_RESOLVE] Nhân viên " + staff.getFullName() + " hoàn tất xử lý ticket " + ticketCode + ": " + resolutionNote,
                "support_requests",
                String.valueOf(supportRequestId != null ? supportRequestId : taskId)
        );

        entityManager.flush();
        entityManager.clear();
        return toDetailResponse(staffTaskRepository.findDetailById(taskId).orElseThrow());
    }

    /**
     * UC-27 / PR-S6, BR-73, PR-Q5: Cấp lại mã PIN 6 số cho ticket LOCK_ISSUE.
     * Chặn nếu hợp đồng đang OVERDUE (PR-Q5).
     */
    @Transactional
    public StaffTaskDetailResponse resetSupportContractPin(Integer taskId, Integer staffId) {
        User staff = findUserWithRole(staffId, "STAFF", "Chỉ nhân viên mới được cấp lại mã PIN hỗ trợ");
        StaffTask task = findTaskInFacility(taskId, staff.getFacilityId());

        if (!"SUPPORT".equals(task.getTaskType())) {
            throw new StaffTaskException(HttpStatus.CONFLICT, "TASK_NOT_SUPPORT",
                    "Chỉ task hỗ trợ (SUPPORT) mới có chức năng cấp lại PIN");
        }
        if (!"IN_PROGRESS".equals(task.getStatus())
                || task.getStaff() == null
                || !task.getStaff().getId().equals(staffId)
                || (task.getDueAt() != null && !task.getDueAt().isAfter(LocalDateTime.now()))) {
            throw explainSupportFailure(taskId, staffId);
        }

        SupportRequest sr = task.getSupportRequestId() != null
                ? supportRequestRepository.findDetailById(task.getSupportRequestId()).orElse(null)
                : null;
        if (sr == null || !"LOCK_ISSUE".equalsIgnoreCase(sr.getIssueType())) {
            throw new StaffTaskException(HttpStatus.CONFLICT, "INVALID_ISSUE_TYPE",
                    "Chỉ yêu cầu hỗ trợ thuộc loại Sự cố khóa (LOCK_ISSUE) mới được cấp lại mã PIN (PR-S6)");
        }

        RentalContract contract = task.getContract() != null ? task.getContract() : sr.getContract();
        if (contract == null) {
            throw new StaffTaskException(HttpStatus.NOT_FOUND, "CONTRACT_NOT_FOUND",
                    "Không tìm thấy hợp đồng gắn với yêu cầu hỗ trợ này");
        }

        // PR-Q5 & PR-S6: Hợp đồng OVERDUE không cấp lại mã PIN
        if ("OVERDUE".equalsIgnoreCase(contract.getStatus())) {
            throw new StaffTaskException(HttpStatus.CONFLICT, "CONTRACT_OVERDUE",
                    "Hợp đồng đang quá hạn thanh toán (OVERDUE), mã PIN đang bị khóa nên không thể cấp lại (PR-Q5, PR-S6)");
        }
        if (!LIVE_CONTRACT_STATUSES.contains(contract.getStatus())) {
            throw new StaffTaskException(HttpStatus.CONFLICT, "CONTRACT_STATUS_INVALID",
                    "Hợp đồng không còn hiệu lực để cấp lại mã PIN");
        }

        String newPin = suggestPinExcluding(contract.getAccessPinCode());
        contract.setAccessPinCode(newPin);
        rentalContractRepository.save(contract);

        String stamp = LocalDateTime.now().format(TS_FMT);
        String updatedNote = (task.getNote() != null ? task.getNote() : "") + " | [Đã cấp lại PIN mới lúc " + stamp + "]";
        if (updatedNote.length() > 1000) {
            updatedNote = updatedNote.substring(0, 997) + "...";
        }
        task.setNote(updatedNote);
        staffTaskRepository.save(task);

        activityLogService.log(
                staff.getId(),
                "[PIN_RESET] Nhân viên " + staff.getFullName() + " cấp lại mã PIN mới cho HĐ " + contract.getContractCode()
                        + " (Ticket " + sr.getTicketCode() + ")",
                "rental_contracts",
                String.valueOf(contract.getId())
        );

        entityManager.flush();
        entityManager.clear();
        return toDetailResponse(staffTaskRepository.findDetailById(taskId).orElseThrow());
    }

    /**
     * UC-27 / PR-S4: Task SUPPORT OVERDUE -> FM gia hạn (hạn mới + lý do) -> OPEN / IN_PROGRESS (giữ người nhận).
     */
    @Transactional
    public StaffTaskDetailResponse extendSupportTask(Integer taskId, Integer managerId, ExtendSupportTaskRequest request) {
        User manager = findUserWithRole(managerId, "FACILITY_MANAGER",
                "Chỉ Quản lý cơ sở (FM) mới có quyền gia hạn task hỗ trợ quá hạn (PR-S4)");
        StaffTask task = findTaskInFacility(taskId, manager.getFacilityId());

        if (!"SUPPORT".equals(task.getTaskType())) {
            throw new StaffTaskException(HttpStatus.CONFLICT, "TASK_NOT_SUPPORT",
                    "Chỉ task hỗ trợ (SUPPORT) mới áp dụng chức năng gia hạn này (PR-S4)");
        }

        boolean isOverdue = "OVERDUE".equals(task.getStatus())
                || (OPEN_STATUSES.contains(task.getStatus()) && task.getDueAt() != null && !task.getDueAt().isAfter(LocalDateTime.now()));
        if (!isOverdue) {
            throw new StaffTaskException(HttpStatus.CONFLICT, "TASK_NOT_OVERDUE",
                    "Chỉ task hỗ trợ đã quá hạn (OVERDUE) mới cần gia hạn");
        }

        if (request == null || request.getNewDueDate() == null) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_INPUT",
                    "Vui lòng chọn ngày hạn mới cho task hỗ trợ (PR-S4)");
        }
        if (request.getNewDueDate().isBefore(LocalDate.now())) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_INPUT",
                    "Ngày hạn mới phải từ hôm nay trở đi");
        }

        String reason = request.getReason() != null ? request.getReason().trim() : "";
        if (reason.isEmpty()) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_INPUT",
                    "Bắt buộc nhập lý do gia hạn task hỗ trợ (PR-S4)");
        }
        if (reason.length() > 500) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_INPUT",
                    "Lý do gia hạn tối đa 500 ký tự");
        }

        LocalDateTime newDueAt = request.getNewDueDate().atTime(CLOSING_TIME);
        if (!newDueAt.isAfter(LocalDateTime.now())) {
            newDueAt = LocalDate.now().plusDays(1).atTime(CLOSING_TIME);
        }

        // PR-S4: Giữ nguyên người nhận (nếu đã có staff nhận -> IN_PROGRESS, chưa ai nhận -> OPEN)
        String restoredStatus = task.getStaff() == null ? "OPEN" : "IN_PROGRESS";
        task.setDueAt(newDueAt);
        task.setStatus(restoredStatus);

        String formattedDue = newDueAt.toLocalDate().format(DATE_FMT);
        String extNote = (task.getNote() != null ? task.getNote() : "")
                + " | [FM gia hạn đến 21:00 " + formattedDue + " - Lý do: " + reason + "]";
        if (extNote.length() > 1000) {
            extNote = extNote.substring(0, 997) + "...";
        }
        task.setNote(extNote);
        staffTaskRepository.save(task);

        String ticketCode = "#" + task.getSupportRequestId();
        if (task.getSupportRequestId() != null) {
            SupportRequest sr = supportRequestRepository.findById(task.getSupportRequestId()).orElse(null);
            if (sr != null) {
                ticketCode = sr.getTicketCode();
                if ("OPEN".equals(sr.getStatus()) || "IN_PROGRESS".equals(sr.getStatus())) {
                    sr.setStatus(restoredStatus);
                    supportRequestRepository.save(sr);
                }
            }
        }

        activityLogService.log(
                manager.getId(),
                "[SUPPORT_EXTEND] Quản lý " + manager.getFullName() + " gia hạn task SUPPORT #" + task.getId()
                        + " (Ticket " + ticketCode + ") đến 21:00 " + formattedDue + ": " + reason,
                "facility_tasks",
                String.valueOf(task.getId())
        );

        entityManager.flush();
        entityManager.clear();
        return toDetailResponse(staffTaskRepository.findDetailById(taskId).orElseThrow());
    }

    private StaffTaskException explainSupportFailure(Integer taskId, Integer staffId) {
        StaffTask current = staffTaskRepository.findDetailById(taskId).orElseThrow();
        String status = current.getStatus();
        if ("COMPLETED".equals(status)) {
            return new StaffTaskException(HttpStatus.CONFLICT, "TASK_ALREADY_COMPLETED",
                    "Yêu cầu hỗ trợ này đã được xử lý xong trước đó");
        }
        if ("OVERDUE".equals(status)) {
            return new StaffTaskException(HttpStatus.CONFLICT, "TASK_OVERDUE",
                    "Task hỗ trợ đã quá hạn 21:00. Nhân viên không thể làm tiếp — vui lòng báo Quản lý cơ sở (FM) gia hạn (PR-S4)");
        }
        if ("IN_PROGRESS".equals(status)) {
            if (current.getStaff() == null || !current.getStaff().getId().equals(staffId)) {
                return new StaffTaskException(HttpStatus.CONFLICT, "TASK_NOT_YOURS",
                        "Task hỗ trợ này đang do nhân viên khác phụ trách");
            }
            return new StaffTaskException(HttpStatus.CONFLICT, "TASK_OVERDUE",
                    "Task hỗ trợ đã quá hạn 21:00. Vui lòng báo Quản lý cơ sở (FM) gia hạn (PR-S4)");
        }
        if ("CANCELLED".equals(status)) {
            return new StaffTaskException(HttpStatus.CONFLICT, "TASK_NOT_IN_PROGRESS",
                    "Task hỗ trợ đã bị hủy (khách hủy ticket hoặc hợp đồng đã kết thúc)");
        }
        return new StaffTaskException(HttpStatus.CONFLICT, "TASK_NOT_IN_PROGRESS",
                "Bạn cần bấm \"Nhận việc\" trước khi xử lý yêu cầu hỗ trợ");
    }

    // ================== UC-23 & UC-24: NGHIỆM THU TRẢ KHO & GHI NHẬN SỰ CỐ ==================

    @Transactional
    public StaffTaskDetailResponse checkOut(Integer taskId, Integer staffId, CheckOutRequest request) {
        User staff = findUserWithRole(staffId, "STAFF", "Chỉ nhân viên mới được nghiệm thu trả kho cho khách");
        StaffTask task = findTaskInFacility(taskId, staff.getFacilityId());
        if (!"CHECK_OUT".equals(task.getTaskType())) {
            throw new StaffTaskException(HttpStatus.CONFLICT, "TASK_NOT_CHECK_OUT", "Task này không phải task nghiệm thu trả kho");
        }

        // 1. Kiểm tra dữ liệu biên bản nghiệm thu và danh sách sự cố (UC-23 / UC-24)
        validateCheckOutRequest(request);
        String notes = request.getNotes() == null || request.getNotes().isBlank() ? null : request.getNotes().trim();
        String originalTaskNote = task.getNote();

        // 2. Đóng task CHECK_OUT bằng câu UPDATE có điều kiện (chống bấm đúp / quá hạn / huỷ giữa chừng)
        LocalDateTime now = LocalDateTime.now();
        if (staffTaskRepository.completeCheckOut(taskId, staffId, now) == 0) {
            throw explainCheckOutFailure(taskId, staffId);
        }

        // 3. Đọc lại hợp đồng sau UPDATE (clearAutomatically đã xoá cache)
        RentalContract contract = rentalContractRepository.findDetailById(task.getContract().getId())
                .orElseThrow(() -> new StaffTaskException(HttpStatus.NOT_FOUND, "CONTRACT_NOT_FOUND",
                        "Không tìm thấy hợp đồng"));
        if (!List.of("TERMINATION_PENDING", "ACTIVE", "OVERDUE").contains(contract.getStatus())) {
            throw new StaffTaskException(HttpStatus.CONFLICT, "CONTRACT_STATUS_INVALID",
                    "Hợp đồng không ở trạng thái chờ trả kho");
        }

        // 4. Lưu biên bản nghiệm thu trả kho (HandoverRecord CHECK_OUT)
        HandoverRecord record = new HandoverRecord();
        record.setContract(contract);
        record.setStaff(userRepository.getReferenceById(staffId));
        record.setRecordType("CHECK_OUT");
        record.setIdentityVerified(Boolean.TRUE.equals(request.getIdentityVerified()));
        record.setUnitEmpty(Boolean.TRUE.equals(request.getUnitEmpty()));
        record.setUnitClean(Boolean.TRUE.equals(request.getUnitClean()));
        record.setLockIntact(Boolean.TRUE.equals(request.getLockIntact()));
        record.setCustomerSignatureConfirmed(Boolean.TRUE.equals(request.getCustomerSignatureConfirmed()));
        record.setNotes(notes);
        handoverRecordRepository.save(record);

        // 5. UC-24: Lưu danh sách sự cố hư hỏng (nếu có).
        // totalDamageCost = chỉ phần LỖI KHÁCH (trừ cọc); lỗi cơ sở ghi nhận chi phí nhưng không tính khách.
        BigDecimal totalDamageCost = BigDecimal.ZERO;
        BigDecimal facilityDamageCost = BigDecimal.ZERO;
        List<CheckOutRequest.DamageItemRequest> rawDamages = request.getDamageCases() != null
                ? request.getDamageCases()
                : Collections.emptyList();
        StaffTask taskRef = staffTaskRepository.getReferenceById(taskId);
        List<String> damageSummaryTitles = new ArrayList<>();

        for (CheckOutRequest.DamageItemRequest item : rawDamages) {
            BigDecimal cost = item.getEstimatedCost() != null ? item.getEstimatedCost() : BigDecimal.ZERO;
            boolean customerFault = "CUSTOMER".equals(item.getLiableParty());
            if (customerFault) {
                totalDamageCost = totalDamageCost.add(cost);
            } else {
                facilityDamageCost = facilityDamageCost.add(cost);
            }
            String titleTrimmed = item.getTitle().trim();
            damageSummaryTitles.add(titleTrimmed + (customerFault ? " (lỗi khách)" : " (lỗi cơ sở)"));

            DamageCase dc = new DamageCase();
            dc.setContract(contract);
            dc.setTask(taskRef);
            dc.setTitle(titleTrimmed);
            dc.setDescription(item.getDescription() != null && !item.getDescription().isBlank()
                    ? item.getDescription().trim()
                    : null);
            dc.setEstimatedCost(cost);
            dc.setLiableParty(item.getLiableParty());
            dc.setEvidenceImageUrls(serializeEvidenceImages(item.getEvidenceImages()));
            damageCaseRepository.save(dc);
        }

        boolean hasDamage = !Boolean.TRUE.equals(request.getUnitClean())
                || !Boolean.TRUE.equals(request.getLockIntact())
                || !rawDamages.isEmpty();

        // 6. Cập nhật trạng thái ô kho (PR-O7, PR-O10):
        // Không có sự cố → AVAILABLE; Có sự cố → MAINTENANCE + sinh task MAINTENANCE
        StorageUnit unit = contract.getStorageUnit();
        if (unit != null) {
            if (hasDamage) {
                unit.setStatus("MAINTENANCE");
                storageUnitRepository.save(unit);

                // Sinh task MAINTENANCE cho cơ sở để theo dõi sửa chữa / vệ sinh (PR-O10)
                String issues = damageSummaryTitles.isEmpty()
                        ? (!Boolean.TRUE.equals(request.getUnitClean()) ? "ô chưa sạch" : "khoá / vách không nguyên vẹn")
                        : String.join(", ", damageSummaryTitles);
                createMaintenanceTask(contract, "DAMAGE", "Khắc phục sự cố sau trả kho ô " + unit.getId()
                        + " (HĐ " + contract.getContractCode() + "): " + issues);
            } else {
                unit.setStatus("AVAILABLE");
                storageUnitRepository.save(unit);
            }
        }

        // 7. Chấm dứt hợp đồng + thu hồi mã PIN & thẻ RFID + đóng đơn đặt chỗ (PR-O7)
        contract.setStatus("TERMINATED");
        contract.setAccessPinCode(null);
        contract.setRfidCardCode(null);
        rentalContractRepository.save(contract);

        if (contract.getReservation() != null) {
            var res = contract.getReservation();
            res.setStatus("COMPLETED");
            reservationRepository.save(res);
        }

        // Đóng các ticket hỗ trợ còn mở của hợp đồng này (PR-S8)
        closeOpenSupportTicketsAndTasks(contract.getId());

        // 8. Quyết toán hoàn tiền trả kho theo bộ Business Rules mới (PR-O2, PR-O11, PR-O14, PR-Q3)
        RefundCalculationResult calc = calculateCheckoutRefund(contract, now.toLocalDate(), totalDamageCost);
        BigDecimal depositHeld = calc.getDepositHeld();
        BigDecimal refundAmount = calc.getTotalRefundAmount();
        BigDecimal excessDebt = calc.getExcessDebtAmount();
        BigDecimal damageOffset = totalDamageCost.min(depositHeld);
        BigDecimal graceOrLateFee = calc.getGraceFee().add(calc.getLateFee());
        BigDecimal feeOffset = graceOrLateFee.min(depositHeld.subtract(damageOffset).max(BigDecimal.ZERO));

        Integer customerId = contract.getCustomer().getId();
        Integer reservationId = contract.getReservation() != null ? contract.getReservation().getId() : null;
        NumberFormat vndFmt = NumberFormat.getInstance(new Locale("vi", "VN"));

        // 8a. Ghi nhận giao dịch khấu trừ cọc cho hư hỏng (DAMAGE_FEE - DEPOSIT_OFFSET)
        if (damageOffset.compareTo(BigDecimal.ZERO) > 0) {
            try {
                String dmgTxnCode = "DMG-OFF-" + contract.getId() + "-" + (System.currentTimeMillis() % 100000);
                jdbcTemplate.update(
                        "INSERT INTO payment_transactions " +
                                "(transaction_code, user_id, reservation_id, contract_id, payment_type, payment_method, amount, status, paid_at) " +
                                "VALUES (?, ?, ?, ?, 'DAMAGE_FEE', 'DEPOSIT_OFFSET', ?, 'SUCCESS', SYSDATETIME())",
                        dmgTxnCode, customerId, reservationId, contract.getId(), damageOffset);
            } catch (Exception ignored) {
            }
        }

        // 8b. Ghi nhận giao dịch khấu trừ cọc cho phí ân hạn / trễ hạn nếu có (LATE_FEE - DEPOSIT_OFFSET)
        if (feeOffset.compareTo(BigDecimal.ZERO) > 0) {
            try {
                String feeTxnCode = "LATE-OFF-" + contract.getId() + "-" + (System.currentTimeMillis() % 100000);
                jdbcTemplate.update(
                        "INSERT INTO payment_transactions " +
                                "(transaction_code, user_id, reservation_id, contract_id, payment_type, payment_method, amount, status, paid_at) " +
                                "VALUES (?, ?, ?, ?, 'LATE_FEE', 'DEPOSIT_OFFSET', ?, 'SUCCESS', SYSDATETIME())",
                        feeTxnCode, customerId, reservationId, contract.getId(), feeOffset);
            } catch (Exception ignored) {
            }
        }

        // 8c. Nếu chi phí vượt quá tiền cọc → tạo khoản nợ PENDING (PR-O9)
        if (excessDebt.compareTo(BigDecimal.ZERO) > 0) {
            try {
                String debtTxnCode = "DMG-DEBT-" + contract.getId() + "-" + (System.currentTimeMillis() % 100000);
                jdbcTemplate.update(
                        "INSERT INTO payment_transactions " +
                                "(transaction_code, user_id, reservation_id, contract_id, payment_type, payment_method, amount, status, paid_at) " +
                                "VALUES (?, ?, ?, ?, 'DAMAGE_FEE', 'VNPAY', ?, 'PENDING', NULL)",
                        debtTxnCode, customerId, reservationId, contract.getId(), excessDebt);
            } catch (Exception ignored) {
            }
        }

        // 8d. Ghi nhận giao dịch hoàn tiền PENDING (nếu có số tiền hoàn > 0)
        if (refundAmount.compareTo(BigDecimal.ZERO) > 0) {
            try {
                String refTxnCode = "REF-OUT-" + contract.getId() + "-" + (System.currentTimeMillis() % 100000);
                jdbcTemplate.update(
                        "INSERT INTO payment_transactions " +
                                "(transaction_code, user_id, reservation_id, contract_id, payment_type, payment_method, amount, status, paid_at) " +
                                "VALUES (?, ?, ?, ?, 'REFUND', 'BANK_TRANSFER', ?, 'PENDING', NULL)",
                        refTxnCode, customerId, reservationId, contract.getId(), refundAmount);
            } catch (Exception ignored) {
            }
        }

        // 8e. Tạo task REFUND cho Quản lý cơ sở (PR-O11: "Bằng 0 vẫn tạo task để FM đóng hồ sơ")
        Integer managerId = null;
        try {
            managerId = jdbcTemplate.queryForObject(
                    "SELECT TOP 1 u.id FROM users u JOIN roles r ON u.role_id = r.id " +
                            "WHERE u.facility_id = ? AND r.name = 'FACILITY_MANAGER' AND u.status = 'ACTIVE' ORDER BY u.id ASC",
                    Integer.class,
                    task.getFacilityId());
        } catch (Exception ignored) {
        }

        String bankInfo = extractBankInfoFromTaskNote(originalTaskNote);
        String refundNoteStr = calc.getBreakdownDescription();
        if (!bankInfo.isEmpty()) {
            refundNoteStr += " | " + bankInfo;
        }
        if (refundNoteStr.length() > 1000) {
            refundNoteStr = refundNoteStr.substring(0, 997) + "...";
        }

        StaffTask refundTask = new StaffTask();
        refundTask.setFacilityId(task.getFacilityId());
        refundTask.setContract(contract);
        refundTask.setTaskType("REFUND");
        refundTask.setStatus("OPEN");
        if (managerId != null) {
            refundTask.setStaff(userRepository.getReferenceById(managerId));
        }
        refundTask.setDueAt(calculateRefundDeadline(now)); // PR-93: 24h không tính Chủ Nhật
        refundTask.setNote(refundNoteStr);
        staffTaskRepository.save(refundTask);

        // 9. Ghi nhật ký hoạt động (activity_logs)
        try {
            String logMsg = "[CHECK_OUT] Nghiệm thu HĐ " + contract.getContractCode()
                    + ", ô " + (unit != null ? unit.getId() : "—")
                    + (hasDamage ? " (" + rawDamages.size() + " sự cố, khách chịu " + vndFmt.format(totalDamageCost) + "đ"
                            + (facilityDamageCost.compareTo(BigDecimal.ZERO) > 0 ? ", cơ sở chịu " + vndFmt.format(facilityDamageCost) + "đ" : "")
                            + ")" : " (Nguyên vẹn)")
                    + ", tổng hoàn: " + vndFmt.format(refundAmount) + "đ"
                    + (calc.getEarlyRentRefund().compareTo(BigDecimal.ZERO) > 0 ? " (gồm " + vndFmt.format(calc.getEarlyRentRefund()) + "đ tiền thuê trả sớm)" : "");
            if (logMsg.length() > 500) {
                logMsg = logMsg.substring(0, 497) + "...";
            }
            jdbcTemplate.update(
                    "INSERT INTO activity_logs (user_id, action, target_entity, target_id, created_at) " +
                            "VALUES (?, ?, 'rental_contracts', ?, SYSDATETIME())",
                    staffId,
                    logMsg,
                    String.valueOf(contract.getId()));
        } catch (Exception ignored) {
        }

        entityManager.flush();
        entityManager.clear();
        return toDetailResponse(staffTaskRepository.findDetailById(taskId).orElseThrow());
    }

    // ================== PR-O10: HOÀN TẤT TASK BẢO TRÌ Ô KHO ==================

    // Staff đang giữ task, hoặc FM của cơ sở (đóng thẳng, không cần nhận việc) bấm "Sửa xong" / "Dọn xong".
    // 1 transaction: task COMPLETED + ô MAINTENANCE → AVAILABLE + log.
    @Transactional
    public StaffTaskDetailResponse completeMaintenanceTask(Integer taskId, Integer userId, CompleteMaintenanceRequest request) {
        if (userId == null) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Thiếu thông tin người thao tác");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new StaffTaskException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "Không tìm thấy tài khoản"));
        String role = user.getRole() != null ? user.getRole().getName() : "";
        boolean isManager = "FACILITY_MANAGER".equals(role);
        if (!isManager && !"STAFF".equals(role)) {
            throw new StaffTaskException(HttpStatus.FORBIDDEN, "FORBIDDEN_ROLE",
                    "Chỉ nhân viên hoặc quản lý cơ sở mới được hoàn tất bảo trì");
        }
        StaffTask task = findTaskInFacility(taskId, user.getFacilityId());
        if (!"MAINTENANCE".equals(task.getTaskType())) {
            throw new StaffTaskException(HttpStatus.CONFLICT, "TASK_NOT_MAINTENANCE", "Task này không phải task bảo trì ô kho");
        }

        String workNote = request != null && request.getNote() != null ? request.getNote().trim() : "";
        if (workNote.length() < 10 || workNote.length() > 1000) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_INPUT",
                    "Ghi chú công việc đã làm bắt buộc, từ 10 đến 1000 ký tự");
        }
        String evidence = request.getEvidenceImageUrl() != null && !request.getEvidenceImageUrl().isBlank()
                ? request.getEvidenceImageUrl().trim() : null;
        if (evidence != null && evidence.length() > 1000) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Link ảnh sau sửa tối đa 1000 ký tự");
        }

        // PR-Q10: dọn kho sau thanh lý → bắt buộc biên bản kiểm kê (trừ khi ô trống, khách không để lại gì)
        boolean cleanup = "LIQUIDATION".equals(task.getMaintenanceReason());
        boolean recordGoods = cleanup && !Boolean.TRUE.equals(request.getNoGoodsLeft());
        List<String> inventoryImages = request.getInventoryImages() == null ? Collections.emptyList()
                : request.getInventoryImages().stream().filter(s -> s != null && !s.isBlank()).map(String::trim).toList();
        if (recordGoods) {
            validateInventory(request, inventoryImages);
        }

        LocalDateTime now = LocalDateTime.now();
        String fullNote = appendTaskNote(task.getNote(), "[Hoàn tất bởi " + (isManager ? "Quản lý " : "")
                + user.getFullName() + " lúc " + now.format(TS_FMT) + ": " + workNote + "]");

        // UPDATE có điều kiện: chống bấm đúp, chống đóng task đã huỷ / đã xong, Staff phải đúng người giữ
        int updated = isManager
                ? staffTaskRepository.completeMaintenanceByManager(taskId, now, fullNote, evidence)
                : staffTaskRepository.completeMaintenanceByStaff(taskId, userId, now, fullNote, evidence);
        if (updated == 0) {
            throw explainMaintenanceFailure(taskId, userId);
        }

        StaffTask done = staffTaskRepository.findDetailById(taskId).orElseThrow();
        StorageUnit unit = done.getContract() != null ? done.getContract().getStorageUnit() : null;
        if (unit != null && "MAINTENANCE".equals(unit.getStatus())) {
            unit.setStatus("AVAILABLE");
            storageUnitRepository.save(unit);
        }

        // PR-Q10: hàng của khách chuyển sang khu lưu giữ → lập hồ sơ lưu giữ 60 ngày
        if (recordGoods && done.getContract() != null) {
            heldGoodsService.createFromCleanup(done, done.getContract(), user,
                    request.getInventoryNote().trim(), inventoryImages,
                    request.getWitnessNote().trim(), request.getStorageLocation().trim());
        }

        activityLogService.log(
                user.getId(),
                "[MAINTENANCE_DONE] " + user.getFullName() + " hoàn tất bảo trì task #" + taskId
                        + (unit != null ? ", ô " + unit.getId() + " sẵn sàng cho thuê" : "") + ": " + workNote,
                "facility_tasks",
                String.valueOf(taskId)
        );

        entityManager.flush();
        entityManager.clear();
        return toDetailResponse(staffTaskRepository.findDetailById(taskId).orElseThrow());
    }

    // PR-Q10: biên bản kiểm kê hàng của khách khi dọn kho sau thanh lý
    private void validateInventory(CompleteMaintenanceRequest request, List<String> images) {
        String inventory = request.getInventoryNote() != null ? request.getInventoryNote().trim() : "";
        if (inventory.length() < 10 || inventory.length() > 2000) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVENTORY_REQUIRED",
                    "Danh sách hàng kiểm kê bắt buộc, từ 10 đến 2000 ký tự (hoặc đánh dấu \"Ô trống, không còn hàng\")");
        }
        String witness = request.getWitnessNote() != null ? request.getWitnessNote().trim() : "";
        if (witness.isEmpty() || witness.length() > 500) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVENTORY_REQUIRED",
                    "Ghi rõ người mở kho / người chứng kiến (ít nhất 2 người, tối đa 500 ký tự)");
        }
        String location = request.getStorageLocation() != null ? request.getStorageLocation().trim() : "";
        if (location.isEmpty() || location.length() > 100) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVENTORY_REQUIRED", "Ghi rõ khu lưu giữ hàng (tối đa 100 ký tự)");
        }
        if (images.isEmpty()) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVENTORY_REQUIRED", "Bắt buộc ít nhất 1 ảnh kiểm kê hàng của khách");
        }
    }

    // PR-O10: FM bấm "Mở lại kho" (UC-06) khi ô còn task bảo trì đang mở → đóng luôn task, tránh task treo / quá hạn mãi.
    @Transactional
    public int closeOpenMaintenanceForUnit(String unitId, Integer actorId) {
        List<StaffTask> tasks = staffTaskRepository.findMaintenanceByUnitAndStatusIn(unitId, OPEN_STATUSES);
        if (tasks.isEmpty()) return 0;
        LocalDateTime now = LocalDateTime.now();
        for (StaffTask t : tasks) {
            t.setStatus("COMPLETED");
            t.setCompletedAt(now);
            t.setNote(appendTaskNote(t.getNote(), "[FM mở lại kho lúc " + now.format(TS_FMT) + "]"));
            activityLogService.log(actorId != null ? actorId : 1,
                    "[MAINTENANCE_DONE] Đóng task bảo trì #" + t.getId() + " do Quản lý mở lại ô " + unitId,
                    "facility_tasks", String.valueOf(t.getId()));
        }
        staffTaskRepository.saveAll(tasks);
        return tasks.size();
    }

    // PR-O10: task bảo trì đang mở mới nhất của 1 ô (dùng ở danh mục ô kho UC-06)
    @Transactional(readOnly = true)
    public Optional<StaffTask> findOpenMaintenanceTask(String unitId) {
        return staffTaskRepository.findMaintenanceByUnitAndStatusIn(unitId, OPEN_STATUSES).stream()
                .max(Comparator.comparing(StaffTask::getId));
    }

    private StaffTaskException explainMaintenanceFailure(Integer taskId, Integer staffId) {
        StaffTask current = staffTaskRepository.findDetailById(taskId).orElseThrow();
        String status = current.getStatus();
        if ("COMPLETED".equals(status)) {
            return new StaffTaskException(HttpStatus.CONFLICT, "TASK_ALREADY_COMPLETED", "Task bảo trì đã được hoàn tất trước đó");
        }
        if ("CANCELLED".equals(status)) {
            return new StaffTaskException(HttpStatus.CONFLICT, "TASK_CANCELLED", "Task bảo trì đã bị huỷ");
        }
        if (current.getStaff() != null && !current.getStaff().getId().equals(staffId)) {
            return new StaffTaskException(HttpStatus.CONFLICT, "TASK_NOT_YOURS",
                    "Task bảo trì đang do " + current.getStaff().getFullName() + " phụ trách");
        }
        return new StaffTaskException(HttpStatus.CONFLICT, "TASK_NOT_IN_PROGRESS",
                "Bạn cần bấm \"Nhận việc\" trước khi hoàn tất bảo trì");
    }

    // Nối thêm 1 đoạn vào ghi chú task, cắt còn 1000 ký tự (giới hạn cột note)
    private static String appendTaskNote(String original, String suffix) {
        String merged = (original == null || original.isBlank() ? "" : original + " | ") + suffix;
        return merged.length() > 1000 ? merged.substring(0, 997) + "..." : merged;
    }

    private void validateCheckOutRequest(CheckOutRequest request) {
        if (request == null) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Thiếu nội dung biên bản nghiệm thu");
        }
        // PR-O6: "Xác minh danh tính", "Ô trống hoàn toàn", "Khách ký biên bản" là bắt buộc đạt (blocking)
        if (!Boolean.TRUE.equals(request.getIdentityVerified())) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "CHECKLIST_INCOMPLETE",
                    "Bắt buộc phải xác minh CCCD của khách hàng trước khi nghiệm thu trả kho");
        }
        if (!Boolean.TRUE.equals(request.getUnitEmpty())) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "CHECKLIST_INCOMPLETE",
                    "Ô kho phải được dọn trống hoàn toàn mới có thể hoàn tất trả kho");
        }
        if (!Boolean.TRUE.equals(request.getCustomerSignatureConfirmed())) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "CHECKLIST_INCOMPLETE",
                    "Khách hàng cần ký xác nhận biên bản nghiệm thu trả kho");
        }
        if (request.getUnitClean() == null || request.getLockIntact() == null) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "CHECKLIST_INCOMPLETE",
                    "Vui lòng đánh giá đầy đủ tình trạng vệ sinh và khoá của ô kho");
        }
        if (request.getNotes() != null && request.getNotes().trim().length() > 1000) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Ghi chú tối đa 1000 ký tự");
        }

        boolean conditionFailed = !Boolean.TRUE.equals(request.getUnitClean()) || !Boolean.TRUE.equals(request.getLockIntact());
        List<CheckOutRequest.DamageItemRequest> damages = request.getDamageCases() != null
                ? request.getDamageCases()
                : Collections.emptyList();

        // PR-O6 & UC-24: Nếu ô không sạch hoặc khoá không nguyên vẹn → bắt buộc lập ít nhất 1 mục sự cố
        if (conditionFailed && damages.isEmpty()) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "DAMAGE_REPORT_REQUIRED",
                    "Ô kho không sạch hoặc khoá/tài sản hư hỏng — bắt buộc ghi nhận ít nhất 1 mục sự cố kèm ảnh bằng chứng");
        }

        for (int i = 0; i < damages.size(); i++) {
            CheckOutRequest.DamageItemRequest item = damages.get(i);
            int idx = i + 1;
            if (item == null || item.getTitle() == null || item.getTitle().isBlank()) {
                throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_DAMAGE_ITEM",
                        "Hạng mục sự cố #" + idx + " thiếu tiêu đề / tên sự cố");
            }
            if (item.getTitle().trim().length() > 150) {
                throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_DAMAGE_ITEM",
                        "Tiêu đề sự cố #" + idx + " tối đa 150 ký tự");
            }
            if (item.getDescription() != null && item.getDescription().trim().length() > 1000) {
                throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_DAMAGE_ITEM",
                        "Mô tả sự cố #" + idx + " tối đa 1000 ký tự");
            }
            if (item.getEstimatedCost() == null || item.getEstimatedCost().compareTo(BigDecimal.ZERO) < 0) {
                throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_DAMAGE_ITEM",
                        "Chi phí đền bù của sự cố #" + idx + " phải lớn hơn hoặc bằng 0");
            }
            // UC-24: bắt buộc chọn ai chịu lỗi — quyết định có trừ cọc khách hay không
            // (List.of(...).contains(null) ném NPE → kiểm tra null trước)
            if (item.getLiableParty() == null || !LIABLE_PARTIES.contains(item.getLiableParty())) {
                throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_DAMAGE_ITEM",
                        "Sự cố #" + idx + " chưa chọn lỗi do khách (CUSTOMER) hay do cơ sở (FACILITY)");
            }
            List<String> validPhotos = item.getEvidenceImages() == null ? Collections.emptyList()
                    : item.getEvidenceImages().stream().filter(s -> s != null && !s.isBlank()).toList();
            if (validPhotos.isEmpty()) {
                throw new StaffTaskException(HttpStatus.BAD_REQUEST, "EVIDENCE_IMAGE_REQUIRED",
                        "Hạng mục sự cố #" + idx + " (\"" + item.getTitle().trim() + "\") bắt buộc phải đính kèm ít nhất 1 ảnh bằng chứng");
            }
        }
    }

    private StaffTaskException explainCheckOutFailure(Integer taskId, Integer staffId) {
        StaffTask current = staffTaskRepository.findDetailById(taskId).orElseThrow();
        String status = current.getStatus();
        if ("COMPLETED".equals(status)) {
            return new StaffTaskException(HttpStatus.CONFLICT, "TASK_ALREADY_COMPLETED", "Task đã được nghiệm thu trả kho xong");
        }
        if ("OVERDUE".equals(status)) {
            return new StaffTaskException(HttpStatus.CONFLICT, "TASK_OVERDUE",
                    "Task đã quá hạn 21:00, vui lòng báo quản lý cơ sở dời ngày trả kho");
        }
        if ("IN_PROGRESS".equals(status)) {
            if (current.getStaff() == null || !current.getStaff().getId().equals(staffId)) {
                return new StaffTaskException(HttpStatus.CONFLICT, "TASK_NOT_YOURS",
                        "Task này do nhân viên khác phụ trách");
            }
            return new StaffTaskException(HttpStatus.CONFLICT, "TASK_OVERDUE",
                    "Task đã quá hạn 21:00, không thể lập biên bản");
        }
        if ("CANCELLED".equals(status)) {
            return new StaffTaskException(HttpStatus.CONFLICT, "TASK_NOT_IN_PROGRESS", "Task trả kho đã bị huỷ");
        }
        return new StaffTaskException(HttpStatus.CONFLICT, "TASK_NOT_IN_PROGRESS",
                "Bạn cần nhận việc trước khi lập biên bản nghiệm thu");
    }

    private String extractBankInfoFromTaskNote(String note) {
        if (note == null || note.isBlank()) return "";
        int idx = note.indexOf("Hoàn cọc STK:");
        if (idx >= 0) {
            return note.substring(idx).trim();
        }
        return note.trim();
    }

    private String serializeEvidenceImages(List<String> images) {
        if (images == null) return "";
        List<String> cleaned = images.stream()
                .filter(s -> s != null && !s.isBlank())
                .map(String::trim)
                .toList();
        return String.join(IMG_DELIMITER, cleaned);
    }

    private List<String> parseEvidenceImages(String raw) {
        if (raw == null || raw.isBlank()) return Collections.emptyList();
        String trimmed = raw.trim();
        if (trimmed.contains("|||")) {
            String[] parts = trimmed.split("\\R?\\|\\|\\|\\R?");
            List<String> result = new ArrayList<>();
            for (String p : parts) {
                if (!p.isBlank()) result.add(p.trim());
            }
            return result;
        }
        if (trimmed.startsWith("data:image")) {
            return List.of(trimmed);
        }
        String[] parts = trimmed.split("[\\r\\n,]+");
        List<String> result = new ArrayList<>();
        for (String p : parts) {
            if (!p.isBlank()) result.add(p.trim());
        }
        return result;
    }

    private StaffTaskDetailResponse toDetailResponse(StaffTask task) {
        SupportRequest sr = null;
        if (task.getSupportRequestId() != null) {
            sr = supportRequestRepository.findDetailById(task.getSupportRequestId()).orElse(null);
        }

        RentalContract contract = task.getContract() != null ? task.getContract() : (sr != null ? sr.getContract() : null);
        User staff = task.getStaff();
        StorageUnit unit = contract != null ? contract.getStorageUnit() : null;
        User customer = contract != null ? contract.getCustomer() : (sr != null ? sr.getCustomer() : null);

        String customerName = customer != null ? customer.getFullName() : null;
        String customerPhone = customer != null ? customer.getPhone() : null;
        String customerEmail = customer != null ? customer.getEmail() : null;
        String unitTypeName = unit != null && unit.getUnitType() != null ? unit.getUnitType().getName() : null;
        String reservationCode = null;

        String facName = null;
        if (unit != null && unit.getFacility() != null) {
            facName = unit.getFacility().getName();
        } else if (task.getFacilityId() != null) {
            facName = facilityRepository.findById(task.getFacilityId()).map(f -> f.getName()).orElse(null);
        }

        java.util.Optional<com.queenkho.api.entity.Reservation> resOpt = java.util.Optional.empty();
        // Nếu contract null (task hoàn cọc đơn đặt chỗ bị hủy) -> Tìm qua reservation hoặc parse note
        if (contract == null && task.getNote() != null) {
            java.util.regex.Matcher mRes = java.util.regex.Pattern.compile("Đơn:\\s*([A-Za-z0-9_-]+)").matcher(task.getNote());
            if (mRes.find()) {
                reservationCode = mRes.group(1).trim();
                resOpt = reservationRepository.findByReservationCode(reservationCode);
                if (resOpt.isPresent()) {
                    com.queenkho.api.entity.Reservation res = resOpt.get();
                    if (res.getCustomer() != null) {
                        customerName = res.getCustomer().getFullName();
                        customerPhone = res.getCustomer().getPhone();
                        customerEmail = res.getCustomer().getEmail();
                    }
                    if (facName == null && res.getFacility() != null) {
                        facName = res.getFacility().getName();
                    }
                    if (unitTypeName == null && res.getUnitType() != null) {
                        unitTypeName = res.getUnitType().getName();
                    }
                }
            }

            // Fallback parse từ note nếu không tìm thấy reservation
            if (customerName == null) {
                java.util.regex.Matcher mName = java.util.regex.Pattern.compile("Khách:\\s*([^|(]+)").matcher(task.getNote());
                if (mName.find()) {
                    customerName = mName.group(1).trim();
                }
            }
            if (customerPhone == null) {
                java.util.regex.Matcher mPhone = java.util.regex.Pattern.compile("SĐT:\\s*([^)]+)").matcher(task.getNote());
                if (mPhone.find()) {
                    customerPhone = mPhone.group(1).trim();
                }
            }
        }

        // Chỉ task đã hoàn thành mới có biên bản
        HandoverRecordResponse handover = null;
        if (contract != null && "COMPLETED".equals(task.getStatus())
                && ("CHECK_IN".equals(task.getTaskType()) || "CHECK_OUT".equals(task.getTaskType()))) {
            handover = handoverRecordRepository
                    .findFirstByContractIdAndRecordTypeOrderByIdDesc(contract.getId(), task.getTaskType())
                    .map(this::toHandoverResponse)
                    .orElse(null);
        }

        // UC-24: Lấy danh sách sự cố hư hỏng (task CHECK_OUT, hoặc REFUND / MAINTENANCE của hợp đồng).
        // totalDamageCost = phần lỗi khách (trừ cọc); facilityDamageCost = phần cơ sở tự chịu.
        List<DamageCaseResponse> damageResponses = Collections.emptyList();
        BigDecimal totalDamageCost = BigDecimal.ZERO;
        BigDecimal facilityDamageCost = BigDecimal.ZERO;
        if ("CHECK_OUT".equals(task.getTaskType())
                || (("REFUND".equals(task.getTaskType()) || "MAINTENANCE".equals(task.getTaskType())) && contract != null)) {
            List<DamageCase> cases = "CHECK_OUT".equals(task.getTaskType())
                    ? damageCaseRepository.findByTask_IdOrderByIdAsc(task.getId())
                    : damageCaseRepository.findByContract_IdOrderByIdAsc(contract.getId());
            if (cases.isEmpty() && contract != null) {
                cases = damageCaseRepository.findByContract_IdOrderByIdAsc(contract.getId());
            }
            List<DamageCaseResponse> mapped = new ArrayList<>();
            for (DamageCase dc : cases) {
                BigDecimal cost = dc.getEstimatedCost() != null ? dc.getEstimatedCost() : BigDecimal.ZERO;
                if ("FACILITY".equals(dc.getLiableParty())) {
                    facilityDamageCost = facilityDamageCost.add(cost);
                } else {
                    totalDamageCost = totalDamageCost.add(cost);
                }
                mapped.add(DamageCaseResponse.builder()
                        .id(dc.getId())
                        .title(dc.getTitle())
                        .description(dc.getDescription())
                        .estimatedCost(cost)
                        .liableParty(dc.getLiableParty())
                        .evidenceImages(parseEvidenceImages(dc.getEvidenceImageUrls()))
                        .createdAt(dc.getCreatedAt())
                        .build());
            }
            damageResponses = mapped;
        }

        BigDecimal depositHeld = contract != null && contract.getDepositHeldAmount() != null
                ? contract.getDepositHeldAmount()
                : BigDecimal.ZERO;
        BigDecimal refundAmount = depositHeld.subtract(totalDamageCost).max(BigDecimal.ZERO);
        BigDecimal excessDebtAmount = totalDamageCost.subtract(depositHeld).max(BigDecimal.ZERO);
        BigDecimal depositRefund = refundAmount;
        if (contract == null) {
            if (resOpt != null && resOpt.isPresent()) {
                com.queenkho.api.entity.Reservation res = resOpt.get();
                BigDecimal resDeposit = res.getTotalDepositPaid() != null && res.getTotalDepositPaid().compareTo(BigDecimal.ZERO) > 0
                        ? res.getTotalDepositPaid()
                        : (res.getDepositAmount() != null ? res.getDepositAmount() : BigDecimal.ZERO);
                depositHeld = resDeposit.setScale(0, RoundingMode.HALF_UP);

                try {
                    BigDecimal resRefund = jdbcTemplate.queryForObject(
                            "SELECT TOP 1 amount FROM payment_transactions WHERE reservation_id = ? AND payment_type = 'REFUND' ORDER BY id DESC",
                            BigDecimal.class, res.getId());
                    if (resRefund != null && resRefund.compareTo(BigDecimal.ZERO) > 0) {
                        refundAmount = resRefund.setScale(0, RoundingMode.HALF_UP);
                        depositRefund = refundAmount;
                    }
                } catch (Exception ignored) {
                }
            }

            if (refundAmount.compareTo(BigDecimal.ZERO) == 0 && task.getNote() != null) {
                java.util.regex.Matcher mRef = java.util.regex.Pattern.compile("(?:Số tiền hoàn|Hoàn tiền|Số tiền):\\s*([0-9.,]+)").matcher(task.getNote());
                if (mRef.find()) {
                    String val = mRef.group(1).trim();
                    if (val.endsWith(".00")) val = val.substring(0, val.length() - 3);
                    val = val.replace(",", "").replace(".", "");
                    try {
                        refundAmount = new BigDecimal(val);
                        depositRefund = refundAmount;
                    } catch (Exception ignored) {
                    }
                }
            }
            if (depositHeld.compareTo(BigDecimal.ZERO) == 0 && refundAmount.compareTo(BigDecimal.ZERO) > 0) {
                depositHeld = refundAmount;
                if (task.getNote() != null) {
                    java.util.regex.Matcher mPen = java.util.regex.Pattern.compile("(?:Đã trừ (?:phạt )?(?:hủy trễ|phí hủy)?(?:\\s*50% cọc)?:?|Phí hủy:?)\\s*([0-9.,]+)").matcher(task.getNote());
                    if (mPen.find()) {
                        String val = mPen.group(1).trim();
                        if (val.endsWith(".00")) val = val.substring(0, val.length() - 3);
                        val = val.replace(",", "").replace(".", "");
                        try {
                            depositHeld = depositHeld.add(new BigDecimal(val));
                        } catch (Exception ignored) {
                        }
                    }
                }
            }
        }
        BigDecimal earlyRentRefund = BigDecimal.ZERO;
        BigDecimal rentPaid = BigDecimal.ZERO;
        BigDecimal breakFee = BigDecimal.ZERO;
        BigDecimal graceFee = BigDecimal.ZERO;
        BigDecimal lateFee = BigDecimal.ZERO;
        Integer usedMonths = null;
        Integer cycleMonths = null;
        BigDecimal baseMonthlyPrice = null;
        String refundBreakdownNote = null;
        String taskNote = task.getNote();

        if (contract != null && ("CHECK_OUT".equals(task.getTaskType()) || "REFUND".equals(task.getTaskType()))) {
            LocalDate refDate = task.getCompletedAt() != null
                    ? task.getCompletedAt().toLocalDate()
                    : (task.getCreatedAt() != null ? task.getCreatedAt().toLocalDate() : LocalDate.now());
            RefundCalculationResult calc = calculateCheckoutRefund(contract, refDate, totalDamageCost);
            depositHeld = calc.getDepositHeld();
            refundAmount = calc.getTotalRefundAmount();
            excessDebtAmount = calc.getExcessDebtAmount();
            depositRefund = calc.getDepositRefund();
            earlyRentRefund = calc.getEarlyRentRefund();
            rentPaid = calc.getRentPaid();
            breakFee = calc.getBreakFee();
            graceFee = calc.getGraceFee();
            lateFee = calc.getLateFee();
            usedMonths = calc.getUsedMonths();
            cycleMonths = calc.getCycleMonths();
            baseMonthlyPrice = calc.getBaseMonthlyPrice();
            refundBreakdownNote = calc.getBreakdownDescription();

            if ("REFUND".equals(task.getTaskType())) {
                taskNote = buildEnrichedRefundNote(contract, taskNote, refDate);
            }
        }

        // PR-Q10: task dọn kho sau thanh lý đã lập hồ sơ lưu giữ hàng
        HeldGoods heldGoods = "MAINTENANCE".equals(task.getTaskType())
                ? heldGoodsRepository.findFirstByTaskId(task.getId()).orElse(null)
                : null;

        boolean urgent = sr != null
                ? SupportRequestService.isUrgentIssue(sr.getIssueType())
                : ("SUPPORT".equals(task.getTaskType()) && taskNote != null && taskNote.contains("[KHẨN]"));

        return StaffTaskDetailResponse.builder()
                .id(task.getId())
                .facilityId(task.getFacilityId())
                .taskType(task.getTaskType())
                .status(task.getStatus())
                .dueAt(task.getDueAt())
                .createdAt(task.getCreatedAt())
                .claimedAt(task.getClaimedAt())
                .completedAt(task.getCompletedAt())
                .evidenceImageUrl(task.getEvidenceImageUrl())
                .note(taskNote)
                .staffId(staff != null ? staff.getId() : null)
                .staffName(staff != null ? staff.getFullName() : null)
                .contractId(contract != null ? contract.getId() : null)
                .contractCode(contract != null ? contract.getContractCode() : null)
                .reservationCode(reservationCode)
                .reservationId(contract != null && contract.getReservation() != null ? contract.getReservation().getId() : null)
                .contractStatus(contract != null ? contract.getStatus() : null)
                .contractStartDate(contract != null ? contract.getStartDate() : null)
                .contractEndDate(contract != null ? contract.getEndDate() : null)
                .depositHeldAmount(depositHeld)
                .accessPinCode(contract != null ? contract.getAccessPinCode() : null)
                .rfidCardCode(contract != null ? contract.getRfidCardCode() : null)
                .customerName(customerName)
                .customerPhone(customerPhone)
                .customerEmail(customerEmail)
                .customerCccd(customer != null ? customer.getCccd() : null)
                .storageUnitId(unit != null ? unit.getId() : null)
                .storageUnitStatus(unit != null ? unit.getStatus() : null)
                .unitTypeName(unitTypeName)
                .facilityName(facName)
                .handoverRecord(handover)
                .damageCases(damageResponses)
                .totalDamageCost(totalDamageCost)
                .facilityDamageCost(facilityDamageCost)
                .maintenanceReason(task.getMaintenanceReason())
                .heldGoodsId(heldGoods != null ? heldGoods.getId() : null)
                .heldGoodsStatus(heldGoods != null ? heldGoods.getStatus() : null)
                .heldGoodsHoldUntil(heldGoods != null ? heldGoods.getHoldUntil() : null)
                .refundAmount(refundAmount)
                .excessDebtAmount(excessDebtAmount)
                .depositRefund(depositRefund)
                .earlyRentRefund(earlyRentRefund)
                .rentPaid(rentPaid)
                .breakFee(breakFee)
                .graceFee(graceFee)
                .lateFee(lateFee)
                .usedMonths(usedMonths)
                .cycleMonths(cycleMonths)
                .baseMonthlyPrice(baseMonthlyPrice)
                .refundBreakdownNote(refundBreakdownNote)
                .supportRequestId(task.getSupportRequestId())
                .ticketCode(sr != null ? sr.getTicketCode() : null)
                .issueType(sr != null ? sr.getIssueType() : null)
                .urgent(urgent)
                .ticketStatus(sr != null ? sr.getStatus() : null)
                .ticketDescription(sr != null ? sr.getDescription() : null)
                .resolutionNote(sr != null ? sr.getResolutionNote() : null)
                .ticketCreatedAt(sr != null ? sr.getCreatedAt() : null)
                .ticketResolvedAt(sr != null ? sr.getResolvedAt() : null)
                .ticketClosedAt(sr != null ? sr.getClosedAt() : null)
                .build();
    }

    private HandoverRecordResponse toHandoverResponse(HandoverRecord record) {
        User staff = record.getStaff();
        return HandoverRecordResponse.builder()
                .id(record.getId())
                .recordType(record.getRecordType())
                .identityVerified(record.getIdentityVerified())
                .unitEmpty(record.getUnitEmpty())
                .unitClean(record.getUnitClean())
                .lockIntact(record.getLockIntact())
                .customerSignatureConfirmed(record.getCustomerSignatureConfirmed())
                .notes(record.getNotes())
                .staffId(staff.getId())
                .staffName(staff.getFullName())
                .createdAt(record.getCreatedAt())
                .build();
    }

    // Báo cáo kết quả liên hệ khách hàng (No-Show workflow)
    @Transactional
    public StaffTaskResponse submitContactReport(Integer taskId, ContactReportRequest request) {
        if (request == null || request.getStaffId() == null) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Thiếu thông tin nhân viên thao tác");
        }
        User staff = userRepository.findById(request.getStaffId())
                .orElseThrow(() -> new StaffTaskException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "Không tìm thấy tài khoản"));

        StaffTask task = findTaskInFacility(taskId, staff.getFacilityId());

        String outcome = (request.getCallOutcome() != null && !request.getCallOutcome().isBlank())
                ? request.getCallOutcome().trim()
                : "Đã liên hệ khách";
        String detail = (request.getNote() != null && !request.getNote().isBlank())
                ? request.getNote().trim()
                : "";

        String formattedNote = "[" + outcome + "]" + (detail.isEmpty() ? "" : " - " + detail);
        if (formattedNote.length() > 500) {
            formattedNote = formattedNote.substring(0, 497) + "...";
        }

        task.setNote(formattedNote);
        if (task.getStaff() == null) {
            task.setStaff(staff);
            task.setClaimedAt(LocalDateTime.now());
        }
        staffTaskRepository.save(task);

        // PR-X3, PR-A10: Ghi nhận mã [CONTACT][FAILED] hoặc [CONTACT][SUCCESS] để đếm số lần liên hệ No-Show
        String outcomeLower = outcome.toLowerCase();
        boolean isFailed = outcomeLower.contains("không nghe máy") || outcomeLower.contains("thuê bao")
                || outcomeLower.contains("từ chối") || outcomeLower.contains("hủy") || outcomeLower.contains("thất bại");
        String contactTag = isFailed ? "[CONTACT][FAILED]" : "[CONTACT][SUCCESS]";

        String logAction = contactTag + " Nhân viên " + staff.getFullName() + " báo cáo liên hệ task #" + task.getId()
                + ": " + formattedNote;
        if (logAction.length() > 500) logAction = logAction.substring(0, 497) + "...";

        jdbcTemplate.update(
                "INSERT INTO activity_logs (user_id, action, target_entity, target_id, created_at) " +
                        "VALUES (?, ?, 'facility_tasks', ?, SYSDATETIME())",
                staff.getId(),
                logAction,
                task.getId());

        if (task.getContract() != null && task.getContract().getReservation() != null) {
            jdbcTemplate.update(
                    "INSERT INTO activity_logs (user_id, action, target_entity, target_id, created_at) " +
                            "VALUES (?, ?, 'reservations', ?, SYSDATETIME())",
                    staff.getId(),
                    logAction,
                    task.getContract().getReservation().getId());
        }

        return toResponse(task);
    }

    // Manager hoàn tất task hoàn tiền (REFUND) - Tuân thủ PR-O15 & L-24
    @Transactional
    public StaffTaskDetailResponse completeRefundTask(Integer taskId, Integer managerId, CompleteRefundRequest request) {
        User manager = findUserWithRole(managerId, "FACILITY_MANAGER", "Chỉ quản lý cơ sở mới được xác nhận hoàn tiền");
        StaffTask task = findTaskInFacility(taskId, manager.getFacilityId());

        if (!"REFUND".equalsIgnoreCase(task.getTaskType())) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_TASK_TYPE", "Task không thuộc loại hoàn tiền (REFUND)");
        }
        if ("COMPLETED".equalsIgnoreCase(task.getStatus()) || "CANCELLED".equalsIgnoreCase(task.getStatus())) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "TASK_ALREADY_CLOSED", "Task đã đóng trước đó");
        }

        if (request == null) {
            request = new CompleteRefundRequest();
        }

        boolean isTaskCash = task.getNote() != null && (
                task.getNote().contains("HOÀN CỌC TIỀN MẶT") ||
                task.getNote().toLowerCase().contains("tiền mặt"));
        String method = (request.getPaymentMethod() != null && !request.getPaymentMethod().isBlank())
                ? request.getPaymentMethod().trim().toUpperCase()
                : (isTaskCash ? "CASH" : "BANK_TRANSFER");

        String extraNote = request.getNote() != null && !request.getNote().isBlank()
                ? request.getNote().trim()
                : (request.getNotes() != null ? request.getNotes().trim() : "");

        // PR-O15: Bắt buộc bằng chứng hoàn tiền (chấp nhận cả khi upload ảnh chứng từ trên trang chi tiết)
        boolean hasEvidenceImg = request.getEvidenceImageUrl() != null && !request.getEvidenceImageUrl().isBlank();
        String ftCode = request.getBankTransactionCode() != null ? request.getBankTransactionCode().trim() : "";
        if (ftCode.isEmpty() && !extraNote.isEmpty()) {
            ftCode = extraNote;
        }

        if ("CASH".equals(method)) {
            if (!Boolean.TRUE.equals(request.getCashReceiptConfirmed()) && !hasEvidenceImg && extraNote.isEmpty()) {
                throw new StaffTaskException(HttpStatus.BAD_REQUEST, "REFUND_EVIDENCE_REQUIRED",
                        "Bắt buộc xác nhận khách hàng đã ký nhận tiền mặt tại quầy");
            }
        } else {
            if (!hasEvidenceImg) {
                throw new StaffTaskException(HttpStatus.BAD_REQUEST, "REFUND_EVIDENCE_REQUIRED",
                        "Bắt buộc tải ảnh biên lai khi hoàn tiền qua chuyển khoản");
            }
            if (ftCode.isEmpty()) {
                ftCode = "UNC-IMAGE";
            }
        }

        task.setStatus("COMPLETED");
        task.setCompletedAt(LocalDateTime.now());
        if (task.getStaff() == null) {
            task.setStaff(manager);
            task.setClaimedAt(LocalDateTime.now());
        }

        if (hasEvidenceImg) {
            task.setEvidenceImageUrl(request.getEvidenceImageUrl().trim());
        }

        String currentNote = task.getNote() != null ? task.getNote() : "";
        StringBuilder appendNote = new StringBuilder();
        if ("CASH".equals(method)) {
            appendNote.append(" | [ĐÃ HOÀN TIỀN MẶT - Khách đã ký nhận]");
        } else {
            appendNote.append(" | [ĐÃ HOÀN TIỀN CK - Mã FT: ").append(ftCode).append("]");
        }
        if (!extraNote.isEmpty()) {
            appendNote.append(" - ").append(extraNote);
        }
        String fullNote = currentNote + appendNote.toString();
        if (fullNote.length() > 1000) {
            fullNote = fullNote.substring(0, 997) + "...";
        }
        task.setNote(fullNote);
        staffTaskRepository.save(task);

        // Chỉ chuyển SUCCESS đúng giao dịch REFUND của task này (BUG-06 / K08: trước đây task không gắn HĐ
        // update MỌI REFUND PENDING của cả cơ sở → đơn khác chưa được hoàn cũng thành "đã hoàn")
        markRefundTransactionsSucceeded(task, method);

        // Ghi activity log (PR-A8, PR-A9)
        try {
            String logAction = "[REFUND] Quản lý " + manager.getFullName() + " xác nhận hoàn tất hoàn tiền task #" + task.getId()
                    + " (Phương thức: " + ("CASH".equals(method) ? "Tiền mặt" : "Chuyển khoản " + ftCode) + ")";
            if (logAction.length() > 500) logAction = logAction.substring(0, 497) + "...";
            jdbcTemplate.update(
                    "INSERT INTO activity_logs (user_id, action, target_entity, target_id, created_at) " +
                            "VALUES (?, ?, 'facility_tasks', ?, SYSDATETIME())",
                    manager.getId(),
                    logAction,
                    task.getId());
        } catch (Exception ignored) {
        }

        entityManager.flush();
        entityManager.clear();
        return toDetailResponse(staffTaskRepository.findDetailById(taskId).orElse(task));
    }




    private static final java.util.regex.Pattern REFUND_ORIGINAL_REF = java.util.regex.Pattern.compile("Mã gốc:\\s*([A-Za-z0-9_-]+)");
    private static final java.util.regex.Pattern REFUND_RESERVATION_CODE = java.util.regex.Pattern.compile("Đơn:\\s*([A-Za-z0-9_-]+)");

    // Xác định giao dịch REFUND của 1 task theo thứ tự chắc chắn nhất:
    //  1. Task hoàn tiền VNPAY về muộn: note có "Mã gốc: <ref>" → giao dịch REF-LATE-<ref>
    //  2. Task gắn hợp đồng (trả kho, No-Show, thanh lý): REFUND PENDING của hợp đồng đó
    //  3. Task huỷ đơn (không có hợp đồng): note có "Đơn: RES-xxx" → REFUND PENDING của đúng đơn đó
    int markRefundTransactionsSucceeded(StaffTask task, String method) {
        String note = task.getNote() != null ? task.getNote() : "";
        java.util.regex.Matcher lateRef = REFUND_ORIGINAL_REF.matcher(note);
        if (lateRef.find()) {
            return jdbcTemplate.update(
                    "UPDATE payment_transactions SET status = 'SUCCESS', payment_method = ?, paid_at = SYSDATETIME() " +
                            "WHERE payment_type = 'REFUND' AND status = 'PENDING' AND transaction_code = ?",
                    method, "REF-LATE-" + lateRef.group(1));
        }
        if (task.getContract() != null) {
            return jdbcTemplate.update(
                    "UPDATE payment_transactions SET status = 'SUCCESS', payment_method = ?, paid_at = SYSDATETIME() " +
                            "WHERE payment_type = 'REFUND' AND status = 'PENDING' AND contract_id = ? " +
                            "AND transaction_code NOT LIKE 'REF-LATE-%'",
                    method, task.getContract().getId());
        }
        java.util.regex.Matcher reservationCode = REFUND_RESERVATION_CODE.matcher(note);
        if (reservationCode.find()) {
            try {
                jdbcTemplate.update("UPDATE reservations SET status = 'REFUNDED' WHERE reservation_code = ?", reservationCode.group(1));
            } catch (Exception ignored) {
            }
            return jdbcTemplate.update(
                    "UPDATE payment_transactions SET status = 'SUCCESS', payment_method = ?, paid_at = SYSDATETIME() " +
                            "WHERE payment_type = 'REFUND' AND status = 'PENDING' AND transaction_code NOT LIKE 'REF-LATE-%' " +
                            "AND reservation_id = (SELECT id FROM reservations WHERE reservation_code = ?)",
                    method, reservationCode.group(1));
        }
        return 0;
    }

    // Overload cho backward compatibility
    @Transactional
    public StaffTaskDetailResponse completeRefundTask(Integer taskId, Integer managerId, String note) {
        CompleteRefundRequest req = new CompleteRefundRequest();
        req.setNote(note);
        req.setPaymentMethod("BANK_TRANSFER");
        req.setBankTransactionCode("FT-MANUAL-" + System.currentTimeMillis());
        return completeRefundTask(taskId, managerId, req);
    }

    // ================== HỆ THỐNG TÍNH TOÁN QUYẾT TOÁN HOÀN TIỀN (PR-O2, PR-O11, PR-O14, PR-Q3) ==================

    public RefundCalculationResult calculateCheckoutRefund(RentalContract contract, LocalDate actualCheckoutDate, BigDecimal totalDamageCost) {
        if (totalDamageCost == null) {
            totalDamageCost = BigDecimal.ZERO;
        }

        BigDecimal baseMonthlyPrice = BigDecimal.ZERO;
        if (contract.getStorageUnit() != null && contract.getStorageUnit().getUnitType() != null
                && contract.getStorageUnit().getUnitType().getBasePriceMonthly() != null) {
            baseMonthlyPrice = contract.getStorageUnit().getUnitType().getBasePriceMonthly();
        } else if (contract.getReservation() != null && contract.getReservation().getUnitType() != null
                && contract.getReservation().getUnitType().getBasePriceMonthly() != null) {
            baseMonthlyPrice = contract.getReservation().getUnitType().getBasePriceMonthly();
        }

        BigDecimal depositHeld = contract.getDepositHeldAmount() != null ? contract.getDepositHeldAmount() : BigDecimal.ZERO;
        if (depositHeld.compareTo(BigDecimal.ZERO) <= 0) {
            if (contract.getReservation() != null && contract.getReservation().getDepositAmount() != null
                    && contract.getReservation().getDepositAmount().compareTo(BigDecimal.ZERO) > 0) {
                depositHeld = contract.getReservation().getDepositAmount();
            } else if (baseMonthlyPrice.compareTo(BigDecimal.ZERO) > 0) {
                depositHeld = baseMonthlyPrice;
            }
        }
        if (baseMonthlyPrice.compareTo(BigDecimal.ZERO) <= 0) {
            baseMonthlyPrice = depositHeld;
        }

        LocalDate startDate = contract.getStartDate() != null ? contract.getStartDate() : LocalDate.now();
        LocalDate endDate = contract.getEndDate() != null ? contract.getEndDate() : startDate.plusMonths(1);
        LocalDate actualDate = actualCheckoutDate != null ? actualCheckoutDate : LocalDate.now();

        int monthsFromDates = 1;
        if (endDate.isAfter(startDate)) {
            Period totalP = Period.between(startDate, endDate);
            monthsFromDates = totalP.getYears() * 12 + totalP.getMonths() + (totalP.getDays() >= 15 ? 1 : 0);
        }
        int resMonths = (contract.getReservation() != null && contract.getReservation().getDurationMonths() != null)
                ? contract.getReservation().getDurationMonths() : 1;
        int billMonths = (contract.getBillingCycleMonths() != null && contract.getBillingCycleMonths() > 0)
                ? contract.getBillingCycleMonths() : 1;
        int cycleMonths = Math.max(monthsFromDates, Math.max(resMonths, billMonths));

        // Flow 4: % ưu đãi đã chốt trên đơn lúc đặt (BOM đổi chính sách sau đó không làm sai tiền hoàn)
        Integer snapshotDiscount = contract.getReservation() != null ? contract.getReservation().getRentDiscountPercent() : null;
        int discountPercent = snapshotDiscount != null ? snapshotDiscount
                : (cycleMonths >= 12 ? 15 : cycleMonths >= 6 ? 10 : cycleMonths >= 3 ? 5 : 0);
        BigDecimal rentPaid = PricingService.discountedRent(baseMonthlyPrice, cycleMonths, discountPercent);

        try {
            BigDecimal latestMonthlyRent = jdbcTemplate.queryForObject(
                    "SELECT COALESCE((SELECT TOP 1 amount FROM payment_transactions WHERE contract_id = ? AND payment_type = 'MONTHLY_RENT' AND status = 'SUCCESS' ORDER BY id DESC), 0)",
                    BigDecimal.class, contract.getId());
            if (latestMonthlyRent != null && latestMonthlyRent.compareTo(BigDecimal.ZERO) > 0) {
                rentPaid = latestMonthlyRent;
            } else {
                Integer resId = contract.getReservation() != null ? contract.getReservation().getId() : -1;
                BigDecimal totalPaid = jdbcTemplate.queryForObject(
                        "SELECT COALESCE(SUM(amount), 0) FROM payment_transactions " +
                                "WHERE (contract_id = ? OR reservation_id = ?) AND status = 'SUCCESS' AND payment_type IN ('DEPOSIT', 'MONTHLY_RENT')",
                        BigDecimal.class, contract.getId(), resId);
                if (totalPaid != null && totalPaid.compareTo(depositHeld) > 0) {
                    rentPaid = totalPaid.subtract(depositHeld);
                }
            }
        } catch (Exception ignored) {
        }

        // 1. Kiểm tra Trả sớm (PR-O2, D-10): ngày nghiệm thu < endDate
        boolean isEarlyCheckout = actualDate.isBefore(endDate);
        int usedMonths = 0;
        BigDecimal breakFee = BigDecimal.ZERO;
        BigDecimal earlyRentRefund = BigDecimal.ZERO;

        if (isEarlyCheckout) {
            if (actualDate.isAfter(startDate)) {
                Period period = Period.between(startDate, actualDate);
                int m = period.getYears() * 12 + period.getMonths();
                if (period.getDays() > 0) {
                    m += 1;
                }
                usedMonths = Math.max(1, m);
            } else {
                usedMonths = 1;
            }
            breakFee = baseMonthlyPrice;

            BigDecimal usedCost = baseMonthlyPrice.multiply(BigDecimal.valueOf(usedMonths));
            BigDecimal refundable = rentPaid.subtract(usedCost).subtract(breakFee);
            earlyRentRefund = refundable.max(BigDecimal.ZERO);
        }

        // 2. Kiểm tra Ân hạn (PR-O14, D-11) & Phí trễ hạn (PR-Q3): ngày nghiệm thu > endDate
        boolean overdueOrGrace = actualDate.isAfter(endDate);
        long daysPast = 0;
        BigDecimal graceFee = BigDecimal.ZERO;
        BigDecimal lateFee = BigDecimal.ZERO;

        if (overdueOrGrace) {
            daysPast = ChronoUnit.DAYS.between(endDate, actualDate);
            if (daysPast == 1) {
                graceFee = BigDecimal.ZERO;
            } else if (daysPast >= 2 && daysPast <= 5) {
                BigDecimal dailyRate = baseMonthlyPrice.divide(BigDecimal.valueOf(30), 0, RoundingMode.HALF_UP);
                graceFee = dailyRate.multiply(BigDecimal.valueOf(daysPast - 1));
            } else {
                long billableDays = Math.min(daysPast, 5);
                BigDecimal percent = new BigDecimal("0.10").multiply(BigDecimal.valueOf(billableDays));
                lateFee = depositHeld.multiply(percent).setScale(0, RoundingMode.HALF_UP);
            }
        }

        // 3. Quyết toán hoàn cọc (PR-O11)
        BigDecimal totalDepositDeductions = totalDamageCost.add(graceFee).add(lateFee);
        BigDecimal depositRefund = depositHeld.subtract(totalDepositDeductions).max(BigDecimal.ZERO);
        BigDecimal excessDebt = totalDepositDeductions.subtract(depositHeld).max(BigDecimal.ZERO);

        BigDecimal totalRefund = depositRefund.add(earlyRentRefund);
        if (excessDebt.compareTo(BigDecimal.ZERO) > 0) {
            if (earlyRentRefund.compareTo(excessDebt) >= 0) {
                totalRefund = earlyRentRefund.subtract(excessDebt);
                excessDebt = BigDecimal.ZERO;
            } else {
                excessDebt = excessDebt.subtract(earlyRentRefund);
                totalRefund = BigDecimal.ZERO;
            }
        }

        NumberFormat vndFmt = NumberFormat.getInstance(new Locale("vi", "VN"));
        StringBuilder desc = new StringBuilder();
        desc.append("Hoàn tiền trả kho | HĐ: ").append(contract.getContractCode())
                .append(" (Ô ").append(contract.getStorageUnit() != null ? contract.getStorageUnit().getId() : "—").append(")")
                .append(" | Cọc gốc ").append(vndFmt.format(depositHeld)).append("đ");

        if (totalDamageCost.compareTo(BigDecimal.ZERO) > 0) {
            desc.append(" - Phí hư hại ").append(vndFmt.format(totalDamageCost)).append("đ");
        }
        if (graceFee.compareTo(BigDecimal.ZERO) > 0) {
            desc.append(" - Phí ân hạn ").append(daysPast - 1).append(" ngày: ").append(vndFmt.format(graceFee)).append("đ");
        }
        if (lateFee.compareTo(BigDecimal.ZERO) > 0) {
            desc.append(" - Phí trễ ").append(vndFmt.format(lateFee)).append("đ (").append(daysPast).append(" ngày)");
        }
        desc.append(" => Cọc hoàn: ").append(vndFmt.format(depositRefund)).append("đ");

        if (earlyRentRefund.compareTo(BigDecimal.ZERO) > 0) {
            desc.append(" + Hoàn tiền thuê trả sớm: ").append(vndFmt.format(earlyRentRefund)).append("đ")
                    .append(" (Đã trả ").append(cycleMonths).append("T: ").append(vndFmt.format(rentPaid)).append("đ")
                    .append(" - Đã dùng ").append(usedMonths).append("T: ").append(vndFmt.format(baseMonthlyPrice.multiply(BigDecimal.valueOf(usedMonths)))).append("đ")
                    .append(" - Phí hủy HĐ: ").append(vndFmt.format(breakFee)).append("đ)");
        }

        desc.append(" => THỰC HOÀN ").append(vndFmt.format(totalRefund)).append("đ");

        if (excessDebt.compareTo(BigDecimal.ZERO) > 0) {
            desc.append(" [Nợ vượt cọc cần truy thu: ").append(vndFmt.format(excessDebt)).append("đ]");
        }

        return RefundCalculationResult.builder()
                .earlyCheckout(isEarlyCheckout)
                .usedMonths(usedMonths)
                .cycleMonths(cycleMonths)
                .baseMonthlyPrice(baseMonthlyPrice)
                .rentPaid(rentPaid)
                .breakFee(breakFee)
                .earlyRentRefund(earlyRentRefund)
                .overdueOrGrace(overdueOrGrace)
                .daysPastEndDate(daysPast)
                .graceFee(graceFee)
                .lateFee(lateFee)
                .depositHeld(depositHeld)
                .totalDamageCost(totalDamageCost)
                .depositRefund(depositRefund)
                .totalRefundAmount(totalRefund)
                .excessDebtAmount(excessDebt)
                .breakdownDescription(desc.toString())
                .build();
    }

    private String buildEnrichedRefundNote(RentalContract contract, String rawNote, LocalDate refDate) {
        try {
            BigDecimal dmg = BigDecimal.ZERO;
            List<DamageCase> cases = damageCaseRepository.findByContract_IdOrderByIdAsc(contract.getId());
            for (DamageCase dc : cases) {
                // Chỉ phần lỗi khách bị trừ vào cọc (UC-24)
                if (dc.getEstimatedCost() != null && !"FACILITY".equals(dc.getLiableParty())) {
                    dmg = dmg.add(dc.getEstimatedCost());
                }
            }
            if (dmg.compareTo(BigDecimal.ZERO) == 0 && rawNote != null) {
                java.util.regex.Matcher m = java.util.regex.Pattern.compile("(?:Phí hư hại|Sự cố:)\\s*([0-9.,]+)", java.util.regex.Pattern.CASE_INSENSITIVE).matcher(rawNote);
                if (m.find()) {
                    String val = m.group(1).trim();
                    if (val.endsWith(".00")) val = val.substring(0, val.length() - 3);
                    dmg = new BigDecimal(val.replace(",", "").replace(".", ""));
                }
            }
            RefundCalculationResult calc = calculateCheckoutRefund(contract, refDate, dmg);
            StringBuilder enriched = new StringBuilder(calc.getBreakdownDescription());
            if (rawNote != null && !rawNote.isBlank()) {
                String[] parts = rawNote.split("\\|");
                for (String part : parts) {
                    String p = part.trim();
                    if (p.startsWith("Ngân hàng:") || p.startsWith("STK:") || p.startsWith("Chủ TK:")
                            || p.startsWith("Hoàn cọc STK:") || p.startsWith("Hoàn tiền:")
                            || p.startsWith("Khách:") || p.startsWith("Lý do:")
                            || p.startsWith("[ĐÃ HOÀN")) {
                        enriched.append(" | ").append(p);
                    }
                }
            }
            return enriched.toString();
        } catch (Exception e) {
            return rawNote;
        }
    }

    // PR-93: Deadline xử lý hoàn tiền là 24h, không tính Chủ Nhật
    private LocalDateTime calculateRefundDeadline(LocalDateTime requestTime) {
        LocalDateTime deadline = requestTime.plusHours(24);
        if (requestTime.getDayOfWeek() == DayOfWeek.SUNDAY) {
            deadline = requestTime.plusDays(1).plusHours(24);
        } else if (deadline.getDayOfWeek() == DayOfWeek.SUNDAY) {
            deadline = deadline.plusDays(1);
        }
        return deadline;
    }

    // ================== JOB QUÁ HẠN ==================

    // @Modifying query bắt buộc chạy trong transaction → bọc ở đây
    @Transactional
    public int markOverdueTasks() {
        return staffTaskRepository.markOverdue(LocalDateTime.now());
    }
}
