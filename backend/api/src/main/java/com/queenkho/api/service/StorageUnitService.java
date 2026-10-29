package com.queenkho.api.service;

import com.queenkho.api.dto.*;
import com.queenkho.api.entity.Facility;
import com.queenkho.api.entity.RentalContract;
import com.queenkho.api.entity.StorageUnit;
import com.queenkho.api.entity.UnitType;
import com.queenkho.api.exception.FacilityException;
import com.queenkho.api.repository.FacilityRepository;
import com.queenkho.api.repository.RentalContractRepository;
import com.queenkho.api.repository.ReservationRepository;
import com.queenkho.api.repository.StorageUnitRepository;
import com.queenkho.api.repository.UnitTypeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class StorageUnitService {

    private final StorageUnitRepository storageUnitRepository;
    private final FacilityRepository facilityRepository;
    private final UnitTypeRepository unitTypeRepository;
    private final RentalContractRepository rentalContractRepository;
    private final ReservationRepository reservationRepository;
    private final ActivityLogService activityLogService;
    private final StaffTaskService staffTaskService;
    private final FloorPlanService floorPlanService;

    /**
     * UC-06: Lấy danh sách ô kho có lọc và tính toán thống kê KPI theo cơ sở
     */
    @Transactional(readOnly = true)
    public StorageUnitListResponse getStorageUnits(Integer facilityId, String status, String floor, Integer unitTypeId, String keyword) {
        Facility facility = facilityRepository.findById(facilityId)
                .orElseThrow(() -> new FacilityException(HttpStatus.NOT_FOUND, "FACILITY_NOT_FOUND", "Không tìm thấy cơ sở ID: " + facilityId));

        List<StorageUnit> allUnits = storageUnitRepository.findByFacility_Id(facilityId);

        // Chuyển đổi sang danh sách Detail DTO và tính toán trạng thái động
        List<StorageUnitDetailResponse> allDetails = allUnits.stream().map(unit -> {
            boolean canDelete = !rentalContractRepository.existsByStorageUnit_Id(unit.getId());
            Optional<RentalContract> latestContractOpt = rentalContractRepository.findFirstByStorageUnit_IdOrderByIdDesc(unit.getId());

            StorageUnitDetailResponse.CurrentContractInfo contractInfo = null;
            boolean isOverdue = false;

            if (latestContractOpt.isPresent()) {
                RentalContract c = latestContractOpt.get();
                // Chỉ hiển thị hợp đồng nếu chưa bị hủy/kết thúc quá khứ hoặc đang trong chu kỳ
                List<String> activeStatuses = List.of("PENDING_CHECK_IN", "ACTIVE", "OVERDUE", "TERMINATION_PENDING");
                if (activeStatuses.contains(c.getStatus())) {
                    contractInfo = StorageUnitDetailResponse.CurrentContractInfo.builder()
                            .contractId(c.getId())
                            .contractCode(c.getContractCode())
                            .customerId(c.getCustomer() != null ? c.getCustomer().getId() : null)
                            .customerName(c.getCustomer() != null ? c.getCustomer().getFullName() : "N/A")
                            .customerPhone(c.getCustomer() != null ? c.getCustomer().getPhone() : "")
                            .startDate(c.getStartDate())
                            .endDate(c.getEndDate())
                            .contractStatus(c.getStatus())
                            .build();

                    if ("OVERDUE".equalsIgnoreCase(c.getStatus())) {
                        isOverdue = true;
                    }
                }
            }

            UnitType ut = unit.getUnitType();
            return StorageUnitDetailResponse.builder()
                    .id(unit.getId())
                    .facilityId(facility.getId())
                    .facilityName(facility.getName())
                    .facilityCode(facility.getCode())
                    .unitTypeId(ut != null ? ut.getId() : null)
                    .unitTypeName(ut != null ? ut.getName() : "")
                    .areaSqm(ut != null ? ut.getAreaSqm() : null)
                    .volumeCbm(ut != null ? ut.getVolumeCbm() : null)
                    .basePriceMonthly(ut != null ? ut.getBasePriceMonthly() : null)
                    .floor(unit.getFloor())
                    .zone(unit.getZone())
                    .roomNumber(unit.getRoomNumber())
                    .status(unit.getStatus())
                    .overdue(isOverdue)
                    .currentContract(contractInfo)
                    .canDelete(canDelete)
                    .mapX(unit.getMapX())
                    .mapY(unit.getMapY())
                    .mapW(unit.getMapW())
                    .mapH(unit.getMapH())
                    .mapDoor(unit.getMapDoor())
                    .defaultMapW(FloorPlanService.defaultSize(ut)[0])
                    .defaultMapH(FloorPlanService.defaultSize(ut)[1])
                    .build();
        }).map(this::withMaintenanceInfo).collect(Collectors.toList());

        // Tính toán các chỉ số KPI trước khi lọc
        int totalUnits = allDetails.size();
        int availableUnits = (int) allDetails.stream().filter(u -> "AVAILABLE".equalsIgnoreCase(u.getStatus())).count();
        int occupiedUnits = (int) allDetails.stream().filter(u -> "OCCUPIED".equalsIgnoreCase(u.getStatus())).count();
        int maintenanceUnits = (int) allDetails.stream().filter(u -> "MAINTENANCE".equalsIgnoreCase(u.getStatus())).count();
        int overdueUnits = (int) allDetails.stream().filter(StorageUnitDetailResponse::isOverdue).count();

        int operationalUnits = totalUnits - maintenanceUnits;
        double occupancyRate = operationalUnits > 0 ? (occupiedUnits * 100.0 / operationalUnits) : 0.0;
        occupancyRate = Math.round(occupancyRate * 10.0) / 10.0; // Làm tròn 1 chữ số thập phân

        // Danh sách các tầng thực tế để hiển thị filter dropdown
        List<String> distinctFloors = storageUnitRepository.findDistinctFloorsByFacilityId(facilityId);

        // Áp dụng bộ lọc
        List<StorageUnitDetailResponse> filteredUnits = allDetails.stream()
                .filter(u -> {
                    // Lọc trạng thái
                    if (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status)) {
                        if ("OVERDUE".equalsIgnoreCase(status)) {
                            if (!u.isOverdue()) return false;
                        } else {
                            if (!status.equalsIgnoreCase(u.getStatus())) return false;
                        }
                    }
                    // Lọc tầng
                    if (floor != null && !floor.isBlank() && !"ALL".equalsIgnoreCase(floor)) {
                        if (!floor.equalsIgnoreCase(u.getFloor())) return false;
                    }
                    // Lọc loại kho
                    if (unitTypeId != null) {
                        if (u.getUnitTypeId() == null || !u.getUnitTypeId().equals(unitTypeId)) return false;
                    }
                    // Tìm kiếm từ khóa
                    if (keyword != null && !keyword.isBlank()) {
                        String kw = keyword.trim().toLowerCase();
                        boolean matchId = u.getId() != null && u.getId().toLowerCase().contains(kw);
                        boolean matchRoom = u.getRoomNumber() != null && u.getRoomNumber().toLowerCase().contains(kw);
                        boolean matchType = u.getUnitTypeName() != null && u.getUnitTypeName().toLowerCase().contains(kw);
                        boolean matchCustomer = u.getCurrentContract() != null && u.getCurrentContract().getCustomerName() != null
                                && u.getCurrentContract().getCustomerName().toLowerCase().contains(kw);

                        if (!matchId && !matchRoom && !matchType && !matchCustomer) return false;
                    }
                    return true;
                })
                .collect(Collectors.toList());

        return StorageUnitListResponse.builder()
                .units(filteredUnits)
                .totalUnits(totalUnits)
                .availableUnits(availableUnits)
                .occupiedUnits(occupiedUnits)
                .maintenanceUnits(maintenanceUnits)
                .overdueUnits(overdueUnits)
                .occupancyRate(occupancyRate)
                .floors(distinctFloors)
                .facilityId(facility.getId())
                .facilityName(facility.getName())
                .build();
    }

    /**
     * Chi tiết 1 ô kho
     */
    @Transactional(readOnly = true)
    public StorageUnitDetailResponse getStorageUnitDetail(String id) {
        StorageUnit unit = storageUnitRepository.findById(id)
                .orElseThrow(() -> new FacilityException(HttpStatus.NOT_FOUND, "UNIT_NOT_FOUND", "Không tìm thấy ô kho: " + id));

        Facility facility = unit.getFacility();
        UnitType ut = unit.getUnitType();
        boolean canDelete = !rentalContractRepository.existsByStorageUnit_Id(unit.getId());
        Optional<RentalContract> latestContractOpt = rentalContractRepository.findFirstByStorageUnit_IdOrderByIdDesc(unit.getId());

        StorageUnitDetailResponse.CurrentContractInfo contractInfo = null;
        boolean isOverdue = false;

        if (latestContractOpt.isPresent()) {
            RentalContract c = latestContractOpt.get();
            List<String> activeStatuses = List.of("PENDING_CHECK_IN", "ACTIVE", "OVERDUE", "TERMINATION_PENDING");
            if (activeStatuses.contains(c.getStatus())) {
                contractInfo = StorageUnitDetailResponse.CurrentContractInfo.builder()
                        .contractId(c.getId())
                        .contractCode(c.getContractCode())
                        .customerId(c.getCustomer() != null ? c.getCustomer().getId() : null)
                        .customerName(c.getCustomer() != null ? c.getCustomer().getFullName() : "N/A")
                        .customerPhone(c.getCustomer() != null ? c.getCustomer().getPhone() : "")
                        .startDate(c.getStartDate())
                        .endDate(c.getEndDate())
                        .contractStatus(c.getStatus())
                        .build();

                if ("OVERDUE".equalsIgnoreCase(c.getStatus())) {
                    isOverdue = true;
                }
            }
        }

        return withMaintenanceInfo(StorageUnitDetailResponse.builder()
                .id(unit.getId())
                .facilityId(facility != null ? facility.getId() : null)
                .facilityName(facility != null ? facility.getName() : "")
                .facilityCode(facility != null ? facility.getCode() : "")
                .unitTypeId(ut != null ? ut.getId() : null)
                .unitTypeName(ut != null ? ut.getName() : "")
                .areaSqm(ut != null ? ut.getAreaSqm() : null)
                .volumeCbm(ut != null ? ut.getVolumeCbm() : null)
                .basePriceMonthly(ut != null ? ut.getBasePriceMonthly() : null)
                .floor(unit.getFloor())
                .zone(unit.getZone())
                .roomNumber(unit.getRoomNumber())
                .status(unit.getStatus())
                .overdue(isOverdue)
                .currentContract(contractInfo)
                .canDelete(canDelete)
                .mapX(unit.getMapX())
                .mapY(unit.getMapY())
                .mapW(unit.getMapW())
                .mapH(unit.getMapH())
                .mapDoor(unit.getMapDoor())
                .defaultMapW(FloorPlanService.defaultSize(ut)[0])
                .defaultMapH(FloorPlanService.defaultSize(ut)[1])
                .build());
    }

    // PR-O10: gắn task bảo trì đang mở (nếu có) cho ô MAINTENANCE để FM phân biệt "chờ sửa sự cố / chờ dọn
    // sau thanh lý" với ô tự khoá bảo trì bằng tay
    private StorageUnitDetailResponse withMaintenanceInfo(StorageUnitDetailResponse detail) {
        if (!"MAINTENANCE".equalsIgnoreCase(detail.getStatus())) {
            return detail;
        }
        staffTaskService.findOpenMaintenanceTask(detail.getId()).ifPresent(task -> {
            detail.setMaintenanceTaskId(task.getId());
            detail.setMaintenanceReason("LIQUIDATION".equals(task.getMaintenanceReason()) ? "LIQUIDATION" : "DAMAGE");
        });
        return detail;
    }

    /**
     * UC-06 / PR-M9: Tạo ô kho mới (mã sinh tự động)
     */
    @Transactional
    public StorageUnitDetailResponse createStorageUnit(Integer facilityId, CreateStorageUnitRequest request, Integer actorUserId) {
        Facility facility = facilityRepository.findById(facilityId)
                .orElseThrow(() -> new FacilityException(HttpStatus.NOT_FOUND, "FACILITY_NOT_FOUND", "Không tìm thấy cơ sở ID: " + facilityId));

        UnitType unitType = unitTypeRepository.findById(request.getUnitTypeId())
                .orElseThrow(() -> new FacilityException(HttpStatus.NOT_FOUND, "UNIT_TYPE_NOT_FOUND", "Không tìm thấy loại kho ID: " + request.getUnitTypeId()));

        // PR-M4: Không cho phép thêm ô kho mới thuộc loại đang INACTIVE
        if ("INACTIVE".equalsIgnoreCase(unitType.getStatus())) {
            throw new FacilityException(HttpStatus.BAD_REQUEST, "UNIT_TYPE_INACTIVE", "Không thể tạo ô kho mới với loại kho đang ở trạng thái Tạm ngưng (INACTIVE)");
        }

        String zone = request.getZone().trim().toUpperCase();
        String room = request.getRoomNumber().trim();

        // Chuẩn hóa số phòng nếu là số thuần túy (VD: "4" -> "004", "12" -> "012", "101" -> "101")
        String cleanRoom = room;
        if (cleanRoom.matches("\\d+") && cleanRoom.length() < 3) {
            cleanRoom = String.format("%03d", Integer.parseInt(cleanRoom));
        }

        // PR-M9: Mã ô tự sinh KV-<facilities.code>-<khu><số phòng 3 chữ số>
        String unitId = "KV-" + facility.getCode() + "-" + zone + cleanRoom;

        if (storageUnitRepository.existsById(unitId)) {
            throw new FacilityException(HttpStatus.CONFLICT, "DUPLICATE_UNIT_CODE", "Mã ô kho " + unitId + " đã tồn tại trong hệ thống");
        }

        StorageUnit unit = new StorageUnit();
        unit.setId(unitId);
        unit.setFacility(facility);
        unit.setUnitType(unitType);
        unit.setFloor(request.getFloor().trim());
        unit.setZone(zone);
        unit.setRoomNumber(cleanRoom);
        unit.setStatus("AVAILABLE");

        // UC-06: đặt luôn vị trí trên mặt bằng nếu FM đã chọn chỗ (tầng phải có mặt bằng, không chồng ô khác)
        if (request.getMapX() != null) {
            floorPlanService.applyPlacement(unit, UnitPlacementDto.builder()
                    .unitId(unitId)
                    .x(request.getMapX())
                    .y(request.getMapY())
                    .w(request.getMapW())
                    .h(request.getMapH())
                    .door(request.getMapDoor())
                    .build(), unit.getFloor());
            floorPlanService.validateNewUnitPlacement(facilityId, unit.getFloor(), unit);
        }

        storageUnitRepository.save(unit);

        activityLogService.log(
                actorUserId != null ? actorUserId : 1,
                "[UNIT_CREATE] Tạo ô kho mới " + unitId + " (" + unitType.getName() + ", " + unit.getFloor() + ") tại cơ sở " + facility.getName(),
                "storage_units",
                unitId
        );

        return getStorageUnitDetail(unitId);
    }

    /**
     * UC-06 / PR-21: Cập nhật loại kho, tầng, khu (chỉ khi AVAILABLE hoặc MAINTENANCE)
     */
    @Transactional
    public StorageUnitDetailResponse updateStorageUnit(String id, UpdateStorageUnitRequest request, Integer actorUserId) {
        StorageUnit unit = storageUnitRepository.findById(id)
                .orElseThrow(() -> new FacilityException(HttpStatus.NOT_FOUND, "UNIT_NOT_FOUND", "Không tìm thấy ô kho: " + id));

        if ("OCCUPIED".equalsIgnoreCase(unit.getStatus())) {
            throw new FacilityException(HttpStatus.CONFLICT, "UNIT_IN_USE", "Không thể chỉnh sửa thông tin ô kho đang có khách thuê (OCCUPIED)");
        }

        // Nếu thay đổi loại kho -> kiểm tra số suất khả dụng của loại kho cũ theo PR-M10 & BR-11
        if (!unit.getUnitType().getId().equals(request.getUnitTypeId())) {
            if ("AVAILABLE".equalsIgnoreCase(unit.getStatus())) {
                checkSlotAvailabilityBeforeReduction(unit.getFacility().getId(), unit.getUnitType().getId());
            }

            UnitType newType = unitTypeRepository.findById(request.getUnitTypeId())
                    .orElseThrow(() -> new FacilityException(HttpStatus.NOT_FOUND, "UNIT_TYPE_NOT_FOUND", "Không tìm thấy loại kho ID: " + request.getUnitTypeId()));

        // PR-M4: Không cho phép chuyển sang loại kho đang INACTIVE
        if ("INACTIVE".equalsIgnoreCase(newType.getStatus())) {
            throw new FacilityException(HttpStatus.BAD_REQUEST, "UNIT_TYPE_INACTIVE", "Không thể chuyển sang loại kho đang ở trạng thái Tạm ngưng (INACTIVE)");
        }
            unit.setUnitType(newType);
        }

        if (request.getFloor() != null && !request.getFloor().isBlank()) {
            // UC-06: chuyển sang tầng khác → vị trí cũ không còn đúng, ô về danh sách "chưa đặt" của tầng mới
            if (unit.getFloor() == null || !unit.getFloor().trim().equalsIgnoreCase(request.getFloor().trim())) {
                unit.clearMapPosition();
            }
            unit.setFloor(request.getFloor().trim());
        }
        if (request.getZone() != null && !request.getZone().isBlank()) {
            unit.setZone(request.getZone().trim().toUpperCase());
        }
        if (request.getRoomNumber() != null && !request.getRoomNumber().isBlank()) {
            unit.setRoomNumber(request.getRoomNumber().trim());
        }

        storageUnitRepository.save(unit);

        activityLogService.log(
                actorUserId != null ? actorUserId : 1,
                "[UNIT_UPDATE] Cập nhật thông tin ô kho " + id,
                "storage_units",
                id
        );

        return getStorageUnitDetail(id);
    }

    /**
     * UC-06 / PR-M9, PR-M10: Đổi trạng thái AVAILABLE ⇄ MAINTENANCE
     */
    @Transactional
    public StorageUnitDetailResponse updateStorageUnitStatus(String id, UpdateStorageUnitStatusRequest request, Integer actorUserId) {
        StorageUnit unit = storageUnitRepository.findById(id)
                .orElseThrow(() -> new FacilityException(HttpStatus.NOT_FOUND, "UNIT_NOT_FOUND", "Không tìm thấy ô kho: " + id));

        String targetStatus = request.getStatus().trim().toUpperCase();

        if (!"AVAILABLE".equals(targetStatus) && !"MAINTENANCE".equals(targetStatus)) {
            throw new FacilityException(HttpStatus.BAD_REQUEST, "INVALID_STATUS_TRANSITION",
                    "Quản lý cơ sở chỉ có thể chuyển đổi qua lại giữa 'AVAILABLE' và 'MAINTENANCE'");
        }

        if ("OCCUPIED".equalsIgnoreCase(unit.getStatus())) {
            throw new FacilityException(HttpStatus.CONFLICT, "UNIT_IN_USE",
                    "Ô kho đang có hợp đồng hoạt động (OCCUPIED), không thể tự ý chuyển trạng thái");
        }

        if (targetStatus.equalsIgnoreCase(unit.getStatus())) {
            return getStorageUnitDetail(id); // Trạng thái không đổi
        }

        // Chuyển AVAILABLE -> MAINTENANCE: làm giảm 1 ô khả dụng
        // Bắt buộc kiểm tra PR-M10 / BR-11: không làm âm số suất cọc
        if ("MAINTENANCE".equals(targetStatus)) {
            checkSlotAvailabilityBeforeReduction(unit.getFacility().getId(), unit.getUnitType().getId());
        }

        unit.setStatus(targetStatus);
        storageUnitRepository.save(unit);

        // PR-O10: "Mở lại kho" khi ô còn task bảo trì (sau trả kho có sự cố / thanh lý) → đóng luôn task đó
        if ("AVAILABLE".equals(targetStatus)) {
            staffTaskService.closeOpenMaintenanceForUnit(id, actorUserId);
        }

        String noteStr = request.getNote() != null && !request.getNote().isBlank() ? " (Ghi chú: " + request.getNote().trim() + ")" : "";
        activityLogService.log(
                actorUserId != null ? actorUserId : 1,
                "[UNIT_STATUS] Đổi trạng thái ô kho " + id + " sang " + targetStatus + noteStr,
                "storage_units",
                id
        );

        return getStorageUnitDetail(id);
    }

    /**
     * UC-06 / PR-21: Xóa ô kho vật lý (chặn nếu đã từng có hợp đồng)
     */
    @Transactional
    public void deleteStorageUnit(String id, Integer actorUserId) {
        StorageUnit unit = storageUnitRepository.findById(id)
                .orElseThrow(() -> new FacilityException(HttpStatus.NOT_FOUND, "UNIT_NOT_FOUND", "Không tìm thấy ô kho: " + id));

        // PR-21: Không xoá ô đã từng có hợp đồng
        if (rentalContractRepository.existsByStorageUnit_Id(id)) {
            throw new FacilityException(HttpStatus.CONFLICT, "UNIT_HAS_CONTRACT_HISTORY",
                    "Không thể xóa ô kho " + id + " vì đã từng phát sinh hợp đồng thuê trong lịch sử");
        }

        // Nếu ô đang AVAILABLE -> kiểm tra số suất khả dụng trước khi giảm
        if ("AVAILABLE".equalsIgnoreCase(unit.getStatus())) {
            checkSlotAvailabilityBeforeReduction(unit.getFacility().getId(), unit.getUnitType().getId());
        }

        storageUnitRepository.delete(unit);

        activityLogService.log(
                actorUserId != null ? actorUserId : 1,
                "[UNIT_DELETE] Xóa ô kho vật lý " + id + " tại cơ sở " + (unit.getFacility() != null ? unit.getFacility().getName() : ""),
                "storage_units",
                id
        );
    }

    /**
     * PR-M10 & BR-11: Kiểm tra không làm âm số suất giữ chỗ
     * Số suất khả dụng = (Ô AVAILABLE) - (Đơn PENDING) - (Đơn DEPOSIT_PAID)
     */
    private void checkSlotAvailabilityBeforeReduction(Integer facilityId, Integer unitTypeId) {
        int availableCount = storageUnitRepository.countByFacility_IdAndUnitType_IdAndStatus(facilityId, unitTypeId, "AVAILABLE");
        int pendingReservations = reservationRepository.countByFacility_IdAndUnitType_IdAndStatusInAndStorageUnitIdIsNull(
                facilityId, unitTypeId, List.of("PENDING", "DEPOSIT_PAID")
        );
        int remainingSlots = availableCount - pendingReservations;

        if (remainingSlots - 1 < 0) {
            throw new FacilityException(HttpStatus.CONFLICT, "SLOT_IN_USE",
                    "Không thể thực hiện vì sẽ làm âm số suất khả dụng của loại kho này (Có "
                            + pendingReservations + " đơn đang đặt giữ chỗ/chờ gán ô, nhưng hiện chỉ còn " + availableCount + " ô trống khả dụng)");
        }
    }
}

