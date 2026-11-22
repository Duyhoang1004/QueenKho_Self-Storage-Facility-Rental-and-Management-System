package com.queenkho.api.service;

import com.queenkho.api.dto.RenewalEligibilityResponse;
import com.queenkho.api.entity.RentalContract;
import com.queenkho.api.exception.ContractException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Date;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * PR-R10 / PR-R11 — Gia hạn phải báo trước 3 ngày; quá mốc thì ô thành "sắp trống" và được bán trước cho khách khác.
 *
 *  end_date − 3 (hết ngày)  → hạn chót gia hạn ưu tiên. Trước mốc: gia hạn tự do.
 *  Sau mốc chưa gia hạn, hoặc đã hẹn trả kho (TERMINATION_PENDING), hoặc đã quá hạn (OVERDUE)
 *      → ô được tính là "sắp trống": đơn đặt mới cùng cơ sở + loại kho có ngày nhận ≥ ngày ô trống được nhận.
 *      → khách cũ chỉ còn gia hạn được nếu chưa có đơn nào cần tới ô này.
 *
 *  Ngày ô trống được nhận (ước tính an toàn, không đổi dữ liệu nào trong DB):
 *  (sửa 05/11/2026, D-15 — bỏ ân hạn 5 ngày; điều khoản v4: hết hạn là chuyển hàng vào kho tổng ngay)
 *      ACTIVE (qua mốc, chưa hẹn trả) / OVERDUE:
 *          điều khoản v4 : end_date + 2 (ngày end + 1 thanh lý + chuyển hàng vào kho tổng, end + 2 giao ô)
 *          điều khoản cũ : end_date + liquidation_days + 2 (FM thanh lý + 1 ngày dọn ô)
 *      TERMINATION_PENDING            : ngày hẹn trả + 1 (khách chỉ được dời lịch SỚM hơn nên ngày này không lùi ra sau).
 *                                       Không còn task CHECK_OUT → end_date + 1.
 */
@Service
public class RenewalPolicyService {

    public static final int RENEWAL_NOTICE_DAYS = 3;
    public static final int GRACE_DAYS_AFTER_END = 6;
    public static final int CLEANUP_DAYS_AFTER_LIQUIDATION = 2;
    /** Điều khoản v5: khách đặt trúng kho quá hạn phải hẹn ngày check-in nhận kho tối thiểu sau 3 ngày kể từ khi đặt */
    public static final int OVERDUE_UNIT_BOOKING_LEAD_DAYS = 3;
    /** Điều khoản v5: khách đặt kho đang thuê (gần hết hạn, quá mốc ưu tiên) nhận kho sớm nhất 7 ngày sau khi ô hết hạn */
    public static final int EXPIRING_ACTIVE_BOOKING_LEAD_DAYS = 7;
    private static final String RENEWABLE_STATUSES = "ACTIVE|TERMINATION_PENDING|OVERDUE";

    private final JdbcTemplate jdbcTemplate;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private UnitScheduleService unitScheduleService;

    public RenewalPolicyService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    private static LocalDate today() {
        return LocalDate.now(LateFeeService.VIETNAM_ZONE);
    }

    /** Hạn chót gia hạn ưu tiên = end_date − 3 ngày */
    public static LocalDate priorityDeadline(LocalDate endDate) {
        return endDate != null ? endDate.minusDays(RENEWAL_NOTICE_DAYS) : null;
    }

    /** Ô của hợp đồng này đang được tính "sắp trống" (đã qua mốc ưu tiên / đã hẹn trả / quá hạn) */
    public static boolean isReleasing(String status, LocalDate endDate, LocalDate today) {
        if (endDate == null || status == null) return false;
        String s = status.toUpperCase();
        if ("OVERDUE".equals(s) || "TERMINATION_PENDING".equals(s)) return true;
        return "ACTIVE".equals(s) && today.isAfter(priorityDeadline(endDate));
    }

    /**
     * Ngày ô "sắp trống" có thể giao cho khách mới, sắp tăng dần.
     * excludeContractId: bỏ qua chính hợp đồng đang xin gia hạn.
     */
    public List<LocalDate> releaseDates(Integer facilityId, Integer unitTypeId, Integer excludeContractId) {
        List<LocalDate> dates = jdbcTemplate.query(
                "SELECT " + RELEASE_DATE_SQL + " AS release_date " + RELEASING_FROM_SQL +
                        "  AND su.unit_type_id = ? AND c.id <> ? " +
                        "ORDER BY release_date",
                (rs, i) -> rs.getDate("release_date").toLocalDate(),
                Date.valueOf(today()), facilityId, unitTypeId, excludeContractId != null ? excludeContractId : -1);
        return dates != null ? dates : List.of();
    }

