# BÁO CÁO TOÀN DIỆN KỸ THUẬT & NGHIỆP VỤ: FLOW 5 & FLOW 7
### ĐỒ ÁN TỐT NGHIỆP SWP391 — HỆ THỐNG QUEENKHO

> **Tài liệu học tập & bảo vệ trọn gói theo yêu cầu nhóm trưởng:**
> 1. **Technical Foundation:** API Contract (kebab-case, plural nouns), Tổ chức Folder React, Tổ chức Folder Spring Boot.
> 2. **Chuyên đề Exception Handling:** Cơ chế ném ngoại lệ ở Backend, bắt lỗi tại Controller, xử lý lỗi tại Frontend Axios & Toast, kèm Bảng tra cứu 25+ mã lỗi nghiệp vụ.
> 3. **Toàn bộ 17 luồng chi tiết của FLOW 5 (Quản lý ô kho & Điều phối FM).**
> 4. **Toàn bộ 17 luồng chi tiết của FLOW 7 (Hỗ trợ khách hàng & Bồi thường bảo hiểm).**

---

# PHẦN 1: TỔNG QUAN TECHNICAL CỦA PROJECT

## 1.1 API Contract & Chuẩn đặt tên URI (Giải mã câu hỏi `/unit-types`)

### A. Tại sao URI lại đặt là `/unit-types`?
1. **Chuẩn RESTful Resource Naming (RFC 3986):**
   - Trong kiến trúc REST, URI định danh **Tài nguyên (Resource)** hoặc **Tập hợp tài nguyên (Collection)**.
   - Vì endpoint này phục vụ việc lấy danh sách danh mục các loại kho (nhiều loại kho) $\rightarrow$ bắt buộc sử dụng **danh từ số nhiều (`unit-types`)**.
   - Tuyệt đối không dùng động từ trong URI (như `/getUnitTypes`, `/saveUnitType`) vì hành động nghiệp vụ đã được định nghĩa qua HTTP Methods (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`).
2. **Kebab-case (`unit-types`) vs. Snake_case (`unit_types`) vs. Viết liền (`unittypes`):**
   - **Kebab-case (`-`):** Chuẩn quốc tế khuyến nghị dùng dấu gạch ngang. Dấu gạch dưới `_` khi hiển thị trên các trình duyệt hoặc tài liệu hyperlink thường bị đường gạch chân (`underline`) che khuất hoàn toàn, gây nhầm với khoảng trắng. Hơn nữa, các Web Engine/Parser coi dấu `-` là dấu ngắt từ (word separator), còn `_` bị gộp thành một từ.
   - **Không viết liền (`unittypes`):** Làm dính 2 từ tiếng Anh riêng biệt (`unit` + `types`), vi phạm nguyên tắc **Readability (Tính dễ đọc)** của Clean Code.
   - **Tính nhất quán:** Toàn hệ thống QueenKho tuân thủ kebab-case: `/storage-units`, `/staff-tasks`, `/support-requests`, `/compensation-claims`.

### B. Quy ước JSON Payload
- **Tên field:** Luôn dùng **camelCase** (vd: `unitTypeId`, `roomNumber`, `claimedAmount`). Cấu hình trong `application.yaml`:
  ```yaml
  spring:
    jackson:
      property-naming-strategy: LOWER_CAMEL_CASE
  ```
- **Enum / Trạng thái:** Luôn viết **CHỮ HOA KHÔNG DẤU** (`AVAILABLE`, `MAINTENANCE`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`).
- **Response chuẩn:**
  - Thành công: Trả trực tiếp Object DTO hoặc Array DTO.
  - Lỗi: `{ "error": "MÃ_LỖI", "message": "Thông báo tiếng Việt", "details": { ... } }`.

---

## 1.2 Tổ chức Folder React (Frontend Architecture)

Cấu trúc mã nguồn tại `frontend/src/`:
```
frontend/src/
├── components/                  # UI dùng chung: FloorPlanBoard, UnitScheduleModal, HandoverPhotos, Toast
├── pages/                       # Giao diện chia theo vai trò (Role/Domain):
│   ├── manager/                 # Quản lý cơ sở: StorageManagementPage, ManagerTaskBoardPage, ClaimsPage
│   ├── staff/                   # Nhân viên: StaffTaskBoardPage, StaffTaskDetailPage
│   ├── support/                 # Khách hàng: CustomerSupportPage
│   ├── customer/                # Hợp đồng & Thanh toán của khách
│   ├── bom/                     # Giám đốc vận hành
│   └── admin/                   # Quản trị hệ thống
├── services/                    # Tầng gọi API qua Axios:
│   ├── api.js                   # Cấu hình Base URL (http://localhost:8080/api/v1) & JWT Interceptor
│   ├── storageUnitService.js    # API ô kho & sơ đồ mặt bằng (Flow 5)
│   ├── staffTaskService.js      # API task & điều phối giao việc (Flow 5 & Flow 7)
│   ├── supportService.js        # API ticket hỗ trợ (Flow 7)
│   ├── claimService.js          # API bồi thường bảo hiểm (Flow 7)
│   └── simulationService.js     # API tua thời gian để demo
├── utils/                       # Hàm tiện ích: date.js, floorPlan.js, sensor.js
├── App.jsx                      # Định tuyến React Router v7 & Phân quyền Route Guard
└── main.jsx                     # Điểm gắn kết DOM
```

* **Cơ chế lưu phiên `sessionStorage`:** Dùng `sessionStorage` thay vì `localStorage` để khi đóng tab trình duyệt, session tự huỷ. Khi test đồng thời Khách, Quản lý và Nhân viên trên các tab/profile khác nhau sẽ không bao giờ bị đè dữ liệu đăng nhập của nhau.
* **Bảo vệ Route (Route Guard):** Trong `App.jsx`, các trang quản lý được bọc trong `<ManagerLayout />`, nhân viên bọc trong `<StaffLayout />`. Nếu người dùng chưa login hoặc sai role, Layout lập tức redirect về `/login`.

---

## 1.3 Tổ chức Folder Spring Boot (Backend Architecture)

Cấu trúc mã nguồn tại `backend/api/src/main/java/com/queenkho/api/`:
```
com.queenkho.api/
├── controller/                  # Tiếp nhận HTTP Request, validate @Valid DTO, định tuyến URL
├── service/                     # Nghiệp vụ (Business logic), Transaction (@Transactional), tính toán tiền
├── repository/                  # Giao tiếp DB qua Spring Data JPA (JpaRepository) & Native Query
├── entity/                      # Ánh xạ 1-1 với 25 bảng trong QueenKhoDB (StorageUnit, StaffTask,...)
├── dto/                         # DTO Request/Response (tách biệt hoàn toàn với Entity)
├── security/                    # AccessControlFilter, OwnershipGuard (chống IDOR), CurrentUserProvider
├── exception/                   # Custom Exception & Exception Handlers tập trung
└── config/                      # Cấu hình CORS, Security, Jackson
```

