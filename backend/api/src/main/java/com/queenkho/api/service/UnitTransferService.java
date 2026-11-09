package com.queenkho.api.service;

import com.queenkho.api.dto.StorageUnitResponse;
import com.queenkho.api.dto.TransferUnitRequest;
import com.queenkho.api.dto.UnitTransferResponse;
import com.queenkho.api.entity.RentalContract;
import com.queenkho.api.entity.Reservation;
import com.queenkho.api.entity.StorageUnit;
import com.queenkho.api.entity.UnitTransfer;
import com.queenkho.api.entity.User;
import com.queenkho.api.exception.ContractException;
import com.queenkho.api.repository.RentalContractRepository;
import com.queenkho.api.repository.ReservationRepository;
import com.queenkho.api.repository.StorageUnitRepository;
import com.queenkho.api.repository.UnitTransferRepository;
import com.queenkho.api.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.queenkho.api.dto.UpcomingContractInfo;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * BR-122 (04/11/2026, góp ý giảng viên "không gắn chết 1 kho cho khách"): FM chuyển hợp đồng sang ô khác
 * cùng cơ sở + cùng loại (giá không đổi) khi ô cũ có vấn đề, khách xin đổi, hoặc cơ sở sắp xếp lại (vd lúc gia hạn).
 */
@Service
@RequiredArgsConstructor
public class UnitTransferService {

    // Hợp đồng còn giữ ô và chưa bị khoá PIN (OVERDUE phải xử lý quá hạn trước)
    static final List<String> TRANSFERABLE_STATUSES = List.of("PENDING_CHECK_IN", "ACTIVE", "TERMINATION_PENDING");
    static final List<String> REASON_TYPES = List.of("FACILITY_ISSUE", "CUSTOMER_REQUEST", "REARRANGE");

    private final RentalContractRepository rentalContractRepository;
    private final StorageUnitRepository storageUnitRepository;
    private final ReservationRepository reservationRepository;
    private final UnitTransferRepository unitTransferRepository;
    private final UserRepository userRepository;
    private final ActivityLogService activityLogService;
    private final NotificationService notificationService;
    private final JdbcTemplate jdbcTemplate;
    private final UnitScheduleService unitScheduleService;

    /**
     * Ô AVAILABLE cùng cơ sở + cùng loại, rảnh suốt phần còn lại của hợp đồng (D-18) — FM chọn 1 ô để chuyển tới.
     * Hợp đồng chờ nhận kho: tính từ ngày nhận kho; đang thuê: tính từ hôm nay.
     */
    @Transactional(readOnly = true)
    public List<StorageUnitResponse> getTransferOptions(Integer contractId) {
        RentalContract contract = findContract(contractId);
        StorageUnit current = contract.getStorageUnit();
        LocalDate[] range = remainingRange(contract);
        return unitScheduleService.candidates(current.getFacility().getId(), current.getUnitType().getId(),
                        range[0], range[1], contract.getId(), current.getId())
                .stream()
                .map(c -> new StorageUnitResponse(c.unit().getId(), c.unit().getUnitType().getName(), c.unit().getUnitType().getAreaSqm(),
                        c.unit().getFloor(), c.unit().getZone(), c.unit().getRoomNumber(), c.unit().getStatus(),
                        c.freeUntil(), c.nextContractCode()))
                .toList();
    }

    // D-18: khoảng ô mới phải rảnh = [max(ngày nhận kho, hôm nay), ngày ô cũ giao lại được của hợp đồng này)
    private LocalDate[] remainingRange(RentalContract contract) {
        LocalDate today = UnitScheduleService.today();
        LocalDate from = contract.getStartDate() != null && contract.getStartDate().isAfter(today) ? contract.getStartDate() : today;
        LocalDate to = unitScheduleService.bookingsOfUnit(contract.getStorageUnit().getId()).stream()
                .filter(b -> contract.getId().equals(b.contractId()))
                .map(UnitScheduleService.Booking::freeFrom)
                .filter(d -> d != null)
                .findFirst()
                .orElse(contract.getEndDate() != null ? contract.getEndDate().plusDays(UnitScheduleService.CLEANUP_DAYS) : from.plusMonths(1));
        if (!to.isAfter(from)) to = from.plusDays(1);
        return new LocalDate[]{from, to};
    }

