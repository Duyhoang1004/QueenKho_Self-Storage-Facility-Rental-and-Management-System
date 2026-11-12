# 🎤 Script Giải Thích Endpoint — Flow 5 & Flow 7

> **Tình huống:** Giảng viên chỉ vào bất kỳ nút nào trên màn hình và hỏi:
> *"Nút này khi bấm thì gọi vào đâu? Controller nào? Service nào?"*
>
> **Công thức trả lời:**
> *"Nút [X] gọi HTTP [METHOD] đến endpoint [URL]. Request đi vào **[Controller]**, method **[methodName()]**. Controller sau đó ủy quyền xử lý nghiệp vụ sang **[Service]**, method **[serviceMethod()]**."*
>
> Sau đó giải thích thêm 1–2 câu về logic nghiệp vụ bên trong Service.

---

# 🏭 FLOW 5 — Các nút FM hay bị hỏi

---

## 🔴 Nút: Xem Dashboard

*"Nút này — hay đúng hơn là việc FM truy cập vào `/manager` — gọi HTTP **GET** đến endpoint `/api/v1/facilities/{id}/dashboard`.*

*Request đi vào **`FacilityController`**, method **`getFacilityDashboard()`**.*

*Trước khi vào Service, controller gọi **`OwnershipGuard.checkFacility(id)`** để đảm bảo FM chỉ được xem đúng cơ sở của mình — đây là quy tắc PR-90.*

*Controller sau đó gọi **`FacilityService.getFacilityDashboardStats(id)`**. Service này tổng hợp từ nhiều bảng: đếm ô theo trạng thái, đếm đơn chờ gán, lấy danh sách HĐ sắp hết hạn và công việc tồn đọng, rồi trả về một DTO tổng hợp cho Frontend render."*

---

## 🔴 Nút: Chọn Tầng / Xem mặt bằng

*"Khi FM chọn tầng để xem sơ đồ, Frontend gọi HTTP **GET** đến `/api/v1/storage-units/layout?facilityId=1`.*

*Request vào **`FloorPlanController`**, method **`getLayout()`**.*

*Controller kiểm tra quyền qua `OwnershipGuard.checkFacility()` rồi gọi **`FloorPlanService.getLayout(facilityId)`**.*

*Service truy vấn toàn bộ tầng, từng ô kho trong tầng, và tính toán nhãn trạng thái thời gian thực — ô nào sắp trống, ô nào đã có người đặt tương lai — rồi trả về dạng `FacilityLayoutResponse`."*

---

## 🔴 Nút: LỊCH Ô KHO (Timeline)

*"Nút LỊCH Ô KHO gọi HTTP **GET** đến `/api/v1/storage-units/schedule?from=...&to=...&unitTypeId=...`.*

*Request vào **`StorageUnitController`**, method **`getSchedule()`**.*

*Controller lấy `facilityId` từ header `X-Facility-Id` hoặc query param, rồi gọi **`UnitScheduleService.getSchedule(facilityId, from, to, unitTypeId)`**.*

*Service này tổng hợp lịch chiếm dụng từng ô kho: khoảng nào đang có hợp đồng, khoảng nào trống — trả về cấu trúc dạng timeline để Frontend vẽ Gantt chart."*

---

## 🔴 Nút: Bấm vào HĐ trong lịch → popup

*"Khi FM bấm vào một thanh hợp đồng trong lịch, Frontend gọi HTTP **GET** đến `/api/v1/contracts/{id}`.*

*Request vào **`ContractController`**, method **`getContractDetail()`**.*

*Controller kiểm tra quyền qua `OwnershipGuard.checkContract(id)`, sau đó gọi `rentalContractRepository.findDetailById(id)` và map kết quả qua method private **`toDto()`** — đây là method nặng nhất trong Controller, tổng hợp toàn bộ thông tin: tiền đã đóng, phí trễ, lịch sử chuyển ô, biên bản, cảm biến.*

*Kết quả trả về dạng `CustomerContractResponse` và hiển thị dưới dạng popup ngay trên màn hình — không mở tab mới để tránh mất phiên `sessionStorage`."*

