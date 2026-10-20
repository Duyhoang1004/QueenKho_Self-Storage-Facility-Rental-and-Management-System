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
 *  - DEPOSIT và MONTHLY_RENT → rentalRevenue
 *  - LATE_FEE và DAMAGE_FEE  → feesRevenue
 *  - REFUND                  → refundDisbursed (âm với doanh thu ròng)
 *  - Quỹ cọc đang giữ         = deposit_held_amount của HĐ đang ACTIVE / OVERDUE / TERMINATION_PENDING
 */
@Service
public class BomRevenueService {

    @Autowired
    private JdbcTemplate jdbc;

    // ─────────────────────────────────────────────────────────────
    // 1. OVERVIEW — 8 KPI thẻ tổng quan
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
    // 2. TIMELINE — Biểu đồ doanh thu 12 tháng / 4 quý theo năm
    // ─────────────────────────────────────────────────────────────

    public List<RevenueTimelineResponse> getTimeline(Integer facilityId, Integer year) {
        String facilityJoin  = buildFacilityJoin(facilityId);
        String facilityWhere = facilityId != null ? " AND f.id = " + facilityId : "";

        String sql =
                "SELECT MONTH(p.paid_at) AS m,"
                + " COALESCE(SUM(CASE WHEN p.payment_type IN ('DEPOSIT','MONTHLY_RENT') THEN p.amount ELSE 0 END), 0) AS rent,"
                + " COALESCE(SUM(CASE WHEN p.payment_type IN ('LATE_FEE','DAMAGE_FEE')  THEN p.amount ELSE 0 END), 0) AS fees,"
                + " COALESCE(SUM(CASE WHEN p.payment_type = 'REFUND'                    THEN p.amount ELSE 0 END), 0) AS refund"
                + " FROM payment_transactions p"
                + facilityJoin
                + " WHERE p.status = 'SUCCESS'"
                + " AND YEAR(p.paid_at) = " + year
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
            rents[m]   = toBD(row.get("rent"));
            fees[m]    = toBD(row.get("fees"));
            refunds[m] = toBD(row.get("refund"));
        }

        int currentMonth = (year == LocalDate.now().getYear()) ? LocalDate.now().getMonthValue() : 12;
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
        String sql =
                "SELECT f.id AS fid, f.name AS fname,"
                + " COALESCE(SUM(CASE WHEN p.payment_type IN ('DEPOSIT','MONTHLY_RENT','LATE_FEE','DAMAGE_FEE') THEN p.amount"
                + "                   WHEN p.payment_type = 'REFUND' THEN -p.amount ELSE 0 END), 0) AS revenue,"
                + " COUNT(DISTINCT CASE WHEN rc.status IN ('ACTIVE','OVERDUE') THEN rc.id END) AS activeUnits,"
                + " COUNT(DISTINCT su.id) AS totalOperational"
                + " FROM facilities f"
                + " LEFT JOIN storage_units su ON su.facility_id = f.id AND su.status NOT IN ('MAINTENANCE','INACTIVE')"
                + " LEFT JOIN rental_contracts rc ON rc.storage_unit_id = su.id AND rc.status IN ('ACTIVE','OVERDUE')"
                + " LEFT JOIN payment_transactions p ON ("
                + "   (p.reservation_id IN (SELECT r.id FROM reservations r WHERE r.facility_id = f.id)"
                + "    OR p.contract_id IN (SELECT c.id FROM rental_contracts c JOIN storage_units su2 ON su2.id = c.storage_unit_id WHERE su2.facility_id = f.id))"
                + "   AND p.status = 'SUCCESS' AND YEAR(p.paid_at) = " + year + ")"
                + " WHERE f.status = 'ACTIVE'"
                + " GROUP BY f.id, f.name"
                + " ORDER BY revenue DESC";

        List<Map<String, Object>> rows = jdbc.queryForList(sql);

        // Tổng để tính %
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
    // 4. BY-UNIT-TYPE — Doanh thu phân bổ theo loại kho
    // ─────────────────────────────────────────────────────────────

