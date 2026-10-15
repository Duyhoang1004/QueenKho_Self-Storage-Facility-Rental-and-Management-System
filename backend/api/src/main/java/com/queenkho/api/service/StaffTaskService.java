package com.queenkho.api.service;

import com.queenkho.api.dto.CheckInRequest;
import com.queenkho.api.dto.ContactReportRequest;
import com.queenkho.api.dto.HandoverRecordResponse;
import com.queenkho.api.dto.StaffTaskDetailResponse;
import com.queenkho.api.dto.StaffTaskResponse;
import com.queenkho.api.entity.HandoverRecord;
import com.queenkho.api.entity.RentalContract;
import com.queenkho.api.entity.StaffTask;
import com.queenkho.api.entity.StorageUnit;
import com.queenkho.api.entity.User;
import com.queenkho.api.exception.StaffTaskException;
import com.queenkho.api.repository.HandoverRecordRepository;
import com.queenkho.api.repository.RentalContractRepository;
import com.queenkho.api.repository.StaffTaskRepository;
import com.queenkho.api.repository.UserRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

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

    @Autowired
    private StaffTaskRepository staffTaskRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RentalContractRepository rentalContractRepository;

    @Autowired
    private HandoverRecordRepository handoverRecordRepository;

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
            // Đúng người, đang xử lý nhưng UPDATE vẫn trượt → đã qua hạn mà job chưa kịp
            // chạy
            return new StaffTaskException(HttpStatus.CONFLICT, "TASK_OVERDUE",
                    "Task đã quá hạn, không thể lập biên bản");
        }
        if ("CANCELLED".equals(status)) {
            return new StaffTaskException(HttpStatus.CONFLICT, "TASK_NOT_IN_PROGRESS", "Task đã bị huỷ");
        }
        return new StaffTaskException(HttpStatus.CONFLICT, "TASK_NOT_IN_PROGRESS",
                "Bạn cần nhận việc trước khi lập biên bản");
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
                .accessPinCode(contract != null ? contract.getAccessPinCode() : null)
                .rfidCardCode(contract != null ? contract.getRfidCardCode() : null)
                .customerName(customer != null ? customer.getFullName() : null)
                .customerPhone(customer != null ? customer.getPhone() : null)
                .customerEmail(customer != null ? customer.getEmail() : null)
                .storageUnitId(unit != null ? unit.getId() : null)
                .unitTypeName(unit != null && unit.getUnitType() != null ? unit.getUnitType().getName() : null)
                .facilityName(unit != null && unit.getFacility() != null ? unit.getFacility().getName() : null)
                .handoverRecord(handover)
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
                        "VALUES (?, ?, 'staff_tasks', ?, SYSDATETIME())",
                staff.getId(),
                logAction,
                task.getId());

        return toResponse(task);
    }

    // ================== JOB QUÁ HẠN ==================

    // @Modifying query bắt buộc chạy trong transaction → bọc ở đây
    @Transactional
    public int markOverdueTasks() {
        return staffTaskRepository.markOverdue(LocalDateTime.now());
    }
}