---

## 🔴 Nút: + THÊM Ô KHO MỚI

*"Nút này gọi HTTP **POST** đến `/api/v1/storage-units?facilityId=1`.*

*Request vào **`StorageUnitController`**, method **`createStorageUnit()`**.*

*Controller gọi **`StorageUnitService.createStorageUnit(facilityId, request, userId)`**.*

*Service kiểm tra loại kho có tồn tại, tạo mã ô tự động theo chuẩn `KV-<cơ sở>-<khu><phòng>` (PR-M9), lưu vào database và ghi log activity. Trả về `StorageUnitDetailResponse` với thông tin ô vừa tạo."*

---

## 🔴 Nút: KHOÁ BẢO TRÌ / MỞ LẠI KHO

*"Hai nút này cùng gọi HTTP **PATCH** đến `/api/v1/storage-units/{id}/status`.*

*Request vào **`StorageUnitController`**, method **`updateStorageUnitStatus()`**.*

*Controller kiểm tra `OwnershipGuard.checkStorageUnit(id)` rồi gọi **`StorageUnitService.updateStorageUnitStatus(id, request, userId)`**.*

*Service kiểm tra nghiệp vụ:*
- *Nếu khoá MAINTENANCE: kiểm tra ô không đang có hợp đồng ACTIVE → nếu có thì 409 `UNIT_IN_USE`; kiểm tra ô không phải ô trống cuối của loại đó khi còn đơn giữ suất → nếu vi phạm thì 409 `SLOT_IN_USE` (PR-M10).*
- *Nếu mở AVAILABLE: chỉ cần không đang có HĐ.*
- *Ghi chú bắt buộc 10–500 ký tự (PR-M9).*
- *Ghi log activity toàn bộ."*

---

## 🔴 Nút: Lưu vị trí sơ đồ (kéo thả)

*"Sau khi FM kéo thả ô trên mặt bằng và bấm Lưu, Frontend gọi HTTP **PUT** đến `/api/v1/storage-units/layout/floors/{floorId}/plan`.*

*Request vào **`FloorPlanController`**, method **`saveFloorPlan()`**.*

*Controller kiểm tra quyền qua `OwnershipGuard.checkFacilityFloor(floorId)` rồi gọi **`FloorPlanService.saveFloorPlan(floorId, request, userId)`**.*

*Service lưu toàn bộ vị trí ô trong tầng đó trong 1 transaction (BR-107). Nếu ô đang có HĐ bị kéo → 409 `UNIT_IN_USE` (BR-138). Nếu hai ô chồng lên nhau → `MAP_CONFLICT`."*

---

## 🔴 Nút: THÊM NHÂN VIÊN

*"Nút này gọi HTTP **POST** đến `/api/v1/manager/staff?facilityId=1`.*

*Request vào **`FacilityStaffController`**, method **`createStaff()`**.*

*Controller gọi **`FacilityStaffService.createStaff(request, actorUserId, facilityId)`**.*

*Service tạo tài khoản người dùng mới với role STAFF, tự động gán `facilityId` của FM đang thao tác, băm mật khẩu BCrypt. Kiểm tra email trùng → 409; mật khẩu < 6 ký tự → 400 (PR-M12). Ghi log activity."*

---

## 🔴 Nút: KHOÁ / MỞ KHOÁ nhân viên

*"Nút này gọi HTTP **PATCH** đến `/api/v1/manager/staff/{id}/status?facilityId=1`.*

*Request vào **`FacilityStaffController`**, method **`changeStatus()`**.*

*Controller gọi **`FacilityStaffService.changeStatus(id, request, actorUserId, facilityId)`**.*

*Service kiểm tra Staff có đang giữ task OPEN hoặc IN_PROGRESS không → nếu có thì 409 (PR-06). Đổi trạng thái `is_active` và ghi log."*

---

## 🔴 Nút: GIAO VIỆC cho Staff

