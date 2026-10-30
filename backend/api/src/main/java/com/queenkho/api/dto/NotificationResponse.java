package com.queenkho.api.dto;

import com.queenkho.api.entity.Notification;
import java.time.LocalDateTime;

public record NotificationResponse(
    Integer id,
    String title,
    String message,
    String type,
    String targetUrl,
    Boolean isRead,
    LocalDateTime createdAt
) {
    public static NotificationResponse fromEntity(Notification entity) {
        return new NotificationResponse(
            entity.getId(),
            entity.getTitle(),
            entity.getMessage(),
            entity.getType(),
            entity.getTargetUrl(),
            entity.getIsRead(),
            entity.getCreatedAt()
        );
    }
}
