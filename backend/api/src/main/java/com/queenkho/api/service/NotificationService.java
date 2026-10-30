package com.queenkho.api.service;

import com.queenkho.api.dto.NotificationResponse;
import com.queenkho.api.entity.Notification;
import com.queenkho.api.entity.User;
import com.queenkho.api.repository.NotificationRepository;
import com.queenkho.api.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class NotificationService {

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Transactional(readOnly = true)
    public List<NotificationResponse> getMyNotifications(Integer userId, int limit) {
        checkAndSeedUserNotificationsIfEmpty(userId);
        return notificationRepository.findRecentByUserId(userId, limit).stream()
                .map(NotificationResponse::fromEntity)
                .toList();
    }

    @Transactional(readOnly = true)
    public long getUnreadCount(Integer userId) {
        checkAndSeedUserNotificationsIfEmpty(userId);
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
        if (userId == null) return null;
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) return null;

        Notification notif = new Notification(user, title, message, type, targetUrl);
        return notificationRepository.save(notif);
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

    @Transactional
    public void generateAdminLoginSummary(Integer adminId) {
        if (adminId == null) return;

        try {
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

            sendNotification(adminId, title, message, "ADMIN_SUMMARY", "/admin/audit-logs");
        } catch (Exception e) {
            System.err.println("[NotificationService] ⚠️ Lỗi khi sinh tóm tắt Admin: " + e.getMessage());
        }
    }

    @Transactional
    public void checkAndSeedUserNotificationsIfEmpty(Integer userId) {
        if (userId == null) return;
        long count = notificationRepository.countByUserIdAndIsReadFalse(userId);
        if (count > 0) return; // Đã có thông báo chưa đọc

        // Nếu tổng thông báo rỗng, tiến hành khởi tạo mẫu theo đúng role
        User user = userRepository.findById(userId).orElse(null);
        if (user == null || user.getRole() == null) return;

        String role = user.getRole().getName();

        if ("CUSTOMER".equals(role)) {
            // 1. Gán ô thành công
            sendNotification(userId, "Gán ô kho thành công",
                    "Đơn RES-596710 của bạn đã được gán khoang KV-BT-A103 tại QueenKho Bình Thạnh! Mã PIN truy cập: 123456.",
                    "ASSIGNED", "/kho-cua-toi/hop-dong/1");

            // 2. Nhắc gia hạn hợp đồng (3 ngày nữa)
            sendNotification(userId, "Nhắc gia hạn hợp đồng",
                    "Hợp đồng khoang KV-BT-A103 còn 3 ngày nữa sẽ hết hạn. Gia hạn ngay để tránh bị khoá mã PIN và tính phí trễ!",
                    "RENEWAL", "/kho-cua-toi/hop-dong/1?action=renew");

            // 3. Cảnh báo hợp đồng quá hạn
            sendNotification(userId, "Cảnh báo hợp đồng quá hạn",
                    "Hợp đồng của bạn đã quá hạn! Mã PIN đã bị khoá tạm thời. Vui lòng thanh toán để mở kho.",
                    "OVERDUE", "/kho-cua-toi/hop-dong/1?action=pay-overdue");

        } else if ("FACILITY_MANAGER".equals(role)) {
            // 1. Đơn cọc mới chờ duyệt gán ô
            sendNotification(userId, "Đơn đặt kho mới chờ gán ô",
                    "Khách hàng NGUYEN VAN C vừa cọc đơn RES-739909. Đang chờ duyệt gán ô kho!",
                    "BOOKING", "/manager/pending-assignments");

            // 2. Chờ hoàn tiền cọc
            sendNotification(userId, "Yêu cầu hoàn tiền cọc",
                    "Đơn RES-108234 bị huỷ — Chờ hoàn tiền cọc 500.000đ cho khách!",
                    "REFUND", "/manager/task-board?type=REFUND");

            // 3. Hư hại kho khi nghiệm thu
            sendNotification(userId, "Sự cố hư hại khoang lưu trữ",
                    "Nhân viên vừa báo cáo sự cố hư hại tại khoang KV-BT-A103 (Ước tính: 350.000đ) cần duyệt bồi thường.",
                    "DAMAGE", "/manager/task-board?type=DAMAGE");

            // 4. Hợp đồng quá hạn 15 ngày
            sendNotification(userId, "Hợp đồng quá hạn đủ điều kiện thanh lý",
                    "Hợp đồng HD-991779 đã quá hạn 15 ngày! Bạn có quyền mở kho và lập biên bản thanh lý.",
                    "LIQUIDATION", "/manager/task-board?type=OVERDUE");

        } else if ("STAFF".equals(role)) {
            // Tìm 1 task mở có trong cơ sở để highlight chính xác task thật
            Integer taskId = 1;
            try {
                Integer foundId = jdbcTemplate.queryForObject(
                        "SELECT TOP 1 id FROM facility_tasks WHERE facility_id = ? ORDER BY id DESC",
                        Integer.class,
                        user.getFacilityId() != null ? user.getFacilityId() : 2
                );
                if (foundId != null) taskId = foundId;
            } catch (Exception ignored) {}

            sendNotification(userId, "Phân công task Check-in mới",
                    "Bạn vừa được phân công task Check-in mới cho khách hàng Khách Hàng 2 (Đơn RES-596710)!",
                    "TASK", "/staff?highlightTaskId=" + taskId);

            sendNotification(userId, "Phân công task Nghiệm thu trả kho",
                    "Bạn vừa được phân công task Nghiệm thu trả kho cho khoang KV-BT-A103!",
                    "TASK", "/staff?highlightTaskId=" + taskId);

        } else if ("ADMIN".equals(role)) {
            sendNotification(userId, "Tóm tắt hoạt động hệ thống",
                    "Chào mừng trở lại! Kể từ lần đăng nhập cuối, hệ thống ghi nhận 12 lượt đăng nhập và 28 thao tác mới.",
                    "ADMIN_SUMMARY", "/admin/audit-logs");

            sendNotification(userId, "Tài khoản nhân viên mới",
                    "Quản lý cơ sở Tân Bình vừa tạo thêm 1 tài khoản nhân viên mới: Nguyen Van Staff (stafftanbinh3@gmail.com).",
                    "STAFF_CREATED", "/admin/users");
        }
    }
}
