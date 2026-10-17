package com.queenkho.api.service;

import com.queenkho.api.dto.CheckInRequest;
import com.queenkho.api.dto.CheckOutRequest;
import com.queenkho.api.dto.ContactReportRequest;
import com.queenkho.api.dto.DamageCaseResponse;
import com.queenkho.api.dto.HandoverRecordResponse;
import com.queenkho.api.dto.StaffTaskDetailResponse;
import com.queenkho.api.dto.StaffTaskResponse;
import com.queenkho.api.entity.DamageCase;
import com.queenkho.api.entity.HandoverRecord;
import com.queenkho.api.entity.RentalContract;
import com.queenkho.api.entity.StaffTask;
import com.queenkho.api.entity.StorageUnit;
import com.queenkho.api.entity.User;
import com.queenkho.api.exception.StaffTaskException;
import com.queenkho.api.repository.DamageCaseRepository;
import com.queenkho.api.repository.HandoverRecordRepository;
import com.queenkho.api.repository.RentalContractRepository;
import com.queenkho.api.repository.ReservationRepository;
import com.queenkho.api.repository.StaffTaskRepository;
import com.queenkho.api.repository.StorageUnitRepository;
import com.queenkho.api.repository.UserRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import com.queenkho.api.dto.CompleteRefundRequest;
import com.queenkho.api.dto.RefundCalculationResult;
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
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;

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

    @Autowired
    private StaffTaskRepository staffTaskRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RentalContractRepository rentalContractRepository;

    @Autowired
    private HandoverRecordRepository handoverRecordRepository;

    @Autowired
    private DamageCaseRepository damageCaseRepository;

    @Autowired
    private StorageUnitRepository storageUnitRepository;

    @Autowired
    private ReservationRepository reservationRepository;

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
        return staffTaskRepository.findBoard(facilityId, normalizedStatus)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    // Entity → DTO. Không trả thẳng entity ra API vì:
    // (1) quan hệ LAZY sẽ lỗi khi Jackson serialize, (2) lộ field không cần thiết
    // (password của User...)
    private StaffTaskResponse toResponse(StaffTask task) {
        RentalContract contract = task.getContract();
        User staff = task.getStaff();
        StorageUnit unit = contract != null ? contract.getStorageUnit() : null;
        User customer = contract != null ? contract.getCustomer() : null;

        return StaffTaskResponse.builder()
                .id(task.getId())
                .facilityId(task.getFacilityId())
                .taskType(task.getTaskType())
                .status(task.getStatus())
                .dueAt(task.getDueAt())
                .createdAt(task.getCreatedAt())
                .claimedAt(task.getClaimedAt())
                .completedAt(task.getCompletedAt())
                .note(task.getNote())
                .evidenceImageUrl(task.getEvidenceImageUrl())
                .staffId(staff != null ? staff.getId() : null)
                .staffName(staff != null ? staff.getFullName() : null)
                .contractId(contract != null ? contract.getId() : null)
                .contractCode(contract != null ? contract.getContractCode() : null)
                .contractStatus(contract != null ? contract.getStatus() : null)
                .customerName(customer != null ? customer.getFullName() : null)
                .customerPhone(customer != null ? customer.getPhone() : null)
                .storageUnitId(unit != null ? unit.getId() : null)
                .unitTypeName(unit != null && unit.getUnitType() != null ? unit.getUnitType().getName() : null)
                .build();
    }

    // ================== UC-17: NHẬN VIỆC / GỠ NGƯỜI NHẬN ==================

    // UC-17: Staff nhận 1 task OPEN của cơ sở mình
    @Transactional
    public StaffTaskResponse claimTask(Integer taskId, Integer staffId) {
        User staff = findUserWithRole(staffId, "STAFF", "Chỉ nhân viên mới được nhận việc");
        StaffTask task = findTaskInFacility(taskId, staff.getFacilityId());

        int updated = staffTaskRepository.claim(task.getId(), staff, LocalDateTime.now());
        if (updated == 0) {
            // UPDATE không ăn dòng nào → đọc lại để báo đúng lý do
            throw explainClaimFailure(taskId, staffId);
        }
        return toResponse(staffTaskRepository.findById(taskId).orElseThrow());
    }

    // UC-17: Facility Manager gỡ nhân viên khỏi task đang xử lý → task về OPEN
    @Transactional
    public StaffTaskResponse unassignTask(Integer taskId, Integer managerId) {
        User manager = findUserWithRole(managerId, "FACILITY_MANAGER", "Chỉ quản lý cơ sở mới được gỡ người nhận");
        StaffTask task = findTaskInFacility(taskId, manager.getFacilityId());

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
        for (int i = 0; i < PIN_MAX_ATTEMPTS; i++) {
            // %06d: đệm số 0 bên trái → luôn đủ 6 ký tự (vd 42 → "000042")
            String pin = String.format("%06d", RANDOM.nextInt(1_000_000));
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

        // 7. Ghi log (cột action ở QueenKho.sql chỉ 100 ký tự → giữ ngắn). Lỗi log
        // không làm hỏng check-in
        try {
            jdbcTemplate.update(
                    "INSERT INTO activity_logs (user_id, action, target_entity, target_id, created_at) " +
                            "VALUES (?, ?, 'rental_contracts', ?, SYSDATETIME())",
                    staffId,
                    "Check-in HĐ " + contract.getContractCode() + ", ô " + contract.getStorageUnit().getId(),
                    String.valueOf(contract.getId()));
        } catch (Exception e) {
            // bỏ qua lỗi ghi log
        }

        // created_at của biên bản do DB tự điền (insertable = false) nên entity trong
        // cache Hibernate vẫn đang null.
        // flush: đẩy INSERT/UPDATE xuống DB; clear: bỏ cache → lần đọc dưới lấy bản mới
        // từ DB
        entityManager.flush();
        entityManager.clear();
        return toDetailResponse(staffTaskRepository.findDetailById(taskId).orElseThrow());
    }

    private void validateCheckInRequest(CheckInRequest request) {
        if (request == null) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Thiếu nội dung biên bản");
        }
        // Boolean.TRUE.equals: null cũng tính là chưa tick (tránh NullPointerException
        // khi unboxing)
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

        // 5. UC-24: Lưu danh sách sự cố hư hỏng (nếu có) và tính tổng chi phí đền bù
        BigDecimal totalDamageCost = BigDecimal.ZERO;
        List<CheckOutRequest.DamageItemRequest> rawDamages = request.getDamageCases() != null
                ? request.getDamageCases()
                : Collections.emptyList();
        StaffTask taskRef = staffTaskRepository.getReferenceById(taskId);
        List<String> damageSummaryTitles = new ArrayList<>();

        for (CheckOutRequest.DamageItemRequest item : rawDamages) {
            BigDecimal cost = item.getEstimatedCost() != null ? item.getEstimatedCost() : BigDecimal.ZERO;
            totalDamageCost = totalDamageCost.add(cost);
            String titleTrimmed = item.getTitle().trim();
            damageSummaryTitles.add(titleTrimmed);

            DamageCase dc = new DamageCase();
            dc.setContract(contract);
            dc.setTask(taskRef);
            dc.setTitle(titleTrimmed);
            dc.setDescription(item.getDescription() != null && !item.getDescription().isBlank()
                    ? item.getDescription().trim()
                    : null);
            dc.setEstimatedCost(cost);
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

                // Sinh task MAINTENANCE cho cơ sở để theo dõi sửa chữa / vệ sinh
                StaffTask maintTask = new StaffTask();
                maintTask.setFacilityId(task.getFacilityId());
                maintTask.setContract(contract);
                maintTask.setTaskType("MAINTENANCE");
                maintTask.setStatus("OPEN");
                maintTask.setDueAt(computeDueAt(LocalDate.now().plusDays(1)));
                String maintNote = "Khắc phục sự cố sau trả kho ô " + unit.getId()
                        + " (HĐ " + contract.getContractCode() + "): "
                        + String.join(", ", damageSummaryTitles);
                if (maintNote.length() > 1000) {
                    maintNote = maintNote.substring(0, 997) + "...";
                }
                maintTask.setNote(maintNote);
                staffTaskRepository.save(maintTask);
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
        try {
            jdbcTemplate.update(
                    "UPDATE support_requests SET status = 'CLOSED' WHERE contract_id = ? AND status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED')",
                    contract.getId());
            cancelOpenTasks(contract.getId(), "SUPPORT");
        } catch (Exception ignored) {
        }

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
                    + (hasDamage ? " (" + rawDamages.size() + " sự cố, phí " + vndFmt.format(totalDamageCost) + "đ)" : " (Nguyên vẹn)")
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
        RentalContract contract = task.getContract();
        User staff = task.getStaff();
        StorageUnit unit = contract != null ? contract.getStorageUnit() : null;
        User customer = contract != null ? contract.getCustomer() : null;

        // Chỉ task đã hoàn thành mới có biên bản
        HandoverRecordResponse handover = null;
        if (contract != null && "COMPLETED".equals(task.getStatus())) {
            handover = handoverRecordRepository
                    .findFirstByContractIdAndRecordTypeOrderByIdDesc(contract.getId(), task.getTaskType())
                    .map(this::toHandoverResponse)
                    .orElse(null);
        }

        // UC-24: Lấy danh sách sự cố hư hỏng (nếu là task CHECK_OUT)
        List<DamageCaseResponse> damageResponses = Collections.emptyList();
        BigDecimal totalDamageCost = BigDecimal.ZERO;
        if ("CHECK_OUT".equals(task.getTaskType())) {
            List<DamageCase> cases = damageCaseRepository.findByTask_IdOrderByIdAsc(task.getId());
            List<DamageCaseResponse> mapped = new ArrayList<>();
            for (DamageCase dc : cases) {
                BigDecimal cost = dc.getEstimatedCost() != null ? dc.getEstimatedCost() : BigDecimal.ZERO;
                totalDamageCost = totalDamageCost.add(cost);
                mapped.add(DamageCaseResponse.builder()
                        .id(dc.getId())
                        .title(dc.getTitle())
                        .description(dc.getDescription())
                        .estimatedCost(cost)
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
        BigDecimal earlyRentRefund = BigDecimal.ZERO;
        BigDecimal graceFee = BigDecimal.ZERO;
        BigDecimal lateFee = BigDecimal.ZERO;
        Integer usedMonths = null;
        Integer cycleMonths = null;
        BigDecimal baseMonthlyPrice = null;
        String refundBreakdownNote = null;

        if (contract != null && "CHECK_OUT".equals(task.getTaskType())) {
            LocalDate refDate = task.getCompletedAt() != null ? task.getCompletedAt().toLocalDate() : LocalDate.now();
            RefundCalculationResult calc = calculateCheckoutRefund(contract, refDate, totalDamageCost);
            refundAmount = calc.getTotalRefundAmount();
            excessDebtAmount = calc.getExcessDebtAmount();
            depositRefund = calc.getDepositRefund();
            earlyRentRefund = calc.getEarlyRentRefund();
            graceFee = calc.getGraceFee();
            lateFee = calc.getLateFee();
            usedMonths = calc.getUsedMonths();
            cycleMonths = calc.getCycleMonths();
            baseMonthlyPrice = calc.getBaseMonthlyPrice();
            refundBreakdownNote = calc.getBreakdownDescription();
        }

        return StaffTaskDetailResponse.builder()
                .id(task.getId())
                .taskType(task.getTaskType())
                .status(task.getStatus())
                .dueAt(task.getDueAt())
                .createdAt(task.getCreatedAt())
                .claimedAt(task.getClaimedAt())
                .completedAt(task.getCompletedAt())
                .note(task.getNote())
                .staffId(staff != null ? staff.getId() : null)
                .staffName(staff != null ? staff.getFullName() : null)
                .contractId(contract != null ? contract.getId() : null)
                .contractCode(contract != null ? contract.getContractCode() : null)
                .contractStatus(contract != null ? contract.getStatus() : null)
                .contractStartDate(contract != null ? contract.getStartDate() : null)
                .contractEndDate(contract != null ? contract.getEndDate() : null)
                .depositHeldAmount(depositHeld)
                .accessPinCode(contract != null ? contract.getAccessPinCode() : null)
                .rfidCardCode(contract != null ? contract.getRfidCardCode() : null)
                .customerName(customer != null ? customer.getFullName() : null)
                .customerPhone(customer != null ? customer.getPhone() : null)
                .customerEmail(customer != null ? customer.getEmail() : null)
                .customerCccd(customer != null ? customer.getCccd() : null)
                .storageUnitId(unit != null ? unit.getId() : null)
                .storageUnitStatus(unit != null ? unit.getStatus() : null)
                .unitTypeName(unit != null && unit.getUnitType() != null ? unit.getUnitType().getName() : null)
                .facilityName(unit != null && unit.getFacility() != null ? unit.getFacility().getName() : null)
                .handoverRecord(handover)
                .damageCases(damageResponses)
                .totalDamageCost(totalDamageCost)
                .refundAmount(refundAmount)
                .excessDebtAmount(excessDebtAmount)
                .depositRefund(depositRefund)
                .earlyRentRefund(earlyRentRefund)
                .graceFee(graceFee)
                .lateFee(lateFee)
                .usedMonths(usedMonths)
                .cycleMonths(cycleMonths)
                .baseMonthlyPrice(baseMonthlyPrice)
                .refundBreakdownNote(refundBreakdownNote)
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

        // Ghi nhật ký hoạt động
        String logAction = "Nhân viên " + staff.getFullName() + " báo cáo liên hệ task #" + task.getId()
                + ": " + formattedNote;
        if (logAction.length() > 500) logAction = logAction.substring(0, 497) + "...";

        jdbcTemplate.update(
                "INSERT INTO activity_logs (user_id, action, target_entity, target_id, created_at) " +
                        "VALUES (?, ?, 'facility_tasks', ?, SYSDATETIME())",
                staff.getId(),
                logAction,
                task.getId());

        return toResponse(task);
    }

    // Manager hoàn tất task hoàn tiền (REFUND) - Tuân thủ PR-O15 & L-24
    @Transactional
    public StaffTaskResponse completeRefundTask(Integer taskId, Integer managerId, CompleteRefundRequest request) {
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

        String method = (request.getPaymentMethod() != null && !request.getPaymentMethod().isBlank())
                ? request.getPaymentMethod().trim().toUpperCase()
                : "BANK_TRANSFER";

        // PR-O15: Bắt buộc bằng chứng hoàn tiền
        if ("CASH".equals(method)) {
            if (!Boolean.TRUE.equals(request.getCashReceiptConfirmed())) {
                throw new StaffTaskException(HttpStatus.BAD_REQUEST, "REFUND_EVIDENCE_REQUIRED",
                        "Bắt buộc xác nhận khách hàng đã ký nhận tiền mặt tại quầy");
            }
        } else {
            // Mặc định là BANK_TRANSFER: bắt buộc mã FT ngân hàng
            if (request.getBankTransactionCode() == null || request.getBankTransactionCode().isBlank()) {
                throw new StaffTaskException(HttpStatus.BAD_REQUEST, "REFUND_EVIDENCE_REQUIRED",
                        "Bắt buộc nhập mã giao dịch ngân hàng (mã FT) khi hoàn tiền qua chuyển khoản");
            }
        }

        task.setStatus("COMPLETED");
        task.setCompletedAt(LocalDateTime.now());
        if (task.getStaff() == null) {
            task.setStaff(manager);
            task.setClaimedAt(LocalDateTime.now());
        }

        if (request.getEvidenceImageUrl() != null && !request.getEvidenceImageUrl().isBlank()) {
            task.setEvidenceImageUrl(request.getEvidenceImageUrl().trim());
        }

        String currentNote = task.getNote() != null ? task.getNote() : "";
        StringBuilder appendNote = new StringBuilder();
        if ("CASH".equals(method)) {
            appendNote.append(" | [ĐÃ HOÀN TIỀN MẶT - Khách đã ký nhận]");
        } else {
            appendNote.append(" | [ĐÃ HOÀN TIỀN CK - Mã FT: ").append(request.getBankTransactionCode().trim()).append("]");
        }
        if (request.getNote() != null && !request.getNote().isBlank()) {
            appendNote.append(" - ").append(request.getNote().trim());
        }
        String fullNote = currentNote + appendNote.toString();
        if (fullNote.length() > 1000) {
            fullNote = fullNote.substring(0, 997) + "...";
        }
        task.setNote(fullNote);
        staffTaskRepository.save(task);

        // Cập nhật trạng thái payment_transactions sang SUCCESS nếu có giao dịch REFUND đang chờ
        try {
            if (task.getContract() != null) {
                jdbcTemplate.update(
                        "UPDATE payment_transactions SET status = 'SUCCESS', payment_method = ?, paid_at = SYSDATETIME() " +
                                "WHERE payment_type = 'REFUND' AND status = 'PENDING' AND contract_id = ?",
                        method, task.getContract().getId());
            } else {
                jdbcTemplate.update(
                        "UPDATE payment_transactions SET status = 'SUCCESS', payment_method = ?, paid_at = SYSDATETIME() " +
                                "WHERE payment_type = 'REFUND' AND status = 'PENDING' AND reservation_id IN (" +
                                "  SELECT id FROM reservations WHERE facility_id = ?" +
                                ")",
                        method, manager.getFacilityId());
            }
        } catch (Exception ignored) {
        }

        // Ghi activity log (PR-A8, PR-A9)
        try {
            String logAction = "Quản lý " + manager.getFullName() + " xác nhận hoàn tất hoàn tiền task #" + task.getId()
                    + " (Phương thức: " + ("CASH".equals(method) ? "Tiền mặt" : "Chuyển khoản " + request.getBankTransactionCode().trim()) + ")";
            if (logAction.length() > 500) logAction = logAction.substring(0, 497) + "...";
            jdbcTemplate.update(
                    "INSERT INTO activity_logs (user_id, action, target_entity, target_id, created_at) " +
                            "VALUES (?, ?, 'facility_tasks', ?, SYSDATETIME())",
                    manager.getId(),
                    logAction,
                    task.getId());
        } catch (Exception ignored) {
        }

        return toResponse(task);
    }

    // Overload cho backward compatibility
    @Transactional
    public StaffTaskResponse completeRefundTask(Integer taskId, Integer managerId, String note) {
        CompleteRefundRequest req = new CompleteRefundRequest();
        req.setNote(note);
        req.setPaymentMethod("BANK_TRANSFER");
        req.setBankTransactionCode("FT-MANUAL-" + System.currentTimeMillis());
        return completeRefundTask(taskId, managerId, req);
    }

    // ================== HỆ THỐNG TÍNH TOÁN QUYẾT TOÁN HOÀN TIỀN (PR-O2, PR-O11, PR-O14, PR-Q3) ==================

    public RefundCalculationResult calculateCheckoutRefund(RentalContract contract, LocalDate actualCheckoutDate, BigDecimal totalDamageCost) {
        BigDecimal depositHeld = contract.getDepositHeldAmount() != null ? contract.getDepositHeldAmount() : BigDecimal.ZERO;
        if (totalDamageCost == null) {
            totalDamageCost = BigDecimal.ZERO;
        }

        // Lấy đơn giá niêm yết 1 tháng lúc ký
        BigDecimal baseMonthlyPrice = BigDecimal.ZERO;
        if (contract.getStorageUnit() != null && contract.getStorageUnit().getUnitType() != null
                && contract.getStorageUnit().getUnitType().getBasePriceMonthly() != null) {
            baseMonthlyPrice = contract.getStorageUnit().getUnitType().getBasePriceMonthly();
        } else if (contract.getReservation() != null && contract.getReservation().getUnitType() != null
                && contract.getReservation().getUnitType().getBasePriceMonthly() != null) {
            baseMonthlyPrice = contract.getReservation().getUnitType().getBasePriceMonthly();
        }
        if (baseMonthlyPrice.compareTo(BigDecimal.ZERO) <= 0) {
            baseMonthlyPrice = depositHeld;
        }

        // Số tháng của kỳ thuê (1, 3, 6, 12)
        int cycleMonths = contract.getBillingCycleMonths() != null && contract.getBillingCycleMonths() > 0
                ? contract.getBillingCycleMonths()
                : (contract.getReservation() != null && contract.getReservation().getDurationMonths() != null
                        ? contract.getReservation().getDurationMonths()
                        : 1);

        // Tính tiền thuê kỳ hiện tại đã trả theo D-08 (hoặc từ payment_transactions nếu có)
        BigDecimal discountRate = BigDecimal.ZERO;
        if (cycleMonths >= 12) discountRate = new BigDecimal("0.15");
        else if (cycleMonths >= 6) discountRate = new BigDecimal("0.10");
        else if (cycleMonths >= 3) discountRate = new BigDecimal("0.05");

        BigDecimal nominalRent = baseMonthlyPrice.multiply(BigDecimal.valueOf(cycleMonths));
        BigDecimal rentPaid = nominalRent.subtract(nominalRent.multiply(discountRate)).setScale(0, RoundingMode.HALF_UP);

        try {
            BigDecimal renewTxn = jdbcTemplate.queryForObject(
                    "SELECT TOP 1 amount FROM payment_transactions WHERE contract_id = ? AND payment_type = 'MONTHLY_RENT' AND status = 'SUCCESS' ORDER BY id DESC",
                    BigDecimal.class, contract.getId());
            if (renewTxn != null && renewTxn.compareTo(BigDecimal.ZERO) > 0) {
                rentPaid = renewTxn;
            } else if (contract.getReservation() != null) {
                BigDecimal depTxn = jdbcTemplate.queryForObject(
                        "SELECT TOP 1 amount FROM payment_transactions WHERE reservation_id = ? AND payment_type = 'DEPOSIT' AND status = 'SUCCESS' ORDER BY id DESC",
                        BigDecimal.class, contract.getReservation().getId());
                if (depTxn != null && depTxn.compareTo(depositHeld) > 0) {
                    rentPaid = depTxn.subtract(depositHeld);
                }
            }
        } catch (Exception ignored) {
        }

        LocalDate startDate = contract.getStartDate() != null ? contract.getStartDate() : LocalDate.now();
        LocalDate endDate = contract.getEndDate() != null ? contract.getEndDate() : startDate.plusMonths(cycleMonths);
        LocalDate actualDate = actualCheckoutDate != null ? actualCheckoutDate : LocalDate.now();

        // 1. Kiểm tra Trả sớm (PR-O2, D-10): ngày nghiệm thu < endDate
        boolean isEarlyCheckout = actualDate.isBefore(endDate);
        int usedMonths = 0;
        BigDecimal breakFee = BigDecimal.ZERO;
        BigDecimal earlyRentRefund = BigDecimal.ZERO;

        if (isEarlyCheckout) {
            Period period = Period.between(startDate, actualDate);
            int m = period.getYears() * 12 + period.getMonths();
            if (period.getDays() > 0) {
                m += 1;
            }
            usedMonths = Math.max(1, m);
            breakFee = baseMonthlyPrice; // Phí phá vỡ hợp đồng = 1 tháng giá niêm yết lúc ký

            // Công thức PR-O2: Hoàn tiền thuê = tiền thuê đã trả - (số tháng đã dùng * đơn giá gốc không ưu đãi) - phí phá HĐ
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
                // Ngày end_date + 1: Miễn phí (PR-O14)
                graceFee = BigDecimal.ZERO;
            } else if (daysPast >= 2 && daysPast <= 5) {
                // Ngày +2 -> +5: tính tiền thuê theo ngày = giá niêm yết lúc ký / 30 mỗi ngày
                BigDecimal dailyRate = baseMonthlyPrice.divide(BigDecimal.valueOf(30), 0, RoundingMode.HALF_UP);
                graceFee = dailyRate.multiply(BigDecimal.valueOf(daysPast - 1));
            } else {
                // Qua +5 ngày (lỡ ân hạn): chuyển sang phí trễ PR-Q3 (10%/ngày, trần 50% tiền cọc)
                long billableDays = Math.min(daysPast, 5);
                BigDecimal percent = new BigDecimal("0.10").multiply(BigDecimal.valueOf(billableDays));
                lateFee = depositHeld.multiply(percent).setScale(0, RoundingMode.HALF_UP);
            }
        }

        // 3. Quyết toán hoàn cọc (PR-O11): Hoàn cọc = cọc đang giữ - phí sự cố - phí ân hạn/trễ hạn (>= 0)
        BigDecimal totalDepositDeductions = totalDamageCost.add(graceFee).add(lateFee);
        BigDecimal depositRefund = depositHeld.subtract(totalDepositDeductions).max(BigDecimal.ZERO);
        BigDecimal excessDebt = totalDepositDeductions.subtract(depositHeld).max(BigDecimal.ZERO);

        // Gộp hoàn tiền thuê trả sớm và hoàn cọc vào tổng hoàn
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

        // Tạo mô tả chi tiết bảng tính
        NumberFormat vndFmt = NumberFormat.getInstance(new Locale("vi", "VN"));
        StringBuilder desc = new StringBuilder();
        desc.append("Hoàn tiền trả kho HĐ ").append(contract.getContractCode())
                .append(" (Ô ").append(contract.getStorageUnit() != null ? contract.getStorageUnit().getId() : "—").append(")")
                .append(" | Tổng hoàn: ").append(vndFmt.format(totalRefund)).append("đ");

        desc.append(" [Cọc hoàn: ").append(vndFmt.format(depositRefund)).append("đ");
        if (totalDepositDeductions.compareTo(BigDecimal.ZERO) > 0) {
            desc.append(" (Cọc gốc: ").append(vndFmt.format(depositHeld)).append("đ");
            if (totalDamageCost.compareTo(BigDecimal.ZERO) > 0) {
                desc.append(" - Sự cố: ").append(vndFmt.format(totalDamageCost)).append("đ");
            }
            if (graceFee.compareTo(BigDecimal.ZERO) > 0) {
                desc.append(" - Phí ân hạn ").append(daysPast - 1).append(" ngày: ").append(vndFmt.format(graceFee)).append("đ");
            }
            if (lateFee.compareTo(BigDecimal.ZERO) > 0) {
                desc.append(" - Phí trễ hạn: ").append(vndFmt.format(lateFee)).append("đ");
            }
            desc.append(")");
        }
        desc.append("]");

        if (earlyRentRefund.compareTo(BigDecimal.ZERO) > 0) {
            desc.append(" [Hoàn tiền thuê trả sớm: ").append(vndFmt.format(earlyRentRefund)).append("đ")
                    .append(" (Đã trả: ").append(vndFmt.format(rentPaid)).append("đ")
                    .append(" - Đã dùng ").append(usedMonths).append("T: ").append(vndFmt.format(baseMonthlyPrice.multiply(BigDecimal.valueOf(usedMonths)))).append("đ")
                    .append(" - Phí hủy HĐ: ").append(vndFmt.format(breakFee)).append("đ)]");
        }

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
