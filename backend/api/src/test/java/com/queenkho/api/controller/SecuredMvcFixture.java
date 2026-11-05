package com.queenkho.api.controller;

import com.queenkho.api.security.*;
import com.queenkho.api.service.SessionTokenService;
import org.junit.jupiter.api.AfterEach;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;

import java.sql.ResultSet;
import java.util.List;

import static org.mockito.Mockito.*;

/** Real MVC binding, Bean Validation, access filter, current user and ownership
 * guard. Only persistence and business collaborators are mocked; no server/DB needed. */
abstract class SecuredMvcFixture {
    static final String TOKEN = "Bearer test-session";
    final SessionTokenService sessions = mock(SessionTokenService.class);
    final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    final CurrentUserProvider currentUser = new CurrentUserProvider();
    final OwnershipGuard ownership = new OwnershipGuard(currentUser, jdbc);
    final LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
    MockMvc mvc;

    void controllers(Object... controllers) {
        validator.afterPropertiesSet();
        mvc = MockMvcBuilders.standaloneSetup(controllers)
                .setControllerAdvice(new AccessExceptionHandler())
                .setValidator(validator)
                .addFilters(new AccessControlFilter(new AccessPolicy(), sessions, jdbc))
                .build();
    }

    void login(String role) throws Exception { login(role, "ACTIVE", 1); }

    @SuppressWarnings("unchecked")
    void login(String role, String status, Integer facility) throws Exception {
        when(sessions.findUserId(TOKEN)).thenReturn(42);
        when(sessions.requireUser(TOKEN)).thenReturn(42);
        ResultSet row = mock(ResultSet.class);
        when(row.getInt("id")).thenReturn(42);
        when(row.getString("role_name")).thenReturn(role);
        when(row.getString("status")).thenReturn(status);
        when(row.getString("full_name")).thenReturn("Test user");
        when(row.getString("email")).thenReturn("test@example.invalid");
        when(row.getObject("facility_id")).thenReturn(facility);
        when(jdbc.query(anyString(), any(RowMapper.class), eq(42))).thenAnswer(invocation -> {
            RowMapper<?> mapper = invocation.getArgument(1);
            return List.of(mapper.mapRow(row, 0));
        });
    }

    @AfterEach void closeValidator() { validator.close(); }
}
