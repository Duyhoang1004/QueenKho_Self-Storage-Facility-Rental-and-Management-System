package com.queenkho.api.service;

import com.queenkho.api.dto.CreateReservationRequest;
import com.queenkho.api.dto.CreateReservationResponse;
import com.queenkho.api.entity.Facility;
import com.queenkho.api.entity.Reservation;
import com.queenkho.api.entity.UnitType;
import com.queenkho.api.entity.User;
import com.queenkho.api.exception.ReservationException;
import com.queenkho.api.repository.FacilityRepository;
import com.queenkho.api.repository.RentalContractRepository;
import com.queenkho.api.repository.ReservationRepository;
import com.queenkho.api.repository.StorageUnitRepository;
import com.queenkho.api.repository.UnitTypeRepository;
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
import org.springframework.jdbc.core.ResultSetExtractor;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ReservationServiceTest {

    @Mock
    private ReservationRepository reservationRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private FacilityRepository facilityRepository;

    @Mock
    private UnitTypeRepository unitTypeRepository;

    @Mock
    private StorageUnitRepository storageUnitRepository;

    @Mock
    private RentalContractRepository rentalContractRepository;

    @Mock
    private JdbcTemplate jdbcTemplate;

    @InjectMocks
    private ReservationService reservationService;

    private User testCustomer;
    private Facility testFacility;
    private UnitType testUnitType;

    @BeforeEach
    void setUp() {
        testCustomer = new User();
        testCustomer.setId(1);
        testCustomer.setFullName("Nguyen Van A");
        testCustomer.setEmail("customer1@gmail.com");

        testFacility = new Facility();
        testFacility.setId(1);
        testFacility.setName("QueenKho Tan Binh");

        testUnitType = new UnitType();
        testUnitType.setId(1);
        testUnitType.setName("Kho Mini");
        testUnitType.setBasePriceMonthly(new BigDecimal("1500000.00"));
        testUnitType.setStatus("ACTIVE");
    }

    @Test
    @DisplayName("UC-10.1: Tao don dat cho thanh cong voi gia coc 100% gia thue 1 thang")
    void testCreateReservation_Success() {
        CreateReservationRequest request = new CreateReservationRequest();
        request.setCustomerId(1);
        request.setFacilityId(1);
        request.setUnitTypeId(1);
        request.setDurationMonths(3);
        request.setStartDate(LocalDate.now().plusDays(2));

        when(userRepository.findById(1)).thenReturn(Optional.of(testCustomer));

        Map<String, Object> noDebtMap = new HashMap<>();
        noDebtMap.put("overdue_count", 0);
        noDebtMap.put("damage_count", 0);
        when(jdbcTemplate.queryForMap(anyString(), eq(1), eq(1), eq(1))).thenReturn(noDebtMap);

        when(facilityRepository.findById(1)).thenReturn(Optional.of(testFacility));
        when(unitTypeRepository.findById(1)).thenReturn(Optional.of(testUnitType));

        when(jdbcTemplate.query(anyString(), any(ResultSetExtractor.class), eq(1))).thenReturn(1);

        when(reservationRepository.save(any(Reservation.class))).thenAnswer(invocation -> {
            Reservation saved = invocation.getArgument(0);
            saved.setId(100);
            return saved;
        });

        CreateReservationResponse response = reservationService.createReservation(request);

        assertNotNull(response);
        assertEquals("PENDING", response.getStatus());
        assertEquals(new BigDecimal("1500000.00"), response.getDepositAmount());
        assertNotNull(response.getReservationCode());
        assertTrue(response.getReservationCode().startsWith("RES-"));
        verify(reservationRepository, times(1)).save(any(Reservation.class));
    }

    @Test
    @DisplayName("UC-10.2: Chan dat cho neu ngay bat dau trong qua khu")
    void testCreateReservation_StartDateInPast_ThrowsException() {
        CreateReservationRequest request = new CreateReservationRequest();
        request.setCustomerId(1);
        request.setStartDate(LocalDate.now().minusDays(1));
        request.setDurationMonths(1);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                reservationService.createReservation(request));
        assertEquals("Ngày bắt đầu không được ở quá khứ", ex.getMessage());
    }

    @Test
    @DisplayName("UC-10.3: Chan dat cho neu thoi gian thue nho hon 1 thang")
    void testCreateReservation_DurationZero_ThrowsException() {
        CreateReservationRequest request = new CreateReservationRequest();
        request.setCustomerId(1);
        request.setStartDate(LocalDate.now().plusDays(1));
        request.setDurationMonths(0);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                reservationService.createReservation(request));
        assertEquals("Thời gian thuê phải tối thiểu 1 tháng", ex.getMessage());
    }

    @Test
    @DisplayName("UC-10.4: Chan dat cho neu khach hang dang no qua han hoac no boi thuong")
    void testCreateReservation_CustomerHasDebt_ThrowsConflict() {
        CreateReservationRequest request = new CreateReservationRequest();
        request.setCustomerId(1);
        request.setStartDate(LocalDate.now().plusDays(1));
        request.setDurationMonths(2);

        when(userRepository.findById(1)).thenReturn(Optional.of(testCustomer));

        Map<String, Object> debtMap = new HashMap<>();
        debtMap.put("overdue_count", 1);
        debtMap.put("damage_count", 0);
        when(jdbcTemplate.queryForMap(anyString(), eq(1), eq(1), eq(1))).thenReturn(debtMap);

        ReservationException ex = assertThrows(ReservationException.class, () ->
                reservationService.createReservation(request));
        assertEquals(HttpStatus.CONFLICT, ex.getStatus());
        assertEquals("CUSTOMER_HAS_DEBT", ex.getCode());
    }

    @Test
    @DisplayName("UC-10.5: Chan dat cho neu loai kho dang INACTIVE")
    void testCreateReservation_UnitTypeInactive_ThrowsException() {
        testUnitType.setStatus("INACTIVE");

        CreateReservationRequest request = new CreateReservationRequest();
        request.setCustomerId(1);
        request.setFacilityId(1);
        request.setUnitTypeId(1);
        request.setStartDate(LocalDate.now().plusDays(1));
        request.setDurationMonths(1);

        when(userRepository.findById(1)).thenReturn(Optional.of(testCustomer));
        Map<String, Object> noDebtMap = new HashMap<>();
        noDebtMap.put("overdue_count", 0);
        noDebtMap.put("damage_count", 0);
        when(jdbcTemplate.queryForMap(anyString(), eq(1), eq(1), eq(1))).thenReturn(noDebtMap);

        when(facilityRepository.findById(1)).thenReturn(Optional.of(testFacility));
        when(unitTypeRepository.findById(1)).thenReturn(Optional.of(testUnitType));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                reservationService.createReservation(request));
        assertEquals("Loại kho này hiện đang tạm ngưng nhận đặt chỗ mới", ex.getMessage());
    }

    @Test
    @DisplayName("UC-10.6: Tinh deadline hoan tien 24h tu dong bo qua Chu Nhat")
    void testCalculateRefundDeadline_SkipsSunday() {
        LocalDateTime saturdayNoon = LocalDateTime.of(2026, 10, 24, 12, 0);
        LocalDateTime deadline = ReservationService.calculateRefundDeadline(saturdayNoon);

        assertNotEquals(DayOfWeek.SUNDAY, deadline.getDayOfWeek());
        assertEquals(DayOfWeek.MONDAY, deadline.getDayOfWeek());
    }
}
