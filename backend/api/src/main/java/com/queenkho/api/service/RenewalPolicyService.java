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
import java.util.List;

/**
 * PR-R10 / PR-R11 — Gia hạn phải báo trước 3 ngày; quá mốc thì ô thành "sắp trống" và được bán trước cho khách khác.
 *
 *  end_date − 3 (hết ngày)  → hạn chót gia hạn ưu tiên. Trước mốc: gia hạn tự do.
 *  Sau mốc chưa gia hạn, hoặc đã hẹn trả kho (TERMINATION_PENDING), hoặc đã quá hạn (OVERDUE)
 *      → ô được tính là "sắp trống": đơn đặt mới cùng cơ sở + loại kho có ngày nhận ≥ ngày ô trống được nhận.
 *      → khách cũ chỉ còn gia hạn được nếu chưa có đơn nào cần tới ô này.
 *
 *  Ngày ô trống được nhận (ước tính an toàn, không đổi dữ liệu nào trong DB):
 *      ACTIVE / TERMINATION_PENDING : end_date + 6  (hết 5 ngày ân hạn dọn đồ PR-O1)
 *      OVERDUE                      : end_date + liquidation_days + 2 (FM thanh lý + 1 ngày dọn ô)
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
                "SELECT CASE WHEN c.status = 'OVERDUE' " +
                        "            THEN DATEADD(DAY, COALESCE(rp.liquidation_days, " + LateFeeService.DEFAULT_LIQUIDATION_DAYS + ") + "
                        + CLEANUP_DAYS_AFTER_LIQUIDATION + ", c.end_date) " +
                        "            ELSE DATEADD(DAY, " + GRACE_DAYS_AFTER_END + ", c.end_date) END AS release_date " +
                        "FROM rental_contracts c " +
                        "JOIN storage_units su ON su.id = c.storage_unit_id " +
                        "LEFT JOIN rental_policy rp ON rp.id = c.rental_policy_id " +
                        "WHERE su.facility_id = ? AND su.unit_type_id = ? AND su.status = 'OCCUPIED' AND c.end_date IS NOT NULL " +
                        "  AND (c.status IN ('OVERDUE', 'TERMINATION_PENDING') " +
                        "       OR (c.status = 'ACTIVE' AND DATEADD(DAY, -" + RENEWAL_NOTICE_DAYS + ", c.end_date) < ?)) " +
                        "  AND c.id <> ? " +
                        "ORDER BY release_date",
                (rs, i) -> rs.getDate("release_date").toLocalDate(),
                facilityId, unitTypeId, Date.valueOf(today()), excludeContractId != null ? excludeContractId : -1);
        return dates != null ? dates : List.of();
    }

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
