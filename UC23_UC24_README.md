# Tài liệu Kỹ thuật & Nghiệp vụ: UC-23 (Nghiệm thu trả kho), UC-24 (Ghi nhận sự cố hư hỏng) & Quyết toán Hoàn tiền (PR-O1 → PR-O15)

**Phân hệ:** Vận hành Cơ sở & Quản lý Hợp đồng (Staff / Facility Manager / Customer)  
**Các Use Case bao gồm:**
- **UC-23:** Nghiệm thu trả kho (*Checkout Inspection*) — Actor: Nhân viên kho (**Staff**)
- **UC-24:** Ghi nhận sự cố hư hỏng & Khấu trừ cọc (*Record Damage Case*) — Actor: Nhân viên kho (**Staff**)
- **UC-22 & UC-25 (Nâng cấp):** Yêu cầu trả kho, tính hoàn tiền thuê trả sớm, phí ân hạn 5 ngày, phí trễ hạn và đối soát bằng chứng hoàn tiền — Actor: **Customer** & **Facility Manager (FM)**

---

## 1. Tổng quan Luồng Hoạt động (End-to-End Flow)

```
[1. KHÁCH HÀNG - UC-22]
Khách mở "Tùy chọn hợp đồng" → Tab "Trả kho" (ContractOptionsModal)
  ├── Chọn ngày hẹn trả kho: Từ ngày mai đến (end_date + 5 ngày ân hạn) [PR-O1]
  ├── Hệ thống hiển thị Bảng dự tính hoàn tiền trực tiếp (Real-time Preview):
  │     • Nếu trả sớm (ngày hẹn < end_date): Tính tiền hoàn các tháng chưa dùng (thu hồi chiết khấu + trừ 1 tháng phí phá HĐ) [PR-O2]
  │     • Nếu trả trong 5 ngày ân hạn: Ngày +1 miễn phí, ngày +2 → +5 tính (giá niêm yết / 30)/ngày [PR-O14]
  ├── Chọn phương thức nhận tiền hoàn: Chuyển khoản (Ngân hàng, Số TK, Chủ TK) hoặc Tiền mặt tại quầy [PR-O3]
  └── Bấm [Xác nhận trả kho] → Hợp đồng chuyển sang TERMINATION_PENDING, sinh Task CHECK_OUT (status = OPEN)

        ↓

[2. NHÂN VIÊN KHO (STAFF) - UC-23 & UC-24]
Staff vào Bảng công việc (/staff/tasks) → Bấm [Nhận việc] → Bấm [Nghiệm thu trả kho] (/staff/tasks/:id)
  ├── Bước 1 (Nhóm A - Điều kiện bắt buộc đạt):
  │     1. Đã xác minh CCCD của khách hàng
  │     2. Ô kho đã dọn trống hoàn toàn
  │     3. Khách đã ký biên bản nghiệm thu & trả thẻ RFID
  │     (Thiếu 1 trong 3 mục → Khóa nút xác nhận, không cho nghiệm thu [PR-O6])
  ├── Bước 2 (Nhóm B - Đánh giá hiện trạng ô kho):
  │     4. Ô kho sạch sẽ, không còn rác tồn đọng
  │     5. Khoá SmartLock & vách ô kho nguyên vẹn
  │     (Nếu bỏ tick 1 trong 2 mục → Hệ thống tự động cảnh báo cam & bắt buộc lập ít nhất 1 sự cố UC-24 [PR-O6])
  ├── Bước 3 (Ghi nhận sự cố hư hỏng - UC-24):
  │     • Thêm 1 hoặc nhiều hạng mục sự cố (Chọn nhanh Preset hoặc tự nhập tên, mô tả, chi phí đền bù ≥ 0)
  │     • Bắt buộc đính kèm ít nhất 1 ảnh bằng chứng hiện trường cho mỗi sự cố (nén tự động qua HTML5 Canvas)
  ├── Bước 4 (Bảng đối soát quyết toán tài chính tự động):
  │     • Tự động tổng hợp: Tiền cọc đang giữ + Hoàn tiền thuê trả sớm (PR-O2) − Phí ân hạn (PR-O14) − Phí trễ hạn (PR-Q3) − Tổng phí sự cố (UC-24)
  │     • Hiển thị rõ: Tổng tiền hoàn trả khách (Cọc hoàn + Tiền thuê trả sớm) và Khoản nợ vượt cọc (nếu có)
  └── Bấm [Hoàn tất nghiệm thu trả kho] → Xác nhận trong Popup

        ↓

[3. XỬ LÝ GIAO DỊCH ĐỒNG BỘ TẠI BACKEND (@Transactional)]
  ├── Lưu biên bản handover_records (record_type = 'CHECK_OUT')
  ├── Lưu danh sách sự cố vào bảng damage_cases (kèm mảng ảnh bằng chứng JSON)
  ├── Chuyển rental_contracts → TERMINATED, xóa access_pin_code = NULL & rfid_card_code = NULL [PR-O7]
  ├── Chuyển reservations → COMPLETED; đóng task CHECK_OUT → COMPLETED
  ├── Cập nhật trạng thái ô kho (storage_units):
  │     ├── Không có sự cố: Ô kho chuyển ngay sang AVAILABLE (Sẵn sàng cho khách mới thuê)
  │     └── Có sự cố: Ô kho chuyển sang MAINTENANCE + Tự động sinh 1 task MAINTENANCE (OPEN) để sửa chữa [PR-O7, PR-O10]
  ├── Ghi nhận các giao dịch tài chính vào payment_transactions:
  │     ├── Phí ân hạn / trễ hạn (nếu > 0): payment_type = 'LATE_FEE', method = 'DEPOSIT_OFFSET', status = 'SUCCESS'
  │     ├── Phí sự cố khấu trừ vào cọc: payment_type = 'DAMAGE_FEE', method = 'DEPOSIT_OFFSET', status = 'SUCCESS'
  │     ├── Phần nợ vượt cọc (nếu tổng trừ > tiền khách có): payment_type = 'DAMAGE_FEE', status = 'PENDING' [PR-O9]
  │     └── Giao dịch hoàn tiền (nếu tổng hoàn > 0): payment_type = 'REFUND', status = 'PENDING'
  └── Tự động sinh 1 Task REFUND trong facility_tasks (giao cho Facility Manager xử lý, tạo kể cả khi tiền hoàn = 0đ để FM đóng hồ sơ [PR-O11, PR-O12])

        ↓

[4. QUẢN LÝ CƠ SỞ (FACILITY MANAGER) - UC-25 / PR-O15]
Facility Manager vào Bảng công việc Quản lý (/manager/tasks) → Nhận & Xử lý Task REFUND
  ├── Xem chi tiết số tiền hoàn (tách bạch Hoàn cọc & Hoàn trả sớm) + Thông tin STK ngân hàng / Tiền mặt
  ├── Nếu hoàn qua Chuyển khoản: Bắt buộc nhập Mã giao dịch ngân hàng (Mã FT) + Link ảnh UNC (tùy chọn) [PR-O15]
  ├── Nếu hoàn Tiền mặt tại quầy: Bắt buộc tick "Khách đã ký biên nhận tiền mặt" + Ghi chú [PR-O15]
  └── Bấm [Xác nhận hoàn tất] → Task REFUND chuyển COMPLETED, giao dịch REFUND chuyển SUCCESS, ghi Activity Log đối soát
```

