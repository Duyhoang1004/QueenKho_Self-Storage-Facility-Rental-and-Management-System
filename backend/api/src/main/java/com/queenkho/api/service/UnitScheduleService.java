package com.queenkho.api.service;

import com.queenkho.api.dto.UnitScheduleResponse;
import com.queenkho.api.dto.UpcomingContractInfo;
import com.queenkho.api.entity.StorageUnit;
import com.queenkho.api.exception.FacilityException;
import com.queenkho.api.repository.RentalContractRepository;
import com.queenkho.api.repository.StorageUnitRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Date;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * D-18 (08/11/2026, góp ý buổi test + giảng viên): ô kho được tính theo LỊCH (khoảng ngày) thay vì chỉ theo trạng thái.
 *
 * <p>Mỗi hợp đồng còn hiệu lực chiếm ô trong khoảng [start_date, ngày ô giao lại được) — ngày giao lại = end_date + ngày dọn ô
 * (cùng công thức PR-R11). Ô bảo trì bị chặn từ hôm nay. Nhờ vậy khách A thuê 1 năm nhưng 2 tháng sau mới nhận kho thì
 * 2 tháng trống trước đó vẫn gán được cho khách B thuê ngắn.</p>
 *
 * <p>Trạng thái {@code storage_units.status} chỉ còn nghĩa "hôm nay ô có khách ở thật không": gán ô cho ngày tương lai thì ô
 * vẫn {@code AVAILABLE}, tới ngày bắt đầu (job 00:05) hoặc check-in mới thành {@code OCCUPIED}.</p>
 */
@Service
public class UnitScheduleService {

    /** PR-B4 (sửa D-18): ngày nhận kho xa nhất = hôm nay + 90 ngày (trước đây ghi 30 ngày nhưng chưa chặn — L-09) */
    public static final int MAX_BOOKING_LEAD_DAYS = 90;
    /** Ngày dọn ô giữa 2 khách — cùng hằng số với ô sắp trống (PR-R11) */
    public static final int CLEANUP_DAYS = RenewalPolicyService.CLEANUP_DAYS_AFTER_LIQUIDATION;
    public static final List<String> LIVE_CONTRACT_STATUSES =
            List.of("PENDING_CHECK_IN", "ACTIVE", "TERMINATION_PENDING", "OVERDUE");
    /** Popup lịch xem tối đa ~1 năm mỗi lần */
    public static final int MAX_SCHEDULE_DAYS = 370;

    private static final DateTimeFormatter DMY = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final JdbcTemplate jdbcTemplate;
    private final StorageUnitRepository storageUnitRepository;
    private final RentalContractRepository rentalContractRepository;

    @PersistenceContext
    private EntityManager entityManager;

    public UnitScheduleService(JdbcTemplate jdbcTemplate,
                               StorageUnitRepository storageUnitRepository,
                               RentalContractRepository rentalContractRepository) {
        this.jdbcTemplate = jdbcTemplate;
        this.storageUnitRepository = storageUnitRepository;
        this.rentalContractRepository = rentalContractRepository;
    }

    /** 1 hợp đồng còn hiệu lực trên 1 ô */
    public record Booking(String unitId, Integer contractId, String contractCode, Integer reservationId,
                          String reservationCode, String customerName, String status,
                          LocalDate startDate, LocalDate endDate, LocalDate freeFrom, boolean mayRenew) {
    }

    /** Ô bị chiếm trong [from, to); to = null là chưa biết ngày ô rảnh lại. reason: null (hợp đồng) / MAINTENANCE / OCCUPIED */
    public record Block(LocalDate from, LocalDate to, Booking booking, String reason) {
    }

    public static LocalDate today() {
        return LocalDate.now(LateFeeService.VIETNAM_ZONE);
    }

    /** Khoảng ô bị chiếm của 1 đơn mới: [start, start + số tháng + ngày dọn ô) */
    public static LocalDate rangeEnd(LocalDate start, int months) {
        return start.plusMonths(months).plusDays(CLEANUP_DAYS);
    }