* **Tại sao tách DTO và Entity?**
  1. Tránh lộ thông tin nhạy cảm (password, audit private fields).
  2. Ngăn ngừa lỗi kinh điển `LazyInitializationException` khi chuyển dữ liệu sang JSON ngoài phạm vi Hibernate Transaction.
  3. Cho phép bổ sung các trường tính toán thời gian thực mà DB không lưu cứng (vd: `occupancyRate`, `isReleasing`, `scheduleWarning`).

---

# PHẦN 2: CHUYÊN ĐỀ EXCEPTION HANDLING (XỬ LÝ NGOẠI LỆ TỪ A-Z)

## 2.1 Kiến trúc xử lý Ngoại lệ tập trung ở Backend

Backend QueenKho xây dựng hệ thống phân cấp Exception dựa trên `RuntimeException`:

```
               java.lang.Throwable
                       ▲
               java.lang.Exception
                       ▲
            java.lang.RuntimeException (Unchecked Exception)
           ┌───────────┴───────────┐
           ▼                       ▼
    FacilityException       StaffTaskException
 (Ngoại lệ ô kho, mặt bằng)   (Ngoại lệ task, ticket, bồi thường)
```

### Cấu trúc 1 Custom Exception:
```java
@Getter
public class FacilityException extends RuntimeException {
    private final HttpStatus status;
    private final String code;

    public FacilityException(HttpStatus status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }
}
```

### Tầng bắt lỗi tại Controller (`@ExceptionHandler`):
Khi tầng Service phát hiện vi phạm nghiệp vụ và ném ra Exception, Controller bắt lại thông qua method `@ExceptionHandler`:
```java
@ExceptionHandler(FacilityException.class)
public ResponseEntity<Map<String, String>> handleFacilityException(FacilityException ex) {
    return ResponseEntity.status(ex.getStatus())
            .body(Map.of(
                    "error", ex.getCode(),
                    "message", ex.getMessage()
            ));
}
```

### Xử lý lỗi Validation DTO (`MethodArgumentNotValidException`):
Khi dữ liệu gửi lên vi phạm các annotation `@NotNull`, `@NotBlank`, `@Size` trên DTO:
```java
@ExceptionHandler(MethodArgumentNotValidException.class)
public ResponseEntity<Map<String, Object>> handleValidationExceptions(MethodArgumentNotValidException ex) {
    Map<String, String> errors = new HashMap<>();
    for (FieldError error : ex.getBindingResult().getFieldErrors()) {
        errors.put(error.getField(), error.getDefaultMessage());
    }
    return ResponseEntity.status(HttpStatus.BAD_REQUEST)
            .body(Map.of(
                    "error", "INVALID_INPUT",
                    "message", "Dữ liệu nhập vào không hợp lệ",
                    "details", errors
            ));
}
```

---

## 2.2 Xử lý Ngoại lệ ở Frontend React

1. **Axios Interceptor (`frontend/src/services/api.js`):**
   - Tự động bắt lỗi `401 Unauthorized` (Token hết hạn) hoặc `403 Forbidden` $\rightarrow$ xóa session và đá người dùng về `/login`.
2. **Khối `try ... catch (err)` tại từng Component:**
   ```javascript
   try {
     await updateStorageUnitStatus(id, 'MAINTENANCE', note);
     setToast({ type: 'success', message: 'Khóa bảo trì thành công' });
   } catch (err) {
     const errorMsg = err.response?.data?.message || 'Không thể cập nhật trạng thái ô kho.';
     setToast({ type: 'error', message: errorMsg });
   }
   ```
3. **Hiển thị Toast Duolingo:**
   - Toast màu đỏ nổi góc phải (`bg-[#FFDFDF] border-[#FF4B4B] text-[#FF4B4B]`), tự tắt sau 4 giây.

---

## 2.3 BẢNG TRA CỨU TOÀN BỘ MÃ LỖI (EXCEPTION CODES) CỦA FLOW 5 & FLOW 7

