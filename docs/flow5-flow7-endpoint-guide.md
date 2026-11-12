# 📋 Flow 5 & Flow 7 — Mỗi nút bấm → Endpoint → Controller → Service

> **Mục đích:** Học thuộc cho buổi bảo vệ. Giảng viên chỉ vào bất kỳ nút nào → đọc dòng tương ứng.
> Base URL: `http://localhost:8080`

---

## ⚡ CÁCH TRẢ LỜI CHUẨN

> *"Nút [Tên nút] gọi HTTP [METHOD] tới endpoint [URL]. Request vào **[Controller]**, method **[methodName()]**, sau đó controller gọi sang **[Service]**, method **[serviceMethod()]** để xử lý nghiệp vụ."*

---

# 🏭 FLOW 5 — Facility Storage and Staff Management

**Người dùng chính:** FM (`fmtanbinh@gmail.com`) — `/manager`

---

## A5-B1: Nút "Xem Dashboard" — `/manager`

| | Chi tiết |
|---|---|
| **HTTP** | `GET /api/v1/facilities/{id}/dashboard` |
| **Controller** | `FacilityController` → `getFacilityDashboard(@PathVariable Integer id)` |
| **Service** | `FacilityService` → `getFacilityDashboardStats(id)` |
| **Ghi chú** | `OwnershipGuard.checkFacility(id)` kiểm tra FM chỉ xem cơ sở của mình (PR-90) |

---

## A5-B2: Nút "Chọn Tầng" — Xem mặt bằng kho `/manager/storage`

| | Chi tiết |
|---|---|
| **HTTP** | `GET /api/v1/storage-units/layout?facilityId=1` |
| **Controller** | `FloorPlanController` → `getLayout(@RequestParam Integer facilityId)` |
| **Service** | `FloorPlanService` → `getLayout(facilityId)` |
| **Ghi chú** | Trả về toàn bộ tầng + ô kho với nhãn trạng thái (sắp trống, đã có người đặt…) |

---

## A5-B2b: Xem danh sách ô kho + KPI — `/manager/storage` (bảng lưới)

| | Chi tiết |
|---|---|
| **HTTP** | `GET /api/v1/storage-units?facilityId=1&status=...&floor=Tầng 2` |
| **Controller** | `StorageUnitController` → `getStorageUnits(...)` |
| **Service** | `StorageUnitService` → `getStorageUnits(facilityId, status, floor, unitTypeId, keyword)` |
| **Ghi chú** | Có thể lọc theo `status`, `floor`, `unitTypeId`, `keyword` |

---

## A5-B3: Nút "LỊCH Ô KHO" — Timeline ô kho

| | Chi tiết |
|---|---|
| **HTTP** | `GET /api/v1/storage-units/schedule?from=2026-11-01&to=2027-02-01&unitTypeId=1` |
| **Controller** | `StorageUnitController` → `getSchedule(...)` |
| **Service** | `UnitScheduleService` → `getSchedule(effectiveFacilityId, from, to, unitTypeId)` |
| **Ghi chú** | facilityId lấy từ header `X-Facility-Id` hoặc query param; trả về lịch chiếm dụng (D-18) |

**→ Bấm vào 1 hợp đồng trong lịch → mở popup:**

| | Chi tiết |
|---|---|
| **HTTP** | `GET /api/v1/contracts/{id}` |
| **Controller** | `ContractController` → `getContractDetail(@PathVariable Integer id)` |
| **Service** | (trực tiếp trong controller) `rentalContractRepository.findDetailById(id)` → map sang `CustomerContractResponse` via `toDto()` |
| **Ghi chú** | `OwnershipGuard.checkContract(id)` |

---

## A5-B4a: Nút "+ THÊM Ô KHO MỚI"

| | Chi tiết |
|---|---|
| **HTTP** | `POST /api/v1/storage-units?facilityId=1` |
| **Controller** | `StorageUnitController` → `createStorageUnit(...)` |
| **Service** | `StorageUnitService` → `createStorageUnit(effectiveFacilityId, request, effectiveUserId)` |
| **Ghi chú** | Mã ô tự sinh `KV-<cơ sở>-<khu><phòng>` (PR-M9) |

---

## A5-B4b: Nút "KHOÁ BẢO TRÌ" (ô → MAINTENANCE)

