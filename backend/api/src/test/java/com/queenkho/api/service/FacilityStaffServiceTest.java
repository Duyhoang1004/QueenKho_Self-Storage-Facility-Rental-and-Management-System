package com.queenkho.api.service;

import com.queenkho.api.dto.CreateFacilityStaffRequest;
import com.queenkho.api.dto.FacilityStaffResponse;
import com.queenkho.api.dto.ResetFacilityStaffPasswordRequest;
import com.queenkho.api.dto.UpdateFacilityStaffStatusRequest;
import com.queenkho.api.entity.Facility;
import com.queenkho.api.entity.Role;
import com.queenkho.api.entity.User;
import com.queenkho.api.exception.AdminException;
import com.queenkho.api.repository.FacilityRepository;
import com.queenkho.api.repository.RoleRepository;
import com.queenkho.api.repository.StaffTaskRepository;
import com.queenkho.api.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class FacilityStaffServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private RoleRepository roleRepository;

    @Mock
    private FacilityRepository facilityRepository;

    @Mock
    private StaffTaskRepository staffTaskRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private ActivityLogService activityLogService;

    @Mock
    private JdbcTemplate jdbcTemplate;

    @InjectMocks
    private FacilityStaffService facilityStaffService;

    private Facility testFacility;
    private Role staffRole;
    private User testStaff;

    @BeforeEach
    void setUp() {
        testFacility = Facility.builder()
                .id(1)
                .code("TB")
                .name("QueenKho Tân Bình")
                .status("ACTIVE")
                .build();

        staffRole = new Role(2, "STAFF", "Nhân viên tại cơ sở");

        testStaff = User.builder()
                .id(10)
                .fullName("Nguyễn Văn An")
                .email("an.nguyen@gmail.com")
                .phone("0901234567")
                .facilityId(1)
                .role(staffRole)
                .status("ACTIVE")
                .build();
    }

    @Test
    @DisplayName("PR-22: Tạo nhân viên thành công cho cơ sở của FM")
    void createStaff_Success() {
        CreateFacilityStaffRequest req = new CreateFacilityStaffRequest(
                "Trần Văn Bình", "binh.tran@queenkho.com", "0912345678", "password123"
        );

        when(facilityRepository.findById(1)).thenReturn(Optional.of(testFacility));
        when(userRepository.existsByEmailIgnoreCase("binh.tran@queenkho.com")).thenReturn(false);
        when(roleRepository.findByName("STAFF")).thenReturn(Optional.of(staffRole));
        when(passwordEncoder.encode("password123")).thenReturn("hashedPassword");

        FacilityStaffResponse response = facilityStaffService.createStaff(req, 99, 1);

        assertNotNull(response);
        assertEquals("Trần Văn Bình", response.getFullName());
        assertEquals("binh.tran@queenkho.com", response.getEmail());
        assertEquals("ACTIVE", response.getStatus());
        assertEquals(1, response.getFacilityId());
        verify(userRepository, times(1)).save(any(User.class));
        verify(activityLogService, times(1)).log(eq(99), contains("[STAFF_CREATE]"), eq("users"), any());
    }

    @Test
    @DisplayName("PR-M12: Thất bại khi trùng email")
    void createStaff_DuplicateEmail_ThrowsException() {
        CreateFacilityStaffRequest req = new CreateFacilityStaffRequest(
                "Trần Văn Bình", "duplicate@queenkho.com", "0912345678", "password123"
        );

        when(facilityRepository.findById(1)).thenReturn(Optional.of(testFacility));
        when(userRepository.existsByEmailIgnoreCase("duplicate@queenkho.com")).thenReturn(true);

        AdminException ex = assertThrows(AdminException.class, () ->
                facilityStaffService.createStaff(req, 99, 1)
        );

        assertEquals(HttpStatus.CONFLICT, ex.getStatus());
        assertEquals("DUPLICATE_EMAIL", ex.getCode());
        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("PR-M12: Thất bại khi sai định dạng số điện thoại")
    void createStaff_InvalidPhone_ThrowsException() {
        CreateFacilityStaffRequest req = new CreateFacilityStaffRequest(
                "Trần Văn Bình", "valid@queenkho.com", "12345", "password123"
        );

        when(facilityRepository.findById(1)).thenReturn(Optional.of(testFacility));
        when(userRepository.existsByEmailIgnoreCase("valid@queenkho.com")).thenReturn(false);

        AdminException ex = assertThrows(AdminException.class, () ->
                facilityStaffService.createStaff(req, 99, 1)
        );

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertEquals("INVALID_PHONE", ex.getCode());
    }

    @Test
    @DisplayName("PR-06: Chặn khóa nhân viên đang giữ task IN_PROGRESS hoặc OVERDUE")
    void changeStatus_LockingStaffWithHoldingTasks_ThrowsException() {
        UpdateFacilityStaffStatusRequest req = new UpdateFacilityStaffStatusRequest("LOCKED", "Nghỉ phép");

        when(userRepository.findById(10)).thenReturn(Optional.of(testStaff));
        when(staffTaskRepository.existsByStaff_IdAndStatusIn(eq(10), anyList())).thenReturn(true);

        AdminException ex = assertThrows(AdminException.class, () ->
                facilityStaffService.changeStatus(10, req, 99, 1)
        );

        assertEquals(HttpStatus.CONFLICT, ex.getStatus());
        assertEquals("STAFF_HAS_TASK_IN_PROGRESS", ex.getCode());
        verify(userRepository, never()).save(testStaff);
    }

    @Test
    @DisplayName("PR-06: Khóa nhân viên thành công khi không có task đang làm")
    void changeStatus_LockingStaffWithoutHoldingTasks_Success() {
        UpdateFacilityStaffStatusRequest req = new UpdateFacilityStaffStatusRequest("LOCKED", "Nghỉ phép dài hạn");

        when(userRepository.findById(10)).thenReturn(Optional.of(testStaff));
        when(staffTaskRepository.existsByStaff_IdAndStatusIn(eq(10), anyList())).thenReturn(false);
        when(facilityRepository.findById(1)).thenReturn(Optional.of(testFacility));

        FacilityStaffResponse response = facilityStaffService.changeStatus(10, req, 99, 1);

        assertNotNull(response);
        assertEquals("LOCKED", testStaff.getStatus());
        verify(userRepository, times(1)).save(testStaff);
        verify(activityLogService, times(1)).log(eq(99), contains("[STAFF_LOCK]"), eq("users"), eq("10"));
    }

    @Test
    @DisplayName("Mở khóa nhân viên thành công")
    void changeStatus_UnlockingStaff_Success() {
        testStaff.setStatus("LOCKED");
        UpdateFacilityStaffStatusRequest req = new UpdateFacilityStaffStatusRequest("ACTIVE", "Đi làm lại");

        when(userRepository.findById(10)).thenReturn(Optional.of(testStaff));
        when(facilityRepository.findById(1)).thenReturn(Optional.of(testFacility));

        FacilityStaffResponse response = facilityStaffService.changeStatus(10, req, 99, 1);

        assertNotNull(response);
        assertEquals("ACTIVE", testStaff.getStatus());
        verify(userRepository, times(1)).save(testStaff);
        verify(activityLogService, times(1)).log(eq(99), contains("[STAFF_UNLOCK]"), eq("users"), eq("10"));
    }

    @Test
    @DisplayName("Chặn FM thao tác trên nhân viên cơ sở khác")
    void changeStatus_StaffOfAnotherFacility_Forbidden() {
        testStaff.setFacilityId(2); // Cơ sở khác
        UpdateFacilityStaffStatusRequest req = new UpdateFacilityStaffStatusRequest("LOCKED", "Khóa");

        when(userRepository.findById(10)).thenReturn(Optional.of(testStaff));

        AdminException ex = assertThrows(AdminException.class, () ->
                facilityStaffService.changeStatus(10, req, 99, 1) // FM cơ sở 1
        );

        assertEquals(HttpStatus.FORBIDDEN, ex.getStatus());
        assertEquals("FORBIDDEN_FACILITY", ex.getCode());
    }

    @Test
    @DisplayName("Đặt lại mật khẩu thành công")
    void resetPassword_Success() {
        ResetFacilityStaffPasswordRequest req = new ResetFacilityStaffPasswordRequest("newSecret123");

        when(userRepository.findById(10)).thenReturn(Optional.of(testStaff));
        when(passwordEncoder.encode("newSecret123")).thenReturn("newHashed");

        facilityStaffService.resetPassword(10, req, 99, 1);

        assertEquals("newHashed", testStaff.getPassword());
        verify(userRepository, times(1)).save(testStaff);
        verify(activityLogService, times(1)).log(eq(99), contains("[STAFF_RESET_PASSWORD]"), eq("users"), eq("10"));
    }
}