| Mã lỗi (`error`) | HTTP Status | Nơi ném ra (Class & Method) | Điều kiện kích hoạt trong Code | Thông báo hiển thị trên UI |
|---|---|---|---|---|
| **SLOT_IN_USE** | `409 CONFLICT` | `StorageUnitService.checkSlotAvailabilityBeforeReduction` | Thao tác làm giảm 1 ô khả dụng nhưng $\text{Suất cọc} - 1 < 0$ (BR-11) | *"Không thể thực hiện vì sẽ làm âm số suất khả dụng của loại kho này"* |
| **UNIT_IN_USE** | `409 CONFLICT` | `StorageUnitService.updateStorageUnitStatus` | FM cố tình sửa hoặc đổi trạng thái ô đang có khách thuê (`OCCUPIED`) | *"Ô kho đang có hợp đồng hoạt động (OCCUPIED), không thể tự ý chuyển trạng thái"* |
| **UNIT_HAS_CONTRACT_HISTORY** | `409 CONFLICT` | `StorageUnitService.deleteStorageUnit` | FM cố xóa ô kho đã từng phát sinh hợp đồng thuê trong lịch sử (PR-21) | *"Không thể xóa ô kho vì đã từng phát sinh hợp đồng thuê trong lịch sử"* |
| **DUPLICATE_UNIT_CODE** | `409 CONFLICT` | `StorageUnitService.createStorageUnit` | Mã ô kho tự sinh (vd: `KV-TB-A101`) đã tồn tại trong database | *"Mã ô kho đã tồn tại trong hệ thống"* |
| **UNIT_TYPE_INACTIVE** | `400 BAD_REQUEST` | `StorageUnitService.createStorageUnit` | Tạo ô kho mới bằng loại kho đang bị tạm ngưng (`INACTIVE`) (PR-M4) | *"Không thể tạo ô kho mới với loại kho đang ở trạng thái Tạm ngưng"* |
| **UNIT_NOT_IDLE** | `409 CONFLICT` | `StorageUnitService.setEmergency` | Đặt ô khẩn cấp trên ô đang bảo trì hoặc đang có khách thuê (BR-140) | *"Chỉ đổi ô khẩn cấp khi ô đang trống"* |
| **TASK_NOT_ASSIGNABLE** | `409 CONFLICT` | `StaffTaskService.assignTask` | FM cố tình giao task hoàn tiền (`REFUND`) cho nhân viên làm thay | *"Task hoàn tiền do quản lý tự xử lý, không giao cho nhân viên"* |
| **TASK_OVERDUE** | `409 CONFLICT` | `StaffTaskService.assignTask` | Giao một task đã quá hạn mà chưa gia hạn lịch | *"Task đã quá hạn, hãy gia hạn / dời lịch trước khi giao việc"* |
| **TASK_NOT_ASSIGNED** | `409 CONFLICT` | `StaffTaskService.unassignTask` | Bấm gỡ người nhận trên một task chưa có ai nhận việc | *"Task chưa có người nhận"* |
| **STAFF_INACTIVE** | `400 BAD_REQUEST` | `StaffTaskService.assignTask` | Giao việc cho nhân viên đang bị khóa tài khoản | *"Nhân viên đang bị khoá, không giao việc được"* |
| **INVALID_STAFF** | `400 BAD_REQUEST` | `StaffTaskService.assignTask` | Giao việc cho nhân viên thuộc cơ sở khác | *"Chỉ giao được cho nhân viên thuộc cơ sở của bạn"* |
| **OUT_OF_ASSIGN_WINDOW** | `409 CONFLICT` | `StaffTaskService.requireInAssignWindow` | Giao task check-in/out trước ngày hẹn $> 30$ ngày (PR-T1) | *"Chỉ giao/nhận việc trong vòng 30 ngày trước ngày hẹn"* |
| **FORBIDDEN_CONTRACT** | `403 FORBIDDEN` | `SupportRequestService.createTicket` | Khách hàng A cố tình gửi ticket trên hợp đồng của khách hàng B (PR-51) | *"Hợp đồng này không thuộc quyền sở hữu của bạn"* |
| **CONTRACT_STATUS_INVALID** | `409 CONFLICT` | `SupportRequestService.createTicket` | Gửi ticket trên hợp đồng đã thanh lý (`LIQUIDATED`) hoặc đã hủy | *"Chỉ hợp đồng đang hoạt động, quá hạn hoặc chờ trả kho mới được gửi hỗ trợ"* |
| **DUPLICATE_ISSUE_TYPE** | `409 CONFLICT` | `SupportRequestService.createTicket` | Hợp đồng đang có 1 ticket cùng loại sự cố chưa đóng (PR-S2) | *"Hợp đồng đang có 1 yêu cầu chưa đóng. Mỗi hợp đồng chỉ được mở 1 ticket cho mỗi loại sự cố"* |
| **MAX_OPEN_TICKETS_REACHED** | `409 CONFLICT` | `SupportRequestService.createTicket` | Hợp đồng đã có 3 ticket đang mở, chạm trần tối đa (PR-S2) | *"Hợp đồng đã có 3/3 yêu cầu hỗ trợ đang mở. Vui lòng chờ xử lý hoặc đóng bớt ticket"* |
| **CONTRACT_OVERDUE** | `409 CONFLICT` | `StaffTaskService.resetSupportContractPin` | Cấp lại mã PIN cho hợp đồng đang nợ tiền quá hạn (PR-Q5, PR-S6) | *"Hợp đồng đang quá hạn thanh toán, mã PIN đang bị khóa nên không thể cấp lại"* |
| **TASK_NOT_SUPPORT** | `409 CONFLICT` | `StaffTaskService.resetSupportContractPin` | Gọi API cấp lại mã PIN trên task không phải `SUPPORT` | *"Chỉ task hỗ trợ mới có chức năng cấp lại PIN"* |
| **INVALID_CLAIM** | `400 BAD_REQUEST` | `CompensationClaimService.validateClaimInput` | Thiếu danh sách hàng hư hoặc số tiền yêu cầu $\le 0$ (BR-126) | *"Danh sách hàng bị ảnh hưởng bắt buộc, từ 10 đến 2000 ký tự"* |
| **EVIDENCE_IMAGE_REQUIRED** | `400 BAD_REQUEST` | `CompensationClaimService.validateClaimInput` | Báo hỏng hàng (`GOODS_DAMAGE`) nhưng không đính kèm ít nhất 1 ảnh chụp | *"Hàng bị hư hỏng cần ít nhất 1 ảnh chụp hàng / hoá đơn"* |
| **CLAIM_ALREADY_SETTLED** | `409 CONFLICT` | `CompensationClaimService.reopenForTicket` | Khách bấm mở lại ticket của hồ sơ bồi thường đã được chi trả tiền | *"Hồ sơ bồi thường đã được chấp nhận, không mở lại"* |
| **INVALID_INPUT** | `400 BAD_REQUEST` | Nhiều hàm | Vi phạm độ dài mô tả, ghi chú dưới 10 ký tự | *"Dữ liệu nhập vào không hợp lệ"* |

---

# PHẦN 3: CHI TIẾT TOÀN BỘ 17 LUỒNG CỦA FLOW 5 (QUẢN LÝ Ô KHO & ĐIỀU PHỐI FM)

## 📌 Nhóm A: Nghiệp vụ Quản lý Ô kho & Mặt bằng (`/manager/units`)

### 🟢 Luồng 5.1: Xem danh sách ô kho, Lưới mặt bằng & Bộ chỉ số KPI
- **UI:** FM mở `/manager/units`.
- **Frontend Service:** `getStorageUnits(params)` & `getFacilityLayout(facilityId)` trong `storageUnitService.js`.
- **API:** `GET /api/v1/storage-units?facilityId=1&status=ALL&floor=ALL` & `GET /api/v1/storage-units/layout?facilityId=1`.
- **Controller:** `StorageUnitController.getStorageUnits` & `FloorPlanController.getLayout`.
- **Service:** `StorageUnitService.getStorageUnits`: Lấy toàn bộ ô kho của cơ sở, lấy ngày giải phóng dự kiến của ô sắp trả (`releaseDatesByUnit`), lấy hợp đồng đang hoạt động, tính bộ chỉ số KPI (Tổng ô, Trống, Đang thuê, Bảo trì, Quá hạn, Sắp trống, Tỉ lệ lấp đầy).
- **Database:** SELECT các bảng: `storage_units`, `rental_contracts`, `facilities`, `unit_types`.

