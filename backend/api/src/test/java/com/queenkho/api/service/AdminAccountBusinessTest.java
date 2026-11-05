package com.queenkho.api.service;

import com.queenkho.api.dto.*;
import com.queenkho.api.entity.*;
import com.queenkho.api.exception.AdminException;
import com.queenkho.api.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.test.util.ReflectionTestUtils;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static com.queenkho.api.service.BusinessFixtures.*;

class AdminAccountBusinessTest {
    final UserRepository users = mock(UserRepository.class);
    final ReservationRepository reservations = mock(ReservationRepository.class);
    final RentalContractRepository contracts = mock(RentalContractRepository.class);
    final StaffTaskRepository tasks = mock(StaffTaskRepository.class);
    final AdminGuard guard = new AdminGuard();
    final AdminUserService service = new AdminUserService();
    User target;

    @BeforeEach void setup() {
        target = user(10, "CUSTOMER", null);
        when(users.findById(1)).thenReturn(Optional.of(user(1, "ADMIN", null)));
        when(users.findById(10)).thenReturn(Optional.of(target));
        ReflectionTestUtils.setField(guard, "userRepository", users);
        ReflectionTestUtils.setField(service, "adminGuard", guard);
        ReflectionTestUtils.setField(service, "userRepository", users);
        ReflectionTestUtils.setField(service, "reservationRepository", reservations);
        ReflectionTestUtils.setField(service, "rentalContractRepository", contracts);
        ReflectionTestUtils.setField(service, "staffTaskRepository", tasks);
        ReflectionTestUtils.setField(service, "activityLogService", mock(ActivityLogService.class));
    }

    UpdateUserStatusRequest block() { return new UpdateUserStatusRequest("LOCKED", "Confirmed account policy violation"); }

    @ParameterizedTest @ValueSource(strings = {"CUSTOMER", "STAFF", "FACILITY_MANAGER", "BOM"})
    void onlyAdminCanChangeAccountStatus(String role) {
        when(users.findById(1)).thenReturn(Optional.of(user(1, role, null)));
        assertThrows(AdminException.class, () -> service.changeStatus(10, block(), 1));
        verify(users, never()).save(any());
    }

    @ParameterizedTest @ValueSource(strings = {"LOCKED", "DISABLED"})
    void inactiveAdminCannotManageOtherAccounts(String status) {
        User actor = user(1, "ADMIN", null); actor.setStatus(status);
        when(users.findById(1)).thenReturn(Optional.of(actor));
        assertThrows(AdminException.class, () -> service.changeStatus(10, block(), 1));
    }

    @Test void adminCannotLockOwnAccount() {
        assertEquals("CANNOT_LOCK_SELF", assertThrows(AdminException.class,
                () -> service.changeStatus(1, block(), 1)).getCode());
    }

    @Test void lastActiveAdminCannotBeDisabled() {
        target.setRole(user(10, "ADMIN", null).getRole());
        when(users.countByRole_NameAndStatusAndEmailNot("ADMIN", "ACTIVE", ActivityLogService.SYSTEM_EMAIL)).thenReturn(1L);
        assertEquals("LAST_ACTIVE_ADMIN", assertThrows(AdminException.class,
                () -> service.changeStatus(10, block(), 1)).getCode());
    }

    @Test void customerWithActiveContractCannotBeLocked() {
        when(contracts.existsByCustomer_IdAndStatusIn(eq(10), any())).thenReturn(true);
        assertThrows(AdminException.class, () -> service.changeStatus(10, block(), 1));
        assertEquals("ACTIVE", target.getStatus());
    }

    @Test void customerWithPendingBookingCannotBeLocked() {
        when(reservations.existsByCustomer_IdAndStatusIn(eq(10), any())).thenReturn(true);
        assertThrows(AdminException.class, () -> service.changeStatus(10, block(), 1));
    }

    @Test void staffHoldingWorkCannotBeLocked() {
        target.setRole(user(10, "STAFF", 1).getRole());
        when(tasks.existsByStaff_IdAndStatusIn(eq(10), any())).thenReturn(true);
        assertThrows(AdminException.class, () -> service.changeStatus(10, block(), 1));
    }

    @Test void systemJobAccountCannotBeModified() {
        target.setEmail(ActivityLogService.SYSTEM_EMAIL);
        assertEquals("USER_NOT_FOUND", assertThrows(AdminException.class,
                () -> service.changeStatus(10, block(), 1)).getCode());
    }

    @Test void lockingRequiresReasonForAuditTrail() {
        assertThrows(AdminException.class,
                () -> service.changeStatus(10, new UpdateUserStatusRequest("LOCKED", ""), 1));
        verify(users, never()).save(any());
    }
}
