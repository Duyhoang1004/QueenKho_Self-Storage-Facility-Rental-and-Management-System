package com.queenkho.api.controller;

import com.queenkho.api.dto.RoleResponse;
import com.queenkho.api.dto.UpdateRoleRequest;
import com.queenkho.api.service.AdminRoleService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

// UC-03: Quản trị vai trò & phân quyền (Admin).
// Lỗi AdminException được AdminExceptionHandler đổi thành { error, message } → không cần try/catch ở đây.
@RestController
@RequestMapping("/api/v1/admin/roles")
public class AdminRoleController {

    @Autowired
    private AdminRoleService adminRoleService;

    // ──────────────────────────────────────────────────────
    // UC-03 API 1: Danh sách vai trò + số người dùng
    // GET /api/v1/admin/roles
    // ──────────────────────────────────────────────────────
    @GetMapping
    public ResponseEntity<List<RoleResponse>> getRoles() {
        return ResponseEntity.ok(adminRoleService.getRoles());
    }

    // ──────────────────────────────────────────────────────
    // UC-03 API 2: Sửa mô tả vai trò
    // PUT /api/v1/admin/roles/{id}?actorUserId=...   body: { "description": "..." }
    // ──────────────────────────────────────────────────────
    @PutMapping("/{id}")
    public ResponseEntity<RoleResponse> updateDescription(
            @PathVariable Integer id,
            @RequestBody(required = false) UpdateRoleRequest request,
            @RequestParam(required = false) Integer actorUserId) {
        return ResponseEntity.ok(adminRoleService.updateDescription(id, request, actorUserId));
    }
}