### 🟢 Luồng 5.2: Xem chi tiết 1 ô kho
- **UI:** FM click vào 1 ô trên bảng danh sách hoặc click vào 1 ô trên sơ đồ mặt bằng.
- **Frontend Service:** `getStorageUnitDetail(id)` trong `storageUnitService.js`.
- **API:** `GET /api/v1/storage-units/KV-TB-A101`.
- **Controller:** `StorageUnitController.getStorageUnitDetail` $\rightarrow$ gọi `ownershipGuard.checkStorageUnit(id)`.
- **Service:** `StorageUnitService.getStorageUnitDetail`: Đọc thông tin vật lý của ô, thông tin hợp đồng hiện tại (khách thuê, ngày bắt đầu, ngày kết thúc), các hợp đồng đặt trước trong tương lai (`upcomingContracts`), ngày trống lại (`freeFrom`), và cảnh báo trùng lịch (`scheduleWarning`).
- **Database:** SELECT `storage_units` JOIN `rental_contracts` JOIN `users`.

### 🟢 Luồng 5.3: Xem Lịch ô kho (Timeline / Gantt Chart)
- **UI:** Bấm nút xanh dương **`LỊCH Ô KHO`**.
- **Frontend Service:** Gọi `api.get('/storage-units/schedule', { params })`.
- **API:** `GET /api/v1/storage-units/schedule?facilityId=1&from=2026-11-01&to=2027-02-01`.
- **Controller:** `StorageUnitController.getSchedule`.
- **Service:** `UnitScheduleService.getSchedule`: Tổng hợp dải thời gian chiếm dụng của từng ô kho (khoảng nào đã có khách thuê, khoảng nào trống) để Frontend vẽ biểu đồ Gantt.

### 🟢 Luồng 5.4: Thêm ô kho mới (+ đặt toạ độ trên mặt bằng)
- **UI:** Bấm nút **`+ THÊM Ô KHO MỚI`**, chọn loại kho, tầng, khu (A), số phòng (101), toạ độ trên lưới $\rightarrow$ Bấm **Xác nhận**.
- **Frontend Service:** `createStorageUnit(data, facilityId, actorUserId)` trong `storageUnitService.js`.
- **API:** `POST /api/v1/storage-units?facilityId=1` (Body: `{ unitTypeId, floor, zone, roomNumber, mapX, mapY, ... }`).
- **Controller:** `StorageUnitController.createStorageUnit`.
- **Service:** `StorageUnitService.createStorageUnit`: Kiểm tra loại kho không bị `INACTIVE`, chuẩn hoá số phòng thành 3 số, tự sinh mã `unitId = KV-<facilityCode>-<zone><roomNumber>`, kiểm tra trùng mã, gọi `FloorPlanService` kiểm tra ô không đè lên lối đi/thang máy, lưu DB với status mặc định `AVAILABLE`, ghi audit log.
- **Database:** `INSERT INTO storage_units (...)` & `INSERT INTO activity_logs (...)`.

### 🟢 Luồng 5.5: Sửa cấu hình vật lý của ô kho
- **UI:** FM chọn ô kho $\rightarrow$ Đổi tầng, đổi khu, hoặc đổi loại kho.
- **Frontend Service:** `updateStorageUnit(id, data, actorUserId)` trong `storageUnitService.js`.
- **API:** `PUT /api/v1/storage-units/KV-TB-A101`.
- **Controller:** `StorageUnitController.updateStorageUnit`.
- **Service:** `StorageUnitService.updateStorageUnit`: Chặn nếu ô đang `OCCUPIED` hoặc có khách sắp nhận kho; nếu đổi loại kho phải kiểm tra quy tắc chống âm suất cọc BR-11; nếu đổi tầng thì xóa toạ độ cũ để đưa về danh sách chưa đặt vị trí.
- **Database:** `UPDATE storage_units SET floor = ..., zone = ..., unit_type_id = ... WHERE id = ...`.

### 🟢 Luồng 5.6: Khóa bảo trì ô kho (`AVAILABLE` $\rightarrow$ `MAINTENANCE`)
- **UI:** Bấm nút **`Khóa bảo trì`**, nhập lý do (10–500 ký tự) $\rightarrow$ Xác nhận.
- **Frontend Service:** `updateStorageUnitStatus(id, 'MAINTENANCE', note, actorUserId)`.
- **API:** `PATCH /api/v1/storage-units/KV-TB-A101/status` (Body: `{ status: "MAINTENANCE", note: "..." }`).
- **Controller:** `StorageUnitController.updateStorageUnitStatus`.
- **Service:** `StorageUnitService.updateStorageUnitStatus`: Kiểm tra ô không `OCCUPIED`, kiểm tra lý do $\ge 10$ ký tự, kiểm tra quy tắc BR-11 chống âm suất cọc; đổi status `MAINTENANCE`, lưu `maintenanceNote` và `maintenanceSince`; nếu ô có khách sắp nhận kho (`BR-141`) thì tự động bắn notification báo khách; ghi audit log.
- **Database:** `UPDATE storage_units SET status = 'MAINTENANCE', maintenance_note = '...', maintenance_since = GETDATE() WHERE id = ...`.

### 🟢 Luồng 5.7: Mở lại kho sau bảo trì (`MAINTENANCE` $\rightarrow$ `AVAILABLE`)
- **UI:** Tại ô màu vàng, bấm nút **`Mở lại kho`** $\rightarrow$ Xác nhận.
- **Frontend Service:** `updateStorageUnitStatus(id, 'AVAILABLE', '', actorUserId)`.
- **API:** `PATCH /api/v1/storage-units/KV-TB-A101/status` (Body: `{ status: "AVAILABLE" }`).
- **Controller:** `StorageUnitController.updateStorageUnitStatus`.
- **Service:** Đổi status về `AVAILABLE` (hoặc `EMERGENCY` nếu là ô khẩn cấp), xoá ghi chú bảo trì; gọi `staffTaskService.closeOpenMaintenanceForUnit` đóng luôn task bảo trì liên kết; ghi audit log.
- **Database:** `UPDATE storage_units SET status = 'AVAILABLE', maintenance_note = NULL WHERE id = ...` & `UPDATE facility_tasks SET status = 'COMPLETED' WHERE storage_unit_id = ...`.

