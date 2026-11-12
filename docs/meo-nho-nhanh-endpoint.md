# 🧠 BÍ KÍP PHẢN XẠ NHANH: NHÌN NÚT ĐOÁN NGAY CONTROLLER & SERVICE

> **Dành cho đêm trước khi ra hội đồng:** Đừng học thuộc lòng 25 dòng!  
> Chỉ cần nhớ **1 câu hỏi thần chú**:  
> 👉 **"Nút này đang bấm trên màn hình nào và tác động lên ĐỐI TƯỢNG GÌ?"**

---

## ⚡ 1. NGUYÊN TẮC "ĐỐI TƯỢNG NÀO THÌ CONTROLLER & SERVICE ĐÓ"

Trong Spring Boot chuẩn, **Controller và Service mang tên của chính thực thể (Entity / Domain)**. Bạn chỉ cần bắt đúng từ khóa là đọc ra ngay:

```
┌─────────────────────────────────┬───────────────────────────────┬───────────────────────────────┐
│ TỪ KHÓA ĐỐI TƯỢNG               │ CONTROLLER                    │ SERVICE                       │
├─────────────────────────────────┼───────────────────────────────┼───────────────────────────────┤
│ 1. Ô KHO (thêm, bảo trì, mở)    │ StorageUnitController         │ StorageUnitService            │
│ 2. LỊCH TIMELINE (lịch ô kho)   │ StorageUnitController         │ UnitScheduleService           │
│ 3. SƠ ĐỒ MẶT BẰNG / TẦNG        │ FloorPlanController           │ FloorPlanService              │
│ 4. NHÂN VIÊN (tạo, khóa staff)  │ FacilityStaffController       │ FacilityStaffService          │
│ 5. CÔNG VIỆC / TASK (giao, nhận)│ StaffTaskController           │ StaffTaskService              │
│ 6. TICKET HỖ TRỢ (khách gửi/đóng) SupportRequestController     │ SupportRequestService         │
│ 7. BỒI THƯỜNG (tính, chốt, trả) │ CompensationClaimController   │ CompensationClaimService      │
│ 8. HỢP ĐỒNG (popup chi tiết HĐ) │ ContractController            │ ContractController / Repo     │
│ 9. DASHBOARD CƠ SỞ              │ FacilityController            │ FacilityService               │
└─────────────────────────────────┴───────────────────────────────┴───────────────────────────────┘
```

> 🎯 **Nhận xét:** Thấy chữ `...Controller` thì Service tương ứng gần như đổi đuôi thành `...Service`!

---

## ⚡ 2. CÔNG THỨC PHẢN XẠ THEO FLOW (3 GIÂY RA ĐÁP ÁN)

### 🏭 FLOW 5: MÀN HÌNH QUẢN LÝ (FM)
Khi cô chỉ vào màn hình FM, hãy nhìn xem đang đứng ở **Tab nào**:

1. **Tab Dashboard (Trang chủ Manager):**
   * Đang xem chỉ số tổng quan cơ sở:
   * ➜ **`FacilityController`** ➔ **`FacilityService.getFacilityDashboardStats()`**

2. **Tab Ô kho / Mặt bằng (Storage & Layout):**
   * Nếu là nút **Chọn tầng / Lưu vị trí kéo thả**:
     * ➜ Tác động lên **Mặt bằng (Floor Plan)**: **`FloorPlanController`** ➔ **`FloorPlanService`**
   * Nếu là nút **+ Thêm ô kho**, **Khóa bảo trì**, **Mở lại kho**:
     * ➜ Tác động lên **Ô kho (Storage Unit)**: **`StorageUnitController`** ➔ **`StorageUnitService`**
   * Nếu là nút **LỊCH Ô KHO (Timeline xanh đỏ)**:
     * ➜ Xem **Lịch (Schedule)**: **`StorageUnitController`** ➔ **`UnitScheduleService`**

3. **Tab Nhân viên (Staff):**
   * Nút **Thêm nhân viên**, **Khóa nhân viên**, **Xem danh sách**:
     * ➜ Cứ dính tới Staff là: **`FacilityStaffController`** ➔ **`FacilityStaffService`**

4. **Tab Công việc (Tasks):**
   * Nút **Giao việc**, **Gỡ người nhận**, **Xem bảng task**:
     * ➜ Cứ dính tới Task là: **`StaffTaskController`** ➔ **`StaffTaskService`**

5. **Khi bấm vào Hợp đồng (popup chi tiết HĐ):**
   * ➜ Đang xem **Hợp đồng (Contract)**: **`ContractController`** ➔ `findDetailById() / toDto()`

