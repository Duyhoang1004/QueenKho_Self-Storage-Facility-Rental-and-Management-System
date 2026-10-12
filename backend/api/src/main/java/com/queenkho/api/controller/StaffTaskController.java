package com.queenkho.api.controller;

import com.queenkho.api.service.StaffTaskService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/staff-tasks")
public class StaffTaskController {

    @Autowired
    private StaffTaskService staffTaskService;

    // UC-16: Bảng công việc — dùng chung cho Staff và Facility Manager
    // GET /api/v1/staff-tasks?facilityId=1
    // GET /api/v1/staff-tasks?facilityId=1&status=OPEN
    @GetMapping
    public ResponseEntity<?> getBoard(@RequestParam Integer facilityId,
                                      @RequestParam(required = false) String status) {
        try {
            return ResponseEntity.ok(staffTaskService.getBoard(facilityId, status));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "INVALID_INPUT", "message", e.getMessage()));
        }
    }
}