### 🟢 Luồng 5.8: Đặt / Bỏ ô kho khẩn cấp (BR-140)
- **UI:** Bấm **`Đặt làm ô khẩn cấp`** (hoặc **`Bỏ ô khẩn cấp`**).
- **Frontend Service:** `setStorageUnitEmergency(id, emergency, actorUserId)` trong `storageUnitService.js`.
- **API:** `PATCH /api/v1/storage-units/KV-TB-A101/emergency` (Body: `{ emergency: true }`).
- **Controller:** `StorageUnitController.setEmergency`.
- **Service:** `StorageUnitService.setEmergency`: Kiểm tra ô đang rảnh (không bảo trì, không có HĐ nào đang/sắp dùng); nếu đặt khẩn cấp thì giảm 1 ô bán được nên phải kiểm tra BR-11; cập nhật `is_emergency` và status `EMERGENCY`.
- **Database:** `UPDATE storage_units SET is_emergency = 1, status = 'EMERGENCY' WHERE id = ...`.

### 🟢 Luồng 5.9: Xóa ô kho vật lý (DELETE)
- **UI:** Bấm icon thùng rác màu đỏ trên dòng ô kho $\rightarrow$ Xác nhận.
- **Frontend Service:** `deleteStorageUnit(id, actorUserId)` trong `storageUnitService.js`.
- **API:** `DELETE /api/v1/storage-units/KV-TB-A101`.
- **Controller:** `StorageUnitController.deleteStorageUnit`.
- **Service:** `StorageUnitService.deleteStorageUnit`: Kiểm tra `rentalContractRepository.existsByStorageUnit_Id(id)` $\rightarrow$ Nếu ô từng có bất kỳ hợp đồng nào trong lịch sử thì **chặn ngay (409 UNIT_HAS_CONTRACT_HISTORY)**; kiểm tra quy tắc BR-11; xoá ô kho khỏi DB; ghi audit log.
- **Database:** `DELETE FROM storage_units WHERE id = 'KV-TB-A101'`.

### 🟢 Luồng 5.10: Lưu sơ đồ mặt bằng tầng (Kéo thả ô & Vật cản)
- **UI:** FM bật chế độ Chỉnh sửa sơ đồ, kéo thả các ô vào toạ độ mới $\rightarrow$ Bấm **Lưu sơ đồ**.
- **Frontend Service:** `saveFloorPlan(floorId, request)` trong `storageUnitService.js`.
- **API:** `PUT /api/v1/storage-units/layout/floors/3/plan` (Body: danh sách toạ độ `{ unitId, x, y, w, h, door }` và vật cản fixtures).
- **Controller:** `FloorPlanController.saveFloorPlan`.
- **Service:** `FloorPlanService.saveFloorPlan`: Kiểm tra toạ độ nằm trong phạm vi tầng, kiểm tra không có 2 ô đè lên nhau, không đè lên lối đi/thang máy; cập nhật `map_x`, `map_y`, `map_w`, `map_h`, `map_door` của các ô; ghi audit log.
- **Database:** Hàng loạt câu `UPDATE storage_units SET map_x = ..., map_y = ... WHERE id = ...`.

---

## 📌 Nhóm B: Nghiệp vụ Điều phối Giao việc (`/manager/tasks`)

### 🟢 Luồng 5.11: Xem Bảng công việc toàn cơ sở
- **UI:** FM mở `/manager/tasks`.
- **Frontend Service:** `getStaffTasks(facilityId, status)` trong `staffTaskService.js`.
- **API:** `GET /api/v1/staff-tasks?facilityId=1`.
- **Controller:** `StaffTaskController.getBoard`.
- **Service:** `StaffTaskService.getBoard`: Truy vấn bảng `facility_tasks` theo cơ sở; tự động đưa các task `SUPPORT` khẩn (`LOCK_ISSUE`, `SECURITY`) lên đầu bảng; sắp xếp theo hạn chót `dueAt` tăng dần.
- **Database:** SELECT `facility_tasks` JOIN `rental_contracts` JOIN `users`.

### 🟢 Luồng 5.12: FM Giao task cho nhân viên cơ sở (Assign Task)
- **UI:** Tại dòng task, FM chọn nhân viên từ dropdown $\rightarrow$ Bấm **Giao việc**.
- **Frontend Service:** `assignStaffTask(taskId, staffId)` trong `staffTaskService.js`.
- **API:** `POST /api/v1/staff-tasks/15/assign?staffId=12`.
- **Controller:** `StaffTaskController.assign`.
- **Service:** `StaffTaskService.assignTask`: Kiểm tra role `FACILITY_MANAGER`; cấm giao task `REFUND`; kiểm tra nhân viên cùng cơ sở và đang `ACTIVE`; kiểm tra khung 30 ngày (PR-T1); cập nhật task sang `IN_PROGRESS`; nếu là task `SUPPORT` thì cập nhật ticket sang `IN_PROGRESS`; bắn notification cho nhân viên; ghi audit log.
- **Database:** `UPDATE facility_tasks SET staff_id = 12, status = 'IN_PROGRESS', claimed_at = GETDATE() WHERE id = 15`.

### 🟢 Luồng 5.13: FM Gỡ người nhận việc (Unassign Task)
- **UI:** Bấm **Gỡ người nhận** cạnh tên nhân viên.
- **Frontend Service:** `unassignStaffTask(taskId, managerId)`.
- **API:** `POST /api/v1/staff-tasks/15/unassign`.
- **Controller:** `StaffTaskController.unassign`.
- **Service:** `StaffTaskService.unassignTask`: Cập nhật `staff_id = NULL`, status về `OPEN`; nếu là task `SUPPORT` thì ticket chuyển ngược về `OPEN`; bắn notification cho nhân viên cũ.
- **Database:** `UPDATE facility_tasks SET staff_id = NULL, status = 'OPEN', claimed_at = NULL WHERE id = 15`.

### 🟢 Luồng 5.14: FM Gia hạn task quá hạn (Extend Task)
- **UI:** Task quá hạn 21:00 hiện nút cam **`Gia hạn xử lý`**, FM nhập ngày mới và lý do.
- **Frontend Service:** `extendOverdueTask(taskId, payload)`.
- **API:** `POST /api/v1/staff-tasks/15/extend` (Body: `{ newDueDate: "2026-11-20", reason: "..." }`).
- **Controller:** `StaffTaskController.extend`.
- **Service:** `StaffTaskService.extendOverdueTask`: Kiểm tra hạn mới tối đa +7 ngày; dời `due_at` thành 21:00 ngày mới; đưa status task về lại `IN_PROGRESS`.
- **Database:** `UPDATE facility_tasks SET due_at = '2026-11-20 21:00:00', status = 'IN_PROGRESS' WHERE id = 15`.

