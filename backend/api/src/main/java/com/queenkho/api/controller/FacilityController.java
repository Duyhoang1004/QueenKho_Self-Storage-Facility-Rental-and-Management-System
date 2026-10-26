package com.queenkho.api.controller;

import com.queenkho.api.dto.BomFacilityResponse;
import com.queenkho.api.dto.CreateFacilityRequest;
import com.queenkho.api.dto.UpdateFacilityRequest;
import com.queenkho.api.dto.UpdateFacilityStatusRequest;
import com.queenkho.api.dto.FacilityAvailabilityResponse;
import com.queenkho.api.dto.FacilitySearchResultItem;
import com.queenkho.api.dto.FacilitySummaryResponse;
import com.queenkho.api.exception.FacilityException;
import com.queenkho.api.service.FacilityService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/facilities")
public class FacilityController {

    @Autowired
    private FacilityService facilityService;

    @Autowired
    private com.queenkho.api.service.PricingService pricingService;

    @Autowired
    private com.queenkho.api.security.OwnershipGuard ownershipGuard;

    // ──────────────────────────────────────────────────────
    // UC-09 API 1: Lấy tất cả cơ sở ACTIVE kèm tổng ô trống
    // GET /api/v1/facilities
    // ──────────────────────────────────────────────────────
    @GetMapping
    public ResponseEntity<List<FacilitySummaryResponse>> getAllFacilities() {
        return ResponseEntity.ok(facilityService.getAllActiveFacilities());
    }

    // ──────────────────────────────────────────────────────
    // UC-09 API 2: Tìm kiếm cơ sở theo bộ lọc
    // GET /api/v1/facilities/search?keyword=...&city=...&unitTypeId=...&minPrice=...&maxPrice=...&page=0&size=10
    // ──────────────────────────────────────────────────────
    @GetMapping("/search")
    public ResponseEntity<Page<FacilitySearchResultItem>> searchFacilities(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String city,
            @RequestParam(required = false) Integer unitTypeId,
            @RequestParam(required = false) BigDecimal minPrice,
            @RequestParam(required = false) BigDecimal maxPrice,
            @RequestParam(required = false) BigDecimal minArea,
            @RequestParam(required = false) BigDecimal maxArea,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {

        Pageable pageable = PageRequest.of(page, size);
        Page<FacilitySearchResultItem> results = facilityService.searchFacilities(
            keyword, city, unitTypeId, minPrice, maxPrice, minArea, maxArea, pageable);

        return ResponseEntity.ok(results);
    }

    // ──────────────────────────────────────────────────────
    // UC-09 API 3: Chi tiết availability của 1 cơ sở
    // GET /api/v1/facilities/{id}/availability
    // ──────────────────────────────────────────────────────
    @GetMapping("/{id}/availability")
    public ResponseEntity<?> getFacilityAvailability(@PathVariable Integer id) {
        try {
            FacilityAvailabilityResponse response = facilityService.getFacilityAvailability(id);
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Map.of("error", "FACILITY_NOT_FOUND", "message", e.getMessage()));
        }
    }

    // ──────────────────────────────────────────────────────
    // Flow 1 / 4: chính sách giá đang áp dụng (gói, % ưu đãi, cọc, quy định huỷ, phí trễ)
    // GET /api/v1/facilities/{id}/pricing — công khai, trang đặt kho dùng
    // ──────────────────────────────────────────────────────
    @GetMapping("/{id}/pricing")
    public ResponseEntity<?> getFacilityPricing(@PathVariable Integer id) {
        return ResponseEntity.ok(pricingService.facilityPricing(id));
    }

