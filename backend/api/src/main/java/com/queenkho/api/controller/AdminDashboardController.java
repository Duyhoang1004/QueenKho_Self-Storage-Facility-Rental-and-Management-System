package com.queenkho.api.controller;

import com.queenkho.api.dto.AdminDashboardResponse;
import com.queenkho.api.service.AdminDashboardService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

// UC-31: Trang tổng quan Admin (/admin)
@RestController
@RequestMapping("/api/v1/admin/dashboard")
public class AdminDashboardController {

    @Autowired
    private AdminDashboardService adminDashboardService;

    // GET /api/v1/admin/dashboard?actorUserId=...
    @GetMapping
    public ResponseEntity<AdminDashboardResponse> getDashboard(@RequestParam(required = false) Integer actorUserId) {
        return ResponseEntity.ok(adminDashboardService.getDashboard(actorUserId));
    }
}
