package com.queenkho.api.service;

import com.queenkho.api.dto.*;
import com.queenkho.api.entity.UnitType;
import com.queenkho.api.exception.UnitTypeException;
import com.queenkho.api.repository.ReservationRepository;
import com.queenkho.api.repository.StorageUnitRepository;
import com.queenkho.api.repository.UnitTypeRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.*;

@Service
public class UnitTypeService {

    @Autowired
    private UnitTypeRepository unitTypeRepository;

    @Autowired
    private StorageUnitRepository storageUnitRepository;

    @Autowired
    private ReservationRepository reservationRepository;

    @Autowired
    private ActivityLogService activityLogService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    /**
     * UC-09: Lấy danh sách loại kho đang hoạt động (ACTIVE) cho dropdown đặt chỗ / tìm kiếm của khách hàng (PR-M4)
     */
    @Transactional(readOnly = true)
    public List<UnitTypeResponse> getAllUnitTypes() {
        return unitTypeRepository.findByStatusIgnoreCase("ACTIVE").stream()
                .map(ut -> UnitTypeResponse.builder()
                        .id(ut.getId())
                        .name(ut.getName())
                        .areaSqm(ut.getAreaSqm())
                        .volumeCbm(ut.getVolumeCbm())
                        .basePriceMonthly(ut.getBasePriceMonthly())
                        .suggestedCapacity(ut.getSuggestedCapacity())
                        .dimensions(ut.getDimensions())
                        .features(ut.getFeatures())
                        .status(ut.getStatus())
                        .build())
                .toList();
    }

    /**
     * UC-05: Lấy toàn bộ danh sách loại kho kèm thống kê số lượng ô kho & trạng thái cho BOM portal
     */
    @Transactional(readOnly = true)
    public List<BomUnitTypeResponse> getBomUnitTypes(String keyword, String status) {
        List<UnitType> all = unitTypeRepository.findAll();

        // 1. Lọc theo trạng thái nếu có
        if (status != null && !status.trim().isEmpty() && !"ALL".equalsIgnoreCase(status.trim())) {
            String filterStatus = status.trim().toUpperCase();
            all = all.stream()
                    .filter(ut -> filterStatus.equalsIgnoreCase(ut.getStatus()))
                    .toList();
        }

        // 2. Lọc theo keyword nếu có (tìm trong tên, kích thước, sức chứa, đặc điểm)
        if (keyword != null && !keyword.trim().isEmpty()) {
            String kw = keyword.trim().toLowerCase();
            all = all.stream()
                    .filter(ut -> (ut.getName() != null && ut.getName().toLowerCase().contains(kw))
                            || (ut.getDimensions() != null && ut.getDimensions().toLowerCase().contains(kw))
                            || (ut.getSuggestedCapacity() != null && ut.getSuggestedCapacity().toLowerCase().contains(kw))
                            || (ut.getFeatures() != null && ut.getFeatures().toLowerCase().contains(kw)))
                    .toList();
        }

        // 3. Batch queries gom nhóm số lượng ô kho
        Map<Integer, Long> totalUnitsMap = toMap(storageUnitRepository.countAllGroupedByUnitTypeSystemWide());
        Map<String, Long> statusUnitsMap = toStatusMap(storageUnitRepository.countStatusGroupedByUnitTypeSystemWide());
        Map<Integer, Long> reservationsMap = toMap(reservationRepository.countAllGroupedByUnitTypeSystemWide());

        // 4. Map ra danh sách DTO
        List<BomUnitTypeResponse> result = new ArrayList<>();
        for (UnitType ut : all) {
            long total = totalUnitsMap.getOrDefault(ut.getId(), 0L);
            long available = statusUnitsMap.getOrDefault(ut.getId() + "_AVAILABLE", 0L);
            long occupied = statusUnitsMap.getOrDefault(ut.getId() + "_OCCUPIED", 0L);
            long maintenance = statusUnitsMap.getOrDefault(ut.getId() + "_MAINTENANCE", 0L);
            long reserved = statusUnitsMap.getOrDefault(ut.getId() + "_RESERVED", 0L);
            long resCount = reservationsMap.getOrDefault(ut.getId(), 0L);

            // PR-M4: Chỉ xoá được loại chưa từng có ô kho và chưa từng có đơn đặt chỗ
            boolean canDelete = (total == 0 && resCount == 0);

            result.add(BomUnitTypeResponse.builder()
                    .id(ut.getId())
                    .name(ut.getName())
                    .areaSqm(ut.getAreaSqm())
                    .volumeCbm(ut.getVolumeCbm())
                    .basePriceMonthly(ut.getBasePriceMonthly())
                    .suggestedCapacity(ut.getSuggestedCapacity())
                    .dimensions(ut.getDimensions())
                    .features(ut.getFeatures())
                    .status(ut.getStatus())
                    .totalUnits(total)
                    .availableUnits(available)
                    .occupiedUnits(occupied)
                    .maintenanceUnits(maintenance)
                    .reservedUnits(reserved)
                    .totalReservations(resCount)
                    .canDelete(canDelete)
                    .build());
        }

        result.sort(Comparator.comparing(BomUnitTypeResponse::getId));
        return result;
    }

