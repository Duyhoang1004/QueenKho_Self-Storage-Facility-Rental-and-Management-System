package com.queenkho.api.service;

import com.queenkho.api.dto.FloorFixtureDto;
import com.queenkho.api.dto.FloorRequest;
import com.queenkho.api.dto.SaveFloorPlanRequest;
import com.queenkho.api.dto.UnitPlacementDto;
import com.queenkho.api.entity.Facility;
import com.queenkho.api.entity.FacilityFloor;
import com.queenkho.api.entity.FloorFixture;
import com.queenkho.api.entity.StorageUnit;
import com.queenkho.api.entity.UnitType;
import com.queenkho.api.exception.FacilityException;
import com.queenkho.api.repository.FacilityFloorRepository;
import com.queenkho.api.repository.FacilityRepository;
import com.queenkho.api.repository.FloorFixtureRepository;
import com.queenkho.api.repository.StorageUnitRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

// UC-06: sơ đồ mặt bằng — kích thước mặc định, chồng lấn, đổi tên / thu nhỏ / xoá tầng
@ExtendWith(MockitoExtension.class)
class FloorPlanServiceTest {

    @Mock private FacilityRepository facilityRepository;
    @Mock private FacilityFloorRepository facilityFloorRepository;
    @Mock private FloorFixtureRepository floorFixtureRepository;
    @Mock private StorageUnitRepository storageUnitRepository;
    @Mock private ActivityLogService activityLogService;

    @InjectMocks
    private FloorPlanService floorPlanService;

    private Facility facility;
    private FacilityFloor floor;
    private UnitType standard;

    @BeforeEach
    void setUp() {
        facility = new Facility();
        facility.setId(1);
        facility.setName("QueenKho Tân Bình");
        floor = FacilityFloor.builder().id(10).facility(facility).name("Tầng 1").gridWidth(56).gridHeight(40).sortOrder(1).build();
        standard = UnitType.builder().id(2).name("Kho Tiêu Chuẩn").areaSqm(new BigDecimal("6.00"))
                .dimensions("2.5m × 2.4m × 2.7m").build();
    }

    private StorageUnit unit(String id, String floorName, Integer x, Integer y) {
        StorageUnit u = new StorageUnit();
        u.setId(id);
        u.setFacility(facility);
        u.setUnitType(standard);
        u.setFloor(floorName);
        u.setStatus("AVAILABLE");
        if (x != null) {
            u.setMapX(x);
            u.setMapY(y);
            u.setMapW(5);
            u.setMapH(5);
            u.setMapDoor("BOTTOM");
        }
        return u;
    }

    @Test
    @DisplayName("Kích thước mặc định lấy từ dimensions (0.5m / ô), không có thì theo diện tích")
    void defaultSizeFromDimensions() {
        assertArrayEquals(new int[]{5, 5}, FloorPlanService.defaultSize(standard));
        UnitType family = UnitType.builder().areaSqm(new BigDecimal("12")).dimensions("4.0m x 3.0m x 2.7m").build();
        assertArrayEquals(new int[]{8, 6}, FloorPlanService.defaultSize(family));
        UnitType noDims = UnitType.builder().areaSqm(new BigDecimal("16")).build();
        assertArrayEquals(new int[]{8, 8}, FloorPlanService.defaultSize(noDims));
    }

    @Test
    @DisplayName("Lưu mặt bằng: đặt ô hợp lệ thì lưu, ô đang ở tầng khác chuyển sang tầng này")
    void saveFloorPlanPlacesUnit() {
        StorageUnit a = unit("KV-TB-A101", "Tầng 1", 12, 5);
        StorageUnit b = unit("KV-TB-A102", "Tầng 2", null, null);
        when(facilityFloorRepository.findById(10)).thenReturn(Optional.of(floor));
        when(storageUnitRepository.findByFacility_Id(1)).thenReturn(List.of(a, b));
        when(floorFixtureRepository.saveAll(anyList())).thenAnswer(inv -> inv.getArgument(0));

        SaveFloorPlanRequest request = SaveFloorPlanRequest.builder()
                .units(List.of(UnitPlacementDto.builder().unitId("KV-TB-A102").x(17).y(5).build()))
                .fixtures(List.of(FloorFixtureDto.builder().type("aisle").label("Lối đi").x(12).y(10).w(44).h(4).build()))
                .build();

        var response = floorPlanService.saveFloorPlan(10, request, 3);

        assertEquals("Tầng 1", b.getFloor());
        assertEquals(17, b.getMapX());
        assertEquals(5, b.getMapW()); // kích thước mặc định theo loại kho
        assertEquals("BOTTOM", b.getMapDoor());
        assertEquals(1, response.getFixtures().size());
        assertEquals("AISLE", response.getFixtures().get(0).getType());
        verify(floorFixtureRepository).deleteAllByFloorId(10);
    }

