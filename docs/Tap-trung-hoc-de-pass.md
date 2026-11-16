# 🎯 TẬP TRUNG HỌC ĐỂ PASS SWP391 — QUEENKHO
### TÀI LIỆU ÔN TẬP TOÀN DIỆN: KỸ THUẬT, BẢN CHẤT LUỒNG DỮ LIỆU, 7 FLOW & TOÀN BỘ EXCEPTION
> **Dành riêng cho Sơn — Kỹ sư Full-Stack phụ trách Flow 5 & Flow 7.**  
> *Biên soạn chuẩn xác 100% theo mã nguồn thực tế và kịch bản demo chính thức của dự án.*

---

# 📑 MỤC LỤC BÀI HỌC

1. [PHẦN 1: BẢN CHẤT CƠ HỌC CỦA LUỒNG DỮ LIỆU (TRẢ LỜI 2 CÂU HỎI LÕI)](#phần-1-bản-chất-cơ-học-của-luồng-dữ-liệu-trả-lời-2-câu-hỏi-lõi)
   - [1.1 Tại sao thao tác trên UI lại liên quan đến hàm gọi API? (Điểm nối trong code)](#11-tại-sao-thao-tác-trên-ui-lại-liên-quan-đến-hàm-gọi-api-điểm-nối-trong-code)
   - [1.2 "Trả về" là trả từ đâu về đâu? (Hành trình 8 chặng đảo chiều)](#12-trả-về-là-trả-từ-đâu-về-đâu-hành-trình-8-chặng-đảo-chiều)
2. [PHẦN 2: BỐN YÊU CẦU TECHNICAL CỐT LÕI CỦA NHÓM TRƯỞNG](#phần-2-bốn-yêu-cầu-technical-cốt-lõi-của-nhóm-trưởng)
   - [2.1 API Contract & Chuẩn đặt tên URI (Câu chuyện `/unit-types`)](#21-api-contract--chuẩn-đặt-tên-uri-câu-chuyện-unit-types)
   - [2.2 Cấu trúc thư mục Frontend (React 19 + Vite)](#22-cấu-trúc-thư-mục-frontend-react-19--vite)
   - [2.3 Cấu trúc thư mục Backend (Spring Boot 4.x + Java 17 - Mô hình 3 tầng)](#23-cấu-trúc-thư-mục-backend-spring-boot-4x--java-17---mô-hình-3-tầng)
   - [2.4 Cơ chế Exception Handling (Từ `@ExceptionHandler` Backend lên Toast Frontend)](#24-cơ-chế-exception-handling-từ-exceptionhandler-backend-lên-toast-frontend)
3. [PHẦN 3: BỘ CÔNG THỨC 5 BƯỚC PHẢN XẠ KHI HỘI ĐỒNG HỎI VỀ 1 CA EXCEPTION](#phần-3-bộ-công-thức-5-bước-phản-xạ-khi-hội-đồng-hỏi-về-1-ca-exception)
4. [PHẦN 4: TOÀN BỘ 7 FLOW: HAPPY PATH & TOÀN BỘ CÁC CA EXCEPTION CHI TIẾT](#phần-4-toàn-bộ-7-flow-happy-path--toàn-bộ-các-ca-exception-chi-tiết)
   - [⭐ Flow 1: Storage Unit Reservation (Tìm kho, Đặt kho & Cọc VNPAY)](#-flow-1-storage-unit-reservation-tìm-kho-đặt-kho--cọc-vnpay)
   - [⭐ Flow 2: Storage Check-in & Handover (Gán ô, Giao việc & Bàn giao quầy)](#-flow-2-storage-check-in--handover-gán-ô-giao-việc--bàn-giao-quầy)
   - [⭐ Flow 3: Rented Storage Unit Management (Đang thuê ➔ Trả kho ➔ Hoàn cọc)](#-flow-3-rented-storage-unit-management-đang-thuê--trả-kho--hoàn-cọc)
   - [⭐ Flow 4: Business Rules, Fee Management & Revenue (Quản trị BOM)](#-flow-4-business-rules-fee-management--revenue-quản-trị-bom)
   - [⭐ Flow 5: Facility Storage & Staff Management (Quản lý kho & Nhân viên - FM)](#-flow-5-facility-storage--staff-management-quản-lý-kho--nhân-viên---fm)
   - [⭐ Flow 6: Renewal & Overdue Handling (Gia hạn, Quá hạn & Kho Tổng)](#-flow-6-renewal--overdue-handling-gia-hạn-quá-hạn--kho-tổng)
   - [⭐ Flow 7: Support Request, SmartLock & Goods Compensation (Hỗ trợ & Đền bù IoT)](#-flow-7-support-request-smartlock--goods-compensation-hỗ-trợ--đền-bù-iot)
5. [PHẦN 5: CHỐNG LỖ HỔNG BẢO MẬT IDOR & GIAO DỊCH DATABASE ACID](#phần-5-chống-lỗ-hổng-bảo-mật-idor--giao-dịch-database-acid)
6. [PHẦN 6: KỊCH BẢN TUYÊN BỐ ĐÓNG GÓP CỦA SƠN (CONTRIBUTION)](#phần-6-kịch-bản-tuyên-bố-đóng-góp-của-sơn-contribution)

---

# PHẦN 1: BẢN CHẤT CƠ HỌC CỦA LUỒNG DỮ LIỆU (TRẢ LỜI 2 CÂU HỎI LÕI)

## 1.1 Tại sao thao tác trên UI lại liên quan đến hàm gọi API? (Điểm nối trong code)

> **Câu hỏi:** *Tại sao người dùng bấm nút "+ Thêm ô kho" trên giao diện lại chạy đến hàm `storageUnitService.createStorageUnit(payload)` và bắn ra HTTP `POST /api/v1/storage-units`? Hai cái này dính líu với nhau ở đâu trong code?*

### 🔍 Giải phẫu cơ học từng dòng code:
Mối liên kết giữa **Nút bấm giao diện** và **Gói tin HTTP mạng** diễn ra qua một dây chuyền 5 mắt xích khép kín:

```
[Mắt xích 1: Thẻ JSX] (StorageManagementPage.jsx - dòng 736)
  <button onClick={() => setShowAddModal(true)}>+ THÊM Ô KHO MỚI</button>
       │
       ▼ Click chuột ➔ State showAddModal = true ➔ Modal mở ra
[Mắt xích 2: Form Submit] (StorageManagementPage.jsx - dòng 410)
  Hàm handleAddSubmit() đọc dữ liệu từ state addForm ➔ gom thành JS Object payload
       │
       ▼
[Mắt xích 3: Lời gọi hàm Service] (StorageManagementPage.jsx - dòng 412)
  const res = await createStorageUnit(payload, facilityId, actorUserId);
       │
       ▼ (Được import ở dòng 5 từ services/storageUnitService.js)
[Mắt xích 4: Tầng Axios Wrapper] (storageUnitService.js - dòng 26-30)
  export const createStorageUnit = async (data, facilityId, actorUserId) => {
    const response = await api.post('/storage-units', data, { params: { facilityId, actorUserId } });
    return response.data;
  };
       │
       ▼ (api là Axios instance được import từ services/api.js)
[Mắt xích 5: Axios Engine & Network Driver] (api.js - dòng 5)
  baseURL = 'http://localhost:8080/api/v1'
  Ghép chuỗi: baseURL + '/storage-units' ➔ POST http://localhost:8080/api/v1/storage-units
  Gắn Header: Authorization: Bearer <token lấy từ sessionStorage>
  Bắn gói tin TCP Socket qua cổng 8080 tới Spring Boot Server!
```

👉 **Kết luận:** Nút bấm không tự gọi mạng. Nút bấm kích hoạt **Sự kiện React (`onClick`)** $\rightarrow$ hàm trong Component gọi **Hàm Service JS** $\rightarrow$ Hàm Service dùng **Thư viện Axios** để serialize dữ liệu thành chuỗi HTTP Request thực sự gửi qua card mạng!

---

## 1.2 "Trả về" là trả từ đâu về đâu? (Hành trình 8 chặng đảo chiều)

> **Câu hỏi:** *Khi câu hướng dẫn ghi: "Controller trả 201 Created kèm StorageUnitDetailResponse $\rightarrow$ FE cập nhật danh sách hiển thị ô màu xanh", thì thực chất là trả từ đâu về đâu? Dữ liệu đi qua những trạm nào?*

### 🔍 Bản đồ 8 chặng đảo chiều (Từ ổ cứng Database về điểm ảnh Màn hình):

```
[Trạm 1: CSDL SQL Server]
  Thực thi lệnh INSERT INTO storage_units thành công. Bản ghi được ghi xuống ổ cứng.
       │
       ▼ JDBC Driver trả về số dòng bị ảnh hưởng (1 row affected)
[Trạm 2: Hibernate ORM (Tầng Repository)]
  Hibernate đồng bộ dữ liệu vào Java Entity Object: StorageUnit unit trong bộ nhớ RAM của Server.
       │
       ▼
[Trạm 3: Service Layer (StorageUnitService.java - dòng 280)]
  Service map Entity sang DTO: StorageUnitDetailResponse created = toDetailResponse(unit);
       │
       ▼
[Trạm 4: Controller Layer (StorageUnitController.java - dòng 108)]
  Controller đóng gói: return ResponseEntity.status(HttpStatus.CREATED).body(created);
       │
       ▼
[Trạm 5: Jackson Serialization Engine (Tầng HTTP Message Converter của Spring)]
  Thư viện Jackson tự động duyệt các trường Java trong created và ép thành chuỗi văn bản JSON camelCase:
  '{"id":"KV-TB-A101","status":"AVAILABLE","unitTypeId":2,"coordinateX":10,"coordinateY":20...}'
       │
       ▼ Đóng gói thành HTTP Response (Mã 201 Created, Content-Type: application/json)
[Trạm 6: Mạng Internet / Localhost (TCP Port 8080 ➔ Trình duyệt Browser)]
  Hệ điều hành gửi các gói tin TCP về card mạng máy client.
       │
       ▼
[Trạm 7: Axios Engine trong Trình duyệt (storageUnitService.js - dòng 30)]
  Axios nhận chuỗi JSON từ HTTP Response body, tự động parse thành JavaScript Object.
  Hàm createStorageUnit kết thúc, return response.data (chính là object ô kho mới).
       │
       ▼
[Trạm 8: Component React (StorageManagementPage.jsx - dòng 431-438)]
  1. const res nhận được Object ô kho mới.
  2. setToast({ type: 'success', message: 'Đã khởi tạo thành công ô kho KV-TB-A101!' }) ➔ Toast xanh bung ra.
  3. setShowAddModal(false) ➔ Đóng popup thêm ô.
  4. reloadAll() kích hoạt: Gọi lại getStorageUnits() ➔ setUnits(newUnits) ➔ State units thay đổi.
  5. React Virtual DOM chạy Diffing Algorithm, phát hiện có thêm 1 ô kho trạng thái AVAILABLE.
  6. Trình duyệt vẽ lại các điểm ảnh (Repaint Real DOM): Ô kho mới hiện hình vuông màu XANH LÁ CÂY trên sơ đồ!
```

---

# PHẦN 2: BỐN YÊU CẦU TECHNICAL CỐT LÕI CỦA NHÓM TRƯỞNG

## 2.1 API Contract & Chuẩn đặt tên URI (Câu chuyện `/unit-types`)
* **Tại sao đặt danh từ số nhiều (`unit-types`):**
  - Chuẩn **RESTful API Resource Naming (RFC 3986)** quy định URI định danh một **Tập hợp tài nguyên (Collection Resource)**. Một hệ thống có nhiều loại kho nên phải dùng danh từ số nhiều (`unit-types`, `storage-units`, `staff-tasks`). Không dùng động từ (`/getUnitTypes`) hay số ít (`/unit-type`).
* **Tại sao dùng kebab-case (`unit-types`) thay vì snake_case (`unit_types`) hay viết liền (`unittypes`):**
  - **Tránh nhầm lẫn thị giác:** Dấu `_` khi hiển thị trên liên kết URL có gạch chân (`underline`) sẽ bị che khuất hoàn toàn, người dùng dễ tưởng nhầm là dấu cách.
  - **Tối ưu Web Crawler/Parser:** Các cỗ máy tìm kiếm và URL parser coi dấu gạch ngang `-` là dấu tách từ (word delimiter), còn `_` bị coi là nối dính liền một từ.
  - **Clean Code:** Viết liền `unittypes` làm dính hai từ tiếng Anh riêng biệt, làm giảm độ đọc hiểu (Readability).
* **Quy chuẩn JSON:**
  - Tên thuộc tính: **camelCase** (`facilityId`, `startDate`, `depositAmount`) qua cấu hình Spring Boot: `spring.jackson.property-naming-strategy: LOWER_CAMEL_CASE`.
  - Giá trị Enum/Trạng thái: **CHỮ HOA KHÔNG DẤU** (`AVAILABLE`, `MAINTENANCE`, `PENDING_CHECK_IN`, `ACTIVE`, `OVERDUE`).

---

## 2.2 Cấu trúc thư mục Frontend (React 19 + Vite)
```
frontend/src/
├── components/                  # UI Components dùng chung:
│   ├── FloorPlanBoard.jsx       # Lưới sơ đồ mặt bằng 2D Grid 0.5m
│   ├── UnitScheduleModal.jsx    # Modal popup Gantt-Chart Lịch ô kho theo khoảng ngày
│   ├── SimulationButton.jsx     # ⚡ Nút giả lập tua thời gian demo (viền đứt cam)
│   └── PaginationBar.jsx        # Phân trang dữ liệu
├── pages/                       # Màn hình chức năng theo từng Actor:
│   ├── manager/                 # 🏢 Facility Manager:
│   │   ├── StorageManagementPage.jsx  # ⭐ FLOW 5: Quản lý ô kho & mặt bằng
│   │   ├── ManagerTaskBoardPage.jsx   # ⭐ FLOW 5: Bảng việc & giao việc
│   │   ├── ClaimsPage.jsx             # ⭐ FLOW 7: Thẩm định & chi trả đền bù
│   │   └── OverdueContractsPage.jsx   # ⭐ FLOW 6: Quá hạn & Hàng kho tổng
│   ├── staff/                   # 👷 Nhân viên cơ sở:
│   │   └── StaffTaskDetailPage.jsx    # ⭐ FLOW 2, 7: Check-in, Cấp lại PIN
│   ├── support/                 # 🙋 Khách hàng:
│   │   └── CustomerSupportPage.jsx    # ⭐ FLOW 7: Gửi ticket & khiếu nại bồi thường
│   └── reservation/             # 🛒 Khách đặt kho:
│       └── CreateReservationPage.jsx  # ⭐ FLOW 1: Đặt chỗ & cọc VNPAY
├── services/                    # Tầng Axios gọi API tập trung:
│   ├── api.js                   # Axios client cấu hình Base URL + JWT Interceptor
│   ├── storageUnitService.js    # ⭐ FLOW 5: API ô kho & mặt bằng
│   ├── staffTaskService.js      # ⭐ FLOW 2, 5, 7: API bảng việc, check-in, reset PIN
│   ├── supportService.js        # ⭐ FLOW 7: API ticket hỗ trợ
│   ├── claimService.js          # ⭐ FLOW 7: API thẩm định bồi thường
│   └── simulationService.js     # ⚡ API gọi tầng giả lập /dev/simulation
├── utils/                       # Hàm tiện ích: floorPlan.js, date.js, sensor.js
└── App.jsx                      # Cấu hình React Router v7 & Phân quyền Route Guard theo Layout
```

* **Cơ chế lưu phiên `sessionStorage`:** Dự án dùng `sessionStorage` thay vì `localStorage` để **cô lập phiên làm việc theo từng tab**. Đóng tab là xóa sạch token. Giúp người chấm bài có thể mở song song 4 tab (Khách, Staff, FM, BOM) trên cùng 1 trình duyệt để demo mà không bị đè phiên của nhau.

---

## 2.3 Cấu trúc thư mục Backend (Spring Boot 4.x + Java 17 - Mô hình 3 tầng)
```
com.queenkho.api/
├── controller/                  # 1. PRESENTATION LAYER (Định tuyến, validate, nhận DTO)
│   ├── StorageUnitController.java       # ⭐ FLOW 5: /api/v1/storage-units
│   ├── FloorPlanController.java         # ⭐ FLOW 5: /api/v1/storage-units/layout
│   ├── StaffTaskController.java         # ⭐ FLOW 2, 5, 7: /api/v1/staff-tasks
│   ├── SupportRequestController.java    # ⭐ FLOW 7: /api/v1/support-requests
│   ├── CompensationClaimController.java # ⭐ FLOW 7: /api/v1/claims
│   └── DemoSimulationController.java    # ⚡ /api/v1/dev/simulation (Tua thời gian demo)
├── service/                     # 2. BUSINESS LOGIC LAYER (Xử lý nghiệp vụ & @Transactional)
│   ├── StorageUnitService.java          # ⭐ FLOW 5: Chống âm suất BR-11, khóa bảo trì
│   ├── StaffTaskService.java            # ⭐ FLOW 2, 5, 7: Bàn giao check-in, cấp lại PIN
│   ├── SupportRequestService.java       # ⭐ FLOW 7: Chống spam ticket PR-S2
│   ├── CompensationClaimService.java    # ⭐ FLOW 7: Bồi thường, trần bảo hiểm, đối soát IoT
│   └── DemoSimulationService.java       # ⚡ Tua ngày trong DB & ghi log [SIMULATION]
├── repository/                  # 3. DATA ACCESS LAYER (Spring Data JPA)
│   ├── StorageUnitRepository.java       # CRUD & Derived Query bảng storage_units
│   ├── StaffTaskRepository.java         # Truy vấn facility_tasks
│   └── CompensationClaimRepository.java # Truy vấn compensation_claims
├── entity/                      # JPA Entities (Ánh xạ 1:1 với 25 bảng SQL Server)
├── dto/                         # Data Transfer Objects (Tách biệt hoàn toàn với Entity)
├── security/                    # Bảo mật: AccessControlFilter (PR-90), OwnershipGuard (chống IDOR)
└── exception/                   # Ngoại lệ: FacilityException, StaffTaskException, GlobalExceptionHandler
```

---

## 2.4 Cơ chế Exception Handling (Từ `@ExceptionHandler` Backend lên Toast Frontend)
Hệ thống không bao giờ để ứng dụng bị crash màn hình trắng (White Screen of Death). Quy trình xử lý lỗi diễn ra như sau:

```
[Service Layer ném ngoại lệ]
  throw new FacilityException(HttpStatus.CONFLICT, "SLOT_IN_USE", "Làm âm số suất cọc!");
       │
       ▼
[@RestControllerAdvice / GlobalExceptionHandler bắt lại]
  @ExceptionHandler(FacilityException.class)
  public ResponseEntity<Map<String, String>> handleFacilityException(FacilityException ex) {
      return ResponseEntity.status(ex.getStatus())
                           .body(Map.of("error", ex.getErrorCode(), "message", ex.getMessage()));
  }
       │
       ▼ Trả về HTTP 409 Conflict với Body JSON: {"error":"SLOT_IN_USE","message":"Làm âm số suất cọc!"}
[Axios Interceptor ở Frontend (api.js)]
  Phát hiện HTTP Status >= 400 ➔ Chuyển luồng vào khối catch (err) của Component React
       │
       ▼
[Component React (StorageManagementPage.jsx)]
  catch (err) {
      const errorMsg = err.response?.data?.message || "Đã xảy ra lỗi hệ thống!";
      toast.error(errorMsg); // Pop-up Duolingo đỏ xuất hiện góc màn hình
  }
```

---

# PHẦN 3: BỘ CÔNG THỨC 5 BƯỚC PHẢN XẠ KHI HỘI ĐỒNG HỎI VỀ 1 CA EXCEPTION

Khi Hội đồng hỏi: *"Luồng chạy của ca lỗi [Tên Exception] diễn ra như thế nào?"*, Sơn chỉ cần trả lời chuẩn chỉ theo 5 bước:

1. **Bước 1 (User Action):** Người dùng ở màn hình nào, thực hiện hành động sai gì và bấm nút gì.
2. **Bước 2 (FE Service):** Hàm Service nào gửi request đi, HTTP Verb gì, Endpoint URL nào.
3. **Bước 3 (BE Controller):** Controller nào đón nhận, chuyển xuống hàm Service nào.
4. **Bước 4 (BE Logic & Database):** Service truy vấn bảng nào, câu `if` nào phát hiện điều kiện sai và câu lệnh `throw new ...` kích hoạt mã lỗi gì.
5. **Bước 5 (Response & Toast UI):** Controller Advice bắt lỗi trả về HTTP Status code gì, JSON format ra sao và Frontend bung Toast thông báo như thế nào.

---

# PHẦN 4: TOÀN BỘ 7 FLOW: HAPPY PATH & TOÀN BỘ CÁC CA EXCEPTION CHI TIẾT

---

## ⭐ FLOW 1: STORAGE UNIT RESERVATION (TÌM KHO, ĐẶT KHO & CỌC VNPAY)

### 1. Luồng chạy Happy Path (A1)
* **B1 (Tìm kho):** Khách vào `/tim-va-dat-kho` $\rightarrow$ chọn cơ sở Tân Bình $\rightarrow$ FE gọi `GET /api/v1/facilities/1/unit-types/availability` $\rightarrow$ `FacilityController` $\rightarrow$ `UnitTypeService`. Hệ thống tính: `Suất khả dụng = Số ô trống AVAILABLE - Số đơn đang giữ suất` (`BR-11`). Khách chỉ thấy loại kho và giá, không thấy số ô cụ thể (`BR-135`).
* **B2 (Chọn gói & Hàng):** Chọn Kho Mini M, ngày nhận sau 7 ngày (`PR-B4`: từ ngày mai đến 90 ngày), gói 3 tháng (giảm 5%), khai báo loại hàng `Gia dụng` (`BR-131`), chọn bảo hiểm Cơ bản (`BR-125`), áp voucher `NEWKHO` giảm 100k (`D-06`), tick chấp thuận điều khoản `v4` (`BR-102`).
* **B3 (Tạo đơn & VNPAY):** Bấm "Thanh toán giữ kho" $\rightarrow$ `reservationService.createReservation()` gửi `POST /api/v1/reservations` $\rightarrow$ `ReservationController` $\rightarrow$ `ReservationService`: Kiểm tra không nợ cũ (`PR-Q12`), tạo đơn trạng thái **`PENDING`** giữ suất 15 phút (`PR-B6`), tạo URL VNPAY HMAC-SHA512.
* **B4 (Thanh toán Sandbox):** Khách trả thẻ NCB Sandbox $\rightarrow$ VNPAY gọi Webhook `GET /api/payments/vnpay/return` $\rightarrow$ Đối soát checksum và số tiền $\rightarrow$ Cập nhật đơn sang **`DEPOSIT_PAID`**, sinh mã đơn `RES-...`, gửi email hóa đơn cọc và thông báo cho FM (`BR-111`, `BR-117`).

### 2. Chi tiết các ca Exception của Flow 1 (F1-X1 $\rightarrow$ F1-X10)
* **⭐ F1-X1 (Nhập sai khi đặt kho):**
  - Chọn hàng "Thực phẩm" ở kho thường $\rightarrow$ `ReservationService` kiểm tra `coolingType != 'COLD'/'FROZEN'` $\rightarrow$ Ném `400 GOODS_REQUIRES_COLD_STORAGE` (`BR-131`).
  - Bỏ tick điều khoản $\rightarrow$ Ném `400 TERMS_NOT_ACCEPTED` (`BR-102`).
  - Chọn ngày nhận $> 90$ ngày $\rightarrow$ Ném `400 START_DATE_TOO_FAR` (`PR-B4`).
  - Áp voucher kho lạnh `LANH50` cho kho thường $\rightarrow$ Ném `400 VOUCHER_INVALID` (`BR-133`).
* **F1-X2 (Hết ô nhưng có ô sắp trống):** Ô A106 đã hẹn trả sau 5 ngày $\rightarrow$ Màn hình hiện "Trống từ dd/MM". Khách cố tình gọi API đặt trước ngày đó $\rightarrow$ Ném `409 NO_AVAILABILITY` (`PR-R11`).
* **⭐ F1-X3 (Chặn khách đang nợ tiền):** Khách `duc.khach` đang nợ 650k phạt sự cố $\rightarrow$ `ReservationService` kiểm tra `hasUnpaidDebt(customerId)` $\rightarrow$ Ném lỗi `409 CUSTOMER_HAS_DEBT` (`PR-Q12`). FE hiện banner đỏ dẫn link tới HĐ nợ để thanh toán qua VNPAY trước.
* **F1-X4 (Số ô trống theo khoảng ngày):** Gói 1 tháng còn ô, đổi sang gói 3 tháng bị vướng lịch của khách sau $\rightarrow$ Màn hình đổi thành "Không còn ô", gợi ý đổi ngày hoặc gói (`BR-136`).
* **⭐ F1-X5 (Năm mức hủy đơn cọc):** Khách bấm "Hủy đơn" tại `Kho của tôi`:
  - Trong 30 phút sau thanh toán: Hoàn 100% (`BR-32a`).
  - Trước $\ge 48$h: Hoàn 100% cọc + tiền thuê.
  - Từ 24–48h: Hoàn 50% cọc + tiền thuê.
  - Dưới 24h: Mất 100% cọc, hoàn tiền thuê.
  - Sau giờ hẹn: Tính như No-Show (mất 100% cọc + 1 tháng tiền thuê).
* **F1-X6 (Chặn xem đơn người khác):** Khách A đổi ID trên URL sang đơn của Khách B $\rightarrow$ `OwnershipGuard.checkReservation()` kiểm tra `customer_id != userId` $\rightarrow$ Ném `403 FORBIDDEN_OWNER` (`PR-90`).
* **F1-X9 (Tranh chấp suất cuối):** 2 khách cùng bấm cọc 1 ô duy nhất $\rightarrow$ Người bấm trước giữ khóa DB Lock, người bấm sau bị ném `409 NO_AVAILABILITY` (`PR-B1`).
* **F1-X10 (Quá 15 phút chưa cọc):** Bấm nút ⚡ "Hết hạn giữ chỗ" $\rightarrow$ Đơn chuyển `EXPIRED`, nhả lại suất khả dụng (`EX-01`).

---

## ⭐ FLOW 2: STORAGE CHECK-IN & HANDOVER (GÁN Ô, GIAO VIỆC & BÀN GIAO QUẦY)

### 1. Luồng chạy Happy Path (A2)
* **B1 (FM gán ô kho):** FM vào `/manager/pending` chọn đơn `RES-F2-01` $\rightarrow$ Mở modal Lịch ô kho chọn ô trống `D201` rảnh trọn vẹn trong kỳ thuê $\rightarrow$ `reservationService.assignUnit(reservationId, { storageUnitId: "D201" })` gửi `POST /api/v1/reservations/{id}/assign` $\rightarrow$ `ReservationService.assignUnit()` chạy trong 1 `@Transactional`: Đổi đơn sang `UNIT_ASSIGNED`, tạo HĐ `PENDING_CHECK_IN`, sinh Task `CHECK_IN` trong `facility_tasks`, khóa ô sang `OCCUPIED` (`BR-40` $\rightarrow$ `BR-43`).
* **B2 (FM giao việc):** FM vào `/manager/tasks` giao task Check-in cho nhân viên $\rightarrow$ `staffTaskService.assignTask()` gửi `POST /api/v1/staff-tasks/{id}/assign?staffId=X` $\rightarrow$ Task chuyển `IN_PROGRESS`, Staff nhận thông báo chuông (`BR-64`).
* **B3 (Staff bàn giao tại quầy):** Staff mở task trên `/staff`, đối chiếu CCCD, kiểm tra đủ 6 mục checklist (`BR-132`), bấm "Ảnh mẫu demo" tải 1-10 ảnh hiện trạng (`BR-121`), cấp thẻ RFID và mã PIN SmartLock 6 số $\rightarrow$ Bấm "Xác nhận bàn giao" $\rightarrow$ `staffTaskService.completeCheckIn()` gửi `POST /api/v1/staff-tasks/{id}/complete-check-in` $\rightarrow$ `@Transactional`: Lưu biên bản `CHECK_IN` vào `handover_records`, kích hoạt Hợp đồng thành **`ACTIVE`**, Task chuyển `COMPLETED`.
* **B4 (Khách nhận kho):** Khách vào `Kho của tôi` thấy HĐ `ACTIVE`, xem được mã PIN, thẻ RFID, vị trí ô trên mặt bằng và xem lại ảnh bàn giao (`BR-80`).

### 2. Chi tiết các ca Exception của Flow 2 (F2-X1 $\rightarrow$ F2-X12)
* **F2-X1 (Checklist chưa đủ):** Staff bỏ sót mục kiểm tra hàng hoặc thiếu ảnh $\rightarrow$ `StaffTaskService` kiểm tra $\rightarrow$ Ném `400 CHECKLIST_INCOMPLETE` (`BR-132`, `BR-121`).
* **⭐ F2-X3 (Khung 30 ngày giao việc):** FM giao task Check-in trước ngày hẹn $> 30$ ngày $\rightarrow$ Dòng 624 `StaffTaskService.java` ném `409 TASK_NOT_IN_WINDOW` (`PR-T1`).
* **⭐ F2-X4 (Lấp khoảng trống):** Ô đã gán cho khách A (nhận sau 60 ngày), khách B thuê 1 tháng từ hôm nay $\rightarrow$ Hệ thống vẫn cho gán ô này cho B vì dải thời gian không chồng chéo (`D-18`, `BR-136`).
* **⭐ F2-X5 (Ô hỏng trước ngày bàn giao):** Ô đã gán bị dột, FM bấm Khóa bảo trì $\rightarrow$ Hệ thống hiện cảnh báo danh sách khách bị ảnh hưởng và cho phép FM bấm **"Đổi ô kho"** tương đương (`BR-122`, `BR-141`).
* **⭐ F2-X6 (No-Show khách từ chối tới):** Khách gọi báo hủy $\rightarrow$ FM có nút "Hủy No-Show ngay", giữ cọc + 1 tháng tiền thuê, hoàn phần còn lại (`D-07`).
* **F2-X7 (No-Show không nghe máy):** Staff gọi điện khách không bắt máy $\rightarrow$ Bắt buộc Staff phải ghi nhận **đủ $\ge 2$ cuộc gọi thất bại** và **qua 48 giờ** thì FM mới được duyệt hủy No-Show (`D-07`, `PR-X3`).
* **F2-X9 (Trùng lịch do khách cũ gia hạn):** Khách đang thuê gia hạn đè lên khoảng ngày đã gán cho khách mới $\rightarrow$ Lịch ô kho báo viền đỏ $\rightarrow$ Điều hướng FM đổi ô khác cho khách mới (`PR-R10`).
* **F2-X12 (Gán sai loại, sai cơ sở):** Cố tình gọi API gán ô khác loại hoặc khác cơ sở $\rightarrow$ Ném lỗi `409 FACILITY_MISMATCH` hoặc `400 INVALID_UNIT_TYPE` (`BR-41`).

---

## ⭐ FLOW 3: RENTED STORAGE UNIT MANAGEMENT (ĐANG THUÊ ➔ TRẢ KHO ➔ HOÀN CỌC)

### 1. Luồng chạy Happy Path (A3)
* **B1 (Đang thuê 24/7):** Khách dùng PIN/RFID ra vào kho bất kể giờ nào. Xem nhiệt độ/độ ẩm ô kho.
* **B2 (Khách hẹn trả kho):** Khách vào chi tiết HĐ $\rightarrow$ tab "Trả kho" $\rightarrow$ chọn ngày mai $\rightarrow$ nhập STK ngân hàng nhận cọc $\rightarrow$ `contractService.scheduleCheckout()` gửi `POST /api/v1/contracts/{id}/schedule-checkout` $\rightarrow$ HĐ chuyển `TERMINATION_PENDING`, sinh Task `CHECK_OUT` cho Staff, ô kho đánh dấu "Sắp trống" từ ngày hẹn + 1 để bán trước (`PR-O1`, `PR-R11`).
* **B3 (Staff nghiệm thu):** Nhân viên mở task Check-out $\rightarrow$ kiểm tra ô kho cùng khách đối chiếu ảnh check-in $\rightarrow$ Kho sạch sẽ, không hư hại $\rightarrow$ Bấm "Nghiệm thu tốt" $\rightarrow$ `POST /api/v1/staff-tasks/{id}/complete-checkout` $\rightarrow$ `@Transactional`: Lưu biên bản `CHECK_OUT` vào `handover_records`, chuyển HĐ sang `TERMINATED`, xóa sạch PIN/RFID, ô kho mở lại `AVAILABLE`, tự động sinh Task **`REFUND`** tiền cọc giao cho FM (`PR-O6`, `PR-O7`, `PR-O12`).
* **B4 (FM hoàn cọc):** FM mở `/manager/refunds`, chuyển khoản cho khách, upload ảnh Ủy nhiệm chi (UNC) và nhập mã FT $\rightarrow$ `POST /api/v1/staff-tasks/{id}/complete-refund` $\rightarrow$ Giao dịch `REFUND` chuyển `SUCCESS`, hoàn tất hợp đồng (`PR-O15`).

### 2. Chi tiết các ca Exception của Flow 3 (F3-X1 $\rightarrow$ F3-X7)
* **⭐ F3-X1 (Trả sớm gói dài hạn):** Thuê gói 6 tháng (giảm 10%), ở 2 tháng đã xin trả sớm $\rightarrow$ Hệ thống tự tính: **Thu hồi 10% tiền ưu đãi của 2 tháng đã ở + Phạt 1 tháng tiền thuê do phá hợp đồng** $\rightarrow$ Tiền hoàn lại = Tiền thuê còn lại trừ đi các khoản phạt (`D-10`, `PR-O2`).
* **F3-X2 (Dời / Hủy yêu cầu trả kho):** Khách đổi ý muốn thuê tiếp $\rightarrow$ Bấm "Hủy yêu cầu trả kho" trước ngày hẹn $\rightarrow$ HĐ quay về `ACTIVE`, Task Check-out tự hủy.
* **F3-X3 (Sự cố hư hỏng trong hạn mức cọc):** Khách làm vỡ đèn kho sửa hết 500k (cọc 1.850k) $\rightarrow$ Cấn trừ 500k vào cọc $\rightarrow$ Task hoàn cọc tự giảm xuống còn 1.350.000đ (`PR-O8`).
* **⭐ F3-X4 (Thiệt hại vượt tiền cọc):** Khách làm cháy hỏng kho thiệt hại 5 triệu (cọc 2 triệu) $\rightarrow$ Cấn trừ sạch 2 triệu cọc, **3 triệu còn lại chuyển thành Khoản nợ (`DAMAGE_FEE`)** của khách. Khách bị chặn đặt kho mới cho đến khi trả nợ (`D-09`, `PR-Q12`).
* **F3-X7 (Chuyển ô khi đang thuê):** Ô kho bị thấm dột $\rightarrow$ FM dùng chức năng "Chuyển ô kho", chuyển HĐ sang ô trống cùng loại $\rightarrow$ Cấp mã PIN/RFID mới mà không ngắt quãng thời hạn thuê (`BR-122`).

---

## ⭐ FLOW 4: BUSINESS RULES, FEE MANAGEMENT & REVENUE (QUẢN TRỊ BOM)

### 1. Luồng chạy Happy Path (A4)
* **Doanh thu chuỗi (`/bom/revenue`):** `GET /api/v1/bom/revenue` $\rightarrow$ `BomRevenueService` tổng hợp: Doanh thu thực thu, tiền phạt, tiền cọc đang giữ, tỷ lệ lấp đầy từng cơ sở, đối soát mã FT, xuất file CSV (`PR-M7`, `PR-M8`).
* **Sửa giá loại kho (`/bom/unit-types`):** Sửa giá Kho Đặc Biệt XL $\rightarrow$ 6.800.000đ $\rightarrow$ `PUT /api/v1/unit-types/{id}`. Giá mới chỉ áp dụng cho đơn mới, **không làm đổi hợp đồng cũ** (`PR-12`).
* **Ban hành Chính sách thuê (`/bom/policies`):** Cập nhật hệ số cọc chi nhánh Bình Thạnh = 2 tháng $\rightarrow$ `POST /api/v1/rental-policies` phát hành phiên bản mới (`v2`), các HĐ cũ giữ nguyên bản lúc ký (`PR-13`).
* **Tạo Voucher (`/bom/vouchers`):** Tạo mã `THU2026` giảm 80k cho riêng `Kho Mini M` $\rightarrow$ `POST /api/v1/vouchers` (`BR-133`).
* **Miễn phí phạt trễ hạn (`/bom/overdue`):** BOM duyệt miễn phí phạt trễ hạn cho khách gặp bất khả kháng $\rightarrow$ Tiền phạt trễ đưa về 0đ (`BR-130`).

### 2. Chi tiết các ca Exception của Flow 4 (F4-X1 $\rightarrow$ F4-X3)
* **⭐ F4-X1 (BOM nhập sai dữ liệu):** Nhập giá $\le 0$, nhập hệ số cọc $< 1$ hoặc $> 3$ $\rightarrow$ Báo lỗi validation viền đỏ `400 BAD_REQUEST` (`PR-M3`, `PR-14`).
* **F4-X2 (Tắt quyền FM miễn phạt):** BOM tắt quyền miễn phạt của cơ sở Bình Thạnh $\rightarrow$ FM vào hợp đồng quá hạn bị ẩn nút miễn phạt hoặc bị chặn `403 FORBIDDEN`.
* **F4-X3 (Sai vai trò RBAC):** Staff hoặc Khách cố gõ URL `/bom/revenue` $\rightarrow$ Router Guard chặn ngay lập tức (`AccessPolicy`).

---

## ⭐ FLOW 5: FACILITY STORAGE & STAFF MANAGEMENT (QUẢN LÝ KHO & NHÂN VIÊN - FM)

### 1. Luồng chạy Happy Path (A5)
* **B1 (Dashboard & Mặt bằng Grid):** FM mở `/manager` xem KPI lấp đầy (`PR-M14`). Vào `/manager/storage` xem mặt bằng tầng 2 lưới 0.5m: Xanh (Trống), Đỏ (Đang thuê), Cam (Bảo trì), Vàng (Sắp trống) (`BR-105` $\rightarrow$ `BR-107`).
* **B2 (Lịch ô kho Timeline):** Bấm "LỊCH Ô KHO" xem Gantt-Chart dải ngày thuê 1, 3, 6, 12 tháng. Bấm vào hợp đồng mở **popup chi tiết ngay trên trang** mà không bị mất session đăng nhập.
* **B3 (Thêm ô kho mới):** Bấm "+ Thêm ô kho", chọn loại và tọa độ $(X, Y)$ $\rightarrow$ `storageUnitService.createStorageUnit()` gửi `POST /api/v1/storage-units` $\rightarrow$ Mã ô tự sinh `KV-TB-C105`, trạng thái `AVAILABLE`.
* **B4 (Khóa bảo trì & Mở lại kho):** Bấm "Khóa bảo trì", nhập lý do $\ge 10$ ký tự $\rightarrow$ `PATCH /api/v1/storage-units/{id}/status` sang `MAINTENANCE` $\rightarrow$ Tự động sinh Task bảo trì cho nhân viên kỹ thuật. Sửa xong bấm "Mở lại kho" $\rightarrow$ Ô về `AVAILABLE`, task tự đóng `COMPLETED` (`PR-M9`).
* **B5 (Quản lý Bảng việc):** Vào `/manager/tasks` thanh lọc task theo hạn chót 21:00, ưu tiên việc khẩn cấp ghim trên cùng. Giao việc cho Staff cơ sở mình (`BR-63`, `PR-34`).

### 2. Chi tiết các ca Exception của Flow 5 (F5-X1 $\rightarrow$ F5-X7)
* **⭐ F5-X1 (Khóa vị trí ô đang thuê - `UNIT_IN_USE`):**
  - FM cố tình kéo thả hoặc xóa ô đang có khách thuê (`OCCUPIED`).
  - Dòng 385 `StorageUnitService.java` kiểm tra `if ("OCCUPIED".equals(unit.getStatus()))` $\rightarrow$ Ném `409 UNIT_IN_USE` (`D-18`). FE bung Toast đỏ chặn thao tác.
* **⭐ F5-X2 (Chặn làm âm số suất cọc - `SLOT_IN_USE` - Rule `BR-11`):**
  - Cơ sở còn 2 ô trống Mini M, nhưng đang có 2 đơn cọc chờ gán ô. FM bấm khóa bảo trì 1 ô.
  - Dòng 533 `StorageUnitService.java` chạy hàm `validateRemainingSlots`: `remainingSlots = availableCount - pendingReservations = 2 - 2 = 0`. Khóa thêm 1 ô thì âm $\rightarrow$ Ném lỗi `409 SLOT_IN_USE`: *"Hành động này làm số ô trống nhỏ hơn số đơn đã cọc!"*.
* **F5-X3 (Chặn xóa ô có lịch sử - `UNIT_HAS_CONTRACT_HISTORY` - Rule `PR-21`):**
  - Bấm xóa ô đã từng có hợp đồng thuê trong quá khứ $\rightarrow$ Dòng 502 `StorageUnitService.java` kiểm tra `countByStorageUnitId > 0` $\rightarrow$ Ném lỗi `409 UNIT_HAS_CONTRACT_HISTORY`.
* **F5-X4 (Trùng mã ô kho - `DUPLICATE_UNIT_CODE`):**
  - Cố tình thêm ô có mã vật lý đã tồn tại trong DB $\rightarrow$ Dòng 272 `StorageUnitService.java` ném `409 DUPLICATE_UNIT_CODE`.
* **F5-X5 (Loại kho tạm ngưng - `UNIT_TYPE_INACTIVE`):**
  - Tạo ô mới bằng loại kho đang bị BOM ngưng hoạt động $\rightarrow$ Dòng 256 ném `400 UNIT_TYPE_INACTIVE`.
* **F5-X6 (Lý do bảo trì quá ngắn - `INVALID_INPUT`):**
  - Nhập lý do khóa bảo trì dưới 10 ký tự $\rightarrow$ Dòng 402 ném `400 INVALID_INPUT`: *"Ghi chú lý do bảo trì từ 10 đến 500 ký tự"*.
* **⭐ F5-X7 (Giao việc ngoài khung 30 ngày - `TASK_NOT_IN_WINDOW` - Rule `PR-T1`):**
  - FM giao task Check-in trước ngày hẹn $> 30$ ngày $\rightarrow$ Dòng 624 `StaffTaskService.java` ném `409 TASK_NOT_IN_WINDOW`.

---

## ⭐ FLOW 6: RENEWAL & OVERDUE HANDLING (GIA HẠN, QUÁ HẠN & KHO TỔNG)

### 1. Luồng chạy Happy Path (A6)
* **Gia hạn hợp đồng:** Hệ thống tự động gửi thông báo chuông và email nhắc hạn trước 15, 10, 7, 3, 1 ngày (`PR-R9`). Khách bấm "Gia hạn" trước ngày hết hạn 3 ngày (`PR-R10`), chọn gói 3 tháng $\rightarrow$ Thanh toán VNPAY $\rightarrow$ `ContractController.renewContract()` nối tiếp hạn `end_date` liền mạch (`BR-81`, `BR-82`).

### 2. Chi tiết các ca Exception của Flow 6 (F6-X1 $\rightarrow$ F6-X6)
* **F6-X1 (Gia hạn muộn khi ô chưa ai đặt):** Khách để sát ngày mới gia hạn, ô chưa bị ai đặt trước $\rightarrow$ Hệ thống vẫn linh động cho phép gia hạn giữ lại ô cũ (`PR-R10`).
* **⭐ F6-X2 (Gia hạn muộn đã có người giữ suất):** Khách để sát ngày mới gia hạn nhưng ô đã được bán trước cho khách mới từ ngày mai $\rightarrow$ Hệ thống chặn gia hạn tại ô cũ, yêu cầu khách **chuyển sang ô trống khác cùng loại** để thuê tiếp (`D-12`, `PR-R11`).
* **⭐ F6-X3 (Quá hạn 3 ngày tính phí trễ):** Hết hạn không trả kho $\rightarrow$ Tua giả lập quá hạn 3 ngày $\rightarrow$ HĐ chuyển `OVERDUE`, khóa PIN không cho mở cửa, tính phí trễ hạn cấn trừ vào cọc (tối đa 50% cọc) (`PR-Q5`, `PR-Q8`).
* **⭐ F6-X5 (Điều khoản v4 tự thanh lý chuyển KHO TỔNG - Job 00:05):** Khách ký điều khoản `v4`, hết hạn không trả kho $\rightarrow$ 00:05 đêm hôm sau Cron Job tự chuyển HĐ sang `LIQUIDATED`, sinh Task dọn hàng vào **KHO TỔNG**, ô kho cũ lập tức mở lại `AVAILABLE` đón khách mới (`D-15`).
* **F6-X6 (Khách nhận lại hàng ở Kho Tổng):** Khách quá hạn vào `Thanh toán & Khoản nợ` trả hết nợ phí lưu giữ qua VNPAY $\rightarrow$ Đến cơ sở xuất trình CCCD nhận lại toàn bộ tài sản nguyên vẹn. **Tuyệt đối không bán thanh lý hay tiêu hủy đồ của khách** (`D-15`).

---

## ⭐ FLOW 7: SUPPORT REQUEST, SMARTLOCK & GOODS COMPENSATION (HỖ TRỢ & ĐỀN BÙ IOT)

### 1. Luồng chạy Happy Path (A7)
* **Khách quên PIN:** Vào `/ho-tro` gửi ticket loại `LOCK_ISSUE` $\rightarrow$ `supportService.createTicket()` gửi `POST /api/v1/support-requests` $\rightarrow$ `SupportRequestService` tạo ticket `OPEN` (Độ ưu tiên `HIGH`), tự động sinh 1 Task `SUPPORT` **Khẩn cấp (Hạn 2 giờ)** nổi lên đầu bảng việc Staff (`PR-34`).
* **Staff cấp lại PIN mới:** Staff mở task trên `/staff`, đối chiếu CCCD $\rightarrow$ Bấm "Cấp lại PIN" $\rightarrow$ `staffTaskService.resetSupportContractPin()` gửi `POST /api/v1/staff-tasks/{id}/reset-pin` $\rightarrow$ Hệ thống sinh PIN 6 số ngẫu nhiên không trùng, cập nhật vào HĐ, gửi email cho khách (`PR-S5`, `PR-S6`). Staff hoàn tất task $\rightarrow$ Ticket chuyển `RESOLVED`. Khách mở khóa kho thành công bấm **"Đã ổn"** $\rightarrow$ Ticket chuyển **`CLOSED`** (`PR-52`).
* **Thẩm định bồi thường hàng hóa có đối chiếu IoT:**
  - Khách báo vải ẩm mốc $\rightarrow$ Tạo hồ sơ `compensation_claims` mã `CLM-000123` trạng thái `SUBMITTED`. Staff đến lập biên bản hiện trường $\rightarrow$ Chuyển `INSPECTED`.
  - **FM đối chiếu dữ liệu:** FM mở `ClaimsPage.jsx`, hệ thống gọi trích xuất biểu đồ cảm biến từ `environmental_logs`: Phát hiện độ ẩm ô kho $> 75\%$ liên tục 4 ngày (ngưỡng chuẩn $\le 65\%$) $\rightarrow$ Lỗi cơ sở 100%.
  - **Tính tiền & Chi trả:** FM tính tiền bồi thường qua `POST /api/v1/claims/{id}/quote`: Chấp thuận tiền hàng 8 triệu (trong trần bảo hiểm Cơ bản 20 triệu) + Đền 1 tháng tiền thuê (`BR-127`). FM bấm Duyệt $\rightarrow$ Chuyển khoản ngân hàng upload mã FT $\rightarrow$ Hồ sơ sang `PAID`, gửi hồ sơ sang bảo hiểm để đòi bồi hoàn (`BR-128`).

### 2. Chi tiết các ca Exception của Flow 7 (F7-X1 $\rightarrow$ F7-X8)
* **F7-X1 (Chống spam ticket - `MAX_OPEN_TICKETS_REACHED` - Rule `PR-S2`):**
  - Khách gửi ticket thứ 4 trên cùng 1 hợp đồng $\rightarrow$ Dòng 222 `SupportRequestService.java` kiểm tra `openCount >= 3` $\rightarrow$ Ném lỗi `409 MAX_OPEN_TICKETS_REACHED`. Không được mở trùng loại sự cố (`409 DUPLICATE_ISSUE_TYPE`).
* **F7-X2 (Khách báo "Chưa xong"):** Sau khi Staff xử lý mà khách thử vẫn không được $\rightarrow$ Khách bấm "Chưa xong" $\rightarrow$ Ticket quay lại `OPEN`, tự sinh task mới cho Staff làm tiếp (`PR-S7`).
* **F7-X3 (Task hỗ trợ quá hạn):** Nhân viên bận không kịp xử lý $\rightarrow$ Task chuyển `OVERDUE` $\rightarrow$ FM có nút **"Gia hạn xử lý"** (tối đa thêm 7 ngày, dời hạn về 21:00) và điều phối lại cho nhân viên khác (`PR-S4`).
* **⭐ F7-X7 (Chặn cấp lại PIN cho Hợp đồng nợ quá hạn - `CONTRACT_OVERDUE` - Rule `PR-Q5`, `PR-S6`):**
  - Khách đang nợ phí trễ hạn (`OVERDUE`) gọi lên xin cấp lại mã PIN.
  - Staff bấm "Cấp lại PIN" $\rightarrow$ Dòng 1030 `StaffTaskService.java` kiểm tra:
    ```java
    if ("OVERDUE".equalsIgnoreCase(contract.getStatus())) {
        throw new StaffTaskException(HttpStatus.CONFLICT, "CONTRACT_OVERDUE",
                "Hợp đồng đang quá hạn thanh toán (OVERDUE), mã PIN đang bị khóa nên không thể cấp lại (PR-Q5, PR-S6)");
    }
    ```
  - Trả về HTTP `409 Conflict`. Màn hình Toast đỏ cảnh báo. Bắt buộc khách phải trả hết nợ mới được cấp PIN mở kho.
* **F7-X6 (Thiếu ảnh bằng chứng - `EVIDENCE_IMAGE_REQUIRED`):** Khách báo hỏng hàng nhưng không tải ảnh $\rightarrow$ Dòng 99 `CompensationClaimService.java` ném `400 EVIDENCE_IMAGE_REQUIRED` (`BR-126`).
* **F7-X5 (Lỗi do khách $\rightarrow$ Từ chối đền bù):** Cảm biến trong `environmental_logs` luôn đạt chuẩn $45\%$, nhưng `access_logs` cho thấy khách mở cửa lúc trời mưa bão tự làm nước hắt vào $\rightarrow$ FM bấm "Từ chối bồi thường" (`REJECTED`) kèm giải trình số liệu minh bạch.
* **F7-X8 (Mô phỏng cảm biến vượt ngưỡng):** Bấm nút ⚡ "Cảm biến vượt ngưỡng" $\rightarrow$ Biểu đồ nhiệt/ẩm nhảy vọt lên vùng đỏ, hệ thống tự động bắn email cảnh báo cho khách và FM (`BR-129`).

---

## 🔒 CHỐT DEMO: NHẬT KÝ KIỂM TOÁN ADMIN (A8)
* Đăng nhập `admin@queenkho.com` $\rightarrow$ vào `/admin/logs`. Mọi thao tác vừa chạy (`[UNIT_ASSIGN]`, `[CHECK_IN]`, `[UNIT_TRANSFER]`, `[RESET_PIN]`, `[REFUND]`, `[SIMULATION]`) đều được ghi vết bất biến (Append-only) trong bảng `activity_logs`. Tuyệt đối không ai có quyền sửa hay xóa log (`PR-07`, `PR-A8`).

---

# PHẦN 5: CHỐNG LỖ HỔNG BẢO MẬT IDOR & GIAO DỊCH DATABASE ACID

### 1. Cơ chế chống tấn công IDOR bằng `OwnershipGuard.java` (Rule `PR-90`)
* **Nguy cơ IDOR (Insecure Direct Object Reference):** Khách A đổi ID trên URL `/contracts/10` sang `/contracts/11` (của khách B) để xem trộm thông tin hợp đồng và mã PIN SmartLock.
* **Cách QueenKho chặn đứng:**
  - `AccessControlFilter.java` giải mã JWT token, trích xuất `userId` và `role` lưu vào `CurrentUserProvider` (ThreadLocal).
  - Tầng Controller/Service gọi `ownershipGuard.checkContract(11)`.
  - `OwnershipGuard.java` chạy câu truy vấn SQL:
    `SELECT customer_id, facility_id FROM rental_contracts rc JOIN storage_units su ON su.id = rc.storage_unit_id WHERE rc.id = 11`
  - So sánh: Nếu `customer_id != currentUser.id()` $\rightarrow$ Lập tức ngắt xử lý và ném ngoại lệ:
    `throw new AccessException(HttpStatus.FORBIDDEN, "FORBIDDEN_OWNER", "Hợp đồng không thuộc về bạn");`
  - Kẻ tấn công nhận về mã HTTP `403 Forbidden`, hoàn toàn không thể xem trộm dữ liệu!

### 2. Toàn vẹn giao dịch `@Transactional` (ACID) khi Bàn giao Check-in
* Tại `StaffTaskService.completeCheckIn()`, hệ thống phải thực hiện 6 thao tác liên hoàn:
  1. `handoverRecordsRepo.save(...)`: Lưu biên bản Check-in + 1-10 ảnh hiện trạng.
  2. `contractsRepo.updateStatus(...)`: Kích hoạt HĐ `ACTIVE`, lưu PIN 6 số và RFID.
  3. `staffTasksRepo.updateStatus(...)`: Đổi Task `CHECK_IN` thành `COMPLETED`.
  4. `reservationsRepo.updateStatus(...)`: Đổi Đơn cọc thành `COMPLETED`.
  5. `storageUnitsRepo.updateStatus(...)`: Đổi trạng thái ô sang `OCCUPIED`.
  6. `activityLogsRepo.save(...)`: Ghi nhật ký kiểm toán `[CHECK_IN]`.
* **Cơ chế Rollback:** Toàn bộ phương thức được bọc trong `@Transactional`. Nếu bước 5 bị lỗi (mất kết nối DB hoặc trùng khóa), Spring Framework sẽ bắt `RuntimeException` và **lập tức ROLLBACK toàn bộ 4 bước trước đó về trạng thái ban đầu**. Dữ liệu không bao giờ bị rác, đảm bảo tính nguyên tử (Atomicity) theo chuẩn ACID!

---

# PHẦN 6: KỊCH BẢN TUYÊN BỐ ĐÓNG GÓP CỦA SƠN (CONTRIBUTION)

Khi Hội đồng hỏi: *"Em Sơn làm những gì trong đồ án này? Đóng góp bao nhiêu %?"*, bạn trả lời dứt khoát:

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
> 🏆 **LỜI NHẮC CUỐI CÙNG CHO SƠN:** File này là tấm vé thông hành đảm bảo bạn PASS môn 100%. Hãy đọc đi đọc lại 2-3 lần, bình tĩnh, tự tin. Bạn hiểu từng dòng code từ Database lên tận giao diện, chắc chắn bạn sẽ đạt điểm xuất sắc!