---

## 2. Chi tiết Logic Nghiệp vụ & Công thức Tính toán (Business Rules)

### 2.1. Quy tắc Phân nhóm Checklist Nghiệm thu (`PR-O6`)

Khác với Check-in (cả 5 mục đều phải tích chọn mới được bàn giao), biên bản **Check-out (UC-23)** chia 5 mục kiểm tra thành 2 nhóm có hành vi khác nhau:

| Nhóm | Mục kiểm tra | Field (`CheckOutRequest`) | Quy tắc kiểm tra |
|---|---|---|---|
| **Nhóm A: Điều kiện tiên quyết (Blocking)** | 1. Đã xác minh CCCD của khách hàng<br>2. Ô kho đã dọn trống hoàn toàn<br>3. Khách đã ký biên bản nghiệm thu & trả thẻ RFID | `identityVerified`<br>`unitEmpty`<br>`customerSignatureConfirmed` | **Bắt buộc đạt 3/3 (`true`)**. Nếu thiếu bất kỳ mục nào, khách chưa đủ điều kiện trả kho → Khóa nút Submit (Backend trả lỗi `400 Bad Request`). |
| **Nhóm B: Hiện trạng ô kho (Non-blocking)** | 4. Ô kho sạch sẽ, không còn rác tồn đọng<br>5. Khoá SmartLock & vách ô kho nguyên vẹn | `unitClean`<br>`lockIntact` | **Cho phép bỏ chọn (`false`)**, nhưng khi `unitClean == false` hoặc `lockIntact == false`, hệ thống **bắt buộc Staff phải thêm ít nhất 1 hạng mục sự cố (UC-24)** kèm ảnh chụp bằng chứng hiện trường. |

> **Lưu ý:** Ngay cả khi cả `unitClean` và `lockIntact` đều đạt (`true`), Staff vẫn có thể chủ động bấm **"Thêm hạng mục sự cố"** nếu phát hiện các vấn đề phát sinh khác (ví dụ: khách làm mất thẻ từ RFID cần khấu trừ phí làm lại thẻ).

---

### 2.2. Công thức Quyết toán Tài chính & Hoàn tiền (`PR-O2`, `PR-O11`, `PR-O14`, `PR-Q3`)

Toàn bộ logic tính toán được đóng gói tại phương thức `StaffTaskService.calculateCheckoutRefund()` (Backend) và đồng bộ hiển thị trực tiếp trên `StaffTaskDetailPage.jsx` & `ContractOptionsModal.jsx` (Frontend).

#### A. Hoàn tiền thuê khi khách trả kho sớm (`PR-O2` / Quyết định `D-10`)
Áp dụng khi ngày nghiệm thu thực tế $\text{today} < \text{end\_date}$ của hợp đồng:
1. **Số tháng đã sử dụng ($\text{usedMonths}$):** Tính từ `start_date` đến ngày nghiệm thu, **làm tròn lên theo tháng** (tối thiểu $1\text{ tháng}$).
   - *Ví dụ:* Hợp đồng bắt đầu `01/08/2026`, nghiệm thu ngày `05/09/2026` (1 tháng 4 ngày) $\rightarrow \text{usedMonths} = 2\text{ tháng}$.
