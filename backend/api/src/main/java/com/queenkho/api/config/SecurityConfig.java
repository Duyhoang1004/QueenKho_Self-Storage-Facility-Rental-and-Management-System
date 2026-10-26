package com.queenkho.api.config;

import com.queenkho.api.security.AccessControlFilter;
import com.queenkho.api.security.AccessPolicy;
import com.queenkho.api.service.SessionTokenService;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class SecurityConfig {

    // Spring Security chỉ còn dùng để băm mật khẩu. Xác thực + phân quyền nằm ở AccessControlFilter (PR-90)
    // vì token của dự án là opaque token tự quản (SessionTokenService), không phải session / JWT của Spring.
    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http.csrf(csrf -> csrf.disable())
                .authorizeHttpRequests(auth -> auth.anyRequest().permitAll());
        return http.build();
    }

    // PR-90: mọi request /api/* đi qua bảng quyền AccessPolicy
    @Bean
    public FilterRegistrationBean<AccessControlFilter> accessControlFilter(AccessPolicy policy,
                                                                           SessionTokenService sessions,
                                                                           JdbcTemplate jdbcTemplate) {
        FilterRegistrationBean<AccessControlFilter> registration =
                new FilterRegistrationBean<>(new AccessControlFilter(policy, sessions, jdbcTemplate));
        registration.addUrlPatterns("/api/*");
        registration.setName("accessControlFilter");
        registration.setOrder(10);
        return registration;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

}
