package com.queenkho.api.controller;

import com.queenkho.api.exception.StaffTaskException;
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

    // UC-17: Staff nhận việc
    // POST /api/v1/staff-tasks/12/claim?staffId=5
    @PostMapping("/{id}/claim")
    public ResponseEntity<?> claim(@PathVariable Integer id, @RequestParam(required = false) Integer staffId) {
        try {
            return ResponseEntity.ok(staffTaskService.claimTask(id, staffId));
        } catch (StaffTaskException e) {
            return toError(e);
        }
    }

    // UC-17: Facility Manager gỡ người nhận, task về OPEN
    // POST /api/v1/staff-tasks/12/unassign?managerId=3
    @PostMapping("/{id}/unassign")
    public ResponseEntity<?> unassign(@PathVariable Integer id, @RequestParam(required = false) Integer managerId) {
        try {
            return ResponseEntity.ok(staffTaskService.unassignTask(id, managerId));
        } catch (StaffTaskException e) {
            return toError(e);
        }
    }

    private ResponseEntity<?> toError(StaffTaskException e) {
        return ResponseEntity.status(e.getStatus()).body(Map.of("error", e.getCode(), "message", e.getMessage()));
    }
}
