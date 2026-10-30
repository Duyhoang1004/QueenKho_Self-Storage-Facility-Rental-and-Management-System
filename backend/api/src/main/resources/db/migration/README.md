# Database Migration Scripts (SQL Reference)

Thư mục này lưu trữ các file SQL migration cấu trúc Database theo chuẩn Flyway versioning (`V1`, `V2`, `V3`...):

* `V1__initial_schema.sql`: Toàn bộ cấu trúc bảng và dữ liệu mẫu khởi tạo ban đầu của hệ thống QueenKho.
* `V2__sync_latest_migrations.sql`: Các bản cập nhật bảng (mã giao dịch ngân hàng, chính sách gia hạn, task cơ sở).
* `V3__create_notifications.sql`: Script khởi tạo bảng `notifications` (cho trường hợp sau này muốn chuyển từ In-Memory sang lưu trữ Persistent trong Database).

---

### Lưu ý cấu hình:
* **Trạng thái hiện tại:** Dự án **KHÔNG** kích hoạt dependency Flyway trong `pom.xml`, nên thư mục này hoàn toàn là tài nguyên tĩnh (Static SQL scripts).
* Ứng dụng Spring Boot chạy bình thường, **không tự động can thiệp hay sửa đổi Database**.
* Khi cần chạy thủ công hoặc khởi tạo database mới, lập trình viên có thể mở các file theo thứ tự `V1 -> V2 -> V3` trong SQL Server Management Studio (SSMS) để Execute.
