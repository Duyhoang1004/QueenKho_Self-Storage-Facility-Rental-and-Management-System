package com.queenkho.api.controller;

import com.queenkho.api.dto.CheckInRequest;
import com.queenkho.api.dto.CheckOutRequest;
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

    // UC-18: gợi ý mã PIN 6 số chưa bị dùng (nút "Sinh lại" trên form biên bản)
    // GET /api/v1/staff-tasks/pin-suggestion
    @GetMapping("/pin-suggestion")
    public ResponseEntity<?> suggestPin() {
        try {
            return ResponseEntity.ok(Map.of("accessPinCode", staffTaskService.suggestPin()));
        } catch (StaffTaskException e) {
            return toError(e);
        }
    }

    // UC-18 / UC-23: chi tiết task (kèm biên bản & sự cố nếu đã hoàn thành)
    // GET /api/v1/staff-tasks/12?userId=5
    // {id:\\d+}: chỉ khớp khi id là số → "/pin-suggestion" không bị hiểu nhầm thành id
    @GetMapping("/{id:\\d+}")
    public ResponseEntity<?> getDetail(@PathVariable Integer id, @RequestParam(required = false) Integer userId) {
        try {
            return ResponseEntity.ok(staffTaskService.getTaskDetail(id, userId));
        } catch (StaffTaskException e) {
            return toError(e);
        }
    }

    // UC-18: Staff check-in cho khách + lập biên bản bàn giao
    // POST /api/v1/staff-tasks/12/check-in?staffId=5   body: CheckInRequest
    @PostMapping("/{id}/check-in")
    public ResponseEntity<?> checkIn(@PathVariable Integer id,
                                     @RequestParam(required = false) Integer staffId,
                                     @RequestBody(required = false) CheckInRequest request) {
        try {
            return ResponseEntity.ok(staffTaskService.checkIn(id, staffId, request));
        } catch (StaffTaskException e) {
            return toError(e);
        }
    }

    // UC-23 & UC-24: Staff nghiệm thu trả kho + ghi nhận sự cố hư hỏng (nếu có)
    // POST /api/v1/staff-tasks/12/check-out?staffId=5   body: CheckOutRequest
    @PostMapping("/{id}/check-out")
    public ResponseEntity<?> checkOut(@PathVariable Integer id,
                                      @RequestParam(required = false) Integer staffId,
                                      @RequestBody(required = false) CheckOutRequest request) {
        try {
            return ResponseEntity.ok(staffTaskService.checkOut(id, staffId, request));
        } catch (StaffTaskException e) {
            return toError(e);
        }
    }

    // Staff báo cáo kết quả liên hệ khách hàng (No-Show workflow)
    // POST /api/v1/staff-tasks/12/contact-report
    @PostMapping("/{id}/contact-report")
    public ResponseEntity<?> submitContactReport(@PathVariable Integer id,
                                                 @RequestBody com.queenkho.api.dto.ContactReportRequest request) {
        try {
            return ResponseEntity.ok(staffTaskService.submitContactReport(id, request));
        } catch (StaffTaskException e) {
            return toError(e);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "INTERNAL_ERROR", "message", e.getMessage()));
        }
    }

    // Manager hoàn thành task hoàn tiền (REFUND) - PR-O15 & L-24
    // POST /api/v1/staff-tasks/{id}/complete-refund?managerId=3
    @PostMapping("/{id}/complete-refund")
    public ResponseEntity<?> completeRefund(@PathVariable Integer id,
                                           @RequestParam(required = false) Integer managerId,
                                           @RequestBody(required = false) com.queenkho.api.dto.CompleteRefundRequest request) {
        try {
            return ResponseEntity.ok(staffTaskService.completeRefundTask(id, managerId, request));
        } catch (StaffTaskException e) {
            return toError(e);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "BAD_REQUEST", "message", e.getMessage()));
        }
    }

    private ResponseEntity<?> toError(StaffTaskException e) {
        return ResponseEntity.status(e.getStatus()).body(Map.of("error", e.getCode(), "message", e.getMessage()));
    }
}
