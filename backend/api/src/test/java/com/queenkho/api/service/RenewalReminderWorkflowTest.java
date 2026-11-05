package com.queenkho.api.service;

import com.queenkho.api.dto.LateFeeCalculationResult;
import com.queenkho.api.entity.*;
import com.queenkho.api.repository.RentalContractRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.jdbc.core.JdbcTemplate;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class RenewalReminderWorkflowTest {
    final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    final NotificationService notifications = mock(NotificationService.class);
    final RentalContractRepository contracts = mock(RentalContractRepository.class);
    final LateFeeService lateFees = mock(LateFeeService.class);
    final RenewalReminderService service = new RenewalReminderService(jdbc, notifications, contracts, lateFees);
    final LocalDate today = LocalDate.now(LateFeeService.VIETNAM_ZONE);

    Map<String, Object> row(int days, String version) {
        Map<String, Object> row = new HashMap<>();
        row.put("id", 30); row.put("contract_code", "HD-30");
        row.put("end_date", java.sql.Date.valueOf(today.plusDays(days)));
        row.put("customer_id", 10); row.put("reservation_id", 20);
        row.put("storage_unit_id", "TB-A101"); row.put("terms_version", version);
        return row;
    }

    void selected(Map<String, Object> row) {
        when(jdbc.queryForList(anyString(), eq(30))).thenReturn(List.of(row));
    }

    void notificationCreated() {
        when(notifications.notifyCustomer(anyInt(), anyString(), anyString(), anyString(), anyString(), anyString()))
                .thenReturn(new Notification());
    }

    @ParameterizedTest
    @CsvSource({"0,1", "1,1", "2,3", "3,3", "5,7", "7,7", "8,10", "10,10", "12,15", "15,15"})
    void missedRunUsesClosestRemainingMilestoneAndStableDeduplicationKey(int days, int milestone) {
        selected(row(days, "v4")); notificationCreated();
        assertTrue(service.remindContract(30));
        verify(notifications).notifyCustomer(eq(10), eq("RENEWAL:30:" + today.plusDays(days) + ":" + milestone),
                contains("HD-30"), contains("TB-A101"), eq("RENEWAL"), eq("/kho-cua-toi/hop-dong/20"));
    }

    @ParameterizedTest @org.junit.jupiter.params.provider.ValueSource(ints = {-1, 16, 100})
    void expiredOrTooDistantContractDoesNotGenerateRenewalNotice(int days) {
        selected(row(days, "v4"));
        assertFalse(service.remindContract(30));
        verifyNoInteractions(notifications);
    }

    @Test void unknownOrNonActiveContractCannotBeReminded() {
        when(jdbc.queryForList(anyString(), eq(30))).thenReturn(List.of());
        assertFalse(service.remindContract(30));
        verifyNoInteractions(notifications);
    }

    @ParameterizedTest @CsvSource({"v4,true", "v3,false"})
    void centralStorageWarningOnlyAppliesToAcceptedTerms(String version, boolean warning) {
        selected(row(3, version)); notificationCreated();
        service.remindContract(30);
        var message = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(notifications).notifyCustomer(eq(10), anyString(), anyString(), message.capture(), eq("RENEWAL"), anyString());
        assertEquals(warning, message.getValue().contains("chuyển hàng vào kho tổng"));
    }

    @Test void duplicateNotificationIsNotCountedAsNewlySent() {
        selected(row(3, "v4"));
        assertFalse(service.remindContract(30));
    }

    @Test void missingReservationUsesMyStorageLandingPage() {
        var row = row(3, "v4"); row.put("reservation_id", null);
        selected(row); notificationCreated();
        assertTrue(service.remindContract(30));
        verify(notifications).notifyCustomer(eq(10), anyString(), anyString(), anyString(), eq("RENEWAL"), eq("/kho-cua-toi"));
    }

    @Test void scanCountsOnlyNewNotificationsNotDuplicateKeys() {
        when(jdbc.queryForList(anyString(), eq(today), eq(today.plusDays(15))))
                .thenReturn(List.of(row(3, "v4"), row(7, "v4")));
        when(notifications.notifyCustomer(anyInt(), anyString(), anyString(), anyString(), anyString(), anyString()))
                .thenReturn(new Notification(), (Notification) null);
        assertEquals(1, service.remindAll());
    }

    RentalContract overdue(int daysUntilLiquidation) {
        RentalContract contract = new RentalContract();
        contract.setId(30); contract.setContractCode("HD-30"); contract.setStatus("OVERDUE");
        contract.setEndDate(today.plusDays(daysUntilLiquidation).minusDays(16));
        User user = new User(); user.setId(10); contract.setCustomer(user);
        Reservation reservation = new Reservation(); reservation.setId(20); contract.setReservation(reservation);
        when(contracts.findById(30)).thenReturn(Optional.of(contract));
        when(lateFees.calculateLateFee(contract, today)).thenReturn(LateFeeCalculationResult.builder()
                .liquidationDaysThreshold(15).overdueDays(16 - daysUntilLiquidation)
                .lateFeeAmount(new BigDecimal("500000")).overstayFeeAmount(new BigDecimal("200000")).build());
        return contract;
    }

    @ParameterizedTest @CsvSource({"3,LIQUIDATION_WARN", "1,LIQUIDATION_WARN", "0,LIQUIDATION_DUE", "-1,LIQUIDATION_DUE"})
    void liquidationWarningAndDueNoticeUseSeparateDeduplicationKeys(int days, String prefix) {
        var contract = overdue(days); notificationCreated();
        assertTrue(service.warnLiquidationContract(30));
        verify(notifications).notifyCustomer(eq(10), eq(prefix + ":30:" + contract.getEndDate()),
                anyString(), contains("700.000đ"), eq("OVERDUE"), eq("/kho-cua-toi/hop-dong/20"));
    }

    @Test void liquidationMoreThanThreeDaysAwayIsNotWarnedEarly() {
        overdue(4);
        assertFalse(service.warnLiquidationContract(30));
        verifyNoInteractions(notifications);
    }

    @Test void waivedPenaltyIsExcludedButOverstayChargeStillAppearsInNotice() {
        overdue(1).setLateFeeWaived(true); notificationCreated();
        service.warnLiquidationContract(30);
        verify(notifications).notifyCustomer(eq(10), anyString(), anyString(), contains("200.000đ"), eq("OVERDUE"), anyString());
    }

    @Test void activeContractCannotReceiveLiquidationNotice() {
        overdue(1).setStatus("ACTIVE");
        assertFalse(service.warnLiquidationContract(30));
        verifyNoInteractions(notifications);
    }

    @Test void incompleteContractDoesNotProduceMisleadingLiquidationNotice() {
        overdue(1).setCustomer(null);
        assertFalse(service.warnLiquidationContract(30));
        verifyNoInteractions(notifications);
    }
}
