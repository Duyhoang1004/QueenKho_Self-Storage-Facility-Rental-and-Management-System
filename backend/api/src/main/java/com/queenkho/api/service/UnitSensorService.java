package com.queenkho.api.service;

import com.queenkho.api.entity.RentalContract;
import com.queenkho.api.repository.RentalContractRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * BR-129 (04/11/2026, góp ý giảng viên "nhiệt độ kho, liên hệ IoT hệ thống giám sát"):
 * nhiệt độ / độ ẩm từng ô (bảng unit_sensor_readings). 🔸 Chưa nối thiết bị thật — dữ liệu sinh bằng nút giả lập.
 *  - Ngưỡng an toàn: 15–30°C, độ ẩm ≤ 75%. Vượt ngưỡng → bản ghi is_alert = 1.
 *  - Có cảnh báo trên ô đang cho thuê → báo khách (+ email) và FM, sinh task bảo trì lý do SENSOR (ô vẫn OCCUPIED).
 *  - Hồ sơ bồi thường (BR-127) xem số liệu quanh ngày xảy ra sự cố để xác định lỗi cơ sở.
 */
@Service
public class UnitSensorService {

    public static final BigDecimal TEMP_MIN = BigDecimal.valueOf(15);
    public static final BigDecimal TEMP_MAX = BigDecimal.valueOf(30);
    public static final BigDecimal HUMIDITY_MAX = BigDecimal.valueOf(75);
    static final List<String> LIVE_STATUSES = List.of("PENDING_CHECK_IN", "ACTIVE", "OVERDUE", "TERMINATION_PENDING");
    private static final DateTimeFormatter TS_FMT = DateTimeFormatter.ofPattern("HH:mm dd/MM/yyyy");

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private RentalContractRepository rentalContractRepository;

    @Autowired(required = false)
    private NotificationService notificationService;

    @Autowired(required = false)
    private StaffTaskService staffTaskService;

    public static boolean isAlert(BigDecimal temperature, BigDecimal humidity) {
        return temperature.compareTo(TEMP_MAX) > 0 || temperature.compareTo(TEMP_MIN) < 0
                || humidity.compareTo(HUMIDITY_MAX) > 0;
    }

    /** Ghi 1 số đo (thiết bị / giả lập). Không tự xử lý cảnh báo — gọi {@link #handleAlert} sau khi ghi xong đợt đo */
    @Transactional
    public boolean recordReading(String unitId, BigDecimal temperature, BigDecimal humidity, LocalDateTime at) {
        boolean alert = isAlert(temperature, humidity);
        jdbcTemplate.update(
                "INSERT INTO unit_sensor_readings (storage_unit_id, temperature, humidity, is_alert, recorded_at) VALUES (?, ?, ?, ?, ?)",
                unitId, temperature, humidity, alert, Timestamp.valueOf(at));
        return alert;
    }

