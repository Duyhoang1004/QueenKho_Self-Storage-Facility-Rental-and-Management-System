package com.queenkho.api.service;

import com.queenkho.api.entity.*;
import com.queenkho.api.repository.RentalContractRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class UnitSensorWorkflowTest {
    final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    final RentalContractRepository contracts = mock(RentalContractRepository.class);
    final NotificationService notifications = mock(NotificationService.class);
    final StaffTaskService tasks = mock(StaffTaskService.class);
    final UnitSensorService service = spy(new UnitSensorService());

    @BeforeEach void setup() {
        ReflectionTestUtils.setField(service, "jdbcTemplate", jdbc);
        ReflectionTestUtils.setField(service, "rentalContractRepository", contracts);
        ReflectionTestUtils.setField(service, "notificationService", notifications);
        ReflectionTestUtils.setField(service, "staffTaskService", tasks);
    }

    RentalContract contract(int id, Integer customerId) {
        var contract = new RentalContract(); contract.setId(id);
        if (customerId != null) { User customer = new User(); customer.setId(customerId); contract.setCustomer(customer); }
        Reservation reservation = new Reservation(); reservation.setId(20); contract.setReservation(reservation);
        when(contracts.findDetailById(id)).thenReturn(Optional.of(contract));
        return contract;
    }

    void live(Integer... ids) {
        when(jdbc.queryForList(anyString(), eq(Integer.class), eq("TB-A101"))).thenReturn(List.of(ids));
        when(jdbc.queryForObject(anyString(), eq(Integer.class), eq("TB-A101"))).thenReturn(1);
    }

    @ParameterizedTest @CsvSource({"15,75,false", "30,75,false", "14.9,60,true", "30.1,60,true", "25,75.1,true"})
    void persistedReadingUsesCorrectAlertFlagAtSafetyBoundaries(String temperature, String humidity, boolean expected) {
        BigDecimal temp = new BigDecimal(temperature), hum = new BigDecimal(humidity);
        LocalDateTime at = LocalDateTime.of(2026, 11, 5, 8, 0);
        assertEquals(expected, service.recordReading("TB-A101", temp, hum, at));
        verify(jdbc).update(anyString(), eq("TB-A101"), eq(temp), eq(hum), eq(expected), eq(Timestamp.valueOf(at)));
        verifyNoInteractions(notifications, tasks);
    }

    void temperatureClass(String unitId, String temperatureClass) {
        when(jdbc.queryForList(contains("temperature_class"), eq(String.class), eq(unitId))).thenReturn(List.of(temperatureClass));
    }

    // 06/11/2026: ngưỡng theo loại kho — kho lạnh 0–8°C / ≤ 90%, kho đông -25 → -15°C / ≤ 95%
    @ParameterizedTest @CsvSource({
            "COLD,4,85,false", "COLD,0,90,false", "COLD,8,60,false", "COLD,8.1,60,true", "COLD,-0.1,60,true", "COLD,4,90.1,true",
            "COLD,25,60,true",
            "FROZEN,-18,90,false", "FROZEN,-25,95,false", "FROZEN,-15,95,false", "FROZEN,-14.9,90,true", "FROZEN,-25.1,90,true",
            "FROZEN,4,60,true"})
    void refrigeratedUnitsUseTheirOwnSafetyRange(String temperatureClass, String temperature, String humidity, boolean expected) {
        temperatureClass("TB-L101", temperatureClass);
        assertEquals(expected, service.recordReading("TB-L101", new BigDecimal(temperature), new BigDecimal(humidity),
                LocalDateTime.of(2026, 11, 6, 8, 0)));
    }

    @Test void unknownTemperatureClassFallsBackToNormalRange() {
        assertEquals(UnitSensorService.NORMAL, UnitSensorService.thresholdsFor(null));
        assertEquals(UnitSensorService.NORMAL, UnitSensorService.thresholdsFor("WHATEVER"));
        assertFalse(service.recordReading("TB-A101", new BigDecimal("25"), new BigDecimal("60"), LocalDateTime.of(2026, 11, 6, 8, 0)));
    }

    @Test void summaryReportsThresholdsOfTheUnitsTemperatureClass() {
        temperatureClass("TB-L101", "COLD");
        doReturn(List.of()).when(service).readings(anyString(), any(), any());
        var result = service.summary("TB-L101", null, 3);
        assertEquals("COLD", result.get("temperatureClass"));
        assertEquals(0, BigDecimal.ZERO.compareTo((BigDecimal) result.get("tempMin")));
        assertEquals(0, new BigDecimal("8").compareTo((BigDecimal) result.get("tempMax")));
        assertEquals(0, new BigDecimal("90").compareTo((BigDecimal) result.get("humidityMax")));
    }

    @Test void coldUnitAlertMentionsColdRangeAndRefrigerationCheck() {
        when(jdbc.queryForList(anyString(), eq(Integer.class), eq("TB-L101"))).thenReturn(List.of(30));
        when(jdbc.queryForObject(anyString(), eq(Integer.class), eq("TB-L101"))).thenReturn(1);
        temperatureClass("TB-L101", "COLD");
        RentalContract first = contract(30, 10);
        service.handleAlert("TB-L101", new BigDecimal("14"), new BigDecimal("88"));
        verify(notifications).notifyCustomer(eq(10), anyString(), anyString(), contains("0–8°C"), anyString(), anyString());
        verify(tasks).createMaintenanceTask(eq(first), eq("SENSOR"), contains("máy lạnh"));
    }

    @Test void alertNotifiesManagerAndEachLiveCustomerAndCreatesMaintenanceWork() {
        live(30, 31);
        RentalContract first = contract(30, 10), second = contract(31, 11);
        service.handleAlert("TB-A101", new BigDecimal("36"), new BigDecimal("88"));
        verify(notifications).notifyFacilityManagersOnce(eq(1), startsWith("SENSOR:TB-A101:"),
                contains("TB-A101"), anyString(), eq("TASK"), eq("/manager/tasks"));
        verify(notifications).notifyCustomer(eq(10), startsWith("SENSOR:TB-A101:"), anyString(), contains("36.0°C"), anyString(), eq("/kho-cua-toi/hop-dong/20"));
        verify(notifications).notifyCustomer(eq(11), startsWith("SENSOR:TB-A101:"), anyString(), contains("88%"), anyString(), anyString());
        verify(tasks).createMaintenanceTask(eq(first), eq("SENSOR"), contains("không mở ô"));
        verify(tasks).createMaintenanceTask(eq(second), eq("SENSOR"), contains("không mở ô"));
        // Sensor maintenance must not evict a customer or directly change occupancy.
        verify(jdbc, never()).update(anyString(), any(Object[].class));
    }

    @Test void missingContractIsSkippedWithoutBlockingRemainingCustomers() {
        live(999, 30); contract(30, 10);
        service.handleAlert("TB-A101", new BigDecimal("36"), new BigDecimal("88"));
        verify(tasks, times(1)).createMaintenanceTask(any(), eq("SENSOR"), anyString());
        verify(notifications, times(1)).notifyCustomer(anyInt(), anyString(), anyString(), anyString(), anyString(), anyString());
    }

    @Test void unoccupiedUnitStillNotifiesFacilityWithoutCreatingCustomerTask() {
        live();
        service.handleAlert("TB-A101", new BigDecimal("36"), new BigDecimal("88"));
        verify(notifications).notifyFacilityManagersOnce(eq(1), anyString(), anyString(), anyString(), eq("TASK"), anyString());
        verify(notifications, never()).notifyCustomer(anyInt(), anyString(), anyString(), anyString(), anyString(), anyString());
        verifyNoInteractions(tasks);
    }

    @Test void missingCustomerDoesNotBlockSensorMaintenanceTask() {
        live(30); contract(30, null);
        service.handleAlert("TB-A101", new BigDecimal("36"), new BigDecimal("88"));
        verify(tasks).createMaintenanceTask(any(), eq("SENSOR"), anyString());
        verify(notifications, never()).notifyCustomer(anyInt(), anyString(), anyString(), anyString(), anyString(), anyString());
    }

    @Test void optionalNotificationAndTaskIntegrationsMayBeAbsent() {
        live(30); contract(30, 10);
        ReflectionTestUtils.setField(service, "notificationService", null);
        ReflectionTestUtils.setField(service, "staffTaskService", null);
        assertDoesNotThrow(() -> service.handleAlert("TB-A101", new BigDecimal("36"), new BigDecimal("88")));
        verifyNoInteractions(notifications, tasks);
    }

    @Test void summaryCountsOnlyActualAlertsAndUsesLatestChronologicalReading() {
        LocalDateTime center = LocalDateTime.of(2026, 1, 10, 12, 0);
        var first = Map.<String, Object>of("alert", false, "temperature", new BigDecimal("25"));
        var last = Map.<String, Object>of("alert", true, "temperature", new BigDecimal("36"));
        doReturn(List.of(first, last)).when(service).readings("TB-A101", center.minusDays(2), center.plusDays(2));
        var result = service.summary("TB-A101", center, 2);
        assertEquals(1L, result.get("alertCount"));
        assertSame(last, result.get("latest"));
        assertEquals(center.minusDays(2), result.get("from"));
        assertEquals(center.plusDays(2), result.get("to"));
    }

    @Test void summaryWithoutReadingsDoesNotInventLatestSensorValue() {
        doReturn(List.of()).when(service).readings(anyString(), any(), any());
        var result = service.summary("TB-A101", null, 7);
        assertNull(result.get("latest"));
        assertEquals(0L, result.get("alertCount"));
        assertEquals(List.of(), result.get("readings"));
    }

    @Test void summaryNeverQueriesFutureMeasurements() {
        doReturn(List.of()).when(service).readings(anyString(), any(), any());
        LocalDateTime before = LocalDateTime.now();
        var result = service.summary("TB-A101", before, 7);
        LocalDateTime after = LocalDateTime.now();
        LocalDateTime actualTo = (LocalDateTime) result.get("to");
        assertFalse(actualTo.isBefore(before));
        assertFalse(actualTo.isAfter(after));
    }
}
