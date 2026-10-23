package com.queenkho.api.service;

import com.queenkho.api.dto.*;
import com.queenkho.api.entity.Facility;
import com.queenkho.api.entity.Role;
import com.queenkho.api.entity.User;
import com.queenkho.api.exception.AdminException;
import com.queenkho.api.repository.FacilityRepository;
import com.queenkho.api.repository.RoleRepository;
import com.queenkho.api.repository.StaffTaskRepository;
import com.queenkho.api.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

// UC-32: Quản lý nhân viên chi nhánh cơ sở (Facility Staff Management)
@Service
public class FacilityStaffService {

    private static final Pattern PHONE_PATTERN = Pattern.compile("^0\\d{9}$");
    private static final List<String> HOLDING_TASK_STATUSES = List.of("IN_PROGRESS", "OVERDUE");

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private FacilityRepository facilityRepository;

    @Autowired
    private StaffTaskRepository staffTaskRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private ActivityLogService activityLogService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    /**
     * Lấy danh sách nhân viên của cơ sở kèm số lượng task đang làm và đã hoàn thành trong tháng (PR-M13).
     */
    public List<FacilityStaffResponse> getStaffByFacility(Integer facilityId) {
        if (facilityId == null) {
            throw new AdminException(HttpStatus.BAD_REQUEST, "MISSING_FACILITY_ID", "Cơ sở không được để trống");
        }

        LocalDateTime startOfMonth = LocalDate.now().withDayOfMonth(1).atStartOfDay();

        String sql = "SELECT " +
                "u.id, u.full_name, u.email, u.phone, u.status, u.created_at, u.facility_id, f.name AS facility_name, " +
                "COALESCE(SUM(CASE WHEN t.status = 'IN_PROGRESS' THEN 1 ELSE 0 END), 0) AS active_tasks_count, " +
                "COALESCE(SUM(CASE WHEN t.status = 'COMPLETED' AND t.completed_at >= ? THEN 1 ELSE 0 END), 0) AS completed_tasks_count " +
                "FROM users u " +
                "JOIN roles r ON r.id = u.role_id " +
                "JOIN facilities f ON f.id = u.facility_id " +
                "LEFT JOIN facility_tasks t ON t.staff_id = u.id " +
                "WHERE u.facility_id = ? AND r.name = 'STAFF' " +
                "GROUP BY u.id, u.full_name, u.email, u.phone, u.status, u.created_at, u.facility_id, f.name " +
                "ORDER BY u.created_at DESC";

        List<FacilityStaffResponse> list = new ArrayList<>();
        try {
            jdbcTemplate.query(sql, (rs) -> {
                Timestamp ts = rs.getTimestamp("created_at");
                LocalDateTime createdAt = ts != null ? ts.toLocalDateTime() : null;

                list.add(FacilityStaffResponse.builder()
                        .id(rs.getInt("id"))
                        .fullName(rs.getString("full_name"))
                        .email(rs.getString("email"))
                        .phone(rs.getString("phone"))
                        .status(rs.getString("status"))
                        .activeTasksCount(rs.getInt("active_tasks_count"))
                        .completedTasksThisMonthCount(rs.getInt("completed_tasks_count"))
                        .facilityId(rs.getInt("facility_id"))
                        .facilityName(rs.getString("facility_name"))
                        .createdAt(createdAt)
                        .build());
            }, Timestamp.valueOf(startOfMonth), facilityId);
        } catch (Exception e) {
            System.err.println("Lỗi truy vấn danh sách staff cơ sở: " + e.getMessage());
            throw new AdminException(HttpStatus.INTERNAL_SERVER_ERROR, "STAFF_QUERY_ERROR", "Lỗi tải danh sách nhân viên: " + e.getMessage());
        }

        return list;
    }

