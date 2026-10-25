package com.queenkho.api.controller;

import com.queenkho.api.dto.ActivityLogResponse;
import com.queenkho.api.dto.PageResponse;
import com.queenkho.api.service.AdminActivityLogService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

// UC-31: Nhật ký hoạt động (Admin) — chỉ có GET (PR-07: không sửa / xoá log).
// Lỗi AdminException → AdminExceptionHandler trả { error, message }.
@RestController
@RequestMapping("/api/v1/admin/activity-logs")
public class AdminActivityLogController {

    @Autowired
    private AdminActivityLogService adminActivityLogService;

    // ──────────────────────────────────────────────────────
    // UC-31 API 1: Danh sách nhật ký (lọc + phân trang)
    // GET /api/v1/admin/activity-logs?actorUserId=&userId=&actor=&role=&targetEntity=&targetId=
    //                                 &keyword=&from=2026-10-01&to=2026-10-25&page=0&size=20
    // ──────────────────────────────────────────────────────
    @GetMapping
    public ResponseEntity<PageResponse<ActivityLogResponse>> getLogs(
            @RequestParam(required = false) Integer actorUserId,
            @RequestParam(required = false) Integer userId,
            @RequestParam(required = false) String actor,
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String targetEntity,
            @RequestParam(required = false) String targetId,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(adminActivityLogService.getLogs(actorUserId, userId, actor, role,
                targetEntity, targetId, keyword, from, to, page, size));
    }

    // ──────────────────────────────────────────────────────
    // UC-31 API 2: Các loại đối tượng có trong log (dropdown lọc)
    // GET /api/v1/admin/activity-logs/target-entities?actorUserId=
    // ──────────────────────────────────────────────────────
    @GetMapping("/target-entities")
    public ResponseEntity<List<String>> getTargetEntities(@RequestParam(required = false) Integer actorUserId) {
        return ResponseEntity.ok(adminActivityLogService.getTargetEntities(actorUserId));
    }
}
