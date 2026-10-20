package com.queenkho.api.service;

import com.queenkho.api.dto.AdminUserResponse;
import com.queenkho.api.dto.CreateUserRequest;
import com.queenkho.api.dto.FacilityOptionResponse;
import com.queenkho.api.dto.PageResponse;
import com.queenkho.api.dto.ResetPasswordRequest;
import com.queenkho.api.dto.UpdateUserRequest;
import com.queenkho.api.dto.UpdateUserStatusRequest;
import com.queenkho.api.dto.UserActionResponse;
import com.queenkho.api.entity.Facility;
import com.queenkho.api.entity.Role;
import com.queenkho.api.entity.User;
import com.queenkho.api.exception.AdminException;
import com.queenkho.api.repository.FacilityRepository;
import com.queenkho.api.repository.RentalContractRepository;
import com.queenkho.api.repository.ReservationRepository;
import com.queenkho.api.repository.RoleRepository;
import com.queenkho.api.repository.StaffTaskRepository;
import com.queenkho.api.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Pattern;

// UC-08: Quản lý tài khoản người dùng toàn hệ thống (Admin).
// Rule: PR-03..05, PR-A2..A7 trong docs/business-rules.md
@Service
public class AdminUserService {

    // PR-03: Admin chỉ tạo / đổi qua lại giữa 4 role nội bộ. CUSTOMER chỉ tự đăng ký (UC-02).
    private static final List<String> INTERNAL_ROLES = List.of("STAFF", "FACILITY_MANAGER", "BOM", "ADMIN");
    private static final List<String> USER_STATUSES = List.of("ACTIVE", "LOCKED", "DISABLED");

    // Task "đang giữ": đã nhận (IN_PROGRESS) hoặc đã nhận rồi bị job chuyển quá hạn (OVERDUE còn staff_id)
    private static final List<String> HOLDING_TASK_STATUSES = List.of("IN_PROGRESS", "OVERDUE");
    // PR-A5: khách "đang thuê"
    private static final List<String> ACTIVE_RESERVATION_STATUSES = List.of("PENDING", "DEPOSIT_PAID", "UNIT_ASSIGNED");
    private static final List<String> ACTIVE_CONTRACT_STATUSES =
            List.of("PENDING_CHECK_IN", "ACTIVE", "OVERDUE", "TERMINATION_PENDING");

    private static final Pattern PHONE_PATTERN = Pattern.compile("^0\\d{9}$");
    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    private static final int FULL_NAME_MAX_LENGTH = 100;   // = users.full_name
    private static final int REASON_MAX_LENGTH = 255;
    private static final int PASSWORD_MIN_LENGTH = 6;
    private static final int DEFAULT_PAGE_SIZE = 20;
    private static final int MAX_PAGE_SIZE = 100;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private FacilityRepository facilityRepository;

    @Autowired
    private StaffTaskRepository staffTaskRepository;

    @Autowired
    private ReservationRepository reservationRepository;

    @Autowired
    private RentalContractRepository rentalContractRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private ActivityLogService activityLogService;

    @Autowired
    private AdminGuard adminGuard;

