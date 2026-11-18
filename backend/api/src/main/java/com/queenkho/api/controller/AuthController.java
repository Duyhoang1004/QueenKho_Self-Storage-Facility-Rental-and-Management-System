package com.queenkho.api.controller;

import com.queenkho.api.dto.LoginRequest;
import com.queenkho.api.dto.LoginResponse;
import com.queenkho.api.exception.AuthException;
import com.queenkho.api.service.AuthService;
import com.queenkho.api.service.LoginHistoryService;
import com.queenkho.api.service.SessionTokenService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {
    @Autowired
    private AuthService authService;

    @Autowired
    private LoginHistoryService loginHistoryService;

    @Autowired
    private SessionTokenService sessionTokenService;

    @Autowired
    private com.queenkho.api.service.NotificationService notificationService;

    @Autowired
    private com.queenkho.api.security.CurrentUserProvider currentUser;

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@RequestBody(required = false) LoginRequest request,
                                               HttpServletRequest http) {
        String email = request == null || request.getEmail() == null ? "" : request.getEmail().trim();
        try {
            LoginResponse response = authService.login(request);
            // Admin: lịch sử đăng nhập (lỗi ghi lịch sử không làm hỏng đăng nhập)
            loginHistoryService.recordSuccess(response.getUserId(), email, http);
            if ("ADMIN".equals(response.getRole())) {
                if (notificationService != null) notificationService.generateAdminLoginSummary(response.getUserId());
            }
            return ResponseEntity.ok(response);
        } catch (AuthException ex) {
            // Thiếu email / mật khẩu là lỗi nhập liệu, không tính là 1 lần đăng nhập
            if (!"INVALID_INPUT".equals(ex.getCode())) {
                loginHistoryService.recordFailure(email, ex.getCode(), http);
            }
            throw ex;
        }
    }

    // Đăng xuất: huỷ token phía server + ghi lịch sử. Gọi lại nhiều lần vẫn trả 200.
    @PostMapping("/logout")
    public ResponseEntity<Map<String, String>> logout(HttpServletRequest http) {
        String authorization = http.getHeader("Authorization");
        Integer userId = sessionTokenService.findUserId(authorization);
        sessionTokenService.revoke(authorization);
        if (userId != null) {
            loginHistoryService.recordLogout(userId, http);
        }
        return ResponseEntity.ok(Map.of("message", "Đã đăng xuất"));
    }

    // UC-01 / PR-L1..L3: @ExceptionHandler đặt TRONG controller → chỉ áp dụng cho AuthController
    @ExceptionHandler(AuthException.class)
    public ResponseEntity<Map<String, String>> handleAuthException(AuthException ex) {
        return ResponseEntity.status(ex.getStatus())
                .body(Map.of("error", ex.getCode(), "message", ex.getMessage()));
    }

    @PostMapping("/register")
    public ResponseEntity<?> registerUser(@jakarta.validation.Valid @RequestBody com.queenkho.api.dto.RegisterRequest request) {
        try {
            authService.register(request);
            return ResponseEntity.ok("Đăng ký tài khoản thành công!");
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @org.springframework.web.bind.annotation.GetMapping("/profile")
    public ResponseEntity<com.queenkho.api.dto.UserProfileResponse> getProfile() {
        return ResponseEntity.ok(authService.getProfile(currentUser.require().id()));
    }

    @org.springframework.web.bind.annotation.PutMapping("/profile")
    public ResponseEntity<com.queenkho.api.dto.UserProfileResponse> updateProfile(
            @RequestBody(required = false) com.queenkho.api.dto.UpdateProfileRequest request) {
        return ResponseEntity.ok(authService.updateProfile(currentUser.require().id(), request));
    }

    @PostMapping("/change-password")
    public ResponseEntity<Map<String, String>> changePassword(
            @RequestBody(required = false) com.queenkho.api.dto.ChangePasswordRequest request) {
        authService.changePassword(currentUser.require().id(), request);
        return ResponseEntity.ok(Map.of("message", "Đổi mật khẩu thành công"));
    }
}
