package com.queenkho.api.service;

import com.queenkho.api.dto.NotificationResponse;
import com.queenkho.api.entity.Notification;
import com.queenkho.api.entity.User;
import com.queenkho.api.repository.NotificationRepository;
import com.queenkho.api.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * BR-111: thông báo trong chuông (lưu bảng notifications).
 *  - Không còn sinh thông báo mẫu cho tài khoản chưa có thông báo — mọi thông báo đều từ sự kiện thật.
 *  - notifyCustomer: thông báo + gửi email cho khách (EmailService gửi sau khi transaction commit).
 *  - sendOnce: thông báo do job sinh, chống gửi trùng bằng refKey (vd nhắc gia hạn mỗi mốc 1 lần).
 */
@Service
public class NotificationService {

    private static final int TITLE_MAX = 200;
    private static final int MESSAGE_MAX = 1000;

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired(required = false)
    private ApplicationEventPublisher eventPublisher;

    @Transactional(readOnly = true)
    public List<NotificationResponse> getMyNotifications(Integer userId, int limit) {
        return notificationRepository.findRecentByUserId(userId, limit).stream()
                .map(NotificationResponse::fromEntity)
                .toList();
    }

    @Transactional(readOnly = true)
    public long getUnreadCount(Integer userId) {
        return notificationRepository.countByUserIdAndIsReadFalse(userId);
    }