    // ──────────────────────────────────────────────────────
    // UC-30: FM Dashboard tổng quan vận hành cơ sở
    // GET /api/v1/facilities/{id}/dashboard — FM chỉ xem được cơ sở của mình (PR-90)
    // ──────────────────────────────────────────────────────
    @GetMapping("/{id}/dashboard")
    public ResponseEntity<?> getFacilityDashboard(@PathVariable Integer id) {
        ownershipGuard.checkFacility(id);
        try {
            return ResponseEntity.ok(facilityService.getFacilityDashboardStats(id));
        } catch (FacilityException e) {
            return ResponseEntity.status(e.getStatus())
                .body(Map.of("error", e.getCode(), "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "DASHBOARD_ERROR", "message", "Lỗi lấy dữ liệu bảng điều khiển: " + e.getMessage()));
        }
    }

    // ──────────────────────────────────────────────────────
    // UC-09 API phụ: Lấy danh sách thành phố (cho dropdown)
    // GET /api/v1/facilities/cities
    // ──────────────────────────────────────────────────────
    @GetMapping("/cities")
    public ResponseEntity<List<String>> getCities() {
        return ResponseEntity.ok(facilityService.getActiveCities());
    }
    // UC-04 (BOM): Quản lý danh sách cơ sở kho bãi
    // ──────────────────────────────────────────────────────

    // 1. Danh sách cơ sở cho BOM (kèm thống kê ô kho & hợp đồng)
    // GET /api/v1/facilities/bom?keyword=...&city=...&status=...
    @GetMapping("/bom")
    public ResponseEntity<List<BomFacilityResponse>> getAllFacilitiesForBom(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String city,
            @RequestParam(required = false) String status) {
        return ResponseEntity.ok(facilityService.getAllFacilitiesForBom(keyword, city, status));
    }

    // 2. Chi tiết cơ sở cho BOM
    // GET /api/v1/facilities/bom/{id}
    @GetMapping("/bom/{id}")
    public ResponseEntity<BomFacilityResponse> getFacilityDetailForBom(@PathVariable Integer id) {
        return ResponseEntity.ok(facilityService.getFacilityDetailForBom(id));
    }

    // 3. Tạo cơ sở mới (PR-10, PR-M1)
    // POST /api/v1/facilities/bom
    @PostMapping("/bom")
    public ResponseEntity<BomFacilityResponse> createFacility(
            @Valid @RequestBody CreateFacilityRequest request,
            @RequestParam(required = false) Integer actorUserId,
            @RequestHeader(value = "X-User-Id", required = false) Integer headerUserId) {
        Integer effectiveUserId = actorUserId != null ? actorUserId : headerUserId;
        BomFacilityResponse created = facilityService.createFacility(request, effectiveUserId);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    // 4. Cập nhật thông tin cơ sở (Mã code bất biến theo PR-M1)
    // PUT /api/v1/facilities/bom/{id}
    @PutMapping("/bom/{id}")
    public ResponseEntity<BomFacilityResponse> updateFacility(
            @PathVariable Integer id,
            @Valid @RequestBody UpdateFacilityRequest request,
            @RequestParam(required = false) Integer actorUserId,
            @RequestHeader(value = "X-User-Id", required = false) Integer headerUserId) {
        Integer effectiveUserId = actorUserId != null ? actorUserId : headerUserId;
        BomFacilityResponse updated = facilityService.updateFacility(id, request, effectiveUserId);
        return ResponseEntity.ok(updated);
    }

    // 5. Đổi trạng thái cơ sở (PR-11, PR-M2: Chặn INACTIVE nếu còn đơn/hợp đồng hoạt động)
    // PATCH / PUT /api/v1/facilities/bom/{id}/status
    @RequestMapping(value = "/bom/{id}/status", method = {RequestMethod.PATCH, RequestMethod.PUT})
    public ResponseEntity<BomFacilityResponse> updateFacilityStatus(
            @PathVariable Integer id,
            @Valid @RequestBody UpdateFacilityStatusRequest request,
            @RequestParam(required = false) Integer actorUserId,
            @RequestHeader(value = "X-User-Id", required = false) Integer headerUserId) {
        Integer effectiveUserId = actorUserId != null ? actorUserId : headerUserId;
        BomFacilityResponse updated = facilityService.updateFacilityStatus(id, request, effectiveUserId);
        return ResponseEntity.ok(updated);
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
