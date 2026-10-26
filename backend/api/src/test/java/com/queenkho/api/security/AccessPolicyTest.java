package com.queenkho.api.security;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.core.type.filter.AnnotationTypeFilter;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;

// PR-90: bảng quyền AccessPolicy — mọi API thật đều phải được khai báo, đúng vai trò được dùng đúng nhóm
class AccessPolicyTest {

    private final AccessPolicy policy = new AccessPolicy();

    private boolean allowed(String role, String method, String path) {
        return policy.match(method, path).map(rule -> policy.allows(rule, role)).orElse(false);
    }

    private boolean isPublic(String method, String path) {
        return policy.match(method, path).map(r -> AccessPolicy.PUBLIC.equals(r.groupCode())).orElse(false);
    }

    @Test
    @DisplayName("Mọi endpoint của mọi @RestController đều có luật trong bảng quyền (không có API 'quên khai báo')")
    void everyControllerEndpointIsDeclared() throws Exception {
        ClassPathScanningCandidateComponentProvider scanner = new ClassPathScanningCandidateComponentProvider(false);
        scanner.addIncludeFilter(new AnnotationTypeFilter(RestController.class));
        List<String> missing = new ArrayList<>();
        int checked = 0;
        for (BeanDefinition bd : scanner.findCandidateComponents("com.queenkho.api.controller")) {
            Class<?> controller = Class.forName(bd.getBeanClassName());
            RequestMapping classMapping = AnnotatedElementUtils.findMergedAnnotation(controller, RequestMapping.class);
            String[] prefixes = classMapping != null && classMapping.path().length > 0 ? classMapping.path() : new String[]{""};
            for (Method method : controller.getDeclaredMethods()) {
                RequestMapping mapping = AnnotatedElementUtils.findMergedAnnotation(method, RequestMapping.class);
                if (mapping == null) {
                    continue;
                }
                String[] paths = mapping.path().length > 0 ? mapping.path() : new String[]{""};
                RequestMethod[] methods = mapping.method().length > 0 ? mapping.method() : new RequestMethod[]{RequestMethod.GET};
                for (String prefix : prefixes) {
                    for (String path : paths) {
                        // {id} / {id:\d+} → giá trị mẫu "1"
                        String concrete = (prefix + path).replaceAll("\\{[^}]+}", "1");
                        for (RequestMethod httpMethod : methods) {
                            checked++;
                            if (policy.match(httpMethod.name(), concrete).isEmpty()) {
                                missing.add(httpMethod + " " + concrete + " (" + controller.getSimpleName() + "." + method.getName() + ")");
                            }
                        }
                    }
                }
            }
        }
        assertTrue(checked > 80, "Phải quét được toàn bộ endpoint, thực tế: " + checked);
        assertTrue(missing.isEmpty(), "Endpoint chưa khai báo quyền:\n" + String.join("\n", missing));
    }

    @Test
    @DisplayName("Nhóm quyền nào cũng có ít nhất 1 luật (ma trận Admin không hiện nhóm 'ma')")
    void everyGroupHasAtLeastOneRule() {
        Set<String> usedGroups = policy.rules().stream().map(AccessPolicy.Rule::groupCode).collect(Collectors.toSet());
        for (AccessPolicy.PermissionGroup group : policy.groups()) {
            assertTrue(usedGroups.contains(group.code()), "Nhóm không có luật: " + group.code());
        }
    }

    @Test
    @DisplayName("API công khai: tìm kho, xem giá, đăng nhập, IPN VNPAY — không cần đăng nhập")
    void publicEndpoints() {
        assertTrue(isPublic("GET", "/api/v1/facilities/search"));
        assertTrue(isPublic("GET", "/api/v1/facilities/1/availability"));
        assertTrue(isPublic("GET", "/api/v1/facilities/1/pricing"));
        assertTrue(isPublic("POST", "/api/v1/auth/login"));
        assertTrue(isPublic("GET", "/api/payments/vnpay/ipn"));
        assertFalse(isPublic("GET", "/api/v1/facilities/1/dashboard"));
        assertFalse(isPublic("GET", "/api/v1/unit-types/bom"));
    }

