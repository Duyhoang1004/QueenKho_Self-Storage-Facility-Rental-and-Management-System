package com.queenkho.api.repository;

import com.queenkho.api.entity.Notification;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface NotificationRepository extends JpaRepository<Notification, Integer> {

    List<Notification> findByUserIdOrderByCreatedAtDesc(Integer userId, Pageable pageable);

    default List<Notification> findRecentByUserId(Integer userId, int limit) {
        return findByUserIdOrderByCreatedAtDesc(userId, PageRequest.of(0, limit));
    }

    long countByUserId(Integer userId);

    long countByUserIdAndIsReadFalse(Integer userId);

    Optional<Notification> findByIdAndUserId(Integer id, Integer userId);

    @Modifying
    @Query("UPDATE Notification n SET n.isRead = true WHERE n.user.id = :userId AND n.isRead = false")
    void markAllAsRead(@Param("userId") Integer userId);
}