### 🟢 Luồng 5.15: Hoàn tất xử lý bảo trì ô kho
- **UI:** Nhân viên hoặc FM bấm **Sửa xong** trên task `MAINTENANCE`, nhập ghi chú + ảnh bằng chứng sửa chữa.
- **Frontend Service:** `completeMaintenanceTask(taskId, payload)`.
- **API:** `POST /api/v1/staff-tasks/15/complete-maintenance` (Body: `{ note, evidenceImageUrl }`).
- **Controller:** `StaffTaskController.completeMaintenance`.
- **Service:** `StaffTaskService.completeMaintenanceTask`: Task chuyển sang `COMPLETED`; ô kho liên kết tự động chuyển từ `MAINTENANCE` về `AVAILABLE`; ghi audit log.
- **Database:** `UPDATE facility_tasks SET status = 'COMPLETED' WHERE id = 15` & `UPDATE storage_units SET status = 'AVAILABLE' WHERE id = ...`.

### 🟢 Luồng 5.16: FM Hoàn tất chi trả hoàn cọc (Complete Refund)
- **UI:** Trên task `REFUND` (sau khi khách trả kho hoặc huỷ đơn), FM chuyển khoản tiền cọc ngoài đời, nhập mã giao dịch ngân hàng và tải ảnh biên lai $\rightarrow$ Bấm **Xác nhận hoàn tiền**.
- **Frontend Service:** `completeRefundTask(taskId, userId, payload)`.
- **API:** `POST /api/v1/staff-tasks/15/complete-refund` (Body: `{ bankTransactionCode, evidenceImageUrl, note }`).
- **Controller:** `StaffTaskController.completeRefund`.
- **Service:** `StaffTaskService.completeRefundTask`: Task chuyển `COMPLETED`; tạo giao dịch `REFUND` trạng thái `SUCCESS` trong bảng `payment_transactions`; nếu hợp đồng đang chờ hoàn cọc thì kết thúc chu kỳ hợp đồng.
- **Database:** `UPDATE facility_tasks SET status = 'COMPLETED' WHERE id = 15` & `INSERT INTO payment_transactions (...)`.

### 🟢 Luồng 5.17: FM Đổi ô kho cho khách khi ô gặp sự cố (Unit Transfer)
- **UI:** Khi ô kho của khách gặp sự cố hoặc trùng lịch, FM mở chi tiết HĐ $\rightarrow$ Bấm **Đổi ô cho khách** $\rightarrow$ Chọn ô mới cùng loại đang `AVAILABLE`.
- **Frontend Service:** Gọi API đổi ô kho trong `contractService.js`.
- **API:** `POST /api/v1/contracts/18/transfer-unit` (Body: `{ newUnitId, reason }`).
- **Controller:** `ContractController.transferUnit`.
- **Service:** `UnitTransferService.transferUnit`: Kiểm tra ô mới cùng loại, cùng cơ sở và đang trống; cập nhật `storage_unit_id` của hợp đồng sang ô mới; ô cũ chuyển sang `MAINTENANCE`; lưu lịch sử vào bảng `unit_transfers`; thông báo mã PIN và vị trí mới cho khách.
- **Database:** `UPDATE rental_contracts SET storage_unit_id = 'KV-TB-A102' WHERE id = 18` & `INSERT INTO unit_transfers (...)`.

---

# PHẦN 4: CHI TIẾT TOÀN BỘ 17 LUỒNG CỦA FLOW 7 (HỖ TRỢ & BỒI THƯỜNG BẢO HIỂM)

## 📌 Nhóm A: Nghiệp vụ Yêu cầu Hỗ trợ Thông thường & Khóa SmartLock

### 🟣 Luồng 7.1: Khách hàng tải danh sách hợp đồng đủ điều kiện hỗ trợ
- **UI:** Khách vào `/ho-tro` $\rightarrow$ Bấm **`+ GỬI YÊU CẦU HỖ TRỢ`**.
- **Frontend Service:** `getEligibleSupportContracts(customerId)` trong `supportService.js`.
- **API:** `GET /api/v1/support-requests/eligible-contracts?customerId=5`.
- **Controller:** `SupportRequestController.getEligibleContracts`.
- **Service:** `SupportRequestService.getEligibleContracts`: Lọc hợp đồng của khách có status thuộc `ACTIVE`, `OVERDUE`, `TERMINATION_PENDING` (PR-51); đếm số ticket đang mở trên từng hợp đồng.
- **Database:** SELECT `rental_contracts` WHERE `customer_id = 5`.

### 🟣 Luồng 7.2: Khách hàng xem danh sách ticket của mình
- **UI:** Khách xem danh sách ticket trên `/ho-tro` (lọc theo Tất cả, Chờ tiếp nhận, Đang xử lý, Đã xử lý, Đã đóng).
- **Frontend Service:** `getCustomerSupportTickets(customerId, filters)` trong `supportService.js`.
- **API:** `GET /api/v1/support-requests?customerId=5&status=ALL`.
- **Controller:** `SupportRequestController.getCustomerTickets`.
- **Service:** `SupportRequestService.getCustomerTickets`: Truy vấn bảng `support_requests`, đính kèm thông tin task nhân viên đang xử lý mới nhất.
- **Database:** SELECT `support_requests` JOIN `facility_tasks`.

### 🟣 Luồng 7.3: Khách hàng gửi ticket hỗ trợ kỹ thuật / vận hành thông thường
- **UI:** Khách chọn HĐ, chọn loại sự cố (`SECURITY`, `FACILITY_DAMAGE`, `CLEANING`, `OTHER`), nhập mô tả (10–1000 ký tự) $\rightarrow$ Bấm **Gửi yêu cầu**.
- **Frontend Service:** `createSupportTicket(customerId, payload)` trong `supportService.js`.
- **API:** `POST /api/v1/support-requests?customerId=5` (Body: `{ contractId, issueType, description }`).
- **Controller:** `SupportRequestController.createTicket`.
- **Service:** `SupportRequestService.createTicket`: Kiểm tra quyền sở hữu hợp đồng; kiểm tra chống spam PR-S2 (tối đa 1 ticket mở/loại, 3 ticket mở/HĐ); tự sinh mã `SP-xxxxxx`, lưu ticket `OPEN`; sinh task `SUPPORT` trong `facility_tasks` cho cơ sở với hạn chót 21:00.
- **Database:** `INSERT INTO support_requests (...)` & `INSERT INTO facility_tasks (...)`.