*"Nút này gọi HTTP **POST** đến `/api/v1/staff-tasks/{id}/assign?staffId=13`.*

*Request vào **`StaffTaskController`**, method **`assign()`**.*

*Controller gọi **`StaffTaskService.assignTask(id, currentUser.id(), staffId)`**.*

*Service kiểm tra ngày hẹn của task — nếu còn hơn 30 ngày thì 409 `TASK_NOT_IN_WINDOW` (PR-T1). Kiểm tra Staff có cùng cơ sở và không bị khoá. Gán Staff, chuyển task sang `IN_PROGRESS`, gửi thông báo cho Staff."*

---

## 🔴 Nút: GỠ NGƯỜI NHẬN

*"Nút này gọi HTTP **POST** đến `/api/v1/staff-tasks/{id}/unassign?managerId=3`.*

*Request vào **`StaffTaskController`**, method **`unassign()`**.*

*Controller gọi **`StaffTaskService.unassignTask(id, managerId)`**.*

*Service xóa người nhận, chuyển task về trạng thái `OPEN`, để Staff khác có thể nhận lại."*

---

## 🔴 Nút: Xem bảng task / Lọc task

*"Danh sách task gọi HTTP **GET** đến `/api/v1/staff-tasks?facilityId=1&status=OPEN`.*

*Request vào **`StaffTaskController`**, method **`getBoard()`**.*

*Controller gọi **`StaffTaskService.getBoard(facilityId, status)`**.*

*Service trả về danh sách task đã sắp xếp: task khẩn ghim trên cùng, sau đó theo hạn chót sớm nhất."*

---

---

# 🎧 FLOW 7 — Các nút hay bị hỏi

---

## 🔴 Nút: GỬI YÊU CẦU HỖ TRỢ

*"Nút này gọi HTTP **POST** đến `/api/v1/support-requests`.*

*Request vào **`SupportRequestController`**, method **`createTicket()`**.*

*Controller lấy `customerId` từ header `X-User-Id` hoặc query param, rồi gọi **`SupportRequestService.createTicket(customerId, request)`**.*

*Service kiểm tra nghiệp vụ:*
- *HĐ phải đang `ACTIVE` và thuộc khách gọi (PR-51).*
- *Mô tả ≥ 10 ký tự (PR-S1).*
- *Tối đa 3 ticket OPEN per HĐ; không được trùng loại vấn đề (PR-S2).*

*Nếu hợp lệ, Service tạo ticket với trạng thái `OPEN`, sau đó **tự động tạo task `SUPPORT` với priority URGENT** (PR-34) và gán vào cơ sở của HĐ đó. Ghi log."*

---

## 🔴 Nút: NHẬN VIỆC (Staff)

*"Nút NHẬN VIỆC gọi HTTP **POST** đến `/api/v1/staff-tasks/{id}/claim`.*

*Request vào **`StaffTaskController`**, method **`claim()`**.*

*Controller lấy người dùng hiện tại từ token qua `currentUser.require().id()`, rồi gọi **`StaffTaskService.claimTask(id, userId)`**.*

*Service kiểm tra task còn `OPEN`, chưa có người nhận, và người nhận cùng cơ sở. Dùng cơ chế khóa database để tránh hai Staff claim cùng lúc — nếu thua thì nhận 409 `TASK_NOT_YOURS`. Chuyển task sang `IN_PROGRESS`."*

---

## 🔴 Nút: CẤP LẠI PIN

*"Nút CẤP LẠI PIN gọi HTTP **POST** đến `/api/v1/staff-tasks/{id}/reset-pin?staffId=5`.*

*Request vào **`StaffTaskController`**, method **`resetPin()`**.*

*Controller gọi **`StaffTaskService.resetSupportContractPin(id, staffId)`**.*

*Service kiểm tra:*
- *Task phải thuộc đúng Staff đang giữ (BR-70).*
- *Hợp đồng liên kết phải đang `ACTIVE` — nếu `OVERDUE` thì 409 `CONTRACT_OVERDUE` (PR-S6, PR-Q5).*

