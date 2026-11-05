package com.queenkho.api.service;

import com.queenkho.api.dto.*;
import com.queenkho.api.entity.*;
import com.queenkho.api.exception.AuthException;
import com.queenkho.api.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static com.queenkho.api.service.BusinessFixtures.*;

class AuthBusinessTest {
    final UserRepository users = mock(UserRepository.class);
    final FacilityRepository facilities = mock(FacilityRepository.class);
    final RoleRepository roles = mock(RoleRepository.class);
    final PasswordEncoder encoder = mock(PasswordEncoder.class);
    final SessionTokenService sessions = new SessionTokenService();
    final AuthService service = new AuthService();

    @BeforeEach void configure() {
        ReflectionTestUtils.setField(service, "userRepository", users);
        ReflectionTestUtils.setField(service, "facilityRepository", facilities);
        ReflectionTestUtils.setField(service, "roleRepository", roles);
        ReflectionTestUtils.setField(service, "passwordEncoder", encoder);
        ReflectionTestUtils.setField(service, "sessionTokenService", sessions);
    }

    LoginRequest credentials(String email, String password) {
        LoginRequest r = new LoginRequest();
        r.setEmail(email);
        r.setPassword(password);
        return r;
    }

    @ParameterizedTest @NullAndEmptySource @ValueSource(strings = {" ", "\t"})
    void emptyEmailCannotCreateSession(String email) {
        AuthException ex = assertThrows(AuthException.class,
                () -> service.login(credentials(email, "correct")));
        assertEquals("INVALID_INPUT", ex.getCode());
        verifyNoInteractions(users);
    }

    @Test void nullRequestIsInputError() {
        assertEquals("INVALID_INPUT", assertThrows(AuthException.class,
                () -> service.login(null)).getCode());
    }

    @ParameterizedTest @NullAndEmptySource
    void emptyPasswordDoesNotLookUpAccount(String password) {
        assertThrows(AuthException.class, () -> service.login(credentials("a@example.invalid", password)));
        verifyNoInteractions(users);
    }

    @Test void unknownEmailAndWrongPasswordHaveSameError() {
        User u = user(10, "CUSTOMER", null);
        when(users.findByEmail(u.getEmail())).thenReturn(Optional.of(u));
        AuthException missing = assertThrows(AuthException.class,
                () -> service.login(credentials("missing@example.invalid", "wrong")));
        AuthException wrong = assertThrows(AuthException.class,
                () -> service.login(credentials(u.getEmail(), "wrong")));
        assertEquals(missing.getCode(), wrong.getCode());
        assertEquals(missing.getMessage(), wrong.getMessage());
    }

    @ParameterizedTest @ValueSource(strings = {"LOCKED", "DISABLED"})
    void blockedCustomerCannotCreateSession(String status) {
        User u = user(10, "CUSTOMER", null);
        u.setStatus(status);
        when(users.findByEmail(u.getEmail())).thenReturn(Optional.of(u));
        when(encoder.matches("correct", u.getPassword())).thenReturn(true);
        assertEquals("ACCOUNT_" + status, assertThrows(AuthException.class,
                () -> service.login(credentials(u.getEmail(), "correct"))).getCode());
    }

    @Test void wrongPasswordDoesNotRevealBlockedStatus() {
        User u = user(10, "CUSTOMER", null);
        u.setStatus("LOCKED");
        when(users.findByEmail(u.getEmail())).thenReturn(Optional.of(u));
        assertEquals("INVALID_CREDENTIALS", assertThrows(AuthException.class,
                () -> service.login(credentials(u.getEmail(), "wrong"))).getCode());
    }

    @ParameterizedTest @ValueSource(strings = {"CUSTOMER", "STAFF", "FACILITY_MANAGER", "BOM", "ADMIN"})
    void successfulLoginReturnsCorrectRoleAndUsableToken(String role) {
        User u = user(10, role, role.equals("STAFF") || role.equals("FACILITY_MANAGER") ? 1 : null);
        when(users.findByEmail(u.getEmail())).thenReturn(Optional.of(u));
        when(encoder.matches("correct", u.getPassword())).thenReturn(true);
        when(facilities.findById(1)).thenReturn(Optional.of(facility(1)));
        var result = service.login(credentials("  " + u.getEmail() + "  ", "correct"));
        assertEquals(role, result.getRole());
        assertEquals(u.getFacilityId(), result.getFacilityId());
        assertEquals(10, sessions.requireUser("Bearer " + result.getToken()));
        sessions.revoke("Bearer " + result.getToken());
        assertNull(sessions.findUserId("Bearer " + result.getToken()));
    }

    @Test void registrationAlwaysCreatesActiveCustomerWithEncodedPassword() {
        Role customer = new Role();
        customer.setName("CUSTOMER");
        when(roles.findByName("CUSTOMER")).thenReturn(Optional.of(customer));
        when(encoder.encode("secret123")).thenReturn("hash-only");
        RegisterRequest request = new RegisterRequest();
        request.setEmail("new@example.invalid");
        request.setFullName("New customer");
        request.setPhone("0900000000");
        request.setPassword("secret123");
        service.register(request);
        var captured = org.mockito.ArgumentCaptor.forClass(User.class);
        verify(users).save(captured.capture());
        assertAll(() -> assertEquals("CUSTOMER", captured.getValue().getRole().getName()),
                () -> assertEquals("ACTIVE", captured.getValue().getStatus()),
                () -> assertEquals("hash-only", captured.getValue().getPassword()),
                () -> assertNull(captured.getValue().getFacilityId()));
    }

    @Test void duplicateRegistrationDoesNotReplacePassword() {
        RegisterRequest request = new RegisterRequest();
        request.setEmail("existing@example.invalid");
        when(users.findByEmail(request.getEmail())).thenReturn(Optional.of(user(10, "CUSTOMER", null)));
        assertThrows(RuntimeException.class, () -> service.register(request));
        verify(users, never()).save(any());
        verifyNoInteractions(encoder);
    }
}
