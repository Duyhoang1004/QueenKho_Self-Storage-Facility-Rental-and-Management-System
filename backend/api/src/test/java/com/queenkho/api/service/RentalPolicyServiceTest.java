package com.queenkho.api.service;

import com.queenkho.api.dto.RentalPolicyRequest;
import com.queenkho.api.entity.Facility;
import com.queenkho.api.entity.RentalPolicy;
import com.queenkho.api.entity.Role;
import com.queenkho.api.entity.User;
import com.queenkho.api.repository.FacilityRepository;
import com.queenkho.api.repository.RentalPolicyRepository;
import com.queenkho.api.repository.UserRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RentalPolicyServiceTest {
    @Mock RentalPolicyRepository policies;
    @Mock FacilityRepository facilities;
    @Mock UserRepository users;
    @Mock SessionTokenService sessions;
    @Mock ActivityLogService logs;
    @Mock EntityManager entityManager;

    RentalPolicyService service;
    User bom;

    @BeforeEach
    void setUp() {
        service = new RentalPolicyService(policies, facilities, users, sessions, logs, entityManager);
        Role role = new Role();
        role.setName("BOM");
        bom = new User();
        bom.setId(7);
        bom.setStatus("ACTIVE");
        bom.setRole(role);
        bom.setFullName("BOM Test");
    }

    private void authorized() {
        when(sessions.requireUser("Bearer valid")).thenReturn(7);
        when(users.findById(7)).thenReturn(Optional.of(bom));
    }

    @Test
    void updateCreatesNewVersionWithoutChangingContractReferencedPolicy() {
        authorized();
        Facility facility = new Facility();
        facility.setId(3);
        facility.setName("QueenKho Thủ Đức");
        when(facilities.findByIdForPolicyUpdate(3)).thenReturn(Optional.of(facility));
        RentalPolicy previous = new RentalPolicy();
        previous.setVersion(1);
        previous.setActive(true);
        when(policies.findFirstByFacility_IdOrderByVersionDesc(3)).thenReturn(Optional.of(previous));
        when(policies.findByFacility_IdAndActiveTrue(3)).thenReturn(Optional.of(previous));
        when(policies.saveAndFlush(any(RentalPolicy.class))).thenAnswer(invocation -> {
            RentalPolicy saved = invocation.getArgument(0);
            if (saved.getId() == null) saved.setId(12);
            return saved;
        });

        var result = service.createVersion(3, new RentalPolicyRequest(2, 20, 48, 12), "Bearer valid");

        assertEquals(2, result.version());
        assertEquals(12, result.id());
        assertEquals(2, result.depositMonthMultiplier());
        assertEquals(50, result.lateFeeMaxPercent());
        assertEquals(30, result.liquidationDays());
        assertTrue(result.active());
        assertFalse(previous.isActive());
        assertEquals(1, previous.getVersion());
        verify(policies, never()).delete(any());
        verify(logs).log(eq(7), contains("[RENTAL_POLICY_CREATE]"), eq("rental_policy"), eq("12"));
    }

    @Test
    void activatesExactOlderVersionWithoutCreatingAnother() {
        authorized();
        Facility facility = new Facility();
        facility.setId(3);
        when(facilities.findByIdForPolicyUpdate(3)).thenReturn(Optional.of(facility));

        RentalPolicy old = new RentalPolicy();
        old.setId(8);
        old.setFacility(facility);
        old.setVersion(1);
        RentalPolicy current = new RentalPolicy();
        current.setId(12);
        current.setVersion(3);
        current.setActive(true);
        when(policies.findByIdAndFacility_Id(8, 3)).thenReturn(Optional.of(old));
        when(policies.findByFacility_IdAndActiveTrue(3)).thenReturn(Optional.of(current));

        var result = service.activate(3, 8, "Bearer valid");

        assertEquals(8, result.id());
        assertEquals(1, result.version());
        assertTrue(result.active());
        assertFalse(current.isActive());
        verify(policies, times(2)).saveAndFlush(any(RentalPolicy.class));
        verify(logs).log(eq(7), contains("[RENTAL_POLICY_ACTIVATE]"), eq("rental_policy"), eq("8"));
    }

    @Test
    void editingReactivatedVersionUsesHighestVersionNumber() {
        authorized();
        Facility facility = new Facility();
        facility.setId(3);
        facility.setName("QueenKho Thủ Đức");
        when(facilities.findByIdForPolicyUpdate(3)).thenReturn(Optional.of(facility));
        RentalPolicy latest = new RentalPolicy();
        latest.setVersion(3);
        RentalPolicy active = new RentalPolicy();
        active.setVersion(1);
        active.setActive(true);
        when(policies.findFirstByFacility_IdOrderByVersionDesc(3)).thenReturn(Optional.of(latest));
        when(policies.findByFacility_IdAndActiveTrue(3)).thenReturn(Optional.of(active));
        when(policies.saveAndFlush(any(RentalPolicy.class))).thenAnswer(invocation -> {
            RentalPolicy saved = invocation.getArgument(0);
            if (saved.getId() == null) saved.setId(15);
            return saved;
        });

        var result = service.createVersion(3, new RentalPolicyRequest(2, 20, 48, 12), "Bearer valid");

        assertEquals(4, result.version());
        assertTrue(result.active());
        assertFalse(active.isActive());
    }

    @Test
    void newVersionInheritsDiscountsUnlessBomChangesThem() {
        authorized();
        Facility facility = new Facility();
        facility.setId(3);
        facility.setName("QueenKho Thủ Đức");
        when(facilities.findByIdForPolicyUpdate(3)).thenReturn(Optional.of(facility));
        RentalPolicy current = new RentalPolicy();
        current.setVersion(1);
        current.setActive(true);
        current.setBookingDiscount3m(8);
        current.setRenewalDiscount12m(12);
        current.setAllowLateFeeWaiver(true);
        when(policies.findFirstByFacility_IdOrderByVersionDesc(3)).thenReturn(Optional.of(current));
        when(policies.findByFacility_IdAndActiveTrue(3)).thenReturn(Optional.of(current));
        when(policies.saveAndFlush(any(RentalPolicy.class))).thenAnswer(invocation -> {
            RentalPolicy saved = invocation.getArgument(0);
            if (saved.getId() == null) saved.setId(20);
            return saved;
        });

        // BOM chỉ đổi ưu đãi đặt mới 12 tháng và tắt quyền miễn phí trễ
        var request = new RentalPolicyRequest(1, 50, 24, 10, null, null, 25, null, null, null, false);
        var result = service.createVersion(3, request, "Bearer valid");

        assertEquals(8, result.bookingDiscount3m());    // kế thừa bản đang hiệu lực
        assertEquals(25, result.bookingDiscount12m());  // giá trị mới
        assertEquals(12, result.renewalDiscount12m());  // kế thừa
        assertFalse(result.allowLateFeeWaiver());
    }

    @Test
    void rejectsDailyFeeAboveFixedCap() {
        authorized();
        ResponseStatusException error = assertThrows(ResponseStatusException.class,
            () -> service.createVersion(3, new RentalPolicyRequest(1, 50, 24, 60), "Bearer valid"));
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
        verifyNoInteractions(facilities, policies);
    }
}