    /** Số đo của 1 ô trong khoảng thời gian, cũ trước */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> readings(String unitId, LocalDateTime from, LocalDateTime to) {
        return jdbcTemplate.query(
                "SELECT temperature, humidity, is_alert, recorded_at FROM unit_sensor_readings " +
                        "WHERE storage_unit_id = ? AND recorded_at BETWEEN ? AND ? ORDER BY recorded_at ASC",
                (rs, i) -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("temperature", rs.getBigDecimal("temperature"));
                    m.put("humidity", rs.getBigDecimal("humidity"));
                    m.put("alert", rs.getBoolean("is_alert"));
                    m.put("recordedAt", rs.getTimestamp("recorded_at").toLocalDateTime());
                    return m;
                },
                unitId, Timestamp.valueOf(from), Timestamp.valueOf(to));
    }

    /** Tóm tắt cho trang hợp đồng / hồ sơ bồi thường: số đo trong {@code days} ngày gần nhất + số lần vượt ngưỡng */
    @Transactional(readOnly = true)
    public Map<String, Object> summary(String unitId, LocalDateTime center, int days) {
        LocalDateTime to = center != null ? center.plusDays(days) : LocalDateTime.now();
        LocalDateTime from = (center != null ? center : LocalDateTime.now()).minusDays(days);
        if (to.isAfter(LocalDateTime.now())) to = LocalDateTime.now();
        List<Map<String, Object>> list = readings(unitId, from, to);
        long alerts = list.stream().filter(r -> Boolean.TRUE.equals(r.get("alert"))).count();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("storageUnitId", unitId);
        result.put("from", from);
        result.put("to", to);
        result.put("readings", list);
        result.put("alertCount", alerts);
        result.put("latest", list.isEmpty() ? null : list.get(list.size() - 1));
        result.put("tempMin", TEMP_MIN);
        result.put("tempMax", TEMP_MAX);
        result.put("humidityMax", HUMIDITY_MAX);
        return result;
    }

    /**
     * Ô vượt ngưỡng: báo khách đang thuê (+ email) và FM, sinh task bảo trì SENSOR để nhân viên kiểm tra điều hoà / hút ẩm.
     * Chống gửi trùng theo ô + giờ (ref_key).
     */
    @Transactional
    public void handleAlert(String unitId, BigDecimal temperature, BigDecimal humidity) {
        List<RentalContract> live = jdbcTemplate.queryForList(
                        "SELECT id FROM rental_contracts WHERE storage_unit_id = ? " +
                                "AND status IN ('PENDING_CHECK_IN', 'ACTIVE', 'OVERDUE', 'TERMINATION_PENDING')",
                        Integer.class, unitId).stream()
                .map(id -> rentalContractRepository.findDetailById(id).orElse(null))
                .filter(java.util.Objects::nonNull)
                .toList();
        String reading = temperature.setScale(1, RoundingMode.HALF_UP) + "°C, độ ẩm " + humidity.setScale(0, RoundingMode.HALF_UP) + "%";
        String refKey = "SENSOR:" + unitId + ":" + LocalDateTime.now().withMinute(0).withSecond(0).withNano(0);
        Integer facilityId = jdbcTemplate.queryForObject("SELECT facility_id FROM storage_units WHERE id = ?", Integer.class, unitId);

        if (notificationService != null && facilityId != null) {
            notificationService.notifyFacilityManagersOnce(facilityId, refKey,
                    "Cảnh báo nhiệt độ / độ ẩm ô " + unitId,
                    "Cảm biến ghi nhận " + reading + " lúc " + LocalDateTime.now().format(TS_FMT)
                            + " (ngưỡng an toàn 15–30°C, độ ẩm ≤ 75%). Đã sinh việc kiểm tra cho nhân viên.",
                    "TASK", "/manager/tasks");
        }
        for (RentalContract c : live) {
            if (notificationService != null && c.getCustomer() != null) {
                notificationService.notifyCustomer(c.getCustomer().getId(), refKey,
                        "Cảnh báo môi trường ô kho " + unitId,
                        "Cảm biến ô của bạn ghi nhận " + reading + ", vượt ngưỡng an toàn. Nhân viên cơ sở đang kiểm tra. "
                                + "Nếu hàng bị ảnh hưởng, bạn có thể gửi yêu cầu hỗ trợ \"Hàng bị hư hỏng\" để được xem xét bồi thường.",
                        "OVERDUE",
                        c.getReservation() != null ? "/kho-cua-toi/hop-dong/" + c.getReservation().getId() : "/kho-cua-toi");
            }
            if (staffTaskService != null) {
                staffTaskService.createMaintenanceTask(c, "SENSOR",
                        "Kiểm tra điều hoà / hút ẩm ô " + unitId + ": cảm biến ghi nhận " + reading
                                + ". Ô đang có khách thuê — không mở ô khi chưa báo khách.");
            }
        }
    }

    /** Giả lập: 6 giờ bình thường rồi 6 giờ vượt ngưỡng (nhiệt độ tăng dần tới 36°C, độ ẩm 88%) → xử lý cảnh báo */
    @Transactional
    public Map<String, Object> simulateAlert(String unitId) {
        LocalDateTime now = LocalDateTime.now();
        double[] temps = {24.5, 24.8, 25.1, 25.4, 25.9, 26.8, 28.4, 30.6, 32.3, 33.9, 35.2, 36.0};
        double[] hums = {58, 59, 60, 61, 63, 66, 70, 76, 80, 84, 86, 88};
        BigDecimal lastTemp = BigDecimal.ZERO;
        BigDecimal lastHum = BigDecimal.ZERO;
        for (int i = 0; i < temps.length; i++) {
            lastTemp = BigDecimal.valueOf(temps[i]);
            lastHum = BigDecimal.valueOf(hums[i]);
            recordReading(unitId, lastTemp, lastHum, now.minusHours(temps.length - 1 - i));
        }
        handleAlert(unitId, lastTemp, lastHum);
        return Map.of("storageUnitId", unitId, "temperature", lastTemp, "humidity", lastHum);
    }
}