    /**
     * (08/11/2026) FM xem ô "sắp trống" trên sơ đồ / danh sách ô: mã ô → ngày ô trống được giao cho khách mới.
     * Cùng công thức với {@link #releaseDates} (PR-R11); ô không có trong map = không sắp trống.
     */
    public Map<String, LocalDate> releaseDatesByUnit(Integer facilityId) {
        Map<String, LocalDate> result = new HashMap<>();
        jdbcTemplate.query(
                "SELECT su.id AS unit_id, " + RELEASE_DATE_SQL + " AS release_date " + RELEASING_FROM_SQL,
                rs -> {
                    result.put(rs.getString("unit_id"), rs.getDate("release_date").toLocalDate());
                },
                Date.valueOf(today()), facilityId);
        return result;
    }

    // Ngày ô sắp trống giao được:
    //  - TERMINATION_PENDING: ngày hẹn trả + 1
    //  - OVERDUE / đang dọn kho sau cưỡng chế (LIQUIDATED): hôm nay + 3 ngày (tối thiểu 3 ngày sau khi đặt)
    //  - ACTIVE gần hết hạn (đã qua mốc ưu tiên): end_date + 7 ngày (7 ngày sau khi ô hết hạn)
    //  - Còn lại (PENDING_CHECK_IN...): end_date + ngày dọn ô
    static final String RELEASE_DATE_SQL =
            "CASE WHEN c.status = 'TERMINATION_PENDING' " +
                    "            THEN DATEADD(DAY, 1, COALESCE((SELECT TOP 1 CAST(t.due_at AS DATE) FROM facility_tasks t " +
                    "                 WHERE t.contract_id = c.id AND t.task_type = 'CHECK_OUT' " +
                    "                   AND t.status IN ('OPEN', 'IN_PROGRESS', 'OVERDUE') ORDER BY t.id DESC), c.end_date)) " +
                    "       WHEN c.status IN ('OVERDUE', 'LIQUIDATED') " +
                    "            THEN DATEADD(DAY, " + OVERDUE_UNIT_BOOKING_LEAD_DAYS + ", CAST(SYSDATETIME() AS DATE)) " +
                    "       WHEN c.status = 'ACTIVE' " +
                    "            THEN DATEADD(DAY, " + EXPIRING_ACTIVE_BOOKING_LEAD_DAYS + ", c.end_date) " +
                    "       ELSE DATEADD(DAY, " + CLEANUP_DAYS_AFTER_LIQUIDATION + ", c.end_date) END";

    // Hợp đồng đang giữ ô và đã "sắp trống": quá hạn / đã hẹn trả / ACTIVE đã qua hạn chót gia hạn ưu tiên / vừa cưỡng chế đang dọn ô.
    // Tham số: (1) hôm nay, (2) facility_id
    private static final String RELEASING_FROM_SQL =
            "FROM rental_contracts c " +
                    "JOIN storage_units su ON su.id = c.storage_unit_id " +
                    "LEFT JOIN reservations r ON r.id = c.reservation_id " +
                    "LEFT JOIN rental_policy rp ON rp.id = c.rental_policy_id " +
                    "WHERE su.is_emergency = 0 AND c.end_date IS NOT NULL " + // BR-140: ô khẩn cấp không bán trước
                    "  AND ((su.status = 'OCCUPIED' " +
                    "        AND (c.status IN ('OVERDUE', 'TERMINATION_PENDING') " +
                    "             OR (c.status = 'ACTIVE' AND DATEADD(DAY, -" + RENEWAL_NOTICE_DAYS + ", c.end_date) < ?))) " +
                    "       OR (su.status = 'MAINTENANCE' AND c.status = 'LIQUIDATED' " +
                    "           AND EXISTS (SELECT 1 FROM facility_tasks t WHERE t.contract_id = c.id " +
                    "                       AND t.task_type = 'MAINTENANCE' AND t.maintenance_reason = 'LIQUIDATION' " +
                    "                       AND t.status IN ('OPEN', 'IN_PROGRESS', 'OVERDUE')))) " +
                    "  AND su.facility_id = ? ";