    /**
     * UC-05: Lấy chi tiết 1 loại kho cho BOM
     */
    @Transactional(readOnly = true)
    public BomUnitTypeResponse getBomUnitTypeById(Integer id) {
        UnitType ut = unitTypeRepository.findById(id)
                .orElseThrow(() -> new UnitTypeException(HttpStatus.NOT_FOUND, "UNIT_TYPE_NOT_FOUND", "Không tìm thấy loại kho ID: " + id));

        int total = storageUnitRepository.countByUnitType_Id(id);
        int available = storageUnitRepository.countByFacility_IdAndUnitType_IdAndStatus(null, id, "AVAILABLE"); // count across all
        int occupied = 0;
        int maintenance = 0;
        int reserved = 0;

        List<Object[]> statusList = storageUnitRepository.countStatusGroupedByUnitTypeSystemWide();
        for (Object[] row : statusList) {
            Integer tid = (Integer) row[0];
            String st = (String) row[1];
            Long cnt = (Long) row[2];
            if (tid != null && tid.equals(id)) {
                if ("AVAILABLE".equalsIgnoreCase(st)) available = cnt.intValue();
                else if ("OCCUPIED".equalsIgnoreCase(st)) occupied = cnt.intValue();
                else if ("MAINTENANCE".equalsIgnoreCase(st)) maintenance = cnt.intValue();
                else if ("RESERVED".equalsIgnoreCase(st)) reserved = cnt.intValue();
            }
        }

        int resCount = reservationRepository.countByUnitType_Id(id);
        boolean canDelete = (total == 0 && resCount == 0);

        return BomUnitTypeResponse.builder()
                .id(ut.getId())
                .name(ut.getName())
                .areaSqm(ut.getAreaSqm())
                .volumeCbm(ut.getVolumeCbm())
                .basePriceMonthly(ut.getBasePriceMonthly())
                .suggestedCapacity(ut.getSuggestedCapacity())
                .dimensions(ut.getDimensions())
                .features(ut.getFeatures())
                .status(ut.getStatus())
                .totalUnits(total)
                .availableUnits(available)
                .occupiedUnits(occupied)
                .maintenanceUnits(maintenance)
                .reservedUnits(reserved)
                .totalReservations(resCount)
                .canDelete(canDelete)
                .build();
    }

    /**
     * UC-05 / PR-M3: Tạo loại kho mới
     */
    @Transactional
    public BomUnitTypeResponse createUnitType(CreateUnitTypeRequest request, Integer actorUserId) {
        String cleanName = request.getName().trim();

        // PR-M3: Tên loại kho duy nhất toàn hệ thống
        if (unitTypeRepository.existsByNameIgnoreCase(cleanName)) {
            throw new UnitTypeException(
                    HttpStatus.CONFLICT,
                    "UNIT_TYPE_NAME_EXISTS",
                    "Tên loại kho '" + cleanName + "' đã tồn tại trong hệ thống. Vui lòng chọn tên khác."
            );
        }

        // PR-M3: Diện tích, thể tích, giá > 0
        if (request.getAreaSqm().compareTo(BigDecimal.ZERO) <= 0) {
            throw new UnitTypeException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Diện tích phải lớn hơn 0 m²");
        }
        if (request.getVolumeCbm().compareTo(BigDecimal.ZERO) <= 0) {
            throw new UnitTypeException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Thể tích phải lớn hơn 0 m³");
        }
        if (request.getBasePriceMonthly().compareTo(BigDecimal.ZERO) <= 0) {
            throw new UnitTypeException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Giá niêm yết hàng tháng phải lớn hơn 0 VNĐ");
        }

        String initialStatus = (request.getStatus() != null && !request.getStatus().isBlank())
                ? request.getStatus().trim().toUpperCase()
                : "ACTIVE";

        UnitType unitType = UnitType.builder()
                .name(cleanName)
                .areaSqm(request.getAreaSqm())
                .volumeCbm(request.getVolumeCbm())
                .basePriceMonthly(request.getBasePriceMonthly())
                .suggestedCapacity(request.getSuggestedCapacity() != null ? request.getSuggestedCapacity().trim() : null)
                .dimensions(request.getDimensions() != null ? request.getDimensions().trim() : null)
                .features(request.getFeatures() != null ? request.getFeatures().trim() : null)
                .status(initialStatus)
                .build();

        unitTypeRepository.save(unitType);

        // PR-91 / PR-A9: Ghi activity_logs
        Integer effectiveUserId = actorUserId != null ? actorUserId : getDefaultBomUserId();
        activityLogService.log(
                effectiveUserId,
                "[UNIT_TYPE_CREATE] Tạo loại kho mới: " + unitType.getName() + " (" + unitType.getAreaSqm() + " m², " + unitType.getBasePriceMonthly() + " đ/tháng)",
                "unit_types",
                String.valueOf(unitType.getId())
        );

        return getBomUnitTypeById(unitType.getId());
    }

