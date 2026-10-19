# QueenKho - Hệ Thống Cho Thuê & Quản Lý Kho Tự Quản

> Đồ án môn học SWP391 – FPTU  
> **Repo:** Monorepo (`frontend/` + `backend/` + `sql_script/`)  
> **Mô hình kiến trúc:** Client-Server (Frontend - Backend tách biệt)

**Công nghệ sử dụng:**
*   **Frontend:** ReactJS (khởi tạo qua Vite), Tailwind CSS (thiết kế theo chuẩn Material Design 3), React Router DOM, Axios.
*   **Backend:** Spring Boot (Java), Spring Data JPA & Hibernate, Spring Security (đang cấu hình mở cho Dev/Test).
*   **Database:** SQL Server 2019/2022.
*   **Tích hợp:** VNPAY sandbox, QR Code tĩnh/động (VietQR).

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

## Rule đặt tên commit

[NgayThangNam][Ten] Chức năng

Ví dụ: [03/10/2026][SonNT] made UC-21 & UC-22


## 1. Tiến Độ Dự Án (Milestones)
Các chức năng MVP (Minimum Viable Product) đã hoàn thiện đến thời điểm hiện tại:
*   **Luồng Xác thực (Authentication):** Đăng ký, Đăng nhập (Mã hóa mật khẩu BCrypt, tự động rẽ nhánh Layout theo Role).
*   **Trang Khách Hàng (Customer Portal):**
    *   Trang chủ (HomePage).
    *   Tìm kiếm và khám phá danh mục kho, xem tình trạng ô trống (UC-09: Search & Landing Page).
    *   Quy trình đặt chỗ kho (UC-10: Booking).
    *   Quản lý kho của tôi & Hợp đồng (UC-12: My Reservations).
    *   **UC-21: Gia hạn hợp đồng thuê:** Gia hạn trực tuyến qua cổng VNPAY với các gói chu kỳ linh hoạt kèm ưu đãi chiết khấu.
    *   **UC-22: Hẹn ngày trả kho & dời ngày trả kho sớm:** Hẹn lịch bàn giao khoang, chọn phương thức hoàn cọc (chuyển khoản / tiền mặt), tính toán dự kiến tiền hoàn theo thời gian thực.
    *   **UC-28: Xử lý hợp đồng quá hạn & thanh lý (Phía Khách hàng):** Hiển thị cảnh báo quá hạn, tra cứu công nợ phí trễ hạn lũy kế, gia hạn hợp đồng quá hạn qua VNPAY gộp phí phạt, khóa mã truy cập PIN SmartLock tự động.
*   **Cổng Thanh Toán:**
    *   Tích hợp thành công VNPAY sandbox.
    *   Trang xác nhận thành công sau khi hoàn tất thanh toán.
    *   Backend có Webhook (IPN) tự động nhận tín hiệu thanh toán để cập nhật trạng thái `DEPOSIT_PAID` vào Database, xử lý gia hạn hợp đồng và gộp phí trễ hạn.
*   **Trang Quản trị Cơ sở (Manager Portal):**
    *   Bảng điều khiển tổng quan (Dashboard) với các thông số realtime.
    *   Quản lý Danh mục Ô kho (Lọc trạng thái, xem ma trận kho).
    *   Duyệt Đơn Đặt Chỗ & Gán Ô Kho (Giao diện bảng danh sách + Modal thao tác gắn mã số khoang thông minh).
    *   **UC-28: Xử lý hợp đồng quá hạn & thanh lý (Phía Quản lý):** Theo dõi danh sách hợp đồng quá hạn, ghi nhận nhật ký đôn đốc khách hàng (contact logs), thực hiện thanh lý hợp đồng quá hạn kéo dài (khấu trừ phí trễ vào cọc, chuyển ô kho bảo trì, hủy mã truy cập), tạo yêu cầu hoàn trả phần cọc còn lại sau thanh lý.

