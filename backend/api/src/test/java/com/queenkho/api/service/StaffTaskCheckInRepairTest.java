package com.queenkho.api.service;

import tools.jackson.databind.ObjectMapper;
import com.queenkho.api.entity.HandoverRecord;
import com.queenkho.api.entity.RentalContract;
import com.queenkho.api.entity.StaffTask;
import com.queenkho.api.entity.StorageUnit;
import com.queenkho.api.entity.User;
import com.queenkho.api.repository.HandoverRecordRepository;
import com.queenkho.api.repository.StaffTaskRepository;
import com.queenkho.api.repository.StorageUnitRepository;
import com.queenkho.api.repository.UserRepository;
import com.queenkho.api.security.CurrentUser;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StaffTaskCheckInRepairTest {

    @Mock StaffTaskRepository staffTaskRepository;
    @Mock HandoverRecordRepository handoverRecordRepository;
    @Mock StorageUnitRepository storageUnitRepository;
    @Mock UserRepository userRepository;
    @Mock UnitScheduleService unitScheduleService;
    @Mock JdbcTemplate jdbcTemplate;
    @Spy ObjectMapper objectMapper = new ObjectMapper();
    @InjectMocks StaffTaskService service;

    private final CurrentUser manager = new CurrentUser(6, "FACILITY_MANAGER", 1, "FM", "fm@example.com");
    private StorageUnit unit;

    @BeforeEach
    void setUp() {
        unit = new StorageUnit();
        unit.setId("KV-TD-M201");
        unit.setStatus("AVAILABLE");

        RentalContract contract = new RentalContract();
        contract.setId(107);
        contract.setStorageUnit(unit);

        StaffTask checkIn = new StaffTask();
        checkIn.setId(171);
        checkIn.setFacilityId(1);
        checkIn.setContract(contract);

        StaffTask repair = new StaffTask();
        repair.setId(172);
        repair.setMaintenanceReason("CHECKIN_REPAIR");
        repair.setStatus("COMPLETED");
        repair.setCreatedAt(LocalDateTime.of(2026, 11, 27, 9, 5, 27));
        repair.setCompletedAt(LocalDateTime.of(2026, 11, 27, 9, 8, 15));
        repair.setEvidenceImageUrl("http://localhost:8080/uploads/after.jpg");
        repair.setNote("[Hoàn tất bởi Staff] | [CHECKIN_UNIT=KV-TD-M201] Xử lý sự cố trước bàn giao");

        when(jdbcTemplate.queryForList(contains("UPDLOCK"), eq(Integer.class), eq(171)))
                .thenReturn(List.of(171));
        when(jdbcTemplate.queryForList(contains("FROM handover_records"), any(Object[].class)))
                .thenReturn(List.of(Map.of(
                        "id", 236,
                        "record_type", "CI_BLOCKER",
                        "created_at", Timestamp.valueOf("2026-11-27 09:05:11"),
                        "notes", "{\"issueType\":\"FACILITY_ISSUE\",\"unitId\":\"KV-TD-M201\",\"draftId\":235}")));
        when(staffTaskRepository.findDetailById(171)).thenReturn(Optional.of(checkIn));
        when(staffTaskRepository.findByContractIdAndTaskTypeAndStatusIn(
                107, "MAINTENANCE", List.of("COMPLETED"))).thenReturn(List.of(repair));
        when(unitScheduleService.bookingsOfUnit("KV-TD-M201")).thenReturn(List.of());
        when(userRepository.getReferenceById(6)).thenReturn(new User());
    }

    @Test
    void fmCanConfirmCompletedRepairWhenCompletionNotePrecedesUnitMarker() {
        assertEquals("RESOLVED", service.confirmCheckInRepair(171, manager, "Ô đã sửa xong và đạt yêu cầu").get("status"));

        ArgumentCaptor<HandoverRecord> event = ArgumentCaptor.forClass(HandoverRecord.class);
        verify(handoverRecordRepository).saveAndFlush(event.capture());
        assertEquals("CI_REOPEN", event.getValue().getRecordType());
        assertEquals("http://localhost:8080/uploads/after.jpg", event.getValue().getEvidenceImageUrls());
    }

    @Test
    void fmUnlocksUnitAfterCompletedRepairIfItIsStillMarkedMaintenance() {
        unit.setStatus("MAINTENANCE");
        unit.setMaintenanceSince(LocalDateTime.of(2026, 11, 27, 9, 5));
        unit.setMaintenanceNote("Sự cố lúc check-in");
        when(jdbcTemplate.queryForObject(contains("SELECT COUNT(*) FROM facility_tasks"),
                eq(Integer.class), eq("KV-TD-M201"), eq(172))).thenReturn(0);

        assertEquals("RESOLVED", service.confirmCheckInRepair(171, manager, "Ô đã sửa xong và đạt yêu cầu").get("status"));

        assertEquals("AVAILABLE", unit.getStatus());
        assertNull(unit.getMaintenanceSince());
        assertNull(unit.getMaintenanceNote());
        verify(storageUnitRepository).save(unit);
        verify(unitScheduleService).refreshUnitStatus(unit);
    }
}