    @Test
    @DisplayName("Lưu mặt bằng: 2 ô chồng nhau hoặc ô đè lối đi → 400 MAP_CONFLICT, không lưu gì")
    void saveFloorPlanRejectsOverlap() {
        StorageUnit a = unit("KV-TB-A101", "Tầng 1", 12, 5);
        StorageUnit b = unit("KV-TB-A102", "Tầng 1", null, null);
        when(facilityFloorRepository.findById(10)).thenReturn(Optional.of(floor));
        when(storageUnitRepository.findByFacility_Id(1)).thenReturn(List.of(a, b));

        SaveFloorPlanRequest request = SaveFloorPlanRequest.builder()
                .units(List.of(UnitPlacementDto.builder().unitId("KV-TB-A102").x(14).y(7).build()))
                .fixtures(List.of(FloorFixtureDto.builder().type("AISLE").x(12).y(9).w(44).h(4).build()))
                .build();

        FacilityException ex = assertThrows(FacilityException.class, () -> floorPlanService.saveFloorPlan(10, request, 3));
        assertEquals("MAP_CONFLICT", ex.getCode());
        assertTrue(ex.getMessage().contains("KV-TB-A101 chồng lên KV-TB-A102"));
        assertTrue(ex.getMessage().contains("đè lên lối đi"));
        verify(storageUnitRepository, never()).saveAll(anyList());
        verify(floorFixtureRepository, never()).deleteAllByFloorId(anyInt());
    }

    @Test
    @DisplayName("Lưu mặt bằng: ô ra ngoài mặt bằng hoặc không thuộc cơ sở → 400")
    void saveFloorPlanRejectsOutOfBoundsAndForeignUnit() {
        StorageUnit a = unit("KV-TB-A101", "Tầng 1", null, null);
        when(facilityFloorRepository.findById(10)).thenReturn(Optional.of(floor));
        when(storageUnitRepository.findByFacility_Id(1)).thenReturn(List.of(a));

        SaveFloorPlanRequest outside = SaveFloorPlanRequest.builder()
                .units(List.of(UnitPlacementDto.builder().unitId("KV-TB-A101").x(54).y(0).build()))
                .build();
        assertEquals("MAP_CONFLICT",
                assertThrows(FacilityException.class, () -> floorPlanService.saveFloorPlan(10, outside, 3)).getCode());

        SaveFloorPlanRequest foreign = SaveFloorPlanRequest.builder()
                .units(List.of(UnitPlacementDto.builder().unitId("KV-Q7-A101").x(0).y(0).build()))
                .build();
        assertEquals("UNIT_NOT_IN_FACILITY",
                assertThrows(FacilityException.class, () -> floorPlanService.saveFloorPlan(10, foreign, 3)).getCode());
    }

    @Test
    @DisplayName("Gỡ ô khỏi mặt bằng: x = null → xoá vị trí, ô vẫn thuộc tầng")
    void saveFloorPlanRemovesUnit() {
        StorageUnit a = unit("KV-TB-A101", "Tầng 1", 12, 5);
        when(facilityFloorRepository.findById(10)).thenReturn(Optional.of(floor));
        when(storageUnitRepository.findByFacility_Id(1)).thenReturn(List.of(a));
        when(floorFixtureRepository.saveAll(anyList())).thenAnswer(inv -> inv.getArgument(0));

        floorPlanService.saveFloorPlan(10, SaveFloorPlanRequest.builder()
                .units(List.of(UnitPlacementDto.builder().unitId("KV-TB-A101").build()))
                .build(), 3);

        assertFalse(a.isPlacedOnMap());
        assertEquals("Tầng 1", a.getFloor());
    }

