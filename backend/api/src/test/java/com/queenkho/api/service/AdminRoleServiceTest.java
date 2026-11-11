package com.queenkho.api.service;

import com.queenkho.api.dto.RoleResponse;
import com.queenkho.api.dto.UpdateRoleRequest;
import com.queenkho.api.entity.Role;
import com.queenkho.api.exception.AdminException;
import com.queenkho.api.repository.RoleRepository;
import com.queenkho.api.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AdminRoleServiceTest {
    @Mock private RoleRepository roleRepository;
    @Mock private UserRepository userRepository;
    @Mock private ActivityLogService activityLogService;
    @Mock private AdminGuard adminGuard;
    @InjectMocks private AdminRoleService service;
    private Role admin;

    @BeforeEach void setUp() { admin = new Role(5, "ADMIN", "Quản trị viên"); }

    @Test void listRoles_aggregatesAllStatusesAndActiveOnly() {
        UserRepository.RoleStatusCount active = count("ADMIN", "ACTIVE", 3L);
        UserRepository.RoleStatusCount locked = count("ADMIN", "LOCKED", 2L);
        when(roleRepository.findAll(any(Sort.class))).thenReturn(List.of(admin));
        when(userRepository.countGroupByRoleAndStatus(anyString())).thenReturn(List.of(active, locked));
        RoleResponse response = service.getRoles().get(0);
        assertEquals(5, response.getUserCount());
        assertEquals(3, response.getActiveCount());
        assertEquals("ADMIN", response.getName());
    }

    @Test void updateDescription_requiresAnActiveAdmin() {
        doThrow(new AdminException(HttpStatus.FORBIDDEN, "FORBIDDEN", "blocked"))
            .when(adminGuard).requireActiveAdmin(9);
        assertThrows(AdminException.class, () -> service.updateDescription(5, new UpdateRoleRequest("x"), 9));
        verifyNoInteractions(roleRepository, activityLogService);
    }

    @Test void updateDescription_missingRole_isTypedNotFound() {
        when(roleRepository.findById(5)).thenReturn(Optional.empty());
        AdminException exception = assertThrows(AdminException.class,
            () -> service.updateDescription(5, new UpdateRoleRequest("x"), 9));
        assertEquals(HttpStatus.NOT_FOUND, exception.getStatus());
        assertEquals("ROLE_NOT_FOUND", exception.getCode());
    }

    @Test void updateDescription_rejectsNullBlankAndWhitespace() {
        when(roleRepository.findById(5)).thenReturn(Optional.of(admin));
        for (UpdateRoleRequest request : List.of(new UpdateRoleRequest(), new UpdateRoleRequest(""), new UpdateRoleRequest("  "))) {
            AdminException exception = assertThrows(AdminException.class, () -> service.updateDescription(5, request, 9));
            assertEquals("INVALID_INPUT", exception.getCode());
        }
        verify(roleRepository, never()).save(any());
    }

    @Test void updateDescription_rejectsValueOverDatabaseColumnLimit() {
        when(roleRepository.findById(5)).thenReturn(Optional.of(admin));
        AdminException exception = assertThrows(AdminException.class,
            () -> service.updateDescription(5, new UpdateRoleRequest("x".repeat(256)), 9));
        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatus());
        verify(roleRepository, never()).save(any());
    }

    @Test void updateDescription_trimsPersistsAndWritesAuditLog() {
        when(roleRepository.findById(5)).thenReturn(Optional.of(admin));
        when(userRepository.countGroupByRoleAndStatus(anyString())).thenReturn(List.of(count("ADMIN", "ACTIVE", 1L)));
        RoleResponse response = service.updateDescription(5, new UpdateRoleRequest("  System administrator  "), 9);
        assertEquals("System administrator", admin.getDescription());
        assertEquals("System administrator", response.getDescription());
        verify(roleRepository).save(admin);
        verify(activityLogService).log(eq(9), contains("[ROLE_UPDATE]"), eq("roles"), eq("5"));
    }

    @Test void updateDescription_identicalValue_doesNotWriteOrLogNoise() {
        when(roleRepository.findById(5)).thenReturn(Optional.of(admin));
        when(userRepository.countGroupByRoleAndStatus(anyString())).thenReturn(List.of());
        service.updateDescription(5, new UpdateRoleRequest(" Quản trị viên "), 9);
        verify(roleRepository, never()).save(any());
        verifyNoInteractions(activityLogService);
    }

    private static UserRepository.RoleStatusCount count(String role, String status, long total) {
        return new UserRepository.RoleStatusCount() {
            public String getRoleName() { return role; }
            public String getStatus() { return status; }
            public Long getTotal() { return total; }
        };
    }
}
