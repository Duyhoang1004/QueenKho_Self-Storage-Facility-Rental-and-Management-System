# Hướng dẫn Cập nhật: Lưu Mã giao dịch Ngân hàng (Bank Transaction Code)

Tài liệu tóm tắt thay đổi chức năng lưu trữ và đối soát mã giao dịch từ phía ngân hàng (`bank_transaction_code`) cho toàn bộ hệ thống QueenKho.

---

## 1. Yêu cầu Chạy SQL Script (BẮT BUỘC)

Trước khi khởi động Backend, thành viên trong nhóm cần chạy script cập nhật cấu trúc database:

- **File script cần chạy:** [`sql_script/Update_payment_bank_transaction_code.sql`](./sql_script/Update_payment_bank_transaction_code.sql)
- **Hoặc thực thi câu lệnh SQL sau trong SQL Server (`QueenKhoDB`):**
  ```sql
  IF COL_LENGTH('payment_transactions', 'bank_transaction_code') IS NULL
  BEGIN
      ALTER TABLE payment_transactions ADD bank_transaction_code NVARCHAR(100) NULL;
      PRINT N'Đã thêm cột bank_transaction_code vào bảng payment_transactions thành công.';
  END
  GO
  ```

> *Lưu ý:* Các file khởi tạo ban đầu [`sql_script/QueenKho.sql`](./sql_script/QueenKho.sql), [`sql_script/QueenKho_full.sql`](./sql_script/QueenKho_full.sql) và [`sql_script/Migration_Consolidated_Update.sql`](./sql_script/Migration_Consolidated_Update.sql) cũng đã được cập nhật đồng bộ.

---

## 2. Chi tiết các Thay đổi trong Code

### A. Giao dịch thanh toán VNPAY từ Khách hàng
- Khi khách hàng thanh toán cọc, tiền thuê kho hàng tháng, gia hạn hoặc thanh toán phí sự cố qua cổng VNPAY:
  - Cổng VNPAY gửi về các tham số kết quả giao dịch qua IPN và Return URL.
  - Backend [`VnpayService.java`](./backend/api/src/main/java/com/queenkho/api/service/VnpayService.java) tự động trích xuất ưu tiên **`vnp_BankTranNo`** (mã giao dịch ngân hàng do bank cấp). Nếu rỗng (thanh toán qua ví/QR), fallback sang **`vnp_TransactionNo`** (mã giao dịch trên cổng VNPAY).
  - Cập nhật đồng thời vào cột `bank_transaction_code` cho giao dịch chính và các dòng phụ đi kèm (phí trễ `LF` và phí chiếm dụng `OS`).

### B. Giao dịch Hoàn tiền (REFUND) từ Quản lý cơ sở
- Khi Quản lý xử lý hoàn tất task hoàn tiền tại quầy hoặc trả kho:
  - **Chuyển khoản (`BANK_TRANSFER`):** Mã FT ngân hàng (`bankTransactionCode`) nhập trong form xác nhận sẽ được lưu trực tiếp vào `payment_transactions.bank_transaction_code`.
  - **Tiền mặt (`CASH`):** Tự động ghi nhận mã phiếu chi tiền mặt `CASH-<taskId>`.

### C. Hiển thị & Đối soát trên Frontend
- **Phía Khách hàng (`CustomerPaymentsPage.jsx`):** Tại bảng Lịch sử giao dịch, mỗi dòng giao dịch hiển thị thêm mã `FT: <mã ngân hàng>` để khách hàng đối chiếu với thông báo biến động số dư trên App ngân hàng.
- **Phía Ban Giám đốc (`BomRevenuePage.jsx`):** Cột "Mã FT Ngân hàng" và Modal chi tiết giao dịch hiển thị mã giao dịch ngân hàng thực tế từ DB, phục vụ đối soát kế toán doanh thu.

---

## 3. Danh sách tệp tin thay đổi
- `sql_script/Update_payment_bank_transaction_code.sql` *(Mới)*
- `sql_script/QueenKho.sql`
- `sql_script/QueenKho_full.sql`
- `sql_script/Migration_Consolidated_Update.sql`
- `backend/api/src/main/java/com/queenkho/api/repository/PaymentRepository.java`
- `backend/api/src/main/java/com/queenkho/api/service/VnpayService.java`
- `backend/api/src/main/java/com/queenkho/api/service/StaffTaskService.java`
- `backend/api/src/main/java/com/queenkho/api/service/BomRevenueService.java`
- `backend/api/src/main/java/com/queenkho/api/service/CustomerPaymentService.java`
- `backend/api/src/main/java/com/queenkho/api/dto/CustomerPaymentsResponse.java`
- `backend/api/src/test/java/com/queenkho/api/service/CustomerPaymentServiceTest.java`
- `frontend/src/pages/payment/CustomerPaymentsPage.jsx`
