package com.queenkho.api.controller;

import com.queenkho.api.dto.FacilityAvailabilityResponse;
import com.queenkho.api.dto.FacilitySearchResultItem;
import com.queenkho.api.dto.FacilitySummaryResponse;
import com.queenkho.api.service.FacilityService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/facilities")
public class FacilityController {

    @Autowired
    private FacilityService facilityService;

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
            return ResponseEntity.status(404)
                .body(Map.of("error", "FACILITY_NOT_FOUND", "message", e.getMessage()));
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
}
