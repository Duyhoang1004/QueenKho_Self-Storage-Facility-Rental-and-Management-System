package com.queenkho.api.service;

import com.queenkho.api.dto.bom.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * UC-29 — BOM Revenue Dashboard Service
 *
 * Tất cả số liệu tài chính tuân theo quy tắc PR-M7:
 *  - Doanh thu = tổng giao dịch status = 'SUCCESS' trong kỳ
 *  - DEPOSIT và MONTHLY_RENT ➔ rentalRevenue
 *  - LATE_FEE và DAMAGE_FEE  ➔ feesRevenue
 *  - REFUND                  ➔ refundDisbursed (âm với doanh thu ròng)
 *  - Quỹ cọc đang giữ         = deposit_held_amount của HĐ đang ACTIVE / OVERDUE / TERMINATION_PENDING
 */
@Service
public class BomRevenueService {

    @Autowired
    private JdbcTemplate jdbc;

    // ─────────────────────────────────────────────────────────────
    // 1. OVERVIEW — 8 KPI tài chính tổng quan
    // ─────────────────────────────────────────────────────────────

    public RevenueOverviewResponse getOverview(Integer facilityId, String period,
                                               Integer year, Integer month, Integer quarter) {
        String dateFilter   = buildDateFilter(period, year, month, quarter, "p.paid_at");
        String facilityJoin = buildFacilityJoin(facilityId);
        String facilityWhere = facilityId != null ? " AND f.id = " + facilityId : "";

        BigDecimal rentalRevenue = querySum(
                "SELECT COALESCE(SUM(p.amount), 0) FROM payment_transactions p"
                        + facilityJoin
                        + " WHERE p.status = 'SUCCESS'"
                        + " AND p.payment_type IN ('DEPOSIT','MONTHLY_RENT')"
                        + dateFilter + facilityWhere);

        BigDecimal feesRevenue = querySum(
                "SELECT COALESCE(SUM(p.amount), 0) FROM payment_transactions p"
                        + facilityJoin
                        + " WHERE p.status = 'SUCCESS'"
                        + " AND p.payment_type IN ('LATE_FEE','DAMAGE_FEE')"
                        + dateFilter + facilityWhere);

        BigDecimal refundDisbursed = querySum(
                "SELECT COALESCE(SUM(p.amount), 0) FROM payment_transactions p"
                        + facilityJoin
                        + " WHERE p.status = 'SUCCESS'"
                        + " AND p.payment_type = 'REFUND'"
                        + dateFilter + facilityWhere);

        // Quỹ cọc: tính theo trạng thái HĐ, không phụ thuộc kỳ lọc
        String depositWhere = facilityId != null
                ? " AND su.facility_id = " + facilityId
                : "";
        BigDecimal depositsHeld = querySum(
                "SELECT COALESCE(SUM(rc.deposit_held_amount), 0)"
                        + " FROM rental_contracts rc"
                        + " JOIN storage_units su ON su.id = rc.storage_unit_id"
                        + " WHERE rc.status IN ('ACTIVE','OVERDUE','TERMINATION_PENDING')"
                        + depositWhere);

        BigDecimal netRevenue = rentalRevenue.add(feesRevenue).subtract(refundDisbursed);

        long rentalCount = queryCount(
                "SELECT COUNT(*) FROM payment_transactions p"
                        + facilityJoin
                        + " WHERE p.status = 'SUCCESS'"
                        + " AND p.payment_type IN ('DEPOSIT','MONTHLY_RENT','LATE_FEE','DAMAGE_FEE')"
                        + dateFilter + facilityWhere);

        long refundCount = queryCount(
                "SELECT COUNT(*) FROM payment_transactions p"
                        + facilityJoin
                        + " WHERE p.status = 'SUCCESS'"
                        + " AND p.payment_type = 'REFUND'"
                        + dateFilter + facilityWhere);

        // Tăng trưởng so với kỳ trước cùng loại
        double growthRate = calcGrowthRate(netRevenue, facilityId, period, year, month, quarter);

        return RevenueOverviewResponse.builder()
                .rentalRevenue(rentalRevenue)
                .feesRevenue(feesRevenue)
                .refundDisbursed(refundDisbursed)
                .depositsHeld(depositsHeld)
                .netRevenue(netRevenue)
                .growthRate(growthRate)
                .rentalCount(rentalCount)
                .refundCount(refundCount)
                .build();
    }