### 🟣 Luồng 7.4: Khách hàng gửi ticket Sự cố khóa / Quên mã PIN
- **UI:** Khách chọn loại sự cố: **Sự cố khóa / Mã PIN (`LOCK_ISSUE`)** $\rightarrow$ Bấm **Gửi yêu cầu**.
- **Frontend Service:** `createSupportTicket(...)`.
- **API:** `POST /api/v1/support-requests?customerId=5` với `issueType: "LOCK_ISSUE"`.
- **Service:** Tương tự luồng 7.3 nhưng gắn cờ **khẩn cấp (`urgent = true`)**: Task `SUPPORT` sinh ra có hạn chót xử lý là **2 giờ** (`now.plusHours(2)`).

### 🟣 Luồng 7.5: Nhân viên cấp lại mã PIN 6 số cho khách (Ticket `LOCK_ISSUE`)
- **UI:** Trên `/staff/tasks/:id`, nhân viên bấm nút **`Cấp lại mã PIN`**.
- **Frontend Service:** `resetSupportContractPin(taskId, staffId)` trong `staffTaskService.js`.
- **API:** `POST /api/v1/staff-tasks/20/reset-pin?staffId=12`.
- **Controller:** `StaffTaskController.resetPin`.
- **Service:** `StaffTaskService.resetSupportContractPin`: Kiểm tra task `SUPPORT` và ticket `LOCK_ISSUE`; **kiểm tra hợp đồng không bị OVERDUE (PR-Q5, PR-S6)** (nếu khách đang nợ tiền thì cấm cấp lại PIN); sinh ngẫu nhiên 6 chữ số chưa bị dùng; cập nhật `access_pin_code` trong `rental_contracts`; gửi notification và email cho khách; ghi audit log.
- **Database:** `UPDATE rental_contracts SET access_pin_code = '592814' WHERE id = ...` & `INSERT INTO notifications (...)`.

### 🟣 Luồng 7.6: Nhân viên xử lý & Hoàn tất ticket thông thường
- **UI:** Nhân viên nhập kết quả xử lý vào ô text: *"Đã thay bóng đèn mới"* $\rightarrow$ Bấm **Hoàn tất xử lý**.
- **Frontend Service:** `resolveSupportTask(taskId, staffId, resolutionNote)` trong `staffTaskService.js`.
- **API:** `POST /api/v1/staff-tasks/20/resolve-support` (Body: `{ resolutionNote: "..." }`).
- **Controller:** `StaffTaskController.resolveSupport`.
- **Service:** `StaffTaskService.resolveSupportTask`: Cập nhật task `status = 'COMPLETED'`; cập nhật ticket liên kết `status = 'RESOLVED'`, `resolution_note = resolutionNote`, `resolved_at = now`; gửi thông báo cho khách hàng có 3 ngày để phản hồi.
- **Database:** `UPDATE facility_tasks SET status = 'COMPLETED' WHERE id = 20` & `UPDATE support_requests SET status = 'RESOLVED' WHERE id = ...`.

### 🟣 Luồng 7.7: Khách hàng hủy ticket khi còn ở trạng thái `OPEN`
- **UI:** Tại ticket đang `OPEN`, khách bấm **Hủy yêu cầu**.
- **Frontend Service:** `cancelSupportTicket(ticketId, customerId)` trong `supportService.js`.
- **API:** `POST /api/v1/support-requests/10/cancel?customerId=5`.
- **Controller:** `SupportRequestController.cancelTicket`.
- **Service:** `SupportRequestService.cancelTicket`: Cập nhật ticket `status = 'CLOSED'`; huỷ task liên kết trong `facility_tasks` sang `status = 'CANCELLED'`.
- **Database:** `UPDATE support_requests SET status = 'CLOSED' WHERE id = 10` & `UPDATE facility_tasks SET status = 'CANCELLED' WHERE support_request_id = 10`.

### 🟣 Luồng 7.8: Khách hàng xác nhận "Đã ổn" để đóng ticket
- **UI:** Tại ticket `RESOLVED`, khách bấm nút xanh **`Đã ổn (Đóng)`**.
- **Frontend Service:** `confirmSupportTicket(ticketId, customerId)` trong `supportService.js`.
- **API:** `POST /api/v1/support-requests/10/confirm?customerId=5`.
- **Controller:** `SupportRequestController.confirmTicket`.
- **Service:** Cập nhật ticket `status = 'CLOSED'`, `closed_at = now`.
- **Database:** `UPDATE support_requests SET status = 'CLOSED', closed_at = GETDATE() WHERE id = 10`.

### 🟣 Luồng 7.9: Khách hàng báo "Chưa xong" để mở lại ticket
- **UI:** Khách bấm **`Chưa xong (Mở lại)`**, nhập lý do *"Mã PIN mới vẫn không mở được"*.
- **Frontend Service:** `reopenSupportTicket(ticketId, customerId, reason)` trong `supportService.js`.
- **API:** `POST /api/v1/support-requests/10/reopen?customerId=5` (Body: `{ reason: "..." }`).
- **Controller:** `SupportRequestController.reopenTicket`.
- **Service:** `SupportRequestService.reopenTicket`: Ticket chuyển từ `RESOLVED` về lại `OPEN`; tự động sinh một task `SUPPORT` mới trong `facility_tasks` để nhân viên tiếp tục hỗ trợ.
- **Database:** `UPDATE support_requests SET status = 'OPEN' WHERE id = 10` & `INSERT INTO facility_tasks (...)`.

### 🟣 Luồng 7.10: Tự động đóng ticket sau 3 ngày không phản hồi
- **Cơ chế:** Cron job chạy định kỳ (hoặc demo bằng nút **Giả lập tự đóng ticket** gọi `simulateTicketAutoClose(ticketId)`).
- **API:** `POST /api/v1/dev/simulation/support-requests/10/auto-close`.
- **Service:** Quét các ticket có status `RESOLVED` mà `resolved_at` đã quá 3 ngày $\rightarrow$ Tự động chuyển sang `CLOSED`.

---

## 📌 Nhóm B: Nghiệp vụ Bồi thường Thiệt hại Hàng hóa (BR-126 $\rightarrow$ BR-128)