    /** Hai khoảng nửa mở [aFrom, aTo) và [bFrom, bTo) có giao nhau không (to = null là vô hạn) */
    public static boolean overlaps(LocalDate aFrom, LocalDate aTo, LocalDate bFrom, LocalDate bTo) {
        return (aTo == null || bFrom.isBefore(aTo)) && (bTo == null || aFrom.isBefore(bTo));
    }

    public static String formatDate(LocalDate date) {
        return date != null ? date.format(DMY) : "";
    }

    // ================== ĐỌC LỊCH ==================

    private static final String BOOKING_SELECT =
            "SELECT c.id AS contract_id, c.contract_code, c.status, c.start_date, c.end_date, su.id AS unit_id, " +
                    "       r.id AS reservation_id, r.reservation_code, cu.full_name, " +
                    RenewalPolicyService.RELEASE_DATE_SQL + " AS free_from " +
                    "FROM rental_contracts c " +
                    "JOIN storage_units su ON su.id = c.storage_unit_id " +
                    "LEFT JOIN reservations r ON r.id = c.reservation_id " +
                    "LEFT JOIN rental_policy rp ON rp.id = c.rental_policy_id " +
                    "LEFT JOIN users cu ON cu.id = c.customer_id " +
                    "WHERE c.status IN ('PENDING_CHECK_IN', 'ACTIVE', 'TERMINATION_PENDING', 'OVERDUE') ";

    @Transactional(readOnly = true)
    public List<Booking> bookingsOfFacility(Integer facilityId) {
        return queryBookings("AND su.facility_id = ? ", facilityId);
    }

    @Transactional(readOnly = true)
    public List<Booking> bookingsOfUnit(String unitId) {
        return queryBookings("AND su.id = ? ", unitId);
    }

    @Transactional(readOnly = true)
    public Map<String, List<Booking>> bookingsByUnit(Integer facilityId) {
        return bookingsOfFacility(facilityId).stream()
                .collect(Collectors.groupingBy(Booking::unitId, LinkedHashMap::new, Collectors.toList()));
    }

    /** Hợp đồng chờ nhận kho trên ô (trừ excludeContractId) — dùng khi ô vào bảo trì để nhắc FM đổi ô cho họ */
    @Transactional(readOnly = true)
    public List<Booking> pendingCheckInsOnUnit(String unitId, Integer excludeContractId) {
        return bookingsOfUnit(unitId).stream()
                .filter(b -> "PENDING_CHECK_IN".equals(b.status()))
                .filter(b -> excludeContractId == null || !excludeContractId.equals(b.contractId()))
                .toList();
    }

    private List<Booking> queryBookings(String where, Object arg) {
        flushPendingChanges();
        LocalDate today = today();
        List<Booking> result = jdbcTemplate.query(BOOKING_SELECT + where + "ORDER BY c.start_date, c.id",
                (rs, i) -> toBooking(rs, today), arg);
        return result != null ? result : List.of();
    }

    private static Booking toBooking(ResultSet rs, LocalDate today) throws SQLException {
        String status = rs.getString("status");
        LocalDate end = toDate(rs.getDate("end_date"));
        int reservationId = rs.getInt("reservation_id");
        boolean hasReservation = !rs.wasNull();
        boolean mayRenew = "ACTIVE".equals(status) && end != null && !RenewalPolicyService.isReleasing(status, end, today);
        return new Booking(rs.getString("unit_id"), rs.getInt("contract_id"), rs.getString("contract_code"),
                hasReservation ? reservationId : null, rs.getString("reservation_code"), rs.getString("full_name"), status,
                toDate(rs.getDate("start_date")), end, toDate(rs.getDate("free_from")), mayRenew);
    }

    private static LocalDate toDate(Date date) {
        return date != null ? date.toLocalDate() : null;
    }