    /**
     * FM tạo tài khoản STAFF cho cơ sở của chính mình (PR-22, PR-M12, D-03).
     */
    @Transactional
    public FacilityStaffResponse createStaff(CreateFacilityStaffRequest request, Integer actorUserId, Integer facilityId) {
        if (facilityId == null) {
            throw new AdminException(HttpStatus.BAD_REQUEST, "MISSING_FACILITY_ID", "Không xác định được cơ sở của quản lý");
        }

        Facility facility = facilityRepository.findById(facilityId)
                .orElseThrow(() -> new AdminException(HttpStatus.NOT_FOUND, "FACILITY_NOT_FOUND", "Không tìm thấy cơ sở với id " + facilityId));

        if (!"ACTIVE".equalsIgnoreCase(facility.getStatus())) {
            throw new AdminException(HttpStatus.BAD_REQUEST, "FACILITY_INACTIVE", "Cơ sở hiện không hoạt động, không thể tạo nhân viên mới");
        }

        // Validate fullName
        if (request == null || request.getFullName() == null || request.getFullName().trim().isEmpty()) {
            throw new AdminException(HttpStatus.BAD_REQUEST, "INVALID_FULL_NAME", "Họ và tên nhân viên không được để trống");
        }
        String fullName = request.getFullName().trim();
        if (fullName.length() > 100) {
            throw new AdminException(HttpStatus.BAD_REQUEST, "FULL_NAME_TOO_LONG", "Họ và tên tối đa 100 ký tự");
        }

        // Validate email
        if (request.getEmail() == null || request.getEmail().trim().isEmpty()) {
            throw new AdminException(HttpStatus.BAD_REQUEST, "INVALID_EMAIL", "Email không được để trống");
        }
        String email = request.getEmail().trim().toLowerCase();
        if (!email.contains("@") || !email.contains(".")) {
            throw new AdminException(HttpStatus.BAD_REQUEST, "INVALID_EMAIL_FORMAT", "Email không đúng định dạng");
        }
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new AdminException(HttpStatus.CONFLICT, "DUPLICATE_EMAIL", "Email '" + email + "' đã được sử dụng trong hệ thống");
        }

        // Validate phone
        if (request.getPhone() == null || !PHONE_PATTERN.matcher(request.getPhone().trim()).matches()) {
            throw new AdminException(HttpStatus.BAD_REQUEST, "INVALID_PHONE", "Số điện thoại phải có 10 chữ số và bắt đầu bằng số 0");
        }
        String phone = request.getPhone().trim();

        // Validate password
        if (request.getPassword() == null || request.getPassword().length() < 6) {
            throw new AdminException(HttpStatus.BAD_REQUEST, "WEAK_PASSWORD", "Mật khẩu ban đầu phải có ít nhất 6 ký tự");
        }

        Role staffRole = roleRepository.findByName("STAFF")
                .orElseThrow(() -> new AdminException(HttpStatus.INTERNAL_SERVER_ERROR, "ROLE_NOT_FOUND", "Không tìm thấy vai trò STAFF"));

        User newStaff = User.builder()
                .facilityId(facility.getId())
                .role(staffRole)
                .email(email)
                .fullName(fullName)
                .phone(phone)
                .password(passwordEncoder.encode(request.getPassword()))
                .status("ACTIVE")
                .build();

        userRepository.save(newStaff);

        // Ghi activity log
        Integer actor = actorUserId != null ? actorUserId : 1;
        activityLogService.log(actor,
                String.format("[STAFF_CREATE] Quản lý tạo nhân viên mới: %s (%s) tại cơ sở %s", fullName, email, facility.getName()),
                "users",
                String.valueOf(newStaff.getId()));

