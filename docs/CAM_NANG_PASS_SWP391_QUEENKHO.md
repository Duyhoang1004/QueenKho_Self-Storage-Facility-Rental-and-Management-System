# 🏆 ĐẠI CẨM NANG TOÀN DIỆN BẢO VỆ ĐỒ ÁN SWP391 — PASS MÔN 100%
### HỆ THỐNG CHO THUÊ & QUẢN LÝ KHO TỰ QUẢN QUEENKHO (SELF-STORAGE)
> **Tài liệu tổng hợp toàn bộ câu hỏi, nghiệp vụ toàn hệ thống (7 Flows), kỹ thuật (Technical), kiến trúc, xử lý ngoại lệ (Exception), chuyên đề Nút Giả lập (Simulation), kịch bản thêm trường (Live Coding) và mẹo vấn đáp thực chiến.**  
> 📌 **Tài liệu học nhanh rút gọn:** Xem [8-TRU-COT-BAO-VE-SWP391-QUEENKHO.md](file:///d:/Semester%205/SWP391/QueenKho_Self-Storage-Facility-Rental-and-Management-System/docs/8-TRU-COT-BAO-VE-SWP391-QUEENKHO.md) (Tập trung trả lời 8 câu hỏi cốt lõi dành riêng cho Sơn).

---

# 📑 MỤC LỤC TỔNG HỢP

1. [PHẦN 1: TỔNG QUAN HỆ THỐNG, 5 ACTOR & TOÀN BỘ 7 FLOW NGHIỆP VỤ](#phần-1-tổng-quan-hệ-thống-5-actor--toàn-bộ-7-flow-nghiệp-vụ)
   - [1.1 Tổng quan & 5 Actor](#11-tổng-quan--5-actor)
   - [1.2 Toàn bộ 7 Flow nghiệp vụ (A ➔ Z)](#12-toàn-bộ-7-flow-nghiệp-vụ-a--z)
   - [1.3 Các quy tắc nghiệp vụ sống còn (Business Rules)](#13-các-quy-tắc-nghiệp-vụ-sống-còn-business-rules)
2. [PHẦN 2: CÁC TECHNICAL CỐT LÕI (KIẾN TRÚC, FOLDER, API CONTRACT)](#phần-2-các-technical-cốt-lõi-kiến-trúc-folder-api-contract)
   - [2.1 API Contract & Chuẩn đặt tên URI (Câu chuyện `/unit-types`)](#21-api-contract--chuẩn-đặt-tên-uri-câu-chuyện-unit-types)
   - [2.2 Cây thư mục & Kiến trúc Frontend (React 19 + Vite)](#22-cây-thư-mục--kiến-trúc-frontend-react-19--vite)
   - [2.3 Cây thư mục & Kiến trúc Backend (Spring Boot 4.x + Java 17)](#23-cây-thư-mục--kiến-trúc-backend-spring-boot-4x--java-17)
   - [2.4 Tech Stack & Lý do lựa chọn (Why this stack?)](#24-tech-stack--lý-do-lựa-chọn-why-this-stack)
3. [PHẦN 3: DỮ LIỆU ĐI TỪ DATABASE "BẮN" LÊN FRONTEND NHƯ THẾ NÀO?](#phần-3-dữ-liệu-đi-từ-database-bắn-lên-frontend-như-thế-nào)
4. [PHẦN 4: HỢP ĐỒNG & FILE BIÊN BẢN LƯU Ở ĐÂU? (CÓ LƯU AZURE KHÔNG?)](#phần-4-hợp-đồng--file-biên-bản-lưu-ở-đâu-có-lưu-azure-không)
5. [PHẦN 5: CHUYÊN ĐỀ EXCEPTION HANDLING & BẢNG TRA CỨU 22 MÃ LỖI](#phần-5-chuyên-đề-exception-handling--bảng-tra-cứu-22-mã-lỗi)
6. [PHẦN 6: CHI TIẾT TOÀN BỘ 17 LUỒNG CỦA FLOW 5 (QUẢN LÝ Ô KHO & ĐIỀU PHỐI FM)](#phần-6-chi-tiết-toàn-bộ-17-luồng-của-flow-5-quản-lý-ô-kho--điều-phối-fm)
7. [PHẦN 7: CHI TIẾT TOÀN BỘ 17 LUỒNG CỦA FLOW 7 (HỖ TRỢ KHÁCH HÀNG & BỒI THƯỜNG BẢO HIỂM)](#phần-7-chi-tiết-toàn-bộ-17-luồng-của-flow-7-hỗ-trợ-khách-hàng--bồi-thường-bảo-hiểm)
8. [PHẦN 8: SYSTEM THINKING — KỊCH BẢN 7 BƯỚC THÊM 1 TRƯỜNG MỚI (LIVE CODING)](#phần-8-system-thinking--kịch-bản-7-bước-thêm-1-trường-mới-live-coding)
9. [PHẦN 9: QUY TRÌNH AGILE SCRUM & PHÂN CHIA SPRINT](#phần-9-quy-trình-agile-scrum--phân-chia-sprint)
10. [PHẦN 10: TỔNG HỢP CÂU HỎI VẤN ĐÁP BẪY & CÁCH TRẢ LỜI ĐIỂM 10](#phần-10-tổng-hợp-câu-hỏi-vấn-đáp-bẫy--cách-trả-lời-điểm-10)
11. [PHẦN 11: CÔNG THỨC 4 BƯỚC "TRẢ LỜI NGHIỆP VỤ CHUẨN KỸ SƯ" & 4 KỊCH BẢN MẪU](#phần-11-công-thức-4-bước-trả-lời-nghiệp-vụ-chuẩn-kỹ-sư--4-kịch-bản-mẫu)
12. [PHẦN 12: CHUYÊN ĐỀ NÚT GIẢ LẬP (TIME TRAVEL SIMULATION) & KỸ NĂNG SỬA/THÊM NÚT](#phần-12-chuyên-đề-nút-giả-lập-time-travel-simulation--kỹ-năng-sửathêm-nút)

---

# PHẦN 1: TỔNG QUAN HỆ THỐNG, 5 ACTOR & TOÀN BỘ 7 FLOW NGHIỆP VỤ

## 1.1 Tổng quan & 5 Actor
* **Tên đề tài:** QueenKho — Self-Storage Facility Rental & Management System (Hệ thống cho thuê & quản lý kho tự quản thông minh đa cơ sở).
* **Bài toán thực tế:** Khách hàng thuê các khoang cá nhân (kho thường, kho lạnh $0-8^\circ\text{C}$, kho đông $-25\text{ đến }-15^\circ\text{C}$) để chứa đồ gia đình, hàng TMĐT, tài liệu. Hệ thống số hóa toàn bộ từ Đặt chỗ online $\rightarrow$ Cọc VNPAY $\rightarrow$ Gán ô trên sơ đồ $\rightarrow$ Check-in nhận kho $\rightarrow$ Cấp mã PIN SmartLock/RFID ra vào 24/7 $\rightarrow$ Giám sát cảm biến IoT $\rightarrow$ Trả kho & Bồi thường.
* **Quy mô CSDL:** 25 bảng quan hệ chặt chẽ trong Microsoft SQL Server (`QueenKhoDB`).
* **5 Actor (Phân quyền):**
  1. `CUSTOMER`: Tìm kiếm, đặt cọc VNPAY, nhận mã PIN SmartLock/RFID mở kho 24/7, xem cảm biến nhiệt/ẩm, gửi ticket hỗ trợ, khiếu nại bồi thường, hẹn trả kho.
  2. `STAFF` (Nhân viên cơ sở): Bàn giao kho (Check-in 6 tiêu chí + 1–10 ảnh hiện trạng), nghiệm thu kho (Check-out), cấp lại mã PIN khi khách quên, khảo sát hiện trường hàng hư hỏng.
  3. `FACILITY_MANAGER` (FM - Quản lý cơ sở): Quản lý mặt bằng số hóa Grid 0.5m, xem Lịch ô kho (Timeline), gán ô kho, điều phối giao việc cho Staff, duyệt bảo trì ô kho, thẩm định bồi thường, duyệt chi trả hoàn cọc (`REFUND`).
  4. `BOM` (Giám đốc vận hành chuỗi): Quản lý danh mục cơ sở toàn quốc, tạo loại kho & giá niêm yết, ban hành chính sách cọc/phạt theo version, phát hành voucher, miễn phí trễ, xem doanh thu toàn chuỗi và đối soát ngân hàng.
  5. `ADMIN`: Quản lý tài khoản, phân quyền hệ thống qua `AccessPolicy`, kiểm tra nhật ký kiểm toán bất biến (`activity_logs`).

---

## 1.2 Toàn bộ 7 Flow nghiệp vụ (A ➔ Z)

```
[Flow 1: Đặt chỗ & Cọc] ──► [Flow 2: Gán ô & Check-in] ──► [Flow 3: Đang thuê & Trả kho]
                                     │
           ┌─────────────────────────┼─────────────────────────┐
           ▼                         ▼                         ▼
 [Flow 5: Quản lý kho,     [Flow 6: Gia hạn &        [Flow 7: Hỗ trợ, PIN
  Mặt bằng & Giao việc]     Xử lý quá hạn]            & Đền bù cảm biến IoT]
           │                         │                         │
           └─────────────────────────┼─────────────────────────┘
                                     ▼
                    [Flow 4: Quản trị BOM & Doanh thu]
```

* ⭐ **Flow 1 — Storage Unit Reservation (Tìm kho, Đặt kho & Cọc VNPAY):**
  - Khách tìm kiếm cơ sở, chọn loại kho (khách chỉ chọn loại, không chọn ô cụ thể - `BR-135`).
  - Chọn ngày nhận kho (mai đến tối đa 90 ngày - `PR-B4`), chọn gói thời hạn (1/3/6/12 tháng giảm 0/5/10/15%), khai báo loại hàng (thực phẩm chỉ vào kho lạnh/đông - `BR-131`), chọn gói bảo hiểm (`BR-125`), áp voucher (`NEWKHO` - `D-06`), tick cam kết điều khoản (`v4`).
  - Thanh toán giữ chỗ qua VNPAY trong 15 phút. Thành công $\rightarrow$ Đơn chuyển **`DEPOSIT_PAID`**.
* ⭐ **Flow 2 — Storage Check-in & Handover (Gán ô, Giao việc & Bàn giao):**
  - FM mở danh sách đơn chờ gán ô (ưu tiên khách cũ + gói dài - `BR-123`), chọn ô trống cùng cơ sở, cùng loại, rảnh trọn vẹn trong kỳ thuê trên Sơ đồ / Lịch ô kho (`BR-41`).
  - Gán ô $\rightarrow$ Đơn sang `UNIT_ASSIGNED`, sinh Hợp đồng **`PENDING_CHECK_IN`**, sinh Task **`CHECK_IN`** cho Staff.
  - Staff đón khách tại quầy: Kiểm tra CCCD, đối chiếu 6 tiêu chí checklist (`BR-132`), chụp 1–10 ảnh hiện trạng ô kho (`BR-121`), cấp thẻ RFID và mã PIN SmartLock 6 số.
  - Hoàn tất: Sinh biên bản `CHECK_IN`, Hợp đồng chuyển **`ACTIVE`**, task `COMPLETED`. Khách xem được PIN/RFID trên web.
* ⭐ **Flow 3 — Rented Storage Unit Management (Đang thuê ➔ Trả kho ➔ Hoàn cọc):**
  - Khách dùng PIN/RFID ra vào kho 24/7. Xem thông số nhiệt độ/độ ẩm ô kho.
  - Khách hẹn trả kho: Chọn ngày hẹn, nhập STK ngân hàng nhận lại cọc (`PR-O3`). HĐ chuyển `TERMINATION_PENDING`, sinh Task `CHECK_OUT`.
  - Staff nghiệm thu: Mở kho cùng khách, đối chiếu ảnh check-in. Nếu tốt $\rightarrow$ HĐ chuyển `TERMINATED`, xóa PIN/RFID, ô về `AVAILABLE`, sinh Task `REFUND`.
  - FM mở Task hoàn tiền (`/manager/refunds`), chuyển khoản cho khách, upload ảnh Ủy nhiệm chi (UNC) và nhập mã FT $\rightarrow$ Hoàn tất hợp đồng.
* ⭐ **Flow 4 — Business Rules, Policies & Revenue Monitoring (BOM):**
  - Quản lý danh mục cơ sở, loại kho và giá thuê niêm yết (giá mới không đổi hợp đồng cũ - `PR-12`).
  - Ban hành Chính sách thuê (`RentalPolicy`) theo từng cơ sở (lưu version `v1`, `v2`, `v3`).
  - Quản lý Voucher khuyến mãi gắn theo từng loại kho (`BR-133`). Miễn phí phạt trễ hạn (`BR-130`).
  - Giám sát biểu đồ doanh thu 12 tháng toàn chuỗi, tỷ lệ lấp đầy và đối soát giao dịch ngân hàng.
* ⭐ **Flow 5 — Facility Storage & Staff Management (Quản lý kho & Nhân viên - FM):**
  - Quản lý Mặt bằng số hóa (Floor Plan Grid 0.5m), theo dõi ô theo màu sắc (Xanh: Trống, Đỏ: Thuê, Cam: Bảo trì, Vàng: Sắp trống).
  - Lịch ô kho (Timeline): Xem lịch thuê theo khoảng ngày trong 1, 3, 6, 12 tháng.
  - Thêm ô kho mới (`KV-TB-A101`), khóa bảo trì (`MAINTENANCE` kèm lý do $\ge 10$ ký tự $\rightarrow$ chặn đặt, sinh task bảo trì, cảnh báo khách đã gán trước).
  - Quản lý Bảng việc cơ sở (Task Board), phân công nhân viên, gia hạn task quá hạn.
* ⭐ **Flow 6 — Renewal & Overdue Handling (Gia hạn & Xử lý quá hạn, Kho tổng):**
  - Hệ thống tự động nhắc gia hạn trước 15, 10, 7, 3, 1 ngày. Khách ưu tiên gia hạn đến trước ngày hết hạn 3 ngày (`PR-R10`). Thanh toán VNPAY nối tiếp hạn hợp đồng.
  - Quá hạn: Sau 00:05 đêm hôm sau, job tự động chuyển sang `OVERDUE`, khóa PIN/RFID, tính phí chiếm dụng mỗi ngày.
  - Xử lý nhân văn (`D-15`): Sau thời gian chờ, Staff & FM kiểm kê niêm phong hàng đưa vào **Kho Tổng**. **Tuyệt đối không bán thanh lý, không tiêu hủy hàng của khách**. Khách trả hết nợ phí lưu giữ sẽ được nhận lại tài sản.
* ⭐ **Flow 7 — Support Request, SmartLock & Goods Compensation (Hỗ trợ, Đổi PIN & Đền bù IoT):**
  - Khách quên PIN / Lỗi khóa $\rightarrow$ Gửi ticket `LOCK_ISSUE` $\rightarrow$ Sinh task `SUPPORT` Khẩn cấp (2h) $\rightarrow$ Staff xác minh danh tính và bấm **Cấp lại PIN** mới.
  - Hàng hư hỏng / ẩm mốc $\rightarrow$ Khách gửi khiếu nại bồi thường $\rightarrow$ Staff khảo sát hiện trường $\rightarrow$ FM thẩm định đối chiếu ảnh bàn giao + dữ liệu **Cảm biến IoT (nhiệt độ, độ ẩm)** từ `environmental_logs` và lịch sử mở cửa từ `access_logs` $\rightarrow$ Chốt bồi thường theo hạn mức gói bảo hiểm đã mua.

---

## 1.3 Các quy tắc nghiệp vụ sống còn (Business Rules)
* **`PR-90` (Bảo mật theo Token & Cô lập cơ sở):** Mọi API lấy user từ JWT Token; Khách chỉ xem dữ liệu của mình; FM và Staff chỉ thấy và thao tác trên dữ liệu cơ sở của mình.
* **`PR-91` (Transaction & Audit Log):** Mọi thay đổi trạng thái đều nằm trong 1 Transaction (`@Transactional`) và bắt buộc ghi nhận vào bảng `activity_logs`.
* **`D-01` (Trả trước theo kỳ):** Khách trả trước Cọc + Tiền thuê toàn bộ kỳ (1/3/6/12 tháng) lúc đặt hoặc gia hạn. Không thu lắt nhắt từng tháng.
* **`D-18` (Quản lý ô kho theo Lịch khoảng ngày):** Ô kho không quản lý tĩnh mà quản lý theo khoảng thời gian rảnh `[start_date, end_date + 2 ngày dọn]`. Hai khách có thể thuê cùng 1 ô nếu khoảng thời gian không trùng nhau.
* **`D-15` (Chuyển Kho Tổng thay vì bán thanh lý):** Quá hạn không bán tài sản của khách, chỉ dọn vào Kho Tổng lưu giữ và tính phí theo ngày.

---

# PHẦN 2: CÁC TECHNICAL CỐT LÕI (KIẾN TRÚC, FOLDER, API CONTRACT)

## 2.1 API Contract & Chuẩn đặt tên URI (Câu chuyện `/unit-types`)

> **Câu hỏi của Giảng viên:** *"Tại sao đặt là `/unit-types` mà không phải `/unit_types` hay `/unittypes`? API này ở đâu, về đâu?"*

### Cách trả lời chuẩn:
1. **API `/unit-types` ở đâu, về đâu:**
   - **Frontend:** Gọi từ `facilityService.js` (hàm `getAllUnitTypes()`) hoặc `unitTypeService.js`. Dùng trên trang `StorageManagementPage.jsx` (dropdown lọc loại kho và form thêm ô mới), `SearchLandingPage.jsx`, `CreateReservationPage.jsx`.
   - **Backend:** Nằm tại `UnitTypeController.java` (`@RequestMapping("/api/v1/unit-types")`) $\rightarrow$ chuyển xuống `UnitTypeService.java` $\rightarrow$ gọi `UnitTypeRepository` lấy từ bảng `unit_types` trong SQL Server.
2. **Tại sao dùng danh từ số nhiều (`unit-types`):**
   - Theo chuẩn **RESTful API Resource Naming (RFC 3986)**, URI định danh một **Tập hợp tài nguyên (Collection Resource)** nên bắt buộc dùng danh từ số nhiều (`unit-types`, `storage-units`, `staff-tasks`, `support-requests`), không dùng động từ hay số ít.
3. **Tại sao dùng dấu gạch ngang (`kebab-case`) thay vì gạch dưới (`unit_types`):**
   - Chuẩn quốc tế (Google Cloud API Design Guide, RFC 3986) khuyến nghị dùng kebab-case. Dấu `_` khi hiển thị trên giao diện hoặc link tài liệu thường bị đường gạch chân (`underline`) che khuất hoàn toàn, gây nhầm lẫn thành khoảng trắng.
   - Các Web Engine/Parser coi `-` là dấu ngắt từ (word separator), còn `_` bị gộp thành một từ dính liền.
4. **Tại sao không viết liền (`unittypes`):**
   - Viết liền làm dính 2 từ tiếng Anh riêng biệt (`unit` + `types`), vi phạm nguyên tắc **Readability (Tính dễ đọc)** của Clean Code.
5. **Quy tắc JSON:**
   - Property names: **camelCase** (cấu hình trong `application.yaml` qua Jackson `property-naming-strategy: LOWER_CAMEL_CASE`).
   - Enum / Status: **CHỮ HOA KHÔNG DẤU** (`AVAILABLE`, `MAINTENANCE`, `IN_PROGRESS`).

---

## 2.2 Cây thư mục & Kiến trúc Frontend (React 19 + Vite)

Cấu trúc mã nguồn tại `frontend/src/`:
```
frontend/src/
├── components/                  # UI dùng chung: FloorPlanBoard, SimulationButton, UnitScheduleModal
├── pages/                       # Màn hình theo vai trò:
│   ├── manager/                 # 🏢 Quản lý cơ sở:
│   │   ├── StorageManagementPage.jsx  # ⭐ FLOW 5: Quản lý danh mục & sơ đồ mặt bằng ô kho
│   │   ├── ManagerTaskBoardPage.jsx   # ⭐ FLOW 5: Bảng công việc cơ sở & giao việc cho Staff
│   │   └── ClaimsPage.jsx             # ⭐ FLOW 7: Thẩm định & chi trả hồ sơ bồi thường
│   ├── staff/                   # 👷 Nhân viên cơ sở:
│   │   └── StaffTaskDetailPage.jsx    # ⭐ FLOW 7: Cấp lại PIN, khảo sát hiện trường hàng hư
│   └── support/                 # 🙋 Khách hàng:
│       └── CustomerSupportPage.jsx    # ⭐ FLOW 7: Khách gửi ticket, khiếu nại bồi thường
├── services/                    # Tầng Axios gọi API:
│   ├── api.js                   # Base URL http://localhost:8080/api/v1 + JWT Interceptor
│   ├── storageUnitService.js    # ⭐ FLOW 5: CRUD ô kho, đổi trạng thái, mặt bằng
│   ├── staffTaskService.js      # ⭐ FLOW 5 & 7: Giao task, nhận task, reset PIN, gia hạn
│   ├── supportService.js        # ⭐ FLOW 7: Tạo ticket, huỷ, đóng, mở lại
│   ├── claimService.js          # ⭐ FLOW 7: Thẩm định bồi thường, tính tiền, chi trả
│   └── simulationService.js     # ⚡ Giả lập tua thời gian demo
├── utils/                       # floorPlan.js, date.js, sensor.js
├── App.jsx                      # React Router v7 & Phân quyền Route Guard theo Layout
└── main.jsx                     # Khởi tạo React Root
```

* **Cơ chế lưu phiên `sessionStorage`:** Dùng `sessionStorage` thay vì `localStorage` để cô lập phiên làm việc theo từng tab. Khi đóng tab, phiên tự hủy sạch, giúp test đồng thời nhiều role (Khách, Quản lý, Nhân viên) trên các tab khác nhau mà không bị đè dữ liệu.
* **Bảo vệ Route (Route Guard):** Trong `App.jsx`, các trang được bọc trong `<ManagerLayout />`, `<StaffLayout />`, `<CustomerLayout />`. Nếu người dùng chưa đăng nhập hoặc sai vai trò, Layout sẽ tự động redirect về `/login`.

---

## 2.3 Cây thư mục & Kiến trúc Backend (Spring Boot 4.x + Java 17)

Áp dụng mô hình **3-Tier Layered Architecture**:
```
com.queenkho.api/
├── controller/                  # 1. PRESENTATION LAYER (Định tuyến, nhận DTO, @Valid)
│   ├── StorageUnitController.java       # ⭐ FLOW 5: API /api/v1/storage-units
│   ├── FloorPlanController.java         # ⭐ FLOW 5: API /api/v1/storage-units/layout
│   ├── StaffTaskController.java         # ⭐ FLOW 5 & 7: API /api/v1/staff-tasks
│   ├── SupportRequestController.java    # ⭐ FLOW 7: API /api/v1/support-requests
│   ├── CompensationClaimController.java # ⭐ FLOW 7: API /api/v1/claims
│   └── DemoSimulationController.java    # ⚡ API /api/v1/dev/simulation
├── service/                     # 2. BUSINESS LOGIC LAYER (Xử lý nghiệp vụ, @Transactional)
│   ├── StorageUnitService.java          # ⭐ FLOW 5: Tính KPI, chống âm suất cọc BR-11
│   ├── FloorPlanService.java            # ⭐ FLOW 5: Lưới toạ độ, chống đè lối đi
│   ├── StaffTaskService.java            # ⭐ FLOW 5 & 7: Phân công task, cấp lại PIN, gia hạn
│   ├── SupportRequestService.java       # ⭐ FLOW 7: Kiểm tra trùng lặp ticket, chống spam
│   ├── CompensationClaimService.java    # ⭐ FLOW 7: Bồi thường, tính trần bảo hiểm
│   └── DemoSimulationService.java       # ⚡ Sửa DB tua thời gian & ghi log [SIMULATION]
├── repository/                  # 3. DATA ACCESS LAYER (Spring Data JPA)
├── entity/                      # JPA Entities (StorageUnit, StaffTask, SupportRequest,...)
├── dto/                         # DTO Request/Response (tách biệt hoàn toàn Entity)
├── security/                    # AccessControlFilter, OwnershipGuard (chống IDOR)
└── exception/                   # FacilityException, StaffTaskException, AccessException
```

* **Tại sao tách DTO và Entity?** Tránh lộ mật khẩu, tránh lỗi `LazyInitializationException`, và cho phép gắn thêm các trường tính toán thời gian thực (`occupancyRate`, `scheduleWarning`).

---

## 2.4 Tech Stack & Lý do lựa chọn (Why this stack?)

| Công nghệ | Lý do chọn vượt trội (So sánh với giải pháp khác) |
|---|---|
| **React 19 + Vite 8** | Single Page Application mượt mà, Virtual DOM render lưới kho nhanh gấp 10 lần so với Webpack hay Thymeleaf/JSP cũ. |
| **Tailwind CSS 3** | Utility-first dễ dàng thiết kế giao diện **Gamification Duolingo UI** (viền nổi 3D, độ nảy nút bấm). Gọn nhẹ hơn Bootstrap / Ant Design. |
| **Spring Boot 4 + Java 17** | Quản lý đa luồng, Dependency Injection và toàn vẹn giao dịch tài chính (`@Transactional`) an toàn tuyệt đối so với Node.js (Express). |
| **SQL Server 2019/2022** | Hệ quản trị CSDL quan hệ chuẩn doanh nghiệp, đảm bảo tính toàn vẹn **ACID**, bảo vệ dữ liệu cọc và hợp đồng tốt hơn NoSQL (MongoDB). |
| **VNPAY Sandbox** | Cổng thanh toán quốc dân tại Việt Nam, bảo mật chữ ký HMAC-SHA512, tích hợp cả IPN Webhook tự động cập nhật đơn cọc. |

---

# PHẦN 3: DỮ LIỆU ĐI TỪ DATABASE "BẮN" LÊN FRONTEND NHƯ THẾ NÀO?

Hội đồng hỏi: *"Dữ liệu từ trong DB làm sao hiển thị lên được màn hình React?"*  
Trình bày theo **quy trình 6 chặng**:

```
[1. SQL Server Database: QueenKhoDB] (Dữ liệu dạng Bảng: Rows & Columns)
             │
             ▼ JDBC Driver + HikariCP Connection Pool
[2. Spring Data JPA / Hibernate (ORM)] (Chuyển Rows thành Java Entity Object)
             │
             ▼
[3. Service Layer (StorageUnitService)] (Nghiệp vụ, tính toán KPI & Map Entity ➔ DTO)
             │
             ▼
[4. Controller Layer + Jackson Library] (Serialize Java DTO ➔ Chuỗi JSON camelCase)
             │
             ▼ HTTP / REST Response qua Internet/Localhost
[5. Frontend Axios Interceptor (api.js)] (Parse JSON ➔ JavaScript Object)
             │
             ▼
[6. React Component (State & Virtual DOM)] (Cập nhật useState ➔ Render ra thẻ JSX hiển thị)
```

---

# PHẦN 4: HỢP ĐỒNG & FILE BIÊN BẢN LƯU Ở ĐÂU? (CÓ LƯU AZURE KHÔNG?)

> **Bẫy của Giảng viên:** *"Hợp đồng sau khi khách đặt thì lưu ở đâu? Có lưu trên Azure Blob hay Cloud Storage không?"*

### Câu trả lời chuẩn xác 100%:
* **Dữ liệu Hợp đồng:** Được lưu trực tiếp dưới dạng **Dữ liệu có cấu trúc (Structured Data)** trong bảng **`rental_contracts`** của Microsoft SQL Server. Hợp đồng KHÔNG PHẢI là một file PDF tĩnh lưu trên Cloud. Mọi thông tin (mã hợp đồng, ngày bắt đầu, ngày kết thúc, số tiền thuê, tiền cọc, điều khoản `terms_version = 'v4'`) đều là các cột dữ liệu. Khi khách hoặc quản lý bấm "Xem Hợp đồng", Frontend gọi API lấy JSON về và tự render ra giao diện hợp đồng điện tử theo mẫu pháp lý.
* **File ảnh biên bản bàn giao (Check-in/Check-out) & Ảnh bồi thường:** 
  - Lưu tại **Ổ đĩa cục bộ của Máy chủ (Local Disk)** trong thư mục `backend/uploads/` thông qua `UploadController.java`.
  - Database chỉ lưu **Chuỗi đường dẫn URL tương đối** trong bảng `handover_records` (cột `evidence_photos`) hoặc `compensation_claims` (cột `damage_images`).
* **Hệ thống KHÔNG DÙNG Azure Blob Storage hay AWS S3.**
  - **Cách đối đáp điểm 10:** *"Dạ thưa thầy/cô, trong phạm vi đồ án môn học, nhóm em chủ động lưu file trên Local Storage của Server kết hợp cấu hình Docker Volume để tiết kiệm chi phí Cloud và đảm bảo tính khả dụng độc lập khi chấm Offline/Localhost. Nhóm đã đóng gói logic lưu trữ qua interface `StorageService` riêng biệt, nên khi dự án thương mại hóa lên Production thật, nhóm chỉ cần viết thêm class `AzureBlobStorageService` hoặc `AwsS3StorageService` mà không phải sửa bất kỳ dòng code nghiệp vụ nào ạ!"*

---

# PHẦN 5: CHUYÊN ĐỀ EXCEPTION HANDLING & BẢNG TRA CỨU 22 MÃ LỖI

* **Backend:** Ném ngoại lệ kế thừa `RuntimeException`: `throw new FacilityException(HttpStatus.CONFLICT, "SLOT_IN_USE", "Thông báo...")`. Controller bắt lại qua `@ExceptionHandler` trả về JSON chuẩn `{ error, message }` với HTTP code tương ứng.
* **Frontend:** Axios interceptor bắt 401/403 đá về login. Khối `try ... catch (err)` tại các trang lấy `err.response?.data?.message` để hiển thị Toast đỏ Duolingo.

### Bảng 22 mã lỗi nghiệp vụ của Flow 5 & Flow 7:

| Mã lỗi (`error`) | HTTP Status | Nơi ném ra (Class) | Nguyên nhân kích hoạt trong code |
|---|---|---|---|
| **SLOT_IN_USE** | `409 CONFLICT` | `StorageUnitService` | Giảm 1 ô khả dụng làm âm số suất cọc của khách đang chờ gán (BR-11). |
| **UNIT_IN_USE** | `409 CONFLICT` | `StorageUnitService` | FM cố tình sửa hoặc đổi trạng thái ô đang có khách thuê (`OCCUPIED`). |
| **UNIT_HAS_CONTRACT_HISTORY** | `409 CONFLICT` | `StorageUnitService` | FM cố xóa ô kho đã từng phát sinh hợp đồng thuê trong lịch sử (PR-21). |
| **DUPLICATE_UNIT_CODE** | `409 CONFLICT` | `StorageUnitService` | Trùng mã ô kho vật lý tự sinh (vd: `KV-TB-A101`). |
| **UNIT_TYPE_INACTIVE** | `400 BAD_REQUEST` | `StorageUnitService` | Tạo ô mới bằng loại kho đang tạm ngưng hoạt động (`INACTIVE`). |
| **UNIT_NOT_IDLE** | `409 CONFLICT` | `StorageUnitService` | Đặt cờ ô khẩn cấp trên ô đang bảo trì hoặc đang có khách thuê (BR-140). |
| **TASK_NOT_ASSIGNABLE** | `409 CONFLICT` | `StaffTaskService` | FM cố giao task hoàn tiền (`REFUND`) cho nhân viên làm thay. |
| **TASK_OVERDUE** | `409 CONFLICT` | `StaffTaskService` | Giao một task đã quá hạn mà chưa thực hiện gia hạn lịch. |
| **TASK_NOT_ASSIGNED** | `409 CONFLICT` | `StaffTaskService` | Bấm gỡ người nhận trên một task chưa có ai nhận việc. |
| **STAFF_INACTIVE** | `400 BAD_REQUEST` | `StaffTaskService` | Giao việc cho nhân viên đang bị khóa tài khoản. |
| **INVALID_STAFF** | `400 BAD_REQUEST` | `StaffTaskService` | Giao việc cho nhân viên thuộc cơ sở khác. |
| **OUT_OF_ASSIGN_WINDOW** | `409 CONFLICT` | `StaffTaskService` | Giao task check-in/out trước ngày hẹn $> 30$ ngày (PR-T1). |
| **FORBIDDEN_CONTRACT** | `403 FORBIDDEN` | `SupportRequestService` | Khách hàng A gửi ticket trên hợp đồng của khách hàng B (PR-51). |
| **CONTRACT_STATUS_INVALID** | `409 CONFLICT` | `SupportRequestService` | Gửi ticket trên hợp đồng đã thanh lý (`LIQUIDATED`) hoặc đã hủy. |
| **DUPLICATE_ISSUE_TYPE** | `409 CONFLICT` | `SupportRequestService` | Mở trùng loại ticket đang có chưa đóng trên cùng hợp đồng (PR-S2). |
| **MAX_OPEN_TICKETS_REACHED** | `409 CONFLICT` | `SupportRequestService` | Hợp đồng đã có 3/3 ticket đang mở, chạm trần tối đa (PR-S2). |
| **CONTRACT_OVERDUE** | `409 CONFLICT` | `StaffTaskService` | Cấp lại PIN cho hợp đồng đang nợ tiền quá hạn (PR-Q5, PR-S6). |
| **TASK_NOT_SUPPORT** | `409 CONFLICT` | `StaffTaskService` | Cấp lại mã PIN trên task không phải loại `SUPPORT`. |
| **INVALID_CLAIM** | `400 BAD_REQUEST` | `CompensationClaimService` | Thiếu danh sách hàng hư hoặc số tiền yêu cầu $\le 0$ (BR-126). |
| **EVIDENCE_IMAGE_REQUIRED** | `400 BAD_REQUEST` | `CompensationClaimService` | Báo hỏng hàng nhưng không đính kèm ít nhất 1 ảnh chụp hiện trường. |
| **CLAIM_ALREADY_SETTLED** | `409 CONFLICT` | `CompensationClaimService` | Mở lại ticket của hồ sơ bồi thường đã được chi trả tiền thành công. |
| **INVALID_INPUT** | `400 BAD_REQUEST` | Nhiều hàm | Vi phạm độ dài mô tả, ghi chú lý do bảo trì dưới 10 ký tự. |

---

# PHẦN 6: CHI TIẾT TOÀN BỘ 17 LUỒNG CỦA FLOW 5 (QUẢN LÝ Ô KHO & ĐIỀU PHỐI FM)

## 📌 Nhóm A: Nghiệp vụ Quản lý Ô kho & Mặt bằng (`/manager/units`)
1. **Luồng 5.1 (Xem danh sách & KPI):** `GET /api/v1/storage-units` $\rightarrow$ Tính tự động tỷ lệ lấp đầy, số ô trống/thuê/bảo trì/quá hạn/sắp trống.
2. **Luồng 5.2 (Xem chi tiết ô kho):** `GET /api/v1/storage-units/{id}` $\rightarrow$ Xem thông tin HĐ hiện tại, lịch đặt trước (`upcomingContracts`), cảnh báo trùng lịch (`scheduleWarning`).
3. **Luồng 5.3 (Xem Lịch ô kho Timeline):** `GET /api/v1/storage-units/schedule` $\rightarrow$ Lấy dải thời gian chiếm dụng vẽ Gantt-chart.
4. **Luồng 5.4 (Thêm ô kho mới):** `POST /api/v1/storage-units` $\rightarrow$ Tự sinh mã `KV-TB-A101`, kiểm tra không đè lên lối đi/thang máy.
5. **Luồng 5.5 (Sửa cấu hình ô kho):** `PUT /api/v1/storage-units/{id}` $\rightarrow$ Đổi tầng, đổi khu, đổi loại kho (kiểm tra ô không `OCCUPIED`).
6. **Luồng 5.6 (Khóa bảo trì):** `PATCH /api/v1/storage-units/{id}/status` sang `MAINTENANCE` $\rightarrow$ Bắt buộc lý do 10–500 ký tự, kiểm tra chống âm suất cọc BR-11, gửi notification báo khách đã gán trước BR-141.
7. **Luồng 5.7 (Mở lại kho sau bảo trì):** `PATCH /api/v1/storage-units/{id}/status` sang `AVAILABLE` $\rightarrow$ Tự động đóng task bảo trì liên kết.
8. **Luồng 5.8 (Đặt/Bỏ ô khẩn cấp):** `PATCH /api/v1/storage-units/{id}/emergency` $\rightarrow$ Đặt ô dự phòng không bán (BR-140).
9. **Luồng 5.9 (Xóa ô kho):** `DELETE /api/v1/storage-units/{id}` $\rightarrow$ Chặn tuyệt đối nếu ô từng có hợp đồng (PR-21).
10. **Luồng 5.10 (Lưu sơ đồ mặt bằng):** `PUT /api/v1/storage-units/layout/floors/{id}/plan` $\rightarrow$ Lưu toạ độ kéo thả `mapX/mapY` và vật cản lối đi.

## 📌 Nhóm B: Nghiệp vụ Điều phối Giao việc (`/manager/tasks`)
11. **Luồng 5.11 (Xem Bảng công việc):** `GET /api/v1/staff-tasks` $\rightarrow$ Nổi task khẩn cấp lên đầu, sắp xếp theo hạn chót 21:00.
12. **Luồng 5.12 (FM Giao task cho nhân viên):** `POST /api/v1/staff-tasks/{id}/assign?staffId=X` $\rightarrow$ Khung 30 ngày (PR-T1), cấm giao task `REFUND`, gửi notification cho nhân viên.
13. **Luồng 5.13 (FM Gỡ người nhận việc):** `POST /api/v1/staff-tasks/{id}/unassign` $\rightarrow$ Task về `OPEN`, ticket về `OPEN`.
14. **Luồng 5.14 (FM Gia hạn task quá hạn):** `POST /api/v1/staff-tasks/{id}/extend` $\rightarrow$ Gia hạn tối đa +7 ngày, dời `due_at` về 21:00.
15. **Luồng 5.15 (Hoàn tất bảo trì ô kho):** `POST /api/v1/staff-tasks/{id}/complete-maintenance` $\rightarrow$ Task `COMPLETED`, ô về `AVAILABLE`.
16. **Luồng 5.16 (FM Hoàn tất chi trả hoàn cọc):** `POST /api/v1/staff-tasks/{id}/complete-refund` $\rightarrow$ Nhập mã FT, lưu giao dịch `REFUND`.
17. **Luồng 5.17 (FM Đổi ô kho khi ô sự cố):** `POST /api/v1/contracts/{id}/transfer-unit` $\rightarrow$ Chuyển khách sang ô trống cùng loại, lưu nhật ký `unit_transfers`.

---

# PHẦN 7: CHI TIẾT TOÀN BỘ 17 LUỒNG CỦA FLOW 7 (HỖ TRỢ KHÁCH HÀNG & BỒI THƯỜNG BẢO HIỂM)

## 📌 Nhóm A: Nghiệp vụ Yêu cầu Hỗ trợ Thông thường & Khóa SmartLock
1. **Luồng 7.1 (Tải danh sách HĐ hợp lệ):** `GET /api/v1/support-requests/eligible-contracts` $\rightarrow$ Chỉ HĐ `ACTIVE`, `OVERDUE`, `TERMINATION_PENDING` (PR-51).
2. **Luồng 7.2 (Xem danh sách ticket):** `GET /api/v1/support-requests` $\rightarrow$ Xem ticket kèm task nhân viên đang xử lý.
3. **Luồng 7.3 (Gửi ticket thông thường):** `POST /api/v1/support-requests` (`CLEANING`, `FACILITY_DAMAGE`, `OTHER`) $\rightarrow$ Sinh task `SUPPORT` hạn 21:00.
4. **Luồng 7.4 (Gửi ticket Sự cố khóa / Quên PIN):** `POST /api/v1/support-requests` (`LOCK_ISSUE`) $\rightarrow$ Sinh task khẩn cấp hạn **2 giờ**.
5. **Luồng 7.5 (Nhân viên cấp lại mã PIN 6 số):** `POST /api/v1/staff-tasks/{id}/reset-pin` $\rightarrow$ Chặn nếu HĐ `OVERDUE` (PR-Q5), sinh PIN mới không trùng, gửi notification + email cho khách.
6. **Luồng 7.6 (Nhân viên hoàn tất xử lý ticket):** `POST /api/v1/staff-tasks/{id}/resolve-support` $\rightarrow$ Task `COMPLETED`, ticket `RESOLVED`.
7. **Luồng 7.7 (Khách hủy ticket khi còn `OPEN`):** `POST /api/v1/support-requests/{id}/cancel` $\rightarrow$ Ticket `CLOSED`, task `CANCELLED`.
8. **Luồng 7.8 (Khách xác nhận "Đã ổn"):** `POST /api/v1/support-requests/{id}/confirm` $\rightarrow$ Ticket chuyển sang `CLOSED`.
9. **Luồng 7.9 (Khách báo "Chưa xong"):** `POST /api/v1/support-requests/{id}/reopen` $\rightarrow$ Ticket về `OPEN`, sinh task `SUPPORT` mới.
10. **Luồng 7.10 (Tự động đóng ticket sau 3 ngày):** `POST /api/v1/dev/simulation/support-requests/{id}/auto-close` $\rightarrow$ Quá 3 ngày không phản hồi tự về `CLOSED`.

## 📌 Nhóm B: Nghiệp vụ Bồi thường Thiệt hại Hàng hóa (BR-126 $\rightarrow$ BR-128)
11. **Luồng 7.11 (Khách gửi yêu cầu bồi thường):** `POST /api/v1/support-requests` (`GOODS_DAMAGE` / `GOODS_LOSS`) $\rightarrow$ Tạo hồ sơ `compensation_claims` mã `CLM-xxxxxx` ở trạng thái `SUBMITTED`.
12. **Luồng 7.12 (Nhân viên khảo sát hiện trường):** Mở kho cùng khách, chụp ảnh, ghi nhận nguyên nhân sơ bộ $\rightarrow$ Hồ sơ sang `INSPECTED`.
13. **Luồng 7.13 (FM xem chi tiết & Đối chiếu dữ liệu):** Đối chiếu ảnh hiện trường + biên bản nhận kho + **biểu đồ cảm biến IoT $\pm 3$ ngày**.
14. **Luồng 7.14 (FM xem trước bảng tính bồi thường):** `POST /api/v1/claims/{id}/quote` $\rightarrow$ Tính tiền hàng $\le$ trần bảo hiểm + hoàn tiền thuê theo ngày gián đoạn.
15. **Luồng 7.15 (FM chốt thẩm định bồi thường):** `POST /api/v1/claims/{id}/decide` $\rightarrow$ Duyệt `APPROVED` (chờ chi trả) hoặc từ chối `REJECTED`.
16. **Luồng 7.16 (FM chi trả tiền bồi thường):** `POST /api/v1/claims/{id}/pay` $\rightarrow$ Chuyển khoản, nhập mã FT $\rightarrow$ Hồ sơ `PAID`, lưu giao dịch `COMPENSATION`, gửi hồ sơ sang bảo hiểm (`insurance_status = 'SUBMITTED'`).
17. **Luồng 7.17 (Bảo hiểm chi trả bồi hoàn):** Giả lập `POST /api/v1/dev/simulation/claims/{id}/insurance-payout` $\rightarrow$ Bảo hiểm duyệt, bồi hoàn tiền vào quỹ QueenKho.

---

# PHẦN 8: SYSTEM THINKING — KỊCH BẢN 7 BƯỚC THÊM 1 TRƯỜNG MỚI (LIVE CODING)

> **Tình huống:** Giảng viên yêu cầu thêm trường `maintenance_priority` (Độ ưu tiên bảo trì: `LOW`, `MEDIUM`, `HIGH`) vào ô kho `storage_units`.

* **Bước 1 (Sửa Database trước tiên):** Vì backend dùng `ddl-auto: validate`, nếu không chạy SQL trước thì server sẽ crash khi khởi động!
  ```sql
  ALTER TABLE storage_units ADD maintenance_priority NVARCHAR(20) NOT NULL DEFAULT 'MEDIUM';
  ```
* **Bước 2 (Sửa Entity):** Thêm vào `entity/StorageUnit.java`:
  ```java
  @Column(name = "maintenance_priority", length = 20)
  private String maintenancePriority = "MEDIUM";
  ```
* **Bước 3 (Sửa DTO):**
  - Thêm `private String maintenancePriority;` vào `CreateStorageUnitRequest.java`.
  - Thêm `private String maintenancePriority;` vào `StorageUnitDetailResponse.java`.
* **Bước 4 (Sửa Service):** Trong `StorageUnitService.java`:
  - Hàm `createStorageUnit`: `unit.setMaintenancePriority(request.getMaintenancePriority());`
  - Hàm `toDetail`: `.maintenancePriority(unit.getMaintenancePriority())`
* **Bước 5 (Controller):** `StorageUnitController.java` tự động nhận và trả về DTO qua Jackson mà không cần sửa method.
* **Bước 6 (Sửa Frontend Service):** `storageUnitService.js` đảm bảo payload gửi lên có chứa `maintenancePriority`.
* **Bước 7 (Sửa React JSX):** Trong `StorageManagementPage.jsx`:
  - Thêm vào state `addForm: { ..., maintenancePriority: 'MEDIUM' }`.
  - Thêm thẻ `<select>` chọn độ ưu tiên trên Modal thêm ô kho.
  - Hiển thị nhãn `{unit.maintenancePriority}` trên danh sách.

---

# PHẦN 9: QUY TRÌNH AGILE SCRUM & PHÂN CHIA SPRINT

> **Câu hỏi:** *"Tại sao tính năng bồi thường (Flow 7) hay quản lý mặt bằng nâng cao (Flow 5) lại làm ở Sprint sau?"*

### Cách trả lời chuẩn bài:
> *"Dạ thưa thầy/cô, nhóm em phát triển theo khung làm việc **Agile Scrum**, ưu tiên Product Backlog theo phương pháp **MoSCoW** và định hướng **MVP (Sản phẩm tối thiểu khả dụng)**:  
> 1. **Sprint 1 (Nền tảng):** Xây dựng CSDL 25 bảng, phân quyền 5 Actor, danh mục cơ sở & loại kho.  
> 2. **Sprint 2 (Luồng kinh doanh sống còn - Core Business):** Ưu tiên **Flow 1 & Flow 2 (Tìm kho, cọc VNPAY, gán ô, check-in)** vì không có đơn hàng thì doanh nghiệp không thể vận hành.  
> 3. **Sprint 3 (Vận hành & Mặt bằng):** Phát triển **Flow 3 & Flow 5 (Quản lý ô kho mặt bằng Grid, bảo trì, nghiệm thu trả kho, hoàn cọc)**.  
> 4. **Sprint 4 (Hậu mãi & Ngoại lệ chuyên sâu):** Mới phát triển **Flow 6 & Flow 7 (Hỗ trợ khách hàng, cấp lại PIN, thẩm định bồi thường bảo hiểm và xử lý nợ quá hạn)**.  
> 
> **Lý do kỹ thuật xếp Flow 7 ở sau:** Để kiểm thử được tính năng bồi thường hàng hư hoặc cấp lại PIN, hệ thống bắt buộc phải có hợp đồng ở trạng thái `ACTIVE` và ô kho đang `OCCUPIED`. Nếu làm Flow 7 ở Sprint 1 thì sẽ không có dữ liệu nền để kiểm thử (Testability). Nhóm tuân thủ đúng nguyên lý Agile: **Phát triển theo lát cắt dọc (Vertical Slicing), làm tính năng cốt lõi trước rồi mở rộng dần dần (Incremental Delivery) qua từng Sprint ạ!"*

---

# PHẦN 10: TỔNG HỢP CÂU HỎI VẤN ĐÁP BẪY & CÁCH TRẢ LỜI ĐIỂM 10

### ❓ 1. "Tại sao không dùng MySQL hay MongoDB mà dùng SQL Server?"
* **Trả lời:** *"Dạ, mô hình thuê kho tự quản quản lý tiền cọc, công nợ lũy kế, bồi thường bảo hiểm và hợp đồng pháp lý đòi hỏi tính toàn vẹn dữ liệu **ACID tuyệt đối**. SQL Server cung cấp hệ thống ràng buộc khóa ngoại, transaction isolation và tương thích báo cáo tài chính tốt hơn hẳn NoSQL (MongoDB vốn không phù hợp cho tài chính kế toán)."*

### ❓ 2. "Lỗ hổng IDOR là gì và nhóm đã chặn bằng cách nào?"
* **Trả lời:** *"Dạ, IDOR (Insecure Direct Object Reference) là khi Khách A đổi ID trên URL để xem trộm hợp đồng của Khách B. Nhóm em chặn đứng bằng **`OwnershipGuard`**: Filter giải mã Token lấy `userId` và `facilityId` thực tế lưu vào ThreadLocal. Trước khi xử lý, Controller gọi `ownershipGuard.checkFacility()` hoặc `checkStorageUnit()`. Nếu người gửi không phải chủ sở hữu, hệ thống ngắt ngay lập tức với mã **`403 Forbidden`**."*

### ❓ 3. "Khách đang nợ tiền quá hạn mà báo quên PIN thì nhân viên có cấp lại được không?"
* **Trả lời:** *"Dạ tuyệt đối không. Tầng Service kiểm tra `contract.getStatus().equals("OVERDUE")` và ném mã lỗi **`409 CONTRACT_OVERDUE`**. Đây là quy tắc an ninh bảo vệ tài sản: khoang kho bị khóa cửa SmartLock, khách bắt buộc phải thanh toán hết công nợ phí phạt trễ hạn mới được mở kho để tránh tẩu tán tài sản trốn nợ."*

### ❓ 4. "Tại sao dùng `ddl-auto: validate` mà không dùng `update`?"
* **Trả lời:** *"Dạ, nếu để `update`, Hibernate sẽ tự ý sửa cột hoặc tạo index ngầm gây lệch schema thực tế. Nhóm để `validate` để toàn bộ 25 bảng CSDL đều do script SQL kiểm soát 100%. Hibernate chỉ kiểm tra đối chiếu xem Entity Java có khớp hoàn toàn với CSDL thực tế hay không, đảm bảo dữ liệu nhất quán tuyệt đối."*

---

# PHẦN 11: CÔNG THỨC 4 BƯỚC "TRẢ LỜI NGHIỆP VỤ CHUẨN KỸ SƯ" & 4 KỊCH BẢN MẪU

Khi thầy cô hỏi: *"Nghiệp vụ ở đây là gì?"*, **tuyệt đối không kể lể cách bấm nút**. Hãy áp dụng công thức 4 bước sau:

```
[BƯỚC 1: MỤC TIÊU KINH DOANH] ➔ Giải quyết bài toán gì ngoài đời thực cho ai?
[BƯỚC 2: CÁC LUẬT RÀNG BUỘC]  ➔ Điều kiện tiên quyết (Invariants / Pre-conditions) là gì?
[BƯỚC 3: SỰ BIẾN ĐỔI TRẠNG THÁI] ➔ Trạng thái dữ liệu chuyển từ đâu sang đâu? Sinh task gì?
[BƯỚC 4: XỬ LÝ NGOẠI LỆ / RỦI RO] ➔ Xử lý tình huống biên (Edge cases) ra sao?
```

### 🎯 Kịch bản 1: Khi thầy cô hỏi tổng quan hệ thống
* **Trả lời:** *"Dạ, nghiệp vụ cốt lõi của QueenKho là **Quản lý vòng đời Hợp đồng thuê kho tự quản thông minh** nhằm giải quyết 3 bài toán lớn: (1) Tối ưu hóa khai thác kho theo **Lịch khoảng ngày**, bán trước các ô sắp trống mà không bị đè lịch; (2) Kiểm soát ra vào 24/7 bằng **mã PIN SmartLock 6 số và thẻ RFID** sau khi nhân viên đã kiểm tra CCCD, hàng hóa và chụp ảnh hiện trạng tại quầy; (3) Minh bạch tài chính & bồi thường bằng cách đối chiếu dữ liệu **Cảm biến IoT (nhiệt độ/độ ẩm)** khi hàng hóa có sự cố."*

### 🎯 Kịch bản 2: Khi hỏi Flow 2 (Gán ô kho & Bàn giao)
* **Trả lời:** *"Dạ, (1) Mục tiêu: Quản lý cơ sở (FM) chỉ định ô kho phù hợp và bàn giao an toàn cho khách; (2) Luật ràng buộc: FM chỉ được gán ô cùng cơ sở, đúng loại kho và rảnh trọn vẹn trong suốt kỳ thuê của khách (BR-41); (3) Biến đổi trạng thái: Trong 1 Transaction, đơn chuyển `UNIT_ASSIGNED`, sinh Hợp đồng `PENDING_CHECK_IN` và sinh Task `CHECK_IN` cho nhân viên; (4) Ngoại lệ: Nhân viên bắt buộc chụp 1–10 ảnh hiện trạng ô kho và kiểm tra đủ 6 tiêu chí (không chứa chất cấm/dễ cháy) trước khi kích hoạt Hợp đồng `ACTIVE` và cấp mã PIN/RFID."*

### 🎯 Kịch bản 3: Khi hỏi Flow 5 (Quản lý kho & Bảo trì của FM)
* **Trả lời:** *"Dạ, (1) Mục tiêu: Quản trị hạ tầng ô kho trên mặt bằng số hóa Grid 0.5m và theo dõi công suất khai thác qua Lịch ô kho; (2) Luật bảo trì: Khi ô hỏng, FM chuyển trạng thái sang `MAINTENANCE` kèm lý do $\ge 10$ ký tự; (3) Biến đổi trạng thái: Hệ thống lập tức chặn khách đặt vào ô này, đồng thời sinh 1 Task bảo trì cho nhân viên; (4) Ngoại lệ: Nếu ô này đã lỡ được gán cho một khách sắp tới nhận, hệ thống cảnh báo trên Lịch để FM tiến hành đổi sang ô khác cùng loại cho khách trước giờ hẹn."*

### 🎯 Kịch bản 4: Khi hỏi Flow 7 (Bồi thường hàng hóa có IoT)
* **Trả lời:** *"Dạ, (1) Mục tiêu: Giải quyết khiếu nại đền bù khi hàng hóa của khách bị mất mát hoặc ẩm mốc; (2) Luật phòng chống gian lận: Nhân viên phải khảo sát hiện trường chụp ảnh. Điểm chốt chặn là FM đối chiếu dữ liệu **Cảm biến nhiệt/ẩm từ `environmental_logs`** và **Lịch sử mở cửa từ `access_logs`**. Nếu độ ẩm vượt ngưỡng quy định kéo dài thì lỗi do kho $\rightarrow$ duyệt bồi thường. Nếu thông số bình thường mà khách tự làm ướt hàng $\rightarrow$ từ chối bồi thường minh bạch; (3) Hạn mức: Số tiền đền bù bị chặn trần bởi gói bảo hiểm khách đã mua (Cơ bản tối đa 20 triệu, Nâng cao, Cao cấp)."*

---

# PHẦN 12: CHUYÊN ĐỀ NÚT GIẢ LẬP (TIME TRAVEL SIMULATION) & KỸ NĂNG SỬA/THÊM NÚT

## 12.1 Bản chất: Tại sao cần nút giả lập?
* Nghiệp vụ QueenKho phụ thuộc lớn vào thời gian thực: Giữ chỗ 15 phút, khách đến nhận sau 7 ngày, hợp đồng thuê 3 tháng, nhắc hạn trước 15 ngày, quá hạn 30 ngày dọn vào kho tổng...
* Để demo mượt mà trước Hội đồng mà không thể chờ hàng tháng ngoài đời, nhóm triển khai cơ chế **"Tua thời gian giả lập" (Time Travel Simulation - BR-114 $\rightarrow$ BR-116)**.
* **Cơ chế an toàn:** Trong `application.yaml`, cấu hình `queenkho.simulation.enabled: ${SIMULATION_ENABLED:true}`. Trên môi trường Production thực tế, chỉ cần đặt `SIMULATION_ENABLED=false`, API trả về `enabled: false`, toàn bộ nút giả lập trên Frontend sẽ **tự động biến mất 100% (`return null`)**, tuyệt đối không ảnh hưởng người dùng thật!

## 12.2 Bản đồ Code của Hệ thống Giả lập
* **Frontend Component:** `frontend/src/components/SimulationButton.jsx` (Nút viền cam đứt nét `#FF9600`, icon tia sét ⚡).
* **Frontend Service:** `frontend/src/services/simulationService.js` (Gọi API Axios qua endpoint `/api/v1/dev/simulation/...`).
* **Backend Controller:** `DemoSimulationController.java` (`@RequestMapping("/api/v1/dev/simulation")`).
* **Backend Service:** `DemoSimulationService.java` (Sửa ngày tháng trong Database và ghi log `[SIMULATION]` vào `activity_logs`).
* **Các màn hình cắm nút giả lập:**
  - `StaffTaskDetailPage.jsx`: "Khách tới hôm nay", "Hẹn còn 45 ngày (khoá việc)", "Hẹn còn 30 ngày (mở việc)", "Khách bùng hẹn (No-Show)", "Task quá hạn ngay".
  - `ContractDetailView.jsx`: "Còn 15/10/7/3/1 ngày hết hạn", "Quá hạn 3 ngày", "Quá hạn 31 ngày".
  - `ContractProtectionPanel.jsx`: "Cảm biến vượt ngưỡng (nhiệt/ẩm)".
  - `ClaimsPage.jsx`: "Bên bảo hiểm duyệt chi trả".
  - `CustomerSupportPage.jsx`: "Ticket tự đóng sau 3 ngày".

## 12.3 Kỹ năng xử lý khi Hội đồng yêu cầu sửa / thêm nút giả lập (Live Coding)

### 📝 Tình huống A: Sửa tham số nút có sẵn (Ví dụ: Đổi hẹn còn 45 ngày thành 60 ngày)
1. Mở file `frontend/src/pages/staff/StaffTaskDetailPage.jsx` (khoảng dòng 1213).
2. Tìm component `<SimulationButton label="Hẹn còn 45 ngày (khoá giao việc)" ... onRun={() => simulateAppointmentIn(task.id, 45)} />`.
3. Sửa số `45` thành `60` và đổi label thành `"Hẹn còn 60 ngày"`. Lưu file (Ctrl+S) $\rightarrow$ Trình duyệt tự hot-reload và hiển thị ngay!

### 📝 Tình huống B: Thêm 1 nút giả lập mới toanh ở Frontend (Tận dụng API có sẵn)
1. Mở `StaffTaskDetailPage.jsx`, copy một thẻ `<SimulationButton>` có sẵn.
2. Đổi label thành `"Hẹn còn 10 ngày (mở giao việc)"`, truyền tham số `simulateAppointmentIn(task.id, 10)`.
3. Lưu file $\rightarrow$ Xuất hiện ngay một nút ⚡ mới trên giao diện.

### 📝 Tình huống C: Giải thích logic Backend
1. Mở `DemoSimulationController.java` chỉ vào endpoint `POST /tasks/{id}/appointment-in`.
2. Mở `DemoSimulationService.java` chỉ hàm:
   ```java
   LocalDate newTargetDate = LocalDate.now().plusDays(days);
   // Cập nhật ngày hẹn của hợp đồng / task trong DB
   // Ghi log [SIMULATION] vào bảng activity_logs
   ```
3. Khẳng định: Mọi hành động giả lập đều được gắn cờ `[SIMULATION]` trong Audit Log để minh bạch kiểm toán.

---
> 🎯 **LỜI KHUYÊN VÀNG KHI BẢO VỆ:** Bình tĩnh lắng nghe, phân loại câu hỏi vào đúng 1 trong các Phần của Cẩm nang này. Trả lời dứt khoát, dẫn chứng trực tiếp tên file mã nguồn và luật nghiệp vụ (`PR-xx`, `BR-xx`). Bạn đã nắm trọn vẹn toàn bộ hệ thống từ A đến Z, chắc chắn sẽ đạt điểm xuất sắc!
