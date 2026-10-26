package com.queenkho.api.security;

import com.queenkho.api.service.SessionTokenService;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

// PR-90: cổng kiểm soát request — xác thực token, chặn sai vai trò, ghi đè danh tính theo token
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AccessControlFilterTest {

    @Mock SessionTokenService sessions;
    @Mock JdbcTemplate jdbcTemplate;

    AccessControlFilter filter;

    @BeforeEach
    void setUp() {
        filter = new AccessControlFilter(new AccessPolicy(), sessions, jdbcTemplate);
    }

    private void loggedIn(String token, CurrentUser user, String status) {
        when(sessions.findUserId("Bearer " + token)).thenReturn(user.id());
        when(jdbcTemplate.query(anyString(), any(RowMapper.class), eq(user.id())))
                .thenReturn(List.of(new AccessControlFilter.UserRow(user, status)));
    }

    private MockHttpServletRequest request(String method, String uri, String token) {
        MockHttpServletRequest request = new MockHttpServletRequest(method, uri);
        request.setRequestURI(uri);
        if (token != null) {
            request.addHeader("Authorization", "Bearer " + token);
        }
        request.addHeader("Origin", "http://localhost:5173");
        return request;
    }

    @Test
    @DisplayName("API công khai đi qua không cần token")
    void publicEndpointPassesWithoutToken() throws Exception {
        MockFilterChain chain = new MockFilterChain();
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request("GET", "/api/v1/facilities/search", null), response, chain);
        assertNotNull(chain.getRequest());
        assertEquals(200, response.getStatus());
    }

    @Test
    @DisplayName("Thiếu / sai token → 401 JSON có header CORS (FE đọc được và đưa về trang đăng nhập)")
    void missingTokenReturns401() throws Exception {
        MockFilterChain chain = new MockFilterChain();
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request("GET", "/api/v1/reservations/my", null), response, chain);
        assertNull(chain.getRequest());
        assertEquals(401, response.getStatus());
        assertTrue(response.getContentAsString().contains("\"error\":\"UNAUTHORIZED\""));
        assertEquals("http://localhost:5173", response.getHeader("Access-Control-Allow-Origin"));
    }

    @Test
    @DisplayName("Khách gọi API bảng việc nhân viên → 403 FORBIDDEN_ROLE")
    void wrongRoleReturns403() throws Exception {
        loggedIn("kh", new CurrentUser(1, "CUSTOMER", null, "Khách 1", "kh1@x.com"), "ACTIVE");
        MockFilterChain chain = new MockFilterChain();
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request("GET", "/api/v1/staff-tasks", "kh"), response, chain);
        assertNull(chain.getRequest());
        assertEquals(403, response.getStatus());
        assertTrue(response.getContentAsString().contains("FORBIDDEN_ROLE"));
    }

    @Test
    @DisplayName("Tài khoản bị khoá giữa phiên → 401 ACCOUNT_LOCKED và huỷ token")
    void lockedAccountIsKickedOut() throws Exception {
        loggedIn("st", new CurrentUser(12, "STAFF", 1, "Staff", "st@x.com"), "LOCKED");
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request("GET", "/api/v1/staff-tasks", "st"), response, new MockFilterChain());
        assertEquals(401, response.getStatus());
        assertTrue(response.getContentAsString().contains("ACCOUNT_LOCKED"));
        verify(sessions).revoke("Bearer st");
    }

    @Test
    @DisplayName("Khách sửa ?customerId=2 trên URL → controller vẫn nhận id của chính mình")
    void customerIdIsOverriddenByToken() throws Exception {
        loggedIn("kh", new CurrentUser(1, "CUSTOMER", null, "Khách 1", "kh1@x.com"), "ACTIVE");
        MockHttpServletRequest req = request("GET", "/api/v1/reservations/my", "kh");
        req.addParameter("customerId", "2");
        MockFilterChain chain = new MockFilterChain();
        filter.doFilter(req, new MockHttpServletResponse(), chain);
        HttpServletRequest passed = (HttpServletRequest) chain.getRequest();
        assertEquals("1", passed.getParameter("customerId"));
        assertArrayEquals(new String[]{"1"}, passed.getParameterValues("customerId"));
        assertEquals("1", passed.getParameterMap().get("customerId")[0]);
        assertEquals("1", passed.getHeader("X-User-Id"));
        CurrentUser attached = (CurrentUser) passed.getAttribute(CurrentUser.REQUEST_ATTRIBUTE);
        assertEquals(1, attached.id());
    }

    @Test
    @DisplayName("FM bị khoá vào cơ sở được gán: ?facilityId=2 và X-Facility-Id bị thay bằng cơ sở 1")
    void managerFacilityIsForced() throws Exception {
        loggedIn("fm", new CurrentUser(6, "FACILITY_MANAGER", 1, "FM", "fm@x.com"), "ACTIVE");
        MockHttpServletRequest req = request("GET", "/api/v1/storage-units", "fm");
        req.addParameter("facilityId", "2");
        req.addHeader("X-Facility-Id", "2");
        MockFilterChain chain = new MockFilterChain();
        filter.doFilter(req, new MockHttpServletResponse(), chain);
        HttpServletRequest passed = (HttpServletRequest) chain.getRequest();
        assertEquals("1", passed.getParameter("facilityId"));
        assertEquals("1", passed.getHeader("x-facility-id"));
        assertEquals("6", passed.getParameter("managerId"));
        assertNull(passed.getParameter("staffId"), "FM chọn nhân viên qua staffId → không được ghi đè");
    }

    @Test
    @DisplayName("FM gọi báo cáo doanh thu không truyền facilityId → vẫn bị lọc theo cơ sở của mình")
    void managerRevenueIsScopedEvenWithoutParam() throws Exception {
        loggedIn("fm", new CurrentUser(6, "FACILITY_MANAGER", 3, "FM", "fm@x.com"), "ACTIVE");
        MockFilterChain chain = new MockFilterChain();
        filter.doFilter(request("GET", "/api/v1/bom/revenue/overview", "fm"), new MockHttpServletResponse(), chain);
        assertEquals("3", ((HttpServletRequest) chain.getRequest()).getParameter("facilityId"));
    }

    @Test
    @DisplayName("Màn nhật ký Admin: userId là bộ lọc theo người → không bị ghi đè")
    void adminLogFilterUserIdIsKept() throws Exception {
        loggedIn("ad", new CurrentUser(31, "ADMIN", null, "Admin", "ad@x.com"), "ACTIVE");
        MockHttpServletRequest req = request("GET", "/api/v1/admin/activity-logs", "ad");
        req.addParameter("userId", "12");
        MockFilterChain chain = new MockFilterChain();
        filter.doFilter(req, new MockHttpServletResponse(), chain);
        HttpServletRequest passed = (HttpServletRequest) chain.getRequest();
        assertEquals("12", passed.getParameter("userId"));
        assertEquals("31", passed.getParameter("actorUserId"));
    }

    @Test
    @DisplayName("API chưa khai báo quyền → 403 API_NOT_DECLARED")
    void undeclaredApiIsRejected() throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request("GET", "/api/v1/khong-co", "x"), response, new MockFilterChain());
        assertEquals(403, response.getStatus());
        assertTrue(response.getContentAsString().contains("API_NOT_DECLARED"));
    }

    @Test
    @DisplayName("Preflight OPTIONS và file /uploads không đi qua filter")
    void optionsAndStaticFilesAreSkipped() throws Exception {
        MockFilterChain chain = new MockFilterChain();
        filter.doFilter(request("OPTIONS", "/api/v1/staff-tasks", null), new MockHttpServletResponse(), chain);
        assertNotNull(chain.getRequest());
        MockFilterChain chain2 = new MockFilterChain();
        filter.doFilter(request("GET", "/uploads/a.png", null), new MockHttpServletResponse(), chain2);
        assertNotNull(chain2.getRequest());
    }
}