*Nếu hợp lệ, Service sinh PIN 6 số chưa tồn tại trong hệ thống, cập nhật vào hợp đồng, gửi thông báo và email cho khách với PIN mới."*

---

## 🔴 Nút: HOÀN TẤT xử lý hỗ trợ

*"Nút này gọi HTTP **POST** đến `/api/v1/staff-tasks/{id}/resolve-support?staffId=5`.*

*Request vào **`StaffTaskController`**, method **`resolveSupport()`**.*

*Controller gọi **`StaffTaskService.resolveSupportTask(id, staffId, request)`**.*

*Service kiểm tra task đang `IN_PROGRESS` và thuộc đúng Staff. Chuyển task sang `COMPLETED`, cập nhật ticket liên quan sang `RESOLVED`, gửi thông báo cho khách để khách xác nhận."*

---

## 🔴 Nút: ĐÃ ỔN (Khách xác nhận)

*"Nút ĐÃ ỔN gọi HTTP **POST** đến `/api/v1/support-requests/{id}/confirm`.*

*Request vào **`SupportRequestController`**, method **`confirmTicket()`**.*

*Controller gọi **`SupportRequestService.confirmResolvedTicket(id, customerId)`**.*

*Service kiểm tra ticket đang ở trạng thái `RESOLVED` và thuộc đúng khách gọi. Chuyển ticket sang `CLOSED` và ghi log. Luồng hỗ trợ kết thúc hoàn toàn."*

---

## 🔴 Nút: CHƯA XONG (Khách mở lại)

*"Nút CHƯA XONG gọi HTTP **POST** đến `/api/v1/support-requests/{id}/reopen`.*

*Request vào **`SupportRequestController`**, method **`reopenTicket()`**.*

*Controller gọi **`SupportRequestService.reopenTicket(id, customerId, request)`**.*

*Service chuyển ticket từ `RESOLVED` về `OPEN` và tạo lại một task `SUPPORT` mới (PR-52) — task mới này cũng được đánh khẩn và nổi đầu danh sách. Khách phải nhập lý do chưa xong."*

---

## 🔴 Nút: GIA HẠN XỬ LÝ (FM — task SUPPORT quá hạn)

*"Nút này gọi HTTP **POST** đến `/api/v1/staff-tasks/{id}/extend-support?managerId=3`.*

*Request vào **`StaffTaskController`**, method **`extendSupport()`**.*

*Controller gọi **`StaffTaskService.extendSupportTask(id, managerId, request)`**.*

*Service kiểm tra task đang ở trạng thái `OVERDUE` và người gọi là FM cùng cơ sở. Gia hạn tối đa 7 ngày (PR-S4), giữ nguyên người nhận, chuyển task về `IN_PROGRESS`."*

---

## 🔴 Nút: TÍNH THỬ bồi thường (F7-X4)

*"Nút TÍNH THỬ gọi HTTP **POST** đến `/api/v1/claims/{id}/quote`.*

*Request vào **`CompensationClaimController`**, method **`quote()`**.*

*Controller gọi **`CompensationClaimService.quote(id, currentUser.id(), request)`**.*

*Service tính toán bảng bồi thường theo BR-127:*
- *Lỗi cơ sở = tiền hàng (≤ trần gói bảo hiểm) + phạt 1 tháng thuê + hoàn thuê theo số ngày không dùng được.*
- *Lỗi khách = từ chối bồi thường.*

*Đây chỉ là xem trước — không lưu gì vào database. FM có thể tính thử nhiều lần."*

---

## 🔴 Nút: CHỐT bồi thường

*"Nút CHỐT gọi HTTP **POST** đến `/api/v1/claims/{id}/decide`.*

*Request vào **`CompensationClaimController`**, method **`decide()`**.*

*Controller gọi **`CompensationClaimService.decide(id, currentUser.id(), request)`**.*

*Service lưu quyết định vào database, chuyển hồ sơ sang `APPROVED` (hoặc `REJECTED` nếu lỗi khách). Nếu approved, FM được phép tiến hành chi trả."*

