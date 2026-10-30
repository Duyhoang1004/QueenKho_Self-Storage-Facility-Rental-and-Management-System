package com.queenkho.api.controller;

import com.queenkho.api.dto.NotificationResponse;
import com.queenkho.api.security.CurrentUser;
import com.queenkho.api.security.CurrentUserProvider;
import com.queenkho.api.service.NotificationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/notifications")
public class NotificationController {

    @Autowired
    private NotificationService notificationService;

    @Autowired
    private CurrentUserProvider currentUserProvider;

    @GetMapping
    public ResponseEntity<List<NotificationResponse>> getNotifications(
            @RequestParam(defaultValue = "30") int limit) {
        CurrentUser user = currentUserProvider.require();
        return ResponseEntity.ok(notificationService.getMyNotifications(user.id(), limit));
    }

    @GetMapping("/unread-count")
    public ResponseEntity<Map<String, Long>> getUnreadCount() {
        CurrentUser user = currentUserProvider.require();
        long count = notificationService.getUnreadCount(user.id());
        return ResponseEntity.ok(Map.of("count", count));
    }

    @PatchMapping("/{id}/read")
    public ResponseEntity<NotificationResponse> markAsRead(@PathVariable Integer id) {
        CurrentUser user = currentUserProvider.require();
        return ResponseEntity.ok(notificationService.markAsRead(id, user.id()));
    }

    @PostMapping("/read-all")
    public ResponseEntity<Map<String, String>> markAllAsRead() {
        CurrentUser user = currentUserProvider.require();
        notificationService.markAllAsRead(user.id());
        return ResponseEntity.ok(Map.of("message", "Đã đánh dấu tất cả thông báo là đã đọc"));
    }
}