    // ─────────────────────────────────────────────────────────────
    // 2. TIMELINE — Biểu đồ doanh thu 12 tháng theo năm
    // ─────────────────────────────────────────────────────────────

    public List<RevenueTimelineResponse> getTimeline(Integer facilityId, Integer year) {
        String facilityJoin  = buildFacilityJoin(facilityId);
        String facilityWhere = facilityId != null ? " AND f.id = " + facilityId : "";
        int targetYear = (year != null) ? year : LocalDate.now().getYear();

        String sql =
                "SELECT MONTH(p.paid_at) AS m,"
                + " COALESCE(SUM(CASE WHEN p.payment_type IN ('DEPOSIT','MONTHLY_RENT') THEN p.amount ELSE 0 END), 0) AS rent,"
                + " COALESCE(SUM(CASE WHEN p.payment_type IN ('LATE_FEE','DAMAGE_FEE')  THEN p.amount ELSE 0 END), 0) AS fees,"
                + " COALESCE(SUM(CASE WHEN p.payment_type = 'REFUND'                    THEN p.amount ELSE 0 END), 0) AS refund"
                + " FROM payment_transactions p"
                + facilityJoin
                + " WHERE p.status = 'SUCCESS'"
                + " AND YEAR(p.paid_at) = " + targetYear
                + facilityWhere
                + " GROUP BY MONTH(p.paid_at)"
                + " ORDER BY MONTH(p.paid_at)";

        List<Map<String, Object>> rows = jdbc.queryForList(sql);

        // Đảm bảo luôn trả đủ 12 tháng (tháng chưa có dữ liệu = 0)
        BigDecimal[] rents   = new BigDecimal[12];
        BigDecimal[] fees    = new BigDecimal[12];
        BigDecimal[] refunds = new BigDecimal[12];
        for (int i = 0; i < 12; i++) {
            rents[i] = refunds[i] = fees[i] = BigDecimal.ZERO;
        }
        for (Map<String, Object> row : rows) {
            int m = ((Number) row.get("m")).intValue() - 1;
            if (m >= 0 && m < 12) {
                rents[m]   = toBD(row.get("rent"));
                fees[m]    = toBD(row.get("fees"));
                refunds[m] = toBD(row.get("refund"));
            }
        }

        int currentMonth = (targetYear == LocalDate.now().getYear()) ? LocalDate.now().getMonthValue() : 12;
        List<RevenueTimelineResponse> result = new ArrayList<>();
        for (int i = 0; i < 12; i++) {
            String label = "T" + (i + 1) + (i + 1 > currentMonth ? " (DK)" : "");
            result.add(RevenueTimelineResponse.builder()
                    .label(label)
                    .rent(rents[i])
                    .fees(fees[i])
                    .refund(refunds[i])
                    .build());
        }
        return result;
    }

    // ─────────────────────────────────────────────────────────────
    // 3. BY-FACILITY — Doanh thu phân bổ theo cơ sở
    // ─────────────────────────────────────────────────────────────

