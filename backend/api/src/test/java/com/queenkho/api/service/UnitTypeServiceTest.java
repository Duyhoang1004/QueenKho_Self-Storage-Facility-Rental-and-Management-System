package com.queenkho.api.service;

import com.queenkho.api.dto.*;
import com.queenkho.api.entity.UnitType;
import com.queenkho.api.exception.UnitTypeException;
import com.queenkho.api.repository.ReservationRepository;
import com.queenkho.api.repository.StorageUnitRepository;
import com.queenkho.api.repository.UnitTypeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UnitTypeServiceTest {

    @Mock
    private UnitTypeRepository unitTypeRepository;

    @Mock
    private StorageUnitRepository storageUnitRepository;

    @Mock
    private ReservationRepository reservationRepository;

    @Mock
    private ActivityLogService activityLogService;

    @Mock
    private JdbcTemplate jdbcTemplate;

    @InjectMocks
    private UnitTypeService unitTypeService;

    private UnitType activeType;
    private UnitType inactiveType;

    @BeforeEach
    void setUp() {
        activeType = UnitType.builder()
                .id(1)
                .name("Kho Tiêu Chuẩn 6m2")
                .areaSqm(new BigDecimal("6.00"))
                .volumeCbm(new BigDecimal("16.20"))
                .basePriceMonthly(new BigDecimal("1850000"))
                .suggestedCapacity("15-20 thùng carton")
                .dimensions("2.0m x 3.0m x 2.7m")
                .features("Máy lạnh 24/7")
                .status("ACTIVE")
                .build();

        inactiveType = UnitType.builder()
                .id(2)
                .name("Kho Tạm Ngưng 2m2")
                .areaSqm(new BigDecimal("2.00"))
                .volumeCbm(new BigDecimal("4.80"))
                .basePriceMonthly(new BigDecimal("500000"))
                .suggestedCapacity("5 thùng carton")
                .dimensions("1.0m x 2.0m x 2.4m")
                .features("Tiêu chuẩn")
                .status("INACTIVE")
                .build();
    }

    @Test
    @DisplayName("UC-09 / PR-M4: getAllUnitTypes chỉ trả về các loại kho đang ACTIVE cho khách đặt chỗ")
    void testGetAllUnitTypes_OnlyActive() {
        when(unitTypeRepository.findByStatusIgnoreCase("ACTIVE")).thenReturn(List.of(activeType));

        List<UnitTypeResponse> results = unitTypeService.getAllUnitTypes();

        assertEquals(1, results.size());
        assertEquals("Kho Tiêu Chuẩn 6m2", results.get(0).getName());
        assertEquals("ACTIVE", results.get(0).getStatus());
        verify(unitTypeRepository).findByStatusIgnoreCase("ACTIVE");
    }

    @Test
    @DisplayName("UC-05: getBomUnitTypes trả về cả ACTIVE và INACTIVE kèm thống kê ô kho")
    void testGetBomUnitTypes() {
        when(unitTypeRepository.findAll()).thenReturn(List.of(activeType, inactiveType));
        when(storageUnitRepository.countAllGroupedByUnitTypeSystemWide()).thenReturn(List.of(
                new Object[]{1, 10L},
                new Object[]{2, 0L}
        ));
        when(storageUnitRepository.countStatusGroupedByUnitTypeSystemWide()).thenReturn(List.of(
                new Object[]{1, "AVAILABLE", 6L},
                new Object[]{1, "OCCUPIED", 4L}
        ));
        when(reservationRepository.countAllGroupedByUnitTypeSystemWide()).thenReturn(List.of());

        List<BomUnitTypeResponse> results = unitTypeService.getBomUnitTypes(null, "ALL");

        assertEquals(2, results.size());

        // Loại 1: có 10 ô kho -> canDelete = false (PR-M4)
        BomUnitTypeResponse res1 = results.get(0);
        assertEquals(1, res1.getId());
        assertEquals(10L, res1.getTotalUnits());
        assertEquals(6L, res1.getAvailableUnits());
        assertEquals(4L, res1.getOccupiedUnits());
        assertFalse(res1.isCanDelete());

        // Loại 2: có 0 ô kho -> canDelete = true (PR-M4)
        BomUnitTypeResponse res2 = results.get(1);
        assertEquals(2, res2.getId());
        assertEquals(0L, res2.getTotalUnits());
        assertTrue(res2.isCanDelete());
    }

    @Test
    @DisplayName("UC-05 / PR-M3: createUnitType thành công khi thông tin hợp lệ")
    void testCreateUnitType_Success() {
        CreateUnitTypeRequest request = CreateUnitTypeRequest.builder()
                .name("Kho Mini VIP 4m2")
                .areaSqm(new BigDecimal("4.00"))
                .volumeCbm(new BigDecimal("10.80"))
                .basePriceMonthly(new BigDecimal("1200000"))
                .dimensions("2m x 2m x 2.7m")
                .suggestedCapacity("10 thùng")
                .status("ACTIVE")
                .build();

        when(unitTypeRepository.existsByNameIgnoreCase("Kho Mini VIP 4m2")).thenReturn(false);
        when(unitTypeRepository.save(any(UnitType.class))).thenAnswer(invocation -> {
            UnitType u = invocation.getArgument(0);
            u.setId(3);
            return u;
        });
        when(unitTypeRepository.findById(3)).thenReturn(Optional.of(UnitType.builder()
                .id(3)
                .name("Kho Mini VIP 4m2")
                .areaSqm(new BigDecimal("4.00"))
                .volumeCbm(new BigDecimal("10.80"))
                .basePriceMonthly(new BigDecimal("1200000"))
                .status("ACTIVE")
                .build()));
        when(storageUnitRepository.countByUnitType_Id(3)).thenReturn(0);
        when(storageUnitRepository.countStatusGroupedByUnitTypeSystemWide()).thenReturn(List.of());
        when(reservationRepository.countByUnitType_Id(3)).thenReturn(0);

        BomUnitTypeResponse created = unitTypeService.createUnitType(request, 1);

        assertNotNull(created);
        assertEquals("Kho Mini VIP 4m2", created.getName());
        assertEquals("ACTIVE", created.getStatus());
        assertTrue(created.isCanDelete());
        verify(activityLogService).log(eq(1), contains("[UNIT_TYPE_CREATE]"), eq("unit_types"), eq("3"));
    }

    @Test
    @DisplayName("UC-05 / PR-M3: createUnitType ném 409 UNIT_TYPE_NAME_EXISTS khi trùng tên")
    void testCreateUnitType_DuplicateName_ThrowsConflict() {
        CreateUnitTypeRequest request = CreateUnitTypeRequest.builder()
                .name("Kho Tiêu Chuẩn 6m2")
                .areaSqm(new BigDecimal("6.00"))
                .volumeCbm(new BigDecimal("16.20"))
                .basePriceMonthly(new BigDecimal("1850000"))
                .build();

        when(unitTypeRepository.existsByNameIgnoreCase("Kho Tiêu Chuẩn 6m2")).thenReturn(true);

        UnitTypeException ex = assertThrows(UnitTypeException.class, () ->
                unitTypeService.createUnitType(request, 1));

        assertEquals(HttpStatus.CONFLICT, ex.getStatus());
        assertEquals("UNIT_TYPE_NAME_EXISTS", ex.getCode());
        verify(unitTypeRepository, never()).save(any());
    }

    @Test
    @DisplayName("UC-05 / PR-M3: createUnitType ném 400 INVALID_INPUT khi diện tích, thể tích hoặc giá <= 0")
    void testCreateUnitType_NegativeValues_ThrowsBadRequest() {
        CreateUnitTypeRequest reqZeroArea = CreateUnitTypeRequest.builder()
                .name("Kho Lỗi")
                .areaSqm(BigDecimal.ZERO)
                .volumeCbm(new BigDecimal("10"))
                .basePriceMonthly(new BigDecimal("1000000"))
                .build();

        UnitTypeException ex = assertThrows(UnitTypeException.class, () ->
                unitTypeService.createUnitType(reqZeroArea, 1));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertEquals("INVALID_INPUT", ex.getCode());
    }

    @Test
    @DisplayName("UC-05 / PR-M4: deleteUnitType ném 409 UNIT_TYPE_HAS_UNITS khi loại kho đã từng có ô")
    void testDeleteUnitType_HasUnits_ThrowsConflict() {
        when(unitTypeRepository.findById(1)).thenReturn(Optional.of(activeType));
        when(storageUnitRepository.countByUnitType_Id(1)).thenReturn(5); // Có 5 ô kho

        UnitTypeException ex = assertThrows(UnitTypeException.class, () ->
                unitTypeService.deleteUnitType(1, 1));

        assertEquals(HttpStatus.CONFLICT, ex.getStatus());
        assertEquals("UNIT_TYPE_HAS_UNITS", ex.getCode());
        assertTrue(ex.getMessage().contains("Không thể xóa loại kho đã từng có ô kho trong hệ thống"));
        verify(unitTypeRepository, never()).delete(any());
    }

    @Test
    @DisplayName("UC-05 / PR-M4: deleteUnitType thành công khi loại kho chưa từng có ô kho nào")
    void testDeleteUnitType_NoUnits_Success() {
        when(unitTypeRepository.findById(2)).thenReturn(Optional.of(inactiveType));
        when(storageUnitRepository.countByUnitType_Id(2)).thenReturn(0);
        when(reservationRepository.countByUnitType_Id(2)).thenReturn(0);

        unitTypeService.deleteUnitType(2, 1);

        verify(unitTypeRepository).delete(inactiveType);
        verify(activityLogService).log(eq(1), contains("[UNIT_TYPE_DELETE]"), eq("unit_types"), eq("2"));
    }

    @Test
    @DisplayName("UC-05 / PR-M4: updateUnitTypeStatus đổi trạng thái sang INACTIVE")
    void testUpdateUnitTypeStatus() {
        when(unitTypeRepository.findById(1)).thenReturn(Optional.of(activeType));
        when(storageUnitRepository.countByUnitType_Id(1)).thenReturn(0);
        when(storageUnitRepository.countStatusGroupedByUnitTypeSystemWide()).thenReturn(List.of());
        when(reservationRepository.countByUnitType_Id(1)).thenReturn(0);

        UpdateUnitTypeStatusRequest req = new UpdateUnitTypeStatusRequest("INACTIVE");
        BomUnitTypeResponse updated = unitTypeService.updateUnitTypeStatus(1, req, 1);

        assertEquals("INACTIVE", activeType.getStatus());
        verify(unitTypeRepository).save(activeType);
        verify(activityLogService).log(eq(1), contains("[UNIT_TYPE_STATUS]"), eq("unit_types"), eq("1"));
    }
}