    /** Số ô "sắp trống" mà đơn có ngày nhận startDate được phép tính vào (PR-R11) */
    public int countReleasingBy(Integer facilityId, Integer unitTypeId, LocalDate startDate) {
        if (startDate == null) return 0;
        return (int) releaseDates(facilityId, unitTypeId, null).stream().filter(d -> !d.isAfter(startDate)).count();
    }

    /** Ô AVAILABLE đúng loại − đơn đang giữ suất (đơn PENDING còn trong 15 phút + đơn đã cọc chưa gán ô) */
    public int freeSlotsNow(Integer facilityId, Integer unitTypeId) {
        Integer free = jdbcTemplate.queryForObject(
                "SELECT " +
                        "(SELECT COUNT(*) FROM storage_units WHERE facility_id = ? AND unit_type_id = ? AND status = 'AVAILABLE') - " +
                        "(SELECT COUNT(*) FROM reservations WHERE facility_id = ? AND unit_type_id = ? AND storage_unit_id IS NULL " +
                        "   AND (status = 'DEPOSIT_PAID' OR (status = 'PENDING' AND created_at > DATEADD(MINUTE, -15, SYSDATETIME()))))",
                Integer.class, facilityId, unitTypeId, facilityId, unitTypeId);
        return free != null ? free : 0;
    }

    /**
     * Ngày sớm nhất có suất cho đơn mới khi hiện không còn ô trống: lấy ô "sắp trống" thứ (số suất đang thiếu + 1).
     * null = không có ô sắp trống nào đủ cho đơn mới.
     */
    public LocalDate earliestSlotDate(Integer facilityId, Integer unitTypeId, int freeNow) {
        if (freeNow > 0) return null;
        List<LocalDate> dates = releaseDates(facilityId, unitTypeId, null);
        int index = -freeNow; // đã thiếu bao nhiêu suất thì phải bỏ qua bấy nhiêu ô sắp trống
        return index < dates.size() ? dates.get(index) : null;
    }

    // ================== GIA HẠN ==================

