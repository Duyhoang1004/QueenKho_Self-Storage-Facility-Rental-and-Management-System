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
    private static final String RENEWABLE_STATUSES = "ACTIVE|TERMINATION_PENDING|OVERDUE";

    private final JdbcTemplate jdbcTemplate;

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

    // Ngày ô sắp trống giao được: đã hẹn trả → ngày hẹn + 1; điều khoản v4 → end_date + dọn ô; cũ → + ngày thanh lý + dọn ô
    private static final String RELEASE_DATE_SQL =
            "CASE WHEN c.status = 'TERMINATION_PENDING' " +
                    "            THEN DATEADD(DAY, 1, COALESCE((SELECT TOP 1 CAST(t.due_at AS DATE) FROM facility_tasks t " +
                    "                 WHERE t.contract_id = c.id AND t.task_type = 'CHECK_OUT' " +
                    "                   AND t.status IN ('OPEN', 'IN_PROGRESS', 'OVERDUE') ORDER BY t.id DESC), c.end_date)) " +
                    "       WHEN r.terms_version >= '" + LateFeeService.CENTRAL_STORAGE_TERMS_VERSION + "' " +
                    "            THEN DATEADD(DAY, " + CLEANUP_DAYS_AFTER_LIQUIDATION + ", c.end_date) " +
                    "       ELSE DATEADD(DAY, COALESCE(rp.liquidation_days, " + LateFeeService.DEFAULT_LIQUIDATION_DAYS + ") + "
                    + CLEANUP_DAYS_AFTER_LIQUIDATION + ", c.end_date) END";

    // Hợp đồng đang giữ ô OCCUPIED và đã "sắp trống": quá hạn / đã hẹn trả / ACTIVE đã qua hạn chót gia hạn ưu tiên.
    // Tham số: (1) hôm nay, (2) facility_id
    private static final String RELEASING_FROM_SQL =
            "FROM rental_contracts c " +
                    "JOIN storage_units su ON su.id = c.storage_unit_id " +
                    "LEFT JOIN reservations r ON r.id = c.reservation_id " +
                    "LEFT JOIN rental_policy rp ON rp.id = c.rental_policy_id " +
                    "WHERE su.status = 'OCCUPIED' AND c.end_date IS NOT NULL " +
                    "  AND (c.status IN ('OVERDUE', 'TERMINATION_PENDING') " +
                    "       OR (c.status = 'ACTIVE' AND DATEADD(DAY, -" + RENEWAL_NOTICE_DAYS + ", c.end_date) < ?)) " +
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

        boolean releasing = isReleasing(status, endDate, today);
        if (!releasing) {
            return new RenewalEligibilityResponse(contract.getId(), status, endDate, deadline, daysUntilDeadline,
                    "PRIORITY", true, false, null, packages);
        }

        String blocked = unitNeededByOthers(contract)
                ? "Đã quá hạn chót gia hạn ưu tiên (" + formatDate(deadline) + ") và ô kho này đã có khách khác đặt trước. "
                + "Vui lòng hẹn trả kho hoặc liên hệ cơ sở để chuyển sang ô khác."
                : null;
        return new RenewalEligibilityResponse(contract.getId(), status, endDate, deadline, daysUntilDeadline,
                "LATE", blocked == null, true, blocked, packages);
    }

    /** Gọi trước khi tạo link VNPAY gia hạn: chặn 409 RENEWAL_UNIT_RESERVED nếu ô đã có người cần */
    public void assertRenewable(RentalContract contract) {
        RenewalEligibilityResponse result = checkEligibility(contract);
        if ("LATE".equals(result.window()) && !result.renewable()) {
            throw new ContractException(HttpStatus.CONFLICT, "RENEWAL_UNIT_RESERVED", result.blockedReason());
        }
    }

    /**
     * Có đơn đang trông vào ô này không: số đơn đang giữ suất > ô trống + các ô sắp trống KHÁC.
     * Không xét ngày nhận của từng đơn (ước tính an toàn cho khách mới).
     */
    boolean unitNeededByOthers(RentalContract contract) {
        if (contract.getStorageUnit() == null || contract.getStorageUnit().getFacility() == null
                || contract.getStorageUnit().getUnitType() == null) {
            return false;
        }
        Integer facilityId = contract.getStorageUnit().getFacility().getId();
        Integer unitTypeId = contract.getStorageUnit().getUnitType().getId();
        int freeNow = freeSlotsNow(facilityId, unitTypeId);
        int otherReleasing = releaseDates(facilityId, unitTypeId, contract.getId()).size();
        return freeNow + otherReleasing < 0;
    }

    private static String formatDate(LocalDate date) {
        return date == null ? "—" : String.format("%02d/%02d/%d", date.getDayOfMonth(), date.getMonthValue(), date.getYear());
    }
}