    /**
     * UC-05 / PR-M3, PR-12: Cập nhật thông tin loại kho & giá niêm yết
     */
    @Transactional
    public BomUnitTypeResponse updateUnitType(Integer id, UpdateUnitTypeRequest request, Integer actorUserId) {
        UnitType unitType = unitTypeRepository.findById(id)
                .orElseThrow(() -> new UnitTypeException(HttpStatus.NOT_FOUND, "UNIT_TYPE_NOT_FOUND", "Không tìm thấy loại kho ID: " + id));

        String cleanName = request.getName().trim();

        // PR-M3: Tên loại kho duy nhất
        if (unitTypeRepository.existsByNameIgnoreCaseAndIdNot(cleanName, id)) {
            throw new UnitTypeException(
                    HttpStatus.CONFLICT,
                    "UNIT_TYPE_NAME_EXISTS",
                    "Tên loại kho '" + cleanName + "' đã được sử dụng bởi loại kho khác."
            );
        }

        // PR-M3: Diện tích, thể tích, giá > 0
        if (request.getAreaSqm().compareTo(BigDecimal.ZERO) <= 0) {
            throw new UnitTypeException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Diện tích phải lớn hơn 0 m²");
        }
        if (request.getVolumeCbm().compareTo(BigDecimal.ZERO) <= 0) {
            throw new UnitTypeException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Thể tích phải lớn hơn 0 m³");
        }
        if (request.getBasePriceMonthly().compareTo(BigDecimal.ZERO) <= 0) {
            throw new UnitTypeException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Giá niêm yết hàng tháng phải lớn hơn 0 VNĐ");
        }

        // PR-12: Ghi nhận nếu có sự thay đổi về giá niêm yết
        boolean priceChanged = unitType.getBasePriceMonthly().compareTo(request.getBasePriceMonthly()) != 0;
        BigDecimal oldPrice = unitType.getBasePriceMonthly();

        unitType.setName(cleanName);
        unitType.setAreaSqm(request.getAreaSqm());
        unitType.setVolumeCbm(request.getVolumeCbm());
        unitType.setBasePriceMonthly(request.getBasePriceMonthly());
        unitType.setSuggestedCapacity(request.getSuggestedCapacity() != null ? request.getSuggestedCapacity().trim() : null);
        unitType.setDimensions(request.getDimensions() != null ? request.getDimensions().trim() : null);
        unitType.setFeatures(request.getFeatures() != null ? request.getFeatures().trim() : null);

        if (request.getStatus() != null && !request.getStatus().isBlank()) {
            unitType.setStatus(request.getStatus().trim().toUpperCase());
        }

        unitTypeRepository.save(unitType);

        // PR-91 / PR-A9 / PR-12: Ghi activity_logs
        Integer effectiveUserId = actorUserId != null ? actorUserId : getDefaultBomUserId();
        String logMessage = "[UNIT_TYPE_UPDATE] Cập nhật loại kho: " + unitType.getName();
        if (priceChanged) {
            logMessage += " (Đổi giá từ " + oldPrice + " thành " + unitType.getBasePriceMonthly() + " đ/tháng - áp dụng cho đơn mới và gia hạn sau theo PR-12)";
        }
        activityLogService.log(effectiveUserId, logMessage, "unit_types", String.valueOf(unitType.getId()));

        return getBomUnitTypeById(id);
    }