| | Chi tiết |
|---|---|
| **HTTP** | `PATCH /api/v1/storage-units/{id}/status` |
| **Controller** | `StorageUnitController` → `updateStorageUnitStatus(@PathVariable String id, ...)` |
| **Service** | `StorageUnitService` → `updateStorageUnitStatus(id, request, effectiveUserId)` |
| **Body mẫu** | `{ "status": "MAINTENANCE", "note": "Lý do ít nhất 10 ký tự..." }` |
| **Ghi chú** | Chặn nếu ô đang có HĐ `ACTIVE` → `UNIT_IN_USE` (409); ghi chú phải 10–500 ký tự (PR-M9, PR-M10) |

---

## A5-B4c: Nút "MỞ LẠI KHO" (MAINTENANCE → AVAILABLE)

| | Chi tiết |
|---|---|
| **HTTP** | `PATCH /api/v1/storage-units/{id}/status` |
| **Controller** | `StorageUnitController` → `updateStorageUnitStatus(...)` |
| **Service** | `StorageUnitService` → `updateStorageUnitStatus(id, request, effectiveUserId)` |
| **Body mẫu** | `{ "status": "AVAILABLE", "note": "Sửa xong, mở lại" }` |

---

## A5-B4d: Lưu vị trí ô trên mặt bằng (kéo thả → Lưu)

| | Chi tiết |
|---|---|
| **HTTP** | `PUT /api/v1/storage-units/layout/floors/{floorId}/plan` |
| **Controller** | `FloorPlanController` → `saveFloorPlan(@PathVariable Integer floorId, ...)` |
| **Service** | `FloorPlanService` → `saveFloorPlan(floorId, request, currentUser.id())` |
| **Ghi chú** | Lưu toàn tầng trong 1 transaction (BR-107); ô đang có HĐ → icon khoá, không kéo được (BR-138) |

---

## A5-B5: Nút "THÊM NHÂN VIÊN"

| | Chi tiết |
|---|---|
| **HTTP** | `POST /api/v1/manager/staff?facilityId=1` |
| **Controller** | `FacilityStaffController` → `createStaff(request, actorUserId, facilityId)` |
| **Service** | `FacilityStaffService` → `createStaff(request, actorUserId, facilityId)` |
| **Ghi chú** | Tự động gán Staff vào cơ sở của FM; chặn email trùng (409), mật khẩu < 6 ký tự (400) (PR-M12) |

## A5-B5b: Xem danh sách nhân viên

| | Chi tiết |
|---|---|
| **HTTP** | `GET /api/v1/manager/staff?facilityId=1` |
| **Controller** | `FacilityStaffController` → `getStaff(@RequestParam Integer facilityId)` |
| **Service** | `FacilityStaffService` → `getStaffByFacility(facilityId)` |

## A5-B5c: Nút "KHOÁ / MỞ KHOÁ" nhân viên

| | Chi tiết |
|---|---|
| **HTTP** | `PATCH /api/v1/manager/staff/{id}/status?facilityId=1` |
| **Controller** | `FacilityStaffController` → `changeStatus(id, request, actorUserId, facilityId)` |
| **Service** | `FacilityStaffService` → `changeStatus(id, request, actorUserId, facilityId)` |
| **Ghi chú** | Chặn khoá Staff đang giữ task (409 PR-06) |

---

## A5-B6: Nút "GIAO VIỆC" cho Staff — `/manager/tasks`

| | Chi tiết |
|---|---|
| **HTTP** | `POST /api/v1/staff-tasks/{id}/assign?staffId=13` |
| **Controller** | `StaffTaskController` → `assign(@PathVariable Integer id, @RequestParam staffId)` |
| **Service** | `StaffTaskService` → `assignTask(id, currentUser.id(), staffId)` |
| **Ghi chú** | Chỉ giao được trong cửa sổ 30 ngày trước ngày hẹn (PR-T1); ngoài cửa sổ → `TASK_NOT_IN_WINDOW` (409) |

## A5-B6b: Nút "GỠ NGƯỜI NHẬN" — task về OPEN

| | Chi tiết |
|---|---|
| **HTTP** | `POST /api/v1/staff-tasks/{id}/unassign?managerId=3` |
| **Controller** | `StaffTaskController` → `unassign(@PathVariable Integer id, ...)` |
| **Service** | `StaffTaskService` → `unassignTask(id, managerId)` |

## A5-B6c: Xem bảng task (lọc theo thời gian)

| | Chi tiết |
|---|---|
| **HTTP** | `GET /api/v1/staff-tasks?facilityId=1&status=OPEN` |
| **Controller** | `StaffTaskController` → `getBoard(@RequestParam Integer facilityId, ...)` |
| **Service** | `StaffTaskService` → `getBoard(facilityId, status)` |