    @Test
    @DisplayName("Đổi tên tầng: đổi luôn storage_units.floor; thu nhỏ làm ô ra ngoài → 400 MAP_OUT_OF_BOUNDS")
    void updateFloorRenamesAndBlocksShrink() {
        StorageUnit a = unit("KV-TB-A101", "Tầng 1", 40, 5);
        when(facilityFloorRepository.findById(10)).thenReturn(Optional.of(floor));
        when(facilityFloorRepository.findByFacility_IdAndNameIgnoreCase(1, "Tầng trệt")).thenReturn(Optional.empty());
        when(storageUnitRepository.findByFacility_Id(1)).thenReturn(List.of(a));
        when(floorFixtureRepository.findByFloor_IdOrderByIdAsc(10)).thenReturn(new ArrayList<>());

        FacilityException ex = assertThrows(FacilityException.class, () -> floorPlanService.updateFloor(10,
                FloorRequest.builder().name("Tầng trệt").gridWidth(40).gridHeight(40).build(), 3));
        assertEquals("MAP_OUT_OF_BOUNDS", ex.getCode());
        assertEquals("Tầng 1", a.getFloor());

        floorPlanService.updateFloor(10, FloorRequest.builder().name("Tầng trệt").gridWidth(60).gridHeight(40).build(), 3);
        assertEquals("Tầng trệt", a.getFloor());
        assertEquals("Tầng trệt", floor.getName());
        assertEquals(60, floor.getGridWidth());
    }

    @Test
    @DisplayName("Xoá tầng còn ô kho → 409 FLOOR_HAS_UNITS")
    void deleteFloorWithUnitsBlocked() {
        when(facilityFloorRepository.findById(10)).thenReturn(Optional.of(floor));
        when(storageUnitRepository.findByFacility_Id(1)).thenReturn(List.of(unit("KV-TB-A101", "tầng 1", null, null)));

        FacilityException ex = assertThrows(FacilityException.class, () -> floorPlanService.deleteFloor(10, 3));
        assertEquals("FLOOR_HAS_UNITS", ex.getCode());
        verify(facilityFloorRepository, never()).delete(any());
    }

    @Test
    @DisplayName("Tạo ô mới kèm vị trí: tầng chưa có mặt bằng → 400 FLOOR_HAS_NO_MAP; đè vật cố định → MAP_CONFLICT")
    void validateNewUnitPlacement() {
        StorageUnit candidate = unit("KV-TB-A106", "Tầng 9", 0, 0);
        when(facilityFloorRepository.findByFacility_IdAndNameIgnoreCase(1, "Tầng 9")).thenReturn(Optional.empty());
        assertEquals("FLOOR_HAS_NO_MAP", assertThrows(FacilityException.class,
                () -> floorPlanService.validateNewUnitPlacement(1, "Tầng 9", candidate)).getCode());

        StorageUnit onStairs = unit("KV-TB-A106", "tầng 1", 0, 0);
        when(facilityFloorRepository.findByFacility_IdAndNameIgnoreCase(1, "tầng 1")).thenReturn(Optional.of(floor));
        when(storageUnitRepository.findByFacility_Id(1)).thenReturn(List.of());
        when(floorFixtureRepository.findByFloor_IdOrderByIdAsc(10)).thenReturn(List.of(
                FloorFixture.builder().floor(floor).fixtureType("STAIRS").label("Thang bộ").mapX(0).mapY(0).mapW(8).mapH(6).build()));
        FacilityException ex = assertThrows(FacilityException.class,
                () -> floorPlanService.validateNewUnitPlacement(1, "tầng 1", onStairs));
        assertEquals("MAP_CONFLICT", ex.getCode());
        assertEquals("Tầng 1", onStairs.getFloor()); // tên tầng chuẩn hoá theo mặt bằng
    }
}