2. **Tiền thuê kỳ hiện tại khách đã đóng ($\text{rentPaid}$):**
   $$\text{rentPaid} = \text{basePrice} \times \text{cycleMonths} \times (1 - \text{discountRate})$$
   *(Trong đó ưu đãi chu kỳ: 3 tháng giảm 5%, 6 tháng giảm 10%, 12 tháng giảm 15%).*
3. **Thu hồi ưu đãi & Phí phá hợp đồng:**
   - Các tháng đã dùng được tính lại theo **giá niêm yết gốc ($\text{basePrice}$)**, không áp dụng chiết khấu chu kỳ: $\text{usedCost} = \text{usedMonths} \times \text{basePrice}$.
   - Phí phá hợp đồng ($\text{breakFee}$): Bằng **$1\text{ tháng}$ giá niêm yết gốc** ($\text{basePrice}$).
4. **Số tiền thuê trả sớm được hoàn ($\text{earlyRentRefund}$):**
   $$\text{earlyRentRefund} = \max\Big(0,\ \text{rentPaid} - (\text{usedMonths} \times \text{basePrice}) - \text{basePrice}\Big)$$
   - *Ví dụ minh họa:* Gói 12 tháng, giá gốc $1.850.000\text{ đ/tháng}$ (giảm 15% $\rightarrow$ đã đóng $18.870.000\text{ đ}$). Khách dùng $2\text{ tháng}$ rồi trả kho sớm:
     $$\text{earlyRentRefund} = 18.870.000 - (2 \times 1.850.000) - 1.850.000 = 13.320.000\text{ đ}$$

#### B. Phí ân hạn chuyển đồ 5 ngày (`PR-O1` & `PR-O14` / Quyết định `D-11`)
Áp dụng khi khách trả kho sau ngày `end_date` từ $1 \rightarrow 5\text{ ngày}$ ($\text{daysPast} = \text{today} - \text{end\_date}$):
- **Ngày $\text{end\_date} + 1$ ($\text{daysPast} = 1$):** **Miễn phí ($0\text{ đ}$)** để tạo điều kiện cho khách dọn đồ.
- **Từ ngày $\text{end\_date} + 2$ đến $\text{end\_date} + 5$ ($2 \le \text{daysPast} \le 5$):** Tính tiền thuê theo ngày (không tính là phí phạt):
  $$\text{graceFee} = \text{round}\left(\frac{\text{basePrice}}{30}\right) \times (\text{daysPast} - 1)$$

#### C. Phí phạt quá hạn (`PR-Q3`)
Áp dụng khi hợp đồng đã rơi vào trạng thái `OVERDUE` hoặc nghiệm thu sau $\text{end\_date} + 5\text{ ngày}$ ($\text{daysPast} > 5$, lúc này mất quyền miễn phí ngày đầu và **thay thế** phí ân hạn):
$$\text{lateFee} = \text{depositHeld} \times \min(\text{daysPast}, 5) \times 10\%$$
*(Mỗi ngày trễ phạt $10\%$ tiền cọc, trần tối đa $50\%$ tiền cọc từ ngày thứ 5).*

#### D. Khấu trừ Tiền cọc, Bù trừ & Ghi nhận Nợ vượt cọc (`PR-O9`, `PR-O11`)
Gọi tổng các khoản khấu trừ là:
$$\text{totalDeductions} = \text{totalDamageCost} + \text{graceFee} + \text{lateFee}$$
1. **Khấu trừ vào Tiền cọc đang giữ ($\text{depositHeld}$):**
   - $\text{depositRefund} = \max(0,\ \text{depositHeld} - \text{totalDeductions})$
   - $\text{excessDebt} = \max(0,\ \text{totalDeductions} - \text{depositHeld})$
2. **Bù trừ với Tiền thuê hoàn trả sớm (nếu khách vừa trả sớm vừa làm hỏng kho vượt quá tiền cọc):**
   - Nếu $\text{excessDebt} > 0$ và $\text{earlyRentRefund} > 0$, hệ thống tự động lấy $\text{earlyRentRefund}$ bù vào phần thiếu trước khi phát sinh nợ cho khách.
3. **Tổng tiền thực nhận của khách ($\text{totalRefund}$):**
   $$\text{totalRefund} = \text{depositRefund} + \text{earlyRentRefund (sau bù trừ)}$$

---

### 2.3. Quy tắc Xử lý Trạng thái Ô kho & Bảo trì (`PR-O7`, `PR-O10`)

| Tình huống nghiệm thu | Trạng thái Ô kho (`storage_units.status`) | Công việc phát sinh (`facility_tasks`) |
|---|---|---|
| **Ô kho nguyên vẹn** (`unitClean = true`, `lockIntact = true`, `damageCases` rỗng) | Chuyển từ `OCCUPIED` $\rightarrow$ **`AVAILABLE`** (Sẵn sàng cho khách khác đặt ngay) | Chỉ sinh 1 task **`REFUND`** cho Facility Manager |
| **Có sự cố hư hỏng / bẩn** (bỏ tick hiện trạng hoặc `damageCases.size() > 0`) | Chuyển từ `OCCUPIED` $\rightarrow$ **`MAINTENANCE`** (Khóa không cho đặt mới để sửa chữa/vệ sinh) | Sinh 1 task **`REFUND`** + Sinh 1 task **`MAINTENANCE`** (`status = OPEN`, hạn 21:00 sau 3 ngày) kèm danh sách sự cố |

---

