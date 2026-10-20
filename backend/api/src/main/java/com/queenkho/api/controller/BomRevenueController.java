package com.queenkho.api.controller;

import com.queenkho.api.dto.bom.*;
import com.queenkho.api.service.BomRevenueService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * UC-29 — BOM Revenue Dashboard Controller
 *
 * Tất cả endpoint đều read-only (GET), không yêu cầu request body.
 * CORS được xử lý toàn cục bởi CorsConfig — không thêm @CrossOrigin ở đây.
 */
@RestController
@RequestMapping("/api/v1/bom/revenue")
public class BomRevenueController {

    @Autowired
    private BomRevenueService revenueService;

    /**
     * GET /api/v1/bom/revenue/overview
     * Trả 8 KPI tổng quan tài chính theo kỳ (tháng / quý / năm).
     */
    @GetMapping("/overview")
    public ResponseEntity<RevenueOverviewResponse> getOverview(
            @RequestParam(required = false) Integer facilityId,
            @RequestParam(defaultValue = "MONTH") String period,
            @RequestParam(defaultValue = "2026") Integer year,
            @RequestParam(required = false) Integer month,
            @RequestParam(required = false) Integer quarter) {

        return ResponseEntity.ok(revenueService.getOverview(facilityId, period, year, month, quarter));
    }

    /**
     * GET /api/v1/bom/revenue/timeline
     * Trả dữ liệu 12 tháng để vẽ biểu đồ cột/đường doanh thu.
     */
    @GetMapping("/timeline")
    public ResponseEntity<List<RevenueTimelineResponse>> getTimeline(
            @RequestParam(required = false) Integer facilityId,
            @RequestParam(defaultValue = "2026") Integer year) {

        return ResponseEntity.ok(revenueService.getTimeline(facilityId, year));
    }

    /**
     * GET /api/v1/bom/revenue/by-facility
     * Phân bổ doanh thu theo từng cơ sở trong năm.
     */
    @GetMapping("/by-facility")
    public ResponseEntity<List<FacilityRevenueResponse>> getByFacility(
            @RequestParam(defaultValue = "2026") Integer year) {

        return ResponseEntity.ok(revenueService.getByFacility(year));
    }

    /**
     * GET /api/v1/bom/revenue/by-unit-type
     * Phân bổ doanh thu theo loại khoang lưu trữ.
     */
    @GetMapping("/by-unit-type")
    public ResponseEntity<List<UnitTypeRevenueResponse>> getByUnitType(
            @RequestParam(required = false) Integer facilityId) {

        return ResponseEntity.ok(revenueService.getByUnitType(facilityId));
    }

    /**
     * GET /api/v1/bom/revenue/transactions
     * Bảng đối soát giao dịch chi tiết (tối đa 200 bản ghi, sắp xếp mới nhất trước).
     */
    @GetMapping("/transactions")
    public ResponseEntity<List<RevenueTransactionResponse>> getTransactions(
            @RequestParam(required = false) Integer facilityId,
            @RequestParam(required = false) String paymentType) {

        return ResponseEntity.ok(revenueService.getTransactions(facilityId, paymentType));
    }

    /**
     * GET /api/v1/bom/revenue/occupancy
     * Báo cáo tỷ lệ lấp đầy và biến động hợp đồng.
     */
    @GetMapping("/occupancy")
    public ResponseEntity<OccupancyReportResponse> getOccupancy(
            @RequestParam(required = false) Integer facilityId) {

        return ResponseEntity.ok(revenueService.getOccupancy(facilityId));
    }
}
