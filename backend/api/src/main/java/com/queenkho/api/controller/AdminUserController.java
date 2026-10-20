package com.queenkho.api.controller;

import com.queenkho.api.dto.AdminUserResponse;
import com.queenkho.api.dto.CreateUserRequest;
import com.queenkho.api.dto.FacilityOptionResponse;
import com.queenkho.api.dto.PageResponse;
import com.queenkho.api.dto.ResetPasswordRequest;
import com.queenkho.api.dto.UpdateUserRequest;
import com.queenkho.api.dto.UpdateUserStatusRequest;
import com.queenkho.api.dto.UserActionResponse;
import com.queenkho.api.service.AdminUserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

// UC-08: Quản lý tài khoản người dùng (Admin).
// Lỗi AdminException → AdminExceptionHandler trả { error, message } → không cần try/catch.
@RestController
@RequestMapping("/api/v1/admin/users")
public class AdminUserController {

    @Autowired
    private AdminUserService adminUserService;

    // ──────────────────────────────────────────────────────
    // UC-08 API 1: Danh sách người dùng (lọc + phân trang)
    // GET /api/v1/admin/users?keyword=&role=&status=&facilityId=&page=0&size=20
    // ──────────────────────────────────────────────────────
    @GetMapping
    public ResponseEntity<PageResponse<AdminUserResponse>> getUsers(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Integer facilityId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(adminUserService.getUsers(keyword, role, status, facilityId, page, size));
    }

    // ──────────────────────────────────────────────────────
    // UC-08 API 2: Dropdown cơ sở (+ FM hiện tại)
    // GET /api/v1/admin/users/facility-options
    // ──────────────────────────────────────────────────────
    @GetMapping("/facility-options")
    public ResponseEntity<List<FacilityOptionResponse>> getFacilityOptions() {
        return ResponseEntity.ok(adminUserService.getFacilityOptions());
    }

    // ──────────────────────────────────────────────────────
    // UC-08 API 3: Tạo tài khoản nội bộ → 201 Created
    // POST /api/v1/admin/users?actorUserId=...
    // ──────────────────────────────────────────────────────
    @PostMapping
    public ResponseEntity<UserActionResponse> createUser(
            @RequestBody(required = false) CreateUserRequest request,
            @RequestParam(required = false) Integer actorUserId) {
        return ResponseEntity.status(HttpStatus.CREATED).body(adminUserService.createUser(request, actorUserId));
    }

    // ──────────────────────────────────────────────────────
    // UC-08 API 4: Sửa tên / SĐT / role / cơ sở
    // PUT /api/v1/admin/users/{id}?actorUserId=...
    // ──────────────────────────────────────────────────────
    @PutMapping("/{id}")
    public ResponseEntity<UserActionResponse> updateUser(
            @PathVariable Integer id,
            @RequestBody(required = false) UpdateUserRequest request,
            @RequestParam(required = false) Integer actorUserId) {
        return ResponseEntity.ok(adminUserService.updateUser(id, request, actorUserId));
    }

    // ──────────────────────────────────────────────────────
    // UC-08 API 5: Khoá / vô hiệu / mở lại
    // PATCH /api/v1/admin/users/{id}/status?actorUserId=...   body: { "status": "LOCKED", "reason": "..." }
    // ──────────────────────────────────────────────────────
    @PatchMapping("/{id}/status")
    public ResponseEntity<UserActionResponse> changeStatus(
            @PathVariable Integer id,
            @RequestBody(required = false) UpdateUserStatusRequest request,
            @RequestParam(required = false) Integer actorUserId) {
        return ResponseEntity.ok(adminUserService.changeStatus(id, request, actorUserId));
    }

    // ──────────────────────────────────────────────────────
    // UC-08 API 6: Đặt lại mật khẩu
    // PUT /api/v1/admin/users/{id}/password?actorUserId=...   body: { "newPassword": "..." }
    // ──────────────────────────────────────────────────────
    @PutMapping("/{id}/password")
    public ResponseEntity<UserActionResponse> resetPassword(
            @PathVariable Integer id,
            @RequestBody(required = false) ResetPasswordRequest request,
            @RequestParam(required = false) Integer actorUserId) {
        return ResponseEntity.ok(adminUserService.resetPassword(id, request, actorUserId));
    }
}