### 2.4. Quy tắc Bằng chứng Hoàn tiền (`PR-O15` / Sửa `L-24`)
Khi Facility Manager xử lý task `REFUND` trên màn hình Quản lý công việc:
- **Trường hợp Chuyển khoản (`BANK_TRANSFER`):**
  - **Bắt buộc** nhập **Mã giao dịch ngân hàng (Mã FT / Ủy nhiệm chi)** (`bankTransactionCode`).
  - Ảnh chụp màn hình chuyển khoản (`evidenceImageUrl`) là tùy chọn (khuyến khích đính kèm).
- **Trường hợp Tiền mặt tại quầy (`CASH`):**
  - **Bắt buộc** tích chọn xác nhận **"Khách hàng đã ký biên nhận tiền mặt tại quầy"** (`cashReceiptConfirmed = true`).
- Nếu thiếu bằng chứng tương ứng $\rightarrow$ Backend từ chối với lỗi `400 Bad Request (REFUND_EVIDENCE_REQUIRED)`.

---

## 3. Chi tiết Implementation (Database, Backend, Frontend)

### 3.1. Database Schema (`sql_script/Create_damage_cases.sql`)

Bảng mới **`damage_cases`** lưu trữ chi tiết từng hạng mục hư hỏng gắn với biên bản nghiệm thu `handover_records` và hợp đồng `rental_contracts`:

```sql
CREATE TABLE damage_cases (
    id                  INT IDENTITY(1,1) PRIMARY KEY,
    handover_record_id  INT NOT NULL,
    contract_id         INT NOT NULL,
    storage_unit_id     NVARCHAR(20) NOT NULL,
    reported_by         INT NOT NULL,
    title               NVARCHAR(200) NOT NULL,         -- Tên hạng mục sự cố
    description         NVARCHAR(MAX) NULL,             -- Mô tả chi tiết hiện trạng
    evidence_image_urls NVARCHAR(MAX) NOT NULL,         -- Mảng JSON chứa các ảnh bằng chứng (Data URL / Link)
    estimated_cost      DECIMAL(12,2) NOT NULL DEFAULT 0, -- Chi phí đền bù / vệ sinh (VNĐ)
    status              NVARCHAR(30) NOT NULL DEFAULT 'DEDUCTED',
                        -- DEDUCTED (Đã cấn trừ đủ trong cọc) / PENDING_DEBT (Vượt cọc, còn nợ) / RESOLVED
    created_at          DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT FK_damage_handover    FOREIGN KEY (handover_record_id) REFERENCES handover_records(id),
    CONSTRAINT FK_damage_contract    FOREIGN KEY (contract_id)        REFERENCES rental_contracts(id),
    CONSTRAINT FK_damage_storageunit FOREIGN KEY (storage_unit_id)    REFERENCES storage_units(id),
    CONSTRAINT FK_damage_reporter    FOREIGN KEY (reported_by)        REFERENCES users(id)
);
```

**Ảnh hưởng lên các bảng hiện có khi thực hiện UC-23 & UC-24:**
1. **`handover_records`**: Thêm 1 dòng có `record_type = 'CHECK_OUT'`, lưu kết quả 5 mục kiểm tra và ghi chú.
2. **`damage_cases`**: Thêm $N$ dòng sự cố (nếu có) liên kết với `handover_record_id` vừa tạo.
3. **`rental_contracts`**: Cập nhật `status = 'TERMINATED'`, `access_pin_code = NULL`, `rfid_card_code = NULL`.
4. **`reservations`**: Cập nhật `status = 'COMPLETED'`.
5. **`storage_units`**: Cập nhật `status = 'AVAILABLE'` (hoặc `'MAINTENANCE'` nếu có sự cố).
6. **`payment_transactions`**:
   - Ghi nhận khấu trừ phí ân hạn/trễ hạn: `payment_type = 'LATE_FEE'`, `payment_method = 'DEPOSIT_OFFSET'`, `status = 'SUCCESS'`.
   - Ghi nhận khấu trừ phí sự cố trong phạm vi cọc: `payment_type = 'DAMAGE_FEE'`, `payment_method = 'DEPOSIT_OFFSET'`, `status = 'SUCCESS'`.
   - Ghi nhận khoản nợ vượt cọc (nếu có): `payment_type = 'DAMAGE_FEE'`, `payment_method = 'CASH'`, `status = 'PENDING'`.
   - Ghi nhận lệnh chờ hoàn tiền cho khách (nếu tổng hoàn $> 0$): `payment_type = 'REFUND'`, `payment_method = 'BANK_TRANSFER' | 'CASH'`, `status = 'PENDING'`.
7. **`facility_tasks`**:
   - Đóng task `CHECK_OUT` hiện tại (`status = 'COMPLETED'`, `completed_at = SYSDATETIME()`).
   - Sinh 1 task `REFUND` (`status = 'OPEN'`, hạn xử lý tính theo 3 ngày làm việc T2–T6 không tính T7/CN theo `PR-93`).
   - Sinh 1 task `MAINTENANCE` (`status = 'OPEN'`) nếu ô kho có sự cố.
8. **`activity_logs`**: Ghi nhận đầy đủ lịch sử nghiệm thu, mã biên bản, chi phí sự cố, chi tiết hoàn trả sớm và bằng chứng hoàn tiền.

---

### 3.2. Các API Endpoints

