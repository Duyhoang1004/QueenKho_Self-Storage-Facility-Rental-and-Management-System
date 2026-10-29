package com.queenkho.api.security;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * PR-90: kiểm tra quyền trên TỪNG bản ghi được gọi theo id trên URL (/reservations/{id}, /contracts/{id}...).
 *  - CUSTOMER: chỉ bản ghi của chính mình            → sai: 403 FORBIDDEN_OWNER
 *  - STAFF / FACILITY_MANAGER: chỉ cơ sở được gán    → sai: 403 FORBIDDEN_FACILITY
 *  - BOM / ADMIN: không giới hạn (filter đã chặn vai trò không được dùng API)
 * Bản ghi không tồn tại → bỏ qua để service trả lỗi "không tìm thấy" như cũ.
 */
@Component
public class OwnershipGuard {

    private final CurrentUserProvider currentUser;
    private final JdbcTemplate jdbcTemplate;

    public OwnershipGuard(CurrentUserProvider currentUser, JdbcTemplate jdbcTemplate) {
        this.currentUser = currentUser;
        this.jdbcTemplate = jdbcTemplate;
    }

    public void checkReservation(Integer reservationId) {
        check(first("SELECT customer_id, facility_id FROM reservations WHERE id = ?", reservationId),
                "Đơn đặt chỗ không thuộc về bạn", "Đơn đặt chỗ không thuộc cơ sở của bạn");
    }

    public void checkContract(Integer contractId) {
        check(first("SELECT rc.customer_id, su.facility_id FROM rental_contracts rc " +
                        "JOIN storage_units su ON su.id = rc.storage_unit_id WHERE rc.id = ?", contractId),
                "Hợp đồng không thuộc về bạn", "Hợp đồng không thuộc cơ sở của bạn");
    }

    public void checkStorageUnit(String storageUnitId) {
        check(first("SELECT NULL AS customer_id, facility_id FROM storage_units WHERE id = ?", storageUnitId),
                "Ô kho không thuộc về bạn", "Ô kho không thuộc cơ sở của bạn");
    }

    // UC-06: mặt bằng tầng thuộc cơ sở nào
    public void checkFacilityFloor(Integer floorId) {
        check(first("SELECT NULL AS customer_id, facility_id FROM facility_floors WHERE id = ?", floorId),
                "Mặt bằng không thuộc về bạn", "Mặt bằng không thuộc cơ sở của bạn");
    }

    public void checkFacility(Integer facilityId) {
        CurrentUser user = currentUser.require();
        if (user.isFacilityScoped() && !Objects.equals(user.facilityId(), facilityId)) {
            throw AccessException.forbidden("FORBIDDEN_FACILITY", "Bạn chỉ xem được dữ liệu cơ sở của mình");
        }
    }

    private void check(Map<String, Object> row, String ownerMessage, String facilityMessage) {
        CurrentUser user = currentUser.require();
        if (row == null) {
            return;
        }
        if (user.hasRole("CUSTOMER") && !Objects.equals(toInt(row.get("customer_id")), user.id())) {
            throw AccessException.forbidden("FORBIDDEN_OWNER", ownerMessage);
        }
        if (user.isFacilityScoped() && !Objects.equals(toInt(row.get("facility_id")), user.facilityId())) {
            throw AccessException.forbidden("FORBIDDEN_FACILITY", facilityMessage);
        }
    }

    private Map<String, Object> first(String sql, Object id) {
        if (id == null) {
            return null;
        }
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, id);
        return rows.isEmpty() ? null : rows.get(0);
    }

    private static Integer toInt(Object value) {
        return value instanceof Number number ? number.intValue() : null;
    }
}
