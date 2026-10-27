package com.queenkho.api.security;

import org.springframework.stereotype.Component;
import org.springframework.util.AntPathMatcher;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * PR-90 / Admin "phân quyền dữ liệu theo vai trò & cơ sở": bảng quyền DUY NHẤT của hệ thống.
 *  - AccessControlFilter dùng bảng này để chặn từng request (sai vai trò → 403).
 *  - Admin xem lại đúng bảng này ở /admin/roles (ma trận quyền) → ma trận luôn khớp với thứ backend đang áp dụng.
 *
 * Mỗi API thuộc 1 nhóm quyền; mỗi nhóm ghi vai trò nào được dùng và phạm vi dữ liệu của vai trò đó:
 *  - "Của chính mình"  : khách chỉ thấy đơn / hợp đồng / ticket của mình
 *  - "Cơ sở được gán"  : Staff / FM chỉ thấy dữ liệu cơ sở trong tài khoản (Admin gán ở UC-08)
 *  - "Toàn hệ thống"   : BOM / Admin
 * Phạm vi được thực thi bởi AccessControlFilter (ghi đè id/cơ sở theo token) + OwnershipGuard.
 */
@Component
public class AccessPolicy {

    public static final String PUBLIC = "PUBLIC";               // không cần đăng nhập
    public static final String AUTHENTICATED = "AUTHENTICATED"; // đăng nhập là được, mọi vai trò

    public static final String OWN = "Của chính mình";
    public static final String FACILITY = "Cơ sở được gán";
    public static final String SYSTEM = "Toàn hệ thống";

    public record PermissionGroup(String code, String name, String description, Map<String, String> roleScopes) {
        public boolean allows(String role) {
            return roleScopes.containsKey(role);
        }
    }

    // method = null → mọi HTTP method
    public record Rule(String method, String pattern, String groupCode) {}

    private final AntPathMatcher matcher = new AntPathMatcher();
    private final Map<String, PermissionGroup> groups = new LinkedHashMap<>();
    private final List<Rule> rules = new ArrayList<>();