---

## A5-B7: Xem danh sách khách hàng + HĐ — `/manager/customers`

| | Chi tiết |
|---|---|
| **HTTP** | `GET /api/v1/contracts?facilityId=1` |
| **Controller** | `ContractController` → `getContracts(facilityId, managerId, customerId, reservationId)` |
| **Service** | `rentalContractRepository.findAllByFacilityId(facilityId)` → map `toDto()` |

**→ Bấm mã HĐ → popup chi tiết:**

| | Chi tiết |
|---|---|
| **HTTP** | `GET /api/v1/contracts/{id}` |
| **Controller** | `ContractController` → `getContractDetail(@PathVariable Integer id)` |
| **Service** | `rentalContractRepository.findDetailById(id)` → `toDto()` |

---

## A5-B8: Xem báo cáo cơ sở — `/manager/reports`

| | Chi tiết |
|---|---|
| **HTTP** | `GET /api/v1/facilities/{id}/dashboard` |
| **Controller** | `FacilityController` → `getFacilityDashboard(id)` |
| **Service** | `FacilityService` → `getFacilityDashboardStats(id)` |

---

## 🔴 EXCEPTION Flow 5

### F5-X1: Kéo ô có HĐ → MAP_CONFLICT / UNIT_IN_USE

| Hành động | HTTP | Controller → method | Service → method | Lỗi |
|---|---|---|---|---|
| Kéo ô trên mặt bằng | `PUT /api/v1/storage-units/layout/floors/{id}/plan` | `FloorPlanController` → `saveFloorPlan()` | `FloorPlanService` → `saveFloorPlan()` | `UNIT_IN_USE` (409) nếu ô có HĐ; `MAP_CONFLICT` nếu chồng nhau |

### F5-X2: Khoá bảo trì ô trống cuối → SLOT_IN_USE

| Hành động | HTTP | Controller → method | Service → method | Lỗi |
|---|---|---|---|---|
| Khoá bảo trì | `PATCH /api/v1/storage-units/{id}/status` | `StorageUnitController` → `updateStorageUnitStatus()` | `StorageUnitService` → `updateStorageUnitStatus()` | `SLOT_IN_USE` (409) — ô trống cuối đang được đơn giữ suất (PR-M10) |

---

---

# 🎧 FLOW 7 — Support Request and Issue Handling

**Người dùng:** Khách (`phuc.khach`) + Staff (`stafftanbinh1`) + FM (`fmtanbinh`)

---

## A7-B1: Nút "GỬI YÊU CẦU HỖ TRỢ" — `/ho-tro`

| | Chi tiết |
|---|---|
| **HTTP** | `POST /api/v1/support-requests?customerId=...` |
| **Controller** | `SupportRequestController` → `createTicket(customerId, headerUserId, request)` |
| **Service** | `SupportRequestService` → `createTicket(effectiveCustomerId, request)` |
| **Kết quả** | Ticket `OPEN`, tự động sinh task `SUPPORT` **khẩn** (nổi đầu danh sách FM/Staff) |
| **Ghi chú** | Mô tả ≥ 10 ký tự (PR-S1); giới hạn 3 ticket `OPEN`/HĐ (PR-S2); task khẩn (PR-34) |

**Trước đó, tải danh sách HĐ đủ điều kiện:**

| | Chi tiết |
|---|---|
| **HTTP** | `GET /api/v1/support-requests/eligible-contracts?customerId=...` |
| **Controller** | `SupportRequestController` → `getEligibleContracts(customerId, headerUserId)` |
| **Service** | `SupportRequestService` → `getEligibleContracts(effectiveCustomerId)` |

---

## A7-B1b: Xem danh sách ticket của khách

| | Chi tiết |
|---|---|
| **HTTP** | `GET /api/v1/support-requests?customerId=...&status=OPEN` |
| **Controller** | `SupportRequestController` → `getCustomerTickets(customerId, headerUserId, status, contractId)` |
| **Service** | `SupportRequestService` → `getCustomerTickets(effectiveCustomerId, status, contractId)` |

---

## A7-B2a: Staff — Nút "NHẬN VIỆC" (task SUPPORT)

| | Chi tiết |
|---|---|
| **HTTP** | `POST /api/v1/staff-tasks/{id}/claim` |
| **Controller** | `StaffTaskController` → `claim(@PathVariable Integer id)` |
| **Service** | `StaffTaskService` → `claimTask(id, currentUser.id())` |
| **Ghi chú** | Ai bấm trước giữ (BR-64); chỉ Staff cùng cơ sở |

