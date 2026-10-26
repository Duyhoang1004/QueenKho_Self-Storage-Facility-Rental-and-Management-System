package com.queenkho.api.controller;

import com.queenkho.api.security.CurrentUserProvider;
import com.queenkho.api.service.DemoSimulationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

// Demo: nút "⚡ Giả lập" tua thời gian. Quyền theo vai trò khai báo trong AccessPolicy (nhóm DEV_SIM_*),
// quyền trên từng bản ghi kiểm tra trong DemoSimulationService.
@RestController
@RequestMapping("/api/v1/dev/simulation")
public class DemoSimulationController {

    private final DemoSimulationService simulationService;
    private final CurrentUserProvider currentUser;

    public DemoSimulationController(DemoSimulationService simulationService, CurrentUserProvider currentUser) {
        this.simulationService = simulationService;
        this.currentUser = currentUser;
    }

    // FE hỏi để biết có hiện nút giả lập hay không
    @GetMapping("/status")
    public ResponseEntity<Map<String, Boolean>> status() {
        return ResponseEntity.ok(Map.of("enabled", simulationService.isEnabled()));
    }

    // Flow 2: khách tới nhận kho hôm nay (Staff / FM, task CHECK_IN)
    @PostMapping("/tasks/{id}/arrive-today")
    public ResponseEntity<Map<String, Object>> arriveToday(@PathVariable Integer id) {
        return ResponseEntity.ok(simulationService.arriveToday(id, currentUser.require()));
    }

    // Flow 1: đơn chưa cọc quá 15 phút giữ chỗ (khách chủ đơn / FM)
    @PostMapping("/reservations/{id}/expire-hold")
    public ResponseEntity<Map<String, Object>> expireHold(@PathVariable Integer id) {
        return ResponseEntity.ok(simulationService.expireHold(id, currentUser.require()));
    }

    // Flow 2: khách bùng hẹn, đủ điều kiện No-Show (FM)
    @PostMapping("/reservations/{id}/trigger-noshow")
    public ResponseEntity<Map<String, Object>> triggerNoShow(@PathVariable Integer id) {
        return ResponseEntity.ok(simulationService.triggerNoShow(id, currentUser.require()));
    }

    // Flow 6: hợp đồng quá hạn N ngày — 3 ngày để thấy phí trễ, 31 ngày để thanh lý (FM)
    @PostMapping("/contracts/{id}/make-overdue")
    public ResponseEntity<Map<String, Object>> makeOverdue(@PathVariable Integer id,
                                                           @RequestParam(defaultValue = "3") int days) {
        return ResponseEntity.ok(simulationService.makeOverdue(id, days, currentUser.require()));
    }

    // Flow 7: ticket đã xử lý quá 3 ngày → hệ thống tự đóng (khách chủ ticket / FM)
    @PostMapping("/support-requests/{id}/auto-close")
    public ResponseEntity<Map<String, Object>> autoCloseTicket(@PathVariable Integer id) {
        return ResponseEntity.ok(simulationService.autoCloseTicket(id, currentUser.require()));
    }
}
