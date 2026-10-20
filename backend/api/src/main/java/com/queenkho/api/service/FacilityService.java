package com.queenkho.api.service;

import com.queenkho.api.dto.FacilityDashboardResponse;

import com.queenkho.api.dto.BomFacilityResponse;
import com.queenkho.api.dto.CreateFacilityRequest;
import com.queenkho.api.dto.UpdateFacilityRequest;
import com.queenkho.api.dto.UpdateFacilityStatusRequest;
import com.queenkho.api.dto.FacilityAvailabilityResponse;
import com.queenkho.api.dto.FacilitySearchResultItem;
import com.queenkho.api.dto.FacilitySummaryResponse;
import com.queenkho.api.entity.Facility;
import com.queenkho.api.entity.UnitType;
import com.queenkho.api.exception.FacilityException;
import com.queenkho.api.repository.FacilityRepository;
import com.queenkho.api.repository.ReservationRepository;
import com.queenkho.api.repository.StorageUnitRepository;
import com.queenkho.api.repository.UnitTypeRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
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

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private static final List<String> PENDING_STATUSES = List.of("PENDING", "DEPOSIT_PAID");

    // ──────────────────────────────────────────────────────
    // UC-09 API 1: Lấy tất cả cơ sở ACTIVE kèm tổng số ô trống
    // ──────────────────────────────────────────────────────
    @Transactional(readOnly = true)
    public List<FacilitySummaryResponse> getAllActiveFacilities() {
        List<Facility> facilities = facilityRepository.findByStatus("ACTIVE");

        return facilities.stream().map(f -> {
            int totalAvailable = storageUnitRepository.countByFacility_IdAndStatus(f.getId(), "AVAILABLE");
            return new FacilitySummaryResponse(
                f.getId(), f.getCode(), f.getName(), f.getCity(), f.getDistrict(),
                f.getAddress(), f.getHotline(), totalAvailable
            );
        }).toList();
    }

    // ──────────────────────────────────────────────────────
    // UC-09 API 2: Tìm kiếm cơ sở theo bộ lọc + trả kết quả kèm available count
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
    // UC-09 API 3: Chi tiết availability của 1 facility
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
    // UC-09 API phụ: Lấy danh sách thành phố có cơ sở hoạt động
    // ──────────────────────────────────────────────────────
    @Transactional(readOnly = true)
    public List<String> getActiveCities() {
        return facilityRepository.findDistinctCities();
    }

    // ──────────────────────────────────────────────────────
    // UC-04 (BOM): Quản lý danh sách cơ sở kho bãi
    // ──────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<BomFacilityResponse> getAllFacilitiesForBom(String keyword, String city, String status) {
        List<Facility> all = facilityRepository.findAllByOrderByIdAsc();

        return all.stream()
            .filter(f -> {
                if (keyword != null && !keyword.isBlank()) {
                    String kw = keyword.toLowerCase().trim();
                    boolean matchesCode = f.getCode() != null && f.getCode().toLowerCase().contains(kw);
                    boolean matchesName = f.getName() != null && f.getName().toLowerCase().contains(kw);
                    boolean matchesAddress = f.getAddress() != null && f.getAddress().toLowerCase().contains(kw);
                    boolean matchesHotline = f.getHotline() != null && f.getHotline().contains(kw);
                    boolean matchesDistrict = f.getDistrict() != null && f.getDistrict().toLowerCase().contains(kw);
                    if (!matchesCode && !matchesName && !matchesAddress && !matchesHotline && !matchesDistrict) {
                        return false;
                    }
                }
                if (city != null && !city.isBlank() && !"ALL".equalsIgnoreCase(city)) {
                    if (f.getCity() == null || !f.getCity().equalsIgnoreCase(city.trim())) {
                        return false;
                    }
                }
                if (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status)) {
                    if (f.getStatus() == null || !f.getStatus().equalsIgnoreCase(status.trim())) {
                        return false;
                    }
                }
                return true;
            })
            .map(this::buildBomFacilityResponse)
            .toList();
    }

    @Transactional(readOnly = true)
    public BomFacilityResponse getFacilityDetailForBom(Integer id) {
        Facility f = facilityRepository.findById(id)
            .orElseThrow(() -> new FacilityException(HttpStatus.NOT_FOUND, "FACILITY_NOT_FOUND", "Không tìm thấy cơ sở với ID: " + id));
        return buildBomFacilityResponse(f);
    }

    @Transactional
    public BomFacilityResponse createFacility(CreateFacilityRequest request, Integer actorUserId) {
        String cleanCode = request.getCode() != null ? request.getCode().trim().toUpperCase() : "";
        if (!cleanCode.matches("^[A-Z0-9]{2,4}$")) {
            throw new FacilityException(HttpStatus.BAD_REQUEST, "INVALID_FACILITY_CODE",
                "Mã cơ sở phải gồm 2 đến 4 ký tự in hoa hoặc số (vd: TB, BT, Q7)");
        }

        if (facilityRepository.existsByCode(cleanCode)) {
            throw new FacilityException(HttpStatus.CONFLICT, "FACILITY_CODE_EXISTS",
                "Mã cơ sở '" + cleanCode + "' đã tồn tại trong hệ thống");
        }

        Facility facility = Facility.builder()
            .code(cleanCode)
            .name(request.getName().trim())
            .city(request.getCity().trim())
            .district(request.getDistrict().trim())
            .address(request.getAddress().trim())
            .hotline(request.getHotline() != null && !request.getHotline().isBlank() ? request.getHotline().trim() : null)
            .status("ACTIVE")
            .build();

        facility = facilityRepository.save(facility);

        // PR-10: Tự tạo chính sách thuê mặc định cho cơ sở mới
        try {
            String policyName = "Chính sách " + facility.getName() + " - Tiêu chuẩn";
            jdbcTemplate.update(
                "INSERT INTO rental_policy (facility_id, policy_name, deposit_month_multiplier, cancel_fee_percent, cancel_free_hours, late_fee_per_day, lock_account_days, liquidation_days) " +
                "VALUES (?, ?, 1, 50, 24, 50000, 5, 30)",
                facility.getId(), policyName
            );
        } catch (Exception e) {
            System.err.println("Warning: Could not create default rental policy: " + e.getMessage());
        }

        // PR-91 / PR-A9: Ghi activity_logs
        recordActivityLog(actorUserId, "Tạo cơ sở mới: " + facility.getName() + " (Mã: " + cleanCode + ")", facility.getId());

        return buildBomFacilityResponse(facility);
    }

    @Transactional
    public BomFacilityResponse updateFacility(Integer id, UpdateFacilityRequest request, Integer actorUserId) {
        Facility facility = facilityRepository.findById(id)
            .orElseThrow(() -> new FacilityException(HttpStatus.NOT_FOUND, "FACILITY_NOT_FOUND", "Không tìm thấy cơ sở với ID: " + id));

        facility.setName(request.getName().trim());
        facility.setCity(request.getCity().trim());
        facility.setDistrict(request.getDistrict().trim());
        facility.setAddress(request.getAddress().trim());
        facility.setHotline(request.getHotline() != null && !request.getHotline().isBlank() ? request.getHotline().trim() : null);

        facility = facilityRepository.save(facility);

        recordActivityLog(actorUserId, "Cập nhật thông tin cơ sở: " + facility.getName() + " (Mã: " + facility.getCode() + ")", facility.getId());

        return buildBomFacilityResponse(facility);
    }

    @Transactional
    public BomFacilityResponse updateFacilityStatus(Integer id, UpdateFacilityStatusRequest request, Integer actorUserId) {
        Facility facility = facilityRepository.findById(id)
            .orElseThrow(() -> new FacilityException(HttpStatus.NOT_FOUND, "FACILITY_NOT_FOUND", "Không tìm thấy cơ sở với ID: " + id));

        String targetStatus = request.getStatus().trim().toUpperCase();
        if (!List.of("ACTIVE", "INACTIVE").contains(targetStatus)) {
            throw new FacilityException(HttpStatus.BAD_REQUEST, "INVALID_STATUS", "Trạng thái chỉ có thể là ACTIVE hoặc INACTIVE");
        }

        if ("INACTIVE".equalsIgnoreCase(targetStatus) && !"INACTIVE".equalsIgnoreCase(facility.getStatus())) {
            // PR-11: Chặn nếu còn đơn PENDING/DEPOSIT_PAID/UNIT_ASSIGNED hoặc hợp đồng còn hiệu lực
            int pendingRes = 0;
            int activeContracts = 0;
            try {
                Integer r = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM reservations WHERE facility_id = ? AND status IN ('PENDING', 'DEPOSIT_PAID', 'UNIT_ASSIGNED')",
                    Integer.class, id
                );
                if (r != null) pendingRes = r;

                Integer c = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM rental_contracts rc JOIN storage_units su ON rc.storage_unit_id = su.id " +
                    "WHERE su.facility_id = ? AND rc.status IN ('PENDING_CHECK_IN', 'ACTIVE', 'OVERDUE', 'TERMINATION_PENDING')",
                    Integer.class, id
                );
                if (c != null) activeContracts = c;
            } catch (Exception ignored) {}

            if (pendingRes > 0 || activeContracts > 0) {
                throw new FacilityException(
                    HttpStatus.CONFLICT,
                    "FACILITY_HAS_ACTIVE_RENTALS",
                    "Không thể tạm dừng cơ sở do đang có " + pendingRes + " đơn đặt chỗ và " +
                    activeContracts + " hợp đồng đang có hiệu lực. Vui lòng hoàn tất hoặc thanh lý trước."
                );
            }
        }

        facility.setStatus(targetStatus);
        facility = facilityRepository.save(facility);

        recordActivityLog(actorUserId, "Đổi trạng thái cơ sở '" + facility.getName() + "' sang " + targetStatus, facility.getId());

        return buildBomFacilityResponse(facility);
    }

    private BomFacilityResponse buildBomFacilityResponse(Facility f) {
        int totalUnits = 0;
        int availableUnits = 0;
        int occupiedUnits = 0;
        int maintenanceUnits = 0;
        int activeContractsCount = 0;
        int pendingReservationsCount = 0;

        try {
            totalUnits = storageUnitRepository.countByFacility_Id(f.getId());
            occupiedUnits = storageUnitRepository.countByFacility_IdAndStatus(f.getId(), "OCCUPIED");
            maintenanceUnits = storageUnitRepository.countByFacility_IdAndStatus(f.getId(), "MAINTENANCE");

            Integer contracts = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM rental_contracts rc JOIN storage_units su ON rc.storage_unit_id = su.id " +
                "WHERE su.facility_id = ? AND rc.status IN ('PENDING_CHECK_IN', 'ACTIVE', 'OVERDUE', 'TERMINATION_PENDING')",
                Integer.class, f.getId()
            );
            if (contracts != null) activeContractsCount = contracts;

            Integer reservations = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM reservations WHERE facility_id = ? AND status IN ('PENDING', 'DEPOSIT_PAID', 'UNIT_ASSIGNED')",
                Integer.class, f.getId()
            );
            if (reservations != null) pendingReservationsCount = reservations;

            // Ô thực tế còn trống sẵn sàng cho thuê mới = Tổng ô - Đang thuê - Đang bảo trì - Đơn chờ nhận
            availableUnits = Math.max(0, totalUnits - occupiedUnits - maintenanceUnits - pendingReservationsCount);
        } catch (Exception ignored) {}

        // Tìm Facility Manager được phân công
        Integer managerId = null;
        String managerName = null;
        String managerEmail = null;
        String managerPhone = null;

        try {
            List<Map<String, Object>> fmRows = jdbcTemplate.queryForList(
                "SELECT TOP 1 u.id, u.full_name, u.email, u.phone FROM users u " +
                "JOIN roles r ON u.role_id = r.id " +
                "WHERE u.facility_id = ? AND r.name = 'FACILITY_MANAGER' AND u.status = 'ACTIVE'",
                f.getId()
            );
            if (!fmRows.isEmpty()) {
                Map<String, Object> row = fmRows.get(0);
                managerId = ((Number) row.get("id")).intValue();
                managerName = (String) row.get("full_name");
                managerEmail = (String) row.get("email");
                managerPhone = (String) row.get("phone");
            }
        } catch (Exception ignored) {}

        return BomFacilityResponse.builder()
            .id(f.getId())
            .code(f.getCode())
            .name(f.getName())
            .city(f.getCity())
            .district(f.getDistrict())
            .address(f.getAddress())
            .hotline(f.getHotline())
            .status(f.getStatus())
            .totalUnits(totalUnits)
            .availableUnits(availableUnits)
            .occupiedUnits(occupiedUnits)
            .maintenanceUnits(maintenanceUnits)
            .activeContractsCount(activeContractsCount)
            .pendingReservationsCount(pendingReservationsCount)
            .managerId(managerId)
            .managerName(managerName)
            .managerEmail(managerEmail)
            .managerPhone(managerPhone)
            .build();
    }

    private Integer getDefaultBomUserId() {
        try {
            Integer id = jdbcTemplate.queryForObject(
                "SELECT TOP 1 u.id FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = 'BOM' ORDER BY u.id ASC",
                Integer.class
            );
            if (id != null) return id;
        } catch (Exception ignored) {}
        return 1;
    }

    private void recordActivityLog(Integer userId, String action, Integer targetId) {
        try {
            Integer effectiveUserId = userId != null ? userId : getDefaultBomUserId();
            jdbcTemplate.update(
                "INSERT INTO activity_logs (user_id, action, target_entity, target_id, created_at) VALUES (?, ?, 'facilities', ?, SYSDATETIME())",
                effectiveUserId, action, String.valueOf(targetId)
            );
        } catch (Exception e) {
            System.err.println("Warning: Failed to record activity_log: " + e.getMessage());
        }
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

    // ──────────────────────────────────────────────────────
    // UC-30: Lấy toàn bộ số liệu thống kê Dashboard cơ sở cho FM
    // ──────────────────────────────────────────────────────
    @Transactional(readOnly = true)
    public FacilityDashboardResponse getFacilityDashboardStats(Integer facilityId) {
        Facility facility = facilityRepository.findById(facilityId)
                .orElseThrow(() -> new FacilityException(HttpStatus.NOT_FOUND, "FACILITY_NOT_FOUND", "Không tìm thấy cơ sở với id: " + facilityId));

        int totalUnits = 0;
        int occupiedUnits = 0;
        int availableUnits = 0;
        int maintenanceUnits = 0;
        int reservedUnits = 0;

        try {
            totalUnits = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM storage_units WHERE facility_id = ?",
                    Integer.class, facilityId);
            occupiedUnits = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM storage_units WHERE facility_id = ? AND status = 'OCCUPIED'",
                    Integer.class, facilityId);
            availableUnits = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM storage_units WHERE facility_id = ? AND status = 'AVAILABLE'",
                    Integer.class, facilityId);
            maintenanceUnits = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM storage_units WHERE facility_id = ? AND status = 'MAINTENANCE'",
                    Integer.class, facilityId);
            reservedUnits = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM storage_units WHERE facility_id = ? AND status = 'RESERVED'",
                    Integer.class, facilityId);
        } catch (Exception e) {
            System.err.println("Error querying storage unit stats: " + e.getMessage());
        }

        int activeInUse = occupiedUnits + reservedUnits;
        double occupancyRate = totalUnits > 0
                ? Math.round(((double) activeInUse / totalUnits) * 1000.0) / 10.0
                : 0.0;

        int pendingReservationsCount = 0;
        try {
            pendingReservationsCount = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM reservations WHERE facility_id = ? AND status = 'DEPOSIT_PAID' AND (storage_unit_id IS NULL OR storage_unit_id = '')",
                    Integer.class, facilityId);
        } catch (Exception ignored) {}

        int overdueContractsCount = 0;
        int activeContractsCount = 0;
        try {
            overdueContractsCount = jdbcTemplate.queryForObject(
                    "SELECT COUNT(rc.id) FROM rental_contracts rc JOIN storage_units su ON rc.storage_unit_id = su.id WHERE su.facility_id = ? AND rc.status = 'OVERDUE'",
                    Integer.class, facilityId);
            activeContractsCount = jdbcTemplate.queryForObject(
                    "SELECT COUNT(rc.id) FROM rental_contracts rc JOIN storage_units su ON rc.storage_unit_id = su.id WHERE su.facility_id = ? AND rc.status = 'ACTIVE'",
                    Integer.class, facilityId);
        } catch (Exception ignored) {}

        int openTasksCount = 0;
        int overdueTasksCount = 0;
        try {
            openTasksCount = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM facility_tasks WHERE facility_id = ? AND status IN ('OPEN', 'IN_PROGRESS', 'OVERDUE')",
                    Integer.class, facilityId);
            overdueTasksCount = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM facility_tasks WHERE facility_id = ? AND status = 'OVERDUE'",
                    Integer.class, facilityId);
        } catch (Exception ignored) {}

        List<FacilityDashboardResponse.CapacityItem> zoneCapacities = new ArrayList<>();
        try {
            String zoneSql = "SELECT " +
                    "COALESCE(NULLIF(su.zone, ''), CASE " +
                    "WHEN su.id LIKE '%-A%' THEN 'A' " +
                    "WHEN su.id LIKE '%-B%' THEN 'B' " +
                    "WHEN su.id LIKE '%-C%' THEN 'C' " +
                    "ELSE 'D' END) as zone_key, " +
                    "COUNT(*) as total_cnt, " +
                    "SUM(CASE WHEN su.status IN ('OCCUPIED', 'RESERVED') THEN 1 ELSE 0 END) as occ_cnt, " +
                    "SUM(CASE WHEN su.status = 'AVAILABLE' THEN 1 ELSE 0 END) as avail_cnt, " +
                    "SUM(CASE WHEN su.status = 'MAINTENANCE' THEN 1 ELSE 0 END) as maint_cnt " +
                    "FROM storage_units su " +
                    "WHERE su.facility_id = ? " +
                    "GROUP BY COALESCE(NULLIF(su.zone, ''), CASE " +
                    "WHEN su.id LIKE '%-A%' THEN 'A' " +
                    "WHEN su.id LIKE '%-B%' THEN 'B' " +
                    "WHEN su.id LIKE '%-C%' THEN 'C' " +
                    "ELSE 'D' END) " +
                    "ORDER BY zone_key";

            jdbcTemplate.query(zoneSql, (rs) -> {
                String key = rs.getString("zone_key");
                int zTotal = rs.getInt("total_cnt");
                int zOcc = rs.getInt("occ_cnt");
                int zAvail = rs.getInt("avail_cnt");
                int zMaint = rs.getInt("maint_cnt");
                double zRate = zTotal > 0 ? Math.round(((double) zOcc / zTotal) * 1000.0) / 10.0 : 0.0;

                String zoneName;
                String desc;
                if ("A".equalsIgnoreCase(key)) {
                    zoneName = "Khu A (Tầng Trệt)";
                    desc = "Kho lớn & Thương mại (DT từ 20m² - 45m²)";
                } else if ("B".equalsIgnoreCase(key)) {
                    zoneName = "Khu B (Tầng 1)";
                    desc = "Kho tiêu chuẩn & Kho mát (DT từ 8m² - 16m²)";
                } else if ("C".equalsIgnoreCase(key)) {
                    zoneName = "Khu C (Tầng 2)";
                    desc = "Kho mini compact & Cá nhân (DT từ 2m² - 6m²)";
                } else {
                    zoneName = "Khu " + key;
                    desc = "Khu vực kho đa năng";
                }

                zoneCapacities.add(FacilityDashboardResponse.CapacityItem.builder()
                        .key(key)
                        .name(zoneName)
                        .description(desc)
                        .totalUnits(zTotal)
                        .occupiedUnits(zOcc)
                        .availableUnits(zAvail)
                        .maintenanceUnits(zMaint)
                        .occupancyRate(zRate)
                        .build());
            }, facilityId);
        } catch (Exception e) {
            System.err.println("Error calculating zone capacities: " + e.getMessage());
        }

        List<FacilityDashboardResponse.UnitTypeCapacityItem> unitTypeCapacities = new ArrayList<>();
        try {
            String utSql = "SELECT ut.id, ut.name, ut.area_sqm, ut.base_price_monthly, " +
                    "COUNT(su.id) as total_cnt, " +
                    "SUM(CASE WHEN su.status = 'AVAILABLE' THEN 1 ELSE 0 END) as avail_cnt, " +
                    "SUM(CASE WHEN su.status IN ('OCCUPIED', 'RESERVED') THEN 1 ELSE 0 END) as occ_cnt " +
                    "FROM unit_types ut " +
                    "JOIN storage_units su ON su.unit_type_id = ut.id " +
                    "WHERE su.facility_id = ? " +
                    "GROUP BY ut.id, ut.name, ut.area_sqm, ut.base_price_monthly " +
                    "ORDER BY ut.id";

            jdbcTemplate.query(utSql, (rs) -> {
                int utTotal = rs.getInt("total_cnt");
                int utOcc = rs.getInt("occ_cnt");
                double utRate = utTotal > 0 ? Math.round(((double) utOcc / utTotal) * 1000.0) / 10.0 : 0.0;

                unitTypeCapacities.add(FacilityDashboardResponse.UnitTypeCapacityItem.builder()
                        .unitTypeId(rs.getInt("id"))
                        .unitTypeName(rs.getString("name"))
                        .areaSqm(rs.getBigDecimal("area_sqm"))
                        .basePriceMonthly(rs.getBigDecimal("base_price_monthly"))
                        .totalUnits(utTotal)
                        .availableUnits(rs.getInt("avail_cnt"))
                        .occupiedUnits(utOcc)
                        .occupancyRate(utRate)
                        .build());
            }, facilityId);
        } catch (Exception e) {
            System.err.println("Error calculating unit type capacities: " + e.getMessage());
        }

        List<FacilityDashboardResponse.DashboardAlertItem> alerts = new ArrayList<>();

        if (pendingReservationsCount > 0) {
            alerts.add(FacilityDashboardResponse.DashboardAlertItem.builder()
                    .id("ALERT_PENDING_" + facilityId)
                    .type("WARNING")
                    .category("PENDING_RESERVATION")
                    .title(String.format("%02d Đơn cọc mới chờ gán kho", pendingReservationsCount))
                    .message("Khách đã cọc thành công qua VNPAY. Cần chỉ định mã ô kho vật lý để bắt đầu thủ tục bàn giao.")
                    .actionText("GÁN PHÒNG NGAY")
                    .actionUrl("/manager/pending")
                    .timeAgo("Vừa cập nhật")
                    .build());
        }

        if (overdueContractsCount > 0) {
            alerts.add(FacilityDashboardResponse.DashboardAlertItem.builder()
                    .id("ALERT_OVERDUE_" + facilityId)
                    .type("CRITICAL")
                    .category("OVERDUE_CONTRACT")
                    .title(String.format("%02d Hợp đồng quá hạn nợ phí", overdueContractsCount))
                    .message("Hợp đồng quá hạn thanh toán/trả kho. Cần đối soát nợ phạt hoặc kích hoạt quy trình thanh lý.")
                    .actionText("ĐỐI SOÁT NỢ")
                    .actionUrl("/manager/overdue")
                    .timeAgo("Khẩn cấp")
                    .build());
        }

        if (overdueTasksCount > 0) {
            alerts.add(FacilityDashboardResponse.DashboardAlertItem.builder()
                    .id("ALERT_TASK_OVERDUE_" + facilityId)
                    .type("CRITICAL")
                    .category("TASK_OVERDUE")
                    .title(String.format("%02d Ca trực quá hạn hoàn thành", overdueTasksCount))
                    .message("Nhân viên ca trực chưa hoàn tất biên bản check-in hoặc check-out theo đúng thời hạn.")
                    .actionText("KIỂM TRA TASK")
                    .actionUrl("/manager/tasks")
                    .timeAgo("Hôm nay")
                    .build());
        }

        if (maintenanceUnits > 0) {
            alerts.add(FacilityDashboardResponse.DashboardAlertItem.builder()
                    .id("ALERT_MAINT_" + facilityId)
                    .type("INFO")
                    .category("MAINTENANCE")
                    .title(String.format("%02d Ô kho đang bảo trì / vệ sinh", maintenanceUnits))
                    .message("Đang kiểm tra kỹ thuật cảm biến SmartLock hoặc vệ sinh sau trả kho để sẵn sàng đón khách.")
                    .actionText("DANH MỤC Ô KHO")
                    .actionUrl("/manager/storage")
                    .timeAgo("Đang thực hiện")
                    .build());
        }

        return FacilityDashboardResponse.builder()
                .facility(FacilityDashboardResponse.FacilityInfo.builder()
                        .id(facility.getId())
                        .code(facility.getCode())
                        .name(facility.getName())
                        .city(facility.getCity())
                        .district(facility.getDistrict())
                        .address(facility.getAddress())
                        .hotline(facility.getHotline())
                        .build())
                .kpi(FacilityDashboardResponse.KpiSummary.builder()
                        .totalUnits(totalUnits)
                        .occupiedUnits(occupiedUnits)
                        .availableUnits(availableUnits)
                        .maintenanceUnits(maintenanceUnits)
                        .reservedUnits(reservedUnits)
                        .occupancyRate(occupancyRate)
                        .pendingReservationsCount(pendingReservationsCount)
                        .overdueContractsCount(overdueContractsCount)
                        .activeContractsCount(activeContractsCount)
                        .openTasksCount(openTasksCount)
                        .build())
                .zoneCapacities(zoneCapacities)
                .unitTypeCapacities(unitTypeCapacities)
                .alerts(alerts)
                .generatedAt(java.time.LocalDateTime.now())
                .build();
    }
}