---

## A7-B2b: Staff — Nút "CẤP LẠI PIN" (Lỗi khoá)

| | Chi tiết |
|---|---|
| **HTTP** | `POST /api/v1/staff-tasks/{id}/reset-pin?staffId=5` |
| **Controller** | `StaffTaskController` → `resetPin(@PathVariable Integer id, @RequestParam staffId)` |
| **Service** | `StaffTaskService` → `resetSupportContractPin(id, staffId)` |
| **Kết quả** | Khách nhận PIN mới; ticket → `RESOLVED` |
| **Ghi chú** | Hợp đồng `OVERDUE` → 409 `CONTRACT_OVERDUE` (PR-S6) |

---

## A7-B2c: Staff — Nút "HOÀN TẤT" xử lý hỗ trợ

| | Chi tiết |
|---|---|
| **HTTP** | `POST /api/v1/staff-tasks/{id}/resolve-support?staffId=5` |
| **Controller** | `StaffTaskController` → `resolveSupport(@PathVariable Integer id, ...)` |
| **Service** | `StaffTaskService` → `resolveSupportTask(id, staffId, request)` |
| **Body mẫu** | `{ "resolutionNote": "Đã xử lý xong lỗi khoá..." }` |
| **Kết quả** | Ticket → `RESOLVED`; khách nhận thông báo |

---

## A7-B3: Khách — Nút "ĐÃ ỔN" (xác nhận đóng ticket)

| | Chi tiết |
|---|---|
| **HTTP** | `POST /api/v1/support-requests/{id}/confirm?customerId=...` |
| **Controller** | `SupportRequestController` → `confirmTicket(id, customerId, headerUserId)` |
| **Service** | `SupportRequestService` → `confirmResolvedTicket(id, effectiveCustomerId)` |
| **Kết quả** | Ticket → `CLOSED` (PR-52) |

---

## 🔴 EXCEPTION Flow 7

### F7-X1: Gửi quá 3 ticket → DUPLICATE_ISSUE_TYPE / MAX_OPEN_TICKETS

| Hành động | HTTP | Controller → method | Service → method | Lỗi |
|---|---|---|---|---|
| Gửi thêm ticket | `POST /api/v1/support-requests` | `SupportRequestController` → `createTicket()` | `SupportRequestService` → `createTicket()` | `DUPLICATE_ISSUE_TYPE` hoặc `MAX_OPEN_TICKETS_REACHED` (409) |

---

### F7-X2: Khách — Nút "CHƯA XONG" (mở lại ticket)

| | Chi tiết |
|---|---|
| **HTTP** | `POST /api/v1/support-requests/{id}/reopen?customerId=...` |
| **Controller** | `SupportRequestController` → `reopenTicket(id, customerId, headerUserId, request)` |
| **Service** | `SupportRequestService` → `reopenTicket(id, effectiveCustomerId, request)` |
| **Body mẫu** | `{ "reason": "Lý do chưa xong..." }` |
| **Kết quả** | Ticket → `OPEN`, sinh task `SUPPORT` mới (PR-52) |

---

### F7-X3: FM — Nút "GIA HẠN XỬ LÝ" (task SUPPORT quá hạn)

| | Chi tiết |
|---|---|
| **HTTP** | `POST /api/v1/staff-tasks/{id}/extend-support?managerId=3` |
| **Controller** | `StaffTaskController` → `extendSupport(@PathVariable Integer id, ...)` |
| **Service** | `StaffTaskService` → `extendSupportTask(id, managerId, request)` |
| **Body mẫu** | `{ "newDueDate": "2026-11-20", "reason": "Phần cứng chờ nhập hàng..." }` |
| **Ghi chú** | Tối đa 7 ngày (PR-S4); giữ nguyên người nhận |

---

### F7-X4 ⭐: Bồi thường — FM xem hồ sơ `/manager/claims`

**B1 — Xem danh sách hồ sơ bồi thường:**

| | Chi tiết |
|---|---|
| **HTTP** | `GET /api/v1/claims?facilityId=1` |
| **Controller** | `CompensationClaimController` → `list(@RequestParam facilityId)` |
| **Service** | `CompensationClaimService` → `list(currentUser.id(), facilityId)` |

**B2 — Xem chi tiết hồ sơ:**

