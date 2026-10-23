package com.queenkho.api.controller;

import com.queenkho.api.dto.*;
import com.queenkho.api.service.FacilityStaffService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

// UC-32: Quản lý nhân viên chi nhánh cơ sở (Facility Staff Management)
@RestController
@RequestMapping("/api/v1/manager/staff")
public class FacilityStaffController {

    @Autowired
    private FacilityStaffService facilityStaffService;

    // ──────────────────────────────────────────────────────
    // UC-32 API 1: Danh sách nhân viên cơ sở kèm thống kê task
    // GET /api/v1/manager/staff?facilityId=1
    // ──────────────────────────────────────────────────────
    @GetMapping
    public ResponseEntity<List<FacilityStaffResponse>> getStaff(
            @RequestParam(required = false) Integer facilityId) {
        return ResponseEntity.ok(facilityStaffService.getStaffByFacility(facilityId));
    }

    // ──────────────────────────────────────────────────────
    // UC-32 API 2: Tạo tài khoản nhân viên mới tại cơ sở
    // POST /api/v1/manager/staff?facilityId=1&actorUserId=...
    // ──────────────────────────────────────────────────────
    @PostMapping
    public ResponseEntity<FacilityStaffResponse> createStaff(
            @RequestBody(required = false) CreateFacilityStaffRequest request,
            @RequestParam(required = false) Integer actorUserId,
            @RequestParam(required = false) Integer facilityId) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(facilityStaffService.createStaff(request, actorUserId, facilityId));
    }

    // ──────────────────────────────────────────────────────
    // UC-32 API 3: Khóa / Mở khóa tài khoản nhân viên
    // PATCH /api/v1/manager/staff/{id}/status?facilityId=1&actorUserId=...
    // ──────────────────────────────────────────────────────
    @PatchMapping("/{id}/status")
    public ResponseEntity<FacilityStaffResponse> changeStatus(
            @PathVariable Integer id,
            @RequestBody(required = false) UpdateFacilityStaffStatusRequest request,
            @RequestParam(required = false) Integer actorUserId,
            @RequestParam(required = false) Integer facilityId) {
        return ResponseEntity.ok(facilityStaffService.changeStatus(id, request, actorUserId, facilityId));
    }

    // ──────────────────────────────────────────────────────
    // UC-32 API 4: Đặt lại mật khẩu nhân viên
    // PUT /api/v1/manager/staff/{id}/password?facilityId=1&actorUserId=...
    // ──────────────────────────────────────────────────────
    @PutMapping("/{id}/password")
    public ResponseEntity<Map<String, String>> resetPassword(
            @PathVariable Integer id,
            @RequestBody(required = false) ResetFacilityStaffPasswordRequest request,
            @RequestParam(required = false) Integer actorUserId,
            @RequestParam(required = false) Integer facilityId) {
        facilityStaffService.resetPassword(id, request, actorUserId, facilityId);
        return ResponseEntity.ok(Map.of("message", "Đặt lại mật khẩu nhân viên thành công"));
    }
}

