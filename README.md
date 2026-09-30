# QueenKho - Hệ Thống Cho Thuê & Quản Lý Kho Tự Quản

> Đồ án môn học SWP391 – FPTU  
> **Repo:** Monorepo (`frontend/` + `backend/` + `sql_script/`)  
> **Mô hình kiến trúc:** Client-Server (Frontend - Backend tách biệt)

**Công nghệ sử dụng:**
*   **Frontend:** ReactJS (khởi tạo qua Vite), Tailwind CSS (thiết kế theo chuẩn Material Design 3), React Router DOM, Axios.
*   **Backend:** Spring Boot (Java), Spring Data JPA & Hibernate, Spring Security (đang cấu hình mở cho Dev/Test).
*   **Database:** SQL Server 2019/2022.
*   **Tích hợp:** Cổng thanh toán SePay (Webhook tự động cập nhật đơn đặt cọc), QR Code tĩnh/động (VietQR).

---

## Mục Lục

1. [Tiến Độ Dự Án (Milestones)](#1-tiến-độ-dự-án-milestones)
2. [Cài Đặt Môi Trường](#2-cài-đặt-môi-trường)
3. [Cấu Hình Database](#3-cấu-hình-database)
4. [Chạy Dự Án & Tài Khoản Test](#4-chạy-dự-án--tài-khoản-test)
5. [Hướng Dẫn Phát Triển Frontend](#5-hướng-dẫn-phát-triển-frontend)
6. [Quy Tắc JSON API](#6-quy-tắc-json-api)
7. [Ví Dụ JSON Cụ Thể](#7-ví-dụ-json-cụ-thể)
8. [Làm Việc Nhóm Trên Git](#8-làm-việc-nhóm-trên-git)

---

## 1. Tiến Độ Dự Án (Milestones)
Các chức năng MVP (Minimum Viable Product) đã hoàn thiện đến thời điểm hiện tại:
*   **Luồng Xác thực (Authentication):** Đăng ký, Đăng nhập (Mã hóa mật khẩu BCrypt, tự động rẽ nhánh Layout theo Role).
*   **Trang Khách Hàng (Customer Portal):**
    *   Trang chủ (HomePage).
    *   Tìm kiếm và khám phá danh mục kho, xem tình trạng ô trống (UC-09: Search & Landing Page).
    *   Quy trình đặt chỗ kho (UC-10: Booking).
    *   Quản lý kho của tôi (UC-12: My Reservations).
*   **Cổng Thanh Toán:**
    *   Tích hợp thành công Hosted Checkout qua SePay.
    *   Trang xác nhận thành công sau khi hoàn tất thanh toán.
    *   Backend có Webhook (IPN) tự động nhận tín hiệu thanh toán để cập nhật trạng thái `DEPOSIT_PAID` vào Database.
*   **Trang Quản trị Cơ sở (Manager Portal):**
    *   Bảng điều khiển tổng quan (Dashboard) với các thông số realtime.
    *   Quản lý Danh mục Ô kho (Lọc trạng thái, xem ma trận kho).
    *   Duyệt Đơn Đặt Chỗ & Gán Ô Kho (Giao diện bảng danh sách + Modal thao tác gắn mã số khoang thông minh).

---

## 2. Cài Đặt Môi Trường

### Yêu cầu

| Tool           | Version       | Link tải                                    |
|----------------|---------------|---------------------------------------------|
| JDK            | 17 LTS        | https://adoptium.net                        |
| Node.js        | 18+           | https://nodejs.org                          |
| SQL Server     | 2019/2022     | Có sẵn hoặc dùng bản Express                |
| IDE Backend    | IntelliJ IDEA | https://www.jetbrains.com/idea              |
| IDE Frontend   | VS Code       | https://code.visualstudio.com               |

### Cài đặt biến môi trường (Database)

File `application.yaml` dùng cú pháp `${BIEN:gia_tri_mac_dinh}`.  
Nếu password SQL Server của bạn **trùng với giá trị mặc định** (`12345`) thì **không cần làm gì thêm**.  
Nếu password **khác** thì làm theo 1 trong 2 cách sau:

#### Cách 1: Dùng GUI Windows
1. Nhấn phím **Windows**, gõ **"Environment Variables"**
2. Chọn **"Edit the system environment variables"**
3. Bấm **"Environment Variables..."**
4. Ở phần **User variables**, bấm **"New..."**:
   - Variable name: `DB_PASSWORD`
   - Variable value: `MatKhauCuaBan`
5. Bấm **OK** tất cả các cửa sổ
6. **Khởi động lại IntelliJ / VS Code**

#### Cách 2: Dùng PowerShell
```powershell
# Tạo biến môi trường cấp User (tồn tại vĩnh viễn, không mất khi tắt máy)
[System.Environment]::SetEnvironmentVariable("DB_PASSWORD", "MatKhauCuaBan", "User")
```
Khởi động lại IDE sau khi chạy lệnh.

**Kiểm tra đã thành công:** Mở PowerShell **mới**, gõ:
```powershell
echo $env:DB_PASSWORD
```
Nếu hiện ra password bạn vừa đặt -> Thành công.

| Biến          | Mặc định    | Khi nào cần đặt                            |
|---------------|-------------|--------------------------------------------|
| `DB_PASSWORD` | `12345`     | Password SQL Server của bạn khác `12345`   |
| `DB_USERNAME` | `sa`        | Username SQL Server của bạn khác `sa`      |
| `DB_NAME`     | `QueenKhoDB`| Tên database của bạn khác `QueenKhoDB`     |
| `DB_PORT`     | `1433`      | Port SQL Server của bạn khác `1433`        |

---

## 3. Cấu Hình Database

### Bước 1: Tạo database và các bảng
Mở SQL Server Management Studio (SSMS), mở file `sql_script/QueenKho.sql` và **chạy toàn bộ**.  
Script sẽ tự động:
- Tạo database `QueenKhoDB`
- Tạo 12 bảng (theo thứ tự phụ thuộc Khóa ngoại)
- Seed 5 roles: `CUSTOMER`, `STAFF`, `FACILITY_MANAGER`, `BOM`, `ADMIN`

### Bước 2: Kiểm tra
```sql
USE QueenKhoDB;
SELECT * FROM roles;
```
Thấy 5 dòng dữ liệu -> Thành công.

---

## 4. Chạy Dự Án & Tài Khoản Test

### Backend (Spring Boot)
```bash
cd backend/api
./mvnw spring-boot:run
```
Backend chạy tại: `http://localhost:8080`

### Frontend (ReactJS)
```bash
cd frontend
npm install
npm run dev
```
Frontend chạy tại: `http://localhost:5173`

### Tài khoản kiểm thử (Dev Account)
Để thuận tiện test các luồng giao diện nội bộ (Protected Route), hệ thống đã cấy sẵn tài khoản Quản lý:
*   **Email:** `admin123@gmail.com`
*   **Mật khẩu:** `1234`
*   **Vai trò (Role):** `MANAGER`

*(Ghi chú: Mật khẩu này đã được băm bằng BCrypt trong DB, bạn chỉ cần nhập "1234" ở trang Login để tự động được điều hướng vào màn hình `/manager`).*

---

## 5. Hướng Dẫn Phát Triển Frontend

### 5.1. Quản lý phiên đăng nhập (SessionStorage)
*   Dự án sử dụng **`sessionStorage`** thay vì `localStorage` để lưu thông tin Token và User sau khi đăng nhập.
*   **Mục đích:** Mỗi khi tắt tab trình duyệt, toàn bộ phiên đăng nhập sẽ bị xóa sạch. Lần tới mở `localhost:5173` sẽ lập tức hiện lại trang Đăng nhập. Tránh lỗi "dính" session cũ khi test nhiều tài khoản khác nhau.
*   **Bảo mật Route:** Các Layout (`ManagerLayout`, `CustomerLayout`) đều có kiểm tra `sessionStorage`. Nếu không có thông tin hợp lệ (chưa login hoặc sai Role), người dùng sẽ tự động bị đá văng về `/login`.

### 5.2. Cách bổ sung Routing khi làm xong giao diện mới
Khi phát triển xong một Component giao diện mới, thực hiện các bước sau để cấu hình Route:
1.  **Bước 1:** Đặt file Component vào đúng thư mục trong `src/pages/` (VD: `src/pages/manager/TenTrangMoi.jsx`).
2.  **Bước 2:** Mở file `src/App.jsx`.
3.  **Bước 3:** Import Component vừa tạo ở phần đầu file.
4.  **Bước 4:** Tìm đến thẻ `<Route element={<TênLayoutPhùHợp />}>` (VD: CustomerLayout, ManagerLayout).
5.  **Bước 5:** Thêm thẻ `<Route>` mới vào bên trong khối đó.
    *(Ví dụ: `<Route path="/manager/bao-cao" element={<TenTrangMoi />} />`)*
6.  **Bước 6:** Vào file Layout tương ứng (VD: `ManagerLayout.jsx`), thêm URL (`/manager/bao-cao`) vào mảng `menuItems` để liên kết xuất hiện trên Sidebar.

---

## 6. Quy Tắc JSON API

> **QUAN TRỌNG:** Cả team (Frontend + Backend) phải đọc và làm theo các quy tắc này.  
> Chi tiết đầy đủ xem file `docs/api-contract.md`.

### 5 quy tắc bắt buộc

| #  | Quy tắc                                  | Đúng                  | Sai                   |
|----|------------------------------------------|-----------------------|-----------------------|
| 1  | Tên field dùng **camelCase**             | `fullName`            | `full_name`           |
| 2  | Trạng thái dùng **CHỮ HOA**              | `"ACTIVE"`            | `"Active"`            |
| 3  | Response lỗi có `error` + `message`      | (xem ví dụ bên dưới)  |                       |
| 4  | Đăng nhập bằng **email**                 | `"email": "..."`      | `"username": "..."`   |
| 5  | FE gửi password thô, BE tự băm BCrypt    | FE không hash trước   |                       |

### Cấu hình Spring Boot để tự động chuyển snake_case -> camelCase
Thêm vào `application.yaml`:
```yaml
spring:
  jackson:
    property-naming-strategy: LOWER_CAMEL_CASE
```

---

## 7. Ví Dụ JSON Cụ Thể

### UC-02: Đăng Ký - `POST /api/auth/register`
**Frontend gửi lên (Request Body):**
```json
{
  "fullName": "Nguyen Van A",
  "email":    "nguyenvana@gmail.com",
  "phone":    "0901234567",
  "password": "MyPassword@123"
}
```
**Backend trả về khi THÀNH CÔNG (201 Created):**
```json
{
  "message": "Dang ky thanh cong"
}
```
**Backend trả về khi LỖI - email đã tồn tại (409 Conflict):**
```json
{
  "error":   "DUPLICATE_EMAIL",
  "message": "Email da duoc su dung"
}
```

### UC-01: Đăng Nhập - `POST /api/auth/login`
**Frontend gửi lên (Request Body):**
```json
{
  "email":    "nguyenvana@gmail.com",
  "password": "MyPassword@123"
}
```
**Backend trả về khi THÀNH CÔNG (200 OK):**
```json
{
  "token":    "eyJhbGciOiJIUzI1NiJ9...",
  "userId":   1,
  "fullName": "Nguyen Van A",
  "email":    "nguyenvana@gmail.com",
  "role":     "CUSTOMER"
}
```
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

### Bảng tóm tắt API

| API       | Method | URL                  | Request Body                         | Success Response                                  |
|-----------|--------|----------------------|--------------------------------------|----------------------------------------------------|
| Đăng ký   | POST   | /api/auth/register   | { fullName, email, phone, password } | 201: { message }                                   |
| Đăng nhập | POST   | /api/auth/login      | { email, password }                  | 200: { token, userId, fullName, email, role }      |

---

## 8. Làm Việc Nhóm Trên Git

### Branching Strategy
```
main          <- Code ổn định, chỉ merge qua Pull Request
  |
  +-- dev     <- Nhánh tích hợp, merge feature vào đây trước
       |
       +-- feature/UC-01-login        (nhánh cá nhân)
       +-- feature/UC-02-register     (nhánh cá nhân)
       +-- feature/UC-03-reservation  (nhánh cá nhân)
```

### Quy trình làm việc hàng ngày
```bash
# 1. Sáng sớm: Cập nhật code mới nhất từ dev
git checkout feature/UC-xx-ten-tinh-nang
git pull origin dev

# 2. Code suốt ngày, commit thường xuyên
git add .
git commit -m "feat(UC-01): Hoan thanh login API"

# 3. Chiều tối: Push lên và tạo Pull Request
git push origin feature/UC-xx-ten-tinh-nang
# -> Lên GitHub tạo PR từ feature/UC-xx vào dev
# -> Cần 1 người review + approve mới được merge
```

### Quy tắc commit message
```
feat(UC-01): Mô tả tính năng mới
fix(UC-02):  Sửa lỗi phát sinh
docs:        Cập nhật tài liệu
chore:       Công việc linh tinh (config, dependency)
```