    // Đọc bằng JDBC không tự flush thay đổi JPA chưa ghi → flush trước để thấy đúng dữ liệu trong cùng transaction
    private void flushPendingChanges() {
        try {
            if (entityManager != null && entityManager.isJoinedToTransaction()) {
                entityManager.flush();
            }
        } catch (RuntimeException ignored) {
            // không có transaction / chỉ đọc → bỏ qua
        }
    }

    /**
     * Các khoảng ô bị chiếm.
     * strict = true (đếm suất cho đơn mới): hợp đồng ACTIVE chưa qua hạn chót gia hạn coi như chưa biết ngày trả,
     * vì khách còn quyền gia hạn (PR-R10) — giống cách đếm "ô sắp trống" cũ.
     */
    public static List<Block> blocksOf(StorageUnit unit, List<Booking> unitBookings, boolean strict, LocalDate today) {
        List<Block> blocks = new ArrayList<>();
        if ("MAINTENANCE".equalsIgnoreCase(unit.getStatus())) {
            blocks.add(new Block(today, null, null, "MAINTENANCE"));
        }
        boolean coveredToday = false;
        for (Booking b : unitBookings) {
            if (b.startDate() == null) continue;
            blocks.add(new Block(b.startDate(), strict && b.mayRenew() ? null : b.freeFrom(), b, null));
            if (!b.startDate().isAfter(today) && (b.freeFrom() == null || b.freeFrom().isAfter(today))) {
                coveredToday = true;
            }
        }
        // Dữ liệu cũ: ô OCCUPIED mà không có hợp đồng nào phủ hôm nay → coi như đang bận, chưa biết ngày trả
        if ("OCCUPIED".equalsIgnoreCase(unit.getStatus()) && !coveredToday) {
            blocks.add(new Block(today, null, null, "OCCUPIED"));
        }
        return blocks;
    }

    /** Các khoảng bận của ô giao với [from, to) (bỏ qua excludeContractId — vd chính hợp đồng đang dời lịch / chuyển ô) */
    @Transactional(readOnly = true)
    public List<Block> conflicts(StorageUnit unit, LocalDate from, LocalDate to, Integer excludeContractId) {
        return otherBlocks(unit, bookingsOfUnit(unit.getId()), excludeContractId, today()).stream()
                .filter(block -> overlaps(block.from(), block.to(), from, to))
                .toList();
    }

    // Tính khoảng bận trên TOÀN BỘ hợp đồng rồi mới bỏ hợp đồng được loại trừ. Lọc trước sẽ làm ô OCCUPIED do chính
    // hợp đồng đó trông như "có khách lạ đang ở" (vd dời lịch đơn đã tới ngày nhận kho).
    private static List<Block> otherBlocks(StorageUnit unit, List<Booking> bookings, Integer excludeContractId, LocalDate today) {
        return blocksOf(unit, bookings, false, today).stream()
                .filter(block -> block.booking() == null || excludeContractId == null
                        || !excludeContractId.equals(block.booking().contractId()))
                .toList();
    }

    @Transactional(readOnly = true)
    public boolean isUnitFree(StorageUnit unit, LocalDate from, LocalDate to, Integer excludeContractId) {
        return conflicts(unit, from, to, excludeContractId).isEmpty();
    }

    /** Ô gán / chuyển tới được + ngày khoảng trống kết thúc (null = chưa ai đặt sau) */
    public record Candidate(StorageUnit unit, LocalDate freeUntil, String nextContractCode) {
    }