    @Transactional(readOnly = true)
    public RenewalEligibilityResponse checkEligibility(RentalContract contract) {
        LocalDate today = today();
        String status = contract.getStatus() != null ? contract.getStatus().toUpperCase() : "";
        LocalDate endDate = contract.getEndDate();
        LocalDate deadline = priorityDeadline(endDate);
        long daysUntilDeadline = deadline != null ? ChronoUnit.DAYS.between(today, deadline) : 0;
        List<RenewalEligibilityResponse.PackageEndDate> packages = new ArrayList<>();

        if (!status.matches(RENEWABLE_STATUSES)) {
            return new RenewalEligibilityResponse(contract.getId(), status, endDate, deadline, daysUntilDeadline,
                    "CLOSED", false, false, "Hợp đồng đang ở trạng thái " + status + ", không thể gia hạn.", packages);
        }

        // BR-82 / PR-R3: còn hạn thì nối tiếp end_date; đã quá hạn hoặc đang hẹn trả kho thì tính từ hôm nay
        LocalDate base = "TERMINATION_PENDING".equals(status) || endDate == null || endDate.isBefore(today) ? today : endDate;
        for (Integer months : PricingService.PACKAGES) {
            packages.add(new RenewalEligibilityResponse.PackageEndDate(months, base.plusMonths(months)));
        }

        String reassignStatus = contract.getReassignRequestStatus();
        Integer reassignMonths = contract.getReassignRequestedMonths();
        String reassignUnitId = contract.getReassignAssignedUnitId();
        String reassignNote = contract.getReassignNote();
        LocalDate freeUntil = nextBookingStartOnUnit(contract);

        List<Integer> fitsOnUnit = packages.stream()
                .filter(p -> freeUntil == null || !p.newEndDate().plusDays(CLEANUP_DAYS_AFTER_LIQUIDATION).isAfter(freeUntil))
                .map(RenewalEligibilityResponse.PackageEndDate::months)
                .toList();

        boolean releasing = isReleasing(status, endDate, today);
        if (!releasing) {
            boolean canRenewInPriority = !fitsOnUnit.isEmpty();
            String priorityBlocked = canRenewInPriority ? null
                    : "Ô kho này đã có lịch nhận kho của khách khác từ ngày " + formatDate(freeUntil)
                    + ". Vui lòng gửi yêu cầu để Quản lý gán sang ô kho mới cùng loại.";
            return new RenewalEligibilityResponse(contract.getId(), status, endDate, deadline, daysUntilDeadline,
                    "PRIORITY", canRenewInPriority, false, priorityBlocked, packages,
                    reassignStatus, reassignMonths, reassignUnitId, reassignNote, freeUntil, fitsOnUnit);
        }

        boolean isAssignedNewUnit = "ASSIGNED".equalsIgnoreCase(reassignStatus)
                && contract.getStorageUnit() != null
                && contract.getStorageUnit().getId() != null
                && contract.getStorageUnit().getId().equals(reassignUnitId);

        if ("OUT_OF_STOCK".equalsIgnoreCase(reassignStatus)) {
            String msg = "Quản lý cơ sở đã kiểm tra: hiện không còn ô kho trống cùng loại trong khoảng thời gian quý khách yêu cầu gia hạn"
                    + (reassignMonths != null ? " (+" + reassignMonths + " tháng)" : "")
                    + ". Quý khách vui lòng đặt đơn mới với loại kho khác và hẹn trả ô kho hiện tại.";
            return new RenewalEligibilityResponse(contract.getId(), status, endDate, deadline, daysUntilDeadline,
                    "LATE", false, true, msg, packages,
                    reassignStatus, reassignMonths, reassignUnitId, reassignNote, freeUntil, List.of());
        }

        if (isAssignedNewUnit) {
            boolean poolStillTight = unitNeededByOthers(contract);
            List<Integer> allowedPackages = fitsOnUnit.stream()
                    .filter(m -> !poolStillTight || reassignMonths == null || m <= reassignMonths)
                    .toList();
            boolean ok = !allowedPackages.isEmpty();
            String msg = ok ? null
                    : "Ô kho mới " + reassignUnitId + " không đủ khoảng trống cho gói gia hạn. Vui lòng gửi yêu cầu gán ô khác hoặc hẹn trả kho.";
            return new RenewalEligibilityResponse(contract.getId(), status, endDate, deadline, daysUntilDeadline,
                    "LATE", ok, true, msg, packages,
                    reassignStatus, reassignMonths, reassignUnitId, reassignNote, freeUntil, allowedPackages);
        }

        boolean poolNeedsUnit = unitNeededByOthers(contract);
        boolean unitHasFutureBooking = freeUntil != null;
        if (poolNeedsUnit || unitHasFutureBooking) {
            String blocked = "Đã quá hạn chót gia hạn ưu tiên (" + formatDate(deadline) + ") và ô kho này đã có khách khác đặt trước"
                    + (freeUntil != null ? " (nhận kho ngày " + formatDate(freeUntil) + ")" : "")
                    + ". Vui lòng gửi yêu cầu để Quản lý gán lại ô kho mới cùng loại hoặc hẹn trả kho.";
            return new RenewalEligibilityResponse(contract.getId(), status, endDate, deadline, daysUntilDeadline,
                    "LATE", false, true, blocked, packages,
                    reassignStatus, reassignMonths, reassignUnitId, reassignNote, freeUntil, List.of());
        }

        return new RenewalEligibilityResponse(contract.getId(), status, endDate, deadline, daysUntilDeadline,
                "LATE", true, true, null, packages,
                reassignStatus, reassignMonths, reassignUnitId, reassignNote, freeUntil, fitsOnUnit);
    }

    private LocalDate nextBookingStartOnUnit(RentalContract contract) {
        if (unitScheduleService == null || contract == null
                || contract.getStorageUnit() == null || contract.getStorageUnit().getId() == null) {
            return null;
        }
        LocalDate today = today();
        return unitScheduleService.bookingsOfUnit(contract.getStorageUnit().getId()).stream()
                .filter(b -> contract.getId() == null || !contract.getId().equals(b.contractId()))
                .map(UnitScheduleService.Booking::startDate)
                .filter(d -> d != null && d.isAfter(today))
                .min(LocalDate::compareTo)
                .orElse(null);
    }

