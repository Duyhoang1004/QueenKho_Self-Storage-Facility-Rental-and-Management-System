package com.queenkho.api.service;

import com.queenkho.api.dto.CheckInRequest;
import com.queenkho.api.dto.CheckOutRequest;
import com.queenkho.api.dto.LateFeeCalculationResult;
import com.queenkho.api.dto.MoneyLine;
import com.queenkho.api.dto.CompleteMaintenanceRequest;
import com.queenkho.api.dto.CompleteRefundRequest;
import com.queenkho.api.dto.ContactReportRequest;
import com.queenkho.api.dto.DamageCaseResponse;
import com.queenkho.api.dto.ExtendSupportTaskRequest;
import com.queenkho.api.dto.HandoverRecordResponse;
import com.queenkho.api.dto.RefundCalculationResult;
import com.queenkho.api.dto.ResolveSupportTaskRequest;
import com.queenkho.api.dto.SettlementRefundSplit;
import com.queenkho.api.dto.StaffTaskDetailResponse;
import com.queenkho.api.dto.StaffTaskResponse;
import com.queenkho.api.entity.CheckoutSettlement;
import com.queenkho.api.entity.DamageCase;
import com.queenkho.api.entity.HandoverRecord;
import com.queenkho.api.entity.HeldGoods;
import com.queenkho.api.entity.RentalContract;
import com.queenkho.api.entity.StaffTask;
import com.queenkho.api.entity.StorageUnit;
import com.queenkho.api.entity.SupportRequest;
import com.queenkho.api.entity.User;
import com.queenkho.api.security.CurrentUser;
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
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
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
import java.sql.Timestamp;
import java.util.LinkedHashMap;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.regex.Matcher;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

@Service
public class StaffTaskService {

    // Giờ đóng cửa: hạn chót của mọi task
    private static final LocalTime CLOSING_TIME = LocalTime.of(21, 0);
    // Các trạng thái được coi là "task chưa đóng" (kể cả quá hạn — Manager vẫn phải
    // xử lý)
    private static final List<String> OPEN_STATUSES = List.of("OPEN", "IN_PROGRESS", "OVERDUE");
    private static final List<String> VALID_STATUSES = List.of("OPEN", "IN_PROGRESS", "OVERDUE", "COMPLETED", "CANCELLED");

    // UC-18: hợp đồng "còn hiệu lực" — PIN / thẻ RFID của chúng không được cấp
    // trùng
    private static final List<String> LIVE_CONTRACT_STATUSES = List.of("ACTIVE", "OVERDUE", "TERMINATION_PENDING");
    private static final int PIN_MAX_ATTEMPTS = 20;
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String IMG_DELIMITER = "\n|||\n";
    private static final List<String> CHECK_IN_PHOTO_KEYS = List.of(
            "identityVerified", "unitChecked", "lockIntact", "goodsChecked", "goodsValueVerified");
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter TS_FMT = DateTimeFormatter.ofPattern("HH:mm dd/MM/yyyy");
    // UC-24: ai chịu lỗi sự cố — CUSTOMER trừ cọc, FACILITY cơ sở tự chịu
    private static final List<String> LIABLE_PARTIES = List.of("CUSTOMER", "FACILITY");
    // PR-O10: số ngày cho task bảo trì (sửa chữa thường lâu hơn 1 ngày)
    private static final int MAINTENANCE_DUE_DAYS = 3;
    // PR-T1 (08/11/2026): task CHECK_IN / CHECK_OUT chỉ giao / nhận được trong vòng 30 ngày trước ngày hẹn
    public static final int ASSIGN_WINDOW_DAYS = 30;
    private static final List<String> WINDOWED_TASK_TYPES = List.of("CHECK_IN", "CHECK_OUT");

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
    private NotificationService notificationService;

    @Autowired
    private HeldGoodsService heldGoodsService;

    @Autowired
    private HeldGoodsRepository heldGoodsRepository;

    // D-18: ô kho tính theo lịch — check-in / trả kho / bảo trì xong thì tính lại trạng thái ô theo lịch
    @Autowired
    private UnitScheduleService unitScheduleService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private LateFeeService lateFeeService;

    // BR-126: task hỗ trợ của ticket hàng hư / mất = kiểm tra hiện trường cho hồ sơ bồi thường
    @Autowired(required = false)
    private CompensationClaimService compensationClaimService;

    // BR-131: tên loại hàng khách khai báo (hiện ở chi tiết task check-in)
    @Autowired(required = false)
    private OperationsCatalogService operationsCatalogService;

    // D-21: nghiệm thu xong → bảng quyết toán, khách xác nhận mới kết thúc hợp đồng (2 service gọi nhau → @Lazy)
    @Autowired
    @Lazy
    private CheckoutSettlementService settlementService;

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
    /**
     * PR-O31a (24/11/2026): ngày chốt quyết toán khi nghiệm thu. Luồng thật = hôm nay. Task đã bấm demo
     * "Khách tới trả đúng ngày hẹn" (hạn task dời về hôm nay) → ngày hẹn gốc, để số tiền khớp đúng số khách thấy lúc hẹn
     * (vd hẹn 25/11 → vẫn tính 1 ngày đã dùng dù nghiệm thu ngày 24/11).
     */
    public static LocalDate effectiveCheckoutDate(StaffTask task, LocalDate today) {
        LocalDate simulated = task != null ? task.getSimulatedCheckoutDate() : null;
        return simulated != null && simulated.isAfter(today) ? simulated : today;
    }

    public void rescheduleOpenTasks(Integer contractId, String taskType, LocalDate newAppointmentDate) {
        List<StaffTask> tasks = staffTaskRepository
                .findByContractIdAndTaskTypeAndStatusIn(contractId, taskType, OPEN_STATUSES);
        for (StaffTask task : tasks) {
            if ("CHECK_IN".equals(task.getTaskType())) lockCheckInTask(task.getId());
            task.setDueAt(computeDueAt(newAppointmentDate));
            task.setSimulatedCheckoutDate(null); // PR-O31a: khách dời hẹn thật → bỏ ngày hẹn giả lập cũ
            if ("OVERDUE".equals(task.getStatus())) {
                task.setStatus(task.getStaff() == null ? "OPEN" : "IN_PROGRESS");
            }
            if ("CHECK_IN".equals(task.getTaskType())) {
                Map<String, Object> latest = checkInEvent(contractId, "CI_DRAFT", "CI_ACCEPT", "CI_REJECT", "CI_FAULT", "CI_BLOCKER", "CI_RESOLUTION", "CI_REOPEN", "CI_RESCHEDULE", "CI_WITHDRAW");
                String latestType = latest != null ? String.valueOf(latest.get("record_type")) : null;
                boolean unitInMaintenance = task.getContract() != null && task.getContract().getStorageUnit() != null
                        && "MAINTENANCE".equalsIgnoreCase(task.getContract().getStorageUnit().getStatus());
                // Vấn đề 2: nếu khách đã từ chối (CI_REJECT / CI_RESOLUTION) và ô không đang bảo trì thì giữ trạng thái
                // REJECTED để sau khi dời lịch, staff/FM vẫn xử lý được các nội dung khách từ chối.
                boolean keepRejectedForResolution = !unitInMaintenance
                        && ("CI_REJECT".equals(latestType) || "CI_RESOLUTION".equals(latestType));
                if (latest != null && !keepRejectedForResolution
                        && !"CI_REOPEN".equals(latestType)
                        && !"CI_RESCHEDULE".equals(latestType) && !"CI_WITHDRAW".equals(latestType)) {
                    int draftId = "CI_DRAFT".equals(latestType) ? eventId(latest) : eventDraftId(latest);
                    if (draftId > 0 || "CI_BLOCKER".equals(latestType) || "CI_FAULT".equals(latestType)) addCheckInEvent(task.getContract(), null, "CI_RESCHEDULE",
                            Map.of("draftId", draftId, "note", "Dời lịch nhận kho; cần kiểm tra lại ô"), null, null);
                } else if (latest == null) {
                    addCheckInEvent(task.getContract(), null, "CI_RESCHEDULE",
                            Map.of("draftId", -1, "note", "Dời lịch nhận kho do ô đang gặp sự cố"), null, null);
                }
            }
        }
        staffTaskRepository.saveAll(tasks);
    }

    // UC-16: huỷ task chưa đóng — gọi khi khách gia hạn (không trả kho nữa) hoặc
    // khi xử lý No-Show
    @Transactional
    public void cancelOpenTasks(Integer contractId, String taskType) {
        cancelOpenTasks(contractId, taskType, null);
    }

    /**
     * PR-T2 (22/11/2026): huỷ task đang mở kèm lý do (vd khách huỷ đơn) — task vẫn còn trên bảng ở cột "Đã đóng"
     * với nhãn lý do, nhân viên đang giữ task nhận thông báo.
     */
    @Transactional
    public void cancelOpenTasks(Integer contractId, String taskType, String reason) {
        List<StaffTask> tasks = staffTaskRepository
                .findByContractIdAndTaskTypeAndStatusIn(contractId, taskType, OPEN_STATUSES);
        for (StaffTask task : tasks) {
            cancelTaskWithReason(task, reason);
        }
        staffTaskRepository.saveAll(tasks);
    }

    /** PR-T2: đánh dấu 1 task CANCELLED + lý do + báo nhân viên đang giữ (không lưu — người gọi tự save) */
    public void cancelTaskWithReason(StaffTask task, String reason) {
        task.setStatus("CANCELLED");
        if (reason == null || reason.isBlank()) return;
        String r = reason.trim();
        task.setCancelReason(r.length() > 300 ? r.substring(0, 297) + "..." : r);
        if (notificationService != null && task.getStaff() != null) {
            notificationService.notifyStaff(task.getStaff().getId(),
                    "Task #" + task.getId() + " đã huỷ",
                    r + ". Bạn không cần xử lý task này nữa.",
                    task.getTaskType(), "/staff/tasks/" + task.getId());
        }
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
        createMaintenanceTask(contract, reason, note, false, null);
    }

    @Transactional
    public void createMaintenanceTask(RentalContract contract, String reason, String note, boolean urgentSameWorkingDay) {
        createMaintenanceTask(contract, reason, note, urgentSameWorkingDay, null);
    }

    @Transactional
    public StaffTask createMaintenanceTask(RentalContract contract, String reason, String note, boolean urgentSameWorkingDay, User assignedStaff) {
        if (contract == null || contract.getId() == null) return null;
        RentalContract liveContract = rentalContractRepository != null 
                ? rentalContractRepository.findDetailById(contract.getId()).orElse(contract) 
                : contract;
        if (liveContract == null || liveContract.getStorageUnit() == null) return null;
        if (staffTaskRepository.existsByContractIdAndTaskTypeAndStatusIn(liveContract.getId(), "MAINTENANCE", OPEN_STATUSES)) {
            return null;
        }
        Integer facilityId = (liveContract.getStorageUnit().getFacility() != null)
                ? liveContract.getStorageUnit().getFacility().getId()
                : null;
        if (facilityId == null) return null;

        StaffTask task = new StaffTask();
        task.setFacilityId(facilityId);
        task.setContract(liveContract);
        task.setTaskType("MAINTENANCE");
        task.setMaintenanceReason(reason);
        LocalDateTime now = LocalDateTime.now();
        if (assignedStaff != null) {
            task.setStaff(assignedStaff);
            task.setStatus("IN_PROGRESS");
            task.setClaimedAt(now);
        } else {
            task.setStatus("OPEN");
        }
        LocalDate targetDate = urgentSameWorkingDay ? LocalDate.now() : LocalDate.now().plusDays(MAINTENANCE_DUE_DAYS);
        task.setDueAt(computeDueAt(targetDate));
        task.setNote(note != null && note.length() > 1000 ? note.substring(0, 997) + "..." : note);
        StaffTask savedTask = staffTaskRepository.save(task);

        if (notificationService != null) {
            String unitCode = (liveContract.getStorageUnit() != null) ? liveContract.getStorageUnit().getId() : "";
            // 1. Thông báo cho Quản lý cơ sở (FM)
            String fmTitle = assignedStaff != null
                    ? "Task bảo trì mới #" + savedTask.getId() + " (Ô " + unitCode + ")"
                    : "Task bảo trì mới cần phân công (Ô " + unitCode + ")";
            String fmBody = assignedStaff != null
                    ? "Nhân viên " + assignedStaff.getFullName() + " đã lập và trực tiếp tiếp nhận Task #" + savedTask.getId() + " [Bảo trì ô kho " + unitCode + "]. Vui lòng theo dõi tiến độ."
                    : "Task #" + savedTask.getId() + " [Bảo trì ô kho] được tạo từ sự cố kỹ thuật. Vui lòng kiểm tra và giao việc cho nhân viên.";
            notificationService.notifyFacilityManagers(
                    facilityId,
                    fmTitle,
                    fmBody,
                    "MAINTENANCE",
                    "/manager/tasks"
            );

            // 2. Thông báo cho Nhân viên (Staff) nếu được giao trực tiếp
            if (assignedStaff != null) {
                notificationService.notifyStaff(
                        assignedStaff.getId(),
                        "Bạn đã tiếp nhận Task bảo trì #" + savedTask.getId(),
                        "Task #" + savedTask.getId() + " [Bảo trì ô " + unitCode + "] đã được tạo và tự động giao cho bạn. Nhấp để chuyển đến thực hiện.",
                        "MAINTENANCE",
                        "/staff/tasks/" + savedTask.getId()
                );
            }
        }
        return savedTask;
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
        return getBoard(facilityId, status, null);
    }

