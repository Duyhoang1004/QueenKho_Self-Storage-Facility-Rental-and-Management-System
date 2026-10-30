package com.queenkho.api.repository;

import com.queenkho.api.entity.Notification;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

class NotificationRepositoryTest {

    private NotificationRepository repository;

    @BeforeEach
    void setUp() {
        repository = new NotificationRepository();
    }

    @Test
    @DisplayName("Lưu thông báo tạm thời vào RAM và tự sinh ID")
    void testSaveAndFind() {
        Notification notif = new Notification(1, "Tiêu đề", "Nội dung", "BOOKING", "/manager/pending");
        Notification saved = repository.save(notif);

        assertNotNull(saved.getId());
        assertEquals("Tiêu đề", saved.getTitle());
        assertEquals(1, repository.countByUserId(1));
        assertEquals(1, repository.countByUserIdAndIsReadFalse(1));
    }

    @Test
    @DisplayName("Lấy danh sách thông báo theo thứ tự thời gian mới nhất")
    void testFindRecentByUserId() {
        repository.save(new Notification(1, "Thông báo 1", "Nội dung 1", "BOOKING", "/url1"));
        repository.save(new Notification(1, "Thông báo 2", "Nội dung 2", "REFUND", "/url2"));

        List<Notification> list = repository.findRecentByUserId(1, 10);
        assertEquals(2, list.size());
        assertEquals("Thông báo 2", list.get(0).getTitle()); // Mới nhất đứng đầu
    }

    @Test
    @DisplayName("Đánh dấu tất cả thông báo là đã đọc")
    void testMarkAllAsRead() {
        repository.save(new Notification(1, "Thông báo 1", "Nội dung 1", "BOOKING", "/url1"));
        repository.save(new Notification(1, "Thông báo 2", "Nội dung 2", "REFUND", "/url2"));

        assertEquals(2, repository.countByUserIdAndIsReadFalse(1));

        repository.markAllAsRead(1);

        assertEquals(0, repository.countByUserIdAndIsReadFalse(1));
        assertEquals(2, repository.countByUserId(1));
    }

    @Test
    @DisplayName("Tắt/Xóa bộ nhớ RAM thì dữ liệu biến mất hoàn toàn")
    void testClearInMemoryStorage() {
        repository.save(new Notification(1, "Thông báo 1", "Nội dung 1", "BOOKING", "/url1"));
        assertEquals(1, repository.countByUserId(1));

        repository.clear();
        assertEquals(0, repository.countByUserId(1));
    }
}
