package com.queenkho.api.controller;

import com.queenkho.api.dto.LoginHistoryResponse;
import com.queenkho.api.dto.PageResponse;
import com.queenkho.api.service.LoginHistoryService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

// Admin: lịch sử đăng nhập
@RestController
@RequestMapping("/api/v1/admin/login-history")
public class AdminLoginHistoryController {

    private final LoginHistoryService loginHistoryService;

    public AdminLoginHistoryController(LoginHistoryService loginHistoryService) {
        this.loginHistoryService = loginHistoryService;
    }

    // GET /api/v1/admin/login-history?keyword=&eventType=LOGIN_FAILED&from=2026-10-01&to=2026-10-26&page=0&size=20
    // actorUserId do AccessControlFilter điền từ token
    @GetMapping
    public ResponseEntity<PageResponse<LoginHistoryResponse>> search(
            @RequestParam(required = false) Integer actorUserId,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String eventType,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(loginHistoryService.search(actorUserId, keyword, eventType, from, to, page, size));
    }
}
