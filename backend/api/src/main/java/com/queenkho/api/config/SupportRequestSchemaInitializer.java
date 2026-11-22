package com.queenkho.api.config;

import org.springframework.beans.BeansException;
import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.context.annotation.Configuration;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.Statement;

/**
 * PR-S10 (UC-26/27): Tự động kiểm tra và bổ sung các cột resolution_note, resolved_at, closed_at
 * cho bảng support_requests trước khi Hibernate chạy ddl-auto: validate.
 */
@Configuration
public class SupportRequestSchemaInitializer implements BeanPostProcessor {

    private boolean initialized = false;

    @Override
    public Object postProcessAfterInitialization(Object bean, String beanName) throws BeansException {
        if (!initialized && bean instanceof DataSource dataSource) {
            initialized = true;
            try (Connection conn = dataSource.getConnection();
                 Statement stmt = conn.createStatement()) {
                stmt.execute(
                        "IF OBJECT_ID('support_requests', 'U') IS NOT NULL " +
                        "BEGIN " +
                        "  IF COL_LENGTH('support_requests', 'resolution_note') IS NULL " +
                        "    ALTER TABLE support_requests ADD resolution_note NVARCHAR(1000) NULL; " +
                        "  IF COL_LENGTH('support_requests', 'resolved_at') IS NULL " +
                        "    ALTER TABLE support_requests ADD resolved_at DATETIME2 NULL; " +
                        "  IF COL_LENGTH('support_requests', 'closed_at') IS NULL " +
                        "    ALTER TABLE support_requests ADD closed_at DATETIME2 NULL; " +
                        "  IF COL_LENGTH('support_requests', 'evidence_images') IS NULL " +
                        "    ALTER TABLE support_requests ADD evidence_images NVARCHAR(MAX) NULL; " +
                        "  IF COL_LENGTH('support_requests', 'sub_category') IS NULL " +
                        "    ALTER TABLE support_requests ADD sub_category NVARCHAR(100) NULL; " +
                        "END; " +
                        "IF OBJECT_ID('rental_contracts', 'U') IS NOT NULL " +
                        "BEGIN " +
                        "  IF COL_LENGTH('rental_contracts', 'reassign_request_status') IS NULL " +
                        "    ALTER TABLE rental_contracts ADD reassign_request_status NVARCHAR(30) NULL; " +
                        "  IF COL_LENGTH('rental_contracts', 'reassign_requested_months') IS NULL " +
                        "    ALTER TABLE rental_contracts ADD reassign_requested_months INT NULL; " +
                        "  IF COL_LENGTH('rental_contracts', 'reassign_requested_at') IS NULL " +
                        "    ALTER TABLE rental_contracts ADD reassign_requested_at DATETIME2 NULL; " +
                        "  IF COL_LENGTH('rental_contracts', 'reassign_assigned_unit_id') IS NULL " +
                        "    ALTER TABLE rental_contracts ADD reassign_assigned_unit_id VARCHAR(50) NULL; " +
                        "  IF COL_LENGTH('rental_contracts', 'reassign_note') IS NULL " +
                        "    ALTER TABLE rental_contracts ADD reassign_note NVARCHAR(500) NULL; " +
                        "  IF COL_LENGTH('rental_contracts', 'reassign_resolved_at') IS NULL " +
                        "    ALTER TABLE rental_contracts ADD reassign_resolved_at DATETIME2 NULL; " +
                        "END"
                );
            } catch (Exception e) {
                System.err.println("[QueenKho Schema] Warning checking support_requests columns: " + e.getMessage());
            }
        }
        return bean;
    }
}