    /** Gọi trước khi tạo link VNPAY gia hạn: chặn 409 RENEWAL_UNIT_RESERVED nếu ô đã có người cần */
    public void assertRenewable(RentalContract contract) {
        RenewalEligibilityResponse result = checkEligibility(contract);
        if ("LATE".equals(result.window()) && !result.renewable()) {
            throw new ContractException(HttpStatus.CONFLICT, "RENEWAL_UNIT_RESERVED", result.blockedReason());
        }
    }

    /** Kiểm tra gia hạn theo đúng gói số tháng khách chọn (xét khoảng trống trên ô kho hiện tại / ô mới vừa gán) */
    public void assertRenewableForMonths(RentalContract contract, Integer months) {
        RenewalEligibilityResponse result = checkEligibility(contract);
        if (!result.renewable()) {
            throw new ContractException(HttpStatus.CONFLICT, "RENEWAL_UNIT_RESERVED",
                    result.blockedReason() != null ? result.blockedReason() : "Ô kho đã có khách khác đặt trước, không thể gia hạn.");
        }
        if (months != null && result.renewablePackages() != null && !result.renewablePackages().contains(months)) {
            String msg = result.currentUnitFreeUntil() != null
                    ? "Ô kho hiện tại chỉ trống đến ngày " + formatDate(result.currentUnitFreeUntil())
                      + " (đã có khách khác đặt nhận kho sau đó), không đủ cho gói +" + months + " tháng. Vui lòng chọn gói ngắn hơn hoặc gửi yêu cầu để Quản lý gán lại ô kho mới."
                    : "Gói gia hạn +" + months + " tháng vượt quá thời hạn đã được duyệt gán ô. Vui lòng chọn gói đã duyệt hoặc gửi yêu cầu gán lại ô kho mới cho gói +" + months + " tháng.";
            throw new ContractException(HttpStatus.CONFLICT, "RENEWAL_UNIT_RESERVED", msg);
        }
    }

    /**
     * Có đơn đang trông vào ô này không: số đơn đang giữ suất > ô trống + các ô sắp trống KHÁC.
     * Nếu có UnitScheduleService, xét thêm trường hợp đơn giữ suất có thời hạn dài bắt buộc phải lấy ô sắp trống này
     * (vì các ô AVAILABLE khác đã có hợp đồng tương lai chặn sau đó).
     */
    boolean unitNeededByOthers(RentalContract contract) {
        if (contract.getStorageUnit() == null || contract.getStorageUnit().getFacility() == null
                || contract.getStorageUnit().getUnitType() == null) {
            return false;
        }
        // Vấn đề 6 / BR-140: ô khẩn cấp không mở bán cho đơn đặt mới → không bao giờ bị đơn giữ suất thương mại chiếm;
        // khách đang lưu tạm ở ô khẩn cấp vẫn gia hạn hợp đồng bình thường, việc chuyển ô do Staff/FM xử lý ở task MAINTENANCE.
        if (contract.getStorageUnit().isEmergencyUnit()) {
            return false;
        }
        Integer facilityId = contract.getStorageUnit().getFacility().getId();
        Integer unitTypeId = contract.getStorageUnit().getUnitType().getId();
        int freeNow = freeSlotsNow(facilityId, unitTypeId);
        int otherReleasing = releaseDates(facilityId, unitTypeId, contract.getId()).size();
        if (freeNow + otherReleasing < 0) {
            return true;
        }
        if (unitScheduleService != null && contract.getStorageUnit().getId() != null) {
            List<Map<String, Object>> holdRows = jdbcTemplate.queryForList(
                    "SELECT start_date, duration_months FROM reservations " +
                            "WHERE facility_id = ? AND unit_type_id = ? AND storage_unit_id IS NULL " +
                            "  AND (status = 'DEPOSIT_PAID' OR (status = 'PENDING' AND created_at > DATEADD(MINUTE, -15, SYSDATETIME())))",
                    facilityId, unitTypeId);
            if (holdRows != null) {
                for (Map<String, Object> row : holdRows) {
                    LocalDate s = row.get("start_date") instanceof Date d ? d.toLocalDate() : null;
                    int m = row.get("duration_months") instanceof Number n ? Math.max(n.intValue(), 1) : 1;
                    if (s != null && unitScheduleService.freeSlots(facilityId, unitTypeId, s, m) <= 0) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    private static String formatDate(LocalDate date) {
        return date == null ? "—" : String.format("%02d/%02d/%d", date.getDayOfMonth(), date.getMonthValue(), date.getYear());
    }
}
