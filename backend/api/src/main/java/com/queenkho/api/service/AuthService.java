package com.queenkho.api.service;


import com.queenkho.api.dto.LoginRequest;
import com.queenkho.api.dto.LoginResponse;
import com.queenkho.api.entity.Facility;
import com.queenkho.api.entity.User;
import com.queenkho.api.exception.AuthException;
import com.queenkho.api.repository.FacilityRepository;
import com.queenkho.api.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    // SĐT Việt Nam 10 số, bắt đầu bằng 0 (giống AdminUserService / FacilityStaffService)
    public static final java.util.regex.Pattern PHONE_PATTERN = java.util.regex.Pattern.compile("^0\\d{9}$");
    // CCCD 12 chữ số, hoặc hộ chiếu 1 chữ cái + 7–8 chữ số (trang đặt kho ghi "CCCD / Passport")
    public static final java.util.regex.Pattern CCCD_PATTERN = java.util.regex.Pattern.compile("^(\\d{12}|[A-Za-z]\\d{7,8})$");

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private FacilityRepository facilityRepository;

    @Autowired
    private SessionTokenService sessionTokenService;

    public LoginResponse login(LoginRequest request) {
        // PR-L3: trim email; thiếu email / mật khẩu → 400
        String email = (request == null || request.getEmail() == null) ? "" : request.getEmail().trim();
        String password = (request == null || request.getPassword() == null) ? "" : request.getPassword();
        if (email.isEmpty() || password.isEmpty()) {
            throw new AuthException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Vui lòng nhập email và mật khẩu");
        }

        // PR-L2: sai email hay sai mật khẩu đều cùng 1 lỗi → không lộ "email này có tồn tại"
        User user = userRepository.findByEmail(email).orElse(null);
        if (user == null || !passwordEncoder.matches(password, user.getPassword())) {
            throw new AuthException(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "Email hoặc mật khẩu không đúng");
        }

        // UC-08 / PR-L1: chỉ báo bị khoá SAU KHI mật khẩu đúng (người đoán mò không biết tài khoản bị khoá)
        if ("LOCKED".equals(user.getStatus())) {
            throw new AuthException(HttpStatus.FORBIDDEN, "ACCOUNT_LOCKED",
                    "Tài khoản đã bị khoá, vui lòng liên hệ quản trị viên");
        }
        if ("DISABLED".equals(user.getStatus())) {
            throw new AuthException(HttpStatus.FORBIDDEN, "ACCOUNT_DISABLED", "Tài khoản đã bị vô hiệu hoá");
        }

        String token = sessionTokenService.create(user.getId());

        // UC-16: trả kèm cơ sở để header Staff/Manager hiển thị tên cơ sở
        String facilityName = user.getFacilityId() == null ? null
                : facilityRepository.findById(user.getFacilityId()).map(Facility::getName).orElse(null);

        return new LoginResponse(token, user.getRole().getName(), user.getId(), user.getFullName(),
                user.getFacilityId(), facilityName, user.getPhone(), user.getCccd());

    }

    @Autowired
    private com.queenkho.api.repository.RoleRepository roleRepository;

    @Autowired(required = false)
    private ActivityLogService activityLogService;

    public void register(com.queenkho.api.dto.RegisterRequest request) {
        // (12/11/2026, góp ý test product) SĐT Việt Nam: đúng 10 chữ số, bắt đầu bằng 0 — cùng luật với Admin / FM tạo tài khoản
        String phone = request.getPhone() == null ? "" : request.getPhone().trim();
        if (!PHONE_PATTERN.matcher(phone).matches()) {
            throw new RuntimeException("Số điện thoại phải gồm đúng 10 chữ số và bắt đầu bằng số 0");
        }
        if (request.getFullName() == null || request.getFullName().trim().length() < 2) {
            throw new RuntimeException("Họ và tên phải có ít nhất 2 ký tự");
        }
        if (userRepository.findByEmail(request.getEmail()).isPresent()) {
            throw new RuntimeException("Email này đã được sử dụng");
        }

        com.queenkho.api.entity.Role customerRole = roleRepository.findByName("CUSTOMER")
                .orElseThrow(() -> new RuntimeException("Lỗi hệ thống: Không tìm thấy Role Customer"));

        User newUser = new User();
        newUser.setEmail(request.getEmail().trim());
        newUser.setFullName(request.getFullName().trim());
        newUser.setPhone(phone);
        newUser.setPassword(passwordEncoder.encode(request.getPassword()));
        newUser.setRole(customerRole);
        newUser.setStatus("ACTIVE");

        userRepository.save(newUser);
    }

    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public com.queenkho.api.dto.UserProfileResponse getProfile(Integer userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AuthException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "Không tìm thấy người dùng"));
        return toProfileResponse(user);
    }

    @org.springframework.transaction.annotation.Transactional
    public com.queenkho.api.dto.UserProfileResponse updateProfile(Integer userId, com.queenkho.api.dto.UpdateProfileRequest request) {
        if (request == null) {
            throw new AuthException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Dữ liệu cập nhật không hợp lệ");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AuthException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "Không tìm thấy người dùng"));

        String fullName = request.getFullName() == null ? "" : request.getFullName().trim();
        if (fullName.length() < 2 || fullName.length() > 100) {
            throw new AuthException(HttpStatus.BAD_REQUEST, "INVALID_FULL_NAME", "Họ và tên phải từ 2 đến 100 ký tự");
        }

        String phone = request.getPhone() == null ? "" : request.getPhone().trim();
        if (!PHONE_PATTERN.matcher(phone).matches()) {
            throw new AuthException(HttpStatus.BAD_REQUEST, "INVALID_PHONE", "Số điện thoại phải gồm đúng 10 chữ số và bắt đầu bằng số 0");
        }

        String cccd = request.getCccd() == null ? "" : request.getCccd().trim();
        if (!cccd.isEmpty() && !CCCD_PATTERN.matcher(cccd).matches()) {
            throw new AuthException(HttpStatus.BAD_REQUEST, "INVALID_CCCD", "CCCD phải gồm đúng 12 chữ số (hoặc hộ chiếu gồm 1 chữ cái và 7–8 chữ số)");
        }

        user.setFullName(fullName);
        user.setPhone(phone);
        user.setCccd(cccd.isEmpty() ? null : cccd);
        User saved = userRepository.save(user);

        if (activityLogService != null) {
            activityLogService.log(userId,
                    "[PROFILE_UPDATE] Người dùng " + saved.getFullName() + " cập nhật thông tin hồ sơ cá nhân",
                    "users", String.valueOf(userId));
        }

        return toProfileResponse(saved);
    }

    @org.springframework.transaction.annotation.Transactional
    public void changePassword(Integer userId, com.queenkho.api.dto.ChangePasswordRequest request) {
        String currentPwd = request != null && request.getCurrentPassword() != null ? request.getCurrentPassword() : "";
        String newPwd = request != null && request.getNewPassword() != null ? request.getNewPassword() : "";
        if (currentPwd.isEmpty() || newPwd.isEmpty()) {
            throw new AuthException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Vui lòng nhập đầy đủ mật khẩu hiện tại và mật khẩu mới");
        }
        if (newPwd.length() < 6) {
            throw new AuthException(HttpStatus.BAD_REQUEST, "WEAK_PASSWORD", "Mật khẩu mới phải có ít nhất 6 ký tự");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AuthException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "Không tìm thấy người dùng"));

        if (!passwordEncoder.matches(currentPwd, user.getPassword())) {
            throw new AuthException(HttpStatus.BAD_REQUEST, "INVALID_CURRENT_PASSWORD", "Mật khẩu hiện tại không chính xác");
        }
        if (passwordEncoder.matches(newPwd, user.getPassword())) {
            throw new AuthException(HttpStatus.BAD_REQUEST, "SAME_PASSWORD", "Mật khẩu mới phải khác mật khẩu hiện tại");
        }

        user.setPassword(passwordEncoder.encode(newPwd));
        userRepository.save(user);

        if (activityLogService != null) {
            activityLogService.log(userId,
                    "[PASSWORD_CHANGE] Người dùng " + user.getFullName() + " đã đổi mật khẩu tài khoản",
                    "users", String.valueOf(userId));
        }
    }

    private com.queenkho.api.dto.UserProfileResponse toProfileResponse(User user) {
        String facilityName = user.getFacilityId() == null ? null
                : facilityRepository.findById(user.getFacilityId()).map(Facility::getName).orElse(null);
        return com.queenkho.api.dto.UserProfileResponse.builder()
                .userId(user.getId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .phone(user.getPhone())
                .cccd(user.getCccd())
                .role(user.getRole() != null ? user.getRole().getName() : null)
                .facilityId(user.getFacilityId())
                .facilityName(facilityName)
                .status(user.getStatus())
                .createdAt(user.getCreatedAt())
                .build();
    }
}


