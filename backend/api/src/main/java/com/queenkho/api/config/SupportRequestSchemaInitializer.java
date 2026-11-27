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
                        "END; " +
                        "IF OBJECT_ID('unit_types', 'U') IS NOT NULL " +
                        "BEGIN " +
                        "  UPDATE unit_types SET suggested_capacity = N'Tương đương 1 phòng chứa đồ nhỏ / 1 xe bán tải' " +
                        "    WHERE name = N'Kho Mini M' AND suggested_capacity IN (N'10–20 thùng carton', N'10-20 thùng carton'); " +
                        "  UPDATE unit_types SET suggested_capacity = N'Tương đương 1 phòng trọ nhỏ / 1 xe tải 1 tấn' " +
                        "    WHERE name = N'Kho Tiêu Chuẩn' AND suggested_capacity IN (N'20–40 thùng, nội thất nhỏ', N'20-40 thùng, nội thất nhỏ'); " +
                        "  UPDATE unit_types SET features = N'Nội thất gọn, đồ gia dụng & hàng shop online' " +
                        "    WHERE name = N'Kho Tiêu Chuẩn' AND features IN (N'Phổ biến nhất, phù hợp chuyển nhà', N'Chuyển nhà, nội thất gọn & hàng shop online'); " +
                        "  UPDATE unit_types SET suggested_capacity = N'Tương đương đồ căn hộ 1 phòng ngủ' " +
                        "    WHERE name = N'Kho Gia Đình' AND suggested_capacity = N'Đồ 1 phòng ngủ hoặc VP nhỏ'; " +
                        "  UPDATE unit_types SET suggested_capacity = N'Tương đương đồ căn hộ 2 phòng ngủ' " +
                        "    WHERE name = N'Kho Lớn' AND suggested_capacity = N'Đồ 2 phòng ngủ hoặc hàng hóa'; " +
                        "  UPDATE unit_types SET suggested_capacity = N'Tương đương 1 gara ô tô / kho hàng nhỏ' " +
                        "    WHERE name = N'Kho Đặc Biệt XL' AND suggested_capacity = N'Hàng hóa lớn, máy móc'; " +
                        "  UPDATE unit_types SET suggested_capacity = N'Tương đương 1 tủ quần áo lớn' " +
                        "    WHERE name = N'Kho nhỏ 2m²' AND suggested_capacity IN (N'5–10 thùng carton', N'5-10 thùng carton'); " +
                        "END"
                );
            } catch (Exception e) {
                System.err.println("[QueenKho Schema] Warning checking support_requests columns: " + e.getMessage());
            }
        }
        return bean;
    }
}
