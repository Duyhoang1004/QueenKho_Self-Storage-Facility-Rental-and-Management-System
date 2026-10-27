package com.queenkho.api.controller;

import com.queenkho.api.dto.ResolveHeldGoodsRequest;
import com.queenkho.api.exception.HeldGoodsException;
import com.queenkho.api.security.CurrentUserProvider;
import com.queenkho.api.service.HeldGoodsService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

// PR-Q10: FM quản lý hàng của khách lưu giữ sau thanh lý (Điều khoản xử lý tài sản khi không trả kho)
@RestController
@RequestMapping("/api/v1/held-goods")
public class HeldGoodsController {

    @Autowired
    private HeldGoodsService heldGoodsService;

    @Autowired
    private CurrentUserProvider currentUser;

    // GET /api/v1/held-goods?scope=HOLDING|RESOLVED — cơ sở lấy theo token của FM
    @GetMapping
    public ResponseEntity<?> getBoard(@RequestParam(defaultValue = "HOLDING") String scope) {
        return ResponseEntity.ok(heldGoodsService.getBoard(currentUser.require().id(), scope));
    }

    // POST /api/v1/held-goods/5/resolve   body: { "outcome": "SOLD", "note": "...", "proceedsAmount": 1500000 }
    @PostMapping("/{id}/resolve")
    public ResponseEntity<?> resolve(@PathVariable Integer id, @RequestBody(required = false) ResolveHeldGoodsRequest request) {
        return ResponseEntity.ok(heldGoodsService.resolve(id, currentUser.require().id(), request));
    }

    @ExceptionHandler(HeldGoodsException.class)
    public ResponseEntity<?> handle(HeldGoodsException e) {
        return ResponseEntity.status(e.getStatus()).body(Map.of("error", e.getCode(), "message", e.getMessage()));
    }
}