| | Chi tiết |
|---|---|
| **HTTP** | `GET /api/v1/claims/{id}` |
| **Controller** | `CompensationClaimController` → `detail(@PathVariable Integer id)` |
| **Service** | `CompensationClaimService` → `detail(id, currentUser.id())` |

**B2b — Nút "TÍNH THỬ" (xem trước bảng tính bồi thường):**

| | Chi tiết |
|---|---|
| **HTTP** | `POST /api/v1/claims/{id}/quote` |
| **Controller** | `CompensationClaimController` → `quote(@PathVariable Integer id, @RequestBody ClaimDecisionRequest)` |
| **Service** | `CompensationClaimService` → `quote(id, currentUser.id(), request)` |
| **Body mẫu** | `{ "faultParty": "FACILITY", "declaredValue": 12000000, "coveragePercent": 100, "unusableDays": 2 }` |
| **Ghi chú** | BR-127: lỗi cơ sở = tiền hàng (≤ trần) + phạt 1 tháng + hoàn thuê theo ngày |

**B3 — Nút "CHỐT" (phê duyệt bồi thường):**

| | Chi tiết |
|---|---|
| **HTTP** | `POST /api/v1/claims/{id}/decide` |
| **Controller** | `CompensationClaimController` → `decide(@PathVariable Integer id, @RequestBody ClaimDecisionRequest)` |
| **Service** | `CompensationClaimService` → `decide(id, currentUser.id(), request)` |
| **Kết quả** | Hồ sơ → `APPROVED` |

**B5 — Nút "CHI TRẢ" (xác nhận đã trả tiền bồi thường cho khách):**

| | Chi tiết |
|---|---|
| **HTTP** | `POST /api/v1/claims/{id}/pay` |
| **Controller** | `CompensationClaimController` → `pay(@PathVariable Integer id, @RequestBody ClaimPaymentRequest)` |
| **Service** | `CompensationClaimService` → `pay(id, currentUser.id(), request)` |
| **Body mẫu** | `{ "evidenceImageUrl": "https://..." }` |
| **Ghi chú** | Thiếu ảnh UNC → `PAYMENT_EVIDENCE_REQUIRED`; sau `PAID` → tự gửi hồ sơ đòi bảo hiểm (BR-128) |

---

### F7-X7: Staff — Nút "CẤP LẠI PIN" cho HĐ OVERDUE → BỊ CHẶN

| | Chi tiết |
|---|---|
| **HTTP** | `POST /api/v1/staff-tasks/{id}/reset-pin?staffId=5` |
| **Controller** | `StaffTaskController` → `resetPin(@PathVariable Integer id, ...)` |
| **Service** | `StaffTaskService` → `resetSupportContractPin(id, staffId)` |
| **Kết quả** | 409 `CONTRACT_OVERDUE` — HĐ quá hạn không được cấp PIN (PR-S6, PR-Q5) |
| **Ghi chú** | ⚠️ **Phải demo CA NÀY TRƯỚC F6-X3** vì cùng dùng `HD-F6-06` |

---

---

# 📌 BẢNG TÓM TẮT NHANH

## Flow 5

| Nút | Method | Endpoint | Controller | Service method |
|---|---|---|---|---|
| Xem Dashboard | GET | `/api/v1/facilities/{id}/dashboard` | `FacilityController` | `facilityService.getFacilityDashboardStats()` |
| Xem mặt bằng (layout) | GET | `/api/v1/storage-units/layout` | `FloorPlanController` | `floorPlanService.getLayout()` |
| Xem danh sách ô kho | GET | `/api/v1/storage-units` | `StorageUnitController` | `storageUnitService.getStorageUnits()` |
| Lịch ô kho | GET | `/api/v1/storage-units/schedule` | `StorageUnitController` | `unitScheduleService.getSchedule()` |
| Lưu vị trí sơ đồ | PUT | `/api/v1/storage-units/layout/floors/{id}/plan` | `FloorPlanController` | `floorPlanService.saveFloorPlan()` |
| Thêm ô kho mới | POST | `/api/v1/storage-units` | `StorageUnitController` | `storageUnitService.createStorageUnit()` |
| Khoá bảo trì / Mở lại | PATCH | `/api/v1/storage-units/{id}/status` | `StorageUnitController` | `storageUnitService.updateStorageUnitStatus()` |
| Thêm nhân viên | POST | `/api/v1/manager/staff` | `FacilityStaffController` | `facilityStaffService.createStaff()` |
| Xem danh sách NV | GET | `/api/v1/manager/staff` | `FacilityStaffController` | `facilityStaffService.getStaffByFacility()` |
| Khoá/Mở khoá NV | PATCH | `/api/v1/manager/staff/{id}/status` | `FacilityStaffController` | `facilityStaffService.changeStatus()` |
| Giao việc cho Staff | POST | `/api/v1/staff-tasks/{id}/assign` | `StaffTaskController` | `staffTaskService.assignTask()` |
| Gỡ người nhận task | POST | `/api/v1/staff-tasks/{id}/unassign` | `StaffTaskController` | `staffTaskService.unassignTask()` |
| Xem bảng task | GET | `/api/v1/staff-tasks` | `StaffTaskController` | `staffTaskService.getBoard()` |
| Xem HĐ của cơ sở | GET | `/api/v1/contracts?facilityId=1` | `ContractController` | `rentalContractRepository.findAllByFacilityId()` |
| Mở popup chi tiết HĐ | GET | `/api/v1/contracts/{id}` | `ContractController` | `rentalContractRepository.findDetailById()` → `toDto()` |
| Xem báo cáo | GET | `/api/v1/facilities/{id}/dashboard` | `FacilityController` | `facilityService.getFacilityDashboardStats()` |

