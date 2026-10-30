package com.queenkho.api.repository;

import com.queenkho.api.entity.Notification;
import org.springframework.stereotype.Repository;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;

/**
 * Kho lưu trữ thông báo tạm thời trên RAM (In-Memory Repository).
 * Hoàn toàn không tạo bảng, không can thiệp vào Database.
 * Khi ứng dụng khởi động lại hoặc tắt chương trình, dữ liệu sẽ tự động được xóa sạch.
 */
@Repository
public class NotificationRepository {

    private final AtomicInteger idGenerator = new AtomicInteger(1);
    private final Map<Integer, List<Notification>> storage = new ConcurrentHashMap<>();

    public synchronized Notification save(Notification notification) {
        if (notification == null) return null;
        Integer userId = notification.getUserId();
        if (userId == null && notification.getUser() != null) {
            userId = notification.getUser().getId();
            notification.setUserId(userId);
        }
        if (userId == null) return notification;

        if (notification.getId() == null) {
            notification.setId(idGenerator.getAndIncrement());
            storage.computeIfAbsent(userId, k -> new CopyOnWriteArrayList<>()).add(0, notification);
        } else {
            List<Notification> list = storage.getOrDefault(userId, Collections.emptyList());
            for (int i = 0; i < list.size(); i++) {
                if (list.get(i).getId().equals(notification.getId())) {
                    list.set(i, notification);
                    break;
                }
            }
        }
        return notification;
    }

    public List<Notification> findRecentByUserId(Integer userId, int limit) {
        if (userId == null) return Collections.emptyList();
        List<Notification> list = storage.getOrDefault(userId, Collections.emptyList());
        return list.stream()
                .sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()))
                .limit(limit)
                .collect(Collectors.toList());
    }

    public long countByUserId(Integer userId) {
        if (userId == null) return 0;
        return storage.getOrDefault(userId, Collections.emptyList()).size();
    }

    public long countByUserIdAndIsReadFalse(Integer userId) {
        if (userId == null) return 0;
        return storage.getOrDefault(userId, Collections.emptyList()).stream()
                .filter(n -> !Boolean.TRUE.equals(n.getIsRead()))
                .count();
    }

    public Optional<Notification> findByIdAndUserId(Integer id, Integer userId) {
        if (id == null || userId == null) return Optional.empty();
        return storage.getOrDefault(userId, Collections.emptyList()).stream()
                .filter(n -> id.equals(n.getId()))
                .findFirst();
    }

    public void markAllAsRead(Integer userId) {
        if (userId == null) return;
        List<Notification> list = storage.getOrDefault(userId, Collections.emptyList());
        for (Notification n : list) {
            n.setIsRead(true);
        }
    }

    public void clear() {
        storage.clear();
        idGenerator.set(1);
    }
}
