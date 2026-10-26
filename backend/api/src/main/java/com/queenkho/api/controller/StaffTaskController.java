package com.queenkho.api.controller;

import com.queenkho.api.dto.CheckInRequest;
import com.queenkho.api.dto.CheckOutRequest;
import com.queenkho.api.dto.ExtendSupportTaskRequest;
import com.queenkho.api.dto.ResolveSupportTaskRequest;
import com.queenkho.api.exception.StaffTaskException;
import com.queenkho.api.security.CurrentUserProvider;
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

    // PR-90: người thao tác lấy từ token (AccessControlFilter đã ghi đè staffId / managerId / userId)
    @Autowired
    private CurrentUserProvider currentUser;

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

    // UC-17: Staff nhận việc (FM chỉ nhận được task hoàn tiền)
    // POST /api/v1/staff-tasks/12/claim
    @PostMapping("/{id}/claim")
    public ResponseEntity<?> claim(@PathVariable Integer id) {
        try {
            return ResponseEntity.ok(staffTaskService.claimTask(id, currentUser.require().id()));
        } catch (StaffTaskException e) {
            return toError(e);
        }
    }

    // Flow 5: Facility Manager giao task cho 1 nhân viên cùng cơ sở (hoặc đổi người đang làm)
    // POST /api/v1/staff-tasks/12/assign?staffId=13
    @PostMapping("/{id}/assign")
    public ResponseEntity<?> assign(@PathVariable Integer id, @RequestParam(required = false) Integer staffId) {
        try {
            return ResponseEntity.ok(staffTaskService.assignTask(id, currentUser.require().id(), staffId));
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

    // UC-18 / UC-23 / UC-27: chi tiết task (kèm biên bản, sự cố hoặc ticket hỗ trợ)
    // GET /api/v1/staff-tasks/12?userId=5
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

    // UC-27 / PR-S5: Staff hoàn tất xử lý yêu cầu hỗ trợ (SUPPORT)
    // POST /api/v1/staff-tasks/12/resolve-support?staffId=5   body: { "resolutionNote": "..." }
    @PostMapping("/{id}/resolve-support")
    public ResponseEntity<?> resolveSupport(@PathVariable Integer id,
                                            @RequestParam(required = false) Integer staffId,
                                            @RequestBody(required = false) ResolveSupportTaskRequest request) {
        try {
            return ResponseEntity.ok(staffTaskService.resolveSupportTask(id, staffId, request));
        } catch (StaffTaskException e) {
            return toError(e);
        }
    }

    // UC-27 / PR-S6: Staff cấp lại mã PIN 6 số cho ticket LOCK_ISSUE
    // POST /api/v1/staff-tasks/12/reset-pin?staffId=5
    @PostMapping("/{id}/reset-pin")
    public ResponseEntity<?> resetPin(@PathVariable Integer id,
                                      @RequestParam(required = false) Integer staffId) {
        try {
            return ResponseEntity.ok(staffTaskService.resetSupportContractPin(id, staffId));
        } catch (StaffTaskException e) {
            return toError(e);
        }
    }

    // UC-27 / PR-S4: Facility Manager gia hạn task SUPPORT đã quá hạn (giữ người nhận)
    // POST /api/v1/staff-tasks/12/extend-support?managerId=3   body: { "newDueDate": "2026-10-25", "reason": "..." }
    @PostMapping("/{id}/extend-support")
    public ResponseEntity<?> extendSupport(@PathVariable Integer id,
                                           @RequestParam(required = false) Integer managerId,
                                           @RequestBody(required = false) ExtendSupportTaskRequest request) {
        try {
            return ResponseEntity.ok(staffTaskService.extendSupportTask(id, managerId, request));
        } catch (StaffTaskException e) {
            return toError(e);
        }
    }

    // Staff báo cáo kết quả liên hệ khách hàng (No-Show workflow)
    // POST /api/v1/staff-tasks/12/contact-report
    @PostMapping("/{id}/contact-report")
    public ResponseEntity<?> submitContactReport(@PathVariable Integer id,
                                                 @RequestBody com.queenkho.api.dto.ContactReportRequest request) {
        if (request != null) {
            request.setStaffId(currentUser.require().id());
        }
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
                                           @RequestParam(required = false) Integer userId,
                                           @RequestBody(required = false) com.queenkho.api.dto.CompleteRefundRequest request) {
        try {
            Integer effectiveUserId = managerId != null ? managerId : userId;
            return ResponseEntity.ok(staffTaskService.completeRefundTask(id, effectiveUserId, request));
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