    @Test
    @DisplayName("Khách: đặt kho, hợp đồng của mình, thanh toán — không vào được việc nội bộ")
    void customerScope() {
        assertTrue(allowed("CUSTOMER", "POST", "/api/v1/reservations"));
        assertTrue(allowed("CUSTOMER", "GET", "/api/v1/payments/my"));
        assertTrue(allowed("CUSTOMER", "POST", "/api/payments/vnpay/create-debt"));
        assertTrue(allowed("CUSTOMER", "GET", "/api/v1/contracts/7"));
        assertFalse(allowed("CUSTOMER", "GET", "/api/v1/staff-tasks"));
        assertFalse(allowed("CUSTOMER", "POST", "/api/v1/reservations/7/assign"));
        assertFalse(allowed("CUSTOMER", "GET", "/api/v1/contracts/manager/overdue"));
        assertFalse(allowed("CUSTOMER", "GET", "/api/v1/admin/users"));
    }

    @Test
    @DisplayName("Staff: bảng việc + check-in/nghiệm thu; không giao việc, không gán ô, không xem doanh thu")
    void staffScope() {
        assertTrue(allowed("STAFF", "GET", "/api/v1/staff-tasks"));
        assertTrue(allowed("STAFF", "POST", "/api/v1/staff-tasks/3/check-in"));
        assertTrue(allowed("STAFF", "POST", "/api/v1/staff-tasks/3/claim"));
        assertFalse(allowed("STAFF", "POST", "/api/v1/staff-tasks/3/assign"));
        assertFalse(allowed("STAFF", "POST", "/api/v1/reservations/3/assign"));
        assertFalse(allowed("STAFF", "GET", "/api/v1/bom/revenue/overview"));
        assertFalse(allowed("STAFF", "POST", "/api/v1/reservations"));
    }

    @Test
    @DisplayName("FM: quản lý cơ sở + báo cáo cơ sở; không so sánh doanh thu toàn hệ thống, không sửa chính sách")
    void facilityManagerScope() {
        assertTrue(allowed("FACILITY_MANAGER", "POST", "/api/v1/staff-tasks/3/assign"));
        assertTrue(allowed("FACILITY_MANAGER", "POST", "/api/v1/contracts/3/waive-late-fee"));
        assertTrue(allowed("FACILITY_MANAGER", "GET", "/api/v1/bom/revenue/overview"));
        assertTrue(allowed("FACILITY_MANAGER", "GET", "/api/v1/rental-policies/facilities/1"));
        assertTrue(allowed("FACILITY_MANAGER", "GET", "/api/v1/storage-units"));
        assertFalse(allowed("FACILITY_MANAGER", "GET", "/api/v1/bom/revenue/by-facility"));
        assertFalse(allowed("FACILITY_MANAGER", "POST", "/api/v1/rental-policies/facilities/1"));
        assertFalse(allowed("FACILITY_MANAGER", "POST", "/api/v1/staff-tasks/3/check-in"));
        assertFalse(allowed("FACILITY_MANAGER", "PUT", "/api/v1/unit-types/bom/1"));
    }

    @Test
    @DisplayName("BOM toàn hệ thống; Admin chỉ quản trị tài khoản & nhật ký")
    void bomAndAdminScope() {
        assertTrue(allowed("BOM", "GET", "/api/v1/bom/revenue/by-facility"));
        assertTrue(allowed("BOM", "POST", "/api/v1/rental-policies/facilities/1"));
        assertTrue(allowed("BOM", "PUT", "/api/v1/facilities/bom/1"));
        assertFalse(allowed("BOM", "GET", "/api/v1/admin/users"));
        assertTrue(allowed("ADMIN", "GET", "/api/v1/admin/login-history"));
        assertTrue(allowed("ADMIN", "GET", "/api/v1/admin/roles/access-matrix"));
        assertFalse(allowed("ADMIN", "GET", "/api/v1/bom/revenue/overview"));
        assertFalse(allowed("ADMIN", "POST", "/api/v1/reservations"));
    }

    @Test
    @DisplayName("API không có trong bảng → không khớp luật nào (filter sẽ trả 403 API_NOT_DECLARED)")
    void undeclaredPathHasNoRule() {
        assertTrue(policy.match("GET", "/api/v1/khong-ton-tai").isEmpty());
        assertTrue(policy.match("DELETE", "/api/v1/reservations/1").isEmpty());
    }
}