---

### 🎧 FLOW 7: MÀN HÌNH HỖ TRỢ & SỰ CỐ
Flow 7 chỉ xoay quanh đúng **3 vai diễn**:

#### 1. Khách hàng (trên trang `/ho-tro`):
Khách chỉ làm việc với **Ticket hỗ trợ (SupportRequest)**:
* Nút **Gửi yêu cầu** ➔ `SupportRequestController` ➔ `SupportRequestService.createTicket()`
* Nút **Đã ổn** (xác nhận xong) ➔ `SupportRequestController` ➔ `SupportRequestService.confirmResolvedTicket()`
* Nút **Chưa xong** (mở lại ticket) ➔ `SupportRequestController` ➔ `SupportRequestService.reopenTicket()`
> 👉 **Mẹo:** Khách bấm cái gì ở trang Hỗ trợ thì 100% là **`SupportRequestController`** ➔ **`SupportRequestService`**!

#### 2. Nhân viên (trên trang `/staff` làm Task):
Staff làm việc trên **Bảng Task** nên mọi nút đều nằm ở **`StaffTask`**:
* Nút **Nhận việc** ➔ `StaffTaskController` ➔ `StaffTaskService.claimTask()`
* Nút **Cấp lại PIN** ➔ `StaffTaskController` ➔ `StaffTaskService.resetSupportContractPin()`
* Nút **Hoàn tất xử lý** ➔ `StaffTaskController` ➔ `StaffTaskService.resolveSupportTask()`
> 👉 **Mẹo:** Staff thao tác trong thẻ việc thì 100% là **`StaffTaskController`** ➔ **`StaffTaskService`**!

#### 3. Bồi thường hư hỏng (trên trang `/manager/claims` - F7-X4):
Cô chỉ vào bất kỳ nút nào ở trang Bồi thường (Claims):
* Nút **Tính thử** (quote)
* Nút **Chốt** (decide)
* Nút **Chi trả** (pay)
> 👉 **Mẹo:** Cứ thấy chữ Bồi thường / Claim ➔ 100% là **`CompensationClaimController`** ➔ **`CompensationClaimService`**!

---

## ⚡ 3. CÁCH NÓI "CHỮA CHÁY" THÔNG MINH NẾU QUÊN TÊN METHOD CỤ THỂ

Giảng viên hỏi: *"Nút [Cấp lại PIN] này gọi vào đâu em?"*

Nếu bạn **nhớ rõ**:
> *"Dạ thưa cô, nút này gọi `POST /api/v1/staff-tasks/{id}/reset-pin` vào `StaffTaskController`, method `resetPin()`, sau đó controller gọi sang `StaffTaskService.resetSupportContractPin()` để sinh mã PIN mới ạ."*

Nếu bạn **hơi quên tên chính xác của method**:
> *"Dạ thưa cô, vì đây là hành động của Nhân viên xử lý trên Task công việc nên request gửi về **`StaffTaskController`**, sau đó tầng Controller sẽ ủy quyền cho **`StaffTaskService`** xử lý nghiệp vụ reset mã PIN và cập nhật xuống hợp đồng ạ!"*

👉 **Đảm bảo 100% giảng viên gật đầu**, vì:
1. Bạn nắm đúng **Kiến trúc phân tầng (Controller ➔ Service ➔ Repository)**.
2. Bạn chỉ đúng **Domain đối tượng (StaffTask hay SupportRequest hay StorageUnit)**.
3. Không ai trừ điểm vì thiếu 1 chữ cái trong tên hàm Java khi bạn đã chỉ đúng file Controller và Service!

---

## 📋 TÓM GỌN TRONG 1 BÀN TAY (HỌC THUỘC LÒNG ĐÚNG KHỐI NÀY):

```
1. Dashboard cơ sở       ➔ FacilityController           ➔ FacilityService
2. Mặt bằng / Tầng       ➔ FloorPlanController          ➔ FloorPlanService
3. Ô kho (bảo trì/thêm)  ➔ StorageUnitController        ➔ StorageUnitService
4. Lịch ô kho            ➔ StorageUnitController        ➔ UnitScheduleService
5. Quản lý nhân viên     ➔ FacilityStaffController      ➔ FacilityStaffService
6. Quản lý công việc     ➔ StaffTaskController          ➔ StaffTaskService
7. Khách gửi ticket      ➔ SupportRequestController     ➔ SupportRequestService
8. Bồi thường hàng hóa   ➔ CompensationClaimController  ➔ CompensationClaimService
9. Xem hợp đồng          ➔ ContractController           ➔ RentalContractRepository
```
