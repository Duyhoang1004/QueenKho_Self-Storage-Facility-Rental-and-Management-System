package com.queenkho.api.service;

import com.queenkho.api.dto.CheckInRequest;
import com.queenkho.api.dto.StaffTaskResponse;
import com.queenkho.api.entity.RentalContract;
import com.queenkho.api.entity.Reservation;
import com.queenkho.api.entity.Role;
import com.queenkho.api.entity.StaffTask;
import com.queenkho.api.entity.User;
import com.queenkho.api.exception.StaffTaskException;
import com.queenkho.api.repository.StaffTaskRepository;
import com.queenkho.api.repository.SupportRequestRepository;
import com.queenkho.api.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

// Flow 5 (FM giao việc), BUG-06/K08 (hoàn tiền đúng giao dịch), L-17/F16 (không check-in trước ngày hẹn)
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class StaffTaskAssignAndRefundTest {

    @Mock StaffTaskRepository staffTaskRepository;
    @Mock UserRepository userRepository;
    @Mock SupportRequestRepository supportRequestRepository;
    @Mock ActivityLogService activityLogService;
    @Mock JdbcTemplate jdbcTemplate;

    @Mock LateFeeService lateFeeService;
    @InjectMocks StaffTaskService service;

    User manager;
    User staff;
    StaffTask task;

    private static User user(int id, String role, Integer facilityId, String status) {
        Role r = new Role();
        r.setName(role);
        User u = new User();
        u.setId(id);
        u.setRole(r);
        u.setFacilityId(facilityId);
        u.setStatus(status);
        u.setFullName(role + " " + id);
        return u;
    }

    @BeforeEach
    void setUp() {
        manager = user(6, "FACILITY_MANAGER", 1, "ACTIVE");
        staff = user(12, "STAFF", 1, "ACTIVE");
        task = new StaffTask();
        task.setId(50);
        task.setFacilityId(1);
        task.setTaskType("CHECK_IN");
        task.setStatus("OPEN");
        task.setDueAt(LocalDateTime.now().plusHours(5));
        when(userRepository.findById(6)).thenReturn(Optional.of(manager));
        when(userRepository.findById(12)).thenReturn(Optional.of(staff));
        when(staffTaskRepository.findById(50)).thenReturn(Optional.of(task));
    }

    @Test
    @DisplayName("FM giao task OPEN cho nhân viên cùng cơ sở → UPDATE có điều kiện + ghi log [TASK_ASSIGN]")
    void assignSuccess() {
        when(staffTaskRepository.assign(eq(50), eq(staff), any(LocalDateTime.class))).thenReturn(1);

        StaffTaskResponse response = service.assignTask(50, 6, 12);

        assertEquals(50, response.getId());
        verify(staffTaskRepository).assign(eq(50), eq(staff), any(LocalDateTime.class));
        verify(activityLogService).log(eq(6), startsWith("[TASK_ASSIGN]"), eq("facility_tasks"), eq("50"));
    }

    @Test
    @DisplayName("Giao cho nhân viên cơ sở khác → 400 INVALID_STAFF, không cập nhật")
    void assignToOtherFacilityStaffRejected() {
        when(userRepository.findById(20)).thenReturn(Optional.of(user(20, "STAFF", 2, "ACTIVE")));
        StaffTaskException ex = assertThrows(StaffTaskException.class, () -> service.assignTask(50, 6, 20));
        assertEquals("INVALID_STAFF", ex.getCode());
        verify(staffTaskRepository, never()).assign(anyInt(), any(), any());
    }

    @Test
    @DisplayName("Giao cho nhân viên đang bị khoá → 400 STAFF_INACTIVE")
    void assignToLockedStaffRejected() {
        when(userRepository.findById(13)).thenReturn(Optional.of(user(13, "STAFF", 1, "LOCKED")));
        StaffTaskException ex = assertThrows(StaffTaskException.class, () -> service.assignTask(50, 6, 13));
        assertEquals("STAFF_INACTIVE", ex.getCode());
    }

    @Test
    @DisplayName("Task hoàn tiền là việc của FM → không giao cho nhân viên")
    void refundTaskNotAssignable() {
        task.setTaskType("REFUND");
        StaffTaskException ex = assertThrows(StaffTaskException.class, () -> service.assignTask(50, 6, 12));
        assertEquals("TASK_NOT_ASSIGNABLE", ex.getCode());
    }

    @Test
    @DisplayName("Task của cơ sở khác → 403 FORBIDDEN_FACILITY")
    void taskOfOtherFacilityRejected() {
        task.setFacilityId(2);
        StaffTaskException ex = assertThrows(StaffTaskException.class, () -> service.assignTask(50, 6, 12));
        assertEquals(HttpStatus.FORBIDDEN, ex.getStatus());
        assertEquals("FORBIDDEN_FACILITY", ex.getCode());
    }

    @Test
    @DisplayName("Giao lại cho đúng người đang làm → 409 TASK_ALREADY_ASSIGNED")
    void assignSameStaffRejected() {
        task.setStaff(staff);
        task.setStatus("IN_PROGRESS");
        StaffTaskException ex = assertThrows(StaffTaskException.class, () -> service.assignTask(50, 6, 12));
        assertEquals("TASK_ALREADY_ASSIGNED", ex.getCode());
    }

    @Test
    @DisplayName("Task vừa quá hạn (UPDATE 0 dòng) → 409 TASK_OVERDUE")
    void assignOverdueTaskRejected() {
        when(staffTaskRepository.assign(eq(50), eq(staff), any(LocalDateTime.class))).thenReturn(0);
        StaffTask overdue = new StaffTask();
        overdue.setId(50);
        overdue.setStatus("OVERDUE");
        overdue.setDueAt(LocalDateTime.now().minusMinutes(1));
        when(staffTaskRepository.findById(50)).thenReturn(Optional.of(task), Optional.of(overdue));
        StaffTaskException ex = assertThrows(StaffTaskException.class, () -> service.assignTask(50, 6, 12));
        assertEquals("TASK_OVERDUE", ex.getCode());
    }

    @Test
    @DisplayName("Staff không được giao việc (chỉ FM)")
    void staffCannotAssign() {
        StaffTaskException ex = assertThrows(StaffTaskException.class, () -> service.assignTask(50, 12, 12));
        assertEquals("FORBIDDEN_ROLE", ex.getCode());
    }

    // ---------- BUG-06 / K08 ----------

    @Test
    @DisplayName("K08: task hoàn cọc huỷ đơn chỉ đánh SUCCESS giao dịch REFUND của ĐÚNG đơn trong note")
    void refundOfCancelledReservationTouchesOnlyThatReservation() {
        StaffTask refund = new StaffTask();
        refund.setTaskType("REFUND");
        refund.setNote("[HOÀN CỌC CK] Đơn: RES-123456 | Khách: A (SĐT: 09) | Số tiền hoàn: 100 VND");
        when(jdbcTemplate.update(anyString(), any(), any())).thenReturn(1);

        service.markRefundTransactionsSucceeded(refund, "BANK_TRANSFER");

        verify(jdbcTemplate).update(contains("reservation_code = ?"), eq("BANK_TRANSFER"), eq("RES-123456"));
        verify(jdbcTemplate, never()).update(contains("facility_id"), any(), any());
    }

    @Test
    @DisplayName("Task hoàn tiền VNPAY về muộn → chỉ giao dịch REF-LATE-<mã gốc>")
    void lateVnpayRefundTouchesOnlyItsTransaction() {
        StaffTask refund = new StaffTask();
        refund.setTaskType("REFUND");
        refund.setNote("[HOÀN TIỀN VNPAY VỀ MUỘN] Mã gốc: QKDABC123 | Số tiền: 10 VND | Lý do: x");

        service.markRefundTransactionsSucceeded(refund, "CASH");

        verify(jdbcTemplate).update(contains("transaction_code = ?"), eq("CASH"), eq("REF-LATE-QKDABC123"));
    }

    @Test
    @DisplayName("Task hoàn tiền trả kho (gắn HĐ) → REFUND PENDING của hợp đồng đó, trừ giao dịch về muộn")
    void checkoutRefundTouchesContract() {
        RentalContract contract = new RentalContract();
        contract.setId(77);
        StaffTask refund = new StaffTask();
        refund.setTaskType("REFUND");
        refund.setContract(contract);
        refund.setNote("Quyết toán trả kho ...");

        service.markRefundTransactionsSucceeded(refund, "BANK_TRANSFER");

        verify(jdbcTemplate).update(contains("contract_id = ?"), eq("BANK_TRANSFER"), eq(77));
    }

    @Test
    @DisplayName("Không xác định được giao dịch → không cập nhật gì (an toàn hơn cập nhật nhầm)")
    void unknownRefundTouchesNothing() {
        StaffTask refund = new StaffTask();
        refund.setTaskType("REFUND");
        refund.setNote("ghi chú tay");
        assertEquals(0, service.markRefundTransactionsSucceeded(refund, "CASH"));
        verifyNoInteractions(jdbcTemplate);
    }

    // ---------- L-17 / F16 ----------

    @Test
    @DisplayName("F16: hẹn nhận kho ngày mai → check-in hôm nay bị chặn 409 CHECK_IN_TOO_EARLY")
    void checkInBeforeAppointmentRejected() {
        Reservation reservation = new Reservation();
        reservation.setExpectedAppointmentTime(LocalDate.now().plusDays(1).atTime(9, 0));
        RentalContract contract = new RentalContract();
        contract.setId(9);
        contract.setStartDate(LocalDate.now().plusDays(1));
        contract.setReservation(reservation);
        task.setContract(contract);

        CheckInRequest request = new CheckInRequest();
        request.setIdentityVerified(true);
        request.setUnitEmpty(true);
        request.setUnitClean(true);
        request.setLockIntact(true);
        request.setCustomerSignatureConfirmed(true);
        request.setAccessPinCode("123456");
        request.setRfidCardCode("RFID-1");

        StaffTaskException ex = assertThrows(StaffTaskException.class, () -> service.checkIn(50, 12, request));
        assertEquals("CHECK_IN_TOO_EARLY", ex.getCode());
        verify(staffTaskRepository, never()).completeCheckIn(anyInt(), anyInt(), any());
    }
}
