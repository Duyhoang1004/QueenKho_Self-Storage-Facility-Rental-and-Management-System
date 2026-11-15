# 🏛️ 8 TRỤ CỘT KIẾN THỨC CỐT LÕI BẢO VỆ ĐỒ ÁN SWP391 — QUEENKHO
### CẨM NANG VẤN ĐÁP THỰC CHIẾN DÀNH CHO SƠN (FULL-STACK DEVELOPER)

> **Mục tiêu:** Giúp Sơn làm chủ 100% kiến thức nền tảng, kiến trúc hệ thống, cơ sở dữ liệu, luồng dữ liệu FE/BE và tự tin khẳng định đóng góp của bản thân trước Hội đồng chấm tốt nghiệp SWP391.

---

# 📑 MỤC LỤC 8 TRỤ CỘT

1. [TRỤ CỘT 1: BUSINESS FLOW — QUY TRÌNH NGHIỆP VỤ CHÍNH](#trụ-cột-1-business-flow--quy-trình-nghiệp-vụ-chính)
2. [TRỤ CỘT 2: DATABASE — ERD, QUAN HỆ CÁC BẢNG & KHÓA (PK/FK)](#trụ-cột-2-database--erd-quan-hệ-các-bảng--khóa-pkfk)
3. [TRỤ CỘT 3: BACKEND — CONTROLLER, SERVICE, REPOSITORY VÀ CÁCH PHỐI HỢP](#trụ-cột-3-backend--controller-service-repository-và-cách-phối-hợp)
4. [TRỤ CỘT 4: FRONTEND — GỌI API VÀ HIỂN THỊ DỮ LIỆU LÊN REACT](#trụ-cột-4-frontend--gọi-api-và-hiển-thị-dữ-liệu-lên-react)
5. [TRỤ CỘT 5: API — CÁC ENDPOINT QUAN TRỌNG, REQUEST/RESPONSE & STATUS CODE](#trụ-cột-5-api--các-endpoint-quan-trọng-requestresponse--status-code)
6. [TRỤ CỘT 6: AUTHENTICATION & AUTHORIZATION — ĐĂNG NHẬP, PHÂN QUYỀN & CHỐNG IDOR](#trụ-cột-6-authentication--authorization--đăng-nhập-phân-quyền--chống-idor)
7. [TRỤ CỘT 7: DATABASE TRANSACTION — XỬ LÝ NHIỀU BẢNG VỚI `@Transactional` & ACID](#trụ-cột-7-database-transaction--xử-lý-nhiều-bảng-với-transactional--acid)
8. [TRỤ CỘT 8: CONTRIBUTION — KỊCH BẢN GIẢI THÍCH CHÍNH XÁC PHẦN VIỆC CỦA SƠN](#trụ-cột-8-contribution--kịch-bản-giải-thích-chính-xác-phần-việc-của-sơn)

---

# TRỤ CỘT 1: BUSINESS FLOW — QUY TRÌNH NGHIỆP VỤ CHÍNH

### 1. Bản chất nghiệp vụ:
QueenKho là **Hệ thống cho thuê & quản lý kho tự quản thông minh (Smart Self-Storage)**. Toàn bộ nghiệp vụ xoay quanh **Vòng đời Hợp đồng thuê kho (Contract Lifecycle)**, giải quyết bài toán thuê kho linh hoạt từ trực tuyến (VNPAY) đến thực tế (PIN SmartLock/RFID ra vào 24/7).

### 2. Sơ đồ chuỗi 7 Flow liên hoàn:

```
[Flow 1: Khách Tìm, Đặt kho & Cọc VNPAY trong 15 phút (Đơn: DEPOSIT_PAID)]
                │
                ▼
[Flow 2: FM Gán ô rảnh ➔ Sinh HĐ PENDING_CHECK_IN ➔ Staff bàn giao tại quầy (CCCD + 6 ảnh) ➔ Cấp PIN/RFID ➔ HĐ ACTIVE]
                │
                ├───────────────────────────────────────┐
                ▼ (Vận hành suốt thời gian thuê)         ▼ (Khi phát sinh sự cố)
[Flow 5: FM Quản lý Mặt bằng Grid, Lịch ô & Việc Staff] [Flow 7: Hỗ trợ, Reset PIN & Đền bù đối chiếu IoT]
                │                                       │
                ├───────────────────────────────────────┘
                ▼
[Flow 3: Hẹn trả kho ➔ HĐ TERMINATION_PENDING ➔ Staff nghiệm thu ➔ HĐ TERMINATED ➔ FM hoàn cọc (REFUND)]
                │ (Nếu khách không trả kho & không gia hạn)
                ▼
[Flow 6: Quá hạn 00:05 ➔ HĐ OVERDUE ➔ Khóa PIN ➔ Tính phí chiếm dụng ➔ Chuyển KHO TỔNG (Không bán đồ khách)]
                ▲
                │ (Bao quát toàn chuỗi)
[Flow 4: BOM ban hành Giá, Chính sách thuê theo version, Voucher & Giám sát Doanh thu]
```

### 🗣️ Kịch bản Sơn trả lời trước Hội đồng:
> *"Dạ thưa thầy/cô, nghiệp vụ chính của QueenKho là quản lý vòng đời khép kín của Hợp đồng thuê kho: Khách hàng đặt kho và thanh toán cọc trực tuyến qua VNPAY (**Flow 1**). Quản lý cơ sở (FM) dựa vào sơ đồ mặt bằng và lịch rảnh ô kho để chỉ định ô thực tế, sau đó nhân viên bàn giao tại quầy, kiểm tra CCCD, chụp ảnh hiện trạng và cấp mã PIN SmartLock 6 số cùng thẻ RFID để hợp đồng chuyển sang `ACTIVE` (**Flow 2**). Trong quá trình thuê, FM điều phối mặt bằng và công việc nội bộ (**Flow 5**), khách được hỗ trợ kỹ thuật và bồi thường thiệt hại hàng hóa có đối chiếu dữ liệu cảm biến IoT (**Flow 7**). Cuối kỳ, khách có thể gia hạn, hẹn trả kho để nhận lại cọc (**Flow 3**), hoặc nếu quá hạn hệ thống sẽ khóa kho và chuyển đồ vào Kho Tổng bảo quản mà không bao giờ tự ý bán thanh lý tài sản của khách (**Flow 6**)."*

---

# TRỤ CỘT 2: DATABASE — ERD, QUAN HỆ CÁC BẢNG & KHÓA (PK/FK)

QueenKho sử dụng **25 bảng quan hệ chặt chẽ** trong Microsoft SQL Server (`QueenKhoDB`). 

### 1. Sơ đồ quan hệ ERD giữa các bảng cốt lõi:

```
┌──────────────┐ 1      N ┌─────────────────┐ 1      N ┌───────────────┐
│  facilities  ├─────────►│ facility_floors ├─────────►│ storage_units │
└──────┬───────┘          └─────────────────┘          └───┬───────────┘
       │ 1                                                 │ 1
       │                                                   │
       │ N                                                 │ N
┌──────▼───────┐ 1      1 ┌─────────────────┐ 1          1 │
│ reservations ├─────────►│ rental_contracts│◄─────────────┘
└──────────────┘          └───┬───────────┬─┘
                              │ 1         │ 1
                              │           │
                              │ N         │ N
                   ┌──────────▼───┐   ┌───▼──────────────────┐
                   │facility_tasks│   │ compensation_claims  │
                   └──────────────┘   └──────────────────────┘
```

### 2. Chi tiết các mối quan hệ & Khóa chính (PK) / Khóa ngoại (FK):
1. **Hạ tầng vật lý (Quan hệ 1 - N):**
   - `facilities` (PK: `id`) $\rightarrow$ `facility_floors` (FK: `facility_id`): Một cơ sở có nhiều tầng.
   - `facility_floors` (PK: `id`) $\rightarrow$ `storage_units` (FK: `floor_id`, FK: `facility_id`, FK: `unit_type_id`): Một tầng có nhiều ô kho. Mỗi ô lưu tọa độ `coordinate_x`, `coordinate_y` và mã ô tự sinh (vd: `KV-TB-A101`).
2. **Từ Đơn đặt chỗ sang Hợp đồng (Quan hệ 1 - 1 logic):**
   - `reservations` (PK: `id`, FK: `customer_id`, FK: `unit_type_id`): Lưu đơn cọc loại kho.
   - Khi FM gán ô $\rightarrow$ Tạo bản ghi trong `rental_contracts` (PK: `id`, FK: `reservation_id`, FK: `storage_unit_id`, FK: `customer_id`). Một đơn đặt chỗ đã gán chỉ sinh đúng 1 Hợp đồng duy nhất.
3. **Quản lý Vận hành & Phân công việc (Quan hệ 1 - N):**
   - `rental_contracts` $\rightarrow$ `facility_tasks` (FK: `contract_id`, FK: `assigned_staff_id`, FK: `facility_id`): Một hợp đồng trong suốt vòng đời sinh ra nhiều nhiệm vụ cho nhân viên (`CHECK_IN`, `CHECK_OUT`, `SUPPORT`, `MAINTENANCE`).
4. **Bồi thường thiệt hại (Quan hệ 1 - N & 1 - 1):**
   - `rental_contracts` $\rightarrow$ `support_requests` (FK: `contract_id`): Một hợp đồng có thể gửi nhiều ticket hỗ trợ.
   - `support_requests` $\rightarrow$ `compensation_claims` (FK: `support_request_id`, FK: `contract_id`): Ticket loại `GOODS_DAMAGE` sinh đúng 1 hồ sơ bồi thường mã `CLM-xxxxxx`.
5. **Dữ liệu thời gian thực (IoT Logs):**
   - `storage_units` $\rightarrow$ `environmental_logs` (FK: `storage_unit_id`): Bảng log lưu chuỗi thời gian (Timeseries) nhiệt độ, độ ẩm đo từ cảm biến.
   - `storage_units` $\rightarrow$ `access_logs` (FK: `storage_unit_id`, FK: `contract_id`): Lưu lịch sử mở cửa bằng PIN/RFID.

### 🗣️ Kịch bản Sơn trả lời trước Hội đồng:
> *"Dạ thưa thầy/cô, CSDL của nhóm gồm 25 bảng chuẩn hóa quan hệ. Trọng tâm dữ liệu là bảng `rental_contracts` liên kết với `storage_units` qua khóa ngoại `storage_unit_id` và liên kết với khách qua `customer_id`. Mọi tác vụ vận hành như `facility_tasks`, `support_requests` hay hồ sơ bồi thường `compensation_claims` đều tham chiếu về `contract_id`. Nhờ cấu trúc khóa ngoại chặt chẽ này, hệ thống đảm bảo tính toàn vẹn tham chiếu, không bao giờ xảy ra tình trạng sinh task hay duyệt đền bù trên một hợp đồng không tồn tại ạ."*

---

# TRỤ CỘT 3: BACKEND — CONTROLLER, SERVICE, REPOSITORY VÀ CÁCH PHỐI HỢP

Backend QueenKho xây dựng theo kiến trúc **Mô hình 3 tầng (3-Tier Layered Architecture)** kết hợp nguyên lý **Inversion of Control (IoC) / Dependency Injection (DI)**:

```
[HTTP Request từ Client]
           │
           ▼
[1. CONTROLLER LAYER] (StorageUnitController, StaffTaskController)
  - Tiếp nhận Request, định tuyến URL (/api/v1/...)
  - Validate dữ liệu đầu vào bằng @Valid (@NotNull, @Size(min=10))
  - "Skinny Controller": Không viết logic nghiệp vụ, chỉ gọi Service
  - Bọc kết quả trong ResponseEntity.ok(dto)
           │
           ▼ (Gọi qua Interface)
[2. SERVICE LAYER] (StorageUnitService, StaffTaskService)
  - "Trái tim" của hệ thống: Xử lý toàn bộ Business Rules
  - Kiểm tra chống âm suất cọc BR-11, khung 30 ngày giao việc PR-T1
  - Đảm bảo toàn vẹn giao dịch qua @Transactional
  - Map dữ liệu từ Entity CSDL ➔ Response DTO (bảo mật, không lộ Entity)
           │
           ▼ (Gọi qua Interface)
[3. REPOSITORY LAYER] (StorageUnitRepository, StaffTaskRepository)
  - Kế thừa JpaRepository<Entity, ID> của Spring Data JPA
  - Cung cấp sẵn CRUD (save, findById, delete)
  - Tự động sinh câu lệnh SQL an toàn (Prepared Statement chống SQL Injection)
           │
           ▼ (HikariCP Connection Pool)
[MICROSOFT SQL SERVER DATABASE]
```

### 🗣️ Kịch bản Sơn trả lời trước Hội đồng:
> *"Dạ thưa thầy/cô, Backend nhóm em tuân thủ nghiêm ngặt 3-Tier Layered Architecture: Khi client gọi API, **Controller** nhận Request DTO và kiểm tra `@Valid`. Sau đó, Controller ủy quyền hoàn toàn cho **Service** xử lý nghiệp vụ, kiểm tra các ràng buộc và điều phối logic trong `@Transactional`. Service sẽ gọi **Repository** kế thừa Spring Data JPA để tương tác với Database. Dữ liệu lấy lên từ Entity được Service chuyển đổi (map) sang Response DTO trước khi trả ngược lại Controller. Cách thiết kế này đảm bảo nguyên lý Single Responsibility (SRP) và giúp việc bảo trì, viết Unit Test độc lập từng tầng trở nên dễ dàng ạ."*

---

# TRỤ CỘT 4: FRONTEND — GỌI API VÀ HIỂN THỊ DỮ LIỆU LÊN REACT

Frontend xây dựng bằng **React 19 + Vite 8**, giao diện thiết kế bằng **Tailwind CSS 3**. Quy trình gọi API và cập nhật màn hình diễn ra như sau:

```
[1. User tương tác: Mở trang hoặc Bấm nút]
             │
             ▼
[2. useEffect Hook kích hoạt] ──► Gọi hàm Service (vd: storageUnitService.js)
                                             │
                                             ▼
[3. Axios Instance (api.js)] ◄── Interceptor tự động đọc JWT từ sessionStorage
             │                   gắn vào Header: Authorization: Bearer <token>
             ▼ (Gửi HTTP sang Backend)
[4. Nhận Response từ Backend]
             │
             ├── ❌ Thất bại (400, 409): Khối catch bắt lại ──► toast.error(err.response?.data?.message)
             │
             └──  Thành công (200): setData(res.data) ──► React State (useState) cập nhật
                                                                    │
                                                                    ▼
                                      [5. React Virtual DOM Re-render] ──► Vẽ lại đúng vùng thay đổi
```

* **Axios Interceptor (`frontend/src/services/api.js`):**
  - **Request Interceptor:** Tự động đính kèm `Bearer <token>` vào mọi request.
  - **Response Interceptor:** Bắt toàn cục lỗi `401 Unauthorized` hoặc `403 Forbidden` để tự động điều hướng người dùng về trang `/login` và xóa sạch phiên làm việc đã hết hạn.
* **Cơ chế lưu phiên `sessionStorage`:** Dùng `sessionStorage` thay vì `localStorage` để cô lập phiên làm việc theo từng tab. Khi đóng tab, phiên tự hủy sạch, giúp test đồng thời nhiều role (Khách, Quản lý, Nhân viên) trên các tab khác nhau mà không bị đè dữ liệu.

### 🗣️ Kịch bản Sơn trả lời trước Hội đồng:
> *"Dạ, ở Frontend, nhóm em dùng Axios đóng gói trong `api.js` với Base URL tập trung. Mọi request đều tự động đi qua Interceptor để đính kèm JWT token từ `sessionStorage`. Khi component React mount, `useEffect` gọi hàm service tương ứng. Nếu API trả về 200 OK, dữ liệu được nạp vào `useState`, kích hoạt React Virtual DOM render lại bảng dữ liệu. Nếu Backend trả về lỗi (như 400 hoặc 409 Conflict), khối `try...catch` ở component sẽ bắt lại và bung thông báo lỗi thân thiện qua Toast UI đỏ (`err.response.data.message`), đảm bảo người dùng không bao giờ gặp tình trạng đơ trang hay màn hình trắng ạ."*

---

# TRỤ CỘT 5: API — CÁC ENDPOINT QUAN TRỌNG, REQUEST/RESPONSE & STATUS CODE

Toàn bộ API tuân thủ chuẩn **RESTful (kebab-case, danh từ số nhiều)**:

| Method | Endpoint | Vai trò | Chức năng nghiệp vụ | Request Body tiêu biểu | Response & Status Code |
|:---:|---|:---:|---|---|:---:|
| `GET` | `/api/v1/storage-units` | FM | Lấy danh sách kho + KPI lấp đầy | Query: `facilityId`, `unitTypeId` | `200 OK` + Array danh sách ô |
| `POST` | `/api/v1/storage-units` | FM | Tạo ô kho mới trên sơ đồ | `{ unitTypeId, coordinateX, coordinateY }` | `201 Created` + Object ô mới sinh mã `KV-TB-A101` |
| `PATCH`| `/api/v1/storage-units/{id}/status` | FM | Khóa ô bảo trì / Mở lại kho | `{ status: "MAINTENANCE", reason: "Khóa hỏng..." }` | `200 OK` (Lỗi: `409 UNIT_IN_USE` nếu ô đang thuê) |
| `GET` | `/api/v1/staff-tasks` | Staff/FM | Lấy bảng việc nội bộ | Query: `status`, `taskType` | `200 OK` (Sắp xếp ưu tiên hạn 21:00) |
| `POST` | `/api/v1/staff-tasks/{id}/assign` | FM | Giao việc cho nhân viên | Query: `staffId=5` | `200 OK` (Lỗi: `409 OUT_OF_ASSIGN_WINDOW` nếu > 30 ngày) |
| `POST` | `/api/v1/staff-tasks/{id}/reset-pin`| Staff | Cấp lại mã PIN SmartLock | Không cần body (lấy ID task) | `200 OK` + `{ newPin: "839201" }` (Lỗi: `409 CONTRACT_OVERDUE`) |
| `POST` | `/api/v1/claims/{id}/decide` | FM | Duyệt/Từ chối bồi thường | `{ decision: "APPROVED", approvedAmount: 5000000 }` | `200 OK` + `{ status: "APPROVED" }` |

* **Ý nghĩa các HTTP Status Code chuẩn hóa:**
  - `200 OK`: Truy vấn hoặc cập nhật thành công.
  - `201 Created`: Tạo mới bản ghi thành công.
  - `400 Bad Request`: Vi phạm ràng buộc dữ liệu (mô tả dưới 10 ký tự, sai CCCD/SĐT).
  - `401 Unauthorized`: Chưa đăng nhập hoặc token sai/hết hạn.
  - `403 Forbidden`: Không có quyền truy cập hoặc vi phạm quyền sở hữu bản ghi (`FORBIDDEN_OWNER`, `FORBIDDEN_FACILITY`).
  - `404 Not Found`: Không tìm thấy ID tài nguyên trong CSDL.
  - `409 Conflict`: Xung đột quy tắc nghiệp vụ (xóa ô đã có lịch sử, cấp lại PIN cho hợp đồng quá hạn).

---

# TRỤ CỘT 6: AUTHENTICATION & AUTHORIZATION — ĐĂNG NHẬP, PHÂN QUYỀN & CHỐNG IDOR

Hệ thống bảo vệ dữ liệu theo **Quy tắc PR-90** với **3 lớp phòng thủ**:

```
[HTTP Request từ Client]
        │ Header: Authorization: Bearer <Token>
        ▼
[LỚP 1: AccessControlFilter (Filter cổng vào)]
   ├── Bước 1: Khớp URL với ma trận AccessPolicy (chưa khai báo ➔ 403 API_NOT_DECLARED)
   ├── Bước 2: Đọc Token ➔ Xác minh phiên & User ACTIVE (thiếu/sai ➔ 401 UNAUTHORIZED)
   └── Bước 3: Kiểm tra Role trong nhóm quyền (sai vai trò ➔ 403 ROLE_NOT_ALLOWED)
        │
        ▼ (Ghi đè thông tin người dùng vào CurrentUserProvider)
[LỚP 2: OwnershipGuard (Chống leo quyền ngang IDOR trên từng bản ghi)]
   ├── Khách hàng (CUSTOMER): Chỉ thao tác trên bản ghi có customer_id == userId (sai ➔ 403 FORBIDDEN_OWNER)
   └── Quản lý/Staff: Chỉ thao tác trên bản ghi có facility_id == facilityId của mình (sai ➔ 403 FORBIDDEN_FACILITY)
        │
        ▼
[LỚP 3: Controller & Service xử lý an toàn tuyệt đối]
```

* **Chống tấn công IDOR bằng `OwnershipGuard.java`:**
  - Nếu Khách hàng A đổi URL từ `/api/v1/contracts/10` sang `/api/v1/contracts/11` (của khách B), dù token của A hợp lệ, `OwnershipGuard.checkContract(11)` sẽ truy vấn SQL kiểm tra `customer_id`. Nếu không trùng, lập tức chặn đứng với mã lỗi **`403 FORBIDDEN_OWNER`**.

### 🗣️ Kịch bản Sơn trả lời trước Hội đồng:
> *"Dạ thưa thầy/cô, hệ thống bảo mật theo rule `PR-90` với cơ chế 2 tầng: Tầng 1 là `AccessControlFilter` kiểm tra chữ ký Token và đối chiếu vai trò qua ma trận `AccessPolicy`. Tầng 2 là `OwnershipGuard` bảo vệ từng bản ghi theo ngữ cảnh thực tế: Khách hàng chỉ được xem dữ liệu của chính mình, Quản lý và Nhân viên chỉ được thao tác trên dữ liệu thuộc cơ sở mình quản lý. Cơ chế này loại bỏ hoàn toàn nguy cơ tấn công leo quyền ngang IDOR ạ."*

---

# TRỤ CỘT 7: DATABASE TRANSACTION — XỬ LÝ NHIỀU BẢNG VỚI `@Transactional` & ACID

Trong hệ thống QueenKho, rất nhiều nghiệp vụ yêu cầu cập nhật đồng thời 3 đến 5 bảng CSDL khác nhau. Nhóm sử dụng annotation **`@Transactional`** của Spring Framework để đảm bảo 4 thuộc tính **ACID**:

### Ví dụ kinh điển: Nghiệp vụ Bàn giao Check-in (`StaffTaskService.completeCheckIn`)
Khi nhân viên bấm nút "Xác nhận bàn giao" tại quầy, Backend phải thực thi **6 hành động liên hoàn**:
1. `handoverRecordsRepo.save(record)`: Tạo bản ghi biên bản nhận kho, lưu danh sách 1-10 ảnh hiện trạng.
2. `contractsRepo.updateStatus(...)`: Chuyển Hợp đồng sang `ACTIVE`, lưu mã PIN SmartLock 6 số và thẻ RFID.
3. `staffTasksRepo.updateStatus(...)`: Đổi trạng thái Task `CHECK_IN` thành `COMPLETED`.
4. `reservationsRepo.updateStatus(...)`: Đổi Đơn đặt chỗ thành `COMPLETED`.
5. `storageUnitsRepo.updateStatus(...)`: Đổi trạng thái ô kho thành `OCCUPIED` (Đang sử dụng).
6. `activityLogsRepo.save(log)`: Ghi nhận lịch sử kiểm toán `[CHECK_IN] Bàn giao ô kho...`.

```
                  ┌─── [1. Lưu Biên bản Check-in] ────┐
                  ├─── [2. Đổi Hợp đồng ACTIVE] ──────┤
                  ├─── [3. Đổi Task COMPLETED] ───────┤
@Transactional ───┼─── [4. Đổi Đơn COMPLETED] ────────┼──► COMMIT (Thành công 100%)
                  ├─── [5. Đổi Ô kho OCCUPIED] ───────┤
                  └─── [6. Ghi Activity Log] ─────────┘
                                   │
                                   ▼ (Nếu Bước 5 lỗi kết nối DB / crash)
                        [ROLLBACK TOÀN BỘ VỀ BAN ĐẦU]
         (Không có dữ liệu rác, HĐ vẫn là PENDING_CHECK_IN, Task vẫn là IN_PROGRESS)
```

### Cơ chế Rollback tự động:
* Nếu trong quá trình thực thi, bước 1, 2, 3, 4 đã chạy xong nhưng đến bước 5 (đổi trạng thái ô kho) bị lỗi (ví dụ mất mạng hoặc trùng khóa ngoại), Spring Framework sẽ bắt được ngoại lệ `RuntimeException` và **lập tức ROLLBACK toàn bộ 4 bước trước đó về trạng thái ban đầu**.
* **Ý nghĩa sống còn:** Đảm bảo dữ liệu nhất quán tuyệt đối. Không bao giờ xảy ra tình trạng "Task thì báo hoàn thành nhưng Hợp đồng vẫn chưa kích hoạt, hoặc Hợp đồng đã kích hoạt nhưng ô kho vẫn báo trống"!

### 🗣️ Kịch bản Sơn trả lời trước Hội đồng:
> *"Dạ thưa thầy/cô, để bảo vệ tính toàn vẹn dữ liệu cho các nghiệp vụ tài chính và kho bãi, mọi phương thức cập nhật nhiều bảng đều được đánh dấu `@Transactional`. Ví dụ ở luồng Check-in, hệ thống phải cập nhật 5 bảng: Biên bản, Hợp đồng, Task, Đơn đặt chỗ và Ô kho. Nhờ `@Transactional`, nếu có bất kỳ lỗi nào xảy ra ở bất kỳ bước nào, toàn bộ giao dịch sẽ tự động Rollback hoàn toàn, đảm bảo tính nguyên tử (Atomicity) theo chuẩn ACID, không để lại dữ liệu rác trong CSDL ạ."*

---

# TRỤ CỘT 8: CONTRIBUTION — KỊCH BẢN GIẢI THÍCH CHÍNH XÁC PHẦN VIỆC CỦA SƠN

Khi thầy cô hỏi: *"Em Sơn đã làm những gì trong đồ án này? Đóng góp bao nhiêu %?"*, Sơn hãy trả lời dứt khoát, rành mạch và tự tin theo kịch bản mẫu sau:

### 🗣️ Kịch bản trả lời khẳng định đóng góp của Sơn:
> *"Kính thưa Hội đồng, trong dự án QueenKho, em đảm nhiệm vai trò **Full-Stack Developer phụ trách 2 phân hệ nghiệp vụ phức tạp nhất** của hệ thống:
> 
> 1. **Về Flow 5 (Quản lý Mặt bằng kho & Điều phối nội bộ của FM):**
>    - **Backend:** Em xây dựng toàn bộ các API trong `StorageUnitController` và `StaffTaskController`. Viết logic tính toán công suất lấp đầy kho, kiểm tra chống âm suất cọc theo rule `BR-11`, và thuật toán phân bổ Lịch ô kho theo dải thời gian rảnh `[start_date, end_date]`.
>    - **Frontend:** Em trực tiếp phát triển màn hình `StorageManagementPage.jsx` với giao diện Mặt bằng số hóa (Floor Plan Grid 0.5m), Modal Lịch ô kho Timeline, và trang điều phối công việc `ManagerTaskBoardPage.jsx`.
> 
> 2. **Về Flow 7 (Hỗ trợ khách hàng, SmartLock & Thẩm định bồi thường IoT):**
>    - **Backend:** Em phát triển các API trong `SupportRequestController` và `CompensationClaimController`. Xây dựng tính năng cấp lại mã PIN SmartLock 6 số (chặn khi hợp đồng nợ quá hạn theo `PR-Q5`), và nghiệp vụ bồi thường hàng hóa có đối chiếu dữ liệu Cảm biến IoT nhiệt độ/độ ẩm từ bảng `environmental_logs`.
>    - **Frontend:** Em xây dựng màn hình `ClaimsPage.jsx` cho Quản lý thẩm định và màn hình `CustomerSupportPage.jsx` cho khách hàng gửi ticket.
> 
> 3. **Về mặt Kỹ thuật nền tảng chung:**
>    - Em tham gia chuẩn hóa **22 mã lỗi Exception Handling** thống nhất giữa Spring Boot (`@ExceptionHandler`) và thông báo Toast trên React.
>    - Đóng góp vào việc thiết lập cơ chế kiểm soát bảo mật cô lập dữ liệu theo cơ sở (`PR-90`) và tích hợp hệ thống **Nút Giả lập (Time Travel Simulation)** để phục vụ công tác demo kiểm thử hôm nay.
> 
> Toàn bộ phần việc của em đều có commit lịch sử rõ ràng trên Git và em hoàn toàn làm chủ 100% mã nguồn của các luồng này ạ!"*

---
> 🎯 **LỜI NHẮC CUỐI CÙNG DÀNH CHO SƠN:** Giữ vững sự bình tĩnh, lắng nghe kỹ câu hỏi, phân loại xem câu hỏi thuộc Trụ cột nào trong 8 Trụ cột trên, rồi trả lời dứt khoát theo đúng kịch bản. Chúc Sơn bảo vệ thành công và đạt điểm xuất sắc!
