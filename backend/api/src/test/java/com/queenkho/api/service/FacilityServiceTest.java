package com.queenkho.api.service;

import com.queenkho.api.dto.BomFacilityResponse;
import com.queenkho.api.dto.CreateFacilityRequest;
import com.queenkho.api.dto.FacilitySummaryResponse;
import com.queenkho.api.dto.UpdateFacilityRequest;
import com.queenkho.api.dto.UpdateFacilityStatusRequest;
import com.queenkho.api.entity.Facility;
import com.queenkho.api.exception.FacilityException;
import com.queenkho.api.repository.FacilityRepository;
import com.queenkho.api.repository.ReservationRepository;
import com.queenkho.api.repository.StorageUnitRepository;
import com.queenkho.api.repository.UnitTypeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * UC-04 / UC-09: regression tests for the facility catalogue and BOM lifecycle.
 * The service deliberately tolerates unavailable dashboard aggregates, so these
 * tests focus on the decisions that must remain transactional and user-visible.
 */
@ExtendWith(MockitoExtension.class)
class FacilityServiceTest {

    @Mock private FacilityRepository facilityRepository;
    @Mock private StorageUnitRepository storageUnitRepository;
    @Mock private ReservationRepository reservationRepository;
    @Mock private UnitTypeRepository unitTypeRepository;
    @Mock private JdbcTemplate jdbcTemplate;
    @Mock private RenewalPolicyService renewalPolicyService;
    @InjectMocks private FacilityService facilityService;

    private Facility tanBinh;
    private Facility district7;

    @BeforeEach
    void setUp() {
        tanBinh = facility(1, "TB", "QueenKho Tân Bình", "Hồ Chí Minh", "Tân Bình", "1 Cộng Hòa", "ACTIVE");
        district7 = facility(2, "Q7", "QueenKho Quận 7", "Hồ Chí Minh", "Quận 7", "2 Nguyễn Văn Linh", "INACTIVE");
    }

    @Test
    @DisplayName("UC-09: active catalogue exposes only active facilities and their physical availability")
    void getAllActiveFacilities_mapsAvailableCounts() {
        when(facilityRepository.findByStatus("ACTIVE")).thenReturn(List.of(tanBinh));
        when(storageUnitRepository.countByFacility_IdAndStatus(1, "AVAILABLE")).thenReturn(4);

        List<FacilitySummaryResponse> result = facilityService.getAllActiveFacilities();

        assertEquals(1, result.size());
        assertEquals("TB", result.get(0).getCode());
        assertEquals("QueenKho Tân Bình", result.get(0).getName());
        assertEquals(4, result.get(0).getTotalAvailableUnits());
        verify(storageUnitRepository).countByFacility_IdAndStatus(1, "AVAILABLE");
        verifyNoInteractions(reservationRepository, unitTypeRepository, renewalPolicyService);
    }

    @Test
    @DisplayName("UC-09: active cities preserves the repository's sorted, distinct result")
    void getActiveCities_returnsRepositoryResult() {
        when(facilityRepository.findDistinctCities()).thenReturn(List.of("Đà Nẵng", "Hồ Chí Minh"));

        assertEquals(List.of("Đà Nẵng", "Hồ Chí Minh"), facilityService.getActiveCities());
    }

    @Test
    @DisplayName("UC-04: BOM filter matches code/name/address and applies city and status together")
    void getAllFacilitiesForBom_appliesAllFilters() {
        when(facilityRepository.findAllByOrderByIdAsc()).thenReturn(List.of(tanBinh, district7));

        List<BomFacilityResponse> result = facilityService.getAllFacilitiesForBom("tân bình", "hồ chí minh", "active");

        assertEquals(1, result.size());
        assertEquals(1, result.get(0).getId());
        assertEquals("TB", result.get(0).getCode());
    }

    @Test
    @DisplayName("UC-04: unknown BOM facility is a typed 404, not a null response")
    void getFacilityDetailForBom_missingFacility_throwsTypedNotFound() {
        when(facilityRepository.findById(404)).thenReturn(Optional.empty());

        FacilityException ex = assertThrows(FacilityException.class,
            () -> facilityService.getFacilityDetailForBom(404));

        assertEquals(HttpStatus.NOT_FOUND, ex.getStatus());
        assertEquals("FACILITY_NOT_FOUND", ex.getCode());
    }

    @Test
    @DisplayName("UC-04: create rejects a code which cannot be represented by the facility contract")
    void createFacility_invalidCode_rejectsBeforeWriting() {
        CreateFacilityRequest request = createRequest("TOO-LONG");

        FacilityException ex = assertThrows(FacilityException.class,
            () -> facilityService.createFacility(request, 7));

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertEquals("INVALID_FACILITY_CODE", ex.getCode());
        verifyNoInteractions(facilityRepository, jdbcTemplate);
    }

