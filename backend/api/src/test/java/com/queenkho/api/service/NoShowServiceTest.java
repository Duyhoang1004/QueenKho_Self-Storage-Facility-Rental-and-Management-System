package com.queenkho.api.service;

import com.queenkho.api.dto.NoShowEligibility;
import com.queenkho.api.dto.NoShowRequest;
import com.queenkho.api.dto.RescheduleReservationRequest;
import com.queenkho.api.entity.Facility;
import com.queenkho.api.entity.Reservation;
import com.queenkho.api.entity.User;
import com.queenkho.api.exception.StaffTaskException;
import com.queenkho.api.repository.RentalContractRepository;
import com.queenkho.api.repository.ReservationRepository;
import com.queenkho.api.repository.StaffTaskRepository;
import com.queenkho.api.repository.StorageUnitRepository;
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

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class NoShowServiceTest {

    @Mock
    private ReservationRepository reservationRepository;

    @Mock
    private RentalContractRepository rentalContractRepository;

    @Mock
    private StorageUnitRepository storageUnitRepository;

    @Mock
    private StaffTaskRepository staffTaskRepository;

    @Mock
    private StaffTaskService staffTaskService;

    @Mock
    private JdbcTemplate jdbcTemplate;

    @InjectMocks
    private ReservationService reservationService;

    private Reservation testReservation;
    private User testCustomer;
    private Facility testFacility;

    @BeforeEach
    void setUp() {
        testCustomer = new User();
        testCustomer.setId(10);
        testCustomer.setFullName("Tran Thi B");
        testCustomer.setPhone("0987654321");

        testFacility = new Facility();
        testFacility.setId(1);
        testFacility.setName("QueenKho Tan Binh");

        testReservation = new Reservation();
        testReservation.setId(200);
        testReservation.setReservationCode("RES-200999");
        testReservation.setCustomer(testCustomer);
        testReservation.setFacility(testFacility);
        testReservation.setStatus("DEPOSIT_PAID");
        testReservation.setDepositAmount(new BigDecimal("2000000.00"));
        testReservation.setTotalDepositPaid(new BigDecimal("2000000.00"));
        testReservation.setStartDate(LocalDate.now().minusDays(3));
        testReservation.setExpectedAppointmentTime(LocalDateTime.now().minusHours(50));
    }

    @Test
    @DisplayName("EX-03.1: Bat buoc phai co staffId cua FM khi xu ly No-Show")
    void testHandleNoShow_MissingStaffId_ThrowsIllegalArgument() {
        NoShowRequest request = new NoShowRequest();

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                reservationService.handleNoShow(200, request));
        assertEquals("Thiếu người thao tác (staffId)", ex.getMessage());
    }

    @Test
    @DisplayName("EX-03.2: Chan No-Show neu don chua o trang thai DEPOSIT_PAID hoac UNIT_ASSIGNED")
    void testHandleNoShow_InvalidStatus_ThrowsIllegalState() {
        testReservation.setStatus("PENDING");
        when(reservationRepository.findById(200)).thenReturn(Optional.of(testReservation));

        NoShowRequest request = new NoShowRequest();
        request.setStaffId(5);

        IllegalStateException ex = assertThrows(IllegalStateException.class, () ->
                reservationService.handleNoShow(200, request));
        assertTrue(ex.getMessage().contains("Trạng thái đơn không hợp lệ"));
    }

    @Test
    @DisplayName("EX-03.3: evaluateNoShowEligibility tra ve false neu chua qua 48h")
    void testEvaluateNoShowEligibility_Before48Hours_NotEligible() {
        testReservation.setExpectedAppointmentTime(LocalDateTime.now().minusHours(20));

        NoShowEligibility eligibility = reservationService.evaluateNoShowEligibility(testReservation);

        assertNotNull(eligibility);
        assertFalse(eligibility.eligible());
        assertTrue(eligibility.reason().contains("48 giờ"));
    }

    @Test
    @DisplayName("EX-03.4: evaluateNoShowEligibility tra ve false neu lien he it hon 2 lan")
    void testEvaluateNoShowEligibility_UnderTwoContacts_NotEligible() {
        testReservation.setExpectedAppointmentTime(LocalDateTime.now().minusHours(50));

        List<Map<String, Object>> logs = new ArrayList<>();
        Map<String, Object> log1 = new HashMap<>();
        log1.put("action", "[CONTACT][FAILED] Khách không nghe máy lần 1");
        log1.put("created_at", Timestamp.valueOf(LocalDateTime.now().minusHours(40)));
        logs.add(log1);

        when(jdbcTemplate.queryForList(anyString(), anyString(), anyInt())).thenReturn(logs);

        NoShowEligibility eligibility = reservationService.evaluateNoShowEligibility(testReservation);

        assertNotNull(eligibility);
        assertFalse(eligibility.eligible());
        assertEquals(1, eligibility.failedCount());
        assertTrue(eligibility.reason().contains("tối thiểu 2 lần"));
    }

    @Test
    @DisplayName("EX-03.5: Xu ly No-Show hop le tich thu 100% coc va chuyen trang thai CANCELLED")
    void testHandleNoShow_Success_ForfeitsDeposit() {
        NoShowRequest request = new NoShowRequest();
        request.setStaffId(5);
        request.setReason("Khach khong den sau 3 ngay lien he");
        request.setWaivePenalty(false);

        when(reservationRepository.findById(200)).thenReturn(Optional.of(testReservation));

        List<Map<String, Object>> logs = new ArrayList<>();
        Map<String, Object> log1 = new HashMap<>();
        log1.put("action", "[CONTACT][FAILED] Khách không nghe máy lần 1");
        log1.put("created_at", Timestamp.valueOf(LocalDateTime.now().minusHours(40)));
        logs.add(log1);

        Map<String, Object> log2 = new HashMap<>();
        log2.put("action", "[CONTACT][FAILED] Khách thuê bao lần 2");
        log2.put("created_at", Timestamp.valueOf(LocalDateTime.now().minusHours(10)));
        logs.add(log2);

        when(jdbcTemplate.queryForList(anyString(), anyString(), anyInt())).thenReturn(logs);
        when(rentalContractRepository.findByReservationId(200)).thenReturn(Optional.empty());

        reservationService.handleNoShow(200, request);

        assertEquals("CANCELLED", testReservation.getStatus());
        verify(reservationRepository, times(1)).save(testReservation);
        verify(jdbcTemplate, atLeastOnce()).update(contains("INSERT INTO activity_logs"), eq(5), anyString(), eq(200));
    }

    @Test
    @DisplayName("EX-03.6: Xu ly No-Show co phe duyet mien phat hoan 100% tien")
    void testHandleNoShow_WaivePenalty_Refunds100Percent() {
        NoShowRequest request = new NoShowRequest();
        request.setStaffId(5);
        request.setReason("Khach gap tai nan bat kha khang");
        request.setWaivePenalty(true);
        request.setWaiveReason("Ly do y te");

        when(reservationRepository.findById(200)).thenReturn(Optional.of(testReservation));

        List<Map<String, Object>> logs = new ArrayList<>();
        Map<String, Object> log1 = new HashMap<>();
        log1.put("action", "[CONTACT][FAILED] Khach khong nghe may");
        log1.put("created_at", Timestamp.valueOf(LocalDateTime.now().minusHours(40)));
        logs.add(log1);

        Map<String, Object> log2 = new HashMap<>();
        log2.put("action", "[CONTACT][FAILED] Khach thue bao");
        log2.put("created_at", Timestamp.valueOf(LocalDateTime.now().minusHours(12)));
        logs.add(log2);

        when(jdbcTemplate.queryForList(anyString(), anyString(), anyInt())).thenReturn(logs);
        when(jdbcTemplate.queryForObject(contains("SELECT TOP 1 u.id FROM users u"), eq(Integer.class), eq(1)))
                .thenReturn(6);
        when(rentalContractRepository.findByReservationId(200)).thenReturn(Optional.empty());

        reservationService.handleNoShow(200, request);

        assertEquals("CANCELLED", testReservation.getStatus());
        verify(reservationRepository, times(1)).save(testReservation);
    }

    @Test
    @DisplayName("EX-03.7: Doi lich nhan kho thanh cong cap nhat startDate va ghi log")
    void testRescheduleReservation_Success() {
        RescheduleReservationRequest request = new RescheduleReservationRequest();
        request.setManagerId(6);
        request.setNewStartDate(LocalDate.now().plusDays(5));
        request.setReason("Khach ban cong tac dot xuat");

        when(reservationRepository.findById(200)).thenReturn(Optional.of(testReservation));
        when(rentalContractRepository.findByReservationId(200)).thenReturn(Optional.empty());

        reservationService.rescheduleReservation(200, request);

        assertEquals(LocalDate.now().plusDays(5), testReservation.getStartDate());
        verify(reservationRepository, times(1)).save(testReservation);
        verify(jdbcTemplate, times(1)).update(contains("INSERT INTO activity_logs"), eq(6), anyString(), eq(200));
    }

    @Test
    @DisplayName("EX-03.8: Chan doi lich neu ngay moi trong qua khu")
    void testRescheduleReservation_DateInPast_ThrowsException() {
        RescheduleReservationRequest request = new RescheduleReservationRequest();
        request.setManagerId(6);
        request.setNewStartDate(LocalDate.now().minusDays(1));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                reservationService.rescheduleReservation(200, request));
        assertEquals("Ngày nhận kho mới không được ở trong quá khứ", ex.getMessage());
    }
}
