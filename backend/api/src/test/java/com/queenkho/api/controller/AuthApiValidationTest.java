package com.queenkho.api.controller;

import com.queenkho.api.dto.*;
import com.queenkho.api.exception.AuthException;
import com.queenkho.api.service.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.*;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class AuthApiValidationTest extends SecuredMvcFixture {
    final AuthService auth = mock(AuthService.class);
    final LoginHistoryService history = mock(LoginHistoryService.class);
    final NotificationService notifications = mock(NotificationService.class);

    @BeforeEach void setup() {
        AuthController controller = new AuthController();
        ReflectionTestUtils.setField(controller, "authService", auth);
        ReflectionTestUtils.setField(controller, "loginHistoryService", history);
        ReflectionTestUtils.setField(controller, "sessionTokenService", sessions);
        ReflectionTestUtils.setField(controller, "notificationService", notifications);
        controllers(controller);
    }

    static final String VALID = "{\"email\":\"new@example.test\",\"password\":\"123456\",\"fullName\":\"Nguyễn An\",\"phone\":\"0900000000\"}";

    @ParameterizedTest @ValueSource(strings = {
            "{}",
            "{\"password\":\"123456\",\"fullName\":\"An\",\"phone\":\"0900000000\"}",
            "{\"email\":\"bad-email\",\"password\":\"123456\",\"fullName\":\"An\",\"phone\":\"0900000000\"}",
            "{\"email\":\"a@example.test\",\"password\":\"12345\",\"fullName\":\"An\",\"phone\":\"0900000000\"}",
            "{\"email\":\"a@example.test\",\"password\":\"      \",\"fullName\":\"An\",\"phone\":\"0900000000\"}",
            "{\"email\":\"a@example.test\",\"password\":\"123456\",\"fullName\":\" \",\"phone\":\"0900000000\"}",
            "{\"email\":\"a@example.test\",\"password\":\"123456\",\"fullName\":\"An\",\"phone\":\"\"}"
    })
    void invalidRegistrationIsRejectedByBeanValidationBeforeService(String json) throws Exception {
        mvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON).content(json))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(auth, history);
    }

    @Test void validRegistrationIsPublicAndPreservesCustomerInput() throws Exception {
        mvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON).content(VALID))
                .andExpect(status().isOk());
        verify(auth).register(argThat(r -> "new@example.test".equals(r.getEmail())
                && "Nguyễn An".equals(r.getFullName()) && "123456".equals(r.getPassword())));
        verifyNoInteractions(sessions);
    }

    @Test void duplicateAccountIsClientError() throws Exception {
        doThrow(new IllegalArgumentException("Email đã tồn tại")).when(auth).register(any());
        mvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON).content(VALID))
                .andExpect(status().isBadRequest());
    }

    @ParameterizedTest @ValueSource(strings = {"{", "null", "[]"})
    void malformedRegistrationCannotReachService(String json) throws Exception {
        mvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON).content(json))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(auth);
    }

    @Test void wrongContentTypeCannotReachService() throws Exception {
        mvc.perform(post("/api/v1/auth/register").contentType(MediaType.TEXT_PLAIN).content(VALID))
                .andExpect(status().isUnsupportedMediaType());
        verifyNoInteractions(auth);
    }

    @Test void loginReturnsTokenAndWritesSuccessHistoryWithoutAuthentication() throws Exception {
        when(auth.login(any())).thenReturn(new LoginResponse("opaque-token", "CUSTOMER", 42, "An", null, null));
        mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"  a@example.test  \",\"password\":\"123456\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.token").value("opaque-token"))
                .andExpect(jsonPath("$.role").value("CUSTOMER"));
        verify(history).recordSuccess(eq(42), eq("a@example.test"), any());
        verifyNoInteractions(notifications);
    }

    @ParameterizedTest @CsvSource({"UNAUTHORIZED,401", "ACCOUNT_LOCKED,403", "INVALID_INPUT,400"})
    void authenticationErrorsKeepStatusAndMachineReadableCode(String code, int statusCode) throws Exception {
        when(auth.login(any())).thenThrow(new AuthException(HttpStatus.valueOf(statusCode), code, "Đăng nhập thất bại"));
        mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"a@example.test\",\"password\":\"bad\"}"))
                .andExpect(status().is(statusCode)).andExpect(jsonPath("$.error").value(code))
                .andExpect(jsonPath("$.message").value("Đăng nhập thất bại"));
        if ("INVALID_INPUT".equals(code)) verifyNoInteractions(history);
        else verify(history).recordFailure(eq("a@example.test"), eq(code), any());
    }

    @Test void adminLoginGeneratesAdminSummary() throws Exception {
        when(auth.login(any())).thenReturn(new LoginResponse("opaque", "ADMIN", 42, "Admin", null, null));
        mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isOk());
        verify(notifications).generateAdminLoginSummary(42);
    }

    @Test void logoutRemainsIdempotentAfterSessionExpires() throws Exception {
        when(sessions.findUserId(TOKEN)).thenReturn(null);
        mvc.perform(post("/api/v1/auth/logout").header("Authorization", TOKEN)).andExpect(status().isOk());
        mvc.perform(post("/api/v1/auth/logout").header("Authorization", TOKEN)).andExpect(status().isOk());
        verify(sessions, times(2)).revoke(TOKEN);
        verifyNoInteractions(history);
    }

    @Test void validLogoutRecordsTheServerSideUserNotClientSuppliedId() throws Exception {
        when(sessions.findUserId(TOKEN)).thenReturn(42);
        mvc.perform(post("/api/v1/auth/logout").header("Authorization", TOKEN).param("userId", "999"))
                .andExpect(status().isOk());
        verify(history).recordLogout(eq(42), any());
    }
}
