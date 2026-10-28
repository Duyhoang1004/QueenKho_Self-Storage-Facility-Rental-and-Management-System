package com.queenkho.api.service;

import com.queenkho.api.dto.CheckOutRequest;
import com.queenkho.api.dto.CompleteMaintenanceRequest;
import com.queenkho.api.dto.StaffTaskDetailResponse;
import com.queenkho.api.entity.RentalContract;
import com.queenkho.api.entity.Role;
import com.queenkho.api.entity.StaffTask;
import com.queenkho.api.entity.StorageUnit;
import com.queenkho.api.entity.User;
import com.queenkho.api.exception.StaffTaskException;
import com.queenkho.api.repository.DamageCaseRepository;
import com.queenkho.api.repository.FacilityRepository;
import com.queenkho.api.repository.HandoverRecordRepository;
import com.queenkho.api.repository.HeldGoodsRepository;
import com.queenkho.api.repository.ReservationRepository;
import com.queenkho.api.repository.StaffTaskRepository;
import com.queenkho.api.repository.StorageUnitRepository;
import com.queenkho.api.repository.SupportRequestRepository;
import com.queenkho.api.repository.UserRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.jdbc.core.JdbcTemplate;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

// PR-O10: hoàn tất task bảo trì ô kho + UC-24: phân lỗi sự cố khi nghiệm thu trả kho
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MaintenanceTaskTest {

    @Mock StaffTaskRepository staffTaskRepository;
    @Mock UserRepository userRepository;
    @Mock StorageUnitRepository storageUnitRepository;
    @Mock DamageCaseRepository damageCaseRepository;
    @Mock FacilityRepository facilityRepository;
    @Mock HandoverRecordRepository handoverRecordRepository;
    @Mock ReservationRepository reservationRepository;
    @Mock SupportRequestRepository supportRequestRepository;
    @Mock ActivityLogService activityLogService;
    @Mock JdbcTemplate jdbcTemplate;
    @Mock EntityManager entityManager;
    @Mock HeldGoodsService heldGoodsService;
    @Mock HeldGoodsRepository heldGoodsRepository;

    @Mock LateFeeService lateFeeService;
    @InjectMocks StaffTaskService service;

    User manager;
    User staff;
    User otherStaff;
    StaffTask task;
    StorageUnit unit;

    private static User user(int id, String role) {
        Role r = new Role();
        r.setName(role);
        User u = new User();
        u.setId(id);
        u.setRole(r);
        u.setFacilityId(1);
        u.setStatus("ACTIVE");
        u.setFullName(role + " " + id);
        return u;
    }

    private static CompleteMaintenanceRequest body(String note) {
        CompleteMaintenanceRequest req = new CompleteMaintenanceRequest();
        req.setNote(note);
        return req;
    }

    @BeforeEach
    void setUp() {
        manager = user(6, "FACILITY_MANAGER");
        staff = user(12, "STAFF");
        otherStaff = user(13, "STAFF");

        unit = new StorageUnit();
        unit.setId("KV-TB-A001");
        unit.setStatus("MAINTENANCE");
        RentalContract contract = new RentalContract();
        contract.setId(9);
        contract.setContractCode("HD-1");
        contract.setStatus("TERMINATED");
        contract.setStorageUnit(unit);

        task = new StaffTask();
        task.setId(70);
        task.setFacilityId(1);
        task.setTaskType("MAINTENANCE");
        task.setStatus("IN_PROGRESS");
        task.setStaff(staff);
        task.setContract(contract);
        task.setNote("Khắc phục sự cố sau trả kho ô KV-TB-A001");
        task.setDueAt(LocalDateTime.now().plusDays(3));

        when(userRepository.findById(6)).thenReturn(Optional.of(manager));
        when(userRepository.findById(12)).thenReturn(Optional.of(staff));
        when(userRepository.findById(13)).thenReturn(Optional.of(otherStaff));
        when(staffTaskRepository.findById(70)).thenReturn(Optional.of(task));
        when(staffTaskRepository.findDetailById(70)).thenReturn(Optional.of(task));
    }

    @Test
    @DisplayName("Staff đang giữ task bấm Sửa xong → task COMPLETED (UPDATE có điều kiện), ô MAINTENANCE → AVAILABLE, log [MAINTENANCE_DONE]")
    void staffCompletesMaintenance() {
        when(staffTaskRepository.completeMaintenanceByStaff(eq(70), eq(12), any(LocalDateTime.class), anyString(), isNull()))
                .thenReturn(1);

        StaffTaskDetailResponse response = service.completeMaintenanceTask(70, 12, body("Đã thay khoá mới, sơn lại vách ngăn"));

        assertEquals(70, response.getId());
        assertEquals("AVAILABLE", unit.getStatus());
        verify(storageUnitRepository).save(unit);
        verify(staffTaskRepository).completeMaintenanceByStaff(eq(70), eq(12), any(LocalDateTime.class),
                contains("Đã thay khoá mới"), isNull());
        verify(activityLogService).log(eq(12), startsWith("[MAINTENANCE_DONE]"), eq("facility_tasks"), eq("70"));
    }

    @Test
    @DisplayName("FM đóng thẳng task bảo trì (không cần nhận việc) → dùng câu UPDATE của quản lý")
    void managerCompletesMaintenanceDirectly() {
        task.setStatus("OPEN");
        task.setStaff(null);
        when(staffTaskRepository.completeMaintenanceByManager(eq(70), any(LocalDateTime.class), anyString(), eq("http://x/after.png")))
                .thenReturn(1);
        CompleteMaintenanceRequest req = body("Dọn sạch ô sau thanh lý, đã kiểm kê");
        req.setEvidenceImageUrl("http://x/after.png");

        service.completeMaintenanceTask(70, 6, req);

        verify(staffTaskRepository, never()).completeMaintenanceByStaff(any(), any(), any(), any(), any());
        assertEquals("AVAILABLE", unit.getStatus());
    }

    @Test
    @DisplayName("Nhân viên khác bấm Sửa xong → 409 TASK_NOT_YOURS, ô vẫn MAINTENANCE")
    void otherStaffCannotComplete() {
        when(staffTaskRepository.completeMaintenanceByStaff(eq(70), eq(13), any(), anyString(), any())).thenReturn(0);

        StaffTaskException ex = assertThrows(StaffTaskException.class,
                () -> service.completeMaintenanceTask(70, 13, body("Đã sửa xong hết rồi nhé")));

        assertEquals("TASK_NOT_YOURS", ex.getCode());
        assertEquals("MAINTENANCE", unit.getStatus());
    }

    @Test
    @DisplayName("Bấm Sửa xong lần 2 → 409 TASK_ALREADY_COMPLETED")
    void secondClickIsRejected() {
        when(staffTaskRepository.completeMaintenanceByStaff(any(), any(), any(), any(), any())).thenReturn(0);
        task.setStatus("COMPLETED");

        StaffTaskException ex = assertThrows(StaffTaskException.class,
                () -> service.completeMaintenanceTask(70, 12, body("Đã sửa xong hết rồi nhé")));

        assertEquals("TASK_ALREADY_COMPLETED", ex.getCode());
    }

    @Test
    @DisplayName("Ghi chú < 10 ký tự → 400; task không phải bảo trì → 409 TASK_NOT_MAINTENANCE")
    void validatesInput() {
        assertEquals("INVALID_INPUT", assertThrows(StaffTaskException.class,
                () -> service.completeMaintenanceTask(70, 12, body("xong"))).getCode());

        task.setTaskType("CHECK_OUT");
        assertEquals("TASK_NOT_MAINTENANCE", assertThrows(StaffTaskException.class,
                () -> service.completeMaintenanceTask(70, 12, body("Đã sửa xong hết rồi nhé"))).getCode());
        verify(staffTaskRepository, never()).completeMaintenanceByStaff(any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("PR-Q10: Dọn xong task thanh lý thiếu biên bản kiểm kê → 400 INVENTORY_REQUIRED, chưa đóng task")
    void cleanupRequiresInventory() {
        task.setMaintenanceReason("LIQUIDATION");

        StaffTaskException ex = assertThrows(StaffTaskException.class,
                () -> service.completeMaintenanceTask(70, 12, body("Đã dọn sạch ô sau thanh lý")));

        assertEquals("INVENTORY_REQUIRED", ex.getCode());
        verify(staffTaskRepository, never()).completeMaintenanceByStaff(any(), any(), any(), any(), any());
        verifyNoInteractions(heldGoodsService);
    }

    @Test
    @DisplayName("PR-Q10: Dọn xong có kiểm kê → lập hồ sơ lưu giữ; đánh dấu ô trống → không lập")
    void cleanupCreatesHeldGoods() {
        task.setMaintenanceReason("LIQUIDATION");
        when(staffTaskRepository.completeMaintenanceByStaff(eq(70), eq(12), any(), anyString(), any())).thenReturn(1);
        CompleteMaintenanceRequest req = body("Đã dọn sạch ô sau thanh lý");
        req.setInventoryNote("12 thùng carton, 1 tủ lạnh mini");
        req.setWitnessNote("Staff 12 + FM Tân Bình");
        req.setStorageLocation("Kho K2 - kệ 3");
        req.setInventoryImages(List.of("http://x/inv1.png", " "));

        service.completeMaintenanceTask(70, 12, req);

        verify(heldGoodsService).createFromCleanup(eq(task), eq(task.getContract()), eq(staff),
                eq("12 thùng carton, 1 tủ lạnh mini"), eq(List.of("http://x/inv1.png")), eq("Staff 12 + FM Tân Bình"), eq("Kho K2 - kệ 3"));

        task.setStatus("IN_PROGRESS");
        CompleteMaintenanceRequest empty = body("Ô trống, khách không để lại gì");
        empty.setNoGoodsLeft(true);
        service.completeMaintenanceTask(70, 12, empty);
        verify(heldGoodsService, times(1)).createFromCleanup(any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("FM Mở lại kho → task bảo trì còn mở của ô được đóng luôn + ghi log")
    void reopenUnitClosesOpenMaintenance() {
        when(staffTaskRepository.findMaintenanceByUnitAndStatusIn(eq("KV-TB-A001"), anyCollection())).thenReturn(List.of(task));

        int closed = service.closeOpenMaintenanceForUnit("KV-TB-A001", 6);

        assertEquals(1, closed);
        assertEquals("COMPLETED", task.getStatus());
        assertNotNull(task.getCompletedAt());
        assertTrue(task.getNote().contains("[FM mở lại kho"));
        verify(staffTaskRepository).saveAll(List.of(task));
    }

    @Test
    @DisplayName("UC-24: sự cố chưa chọn lỗi khách / lỗi cơ sở → 400 INVALID_DAMAGE_ITEM, chưa đóng task")
    void checkOutRequiresLiableParty() {
        task.setTaskType("CHECK_OUT");
        CheckOutRequest.DamageItemRequest item = new CheckOutRequest.DamageItemRequest();
        item.setTitle("Vỡ vách ngăn");
        item.setEstimatedCost(BigDecimal.valueOf(500000));
        item.setEvidenceImages(List.of("http://x/1.png"));
        CheckOutRequest req = new CheckOutRequest();
        req.setIdentityVerified(true);
        req.setUnitEmpty(true);
        req.setCustomerSignatureConfirmed(true);
        req.setUnitClean(true);
        req.setLockIntact(false);
        req.setDamageCases(List.of(item));

        StaffTaskException ex = assertThrows(StaffTaskException.class, () -> service.checkOut(70, 12, req));

        assertEquals("INVALID_DAMAGE_ITEM", ex.getCode());
        verify(staffTaskRepository, never()).completeCheckOut(any(), any(), any());
    }
}
