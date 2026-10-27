


package com.queenkho.api.controller;

import com.queenkho.api.dto.*;
import com.queenkho.api.exception.FacilityException;
import com.queenkho.api.service.StorageUnitService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/storage-units")
@RequiredArgsConstructor
public class StorageUnitController {

    private final StorageUnitService storageUnitService;

    // PR-90: FM chỉ thao tác ô kho thuộc cơ sở của mình (danh sách đã bị AccessControlFilter khoá facilityId)
    private final com.queenkho.api.security.OwnershipGuard ownershipGuard;

    /**
     * UC-06: Lấy danh sách ô kho và bộ chỉ số KPI vận hành của cơ sở
     * GET /api/v1/storage-units?facilityId=1&status=AVAILABLE&floor=Tầng 1&keyword=A101
     */
    @GetMapping
    public ResponseEntity<StorageUnitListResponse> getStorageUnits(
            @RequestParam(required = false) Integer facilityId,
            @RequestHeader(value = "X-Facility-Id", required = false) Integer headerFacilityId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String floor,
            @RequestParam(required = false) Integer unitTypeId,
            @RequestParam(required = false) String keyword) {

        Integer effectiveFacilityId = facilityId != null ? facilityId : headerFacilityId;
        if (effectiveFacilityId == null) {
            // Mặc định Tân Bình (ID = 1) nếu chưa truyền
            effectiveFacilityId = 1;
        }

        StorageUnitListResponse response = storageUnitService.getStorageUnits(
                effectiveFacilityId, status, floor, unitTypeId, keyword
        );
        return ResponseEntity.ok(response);
    }

    /**
     * Chi tiết 1 ô kho
     * GET /api/v1/storage-units/{id}
     */
    @GetMapping("/{id}")
    public ResponseEntity<StorageUnitDetailResponse> getStorageUnitDetail(@PathVariable String id) {
        ownershipGuard.checkStorageUnit(id);
        return ResponseEntity.ok(storageUnitService.getStorageUnitDetail(id));
    }

    /**
     * UC-06 / PR-M9: Tạo ô kho mới
     * POST /api/v1/storage-units?facilityId=1
     */
    @PostMapping
    public ResponseEntity<StorageUnitDetailResponse> createStorageUnit(
            @RequestParam(required = false) Integer facilityId,
            @RequestHeader(value = "X-Facility-Id", required = false) Integer headerFacilityId,
            @Valid @RequestBody CreateStorageUnitRequest request,
            @RequestParam(required = false) Integer actorUserId,
            @RequestHeader(value = "X-User-Id", required = false) Integer headerUserId) {

        Integer effectiveFacilityId = facilityId != null ? facilityId : headerFacilityId;
        if (effectiveFacilityId == null) {
            effectiveFacilityId = 1;
        }
        Integer effectiveUserId = actorUserId != null ? actorUserId : headerUserId;

        StorageUnitDetailResponse created = storageUnitService.createStorageUnit(effectiveFacilityId, request, effectiveUserId);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    /**
     * UC-06 / PR-21: Cập nhật cấu hình vật lý của ô kho
     * PUT /api/v1/storage-units/{id}
     */
    @PutMapping("/{id}")
    public ResponseEntity<StorageUnitDetailResponse> updateStorageUnit(
            @PathVariable String id,
            @Valid @RequestBody UpdateStorageUnitRequest request,
            @RequestParam(required = false) Integer actorUserId,
            @RequestHeader(value = "X-User-Id", required = false) Integer headerUserId) {

        ownershipGuard.checkStorageUnit(id);
        Integer effectiveUserId = actorUserId != null ? actorUserId : headerUserId;
        StorageUnitDetailResponse updated = storageUnitService.updateStorageUnit(id, request, effectiveUserId);
        return ResponseEntity.ok(updated);
    }

    /**
     * UC-06 / PR-M9, PR-M10: Đổi trạng thái ô kho (AVAILABLE ⇄ MAINTENANCE)
     * PATCH /api/v1/storage-units/{id}/status
     */
    @PatchMapping("/{id}/status")
    public ResponseEntity<StorageUnitDetailResponse> updateStorageUnitStatus(
            @PathVariable String id,
            @Valid @RequestBody UpdateStorageUnitStatusRequest request,
            @RequestParam(required = false) Integer actorUserId,
            @RequestHeader(value = "X-User-Id", required = false) Integer headerUserId) {

        ownershipGuard.checkStorageUnit(id);
        Integer effectiveUserId = actorUserId != null ? actorUserId : headerUserId;
        StorageUnitDetailResponse updated = storageUnitService.updateStorageUnitStatus(id, request, effectiveUserId);
        return ResponseEntity.ok(updated);
    }

    /**
     * UC-06 / PR-21: Xóa ô kho (chặn nếu đã từng có hợp đồng)
     * DELETE /api/v1/storage-units/{id}
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, String>> deleteStorageUnit(
            @PathVariable String id,
            @RequestParam(required = false) Integer actorUserId,
            @RequestHeader(value = "X-User-Id", required = false) Integer headerUserId) {

        ownershipGuard.checkStorageUnit(id);
        Integer effectiveUserId = actorUserId != null ? actorUserId : headerUserId;
        storageUnitService.deleteStorageUnit(id, effectiveUserId);
        return ResponseEntity.ok(Map.of("message", "Đã xóa ô kho " + id + " thành công"));
    }

    // ──────────────────────────────────────────────────────
    // Exception Handlers
    // ──────────────────────────────────────────────────────
    @ExceptionHandler(FacilityException.class)
    public ResponseEntity<Map<String, String>> handleFacilityException(FacilityException ex) {
        return ResponseEntity.status(ex.getStatus())
                .body(Map.of(
                        "error", ex.getCode(),
                        "message", ex.getMessage()
                ));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> handleGeneralException(Exception ex) {
        ex.printStackTrace();
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of(
                        "error", ex.getClass().getSimpleName(),
                        "message", ex.getMessage() != null ? ex.getMessage() : ex.toString()
                ));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidationExceptions(MethodArgumentNotValidException ex) {
        Map<String, String> errors = new HashMap<>();
        for (FieldError error : ex.getBindingResult().getFieldErrors()) {
            errors.put(error.getField(), error.getDefaultMessage());
        }
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of(
                        "error", "INVALID_INPUT",
                        "message", "Dữ liệu nhập vào không hợp lệ",
                        "details", errors
                ));
    }
}