    public List<FacilityRevenueResponse> getByFacility(Integer year) {
        int y = (year != null) ? year : LocalDate.now().getYear();

        // Sử dụng subquery để tránh nhân bản tích Đề-các (Cartesian product)
        String sql =
                "SELECT f.id AS fid, f.name AS fname,"
                + " COALESCE(("
                + "   SELECT SUM(CASE WHEN p.payment_type IN ('DEPOSIT','MONTHLY_RENT','LATE_FEE','DAMAGE_FEE') THEN p.amount"
                + "                   WHEN p.payment_type = 'REFUND' THEN -p.amount ELSE 0 END)"
                + "   FROM payment_transactions p"
                + "   LEFT JOIN reservations res ON res.id = p.reservation_id"
                + "   LEFT JOIN rental_contracts rc2 ON rc2.id = p.contract_id"
                + "   LEFT JOIN storage_units su2 ON su2.id = rc2.storage_unit_id"
                + "   WHERE (res.facility_id = f.id OR su2.facility_id = f.id)"
                + "     AND p.status = 'SUCCESS' AND YEAR(p.paid_at) = ?"
                + " ), 0) AS revenue,"
                + " (SELECT COUNT(DISTINCT rc.id)"
                + "  FROM rental_contracts rc"
                + "  JOIN storage_units su ON su.id = rc.storage_unit_id"
                + "  WHERE su.facility_id = f.id AND rc.status IN ('ACTIVE','OVERDUE')) AS activeUnits,"
                + " (SELECT COUNT(*)"
                + "  FROM storage_units su"
                + "  WHERE su.facility_id = f.id AND su.status <> 'MAINTENANCE') AS totalOperational"
                + " FROM facilities f"
                + " WHERE f.status = 'ACTIVE'"
                + " ORDER BY revenue DESC";

        List<Map<String, Object>> rows = jdbc.queryForList(sql, y);

        BigDecimal totalRevenue = rows.stream()
                .map(r -> toBD(r.get("revenue")))
                .filter(v -> v.compareTo(BigDecimal.ZERO) > 0)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        List<FacilityRevenueResponse> result = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            BigDecimal rev    = toBD(row.get("revenue"));
            int activeUnits   = ((Number) row.get("activeUnits")).intValue();
            int totalOp       = ((Number) row.get("totalOperational")).intValue();
            double occupancy  = totalOp > 0 ? (activeUnits * 100.0 / totalOp) : 0.0;
            double pct        = totalRevenue.compareTo(BigDecimal.ZERO) > 0
                    ? rev.multiply(BigDecimal.valueOf(100)).divide(totalRevenue, 1, RoundingMode.HALF_UP).doubleValue()
                    : 0.0;

            result.add(FacilityRevenueResponse.builder()
                    .facilityId(((Number) row.get("fid")).intValue())
                    .facilityName((String) row.get("fname"))
                    .revenue(rev)
                    .percentage(pct)
                    .activeUnits(activeUnits)
                    .occupancyRate(round1(occupancy))
                    .build());
        }
        return result;
    }

    // ─────────────────────────────────────────────────────────────
    // 4. BY-UNIT-TYPE — Doanh thu phân bổ theo loại khoang
    // ─────────────────────────────────────────────────────────────

    public List<UnitTypeRevenueResponse> getByUnitType(Integer facilityId) {
        String facFilter = (facilityId != null)
                ? " AND COALESCE(su.facility_id, res.facility_id) = " + facilityId
                : "";

        String sql =
                "SELECT ut.id AS tid, ut.name AS tname,"
                + " COALESCE(("
                + "   SELECT SUM(p.amount)"
                + "   FROM payment_transactions p"
                + "   LEFT JOIN rental_contracts rc ON rc.id = p.contract_id"
                + "   LEFT JOIN storage_units su ON su.id = rc.storage_unit_id"
                + "   LEFT JOIN reservations res ON res.id = p.reservation_id"
                + "   WHERE COALESCE(su.unit_type_id, res.unit_type_id) = ut.id"
                + "     AND p.status = 'SUCCESS' AND p.payment_type IN ('DEPOSIT','MONTHLY_RENT')"
                +       facFilter
                + " ), 0) AS revenue,"
                + " (SELECT COUNT(DISTINCT rc.id)"
                + "  FROM rental_contracts rc"
                + "  JOIN storage_units su ON su.id = rc.storage_unit_id"
                + "  WHERE su.unit_type_id = ut.id AND rc.status IN ('ACTIVE','OVERDUE')"
                +       (facilityId != null ? " AND su.facility_id = " + facilityId : "")
                + " ) AS totalRented"
                + " FROM unit_types ut"
                + " ORDER BY revenue DESC";

        List<Map<String, Object>> rows = jdbc.queryForList(sql);

        BigDecimal totalRevenue = rows.stream()
                .map(r -> toBD(r.get("revenue")))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        List<UnitTypeRevenueResponse> result = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            BigDecimal rev = toBD(row.get("revenue"));
            double pct     = totalRevenue.compareTo(BigDecimal.ZERO) > 0
                    ? rev.multiply(BigDecimal.valueOf(100)).divide(totalRevenue, 1, RoundingMode.HALF_UP).doubleValue()
                    : 0.0;

            result.add(UnitTypeRevenueResponse.builder()
                    .typeId(((Number) row.get("tid")).intValue())
                    .typeName((String) row.get("tname"))
                    .revenue(rev)
                    .percentage(pct)
                    .totalRented(((Number) row.get("totalRented")).intValue())
                    .build());
        }
        return result;
    }

    // ─────────────────────────────────────────────────────────────
    // 5. TRANSACTIONS — Bảng đối soát giao dịch (PR-O15, PR-M7)
    // ─────────────────────────────────────────────────────────────

    public List<RevenueTransactionResponse> getTransactions(Integer facilityId, String paymentType) {
        StringBuilder sql = new StringBuilder(
                "SELECT TOP 200 p.id, p.transaction_code, p.paid_at,"
                + " u.full_name AS customerName, u.phone AS customerPhone,"
                + " COALESCE(f.name, N'Hệ thống') AS facilityName,"
                + " rc.contract_code,"
                + " p.payment_type, p.payment_method,"
                + " p.transaction_code AS bank_transaction_code,"
                + " p.amount, p.status,"
                + " ft.evidence_image_url,"
                + " ft.note"
                + " FROM payment_transactions p"
                + " JOIN users u ON u.id = p.user_id"
                + " LEFT JOIN reservations res ON res.id = p.reservation_id"
                + " LEFT JOIN rental_contracts rc ON rc.id = p.contract_id"
                + " LEFT JOIN storage_units su ON su.id = rc.storage_unit_id"
                + " LEFT JOIN facilities f ON (f.id = res.facility_id OR f.id = su.facility_id)"
                + " LEFT JOIN facility_tasks ft ON ft.id = ("
                + "   SELECT TOP 1 ft2.id FROM facility_tasks ft2"
                + "   WHERE (ft2.contract_id = p.contract_id"
                + "          OR (res.reservation_code IS NOT NULL AND ft2.note LIKE '%' + res.reservation_code + '%'))"
                + "     AND ft2.evidence_image_url IS NOT NULL"
                + "   ORDER BY ft2.id DESC"
                + " )"
                + " WHERE p.status = 'SUCCESS'");

        List<Object> args = new ArrayList<>();
        if (facilityId != null) {
            sql.append(" AND f.id = ?");
            args.add(facilityId);
        }
        if (paymentType != null && !paymentType.isBlank()) {
            sql.append(" AND p.payment_type = ?");
            args.add(paymentType.trim().toUpperCase());
        }
        sql.append(" ORDER BY p.paid_at DESC");

        List<Map<String, Object>> rows = jdbc.queryForList(sql.toString(), args.toArray());
        List<RevenueTransactionResponse> result = new ArrayList<>();

        for (Map<String, Object> row : rows) {
            result.add(RevenueTransactionResponse.builder()
                    .id(((Number) row.get("id")).intValue())
                    .txnRef((String) row.get("transaction_code"))
                    .paidAt(toLocalDateTime(row.get("paid_at")))
                    .customerName((String) row.get("customerName"))
                    .customerPhone((String) row.get("customerPhone"))
                    .facilityName((String) row.get("facilityName"))
                    .contractCode((String) row.get("contract_code"))
                    .paymentType((String) row.get("payment_type"))
                    .paymentMethod((String) row.get("payment_method"))
                    .bankTxnCode((String) row.get("bank_transaction_code"))
                    .amount(toBD(row.get("amount")))
                    .status((String) row.get("status"))
                    .evidenceUrl((String) row.get("evidence_image_url"))
                    .note((String) row.get("note"))
                    .build());
        }
        return result;
    }

    // ─────────────────────────────────────────────────────────────
    // 6. OCCUPANCY — Báo cáo tỷ lệ lấp đầy & biến động hợp đồng
    // ─────────────────────────────────────────────────────────────

    public OccupancyReportResponse getOccupancy(Integer facilityId) {
        // 1. Tổng số ô kho
        int totalUnits = facilityId != null
                ? queryCountInt("SELECT COUNT(*) FROM storage_units su WHERE su.facility_id = ?", facilityId)
                : queryCountInt("SELECT COUNT(*) FROM storage_units su");

        // 2. Số ô đang cho thuê (status OCCUPIED hoặc có HĐ ACTIVE/OVERDUE)
        int occupiedUnits = facilityId != null
                ? queryCountInt(
                        "SELECT COUNT(DISTINCT rc.storage_unit_id) FROM rental_contracts rc"
                        + " JOIN storage_units su ON su.id = rc.storage_unit_id"
                        + " WHERE su.facility_id = ? AND rc.status IN ('ACTIVE','OVERDUE')", facilityId)
                : queryCountInt(
                        "SELECT COUNT(DISTINCT rc.storage_unit_id) FROM rental_contracts rc"
                        + " WHERE rc.status IN ('ACTIVE','OVERDUE')");

        // 3. Số ô đang bảo trì
        int maintenanceUnits = facilityId != null
                ? queryCountInt("SELECT COUNT(*) FROM storage_units su WHERE su.facility_id = ? AND su.status = 'MAINTENANCE'", facilityId)
                : queryCountInt("SELECT COUNT(*) FROM storage_units su WHERE su.status = 'MAINTENANCE'");

        int availableUnits = Math.max(0, totalUnits - occupiedUnits - maintenanceUnits);
        int operationalUnits = totalUnits - maintenanceUnits;
        double occupancyRate = operationalUnits > 0
                ? round1(occupiedUnits * 100.0 / operationalUnits) : 0.0;

        // 4. HĐ mới trong tháng hiện tại (dùng start_date, KHÔNG dùng created_at vì bảng rental_contracts không có)
        int currentYear = LocalDate.now().getYear();
        int currentMonth = LocalDate.now().getMonthValue();
        int newContracts = facilityId != null
                ? queryCountInt(
                        "SELECT COUNT(*) FROM rental_contracts rc"
                        + " JOIN storage_units su ON su.id = rc.storage_unit_id"
                        + " WHERE su.facility_id = ? AND YEAR(rc.start_date) = ? AND MONTH(rc.start_date) = ?",
                        facilityId, currentYear, currentMonth)
                : queryCountInt(
                        "SELECT COUNT(*) FROM rental_contracts rc"
                        + " WHERE YEAR(rc.start_date) = ? AND MONTH(rc.start_date) = ?",
                        currentYear, currentMonth);

        // 5. HĐ kết thúc trong tháng (dùng end_date, KHÔNG dùng updated_at vì bảng rental_contracts không có)
        int terminatedContracts = facilityId != null
                ? queryCountInt(
                        "SELECT COUNT(*) FROM rental_contracts rc"
                        + " JOIN storage_units su ON su.id = rc.storage_unit_id"
                        + " WHERE su.facility_id = ? AND rc.status IN ('TERMINATED','LIQUIDATED')"
                        + " AND rc.end_date IS NOT NULL AND YEAR(rc.end_date) = ? AND MONTH(rc.end_date) = ?",
                        facilityId, currentYear, currentMonth)
                : queryCountInt(
                        "SELECT COUNT(*) FROM rental_contracts rc"
                        + " WHERE rc.status IN ('TERMINATED','LIQUIDATED')"
                        + " AND rc.end_date IS NOT NULL AND YEAR(rc.end_date) = ? AND MONTH(rc.end_date) = ?",
                        currentYear, currentMonth);

        // 6. Tỷ lệ tái ký (gia hạn / (gia hạn + kết thúc)): Dựa vào activity_logs ghi nhận RENEW
        int renewedContracts = facilityId != null
                ? queryCountInt(
                        "SELECT COUNT(DISTINCT al.target_id) FROM activity_logs al"
                        + " JOIN rental_contracts rc ON rc.id = TRY_CAST(al.target_id AS INT)"
                        + " JOIN storage_units su ON su.id = rc.storage_unit_id"
                        + " WHERE su.facility_id = ? AND al.target_entity = 'rental_contracts'"
                        + " AND (al.action LIKE '[RENEW]%' OR al.action LIKE N'%Gia hạn%')"
                        + " AND YEAR(al.created_at) = ? AND MONTH(al.created_at) = ?",
                        facilityId, currentYear, currentMonth)
                : queryCountInt(
                        "SELECT COUNT(DISTINCT al.target_id) FROM activity_logs al"
                        + " WHERE al.target_entity = 'rental_contracts'"
                        + " AND (al.action LIKE '[RENEW]%' OR al.action LIKE N'%Gia hạn%')"
                        + " AND YEAR(al.created_at) = ? AND MONTH(al.created_at) = ?",
                        currentYear, currentMonth);

        long totalDecisions = (long) renewedContracts + terminatedContracts;
        double retentionRate = totalDecisions > 0
                ? round1(renewedContracts * 100.0 / totalDecisions)
                : 0.0;

        return OccupancyReportResponse.builder()
                .totalUnits(totalUnits)
                .occupiedUnits(occupiedUnits)
                .availableUnits(availableUnits)
                .maintenanceUnits(maintenanceUnits)
                .occupancyRate(occupancyRate)
                .newContracts(newContracts)
                .terminatedContracts(terminatedContracts)
                .retentionRate(retentionRate)
                .build();
    }

    // ─────────────────────────────────────────────────────────────
    // PRIVATE HELPERS
    // ─────────────────────────────────────────────────────────────

    /** Tạo JOIN với bảng facilities qua reservation hoặc contract */
    private String buildFacilityJoin(Integer facilityId) {
        if (facilityId == null) return "";
        return " LEFT JOIN reservations res ON res.id = p.reservation_id"
                + " LEFT JOIN rental_contracts rc2 ON rc2.id = p.contract_id"
                + " LEFT JOIN storage_units su2 ON su2.id = rc2.storage_unit_id"
                + " JOIN facilities f ON (f.id = res.facility_id OR f.id = su2.facility_id)";
    }

    /** Điều kiện lọc theo kỳ báo cáo (tháng / quý / năm) */
    private String buildDateFilter(String period, Integer year, Integer month, Integer quarter, String col) {
        if (year == null) return "";
        switch (period == null ? "YEAR" : period.toUpperCase()) {
            case "MONTH":
                if (month == null) return " AND YEAR(" + col + ") = " + year;
                return " AND YEAR(" + col + ") = " + year + " AND MONTH(" + col + ") = " + month;
            case "QUARTER":
                if (quarter == null) return " AND YEAR(" + col + ") = " + year;
                int qStart = (quarter - 1) * 3 + 1;
                int qEnd   = qStart + 2;
                return " AND YEAR(" + col + ") = " + year
                        + " AND MONTH(" + col + ") BETWEEN " + qStart + " AND " + qEnd;
            default: // YEAR
                return " AND YEAR(" + col + ") = " + year;
        }
    }

    /** Tính % tăng trưởng so với kỳ liền trước */
    private double calcGrowthRate(BigDecimal currentNet, Integer facilityId,
                                  String period, Integer year, Integer month, Integer quarter) {
        Integer prevYear = year, prevMonth = month, prevQuarter = quarter;
        if ("MONTH".equalsIgnoreCase(period)) {
            if (month != null && month > 1)      { prevMonth = month - 1; }
            else                                  { prevYear = (year != null ? year - 1 : LocalDate.now().getYear() - 1); prevMonth = 12; }
        } else if ("QUARTER".equalsIgnoreCase(period)) {
            if (quarter != null && quarter > 1)  { prevQuarter = quarter - 1; }
            else                                  { prevYear = (year != null ? year - 1 : LocalDate.now().getYear() - 1); prevQuarter = 4; }
        } else {
            prevYear = (year != null ? year - 1 : LocalDate.now().getYear() - 1);
        }

        String prevDateFilter   = buildDateFilter(period, prevYear, prevMonth, prevQuarter, "p.paid_at");
        String facilityJoin     = buildFacilityJoin(facilityId);
        String facilityWhere    = facilityId != null ? " AND f.id = " + facilityId : "";

        BigDecimal prevRental = querySum(
                "SELECT COALESCE(SUM(p.amount),0) FROM payment_transactions p"
                        + facilityJoin
                        + " WHERE p.status='SUCCESS' AND p.payment_type IN ('DEPOSIT','MONTHLY_RENT','LATE_FEE','DAMAGE_FEE')"
                        + prevDateFilter + facilityWhere);
        BigDecimal prevRefund = querySum(
                "SELECT COALESCE(SUM(p.amount),0) FROM payment_transactions p"
                        + facilityJoin
                        + " WHERE p.status='SUCCESS' AND p.payment_type='REFUND'"
                        + prevDateFilter + facilityWhere);
        BigDecimal prevNet = prevRental.subtract(prevRefund);

        if (prevNet.compareTo(BigDecimal.ZERO) == 0) return 0.0;
        return round1(currentNet.subtract(prevNet)
                .multiply(BigDecimal.valueOf(100))
                .divide(prevNet.abs(), 1, RoundingMode.HALF_UP)
                .doubleValue());
    }

    private BigDecimal querySum(String sql, Object... args) {
        BigDecimal result = (args != null && args.length > 0)
                ? jdbc.queryForObject(sql, BigDecimal.class, args)
                : jdbc.queryForObject(sql, BigDecimal.class);
        return result != null ? result : BigDecimal.ZERO;
    }

    private long queryCount(String sql, Object... args) {
        Long result = (args != null && args.length > 0)
                ? jdbc.queryForObject(sql, Long.class, args)
                : jdbc.queryForObject(sql, Long.class);
        return result != null ? result : 0L;
    }

    private int queryCountInt(String sql, Object... args) {
        Integer result = (args != null && args.length > 0)
                ? jdbc.queryForObject(sql, Integer.class, args)
                : jdbc.queryForObject(sql, Integer.class);
        return result != null ? result : 0;
    }

    private BigDecimal toBD(Object val) {
        if (val == null) return BigDecimal.ZERO;
        if (val instanceof BigDecimal bd) return bd;
        return new BigDecimal(val.toString());
    }

    private LocalDateTime toLocalDateTime(Object val) {
        if (val == null) return null;
        if (val instanceof LocalDateTime ldt) return ldt;
        if (val instanceof java.sql.Timestamp ts) return ts.toLocalDateTime();
        return null;
    }

    private double round1(double val) {
        return Math.round(val * 10.0) / 10.0;
    }
}
