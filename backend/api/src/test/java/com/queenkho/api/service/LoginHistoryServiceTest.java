package com.queenkho.api.service;

import com.queenkho.api.exception.AdminException;
import com.queenkho.api.repository.LoginHistoryRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.mock.web.MockHttpServletRequest;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

// Admin: lịch sử đăng nhập
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class LoginHistoryServiceTest {

    @Mock JdbcTemplate jdbcTemplate;
    @Mock LoginHistoryRepository repository;
    @Mock AdminGuard adminGuard;

    private LoginHistoryService service() {
        return new LoginHistoryService(jdbcTemplate, repository, adminGuard);
    }

    private MockHttpServletRequest browser() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("10.0.0.5");
        request.addHeader("User-Agent", "Mozilla/5.0 Chrome/130");
        return request;
    }

    @Test
    @DisplayName("Đăng nhập sai: ghi LOGIN_FAILED kèm lý do, IP, trình duyệt và user_id theo email")
    void recordsFailure() {
        when(jdbcTemplate.query(contains("FROM users WHERE email"), any(RowMapper.class), eq("kh1@x.com"))).thenReturn(List.of(1));
        service().recordFailure("kh1@x.com", "INVALID_CREDENTIALS", browser());
        verify(jdbcTemplate).update(contains("INSERT INTO login_history"),
                eq(1), eq("kh1@x.com"), eq("LOGIN_FAILED"), eq("INVALID_CREDENTIALS"), eq("10.0.0.5"), eq("Mozilla/5.0 Chrome/130"));
    }

    @Test
    @DisplayName("Email không tồn tại vẫn ghi lịch sử (user_id = NULL) — phát hiện dò tài khoản")
    void recordsUnknownEmail() {
        when(jdbcTemplate.query(contains("FROM users WHERE email"), any(RowMapper.class), eq("ai@x.com"))).thenReturn(List.of());
        service().recordFailure("ai@x.com", "INVALID_CREDENTIALS", browser());
        verify(jdbcTemplate).update(contains("INSERT INTO login_history"),
                isNull(), eq("ai@x.com"), eq("LOGIN_FAILED"), eq("INVALID_CREDENTIALS"), any(), any());
    }

    @Test
    @DisplayName("Lỗi ghi lịch sử không được làm hỏng đăng nhập")
    void writeErrorIsSwallowed() {
        when(jdbcTemplate.update(contains("INSERT INTO login_history"), any(Object[].class)))
                .thenThrow(new DataAccessResourceFailureException("db down"));
        assertDoesNotThrow(() -> service().recordSuccess(1, "kh1@x.com", browser()));
    }

    @Test
    @DisplayName("Đứng sau proxy: lấy IP đầu tiên trong X-Forwarded-For")
    void clientIpBehindProxy() {
        MockHttpServletRequest request = browser();
        request.addHeader("X-Forwarded-For", "203.0.113.7, 10.0.0.1");
        assertEquals("203.0.113.7", LoginHistoryService.clientIp(request));
        assertEquals("10.0.0.5", LoginHistoryService.clientIp(browser()));
    }

    @Test
    @DisplayName("Lọc sự kiện không hợp lệ / khoảng ngày ngược → 400")
    void validatesFilters() {
        assertThrows(AdminException.class, () -> service().search(31, null, "HACK", null, null, 0, 20));
        assertThrows(AdminException.class,
                () -> service().search(31, null, null, LocalDate.of(2026, 10, 26), LocalDate.of(2026, 10, 1), 0, 20));
        verify(adminGuard, times(2)).requireActiveAdmin(31);
    }
}
