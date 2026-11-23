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

import com.queenkho.api.entity.UnitType;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

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

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    @org.springframework.context.annotation.Lazy
    private StaffTaskService staffTaskService;

    /**
     * Ô AVAILABLE cùng cơ sở + cùng loại, rảnh suốt phần còn lại của hợp đồng (D-18) — FM chọn 1 ô để chuyển tới.
     * Hợp đồng chờ nhận kho: tính từ ngày nhận kho; đang thuê: tính từ hôm nay.
     */
    @Transactional(readOnly = true)
    public List<StorageUnitResponse> getTransferOptions(Integer contractId) {
        return getTransferOptions(contractId, null);
    }

    @Transactional(readOnly = true)
    public List<StorageUnitResponse> getTransferOptions(Integer contractId, Integer renewalMonths) {
        RentalContract contract = findContract(contractId);
        StorageUnit current = contract.getStorageUnit();
        Integer effectiveMonths = renewalMonths != null && renewalMonths > 0
                ? renewalMonths
                : ("PENDING".equalsIgnoreCase(contract.getReassignRequestStatus()) ? contract.getReassignRequestedMonths() : null);
        LocalDate[] range = effectiveMonths != null && effectiveMonths > 0
                ? renewalRange(contract, effectiveMonths)
                : remainingRange(contract);
        // Ô thường: đúng loại khách đã đặt (khách đang tạm ở ô khẩn cấp khác loại thì vẫn về đúng loại đã đặt)
        List<StorageUnitResponse> result = new ArrayList<>(unitScheduleService.candidates(current.getFacility().getId(),
                        bookedType(contract).getId(), range[0], range[1], contract.getId(), current.getId())
                .stream()
                .map(c -> new StorageUnitResponse(c.unit().getId(), c.unit().getUnitType().getName(), c.unit().getUnitType().getAreaSqm(),
                        c.unit().getFloor(), c.unit().getZone(), c.unit().getRoomNumber(), c.unit().getStatus(),
                        c.freeUntil(), c.nextContractCode()))
                .toList());
        // BR-140: ô khẩn cấp rảnh cùng nhóm nhiệt độ (thường / lạnh / đông) — FE chỉ cho chọn khi lý do là sự cố do cơ sở
        if (effectiveMonths == null) {
            for (StorageUnit unit : emergencyCandidates(contract, range)) {
                result.add(new StorageUnitResponse(unit.getId(), unit.getUnitType().getName(), unit.getUnitType().getAreaSqm(),
                        unit.getFloor(), unit.getZone(), unit.getRoomNumber(), unit.getStatus(), null, null, true));
            }
        }
        return result;
    }

    /** Loại kho khách đã đặt (giá tính theo loại này) — thiếu đơn thì lấy loại của ô hiện tại */
    private static UnitType bookedType(RentalContract contract) {
        if (contract.getReservation() != null && contract.getReservation().getUnitType() != null) {
            return contract.getReservation().getUnitType();
        }
        return contract.getStorageUnit().getUnitType();
    }

    private static String temperatureOf(UnitType type) {
        return type != null && type.getTemperatureClass() != null ? type.getTemperatureClass() : "NORMAL";
    }

    /** BR-140: ô khẩn cấp đang rảnh (EMERGENCY), cùng cơ sở, cùng nhóm nhiệt độ, không vướng lịch suốt khoảng còn lại */
    private List<StorageUnit> emergencyCandidates(RentalContract contract, LocalDate[] range) {
        StorageUnit current = contract.getStorageUnit();
        String temperature = temperatureOf(bookedType(contract));
        return storageUnitRepository.findByFacility_IdAndStatus(current.getFacility().getId(), StorageUnit.EMERGENCY).stream()
                .filter(StorageUnit::isEmergencyUnit)
                .filter(u -> !u.getId().equals(current.getId()))
                .filter(u -> temperature.equals(temperatureOf(u.getUnitType())))
                .filter(u -> unitScheduleService.conflicts(u, range[0], range[1], contract.getId()).isEmpty())
                .sorted(Comparator.comparing(StorageUnit::getId))
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

    // Khoảng ô mới phải rảnh khi gán lại ô kho để gia hạn +renewalMonths tháng
    private LocalDate[] renewalRange(RentalContract contract, int renewalMonths) {
        LocalDate today = UnitScheduleService.today();
        LocalDate from = contract.getStartDate() != null && contract.getStartDate().isAfter(today) ? contract.getStartDate() : today;
        String status = contract.getStatus() != null ? contract.getStatus().toUpperCase() : "";
        LocalDate base = "TERMINATION_PENDING".equals(status) || contract.getEndDate() == null || contract.getEndDate().isBefore(today)
                ? today : contract.getEndDate();
        LocalDate to = base.plusMonths(renewalMonths).plusDays(UnitScheduleService.CLEANUP_DAYS);
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
        // Ô cũ lỗi do cơ sở thì không được cho thuê lại ngay — bắt buộc đưa vào bảo trì (xét bên dưới, sau khi biết ô cũ)
        boolean oldToMaintenance = Boolean.TRUE.equals(request.getOldUnitMaintenance());

        User manager = userRepository.findById(managerId)
                .orElseThrow(() -> new ContractException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "Không tìm thấy tài khoản"));
        RentalContract contract = findContract(contractId);
        StorageUnit oldUnit = contract.getStorageUnit();
        Integer facilityId = oldUnit.getFacility().getId();
        if (manager.getFacilityId() == null || !manager.getFacilityId().equals(facilityId)) {
            throw new ContractException(HttpStatus.FORBIDDEN, "FORBIDDEN_FACILITY", "Hợp đồng không thuộc cơ sở của bạn");
        }
        boolean isRenewalReassign = "PENDING".equalsIgnoreCase(contract.getReassignRequestStatus())
                || (request.getRenewalMonths() != null && request.getRenewalMonths() > 0);
        Integer effectiveRenewalMonths = request.getRenewalMonths() != null && request.getRenewalMonths() > 0
                ? request.getRenewalMonths()
                : contract.getReassignRequestedMonths();
        // Vấn đề 4 (22/11/2026): HĐ OVERDUE (chưa bị cưỡng chế → chưa LIQUIDATED) có yêu cầu gán lại ô để gia hạn
        // đang chờ → FM được chuyển ô; phí trễ / chiếm dụng tích luỹ vẫn cộng vào hoá đơn gia hạn khi khách thanh toán.
        boolean overdueRenewalReassign = "OVERDUE".equals(contract.getStatus())
                && "PENDING".equalsIgnoreCase(contract.getReassignRequestStatus());
        if (!TRANSFERABLE_STATUSES.contains(contract.getStatus()) && !overdueRenewalReassign) {
            throw new ContractException(HttpStatus.CONFLICT, "CONTRACT_NOT_TRANSFERABLE",
                    "Chỉ chuyển ô cho hợp đồng chờ nhận kho / đang thuê / chờ trả kho, hoặc hợp đồng quá hạn đang có"
                            + " yêu cầu gán lại ô để gia hạn (hiện tại: " + contract.getStatus() + ")");
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
        // BR-140: rời ô khẩn cấp về ô thường thì không bắt buộc bảo trì — ô khẩn cấp không hỏng, chỉ tạm giữ hàng
        if ("FACILITY_ISSUE".equals(reasonType) && !oldUnit.isEmergencyUnit()) {
            oldToMaintenance = true;
        }
        UnitType booked = bookedType(contract);
        boolean toEmergency = newUnit.isEmergencyUnit();
        if (toEmergency) {
            // BR-140: ô khẩn cấp chỉ dùng khi ô của khách có sự cố do cơ sở; khác loại được nhưng phải cùng nhóm nhiệt độ
            // (hàng lạnh / đông không để ô thường). Khách vẫn trả giá loại đã đặt (PricingService.contractMonthlyPrice).
            if (!"FACILITY_ISSUE".equals(reasonType)) {
                throw new ContractException(HttpStatus.BAD_REQUEST, "EMERGENCY_UNIT_RESTRICTED",
                        "Ô kho khẩn cấp chỉ dùng khi ô của khách gặp sự cố do cơ sở (lý do FACILITY_ISSUE)");
            }
            if (!temperatureOf(booked).equals(temperatureOf(newUnit.getUnitType()))) {
                throw new ContractException(HttpStatus.BAD_REQUEST, "UNIT_TYPE_MISMATCH",
                        "Ô khẩn cấp " + newUnit.getId() + " khác nhóm nhiệt độ với loại kho khách đã đặt (" + booked.getName() + ")");
            }
        } else if (!newUnit.getUnitType().getId().equals(booked.getId())) {
            // Cùng loại khách đã đặt → giá thuê, cọc, phí trễ / chiếm dụng không đổi
            throw new ContractException(HttpStatus.BAD_REQUEST, "UNIT_TYPE_MISMATCH",
                    "Chỉ chuyển sang ô cùng loại (" + booked.getName() + ") để giữ nguyên giá thuê");
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
        if (oldToMaintenance && !oldAlreadyMaintenance && !oldUnit.isEmergencyUnit()) {
            checkSlotAfterTransfer(facilityId, oldUnit.getUnitType().getId());
        }

        // D06 / D-18: khoá dòng ô mới → 2 FM thao tác cùng lúc thì người sau chờ, rồi thấy lịch đã bị chiếm.
        // Ô mới phải AVAILABLE và rảnh suốt phần còn lại của hợp đồng (hoặc suốt thời gian gia hạn nếu gán lại ô gia hạn).
        String lockedStatus = jdbcTemplate.queryForObject(
                "SELECT status FROM storage_units WITH (UPDLOCK, HOLDLOCK) WHERE id = ?", String.class, newUnit.getId());
        if (!(toEmergency ? StorageUnit.EMERGENCY : "AVAILABLE").equalsIgnoreCase(lockedStatus)) {
            throw new ContractException(HttpStatus.CONFLICT, "UNIT_NOT_AVAILABLE", "Ô " + newUnit.getId() + " không còn trống");
        }
        LocalDate[] range = (isRenewalReassign && effectiveRenewalMonths != null && effectiveRenewalMonths > 0)
                ? renewalRange(contract, effectiveRenewalMonths)
                : remainingRange(contract);
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
        if (isRenewalReassign) {
            contract.setReassignRequestStatus("ASSIGNED");
            if (effectiveRenewalMonths != null && effectiveRenewalMonths > 0) {
                contract.setReassignRequestedMonths(effectiveRenewalMonths);
            }
            contract.setReassignAssignedUnitId(newUnit.getId());
            contract.setReassignNote(reason);
            contract.setReassignResolvedAt(now);
        }
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

        // Vấn đề 6 (22/11/2026): khi ô cũ vào bảo trì (khách chuyển tạm sang ô khẩn cấp hoặc ô khác), tự động sinh task
        // MAINTENANCE nếu chưa có để nhân viên kỹ thuật theo dõi sửa chữa hoặc yêu cầu FM đổi ô chính thức khi sửa kéo dài.
        if (oldToMaintenance && staffTaskService != null) {
            staffTaskService.createMaintenanceTask(contract, "DAMAGE",
                    "Bảo trì khắc phục sự cố ô " + oldUnit.getId() + " (HĐ " + contract.getContractCode()
                            + " đã chuyển sang ô " + newUnit.getId() + (toEmergency ? " [khẩn cấp tạm thời]" : "") + "): " + reason);
        }
        // Nếu FM vừa chuyển khách sang ô mới theo yêu cầu từ task bảo trì hoặc task hỗ trợ → ghi nhận lên task và báo nhân viên
        try {
            jdbcTemplate.queryForList(
                    "SELECT id, staff_id, note, task_type FROM facility_tasks WHERE contract_id = ? AND task_type IN ('MAINTENANCE', 'SUPPORT') " +
                            "AND status IN ('OPEN','IN_PROGRESS','OVERDUE')",
                    contract.getId()).forEach(row -> {
                String note = row.get("note") != null ? String.valueOf(row.get("note")) : "";
                if (note.contains("[YÊU CẦU FM ĐỔI KHO CHO KHÁCH")) {
                    Integer tid = ((Number) row.get("id")).intValue();
                    String taskType = row.get("task_type") != null ? String.valueOf(row.get("task_type")) : "MAINTENANCE";
                    String label = "SUPPORT".equals(taskType) ? "task hỗ trợ" : "task bảo trì";
                    String updatedNote = truncate(note + " | [FM đã chuyển HĐ sang ô " + (toEmergency ? "khẩn cấp " : "tiêu chuẩn ") + newUnit.getId() + "]", 1000);
                    jdbcTemplate.update("UPDATE facility_tasks SET note = ? WHERE id = ?", updatedNote, tid);
                    if (row.get("staff_id") instanceof Number staffNum && notificationService != null) {
                        notificationService.notifyStaff(staffNum.intValue(),
                                "FM đã chuyển ô chính thức cho HĐ " + contract.getContractCode(),
                                "Quản lý đã chuyển HĐ " + contract.getContractCode() + " từ ô " + oldUnit.getId()
                                        + " sang ô " + (toEmergency ? "khẩn cấp " : "tiêu chuẩn ") + newUnit.getId() + " theo đề xuất từ " + label + " #" + tid + ".",
                                "TASK", "/staff/tasks/" + tid, true);
                    }
                }
            });
        } catch (Exception ignored) {
        }

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
            String moveHint = isRenewalReassign
                    ? "Quản lý đã gán ô kho mới theo yêu cầu gia hạn"
                      + (effectiveRenewalMonths != null ? " (+" + effectiveRenewalMonths + " tháng)" : "")
                      + " của bạn. Giá thuê và mã PIN giữ nguyên; bạn có thể vào mục Gia hạn hợp đồng để thanh toán ngay."
                    : toEmergency
                    ? "Đây là ô kho khẩn cấp tạm thời, giá thuê giữ nguyên; cơ sở sẽ chuyển bạn về ô đúng loại đã đặt khi có ô trống."
                    : "PENDING_CHECK_IN".equals(contract.getStatus())
                    ? "Lịch nhận kho giữ nguyên, bạn nhận ô mới khi tới cơ sở."
                    : "FACILITY_ISSUE".equals(reasonType)
                    ? "Cơ sở sẽ hỗ trợ chuyển hàng sang ô mới miễn phí, vui lòng liên hệ quầy để hẹn giờ."
                    : "Mã PIN giữ nguyên; vui lòng chuyển hàng sang ô mới theo lịch đã thống nhất với cơ sở.";
            notificationService.notifyCustomer(contract.getCustomer().getId(),
                    isRenewalReassign
                            ? "Đã gán ô kho mới " + newUnit.getId() + " để gia hạn HĐ " + contract.getContractCode()
                            : "Ô kho của hợp đồng " + contract.getContractCode() + " đã được chuyển",
                    "Hợp đồng được chuyển từ ô " + oldUnit.getId() + " sang ô " + newUnit.getId()
                            + " (tầng " + newUnit.getFloor() + ", khu " + newUnit.getZone() + ", phòng " + newUnit.getRoomNumber()
                            + "). Lý do: " + truncate(reason, 200) + ". " + moveHint,
                    "ASSIGNED",
                    reservation != null ? "/kho-cua-toi/hop-dong/" + reservation.getId() : "/kho-cua-toi");
        }

        if ("PENDING_CHECK_IN".equals(contract.getStatus())) {
            jdbcTemplate.queryForList(
                    "SELECT staff_id, id FROM facility_tasks WHERE contract_id = ? AND task_type = 'CHECK_IN' " +
                    "AND status IN ('OPEN','IN_PROGRESS','OVERDUE') AND staff_id IS NOT NULL",
                    contract.getId()).forEach(row -> notificationService.notifyStaff(
                    ((Number) row.get("staff_id")).intValue(),
                    "Ô bàn giao đã đổi cho task check-in",
                    "Hợp đồng " + contract.getContractCode() + " chuyển từ ô " + oldUnit.getId() + " sang ô " + newUnit.getId()
                            + ". Hãy kiểm tra ô mới trước khi lập biên bản.",
                    "ASSIGNED", "/staff/tasks/" + row.get("id")));
        }

        return toResponse(transfer, affected);
    }

    /**
     * Khách hàng gửi yêu cầu cho Quản lý (FM) gán lại ô kho mới cùng loại khi ô hiện tại gần hết hạn (< 3 ngày)
     * và đã có khách khác đặt trùng. Lưu kèm số tháng muốn gia hạn để FM so khớp lịch trống của các ô kho cùng loại.
     */
    @Transactional
    public Map<String, Object> requestRenewalReassign(Integer contractId, Integer customerId, Integer requestedMonths, String note) {
        RentalContract contract = findContract(contractId);
        if (contract.getCustomer() == null || !contract.getCustomer().getId().equals(customerId)) {
            throw new ContractException(HttpStatus.FORBIDDEN, "FORBIDDEN_CONTRACT", "Bạn không có quyền thao tác trên hợp đồng này");
        }
        String status = contract.getStatus() != null ? contract.getStatus().toUpperCase() : "";
        if (!List.of("ACTIVE", "TERMINATION_PENDING", "OVERDUE").contains(status)) {
            throw new ContractException(HttpStatus.CONFLICT, "CONTRACT_NOT_RENEWABLE",
                    "Hợp đồng đang ở trạng thái " + status + ", không thể gửi yêu cầu gán lại ô kho để gia hạn");
        }
        int months = requestedMonths != null ? requestedMonths : 1;
        if (!PricingService.PACKAGES.contains(months)) {
            throw new ContractException(HttpStatus.BAD_REQUEST, "INVALID_INPUT",
                    "Gói gia hạn không hợp lệ (chỉ chấp nhận 1, 3, 6 hoặc 12 tháng)");
        }
        String cleanNote = note != null && !note.isBlank() ? truncate(note.trim(), 500) : null;
        contract.setReassignRequestStatus("PENDING");
        contract.setReassignRequestedMonths(months);
        contract.setReassignRequestedAt(LocalDateTime.now());
        contract.setReassignAssignedUnitId(null);
        contract.setReassignNote(cleanNote);
        contract.setReassignResolvedAt(null);
        rentalContractRepository.save(contract);

        StorageUnit currentUnit = contract.getStorageUnit();
        UnitType booked = bookedType(contract);
        Integer facilityId = currentUnit != null && currentUnit.getFacility() != null ? currentUnit.getFacility().getId() : null;
        String customerName = contract.getCustomer().getFullName() != null ? contract.getCustomer().getFullName() : "Khách hàng";

        activityLogService.log(customerId,
                "[RENEWAL_REASSIGN_REQ] Khách " + customerName + " yêu cầu gán lại ô kho mới cùng loại ("
                        + (booked != null ? booked.getName() : "") + ") để gia hạn HĐ " + contract.getContractCode()
                        + " thêm +" + months + " tháng (ô hiện tại: " + (currentUnit != null ? currentUnit.getId() : "") + ")",
                "rental_contracts", String.valueOf(contract.getId()));

        if (facilityId != null && notificationService != null) {
            notificationService.notifyFacilityManagers(
                    facilityId,
                    "Yêu cầu gán lại ô kho để gia hạn — HĐ " + contract.getContractCode(),
                    "Khách hàng " + customerName + " (ô " + (currentUnit != null ? currentUnit.getId() : "") + " · "
                            + (booked != null ? booked.getName() : "") + ") muốn gia hạn thêm +" + months
                            + " tháng nhưng ô hiện tại gần hết hạn và đã có khách khác đặt trước. Vui lòng kiểm tra và gán ô mới cùng loại hoặc thông báo hết loại kho này.",
                    "ASSIGNED",
                    "/manager/contracts/" + contract.getId()
            );
        }

        return Map.of(
                "contractId", contract.getId(),
                "contractCode", contract.getContractCode(),
                "reassignRequestStatus", "PENDING",
                "reassignRequestedMonths", months,
                "message", "Đã gửi yêu cầu gán lại ô kho mới (gói +" + months + " tháng) cho Quản lý cơ sở."
        );
    }

    /**
     * Quản lý (FM) xác nhận đã hết ô kho cùng loại trong khoảng thời gian khách muốn gia hạn
     * → Thông báo cho khách phải đặt loại kho khác và hẹn trả kho hiện tại.
     */
    @Transactional
    public Map<String, Object> rejectRenewalReassign(Integer contractId, Integer managerId, String reason) {
        User manager = userRepository.findById(managerId)
                .orElseThrow(() -> new ContractException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "Không tìm thấy tài khoản"));
        RentalContract contract = findContract(contractId);
        StorageUnit currentUnit = contract.getStorageUnit();
        Integer facilityId = currentUnit != null && currentUnit.getFacility() != null ? currentUnit.getFacility().getId() : null;
        if (manager.getFacilityId() == null || !manager.getFacilityId().equals(facilityId)) {
            throw new ContractException(HttpStatus.FORBIDDEN, "FORBIDDEN_FACILITY", "Hợp đồng không thuộc cơ sở của bạn");
        }
        UnitType booked = bookedType(contract);
        String unitTypeName = booked != null ? booked.getName() : "cùng loại";
        Integer months = contract.getReassignRequestedMonths();
        String cleanReason = (reason != null && !reason.isBlank())
                ? truncate(reason.trim(), 500)
                : "Hiện cơ sở đã hết ô kho trống thuộc loại " + unitTypeName
                  + (months != null ? " trong khoảng thời gian gia hạn +" + months + " tháng" : "")
                  + ". Quý khách vui lòng đặt thuê loại kho khác và hẹn ngày trả ô kho hiện tại.";

        contract.setReassignRequestStatus("OUT_OF_STOCK");
        contract.setReassignNote(cleanReason);
        contract.setReassignResolvedAt(LocalDateTime.now());
        rentalContractRepository.save(contract);

        activityLogService.log(managerId,
                "[RENEWAL_REASSIGN_OUT_OF_STOCK] Báo hết ô cùng loại (" + unitTypeName + ") cho yêu cầu gia hạn HĐ "
                        + contract.getContractCode() + ": " + truncate(cleanReason, 300),
                "rental_contracts", String.valueOf(contract.getId()));

        Reservation reservation = contract.getReservation();
        if (contract.getCustomer() != null && notificationService != null) {
            notificationService.notifyCustomer(
                    contract.getCustomer().getId(),
                    "Thông báo hết loại kho " + unitTypeName + " để gia hạn — HĐ " + contract.getContractCode(),
                    "Quản lý cơ sở đã phản hồi yêu cầu gán lại ô kho mới của hợp đồng " + contract.getContractCode() + ": "
                            + cleanReason,
                    "WARNING",
                    reservation != null ? "/kho-cua-toi/hop-dong/" + reservation.getId() : "/kho-cua-toi"
            );
        }

        return Map.of(
                "contractId", contract.getId(),
                "contractCode", contract.getContractCode(),
                "reassignRequestStatus", "OUT_OF_STOCK",
                "reassignNote", cleanReason,
                "message", "Đã gửi thông báo hết loại kho " + unitTypeName + " cho khách hàng."
        );
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
