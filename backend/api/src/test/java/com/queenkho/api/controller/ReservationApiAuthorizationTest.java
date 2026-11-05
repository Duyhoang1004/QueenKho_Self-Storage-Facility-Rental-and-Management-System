package com.queenkho.api.controller;

import com.queenkho.api.dto.*;
import com.queenkho.api.exception.ReservationException;
import com.queenkho.api.service.ReservationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.*;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Map;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class ReservationApiAuthorizationTest extends SecuredMvcFixture {
    final ReservationService reservations = mock(ReservationService.class);

    @BeforeEach void setup() {
        var controller = new ReservationController();
        ReflectionTestUtils.setField(controller, "reservationService", reservations);
        ReflectionTestUtils.setField(controller, "currentUser", currentUser);
        ReflectionTestUtils.setField(controller, "ownershipGuard", ownership);
        controllers(controller);
    }

    @Test void anonymousBookingCannotReachBusinessService() throws Exception {
        mvc.perform(post("/api/v1/reservations").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.error").value("UNAUTHORIZED"));
        verifyNoInteractions(reservations);
    }

    @ParameterizedTest @ValueSource(strings = {"STAFF", "FACILITY_MANAGER", "BOM", "ADMIN"})
    void otherRolesCannotCreateCustomerBooking(String role) throws Exception {
        login(role);
        mvc.perform(post("/api/v1/reservations").header("Authorization", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.error").value("FORBIDDEN_ROLE"));
        verifyNoInteractions(reservations);
    }

    @Test void customerCannotCreateReservationForSpoofedCustomerId() throws Exception {
        login("CUSTOMER");
        var response = new CreateReservationResponse(); response.setId(20); response.setStatus("PENDING");
        when(reservations.createReservation(any())).thenReturn(response);
        mvc.perform(post("/api/v1/reservations").header("Authorization", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"customerId\":999,\"facilityId\":2,\"unitTypeId\":3}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.id").value(20));
        verify(reservations).createReservation(argThat(r -> r.getCustomerId() == 42 && r.getFacilityId() == 2 && r.getUnitTypeId() == 3));
    }

    @Test void spoofedQueryCustomerIdIsReplacedBeforeBinding() throws Exception {
        login("CUSTOMER");
        when(reservations.getMyReservations(42)).thenReturn(List.of());
        mvc.perform(get("/api/v1/reservations/my").header("Authorization", TOKEN).param("customerId", "999"))
                .andExpect(status().isOk()).andExpect(content().json("[]"));
        verify(reservations).getMyReservations(42);
        verify(reservations, never()).getMyReservations(999);
    }

    @Test void managerQueryIsScopedToAssignedFacility() throws Exception {
        login("FACILITY_MANAGER", "ACTIVE", 1);
        mvc.perform(get("/api/v1/reservations/pending").header("Authorization", TOKEN)
                        .param("facilityId", "999").param("managerId", "888"))
                .andExpect(status().isOk());
        verify(reservations).getPendingReservations(1, 42);
    }

    @ParameterizedTest @ValueSource(strings = {"CUSTOMER", "STAFF", "BOM", "ADMIN"})
    void pendingQueueIsNotAvailableToOtherRoles(String role) throws Exception {
        login(role);
        mvc.perform(get("/api/v1/reservations/pending").header("Authorization", TOKEN))
                .andExpect(status().isForbidden());
        verifyNoInteractions(reservations);
    }

    @Test void managerCannotAssignReservationAtAnotherFacility() throws Exception {
        login("FACILITY_MANAGER");
        when(jdbc.queryForList(anyString(), eq(20))).thenReturn(List.of(Map.of("facility_id", 2, "customer_id", 10)));
        mvc.perform(post("/api/v1/reservations/20/assign").header("Authorization", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"storageUnitId\":\"TB-A101\"}"))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.error").value("FORBIDDEN_FACILITY"));
        verifyNoInteractions(reservations);
    }

    @Test void sameFacilityAssignmentUsesAuthenticatedActor() throws Exception {
        login("FACILITY_MANAGER");
        when(jdbc.queryForList(anyString(), eq(20))).thenReturn(List.of(Map.of("facility_id", 1, "customer_id", 10)));
        mvc.perform(post("/api/v1/reservations/20/assign").header("Authorization", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"storageUnitId\":\"TB-A101\",\"actorUserId\":999}"))
                .andExpect(status().isOk());
        verify(reservations).assignStorageUnit(eq(20), argThat(r -> "TB-A101".equals(r.getStorageUnitId())), eq(42));
    }

    @Test void customerCannotPreviewCancellationOfSomeoneElsesReservation() throws Exception {
        login("CUSTOMER");
        when(jdbc.queryForList(anyString(), eq(20))).thenReturn(List.of(Map.of("facility_id", 1, "customer_id", 999)));
        mvc.perform(get("/api/v1/reservations/20/cancel-preview").header("Authorization", TOKEN))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.error").value("FORBIDDEN_OWNER"));
        verifyNoInteractions(reservations);
    }

    @ParameterizedTest @ValueSource(strings = {"LOCKED", "DISABLED", "INACTIVE"})
    void disabledAccountCannotKeepUsingOldToken(String accountStatus) throws Exception {
        login("CUSTOMER", accountStatus, null);
        mvc.perform(get("/api/v1/reservations/my").header("Authorization", TOKEN))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.error").value("ACCOUNT_LOCKED"));
        verify(sessions).revoke(TOKEN);
        verifyNoInteractions(reservations);
    }

    @ParameterizedTest @ValueSource(strings = {"{", "null", "[]"})
    void invalidBookingJsonCannotReachBusinessService(String body) throws Exception {
        login("CUSTOMER");
        mvc.perform(post("/api/v1/reservations").header("Authorization", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(reservations);
    }

    @Test void nonIntegerReservationIdIsRejectedBeforeBusinessCall() throws Exception {
        login("FACILITY_MANAGER");
        mvc.perform(get("/api/v1/reservations/not-a-number/available-units").header("Authorization", TOKEN))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(reservations);
    }

    @Test void businessValidationKeepsErrorCodeAndMessage() throws Exception {
        login("CUSTOMER");
        when(reservations.createReservation(any())).thenThrow(
                new ReservationException(HttpStatus.BAD_REQUEST, "GOODS_CATEGORY_REQUIRED", "Phải chọn loại hàng"));
        mvc.perform(post("/api/v1/reservations").header("Authorization", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("GOODS_CATEGORY_REQUIRED"))
                .andExpect(jsonPath("$.message").value("Phải chọn loại hàng"));
    }

    @Test void rescheduleCannotSpoofManagerInJsonBody() throws Exception {
        login("FACILITY_MANAGER");
        mvc.perform(put("/api/v1/reservations/20/reschedule").header("Authorization", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"managerId\":999,\"newStartDate\":\"2027-01-01\",\"reason\":\"Đổi lịch\"}"))
                .andExpect(status().isOk());
        verify(reservations).rescheduleReservation(eq(20), argThat(r -> r.getManagerId() == 42));
    }

    @Test void undeclaredApiIsDeniedBeforeControllerDispatch() throws Exception {
        login("ADMIN");
        mvc.perform(delete("/api/v1/reservations/20").header("Authorization", TOKEN))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.error").value("API_NOT_DECLARED"));
        verifyNoInteractions(reservations);
    }

    @Test void authenticationErrorRetainsCorsHeadersForFrontend() throws Exception {
        mvc.perform(get("/api/v1/reservations/my").header("Origin", "http://localhost:5173"))
                .andExpect(status().isUnauthorized())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5173"))
                .andExpect(header().string("Access-Control-Allow-Credentials", "true"));
    }
}