    public AccessPolicy() {
        // ---------- Nhóm quyền (thứ tự = thứ tự hiển thị ở ma trận Admin) ----------
        group("CUSTOMER_BOOKING", "Tìm & đặt kho, thanh toán cọc",
                "Flow 1: tạo đơn, trả cọc VNPAY, xem / huỷ đơn của mình", scopes("CUSTOMER", OWN));
        group("CUSTOMER_RENTAL", "Kho đang thuê: gia hạn, trả kho",
                "Flow 3 / 6: gia hạn qua VNPAY, yêu cầu / huỷ trả kho", scopes("CUSTOMER", OWN));
        group("CUSTOMER_PAYMENT", "Lịch sử thanh toán & trả khoản nợ",
                "UC-20: mọi giao dịch của khách, trả phí sự cố còn nợ", scopes("CUSTOMER", OWN));
        group("CUSTOMER_SUPPORT", "Gửi yêu cầu hỗ trợ",
                "Flow 7: khoá, mã ra vào, thanh toán, đồ lưu kho...", scopes("CUSTOMER", OWN));
        group("CONTRACT_VIEW", "Xem hợp đồng thuê",
                "Chi tiết hợp đồng, PIN, ngày hết hạn, tiền đã đóng",
                scopes("CUSTOMER", OWN, "STAFF", FACILITY, "FACILITY_MANAGER", FACILITY));
        group("TASK_BOARD", "Bảng công việc, nhận việc, báo cáo liên hệ",
                "Flow 2: danh sách khách cần nhận kho / trả kho / hỗ trợ trong ngày",
                scopes("STAFF", FACILITY, "FACILITY_MANAGER", FACILITY));
        group("TASK_EXECUTE", "Check-in, nghiệm thu trả kho, xử lý sự cố",
                "Flow 2 / 3 / 7: lập biên bản, cấp PIN / thẻ, ghi sự cố, cấp lại PIN", scopes("STAFF", FACILITY));
        group("TASK_MANAGE", "Giao / gỡ việc, gia hạn hỗ trợ, xác nhận hoàn tiền",
                "Flow 5: phân công nhân viên cho bàn giao, nghiệm thu, hỗ trợ", scopes("FACILITY_MANAGER", FACILITY));
        group("TASK_MAINTENANCE", "Bảo trì ô kho: sửa xong / dọn xong",
                "PR-O10: đóng task bảo trì sau trả kho có sự cố hoặc sau thanh lý, ô quay về sẵn sàng cho thuê",
                scopes("STAFF", FACILITY, "FACILITY_MANAGER", FACILITY));
        group("HELD_GOODS_MANAGE", "Hàng lưu giữ sau thanh lý",
                "PR-Q10: trả khách, bán thanh lý, tiêu huỷ, giao cơ quan chức năng", scopes("FACILITY_MANAGER", FACILITY));
        group("RESERVATION_MANAGE", "Duyệt đơn, gán ô, No-Show, dời lịch",
                "Flow 1 / 2: gán ô đúng loại cho đơn đã cọc", scopes("FACILITY_MANAGER", FACILITY));
        group("CONTRACT_MANAGE", "Quá hạn: liên hệ, miễn phí trễ, thanh lý",
                "Flow 6: theo dõi hợp đồng quá hạn của cơ sở", scopes("FACILITY_MANAGER", FACILITY));
        group("STORAGE_MANAGE", "Danh mục ô kho",
                "Flow 5: loại, kích thước, vị trí, giá, trạng thái ô", scopes("FACILITY_MANAGER", FACILITY));
        group("STAFF_MANAGE", "Quản lý nhân viên cơ sở",
                "Flow 5: tạo / khoá tài khoản Staff, đặt lại mật khẩu", scopes("FACILITY_MANAGER", FACILITY));
        group("FACILITY_REPORT", "Dashboard & báo cáo doanh thu, lấp đầy",
                "Flow 4 / 5: ô trống, ô đang thuê, doanh thu, tỷ lệ sử dụng, quá hạn",
                scopes("FACILITY_MANAGER", FACILITY, "BOM", SYSTEM));
        group("POLICY_VIEW", "Xem chính sách thuê",
                "Cọc, huỷ, phí trễ, ưu đãi, thanh lý", scopes("FACILITY_MANAGER", FACILITY, "BOM", SYSTEM));
        group("BOM_CATALOG", "Cơ sở, loại kho & bảng giá, chính sách (sửa)",
                "Flow 4: quản lý danh mục và quy định chung", scopes("BOM", SYSTEM));
        group("BOM_REVENUE", "So sánh doanh thu giữa các cơ sở",
                "Flow 4: hiệu quả vận hành từng cơ sở", scopes("BOM", SYSTEM));
        group("ADMIN_ACCOUNTS", "Tài khoản người dùng & vai trò",
                "Tạo / khoá tài khoản, gán vai trò và cơ sở", scopes("ADMIN", SYSTEM));
        group("ADMIN_AUDIT", "Nhật ký hoạt động & lịch sử đăng nhập",
                "Theo dõi ai làm gì, đăng nhập lúc nào, từ đâu", scopes("ADMIN", SYSTEM));
        // Demo: nút "⚡ Giả lập" tua thời gian (tắt bằng queenkho.simulation.enabled=false)
        group("DEV_SIM_CHECKIN", "Giả lập demo: khách tới nhận / trả kho hôm nay",
                "Dời lịch hẹn về hôm nay để check-in / nghiệm thu trả kho ngay", scopes("STAFF", FACILITY, "FACILITY_MANAGER", FACILITY));
        group("DEV_SIM_CUSTOMER", "Giả lập demo: giữ chỗ 15 phút, ticket tự đóng",
                "Tua giờ để thấy job tự huỷ đơn / tự đóng ticket", scopes("CUSTOMER", OWN, "FACILITY_MANAGER", FACILITY));
        group("DEV_SIM_MANAGER", "Giả lập demo: No-Show, quá hạn, thanh lý",
                "Tua 48h / 3 ngày / 31 ngày để demo chế tài", scopes("FACILITY_MANAGER", FACILITY));

        // ---------- Luật: khớp từ trên xuống, luật đầu tiên khớp được dùng ----------
        // Công khai
        rule("POST", "/api/v1/auth/login", PUBLIC);
        rule("POST", "/api/v1/auth/register", PUBLIC);
        rule("GET", "/api/v1/facilities", PUBLIC);
        rule("GET", "/api/v1/facilities/search", PUBLIC);
        rule("GET", "/api/v1/facilities/cities", PUBLIC);
        rule("GET", "/api/v1/facilities/{id:\\d+}/availability", PUBLIC);
        rule("GET", "/api/v1/facilities/{id:\\d+}/pricing", PUBLIC);
        rule("GET", "/api/v1/unit-types", PUBLIC);
        rule("GET", "/api/payments/vnpay/return", PUBLIC);
        rule("GET", "/api/payments/vnpay/ipn", PUBLIC);
        // Đăng xuất tự đọc token: token đã hết hạn vẫn trả 200 (FE không bị kẹt vòng lặp 401)
        rule("POST", "/api/v1/auth/logout", PUBLIC);

        // Đăng nhập là được
        rule("POST", "/api/v1/uploads", AUTHENTICATED);

        // Khách hàng
        rule("POST", "/api/v1/reservations", "CUSTOMER_BOOKING");
        rule("GET", "/api/v1/reservations/my", "CUSTOMER_BOOKING");
        rule("GET", "/api/v1/reservations/{id}/cancel-preview", "CUSTOMER_BOOKING");
        rule("POST", "/api/v1/reservations/{id}/cancel", "CUSTOMER_BOOKING");
        rule("POST", "/api/payments/vnpay/create", "CUSTOMER_BOOKING");
        rule("POST", "/api/v1/contracts/{id}/request-checkout", "CUSTOMER_RENTAL");
        rule("POST", "/api/v1/contracts/{id}/cancel-checkout", "CUSTOMER_RENTAL");
        rule("GET", "/api/v1/contracts/{id}/renewal-quote", "CUSTOMER_RENTAL");
        rule("POST", "/api/payments/vnpay/create-renewal", "CUSTOMER_RENTAL");
        rule("GET", "/api/v1/payments/my", "CUSTOMER_PAYMENT");
        rule("POST", "/api/payments/vnpay/create-debt", "CUSTOMER_PAYMENT");
        rule("GET", "/api/payments/vnpay/status/**", "CUSTOMER_PAYMENT");
        rule(null, "/api/v1/support-requests/**", "CUSTOMER_SUPPORT");

        // Hợp đồng
        rule("GET", "/api/v1/contracts", "CONTRACT_VIEW");
        rule("GET", "/api/v1/contracts/manager/overdue", "CONTRACT_MANAGE");
        rule("GET", "/api/v1/contracts/{id:\\d+}", "CONTRACT_VIEW");
        rule(null, "/api/v1/contracts/{id}/overdue-contacts", "CONTRACT_MANAGE");
        rule("POST", "/api/v1/contracts/{id}/liquidate", "CONTRACT_MANAGE");
        rule("POST", "/api/v1/contracts/{id}/refund-remaining-deposit", "CONTRACT_MANAGE");
        rule("POST", "/api/v1/contracts/{id}/waive-late-fee", "CONTRACT_MANAGE");

        // Đơn đặt chỗ phía quản lý
        rule("GET", "/api/v1/reservations/pending", "RESERVATION_MANAGE");
        rule("GET", "/api/v1/reservations/overdue-no-show", "RESERVATION_MANAGE");
        rule("GET", "/api/v1/reservations/{id}/available-units", "RESERVATION_MANAGE");
        rule("POST", "/api/v1/reservations/{id}/assign", "RESERVATION_MANAGE");
        rule("POST", "/api/v1/reservations/{id}/no-show", "RESERVATION_MANAGE");
        rule("PUT", "/api/v1/reservations/{id}/reschedule", "RESERVATION_MANAGE");

        // Công việc
        rule("POST", "/api/v1/staff-tasks/{id}/assign", "TASK_MANAGE");
        rule("POST", "/api/v1/staff-tasks/{id}/unassign", "TASK_MANAGE");
        rule("POST", "/api/v1/staff-tasks/{id}/extend-support", "TASK_MANAGE");
        rule("POST", "/api/v1/staff-tasks/{id}/complete-refund", "TASK_MANAGE");
        rule("GET", "/api/v1/staff-tasks/pin-suggestion", "TASK_EXECUTE");
        rule("POST", "/api/v1/staff-tasks/{id}/check-in", "TASK_EXECUTE");
        rule("POST", "/api/v1/staff-tasks/{id}/check-out", "TASK_EXECUTE");
        rule("POST", "/api/v1/staff-tasks/{id}/resolve-support", "TASK_EXECUTE");
        rule("POST", "/api/v1/staff-tasks/{id}/reset-pin", "TASK_EXECUTE");
        rule("POST", "/api/v1/staff-tasks/{id}/complete-maintenance", "TASK_MAINTENANCE");
        rule("GET", "/api/v1/staff-tasks", "TASK_BOARD");
        rule("GET", "/api/v1/staff-tasks/{id:\\d+}", "TASK_BOARD");
        rule("POST", "/api/v1/staff-tasks/{id}/claim", "TASK_BOARD");
        rule("POST", "/api/v1/staff-tasks/{id}/contact-report", "TASK_BOARD");

        // Hàng lưu giữ sau thanh lý
        rule("GET", "/api/v1/held-goods", "HELD_GOODS_MANAGE");
        rule("POST", "/api/v1/held-goods/{id}/resolve", "HELD_GOODS_MANAGE");

        // Cơ sở: ô kho, nhân viên, báo cáo
        rule(null, "/api/v1/storage-units/**", "STORAGE_MANAGE");
        rule(null, "/api/v1/manager/staff/**", "STAFF_MANAGE");
        rule("GET", "/api/v1/facilities/{id:\\d+}/dashboard", "FACILITY_REPORT");
        rule("GET", "/api/v1/bom/revenue/overview", "FACILITY_REPORT");
        rule("GET", "/api/v1/bom/revenue/timeline", "FACILITY_REPORT");
        rule("GET", "/api/v1/bom/revenue/by-unit-type", "FACILITY_REPORT");
        rule("GET", "/api/v1/bom/revenue/transactions", "FACILITY_REPORT");
        rule("GET", "/api/v1/bom/revenue/occupancy", "FACILITY_REPORT");
        rule("GET", "/api/v1/bom/revenue/by-facility", "BOM_REVENUE");

        // BOM
        rule("GET", "/api/v1/rental-policies/**", "POLICY_VIEW");
        rule("POST", "/api/v1/rental-policies/**", "BOM_CATALOG");
        rule(null, "/api/v1/facilities/bom/**", "BOM_CATALOG");
        rule(null, "/api/v1/unit-types/**", "BOM_CATALOG");

        // Admin
        rule(null, "/api/v1/admin/users/**", "ADMIN_ACCOUNTS");
        rule(null, "/api/v1/admin/roles/**", "ADMIN_ACCOUNTS");
        rule(null, "/api/v1/admin/activity-logs/**", "ADMIN_AUDIT");
        rule(null, "/api/v1/admin/login-history/**", "ADMIN_AUDIT");
        rule(null, "/api/v1/admin/dashboard/**", "ADMIN_AUDIT");

        // Demo giả lập
        rule("GET", "/api/v1/dev/simulation/status", AUTHENTICATED);
        rule("POST", "/api/v1/dev/simulation/tasks/{id}/arrive-today", "DEV_SIM_CHECKIN");
        rule("POST", "/api/v1/dev/simulation/tasks/{id}/checkout-today", "DEV_SIM_CHECKIN");
        rule("POST", "/api/v1/dev/simulation/contracts/{id}/add-failed-contacts", "DEV_SIM_MANAGER");
        rule("POST", "/api/v1/dev/simulation/held-goods/{id}/expire-hold", "DEV_SIM_MANAGER");
        rule("POST", "/api/v1/dev/simulation/reservations/{id}/expire-hold", "DEV_SIM_CUSTOMER");
        rule("POST", "/api/v1/dev/simulation/support-requests/{id}/auto-close", "DEV_SIM_CUSTOMER");
        rule("POST", "/api/v1/dev/simulation/reservations/{id}/trigger-noshow", "DEV_SIM_MANAGER");
        rule("POST", "/api/v1/dev/simulation/contracts/{id}/make-overdue", "DEV_SIM_MANAGER");
    }

