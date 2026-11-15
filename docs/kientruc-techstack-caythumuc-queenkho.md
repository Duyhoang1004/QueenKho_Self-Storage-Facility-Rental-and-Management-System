# CẨM NANG BẢO VỆ HỘI ĐỒNG: KIẾN TRÚC, CÂY THƯ MỤC & TECH STACK
### ĐỒ ÁN TỐT NGHIỆP SWP391 — HỆ THỐNG QUEENKHO

> **Tài liệu chiến lược dành riêng cho vòng vấn đáp kiến trúc phần mềm.**  
> Hướng dẫn từ tổng quan kiến trúc, cấu trúc cây thư mục chi tiết, lý do chọn từng công nghệ (Why this stack?), luồng đi của dữ liệu qua các tầng, và bộ câu hỏi phản biện "gài bẫy" của Giảng viên / Hội đồng.

---

# MỤC LỤC
1. [BỨC TRANH TOÀN CẢNH KIẾN TRÚC HỆ THỐNG (SYSTEM ARCHITECTURE)](#1-bức-tranh-toàn-cảnh-kiến-trúc-hệ-thống-system-architecture)
2. [CÂY THƯ MỤC DỰ ÁN CHI TIẾT (PROJECT DIRECTORY TREE)](#2-cây-thư-mục-dự-án-chi-tiết-project-directory-tree)
   - [2.1 Cây thư mục cấp Monorepo](#21-cây-thư-mục-cấp-monorepo)
   - [2.2 Cây thư mục Frontend (React 19)](#22-cây-thư-mục-frontend-react-19)
   - [2.3 Cây thư mục Backend (Spring Boot 4.x / Java 17)](#23-cây-thư-mục-backend-spring-boot-4x--java-17)
3. [TECH STACK CHI TIẾT & LÝ DO LỰA CHỌN (WHY THIS TECH STACK?)](#3-tech-stack-chi-tiết--lý-do-lựa-chọn-why-this-tech-stack)
4. [LUỒNG ĐI CỦA 1 REQUEST QUA TỪNG TẦNG (REQUEST LIFECYCLE)](#4-luồng-đi-của-1-request-qua-từng-tầng-request-lifecycle)
5. [BỘ CÂU HỎI VẤN ĐÁP KIẾN TRÚC CỦA HỘI ĐỒNG & CÁCH TRẢ LỜI ĐIỂM 10](#5-bộ-câu-hỏi-vấn-đáp-kiến-trúc-của-hội-đồng--cách-trả-lời-điểm-10)

---

# 1. BỨC TRANH TOÀN CẢNH KIẾN TRÚC HỆ THỐNG (SYSTEM ARCHITECTURE)

Hệ thống **QueenKho** được xây dựng theo mô hình **Decoupled Client-Server Architecture** (Frontend SPA tách biệt hoàn toàn với Backend RESTful API), quản lý trong một **Monorepo**:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER (FRONTEND)                         │
│   React 19 SPA · Vite 8 · TailwindCSS 3 · React Router 7 · Axios       │
│   (5 Portal: Customer · Staff · Facility Manager · BOM · Admin)        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ RESTful JSON over HTTP
                                    │ (JWT Bearer Token in Header)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    SECURITY & INTERCEPTOR LAYER                        │
│   Spring Security · AccessControlFilter · OwnershipGuard (Chống IDOR)  │
│   Khai báo luật động qua AccessPolicy · ThreadLocal CurrentUserContext │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   BACKEND 3-TIER LAYERED ARCHITECTURE                  │
│                                                                        │
│   [Controller Layer]  ──► Tiếp nhận request, @Valid DTO, định tuyến    │
│            │                                                           │
│            ▼                                                           │
│   [Service Layer]     ──► Nghiệp vụ (@Transactional), Business Rules,  │
│            │              tính toán tiền, snapshot versioning          │
│            ▼                                                           │
│   [Repository Layer]  ──► Spring Data JPA (Hibernate) + Native Queries │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ JDBC Connection Pool (HikariCP)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         DATABASE LAYER                                 │
│   Microsoft SQL Server 2019/2022 (QueenKhoDB - 25 bảng quan hệ)        │
│   ddl-auto: validate (Schema bất biến do script SQL quản lý)          │
└────────────────────────────────────────────────────────────────────────┘
                                    ▲
                                    │ Tích hợp ngoại vi
          ┌─────────────────────────┴─────────────────────────┐
          ▼                                                   ▼
┌───────────────────────┐                           ┌────────────────────┐
│    VNPAY SANDBOX      │                           │  MÔ PHỎNG IoT      │
│  HMAC-SHA512 Checksum │                           │  Cảm biến kho lạnh │
│  IPN Webhook + Return │                           │  Nhiệt độ / Độ ẩm  │
└───────────────────────┘                           └────────────────────┘
```

---

# 2. CÂY THƯ MỤC DỰ ÁN CHI TIẾT (PROJECT DIRECTORY TREE)

## 2.1 Cây thư mục cấp Monorepo
Dự án tổ chức theo cấu trúc **Monorepo** giúp cả nhóm làm việc đồng bộ trên 1 repository duy nhất, dễ dàng đối chiếu schema SQL và hợp đồng API:

```
QueenKho_Self-Storage-Facility-Rental-and-Management-System/
├── frontend/               # Mã nguồn ứng dụng Web Client (React 19 + Vite)
├── backend/                # Mã nguồn API Server (Spring Boot + Java 17)
│   └── api/                # Sub-module Spring Boot chính
├── sql_script/             # Toàn bộ script khởi tạo DB, migration, trigger, seed data
│   ├── QueenKho_setup_data.sql   # ⭐ File chuẩn: Schema mới nhất + Seed data nền
│   ├── QueenKho_full.sql         # Schema đầy đủ + dữ liệu test 42 ô
│   └── QueenKho.sql              # Schema gốc 25 bảng
├── docs/                   # Tài liệu đồ án: api-contract.md, test scripts, quy trình test
├── docker-compose.yml      # File chạy toàn bộ hệ thống bằng Docker (FE + BE + DB)
├── CLAUDE.md               # Quy ước phát triển, stack thực tế, nợ kỹ thuật
└── README.md               # Hướng dẫn cài đặt và tổng quan dự án
```

---

## 2.2 Cây thư mục Frontend (React 19)

Mã nguồn Frontend nằm tại `frontend/src/` được chia theo **mô hình hướng vai trò (Role-based domain)** kết hợp với **tầng Service tập trung**:

```
frontend/src/
├── components/                  # UI Components tái sử dụng (Shared Components)
│   ├── FloorPlanBoard.jsx       # Lưới sơ đồ mặt bằng tương tác (Canvas/Grid layout)
│   ├── UnitPositionPicker.jsx   # Bộ chọn toạ độ lưới khi thêm ô kho mới (Flow 5)
│   ├── UnitScheduleModal.jsx    # Popup Timeline / Gantt-chart lịch chiếm dụng ô kho
│   ├── HandoverPhotos.jsx       # Component chụp/chọn và xem lưới ảnh biên bản
│   ├── TaskActionFeedback.jsx   # Dialog xác nhận thao tác và Toast thông báo
│   ├── PaginationBar.jsx        # Thanh phân trang chuẩn toàn hệ thống
│   └── TimeFilterBar.jsx        # Thanh lọc theo khoảng thời gian
│
├── pages/                       # Các màn hình phân theo vai trò người dùng (5 Actor)
│   ├── manager/                 # 🏢 FACILITY MANAGER (Quản lý cơ sở)
│   │   ├── StorageManagementPage.jsx  # ⭐ FLOW 5: Quản lý danh mục & sơ đồ mặt bằng ô kho
│   │   ├── ManagerTaskBoardPage.jsx   # ⭐ FLOW 5: Bảng công việc cơ sở & giao task cho Staff
│   │   ├── ClaimsPage.jsx             # ⭐ FLOW 7: Quản lý, thẩm định & chi trả bồi thường
│   │   ├── ManagerDashboardPage.jsx   # Bảng điều khiển KPI cơ sở realtime
│   │   ├── PendingReservationsPage.jsx# Duyệt đơn cọc & gán ô kho (Flow 2)
│   │   ├── OverdueContractsPage.jsx   # Xử lý hợp đồng quá hạn & thanh lý (Flow 6)
│   │   └── ManagerStaffPage.jsx       # Quản lý danh sách nhân viên cơ sở
│   │
│   ├── staff/                   # 👷 STAFF (Nhân viên cơ sở)
│   │   ├── StaffTaskBoardPage.jsx     # Bảng công việc của riêng nhân viên
│   │   └── StaffTaskDetailPage.jsx    # ⭐ FLOW 7: Chi tiết task, cấp lại PIN, biên bản kiểm tra
│   │
│   ├── support/                 # 🙋 CUSTOMER (Hỗ trợ khách hàng)
│   │   └── CustomerSupportPage.jsx    # ⭐ FLOW 7: Khách gửi ticket, khiếu nại bồi thường
│   │
│   ├── customer/                # 🙋 CUSTOMER (Quản lý hợp đồng & thanh toán)
│   │   ├── CustomerContractsPage.jsx  # Danh sách kho đang thuê của tôi
│   │   ├── CustomerContractPage.jsx   # Chi tiết HĐ, xem mã PIN SmartLock, hẹn trả kho
│   │   └── CustomerPaymentsPage.jsx   # Lịch sử giao dịch VNPAY
│   │
│   ├── bom/                     # 👔 BOM (Giám đốc vận hành)
│   │   ├── BomRevenuePage.jsx         # Báo cáo doanh thu tài chính & tỷ lệ lấp đầy
│   │   ├── BomFacilitiesPage.jsx      # Quản lý danh mục chi nhánh toàn quốc
│   │   ├── BomUnitTypesPage.jsx       # Quản lý danh mục loại kho & kho lạnh/đông
│   │   └── BomRentalPoliciesPage.jsx  # Cấu hình chính sách giá & phạt cọc động
│   │
│   ├── admin/                   # ⚙️ ADMIN (Quản trị hệ thống)
│   │   ├── AdminUsersPage.jsx         # Quản lý tài khoản người dùng
│   │   ├── AdminRolesPage.jsx         # Phân quyền hệ thống
│   │   └── AdminLogsPage.jsx          # Xem nhật ký kiểm toán activity_logs
│   │
│   └── search/                  # 🔍 Public: Tìm kiếm kho, chọn gói, đặt cọc
│       ├── SearchLandingPage.jsx      # Trang tìm kiếm khoang trống
│       └── CreateReservationPage.jsx  # Form đặt chỗ, áp voucher, thanh toán VNPAY
│
├── services/                    # 🌐 Tầng gọi API qua Axios (Data Fetching Layer)
│   ├── api.js                   # Cấu hình Axios Base URL, Interceptor gắn Bearer Token
│   ├── storageUnitService.js    # ⭐ FLOW 5: API CRUD ô kho, đổi trạng thái, mặt bằng
│   ├── staffTaskService.js      # ⭐ FLOW 5 & 7: API giao task, nhận task, reset PIN, gia hạn
│   ├── supportService.js        # ⭐ FLOW 7: API tạo ticket, huỷ, đóng, mở lại ticket
│   ├── claimService.js          # ⭐ FLOW 7: API thẩm định bồi thường, tính tiền, chi trả
│   ├── facilityService.js       # API thông tin cơ sở & loại kho
│   ├── contractService.js       # API hợp đồng & chỉ số cảm biến IoT
│   └── simulationService.js     # API tua nhanh thời gian phục vụ demo
│
├── utils/                       # 🛠️ Hàm tiện ích tính toán thuần túy (Pure Functions)
│   ├── date.js                  # Format ngày giờ VN (`dd/MM/yyyy HH:mm`)
│   ├── floorPlan.js             # Thuật toán kiểm tra va chạm lưới toạ độ ô kho
│   ├── unitDisplayState.js      # Tính màu sắc hiển thị ô kho trên mặt bằng
│   └── sensor.js                # Phân tích dải nhiệt độ cảm biến an toàn
│
├── App.jsx                      # Cấu hình React Router v7 & Bọc Route Guard theo Layout
├── main.jsx                     # Khởi tạo React DOM Root
└── tailwind.config.js           # Định nghĩa mã màu Brand & phong cách Duolingo UI
```

---

## 2.3 Cây thư mục Backend (Spring Boot 4.x / Java 17)

Mã nguồn Backend nằm tại `backend/api/src/main/java/com/queenkho/api/`, tuân thủ chặt chẽ kiến trúc **3-Tier Layered Architecture**:

```
com.queenkho.api/
├── controller/                  # 1. PRESENTATION LAYER (REST Controllers)
│   ├── StorageUnitController.java       # ⭐ FLOW 5: Endpoints /api/v1/storage-units
│   ├── FloorPlanController.java         # ⭐ FLOW 5: Endpoints /api/v1/storage-units/layout
│   ├── StaffTaskController.java         # ⭐ FLOW 5 & 7: Endpoints /api/v1/staff-tasks
│   ├── SupportRequestController.java    # ⭐ FLOW 7: Endpoints /api/v1/support-requests
│   ├── CompensationClaimController.java # ⭐ FLOW 7: Endpoints /api/v1/claims
│   ├── ContractController.java          # Endpoints /api/v1/contracts (Đổi ô, trả kho)
│   ├── ReservationController.java       # Endpoints /api/v1/reservations (Đặt chỗ)
│   ├── VnpayController.java             # Endpoints xử lý IPN Webhook thanh toán
│   ├── BomRevenueController.java        # Endpoints báo cáo tài chính cho BOM
│   └── DemoSimulationController.java    # Endpoints tua thời gian để demo
│
├── service/                     # 2. BUSINESS LOGIC LAYER (Services)
│   ├── StorageUnitService.java          # ⭐ FLOW 5: Nghiệp vụ ô kho, KPI, chống âm suất cọc
│   ├── FloorPlanService.java            # ⭐ FLOW 5: Nghiệp vụ lưới toạ độ, chống đè lối đi
│   ├── StaffTaskService.java            # ⭐ FLOW 5 & 7: Nghiệp vụ giao task, cấp lại PIN, gia hạn
│   ├── SupportRequestService.java       # ⭐ FLOW 7: Nghiệp vụ ticket, kiểm tra trùng lặp
│   ├── CompensationClaimService.java    # ⭐ FLOW 7: Nghiệp vụ bồi thường, tính trần bảo hiểm
│   ├── UnitScheduleService.java         # Thuật toán quản lý timeline lịch chiếm dụng ô kho
│   ├── UnitTransferService.java         # Nghiệp vụ chuyển đổi ô kho khi sự cố
│   ├── ActivityLogService.java          # Ghi nhật ký kiểm toán hệ thống (Audit Trail)
│   └── NotificationService.java         # Bắn thông báo chuông và gửi Email cho user
│
├── repository/                  # 3. DATA ACCESS LAYER (Spring Data JPA)
│   ├── StorageUnitRepository.java       # Query bảng storage_units
│   ├── FacilityFloorRepository.java     # Query bảng facility_floors
│   ├── FloorFixtureRepository.java      # Query bảng floor_fixtures (vật cản lối đi)
│   ├── StaffTaskRepository.java         # Query bảng facility_tasks
│   ├── SupportRequestRepository.java    # Query bảng support_requests
│   ├── CompensationClaimRepository.java # Query bảng compensation_claims
│   ├── RentalContractRepository.java    # Query bảng rental_contracts
│   └── UserRepository.java              # Query bảng users
│
├── entity/                      # JPA ENTITIES (Ánh xạ 1-1 với 25 bảng DB)
│   ├── StorageUnit.java                 # Entity ô kho (Khóa chính String: KV-TB-A101)
│   ├── FacilityFloor.java               # Entity tầng mặt bằng
│   ├── FloorFixture.java                # Entity vật cản (lối đi, thang máy)
│   ├── StaffTask.java                   # Entity công việc cơ sở (CHECK_IN, SUPPORT...)
│   ├── SupportRequest.java              # Entity ticket hỗ trợ của khách
│   ├── CompensationClaim.java           # Entity hồ sơ bồi thường hàng hóa
│   ├── RentalContract.java              # Entity hợp đồng thuê kho
│   └── User.java                        # Entity người dùng
│
├── dto/                         # DATA TRANSFER OBJECTS (Tách biệt hoàn toàn Entity)
│   ├── CreateStorageUnitRequest.java
│   ├── UpdateStorageUnitStatusRequest.java
│   ├── StorageUnitDetailResponse.java
│   ├── StorageUnitListResponse.java
│   ├── CreateSupportRequestDto.java
│   ├── ResolveSupportTaskRequest.java
│   ├── ClaimDecisionRequest.java
│   └── ClaimPaymentRequest.java
│
├── security/                    # BẢO MẬT & PHÂN QUYỀN CHẶT CHẼ
│   ├── AccessControlFilter.java         # Bộ lọc xác thực Token & kiểm tra bảng quyền
│   ├── AccessPolicy.java                # Bảng khai báo luật truy cập API động
│   ├── OwnershipGuard.java              # ⭐ Chốt chặn chống lỗi IDOR (kiểm tra sở hữu)
│   └── CurrentUserProvider.java         # Trích xuất UserInfo từ ThreadLocal Context
│
├── exception/                   # XỬ LÝ NGOẠI LỆ TẬP TRUNG
│   ├── FacilityException.java           # Ngoại lệ ô kho, mặt bằng
│   ├── StaffTaskException.java          # Ngoại lệ task, ticket, bồi thường
│   └── AccessException.java             # Ngoại lệ bảo mật, quyền truy cập
│
└── config/                      # CẤU HÌNH HỆ THỐNG
    ├── SecurityConfig.java              # Cấu hình Spring Security
    ├── CorsConfig.java                  # Cấu hình CORS cho phép React 5173 gọi API
    └── JacksonConfig.java               # Cấu hình snake_case -> camelCase
```

---

# 3. TECH STACK CHI TIẾT & LÝ DO LỰA CHỌN (WHY THIS TECH STACK?)

Khi Hội đồng hỏi: *"Tại sao nhóm em lại chọn công nghệ này mà không chọn công nghệ khác?"*, hãy trả lời theo bảng so sánh chuẩn này:

| Thành phần | Công nghệ thực tế | Tại sao chọn? (Ưu điểm vượt trội) | So sánh với giải pháp thay thế |
|---|---|---|---|
| **Frontend Framework** | **React 19** | • Mô hình Component tái sử dụng cao.<br>• Virtual DOM giúp re-render sơ đồ kho cực nhanh.<br>• Hệ sinh thái thư viện phong phú, chuẩn công nghiệp. | Tốt hơn **Thymeleaf / JSP** vì không bị tải lại toàn bộ trang (Full Page Reload), mang lại trải nghiệm mượt mà như app desktop. |
| **Build Tool** | **Vite 8** | • Tốc độ khởi động máy chủ ảo gần như tức thì nhờ Native ES Modules.<br>• Hot Module Replacement (HMR) cực nhanh, lưu state khi sửa code. | Nhanh gấp 10–20 lần so với **Webpack / Create-React-App** (vốn đã lỗi thời và build rất nặng). |
| **CSS Framework** | **Tailwind CSS 3** | • Utility-first giúp viết CSS trực tiếp trong JSX mà không sợ xung đột class.<br>• Dễ dàng tùy biến bảng màu Brand chuẩn phong cách **Duolingo Gamification UI** (viền nổi 3D, độ nảy nút bấm). | Gọn gàng, tối ưu dung lượng build hơn **Bootstrap** hoặc **Ant Design** (vốn khó customize màu sắc và giao diện bị cứng nhắc). |
| **Client Routing** | **React Router 7** | • Hỗ trợ lồng Layout (`ManagerLayout`, `CustomerLayout`) linh hoạt.<br>• Dễ dàng cài đặt Route Guards kiểm tra quyền truy cập. | Chuẩn mực định tuyến cho React SPA. |
| **Backend Framework** | **Spring Boot 4.x (Java 17 LTS)** | • Dependency Injection (IoC) giúp tách biệt rõ ràng các tầng Controller, Service, Repository.<br>• Spring Data JPA tự động sinh query, giảm 80% code boilerplate.<br>• Hệ thống quản lý Transaction (`@Transactional`) an toàn tuyệt đối cho bài toán tiền bạc, cọc kho. | Vượt trội hơn **Node.js (Express)** về độ chặt chẽ kiểu dữ liệu (Strongly-typed), quản lý đa luồng và toàn vẹn giao dịch tài chính ACID. |
| **Java Version** | **Java 17 LTS** | • Bản hỗ trợ dài hạn (Long-Term Support) ổn định nhất cho doanh nghiệp.<br>• Hỗ trợ Java Records (viết DTO gọn gàng), Pattern Matching, Garbage Collector ZGC tối ưu RAM. | Chuẩn mực hơn Java 8/11 cũ, hỗ trợ đầy đủ các thư viện Spring mới nhất. |
| **Database** | **SQL Server 2019/2022** | • Hệ quản trị CSDL quan hệ chuẩn doanh nghiệp lớn.<br>• Tính toàn vẹn dữ liệu cao (Khóa ngoại, Check Constraints, Transaction Isolation).<br>• Tương thích tuyệt vời với các bài toán báo cáo doanh thu, kế toán và kiểm toán. | Đảm bảo tính nhất quán (ACID) tốt hơn các CSDL NoSQL như **MongoDB** (vốn không phù hợp cho dữ liệu giao dịch tài chính, hợp đồng pháp lý). |
| **Cổng thanh toán** | **VNPAY Sandbox** | • Cổng thanh toán quốc dân tại Việt Nam.<br>• Bảo mật cao với chữ ký số HMAC-SHA512.<br>• Hỗ trợ cả cơ chế Return URL (ngay lập tức) và IPN Webhook (bảo đảm dữ liệu ngầm khi rớt mạng). | Thực tế hơn việc tự làm ví ảo, giải quyết đúng bài toán thanh toán không tiền mặt. |

---

# 4. LUỒNG ĐI CỦA 1 REQUEST QUA TỪNG TẦNG (REQUEST LIFECYCLE)

Khi thầy cô yêu cầu: *"Em hãy vẽ hoặc nói rõ đường đi của một request từ lúc người dùng bấm nút trên màn hình đến khi vào database và trả về?"*

### Mô tả từng bước (Step-by-step):
```
[1. User Click Nút trên UI] ──► Gọi hàm async trong React Component
        │
        ▼
[2. Service Frontend (Axios)] ──► api.js gắn JWT Token vào Header: "Authorization: Bearer ..."
        │
        ▼ (Gửi gói tin HTTP JSON qua mạng)
[3. Spring Boot Security Filter] ──► AccessControlFilter trích xuất Token, kiểm tra bảng AccessPolicy
        │── Nếu không hợp lệ ──► Trả về HTTP 401 Unauthorized / 403 Forbidden
        │── Nếu hợp lệ: Trích xuất userId, role, facilityId gắn vào ThreadLocal CurrentUserContext
        ▼
[4. Controller Layer] ──► Bắt HTTP Request (@GetMapping, @PostMapping...)
        │── Kiểm tra bảo mật IDOR: OwnershipGuard.checkFacility(facilityId)
        │── Validate DTO đầu vào: @Valid kiểm tra @NotNull, @Size...
        │── Nếu vi phạm DTO ──► Ném MethodArgumentNotValidException (HTTP 400)
        ▼
[5. Service Layer (@Transactional)] ──► Nơi xử lý 100% Logic Nghiệp Vụ
        │── Kiểm tra Business Rules (ví dụ: BR-11 chống âm suất cọc, PR-21 ô không OCCUPIED)
        │── Nếu vi phạm nghiệp vụ ──► throw new FacilityException(HttpStatus.CONFLICT, "MÃ_LỖI", "...")
        │── Thực hiện tính toán tiền nong, cập nhật trạng thái Entity
        │── Ghi nhận vết kiểm toán: activityLogService.log(...)
        ▼
[6. Repository Layer (Spring Data JPA)] ──► Chuyển đổi Entity sang câu lệnh SQL
        │
        ▼ (JDBC Driver qua HikariCP Connection Pool)
[7. Database Layer (SQL Server)] ──► Thực thi lệnh INSERT / UPDATE / DELETE trên bảng dữ liệu
        │
        ▼
[8. Service trả về Response DTO] ──► Controller nhận DTO và bọc trong ResponseEntity.ok(dto)
        │
        ▼ (HTTP 200 OK + JSON Payload)
[9. Frontend Axios nhận Response] ──► Component cập nhật State (setData), đóng Modal
        │
        ▼
[10. React Virtual DOM Re-render] ──► Màn hình bật Toast xanh thông báo thành công!
```

---

# 5. BỘ CÂU HỎI VẤN ĐÁP KIẾN TRÚC CỦA HỘI ĐỒNG & CÁCH TRẢ LỜI ĐIỂM 10

### ❓ Câu 1: "Tại sao nhóm em lại làm Monorepo (để cả Frontend và Backend trong cùng 1 Git Repo) mà không tách làm 2 Repo riêng biệt?"
* **Trả lời điểm 10:**
  > *"Dạ thưa thầy/cô, nhóm em chọn kiến trúc Monorepo vì 3 lý do chiến lược:  
  > 1. **Đồng bộ hóa phiên bản (Atomic Commits):** Khi có một sự thay đổi về nghiệp vụ (ví dụ: thêm trường ảnh bằng chứng vào hồ sơ bồi thường), nhóm có thể cập nhật đồng thời file SQL schema, Backend DTO và Frontend Component trong cùng một commit. Tránh tình trạng lệch phiên bản API (API Contract mismatch) giữa 2 repo độc lập.  
  > 2. **Dễ dàng cấu hình CI/CD và Docker:** File `docker-compose.yml` ở thư mục gốc có thể build và chạy toàn bộ FE, BE và DB chỉ bằng một câu lệnh duy nhất.  
  > 3. **Chia sẻ tài liệu chuẩn:** Toàn bộ tài liệu `api-contract.md` và script test được đặt tại thư mục `docs/` để cả thành viên Frontend và Backend đều đọc và tuân thủ cùng một quy chuẩn."*

---

### ❓ Câu 2: "Tại sao Frontend lại dùng `sessionStorage` để lưu phiên đăng nhập mà không dùng `localStorage` hay `Cookie`?"
* **Trả lời điểm 10:**
  > *"Dạ thưa thầy/cô, đối với một hệ thống quản lý có nhiều vai trò như QueenKho (Khách hàng, Quản lý cơ sở, Nhân viên cơ sở):  
  > - Nếu dùng `localStorage`, dữ liệu sẽ bị chia sẻ chung giữa các tab trình duyệt. Khi kiểm thử hoặc demo thực tế, nếu người dùng mở tab 1 là Quản lý và tab 2 là Khách hàng thì hai tab sẽ ghi đè session của nhau, dẫn đến lỗi xung đột dữ liệu.  
  > - Nhóm chọn **`sessionStorage`** vì nó có phạm vi hoạt động cô lập theo từng tab (Tab-isolated). Khi đóng tab thì session tự động bị hủy sạch, đảm bảo tính bảo mật và giúp nhóm dễ dàng mở 3 profile khác nhau để demo luồng tương tác giữa Quản lý và Nhân viên mà không bao giờ bị dính session cũ."*

---

### ❓ Câu 3: "Lỗ hổng bảo mật IDOR (Insecure Direct Object Reference) là gì và nhóm đã giải quyết bằng cách nào trong kiến trúc?"
* **Trả lời điểm 10:**
  > *"Dạ thưa thầy/cô, lỗ hổng IDOR xảy ra khi một người dùng có thể truy cập hoặc chỉnh sửa dữ liệu của người khác bằng cách thay đổi tham số ID trên URL (ví dụ: Khách hàng A đổi URL thành `contractId=2` để xem trộm hoặc gửi khiếu nại trên hợp đồng của Khách hàng B, hoặc FM Tân Bình vào xóa ô kho của cơ sở Bình Thạnh).  
  > Nhóm em giải quyết triệt để bằng lớp bảo vệ **`OwnershipGuard`** ở Backend:  
  > - Khi có request gửi lên, `AccessControlFilter` giải mã Token JWT để lấy `userId` và `facilityId` thực tế của người thao tác lưu vào ThreadLocal Context.  
  > - Trước khi gọi xuống Service, Controller luôn gọi `ownershipGuard.checkFacility(facilityId)` hoặc `ownershipGuard.checkStorageUnit(unitId)`. Lớp Guard này sẽ truy vấn DB xem tài nguyên đó có đúng thuộc về người gửi request không. Nếu không trùng khớp, hệ thống ngắt ngay lập tức với mã lỗi **`403 Forbidden`**."*

---

### ❓ Câu 4: "Tại sao trong file `application.yaml`, backend lại để `ddl-auto: validate` mà không để `update` hay `create-drop`?"
* **Trả lời điểm 10:**
  > *"Dạ thưa thầy/cô, trong các hệ thống doanh nghiệp thực tế:  
  > - Để `create-drop` sẽ xóa sạch dữ liệu mỗi khi khởi động lại server.  
  > - Để `update` thì Hibernate sẽ tự ý sửa đổi cột, tạo bảng hoặc index ngầm trong database, dễ gây lỗi khóa ngoại, lệch kiểu dữ liệu hoặc làm mất ràng buộc toàn vẹn.  
  > - Do đó, nhóm em chọn **`ddl-auto: validate`**. Toàn bộ cấu trúc Database (25 bảng, ràng buộc khóa ngoại, index, trigger) đều do các script trong thư mục `sql_script/` kiểm soát 100%. Hibernate chỉ có nhiệm vụ kiểm tra đối chiếu (validate) xem Entity trong Java có khớp hoàn toàn với CSDL thực tế hay không. Nếu có bất kỳ sai lệch nào, server sẽ báo lỗi ngay khi khởi động để lập trình viên sửa, đảm bảo dữ liệu luôn nhất quán tuyệt đối."*

---

### ❓ Câu 5: "Nếu viết hết code truy vấn SQL trực tiếp trong Controller mà không tách ra Service thì hệ thống có chạy được không? Tại sao bắt buộc phải chia tầng (Layered Architecture)?"
* **Trả lời điểm 10:**
  > *"Dạ thưa thầy/cô, về mặt kỹ thuật nếu viết SQL trực tiếp trong Controller thì hệ thống vẫn có thể chạy được, nhưng đây là một **Anti-pattern cực kỳ nguy hiểm (Fat Controller)** bị cấm trong công nghệ phần mềm chuyên nghiệp vì 3 lý do:  
  > 1. **Vi phạm nguyên lý đơn nhiệm (Single Responsibility Principle - SRP):** Controller chỉ có nhiệm vụ định tuyến URL và validate HTTP request. Nếu nhồi nhét SQL vào Controller sẽ làm code phình to hàng ngàn dòng, không thể bảo trì.  
  > 2. **Không thể quản lý giao dịch (@Transactional):** Các nghiệp vụ phức tạp đòi hỏi nhiều câu lệnh ghi dữ liệu liên tiếp (ví dụ: nhân viên cấp lại PIN vừa cập nhật hợp đồng, vừa ghi notification, vừa ghi audit log). Nếu không có Service quản lý `@Transactional`, khi câu lệnh thứ hai bị lỗi thì câu lệnh thứ nhất không thể rollback, dẫn đến rác dữ liệu.  
  > 3. **Không thể tái sử dụng (Reusability) và Viết Unit Test:** Khi tách thành Service, một hàm nghiệp vụ có thể được gọi từ nhiều Controller khác nhau hoặc từ các Scheduled Cron Job ngầm mà không cần giả lập HTTP Request."*