    // ──────────────────────────────────────────────────────
    // Danh sách + bộ lọc + phân trang
    // ──────────────────────────────────────────────────────
    @Transactional(readOnly = true)
    public PageResponse<AdminUserResponse> getUsers(String keyword, String roleName, String status,
                                                    Integer facilityId, int page, int size) {
        int safePage = Math.max(page, 0);
        int safeSize = (size < 1 || size > MAX_PAGE_SIZE) ? DEFAULT_PAGE_SIZE : size;
        // Mới tạo lên trước; trùng giờ tạo thì id lớn trước → thứ tự luôn ổn định giữa các trang
        Pageable pageable = PageRequest.of(safePage, safeSize,
                Sort.by(Sort.Direction.DESC, "createdAt").and(Sort.by(Sort.Direction.DESC, "id")));

        Page<User> result = userRepository.searchUsers(blankToNull(keyword), blankToNull(roleName),
                blankToNull(status), facilityId, ActivityLogService.SYSTEM_EMAIL, pageable);

        // User chỉ giữ facilityId (không có quan hệ @ManyToOne) → lấy tên cơ sở 1 lần cho cả trang,
        // tránh gọi findById 20 lần (N+1 query)
        List<Integer> facilityIds = result.getContent().stream()
                .map(User::getFacilityId).filter(Objects::nonNull).distinct().toList();
        Map<Integer, Facility> facilities = new HashMap<>();
        for (Facility f : facilityRepository.findAllById(facilityIds)) {
            facilities.put(f.getId(), f);
        }

        List<AdminUserResponse> content = result.getContent().stream()
                .map(u -> toResponse(u, facilities.get(u.getFacilityId())))
                .toList();
        return new PageResponse<>(content, result.getNumber(), result.getSize(),
                result.getTotalElements(), result.getTotalPages());
    }

    // ──────────────────────────────────────────────────────
    // Dropdown cơ sở (gồm cả INACTIVE để lọc) + FM ACTIVE hiện tại
    // ──────────────────────────────────────────────────────
    @Transactional(readOnly = true)
    public List<FacilityOptionResponse> getFacilityOptions() {
        Map<Integer, User> managerByFacility = new HashMap<>();
        for (User fm : userRepository.findByRole_NameAndStatus("FACILITY_MANAGER", "ACTIVE")) {
            if (fm.getFacilityId() != null) {
                managerByFacility.putIfAbsent(fm.getFacilityId(), fm);
            }
        }
        return facilityRepository.findAllByOrderByIdAsc().stream()
                .map(f -> {
                    User manager = managerByFacility.get(f.getId());
                    return new FacilityOptionResponse(f.getId(), f.getCode(), f.getName(), f.getStatus(),
                            manager == null ? null : manager.getId(),
                            manager == null ? null : manager.getFullName());
                })
                .toList();
    }

    // ──────────────────────────────────────────────────────
    // Tạo tài khoản nội bộ (PR-03, PR-04)
    // ──────────────────────────────────────────────────────
    @Transactional
    public UserActionResponse createUser(CreateUserRequest request, Integer actorUserId) {
        adminGuard.requireActiveAdmin(actorUserId);
        if (request == null) {
            throw badRequest("Thiếu dữ liệu tài khoản");
        }

        String fullName = validateFullName(request.getFullName());
        String phone = validatePhone(request.getPhone());

        String email = request.getEmail() == null ? "" : request.getEmail().trim().toLowerCase();
        if (!EMAIL_PATTERN.matcher(email).matches()) {
            throw badRequest("Email không hợp lệ");
        }
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new AdminException(HttpStatus.CONFLICT, "EMAIL_EXISTS", "Email " + email + " đã được sử dụng");
        }

        String password = request.getPassword() == null ? "" : request.getPassword();
        if (password.length() < PASSWORD_MIN_LENGTH) {
            throw badRequest("Mật khẩu tối thiểu " + PASSWORD_MIN_LENGTH + " ký tự");
        }

        Role role = requireInternalRole(request.getRoleName());
        Facility facility = resolveFacility(role.getName(), request.getFacilityId(), null);
        if ("FACILITY_MANAGER".equals(role.getName())) {
            ensureNoOtherActiveManager(facility, null); // PR-04: mỗi cơ sở tối đa 1 FM ACTIVE
        }

        User user = new User();
        user.setFullName(fullName);
        user.setEmail(email);
        user.setPhone(phone);
        user.setRole(role);
        user.setFacilityId(facility == null ? null : facility.getId());
        user.setPassword(passwordEncoder.encode(password));   // luôn lưu BCrypt, không lưu mật khẩu thô
        user.setStatus("ACTIVE");                              // khởi tạo trong Java (cột NOT NULL DEFAULT)
        userRepository.save(user);                             // save xong user.getId() đã có giá trị (IDENTITY)

