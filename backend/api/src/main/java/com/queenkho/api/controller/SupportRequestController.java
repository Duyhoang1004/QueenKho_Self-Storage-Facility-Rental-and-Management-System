package com.queenkho.api.controller;

import com.queenkho.api.dto.CreateSupportRequestDto;
import com.queenkho.api.dto.ReopenSupportRequestDto;
import com.queenkho.api.exception.StaffTaskException;
import com.queenkho.api.security.CurrentUserProvider;
import com.queenkho.api.service.CompensationClaimService;
import com.queenkho.api.service.SupportRequestService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * UC-26: Gửi và quản lý yêu cầu hỗ trợ (Customer).
 */
@RestController
@RequestMapping("/api/v1/support-requests")
public class SupportRequestController {

    @Autowired
    private SupportRequestService supportRequestService;

    @Autowired
    private CompensationClaimService compensationClaimService;

    @Autowired(required = false)
    private CurrentUserProvider currentUser;

    // ──────────────────────────────────────────────────────
    // UC-26 API 1: Danh sách hợp đồng đủ điều kiện gửi hỗ trợ (PR-51, PR-S2)
    // GET /api/v1/support-requests/eligible-contracts?customerId=...
    // ──────────────────────────────────────────────────────
    @GetMapping("/eligible-contracts")
    public ResponseEntity<?> getEligibleContracts(
            @RequestParam(required = false) Integer customerId,
            @RequestHeader(value = "X-User-Id", required = false) Integer headerUserId) {
        try {
            Integer effectiveCustomerId = customerId != null ? customerId : headerUserId;
            return ResponseEntity.ok(supportRequestService.getEligibleContracts(effectiveCustomerId));
        } catch (StaffTaskException e) {
            return toError(e);
        }
    }

    // ──────────────────────────────────────────────────────
    // UC-26 API 2: Danh sách ticket của khách hàng (PR-S9)
    // GET /api/v1/support-requests?customerId=...&status=...&contractId=...
    // ──────────────────────────────────────────────────────
    @GetMapping
    public ResponseEntity<?> getCustomerTickets(
            @RequestParam(required = false) Integer customerId,
            @RequestHeader(value = "X-User-Id", required = false) Integer headerUserId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Integer contractId) {
        try {
            Integer effectiveCustomerId = customerId != null ? customerId : headerUserId;
            return ResponseEntity.ok(supportRequestService.getCustomerTickets(effectiveCustomerId, status, contractId));
        } catch (StaffTaskException e) {
            return toError(e);
        }
    }

    // ──────────────────────────────────────────────────────
    // UC-26 API 3: Tạo ticket hỗ trợ mới + tự động sinh task SUPPORT (PR-51, PR-S1, PR-S2, PR-34)
    // POST /api/v1/support-requests?customerId=...
    // ──────────────────────────────────────────────────────
    @PostMapping
    public ResponseEntity<?> createTicket(
            @RequestParam(required = false) Integer customerId,
            @RequestHeader(value = "X-User-Id", required = false) Integer headerUserId,
            @RequestBody(required = false) CreateSupportRequestDto request) {
        try {
            Integer effectiveCustomerId = customerId != null ? customerId : headerUserId;
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(supportRequestService.createTicket(effectiveCustomerId, request));
        } catch (StaffTaskException e) {
            return toError(e);
        }
    }

    // ──────────────────────────────────────────────────────
    // UC-26 API 4: Khách hủy ticket OPEN / IN_PROGRESS → CLOSED, task CANCELLED (PR-S3, PR-S3a)
    // POST /api/v1/support-requests/{id}/cancel?customerId=...   body (tuỳ chọn): { "reason": "..." }
    // ──────────────────────────────────────────────────────
    @PostMapping("/{id}/cancel")
    public ResponseEntity<?> cancelTicket(
            @PathVariable Integer id,
            @RequestParam(required = false) Integer customerId,
            @RequestHeader(value = "X-User-Id", required = false) Integer headerUserId,
            @RequestBody(required = false) Map<String, String> body) {
        try {
            Integer effectiveCustomerId = customerId != null ? customerId : headerUserId;
            String reason = body != null ? body.get("reason") : null;
            return ResponseEntity.ok(supportRequestService.cancelTicket(id, effectiveCustomerId, reason));
        } catch (StaffTaskException e) {
            return toError(e);
        }
    }

    // ──────────────────────────────────────────────────────
    // UC-26 API 5: Khách xác nhận "Đã ổn" khi ticket RESOLVED → CLOSED (PR-52)
    // POST /api/v1/support-requests/{id}/confirm?customerId=...
    // ──────────────────────────────────────────────────────
    @PostMapping("/{id}/confirm")
    public ResponseEntity<?> confirmTicket(
            @PathVariable Integer id,
            @RequestParam(required = false) Integer customerId,
            @RequestHeader(value = "X-User-Id", required = false) Integer headerUserId) {
        try {
            Integer effectiveCustomerId = customerId != null ? customerId : headerUserId;
            return ResponseEntity.ok(supportRequestService.confirmResolvedTicket(id, effectiveCustomerId));
        } catch (StaffTaskException e) {
            return toError(e);
        }
    }

