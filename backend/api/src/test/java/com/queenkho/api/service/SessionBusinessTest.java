package com.queenkho.api.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.*;
import static org.junit.jupiter.api.Assertions.*;

class SessionBusinessTest {
    @ParameterizedTest @NullAndEmptySource @ValueSource(strings = {"Bearer", "Bearer ", "Basic abc", "Bearer forged"})
    void malformedOrForgedSessionsCannotIdentifyUser(String authorization) {
        SessionTokenService sessions = new SessionTokenService();
        assertNull(sessions.findUserId(authorization));
        assertThrows(RuntimeException.class, () -> sessions.requireUser(authorization));
    }

    @Test void logoutInvalidatesOnlyThatSession() {
        SessionTokenService sessions = new SessionTokenService();
        String first = sessions.create(10);
        String second = sessions.create(99);
        sessions.revoke("Bearer " + first);
        assertNull(sessions.findUserId("Bearer " + first));
        assertEquals(99, sessions.requireUser("Bearer " + second));
    }

    @Test void repeatedLogoutIsSafe() {
        SessionTokenService sessions = new SessionTokenService();
        String authorization = "Bearer " + sessions.create(10);
        sessions.revoke(authorization);
        assertDoesNotThrow(() -> sessions.revoke(authorization));
        assertDoesNotThrow(() -> sessions.revoke(null));
    }

    @Test void restartDoesNotAcceptTokensFromPreviousProcess() {
        String old = new SessionTokenService().create(10);
        assertNull(new SessionTokenService().findUserId("Bearer " + old));
    }
}
