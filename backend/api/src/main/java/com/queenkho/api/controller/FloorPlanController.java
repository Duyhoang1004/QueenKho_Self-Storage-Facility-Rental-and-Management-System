package com.queenkho.api.controller;

import com.queenkho.api.dto.FacilityLayoutResponse;
import com.queenkho.api.dto.FloorLayoutResponse;
import com.queenkho.api.dto.FloorRequest;
import com.queenkho.api.dto.SaveFloorPlanRequest;
import com.queenkho.api.exception.FacilityException;
import com.queenkho.api.security.CurrentUserProvider;
import com.queenkho.api.security.OwnershipGuard;
import com.queenkho.api.service.FloorPlanService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

/**
 * UC-06: Sơ đồ mặt bằng ô kho của cơ sở (nằm dưới /storage-units → cùng nhóm quyền STORAGE_MANAGE).
 * facilityId của FM bị AccessControlFilter ghi đè theo token.
 */
@RestController
@RequestMapping("/api/v1/storage-units/layout")
@RequiredArgsConstructor
public class FloorPlanController {

    private final FloorPlanService floorPlanService;
    private final OwnershipGuard ownershipGuard;
    private final CurrentUserProvider currentUser;

    // GET /api/v1/storage-units/layout?facilityId=1
    @GetMapping
    public ResponseEntity<FacilityLayoutResponse> getLayout(@RequestParam Integer facilityId) {
        ownershipGuard.checkFacility(facilityId);
        return ResponseEntity.ok(floorPlanService.getLayout(facilityId));
    }

    // POST /api/v1/storage-units/layout/floors?facilityId=1
    @PostMapping("/floors")
    public ResponseEntity<FloorLayoutResponse> createFloor(@RequestParam Integer facilityId,
                                                           @Valid @RequestBody FloorRequest request) {
        ownershipGuard.checkFacility(facilityId);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(floorPlanService.createFloor(facilityId, request, currentUser.require().id()));
    }

    // PUT /api/v1/storage-units/layout/floors/3 — đổi tên / kích thước tầng
    @PutMapping("/floors/{floorId}")
    public ResponseEntity<FloorLayoutResponse> updateFloor(@PathVariable Integer floorId,
                                                           @Valid @RequestBody FloorRequest request) {
        ownershipGuard.checkFacilityFloor(floorId);
        return ResponseEntity.ok(floorPlanService.updateFloor(floorId, request, currentUser.require().id()));
    }

    // DELETE /api/v1/storage-units/layout/floors/3 — chỉ xoá được tầng không còn ô kho
    @DeleteMapping("/floors/{floorId}")
    public ResponseEntity<Map<String, String>> deleteFloor(@PathVariable Integer floorId) {
        ownershipGuard.checkFacilityFloor(floorId);
        floorPlanService.deleteFloor(floorId, currentUser.require().id());
        return ResponseEntity.ok(Map.of("message", "Đã xoá mặt bằng"));
    }

    // PUT /api/v1/storage-units/layout/floors/3/plan — lưu vị trí ô + vật cố định của tầng
    @PutMapping("/floors/{floorId}/plan")
    public ResponseEntity<FloorLayoutResponse> saveFloorPlan(@PathVariable Integer floorId,
                                                             @Valid @RequestBody SaveFloorPlanRequest request) {
        ownershipGuard.checkFacilityFloor(floorId);
        return ResponseEntity.ok(floorPlanService.saveFloorPlan(floorId, request, currentUser.require().id()));
    }

    @ExceptionHandler(FacilityException.class)
    public ResponseEntity<Map<String, String>> handleFacilityException(FacilityException ex) {
        return ResponseEntity.status(ex.getStatus())
                .body(Map.of("error", ex.getCode(), "message", ex.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidationExceptions(MethodArgumentNotValidException ex) {
        Map<String, String> errors = new HashMap<>();
        for (FieldError error : ex.getBindingResult().getFieldErrors()) {
            errors.put(error.getField(), error.getDefaultMessage());
        }
        String first = errors.values().stream().findFirst().orElse("Dữ liệu nhập vào không hợp lệ");
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of("error", "INVALID_INPUT", "message", first, "details", errors));
    }
}