    /**
     * Ô AVAILABLE cùng cơ sở + loại, rảnh suốt [from, to) (bỏ qua excludeContractId / excludeUnitId).
     * Xếp ô có khoảng trống vừa khít lên đầu (freeUntil gần nhất) để lấp các khoảng trống ngắn trước — giữ ô trống dài cho đơn dài.
     */
    @Transactional(readOnly = true)
    public List<Candidate> candidates(Integer facilityId, Integer unitTypeId, LocalDate from, LocalDate to,
                                      Integer excludeContractId, String excludeUnitId) {
        LocalDate today = today();
        Map<String, List<Booking>> byUnit = bookingsByUnit(facilityId);
        List<Candidate> result = new ArrayList<>();
        for (StorageUnit unit : storageUnitRepository.findByFacility_IdAndUnitType_IdAndStatus(facilityId, unitTypeId, "AVAILABLE")) {
            if (unit.getId().equals(excludeUnitId)) continue;
            List<Block> blocks = otherBlocks(unit, byUnit.getOrDefault(unit.getId(), List.of()), excludeContractId, today);
            if (blocks.stream().anyMatch(block -> overlaps(block.from(), block.to(), from, to))) continue;
            Block next = blocks.stream()
                    .filter(block -> !block.from().isBefore(to))
                    .min(Comparator.comparing(Block::from))
                    .orElse(null);
            result.add(new Candidate(unit, next != null ? next.from() : null,
                    next != null && next.booking() != null ? next.booking().contractCode() : null));
        }
        result.sort(Comparator.comparing(Candidate::freeUntil, Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparing(c -> c.unit().getId()));
        return result;
    }

    /** "đã có HĐ HD-123456 (Nguyễn A) 01/01/2027 → 03/02/2027" — câu báo lỗi cho FM */
    public static String describe(Block block) {
        if ("MAINTENANCE".equals(block.reason())) return "ô đang bảo trì";
        if (block.booking() == null) return "ô đang có khách sử dụng";
        Booking b = block.booking();
        return "đã có HĐ " + b.contractCode() + (b.customerName() != null ? " (" + b.customerName() + ")" : "")
                + " từ " + formatDate(b.startDate())
                + (b.freeFrom() != null ? " đến hết " + formatDate(b.freeFrom().minusDays(1)) : "");
    }

    // ================== ĐẾM SUẤT CHO ĐƠN MỚI (BR-11 / PR-B1) ==================

    /**
     * Số suất còn nhận đơn cho khoảng [start, start + months + ngày dọn ô):
     * số ô đúng loại rảnh suốt khoảng đó − đơn đang giữ suất (đã cọc chưa gán ô / PENDING trong 15 phút) có khoảng ngày giao nhau.
     */
    @Transactional(readOnly = true)
    public int freeSlots(Integer facilityId, Integer unitTypeId, LocalDate start, int months) {
        LocalDate to = rangeEnd(start, months);
        LocalDate today = today();
        Map<String, List<Booking>> byUnit = bookingsByUnit(facilityId);
        int free = 0;
        for (StorageUnit unit : storageUnitRepository.findByFacility_Id(facilityId)) {
            if (unit.getUnitType() == null || !unitTypeId.equals(unit.getUnitType().getId())) continue;
            if (unit.isEmergencyUnit()) continue; // BR-140: ô khẩn cấp không bán, không tính suất
            boolean ok = blocksOf(unit, byUnit.getOrDefault(unit.getId(), List.of()), true, today).stream()
                    .noneMatch(block -> overlaps(block.from(), block.to(), start, to));
            if (ok) free++;
        }
        return free - overlappingHolds(facilityId, unitTypeId, start, to);
    }

    private int overlappingHolds(Integer facilityId, Integer unitTypeId, LocalDate from, LocalDate to) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                "SELECT start_date, duration_months FROM reservations " +
                        "WHERE facility_id = ? AND unit_type_id = ? AND storage_unit_id IS NULL " +
                        "  AND (status = 'DEPOSIT_PAID' OR (status = 'PENDING' AND created_at > DATEADD(MINUTE, -15, SYSDATETIME())))",
                facilityId, unitTypeId);
        if (rows == null) return 0;
        int count = 0;
        for (Map<String, Object> row : rows) {
            LocalDate s = row.get("start_date") instanceof Date d ? d.toLocalDate() : null;
            int m = row.get("duration_months") instanceof Number n ? n.intValue() : 1;
            if (s == null || overlaps(s, rangeEnd(s, Math.max(m, 1)), from, to)) count++;
        }
        return count;
    }

    // ================== TRẠNG THÁI Ô HÔM NAY ==================

    /** Đặt lại AVAILABLE / OCCUPIED theo lịch (không đụng ô MAINTENANCE). Gọi sau mọi thao tác đổi hợp đồng trên ô. */
    @Transactional
    public void refreshUnitStatus(StorageUnit unit) {
        if (unit == null || "MAINTENANCE".equalsIgnoreCase(unit.getStatus())) return;
        // BR-140: ô khẩn cấp rảnh về EMERGENCY (không bán)
        String next = rentalContractRepository.countOccupyingNow(unit.getId(), today()) > 0 ? "OCCUPIED" : unit.idleStatus();
        if (!next.equals(unit.getStatus())) {
            unit.setStatus(next);
            storageUnitRepository.save(unit);
        }
    }

    @Transactional
    public void refreshUnitStatus(String unitId) {
        if (unitId == null) return;
        storageUnitRepository.findById(unitId).ifPresent(this::refreshUnitStatus);
    }

    /**
     * Job 00:05 + lúc khởi động: tới ngày bắt đầu thì ô thành OCCUPIED; ô bị đánh OCCUPIED chỉ vì đơn gán trước
     * cho ngày tương lai (dữ liệu trước D-18) trả về AVAILABLE. Trả về số ô đã đổi.
     */
    @Transactional
    public int syncUnitStatuses() {
        Date today = Date.valueOf(today());
        String occupyingNow = "SELECT 1 FROM rental_contracts c WHERE c.storage_unit_id = su.id " +
                "AND (c.status IN ('ACTIVE', 'TERMINATION_PENDING', 'OVERDUE') OR (c.status = 'PENDING_CHECK_IN' AND c.start_date <= ?))";
        int occupied = jdbcTemplate.update(
                "UPDATE su SET su.status = 'OCCUPIED' FROM storage_units su WHERE su.status IN ('AVAILABLE', 'EMERGENCY') AND EXISTS (" + occupyingNow + ")",
                today);
        int released = jdbcTemplate.update(
                "UPDATE su SET su.status = CASE WHEN su.is_emergency = 1 THEN 'EMERGENCY' ELSE 'AVAILABLE' END " +
                        "FROM storage_units su WHERE su.status = 'OCCUPIED' " +
                        "AND EXISTS (SELECT 1 FROM rental_contracts f WHERE f.storage_unit_id = su.id " +
                        "            AND f.status = 'PENDING_CHECK_IN' AND f.start_date > ?) " +
                        "AND NOT EXISTS (" + occupyingNow + ")",
                today, today);
        return occupied + released;
    }

    // ================== POPUP LỊCH Ô KHO ==================

    @Transactional(readOnly = true)
    public UnitScheduleResponse getSchedule(Integer facilityId, LocalDate from, LocalDate to, Integer unitTypeId) {
        LocalDate today = today();
        LocalDate start = from != null ? from : today;
        LocalDate end = to != null ? to : start.plusMonths(3);
        if (!end.isAfter(start)) {
            throw new FacilityException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Ngày kết thúc phải sau ngày bắt đầu");
        }
        if (ChronoUnit.DAYS.between(start, end) > MAX_SCHEDULE_DAYS) {
            throw new FacilityException(HttpStatus.BAD_REQUEST, "INVALID_INPUT",
                    "Mỗi lần chỉ xem tối đa " + MAX_SCHEDULE_DAYS + " ngày");
        }

        List<StorageUnit> units = storageUnitRepository.findByFacility_Id(facilityId).stream()
                .filter(u -> unitTypeId == null || (u.getUnitType() != null && unitTypeId.equals(u.getUnitType().getId())))
                .sorted(Comparator.comparing((StorageUnit u) -> u.getFloor() != null ? u.getFloor() : "")
                        .thenComparing(StorageUnit::getId))
                .toList();
        Map<String, List<Booking>> byUnit = bookingsByUnit(facilityId);

        List<UnitScheduleResponse.UnitRow> rows = new ArrayList<>();
        int conflictCount = 0;
        for (StorageUnit unit : units) {
            List<Booking> bookings = byUnit.getOrDefault(unit.getId(), List.of());
            List<UnitScheduleResponse.BookingBar> bars = new ArrayList<>();
            boolean unitConflict = false;
            for (Booking b : bookings) {
                UnitScheduleResponse.BookingBar bar = toBar(unit, b, bookings);
                if (bar.isConflict()) unitConflict = true;
                if (overlaps(b.startDate(), b.freeFrom(), start, end) || bar.isConflict()) {
                    bars.add(bar);
                    if (bar.isConflict()) conflictCount++;
                }
            }
            rows.add(UnitScheduleResponse.UnitRow.builder()
                    .unitId(unit.getId())
                    .unitTypeId(unit.getUnitType() != null ? unit.getUnitType().getId() : null)
                    .unitTypeName(unit.getUnitType() != null ? unit.getUnitType().getName() : null)
                    .floor(unit.getFloor())
                    .zone(unit.getZone())
                    .roomNumber(unit.getRoomNumber())
                    .status(unit.getStatus())
                    .maintenanceNote(unit.getMaintenanceNote())
                    .maintenanceSince(unit.getMaintenanceSince())
                    .bookings(bars)
                    .freeRanges(freeRanges(blocksOf(unit, bookings, false, today), start.isBefore(today) ? today : start, end))
                    .conflict(unitConflict)
                    .build());
        }

        String facilityName = null;
        try {
            facilityName = jdbcTemplate.queryForObject("SELECT name FROM facilities WHERE id = ?", String.class, facilityId);
        } catch (RuntimeException ignored) {
            // cơ sở không tồn tại → để trống tên
        }

        return UnitScheduleResponse.builder()
                .facilityId(facilityId)
                .facilityName(facilityName)
                .from(start)
                .to(end)
                .today(today)
                .cleanupDays(CLEANUP_DAYS)
                .units(rows)
                .pendingReservations(pendingDemand(facilityId, unitTypeId))
                .conflictCount(conflictCount)
                .build();
    }

    private static UnitScheduleResponse.BookingBar toBar(StorageUnit unit, Booking b, List<Booking> all) {
        String note = null;
        boolean conflict = false;
        for (Booking other : all) {
            if (other == b || other.startDate() == null) continue;
            if (overlaps(b.startDate(), b.freeFrom(), other.startDate(), other.freeFrom())) {
                conflict = true;
                note = "Trùng lịch với HĐ " + other.contractCode() + " (" + formatDate(other.startDate()) + ") — cần đổi ô cho một bên";
                break;
            }
        }
        if (!conflict && "MAINTENANCE".equalsIgnoreCase(unit.getStatus()) && "PENDING_CHECK_IN".equals(b.status())) {
            conflict = true;
            note = "Ô đang bảo trì — hoàn tất bảo trì trước " + formatDate(b.startDate()) + " hoặc đổi ô cho khách";
        }
        if (!conflict && b.mayRenew()) {
            Booking next = all.stream()
                    .filter(o -> o != b && o.startDate() != null && o.startDate().isAfter(b.startDate()))
                    .min(Comparator.comparing(Booking::startDate))
                    .orElse(null);
            if (next != null) {
                note = "Khách còn gia hạn được — ô đã có HĐ " + next.contractCode() + " nhận từ "
                        + formatDate(next.startDate()) + ", nếu khách gia hạn phải đổi ô cho một bên";
            }
        }
        return UnitScheduleResponse.BookingBar.builder()
                .contractId(b.contractId())
                .contractCode(b.contractCode())
                .reservationId(b.reservationId())
                .reservationCode(b.reservationCode())
                .customerName(b.customerName())
                .status(b.status())
                .startDate(b.startDate())
                .endDate(b.endDate())
                .freeFrom(b.freeFrom())
                .mayRenew(b.mayRenew())
                .conflict(conflict)
                .note(note)
                .build();
    }

    /** Câu cảnh báo lịch đầu tiên của ô (trùng lịch / bảo trì mà có khách sắp nhận), null = ổn */
    public static String scheduleWarning(StorageUnit unit, List<Booking> bookings) {
        for (Booking b : bookings) {
            UnitScheduleResponse.BookingBar bar = toBar(unit, b, bookings);
            if (bar.isConflict()) return "HĐ " + b.contractCode() + ": " + bar.getNote();
        }
        return null;
    }

    public static UpcomingContractInfo toUpcoming(Booking b) {
        return UpcomingContractInfo.builder()
                .contractId(b.contractId())
                .contractCode(b.contractCode())
                .reservationId(b.reservationId())
                .reservationCode(b.reservationCode())
                .customerName(b.customerName())
                .status(b.status())
                .startDate(b.startDate())
                .endDate(b.endDate())
                .build();
    }

    /** Các khoảng trống trong [from, to): khoảng cuối có to = null nghĩa là trống tới hết khoảng xem và chưa ai đặt sau */
    static List<UnitScheduleResponse.FreeRange> freeRanges(List<Block> blocks, LocalDate from, LocalDate to) {
        List<UnitScheduleResponse.FreeRange> ranges = new ArrayList<>();
        if (!from.isBefore(to)) return ranges;
        List<Block> sorted = blocks.stream().sorted(Comparator.comparing(Block::from)).toList();
        LocalDate cursor = from;
        for (Block block : sorted) {
            if (block.to() != null && !block.to().isAfter(cursor)) continue; // đã qua
            if (block.from().isAfter(cursor)) {
                LocalDate gapEnd = block.from();
                if (cursor.isBefore(to)) {
                    ranges.add(UnitScheduleResponse.FreeRange.builder()
                            .from(cursor).to(gapEnd).days(ChronoUnit.DAYS.between(cursor, gapEnd)).build());
                }
            }
            if (block.to() == null) return ranges; // bận vô thời hạn → hết khoảng trống
            if (block.to().isAfter(cursor)) cursor = block.to();
        }
        if (cursor.isBefore(to)) {
            ranges.add(UnitScheduleResponse.FreeRange.builder().from(cursor).to(null).days(null).build());
        }
        return ranges;
    }

    private List<UnitScheduleResponse.PendingDemand> pendingDemand(Integer facilityId, Integer unitTypeId) {
        List<UnitScheduleResponse.PendingDemand> result = jdbcTemplate.query(
                "SELECT r.id, r.reservation_code, r.start_date, r.duration_months, r.unit_type_id, ut.name AS unit_type_name, u.full_name " +
                        "FROM reservations r JOIN unit_types ut ON ut.id = r.unit_type_id LEFT JOIN users u ON u.id = r.customer_id " +
                        "WHERE r.facility_id = ? AND r.status = 'DEPOSIT_PAID' AND r.storage_unit_id IS NULL " +
                        (unitTypeId != null ? "AND r.unit_type_id = ? " : "") +
                        "ORDER BY r.start_date, r.id",
                (rs, i) -> {
                    LocalDate s = toDate(rs.getDate("start_date"));
                    int months = Math.max(rs.getInt("duration_months"), 1);
                    return UnitScheduleResponse.PendingDemand.builder()
                            .reservationId(rs.getInt("id"))
                            .reservationCode(rs.getString("reservation_code"))
                            .customerName(rs.getString("full_name"))
                            .unitTypeId(rs.getInt("unit_type_id"))
                            .unitTypeName(rs.getString("unit_type_name"))
                            .startDate(s)
                            .endDate(s != null ? s.plusMonths(months) : null)
                            .durationMonths(months)
                            .build();
                },
                unitTypeId != null ? new Object[]{facilityId, unitTypeId} : new Object[]{facilityId});
        return result != null ? result : List.of();
    }
}