### 🟣 Luồng 7.11: Khách gửi yêu cầu bồi thường hàng hư hỏng / mất mát
- **UI:** Khách chọn loại sự cố: **Hàng bị hư hỏng (`GOODS_DAMAGE`)** hoặc **Mất hàng (`GOODS_LOSS`)**, nhập ngày phát hiện, danh sách hàng & giá trị, số tiền đề nghị, tải ảnh bằng chứng $\rightarrow$ Bấm **Gửi yêu cầu bồi thường**.
- **Frontend Service:** `createSupportTicket(...)`.
- **API:** `POST /api/v1/support-requests?customerId=5` (kèm các trường claim: `incidentDate`, `itemsDescription`, `claimedAmount`, `evidenceImages`).
- **Controller:** `SupportRequestController.createTicket`.
- **Service:** `CompensationClaimService.validateClaimInput`: Kiểm tra ngày sự cố trong hạn hợp đồng, số tiền $> 0$, bắt buộc có ít nhất 1 ảnh; tạo ticket `support_requests`; tạo hồ sơ bồi thường trong `compensation_claims` mã `CLM-xxxxxx` với status **`SUBMITTED`** (Chờ kiểm tra hiện trường); sinh task `SUPPORT` khẩn cho nhân viên.
- **Database:** `INSERT INTO support_requests (...)` & `INSERT INTO compensation_claims (...)` & `INSERT INTO facility_tasks (...)`.

### 🟣 Luồng 7.12: Nhân viên khảo sát hiện trường và lập biên bản
- **UI:** Nhân viên cùng khách mở ô kho, chụp ảnh hiện trường, chọn nguyên nhân sơ bộ $\rightarrow$ Bấm **Lưu biên bản kiểm tra**.
- **Frontend Service:** Gọi API resolve support kèm thông tin inspection trong `staffTaskService.js`.
- **Service:** `CompensationClaimService.recordInspection`: Task của nhân viên chuyển thành `COMPLETED`; hồ sơ `compensation_claims` cập nhật ảnh kiểm tra, ghi chú hiện trường và chuyển status sang **`INSPECTED`** (Chờ Quản lý thẩm định).
- **Database:** `UPDATE compensation_claims SET status = 'INSPECTED', inspection_note = '...', inspected_at = GETDATE() WHERE id = ...`.

### 🟣 Luồng 7.13: Quản lý FM xem chi tiết hồ sơ & Đối chiếu dữ liệu đa tầng
- **UI:** FM mở `/manager/claims/:id`.
- **Frontend Service:** `getClaimDetail(id)` trong `claimService.js` & `getSensorReadings(...)` trong `contractService.js`.
- **API:** `GET /api/v1/claims/8` & `GET /api/v1/contracts/18/sensor-readings?days=3&around=2026-11-10`.
- **Màn hình FM đối chiếu 3 nguồn dữ liệu:**
  1. Ảnh khách gửi ban đầu vs. Ảnh nhân viên chụp hiện trường.
  2. Biên bản nhận kho bàn giao ban đầu (`ContractHandoverSection`).
  3. **Biểu đồ cảm biến IoT (`SensorSparkline`):** Xem lịch sử nhiệt độ $\pm 3$ ngày quanh ngày sự cố để xác minh kho lạnh có từng bị vượt ngưỡng an toàn hay không.

### 🟣 Luồng 7.14: Quản lý FM xem trước bảng tính bồi thường (Quote Claim)
- **UI:** FM nhập bên chịu lỗi (`FACILITY`), giá trị thẩm định (`5.000.000đ`), tỷ lệ hư hại (`100%`), số ngày ô kho không dùng được (`3 ngày`) $\rightarrow$ Bấm **Xem trước bảng tính**.
- **Frontend Service:** `quoteClaim(id, payload)` trong `claimService.js`.
- **API:** `POST /api/v1/claims/8/quote`.
- **Controller:** `CompensationClaimController.quote`.
- **Service:** `CompensationClaimService.quote`: Tính toán tiền hàng theo trần bảo hiểm của hợp đồng; tính tiền hoàn tiền thuê theo số ngày gián đoạn; tính tổng tiền bồi thường trả về cho FM xem trước.

### 🟣 Luồng 7.15: Quản lý FM chốt quyết định thẩm định (Decide Claim)
- **UI:** FM bấm nút **`Chốt quyết định thẩm định`**.
- **Frontend Service:** `decideClaim(id, payload)` trong `claimService.js`.
- **API:** `POST /api/v1/claims/8/decide` (Body: `{ liableParty, assessedValue, damagePercent, unusableDays, resolution, decisionNote }`).
- **Controller:** `CompensationClaimController.decide`.
- **Service:** `CompensationClaimService.decide`: Nếu lỗi `FACILITY` $\rightarrow$ Chuyển hồ sơ sang **`APPROVED`** (Chờ chi trả); nếu lỗi do khách $\rightarrow$ Chuyển sang **`REJECTED`**; gửi notification kết quả cho khách.
- **Database:** `UPDATE compensation_claims SET status = 'APPROVED', assessed_value = ..., total_compensation = ..., decided_at = GETDATE() WHERE id = 8`.

### 🟣 Luồng 7.16: Quản lý FM chi trả tiền bồi thường cho khách (Pay Claim)
- **UI:** FM chuyển khoản ngoài thực tế $\rightarrow$ Nhập mã giao dịch ngân hàng `FT261114889`, tải ảnh ủy nhiệm chi $\rightarrow$ Bấm **`Xác nhận đã chi trả`**.
- **Frontend Service:** `payClaim(id, payload)` trong `claimService.js`.
- **API:** `POST /api/v1/claims/8/pay` (Body: `{ paymentMethod: "BANK_TRANSFER", bankTransactionCode, paymentEvidence }`).
- **Controller:** `CompensationClaimController.pay`.
- **Service:** `CompensationClaimService.pay`: Cập nhật hồ sơ sang **`PAID`**; lưu giao dịch `COMPENSATION` trạng thái `SUCCESS` vào bảng `payment_transactions`; đóng ticket `support_requests`; nếu hợp đồng có mua bảo hiểm thì tự động kích hoạt luồng đòi tiền bảo hiểm (`insurance_status = 'SUBMITTED'`).
- **Database:** `UPDATE compensation_claims SET status = 'PAID', bank_transaction_code = '...' WHERE id = 8` & `INSERT INTO payment_transactions (...)` & `UPDATE support_requests SET status = 'CLOSED' WHERE id = ...`.

### 🟣 Luồng 7.17: Đối tác bảo hiểm chi trả bồi hoàn cho cơ sở
- **Cơ chế:** Nút giả lập **"Bảo hiểm duyệt & chi trả"** (`simulateInsurancePayout(claimId)`).
- **API:** `POST /api/v1/dev/simulation/claims/8/insurance-payout`.
- **Service:** Mô phỏng webhook/phản hồi từ công ty bảo hiểm đối tác: Cập nhật `insurance_status = 'PAID'`, ghi nhận số tiền bảo hiểm bồi hoàn lại vào quỹ của QueenKho.
- **Database:** `UPDATE compensation_claims SET insurance_status = 'PAID', insurance_amount = ... WHERE id = 8`.