    // ──────────────────────────────────────────────────────
    // UC-26 API 6: Khách báo "Chưa xong" → OPEN + sinh task SUPPORT mới (PR-52)
    // POST /api/v1/support-requests/{id}/reopen?customerId=...
    // ──────────────────────────────────────────────────────
    @PostMapping("/{id}/reopen")
    public ResponseEntity<?> reopenTicket(
            @PathVariable Integer id,
            @RequestParam(required = false) Integer customerId,
            @RequestHeader(value = "X-User-Id", required = false) Integer headerUserId,
            @RequestBody(required = false) ReopenSupportRequestDto request) {
        try {
            Integer effectiveCustomerId = customerId != null ? customerId : headerUserId;
            return ResponseEntity.ok(supportRequestService.reopenTicket(id, effectiveCustomerId, request));
        } catch (StaffTaskException e) {
            return toError(e);
        }
    }

    // ──────────────────────────────────────────────────────
    // Xác nhận 2 chiều cho hồ sơ bồi thường (Idea 1, Idea 2, Idea 3)
    // ──────────────────────────────────────────────────────
    private Integer resolveCustomerId(Integer customerId, Integer headerUserId) {
        if (currentUser != null && currentUser.current() != null) {
            return currentUser.current().id();
        }
        return customerId != null ? customerId : headerUserId;
    }

    @PostMapping("/claims/{claimId}/confirm-inspection")
    public ResponseEntity<?> confirmClaimInspection(
            @PathVariable Integer claimId,
            @RequestParam(required = false) Integer customerId,
            @RequestHeader(value = "X-User-Id", required = false) Integer headerUserId) {
        try {
            return ResponseEntity.ok(compensationClaimService.confirmInspection(claimId, resolveCustomerId(customerId, headerUserId)));
        } catch (StaffTaskException e) {
            return toError(e);
        }
    }

    @PostMapping("/claims/{claimId}/dispute-inspection")
    public ResponseEntity<?> disputeClaimInspection(
            @PathVariable Integer claimId,
            @RequestParam(required = false) Integer customerId,
            @RequestHeader(value = "X-User-Id", required = false) Integer headerUserId,
            @RequestBody(required = false) Map<String, String> body) {
        try {
            String reason = body != null ? body.get("reason") : null;
            return ResponseEntity.ok(compensationClaimService.disputeInspection(claimId, resolveCustomerId(customerId, headerUserId), reason));
        } catch (StaffTaskException e) {
            return toError(e);
        }
    }

    @PostMapping("/claims/{claimId}/confirm-decision")
    public ResponseEntity<?> confirmClaimDecision(
            @PathVariable Integer claimId,
            @RequestParam(required = false) Integer customerId,
            @RequestHeader(value = "X-User-Id", required = false) Integer headerUserId) {
        try {
            return ResponseEntity.ok(compensationClaimService.confirmDecision(claimId, resolveCustomerId(customerId, headerUserId)));
        } catch (StaffTaskException e) {
            return toError(e);
        }
    }

    @PostMapping("/claims/{claimId}/dispute-decision")
    public ResponseEntity<?> disputeClaimDecision(
            @PathVariable Integer claimId,
            @RequestParam(required = false) Integer customerId,
            @RequestHeader(value = "X-User-Id", required = false) Integer headerUserId,
            @RequestBody(required = false) Map<String, String> body) {
        try {
            String reason = body != null ? body.get("reason") : null;
            return ResponseEntity.ok(compensationClaimService.disputeDecision(claimId, resolveCustomerId(customerId, headerUserId), reason));
        } catch (StaffTaskException e) {
            return toError(e);
        }
    }

    @PostMapping("/claims/{claimId}/confirm-receipt")
    public ResponseEntity<?> confirmClaimReceipt(
            @PathVariable Integer claimId,
            @RequestParam(required = false) Integer customerId,
            @RequestHeader(value = "X-User-Id", required = false) Integer headerUserId) {
        try {
            return ResponseEntity.ok(compensationClaimService.confirmReceipt(claimId, resolveCustomerId(customerId, headerUserId)));
        } catch (StaffTaskException e) {
            return toError(e);
        }
    }

    @PostMapping("/claims/{claimId}/dispute-receipt")
    public ResponseEntity<?> disputeClaimReceipt(
            @PathVariable Integer claimId,
            @RequestParam(required = false) Integer customerId,
            @RequestHeader(value = "X-User-Id", required = false) Integer headerUserId,
            @RequestBody(required = false) Map<String, String> body) {
        try {
            String reason = body != null ? body.get("reason") : null;
            return ResponseEntity.ok(compensationClaimService.disputeReceipt(claimId, resolveCustomerId(customerId, headerUserId), reason));
        } catch (StaffTaskException e) {
            return toError(e);
        }
    }

    @PostMapping("/claims/{claimId}/simulate-auto-confirm")
    public ResponseEntity<?> simulateClaimReceiptAutoConfirm(
            @PathVariable Integer claimId,
            @RequestParam(required = false) Integer customerId,
            @RequestHeader(value = "X-User-Id", required = false) Integer headerUserId) {
        try {
            return ResponseEntity.ok(compensationClaimService.simulateReceiptAutoConfirm(claimId, resolveCustomerId(customerId, headerUserId)));
        } catch (StaffTaskException e) {
            return toError(e);
        }
    }

    private ResponseEntity<?> toError(StaffTaskException e) {
        return ResponseEntity.status(e.getStatus()).body(Map.of("error", e.getCode(), "message", e.getMessage()));
    }
}
