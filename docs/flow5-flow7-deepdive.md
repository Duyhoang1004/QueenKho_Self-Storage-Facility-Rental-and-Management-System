# CẨM NANG CHI TIẾT TỪ FRONTEND ĐẾN DATABASE: FLOW 5 & FLOW 7

> **Dành riêng cho kỳ bảo vệ đồ án tốt nghiệp SWP391 — Hệ thống QueenKho**  
> Tài liệu phân tích đến từng nút bấm trên màn hình, từng hàm frontend, từng endpoint REST API, controller, service xử lý nghiệp vụ, câu lệnh JPA / SQL và thay đổi bảng dữ liệu.

---

## 🧭 MỤC LỤC
1. [GIẢI MÃ CÂU HỎI HỘI ĐỒNG: TẠI SAO ĐẶT TÊN API LÀ `/unit-types`?](#1-giải-mã-câu-hỏi-hội-đồng-tại-sao-đặt-tên-api-là-unit-types)
2. [FLOW 5: QUẢN LÝ Ô KHO & ĐIỀU PHỐI NỘI BỘ (FACILITY MANAGER)](#2-flow-5-quản-lý-ô-kho--điều-phối-nội-bộ-facility-manager)
   - [2.1 Màn hình 1: Quản lý danh mục ô kho & Sơ đồ mặt bằng Grid (`/manager/units`)](#21-màn-hình-1-quản-lý-danh-mục-ô-kho--sơ-đồ-mặt-bằng-grid-managerunits)
   - [2.2 Màn hình 2: Bảng công việc cơ sở & Điều phối giao việc (`/manager/tasks`)](#22-màn-hình-2-bảng-công-việc-cơ-sở--điều-phối-giao-việc-managertasks)
3. [FLOW 7: HỖ TRỢ KHÁCH HÀNG & BỒI THƯỜNG BẢO HIỂM](#3-flow-7-hỗ-trợ-khách-hàng--bồi-thường-bảo-hiểm)
   - [3.1 Màn hình 1: Khách hàng gửi và quản lý yêu cầu hỗ trợ (`/ho-tro`)](#31-màn-hình-1-khách-hàng-gửi-và-quản-lý-yêu-cầu-hỗ-trợ-ho-tro)
   - [3.2 Màn hình 2: Nhân viên tiếp nhận & xử lý ticket tại task detail (`/staff/tasks/:id`)](#32-màn-hình-2-nhân-viên-tiếp-nhận--xử-lý-ticket-tại-task-detail-stafftasksid)
   - [3.3 Màn hình 3: Quản lý thẩm định & chi trả hồ sơ bồi thường (`/manager/claims`)](#33-màn-hình-3-quản-lý-thẩm-định--chi-trả-hồ-sơ-bồi-thường-managerclaims)
4. [BẢNG TỔNG HỢP MÃ LỖI (EXCEPTION CODES) CỦA 2 FLOW](#4-bảng-tổng-hợp-mã-lỗi-exception-codes-của-2-flow)

---

# 1. GIẢI MÃ CÂU HỎI HỘI ĐỒNG: TẠI SAO ĐẶT TÊN API LÀ `/unit-types`?

### Câu hỏi thực tế của Giảng viên:
> *"API `/unit-types` đó là ở đâu, về đâu và lý do tại sao lại đặt là `/unit-types` chứ không phải là `/unit_types` hay là `/unittypes`...?"*

### Cách trả lời chuẩn điểm 10 trước Hội đồng:
1. **API `/unit-types` ở đâu, về đâu?**
   - **Frontend:** Được gọi từ `frontend/src/services/facilityService.js` (hàm `getAllUnitTypes()`) và `unitTypeService.js`. Sử dụng trên các trang: `StorageManagementPage.jsx` (lọc loại kho và dropdown thêm kho mới), `SearchLandingPage.jsx`, `CreateReservationPage.jsx` và trang quản trị BOM `BomUnitTypesPage.jsx`.
   - **Backend Controller:** Nằm tại [`UnitTypeController.java`](file:///d:/Semester%205/SWP391/QueenKho_Self-Storage-Facility-Rental-and-Management-System/backend/api/src/main/java/com/queenkho/api/controller/UnitTypeController.java) mapping `@RequestMapping("/api/v1/unit-types")`.
   - **Backend Service:** Gọi vào `UnitTypeService.java` truy vấn từ `UnitTypeRepository` lấy danh sách từ bảng `unit_types` trong database `QueenKhoDB`.

2. **Tại sao đặt là `/unit-types` (kebab-case, số nhiều)?**
   - **Thứ nhất - Chuẩn danh từ số nhiều (Plural Nouns):** Theo chuẩn thiết kế **RESTful API Resource Naming Guidelines**, URI định danh một tài nguyên (Resource) hoặc một tập hợp tài nguyên (Collection). Vì API này đại diện cho tập hợp danh mục các loại kho, nên bắt buộc dùng danh từ số nhiều (`unit-types`) thay vì động từ (`/getUnitTypes`) hay số ít (`/unit-type`).
   - **Thứ hai - Tại sao dùng Kebab-case (`unit-types`) thay vì Snake_case (`unit_types`)?**
     - Theo tài liệu chuẩn **RFC 3986 (URI Generic Syntax)** và **Google Cloud API Design Guide**, đường dẫn URI chuẩn luôn khuyến nghị sử dụng **kebab-case (dấu gạch nối ngang `-`)**.
     - Dấu gạch dưới `_` khi hiển thị trên trình duyệt hoặc tài liệu hyperlink thường bị đường gạch chân (`underline`) che khuất hoàn toàn, gây khó đọc hoặc nhầm lẫn thành khoảng trắng.
     - Các bộ parser URL và công cụ tìm kiếm chuẩn coi dấu gạch ngang `-` là dấu phân tách từ (word separator), trong khi `_` bị gộp chung thành một từ.
   - **Thứ ba - Tại sao không viết liền `unittypes`?**
     - Viết liền `unittypes` làm dính hai từ tiếng Anh độc lập (`unit` và `types`), vi phạm nguyên tắc **Readability (Tính dễ đọc)** của chuẩn Clean Code và RESTful URI.
   - **Thứ tư - Tính nhất quán toàn hệ thống (Consistency):**
     - Toàn bộ backend QueenKho đều tuân thủ chuẩn kebab-case cho danh từ số nhiều: `/storage-units`, `/staff-tasks`, `/support-requests`, `/insurance-plans`, `/compensation-claims`, `/unit-transfers`.

---

# 2. FLOW 5: QUẢN LÝ Ô KHO & ĐIỀU PHỐI NỘI BỘ (FACILITY MANAGER)

## 2.1 Màn hình 1: Quản lý danh mục ô kho & Sơ đồ mặt bằng Grid (`/manager/units`)
* **File Frontend:** [`StorageManagementPage.jsx`](file:///d:/Semester%205/SWP391/QueenKho_Self-Storage-Facility-Rental-and-Management-System/frontend/src/pages/manager/StorageManagementPage.jsx)
* **Frontend Service:** [`storageUnitService.js`](file:///d:/Semester%205/SWP391/QueenKho_Self-Storage-Facility-Rental-and-Management-System/frontend/src/services/storageUnitService.js)
* **Backend Controller:** [`StorageUnitController.java`](file:///d:/Semester%205/SWP391/QueenKho_Self-Storage-Facility-Rental-and-Management-System/backend/api/src/main/java/com/queenkho/api/controller/StorageUnitController.java) & [`FloorPlanController.java`](file:///d:/Semester%205/SWP391/QueenKho_Self-Storage-Facility-Rental-and-Management-System/backend/api/src/main/java/com/queenkho/api/controller/FloorPlanController.java)
* **Backend Service:** [`StorageUnitService.java`](file:///d:/Semester%205/SWP391/QueenKho_Self-Storage-Facility-Rental-and-Management-System/backend/api/src/main/java/com/queenkho/api/service/StorageUnitService.java) & [`FloorPlanService.java`](file:///d:/Semester%205/SWP391/QueenKho_Self-Storage-Facility-Rental-and-Management-System/backend/api/src/main/java/com/queenkho/api/service/FloorPlanService.java)

### Hành động 1: Tải dữ liệu trang & Thống kê KPI cơ sở
* **Thao tác UI:** Người dùng (FM) mở trang `/manager/units` hoặc bấm nút **LÀM MỚI**.
* **Frontend:** Gọi `getStorageUnits(params)` và `getFacilityLayout(facilityId)`.
* **API Request:**
  - `GET /api/v1/storage-units?facilityId=1&status=ALL&floor=ALL`
  - Header: `X-Facility-Id: 1`, `X-User-Id: 2` (hoặc lấy từ token JWT qua `CurrentUserProvider`).
* **Backend Controller:** `StorageUnitController.getStorageUnits(...)`
* **Backend Service Logic (`StorageUnitService.getStorageUnits`):**
  1. Kiểm tra tồn tại cơ sở qua `facilityRepository.findById(facilityId)`.
  2. Lấy toàn bộ ô kho của cơ sở: `storageUnitRepository.findByFacility_Id(facilityId)`.
  3. Lấy ngày giải phóng dự kiến của các ô sắp trả: `renewalPolicyService.releaseDatesByUnit(facilityId)`.
  4. Lấy danh sách hợp đồng đang chiếm dụng: `rentalContractRepository.findAllByFacilityId(facilityId)`.
  5. Đọc lịch đặt trước: `unitScheduleService.bookingsByUnit(facilityId)`.
  6. **Tính toán bộ chỉ số KPI Realtime:**
     - `totalUnits` = tổng số ô.
     - `availableUnits` = số ô có status `AVAILABLE`.
     - `occupiedUnits` = số ô có status `OCCUPIED`.
     - `maintenanceUnits` = số ô có status `MAINTENANCE`.
     - `overdueUnits` = số ô có hợp đồng quá hạn (`OVERDUE`).
     - `releasingUnits` = số ô sắp trống (`releaseDate != null`).
     - `occupancyRate` = $(Occupied / (Total - Maintenance)) \times 100\%$.
* **Database tác động:** Chỉ đọc (SELECT) các bảng: `storage_units`, `rental_contracts`, `facilities`, `unit_types`.

---

### Hành động 2: Thêm ô kho mới vào hệ thống (+ đặt vị trí mặt bằng)
* **Thao tác UI:**
  1. Bấm nút màu xanh **`+ THÊM Ô KHO MỚI`**.
  2. Modal hiển thị: Chọn loại kho (`unitTypeId`), chọn Tầng (`floor`), Khu (`zone`, vd: `A`), Số phòng (`roomNumber`, vd: `101`), chọn vị trí trên lưới mặt bằng (nếu tầng có mặt bằng). Có thể tick chọn *"Đặt làm ô kho khẩn cấp (BR-140)"*.
  3. Bấm **Xác nhận tạo**.
* **Frontend:** Hàm `handleCreateUnit` gọi `createStorageUnit(data, facilityId, actorUserId)` trong `storageUnitService.js`.
* **API Request:**
  - `POST /api/v1/storage-units?facilityId=1`
  - Body (JSON):
    ```json
    {
      "unitTypeId": 1,
      "floor": "Tầng 1",
      "zone": "A",
      "roomNumber": "101",
      "emergency": false,
      "mapX": 4, "mapY": 6, "mapW": 4, "mapH": 4, "mapDoor": "BOTTOM"
    }
    ```
* **Backend Controller:** `StorageUnitController.createStorageUnit(...)`
* **Backend Service Logic (`StorageUnitService.createStorageUnit`):**
  1. Kiểm tra loại kho có đang `INACTIVE` không? Nếu `INACTIVE` $\rightarrow$ Ném `FacilityException(400, "UNIT_TYPE_INACTIVE")`.
  2. Chuẩn hóa số phòng thành 3 chữ số: `"4"` $\rightarrow$ `"004"`, `"101"` $\rightarrow$ `"101"`.
  3. **Tự động sinh mã ô kho vật lý:** `unitId = "KV-" + facility.getCode() + "-" + zone + cleanRoom` (vd: `KV-TB-A101`).
  4. Kiểm tra trùng mã: `storageUnitRepository.existsById(unitId)` $\rightarrow$ Trùng thì ném `FacilityException(409, "DUPLICATE_UNIT_CODE")`.
  5. Nếu có toạ độ `mapX`, gọi `floorPlanService.validateNewUnitPlacement(...)` kiểm tra ô mới có bị chồng lấn lên ô khác hoặc đè lên vật cản (lối đi, thang máy, cửa thoát hiểm) không.
  6. Lưu vào DB: Status mặc định là `AVAILABLE` (hoặc `EMERGENCY` nếu tick khẩn cấp).
  7. Ghi nhật ký kiểm toán hệ thống qua `activityLogService.log(...)` với mã `[UNIT_CREATE]`.
* **Database tác động:**
  - `INSERT INTO storage_units (id, facility_id, unit_type_id, floor, zone, room_number, status, is_emergency, map_x, map_y, map_w, map_h, map_door)`
  - `INSERT INTO activity_logs (user_id, action, target_table, target_id, created_at)`

---

### Hành động 3: Khóa bảo trì ô kho (`AVAILABLE` $\rightarrow$ `MAINTENANCE`)
* **Thao tác UI:**
  1. Tại một ô kho đang trống (`AVAILABLE`), bấm nút **Khóa bảo trì**.
  2. Modal bật lên yêu cầu nhập lý do bảo trì (tối thiểu 10 ký tự, tối đa 500 ký tự).
  3. Bấm **Xác nhận khóa bảo trì**.
* **Frontend:** Hàm `handleConfirmStatusChange` gọi `updateStorageUnitStatus(id, 'MAINTENANCE', note, actorUserId)`.
* **API Request:**
  - `PATCH /api/v1/storage-units/KV-TB-A101/status`
  - Body: `{ "status": "MAINTENANCE", "note": "Hỏng khóa cửa cuốn và dột góc tường" }`
* **Backend Controller:** `StorageUnitController.updateStorageUnitStatus(...)`
* **Backend Service Logic (`StorageUnitService.updateStorageUnitStatus`):**
  1. Lấy thông tin ô: `storageUnitRepository.findById(id)`.
  2. **Kiểm tra an toàn:** Nếu ô đang `OCCUPIED` (có khách thuê) $\rightarrow$ Ném lỗi `FacilityException(409, "UNIT_IN_USE")` (Cấm FM tự ý khóa ô đang có khách!).
  3. Kiểm tra độ dài ghi chú lý do: bắt buộc từ 10 đến 500 ký tự.
  4. **Quy tắc vàng BR-11 & PR-M10 (Chống âm suất cọc):**
     - Khi chuyển `AVAILABLE` $\rightarrow$ `MAINTENANCE`, số ô khả dụng của loại kho đó giảm đi 1.
     - Hàm `checkSlotAvailabilityBeforeReduction(...)` tính:  
       $\text{Suất còn lại} = (\text{Số ô AVAILABLE}) - (\text{Đơn PENDING}) - (\text{Đơn DEPOSIT\_PAID})$.
     - Nếu $\text{Suất còn lại} - 1 < 0 \rightarrow$ Ném ngay `FacilityException(409, "SLOT_IN_USE")` vì đang có khách đã cọc chờ gán ô mà cơ sở dám khóa ô làm thiếu phòng!
  5. Cập nhật `unit.setStatus("MAINTENANCE")`, `unit.setMaintenanceNote(note)`, `unit.setMaintenanceSince(LocalDateTime.now())`.
  6. **BR-141:** Nếu ô này đã được gán trước cho khách sắp nhận kho (`upcomingContracts`), hệ thống tự động bắn chuông thông báo (`notificationService.notifyCustomer`) báo khách ô gặp sự cố để hỗ trợ đổi ô hoặc dời ngày!
* **Database tác động:**
  - `UPDATE storage_units SET status = 'MAINTENANCE', maintenance_note = '...', maintenance_since = GETDATE() WHERE id = 'KV-TB-A101'`
  - `INSERT INTO activity_logs (...)`

---

### Hành động 4: Mở lại kho bảo trì (`MAINTENANCE` $\rightarrow$ `AVAILABLE`)
* **Thao tác UI:** Tại ô màu vàng `MAINTENANCE`, bấm **Mở lại kho** $\rightarrow$ Bấm xác nhận.
* **API Request:** `PATCH /api/v1/storage-units/KV-TB-A101/status` với body `{ "status": "AVAILABLE", "note": "" }`
* **Backend Service Logic:**
  1. Đổi status thành `AVAILABLE` (hoặc `EMERGENCY` nếu là ô khẩn cấp). Xóa `maintenanceNote` và `maintenanceSince`.
  2. **PR-O10:** Tự động tìm task bảo trì đang mở của ô này trong bảng `facility_tasks` và đóng luôn task đó (`staffTaskService.closeOpenMaintenanceForUnit(...)`).
  3. Ghi log `[UNIT_STATUS]`.
* **Database tác động:**
  - `UPDATE storage_units SET status = 'AVAILABLE', maintenance_note = NULL, maintenance_since = NULL WHERE id = '...'`
  - `UPDATE facility_tasks SET status = 'COMPLETED', completed_at = GETDATE() WHERE storage_unit_id = '...' AND task_type = 'MAINTENANCE'`

---

### Hành động 5: Xóa ô kho vật lý (DELETE)
* **Thao tác UI:** Bấm icon thùng rác màu đỏ trên dòng ô kho $\rightarrow$ Xác nhận xóa.
* **API Request:** `DELETE /api/v1/storage-units/KV-TB-A101`
* **Backend Service Logic (`StorageUnitService.deleteStorageUnit`):**
  1. Kiểm tra: `rentalContractRepository.existsByStorageUnit_Id(id)`. Nếu ô này **đã từng phát sinh bất kỳ hợp đồng nào trong lịch sử** $\rightarrow$ Ném ngay `FacilityException(409, "UNIT_HAS_CONTRACT_HISTORY")`. Ràng buộc dữ liệu tài chính không được phép xóa!
  2. Kiểm tra quy tắc chống âm suất cọc BR-11.
  3. `storageUnitRepository.delete(unit)`.
* **Database tác động:** `DELETE FROM storage_units WHERE id = 'KV-TB-A101'`.

---

## 2.2 Màn hình 2: Bảng công việc cơ sở & Điều phối giao việc (`/manager/tasks`)
* **File Frontend:** [`ManagerTaskBoardPage.jsx`](file:///d:/Semester%205/SWP391/QueenKho_Self-Storage-Facility-Rental-and-Management-System/frontend/src/pages/manager/ManagerTaskBoardPage.jsx)
* **Frontend Service:** [`staffTaskService.js`](file:///d:/Semester%205/SWP391/QueenKho_Self-Storage-Facility-Rental-and-Management-System/frontend/src/services/staffTaskService.js)
* **Backend Controller:** [`StaffTaskController.java`](file:///d:/Semester%205/SWP391/QueenKho_Self-Storage-Facility-Rental-and-Management-System/backend/api/src/main/java/com/queenkho/api/controller/StaffTaskController.java)
* **Backend Service:** [`StaffTaskService.java`](file:///d:/Semester%205/SWP391/QueenKho_Self-Storage-Facility-Rental-and-Management-System/backend/api/src/main/java/com/queenkho/api/service/StaffTaskService.java)

### Hành động 1: FM giao việc cho nhân viên cơ sở (Assign Task)
* **Thao tác UI:**
  1. Tại một task đang ở trạng thái `OPEN` (hoặc đang `IN_PROGRESS` muốn đổi người), cột Người phụ trách có dropdown chọn nhân viên.
  2. Chọn tên một nhân viên trong cơ sở (vd: `Nguyễn Văn Staff 1`).
  3. Bấm **Giao việc** (hoặc **Đổi người**).
* **Frontend:** Gọi `assignStaffTask(taskId, staffId)` trong `staffTaskService.js`.
* **API Request:**
  - `POST /api/v1/staff-tasks/15/assign?staffId=12`
  - Header: Token của Quản lý cơ sở (`managerId = currentUser.require().id()`).
* **Backend Controller:** `StaffTaskController.assign(@PathVariable Integer id, @RequestParam Integer staffId)`
* **Backend Service Logic (`StaffTaskService.assignTask`):**
  1. Xác thực người thao tác phải có role `FACILITY_MANAGER`.
  2. Task phải thuộc cơ sở mà FM đang quản lý (`findTaskInFacility`).
  3. **Kiểm tra loại task hợp lệ:** Chỉ các task `CHECK_IN`, `CHECK_OUT`, `SUPPORT`, `MAINTENANCE` mới được giao cho Staff. Riêng task `REFUND` (Hoàn tiền) là trách nhiệm tài chính của Quản lý, hệ thống chặn không cho giao cho nhân viên (`TASK_NOT_ASSIGNABLE`).
  4. Kiểm tra tài khoản nhân viên được giao: Phải có role `STAFF`, cùng `facility_id` với FM, và trạng thái tài khoản phải là `ACTIVE`.
  5. **Quy tắc PR-T1 (Khung 30 ngày):** Với task `CHECK_IN` và `CHECK_OUT`, chỉ được phép giao việc trong vòng 30 ngày trước ngày hẹn (`appointmentDate`). Nếu khách đặt trước 2 tháng thì task chưa mở khung giao việc.
  6. Thực hiện update: `staffTaskRepository.assign(taskId, staff, LocalDateTime.now())`:
     - Task chuyển status sang `IN_PROGRESS`.
     - Cột `staff_id` cập nhật thành ID của nhân viên.
     - Cột `claimed_at` cập nhật thời điểm giao.
  7. Nếu đây là task loại `SUPPORT`, cập nhật luôn trạng thái ticket hỗ trợ liên kết trong bảng `support_requests` từ `OPEN` $\rightarrow$ `IN_PROGRESS`.
  8. Gửi thông báo Notification thời gian thực cho nhân viên được giao: *"Bạn vừa được phân công task mới!"*.
  9. Ghi audit log `[TASK_ASSIGN]`.
* **Database tác động:**
  - `UPDATE facility_tasks SET staff_id = 12, status = 'IN_PROGRESS', claimed_at = GETDATE() WHERE id = 15`
  - `UPDATE support_requests SET status = 'IN_PROGRESS' WHERE id = (SELECT support_request_id FROM facility_tasks WHERE id = 15)`
  - `INSERT INTO notifications (...)`
  - `INSERT INTO activity_logs (...)`

---

### Hành động 2: FM gỡ người nhận (Unassign Task)
* **Thao tác UI:** Bấm nút **Gỡ người nhận** cạnh tên nhân viên đang làm task.
* **API Request:** `POST /api/v1/staff-tasks/15/unassign`
* **Backend Service Logic (`StaffTaskService.unassignTask`):**
  1. Task phải thuộc cơ sở của FM.
  2. Task đang `OVERDUE` hoặc đã đóng thì không được gỡ.
  3. Cập nhật task: `staff_id = NULL`, `claimed_at = NULL`, `status = 'OPEN'`.
  4. Nếu là task `SUPPORT`, ticket trong `support_requests` chuyển ngược về `OPEN`.
  5. Bắn notification cho nhân viên cũ: *"Bạn đã được gỡ khỏi task #15"*.
* **Database tác động:** `UPDATE facility_tasks SET staff_id = NULL, claimed_at = NULL, status = 'OPEN' WHERE id = 15`.

---

### Hành động 3: FM gia hạn task quá hạn (Extend Task)
* **Thao tác UI:** Khi task `SUPPORT` hoặc `MAINTENANCE` bị quá hạn (`OVERDUE`), nút màu cam **Gia hạn xử lý** hiện lên. FM nhập ngày hết hạn mới và lý do gia hạn (tối đa +7 ngày).
* **API Request:** `POST /api/v1/staff-tasks/15/extend` với body: `{ "newDueDate": "2026-11-20", "reason": "Chờ linh kiện khóa nhập về" }`.
* **Backend Service Logic (`StaffTaskService.extendOverdueTask`):**
  1. Hạn mới không được quá 7 ngày so với ngày hiện tại.
  2. Cập nhật `due_at` thành 21:00 của ngày mới.
  3. Status task chuyển từ `OVERDUE` về lại `IN_PROGRESS` (nếu đã có người nhận) hoặc `OPEN`.
* **Database tác động:** `UPDATE facility_tasks SET due_at = '2026-11-20 21:00:00', status = 'IN_PROGRESS' WHERE id = 15`.

---

# 3. FLOW 7: HỖ TRỢ KHÁCH HÀNG & BỒI THƯỜNG BẢO HIỂM

Flow 7 là luồng khép kín liên thông giữa **3 Actor**:  
`Khách hàng (Tạo ticket / Yêu cầu bồi thường)` $\rightarrow$ `Nhân viên (Khảo sát hiện trường / Đổi PIN / Giải quyết)` $\rightarrow$ `Quản lý FM (Thẩm định lỗi, chốt tiền bồi thường, chi trả ngân hàng)`.

---

## 3.1 Màn hình 1: Khách hàng gửi và quản lý yêu cầu hỗ trợ (`/ho-tro`)
* **File Frontend:** [`CustomerSupportPage.jsx`](file:///d:/Semester%205/SWP391/QueenKho_Self-Storage-Facility-Rental-and-Management-System/frontend/src/pages/support/CustomerSupportPage.jsx)
* **Frontend Service:** [`supportService.js`](file:///d:/Semester%205/SWP391/QueenKho_Self-Storage-Facility-Rental-and-Management-System/frontend/src/services/supportService.js)
* **Backend Controller:** [`SupportRequestController.java`](file:///d:/Semester%205/SWP391/QueenKho_Self-Storage-Facility-Rental-and-Management-System/backend/api/src/main/java/com/queenkho/api/controller/SupportRequestController.java)
* **Backend Service:** [`SupportRequestService.java`](file:///d:/Semester%205/SWP391/QueenKho_Self-Storage-Facility-Rental-and-Management-System/backend/api/src/main/java/com/queenkho/api/service/SupportRequestService.java) & [`CompensationClaimService.java`](file:///d:/Semester%205/SWP391/QueenKho_Self-Storage-Facility-Rental-and-Management-System/backend/api/src/main/java/com/queenkho/api/service/CompensationClaimService.java)

### Hành động 1: Mở form tạo ticket & Tải danh sách hợp đồng hợp lệ
* **Thao tác UI:** Khách vào trang `/ho-tro` $\rightarrow$ Bấm nút xanh **`+ GỬI YÊU CẦU HỖ TRỢ`**.
* **Frontend:** Gọi `getEligibleSupportContracts(customerId)`.
* **API Request:** `GET /api/v1/support-requests/eligible-contracts?customerId=5`
* **Backend Service Logic (`SupportRequestService.getEligibleContracts`):**
  1. Tìm các hợp đồng của khách: `rentalContractRepository.findAllByCustomerId(customerId)`.
  2. **Điều kiện lọc (PR-51):** Chỉ hợp đồng có trạng thái `ACTIVE`, `OVERDUE` hoặc `TERMINATION_PENDING` mới được gửi yêu cầu hỗ trợ. Hợp đồng đã thanh lý (`LIQUIDATED`) hoặc đã hủy cọc thì không được gửi.
  3. Đếm số ticket đang mở trên từng hợp đồng để cảnh báo khách nếu chạm giới hạn.

---

### Hành động 2: Gửi Ticket hỗ trợ thông thường (vd: Sự cố khóa / Quên mã PIN)
* **Thao tác UI:**
  1. Chọn Hợp đồng trong dropdown.
  2. Chọn Loại sự cố: **Sự cố khóa / Mã PIN (`LOCK_ISSUE`)** (hoặc `SECURITY`, `FACILITY_DAMAGE`, `CLEANING`, `OTHER`).
  3. Nhập mô tả sự cố: *"Tôi bị quên mã PIN mở khoang A101, thử nhiều lần không được."* (10 – 1000 ký tự).
  4. Bấm nút **Gửi yêu cầu**.
* **Frontend:** Gọi `createSupportTicket(customerId, payload)`.
* **API Request:**
  - `POST /api/v1/support-requests?customerId=5`
  - Body (JSON):
    ```json
    {
      "contractId": 18,
      "issueType": "LOCK_ISSUE",
      "description": "Tôi bị quên mã PIN mở khoang A101, thử nhiều lần không được."
    }
    ```
* **Backend Controller:** `SupportRequestController.createTicket(...)`
* **Backend Service Logic (`SupportRequestService.createTicket`):**
  1. Xác thực hợp đồng thuộc quyền sở hữu của khách hàng (`customer.getId().equals(contract.getCustomer().getId())`).
  2. **Quy tắc chống spam PR-S2:**
     - Mỗi hợp đồng chỉ được mở **tối đa 1 ticket chưa đóng cho mỗi loại sự cố** (nếu đang có 1 ticket `LOCK_ISSUE` chưa giải quyết thì chặn không cho tạo thêm ticket cùng loại).
     - Mỗi hợp đồng chỉ được có **tối đa 3 ticket chưa đóng** cùng lúc.
  3. Sinh mã ticket ngẫu nhiên: `ticketCode = "SP-" + 6 chữ số` (vd: `SP-749102`).
  4. Lưu ticket vào bảng `support_requests` với status `OPEN`.
  5. **Tự động sinh Task công việc cho cơ sở:**
     - Gọi `staffTaskRepository.save(...)` tạo một dòng mới trong bảng `facility_tasks`.
     - `task_type = 'SUPPORT'`.
     - `facility_id` = cơ sở của ô kho thuộc hợp đồng.
     - `status = 'OPEN'`.
     - `due_at`: Nếu là loại khẩn cấp (`LOCK_ISSUE`, `SECURITY`) $\rightarrow$ Hạn chót xử lý là **2 giờ** kể từ lúc tạo (`now.plusHours(2)`). Nếu là loại thường $\rightarrow$ Hạn chót là 21:00 hôm nay hoặc ngày mai.
  6. Ghi log `[SUPPORT_CREATE]`.
* **Database tác động:**
  - `INSERT INTO support_requests (ticket_code, contract_id, customer_id, issue_type, description, status, created_at)`
  - `INSERT INTO facility_tasks (facility_id, contract_id, support_request_id, task_type, status, due_at, note, created_at)`
  - `INSERT INTO activity_logs (...)`

---

### Hành động 3: Gửi Ticket Bồi Thường Hàng Hóa (BR-126: `GOODS_DAMAGE` / `GOODS_LOSS`)
* **Thao tác UI:**
  1. Khách chọn loại sự cố: **Hàng bị hư hỏng (`GOODS_DAMAGE`)** hoặc **Mất hàng (`GOODS_LOSS`)**.
  2. Màn hình tự động mở thêm các trường bồi thường:
     - Ngày xảy ra sự cố (`incidentDate`).
     - Danh sách hàng bị ảnh hưởng & giá trị (`itemsDescription`, 10–2000 ký tự).
     - Số tiền đề nghị bồi thường (`claimedAmount`, vd: `5.000.000đ`).
     - Tải lên ảnh bằng chứng hiện trường hàng hư hỏng (`evidenceImages`, tối đa 10 ảnh).
  3. Bấm **Gửi yêu cầu bồi thường**.
* **Backend Service Logic (`CompensationClaimService.validateClaimInput` & `createForTicket`):**
  1. Kiểm tra ngày sự cố: Phải nằm trong khoảng thời gian hiệu lực của hợp đồng (`startDate` đến hôm nay).
  2. Số tiền yêu cầu phải $> 0$ và $\le 10$ tỷ đồng.
  3. Bắt buộc có ít nhất 1 ảnh chụp bằng chứng đối với `GOODS_DAMAGE`.
  4. Sau khi lưu `support_requests`, gọi `compensationClaimService.createForTicket(...)`:
     - Tự động sinh mã hồ sơ: `claimCode = "CLM-" + 6 số` (vd: `CLM-183920`).
     - Tạo bản ghi trong bảng `compensation_claims` với trạng thái ban đầu là **`SUBMITTED`** (Chờ kiểm tra hiện trường).
     - Lưu thông tin gói bảo hiểm của hợp đồng để xác định hạn mức trần bồi thường tối đa (`coverageCap`).
  5. Sinh task `SUPPORT` gắn cờ khẩn cấp (`urgent = true`) để nhân viên cơ sở tới mở kho kiểm tra cùng khách.
* **Database tác động:**
  - `INSERT INTO support_requests (...)`
  - `INSERT INTO compensation_claims (claim_code, support_request_id, contract_id, customer_id, facility_id, claim_type, incident_date, items_description, claimed_amount, customer_images, status, created_at)`
  - `INSERT INTO facility_tasks (...)`

---

### Hành động 4: Khách đóng ticket ("Đã ổn") hoặc mở lại ("Chưa xong")
* **Trường hợp A: Khách bấm "Đã ổn (Đóng)"**
  - **API:** `POST /api/v1/support-requests/10/confirm?customerId=5`
  - **Service:** Cập nhật ticket `status = 'CLOSED'`, `closed_at = now`.
* **Trường hợp B: Khách bấm "Chưa xong (Mở lại)"**
  - **API:** `POST /api/v1/support-requests/10/reopen?customerId=5` với body `{ "reason": "Mã PIN mới vẫn không mở được cửa" }`.
  - **Service:**
    - Ticket chuyển từ `RESOLVED` $\rightarrow$ `OPEN`.
    - Sinh một task `SUPPORT` mới trong `facility_tasks` để nhân viên tiếp tục xử lý.

---

## 3.2 Màn hình 2: Nhân viên tiếp nhận & xử lý ticket tại task detail (`/staff/tasks/:id`)
* **File Frontend:** [`StaffTaskDetailPage.jsx`](file:///d:/Semester%205/SWP391/QueenKho_Self-Storage-Facility-Rental-and-Management-System/frontend/src/pages/staff/StaffTaskDetailPage.jsx)
* **Frontend Service:** [`staffTaskService.js`](file:///d:/Semester%205/SWP391/QueenKho_Self-Storage-Facility-Rental-and-Management-System/frontend/src/services/staffTaskService.js)
* **Backend Controller:** [`StaffTaskController.java`](file:///d:/Semester%205/SWP391/QueenKho_Self-Storage-Facility-Rental-and-Management-System/backend/api/src/main/java/com/queenkho/api/controller/StaffTaskController.java)
* **Backend Service:** [`StaffTaskService.java`](file:///d:/Semester%205/SWP391/QueenKho_Self-Storage-Facility-Rental-and-Management-System/backend/api/src/main/java/com/queenkho/api/service/StaffTaskService.java)

### Nghiệp vụ 1: Cấp lại mã PIN 6 số cho khách (Đối với ticket `LOCK_ISSUE`)
* **Thao tác UI:**
  1. Nhân viên mở chi tiết task `SUPPORT` có `issueType = LOCK_ISSUE`.
  2. Tại khung Hỗ trợ khóa SmartLock, bấm nút xanh **Cấp lại mã PIN**.
  3. Hệ thống xác nhận và hiển thị mã PIN 6 số mới toanh.
* **Frontend:** Gọi `resetSupportContractPin(taskId, staffId)`.
* **API Request:** `POST /api/v1/staff-tasks/15/reset-pin?staffId=12`
* **Backend Controller:** `StaffTaskController.resetPin(@PathVariable Integer id, @RequestParam Integer staffId)`
* **Backend Service Logic (`StaffTaskService.resetSupportContractPin`):**
  1. Xác thực nhân viên thuộc đúng cơ sở và đang nhận task (`status = 'IN_PROGRESS'`).
  2. **Quy tắc an toàn PR-Q5 & PR-S6:** Kiểm tra trạng thái hợp đồng. Nếu hợp đồng đang quá hạn (`OVERDUE`) $\rightarrow$ **Chặn ngay lập tức** với mã `CONTRACT_OVERDUE` (Hợp đồng đang nợ tiền quá hạn thì SmartLock bị khóa bảo vệ, cấm nhân viên cấp lại PIN cho khách vào lấy đồ trốn nợ!).
  3. Hàm `suggestPinExcluding(oldPin)` sinh ngẫu nhiên 6 chữ số (`000000`–`999999`) đảm bảo:
     - Không trùng với mã PIN hiện tại của hợp đồng này.
     - Không trùng với bất kỳ mã PIN nào của các hợp đồng đang hoạt động khác trong hệ thống.
  4. Cập nhật `rentalContract.setAccessPinCode(newPin)`.
  5. Bắn thông báo realtime và email cho khách hàng mã PIN mới.
  6. Ghi log audit `[CONTRACT_RESET_PIN]`.
* **Database tác động:**
  - `UPDATE rental_contracts SET access_pin_code = '849201' WHERE id = 18`
  - `INSERT INTO activity_logs (...)`

---

### Nghiệp vụ 2: Nhân viên hoàn tất xử lý ticket thông thường
* **Thao tác UI:** Nhập kết quả xử lý vào ô text: *"Đã kiểm tra hệ thống đèn, thay bóng mới tại hành lang tầng 2"* $\rightarrow$ Bấm **Hoàn tất xử lý**.
* **API Request:** `POST /api/v1/staff-tasks/15/resolve-support` với body `{ "resolutionNote": "..." }`.
* **Backend Service Logic (`StaffTaskService.resolveSupportTask`):**
  1. Cập nhật task: `status = 'COMPLETED'`, `completed_at = now`.
  2. Cập nhật ticket liên kết: `status = 'RESOLVED'`, `resolution_note = resolutionNote`, `resolved_at = now`.
  3. Gửi thông báo đến khách hàng: *"Yêu cầu hỗ trợ của bạn đã được giải quyết. Nếu chưa hài lòng bạn có 3 ngày để yêu cầu xử lý lại."*.
* **Database tác động:**
  - `UPDATE facility_tasks SET status = 'COMPLETED', completed_at = GETDATE() WHERE id = 15`
  - `UPDATE support_requests SET status = 'RESOLVED', resolution_note = '...', resolved_at = GETDATE() WHERE id = 10`

---

### Nghiệp vụ 3: Nhân viên kiểm tra hiện trường bồi thường hàng hóa
* **Thao tác UI:** Với ticket `GOODS_DAMAGE`, nhân viên cùng khách mở ô kiểm tra, chụp ảnh thiệt hại, chọn nguyên nhân sơ bộ (Lỗi cơ sở / Lỗi khách / Bất khả kháng) và nhập biên bản hiện trường $\rightarrow$ Bấm **Lưu biên bản kiểm tra**.
* **Backend Service Logic:**
  - Task của nhân viên chuyển thành `COMPLETED`.
  - Hồ sơ bồi thường trong bảng `compensation_claims` chuyển trạng thái từ `SUBMITTED` $\rightarrow$ **`INSPECTED`** (Chờ Quản lý cơ sở thẩm định tài chính).

---

## 3.3 Màn hình 3: Quản lý thẩm định & chi trả hồ sơ bồi thường (`/manager/claims`)
* **File Frontend:** [`ClaimsPage.jsx`](file:///d:/Semester%205/SWP391/QueenKho_Self-Storage-Facility-Rental-and-Management-System/frontend/src/pages/manager/ClaimsPage.jsx)
* **Frontend Service:** [`claimService.js`](file:///d:/Semester%205/SWP391/QueenKho_Self-Storage-Facility-Rental-and-Management-System/frontend/src/services/claimService.js)
* **Backend Controller:** [`CompensationClaimController.java`](file:///d:/Semester%205/SWP391/QueenKho_Self-Storage-Facility-Rental-and-Management-System/backend/api/src/main/java/com/queenkho/api/controller/CompensationClaimController.java)
* **Backend Service:** [`CompensationClaimService.java`](file:///d:/Semester%205/SWP391/QueenKho_Self-Storage-Facility-Rental-and-Management-System/backend/api/src/main/java/com/queenkho/api/service/CompensationClaimService.java)

### Hành động 1: FM thẩm định hồ sơ (Decide Claim)
* **Thao tác UI:**
  1. Mở hồ sơ ở trạng thái `INSPECTED`.
  2. FM xem màn hình đối chiếu:
     - Ảnh khách gửi lúc gửi claim vs. Ảnh nhân viên chụp hiện trường.
     - Ảnh biên bản bàn giao lúc khách nhận ô (`ContractHandoverSection`).
     - **Biểu đồ cảm biến IoT (`SensorSparkline`):** Xem lịch sử nhiệt độ/độ ẩm $\pm 3$ ngày quanh ngày sự cố để kiểm tra xem có lần nào vượt ngưỡng an toàn không (căn cứ chứng minh lỗi thuộc về hệ thống kho lạnh hay không).
  3. FM nhập form quyết định:
     - Chọn bên chịu lỗi: `FACILITY` (Lỗi cơ sở) / `CUSTOMER` (Khách tự làm hỏng) / `FORCE_MAJEURE` (Thiên tai).
     - Giá trị tài sản thẩm định (`assessedValue`), tỷ lệ hư hỏng (`damagePercent`, vd: 80%).
     - Số ngày không sử dụng được ô kho (`unusableDays`) để hoàn tiền thuê tương ứng.
     - Hướng giải quyết: Tiếp tục thuê (`CONTINUE`) hoặc Cho phép thanh lý sớm không phạt (`TERMINATE`).
  4. Bấm **Xem trước bảng tính (`quoteClaim`)** $\rightarrow$ Hệ thống tự động tính ra tổng tiền bồi thường.
  5. Bấm **Chốt quyết định thẩm định (`decideClaim`)**.
* **API Request:**
  - `POST /api/v1/claims/8/decide`
  - Body (JSON):
    ```json
    {
      "liableParty": "FACILITY",
      "assessedValue": 4000000,
      "damagePercent": 100,
      "unusableDays": 5,
      "resolution": "CONTINUE",
      "decisionNote": "Xác nhận hệ thống làm lạnh bị chập điện dẫn đến rã đông làm hỏng hàng."
    }
    ```
* **Backend Service Logic (`CompensationClaimService.decide`):**
  1. **Công thức tính tiền bồi thường theo chính sách bảo hiểm (BR-127):**
     - $\text{Tiền hàng đề xuất} = \text{assessedValue} \times (\text{damagePercent} / 100)$.
     - $\text{Tiền hàng thực trả} = \min(\text{Tiền hàng đề xuất}, \text{Trần gói bảo hiểm coverageCap})$.
     - $\text{Hoàn tiền thuê} = (\text{Giá thuê 1 ngày}) \times \text{unusableDays}$.
     - $\text{Tổng bồi thường} = \text{Tiền hàng thực trả} + \text{Phạt vi phạm (nếu có)} + \text{Hoàn tiền thuê}$.
  2. Cập nhật hồ sơ `compensation_claims`:
     - Nếu lỗi do `FACILITY`: Chuyển status sang **`APPROVED`** (Chờ chi trả).
     - Nếu lỗi do `CUSTOMER`: Chuyển status sang **`REJECTED`** (Từ chối bồi thường).
* **Database tác động:**
  - `UPDATE compensation_claims SET status = 'APPROVED', assessed_value = ..., total_compensation = ..., decided_at = GETDATE() WHERE id = 8`

---

### Hành động 2: FM chi trả bồi thường cho khách (Pay Claim)
* **Thao tác UI:**
  1. Với hồ sơ `APPROVED`, FM thực hiện chuyển khoản cho khách ngoài đời thực.
  2. Trên web, FM nhập Phương thức thanh toán (`BANK_TRANSFER` / `CASH`), Mã giao dịch ngân hàng (Mã FT), tải ảnh Ủy nhiệm chi / Biên lai chuyển tiền thành công.
  3. Bấm nút **Xác nhận đã chi trả**.
* **API Request:**
  - `POST /api/v1/claims/8/pay`
  - Body:
    ```json
    {
      "paymentMethod": "BANK_TRANSFER",
      "bankTransactionCode": "FT261114889201",
      "paymentEvidence": "http://localhost:8080/uploads/evidence-claim-8.jpg",
      "paymentNote": "Đã chuyển khoản bồi thường qua Vietcombank"
    }
    ```
* **Backend Service Logic (`CompensationClaimService.pay`):**
  1. Cập nhật hồ sơ `compensation_claims`: `status = 'PAID'`, `paid_at = now`.
  2. Tạo bản ghi giao dịch tài chính trong bảng `payment_transactions` với loại `COMPENSATION` (Bồi thường), trạng thái `SUCCESS`.
  3. Đóng ticket liên kết trong `support_requests`: `status = 'CLOSED'`.
  4. **Quy trình đòi tiền đối tác bảo hiểm:**
     - Nếu hợp đồng của khách có mua gói bảo hiểm (gói Tiêu Chuẩn / Cao Cấp), hệ thống tự động sinh hồ sơ đòi bảo hiểm: Cập nhật `insurance_status = 'SUBMITTED'`, sinh mã hồ sơ `insurance_ref`.
     - FM có thể bấm nút Demo giả lập: **"Bảo hiểm duyệt & chi trả"** (`simulateInsurancePayout(claimId)`) để giả lập bên bảo hiểm bồi hoàn lại số tiền hàng đó vào tài khoản của doanh nghiệp QueenKho!
* **Database tác động:**
  - `UPDATE compensation_claims SET status = 'PAID', payment_method = 'BANK_TRANSFER', bank_transaction_code = '...', paid_at = GETDATE() WHERE id = 8`
  - `INSERT INTO payment_transactions (contract_id, transaction_type, amount, status, ...) VALUES (..., 'COMPENSATION', ..., 'SUCCESS', ...)`
  - `UPDATE support_requests SET status = 'CLOSED' WHERE id = ...`

---

# 4. BẢNG TỔNG HỢP MÃ LỖI (EXCEPTION CODES) CỦA 2 FLOW

Khi hội đồng hỏi *"Nếu xảy ra lỗi thì hệ thống trả về mã gì, status code bao nhiêu?"*, trả lời ngay theo bảng này:

| Flow | Mã lỗi (Error Code) | HTTP Status | Nguyên nhân nghiệp vụ |
|------|---------------------|-------------|----------------------|
| **Flow 5** | `UNIT_IN_USE` | 409 Conflict | FM cố tình sửa hoặc đổi trạng thái ô đang có khách thuê (`OCCUPIED`). |
| **Flow 5** | `SLOT_IN_USE` | 409 Conflict | Khóa bảo trì làm âm số suất cọc của các khách đang chờ gán ô (BR-11). |
| **Flow 5** | `UNIT_HAS_CONTRACT_HISTORY` | 409 Conflict | FM cố xóa ô kho đã từng có hợp đồng trong lịch sử. |
| **Flow 5** | `UNIT_TYPE_INACTIVE` | 400 Bad Request | Tạo ô kho mới bằng loại kho đang bị ngưng hoạt động. |
| **Flow 5** | `DUPLICATE_UNIT_CODE` | 409 Conflict | Trùng mã ô kho vật lý (vd: `KV-TB-A101`). |
| **Flow 5** | `TASK_NOT_ASSIGNABLE` | 409 Conflict | FM cố giao task hoàn tiền (`REFUND`) cho nhân viên làm thay. |
| **Flow 5** | `STAFF_INACTIVE` | 400 Bad Request | Giao việc cho nhân viên đang bị khóa tài khoản. |
| **Flow 7** | `FORBIDDEN_CONTRACT` | 403 Forbidden | Khách hàng A cố tình gửi ticket trên hợp đồng của khách hàng B. |
| **Flow 7** | `DUPLICATE_ISSUE_TYPE` | 409 Conflict | Đang có 1 ticket cùng loại chưa đóng trên cùng 1 hợp đồng (PR-S2). |
| **Flow 7** | `MAX_OPEN_TICKETS_REACHED` | 409 Conflict | Hợp đồng đã có 3 ticket đang mở, chạm trần cho phép (PR-S2). |
| **Flow 7** | `CONTRACT_OVERDUE` | 409 Conflict | Hợp đồng đang nợ tiền quá hạn, hệ thống khóa SmartLock nên cấm cấp lại mã PIN. |
| **Flow 7** | `INVALID_CLAIM` | 400 Bad Request | Thiếu danh sách hàng hư hoặc số tiền yêu cầu bồi thường $\le 0$. |
| **Flow 7** | `EVIDENCE_IMAGE_REQUIRED` | 400 Bad Request | Báo hỏng hàng (`GOODS_DAMAGE`) nhưng không gửi kèm ảnh chụp hiện trường. |
| **Flow 7** | `CLAIM_ALREADY_SETTLED` | 409 Conflict | Hồ sơ bồi thường đã chi trả thành công thì không cho phép mở lại ticket. |