    @Transactional(readOnly = true)
    public List<StaffTaskResponse> getBoard(Integer facilityId, String status, Integer staffId) {
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

        if (staffId != null) {
            tasks = tasks.stream()
                    .filter(t -> t.getStaff() != null && Objects.equals(t.getStaff().getId(), staffId))
                    .toList();
            if (tasks.isEmpty()) {
                return Collections.emptyList();
            }
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

        if (responses.stream().anyMatch(r -> "CHECK_IN".equals(r.getTaskType()) && OPEN_STATUSES.contains(r.getStatus()))) {
            Map<Integer, String> escalations = new HashMap<>();
            jdbcTemplate.query("SELECT contract_id, record_type FROM (" +
                    "SELECT h.contract_id, h.record_type, ROW_NUMBER() OVER (PARTITION BY h.contract_id ORDER BY h.id DESC) AS rn " +
                    "FROM handover_records h JOIN rental_contracts c ON c.id = h.contract_id " +
                    "JOIN storage_units su ON su.id = c.storage_unit_id " +
                    "WHERE su.facility_id = ? AND c.status = 'PENDING_CHECK_IN' " +
                    "AND h.record_type IN ('CI_DRAFT','CI_ACCEPT','CI_REJECT','CI_BLOCKER','CI_FAULT','CI_REOPEN','CI_RESCHEDULE','CI_WITHDRAW','CI_RESOLUTION','CHECK_IN')" +
                    ") latest WHERE rn = 1 AND record_type IN ('CI_BLOCKER','CI_FAULT')",
                    rs -> { escalations.put(rs.getInt("contract_id"), rs.getString("record_type")); }, facilityId);
            for (StaffTaskResponse response : responses) {
                if ("CHECK_IN".equals(response.getTaskType()) && OPEN_STATUSES.contains(response.getStatus())) {
                    String escalation = escalations.get(response.getContractId());
                    response.setCheckInNeedsManager(escalation != null);
                    response.setCheckInEscalationStatus(escalation);
                }
            }
        }

        // PR-34: Task SUPPORT khẩn (LOCK_ISSUE, SECURITY) đang mở nổi lên đầu bảng, sau đó sắp theo dueAt ASC
        responses.sort(Comparator
                .comparing((StaffTaskResponse r) -> {
                    boolean active = OPEN_STATUSES.contains(r.getStatus());
                    return !(active && (r.isUrgent() || r.isCheckInNeedsManager()));
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
                .cancelReason(task.getCancelReason())
                .simulatedCheckoutDate(task.getSimulatedCheckoutDate())
                .facilityId(task.getFacilityId())
                .taskType(task.getTaskType())
                .status(task.getStatus())
                .dueAt(task.getDueAt())
                .assignableFrom(assignableFrom(task))
                .createdAt(task.getCreatedAt())
                .claimedAt(task.getClaimedAt())
                .completedAt(task.getCompletedAt())
                .note(taskNote)
                .evidenceImageUrl(task.getEvidenceImageUrl())
                .receiptStatus(task.getReceiptStatus())
                .receiptDisputeReason(task.getReceiptDisputeReason())
                .receiptRound(task.getReceiptRound())
                .refundAmount(task.getRefundAmount())
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
                .subCategory(sr != null ? sr.getSubCategory() : null)
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

        requireInAssignWindow(task, "nhận");
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
        Integer prevStaffId = task.getStaff() != null ? task.getStaff().getId() : null;

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

        if (notificationService != null && prevStaffId != null) notificationService.notifyStaff(
                prevStaffId,
                "Bạn đã được gỡ khỏi task #" + task.getId(),
                "Quản lý " + manager.getFullName() + " đã gỡ bạn khỏi task " + task.getTaskType() + " #" + task.getId()
                        + ". Task quay về \"Chờ nhận\".",
                "TASK",
                "/staff?highlightTaskId=" + task.getId()
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
        requireInAssignWindow(task, "giao");
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

        if (notificationService != null) notificationService.notifyStaff(
                staff.getId(),
                "Phân công task mới",
                "Bạn vừa được phân công task " + task.getTaskType() + " #" + task.getId() + "!",
                "TASK",
                "/staff?highlightTaskId=" + task.getId()
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

    // PR-T1: mốc mở giao / nhận việc = 00:00 của (ngày hẹn − 30 ngày); task khác loại không giới hạn → null
    static LocalDateTime assignableFrom(StaffTask task) {
        if (task == null || task.getDueAt() == null || !WINDOWED_TASK_TYPES.contains(task.getTaskType())) {
            return null;
        }
        return task.getDueAt().toLocalDate().minusDays(ASSIGN_WINDOW_DAYS).atStartOfDay();
    }

    private void requireInAssignWindow(StaffTask task, String verb) {
        LocalDateTime opensAt = assignableFrom(task);
        if (opensAt != null && LocalDateTime.now().isBefore(opensAt)) {
            throw new StaffTaskException(HttpStatus.CONFLICT, "TASK_NOT_IN_WINDOW",
                    "Chỉ " + verb + " việc " + ("CHECK_IN".equals(task.getTaskType()) ? "bàn giao kho" : "nghiệm thu trả kho")
                            + " trong vòng " + ASSIGN_WINDOW_DAYS + " ngày trước ngày hẹn — mở từ "
                            + opensAt.toLocalDate().format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy")));
        }
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

    @Transactional(readOnly = true)
    public String suggestRfid() {
        return suggestRfidExcluding(null);
    }

    private String suggestRfidExcluding(String currentRfid) {
        for (int i = 0; i < 200; i++) {
            String rfid = String.format("RFID-%05d", RANDOM.nextInt(100_000));
            if (currentRfid != null && currentRfid.equals(rfid)) {
                continue;
            }
            if (!rentalContractRepository.existsByRfidCardCode(rfid)) {
                return rfid;
            }
        }
        for (int i = 0; i < 200; i++) {
            String rfid = String.format("RFID-%05d", RANDOM.nextInt(100_000));
            if (currentRfid != null && currentRfid.equals(rfid)) {
                continue;
            }
            if (!rentalContractRepository.existsByRfidCardCodeAndStatusIn(rfid, LIVE_CONTRACT_STATUSES)) {
                return rfid;
            }
        }
        throw new StaffTaskException(HttpStatus.CONFLICT, "RFID_UNAVAILABLE",
                "Không sinh được mã thẻ RFID mới ngẫu nhiên, vui lòng thử lại");
    }

    // Flow 2: use immutable handover records as an event trail; facility_tasks keeps its original statuses.
    private void lockCheckInTask(Integer taskId) {
        List<Integer> ids = jdbcTemplate.queryForList(
                "SELECT id FROM facility_tasks WITH (UPDLOCK, HOLDLOCK) WHERE id = ? AND task_type = 'CHECK_IN'",
                Integer.class, taskId);
        if (ids.isEmpty()) throw new StaffTaskException(HttpStatus.NOT_FOUND, "TASK_NOT_FOUND", "Không tìm thấy task check-in");
    }

    private Map<String, Object> checkInEvent(Integer contractId, String... types) {
        String placeholders = String.join(",", java.util.Collections.nCopies(types.length, "?"));
        Object[] args = new Object[types.length + 1];
        args[0] = contractId;
        System.arraycopy(types, 0, args, 1, types.length);
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                "SELECT TOP 1 id, contract_id, staff_id, record_type, is_identity_verified, is_empty, is_clean, " +
                "is_lock_intact, is_prohibited_goods_committed, is_goods_value_verified, goods_value_assessment, " +
                "assessed_goods_value, goods_value_assessment_note, notes, evidence_image_urls, created_at " +
                "FROM handover_records WHERE contract_id = ? AND record_type IN (" + placeholders + ") ORDER BY id DESC", args);
        return rows.isEmpty() ? null : rows.get(0);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> eventData(Map<String, Object> row) {
        if (row == null || !(row.get("notes") instanceof String value)) return Map.of();
        try { return objectMapper.readValue(value, Map.class); }
        catch (JacksonException e) { throw new StaffTaskException(HttpStatus.CONFLICT, "HANDOVER_DATA_INVALID", "Dữ liệu biên bản không hợp lệ"); }
    }

    private String eventJson(Map<String, Object> data) {
        try { return objectMapper.writeValueAsString(data); }
        catch (JacksonException e) { throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Không lưu được biên bản"); }
    }

    private static List<String> asStringList(Object value) {
        if (!(value instanceof Collection<?> values)) return List.of();
        return values.stream().filter(String.class::isInstance).map(String.class::cast).toList();
    }

    private static List<String> normalizeRejectionTypes(List<String> values) {
        if (values == null) return List.of();
        Set<String> allowed = Set.of("UNIT_CONDITION", "GOODS_VALUE", "GOODS_INFORMATION", "OTHER");
        return values.stream().filter(Objects::nonNull).map(String::trim).map(String::toUpperCase)
                .filter(allowed::contains).distinct().toList();
    }

    private static String text(Map<String, Object> body, String key) {
        Object value = body != null ? body.get(key) : null;
        return value instanceof String text ? text.trim() : "";
    }

    private static boolean validLength(String value, int min, int max) {
        return value != null && value.trim().length() >= min && value.trim().length() <= max;
    }

    private static BigDecimal decimal(Object value) {
        if (value == null) return null;
        try { return new BigDecimal(String.valueOf(value)); }
        catch (NumberFormatException ignored) { return null; }
    }

    private int eventId(Map<String, Object> row) { return ((Number) row.get("id")).intValue(); }
    private int eventDraftId(Map<String, Object> row) {
        Object value = eventData(row).get("draftId");
        return value instanceof Number n ? n.intValue() : -1;
    }

    private void addCheckInEvent(RentalContract contract, Integer staffId, String type,
                                 Map<String, Object> data, String photos, CheckInRequest draft) {
        HandoverRecord record = new HandoverRecord();
        record.setContract(contract);
        if (staffId != null) record.setStaff(userRepository.getReferenceById(staffId));
        record.setRecordType(type);
        record.setIdentityVerified(draft != null ? draft.getIdentityVerified() : false);
        record.setUnitEmpty(draft != null ? draft.getUnitEmpty() : false);
        record.setUnitClean(draft != null ? draft.getUnitClean() : false);
        record.setLockIntact(draft != null ? draft.getLockIntact() : false);
        record.setProhibitedGoodsCommitted(draft != null && Boolean.TRUE.equals(draft.getGoodsChecked()));
        record.setGoodsValueVerified(draft != null && Boolean.TRUE.equals(draft.getGoodsValueVerified()));
        record.setGoodsValueAssessment(draft != null ? draft.getGoodsValueAssessment() : null);
        record.setAssessedGoodsValue(draft != null ? draft.getAssessedGoodsValue() : null);
        record.setGoodsValueAssessmentNote(draft != null ? draft.getGoodsValueAssessmentNote() : null);
        record.setCustomerSignatureConfirmed("CI_ACCEPT".equals(type));
        record.setNotes(eventJson(data));
        record.setEvidenceImageUrls(photos);
        record.setCheckInMethod("COUNTER");
        handoverRecordRepository.saveAndFlush(record);
    }

    private RentalContract checkInContract(Integer contractId, CurrentUser actor) {
        RentalContract contract = rentalContractRepository.findDetailById(contractId)
                .orElseThrow(() -> new StaffTaskException(HttpStatus.NOT_FOUND, "CONTRACT_NOT_FOUND", "Không tìm thấy hợp đồng"));
        if (actor.hasRole("CUSTOMER")) {
            if (!contract.getCustomer().getId().equals(actor.id())) throw new StaffTaskException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Không có quyền xem hợp đồng này");
        } else if (!(actor.hasRole("STAFF") || actor.hasRole("FACILITY_MANAGER"))
                || !contract.getStorageUnit().getFacility().getId().equals(actor.facilityId())) {
            throw new StaffTaskException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Không có quyền xem hợp đồng này");
        }
        return contract;
    }

    @Transactional
    public Map<String, Object> prepareCheckIn(Integer taskId, CurrentUser actor, CheckInRequest request) {
        if (!actor.hasRole("STAFF")) throw new StaffTaskException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Chỉ nhân viên được lập biên bản");
        lockCheckInTask(taskId);
        StaffTask task = staffTaskRepository.findDetailById(taskId).orElseThrow();
        if (!"IN_PROGRESS".equals(task.getStatus()) || task.getStaff() == null
                || !task.getStaff().getId().equals(actor.id()) || !task.getFacilityId().equals(actor.facilityId())
                || task.getDueAt() == null || !task.getDueAt().isAfter(LocalDateTime.now())) {
            throw new StaffTaskException(HttpStatus.CONFLICT, "TASK_NOT_READY", "Task không còn trong thời gian bàn giao của nhân viên này");
        }
        RentalContract contract = task.getContract();
        if (!"PENDING_CHECK_IN".equals(contract.getStatus())) throw new StaffTaskException(HttpStatus.CONFLICT, "CONTRACT_STATUS_INVALID", "Hợp đồng không còn chờ bàn giao");
        LocalDate appointment = contract.getReservation() != null && contract.getReservation().getExpectedAppointmentTime() != null
                ? contract.getReservation().getExpectedAppointmentTime().toLocalDate() : contract.getStartDate();
        if (appointment != null && LocalDate.now().isBefore(appointment)) throw new StaffTaskException(HttpStatus.CONFLICT, "CHECK_IN_TOO_EARLY", "Chưa đến ngày hẹn bàn giao");
        normalizeUnitCheck(request);
        normalizeGoodsValueAssessment(contract, request);
        validateCheckInRequest(request, false);
        assertUnitReadyForCheckIn(contract);
        Map<String, Object> latest = checkInEvent(contract.getId(), "CI_DRAFT", "CI_ACCEPT", "CI_REJECT", "CI_FAULT", "CI_BLOCKER", "CI_RESOLUTION", "CI_REOPEN", "CI_RESCHEDULE", "CI_WITHDRAW");
        if (latest != null && "CI_REOPEN".equals(latest.get("record_type"))) {
            BigDecimal fmValue = decimal(eventData(latest).get("resolvedGoodsValue"));
            if (fmValue != null && fmValue.signum() > 0) {
                request.setGoodsValueAssessment("ADJUSTED");
                request.setAssessedGoodsValue(fmValue);
                request.setGoodsValueAssessmentNote(text(eventData(latest), "goodsValueResolutionNote"));
            }
        }
        if (latest != null && "CI_REJECT".equals(latest.get("record_type"))) {
            addCheckInEvent(contract, actor.id(), "CI_REOPEN",
                    Map.of("draftId", eventDraftId(latest), "actorId", actor.id(),
                            "unitId", contract.getStorageUnit().getId(),
                            "note", "Nhân viên xử lý phản hồi của khách và lập lại biên bản"), null, null);
        } else if (latest != null && ("CI_DRAFT".equals(latest.get("record_type")) || "CI_ACCEPT".equals(latest.get("record_type"))
                || "CI_FAULT".equals(latest.get("record_type")) || "CI_BLOCKER".equals(latest.get("record_type"))
                || "CI_RESOLUTION".equals(latest.get("record_type")))) {
            throw new StaffTaskException(HttpStatus.CONFLICT, "HANDOVER_PENDING", "Biên bản trước đang chờ xử lý; quản lý cần mở lại trước khi lập biên bản mới");
        }
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("taskId", taskId);
        data.put("unitId", contract.getStorageUnit().getId());
        data.put("notes", request.getNotes());
        data.put("checklistEvidence", request.getChecklistEvidence());
        data.put("declaredGoodsValue", contract.getReservation() != null ? contract.getReservation().getDeclaredGoodsValue() : null);
        data.put("goodsValueEvidenceImages", contract.getReservation() != null
                ? parseEvidenceImages(contract.getReservation().getGoodsValueEvidenceImages()) : List.of());
        addCheckInEvent(contract, actor.id(), "CI_DRAFT", data, serializeEvidenceImages(request.getEvidenceImages()), request);
        if (notificationService != null) notificationService.notifyCustomer(contract.getCustomer().getId(),
                "Biên bản nhận kho chờ bạn xác nhận", "Hãy kiểm tra ô " + contract.getStorageUnit().getId() + " và ảnh rồi xác nhận trong hợp đồng.",
                "ASSIGNED", "/kho-cua-toi/hop-dong/" + contract.getReservation().getId());
        return latestCheckInHandover(contract.getId(), actor);
    }

    @Transactional
    public Map<String, Object> withdrawCheckIn(Integer taskId, CurrentUser actor) {
        if (!actor.hasRole("STAFF")) throw new StaffTaskException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Chỉ nhân viên được hoàn tác biên bản");
        lockCheckInTask(taskId);
        StaffTask task = staffTaskRepository.findDetailById(taskId).orElseThrow();
        if (!"IN_PROGRESS".equals(task.getStatus()) || task.getStaff() == null
                || !actor.id().equals(task.getStaff().getId()) || !task.getFacilityId().equals(actor.facilityId())) {
            throw new StaffTaskException(HttpStatus.CONFLICT, "TASK_NOT_YOURS", "Chỉ nhân viên đang phụ trách mới được hoàn tác");
        }
        RentalContract contract = task.getContract();
        if (!"PENDING_CHECK_IN".equals(contract.getStatus())) throw new StaffTaskException(HttpStatus.CONFLICT, "CONTRACT_STATUS_INVALID", "Hợp đồng không còn chờ bàn giao");
        Map<String, Object> latest = checkInEvent(contract.getId(), "CI_DRAFT", "CI_ACCEPT", "CI_REJECT", "CI_FAULT", "CI_BLOCKER", "CI_RESOLUTION", "CI_REOPEN", "CI_RESCHEDULE", "CI_WITHDRAW");
        if (latest == null || !"CI_DRAFT".equals(latest.get("record_type"))
                || !taskId.equals(eventData(latest).get("taskId"))
                || !actor.id().equals(((Number) latest.get("staff_id")).intValue())) {
            throw new StaffTaskException(HttpStatus.CONFLICT, "HANDOVER_ALREADY_DECIDED", "Khách đã phản hồi hoặc biên bản không còn chờ xác nhận");
        }
        addCheckInEvent(contract, actor.id(), "CI_WITHDRAW",
                Map.of("draftId", eventId(latest), "actorId", actor.id(), "note", "Nhân viên hoàn tác biên bản để lập lại"), null, null);
        if (notificationService != null) notificationService.notifyCustomer(contract.getCustomer().getId(),
                "Biên bản nhận kho đã được nhân viên thu hồi",
                "Biên bản ô " + contract.getStorageUnit().getId() + " đang được lập lại. Vui lòng chờ biên bản mới để xác nhận.",
                "ASSIGNED", "/kho-cua-toi/hop-dong/" + contract.getReservation().getId());
        return Map.of("status", "WITHDRAWN", "message", "Đã hoàn tác biên bản; có thể lập và gửi bản mới");
    }

    @Transactional(readOnly = true)
    public Map<String, Object> latestCheckInHandover(Integer contractId, CurrentUser actor) {
        checkInContract(contractId, actor);
        Map<String, Object> blocker = checkInEvent(contractId, "CI_BLOCKER", "CI_FAULT", "CI_REOPEN", "CI_RESCHEDULE", "CI_DRAFT", "CI_ACCEPT", "CI_REJECT");
        if (blocker != null && ("CI_BLOCKER".equals(blocker.get("record_type")) || "CI_FAULT".equals(blocker.get("record_type")))) {
            Map<String, Object> data = eventData(blocker);
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("status", "BLOCKED_FM");
            result.put("blockerReason", data.get("note"));
            result.put("blockerType", data.getOrDefault("issueType", "FACILITY_ISSUE"));
            result.put("blockedUnitId", data.get("unitId"));
            result.put("blockerEvidenceImages", parseEvidenceImages((String) blocker.get("evidence_image_urls")));
            result.put("customerRejectionReason", data.get("customerRejectionReason"));
            result.put("customerRejectionImages", data.getOrDefault("customerRejectionImages", List.of()));
            result.put("facilityFaultConfirmed", "CI_FAULT".equals(blocker.get("record_type")));
            return result;
        }
        List<Map<String, Object>> history = checkInHandoverHistory(contractId, actor);
        Map<String, Object> result = history.isEmpty() ? new LinkedHashMap<>(Map.of("status", "NONE"))
                : new LinkedHashMap<>(history.get(0));
        if (blocker != null && "CI_REOPEN".equals(blocker.get("record_type"))
                && eventData(blocker).get("resolvedGoodsValue") != null)
            result.put("issueResolution", eventData(blocker));
        return result;
    }

    @Transactional
    public Map<String, Object> reportCheckInBlocker(Integer taskId, CurrentUser actor, Map<String, Object> body) {
        if (!actor.hasRole("STAFF")) throw new StaffTaskException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Chỉ nhân viên phụ trách được báo sự cố bàn giao");
        lockCheckInTask(taskId);
        StaffTask task = staffTaskRepository.findDetailById(taskId).orElseThrow();
        if (!"CHECK_IN".equals(task.getTaskType()) || !"IN_PROGRESS".equals(task.getStatus())
                || task.getStaff() == null || !actor.id().equals(task.getStaff().getId())
                || !task.getFacilityId().equals(actor.facilityId())
                || !"PENDING_CHECK_IN".equals(task.getContract().getStatus()))
            throw new StaffTaskException(HttpStatus.CONFLICT, "TASK_NOT_READY", "Task check-in không còn thuộc nhân viên này");
        String note = text(body, "note");
        if (!validLength(note, 10, 500)) throw new StaffTaskException(HttpStatus.BAD_REQUEST, "ISSUE_NOTE_REQUIRED", "Mô tả sự cố trong 10–500 ký tự");
        String requestedType = text(body, "issueType");
        String issueType = List.of("GOODS_VALUE_DISPUTE", "OTHER_DISPUTE").contains(requestedType)
                ? requestedType : "FACILITY_ISSUE";
        List<String> evidence = asStringList(body != null ? body.get("evidenceImages") : null).stream()
                .filter(value -> value != null && !value.isBlank()).distinct().toList();
        if (("FACILITY_ISSUE".equals(issueType) && evidence.isEmpty()) || evidence.size() > 10)
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "ISSUE_PHOTO_REQUIRED", "Sự cố cơ sở cần 1–10 ảnh");
        Map<String, Object> latest = checkInEvent(task.getContract().getId(), "CI_DRAFT", "CI_ACCEPT", "CI_REJECT", "CI_FAULT", "CI_BLOCKER", "CI_REOPEN", "CI_RESCHEDULE", "CI_WITHDRAW");
        if (latest != null && ("CI_BLOCKER".equals(latest.get("record_type")) || "CI_FAULT".equals(latest.get("record_type"))))
            throw new StaffTaskException(HttpStatus.CONFLICT, "ISSUE_ALREADY_REPORTED", "Sự cố đang chờ quản lý xử lý");
        if (latest != null && "CI_ACCEPT".equals(latest.get("record_type")))
            throw new StaffTaskException(HttpStatus.CONFLICT, "HANDOVER_ALREADY_ACCEPTED", "Khách đã đồng ý biên bản");
        int draftId = latest == null ? -1 : "CI_DRAFT".equals(latest.get("record_type")) ? eventId(latest) : eventDraftId(latest);
        Map<String, Object> reportData = new LinkedHashMap<>();
        reportData.put("draftId", draftId);
        reportData.put("actorId", actor.id());
        reportData.put("unitId", task.getContract().getStorageUnit().getId());
        reportData.put("note", note);
        reportData.put("issueType", issueType);
        if (latest != null && "CI_REJECT".equals(latest.get("record_type"))) {
            reportData.put("customerRejectionReason", eventData(latest).get("reason"));
            reportData.put("customerRejectionImages", parseEvidenceImages((String) latest.get("evidence_image_urls")));
        }
        addCheckInEvent(task.getContract(), actor.id(), "CI_BLOCKER",
                reportData,
                serializeEvidenceImages(evidence), null);
        if (notificationService != null) notificationService.notifyFacilityManagers(task.getFacilityId(),
                !"FACILITY_ISSUE".equals(issueType) ? "Bất đồng khi check-in" : "Không thể bàn giao ô " + task.getContract().getStorageUnit().getId(),
                "Staff chuyển FM xử lý task #" + taskId + ": " + note,
                "BOOKING", "/manager/tasks/" + taskId);
        if (notificationService != null) notificationService.notifyCustomer(task.getContract().getCustomer().getId(),
                "Check-in đang chờ quản lý xử lý",
                "Nhân viên đã ghi nhận vấn đề khi bàn giao ô " + task.getContract().getStorageUnit().getId()
                        + ". Quản lý cơ sở sẽ liên hệ để thống nhất phương án; biên bản cũ không còn hiệu lực.",
                "BOOKING", "/kho-cua-toi/hop-dong/" + task.getContract().getReservation().getId());
        return Map.of("status", "BLOCKED_FM", "message", "Đã báo quản lý; task check-in chờ phương án xử lý");
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> checkInHandoverHistory(Integer contractId, CurrentUser actor) {
        RentalContract contract = checkInContract(contractId, actor);
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                "SELECT id, staff_id, record_type, is_identity_verified, is_empty, is_clean, is_lock_intact, " +
                "is_prohibited_goods_committed, is_goods_value_verified, goods_value_assessment, assessed_goods_value, " +
                "goods_value_assessment_note, notes, evidence_image_urls, created_at FROM handover_records " +
                "WHERE contract_id = ? AND record_type IN ('CI_DRAFT','CI_ACCEPT','CI_REJECT','CI_FAULT','CI_BLOCKER','CI_RESOLUTION','CI_REOPEN','CI_RESCHEDULE','CI_WITHDRAW') ORDER BY id ASC", contractId);
        Map<Integer, Map<String, Object>> attempts = new LinkedHashMap<>();
        for (Map<String, Object> row : rows) {
            String type = (String) row.get("record_type");
            if ("CI_DRAFT".equals(type)) {
                for (Map<String, Object> old : attempts.values()) {
                    if ("PENDING_CUSTOMER".equals(old.get("status"))) old.put("status", "SUPERSEDED");
                }
                Map<String, Object> data = eventData(row);
                Map<String, Object> view = new LinkedHashMap<>();
                view.put("id", eventId(row));
                view.put("staff_id", row.get("staff_id"));
                view.put("storage_unit_id", data.get("unitId"));
                view.put("status", "PENDING_CUSTOMER");
                view.put("notes", data.get("notes"));
                view.put("unitEmpty", row.get("is_empty"));
                view.put("unitClean", row.get("is_clean"));
                view.put("unitChecked", Boolean.TRUE.equals(row.get("is_empty")) && Boolean.TRUE.equals(row.get("is_clean")));
                view.put("lockIntact", row.get("is_lock_intact"));
                view.put("goodsChecked", row.get("is_prohibited_goods_committed"));
                view.put("goodsValueVerified", row.get("is_goods_value_verified"));
                view.put("goodsValueAssessment", row.get("goods_value_assessment"));
                view.put("assessedGoodsValue", row.get("assessed_goods_value"));
                view.put("goodsValueAssessmentNote", row.get("goods_value_assessment_note"));
                view.put("declaredGoodsValue", data.get("declaredGoodsValue"));
                view.put("goodsValueEvidenceImages", data.get("goodsValueEvidenceImages"));
                if (data.get("checklistEvidence") instanceof Map<?, ?>) view.put("checklistEvidence", data.get("checklistEvidence"));
                view.put("evidenceImages", parseEvidenceImages((String) row.get("evidence_image_urls")));
                view.put("created_at", row.get("created_at"));
                attempts.put(eventId(row), view);
            } else {
                Map<String, Object> view = attempts.get(eventDraftId(row));
                if (view == null) continue;
                view.put("decided_at", row.get("created_at"));
                if ("CI_ACCEPT".equals(type)) view.put("status", "ACCEPTED");
                if ("CI_REJECT".equals(type)) {
                    view.put("status", "REJECTED");
                    view.put("rejection_reason", eventData(row).get("reason"));
                    view.put("rejectionTypes", eventData(row).get("rejectionTypes"));
                    view.put("customerEvidenceImages", parseEvidenceImages((String) row.get("evidence_image_urls")));
                }
                if ("CI_BLOCKER".equals(type)) {
                    view.put("status", "BLOCKED_FM");
                    view.put("blockerReason", eventData(row).get("note"));
                    view.put("blockerEvidenceImages", parseEvidenceImages((String) row.get("evidence_image_urls")));
                }
                if ("CI_FAULT".equals(type)) {
                    view.put("facility_fault_confirmed", true);
                    view.put("faultNote", eventData(row).get("note"));
                    view.put("faultConfirmedAt", row.get("created_at"));
                }
                if ("CI_RESOLUTION".equals(type)) {
                    Map<String, Object> resolution = eventData(row);
                    view.put("issueResolution", resolution);
                    view.put("issuesResolved", true);
                    view.put("resolutionRecordedAt", row.get("created_at"));
                    view.put("resolutionEvidenceImages", parseEvidenceImages((String) row.get("evidence_image_urls")));
                }
                if ("CI_REOPEN".equals(type)) {
                    view.put("status", "SUPERSEDED");
                    view.put("resolutionNote", eventData(row).get("note"));
                    view.put("resolvedUnitId", eventData(row).get("unitId"));
                    view.put("resolvedAt", row.get("created_at"));
                    view.put("resolutionEvidenceImages", parseEvidenceImages((String) row.get("evidence_image_urls")));
                }
                if ("CI_WITHDRAW".equals(type)) view.put("status", "WITHDRAWN");
                if ("CI_RESCHEDULE".equals(type)) view.put("status", "SUPERSEDED");
            }
        }
        List<Map<String, Object>> result = new ArrayList<>(attempts.values());
        Collections.reverse(result);
        if (!result.isEmpty() && "PENDING_CUSTOMER".equals(result.get(0).get("status"))) {
            if (!"PENDING_CHECK_IN".equals(contract.getStatus())) result.get(0).put("status", "SUPERSEDED");
            else {
                Map<String, Object> latestDraft = checkInEvent(contractId, "CI_DRAFT");
                int taskId = ((Number) eventData(latestDraft).get("taskId")).intValue();
                List<Map<String, Object>> taskRows = jdbcTemplate.queryForList(
                        "SELECT status, due_at FROM facility_tasks WHERE id = ?", taskId);
                Object due = taskRows.isEmpty() ? null : taskRows.get(0).get("due_at");
                LocalDateTime deadline = due instanceof Timestamp ts ? ts.toLocalDateTime() : (LocalDateTime) due;
                Object created = result.get(0).get("created_at");
                LocalDateTime at = created instanceof Timestamp ts ? ts.toLocalDateTime() : (LocalDateTime) created;
                Object evidence = result.get(0).get("checklistEvidence");
                boolean completeEvidence = evidence instanceof Map<?, ?> photos
                        && CHECK_IN_PHOTO_KEYS.stream().allMatch(key -> checklistPhotos(photos, key).size() > 0);
                result.get(0).put("acceptAllowed", at != null && at.toLocalDate().equals(LocalDate.now())
                        && completeEvidence
                        && deadline != null && deadline.isAfter(LocalDateTime.now())
                        && !taskRows.isEmpty() && "IN_PROGRESS".equals(taskRows.get(0).get("status")));
            }
        }
        return result;
    }

    @Transactional
    public Map<String, Object> decideCheckIn(Integer contractId, Integer draftId, CurrentUser actor,
                                               boolean accepted, String reason, List<String> evidence) {
        return decideCheckIn(contractId, draftId, actor, accepted, reason, evidence,
                accepted ? List.of() : List.of("UNIT_CONDITION"));
    }

    @Transactional
    public Map<String, Object> decideCheckIn(Integer contractId, Integer draftId, CurrentUser actor,
                                               boolean accepted, String reason, List<String> evidence,
                                               List<String> rejectionTypes) {
        if (!actor.hasRole("CUSTOMER")) throw new StaffTaskException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Chỉ khách hàng được xác nhận");
        RentalContract contract = checkInContract(contractId, actor);
        Map<String, Object> draft = checkInEvent(contractId, "CI_DRAFT");
        if (draft == null || eventId(draft) != draftId) throw new StaffTaskException(HttpStatus.CONFLICT, "HANDOVER_STALE", "Biên bản đã thay thế");
        int taskId = ((Number) eventData(draft).get("taskId")).intValue();
        lockCheckInTask(taskId);
        // Re-read under the task lock to serialize decision, reopening and finalization.
        Map<String, Object> latest = checkInEvent(contractId, "CI_DRAFT", "CI_ACCEPT", "CI_REJECT", "CI_FAULT", "CI_BLOCKER", "CI_RESOLUTION", "CI_REOPEN", "CI_RESCHEDULE", "CI_WITHDRAW");
        StaffTask task = staffTaskRepository.findDetailById(taskId).orElseThrow();
        if (latest == null || eventId(latest) != draftId
                || !("IN_PROGRESS".equals(task.getStatus()) || (!accepted && "OVERDUE".equals(task.getStatus())))
                || !"PENDING_CHECK_IN".equals(contract.getStatus())
                || !contract.getStorageUnit().getId().equals(eventData(draft).get("unitId"))) {
            throw new StaffTaskException(HttpStatus.CONFLICT, "HANDOVER_STALE", "Biên bản không còn chờ xác nhận");
        }
        Object created = draft.get("created_at");
        LocalDateTime at = created instanceof Timestamp ts ? ts.toLocalDateTime() : (LocalDateTime) created;
        if (accepted && (at == null || !at.toLocalDate().equals(LocalDate.now()) || task.getDueAt() == null
                || !task.getDueAt().isAfter(LocalDateTime.now()))) throw new StaffTaskException(HttpStatus.CONFLICT, "HANDOVER_STALE", "Đã quá ngày hoặc giờ bàn giao; cần kiểm tra lại");
        if (!accepted && (reason == null || reason.trim().length() < 5 || reason.trim().length() > 1000))
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "REJECTION_REASON_REQUIRED", "Lý do từ chối cần 5–1000 ký tự");
        if (accepted && rejectionTypes != null && !rejectionTypes.isEmpty())
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "REJECTION_TYPE_SELECTED", "Bỏ chọn các lý do từ chối trước khi đồng ý nhận kho");
        if (evidence != null && evidence.size() > 10) throw new StaffTaskException(HttpStatus.BAD_REQUEST, "TOO_MANY_PHOTOS", "Tối đa 10 ảnh");
        List<String> normalizedTypes = accepted ? List.of() : normalizeRejectionTypes(rejectionTypes);
        if (!accepted && normalizedTypes.isEmpty()) throw new StaffTaskException(HttpStatus.BAD_REQUEST,
                "REJECTION_TYPE_REQUIRED", "Chọn ít nhất một nội dung không đồng ý");
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("draftId", draftId);
        data.put("actorId", actor.id());
        data.put("unitId", eventData(draft).get("unitId"));
        if (!accepted) {
            data.put("reason", reason.trim());
            data.put("rejectionTypes", normalizedTypes);
        }
        addCheckInEvent(contract, null, accepted ? "CI_ACCEPT" : "CI_REJECT", data,
                accepted || evidence == null ? null : serializeEvidenceImages(evidence), null);
        jdbcTemplate.update("INSERT INTO activity_logs (user_id, action, target_entity, target_id, created_at) " +
                "VALUES (?, ?, 'handover_records', ?, SYSDATETIME())", actor.id(),
                accepted ? "CHECK_IN_ACCEPT" : "CHECK_IN_REJECT", String.valueOf(draftId));
        if (!accepted && notificationService != null) {
            String title = "Khách từ chối biên bản nhận kho " + contract.getStorageUnit().getId();
            String message = "Task #" + taskId + " cần kiểm tra lại: " + String.join(", ", normalizedTypes) + ". Lý do: " + reason.trim();
            if (task.getStaff() != null) notificationService.notifyStaff(task.getStaff().getId(), title, message,
                    "ASSIGNED", "/staff/tasks/" + taskId);
            else notificationService.notifyFacilityManagers(task.getFacilityId(), title,
                    message + " Hãy giao task check-in cho nhân viên.", "BOOKING", "/manager/tasks/" + taskId);
        }
        return Map.of("status", accepted ? "ACCEPTED" : "REJECTED",
                "message", accepted ? "Đã đồng ý biên bản; nhân viên sẽ hoàn tất bàn giao và cấp quyền truy cập" : "Đã ghi nhận từ chối; nhân viên sẽ kiểm tra và gửi lại biên bản");
    }

    @Transactional
    public Map<String, Object> resolveCheckInIssues(Integer taskId, CurrentUser actor, Map<String, Object> body) {
        if (!actor.hasRole("FACILITY_MANAGER")) throw new StaffTaskException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Chỉ quản lý cơ sở được xử lý biên bản bị từ chối");
        lockCheckInTask(taskId);
        StaffTask task = staffTaskRepository.findDetailById(taskId).orElseThrow();
        if (!task.getFacilityId().equals(actor.facilityId())) throw new StaffTaskException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Khác cơ sở");
        Map<String, Object> latest = checkInEvent(task.getContract().getId(), "CI_DRAFT", "CI_ACCEPT", "CI_REJECT", "CI_FAULT", "CI_BLOCKER", "CI_RESOLUTION", "CI_REOPEN", "CI_RESCHEDULE", "CI_WITHDRAW");
        if (latest == null || !"CI_REJECT".equals(latest.get("record_type")) || eventDraftId(latest) < 0)
            throw new StaffTaskException(HttpStatus.CONFLICT, "HANDOVER_NOT_REJECTED", "Chưa có biên bản từ chối cần xử lý");

        Map<String, Object> rejection = eventData(latest);
        List<String> rejectedTypes = normalizeRejectionTypes(asStringList(rejection.get("rejectionTypes")));
        if (rejectedTypes.isEmpty()) rejectedTypes = List.of("UNIT_CONDITION"); // dữ liệu cũ
        List<String> resolvedTypes = normalizeRejectionTypes(asStringList(body != null ? body.get("resolvedIssueTypes") : null));
        if (!resolvedTypes.containsAll(rejectedTypes)) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "ISSUES_NOT_FULLY_RESOLVED",
                    "Phải xử lý đầy đủ tất cả nội dung khách từ chối trước khi mở lại check-in");
        }

        String unitNote = text(body, "unitResolutionNote");
        if (rejectedTypes.contains("UNIT_CONDITION") && !validLength(unitNote, 10, 500)) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "UNIT_RESOLUTION_REQUIRED", "Ghi cách xử lý ô kho trong 10–500 ký tự");
        }
        String valueNote = text(body, "goodsValueResolutionNote");
        BigDecimal resolvedValue = decimal(body != null ? body.get("resolvedGoodsValue") : null);
        if (rejectedTypes.contains("GOODS_VALUE")) {
            if (resolvedValue == null || resolvedValue.signum() <= 0
                    || resolvedValue.compareTo(InsurancePlan.MAX_DECLARED_VALUE) > 0) {
                throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_GOODS_VALUE", "Giá trị FM đề xuất phải lớn hơn 0 và không vượt quá 10 tỷ đồng");
            }
            if (!validLength(valueNote, 10, 1000)) {
                throw new StaffTaskException(HttpStatus.BAD_REQUEST, "GOODS_VALUE_RESOLUTION_REQUIRED", "Ghi căn cứ kết luận giá trị trong 10–1000 ký tự");
            }
        }
        String otherNote = text(body, "otherResolutionNote");
        if ((rejectedTypes.contains("GOODS_INFORMATION") || rejectedTypes.contains("OTHER"))
                && !validLength(otherNote, 10, 500)) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "OTHER_RESOLUTION_REQUIRED", "Ghi cách xử lý nội dung còn lại trong 10–500 ký tự");
        }
        List<String> evidence = asStringList(body != null ? body.get("evidenceImages") : null).stream()
                .filter(value -> value != null && !value.isBlank()).distinct().toList();
        if (evidence.isEmpty()) throw new StaffTaskException(HttpStatus.BAD_REQUEST, "RESOLUTION_PHOTO_REQUIRED", "Cần ít nhất một ảnh hoặc chứng từ sau xử lý");
        if (evidence.size() > 10) throw new StaffTaskException(HttpStatus.BAD_REQUEST, "TOO_MANY_PHOTOS", "Tối đa 10 ảnh");

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("draftId", eventDraftId(latest));
        data.put("actorId", actor.id());
        data.put("resolvedIssueTypes", resolvedTypes);
        data.put("unitResolutionNote", unitNote);
        data.put("resolvedGoodsValue", resolvedValue);
        data.put("goodsValueResolutionNote", valueNote);
        data.put("otherResolutionNote", otherNote);
        addCheckInEvent(task.getContract(), actor.id(), "CI_RESOLUTION", data,
                serializeEvidenceImages(evidence), null);
        if (notificationService != null) notificationService.notifyCustomer(task.getContract().getCustomer().getId(),
                "Quản lý đã xử lý phản hồi check-in", "Các nội dung bạn từ chối đã được xử lý. Nhân viên sẽ kiểm tra lại và gửi biên bản mới.",
                "ASSIGNED", "/kho-cua-toi/hop-dong/" + task.getContract().getReservation().getId());
        return Map.of("status", "RESOLVED", "message", "Đã xử lý đầy đủ; có thể mở lại check-in");
    }

    // Endpoint cũ giữ để dữ liệu/client cũ vẫn hoạt động. Flow mới dùng resolveCheckInIssues.
    @Transactional
    public Map<String, Object> confirmCheckInIssue(Integer taskId, CurrentUser actor, String note) {
        if (!actor.hasRole("FACILITY_MANAGER")) throw new StaffTaskException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Chỉ quản lý cơ sở được xác nhận sự cố");
        lockCheckInTask(taskId);
        StaffTask task = staffTaskRepository.findDetailById(taskId).orElseThrow();
        if (!task.getFacilityId().equals(actor.facilityId())) throw new StaffTaskException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Khác cơ sở");
        if (!validLength(note, 10, 500)) throw new StaffTaskException(HttpStatus.BAD_REQUEST, "ISSUE_NOTE_REQUIRED", "Ghi nhận lỗi cơ sở trong 10–500 ký tự");
        Map<String, Object> latest = checkInEvent(task.getContract().getId(), "CI_DRAFT", "CI_ACCEPT", "CI_REJECT", "CI_FAULT", "CI_BLOCKER", "CI_RESOLUTION", "CI_REOPEN", "CI_RESCHEDULE", "CI_WITHDRAW");
        if (latest == null || !"CI_BLOCKER".equals(latest.get("record_type")))
            throw new StaffTaskException(HttpStatus.CONFLICT, "ISSUE_NOT_REPORTED", "Chưa có báo cáo không thể bàn giao cần xác nhận");
        if (!"FACILITY_ISSUE".equals(eventData(latest).get("issueType")))
            throw new StaffTaskException(HttpStatus.CONFLICT, "NOT_FACILITY_FAULT", "Bất đồng chưa xác định là lỗi cơ sở để hoàn 100%");
        addCheckInEvent(task.getContract(), actor.id(), "CI_FAULT",
                Map.of("draftId", eventDraftId(latest), "note", note.trim(), "actorId", actor.id(),
                        "unitId", task.getContract().getStorageUnit().getId()),
                (String) latest.get("evidence_image_urls"), null);
        StorageUnit affectedUnit = task.getContract().getStorageUnit();
        affectedUnit.setStatus("MAINTENANCE");
        affectedUnit.setMaintenanceNote(note.trim());
        if (affectedUnit.getMaintenanceSince() == null) affectedUnit.setMaintenanceSince(LocalDateTime.now());
        storageUnitRepository.save(affectedUnit);
        if (notificationService != null) notificationService.notifyCustomer(task.getContract().getCustomer().getId(),
                "Cơ sở xác nhận sự cố ô kho",
                "Ô " + task.getContract().getStorageUnit().getId() + " chưa thể bàn giao. Cơ sở đang xử lý; bạn có thể xem phương án dời lịch hoặc hủy hoàn tiền tại Kho của tôi.",
                "BOOKING", "/kho-cua-toi");
        return Map.of("status", "REJECTED", "message", "Đã xác nhận lỗi cơ sở; khách có thể dời lịch hoặc hủy hoàn tiền");
    }

    @Transactional
    public Map<String, Object> reopenCheckIn(Integer taskId, CurrentUser actor, String note, String photo,
                                             BigDecimal resolvedGoodsValue) {
        if (!actor.hasRole("FACILITY_MANAGER")) throw new StaffTaskException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Chỉ quản lý cơ sở được mở lại");
        lockCheckInTask(taskId);
        StaffTask task = staffTaskRepository.findDetailById(taskId).orElseThrow();
        if (!task.getFacilityId().equals(actor.facilityId()) || !"IN_PROGRESS".equals(task.getStatus())
                || task.getDueAt() == null || !task.getDueAt().isAfter(LocalDateTime.now()))
            throw new StaffTaskException(HttpStatus.CONFLICT, "RESCHEDULE_REQUIRED", "Task đã quá hạn hoặc không còn mở; cần dời lịch trước");
        if (note == null || note.trim().length() < 10 || note.trim().length() > 500)
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "RESOLUTION_NOTE_REQUIRED", "Ghi cách xử lý trong 10–500 ký tự");
        Map<String, Object> latest = checkInEvent(task.getContract().getId(), "CI_DRAFT", "CI_ACCEPT", "CI_REJECT", "CI_FAULT", "CI_BLOCKER", "CI_RESOLUTION", "CI_REOPEN", "CI_RESCHEDULE", "CI_WITHDRAW");
        if (latest == null || "CI_REOPEN".equals(latest.get("record_type")) || "CI_RESCHEDULE".equals(latest.get("record_type")))
            throw new StaffTaskException(HttpStatus.CONFLICT, "HANDOVER_NOT_PENDING", "Không có biên bản cần mở lại");
        int draftId = "CI_DRAFT".equals(latest.get("record_type")) ? eventId(latest) : eventDraftId(latest);
        if (draftId < 0 && !"CI_FAULT".equals(latest.get("record_type")) && !"CI_BLOCKER".equals(latest.get("record_type")))
            throw new StaffTaskException(HttpStatus.CONFLICT, "HANDOVER_STALE", "Biên bản không hợp lệ");
        if ("CI_REJECT".equals(latest.get("record_type")))
            throw new StaffTaskException(HttpStatus.CONFLICT, "ISSUES_NOT_RESOLVED", "Quản lý phải xử lý đầy đủ các nội dung khách từ chối trước");
        boolean dispute = "CI_BLOCKER".equals(latest.get("record_type"))
                && !"FACILITY_ISSUE".equals(eventData(latest).get("issueType"));
        boolean goodsValueDispute = dispute && "GOODS_VALUE_DISPUTE".equals(eventData(latest).get("issueType"));
        if (goodsValueDispute && (resolvedGoodsValue == null || resolvedGoodsValue.signum() <= 0
                || resolvedGoodsValue.compareTo(InsurancePlan.MAX_DECLARED_VALUE) > 0))
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_GOODS_VALUE", "FM cần chốt giá trị hàng hợp lệ trước khi tiếp tục");
        if (("CI_RESOLUTION".equals(latest.get("record_type")) || "CI_FAULT".equals(latest.get("record_type"))
                || ("CI_BLOCKER".equals(latest.get("record_type")) && !dispute))
                && (photo == null || photo.isBlank())) throw new StaffTaskException(HttpStatus.BAD_REQUEST, "RESOLUTION_PHOTO_REQUIRED", "Cần ảnh ô sau khi xử lý hoặc ô thay thế");
        assertUnitReadyForCheckIn(task.getContract());
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("draftId", draftId);
        data.put("note", note.trim());
        data.put("actorId", actor.id());
        data.put("unitId", task.getContract().getStorageUnit().getId());
        if (goodsValueDispute) {
            data.put("resolvedGoodsValue", resolvedGoodsValue);
            data.put("goodsValueResolutionNote", note.trim());
        }
        // Khi FM đã chốt lại giá trị hàng, kết luận này phải được giữ nguyên
        // xuyên suốt lần lập biên bản mới; staff không được tự sửa lại giá trị.
        if ("CI_RESOLUTION".equals(latest.get("record_type"))) {
            Map<String, Object> resolutionData = eventData(latest);
            data.put("resolvedGoodsValue", resolutionData.get("resolvedGoodsValue"));
            data.put("goodsValueResolutionNote", resolutionData.get("goodsValueResolutionNote"));
        }
        addCheckInEvent(task.getContract(), actor.id(), "CI_REOPEN", data, photo, null);
        if (notificationService != null && task.getStaff() != null) notificationService.notifyStaff(task.getStaff().getId(),
                "Check-in đã được mở lại",
                "Kiểm tra ô " + task.getContract().getStorageUnit().getId() + " và lập biên bản bàn giao mới cho task #" + taskId + ".",
                "ASSIGNED", "/staff/tasks/" + taskId);
        return Map.of("status", "IN_PROGRESS", "message", "Đã mở lại; nhân viên cần cùng khách kiểm tra và lập biên bản mới");
    }