    /**
     * UC-05 / PR-M4: Bật/tắt trạng thái loại kho (ACTIVE/INACTIVE)
     */
    @Transactional
    public BomUnitTypeResponse updateUnitTypeStatus(Integer id, UpdateUnitTypeStatusRequest request, Integer actorUserId) {
        UnitType unitType = unitTypeRepository.findById(id)
                .orElseThrow(() -> new UnitTypeException(HttpStatus.NOT_FOUND, "UNIT_TYPE_NOT_FOUND", "Không tìm thấy loại kho ID: " + id));

        String targetStatus = request.getStatus().trim().toUpperCase();
        unitType.setStatus(targetStatus);
        unitTypeRepository.save(unitType);

        Integer effectiveUserId = actorUserId != null ? actorUserId : getDefaultBomUserId();
        activityLogService.log(
                effectiveUserId,
                "[UNIT_TYPE_STATUS] Đổi trạng thái loại kho '" + unitType.getName() + "' sang " + targetStatus,
                "unit_types",
                String.valueOf(unitType.getId())
        );

        return getBomUnitTypeById(id);
    }

    /**
     * UC-05 / PR-M4: Xóa hoàn toàn loại kho khỏi hệ thống
     * Quy tắc PR-M4: "Chỉ xoá được loại chưa từng có ô."
     */
    @Transactional
    public void deleteUnitType(Integer id, Integer actorUserId) {
        UnitType unitType = unitTypeRepository.findById(id)
                .orElseThrow(() -> new UnitTypeException(HttpStatus.NOT_FOUND, "UNIT_TYPE_NOT_FOUND", "Không tìm thấy loại kho ID: " + id));

        // PR-M4: Kiểm tra có ô kho nào từng thuộc loại này không
        int unitCount = storageUnitRepository.countByUnitType_Id(id);
        if (unitCount > 0) {
            throw new UnitTypeException(
                    HttpStatus.CONFLICT,
                    "UNIT_TYPE_HAS_UNITS",
                    "Không thể xóa loại kho đã từng có ô kho trong hệ thống (hiện có " + unitCount + " ô kho). Vui lòng chuyển trạng thái sang Tạm ngừng (INACTIVE)."
            );
        }

        // Kiểm tra xem đã từng có đơn đặt chỗ nào gắn loại kho này không
        int resCount = reservationRepository.countByUnitType_Id(id);
        if (resCount > 0) {
            throw new UnitTypeException(
                    HttpStatus.CONFLICT,
                    "UNIT_TYPE_IN_USE",
                    "Không thể xóa loại kho đã phát sinh " + resCount + " đơn đặt chỗ trong hệ thống. Vui lòng chuyển trạng thái sang Tạm ngừng (INACTIVE)."
            );
        }

        String typeName = unitType.getName();
        unitTypeRepository.delete(unitType);

        // Ghi activity log
        Integer effectiveUserId = actorUserId != null ? actorUserId : getDefaultBomUserId();
        activityLogService.log(
                effectiveUserId,
                "[UNIT_TYPE_DELETE] Xóa hoàn toàn loại kho: " + typeName + " (ID: " + id + ")",
                "unit_types",
                String.valueOf(id)
        );
    }

    // ──────────────────────────────────────────────────────
    // Helper Methods
    // ──────────────────────────────────────────────────────
    private Map<Integer, Long> toMap(List<Object[]> rows) {
        Map<Integer, Long> map = new HashMap<>();
        if (rows == null) return map;
        for (Object[] row : rows) {
            if (row != null && row.length >= 2 && row[0] != null) {
                Integer id = (Integer) row[0];
                Long count = (Long) row[1];
                map.put(id, count);
            }
        }
        return map;
    }

    private Map<String, Long> toStatusMap(List<Object[]> rows) {
        Map<String, Long> map = new HashMap<>();
        if (rows == null) return map;
        for (Object[] row : rows) {
            if (row != null && row.length >= 3 && row[0] != null && row[1] != null) {
                Integer id = (Integer) row[0];
                String st = (String) row[1];
                Long count = (Long) row[2];
                map.put(id + "_" + st.toUpperCase(), count);
            }
        }
        return map;
    }

    private Integer getDefaultBomUserId() {
        try {
            return jdbcTemplate.queryForObject(
                    "SELECT TOP 1 u.id FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = 'BOM' AND u.status = 'ACTIVE' ORDER BY u.id ASC",
                    Integer.class
            );
        } catch (Exception ignored) {
        }
        return 1;
    }
}
