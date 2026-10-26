package com.queenkho.api.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;

import java.util.Collections;
import java.util.Enumeration;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;

/**
 * PR-90: bọc request để các tham số danh tính (customerId, staffId, managerId, actorUserId, facilityId...)
 * và header X-User-Id / X-Facility-Id luôn mang giá trị lấy từ token.
 * → Client sửa ?customerId=2 trên URL cũng vô ích; controller cũ không phải sửa chữ ký hàm.
 */
public class IdentityRequestWrapper extends HttpServletRequestWrapper {

    private final Map<String, String> paramOverrides;
    private final Map<String, String> headerOverrides;

    public IdentityRequestWrapper(HttpServletRequest request,
                                  Map<String, String> paramOverrides,
                                  Map<String, String> headerOverrides) {
        super(request);
        this.paramOverrides = Map.copyOf(paramOverrides);
        // Tên header không phân biệt hoa thường
        Map<String, String> headers = new TreeMap<>(String.CASE_INSENSITIVE_ORDER);
        headers.putAll(headerOverrides);
        this.headerOverrides = Collections.unmodifiableMap(headers);
    }

    @Override
    public String getParameter(String name) {
        return paramOverrides.containsKey(name) ? paramOverrides.get(name) : super.getParameter(name);
    }

    @Override
    public String[] getParameterValues(String name) {
        return paramOverrides.containsKey(name)
                ? new String[]{paramOverrides.get(name)}
                : super.getParameterValues(name);
    }

    @Override
    public Map<String, String[]> getParameterMap() {
        Map<String, String[]> merged = new LinkedHashMap<>(super.getParameterMap());
        paramOverrides.forEach((key, value) -> merged.put(key, new String[]{value}));
        return Collections.unmodifiableMap(merged);
    }

    @Override
    public Enumeration<String> getParameterNames() {
        return Collections.enumeration(getParameterMap().keySet());
    }

    @Override
    public String getHeader(String name) {
        return headerOverrides.containsKey(name) ? headerOverrides.get(name) : super.getHeader(name);
    }

    @Override
    public Enumeration<String> getHeaders(String name) {
        return headerOverrides.containsKey(name)
                ? Collections.enumeration(List.of(headerOverrides.get(name)))
                : super.getHeaders(name);
    }

    @Override
    public Enumeration<String> getHeaderNames() {
        Set<String> names = new LinkedHashSet<>(Collections.list(super.getHeaderNames()));
        names.addAll(headerOverrides.keySet());
        return Collections.enumeration(names);
    }
}