        return FacilityStaffResponse.builder()
                .id(newStaff.getId())
                .fullName(newStaff.getFullName())
                .email(newStaff.getEmail())
                .phone(newStaff.getPhone())
                .status(newStaff.getStatus())
                .activeTasksCount(0)
                .completedTasksThisMonthCount(0)
                .facilityId(facility.getId())
                .facilityName(facility.getName())
                .createdAt(LocalDateTime.now())
                .build();
    }

    /**
     * Khóa / Mở khóa tài khoản Staff (PR-06).
     * Tuyệt đối không cho khóa nhân viên đang giữ task IN_PROGRESS hoặc OVERDUE.
     */
    @Transactional
    public FacilityStaffResponse changeStatus(Integer staffId, UpdateFacilityStaffStatusRequest request, Integer actorUserId, Integer facilityId) {
        User staff = userRepository.findById(staffId)
                .orElseThrow(() -> new AdminException(HttpStatus.NOT_FOUND, "STAFF_NOT_FOUND", "Không tìm thấy nhân viên với id: " + staffId));

        if (!"STAFF".equals(staff.getRole().getName())) {
            throw new AdminException(HttpStatus.BAD_REQUEST, "INVALID_ROLE", "Chỉ được thay đổi trạng thái của nhân viên (STAFF)");
        }

        if (facilityId != null && !facilityId.equals(staff.getFacilityId())) {
            throw new AdminException(HttpStatus.FORBIDDEN, "FORBIDDEN_FACILITY", "Bạn chỉ được quản lý nhân viên thuộc cơ sở của mình");
        }

        String targetStatus = request != null && request.getStatus() != null ? request.getStatus().trim().toUpperCase() : "";
        if (!"ACTIVE".equals(targetStatus) && !"LOCKED".equals(targetStatus)) {
            throw new AdminException(HttpStatus.BAD_REQUEST, "INVALID_STATUS", "Trạng thái chỉ có thể là ACTIVE hoặc LOCKED");
        }

        if (targetStatus.equals(staff.getStatus())) {
            return getStaffDetail(staff.getId());
        }

        // PR-06: Chặn khóa nhân viên đang giữ task
        if ("LOCKED".equals(targetStatus)) {
            if (staffTaskRepository.existsByStaff_IdAndStatusIn(staff.getId(), HOLDING_TASK_STATUSES)) {
                throw new AdminException(HttpStatus.CONFLICT, "STAFF_HAS_TASK_IN_PROGRESS",
                        "Nhân viên đang phụ trách ca trực chưa hoàn tất. Quản lý cần gỡ người nhận trên Bảng công việc trước khi khóa");
            }
        }

        String oldStatus = staff.getStatus();
        staff.setStatus(targetStatus);
        userRepository.save(staff);

        String reason = request.getReason() != null ? request.getReason().trim() : "Không ghi chú";
        Integer actor = actorUserId != null ? actorUserId : 1;
        String actionCode = "LOCKED".equals(targetStatus) ? "[STAFF_LOCK]" : "[STAFF_UNLOCK]";
        activityLogService.log(actor,
                String.format("%s Quản lý đổi trạng thái nhân viên %s (%s): %s -> %s. Lý do: %s",
                        actionCode, staff.getFullName(), staff.getEmail(), oldStatus, targetStatus, reason),
                "users",
                String.valueOf(staff.getId()));

        return getStaffDetail(staff.getId());
    }

    /**
     * Đặt lại mật khẩu nhân viên (FM cấp mật khẩu mới khi nhân viên quên).
     */
    @Transactional
    public void resetPassword(Integer staffId, ResetFacilityStaffPasswordRequest request, Integer actorUserId, Integer facilityId) {
        User staff = userRepository.findById(staffId)
                .orElseThrow(() -> new AdminException(HttpStatus.NOT_FOUND, "STAFF_NOT_FOUND", "Không tìm thấy nhân viên"));

        if (!"STAFF".equals(staff.getRole().getName())) {
            throw new AdminException(HttpStatus.BAD_REQUEST, "INVALID_ROLE", "Chỉ được đặt lại mật khẩu cho nhân viên (STAFF)");
        }

        if (facilityId != null && !facilityId.equals(staff.getFacilityId())) {
            throw new AdminException(HttpStatus.FORBIDDEN, "FORBIDDEN_FACILITY", "Bạn chỉ được đặt lại mật khẩu cho nhân viên thuộc cơ sở của mình");
        }

        if (request == null || request.getNewPassword() == null || request.getNewPassword().length() < 6) {
            throw new AdminException(HttpStatus.BAD_REQUEST, "WEAK_PASSWORD", "Mật khẩu mới phải có ít nhất 6 ký tự");
        }

        staff.setPassword(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(staff);

        Integer actor = actorUserId != null ? actorUserId : 1;
        activityLogService.log(actor,
                String.format("[STAFF_RESET_PASSWORD] Quản lý đặt lại mật khẩu cho nhân viên: %s (%s)", staff.getFullName(), staff.getEmail()),
                "users",
                String.valueOf(staff.getId()));
    }

    private FacilityStaffResponse getStaffDetail(Integer staffId) {
        User staff = userRepository.findById(staffId).orElseThrow();
        LocalDateTime startOfMonth = LocalDate.now().withDayOfMonth(1).atStartOfDay();

        int activeTasks = 0;
        int completedTasks = 0;
        try {
            activeTasks = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM facility_tasks WHERE staff_id = ? AND status = 'IN_PROGRESS'",
                    Integer.class, staff.getId());
            completedTasks = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM facility_tasks WHERE staff_id = ? AND status = 'COMPLETED' AND completed_at >= ?",
                    Integer.class, staff.getId(), Timestamp.valueOf(startOfMonth));
        } catch (Exception ignored) {}

        String facilityName = "";
        if (staff.getFacilityId() != null) {
            facilityName = facilityRepository.findById(staff.getFacilityId()).map(Facility::getName).orElse("");
        }

        return FacilityStaffResponse.builder()
                .id(staff.getId())
                .fullName(staff.getFullName())
                .email(staff.getEmail())
                .phone(staff.getPhone())
                .status(staff.getStatus())
                .activeTasksCount(activeTasks)
                .completedTasksThisMonthCount(completedTasks)
                .facilityId(staff.getFacilityId())
                .facilityName(facilityName)
                .createdAt(staff.getCreatedAt())
                .build();
    }
}

