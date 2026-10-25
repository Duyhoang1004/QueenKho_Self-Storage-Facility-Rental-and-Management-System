# 📋 NHẬT KÝ LỖI & KHẮC PHỤC HỆ THỐNG (BUG LOG)

> **Phụ trách kiểm thử & Đảm bảo chất lượng (POLISH-02)**: Nhiêu Sĩ Luân (`siluan0706@gmail.com`)  
> **Dự án**: Hệ thống Quản lý và Cho thuê Kho Lưu Trữ Tự Quản (QueenKho)

---

### 📊 Thống kê tiến độ xử lý:
* **Tổng số lỗi ghi nhận**: 7 lỗi
* **Đã khắc phục hoàn tất (`RESOLVED`)**: 5 lỗi
* **Đang xử lý / Kiểm thử (`IN_PROGRESS` / `TESTING`)**: 2 lỗi
* **Bảo vệ bằng kiểm thử tự động**: 21 bài Unit Test (JUnit 5 + Mockito)

---

### 📑 Bảng theo dõi và khắc phục lỗi:

| Mã Bug | Use Case | Mô tả & Triệu chứng | Nguyên nhân gốc rễ (Root Cause) | Giải pháp kỹ thuật | File sửa / Commit | Trạng thái |
| :---: | :---: | :--- | :--- | :--- | :--- | :---: |
| **BUG-01** | **Bảo mật (Auth)** | **Lỗ hổng Fallback User ID 1**:<br>Request không có token vẫn tự động gán quyền thao tác cho User ID 1 (Admin). | Code cũ gán giá trị mặc định `int userId = 1;` khi header rỗng để tiện chạy thử lúc dev. | Bỏ biến fallback; tích hợp `SecurityContextHolder` lấy ID từ Token; ném lỗi `401 Unauthorized` nếu chưa đăng nhập. | `ReservationService.java`<br>`#54` | 🟢 **RESOLVED** |
| **BUG-02** | **UC-29 (BOM)** | **Thất thoát doanh thu theo Loại kho**:<br>Khách đặt cọc thành công qua VNPAY nhưng biểu đồ doanh thu theo loại kho báo 0đ. | Query SQL dùng `INNER JOIN rental_contracts`. Các đơn mới cọc giữ chỗ (`contract_id = NULL`) bị văng khỏi kết quả. | Đổi sang `LEFT JOIN` với cả hợp đồng và đơn đặt chỗ, lấy loại kho linh hoạt bằng `COALESCE(su.unit_type_id, res.unit_type_id)` theo PR-M7. | `BomRevenueService.java`<br>`fix/uc-29` | 🟢 **RESOLVED** |
| **BUG-03** | **UC-29 (BOM)** | **Tỷ lệ tái ký hợp đồng vượt 100% (2000%)**:<br>Dashboard BOM hiển thị tỷ lệ gia hạn sai logic toán học. | Lấy `renewedContracts / terminatedContracts`. Khi 20 khách gia hạn và 1 khách trả kho $\to$ tính ra 2000%. Nếu 0 ai trả kho bị chia cho 0. | Chuẩn hóa mẫu số: `renewed / (renewed + terminated) * 100`. Chặn chia cho 0 khi 0 ai dọn đi. | `BomRevenueService.java`<br>`fix/uc-29` | 🟢 **RESOLVED** |
| **BUG-04** | **UC-29 (BOM)** | **Hiển thị số ảo 194 hợp đồng trên UI**:<br>Cơ sở mới có 0 hợp đồng nhưng màn hình tự động hiện số giả 194. | Sử dụng toán tử `\|\|` trong JSX: `{overview?.rentalCount \|\| 194}`. Số 0 bị coi là falsy nên tự lấy số mock phía sau. | Thay thế toàn bộ bằng toán tử Nullish Coalescing `?? 0` để bảo toàn giá trị số 0 thực tế từ database. | `BomRevenuePage.jsx`<br>`fix/uc-29` | 🟢 **RESOLVED** |
| **BUG-05** | **EX-03 (No-Show)** | **Vi phạm quy chế hủy No-Show**:<br>FM có thể bấm hủy No-Show ngay cả khi chưa đủ 48h hoặc chưa gọi đủ 2 lần cho khách. | Thiếu hàm validate tập trung điều kiện ràng buộc kinh doanh theo quy chế `PR-X1` và `PR-X3`. | Thêm hàm `evaluateNoShowEligibility()`: bắt buộc quá 48h kể từ lịch hẹn và có $\ge 2$ lần gọi thất bại cách nhau 24h trong `activity_logs`. | `ReservationService.java`<br>`#68` | 🟢 **RESOLVED** |
| **BUG-06** | **UC-25 (Hoàn cọc)** | **Cập nhật nhầm giao dịch hoàn tiền**:<br>Duyệt hoàn tiền cho 1 đơn làm chuyển `SUCCESS` hàng loạt đơn khác trong cơ sở. | Query UPDATE chỉ lọc theo `facility_id` mà không chỉ định chính xác mã đơn `reservation_code`. | Trích xuất `reservation_code` từ ghi chú của Task để cập nhật duy nhất giao dịch của đơn đặt chỗ đó. | `StaffTaskService.java` | 🟡 **IN_PROGRESS** |
| **BUG-07** | **EX-03 (No-Show)** | **Lệch sổ cái kế toán khi No-Show**:<br>Hủy No-Show có hoàn lại tiền thuê nhưng không có bản ghi giao dịch `REFUND`. | Hàm hủy No-Show chỉ cập nhật bảng `reservations` mà quên INSERT giao dịch vào `payment_transactions`. | Bổ sung lệnh tạo giao dịch `REFUND` với trạng thái `PENDING` và liên kết Task cho FM xử lý theo `PR-O12`. | `ReservationService.java` | 🔵 **TESTING** |
