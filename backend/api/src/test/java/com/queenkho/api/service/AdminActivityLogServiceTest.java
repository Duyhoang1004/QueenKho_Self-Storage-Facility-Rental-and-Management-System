package com.queenkho.api.service;

import com.queenkho.api.dto.PageResponse;
import com.queenkho.api.entity.ActivityLog;
import com.queenkho.api.entity.Role;
import com.queenkho.api.entity.User;
import com.queenkho.api.exception.AdminException;
import com.queenkho.api.repository.ActivityLogRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AdminActivityLogServiceTest {
    @Mock private ActivityLogRepository repository;
    @Mock private AdminGuard adminGuard;
    @InjectMocks private AdminActivityLogService service;

    @Test void getLogs_rejectsReversedDateRangeBeforeQuery() {
        AdminException ex = assertThrows(AdminException.class, () -> service.getLogs(1, null, null, null, null, null, null,
            LocalDate.of(2026, 2, 2), LocalDate.of(2026, 2, 1), 0, 20));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertEquals("INVALID_INPUT", ex.getCode());
        verifyNoInteractions(repository);
    }

    @Test void getLogs_escapesSqlLikeCharactersAndClampsPage() {
        ActivityLog log = log("[CHECK_IN] Nhận kho");
        when(repository.searchLogs(any(), any(), any(), any(), any(), any(), any(), any(), any()))
            .thenReturn(new PageImpl<>(List.of(log)));
        PageResponse<?> response = service.getLogs(1, 2, " an_[% ", " ADMIN ", " users ", " 12 ", " a%_[\\ ",
            LocalDate.of(2026, 1, 1), LocalDate.of(2026, 1, 2), -5, 101);
        assertEquals(0, response.getPage());
        ArgumentCaptor<String> actor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> keyword = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        verify(repository).searchLogs(any(), any(), eq(2), actor.capture(), eq("ADMIN"), eq("users"), eq("12"), keyword.capture(), pageable.capture());
        assertEquals("an\\_\\[\\%", actor.getValue());
        assertEquals("a\\%\\_\\[\\\\", keyword.getValue());
        assertEquals(0, pageable.getValue().getPageNumber()); assertEquals(20, pageable.getValue().getPageSize());
    }

    @Test void getLogs_mapsActionCodeAndSystemAccount() {
        when(repository.searchLogs(any(), any(), any(), any(), any(), any(), any(), any(), any()))
            .thenReturn(new PageImpl<>(List.of(log("[NO-SHOW] Đã xử lý"), log("legacy action"))));
        PageResponse<?> page = service.getLogs(1, null, null, null, null, null, null, null, null, 0, 1);
        var first = (com.queenkho.api.dto.ActivityLogResponse) page.getContent().get(0);
        var second = (com.queenkho.api.dto.ActivityLogResponse) page.getContent().get(1);
        assertEquals("NO-SHOW", first.getActionCode()); assertEquals("Đã xử lý", first.getContent());
        assertNull(second.getActionCode()); assertEquals("legacy action", second.getContent());
    }

    @Test void targets_requireAdminAndDelegateDistinctValues() {
        when(repository.findDistinctTargetEntities()).thenReturn(List.of("reservations", "users"));
        assertEquals(List.of("reservations", "users"), service.getTargetEntities(4));
        verify(adminGuard).requireActiveAdmin(4);
    }

    private static ActivityLog log(String action) {
        Role role = new Role(5, "ADMIN", "admin");
        User user = User.builder().id(8).fullName("System").email("system@queenkho.vn").role(role).build();
        ActivityLog log = new ActivityLog(); log.setId(3); log.setUser(user); log.setAction(action); log.setTargetEntity("users"); log.setTargetId("8"); log.setCreatedAt(LocalDateTime.now()); return log;
    }
}
