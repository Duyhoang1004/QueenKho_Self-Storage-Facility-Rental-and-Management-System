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
                user.getFacilityId(), facilityName);

    }

    @Autowired
    private com.queenkho.api.repository.RoleRepository roleRepository;

    public void register(com.queenkho.api.dto.RegisterRequest request) {
        if (userRepository.findByEmail(request.getEmail()).isPresent()) {
            throw new RuntimeException("Email này đã được sử dụng");
        }

        com.queenkho.api.entity.Role customerRole = roleRepository.findByName("CUSTOMER")
                .orElseThrow(() -> new RuntimeException("Lỗi hệ thống: Không tìm thấy Role Customer"));

        User newUser = new User();
        newUser.setEmail(request.getEmail());
        newUser.setFullName(request.getFullName());
        newUser.setPhone(request.getPhone());
        newUser.setPassword(passwordEncoder.encode(request.getPassword()));
        newUser.setRole(customerRole);
        newUser.setStatus("ACTIVE");

        userRepository.save(newUser);
    }
}


