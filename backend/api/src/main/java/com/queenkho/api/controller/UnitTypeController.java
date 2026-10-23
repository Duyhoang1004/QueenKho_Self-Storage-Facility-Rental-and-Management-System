package com.queenkho.api.controller;

import com.queenkho.api.dto.*;
import com.queenkho.api.exception.UnitTypeException;
import com.queenkho.api.service.UnitTypeService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/unit-types")
public class UnitTypeController {

    @Autowired
    private UnitTypeService unitTypeService;

    // ──────────────────────────────────────────────────────
    // UC-09: Lấy danh sách loại kho đang hoạt động (ACTIVE) cho dropdown
    // GET /api/v1/unit-types
    // ──────────────────────────────────────────────────────
    @GetMapping
    public ResponseEntity<List<UnitTypeResponse>> getAllActiveUnitTypes() {
        return ResponseEntity.ok(unitTypeService.getAllUnitTypes());
    }

    // ──────────────────────────────────────────────────────
    // UC-05: BOM Portal - Lấy danh sách loại kho toàn hệ thống kèm thống kê
    // GET /api/v1/unit-types/bom
    // ──────────────────────────────────────────────────────
    @GetMapping("/bom")
    public ResponseEntity<List<BomUnitTypeResponse>> getBomUnitTypes(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String status) {
        return ResponseEntity.ok(unitTypeService.getBomUnitTypes(keyword, status));
    }

    // ──────────────────────────────────────────────────────
    // UC-05: BOM Portal - Lấy chi tiết 1 loại kho
    // GET /api/v1/unit-types/bom/{id} hoặc GET /api/v1/unit-types/{id}
    // ──────────────────────────────────────────────────────
    @GetMapping({"/bom/{id}", "/{id}"})
    public ResponseEntity<BomUnitTypeResponse> getBomUnitTypeById(@PathVariable Integer id) {
        return ResponseEntity.ok(unitTypeService.getBomUnitTypeById(id));
    }

    // ──────────────────────────────────────────────────────
    // UC-05: BOM Portal - Thêm mới loại kho (PR-M3)
    // POST /api/v1/unit-types/bom hoặc POST /api/v1/unit-types
    // ──────────────────────────────────────────────────────
    @PostMapping({"/bom", ""})
    public ResponseEntity<BomUnitTypeResponse> createUnitType(
            @Valid @RequestBody CreateUnitTypeRequest request,
            @RequestParam(required = false) Integer actorUserId,
            @RequestHeader(value = "X-User-Id", required = false) Integer headerUserId) {
        Integer effectiveUserId = actorUserId != null ? actorUserId : headerUserId;
        BomUnitTypeResponse created = unitTypeService.createUnitType(request, effectiveUserId);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    // ──────────────────────────────────────────────────────
    // UC-05: BOM Portal - Cập nhật loại kho & giá niêm yết (PR-M3, PR-12)
    // PUT /api/v1/unit-types/bom/{id} hoặc PUT /api/v1/unit-types/{id}
    // ──────────────────────────────────────────────────────
    @PutMapping({"/bom/{id}", "/{id}"})
    public ResponseEntity<BomUnitTypeResponse> updateUnitType(
            @PathVariable Integer id,
            @Valid @RequestBody UpdateUnitTypeRequest request,
            @RequestParam(required = false) Integer actorUserId,
            @RequestHeader(value = "X-User-Id", required = false) Integer headerUserId) {
        Integer effectiveUserId = actorUserId != null ? actorUserId : headerUserId;
        BomUnitTypeResponse updated = unitTypeService.updateUnitType(id, request, effectiveUserId);
        return ResponseEntity.ok(updated);
    }

    // ──────────────────────────────────────────────────────
    // UC-05: BOM Portal - Bật / tắt trạng thái ACTIVE / INACTIVE (PR-M4)
    // PATCH / PUT /api/v1/unit-types/bom/{id}/status hoặc /{id}/status
    // ──────────────────────────────────────────────────────
    @RequestMapping(value = {"/bom/{id}/status", "/{id}/status"}, method = {RequestMethod.PATCH, RequestMethod.PUT})
    public ResponseEntity<BomUnitTypeResponse> updateUnitTypeStatus(
            @PathVariable Integer id,
            @Valid @RequestBody UpdateUnitTypeStatusRequest request,
            @RequestParam(required = false) Integer actorUserId,
            @RequestHeader(value = "X-User-Id", required = false) Integer headerUserId) {
        Integer effectiveUserId = actorUserId != null ? actorUserId : headerUserId;
        BomUnitTypeResponse updated = unitTypeService.updateUnitTypeStatus(id, request, effectiveUserId);
        return ResponseEntity.ok(updated);
    }

    // ──────────────────────────────────────────────────────
    // UC-05: BOM Portal - Xóa loại kho (PR-M4: chỉ khi chưa từng có ô kho)
    // DELETE /api/v1/unit-types/bom/{id} hoặc DELETE /api/v1/unit-types/{id}
    // ──────────────────────────────────────────────────────
    @DeleteMapping({"/bom/{id}", "/{id}"})
    public ResponseEntity<Map<String, Object>> deleteUnitType(
            @PathVariable Integer id,
            @RequestParam(required = false) Integer actorUserId,
            @RequestHeader(value = "X-User-Id", required = false) Integer headerUserId) {
        Integer effectiveUserId = actorUserId != null ? actorUserId : headerUserId;
        unitTypeService.deleteUnitType(id, effectiveUserId);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Đã xóa loại kho thành công"
        ));
    }

    // ──────────────────────────────────────────────────────
    // Exception Handlers
    // ──────────────────────────────────────────────────────
    @ExceptionHandler(UnitTypeException.class)
    public ResponseEntity<Map<String, String>> handleUnitTypeException(UnitTypeException ex) {
        return ResponseEntity.status(ex.getStatus())
                .body(Map.of(
                        "error", ex.getCode(),
                        "message", ex.getMessage()
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
                        "message", "Dữ liệu không hợp lệ",
                        "details", errors
                ));
    }
}
