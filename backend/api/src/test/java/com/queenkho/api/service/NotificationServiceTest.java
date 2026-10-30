package com.queenkho.api.service;

import com.queenkho.api.dto.NotificationResponse;
import com.queenkho.api.entity.Notification;
import com.queenkho.api.entity.Role;
import com.queenkho.api.entity.User;
import com.queenkho.api.repository.NotificationRepository;
import com.queenkho.api.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class NotificationServiceTest {

    @Mock
    private NotificationRepository notificationRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private JdbcTemplate jdbcTemplate;

    @InjectMocks
    private NotificationService notificationService;

    private User customerUser;
    private Notification notif1;

    @BeforeEach
    void setUp() {
        Role role = new Role();
        role.setName("CUSTOMER");

        customerUser = new User();
        customerUser.setId(10);
        customerUser.setFullName("Nguyen Van A");
        customerUser.setEmail("customer@test.com");
        customerUser.setRole(role);

        notif1 = new Notification(customerUser, "Đặt kho thành công", "Đơn RES-123 đã được tạo", "BOOKING", "/kho-cua-toi/don-thue");
        notif1.setId(101);
    }

    @Test
    @DisplayName("Lấy danh sách thông báo của người dùng khi đã có thông báo chưa đọc")
    void testGetMyNotifications_WithExisting() {
        when(notificationRepository.countByUserIdAndIsReadFalse(10)).thenReturn(1L);
        when(notificationRepository.findRecentByUserId(10, 30)).thenReturn(List.of(notif1));

        List<NotificationResponse> result = notificationService.getMyNotifications(10, 30);

        assertEquals(1, result.size());
        assertEquals("Đặt kho thành công", result.get(0).title());
        assertEquals("BOOKING", result.get(0).type());
        assertFalse(result.get(0).isRead());
    }

    @Test
    @DisplayName("Đếm số lượng thông báo chưa đọc")
    void testGetUnreadCount() {
        when(notificationRepository.countByUserIdAndIsReadFalse(10)).thenReturn(3L);

        long count = notificationService.getUnreadCount(10);

        assertEquals(3L, count);
    }

    @Test
    @DisplayName("Đánh dấu 1 thông báo là đã đọc thành công")
    void testMarkAsRead_Success() {
        when(notificationRepository.findByIdAndUserId(101, 10)).thenReturn(Optional.of(notif1));
        when(notificationRepository.save(any(Notification.class))).thenAnswer(inv -> inv.getArgument(0));

        NotificationResponse response = notificationService.markAsRead(101, 10);

        assertTrue(response.isRead());
        verify(notificationRepository).save(notif1);
    }

    @Test
    @DisplayName("Đánh dấu thông báo không thuộc quyền sở hữu sẽ ném ngoại lệ")
    void testMarkAsRead_NotOwned() {
        when(notificationRepository.findByIdAndUserId(999, 10)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () -> notificationService.markAsRead(999, 10));
    }

    @Test
    @DisplayName("Đánh dấu tất cả thông báo đã đọc")
    void testMarkAllAsRead() {
        notificationService.markAllAsRead(10);

        verify(notificationRepository).markAllAsRead(10);
    }

    @Test
    @DisplayName("Gửi thông báo mới cho user")
    void testSendNotification() {
        when(userRepository.findById(10)).thenReturn(Optional.of(customerUser));
        when(notificationRepository.save(any(Notification.class))).thenAnswer(inv -> inv.getArgument(0));

        Notification created = notificationService.sendNotification(10, "Tiêu đề", "Nội dung", "TASK", "/staff");

        assertNotNull(created);
        assertEquals("Tiêu đề", created.getTitle());
        assertEquals("/staff", created.getTargetUrl());
    }

    @Test
    @DisplayName("Bắn thông báo cho tất cả Quản lý của cơ sở")
    void testNotifyFacilityManagers() {
        when(jdbcTemplate.query(anyString(), any(RowMapper.class), eq(2)))
                .thenReturn(List.of(6, 7));
        when(userRepository.findById(6)).thenReturn(Optional.of(customerUser));
        when(userRepository.findById(7)).thenReturn(Optional.of(customerUser));
        when(notificationRepository.save(any(Notification.class))).thenAnswer(inv -> inv.getArgument(0));

        notificationService.notifyFacilityManagers(2, "Có đơn mới", "Đơn chờ gán ô", "BOOKING", "/manager/pending-assignments");

        verify(notificationRepository, times(2)).save(any(Notification.class));
    }

    @Test
    @DisplayName("Bắn thông báo cho tất cả Quản trị viên (Admin)")
    void testNotifyAdmins() {
        when(jdbcTemplate.query(anyString(), any(RowMapper.class)))
                .thenReturn(List.of(31));
        when(userRepository.findById(31)).thenReturn(Optional.of(customerUser));
        when(notificationRepository.save(any(Notification.class))).thenAnswer(inv -> inv.getArgument(0));

        notificationService.notifyAdmins("Nhân viên mới", "Đã tạo nhân viên", "STAFF_CREATED", "/admin/users");

        verify(notificationRepository, times(1)).save(any(Notification.class));
    }
}
