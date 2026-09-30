## UC-15 — Hủy đơn đặt chỗ (Cancel Reservation)

**Actor:** Khách hàng (Customer)
**Màn hình:** Kho của tôi (`/kho-cua-toi`) → Popup xác nhận hủy

---

### Luồng chức năng (Flow)

```
Khách bấm [Hủy đơn] trên dòng đơn có status PENDING / DEPOSIT_PAID
    → Popup mở, FE gọi GET /api/v1/reservations/{id}/cancel-preview
    → BE tính toán: So sánh LocalDateTime.now() với giờ hẹn nhận kho
        ├── Còn hơn 24h → Phí phạt = 0, hoàn 100% cọc
        └── Trong vòng 24h hoặc đã quá giờ → Phí phạt 50%, hoàn 50% cọc
    → Popup hiển thị: Tóm tắt đơn, Khung tính hoàn cọc, Lý do hủy (Radio),
      Form tài khoản ngân hàng (chỉ hiện nếu đơn đã DEPOSIT_PAID)
    → Khách chọn lý do + nhập bank info (nếu có) → Bấm [Xác nhận hủy]
    → FE gọi POST /api/v1/reservations/{id}/cancel
    → BE xử lý và trả về 200 OK
    → FE đóng popup, reload danh sách đơn
```

---

### Logic nghiệp vụ (Business Logic)

| Điều kiện | Phí phạt | Số tiền hoàn |
|---|---|---|
| Hủy **trước 24h** so với giờ hẹn nhận kho | 0₫ | 100% tiền cọc |
| Hủy **trong vòng 24h** hoặc **sau giờ hẹn** | 50% tiền cọc | 50% tiền cọc |

- Đơn có status `PENDING` (chưa đóng cọc): Hủy tự do, không phát sinh hoàn tiền.
- Đơn có status `DEPOSIT_PAID` (đã đóng cọc): Bắt buộc nhập thông tin ngân hàng hoặc chọn nhận tiền mặt tại quầy.
- Đơn có status khác (`UNIT_ASSIGNED`, `CANCELLED`,...): Hệ thống từ chối, trả về lỗi.

---

### Ảnh hưởng tới Database

Sau khi khách xác nhận hủy, hệ thống cập nhật / ghi mới vào **3 bảng**:

**1. Bảng `reservations`**
```sql
UPDATE reservations SET status = 'CANCELLED' WHERE id = ?;
```

**2. Bảng `payment_transactions`** *(Chỉ tạo nếu đơn đã DEPOSIT_PAID)*
```sql
INSERT INTO payment_transactions
    (transaction_code, reservation_id, user_id, amount,
     payment_type, payment_method, status, paid_at)
VALUES
    ('REF-RES-XXXXXX-XXXXX', ?, ?, <số_tiền_hoàn>,
     'REFUND', 'BANK_TRANSFER', 'PENDING', SYSDATETIME());
```
> Phiếu REFUND sẽ có `status = 'PENDING'` cho đến khi bộ phận tài chính duyệt và chuyển khoản thực tế.

**3. Bảng `activity_logs`**
```sql
INSERT INTO activity_logs (user_id, action, target_entity, target_id, created_at)
VALUES (?, N'Hủy đặt chỗ RES-XXXXXX. Lý do: ... [HOÀN CỌC - CK] Chuyển tiền về tài khoản: ...', 'reservations', ?, SYSDATETIME());
```
> Cột `action` chứa đầy đủ lý do hủy + thông tin tài khoản thụ hưởng → Dùng làm nội dung task cho nhân viên tài chính xử lý hoàn tiền.

---

### API Endpoints

| Method | Endpoint | Mô tả |
|---|---|---|
| `GET` | `/api/v1/reservations/{id}/cancel-preview` | Tính toán trước số tiền hoàn cọc |
| `POST` | `/api/v1/reservations/{id}/cancel` | Xác nhận hủy đơn và ghi nhận toàn bộ |

---

### Script DB cần chạy thêm

> ⚠️ **Bắt buộc chạy script sau trong SSMS trước khi test UC-15**, vì cột `action` mặc định chỉ có `NVARCHAR(100)` không đủ chứa thông tin ngân hàng:

File: `sql_script/Update_activity_logs.sql`
```sql
USE QueenKhoDB;
GO

ALTER TABLE activity_logs
ALTER COLUMN action NVARCHAR(500) NOT NULL;
GO
```

---

### Các file đã thêm / sửa đổi

**Backend:**
- `dto/CancelPreviewResponse.java` — DTO trả về kết quả tính toán hoàn cọc
- `dto/CancelReservationRequest.java` — DTO nhận lý do hủy + thông tin ngân hàng
- `service/ReservationService.java` — Thêm 2 method: `previewCancel()`, `cancelReservation()`
- `controller/ReservationController.java` — Thêm 2 endpoint GET cancel-preview, POST cancel

**Frontend:**
- `src/components/CancelReservationModal.jsx` — Component popup hủy đơn (mới tạo)
- `src/pages/my_reservation/MyReservationsPage.jsx` — Thêm cột Thao tác + tích hợp Modal
- `src/services/reservationService.js` — Thêm 2 hàm `getCancelPreview()`, `cancelReservation()`

**Database:**
- `sql_script/Update_activity_logs.sql` — Mở rộng cột `action` từ 100 lên 500 ký tự