    private static Map<String, String> scopes(String... roleAndScope) {
        Map<String, String> map = new LinkedHashMap<>();
        for (int i = 0; i < roleAndScope.length; i += 2) {
            map.put(roleAndScope[i], roleAndScope[i + 1]);
        }
        return map;
    }

    private void group(String code, String name, String description, Map<String, String> roleScopes) {
        groups.put(code, new PermissionGroup(code, name, description, roleScopes));
    }

    private void rule(String method, String pattern, String groupCode) {
        if (!PUBLIC.equals(groupCode) && !AUTHENTICATED.equals(groupCode) && !groups.containsKey(groupCode)) {
            throw new IllegalStateException("Nhóm quyền chưa khai báo: " + groupCode);
        }
        rules.add(new Rule(method, pattern, groupCode));
    }

    // Luật đầu tiên khớp method + path; rỗng = API chưa khai báo quyền → filter chặn
    public Optional<Rule> match(String method, String path) {
        for (Rule rule : rules) {
            boolean methodOk = rule.method() == null || rule.method().equalsIgnoreCase(method);
            if (methodOk && matcher.match(rule.pattern(), path)) {
                return Optional.of(rule);
            }
        }
        return Optional.empty();
    }

    public Optional<PermissionGroup> group(String code) {
        return Optional.ofNullable(groups.get(code));
    }

    public boolean allows(Rule rule, String role) {
        if (PUBLIC.equals(rule.groupCode()) || AUTHENTICATED.equals(rule.groupCode())) {
            return true;
        }
        PermissionGroup group = groups.get(rule.groupCode());
        return group != null && group.allows(role);
    }

    // Ma trận cho Admin (/admin/roles)
    public List<PermissionGroup> groups() {
        return List.copyOf(groups.values());
    }

    public List<Rule> rules() {
        return List.copyOf(rules);
    }
}