### Giới hạn đã biết của UC-28:
1. Nếu hợp đồng đã quá hạn rồi mới hẹn trả kho (UC-22) thì quy trình trả kho hiện tại (UC-23) vẫn tính phí theo bảng ân hạn của UC-22 thay vì phí trễ hạn lũy kế của UC-28; tiền cọc thực hoàn được chốt tại thời điểm FM xác nhận trả kho.
2. Phí trễ khi gia hạn hợp đồng quá hạn được chốt tại thời điểm tạo liên kết thanh toán VNPAY; nếu khách thanh toán chậm sau đó nhiều ngày, số tiền đã trả không tự động tăng thêm.

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

### Bước 1: Tạo database đầy đủ (1 file duy nhất)
Mở SQL Server Management Studio (SSMS), mở file **`sql_script/QueenKho_full.sql`** và **chạy toàn bộ** (F5).

> ⚠️ Script **xoá `QueenKhoDB` cũ rồi tạo lại từ đầu** → mất hết dữ liệu local (đơn, hợp đồng, task...). Chạy xong nhớ **đăng nhập lại** trên FE.

Script sẽ tự động:
- Tạo database `QueenKhoDB` + 13 bảng (theo thứ tự phụ thuộc khoá ngoại, gồm cả `staff_tasks`)
- Seed 5 roles: `CUSTOMER`, `STAFF`, `FACILITY_MANAGER`, `BOM`, `ADMIN`
- Seed dữ liệu nền (id cố định):

| Dữ liệu       | Số lượng | Ghi chú                                                                 |
|---------------|----------|-------------------------------------------------------------------------|
| Cơ sở         | 6        | 1 Tân Bình · 2 Bình Thạnh · 3 Thủ Đức · 4 Gò Vấp · 5 Cầu Giấy · 6 Quận 7 |
| Loại kho      | 6        | Mini M, Tiêu Chuẩn, Gia Đình, Lớn, Đặc Biệt XL, Nhỏ 2m²                 |
| Chính sách    | 6        | Mỗi cơ sở 1 chính sách thuê                                             |
| Ô kho         | 42       | Mã `KV-<cơ sở>-<zone><phòng>`, vd `KV-TB-A101`                          |
| Tài khoản     | 29       | Xem mục 4 — Tài khoản kiểm thử                                          |

> Các file cũ (`QueenKho.sql`, `QueenKhoDuLieuMau_UC09.sql`, `rental_policies_data.sql`, `Update_activity_logs.sql`, `setup_test_env.sql`) đã được gộp vào `QueenKho_full.sql`.  
> Khi thêm bảng / cột mới: sửa **`QueenKho_full.sql`** (backend dùng `ddl-auto: validate` nên schema phải khớp Entity).

### Bước 2: Kiểm tra
```sql
USE QueenKhoDB;
SELECT r.name, COUNT(*) FROM users u JOIN roles r ON r.id = u.role_id GROUP BY r.name;
```
Thấy `CUSTOMER 5`, `FACILITY_MANAGER 6`, `STAFF 18` -> Thành công.

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
Sau khi chạy `QueenKho_full.sql`, tất cả tài khoản đều có **mật khẩu `123456`** (đã băm BCrypt trong DB):

| Vai trò                       | Số lượng           | Email                              | Ví dụ                     | Vào trang    |
|-------------------------------|--------------------|------------------------------------|---------------------------|--------------|
| Khách hàng (`CUSTOMER`)       | 5                  | `khachhang<1..5>@gmail.com`        | `khachhang1@gmail.com`    | `/`          |
| Quản lý cơ sở (`FACILITY_MANAGER`) | 1 / cơ sở (6) | `fm<cơ sở>@gmail.com`              | `fmtanbinh@gmail.com`     | `/manager`   |
| Nhân viên (`STAFF`)           | 3 / cơ sở (18)     | `staff<cơ sở><1..3>@gmail.com`     | `stafftanbinh1@gmail.com` | `/staff`     |

`<cơ sở>` = `tanbinh` · `binhthanh` · `thuduc` · `govap` · `caugiay` · `quan7`

*(Quản lý và nhân viên được gán sẵn vào cơ sở tương ứng → chỉ thấy bảng công việc / đơn của cơ sở mình.)*

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