    @Transactional(readOnly = true)
    public List<UnitTransferResponse> getTransferHistory(Integer contractId) {
        return unitTransferRepository.findByContractIdOrderByIdDesc(contractId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public UnitTransferResponse transferUnit(Integer contractId, Integer managerId, TransferUnitRequest request) {
        String reasonType = request != null && request.getReasonType() != null ? request.getReasonType().trim().toUpperCase() : "";
        String reason = request != null && request.getReason() != null ? request.getReason().trim() : "";
        if (request == null || request.getToUnitId() == null || request.getToUnitId().isBlank()) {
            throw new ContractException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Vui lòng chọn ô kho chuyển tới");
        }
        if (!REASON_TYPES.contains(reasonType)) {
            throw new ContractException(HttpStatus.BAD_REQUEST, "INVALID_INPUT",
                    "Lý do chuyển ô phải là FACILITY_ISSUE, CUSTOMER_REQUEST hoặc REARRANGE");
        }
        if (reason.length() < 10 || reason.length() > 500) {
            throw new ContractException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Mô tả lý do chuyển ô từ 10 đến 500 ký tự");
        }
        // Ô cũ lỗi do cơ sở thì không được cho thuê lại ngay — bắt buộc đưa vào bảo trì
        boolean oldToMaintenance = "FACILITY_ISSUE".equals(reasonType) || Boolean.TRUE.equals(request.getOldUnitMaintenance());

        User manager = userRepository.findById(managerId)
                .orElseThrow(() -> new ContractException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "Không tìm thấy tài khoản"));
        RentalContract contract = findContract(contractId);
        StorageUnit oldUnit = contract.getStorageUnit();
        Integer facilityId = oldUnit.getFacility().getId();
        if (manager.getFacilityId() == null || !manager.getFacilityId().equals(facilityId)) {
            throw new ContractException(HttpStatus.FORBIDDEN, "FORBIDDEN_FACILITY", "Hợp đồng không thuộc cơ sở của bạn");
        }
        if (!TRANSFERABLE_STATUSES.contains(contract.getStatus())) {
            throw new ContractException(HttpStatus.CONFLICT, "CONTRACT_NOT_TRANSFERABLE",
                    "Chỉ chuyển ô cho hợp đồng chờ nhận kho / đang thuê / chờ trả kho (hiện tại: " + contract.getStatus() + ")");
        }

        String toUnitId = request.getToUnitId().trim();
        if (toUnitId.equals(oldUnit.getId())) {
            throw new ContractException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Ô chuyển tới trùng ô hiện tại");
        }
        StorageUnit newUnit = storageUnitRepository.findById(toUnitId)
                .orElseThrow(() -> new ContractException(HttpStatus.NOT_FOUND, "UNIT_NOT_FOUND", "Không tìm thấy ô kho " + toUnitId));
        if (!newUnit.getFacility().getId().equals(facilityId)) {
            throw new ContractException(HttpStatus.BAD_REQUEST, "UNIT_NOT_IN_FACILITY", "Ô chuyển tới không cùng cơ sở");
        }
        // Cùng loại → giá thuê, cọc, phí trễ / chiếm dụng (tính theo loại ô) không đổi
        if (!newUnit.getUnitType().getId().equals(oldUnit.getUnitType().getId())) {
            throw new ContractException(HttpStatus.BAD_REQUEST, "UNIT_TYPE_MISMATCH",
                    "Chỉ chuyển sang ô cùng loại (" + oldUnit.getUnitType().getName() + ") để giữ nguyên giá thuê");
        }

        // D-18: ô cũ còn khách khác đang ở (hợp đồng này là khách gán trước cho ngày sau) → không khoá bảo trì được,
        // phải chuyển khách đang ở trước
        boolean oldAlreadyMaintenance = "MAINTENANCE".equalsIgnoreCase(oldUnit.getStatus());
        if (oldToMaintenance && !oldAlreadyMaintenance) {
            unitScheduleService.bookingsOfUnit(oldUnit.getId()).stream()
                    .filter(b -> !contract.getId().equals(b.contractId()))
                    .filter(b -> List.of("ACTIVE", "TERMINATION_PENDING", "OVERDUE").contains(b.status())
                            || ("PENDING_CHECK_IN".equals(b.status()) && !b.startDate().isAfter(UnitScheduleService.today())))
                    .findFirst()
                    .ifPresent(b -> {
                        throw new ContractException(HttpStatus.CONFLICT, "OLD_UNIT_IN_USE",
                                "Ô " + oldUnit.getId() + " đang có khách HĐ " + b.contractCode() + " sử dụng — hãy chuyển khách đó"
                                        + " sang ô khác trước rồi mới đưa ô vào bảo trì, hoặc chọn lý do không cần bảo trì");
                    });
        }

        // PR-M10: ô cũ vào bảo trì làm mất 1 ô trống so với trước → không được làm âm số suất đang giữ chỗ
        if (oldToMaintenance && !oldAlreadyMaintenance) {
            checkSlotAfterTransfer(facilityId, oldUnit.getUnitType().getId());
        }

        // D06 / D-18: khoá dòng ô mới → 2 FM thao tác cùng lúc thì người sau chờ, rồi thấy lịch đã bị chiếm.
        // Ô mới phải AVAILABLE và rảnh suốt phần còn lại của hợp đồng.
        String lockedStatus = jdbcTemplate.queryForObject(
                "SELECT status FROM storage_units WITH (UPDLOCK, HOLDLOCK) WHERE id = ?", String.class, newUnit.getId());
        if (!"AVAILABLE".equalsIgnoreCase(lockedStatus)) {
            throw new ContractException(HttpStatus.CONFLICT, "UNIT_NOT_AVAILABLE", "Ô " + newUnit.getId() + " không còn trống");
        }
        LocalDate[] range = remainingRange(contract);
        List<UnitScheduleService.Block> clashes = unitScheduleService.conflicts(newUnit, range[0], range[1], contract.getId());
        if (!clashes.isEmpty()) {
            throw new ContractException(HttpStatus.CONFLICT, "UNIT_NOT_AVAILABLE",
                    "Ô " + newUnit.getId() + " không trống suốt " + UnitScheduleService.formatDate(range[0]) + " – "
                            + UnitScheduleService.formatDate(range[1].minusDays(1)) + ": " + UnitScheduleService.describe(clashes.get(0)));
        }

        LocalDateTime now = LocalDateTime.now();
        if (oldToMaintenance) {
            String note = "Chuyển khách HĐ " + contract.getContractCode() + " sang ô " + newUnit.getId() + ": " + reason;
            oldUnit.setStatus("MAINTENANCE");
            oldUnit.setMaintenanceNote(truncate(oldAlreadyMaintenance && oldUnit.getMaintenanceNote() != null
                    ? oldUnit.getMaintenanceNote() + " | " + note : note, 500));
            if (!oldAlreadyMaintenance || oldUnit.getMaintenanceSince() == null) oldUnit.setMaintenanceSince(now);
        } else if (oldAlreadyMaintenance) {
            // ô cũ đang bảo trì vì lý do khác → giữ nguyên bảo trì
        } else {
            oldUnit.setMaintenanceNote(null);
            oldUnit.setMaintenanceSince(null);
        }
        storageUnitRepository.save(oldUnit);

        contract.setStorageUnit(newUnit);
        rentalContractRepository.save(contract);
        // D-18: trạng thái 2 ô tính lại theo lịch (ô cũ có thể còn khách khác; ô mới chỉ OCCUPIED khi đã tới ngày nhận kho)
        unitScheduleService.refreshUnitStatus(oldUnit);
        unitScheduleService.refreshUnitStatus(newUnit);
        Reservation reservation = contract.getReservation();
        if (reservation != null) {
            reservation.setStorageUnitId(newUnit.getId());
            reservationRepository.save(reservation);
        }

        UnitTransfer transfer = new UnitTransfer();
        transfer.setContract(contract);
        transfer.setFromUnitId(oldUnit.getId());
        transfer.setToUnitId(newUnit.getId());
        transfer.setReasonType(reasonType);
        transfer.setReason(reason);
        transfer.setOldUnitStatus(oldUnit.getStatus());
        transfer.setMovedBy(manager);
        unitTransferRepository.saveAndFlush(transfer);

        // D-18: ô cũ vào bảo trì mà còn khách khác đã gán trước (nhận kho sau) → trả danh sách để FM đổi ô tiếp cho họ
        List<UpcomingContractInfo> affected = "MAINTENANCE".equalsIgnoreCase(oldUnit.getStatus())
                ? unitScheduleService.pendingCheckInsOnUnit(oldUnit.getId(), contract.getId()).stream()
                    .map(UnitScheduleService::toUpcoming).toList()
                : List.of();

        activityLogService.log(managerId,
                "[UNIT_TRANSFER] Chuyển HĐ " + contract.getContractCode() + " từ ô " + oldUnit.getId() + " sang ô " + newUnit.getId()
                        + " (" + reasonLabel(reasonType) + "): " + truncate(reason, 300),
                "rental_contracts", String.valueOf(contract.getId()));

        // BR-117: báo khách + email — PIN giữ nguyên, chỉ đổi vị trí ô
        if (contract.getCustomer() != null) {
            String moveHint = "PENDING_CHECK_IN".equals(contract.getStatus())
                    ? "Lịch nhận kho giữ nguyên, bạn nhận ô mới khi tới cơ sở."
                    : "FACILITY_ISSUE".equals(reasonType)
                    ? "Cơ sở sẽ hỗ trợ chuyển hàng sang ô mới miễn phí, vui lòng liên hệ quầy để hẹn giờ."
                    : "Mã PIN giữ nguyên; vui lòng chuyển hàng sang ô mới theo lịch đã thống nhất với cơ sở.";
            notificationService.notifyCustomer(contract.getCustomer().getId(),
                    "Ô kho của hợp đồng " + contract.getContractCode() + " đã được chuyển",
                    "Hợp đồng được chuyển từ ô " + oldUnit.getId() + " sang ô " + newUnit.getId()
                            + " (tầng " + newUnit.getFloor() + ", khu " + newUnit.getZone() + ", phòng " + newUnit.getRoomNumber()
                            + "). Lý do: " + truncate(reason, 200) + ". " + moveHint,
                    "ASSIGNED",
                    reservation != null ? "/kho-cua-toi/hop-dong/" + reservation.getId() : "/kho-cua-toi");
        }

        return toResponse(transfer, affected);
    }

    private RentalContract findContract(Integer contractId) {
        return rentalContractRepository.findDetailById(contractId)
                .orElseThrow(() -> new ContractException(HttpStatus.NOT_FOUND, "CONTRACT_NOT_FOUND", "Không tìm thấy hợp đồng"));
    }

    // Cùng công thức BR-11 / PR-M10: ô trống − đơn đang giữ suất phải còn ≥ 1 trước khi bớt 1 ô trống
    private void checkSlotAfterTransfer(Integer facilityId, Integer unitTypeId) {
        int available = storageUnitRepository.countByFacility_IdAndUnitType_IdAndStatus(facilityId, unitTypeId, "AVAILABLE");
        int holding = reservationRepository.countByFacility_IdAndUnitType_IdAndStatusInAndStorageUnitIdIsNull(
                facilityId, unitTypeId, List.of("PENDING", "DEPOSIT_PAID"));
        if (available - holding - 1 < 0) {
            throw new ContractException(HttpStatus.CONFLICT, "SLOT_IN_USE",
                    "Không đưa ô cũ vào bảo trì được: còn " + holding + " đơn đang giữ suất nhưng chỉ có " + available
                            + " ô trống cùng loại");
        }
    }

    private UnitTransferResponse toResponse(UnitTransfer t) {
        return toResponse(t, null);
    }

    private UnitTransferResponse toResponse(UnitTransfer t, List<UpcomingContractInfo> affected) {
        return UnitTransferResponse.builder()
                .affectedContracts(affected)
                .id(t.getId())
                .contractId(t.getContract().getId())
                .contractCode(t.getContract().getContractCode())
                .fromUnitId(t.getFromUnitId())
                .toUnitId(t.getToUnitId())
                .reasonType(t.getReasonType())
                .reason(t.getReason())
                .oldUnitStatus(t.getOldUnitStatus())
                .movedByName(t.getMovedBy() != null ? t.getMovedBy().getFullName() : null)
                .createdAt(t.getCreatedAt())
                .build();
    }

    static String reasonLabel(String reasonType) {
        return switch (reasonType) {
            case "FACILITY_ISSUE" -> "ô có sự cố do cơ sở";
            case "CUSTOMER_REQUEST" -> "khách yêu cầu";
            default -> "cơ sở sắp xếp lại";
        };
    }

    private static String truncate(String s, int max) {
        return s.length() <= max ? s : s.substring(0, max - 3) + "...";
    }
}