---

## 🔴 Nút: CHI TRẢ bồi thường

*"Nút CHI TRẢ gọi HTTP **POST** đến `/api/v1/claims/{id}/pay`.*

*Request vào **`CompensationClaimController`**, method **`pay()`**.*

*Controller gọi **`CompensationClaimService.pay(id, currentUser.id(), request)`**.*

*Service kiểm tra có ảnh UNC (ủy nhiệm chi) → thiếu thì 400 `PAYMENT_EVIDENCE_REQUIRED`. Lưu bằng chứng, chuyển hồ sơ sang `PAID`. Nếu hợp đồng có gói bảo hiểm, Service tự động gửi hồ sơ đòi bảo hiểm qua `InsuranceProviderClient` — đây là mô phỏng (BR-128): cơ sở chi trước rồi đòi bảo hiểm hoàn lại sau."*

---

---

# 📌 BẢNG PHẢN XẠ NHANH

> Nhìn vào nút → nhớ ngay 3 thứ: **Controller | Method | Service.method()**

## Flow 5

| Nút nhìn thấy | Controller | Method trong Controller | Service.method() |
|---|---|---|---|
| Dashboard | `FacilityController` | `getFacilityDashboard()` | `FacilityService.getFacilityDashboardStats()` |
| Chọn tầng / layout | `FloorPlanController` | `getLayout()` | `FloorPlanService.getLayout()` |
| LỊCH Ô KHO | `StorageUnitController` | `getSchedule()` | `UnitScheduleService.getSchedule()` |
| Lưu sơ đồ kéo thả | `FloorPlanController` | `saveFloorPlan()` | `FloorPlanService.saveFloorPlan()` |
| + Thêm ô kho | `StorageUnitController` | `createStorageUnit()` | `StorageUnitService.createStorageUnit()` |
| Khoá/Mở bảo trì | `StorageUnitController` | `updateStorageUnitStatus()` | `StorageUnitService.updateStorageUnitStatus()` |
| Thêm nhân viên | `FacilityStaffController` | `createStaff()` | `FacilityStaffService.createStaff()` |
| Khoá/Mở khoá NV | `FacilityStaffController` | `changeStatus()` | `FacilityStaffService.changeStatus()` |
| Giao việc | `StaffTaskController` | `assign()` | `StaffTaskService.assignTask()` |
| Gỡ người nhận | `StaffTaskController` | `unassign()` | `StaffTaskService.unassignTask()` |
| Bảng task | `StaffTaskController` | `getBoard()` | `StaffTaskService.getBoard()` |
| Mở popup HĐ | `ContractController` | `getContractDetail()` | `rentalContractRepository.findDetailById()` |

## Flow 7

| Nút nhìn thấy | Controller | Method trong Controller | Service.method() |
|---|---|---|---|
| Gửi yêu cầu | `SupportRequestController` | `createTicket()` | `SupportRequestService.createTicket()` |
| Nhận việc | `StaffTaskController` | `claim()` | `StaffTaskService.claimTask()` |
| Cấp lại PIN | `StaffTaskController` | `resetPin()` | `StaffTaskService.resetSupportContractPin()` |
| Hoàn tất xử lý | `StaffTaskController` | `resolveSupport()` | `StaffTaskService.resolveSupportTask()` |
| Đã ổn | `SupportRequestController` | `confirmTicket()` | `SupportRequestService.confirmResolvedTicket()` |
| Chưa xong | `SupportRequestController` | `reopenTicket()` | `SupportRequestService.reopenTicket()` |
| Gia hạn task | `StaffTaskController` | `extendSupport()` | `StaffTaskService.extendSupportTask()` |
| Tính thử bồi thường | `CompensationClaimController` | `quote()` | `CompensationClaimService.quote()` |
| Chốt bồi thường | `CompensationClaimController` | `decide()` | `CompensationClaimService.decide()` |
| Chi trả bồi thường | `CompensationClaimController` | `pay()` | `CompensationClaimService.pay()` |