    public List<UnitTypeRevenueResponse> getByUnitType(Integer facilityId) {
        String facilityFilter = facilityId != null
                ? " AND su.facility_id = " + facilityId
                : "";

        String sql =
                "SELECT ut.id AS tid, ut.name AS tname,"
                + " COALESCE(SUM(CASE WHEN p.payment_type IN ('DEPOSIT','MONTHLY_RENT') THEN p.amount ELSE 0 END), 0) AS revenue,"
                + " COUNT(DISTINCT CASE WHEN rc.status IN ('ACTIVE','OVERDUE') THEN rc.id END) AS totalRented"
                + " FROM unit_types ut"
                + " LEFT JOIN storage_units su ON su.unit_type_id = ut.id" + facilityFilter
                + " LEFT JOIN rental_contracts rc ON rc.storage_unit_id = su.id"
                + " LEFT JOIN payment_transactions p ON p.contract_id = rc.id AND p.status = 'SUCCESS'"
                + "   AND p.payment_type IN ('DEPOSIT','MONTHLY_RENT')"
                + " GROUP BY ut.id, ut.name"
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
    // 5. TRANSACTIONS — Bảng đối soát giao dịch (PR-O15)
    // ─────────────────────────────────────────────────────────────

    public List<RevenueTransactionResponse> getTransactions(Integer facilityId, String paymentType) {
        String facilityJoin  = buildFacilityJoin(facilityId);
        String facilityWhere = facilityId != null ? " AND f.id = " + facilityId : "";
        String typeWhere     = (paymentType != null && !paymentType.isBlank())
                ? " AND p.payment_type = '" + paymentType.toUpperCase() + "'"
                : "";

        String sql =
                "SELECT TOP 200 p.id, p.transaction_code, p.paid_at,"
                + " u.full_name AS customerName, u.phone AS customerPhone,"
                + " f.name AS facilityName,"
                + " rc.contract_code,"
                + " p.payment_type, p.payment_method,"
                + " p.bank_transaction_code,"
                + " p.amount, p.status,"
                + " ft.evidence_image_url,"
                + " p.note"
                + " FROM payment_transactions p"
                + " JOIN users u ON u.id = p.user_id"
                + facilityJoin
                + " LEFT JOIN rental_contracts rc ON rc.id = p.contract_id"
                + " LEFT JOIN facility_tasks ft ON ft.id = p.task_id"
                + " WHERE p.status = 'SUCCESS'"
                + facilityWhere + typeWhere
                + " ORDER BY p.paid_at DESC";

        List<Map<String, Object>> rows = jdbc.queryForList(sql);
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
    // 6. OCCUPANCY — Tỷ lệ lấp đầy & thống kê hợp đồng
    // ─────────────────────────────────────────────────────────────

    public OccupancyReportResponse getOccupancy(Integer facilityId) {
        String facilityWhere = facilityId != null ? " WHERE su.facility_id = " + facilityId : "";
        String facilityWhereAnd = facilityId != null
                ? " JOIN storage_units su ON su.id = rc.storage_unit_id WHERE su.facility_id = " + facilityId
                : "";

        // Tổng số ô kho
        int totalUnits = queryCountInt(
                "SELECT COUNT(*) FROM storage_units su" + facilityWhere);

        // Số ô đang cho thuê
        int occupiedUnits = queryCountInt(
                "SELECT COUNT(DISTINCT rc.storage_unit_id) FROM rental_contracts rc"
                + (facilityWhereAnd.isBlank()
                        ? " WHERE rc.status IN ('ACTIVE','OVERDUE')"
                        : facilityWhereAnd + " AND rc.status IN ('ACTIVE','OVERDUE')"));

        // Số ô đang bảo trì
        int maintenanceUnits = queryCountInt(
                "SELECT COUNT(*) FROM storage_units su"
                + (facilityWhere.isBlank() ? " WHERE" : facilityWhere + " AND")
                + " su.status = 'MAINTENANCE'");

        int availableUnits = Math.max(0, totalUnits - occupiedUnits - maintenanceUnits);
        int operationalUnits = totalUnits - maintenanceUnits;
        double occupancyRate = operationalUnits > 0
                ? round1(occupiedUnits * 100.0 / operationalUnits) : 0.0;

        // HĐ mới trong tháng hiện tại
        int newContracts = queryCountInt(
                "SELECT COUNT(*) FROM rental_contracts rc"
                + (facilityWhereAnd.isBlank()
                        ? " WHERE"
                        : facilityWhereAnd + " AND")
                + " YEAR(rc.created_at) = " + LocalDate.now().getYear()
                + " AND MONTH(rc.created_at) = " + LocalDate.now().getMonthValue());

        // HĐ kết thúc trong tháng
        int terminatedContracts = queryCountInt(
                "SELECT COUNT(*) FROM rental_contracts rc"
                + (facilityWhereAnd.isBlank()
                        ? " WHERE"
                        : facilityWhereAnd + " AND")
                + " rc.status IN ('TERMINATED','LIQUIDATED')"
                + " AND YEAR(rc.updated_at) = " + LocalDate.now().getYear()
                + " AND MONTH(rc.updated_at) = " + LocalDate.now().getMonthValue());

        // Tỷ lệ tái ký (gia hạn / tổng kết thúc)
        double retentionRate = 0.0;
        if (terminatedContracts > 0) {
            int renewedContracts = queryCountInt(
                    "SELECT COUNT(*) FROM rental_contracts rc"
                    + (facilityWhereAnd.isBlank()
                            ? " WHERE"
                            : facilityWhereAnd + " AND")
                    + " rc.status = 'ACTIVE'"
                    + " AND rc.reservation_id IN ("
                    + "   SELECT r.id FROM reservations r WHERE r.reservation_code LIKE 'RE%'"
                    + " )");
            retentionRate = round1(renewedContracts * 100.0 / terminatedContracts);
        }

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
    // Private helpers
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
        // Xác định kỳ trước
        Integer prevYear = year, prevMonth = month, prevQuarter = quarter;
        if ("MONTH".equalsIgnoreCase(period)) {
            if (month != null && month > 1)      { prevMonth = month - 1; }
            else                                  { prevYear = year - 1; prevMonth = 12; }
        } else if ("QUARTER".equalsIgnoreCase(period)) {
            if (quarter != null && quarter > 1)  { prevQuarter = quarter - 1; }
            else                                  { prevYear = year - 1; prevQuarter = 4; }
        } else {
            prevYear = year - 1;
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

    private BigDecimal querySum(String sql) {
        BigDecimal result = jdbc.queryForObject(sql, BigDecimal.class);
        return result != null ? result : BigDecimal.ZERO;
    }

    private long queryCount(String sql) {
        Long result = jdbc.queryForObject(sql, Long.class);
        return result != null ? result : 0L;
    }

    private int queryCountInt(String sql) {
        Integer result = jdbc.queryForObject(sql, Integer.class);
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