## Flow 7

| Nút | Method | Endpoint | Controller | Service method |
|---|---|---|---|---|
| Gửi yêu cầu hỗ trợ | POST | `/api/v1/support-requests` | `SupportRequestController` | `supportRequestService.createTicket()` |
| Xem danh sách ticket | GET | `/api/v1/support-requests` | `SupportRequestController` | `supportRequestService.getCustomerTickets()` |
| Xem HĐ đủ điều kiện | GET | `/api/v1/support-requests/eligible-contracts` | `SupportRequestController` | `supportRequestService.getEligibleContracts()` |
| Nhận việc (Staff) | POST | `/api/v1/staff-tasks/{id}/claim` | `StaffTaskController` | `staffTaskService.claimTask()` |
| Cấp lại PIN | POST | `/api/v1/staff-tasks/{id}/reset-pin` | `StaffTaskController` | `staffTaskService.resetSupportContractPin()` |
| Hoàn tất xử lý | POST | `/api/v1/staff-tasks/{id}/resolve-support` | `StaffTaskController` | `staffTaskService.resolveSupportTask()` |
| Đã ổn (khách đóng) | POST | `/api/v1/support-requests/{id}/confirm` | `SupportRequestController` | `supportRequestService.confirmResolvedTicket()` |
| Chưa xong (mở lại) | POST | `/api/v1/support-requests/{id}/reopen` | `SupportRequestController` | `supportRequestService.reopenTicket()` |
| Gia hạn task (FM) | POST | `/api/v1/staff-tasks/{id}/extend-support` | `StaffTaskController` | `staffTaskService.extendSupportTask()` |
| Xem danh sách claims | GET | `/api/v1/claims` | `CompensationClaimController` | `claimService.list()` |
| Xem chi tiết claim | GET | `/api/v1/claims/{id}` | `CompensationClaimController` | `claimService.detail()` |
| Tính thử bồi thường | POST | `/api/v1/claims/{id}/quote` | `CompensationClaimController` | `claimService.quote()` |
| Chốt bồi thường | POST | `/api/v1/claims/{id}/decide` | `CompensationClaimController` | `claimService.decide()` |
| Chi trả bồi thường | POST | `/api/v1/claims/{id}/pay` | `CompensationClaimController` | `claimService.pay()` |

---

## 💡 Mẹo nhớ nhanh theo Controller

| Controller | Quản lý gì |
|---|---|
| `FacilityController` | Cơ sở, Dashboard FM, tìm kiếm cơ sở |
| `FloorPlanController` | Mặt bằng sơ đồ, tầng, vị trí ô kho |
| `StorageUnitController` | Ô kho (CRUD, khoá bảo trì, lịch timeline) |
| `FacilityStaffController` | Nhân viên cơ sở (tạo, khoá/mở, đặt lại mật khẩu) |
| `StaffTaskController` | Task (nhận, giao, gỡ, check-in, check-out, cấp PIN, hoàn tất hỗ trợ) |
| `SupportRequestController` | Ticket hỗ trợ (tạo, xác nhận xong, mở lại, huỷ) |
| `CompensationClaimController` | Hồ sơ bồi thường hàng hoá (tính thử, chốt, chi trả) |
| `ContractController` | Hợp đồng (xem, trả kho, chuyển ô, quá hạn, miễn phí trễ, thanh lý) |