| Method | Endpoint | Actor | Mô tả chức năng |
|---|---|---|---|
| `POST` | `/api/v1/contracts/{id}/checkout` | Customer | Khách gửi yêu cầu hẹn ngày trả kho (`PR-O1`) kèm phương thức nhận tiền hoàn (`PR-O3`) |
| `GET` | `/api/v1/staff/tasks/{id}?userId={uid}` | Staff / FM | Lấy chi tiết task `CHECK_IN` / `CHECK_OUT` kèm thông tin giá gốc, chu kỳ, biên bản, danh sách sự cố và bảng tính hoàn tiền |
| `POST` | `/api/v1/staff/tasks/{id}/check-out?userId={uid}` | Staff | **UC-23 & UC-24:** Gửi biên bản nghiệm thu trả kho + danh sách sự cố kèm ảnh bằng chứng |
| `POST` | `/api/v1/staff/tasks/{id}/complete-refund?userId={uid}` | Facility Manager | **UC-25 / PR-O15:** Xác nhận hoàn tất task `REFUND` kèm mã giao dịch ngân hàng (`FT`) hoặc xác nhận ký nhận tiền mặt |

#### Mẫu Request Body — `POST /api/v1/staff/tasks/{id}/check-out`
```json
{
  "identityVerified": true,
  "unitEmpty": true,
  "unitClean": false,
  "lockIntact": true,
  "customerSignatureConfirmed": true,
  "notes": "Khách đã dọn hết đồ nhưng để lại nhiều thùng carton rách cần dọn vệ sinh.",
  "damageCases": [
    {
      "title": "Phí vệ sinh rác thải tồn đọng trong kho",
      "description": "Khách để lại rác thải, bao bì cần nhân viên dọn vệ sinh công nghiệp.",
      "estimatedCost": 150000,
      "evidenceImages": [
        "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD..."
      ]
    }
  ]
}
```

#### Mẫu Request Body — `POST /api/v1/staff/tasks/{id}/complete-refund`
```json
{
  "paymentMethod": "BANK_TRANSFER",
  "bankTransactionCode": "FT26290123456789",
  "evidenceImageUrl": "https://i.imgur.com/unc-receipt-demo.png",
  "cashReceiptConfirmed": false,
  "note": "Đã chuyển khoản Vietcombank hoàn cọc và tiền thuê trả sớm cho khách"
}
```

---

### 3.3. Danh sách File đã Thêm mới & Nâng cấp

