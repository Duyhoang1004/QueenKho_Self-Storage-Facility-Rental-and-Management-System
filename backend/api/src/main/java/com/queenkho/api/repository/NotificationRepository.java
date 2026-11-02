package com.queenkho.api.repository;

import com.queenkho.api.entity.Notification;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

// BR-111: thông báo lưu bảng notifications
public interface NotificationRepository extends JpaRepository<Notification, Integer> {

    List<Notification> findByUserIdOrderByCreatedAtDescIdDesc(Integer userId, PageRequest page);

    default List<Notification> findRecentByUserId(Integer userId, int limit) {
        if (userId == null) return List.of();
        return findByUserIdOrderByCreatedAtDescIdDesc(userId, PageRequest.of(0, Math.max(1, limit)));
    }

    long countByUserId(Integer userId);

    long countByUserIdAndIsReadFalse(Integer userId);

    Optional<Notification> findByIdAndUserId(Integer id, Integer userId);

    boolean existsByUserIdAndRefKey(Integer userId, String refKey);

    @Modifying
    @Query("UPDATE Notification n SET n.isRead = true WHERE n.userId = :userId AND n.isRead = false")
    int markAllAsRead(@Param("userId") Integer userId);
}