        log(actorUserId, "[USER_CREATE] Tạo tài khoản " + email + " — vai trò " + role.getName()
                + (facility == null ? "" : ", cơ sở " + facility.getName()), user.getId());

        return new UserActionResponse(toResponse(user, facility), null);
    }

    // ──────────────────────────────────────────────────────
    // Sửa: tên, SĐT, role, cơ sở (PR-A2, PR-A3, PR-A7)
    // ──────────────────────────────────────────────────────
    @Transactional
    public UserActionResponse updateUser(Integer userId, UpdateUserRequest request, Integer actorUserId) {
        adminGuard.requireActiveAdmin(actorUserId);
        if (request == null) {
            throw badRequest("Thiếu dữ liệu tài khoản");
        }
        User user = findTargetUser(userId);

        String fullName = validateFullName(request.getFullName());
        String phone = validatePhone(request.getPhone());

        String oldRole = user.getRole().getName();
        Integer oldFacilityId = user.getFacilityId();
        List<String> changes = new ArrayList<>();   // gom các thay đổi để ghi 1 dòng log
        String warning = null;

        if (!fullName.equals(user.getFullName())) {
            changes.add("tên \"" + user.getFullName() + "\" → \"" + fullName + "\"");
            user.setFullName(fullName);
        }
        if (!phone.equals(user.getPhone())) {
            changes.add("SĐT " + user.getPhone() + " → " + phone);
            user.setPhone(phone);
        }

        // PR-A2: khách hàng không đổi role / cơ sở → bỏ qua phần dưới
        if (!"CUSTOMER".equals(oldRole)) {
            Role newRole = requireInternalRole(request.getRoleName());
            boolean roleChanged = !newRole.getName().equals(oldRole);

            // Admin không tự đổi role của chính mình
            if (roleChanged && user.getId().equals(actorUserId)) {
                throw new AdminException(HttpStatus.CONFLICT, "CANNOT_CHANGE_OWN_ROLE",
                        "Không thể tự đổi vai trò của chính mình");
            }

            Facility newFacility = resolveFacility(newRole.getName(), request.getFacilityId(), oldFacilityId);
            Integer newFacilityId = newFacility == null ? null : newFacility.getId();
            boolean facilityChanged = !Objects.equals(oldFacilityId, newFacilityId);

            // PR-A2, PR-A3: Staff đổi role / chuyển cơ sở khi đang giữ task → task bị treo
            if ("STAFF".equals(oldRole) && (roleChanged || facilityChanged)) {
                ensureNoHoldingTask(user);
            }
            // PR-A7: không đổi role của Admin ACTIVE cuối cùng
            if (roleChanged && "ADMIN".equals(oldRole) && "ACTIVE".equals(user.getStatus())) {
                ensureNotLastActiveAdmin();
            }
            // PR-04, PR-A3: sang FM / FM chuyển cơ sở → cơ sở mới chưa có FM ACTIVE khác
            if ("FACILITY_MANAGER".equals(newRole.getName()) && "ACTIVE".equals(user.getStatus())
                    && (roleChanged || facilityChanged)) {
                ensureNoOtherActiveManager(newFacility, user.getId());
            }
            // PR-A4 (mở rộng): FM ACTIVE rời cơ sở cũ → cảnh báo nếu cơ sở cũ không còn quản lý
            if ("FACILITY_MANAGER".equals(oldRole) && "ACTIVE".equals(user.getStatus())
                    && (roleChanged || facilityChanged)) {
                warning = managerMissingWarning(oldFacilityId, user.getId());
            }

            if (roleChanged) {
                changes.add("vai trò " + oldRole + " → " + newRole.getName());
                user.setRole(newRole);
            }
            if (facilityChanged) {
                changes.add("cơ sở " + facilityLabel(oldFacilityId) + " → "
                        + (newFacility == null ? "—" : newFacility.getName()));
                user.setFacilityId(newFacilityId);
            }
        }

        // Không đổi gì → không save, không log rác (giống UC-03)
        if (!changes.isEmpty()) {
            userRepository.save(user);
            log(actorUserId, "[USER_UPDATE] Sửa tài khoản " + user.getEmail() + ": " + String.join("; ", changes),
                    user.getId());
        }
        return new UserActionResponse(toResponse(user, loadFacility(user.getFacilityId())), warning);
    }

    // ──────────────────────────────────────────────────────
    // Khoá / vô hiệu / mở lại (PR-05, PR-06, PR-A4, PR-A5, PR-A7)
    // ──────────────────────────────────────────────────────
    @Transactional
    public UserActionResponse changeStatus(Integer userId, UpdateUserStatusRequest request, Integer actorUserId) {
        adminGuard.requireActiveAdmin(actorUserId);
        String newStatus = (request == null || request.getStatus() == null)
                ? "" : request.getStatus().trim().toUpperCase();
        if (!USER_STATUSES.contains(newStatus)) {
            throw badRequest("Trạng thái phải là ACTIVE, LOCKED hoặc DISABLED");
        }
        User user = findTargetUser(userId);
        String oldStatus = user.getStatus();
        String roleName = user.getRole().getName();

        // Không đổi → trả về luôn, không log
        if (newStatus.equals(oldStatus)) {
            return new UserActionResponse(toResponse(user, loadFacility(user.getFacilityId())), null);
        }

        String reason = request.getReason() == null ? "" : request.getReason().trim();
        String warning = null;
        String code;

        if ("ACTIVE".equals(newStatus)) {
            // Mở lại FM: cơ sở không được đang có FM ACTIVE khác (PR-04)
            if ("FACILITY_MANAGER".equals(roleName) && user.getFacilityId() != null) {
                ensureNoOtherActiveManager(loadFacility(user.getFacilityId()), user.getId());
            }
            code = "[USER_UNLOCK] Mở lại";
        } else {
            if (reason.isEmpty()) {
                throw badRequest("Vui lòng nhập lý do");
            }
            if (reason.length() > REASON_MAX_LENGTH) {
                throw badRequest("Lý do tối đa " + REASON_MAX_LENGTH + " ký tự");
            }
            // PR-05: Admin không tự khoá mình
            if (user.getId().equals(actorUserId)) {
                throw new AdminException(HttpStatus.CONFLICT, "CANNOT_LOCK_SELF", "Không thể tự khoá tài khoản của mình");
            }
            // PR-A7: chỉ cần kiểm tra khi Admin này đang ACTIVE (LOCKED → DISABLED không làm giảm số Admin ACTIVE)
            if ("ADMIN".equals(roleName) && "ACTIVE".equals(oldStatus)) {
                ensureNotLastActiveAdmin();
            }
            if ("CUSTOMER".equals(roleName)) {
                ensureNoActiveRental(user);   // PR-A5
            }
            if ("STAFF".equals(roleName)) {
                ensureNoHoldingTask(user);    // PR-06
            }
            // PR-A4: khoá FM → cảnh báo, KHÔNG chặn
            if ("FACILITY_MANAGER".equals(roleName) && "ACTIVE".equals(oldStatus)) {
                warning = managerMissingWarning(user.getFacilityId(), user.getId());
            }
            code = "LOCKED".equals(newStatus) ? "[USER_LOCK] Khoá" : "[USER_DISABLE] Vô hiệu";
        }

        user.setStatus(newStatus);
        userRepository.save(user);

        log(actorUserId, code + " tài khoản " + user.getEmail() + " (" + oldStatus + " → " + newStatus + ")"
                + (reason.isEmpty() ? "" : ". Lý do: " + reason), user.getId());

        return new UserActionResponse(toResponse(user, loadFacility(user.getFacilityId())), warning);
    }

    // ──────────────────────────────────────────────────────
    // Đặt lại mật khẩu (PR-A6) — không gửi email, không ghi mật khẩu vào log
    // ──────────────────────────────────────────────────────
    @Transactional
    public UserActionResponse resetPassword(Integer userId, ResetPasswordRequest request, Integer actorUserId) {
        adminGuard.requireActiveAdmin(actorUserId);
        String newPassword = (request == null || request.getNewPassword() == null) ? "" : request.getNewPassword();
        if (newPassword.length() < PASSWORD_MIN_LENGTH) {
            throw badRequest("Mật khẩu tối thiểu " + PASSWORD_MIN_LENGTH + " ký tự");
        }
        User user = findTargetUser(userId);
        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);

        log(actorUserId, "[USER_RESET_PASSWORD] Đặt lại mật khẩu cho tài khoản " + user.getEmail(), user.getId());
        return new UserActionResponse(toResponse(user, loadFacility(user.getFacilityId())), null);
    }

    // ══════════════════════════════════════════════════════
    // Hàm phụ
    // ══════════════════════════════════════════════════════

    // Tài khoản system (job) coi như không tồn tại với Admin → không sửa / khoá / đổi mật khẩu được
    private User findTargetUser(Integer userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AdminException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND",
                        "Không tìm thấy người dùng #" + userId));
        if (ActivityLogService.SYSTEM_EMAIL.equals(user.getEmail())) {
            throw new AdminException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "Không tìm thấy người dùng #" + userId);
        }
        return user;
    }

    private Role requireInternalRole(String roleName) {
        String name = roleName == null ? "" : roleName.trim().toUpperCase();
        if (!INTERNAL_ROLES.contains(name)) {
            throw badRequest("Vai trò phải là STAFF, FACILITY_MANAGER, BOM hoặc ADMIN (khách hàng tự đăng ký)");
        }
        return roleRepository.findByName(name)
                .orElseThrow(() -> badRequest("Không tìm thấy vai trò " + name));
    }

    private boolean needsFacility(String roleName) {
        return "STAFF".equals(roleName) || "FACILITY_MANAGER".equals(roleName);
    }

    // PR-04: STAFF/FM bắt buộc có cơ sở; BOM/ADMIN → null (bỏ qua facilityId gửi lên).
    // currentFacilityId: giữ nguyên cơ sở cũ thì cho qua dù cơ sở đó đã INACTIVE (để vẫn sửa được tên/SĐT);
    // chọn cơ sở MỚI thì cơ sở đó phải ACTIVE.
    private Facility resolveFacility(String roleName, Integer facilityId, Integer currentFacilityId) {
        if (!needsFacility(roleName)) {
            return null;
        }
        if (facilityId == null) {
            throw badRequest("Nhân viên / Quản lý cơ sở bắt buộc chọn cơ sở");
        }
        Facility facility = facilityRepository.findById(facilityId)
                .orElseThrow(() -> badRequest("Không tìm thấy cơ sở #" + facilityId));
        if (!"ACTIVE".equals(facility.getStatus()) && !facilityId.equals(currentFacilityId)) {
            throw badRequest("Cơ sở " + facility.getName() + " đang ngừng hoạt động");
        }
        return facility;
    }

    // PR-04: cơ sở đã có FM ACTIVE khác (khác userId) → 409. userId = null khi tạo mới.
    private void ensureNoOtherActiveManager(Facility facility, Integer userId) {
        if (facility == null) {
            return;
        }
        for (User manager : userRepository.findByRole_NameAndFacilityIdAndStatus(
                "FACILITY_MANAGER", facility.getId(), "ACTIVE")) {
            if (!manager.getId().equals(userId)) {
                throw new AdminException(HttpStatus.CONFLICT, "FACILITY_HAS_MANAGER",
                        "Cơ sở " + facility.getName() + " đã có quản lý " + manager.getFullName());
            }
        }
    }

    // PR-A4: trả câu cảnh báo nếu cơ sở không còn FM ACTIVE nào ngoài người đang bị khoá / chuyển đi
    private String managerMissingWarning(Integer facilityId, Integer leavingUserId) {
        if (facilityId == null) {
            return null;
        }
        boolean hasOther = userRepository.findByRole_NameAndFacilityIdAndStatus("FACILITY_MANAGER", facilityId, "ACTIVE")
                .stream().anyMatch(m -> !m.getId().equals(leavingUserId));
        return hasOther ? null : "Cơ sở " + facilityLabel(facilityId) + " chưa có quản lý";
    }

    // PR-A7: luôn còn >= 1 Admin ACTIVE (không tính system)
    private void ensureNotLastActiveAdmin() {
        long activeAdmins = userRepository.countByRole_NameAndStatusAndEmailNot(
                "ADMIN", "ACTIVE", ActivityLogService.SYSTEM_EMAIL);
        if (activeAdmins <= 1) {
            throw new AdminException(HttpStatus.CONFLICT, "LAST_ACTIVE_ADMIN",
                    "Hệ thống phải còn ít nhất 1 Quản trị viên đang hoạt động");
        }
    }

    // PR-A2, PR-A3, PR-06 (tính cả OVERDUE đã nhận)
    private void ensureNoHoldingTask(User staff) {
        if (staffTaskRepository.existsByStaff_IdAndStatusIn(staff.getId(), HOLDING_TASK_STATUSES)) {
            throw new AdminException(HttpStatus.CONFLICT, "STAFF_HAS_TASK_IN_PROGRESS",
                    "Nhân viên đang giữ task chưa hoàn thành — Quản lý cơ sở cần gỡ người nhận trước");
        }
    }

    // PR-A5
    private void ensureNoActiveRental(User customer) {
        if (reservationRepository.existsByCustomer_IdAndStatusIn(customer.getId(), ACTIVE_RESERVATION_STATUSES)
                || rentalContractRepository.existsByCustomer_IdAndStatusIn(customer.getId(), ACTIVE_CONTRACT_STATUSES)) {
            throw new AdminException(HttpStatus.CONFLICT, "CUSTOMER_HAS_ACTIVE_RENTAL",
                    "Khách hàng đang có đơn / hợp đồng còn hiệu lực, không thể khoá");
        }
    }

    private String validateFullName(String raw) {
        String fullName = raw == null ? "" : raw.trim();
        if (fullName.isEmpty() || fullName.length() > FULL_NAME_MAX_LENGTH) {
            throw badRequest("Họ tên bắt buộc, tối đa " + FULL_NAME_MAX_LENGTH + " ký tự");
        }
        return fullName;
    }

    private String validatePhone(String raw) {
        String phone = raw == null ? "" : raw.trim();
        if (!PHONE_PATTERN.matcher(phone).matches()) {
            throw badRequest("Số điện thoại phải gồm 10 chữ số, bắt đầu bằng 0");
        }
        return phone;
    }

    private Facility loadFacility(Integer facilityId) {
        return facilityId == null ? null : facilityRepository.findById(facilityId).orElse(null);
    }

    private String facilityLabel(Integer facilityId) {
        Facility facility = loadFacility(facilityId);
        if (facility != null) {
            return facility.getName();
        }
        return facilityId == null ? "—" : "#" + facilityId;
    }

    private String blankToNull(String value) {
        return (value == null || value.isBlank()) ? null : value.trim();
    }

    // Trả về (không tự throw) để viết được "throw badRequest(...)" và ".orElseThrow(() -> badRequest(...))"
    private AdminException badRequest(String message) {
        return new AdminException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", message);
    }

    // PR-A9, PR-A10: mọi CRUD của Admin đều log, target_entity = 'users'
    private void log(Integer actorUserId, String action, Integer targetUserId) {
        activityLogService.log(actorUserId, action, "users", String.valueOf(targetUserId));
    }

    private AdminUserResponse toResponse(User user, Facility facility) {
        return new AdminUserResponse(
                user.getId(),
                user.getFullName(),
                user.getEmail(),
                user.getPhone(),
                user.getRole().getName(),
                user.getStatus(),
                user.getFacilityId(),
                facility == null ? null : facility.getCode(),
                facility == null ? null : facility.getName(),
                user.getCreatedAt());
    }
}