    private CheckInRequest approvedCheckInDraft(StaffTask task, Integer staffId, Integer draftId) {
        if (draftId == null) throw new StaffTaskException(HttpStatus.CONFLICT, "CUSTOMER_CONFIRMATION_REQUIRED", "Khách cần xác nhận biên bản trước");
        lockCheckInTask(task.getId());
        Map<String, Object> latest = checkInEvent(task.getContract().getId(), "CI_DRAFT", "CI_ACCEPT", "CI_REJECT", "CI_FAULT", "CI_BLOCKER", "CI_RESOLUTION", "CI_REOPEN", "CI_RESCHEDULE", "CI_WITHDRAW");
        if (latest == null || !"CI_ACCEPT".equals(latest.get("record_type")) || eventDraftId(latest) != draftId)
            throw new StaffTaskException(HttpStatus.CONFLICT, "CUSTOMER_CONFIRMATION_REQUIRED", "Biên bản chưa được khách đồng ý hoặc đã thay thế");
        List<Map<String, Object>> drafts = jdbcTemplate.queryForList("SELECT id, staff_id, is_identity_verified, is_empty, is_clean, is_lock_intact, " +
                "is_prohibited_goods_committed, is_goods_value_verified, goods_value_assessment, assessed_goods_value, " +
                "goods_value_assessment_note, notes, evidence_image_urls, created_at FROM handover_records " +
                "WHERE id = ? AND contract_id = ? AND record_type = 'CI_DRAFT'", draftId, task.getContract().getId());
        if (drafts.isEmpty() || !staffId.equals(((Number) drafts.get(0).get("staff_id")).intValue())
                || !task.getId().equals(((Number) eventData(drafts.get(0)).get("taskId")).intValue())
                || !task.getContract().getStorageUnit().getId().equals(eventData(drafts.get(0)).get("unitId")))
            throw new StaffTaskException(HttpStatus.CONFLICT, "HANDOVER_STALE", "Ô kho hoặc nhân viên đã thay đổi; cần kiểm tra lại");
        Map<String, Object> draft = drafts.get(0);
        CheckInRequest request = new CheckInRequest();
        request.setIdentityVerified((Boolean) draft.get("is_identity_verified"));
        request.setUnitEmpty((Boolean) draft.get("is_empty"));
        request.setUnitClean((Boolean) draft.get("is_clean"));
        request.setUnitChecked(Boolean.TRUE.equals(draft.get("is_empty")) && Boolean.TRUE.equals(draft.get("is_clean")));
        request.setLockIntact((Boolean) draft.get("is_lock_intact"));
        request.setGoodsChecked((Boolean) draft.get("is_prohibited_goods_committed"));
        request.setGoodsValueVerified((Boolean) draft.get("is_goods_value_verified"));
        request.setGoodsValueAssessment((String) draft.get("goods_value_assessment"));
        request.setAssessedGoodsValue((BigDecimal) draft.get("assessed_goods_value"));
        request.setGoodsValueAssessmentNote((String) draft.get("goods_value_assessment_note"));
        request.setNotes((String) eventData(draft).get("notes"));
        Object checklistEvidence = eventData(draft).get("checklistEvidence");
        if (checklistEvidence instanceof Map<?, ?> values) {
            Map<String, List<String>> photos = new LinkedHashMap<>();
            for (String key : CHECK_IN_PHOTO_KEYS) {
                List<String> urls = checklistPhotos(values, key);
                if (!urls.isEmpty()) photos.put(key, urls);
            }
            request.setChecklistEvidence(photos);
        }
        request.setEvidenceImages(parseEvidenceImages((String) draft.get("evidence_image_urls")));
        return request;
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

        // Checklist is loaded from the customer-approved draft below.
        if (request == null) throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Thiếu thông tin hoàn tất bàn giao");
        RentalContract taskContract = task.getContract();
        if (taskContract == null && request.getApprovalId() == null) {
            throw new StaffTaskException(HttpStatus.CONFLICT, "CUSTOMER_CONFIRMATION_REQUIRED",
                    "Khách cần xác nhận biên bản trước khi cấp PIN/RFID và kích hoạt hợp đồng");
        }
        if (taskContract == null) {
            throw new StaffTaskException(HttpStatus.NOT_FOUND, "CONTRACT_NOT_FOUND", "Task chưa gắn với hợp đồng");
        }

        // PR-C1 (sửa L-17): không bàn giao trước ngày khách hẹn nhận kho — hợp đồng tính tiền từ ngày đó
        LocalDate appointmentDate = taskContract.getStartDate();
        if (taskContract.getReservation() != null
                && taskContract.getReservation().getExpectedAppointmentTime() != null) {
            appointmentDate = taskContract.getReservation().getExpectedAppointmentTime().toLocalDate();
        }
        if (appointmentDate != null && LocalDate.now().isBefore(appointmentDate)) {
            throw new StaffTaskException(HttpStatus.CONFLICT, "CHECK_IN_TOO_EARLY",
                    "Khách hẹn nhận kho ngày " + appointmentDate.format(DATE_FMT)
                            + ", chưa được check-in trước ngày hẹn");
        }
        if (request.getApprovalId() == null) {
            throw new StaffTaskException(HttpStatus.CONFLICT, "CUSTOMER_CONFIRMATION_REQUIRED",
                    "Khách cần xác nhận biên bản trước khi cấp PIN/RFID và kích hoạt hợp đồng");
        }
        // D-18: ô có thể đã gán cho khách này từ trước, nhưng tới ngày nhận kho ô đang bảo trì / khách trước chưa trả
        // → không bàn giao, FM phải đổi ô cho hợp đồng trước
        assertUnitReadyForCheckIn(task.getContract());
        // The accepted inspection is immutable; PIN/RFID are supplied only at final handover.
        CheckInRequest approvedDraft = approvedCheckInDraft(task, staffId, request.getApprovalId());
        approvedDraft.setAccessPinCode(request.getAccessPinCode());
        approvedDraft.setRfidCardCode(request.getRfidCardCode());
        approvedDraft.setCustomerSignatureConfirmed(true);
        validateCheckInRequest(approvedDraft);
        request = approvedDraft;
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
        record.setProhibitedGoodsCommitted(true);
        record.setGoodsValueVerified(true);
        record.setGoodsValueAssessment(request.getGoodsValueAssessment());
        record.setAssessedGoodsValue(request.getAssessedGoodsValue());
        record.setGoodsValueAssessmentNote(request.getGoodsValueAssessmentNote());
        record.setNotes(notes);
        record.setEvidenceImageUrls(serializeEvidenceImages(request.getEvidenceImages()));
        record.setCheckInMethod("COUNTER");
        handoverRecordRepository.save(record);

        // 6. Kích hoạt hợp đồng + cấp mã mở khoá
        contract.setStatus("ACTIVE");
        contract.setAccessPinCode(pin);
        contract.setRfidCardCode(rfid);
        rentalContractRepository.save(contract);
        // D-18: hàng đã vào ô → ô OCCUPIED (đơn gán trước cho ngày sau thì tới lúc này ô mới thật sự có khách)
        StorageUnit checkedInUnit = contract.getStorageUnit();
        if (checkedInUnit != null && !"OCCUPIED".equals(checkedInUnit.getStatus())) {
            checkedInUnit.setStatus("OCCUPIED");
            storageUnitRepository.save(checkedInUnit);
        }

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

        // BR-111 / BR-117: khách nhận thông báo + email (KHÔNG gửi mã PIN — khách xem PIN trong trang hợp đồng)
        if (notificationService != null && contract.getCustomer() != null) notificationService.notifyCustomer(
                contract.getCustomer().getId(),
                "Nhận kho thành công — hợp đồng " + contract.getContractCode() + " đã kích hoạt",
                "Ô " + contract.getStorageUnit().getId() + " đã bàn giao cho bạn, hợp đồng có hiệu lực đến "
                        + contract.getEndDate() + ". Mã PIN và thẻ RFID xem trong trang hợp đồng.",
                "ASSIGNED",
                contract.getReservation() != null ? "/kho-cua-toi/hop-dong/" + contract.getReservation().getId() : "/kho-cua-toi"
        );

        entityManager.flush();
        entityManager.clear();
        return toDetailResponse(staffTaskRepository.findDetailById(taskId).orElseThrow());
    }



