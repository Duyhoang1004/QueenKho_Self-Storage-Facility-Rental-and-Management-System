package com.queenkho.api.controller;

import com.queenkho.api.entity.CentralWarehouse;
import com.queenkho.api.entity.GoodsCategory;
import com.queenkho.api.exception.ReservationException;
import com.queenkho.api.security.CurrentUserProvider;
import com.queenkho.api.service.OperationsCatalogService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

// Họp nhóm 05/11/2026: danh mục loại hàng (BR-131) + kho tổng (BR-134) — BOM quản lý
@RestController
@RequestMapping("/api/v1")
public class OperationsCatalogController {

    private final OperationsCatalogService catalogService;
    private final CurrentUserProvider currentUser;

    public OperationsCatalogController(OperationsCatalogService catalogService, CurrentUserProvider currentUser) {
        this.catalogService = catalogService;
        this.currentUser = currentUser;
    }

    @ExceptionHandler(ReservationException.class)
    public ResponseEntity<?> handle(ReservationException ex) {
        return ResponseEntity.status(ex.getStatus()).body(Map.of("error", ex.getCode(), "message", ex.getMessage()));
    }

    // Công khai: loại hàng đang nhận cho trang đặt kho
    @GetMapping("/goods-categories")
    public ResponseEntity<?> activeGoodsCategories() {
        return ResponseEntity.ok(catalogService.listGoodsCategories(true));
    }

    @GetMapping("/bom/goods-categories")
    public ResponseEntity<?> allGoodsCategories() {
        return ResponseEntity.ok(catalogService.listGoodsCategories(false));
    }

    @PostMapping("/bom/goods-categories")
    public ResponseEntity<?> createGoodsCategory(@RequestBody GoodsCategory body) {
        return ResponseEntity.ok(catalogService.saveGoodsCategory(null, body, currentUser.require().id()));
    }

    @PutMapping("/bom/goods-categories/{id}")
    public ResponseEntity<?> updateGoodsCategory(@PathVariable Integer id, @RequestBody GoodsCategory body) {
        return ResponseEntity.ok(catalogService.saveGoodsCategory(id, body, currentUser.require().id()));
    }

    @PatchMapping("/bom/goods-categories/{id}/status")
    public ResponseEntity<?> goodsCategoryStatus(@PathVariable Integer id, @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(catalogService.setGoodsCategoryStatus(id, body.get("status"), currentUser.require().id()));
    }

    // Kho tổng đang hoạt động — FM / Staff chọn khi chuyển hàng
    @GetMapping("/central-warehouses")
    public ResponseEntity<?> activeWarehouses() {
        return ResponseEntity.ok(catalogService.listWarehouses(true));
    }

    @GetMapping("/bom/central-warehouses")
    public ResponseEntity<?> allWarehouses() {
        return ResponseEntity.ok(catalogService.listWarehouses(false));
    }

    @PostMapping("/bom/central-warehouses")
    public ResponseEntity<?> createWarehouse(@RequestBody CentralWarehouse body) {
        return ResponseEntity.ok(catalogService.saveWarehouse(null, body, currentUser.require().id()));
    }

    @PutMapping("/bom/central-warehouses/{id}")
    public ResponseEntity<?> updateWarehouse(@PathVariable Integer id, @RequestBody CentralWarehouse body) {
        return ResponseEntity.ok(catalogService.saveWarehouse(id, body, currentUser.require().id()));
    }

    @PatchMapping("/bom/central-warehouses/{id}/status")
    public ResponseEntity<?> warehouseStatus(@PathVariable Integer id, @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(catalogService.setWarehouseStatus(id, body.get("status"), currentUser.require().id()));
    }
}