    @Test
    @DisplayName("UC-04: create normalizes code and protects the unique business key")
    void createFacility_duplicateCode_rejectsNormalizedCode() {
        when(facilityRepository.existsByCode("TB")).thenReturn(true);

        FacilityException ex = assertThrows(FacilityException.class,
            () -> facilityService.createFacility(createRequest(" tb "), 7));

        assertEquals(HttpStatus.CONFLICT, ex.getStatus());
        assertEquals("FACILITY_CODE_EXISTS", ex.getCode());
        verify(facilityRepository, never()).save(any());
        verifyNoInteractions(jdbcTemplate);
    }

    @Test
    @DisplayName("UC-04: successful create persists facility, default policy, and audit entry")
    void createFacility_persistsPolicyAndAuditTrail() {
        when(facilityRepository.existsByCode("TB")).thenReturn(false);
        when(facilityRepository.save(any(Facility.class))).thenAnswer(invocation -> {
            Facility saved = invocation.getArgument(0);
            saved.setId(31);
            return saved;
        });

        BomFacilityResponse result = facilityService.createFacility(createRequest(" tb "), 7);

        assertEquals(31, result.getId());
        assertEquals("TB", result.getCode());
        assertEquals("ACTIVE", result.getStatus());
        ArgumentCaptor<Facility> saved = ArgumentCaptor.forClass(Facility.class);
        verify(facilityRepository).save(saved.capture());
        assertEquals("TB", saved.getValue().getCode());
        assertEquals("0901234567", saved.getValue().getHotline());
        verify(jdbcTemplate, atLeast(2)).update(anyString(), any(Object[].class));
    }

    @Test
    @DisplayName("UC-04: update keeps the immutable code while trimming editable fields")
    void updateFacility_updatesOnlyEditableDetails() {
        when(facilityRepository.findById(1)).thenReturn(Optional.of(tanBinh));
        when(facilityRepository.save(tanBinh)).thenReturn(tanBinh);
        UpdateFacilityRequest request = new UpdateFacilityRequest("  Kho mới  ", " Hà Nội ", " Cầu Giấy ", " 3 Duy Tân ", " ");

        BomFacilityResponse result = facilityService.updateFacility(1, request, 9);

        assertEquals("TB", result.getCode());
        assertEquals("Kho mới", tanBinh.getName());
        assertEquals("Hà Nội", tanBinh.getCity());
        assertNull(tanBinh.getHotline());
        verify(facilityRepository).save(tanBinh);
    }

    @Test
    @DisplayName("UC-04: deactivation rejects unsupported status values")
    void updateFacilityStatus_invalidStatus_rejectsBeforeSaving() {
        when(facilityRepository.findById(1)).thenReturn(Optional.of(tanBinh));

        FacilityException ex = assertThrows(FacilityException.class,
            () -> facilityService.updateFacilityStatus(1, new UpdateFacilityStatusRequest("CLOSED"), 9));

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertEquals("INVALID_STATUS", ex.getCode());
        verify(facilityRepository, never()).save(any());
    }

    @Test
    @DisplayName("UC-04: deactivation is blocked while customer reservations still require the facility")
    void updateFacilityStatus_activeReservation_blocksDeactivation() {
        when(facilityRepository.findById(1)).thenReturn(Optional.of(tanBinh));
        when(jdbcTemplate.queryForObject(contains("FROM reservations"), eq(Integer.class), eq(1))).thenReturn(2);
        when(jdbcTemplate.queryForObject(contains("FROM rental_contracts"), eq(Integer.class), eq(1))).thenReturn(0);

        FacilityException ex = assertThrows(FacilityException.class,
            () -> facilityService.updateFacilityStatus(1, new UpdateFacilityStatusRequest("INACTIVE"), 9));

        assertEquals(HttpStatus.CONFLICT, ex.getStatus());
        assertEquals("FACILITY_HAS_ACTIVE_RENTALS", ex.getCode());
        verify(facilityRepository, never()).save(any());
    }

    private static Facility facility(Integer id, String code, String name, String city, String district,
                                     String address, String status) {
        return Facility.builder().id(id).code(code).name(name).city(city).district(district)
            .address(address).hotline("0901234567").status(status).build();
    }

    private static CreateFacilityRequest createRequest(String code) {
        return new CreateFacilityRequest(code, "QueenKho Tân Bình", "Hồ Chí Minh", "Tân Bình",
            "1 Cộng Hòa", "0901234567");
    }
}