    // D-18: ô của hợp đồng phải sẵn sàng hôm nay — không bảo trì, không còn khách khác đang ở
    void assertUnitReadyForCheckIn(RentalContract contract) {
        StorageUnit unit = contract != null ? contract.getStorageUnit() : null;
        if (unit == null) return;
        if ("MAINTENANCE".equalsIgnoreCase(unit.getStatus())) {
            throw new StaffTaskException(HttpStatus.CONFLICT, "UNIT_IN_MAINTENANCE",
                    "Ô " + unit.getId() + " đang bảo trì" + (unit.getMaintenanceNote() != null ? " (" + unit.getMaintenanceNote() + ")" : "")
                            + " — báo Quản lý cơ sở đổi ô cho hợp đồng trước khi bàn giao");
        }
        unitScheduleService.bookingsOfUnit(unit.getId()).stream()
                .filter(b -> !b.contractId().equals(contract.getId()))
                .filter(b -> LIVE_CONTRACT_STATUSES.contains(b.status()))
                .findFirst()
                .ifPresent(b -> {
                    throw new StaffTaskException(HttpStatus.CONFLICT, "UNIT_STILL_OCCUPIED",
                            "Ô " + unit.getId() + " vẫn còn khách HĐ " + b.contractCode() + " chưa trả kho"
                                    + " — báo Quản lý cơ sở đổi ô cho hợp đồng trước khi bàn giao");
                });
    }

    private void normalizeGoodsValueAssessment(RentalContract contract, CheckInRequest request) {
        if (request == null) return;
        String assessment = request.getGoodsValueAssessment() == null
                ? "" : request.getGoodsValueAssessment().trim().toUpperCase();
        request.setGoodsValueAssessment(assessment);
        if ("MATCHED".equals(assessment)) {
            BigDecimal declared = contract != null && contract.getReservation() != null
                    ? contract.getReservation().getDeclaredGoodsValue() : null;
            if (declared == null || declared.signum() <= 0) {
                throw new StaffTaskException(HttpStatus.BAD_REQUEST, "GOODS_VALUE_ASSESSMENT_REQUIRED",
                        "Đơn cũ chưa có giá trị khai báo; hãy ghi nhận giá trị thực tế tại check-in");
            }
            request.setAssessedGoodsValue(declared);
            request.setGoodsValueAssessmentNote(null);
        }
    }

    void validateCheckInRequest(CheckInRequest request) {
        validateCheckInRequest(request, true);
    }

    private void normalizeUnitCheck(CheckInRequest request) {
        if (request != null && Boolean.TRUE.equals(request.getUnitChecked())) {
            request.setUnitEmpty(true);
            request.setUnitClean(true);
        }
    }

    private static List<String> evidencePhotos(Object value) {
        if (value instanceof String url) return url.isBlank() ? List.of() : List.of(url);
        if (!(value instanceof Collection<?> photos)) return List.of();
        return photos.stream().filter(String.class::isInstance).map(String.class::cast)
                .filter(url -> !url.isBlank()).toList();
    }

    private static List<String> checklistPhotos(Map<?, ?> values, String key) {
        List<String> photos = evidencePhotos(values.get(key));
        if ("unitChecked".equals(key) && photos.isEmpty()) {
            List<String> legacy = new ArrayList<>(evidencePhotos(values.get("unitEmpty")));
            legacy.addAll(evidencePhotos(values.get("unitClean")));
            return legacy;
        }
        return photos;
    }