#### Backend (`backend/api/src/main/java/com/queenkho/api/`)
- [DamageCase.java](file:///h:/Study/New%20folder/backend/api/src/main/java/com/queenkho/api/entity/DamageCase.java) *(Mới)* — JPA Entity ánh xạ bảng `damage_cases`.
- [DamageCaseRepository.java](file:///h:/Study/New%20folder/backend/api/src/main/java/com/queenkho/api/repository/DamageCaseRepository.java) *(Mới)* — Repository truy vấn danh sách sự cố theo `handoverRecordId` hoặc `contractId`.
- [CheckOutRequest.java](file:///h:/Study/New%20folder/backend/api/src/main/java/com/queenkho/api/dto/CheckOutRequest.java) *(Mới)* — DTO nhận dữ liệu nghiệm thu 5 mục + danh sách `DamageCaseItemRequest` (tên, mô tả, chi phí, mảng ảnh bằng chứng).
- [DamageCaseResponse.java](file:///h:/Study/New%20folder/backend/api/src/main/java/com/queenkho/api/dto/DamageCaseResponse.java) *(Mới)* — DTO trả thông tin từng sự cố và mảng ảnh bằng chứng đã parse từ JSON.
- [RefundCalculationResult.java](file:///h:/Study/New%20folder/backend/api/src/main/java/com/queenkho/api/dto/RefundCalculationResult.java) *(Mới)* — DTO đóng gói toàn bộ kết quả quyết toán tài chính (`depositRefund`, `earlyRentRefund`, `graceFee`, `lateFee`, `damageDeducted`, `totalRefund`, `excessDebt`, `breakdownNote`).
- [CompleteRefundRequest.java](file:///h:/Study/New%20folder/backend/api/src/main/java/com/queenkho/api/dto/CompleteRefundRequest.java) *(Mới)* — DTO nhận bằng chứng hoàn tiền theo `PR-O15` (Mã FT ngân hàng, ảnh bằng chứng, xác nhận ký nhận tiền mặt, ghi chú).
- [StaffTaskDetailResponse.java](file:///h:/Study/New%20folder/backend/api/src/main/java/com/queenkho/api/dto/StaffTaskDetailResponse.java) *(Cập nhật)* — Bổ sung các trường thông tin gói cước (`baseMonthlyPrice`, `cycleMonths`) và chi tiết quyết toán (`damageCases`, `totalDamageCost`, `refundAmount`, `depositRefund`, `earlyRentRefund`, `graceFee`, `lateFee`, `excessDebtAmount`, `refundBreakdownNote`).
- [StaffTaskRepository.java](file:///h:/Study/New%20folder/backend/api/src/main/java/com/queenkho/api/repository/StaffTaskRepository.java) *(Cập nhật)* — Lấy thêm `ut.monthly_price`, `rc.billing_cycle_months` và thêm hàm `completeCheckOut(...)` thực thi cập nhật đồng bộ hợp đồng, đơn đặt chỗ, ô kho và đóng ticket hỗ trợ mở (`PR-S8`).
- [StaffTaskService.java](file:///h:/Study/New%20folder/backend/api/src/main/java/com/queenkho/api/service/StaffTaskService.java) *(Cập nhật)* — Triển khai `checkOut()`, `calculateCheckoutRefund()`, `calculateRefundDeadline()` (3 ngày làm việc T2–T6) và nâng cấp `completeRefundTask()` theo `PR-O15`.
- [ContractService.java](file:///h:/Study/New%20folder/backend/api/src/main/java/com/queenkho/api/service/ContractService.java) *(Cập nhật)* — Nâng cấp `requestCheckout()` cho phép hẹn trả kho trong khung ân hạn `end_date + 5 ngày` (`PR-O1`) hoặc 3 ngày tới nếu `OVERDUE`, đồng thời chuẩn hóa chuỗi ghi chú phương thức nhận tiền (`[HOÀN TIỀN - CK]` / `[HOÀN TIỀN - TIỀN MẶT]`).
- [StaffTaskController.java](file:///h:/Study/New%20folder/backend/api/src/main/java/com/queenkho/api/controller/StaffTaskController.java) *(Cập nhật)* — Thêm endpoint `POST /{id}/check-out` và nâng cấp `POST /{id}/complete-refund`.

#### Frontend (`frontend/src/`)
- [StaffTaskDetailPage.jsx](file:///h:/Study/New%20folder/frontend/src/pages/staff/StaffTaskDetailPage.jsx) *(Cập nhật)* — Giao diện thực hiện UC-23 & UC-24 theo 4 bước trực quan, tích hợp bộ nén ảnh HTML5 Canvas, Chips gợi ý sự cố, nút Giả lập hoàn thiện / Giả lập kèm sự cố, Lightbox xem ảnh phóng to và Bảng đối soát quyết toán tài chính thời gian thực.
- [StaffTaskBoardPage.jsx](file:///h:/Study/New%20folder/frontend/src/pages/staff/StaffTaskBoardPage.jsx) *(Cập nhật)* — Mở khóa nút **"Nghiệm thu trả kho"** cho các task `CHECK_OUT` đang ở trạng thái `IN_PROGRESS`.
- [TaskBoard.jsx](file:///h:/Study/New%20folder/frontend/src/components/TaskBoard.jsx) *(Cập nhật)* — Thêm badge hiển thị loại công việc `MAINTENANCE` (Bảo trì kho).
- [ContractOptionsModal.jsx](file:///h:/Study/New%20folder/frontend/src/components/ContractOptionsModal.jsx) *(Cập nhật)* — Nâng cấp Tab "Trả kho" của khách hàng: mở rộng date picker đến `end_date + 5 ngày`, hiển thị bảng tính dự kiến hoàn tiền trả sớm (`PR-O2`) và phí ân hạn (`PR-O14`), chọn Chuyển khoản hoặc Tiền mặt (`PR-O3`).
- [ManagerTaskBoardPage.jsx](file:///h:/Study/New%20folder/frontend/src/pages/manager/ManagerTaskBoardPage.jsx) *(Cập nhật)* — Nâng cấp Modal xác nhận hoàn tiền của Facility Manager theo `PR-O15` (bắt buộc nhập mã FT khi chuyển khoản hoặc tick ký nhận khi hoàn tiền mặt).
- [staffTaskService.js](file:///h:/Study/New%20folder/frontend/src/services/staffTaskService.js) *(Cập nhật)* — Bổ sung hàm `checkOutStaffTask()` và cập nhật `completeRefundTask()`.

---

## 4. Cách hoạt động của Giao diện UI/UX (UI Walkthrough)

### 4.1. Giao diện Khách hàng hẹn trả kho ([ContractOptionsModal.jsx](file:///h:/Study/New%20folder/frontend/src/components/ContractOptionsModal.jsx))
1. Khách hàng vào mục **Hợp đồng của tôi** $\rightarrow$ bấm **Tùy chọn** $\rightarrow$ chuyển sang tab **Trả kho**.
2. **Chọn ngày hẹn trả kho:**
   - Lịch cho phép chọn từ **ngày mai** đến tối đa **`end_date` + 5 ngày** (5 ngày ân hạn chuyển đồ).
3. **Bảng dự tính hoàn tiền tự động (Live Preview Box):**
   - Nếu khách chọn ngày hẹn **trước `end_date`** (Trả kho sớm): Hiển thị khung màu xanh dương thông báo số tháng đã sử dụng, tiền thuê kỳ hiện tại đã đóng, chi phí tính lại theo giá gốc, phí phá hợp đồng 1 tháng và **số tiền thuê trả sớm dự kiến được hoàn lại**.
   - Nếu khách chọn ngày hẹn **trong 5 ngày ân hạn**: Hiển thị thông báo miễn phí cho ngày `end_date + 1`, hoặc hiển thị số phí ân hạn theo ngày (`giá gốc / 30`) từ ngày `+2` đến `+5`.
   - Hiển thị **Tổng tiền dự kiến nhận lại** = Tiền cọc đang giữ + Hoàn tiền thuê trả sớm − Phí ân hạn.
4. **Chọn phương thức nhận tiền (`PR-O3`):**
   - Hai nút chuyển đổi trực quan: **Chuyển khoản ngân hàng** (nhập Ngân hàng, Số tài khoản, Chủ tài khoản) hoặc **Nhận tiền mặt tại quầy** (hiển thị hướng dẫn mang CCCD đến quầy cơ sở).

---

### 4.2. Giao diện Nhân viên Nghiệm thu & Ghi nhận sự cố ([StaffTaskDetailPage.jsx](file:///h:/Study/New%20folder/frontend/src/pages/staff/StaffTaskDetailPage.jsx))

Khi Staff bấm **"Nghiệm thu trả kho"** trên một task `CHECK_OUT` đang xử lý, màn hình hiển thị bố cục 2 cột:
- **Cột trái:** Thông tin ô kho, hợp đồng, khách hàng, tiền cọc đang giữ, giá niêm yết gốc, chu kỳ thuê và yêu cầu nhận tiền hoàn của khách.
- **Cột phải (Form Nghiệm thu 4 bước):**
  - **Thanh công cụ Demo nhanh (ở góc trên bên phải):**
    - Nút **`Giả lập nguyên vẹn`**: Tự động tick đạt cả 5 mục, xóa danh sách sự cố $\rightarrow$ Phù hợp để test nhanh kịch bản trả kho hoàn hảo.
    - Nút **`Giả lập kèm sự cố`**: Tự động tick 3 mục bắt buộc, bỏ tick mục "Ô kho sạch sẽ", đồng thời tạo sẵn 1 hạng mục sự cố mẫu kèm **ảnh bằng chứng SVG tự sinh** $\rightarrow$ Phù hợp để demo nhanh kịch bản UC-24 mà không cần tìm file ảnh trên máy.
  - **Bước 1 — Điều kiện tiên quyết (Khung Xanh lá):**
    - Gồm 3 checkbox bắt buộc: Xác minh CCCD, Ô kho đã dọn trống hoàn toàn, Khách đã ký biên bản & trả thẻ RFID.
    - Nếu chưa tick đủ 3/3, hệ thống hiển thị thanh cảnh báo và khóa nút Submit.
  - **Bước 2 — Đánh giá hiện trạng ô kho (Khung Xanh dương):**
    - Gồm 2 checkbox mặc định được bật sẵn: *"Ô kho sạch sẽ, không còn rác tồn đọng"* và *"Khoá SmartLock & vách ô kho nguyên vẹn"*.
    - Ngay khi Staff **bỏ chọn** 1 trong 2 mục này, giao diện lập tức đổi sang tông cảnh báo cam và yêu cầu khai báo sự cố ở Bước 3.
  - **Bước 3 — Ghi nhận sự cố hư hỏng & Bằng chứng hiện trường (UC-24 - Khung Cam):**
    - **Chips gợi ý nhanh (Quick Presets):** 4 nút bấm nhanh (*Phí vệ sinh rác thải 150.000đ*, *Mất/hỏng thẻ RFID 100.000đ*, *Hỏng chốt SmartLock 350.000đ*, *Móp vách ngăn 500.000đ*) giúp Staff điền nhanh chỉ với 1 cú click.
    - **Danh sách thẻ sự cố (Damage Cards):** Mỗi sự cố gồm Tên hạng mục, Chi phí đền bù (VNĐ), Mô tả chi tiết và vùng **Tải ảnh bằng chứng hiện trường**.
    - **Xử lý ảnh thông minh:** Khi Staff chọn ảnh từ máy/điện thoại, hàm `compressImageToDataUrl()` tự động nén ảnh qua HTML5 Canvas về kích thước tối đa `800px` (JPEG quality `0.75`), hiển thị thumbnail ngay lập tức và cho phép bấm vào ảnh để **phóng to (Lightbox Modal)**.
    - Nếu có sự cố nhưng chưa tải ảnh lên, hệ thống báo lỗi rõ ràng tại sự cố đó và không cho phép bấm Hoàn tất.
  - **Bước 4 — Bảng đối soát quyết toán tài chính (Live Settlement Card):**
    - Tự động cập nhật ngay khi Staff thêm/xóa sự cố hoặc sửa số tiền đền bù:
      - `(1) Tiền cọc đang giữ`
      - `+) Hoàn tiền thuê trả sớm (PR-O2)` *(nếu trả kho trước hạn, kèm giải thích số tháng đã dùng & phí phá HĐ)*
      - `-) Phí ân hạn chuyển đồ / Phí phạt quá hạn` *(nếu trả sau ngày kết thúc)*
      - `-) Tổng phí đền bù sự cố (UC-24)`
      - **`(=) TỔNG TIỀN HOÀN TRẢ KHÁCH`** (Tách rõ: Hoàn cọc + Hoàn trả sớm).
      - Nếu tổng khấu trừ vượt quá số tiền khách có: Hiển thị cảnh báo đỏ **`Khách cần đóng thêm (Nợ vượt cọc)`** và thông báo ô kho sẽ chuyển sang trạng thái **`Đang bảo trì (MAINTENANCE)`**.

---

### 4.3. Giao diện Quản lý cơ sở Xác nhận Hoàn tiền ([ManagerTaskBoardPage.jsx](file:///h:/Study/New%20folder/frontend/src/pages/manager/ManagerTaskBoardPage.jsx))
1. Sau khi Staff hoàn tất nghiệm thu, một task **`REFUND`** xuất hiện trên bảng công việc của **Facility Manager**.
2. Khi FM bấm **"Xử lý hoàn cọc"**, Modal hiển thị:
   - Thông tin hợp đồng, tổng số tiền cần hoàn và chi tiết cấu thành (Hoàn cọc + Hoàn tiền thuê trả sớm).
   - Hệ thống tự động nhận diện phương thức khách đã chọn (`BANK_TRANSFER` hoặc `CASH`) từ ghi chú task:
     - **Nếu là Chuyển khoản:** Hiển thị thông tin Ngân hàng / Số TK / Chủ TK của khách, yêu cầu FM nhập **Mã giao dịch ngân hàng (Mã FT)** (bắt buộc) và link ảnh chụp màn hình chuyển khoản (nếu có).
     - **Nếu là Tiền mặt:** Yêu cầu FM tích vào ô **"Xác nhận khách hàng đã ký biên nhận tiền mặt tại quầy"** (bắt buộc) và nhập ghi chú thu ngân.
3. Sau khi xác nhận, task `REFUND` chuyển sang `COMPLETED` và giao dịch `REFUND` trong `payment_transactions` được cập nhật thành `SUCCESS`.

---

## 5. Kịch bản Kiểm thử (Test Cases) & Câu lệnh SQL Đối soát

### Các kịch bản kiểm thử nhanh trên UI:
1. **Case 1 — Trả kho đúng hạn, ô kho nguyên vẹn (Happy Path):**
   - Vào task `CHECK_OUT` $\rightarrow$ Bấm **`Giả lập nguyên vẹn`** $\rightarrow$ Bấm **`Hoàn tất nghiệm thu trả kho`**.
   - **Kết quả:** Hợp đồng `TERMINATED`, mất mã PIN/RFID, ô kho về `AVAILABLE`, sinh 1 task `REFUND` hoàn 100% cọc.
2. **Case 2 — Trả kho sớm (Early Checkout - `PR-O2`):**
   - Dùng hợp đồng có `end_date > hôm nay` (ví dụ gói 6 tháng hoặc 12 tháng mới dùng 1–2 tháng).
   - Kiểm tra Bước 4 trên màn hình nghiệm thu: Dòng **`+) Hoàn tiền thuê trả sớm (PR-O2)`** tự động tính số tiền hoàn sau khi trừ các tháng đã dùng (giá gốc) và 1 tháng phí phá hợp đồng.
3. **Case 3 — Trả kho có sự cố hư hỏng trong phạm vi tiền cọc (`UC-24`):**
   - Bấm **`Giả lập kèm sự cố`** (hoặc bỏ chọn "Ô kho sạch sẽ", bấm chip *"Phí vệ sinh rác thải 150.000đ"* và tải 1 ảnh bất kỳ).
   - **Kết quả:** Ô kho chuyển sang `MAINTENANCE`, sinh 1 task `MAINTENANCE` + 1 task `REFUND` với số tiền cọc đã trừ `150.000đ`.
4. **Case 4 — Trả kho có sự cố nghiêm trọng vượt quá tiền cọc (`PR-O9`):**
   - Thêm sự cố có chi phí lớn hơn tiền cọc (ví dụ `5.000.000đ` trong khi cọc `1.500.000đ`).
   - **Kết quả:** Tiền hoàn = `0đ` (vẫn tạo task `REFUND` `0đ` để FM đóng hồ sơ theo `PR-O11`), phát sinh khoản nợ vượt cọc `3.500.000đ` (`DAMAGE_FEE` `PENDING` trong `payment_transactions`), `damage_cases.status = 'PENDING_DEBT'`.

### Câu lệnh SQL kiểm tra dữ liệu trong SSMS:
```sql
USE QueenKhoDB;
GO

-- 1. Kiểm tra biên bản nghiệm thu CHECK_OUT và danh sách sự cố UC-24
SELECT hr.id AS handover_id, hr.contract_id, hr.record_type,
       hr.is_identity_verified, hr.is_empty, hr.is_clean, hr.is_lock_intact,
       dc.id AS damage_id, dc.title, dc.estimated_cost, dc.status AS damage_status
FROM handover_records hr
LEFT JOIN damage_cases dc ON dc.handover_record_id = hr.id
WHERE hr.record_type = 'CHECK_OUT'
ORDER BY hr.id DESC;

-- 2. Kiểm tra trạng thái Hợp đồng (PIN/RFID đã xóa) và trạng thái Ô kho
SELECT rc.id, rc.contract_code, rc.status AS contract_status,
       rc.access_pin_code, rc.rfid_card_code,
       su.id AS unit_id, su.status AS unit_status
FROM rental_contracts rc
JOIN storage_units su ON su.id = rc.storage_unit_id
WHERE rc.status = 'TERMINATED';

-- 3. Kiểm tra các giao dịch tài chính sinh ra (REFUND, DAMAGE_FEE, LATE_FEE)
SELECT id, transaction_code, contract_id, payment_type, payment_method, amount, status, paid_at
FROM payment_transactions
WHERE payment_type IN ('REFUND', 'DAMAGE_FEE', 'LATE_FEE')
ORDER BY id DESC;

-- 4. Kiểm tra các Task REFUND và MAINTENANCE được tạo tự động
SELECT id, facility_id, task_type, contract_id, status, due_at, evidence_image_url, note
FROM facility_tasks
WHERE task_type IN ('CHECK_OUT', 'REFUND', 'MAINTENANCE')
ORDER BY id DESC;
```
