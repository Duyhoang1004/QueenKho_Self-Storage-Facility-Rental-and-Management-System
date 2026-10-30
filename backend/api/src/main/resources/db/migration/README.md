# Flyway Database Migration Scripts

Thư mục này chứa các file SQL Migration phục vụ quản lý và đồng bộ cấu trúc Database theo chuẩn Flyway:

- `V1__initial_schema.sql`: Cấu trúc bảng và dữ liệu mẫu khởi tạo ban đầu của hệ thống QueenKho.
- `V2__sync_latest_migrations.sql`: Đồng bộ các trường mới nhất (mã giao dịch ngân hàng `bank_transaction_code`, chính sách gia hạn, task cơ sở).

### Hướng dẫn sử dụng:
1. **Chạy thủ công:** Mở từng file theo thứ tự `V1 -> V2` trong SQL Server Management Studio (SSMS) và bấm Execute.
2. **Kích hoạt Flyway tự động (khi team sẵn sàng):**
   - Thêm dependency `flyway-core` và `flyway-sqlserver` vào `pom.xml`.
   - Bật `spring.flyway.enabled: true` trong `application.yaml`.
