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
 *  - Ngưỡng an toàn theo loại kho (unit_types.temperature_class, sửa 06/11/2026):
 *      kho thường NORMAL 15–30°C, độ ẩm ≤ 75% · kho lạnh COLD 0–8°C, ≤ 90% · kho đông FROZEN -25 → -15°C, ≤ 95%.
 *    Vượt ngưỡng → bản ghi is_alert = 1.
 *  - Có cảnh báo trên ô đang cho thuê → báo khách (+ email) và FM, sinh task bảo trì lý do SENSOR (ô vẫn OCCUPIED).
 *  - Hồ sơ bồi thường (BR-127) xem số liệu quanh ngày xảy ra sự cố để xác định lỗi cơ sở.
 */
@Service
public class UnitSensorService {

    /** Ngưỡng an toàn của 1 loại kho */
    public record Thresholds(BigDecimal tempMin, BigDecimal tempMax, BigDecimal humidityMax) {
        String describe() {
            String range = tempMin.signum() < 0 ? tempMin.toPlainString() + " → " + tempMax.toPlainString()
                    : tempMin.toPlainString() + "–" + tempMax.toPlainString();
            return range + "°C, độ ẩm ≤ " + humidityMax.toPlainString() + "%";
        }
    }

    // Kho thường (giữ tên hằng cũ cho các chỗ đang dùng)
    public static final BigDecimal TEMP_MIN = BigDecimal.valueOf(15);
    public static final BigDecimal TEMP_MAX = BigDecimal.valueOf(30);
    public static final BigDecimal HUMIDITY_MAX = BigDecimal.valueOf(75);
    public static final Thresholds NORMAL = new Thresholds(TEMP_MIN, TEMP_MAX, HUMIDITY_MAX);
    public static final Thresholds COLD = new Thresholds(BigDecimal.ZERO, BigDecimal.valueOf(8), BigDecimal.valueOf(90));
    public static final Thresholds FROZEN = new Thresholds(BigDecimal.valueOf(-25), BigDecimal.valueOf(-15), BigDecimal.valueOf(95));
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

    public static Thresholds thresholdsFor(String temperatureClass) {
        if ("COLD".equals(temperatureClass)) return COLD;
        if ("FROZEN".equals(temperatureClass)) return FROZEN;
        return NORMAL;
    }

    /** Ngưỡng kho thường */
    public static boolean isAlert(BigDecimal temperature, BigDecimal humidity) {
        return isAlert(temperature, humidity, NORMAL);
    }

    public static boolean isAlert(BigDecimal temperature, BigDecimal humidity, Thresholds t) {
        return temperature.compareTo(t.tempMax()) > 0 || temperature.compareTo(t.tempMin()) < 0
                || humidity.compareTo(t.humidityMax()) > 0;
    }

    /** Loại kho nhiệt độ của ô (NORMAL khi không rõ) */
    String temperatureClassOf(String unitId) {
        List<String> rows = jdbcTemplate.queryForList(
                "SELECT ut.temperature_class FROM storage_units su JOIN unit_types ut ON ut.id = su.unit_type_id WHERE su.id = ?",
                String.class, unitId);
        return rows == null || rows.isEmpty() || rows.get(0) == null ? "NORMAL" : rows.get(0);
    }

    /** Ghi 1 số đo (thiết bị / giả lập). Không tự xử lý cảnh báo — gọi {@link #handleAlert} sau khi ghi xong đợt đo */
    @Transactional
    public boolean recordReading(String unitId, BigDecimal temperature, BigDecimal humidity, LocalDateTime at) {
        boolean alert = isAlert(temperature, humidity, thresholdsFor(temperatureClassOf(unitId)));
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
        String temperatureClass = temperatureClassOf(unitId);
        Thresholds t = thresholdsFor(temperatureClass);
        result.put("temperatureClass", temperatureClass);
        result.put("tempMin", t.tempMin());
        result.put("tempMax", t.tempMax());
        result.put("humidityMax", t.humidityMax());
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
        String temperatureClass = temperatureClassOf(unitId);
        boolean refrigerated = !"NORMAL".equals(temperatureClass);
        String limits = thresholdsFor(temperatureClass).describe();
        String equipment = refrigerated ? "máy lạnh / máy nén" : "điều hoà / hút ẩm";

        if (notificationService != null && facilityId != null) {
            notificationService.notifyFacilityManagersOnce(facilityId, refKey,
                    "Cảnh báo nhiệt độ / độ ẩm ô " + unitId,
                    "Cảm biến ghi nhận " + reading + " lúc " + LocalDateTime.now().format(TS_FMT)
                            + " (ngưỡng an toàn " + limits + "). Đã sinh việc kiểm tra cho nhân viên.",
                    "TASK", "/manager/tasks");
        }
        for (RentalContract c : live) {
            if (notificationService != null && c.getCustomer() != null) {
                notificationService.notifyCustomer(c.getCustomer().getId(), refKey,
                        "Cảnh báo môi trường ô kho " + unitId,
                        "Cảm biến ô của bạn ghi nhận " + reading + ", vượt ngưỡng an toàn (" + limits + "). Nhân viên cơ sở đang kiểm tra. "
                                + "Nếu hàng bị ảnh hưởng, bạn có thể gửi yêu cầu hỗ trợ \"Hàng bị hư hỏng\" để được xem xét bồi thường.",
                        "OVERDUE",
                        c.getReservation() != null ? "/kho-cua-toi/hop-dong/" + c.getReservation().getId() : "/kho-cua-toi");
            }
            if (staffTaskService != null) {
                staffTaskService.createMaintenanceTask(c, "SENSOR",
                        "Kiểm tra " + equipment + " ô " + unitId + ": cảm biến ghi nhận " + reading
                                + ". Ô đang có khách thuê — không mở ô khi chưa báo khách.");
            }
        }
    }

    /**
     * Giả lập: 6 giờ bình thường rồi 6 giờ vượt ngưỡng → xử lý cảnh báo.
     * Kho thường: nóng / ẩm dần tới 36°C, 88% · kho lạnh: hỏng máy nén, ấm dần 4 → 14°C · kho đông: rã đông -19 → -8°C.
     */
    @Transactional
    public Map<String, Object> simulateAlert(String unitId) {
        LocalDateTime now = LocalDateTime.now();
        String temperatureClass = temperatureClassOf(unitId);
        double[] temps;
        double[] hums;
        if ("COLD".equals(temperatureClass)) {
            temps = new double[]{3.8, 4.0, 4.1, 4.3, 4.6, 5.4, 6.9, 8.6, 10.2, 11.8, 13.1, 14.0};
            hums = new double[]{82, 82, 83, 83, 84, 84, 85, 86, 86, 87, 87, 88};
        } else if ("FROZEN".equals(temperatureClass)) {
            temps = new double[]{-19.2, -19.0, -18.9, -18.6, -18.1, -17.0, -15.8, -14.3, -12.6, -10.9, -9.2, -8.0};
            hums = new double[]{85, 85, 86, 86, 86, 87, 87, 88, 89, 90, 91, 92};
        } else {
            temps = new double[]{24.5, 24.8, 25.1, 25.4, 25.9, 26.8, 28.4, 30.6, 32.3, 33.9, 35.2, 36.0};
            hums = new double[]{58, 59, 60, 61, 63, 66, 70, 76, 80, 84, 86, 88};
        }
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
