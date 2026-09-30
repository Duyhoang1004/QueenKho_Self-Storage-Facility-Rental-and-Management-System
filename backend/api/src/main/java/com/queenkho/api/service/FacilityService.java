package com.queenkho.api.service;

import com.queenkho.api.dto.FacilityAvailabilityResponse;
import com.queenkho.api.dto.FacilitySearchResultItem;
import com.queenkho.api.dto.FacilitySummaryResponse;
import com.queenkho.api.entity.Facility;
import com.queenkho.api.entity.UnitType;
import com.queenkho.api.repository.FacilityRepository;
import com.queenkho.api.repository.ReservationRepository;
import com.queenkho.api.repository.StorageUnitRepository;
import com.queenkho.api.repository.UnitTypeRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.*;

@Service
public class FacilityService {

    @Autowired
    private FacilityRepository facilityRepository;

    @Autowired
    private StorageUnitRepository storageUnitRepository;

    @Autowired
    private ReservationRepository reservationRepository;

    @Autowired
    private UnitTypeRepository unitTypeRepository;

    private static final List<String> PENDING_STATUSES = List.of("PENDING", "DEPOSIT_PAID");

    // ──────────────────────────────────────────────────────
    // API 1: Lấy tất cả cơ sở ACTIVE kèm tổng số ô trống
    // ──────────────────────────────────────────────────────
    @Transactional(readOnly = true)
    public List<FacilitySummaryResponse> getAllActiveFacilities() {
        List<Facility> facilities = facilityRepository.findByStatus("ACTIVE");

        return facilities.stream().map(f -> {
            int totalAvailable = storageUnitRepository.countByFacility_IdAndStatus(f.getId(), "AVAILABLE");
            return new FacilitySummaryResponse(
                f.getId(), f.getName(), f.getCity(), f.getDistrict(),
                f.getAddress(), f.getHotline(), totalAvailable
            );
        }).toList();
    }

    // ──────────────────────────────────────────────────────
    // API 2: Tìm kiếm cơ sở theo bộ lọc + trả kết quả kèm available count
    // ──────────────────────────────────────────────────────
    @Transactional(readOnly = true)
    public Page<FacilitySearchResultItem> searchFacilities(
            String keyword, String city, Integer unitTypeId,
            BigDecimal minPrice, BigDecimal maxPrice,
            BigDecimal minArea, BigDecimal maxArea,
            Pageable pageable) {

        // Bước 1: Tìm facility theo keyword + city
        Page<Facility> facilityPage = facilityRepository.search(keyword, city, pageable);

        // Bước 2: Lấy danh sách unit types phù hợp bộ lọc
        List<UnitType> unitTypes = unitTypeRepository.findAll().stream()
            .filter(ut -> unitTypeId == null || ut.getId().equals(unitTypeId))
            .filter(ut -> minPrice == null || ut.getBasePriceMonthly().compareTo(minPrice) >= 0)
            .filter(ut -> maxPrice == null || ut.getBasePriceMonthly().compareTo(maxPrice) <= 0)
            .filter(ut -> minArea == null || ut.getAreaSqm().compareTo(minArea) >= 0)
            .filter(ut -> maxArea == null || ut.getAreaSqm().compareTo(maxArea) <= 0)
            .toList();

        // Bước 3: Kết hợp facility + unitType, tính available_count
        List<FacilitySearchResultItem> results = new ArrayList<>();

        for (Facility f : facilityPage.getContent()) {
            // Batch query: lấy tổng physical AVAILABLE units grouped by unitType
            Map<Integer, Long> physicalMap = toMap(
                storageUnitRepository.countGroupedByUnitType(f.getId(), "AVAILABLE"));

            // Batch query: lấy tổng pending reservations grouped by unitType
            Map<Integer, Long> pendingMap = toMap(
                reservationRepository.countPendingGroupedByUnitType(f.getId(), PENDING_STATUSES));

            for (UnitType ut : unitTypes) {
                long physical = physicalMap.getOrDefault(ut.getId(), 0L);
                long pending = pendingMap.getOrDefault(ut.getId(), 0L);
                int available = (int) Math.max(0, physical - pending);

                // Chỉ hiển thị nếu còn slot
                if (available > 0) {
                    results.add(new FacilitySearchResultItem(
                        f.getId(), f.getName(), f.getCity(), f.getDistrict(),
                        f.getAddress(), f.getHotline(),
                        ut.getId(), ut.getName(), ut.getAreaSqm(),
                        ut.getBasePriceMonthly(), ut.getDimensions(),
                        ut.getSuggestedCapacity(), ut.getFeatures(),
                        available
                    ));
                }
            }
        }

        return new PageImpl<>(results, pageable, facilityPage.getTotalElements());
    }

    // ──────────────────────────────────────────────────────
    // API 3: Chi tiết availability của 1 facility
    // ──────────────────────────────────────────────────────
    @Transactional(readOnly = true)
    public FacilityAvailabilityResponse getFacilityAvailability(Integer facilityId) {
        Facility facility = facilityRepository.findById(facilityId)
            .orElseThrow(() -> new RuntimeException("Không tìm thấy cơ sở"));

        // Facility info
        FacilityAvailabilityResponse.FacilityInfo facilityInfo =
            new FacilityAvailabilityResponse.FacilityInfo(
                facility.getId(), facility.getName(), facility.getCity(),
                facility.getDistrict(), facility.getAddress(), facility.getHotline()
            );

        // Batch queries
        Map<Integer, Long> totalMap = toMap(
            storageUnitRepository.countAllGroupedByUnitType(facilityId));
        Map<Integer, Long> availableMap = toMap(
            storageUnitRepository.countGroupedByUnitType(facilityId, "AVAILABLE"));
        Map<Integer, Long> pendingMap = toMap(
            reservationRepository.countPendingGroupedByUnitType(facilityId, PENDING_STATUSES));

        // Tạo danh sách slot cho mỗi unit type có mặt tại cơ sở
        List<FacilityAvailabilityResponse.UnitTypeSlot> slots = new ArrayList<>();

        List<UnitType> allTypes = unitTypeRepository.findAll();
        for (UnitType ut : allTypes) {
            long total = totalMap.getOrDefault(ut.getId(), 0L);
            if (total == 0) continue; // Unit type không có ở cơ sở này

            long physical = availableMap.getOrDefault(ut.getId(), 0L);
            long pending = pendingMap.getOrDefault(ut.getId(), 0L);
            int available = (int) Math.max(0, physical - pending);

            slots.add(new FacilityAvailabilityResponse.UnitTypeSlot(
                ut.getId(), ut.getName(), ut.getAreaSqm(),
                ut.getBasePriceMonthly(), ut.getDimensions(),
                ut.getSuggestedCapacity(), ut.getFeatures(),
                (int) total, available
            ));
        }

        return new FacilityAvailabilityResponse(facilityInfo, slots);
    }

    // ──────────────────────────────────────────────────────
    // API phụ: Lấy danh sách thành phố có cơ sở hoạt động
    // ──────────────────────────────────────────────────────
    @Transactional(readOnly = true)
    public List<String> getActiveCities() {
        return facilityRepository.findDistinctCities();
    }

    // ──────────────────────────────────────────────────────
    // Helper: Chuyển List<Object[]> (id, count) thành Map
    // ──────────────────────────────────────────────────────
    private Map<Integer, Long> toMap(List<Object[]> rows) {
        Map<Integer, Long> map = new HashMap<>();
        for (Object[] row : rows) {
            Integer id = (Integer) row[0];
            Long count = (Long) row[1];
            map.put(id, count);
        }
        return map;
    }
}