    void validateCheckInRequest(CheckInRequest request, boolean requireCustomerApproval) {
        if (request == null) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Thiếu nội dung biên bản");
        }
        boolean allChecked = Boolean.TRUE.equals(request.getIdentityVerified())
                && Boolean.TRUE.equals(request.getUnitChecked())
                && Boolean.TRUE.equals(request.getLockIntact())
                && (!requireCustomerApproval || Boolean.TRUE.equals(request.getCustomerSignatureConfirmed()));
        if (!allChecked) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "CHECKLIST_INCOMPLETE",
                    "Phải hoàn thành đủ các mục kiểm tra trước khi bàn giao");
        }
        // PR-C7 / BR-132: kiểm tra hàng mang vào khớp loại hàng khai báo, không có chất cháy nổ / hàng cấm
        if (!Boolean.TRUE.equals(request.getGoodsChecked())) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "GOODS_CHECK_REQUIRED",
                    "Phải kiểm tra hàng khách mang vào (khớp khai báo, không có hàng cấm) trước khi bàn giao");
        }
        if (!Boolean.TRUE.equals(request.getGoodsValueVerified())) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "GOODS_VALUE_CHECK_REQUIRED",
                    "Phải đối chiếu hàng thực tế với giá trị và chứng từ khách khai trước khi gửi biên bản");
        }
        String assessment = request.getGoodsValueAssessment() == null
                ? "" : request.getGoodsValueAssessment().trim().toUpperCase();
        if (!List.of("MATCHED", "ADJUSTED").contains(assessment)) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "GOODS_VALUE_ASSESSMENT_REQUIRED",
                    "Chọn giá trị khớp khai báo hoặc đề xuất giá trị điều chỉnh");
        }
        if (request.getAssessedGoodsValue() == null || request.getAssessedGoodsValue().signum() <= 0
                || request.getAssessedGoodsValue().compareTo(InsurancePlan.MAX_DECLARED_VALUE) > 0) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_GOODS_VALUE",
                    "Giá trị hàng ghi nhận phải lớn hơn 0 và không vượt quá 10 tỷ đồng");
        }
        if ("ADJUSTED".equals(assessment)
                && !validLength(request.getGoodsValueAssessmentNote(), 5, 1000)) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "GOODS_VALUE_NOTE_REQUIRED",
                    "Khi điều chỉnh giá trị, lý do phải từ 5 đến 1000 ký tự");
        }
        if (requireCustomerApproval && (request.getAccessPinCode() == null || !request.getAccessPinCode().trim().matches("\\d{6}"))) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Mã PIN phải gồm đúng 6 chữ số");
        }
        if (requireCustomerApproval && (request.getRfidCardCode() == null
                || !request.getRfidCardCode().matches("RFID-\\d{5}"))) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_RFID", "Mã thẻ phải có dạng RFID-12345 (RFID- và đúng 5 chữ số)");
        }
        if (request.getNotes() != null && request.getNotes().trim().length() > 1000) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Ghi chú tối đa 1000 ký tự");
        }
        Map<String, List<String>> photos = request.getChecklistEvidence();
        if (photos == null || CHECK_IN_PHOTO_KEYS.stream().anyMatch(key -> evidencePhotos(photos.get(key)).isEmpty())) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "CHECKLIST_PHOTO_REQUIRED",
                    "Mỗi mục kiểm tra check-in phải có ít nhất một ảnh minh chứng");
        }
        List<String> orderedPhotos = CHECK_IN_PHOTO_KEYS.stream().flatMap(key -> evidencePhotos(photos.get(key)).stream()).toList();
        if (orderedPhotos.stream().distinct().count() != orderedPhotos.size()) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "CHECKLIST_PHOTO_DUPLICATE",
                    "Một ảnh không được dùng cho nhiều mục kiểm tra");
        }
        request.setEvidenceImages(orderedPhotos);
        validateHandoverPhotos(request.getEvidenceImages(), "bàn giao");
    }

    // BR-121: biên bản check-in / nghiệm thu phải có ảnh hiện trạng ô (1–10 ảnh) — là căn cứ khi tranh chấp
    // ai làm hỏng ô / hàng. So ảnh lúc nhận với ảnh lúc trả để biết hư hỏng phát sinh trong thời gian thuê
    static final int MAX_HANDOVER_PHOTOS = 10;

    private void validateHandoverPhotos(List<String> images, String action) {
        long count = images == null ? 0 : images.stream().filter(s -> s != null && !s.isBlank()).count();
        if (count == 0) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "HANDOVER_PHOTO_REQUIRED",
                    "Biên bản " + action + " bắt buộc có ít nhất 1 ảnh hiện trạng ô kho");
        }
        if (count > MAX_HANDOVER_PHOTOS) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_INPUT",
                    "Biên bản " + action + " tối đa " + MAX_HANDOVER_PHOTOS + " ảnh");
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

        boolean transferDone = task.getNote() != null && task.getNote().contains("[FM đã chuyển HĐ sang ô");
        boolean hasTransferReq = task.getNote() != null && task.getNote().contains("[YÊU CẦU FM ĐỔI KHO CHO KHÁCH");
        boolean isTransferUnit = false;
        if (task.getSupportRequestId() != null && supportRequestRepository != null) {
            SupportRequest sr = supportRequestRepository.findById(task.getSupportRequestId()).orElse(null);
            if (sr != null && sr.getSubCategory() != null) {
                String sub = sr.getSubCategory().toLowerCase();
                if (sub.contains("đổi ô") || sub.contains("chuyển ô") || sub.contains("chuyển đồ") || sub.contains("chuyển kho")) {
                    isTransferUnit = true;
                }
            }
        }
        if (!isTransferUnit && task.getNote() != null) {
            String noteLower = task.getNote().toLowerCase();
            if (noteLower.contains("đổi ô") || noteLower.contains("chuyển ô kho") || noteLower.contains("chuyển đồ") || noteLower.contains("chuyển kho")) {
                isTransferUnit = true;
            }
        }
        if ((hasTransferReq || isTransferUnit) && !transferDone) {
            throw new StaffTaskException(HttpStatus.CONFLICT, "PENDING_UNIT_TRANSFER",
                    "Yêu cầu hỗ trợ chuyển ô kho này đang chờ Quản lý cơ sở (FM) thực hiện chuyển hợp đồng sang ô kho mới trên hệ thống. "
                    + "Cần Quản lý cơ sở chuyển ô kho cho khách trước khi hoàn tất yêu cầu hỗ trợ.");
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
        StringBuilder fullResolution = new StringBuilder(resolutionNote);
        if (request != null && request.getSecurityLockStatus() != null && !request.getSecurityLockStatus().isBlank()) {
            fullResolution.append(" [Khóa: ")
                    .append("TAMPERED".equalsIgnoreCase(request.getSecurityLockStatus()) ? "Có dấu vết can thiệp" : "Nguyên vẹn")
                    .append("]");
        }
        boolean isEscalated = request != null && request.getRepairStatus() != null && "ESCALATED_MAINTENANCE".equalsIgnoreCase(request.getRepairStatus());
        StaffTask createdMaintenanceTask = null;
        if (isEscalated) {
            fullResolution.append(" [Chuyển bảo trì chuyên sâu]");
            Integer contractId = updatedTask.getContract() != null ? updatedTask.getContract().getId() : null;
            if (contractId != null && rentalContractRepository != null) {
                RentalContract liveContract = rentalContractRepository.findDetailById(contractId).orElse(null);
                if (liveContract != null) {
                    String maintNote = "[Bảo trì chuyên sâu từ Ticket #" + (updatedTask.getSupportRequestId() != null ? updatedTask.getSupportRequestId() : "") + "] " + resolutionNote;
                    if (maintNote.length() > 1000) {
                        maintNote = maintNote.substring(0, 997) + "...";
                    }
                    createdMaintenanceTask = createMaintenanceTask(liveContract, "FACILITY_DAMAGE", maintNote, false, staff);
                    if (createdMaintenanceTask != null && updatedTask.getSupportRequestId() != null) {
                        createdMaintenanceTask.setSupportRequestId(updatedTask.getSupportRequestId());
                        staffTaskRepository.save(createdMaintenanceTask);
                    }
                }
            }
        }

        String appendedNote = oldNote + " | [Kết quả xử lý: " + fullResolution + "]";
        if (appendedNote.length() > 1000) {
            appendedNote = appendedNote.substring(0, 997) + "...";
        }
        updatedTask.setNote(appendedNote);
        if (request != null && request.getInspectionImages() != null && !request.getInspectionImages().isEmpty()) {
            List<String> validImgs = request.getInspectionImages().stream()
                    .filter(Objects::nonNull).map(String::trim).filter(s -> !s.isEmpty()).toList();
            if (!validImgs.isEmpty()) {
                updatedTask.setEvidenceImageUrl(String.join("\n|||\n", validImgs));
            }
        }
        staffTaskRepository.save(updatedTask);

        // Cập nhật ticket sang RESOLVED
        String ticketCode = "#" + supportRequestId;
        SupportRequest linkedTicket = supportRequestId == null ? null : supportRequestRepository.findById(supportRequestId).orElse(null);
        if (linkedTicket != null && CompensationClaimService.isClaimIssue(linkedTicket.getIssueType())
                && compensationClaimService != null) {
            // BR-126: ticket hàng hư / mất → "hoàn tất" = biên bản kiểm tra hiện trường; ticket vẫn đang xử lý chờ FM chốt bồi thường
            compensationClaimService.recordInspection(linkedTicket.getId(), staff, resolutionNote,
                    request.getInspectionImages(), request.getPreliminaryCause());
            ticketCode = linkedTicket.getTicketCode();
        } else if (supportRequestId != null) {
            SupportRequest sr = supportRequestRepository.findById(supportRequestId)
                    .orElseThrow(() -> new StaffTaskException(HttpStatus.NOT_FOUND, "TICKET_NOT_FOUND",
                            "Không tìm thấy ticket hỗ trợ liên kết"));
            if (isEscalated) {
                sr.setStatus("IN_PROGRESS");
            } else {
                sr.setStatus("RESOLVED");
                sr.setResolvedAt(now);
            }
            String resNoteToSave = fullResolution.toString();
            if (resNoteToSave.length() > 1000) {
                resNoteToSave = resNoteToSave.substring(0, 997) + "...";
            }
            sr.setResolutionNote(resNoteToSave);
            supportRequestRepository.save(sr);
            ticketCode = sr.getTicketCode();

            // BR-111 / BR-117: khách nhận thông báo + email kết quả xử lý
            if (notificationService != null && sr.getCustomer() != null) {
                String notifTitle = isEscalated
                        ? "Yêu cầu hỗ trợ " + sr.getTicketCode() + " đã chuyển sang bảo trì chuyên sâu"
                        : "Yêu cầu hỗ trợ " + sr.getTicketCode() + " đã được xử lý";
                String notifBody = isEscalated
                        ? "Nhân viên " + staff.getFullName() + " đã kiểm tra hiện trường và chuyển tiếp sang bảo trì chuyên sâu"
                          + (createdMaintenanceTask != null ? " (Task #" + createdMaintenanceTask.getId() + ")" : "")
                          + ": " + resolutionNote + ". Đội ngũ kỹ thuật đang tiếp tục xử lý."
                        : "Kết quả: " + resolutionNote + ". Nếu sự cố chưa được khắc phục, bạn có thể yêu cầu xử lý lại trong 3 ngày.";
                notificationService.notifyCustomer(
                        sr.getCustomer().getId(),
                        notifTitle,
                        notifBody,
                        "SUPPORT",
                        "/ho-tro"
                );
            }
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
     * PR-S5: Chỉnh sửa lại kết quả xử lý hỗ trợ khi ticket đang ở trạng thái RESOLVED (Chờ khách xác nhận).
     * Cho phép Staff / Quản lý cơ sở sửa lại nội dung hoặc cập nhật ảnh nếu phát hiện nhầm lẫn.
     */
    @Transactional
    public StaffTaskDetailResponse updateSupportResolution(Integer taskId, Integer userId, ResolveSupportTaskRequest request) {
        if (userId == null) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Thiếu thông tin người thao tác");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new StaffTaskException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "Không tìm thấy người dùng"));
        String roleName = user.getRole() != null ? user.getRole().getName() : "";
        if (!"STAFF".equals(roleName) && !"FACILITY_MANAGER".equals(roleName)) {
            throw new StaffTaskException(HttpStatus.FORBIDDEN, "FORBIDDEN_ROLE",
                    "Chỉ nhân viên hoặc quản lý cơ sở mới được cập nhật phản hồi");
        }

        StaffTask task = findTaskInFacility(taskId, user.getFacilityId());
        if (!"SUPPORT".equals(task.getTaskType())) {
            throw new StaffTaskException(HttpStatus.CONFLICT, "TASK_NOT_SUPPORT",
                    "Task này không phải task hỗ trợ khách hàng (SUPPORT)");
        }

        String resolutionNote = (request != null && request.getResolutionNote() != null)
                ? request.getResolutionNote().trim()
                : "";
        if (resolutionNote.isEmpty()) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_INPUT",
                    "Bắt buộc nhập nội dung kết quả xử lý");
        }
        if (resolutionNote.length() > 1000) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_INPUT",
                    "Nội dung kết quả xử lý tối đa 1000 ký tự");
        }

        Integer supportRequestId = task.getSupportRequestId();
        if (supportRequestId == null) {
            throw new StaffTaskException(HttpStatus.NOT_FOUND, "TICKET_NOT_FOUND", "Không tìm thấy ticket liên kết");
        }

        SupportRequest sr = supportRequestRepository.findById(supportRequestId)
                .orElseThrow(() -> new StaffTaskException(HttpStatus.NOT_FOUND, "TICKET_NOT_FOUND", "Không tìm thấy ticket hỗ trợ liên kết"));

        if (!"RESOLVED".equalsIgnoreCase(sr.getStatus())) {
            throw new StaffTaskException(HttpStatus.CONFLICT, "TICKET_NOT_RESOLVED",
                    "Chỉ được chỉnh sửa phản hồi khi yêu cầu hỗ trợ đang ở trạng thái Chờ khách xác nhận (RESOLVED)");
        }

        StringBuilder fullResolution = new StringBuilder(resolutionNote);
        if (request != null && request.getSecurityLockStatus() != null && !request.getSecurityLockStatus().isBlank()) {
            fullResolution.append(" [Khóa: ")
                    .append("TAMPERED".equalsIgnoreCase(request.getSecurityLockStatus()) ? "Có dấu vết can thiệp" : "Nguyên vẹn")
                    .append("]");
        }
        if (request != null && request.getRepairStatus() != null && "ESCALATED_MAINTENANCE".equalsIgnoreCase(request.getRepairStatus())) {
            fullResolution.append(" [Chuyển bảo trì chuyên sâu]");
        }

        String resNoteToSave = fullResolution.toString();
        if (resNoteToSave.length() > 1000) {
            resNoteToSave = resNoteToSave.substring(0, 997) + "...";
        }
        sr.setResolutionNote(resNoteToSave);
        supportRequestRepository.save(sr);

        if (request != null && request.getInspectionImages() != null && !request.getInspectionImages().isEmpty()) {
            List<String> validImgs = request.getInspectionImages().stream()
                    .filter(Objects::nonNull).map(String::trim).filter(s -> !s.isEmpty()).toList();
            if (!validImgs.isEmpty()) {
                task.setEvidenceImageUrl(String.join("\n|||\n", validImgs));
                staffTaskRepository.save(task);
            }
        }

        activityLogService.log(
                user.getId(),
                "[SUPPORT_RESOLVE_UPDATE] " + user.getFullName() + " chỉnh sửa lại phản hồi ticket #" + sr.getTicketCode() + ": " + resolutionNote,
                "support_requests",
                String.valueOf(supportRequestId)
        );

        entityManager.flush();
        entityManager.clear();
        return toDetailResponse(staffTaskRepository.findDetailById(taskId).orElseThrow());
    }



    /**
     * PR-S5: Nhân viên / Quản lý cơ sở thu hồi kết quả và mở lại toàn bộ task SUPPORT để xử lý lại từ đầu.
     * Áp dụng khi ticket đang ở trạng thái RESOLVED (Chờ khách xác nhận).
     * Task chuyển về IN_PROGRESS, ticket chuyển về IN_PROGRESS.
     */
    @Transactional
    public StaffTaskDetailResponse reopenSupportTask(Integer taskId, Integer userId, String reason) {
        if (userId == null) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Thiếu thông tin người thao tác");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new StaffTaskException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "Không tìm thấy người dùng"));
        String roleName = user.getRole() != null ? user.getRole().getName() : "";
        if (!"STAFF".equals(roleName) && !"FACILITY_MANAGER".equals(roleName)) {
            throw new StaffTaskException(HttpStatus.FORBIDDEN, "FORBIDDEN_ROLE",
                    "Chỉ nhân viên hoặc quản lý cơ sở mới được mở lại task hỗ trợ");
        }

        StaffTask task = findTaskInFacility(taskId, user.getFacilityId());
        if (!"SUPPORT".equals(task.getTaskType())) {
            throw new StaffTaskException(HttpStatus.CONFLICT, "TASK_NOT_SUPPORT",
                    "Task này không phải task hỗ trợ khách hàng (SUPPORT)");
        }
        if (!"COMPLETED".equalsIgnoreCase(task.getStatus())) {
            throw new StaffTaskException(HttpStatus.CONFLICT, "TASK_NOT_COMPLETED",
                    "Chỉ mở lại task đã hoàn tất");
        }

        Integer supportRequestId = task.getSupportRequestId();
        if (supportRequestId == null) {
            throw new StaffTaskException(HttpStatus.NOT_FOUND, "TICKET_NOT_FOUND", "Không tìm thấy ticket liên kết");
        }

        SupportRequest sr = supportRequestRepository.findById(supportRequestId)
                .orElseThrow(() -> new StaffTaskException(HttpStatus.NOT_FOUND, "TICKET_NOT_FOUND", "Không tìm thấy ticket hỗ trợ liên kết"));

        if (!"RESOLVED".equalsIgnoreCase(sr.getStatus())) {
            throw new StaffTaskException(HttpStatus.CONFLICT, "TICKET_NOT_RESOLVED",
                    "Chỉ được mở lại task khi phiếu hỗ trợ đang ở trạng thái Chờ khách xác nhận (RESOLVED)");
        }

        if (compensationClaimService != null && CompensationClaimService.isClaimIssue(sr.getIssueType())) {
            compensationClaimService.reopenForTicket(sr.getId());
        }

        task.setStatus("IN_PROGRESS");
        task.setCompletedAt(null);
        if (task.getStaff() == null && "STAFF".equals(roleName)) {
            task.setStaff(user);
        }
        String reopenNote = reason != null && !reason.isBlank() ? reason.trim() : "Nhân viên mở lại để xử lý lại";
        String oldNote = task.getNote() != null ? task.getNote() : "";
        String appended = oldNote + " | [Mở lại: " + reopenNote + "]";
        if (appended.length() > 1000) appended = appended.substring(0, 997) + "...";
        task.setNote(appended);
        staffTaskRepository.save(task);

        sr.setStatus("IN_PROGRESS");
        sr.setResolvedAt(null);
        supportRequestRepository.save(sr);

        activityLogService.log(
                user.getId(),
                "[SUPPORT_TASK_REOPEN] " + user.getFullName() + " đã thu hồi kết quả và mở lại task #" + taskId + " (ticket #" + sr.getTicketCode() + ") để xử lý lại: " + reopenNote,
                "support_requests",
                String.valueOf(supportRequestId)
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
     * UC-27 / PR-S7: Staff cấp đổi thẻ từ RFID mới cho ticket LOCK_ISSUE (lỗi thẻ từ RFID).
     */
    @Transactional
    public StaffTaskDetailResponse reissueSupportContractRfid(Integer taskId, Integer staffId, String customRfid) {
        User staff = findUserWithRole(staffId, "STAFF", "Chỉ nhân viên mới được cấp đổi thẻ từ RFID hỗ trợ");
        StaffTask task = findTaskInFacility(taskId, staff.getFacilityId());

        if (!"SUPPORT".equals(task.getTaskType())) {
            throw new StaffTaskException(HttpStatus.CONFLICT, "TASK_NOT_SUPPORT",
                    "Chỉ task Hỗ trợ (SUPPORT) mới có chức năng cấp đổi thẻ từ RFID");
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
                    "Chỉ yêu cầu hỗ trợ thuộc loại Sự cố khóa (LOCK_ISSUE) mới được cấp đổi thẻ từ RFID");
        }

        RentalContract contract = task.getContract() != null ? task.getContract() : sr.getContract();
        if (contract == null) {
            throw new StaffTaskException(HttpStatus.NOT_FOUND, "CONTRACT_NOT_FOUND",
                    "Không tìm thấy hợp đồng gắn với yêu cầu hỗ trợ này");
        }

        if (!LIVE_CONTRACT_STATUSES.contains(contract.getStatus())) {
            throw new StaffTaskException(HttpStatus.CONFLICT, "CONTRACT_STATUS_INVALID",
                    "Hợp đồng không còn hiệu lực để cấp đổi thẻ từ RFID");
        }

        String newRfid;
        if (customRfid != null && !customRfid.isBlank()) {
            newRfid = customRfid.trim();
            if (!newRfid.matches("RFID-\\d{5}")) {
                throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_RFID",
                        "Mã thẻ RFID phải có dạng RFID-12345 (RFID- và đúng 5 chữ số)");
            }
            if (rentalContractRepository.existsByRfidCardCode(newRfid)) {
                throw new StaffTaskException(HttpStatus.CONFLICT, "RFID_TAKEN",
                        "Mã thẻ RFID " + newRfid + " hiện đang được sử dụng trên một hợp đồng khác");
            }
        } else {
            newRfid = suggestRfidExcluding(contract.getRfidCardCode());
        }

        contract.setRfidCardCode(newRfid);
        rentalContractRepository.save(contract);

        String stamp = LocalDateTime.now().format(TS_FMT);
        String updatedNote = (task.getNote() != null ? task.getNote() : "") + " | [Đã cấp đổi thẻ RFID mới " + newRfid + " lúc " + stamp + "]";
        if (updatedNote.length() > 1000) {
            updatedNote = updatedNote.substring(0, 997) + "...";
        }
        task.setNote(updatedNote);
        staffTaskRepository.save(task);

        activityLogService.log(
                staff.getId(),
                "[RFID_REISSUE] Nhân viên " + staff.getFullName() + " cấp đổi thẻ từ RFID mới (" + newRfid + ") cho HĐ " + contract.getContractCode()
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
        return extendTask(taskId, managerId, request, List.of("SUPPORT"));
    }

    // PR-S4 mở rộng (02/11/2026): FM gia hạn được task SUPPORT và MAINTENANCE quá hạn.
    // CHECK_IN quá hạn dùng "Dời lịch nhận kho"; CHECK_OUT do khách dời lịch trả; REFUND là việc của chính FM.
    public static final List<String> EXTENDABLE_TASK_TYPES = List.of("SUPPORT", "MAINTENANCE");
    public static final int MAX_EXTEND_DAYS = 7;

    @Transactional
    public StaffTaskDetailResponse extendOverdueTask(Integer taskId, Integer managerId, ExtendSupportTaskRequest request) {
        return extendTask(taskId, managerId, request, EXTENDABLE_TASK_TYPES);
    }

    private StaffTaskDetailResponse extendTask(Integer taskId, Integer managerId, ExtendSupportTaskRequest request,
                                               List<String> allowedTypes) {
        User manager = findUserWithRole(managerId, "FACILITY_MANAGER",
                "Chỉ Quản lý cơ sở (FM) mới có quyền gia hạn task quá hạn (PR-S4)");
        StaffTask task = findTaskInFacility(taskId, manager.getFacilityId());

        // D-21 / PR-O22: task kiểm tra lại quyết toán (CHECK_OUT [RECHECK]) quá hạn cũng gia hạn như task bảo trì
        boolean recheck = allowedTypes.size() > 1 && CheckoutSettlementService.isRecheckTask(task);
        if (!allowedTypes.contains(task.getTaskType()) && !recheck) {
            throw new StaffTaskException(HttpStatus.CONFLICT, allowedTypes.size() == 1 ? "TASK_NOT_SUPPORT" : "TASK_NOT_EXTENDABLE",
                    allowedTypes.size() == 1
                            ? "Chỉ task hỗ trợ (SUPPORT) mới áp dụng chức năng gia hạn này (PR-S4)"
                            : "Chỉ gia hạn được task hỗ trợ (SUPPORT) và bảo trì (MAINTENANCE). Task nhận kho hãy dời lịch hẹn, task trả kho do khách dời lịch.");
        }
        String typeLabel = recheck ? "kiểm tra lại" : "MAINTENANCE".equals(task.getTaskType()) ? "bảo trì" : "hỗ trợ";

        boolean isOverdue = "OVERDUE".equals(task.getStatus())
                || (OPEN_STATUSES.contains(task.getStatus()) && task.getDueAt() != null && !task.getDueAt().isAfter(LocalDateTime.now()));
        if (!isOverdue) {
            throw new StaffTaskException(HttpStatus.CONFLICT, "TASK_NOT_OVERDUE",
                    "Chỉ task " + typeLabel + " đã quá hạn (OVERDUE) mới cần gia hạn");
        }

        if (request == null || request.getNewDueDate() == null) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_INPUT",
                    "Vui lòng chọn ngày hạn mới cho task " + typeLabel + " (PR-S4)");
        }
        if (request.getNewDueDate().isBefore(LocalDate.now())) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_INPUT",
                    "Ngày hạn mới phải từ hôm nay trở đi");
        }
        if (request.getNewDueDate().isAfter(LocalDate.now().plusDays(MAX_EXTEND_DAYS))) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_INPUT",
                    "Chỉ gia hạn tối đa " + MAX_EXTEND_DAYS + " ngày kể từ hôm nay");
        }

        String reason = request.getReason() != null ? request.getReason().trim() : "";
        if (reason.isEmpty()) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_INPUT",
                    "Bắt buộc nhập lý do gia hạn task " + typeLabel + " (PR-S4)");
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
        SupportRequest sr = null;
        if (task.getSupportRequestId() != null) {
            sr = supportRequestRepository.findById(task.getSupportRequestId()).orElse(null);
            if (sr != null) {
                ticketCode = sr.getTicketCode();
                if ("OPEN".equals(sr.getStatus()) || "IN_PROGRESS".equals(sr.getStatus())) {
                    sr.setStatus(restoredStatus);
                    supportRequestRepository.save(sr);
                }
            }
        }

        boolean support = "SUPPORT".equals(task.getTaskType());
        activityLogService.log(
                manager.getId(),
                (support ? "[SUPPORT_EXTEND] " : "[TASK_EXTEND] ") + "Quản lý " + manager.getFullName() + " gia hạn task "
                        + task.getTaskType() + " #" + task.getId()
                        + (support ? " (Ticket " + ticketCode + ")" : "") + " đến 21:00 " + formattedDue + ": " + reason,
                "facility_tasks",
                String.valueOf(task.getId())
        );

        // BR-111 & Vấn đề 3C: nhân viên đang giữ task biết hạn mới (chuông báo + email)
        if (notificationService != null && task.getStaff() != null) {
            notificationService.notifyStaff(
                    task.getStaff().getId(),
                    "Task #" + task.getId() + " đã được gia hạn đến " + formattedDue,
                    "Quản lý " + manager.getFullName() + " đã dời hạn xử lý task " + typeLabel + " sang 21:00 ngày " + formattedDue + ". Lý do: " + reason,
                    "TASK",
                    "/staff?highlightTaskId=" + task.getId(),
                    true
            );
        }

        // Vấn đề 3C: chuông báo + email cho khách hàng liên quan biết công việc được dời qua ngày mới
        if (notificationService != null) {
            User customer = (task.getContract() != null && task.getContract().getCustomer() != null)
                    ? task.getContract().getCustomer()
                    : (sr != null ? sr.getCustomer() : null);
            if (customer != null) {
                String contractCode = task.getContract() != null ? task.getContract().getContractCode() : "";
                String custTitle = support
                        ? "Gia hạn thời gian xử lý yêu cầu hỗ trợ " + ticketCode
                        : recheck
                        ? "Gia hạn kiểm tra lại nghiệm thu trả kho — HĐ " + contractCode
                        : "Cập nhật lịch bảo trì ô kho" + (!contractCode.isEmpty() ? " — HĐ " + contractCode : "");
                String custMsg = "Quản lý cơ sở đã dời thời hạn hoàn tất công việc " + typeLabel
                        + (support ? " (phiếu " + ticketCode + ")" : (!contractCode.isEmpty() ? " của HĐ " + contractCode : ""))
                        + " sang trước 21:00 ngày " + formattedDue + ". Lý do: " + reason + ".";
                String custUrl = support
                        ? "/ho-tro"
                        : (task.getContract() != null && task.getContract().getReservation() != null
                            ? "/kho-cua-toi/hop-dong/" + task.getContract().getReservation().getId()
                            : "/kho-cua-toi");
                notificationService.notifyCustomer(customer.getId(), custTitle, custMsg, support ? "SUPPORT" : "CONTRACT", custUrl);
            }
        }

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

        // D-21 / PR-O22: task kiểm tra lại theo khiếu nại quyết toán — chỉ lập lại danh sách sự cố, không làm lại bàn giao
        if (CheckoutSettlementService.isRecheckTask(task)) {
            settlementService.recordRecheck(task, staffId, request);
            entityManager.flush();
            entityManager.clear();
            return toDetailResponse(staffTaskRepository.findDetailById(taskId).orElseThrow());
        }

        // 1. Kiểm tra dữ liệu biên bản nghiệm thu và danh sách sự cố (UC-23 / UC-24)
        validateCheckOutRequest(request);

        // D-21 / PR-O17: còn ticket hỗ trợ mở / hồ sơ bồi thường chưa kiểm tra hiện trường → chưa nghiệm thu
        if (settlementService != null) settlementService.assertReadyForCheckout(task.getContract().getId());

        // UC-23 (góp ý test 13/11): không nghiệm thu trước ngày khách hẹn trả kho — tiền hoàn tính theo ngày nghiệm thu
        // thực tế, nghiệm thu sớm sẽ làm sai số tiền khách đã thấy lúc hẹn. Hạn task CHECK_OUT = 21:00 ngày hẹn
        // (task trả kho không gia hạn được, chỉ khách dời lịch → due_at luôn là ngày hẹn).
        LocalDate checkoutAppointment = task.getDueAt() != null ? task.getDueAt().toLocalDate() : null;
        if (checkoutAppointment != null && LocalDate.now().isBefore(checkoutAppointment)) {
            throw new StaffTaskException(HttpStatus.CONFLICT, "CHECK_OUT_TOO_EARLY",
                    "Khách hẹn trả kho ngày " + checkoutAppointment.format(DATE_FMT)
                            + ", chưa được nghiệm thu trước ngày hẹn");
        }
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
        record.setEvidenceImageUrls(serializeEvidenceImages(request.getEvidenceImages()));
        record.setCheckInMethod("COUNTER");
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
        if (hasDamage) {
            String unitId = unit != null ? unit.getId() : "";
            if (notificationService != null) notificationService.notifyFacilityManagers(
                task.getFacilityId(),
                "Sự cố hư hại khoang lưu trữ",
                "Nhân viên vừa báo cáo sự cố hư hại tại khoang " + unitId + " cần duyệt bồi thường.",
                "DAMAGE",
                "/manager/tasks"
            );
        }
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
                unit.setStatus(unit.idleStatus()); // BR-140: ô khẩn cấp về EMERGENCY, không mở bán
                storageUnitRepository.save(unit);
            }
        }

        // 7. D-21 / PR-O18 + PR-O19: bảng quyết toán vòng 1 — tính TRƯỚC khi đổi trạng thái hợp đồng
        //    (phí trễ / chiếm dụng chốt tại ngày nghiệm thu, giống màn xem trước của khách)
        //    PR-O31a (24/11/2026): task đã bấm demo "Khách tới trả đúng ngày hẹn" → chốt theo ngày hẹn gốc
        CheckoutSettlement settlement = settlementService.createInitial(contract, task,
                effectiveCheckoutDate(task, now.toLocalDate()), totalDamageCost, notes, staffId);

        // 8. Thu hồi mã PIN & thẻ RFID; hợp đồng chờ khách xác nhận kết thúc (chưa TERMINATED, đơn giữ TERMINATION_PENDING)
        contract.setStatus("SETTLEMENT_PENDING");
        contract.setAccessPinCode(null);
        contract.setRfidCardCode(null);
        rentalContractRepository.save(contract);

        // D-18: ô trống lại — nếu khách sau (gán trước) đã tới ngày nhận kho thì ô vẫn OCCUPIED
        if (unit != null && !hasDamage) {
            unitScheduleService.refreshUnitStatus(unit);
        }

        // PR-O17: ticket đã xử lý xong đang chờ khách xác nhận → đóng luôn (ticket hàng hư / mất đi theo hồ sơ bồi thường)
        jdbcTemplate.update(
                "UPDATE support_requests SET status = 'CLOSED', closed_at = SYSDATETIME() " +
                        "WHERE contract_id = ? AND status = 'RESOLVED' AND issue_type NOT IN ('GOODS_DAMAGE', 'GOODS_LOSS')",
                contract.getId());

        NumberFormat vndFmt = NumberFormat.getInstance(new Locale("vi", "VN"));
        if (notificationService != null) {
            notificationService.notifyFacilityManagers(
                    task.getFacilityId(),
                    "Đã nghiệm thu trả kho — HĐ " + contract.getContractCode(),
                    "Nhân viên đã nghiệm thu ô " + (unit != null ? unit.getId() : "—") + ". Chờ khách "
                            + contract.getCustomer().getFullName() + " xác nhận quyết toán ("
                            + (settlement.customerPays() ? "khách trả thêm " + vndFmt.format(settlement.getNetAmount().abs())
                                : "hoàn khách " + vndFmt.format(settlement.getNetAmount())) + "đ).",
                    "CHECKOUT",
                    "/manager/settlements?highlight=" + settlement.getId());
        }

        // 9. Ghi nhật ký hoạt động (activity_logs)
        try {
            String logMsg = "[CHECK_OUT] Nghiệm thu HĐ " + contract.getContractCode()
                    + ", ô " + (unit != null ? unit.getId() : "—")
                    + (hasDamage ? " (" + rawDamages.size() + " sự cố, khách chịu " + vndFmt.format(totalDamageCost) + "đ"
                            + (facilityDamageCost.compareTo(BigDecimal.ZERO) > 0 ? ", cơ sở chịu " + vndFmt.format(facilityDamageCost) + "đ" : "")
                            + ")" : " (Nguyên vẹn)")
                    + ", chờ khách xác nhận quyết toán: " + settlement.getBreakdownNote();
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
        // D-21 / PR-O22: khách đang khiếu nại quyết toán → giữ hiện trường, chưa đóng bảo trì
        if (settlementService != null) settlementService.assertNotDisputed(task.getContract() != null ? task.getContract().getId() : null);

        // Vấn đề 6: nếu task đang chờ FM chuyển ô cho khách, không được bấm hoàn tất bảo trì trước khi FM chuyển ô xong
        boolean pendingTransfer = task.getNote() != null
                && task.getNote().contains("[YÊU CẦU FM ĐỔI KHO CHO KHÁCH")
                && !task.getNote().contains("[FM đã chuyển HĐ sang ô");
        if (pendingTransfer) {
            throw new StaffTaskException(HttpStatus.CONFLICT, "PENDING_UNIT_TRANSFER",
                    "Task bảo trì này đang chờ Quản lý cơ sở (FM) thực hiện chuyển hợp đồng của khách sang ô tiêu chuẩn khác. "
                    + "Cần chuyển ô kho cho khách trước khi hoàn tất bảo trì ô cũ.");
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
        if (unit != null && !"MAINTENANCE".equals(unit.getStatus()) && done.getContract() != null) {
            // Vấn đề 6: nếu HĐ đã chuyển tạm sang ô khẩn cấp / ô khác khi ô cũ vào bảo trì, mở lại chính ô cũ đó
            try {
                List<String> oldIds = jdbcTemplate.queryForList(
                        "SELECT TOP 1 from_unit_id FROM unit_transfers WHERE contract_id = ? AND old_unit_status = 'MAINTENANCE' ORDER BY id DESC",
                        String.class, done.getContract().getId());
                if (!oldIds.isEmpty() && oldIds.get(0) != null) {
                    StorageUnit origUnit = storageUnitRepository.findById(oldIds.get(0)).orElse(null);
                    if (origUnit != null && "MAINTENANCE".equals(origUnit.getStatus())) {
                        unit = origUnit;
                    }
                }
            } catch (Exception ignored) {
            }
        }
        if (unit != null && "MAINTENANCE".equals(unit.getStatus())) {
            unit.setStatus(unit.idleStatus());
            unit.setMaintenanceNote(null);
            unit.setMaintenanceSince(null);
            storageUnitRepository.save(unit);
            // D-18: khách gán trước đã tới ngày nhận kho → OCCUPIED
            unitScheduleService.refreshUnitStatus(unit);
        }

        // PR-Q10: hàng của khách chuyển sang khu lưu giữ → lập hồ sơ lưu giữ 60 ngày
        if (recordGoods && done.getContract() != null) {
            heldGoodsService.createFromCleanup(done, done.getContract(), user,
                    request.getInventoryNote().trim(), inventoryImages,
                    request.getWitnessNote().trim(), request.getStorageLocation().trim(), request.getCentralWarehouseId());
        }

        activityLogService.log(
                user.getId(),
                "[MAINTENANCE_DONE] " + user.getFullName() + " hoàn tất bảo trì task #" + taskId
                        + (unit != null ? ", ô " + unit.getId() + " sẵn sàng cho thuê" : "") + ": " + workNote,
                "facility_tasks",
                String.valueOf(taskId)
        );

        // BR-111: nhân viên làm xong thì FM được báo (FM tự đóng thì không cần)
        if (notificationService != null && !isManager) notificationService.notifyFacilityManagers(
                task.getFacilityId(),
                (cleanup ? "Đã cưỡng chế dọn kho xong" : "Đã bảo trì xong") + (unit != null ? " — ô " + unit.getId() : ""),
                user.getFullName() + " hoàn tất task #" + taskId + ": " + workNote
                        + (unit != null ? ". Ô đã mở lại cho thuê." : ""),
                "TASK",
                "/manager/tasks/" + taskId
        );

        // Nếu task bảo trì xuất phát từ yêu cầu hỗ trợ -> cập nhật ticket sang RESOLVED
        if (done.getSupportRequestId() != null && supportRequestRepository != null) {
            supportRequestRepository.findById(done.getSupportRequestId()).ifPresent(sr -> {
                if (!"CLOSED".equals(sr.getStatus())) {
                    sr.setStatus("RESOLVED");
                    sr.setResolvedAt(now);
                    String updatedRes = (sr.getResolutionNote() != null ? sr.getResolutionNote() : "")
                            + " | [Bảo trì ô kho hoàn tất lúc " + now.format(TS_FMT) + ": " + workNote + "]";
                    if (updatedRes.length() > 1000) {
                        updatedRes = updatedRes.substring(0, 997) + "...";
                    }
                    sr.setResolutionNote(updatedRes);
                    supportRequestRepository.save(sr);

                    if (notificationService != null && sr.getCustomer() != null) {
                        notificationService.notifyCustomer(
                                sr.getCustomer().getId(),
                                "Bảo trì ô kho hoàn tất — Yêu cầu " + sr.getTicketCode(),
                                "Cơ sở đã hoàn tất bảo trì kỹ thuật cho ô kho của bạn: " + workNote + ". Vui lòng kiểm tra và xác nhận trên hệ thống.",
                                "SUPPORT",
                                "/ho-tro"
                        );
                    }
                }
            });
        }

        entityManager.flush();
        entityManager.clear();
        return toDetailResponse(staffTaskRepository.findDetailById(taskId).orElseThrow());
    }



    /**
     * Vấn đề 6 (22/11/2026): trong quá trình xử lý task MAINTENANCE, nhân viên kỹ thuật nhận thấy việc sửa kho cần
     * nhiều thời gian hơn (đặc biệt khi hàng của khách đang nằm tạm ở ô khẩn cấp) → gửi yêu cầu cho Quản lý cơ sở (FM)
     * chuyển hợp đồng của khách sang ô tiêu chuẩn khác.
     */
    @Transactional
    public StaffTaskDetailResponse requestMaintenanceUnitTransfer(Integer taskId, Integer userId, String reason) {
        if (userId == null) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Thiếu thông tin người thao tác");
        }
        User actor = userRepository.findById(userId)
                .orElseThrow(() -> new StaffTaskException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "Không tìm thấy tài khoản"));
        String role = actor.getRole() != null ? actor.getRole().getName() : "";
        if (!"STAFF".equals(role) && !"FACILITY_MANAGER".equals(role)) {
            throw new StaffTaskException(HttpStatus.FORBIDDEN, "FORBIDDEN_ROLE",
                    "Chỉ nhân viên cơ sở hoặc quản lý cơ sở mới được gửi yêu cầu chuyển ô kho");
        }
        StaffTask task = findTaskInFacility(taskId, actor.getFacilityId());
        if (!"MAINTENANCE".equals(task.getTaskType()) && !"SUPPORT".equals(task.getTaskType())) {
            throw new StaffTaskException(HttpStatus.CONFLICT, "TASK_NOT_ALLOWED",
                    "Chỉ task bảo trì (MAINTENANCE) hoặc hỗ trợ khách hàng (SUPPORT) mới sử dụng chức năng yêu cầu đổi kho này");
        }
        if ("COMPLETED".equals(task.getStatus()) || "CANCELLED".equals(task.getStatus())) {
            throw new StaffTaskException(HttpStatus.CONFLICT, "TASK_ALREADY_CLOSED",
                    "Task đã đóng, không thể gửi yêu cầu đổi kho");
        }
        RentalContract contract = task.getContract();
        if (contract == null) {
            throw new StaffTaskException(HttpStatus.CONFLICT, "NO_LINKED_CONTRACT",
                    "Task này không gắn với hợp đồng đang thuê để yêu cầu chuyển ô");
        }
        String cleanReason = reason != null ? reason.trim() : "";
        if (cleanReason.length() < 10 || cleanReason.length() > 500) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_INPUT",
                    "Vui lòng nhập lý do & đề xuất chuyển kho từ 10 đến 500 ký tự");
        }

        LocalDateTime now = LocalDateTime.now();
        String tag = "[YÊU CẦU FM ĐỔI KHO CHO KHÁCH bởi " + actor.getFullName() + " lúc " + now.format(TS_FMT) + ": " + cleanReason + "]";
        task.setNote(appendTaskNote(task.getNote(), tag));
        staffTaskRepository.save(task);

        String unitCode = contract.getStorageUnit() != null ? contract.getStorageUnit().getId() : "—";
        boolean inEmergency = contract.getStorageUnit() != null && contract.getStorageUnit().isEmergencyUnit();

        String taskTypeLabel = "SUPPORT".equals(task.getTaskType()) ? "hỗ trợ khách hàng" : "bảo trì";
        String taskTypeTag = "SUPPORT".equals(task.getTaskType()) ? "[SUPPORT_TRANSFER_REQ] " : "[MAINTENANCE_TRANSFER_REQ] ";
        activityLogService.log(
                actor.getId(),
                taskTypeTag + actor.getFullName() + " yêu cầu FM chuyển HĐ " + contract.getContractCode()
                        + " (đang ở ô " + unitCode + (inEmergency ? " - khẩn cấp" : "") + ") sang ô tiêu chuẩn khác ở task #" + taskId + ": " + cleanReason,
                "facility_tasks",
                String.valueOf(taskId)
        );

        if (notificationService != null) {
            notificationService.notifyFacilityManagers(
                    task.getFacilityId(),
                    "Yêu cầu đổi kho từ " + taskTypeLabel + " — HĐ " + contract.getContractCode(),
                    "Nhân viên " + actor.getFullName() + " gửi yêu cầu chuyển ô kho (Task #" + taskId + ") cho HĐ "
                            + contract.getContractCode() + " (hiện ở ô " + unitCode + (inEmergency ? " — ô khẩn cấp tạm thời" : "")
                            + ") sang ô tiêu chuẩn khác. Lý do: " + cleanReason,
                    "TASK",
                    "/manager/tasks/" + taskId,
                    true
            );
        }

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
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVENTORY_REQUIRED", "Ghi rõ vị trí kệ trong kho tổng (tối đa 100 ký tự)");
        }
        // BR-134 (05/11/2026): hàng của khách quá hạn chuyển vào kho tổng đang hoạt động
        boolean warehouseOk = request.getCentralWarehouseId() != null && operationsCatalogService != null
                && operationsCatalogService.findWarehouse(request.getCentralWarehouseId())
                        .filter(w -> "ACTIVE".equals(w.getStatus())).isPresent();
        if (!warehouseOk) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVENTORY_REQUIRED", "Chọn kho tổng nhận hàng (đang hoạt động)");
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
        // D-21 / PR-O22: khách đang khiếu nại quyết toán → chưa mở lại ô
        if (settlementService != null) tasks.forEach(t -> settlementService.assertNotDisputed(t.getContract() != null ? t.getContract().getId() : null));
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
        validateHandoverPhotos(request.getEvidenceImages(), "nghiệm thu");

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

    static String detectRefundMethodFromNote(String note) {
        if (note == null || note.isBlank()) {
            return "BANK_TRANSFER";
        }
        if (note.contains("Hoàn cọc STK:") || note.contains("STK:")) {
            return "BANK_TRANSFER";
        }
        String lower = note.toLowerCase(java.util.Locale.ROOT);
        boolean isCash = note.contains("HOÀN CỌC TIỀN MẶT")
                || note.contains("HOAN COC TIEN MAT")
                || lower.contains("tiền mặt")
                || lower.contains("tien mat");
        return isCash ? "CASH" : "BANK_TRANSFER";
    }

    // D-21: tiện ích cho CheckoutSettlementService (quyết toán trả kho)
    String bankInfoOfContractCheckout(Integer contractId) {
        List<String> notes = jdbcTemplate.queryForList(
                "SELECT TOP 1 note FROM facility_tasks WHERE contract_id = ? AND task_type = 'CHECK_OUT' AND status = 'COMPLETED' " +
                        "AND (note IS NULL OR note NOT LIKE '[[]RECHECK]%') ORDER BY id DESC", String.class, contractId);
        String note = notes.isEmpty() ? null : notes.get(0);
        return note != null && note.contains("Hoàn cọc STK:") ? extractBankInfoFromTaskNote(note) : "";
    }

    LocalDateTime refundDeadline(LocalDateTime requestTime) {
        return calculateRefundDeadline(requestTime);
    }

    String serializeImages(List<String> images) {
        return serializeEvidenceImages(images);
    }

    List<String> parseImages(String raw) {
        return parseEvidenceImages(raw);
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
        BigDecimal overstayFee = BigDecimal.ZERO;
        BigDecimal totalPenaltyFee = BigDecimal.ZERO;
        boolean lateFeeWaived = false;
        boolean overstayFeeWaived = false;
        Integer usedMonths = null;
        Integer cycleMonths = null;
        BigDecimal baseMonthlyPrice = null;
        String refundBreakdownNote = null;
        String taskNote = task.getNote();

        if (contract != null && ("CHECK_OUT".equals(task.getTaskType()) || "REFUND".equals(task.getTaskType()))) {
            LocalDate refDate = task.getCompletedAt() != null
                    ? task.getCompletedAt().toLocalDate()
                    : ("CHECK_OUT".equals(task.getTaskType())
                        ? LocalDate.now(LateFeeService.VIETNAM_ZONE)
                        : (task.getCreatedAt() != null ? task.getCreatedAt().toLocalDate() : LocalDate.now(LateFeeService.VIETNAM_ZONE)));
            // PR-O31a: task nghiệm thu chưa xong đã bấm demo "đúng ngày hẹn" → xem trước theo ngày hẹn gốc
            if ("CHECK_OUT".equals(task.getTaskType()) && task.getCompletedAt() == null) {
                refDate = effectiveCheckoutDate(task, refDate);
            }
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
            overstayFee = calc.getOverstayFee() != null ? calc.getOverstayFee() : BigDecimal.ZERO;
            totalPenaltyFee = graceFee.add(lateFee).add(overstayFee);
            lateFeeWaived = Boolean.TRUE.equals(contract.getLateFeeWaived());
            overstayFeeWaived = lateFeeWaived && Boolean.TRUE.equals(contract.getOverstayFeeWaived());
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

        // D-23 / PR-O30: task hoàn của quyết toán trả kho → số tiền lấy từ quyết toán (gồm bồi thường),
        // không tính lại theo hợp đồng (sau nghiệm thu cọc / trạng thái đã đổi nên tính lại sẽ lệch)
        SettlementRefundSplit settlementRefund = "REFUND".equals(task.getTaskType()) && settlementService != null
                ? settlementService.refundSplitOfTask(task.getId()).orElse(null) : null;
        if (settlementRefund != null) {
            refundAmount = settlementRefund.total();
        }

        Integer escalatedMaintId = null;
        if ("SUPPORT".equals(task.getTaskType()) && task.getSupportRequestId() != null) {
            escalatedMaintId = staffTaskRepository
                    .findFirstBySupportRequestIdAndTaskTypeOrderByIdDesc(task.getSupportRequestId(), "MAINTENANCE")
                    .map(StaffTask::getId)
                    .orElse(null);
        }

        return StaffTaskDetailResponse.builder()
                .id(task.getId())
                .cancelReason(task.getCancelReason())
                .simulatedCheckoutDate(task.getSimulatedCheckoutDate())
                .facilityId(task.getFacilityId())
                .taskType(task.getTaskType())
                .status(task.getStatus())
                .dueAt(task.getDueAt())
                .assignableFrom(assignableFrom(task))
                .createdAt(task.getCreatedAt())
                .claimedAt(task.getClaimedAt())
                .completedAt(task.getCompletedAt())
                .evidenceImageUrl(task.getEvidenceImageUrl())
                .receiptStatus(task.getReceiptStatus())
                .receiptDisputeReason(task.getReceiptDisputeReason())
                .receiptRound(task.getReceiptRound())
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
                .overstayFee(overstayFee)
                .totalPenaltyFee(totalPenaltyFee)
                .lateFeeWaived(lateFeeWaived)
                .overstayFeeWaived(overstayFeeWaived)
                .usedMonths(usedMonths)
                .cycleMonths(cycleMonths)
                .baseMonthlyPrice(baseMonthlyPrice)
                .refundBreakdownNote(refundBreakdownNote)
                .supportRequestId(task.getSupportRequestId())
                .ticketCode(sr != null ? sr.getTicketCode() : null)
                .issueType(sr != null ? sr.getIssueType() : null)
                .subCategory(sr != null ? sr.getSubCategory() : null)
                .urgent(urgent)
                .ticketStatus(sr != null ? sr.getStatus() : null)
                .ticketDescription(sr != null ? sr.getDescription() : null)
                .ticketEvidenceImages(sr != null && sr.getEvidenceImages() != null && !sr.getEvidenceImages().isBlank()
                        ? Arrays.stream(sr.getEvidenceImages().split("\n\\|\\|\\|\n")).map(String::trim).filter(s -> !s.isEmpty()).toList()
                        : Collections.emptyList())
                .resolutionImages(task.getEvidenceImageUrl() != null && !task.getEvidenceImageUrl().isBlank()
                        ? Arrays.stream(task.getEvidenceImageUrl().split("\n\\|\\|\\|\n")).map(String::trim).filter(s -> !s.isEmpty()).toList()
                        : Collections.emptyList())
                .resolutionNote(sr != null ? sr.getResolutionNote() : null)
                .ticketCreatedAt(sr != null ? sr.getCreatedAt() : null)
                .ticketResolvedAt(sr != null ? sr.getResolvedAt() : null)
                .ticketClosedAt(sr != null ? sr.getClosedAt() : null)
                .claim(sr != null && CompensationClaimService.isClaimIssue(sr.getIssueType()) && compensationClaimService != null
                        ? compensationClaimService.byTicketIds(List.of(sr.getId())).get(sr.getId()) : null)
                .goodsCategories(contract != null && contract.getReservation() != null && operationsCatalogService != null
                        ? operationsCatalogService.goodsLabels(contract.getReservation().getGoodsCategoryCodes()) : null)
                .goodsDescription(contract != null && contract.getReservation() != null
                        ? contract.getReservation().getGoodsDescription() : null)
                .declaredGoodsValue(contract != null && contract.getReservation() != null
                        ? contract.getReservation().getDeclaredGoodsValue() : null)
                .goodsValueEvidenceImages(contract != null && contract.getReservation() != null
                        ? parseEvidenceImages(contract.getReservation().getGoodsValueEvidenceImages()) : Collections.emptyList())
                // D-23 / PR-O30: task hoàn tiền trả kho tách hoàn cọc + tiền thuê / bồi thường từng hồ sơ
                .settlementRefund(settlementRefund)
                .escalatedMaintenanceTaskId(escalatedMaintId)
                .build();
    }

    private HandoverRecordResponse toHandoverResponse(HandoverRecord record) {
        User staff = record.getStaff();
        RentalContract contract = record.getContract();
        return HandoverRecordResponse.builder()
                .id(record.getId())
                .recordType(record.getRecordType())
                .identityVerified(record.getIdentityVerified())
                .unitEmpty(record.getUnitEmpty())
                .unitClean(record.getUnitClean())
                .lockIntact(record.getLockIntact())
                .customerSignatureConfirmed(record.getCustomerSignatureConfirmed())
                .prohibitedGoodsCommitted(record.getProhibitedGoodsCommitted())
                .goodsValueVerified(record.getGoodsValueVerified())
                .goodsValueAssessment(record.getGoodsValueAssessment())
                .assessedGoodsValue(record.getAssessedGoodsValue())
                .goodsValueAssessmentNote(record.getGoodsValueAssessmentNote())
                .notes(record.getNotes())
                .staffId(staff != null ? staff.getId() : null)
                .staffName(staff != null ? staff.getFullName() : "Khách tự check-in online")
                .createdAt(record.getCreatedAt())
                .evidenceImages(parseEvidenceImages(record.getEvidenceImageUrls()))
                .checkInMethod(record.getCheckInMethod())
                .contractCode(contract != null ? contract.getContractCode() : null)
                .build();
    }

    // BR-121: khách / Staff / FM xem lại mọi biên bản bàn giao của 1 hợp đồng (quyền đã kiểm tra ở controller)
    @Transactional(readOnly = true)
    public List<HandoverRecordResponse> getHandoverRecords(Integer contractId) {
        return handoverRecordRepository.findByContractIdOrderByIdAsc(contractId).stream()
                .filter(record -> "CHECK_IN".equals(record.getRecordType()) || "CHECK_OUT".equals(record.getRecordType()))
                .map(this::toHandoverResponse)
                .toList();
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

        // PR-X3, PR-A10 (08/11/2026): mã liên hệ để xét No-Show
        //  [CONTACT][REFUSED] khách từ chối tới nhận kho → FM xử lý No-Show được ngay
        //  [CONTACT][FAILED]  không nghe máy / thuê bao / cúp máy → đủ 2 lần + qua 48h mới xử lý
        //  [CONTACT][SUCCESS] liên lạc được (dời lịch, hẹn đến...)
        String outcomeLower = outcome.toLowerCase();
        boolean isRefused = outcomeLower.contains("từ chối") || outcomeLower.contains("xin hủy") || outcomeLower.contains("xin huỷ");
        boolean isFailed = outcomeLower.contains("không nghe máy") || outcomeLower.contains("thuê bao")
                || outcomeLower.contains("cúp máy") || outcomeLower.contains("thất bại");
        String contactTag = isRefused ? "[CONTACT][REFUSED]" : isFailed ? "[CONTACT][FAILED]" : "[CONTACT][SUCCESS]";

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
        // D-22 / PR-O26: task mở lại vì khách báo "Chưa nhận được" → FM xử lý phản hồi, không chi lại khoản cũ
        boolean reopened = StaffTask.RECEIPT_DISPUTED.equals(task.getReceiptStatus());

        String method = (request.getPaymentMethod() != null && !request.getPaymentMethod().isBlank())
                ? request.getPaymentMethod().trim().toUpperCase()
                : detectRefundMethodFromNote(task.getNote());

        String extraNote = request.getNote() != null && !request.getNote().isBlank()
                ? request.getNote().trim()
                : (request.getNotes() != null ? request.getNotes().trim() : "");

        String resolution = null;
        BigDecimal additional = BigDecimal.ZERO;
        if (reopened) {
            resolution = request.getResolution() != null && !request.getResolution().isBlank()
                    ? request.getResolution().trim().toUpperCase() : "VERIFIED";
            if (!List.of("VERIFIED", "ADDITIONAL").contains(resolution)) {
                throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_INPUT",
                        "Chọn cách xử lý: VERIFIED (giao dịch đúng) hoặc ADDITIONAL (chuyển bổ sung)");
            }
            if (extraNote.length() < 10) {
                throw new StaffTaskException(HttpStatus.BAD_REQUEST, "REFUND_NOTE_REQUIRED",
                        "Ghi giải thích gửi khách (tối thiểu 10 ký tự)");
            }
            if ("ADDITIONAL".equals(resolution)) {
                additional = request.getAdditionalAmount() != null ? request.getAdditionalAmount() : BigDecimal.ZERO;
                if (additional.signum() <= 0) {
                    throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Nhập số tiền chuyển bổ sung lớn hơn 0");
                }
            }
        }

        // PR-O15: Bắt buộc bằng chứng hoàn tiền (chấp nhận cả khi upload ảnh chứng từ trên trang chi tiết)
        boolean hasEvidenceImg = request.getEvidenceImageUrl() != null && !request.getEvidenceImageUrl().isBlank();
        boolean evidenceOptional = reopened && "VERIFIED".equals(resolution);
        String ftCode = request.getBankTransactionCode() != null ? request.getBankTransactionCode().trim() : "";
        if (ftCode.isEmpty() && !extraNote.isEmpty() && !reopened) {
            ftCode = extraNote;
        }

        if ("CASH".equals(method)) {
            // D-22 / PR-O27: tiền mặt tại quầy → bắt buộc ảnh phiếu chi có chữ ký nhận tiền của khách (thay dấu tick)
            if (!hasEvidenceImg && !evidenceOptional) {
                throw new StaffTaskException(HttpStatus.BAD_REQUEST, "REFUND_EVIDENCE_REQUIRED",
                        "Bắt buộc tải ảnh phiếu chi có chữ ký nhận tiền của khách");
            }
            if (ftCode.isEmpty()) {
                ftCode = "CASH-" + task.getId();
            }
        } else {
            if (!hasEvidenceImg && !evidenceOptional) {
                throw new StaffTaskException(HttpStatus.BAD_REQUEST, "REFUND_EVIDENCE_REQUIRED",
                        "Bắt buộc tải ảnh biên lai khi hoàn tiền qua chuyển khoản");
            }
            if (ftCode.isEmpty()) {
                ftCode = "UNC-IMAGE";
            }
        }

        // Số tiền chi lần này (đọc trước khi chuyển giao dịch sang SUCCESS)
        BigDecimal pendingAmount = reopened ? BigDecimal.ZERO : pendingRefundAmount(task);

        LocalDateTime now = LocalDateTime.now();
        task.setStatus("COMPLETED");
        task.setCompletedAt(now);
        if (task.getStaff() == null) {
            task.setStaff(manager);
            task.setClaimedAt(now);
        }

        if (hasEvidenceImg) {
            task.setEvidenceImageUrl(request.getEvidenceImageUrl().trim());
        }

        String additionalText = additional.setScale(0, RoundingMode.HALF_UP).toPlainString() + "đ";
        String currentNote = task.getNote() != null ? task.getNote() : "";
        StringBuilder appendNote = new StringBuilder();
        if (reopened) {
            appendNote.append(" | [XỬ LÝ KHÁCH BÁO CHƯA NHẬN: ")
                    .append("ADDITIONAL".equals(resolution) ? "chuyển bổ sung " + additionalText : "giao dịch đúng")
                    .append("]");
        } else if ("CASH".equals(method)) {
            appendNote.append(" | [ĐÃ HOÀN TIỀN MẶT - Khách đã ký nhận]");
        } else {
            appendNote.append(" | [ĐÃ HOÀN TIỀN CK - Mã FT: ").append(ftCode).append("]");
        }
        if (!extraNote.isEmpty()) {
            appendNote.append(" - ").append(extraNote);
        }
        String fullNote = currentNote + appendNote;
        if (fullNote.length() > 1000) {
            fullNote = fullNote.substring(0, 997) + "...";
        }
        task.setNote(fullNote);

        // D-22 / PR-O25 → PR-O27: trạng thái khách xác nhận đã nhận tiền
        Integer customerId = resolveRefundCustomerId(task);
        BigDecimal amount = reopened
                ? (task.getRefundAmount() != null ? task.getRefundAmount() : BigDecimal.ZERO).add(additional)
                : pendingAmount;
        task.setCustomerId(customerId);
        task.setRefundAmount(amount);
        task.setReceiptRound((task.getReceiptRound() != null ? task.getReceiptRound() : 0) + 1);
        task.setReceiptAutoConfirmed(false);
        task.setReceiptConfirmedAt(null);
        if (customerId == null) {
            task.setReceiptStatus(null); // không xác định được khách (dữ liệu cũ) → không hỏi khách
        } else if (!reopened && amount.signum() == 0) {
            task.setReceiptStatus(StaffTask.RECEIPT_AUTO_CONFIRMED); // hoàn 0đ (PR-O11): chỉ đóng hồ sơ
            task.setReceiptAutoConfirmed(true);
            task.setReceiptConfirmedAt(now);
        } else if ("CASH".equals(method) && hasEvidenceImg && !reopened) {
            task.setReceiptStatus(StaffTask.RECEIPT_CONFIRMED); // phiếu chi có chữ ký khách = khách đã nhận
            task.setReceiptConfirmedAt(now);
        } else {
            task.setReceiptStatus(StaffTask.RECEIPT_WAITING);
        }
        staffTaskRepository.save(task);

        if (!reopened) {
            // Chỉ chuyển SUCCESS đúng giao dịch REFUND của task này (BUG-06 / K08: trước đây task không gắn HĐ
            // update MỌI REFUND PENDING của cả cơ sở → đơn khác chưa được hoàn cũng thành "đã hoàn")
            markRefundTransactionsSucceeded(task, method, ftCode);

            // D-21 / PR-O20: task hoàn của quyết toán trả kho → tiền bồi thường gộp trong task + hồ sơ chuyển PAID
            if (settlementService != null) settlementService.onRefundCompleted(task, method,
                    hasEvidenceImg ? request.getEvidenceImageUrl().trim() : null, ftCode, managerId);
        } else {
            if (additional.signum() > 0) {
                insertAdditionalRefund(task, customerId, method, additional, ftCode);
            }
            // D-23 / PR-O29: xử lý lại "Chưa nhận được" → quyết toán quay về chờ khách xác nhận đã nhận
            if (settlementService != null) settlementService.syncWithRefundTask(task, managerId);
        }

        // BR-111 / BR-117: khách nhận thông báo + email đã hoàn tiền (kèm yêu cầu xác nhận — PR-O25)
        String how = "CASH".equals(method)
                ? "Quản lý cơ sở đã hoàn tiền mặt tại quầy."
                : "Quản lý cơ sở đã chuyển khoản hoàn tiền (mã giao dịch " + ftCode + ").";
        if (reopened) {
            how = "Quản lý cơ sở đã xử lý phản hồi \"Chưa nhận được\" của bạn: "
                    + ("ADDITIONAL".equals(resolution) ? "đã chuyển bổ sung " + additionalText + ". " : "giao dịch đã chuyển đúng. ")
                    + extraNote;
        }
        if (StaffTask.RECEIPT_WAITING.equals(task.getReceiptStatus())) {
            how += " Vui lòng vào Kho của tôi (hoặc mục Thanh toán) bấm \"Đã nhận được\" hoặc \"Chưa nhận được\" (tự xác nhận sau "
                    + RefundReceiptService.AUTO_CONFIRM_DAYS + " ngày).";
        }
        notifyCustomerRefunded(task, how);

        // Ghi activity log (PR-A8, PR-A9)
        try {
            String logAction = (reopened ? "[REFUND_RECHECK] " : "[REFUND] ") + "Quản lý " + manager.getFullName()
                    + " xác nhận hoàn tất hoàn tiền task #" + task.getId()
                    + " (Phương thức: " + ("CASH".equals(method) ? "Tiền mặt" : "Chuyển khoản " + ftCode) + ")"
                    + (reopened ? " — " + ("ADDITIONAL".equals(resolution) ? "chuyển bổ sung " + additionalText : "giao dịch đúng") : "");
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

    // D-22: tổng tiền sẽ chi cho khách của task REFUND (giao dịch REFUND PENDING cùng tiêu chí markRefundTransactionsSucceeded,
    // cộng tiền bồi thường PENDING gộp trong task hoàn của quyết toán trả kho)
    BigDecimal pendingRefundAmount(StaffTask task) {
        String note = task.getNote() != null ? task.getNote() : "";
        try {
            Matcher lateRef = REFUND_ORIGINAL_REF.matcher(note);
            if (lateRef.find()) {
                return jdbcTemplate.queryForObject(
                        "SELECT COALESCE(SUM(amount), 0) FROM payment_transactions WHERE payment_type = 'REFUND' AND status = 'PENDING' AND transaction_code = ?",
                        BigDecimal.class, "REF-LATE-" + lateRef.group(1));
            }
            if (task.getContract() != null) {
                return jdbcTemplate.queryForObject(
                        "SELECT COALESCE(SUM(amount), 0) FROM payment_transactions WHERE contract_id = ? AND status = 'PENDING' " +
                                "AND ((payment_type = 'REFUND' AND transaction_code NOT LIKE 'REF-LATE-%') OR payment_type = 'COMPENSATION')",
                        BigDecimal.class, task.getContract().getId());
            }
            Matcher reservationCode = REFUND_RESERVATION_CODE.matcher(note);
            if (reservationCode.find()) {
                return jdbcTemplate.queryForObject(
                        "SELECT COALESCE(SUM(amount), 0) FROM payment_transactions WHERE payment_type = 'REFUND' AND status = 'PENDING' " +
                                "AND transaction_code NOT LIKE 'REF-LATE-%' AND reservation_id = (SELECT id FROM reservations WHERE reservation_code = ?)",
                        BigDecimal.class, reservationCode.group(1));
            }
        } catch (Exception ignored) {
        }
        return BigDecimal.ZERO;
    }

    // D-22: khách nhận tiền của task REFUND — qua hợp đồng, mã đơn trong ghi chú (huỷ đơn) hoặc giao dịch gốc (IPN về muộn)
    Integer resolveRefundCustomerId(StaffTask task) {
        if (task.getCustomerId() != null) return task.getCustomerId();
        try {
            if (task.getContract() != null && task.getContract().getCustomer() != null) {
                return task.getContract().getCustomer().getId();
            }
            String note = task.getNote() != null ? task.getNote() : "";
            Matcher reservationCode = REFUND_RESERVATION_CODE.matcher(note);
            if (reservationCode.find()) {
                List<Integer> ids = jdbcTemplate.queryForList(
                        "SELECT TOP 1 customer_id FROM reservations WHERE reservation_code = ?", Integer.class, reservationCode.group(1));
                if (!ids.isEmpty()) return ids.get(0);
            }
            Matcher lateRef = REFUND_ORIGINAL_REF.matcher(note);
            if (lateRef.find()) {
                List<Integer> ids = jdbcTemplate.queryForList(
                        "SELECT TOP 1 user_id FROM payment_transactions WHERE transaction_code = ?", Integer.class, lateRef.group(1));
                if (!ids.isEmpty()) return ids.get(0);
            }
        } catch (Exception ignored) {
        }
        return null;
    }

    // D-22 / PR-O26: FM chuyển bổ sung khi khách báo thiếu tiền → 1 giao dịch REFUND SUCCESS mới
    private void insertAdditionalRefund(StaffTask task, Integer customerId, String method, BigDecimal amount, String ftCode) {
        Integer contractId = task.getContract() != null ? task.getContract().getId() : null;
        Integer reservationId = task.getContract() != null && task.getContract().getReservation() != null
                ? task.getContract().getReservation().getId() : null;
        if (reservationId == null) {
            Matcher reservationCode = REFUND_RESERVATION_CODE.matcher(task.getNote() != null ? task.getNote() : "");
            if (reservationCode.find()) {
                List<Integer> ids = jdbcTemplate.queryForList(
                        "SELECT TOP 1 id FROM reservations WHERE reservation_code = ?", Integer.class, reservationCode.group(1));
                if (!ids.isEmpty()) reservationId = ids.get(0);
            }
        }
        jdbcTemplate.update(
                "INSERT INTO payment_transactions (transaction_code, user_id, reservation_id, contract_id, payment_type, " +
                        "payment_method, amount, status, paid_at, bank_transaction_code) VALUES (?, ?, ?, ?, 'REFUND', ?, ?, 'SUCCESS', SYSDATETIME(), ?)",
                "REF-ADD-" + task.getId() + "-" + task.getReceiptRound() + "-" + (System.currentTimeMillis() % 100000),
                customerId, reservationId, contractId, method, amount.setScale(0, RoundingMode.HALF_UP), ftCode);
    }




    private static final java.util.regex.Pattern REFUND_ORIGINAL_REF = java.util.regex.Pattern.compile("Mã gốc:\\s*([A-Za-z0-9_-]+)");
    private static final java.util.regex.Pattern REFUND_RESERVATION_CODE = java.util.regex.Pattern.compile("Đơn:\\s*([A-Za-z0-9_-]+)");

    // Khách của task REFUND: qua hợp đồng (trả kho, thanh lý, No-Show) hoặc mã đơn trong note (huỷ đơn)
    private void notifyCustomerRefunded(StaffTask task, String detail) {
        if (notificationService == null) return;
        Integer customerId = null;
        Integer reservationId = null;
        String code = null;
        if (task.getContract() != null && task.getContract().getCustomer() != null) {
            customerId = task.getContract().getCustomer().getId();
            reservationId = task.getContract().getReservation() != null ? task.getContract().getReservation().getId() : null;
            code = task.getContract().getContractCode();
        } else {
            java.util.regex.Matcher m = REFUND_RESERVATION_CODE.matcher(task.getNote() != null ? task.getNote() : "");
            if (m.find()) {
                List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                        "SELECT TOP 1 id, customer_id FROM reservations WHERE reservation_code = ?", m.group(1));
                if (!rows.isEmpty()) {
                    customerId = ((Number) rows.get(0).get("customer_id")).intValue();
                    code = m.group(1);
                }
            }
        }
        if (customerId == null) return;
        notificationService.notifyCustomer(
                customerId,
                "Đã hoàn tiền" + (code != null ? " — " + code : ""),
                detail,
                "REFUND",
                // PR-O32: đơn huỷ chưa có hợp đồng → mở Kho của tôi, tô sáng đúng đơn (có nút xác nhận nhận tiền)
                reservationId != null ? "/kho-cua-toi/hop-dong/" + reservationId
                        : (code != null ? "/kho-cua-toi?highlightCode=" + code : "/kho-cua-toi"));
    }

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

    int markRefundTransactionsSucceeded(StaffTask task, String method, String bankTranCode) {
        if (bankTranCode == null || bankTranCode.isBlank()) {
            return markRefundTransactionsSucceeded(task, method);
        }
        String note = task.getNote() != null ? task.getNote() : "";
        java.util.regex.Matcher lateRef = REFUND_ORIGINAL_REF.matcher(note);
        if (lateRef.find()) {
            return jdbcTemplate.update(
                    "UPDATE payment_transactions SET status = 'SUCCESS', payment_method = ?, paid_at = SYSDATETIME(), bank_transaction_code = ? " +
                            "WHERE payment_type = 'REFUND' AND status = 'PENDING' AND transaction_code = ?",
                    method, bankTranCode, "REF-LATE-" + lateRef.group(1));
        }
        if (task.getContract() != null) {
            return jdbcTemplate.update(
                    "UPDATE payment_transactions SET status = 'SUCCESS', payment_method = ?, paid_at = SYSDATETIME(), bank_transaction_code = ? " +
                            "WHERE payment_type = 'REFUND' AND status = 'PENDING' AND contract_id = ? " +
                            "AND transaction_code NOT LIKE 'REF-LATE-%'",
                    method, bankTranCode, task.getContract().getId());
        }
        java.util.regex.Matcher reservationCode = REFUND_RESERVATION_CODE.matcher(note);
        if (reservationCode.find()) {
            try {
                jdbcTemplate.update("UPDATE reservations SET status = 'REFUNDED' WHERE reservation_code = ?", reservationCode.group(1));
            } catch (Exception ignored) {
            }
            return jdbcTemplate.update(
                    "UPDATE payment_transactions SET status = 'SUCCESS', payment_method = ?, paid_at = SYSDATETIME(), bank_transaction_code = ? " +
                            "WHERE payment_type = 'REFUND' AND status = 'PENDING' AND transaction_code NOT LIKE 'REF-LATE-%' " +
                            "AND reservation_id = (SELECT id FROM reservations WHERE reservation_code = ?)",
                    method, bankTranCode, reservationCode.group(1));
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

    record EarlyReturn(int usedMonths, BigDecimal breakFee, BigDecimal refund) {}

    /**
     * PR-O2 (D-10) trả kho sớm, tính trong KỲ HIỆN TẠI (PR-O2c: kỳ gia hạn gần nhất, chưa gia hạn thì từ ngày bắt đầu HĐ):
     *  - Số tháng đã dùng = từ đầu kỳ đến ngày nghiệm thu, làm tròn LÊN, tối thiểu 1.
     *  - PR-O2a: đang ở tháng cuối của kỳ (đã dùng = số tháng của kỳ) → không hoàn tiền thuê, KHÔNG thu phí phá HĐ.
     *  - Còn lại: hoàn = tiền thuê kỳ đã trả − đã dùng × giá niêm yết − phí phá HĐ (1 tháng giá niêm yết), tối thiểu 0.
     */
    static EarlyReturn earlyReturn(LocalDate periodStart, int periodMonths, LocalDate actualDate,
                                   BigDecimal baseMonthlyPrice, BigDecimal rentPaid) {
        int usedMonths = 1;
        if (actualDate.isAfter(periodStart)) {
            Period period = Period.between(periodStart, actualDate);
            int m = period.getYears() * 12 + period.getMonths() + (period.getDays() > 0 ? 1 : 0);
            usedMonths = Math.max(1, m);
        }
        if (usedMonths >= periodMonths) {
            return new EarlyReturn(periodMonths, BigDecimal.ZERO, BigDecimal.ZERO);
        }
        BigDecimal usedCost = baseMonthlyPrice.multiply(BigDecimal.valueOf(usedMonths));
        BigDecimal refund = rentPaid.subtract(usedCost).subtract(baseMonthlyPrice).max(BigDecimal.ZERO);
        return new EarlyReturn(usedMonths, baseMonthlyPrice, refund);
    }

    /**
     * BR-127: chấm dứt hợp đồng do lỗi cơ sở (hồ sơ bồi thường chọn TERMINATE) → không phí phá HĐ,
     * hoàn tiền thuê kỳ hiện tại theo số NGÀY còn lại (giữ nguyên ưu đãi đã hưởng, gồm cả phí bảo hiểm các ngày chưa dùng).
     */
    static EarlyReturn faultTerminationReturn(LocalDate periodStart, LocalDate periodEnd, LocalDate actualDate, BigDecimal rentPaid) {
        long totalDays = Math.max(1, ChronoUnit.DAYS.between(periodStart, periodEnd));
        long remainingDays = Math.max(0, ChronoUnit.DAYS.between(actualDate, periodEnd));
        BigDecimal refund = rentPaid.multiply(BigDecimal.valueOf(remainingDays))
                .divide(BigDecimal.valueOf(totalDays), 0, RoundingMode.HALF_UP);
        long usedDays = totalDays - Math.min(totalDays, remainingDays);
        int usedMonths = (int) Math.max(1, (usedDays + 29) / 30);
        return new EarlyReturn(usedMonths, BigDecimal.ZERO, refund.max(BigDecimal.ZERO));
    }

    public RefundCalculationResult calculateCheckoutRefund(RentalContract contract, LocalDate actualCheckoutDate, BigDecimal totalDamageCost) {
        if (totalDamageCost == null) {
            totalDamageCost = BigDecimal.ZERO;
        }

        // BR-140: giá theo loại kho khách đã đặt — ô khẩn cấp đang tạm ở có thể khác loại
        BigDecimal baseMonthlyPrice = PricingService.contractMonthlyPrice(contract);

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

        // PR-O2c (sửa 22/11/2026 — PR-O2d): các kỳ đã trả = kỳ gốc + từng lần gia hạn, xếp lùi từ end_date.
        // Kỳ hiện tại là kỳ CHỨA ngày trả kho → tính trả sớm PR-O2 trong kỳ đó. Kỳ gia hạn CHƯA bắt đầu được hoàn đủ
        // (gồm bảo hiểm), không thu phí phá HĐ. Trước đây luôn coi kỳ gia hạn gần nhất là kỳ hiện tại → khách gia hạn rồi
        // trả kho ngay trong kỳ gốc bị mất cả tiền thuê kỳ gốc lẫn tiền gia hạn.
        LocalDate periodStart = startDate;
        int periodMonths = cycleMonths;
        BigDecimal futurePaid = BigDecimal.ZERO;
        int futureMonths = 0;
        LocalDate futureStart = null;
        try {
            List<Map<String, Object>> renewals = jdbcTemplate.queryForList(
                    "SELECT amount, renewal_months FROM payment_transactions WHERE contract_id = ? " +
                            "AND payment_type = 'MONTHLY_RENT' AND status = 'SUCCESS' AND renewal_months > 0 ORDER BY id DESC",
                    contract.getId());
            BigDecimal renewalsTotal = BigDecimal.ZERO;
            for (Map<String, Object> r : renewals) {
                if (r.get("amount") instanceof BigDecimal a) renewalsTotal = renewalsTotal.add(a);
            }
            LocalDate cursor = endDate;
            boolean currentIsRenewal = false;
            for (Map<String, Object> r : renewals) {
                int m = r.get("renewal_months") instanceof Number n ? n.intValue() : 0;
                BigDecimal amount = r.get("amount") instanceof BigDecimal a ? a : BigDecimal.ZERO;
                if (m <= 0) continue;
                LocalDate start = cursor.minusMonths(m);
                if (!actualDate.isAfter(start)) {
                    // kỳ gia hạn chưa bắt đầu tại ngày trả kho
                    futurePaid = futurePaid.add(amount);
                    futureMonths += m;
                    futureStart = start;
                    cursor = start;
                    continue;
                }
                periodStart = start;
                periodMonths = m;
                rentPaid = amount;
                currentIsRenewal = true;
                break;
            }
            if (!currentIsRenewal) {
                // Kỳ gốc: tiền đã đóng lúc đặt (DEPOSIT + MONTHLY_RENT không phải gia hạn) − cọc
                if (!renewals.isEmpty()) {
                    periodMonths = Math.max(resMonths, billMonths);
                    periodStart = cursor.minusMonths(periodMonths);
                }
                Integer resId = contract.getReservation() != null ? contract.getReservation().getId() : -1;
                BigDecimal totalPaid = jdbcTemplate.queryForObject(
                        "SELECT COALESCE(SUM(amount), 0) FROM payment_transactions " +
                                "WHERE (contract_id = ? OR reservation_id = ?) AND status = 'SUCCESS' AND payment_type IN ('DEPOSIT', 'MONTHLY_RENT')",
                        BigDecimal.class, contract.getId(), resId);
                BigDecimal originalRent = totalPaid != null ? totalPaid.subtract(depositHeld).subtract(renewalsTotal) : BigDecimal.ZERO;
                if (originalRent.compareTo(BigDecimal.ZERO) > 0) {
                    rentPaid = originalRent;
                }
            }
        } catch (Exception ignored) {
        }
        LocalDate periodEnd = periodStart.plusMonths(periodMonths);

        // D-22: tách tiền thuê kỳ hiện tại và phí bảo hiểm (BR-125) để bảng "Đã đóng" khớp màn hợp đồng
        BigDecimal insurancePaid = PricingService.insurancePremiumMonthly(contract)
                .multiply(BigDecimal.valueOf(periodMonths)).min(rentPaid.max(BigDecimal.ZERO));
        BigDecimal rentPaidNet = rentPaid.subtract(insurancePaid).max(BigDecimal.ZERO);

        // 1. Kiểm tra Trả sớm (PR-O2, D-10): ngày nghiệm thu < endDate
        boolean isEarlyCheckout = actualDate.isBefore(endDate);
        int usedMonths = 0;
        BigDecimal breakFee = BigDecimal.ZERO;
        BigDecimal earlyRentRefund = BigDecimal.ZERO;

        if (isEarlyCheckout && Boolean.TRUE.equals(contract.getFaultTermination())) {
            EarlyReturn early = faultTerminationReturn(periodStart, periodEnd.isAfter(endDate) ? endDate : periodEnd, actualDate, rentPaid);
            usedMonths = early.usedMonths();
            breakFee = BigDecimal.ZERO;
            earlyRentRefund = early.refund();
        } else if (isEarlyCheckout) {
            // BR-125: phí bảo hiểm không hoàn khi khách tự trả sớm — trừ ra khỏi tiền thuê kỳ đã trả trước khi áp PR-O2
            BigDecimal premiumPaid = PricingService.insurancePremiumMonthly(contract).multiply(BigDecimal.valueOf(periodMonths));
            rentPaid = rentPaid.subtract(premiumPaid).max(BigDecimal.ZERO);
            EarlyReturn early = earlyReturn(periodStart, periodMonths, actualDate, baseMonthlyPrice, rentPaid);
            usedMonths = early.usedMonths();
            breakFee = early.breakFee();
            earlyRentRefund = early.refund();
        }
        // PR-O2d: cộng tiền các kỳ gia hạn chưa bắt đầu (hoàn đủ)
        if (isEarlyCheckout && futurePaid.signum() > 0) {
            earlyRentRefund = earlyRentRefund.add(futurePaid);
        }

        // 2. Kiểm tra Ân hạn (PR-O14, D-11) & Phí trễ hạn (PR-Q3): ngày nghiệm thu > endDate
        boolean overdueOrGrace = actualDate.isAfter(endDate);
        long daysPast = 0;
        BigDecimal graceFee = BigDecimal.ZERO;
        BigDecimal lateFee = BigDecimal.ZERO;
        BigDecimal overstayFee = BigDecimal.ZERO;

        if (overdueOrGrace) {
            daysPast = ChronoUnit.DAYS.between(endDate, actualDate);
            // (sửa 12/11/2026) D-15 đã bỏ ân hạn → mọi ngày sau end_date: phí trễ PR-Q3 theo chính sách gắn HĐ
            // (tỉ lệ / ngày, trần 50% cọc, = 0 nếu FM / BOM đã miễn) + phí chiếm dụng PR-Q14 (100% nếu đã miễn phí trễ,
            // 0 nếu miễn luôn phí chiếm dụng). Trước đây tính cứng 10%/ngày và bỏ qua cờ miễn phí trễ.
            LateFeeCalculationResult late = lateFeeService.calculateLateFee(contract, actualDate);
            if (late != null && late.getLateFeeAmount() != null) {
                lateFee = late.getLateFeeAmount();
            } else if (!Boolean.TRUE.equals(contract.getLateFeeWaived())) {
                long billableDays = Math.min(daysPast, 5);
                lateFee = depositHeld.multiply(new BigDecimal("0.10").multiply(BigDecimal.valueOf(billableDays)))
                        .setScale(0, RoundingMode.HALF_UP);
            }
            BigDecimal fee = lateFeeService.overstayFee(contract, daysPast);
            overstayFee = fee != null ? fee : BigDecimal.ZERO;
        }

        // 3. Quyết toán hoàn cọc (PR-O11): cọc trừ lần lượt sự cố → phí ân hạn / phí trễ → phí chiếm dụng.
        // Phí trễ không bao giờ vượt cọc (PR-Q3); sự cố và phí chiếm dụng vượt cọc thì thành khoản nợ.
        BigDecimal remainingDeposit = depositHeld;
        BigDecimal damageOffset = totalDamageCost.min(remainingDeposit);
        remainingDeposit = remainingDeposit.subtract(damageOffset);
        BigDecimal feeOffset = graceFee.add(lateFee).min(remainingDeposit);
        remainingDeposit = remainingDeposit.subtract(feeOffset);
        BigDecimal overstayOffset = overstayFee.min(remainingDeposit);
        remainingDeposit = remainingDeposit.subtract(overstayOffset);
        BigDecimal depositRefund = remainingDeposit;
        BigDecimal damageDebt = totalDamageCost.subtract(damageOffset);
        BigDecimal overstayDebt = overstayFee.subtract(overstayOffset);
        BigDecimal excessDebt = damageDebt.add(overstayDebt);

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
        if (overstayFee.compareTo(BigDecimal.ZERO) > 0) {
            desc.append(" - Phí chiếm dụng ").append(daysPast).append(" ngày: ").append(vndFmt.format(overstayFee)).append("đ");
        }
        if (overdueOrGrace && Boolean.TRUE.equals(contract.getLateFeeWaived())) {
            desc.append(Boolean.TRUE.equals(contract.getOverstayFeeWaived())
                    ? " (đã miễn phí trễ và phí chiếm dụng)"
                    : " (đã miễn phí trễ; phí chiếm dụng tính 100% giá ngày)");
        }
        desc.append(" => Cọc hoàn: ").append(vndFmt.format(depositRefund)).append("đ");

        if (futurePaid.signum() > 0) {
            desc.append(" + Hoàn đủ ").append(futureMonths).append("T gia hạn chưa bắt đầu: ")
                    .append(vndFmt.format(futurePaid)).append("đ");
        }
        if (earlyRentRefund.subtract(futurePaid).compareTo(BigDecimal.ZERO) > 0) {
            desc.append(" + Hoàn tiền thuê trả sớm: ").append(vndFmt.format(earlyRentRefund.subtract(futurePaid))).append("đ")
                    .append(" (Đã trả ").append(periodMonths).append("T: ").append(vndFmt.format(rentPaid)).append("đ")
                    .append(" - Đã dùng ").append(usedMonths).append("T: ").append(vndFmt.format(baseMonthlyPrice.multiply(BigDecimal.valueOf(usedMonths)))).append("đ")
                    .append(" - Phí hủy HĐ: ").append(vndFmt.format(breakFee)).append("đ)");
        } else if (isEarlyCheckout && breakFee.compareTo(BigDecimal.ZERO) == 0) {
            desc.append(" (Trả trong tháng cuối của kỳ: không hoàn tiền thuê, không phí phá HĐ — PR-O2a)");
        }

        desc.append(" => THỰC HOÀN ").append(vndFmt.format(totalRefund)).append("đ");

        if (excessDebt.compareTo(BigDecimal.ZERO) > 0) {
            desc.append(" [Nợ vượt cọc cần truy thu: ").append(vndFmt.format(excessDebt)).append("đ]");
        }

        // D-22: bảng "Bạn đã đóng − Cơ sở giữ lại = Hoàn" — dùng chung với bảng quyết toán sau nghiệm thu
        boolean fault = isEarlyCheckout && Boolean.TRUE.equals(contract.getFaultTermination());
        RefundBreakdown.RentBasis rentBasis = new RefundBreakdown.RentBasis(rentPaidNet, insurancePaid, periodMonths,
                periodStart, isEarlyCheckout, fault, usedMonths, baseMonthlyPrice, breakFee, daysPast,
                futurePaid, futureMonths, futureStart);
        List<MoneyLine> lines = RefundBreakdown.lines(depositHeld, rentBasis, earlyRentRefund, totalDamageCost,
                feeOffset, overstayFee, BigDecimal.ZERO);
        RefundBreakdown.Totals totals = RefundBreakdown.totals(lines);

        return RefundCalculationResult.builder()
                .futurePaid(futurePaid)
                .futureMonths(futureMonths)
                .futureStart(futureStart)
                .rentPaidNet(rentPaidNet)
                .insurancePaid(insurancePaid)
                .periodMonths(periodMonths)
                .periodStart(periodStart)
                .faultTermination(fault)
                .lines(lines)
                .paidTotal(totals.paid())
                .keptTotal(totals.kept())
                .netAmount(totals.net())
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
                .overstayFee(overstayFee)
                .damageOffset(damageOffset)
                .feeOffset(feeOffset)
                .overstayOffset(overstayOffset)
                .damageDebtAmount(damageDebt)
                .overstayDebtAmount(overstayDebt)
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
    // BR-111: task vừa quá hạn → báo FM của cơ sở + nhân viên đang giữ task
    @Transactional
    public int markOverdueTasks() {
        LocalDateTime now = LocalDateTime.now();
        List<StaffTask> due = notificationService != null ? staffTaskRepository.findDueForOverdue(now) : List.of();
        int updated = staffTaskRepository.markOverdue(now);
        for (StaffTask t : due) {
            notifyTaskOverdue(t);
        }
        return updated;
    }

    private void notifyTaskOverdue(StaffTask t) {
        String hint = switch (t.getTaskType()) {
            case "SUPPORT", "MAINTENANCE" -> "Bấm \"Gia hạn xử lý\" để đặt hạn mới cho task.";
            case "CHECK_IN" -> "Liên hệ khách để dời lịch nhận kho hoặc xử lý No-Show.";
            case "CHECK_OUT" -> "Khách chưa tới trả kho đúng hẹn — liên hệ khách để hẹn lại.";
            case "REFUND" -> "Hoàn tiền cho khách sớm nhất có thể.";
            default -> "";
        };
        String link = "REFUND".equals(t.getTaskType())
                ? "/manager/refunds?highlightTaskId=" + t.getId()
                : "/manager/tasks?highlightTaskId=" + t.getId();
        String title = "Task #" + t.getId() + " (" + t.getTaskType() + ") đã quá hạn";
        String who = t.getStaff() != null ? " — đang do " + t.getStaff().getFullName() + " giữ" : " — chưa ai nhận";
        notificationService.notifyFacilityManagers(t.getFacilityId(), title,
                "Hạn xử lý " + t.getDueAt().format(TS_FMT) + who + ". " + hint, "TASK", link);
        if (t.getStaff() != null && !"REFUND".equals(t.getTaskType())) {
            notificationService.notifyStaff(t.getStaff().getId(), title,
                    "Task bạn đang giữ đã quá hạn " + t.getDueAt().format(TS_FMT) + ". Báo quản lý cơ sở để được gia hạn.",
                    "TASK", "/staff?highlightTaskId=" + t.getId());
        }
    }
}