    @Transactional
    public NotificationResponse markAsRead(Integer id, Integer userId) {
        Notification notification = notificationRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new IllegalArgumentException("Thông báo không tồn tại hoặc không thuộc quyền sở hữu"));
        notification.setIsRead(true);
        Notification saved = notificationRepository.save(notification);
        return NotificationResponse.fromEntity(saved);
    }

    @Transactional
    public void markAllAsRead(Integer userId) {
        notificationRepository.markAllAsRead(userId);
    }

    @Transactional
    public Notification sendNotification(Integer userId, String title, String message, String type, String targetUrl) {
        return save(userId, title, message, type, targetUrl, null);
    }

    /** Thông báo do job sinh: đã gửi refKey này cho user thì bỏ qua (trả null). */
    @Transactional
    public Notification sendOnce(Integer userId, String refKey, String title, String message, String type, String targetUrl) {
        if (userId == null || refKey == null) return null;
        if (notificationRepository.existsByUserIdAndRefKey(userId, refKey)) return null;
        return save(userId, title, message, type, targetUrl, refKey);
    }

    /** Thông báo cho khách + email (nếu khách có email). refKey != null thì chỉ gửi 1 lần. */
    @Transactional
    public Notification notifyCustomer(Integer customerId, String title, String message, String type, String targetUrl) {
        return notifyCustomer(customerId, null, title, message, type, targetUrl);
    }

    @Transactional
    public Notification notifyCustomer(Integer customerId, String refKey, String title, String message, String type, String targetUrl) {
        Notification saved = refKey != null
                ? sendOnce(customerId, refKey, title, message, type, targetUrl)
                : sendNotification(customerId, title, message, type, targetUrl);
        if (saved != null && eventPublisher != null) {
            userRepository.findById(customerId)
                    .filter(u -> u.getEmail() != null && !u.getEmail().isBlank())
                    .ifPresent(u -> eventPublisher.publishEvent(
                            new CustomerEmailEvent(u.getEmail(), u.getFullName(), title, message, targetUrl)));
        }
        return saved;
    }

    @Transactional
    public void notifyFacilityManagers(Integer facilityId, String title, String message, String type, String targetUrl) {
        if (facilityId == null) return;
        List<Integer> managerIds = jdbcTemplate.query(
                "SELECT u.id FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = 'FACILITY_MANAGER' AND u.facility_id = ?",
                (rs, rowNum) -> rs.getInt("id"),
                facilityId
        );
        for (Integer mId : managerIds) {
            sendNotification(mId, title, message, type, targetUrl);
        }
    }

    /** Như notifyFacilityManagers nhưng chống trùng theo refKey (dùng cho job). */
    @Transactional
    public void notifyFacilityManagersOnce(Integer facilityId, String refKey, String title, String message, String type, String targetUrl) {
        if (facilityId == null) return;
        List<Integer> managerIds = jdbcTemplate.query(
                "SELECT u.id FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = 'FACILITY_MANAGER' AND u.facility_id = ?",
                (rs, rowNum) -> rs.getInt("id"),
                facilityId
        );
        for (Integer mId : managerIds) {
            sendOnce(mId, refKey, title, message, type, targetUrl);
        }
    }

    @Transactional
    public void notifyStaff(Integer staffId, String title, String message, String type, String targetUrl) {
        sendNotification(staffId, title, message, type, targetUrl);
    }

    @Transactional
    public void notifyAdmins(String title, String message, String type, String targetUrl) {
        List<Integer> adminIds = jdbcTemplate.query(
                "SELECT u.id FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = 'ADMIN'",
                (rs, rowNum) -> rs.getInt("id")
        );
        for (Integer aId : adminIds) {
            sendNotification(aId, title, message, type, targetUrl);
        }
    }

    // Cắt độ dài cho vừa cột để lỗi thông báo không làm hỏng nghiệp vụ chính
    private Notification save(Integer userId, String title, String message, String type, String targetUrl, String refKey) {
        if (userId == null) return null;
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) return null;

        Notification notif = new Notification(user, truncate(title, TITLE_MAX), truncate(message, MESSAGE_MAX), type, targetUrl);
        notif.setRefKey(refKey);
        return notificationRepository.save(notif);
    }

    private static String truncate(String value, int max) {
        if (value == null) return "";
        return value.length() <= max ? value : value.substring(0, max - 1) + "…";
    }

    @Transactional
    public void generateAdminLoginSummary(Integer adminId) {
        if (adminId == null) return;

        try {
            // Tránh spam nếu đã tạo thông báo tóm tắt trong vòng 30 phút qua
            boolean hasRecentSummary = notificationRepository.findRecentByUserId(adminId, 50).stream()
                    .anyMatch(n -> "ADMIN_SUMMARY".equals(n.getType()) && n.getCreatedAt() != null
                            && n.getCreatedAt().isAfter(LocalDateTime.now().minusMinutes(30)));
            if (hasRecentSummary) {
                return;
            }

            // Tìm thời điểm đăng nhập thành công trước đó (bỏ qua lần đăng nhập vừa tạo)
            List<LocalDateTime> previousLogins = jdbcTemplate.query(
                    "SELECT created_at FROM login_history WHERE user_id = ? AND event_type = 'LOGIN_SUCCESS' ORDER BY created_at DESC",
                    (rs, rowNum) -> rs.getTimestamp("created_at").toLocalDateTime(),
                    adminId
            );

            LocalDateTime since;
            if (previousLogins.size() >= 2) {
                since = previousLogins.get(1); // Lần trước đó
            } else {
                since = LocalDateTime.now().minusHours(24);
            }

            Integer loginCount = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM login_history WHERE created_at >= ?",
                    Integer.class,
                    since
            );
            Integer actionCount = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM activity_logs WHERE created_at >= ?",
                    Integer.class,
                    since
            );

            int n = loginCount != null ? loginCount : 0;
            int m = actionCount != null ? actionCount : 0;

            String title = "Tóm tắt hoạt động hệ thống";
            String message = String.format("Chào mừng trở lại! Kể từ lần đăng nhập cuối, hệ thống ghi nhận %d lượt đăng nhập và %d thao tác mới.", n, m);

            sendNotification(adminId, title, message, "ADMIN_SUMMARY", "/admin/logs");
        } catch (Exception e) {
            System.err.println("[NotificationService] ⚠️ Lỗi khi sinh tóm tắt Admin: " + e.getMessage());
        }
    }
}
