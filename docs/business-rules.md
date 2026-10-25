# QueenKho — Business Rules

> Cập nhật: 17/10/2026 · Nguồn: code trên `main` (commit `e887c67`) + file phân công `SWP391_Task` + các buổi chốt nghiệp vụ + góp ý thành viên (17/10, mục 7).
>
> **Ký hiệu**
> - **BR-xx** — rule **đang chạy trong code**. Dòng có ~~gạch~~ là rule cũ **đã bị thay** bởi PR ghi bên cạnh.
> - **PR-xx** — rule **nhóm đã chốt**, **chưa code** (hoặc code chưa đúng) → làm theo khi code UC.
> - **D-xx** — quyết định nghiệp vụ lớn (mục 1.2). **L-xx** — lỗi / chỗ lệch trong code hiện tại (mục 4).
> - ✅ đã xong · 🟡 làm dở / giao diện giả · ⬜ chưa làm.
>
> Mã rule giữ nguyên qua các lần sửa để PR/commit trích dẫn được — **không đánh số lại**.
> Mã đã bỏ (bị gộp vào mã khác): PR-01, 02 → PR-A1 · PR-16 → PR-M7 · PR-23 → PR-M14 · PR-30…33 → PR-O5…O9 · PR-40, 41 → PR-O11, O12 · PR-42…44 → PR-Q1…Q10 · PR-45 → PR-Q12 · PR-53 → PR-R9.

**Mục lục**
0. [Tổng quan](#0-tổng-quan)
1. [Quy ước chung & quyết định lớn](#1-quy-ước-chung--quyết-định-lớn)
2. [Vòng đời trạng thái](#2-vòng-đời-trạng-thái)
3. [Rule theo từng UC](#3-rule-theo-từng-uc)
4. [Lỗi trong code hiện tại](#4-lỗi-trong-code-hiện-tại)
5. [Thay đổi schema cần làm](#5-thay-đổi-schema-cần-làm)
6. [Mã lỗi API](#6-mã-lỗi-api)
7. [Lịch sử thay đổi theo góp ý](#7-lịch-sử-thay-đổi-theo-góp-ý)

---

## 0. Tổng quan

### 0.1 Tính năng theo vai trò

| Vai trò | UC | Trạng thái |
|---|---|---|
| **Customer** | UC-02 Đăng ký · UC-09 Tìm kho · UC-10 Đặt chỗ · UC-11 Thanh toán cọc · UC-12 Đơn của tôi · UC-15 Huỷ đơn · UC-19 Hợp đồng của tôi · UC-21 Gia hạn · UC-22 Yêu cầu trả kho | ✅ |
| | UC-20 Lịch sử & khoản phải thanh toán (đổi phạm vi — PR-50) · UC-26 Gửi yêu cầu hỗ trợ | ⬜ |
| **Staff** | UC-16 Bảng công việc · UC-17 Nhận việc · UC-18 Check-in & biên bản | ✅ |
| | UC-23 Nghiệm thu trả kho · UC-24 Sự cố hư hỏng · UC-27 Xử lý hỗ trợ | ⬜ |
| **Facility Manager** | UC-13 Đơn chờ gán ô · UC-14 Gán ô + sinh hợp đồng · EX-03 No-Show / dời lịch · UC-16/17 Xem bảng việc, gỡ người nhận · Xem khách hàng & hợp đồng | ✅ |
| | UC-06 Ô kho · UC-30 Dashboard | 🟡 giao diện giả |
| | UC-32 Quản lý nhân viên | ✅ |
| | UC-25 Hoàn cọc · UC-28 Hợp đồng quá hạn | ⬜ |
| **BOM** | UC-04 Cơ sở · UC-05 Loại kho & giá · UC-07 Chính sách thuê · UC-29 Doanh thu | ⬜ (portal `/bom` đã có) |
| **Admin** | UC-03 Vai trò · UC-08 Tài khoản · UC-31 Nhật ký · Dashboard `/admin` | ✅ |
| **Chung** | UC-01 Đăng nhập | ✅ |
| **Hệ thống** | EX-01 Hết hạn giữ chỗ · EX-02 Thanh toán lỗi · job task quá hạn | ✅ |

### 0.2 Việc tiên quyết
- ~~**Portal riêng `/bom` và `/admin`**~~ ✅ Đã có: `/admin` (#56, `getHomePath(role)` điều hướng theo role), `/bom` (UC-04).
- **Entity `RentalPolicy`** (PR-Q13) → cần cho UC-07, UC-15 (PR-15), UC-28.
- **Task `REFUND` cho FM** (PR-O12, đã có từ #55 / #57) → dùng chung cho UC-15, EX-03, UC-23, UC-28; các UC sau chỉ cần sinh task `REFUND`.

---

## 1. Quy ước chung & quyết định lớn

### 1.1 Rule chung
| Mã | Rule |
|---|---|
| PR-90 | Mọi API lấy người thao tác từ **token**, không nhận `customerId`/`managerId`/`staffId` qua query. Khách chỉ xem/thao tác **đơn & hợp đồng của mình**; FM/Staff chỉ dữ liệu **cơ sở mình**. *(nợ kỹ thuật, làm sau)* |
| PR-91 | Mọi thay đổi trạng thái nằm trong 1 `@Transactional` và ghi `activity_logs` (chi tiết: PR-A9). |
| PR-92 | Tiền VND, làm tròn đến đồng; giờ `Asia/Ho_Chi_Minh`. Tách 2 khung giờ: **Giờ quầy (Staff Desk Hours) đóng lúc 21:00** — là hạn của mọi task (check-in, nghiệm thu, hỗ trợ); **Giờ ra vào kho (Customer Access) 24/7** — khách có hợp đồng `ACTIVE` / `TERMINATION_PENDING` tự ra vào bằng PIN / RFID bất kể giờ nào (`OVERDUE` bị khoá PIN — PR-Q5). |
| PR-93 | Hạn xử lý tiền hoàn: **24h, không tính Chủ Nhật** (`ReservationService.calculateRefundDeadline`). |

### 1.2 Quyết định lớn (đã chốt 16/10/2026)
| Mã | Quyết định | Ảnh hưởng |
|---|---|---|
| D-01 | **Trả trước theo kỳ**: lúc đặt trả **cọc** (mặc định 1 tháng; BOM chỉnh hệ số — PR-M6) **+ tiền thuê cả kỳ**. Hết kỳ muốn thuê tiếp thì trả kỳ mới, chọn lại 1 / 3 / 6 / 12 tháng. Không thu hằng tháng. | Code đã đúng (BR-24). UC-20 đổi phạm vi (PR-50). |
| D-02 | Chỉ đặt được khi **còn suất** đúng loại + cơ sở. Đặt chỗ **giữ tạm** 1 suất, gán ô mới **trừ thật**. FM chỉ gán **đúng loại**. | PR-B1, PR-M10; sửa L-11, L-13. |
| D-03 | Tài khoản `STAFF` do **cả FM và Admin** tạo. | PR-22. |
| D-04 | **FM** thực hiện hoàn tiền, qua task `REFUND` trong `facility_tasks` (đã code ở #55, #57). | PR-O12; L-01 đã sửa. |
| D-05 | **Bỏ cột** `rental_policy.lock_account_days`. | Nghĩa làm trong nhánh UC-07 (mục 5). |
| D-06 | **Bỏ voucher.** | PR-B9; sửa L-04. |
| D-07 | **No-Show**: mặc định tịch thu 100% cọc, **hoàn toàn bộ tiền thuê**. FM được **"Miễn phạt"** (bắt buộc lý do) → hoàn cả cọc. Chỉ được bấm No-Show sau **≥ 2 lần liên hệ thất bại cách nhau ≥ 24h** và đã qua **48h** từ giờ hẹn. | PR-X1, PR-X3; sửa L-06. |
| D-08 | **Giữ 2 bảng ưu đãi**: đặt mới 1/3/6/12T giảm **0/5/10/15%**; gia hạn **0/0/5/10%**. | Gom % về 1 chỗ ở BE, FE lấy từ API (hiện đang lặp ở `VnpayService`, `ContractService`, `CreateReservationPage.jsx`, `ContractOptionsModal.jsx`). |
| D-09 | **Thanh lý**: trừ phí trễ 50% cọc; **50% còn lại tạm giữ**, chỉ hoàn khi khách đến cơ sở làm việc với FM. | PR-Q9. |
| D-10 | **Trả kho sớm được hoàn tiền thuê** theo nguyên tắc *thu hồi ưu đãi + phí phá hợp đồng* (thay quy định "trả sớm không hoàn"). | PR-O2. |
| D-11 | **Ân hạn dọn đồ**: miễn phí **1 ngày** sau `end_date`; ngày 2 → 5 tính **tiền thuê theo ngày**, trừ vào cọc. | PR-O1, PR-O14. |

### 1.3 Ma trận vai trò → màn hình
| Nhóm màn hình | CUSTOMER | STAFF | FM | BOM | ADMIN |
|---|:-:|:-:|:-:|:-:|:-:|
| Tìm & đặt kho, Kho của tôi, Hỗ trợ | ✔ | | | | |
| Bảng công việc, check-in / nghiệm thu, sự cố, xử lý hỗ trợ | | ✔ | xem, gỡ người nhận, gia hạn task hỗ trợ | | |
| Đơn chờ gán ô, No-Show, ô kho, hợp đồng quá hạn, dashboard cơ sở, hoàn tiền | | | ✔ | | |
| Tạo / khoá tài khoản Staff | | | ✔ (cơ sở mình) | | ✔ |
| Cơ sở, loại kho & giá, chính sách, doanh thu | | | xem chính sách | ✔ | |
| Vai trò, người dùng, nhật ký | | | | | ✔ |

---

## 2. Vòng đời trạng thái

> Sơ đồ là **trạng thái đích** sau khi áp dụng mọi PR. Ghi chú ⚙️ = phần đang chạy trong code.

### 2.1 Đơn đặt chỗ — `reservations.status`
```
                 ┌── VNPAY lỗi / khách huỷ trên VNPAY: vẫn PENDING, "Thanh toán lại" (PR-B8)
                 │
PENDING ──(VNPAY OK)──▶ DEPOSIT_PAID ──(FM gán ô, UC-14)──▶ UNIT_ASSIGNED ──(yêu cầu trả kho, UC-22)──▶ TERMINATION_PENDING ──(nghiệm thu UC-23 / thanh lý UC-28)──▶ COMPLETED
   │                        │                                   │                                              │
   │ quá 15 phút → EXPIRED  │ khách huỷ (UC-15) → CANCELLED     │ No-Show (EX-03) → CANCELLED                  │ gia hạn (UC-21) / huỷ yêu cầu (PR-O4) → UNIT_ASSIGNED
   │ khách huỷ → CANCELLED  │ No-Show → CANCELLED
```
⚙️ Hiện tại: hết hạn ghi `CANCELLED` sau 10 phút (L-08); VNPAY lỗi huỷ đơn ngay (BR-28). Hoàn tiền xong cho đơn bị huỷ, code (#57) chuyển đơn `CANCELLED` → **`REFUNDED`** — trạng thái này cần thêm vào comment SQL (mục 5).

### 2.2 Hợp đồng — `rental_contracts.status`
```
PENDING_CHECK_IN ──(check-in, UC-18)──▶ ACTIVE ──(yêu cầu trả kho, UC-22)──▶ TERMINATION_PENDING ──(nghiệm thu, UC-23)──▶ TERMINATED
      │                                   │  ▲                                  │   ▲
      │ No-Show → TERMINATED              │  └──(gia hạn UC-21 / huỷ yêu cầu)───┘   │ hẹn trả kho (≤ 3 ngày)
                                          │                                        │
                    (job 00:05, end_date < hôm nay)          (qua end_date + 5 ngày ân hạn)
                                          ▼                                        │
                                       OVERDUE ◀───────────────────────────────────┘
                                          │  ├──(gia hạn + trả phí trễ)──▶ ACTIVE
                                          │  └──(hẹn trả kho)──▶ TERMINATION_PENDING
                                          └──(quá liquidation_days, FM bấm)──▶ LIQUIDATED
```
⚙️ Hiện tại: chưa có gì chuyển sang `OVERDUE` / `LIQUIDATED`, chưa có nghiệm thu → `TERMINATED`.

### 2.3 Ô kho — `storage_units.status`
```
AVAILABLE ──(gán ô)──▶ OCCUPIED ──(nghiệm thu đạt / No-Show)──▶ AVAILABLE
    ▲  │                   │
    │  │ FM bảo trì        │ nghiệm thu có sự cố / thanh lý
    │  ▼                   ▼
    └─ MAINTENANCE ◀───────┘   (FM "Sửa xong" / "Dọn xong" → AVAILABLE)
```
`RESERVED` **không dùng** (PR-M9). Nhãn "Quá hạn" trên lưới ô là suy ra từ hợp đồng (PR-M11).

### 2.4 Công việc — `facility_tasks` (đổi tên từ `staff_tasks` ở #55)
- Loại: `CHECK_IN` (sinh khi gán ô) · `CHECK_OUT` (sinh khi yêu cầu trả kho) · `SUPPORT` (sinh khi khách tạo ticket) · `REFUND` (sinh khi phát sinh tiền hoàn — **FM xử lý**, PR-O12) · `MAINTENANCE` (có trong schema, chưa dùng).
- `OPEN` ──nhận──▶ `IN_PROGRESS` ──xong──▶ `COMPLETED`; FM gỡ người nhận → `OPEN`; quá `due_at` → `OVERDUE`; huỷ → `CANCELLED`.
- `OVERDUE` thoát ra: `CHECK_IN` — FM dời lịch hoặc No-Show (EX-03); `CHECK_OUT` — FM dời ngày trả kho (PR-O13); `SUPPORT` — FM gia hạn task (PR-S4); `REFUND` — FM vẫn hoàn tất được (task hiện đỏ).
- Cột `evidence_image_url` lưu bằng chứng hoàn tiền (PR-O12).

### 2.5 Ticket hỗ trợ — `support_requests.status`
`OPEN` ──Staff nhận──▶ `IN_PROGRESS` ──Staff xong──▶ `RESOLVED` ──khách "Đã ổn" / 3 ngày──▶ `CLOSED`
`RESOLVED` ──khách "Chưa xong"──▶ `OPEN` (task mới). `OPEN` ──khách huỷ / hợp đồng kết thúc──▶ `CLOSED`.

### 2.6 Giao dịch — `payment_transactions`
| `payment_type` | Khi nào |
|---|---|
| `DEPOSIT` | Thanh toán lúc đặt (cọc + tiền thuê cả kỳ) |
| `MONTHLY_RENT` | Gia hạn |
| `LATE_FEE` | Phí trễ (trả khi gia hạn, hoặc trừ vào cọc) |
| `DAMAGE_FEE` 🆕 | Phí sự cố hư hỏng |
| `REFUND` | Hoàn tiền (huỷ đơn, No-Show, trả kho, thanh lý, IPN về trễ) |

`payment_method`: `VNPAY` · `BANK_TRANSFER` · `CASH` · `DEPOSIT_OFFSET` 🆕 (trừ vào cọc, không phải tiền mới — PR-M8).
`status`: `PENDING` → `SUCCESS` / `FAILED`.

---

## 3. Rule theo từng UC

### UC-01 Đăng nhập ✅
**Đang chạy** (`AuthService`, `LoginPage.jsx`, các Layout)
| Mã | Rule |
|---|---|
| BR-03 | Đăng nhập bằng email + mật khẩu (BCrypt). Trả `token`, `role`, `userId`, `fullName`, `facilityId`, `facilityName`. Token là UUID, **không API nào kiểm tra**. FE kiểm tra email đúng định dạng, mật khẩu không rỗng. |
| BR-04 | Điều hướng: `FACILITY_MANAGER`/`ADMIN` → `/manager`; `STAFF` → `/staff`; `CUSTOMER` → `/`. Mỗi layout tự kiểm tra role. ⚠️ `BOM` bị đá về `/login`. |
| BR-05 | Phiên ở `sessionStorage` (`accessToken`, `user`) → đóng tab là mất phiên; đăng xuất = xoá 2 khoá. |

**Đã chốt**
| Mã | Rule |
|---|---|
| PR-L1 | `LOCKED` → 403 `ACCOUNT_LOCKED`; `DISABLED` → 403 `ACCOUNT_DISABLED`. Chỉ kiểm tra **sau khi** mật khẩu đúng. (sửa L-07) |
| PR-L2 | Sai email hay sai mật khẩu đều 401 `INVALID_CREDENTIALS`, cùng message "Email hoặc mật khẩu không đúng". |
| PR-L3 | BE trim email; email / mật khẩu rỗng → 400 `INVALID_INPUT`. |

*Để sau:* portal theo role cho BOM/ADMIN (PR-L4 — cần trước nhóm quản trị), chặn STAFF/FM chưa gán cơ sở, tự chuyển khi đã đăng nhập mà vào `/login`, khoá sau N lần sai, bỏ role ảo `MANAGER` trong FE.

### UC-02 Đăng ký ✅
| Mã | Rule |
|---|---|
| BR-01 | Chỉ tạo role `CUSTOMER`, status `ACTIVE`. Role khác tạo ở UC-08 / UC-32. |
| BR-02 | Email bắt buộc, đúng định dạng, **duy nhất**; mật khẩu ≥ 6 ký tự; họ tên, SĐT bắt buộc. |
| — | Gỡ dòng "Tặng mã 100.000₫" ở `RegisterPage.jsx` (D-06). |

### UC-09 Tìm kiếm & khám phá kho ✅
| Mã | Rule |
|---|---|
| BR-10 | Chỉ cơ sở `ACTIVE`. Lọc từ khoá, thành phố, loại kho, khoảng giá, khoảng diện tích. |
| BR-11 | **Số suất** của (cơ sở × loại kho) = ô `AVAILABLE` − đơn `PENDING` − đơn `DEPOSIT_PAID` (≥ 0). Suất = 0 → ẩn. Đây là công thức "giữ tạm" của D-02, dùng chung cho PR-B1, PR-M10. |
| PR-M4 | Loại kho `INACTIVE` không hiện trong tìm kiếm. |

### UC-10 / UC-11 / EX-01 / EX-02 Đặt chỗ & thanh toán cọc ✅
**Đang chạy** (`ReservationService`, `VnpayService`, `ReservationCleanupService`, `CreateReservationPage.jsx`)
| Mã | Rule |
|---|---|
| ~~BR-20~~ | ~~Ngày bắt đầu không ở quá khứ~~ → **PR-B4** |
| BR-21 | Gói thuê 1 / 3 / 6 / 12 tháng (BE chỉ kiểm tra ≥ 1). |
| BR-22 | Mã đơn `RES-xxxxxx`. Đơn mới `PENDING`, chưa có ô. |
| ~~BR-23~~ | ~~Cọc = 1 tháng, viết cứng~~ → **PR-M6** |
| BR-24 | Tổng trả = giá × số tháng × (1 − ưu đãi gói 0/5/10/15%) + cọc. ⚠️ hiện còn trừ voucher 100.000đ (L-04). |
| ~~BR-25~~ | ~~Voucher NEWKHO~~ → **PR-B9** |
| ~~BR-26~~ | ~~Giữ đơn 10 phút~~ → **PR-B6, PR-B7** |
| BR-27 | IPN: kiểm tra chữ ký HMAC, khớp số tiền, mỗi giao dịch chỉ xử lý 1 lần (khoá dòng). |
| ~~BR-28~~ | ~~VNPAY lỗi → huỷ đơn ngay~~ → **PR-B8**. (VNPAY OK → giao dịch `SUCCESS`, đơn `DEPOSIT_PAID` vẫn giữ.) |

**Đã chốt**
| Mã | Rule |
|---|---|
| PR-B1 | Tạo đơn **tính lại số suất (BR-11) trong transaction có khoá** theo cơ sở + loại kho. Hết → 409 `OUT_OF_STOCK`. (sửa L-13) |
| PR-B2 | Mỗi khách tối đa **1 đơn `PENDING`** → 409 `PENDING_EXISTS`. |
| PR-B3 | Chỉ `CUSTOMER` `ACTIVE` được đặt; cơ sở và loại kho phải `ACTIVE`. Khách có hợp đồng `OVERDUE` hoặc còn nợ → PR-Q12. Bỏ fallback `customerId ?? 1` ở FE (L-22). |
| PR-B4 | Ngày bắt đầu: **từ ngày mai đến tối đa 30 ngày tới** (FE + BE). |
| PR-B5 | Họ tên, email, SĐT lấy từ tài khoản (chỉ đọc). **CCCD bắt buộc**: lần đầu nhập → lưu `users.cccd`, lần sau tự điền. Bỏ ô địa chỉ. (sửa L-14) |
| PR-B6 | Đơn `PENDING` giữ suất **15 phút** (link VNPAY 10 phút + 5 phút đệm). IPN thành công về cho đơn đã hết hạn / huỷ → giao dịch vẫn `SUCCESS` + **tự tạo yêu cầu hoàn tiền** (PR-O12). (sửa L-15) |
| PR-B7 | Hết hạn → đơn **`EXPIRED`**, giao dịch `PENDING` → `FAILED`. (sửa L-08) |
| PR-B8 | VNPAY lỗi / khách huỷ trên VNPAY → **đơn giữ `PENDING`**, nút **"Thanh toán lại"** (link mới, giao dịch cũ `FAILED`) đến hết 15 phút. Muốn bỏ thì huỷ đơn (UC-15). |
| PR-B9 | Gỡ voucher ở FE + BE. **Tổng trả = giá × số tháng × (1 − ưu đãi gói) + cọc.** |
| PR-B10 | Giờ nhận kho mặc định **09:00 ngày bắt đầu**, ghi vào `expected_appointment_time` lúc tạo đơn; dùng chung cho mốc phí huỷ và hạn task check-in. |
| PR-M6 | Cọc = giá niêm yết × `deposit_month_multiplier` của chính sách hiện hành lúc đặt; lưu vào `reservations.deposit_amount`, không đổi về sau. |

### UC-12 Đơn đặt chỗ của tôi ✅
| Mã | Rule |
|---|---|
| BR-12 | Khách xem đơn của mình, mới nhất trước; mỗi đơn hiện "đã thanh toán thực tế" = Σ giao dịch `SUCCESS` (`DEPOSIT` + `MONTHLY_RENT`) và ngày kết thúc hợp đồng (nếu có). |
| — | Đơn `PENDING` hiện nút "Thanh toán lại" (PR-B8) và "Huỷ"; đơn `DEPOSIT_PAID` hiện "Huỷ". |

### UC-15 Huỷ đơn đặt chỗ ✅
**Đang chạy** (`ReservationService.previewCancel / cancelReservation`, `CancelReservationModal.jsx`)
| Mã | Rule |
|---|---|
| BR-30 | Chỉ huỷ đơn `PENDING` hoặc `DEPOSIT_PAID` (đã gán ô thì không). |
| BR-31 | Mốc tính phí = `expected_appointment_time`, trống → 09:00 ngày bắt đầu (PR-B10 làm cho luôn có giá trị). |
| BR-32 | Trước mốc > `cancel_free_hours` → hoàn 100% số đã trả; trong khoảng đó → phạt `cancel_fee_percent` × cọc, hoàn phần còn lại. ⚠️ Hiện viết cứng 24h / 50% (L-03 → PR-15). |
| BR-33 | Lý do: 4 lý do có sẵn hoặc "Lý do khác" (bắt buộc nhập). Có thông tin ngân hàng → hoàn chuyển khoản; không có → tiền mặt tại quầy. |
| BR-34 | Đơn đã thanh toán khi huỷ: tạo giao dịch `REFUND` `PENDING` + task `REFUND` trong `facility_tasks` (hạn PR-93) để FM hoàn — theo PR-O12. *(L-01 đã sửa nhờ #55 nới ràng buộc bảng task.)* |
| BR-35 | Mọi lần huỷ ghi `activity_logs`. |

**Đã chốt**
| Mã | Rule |
|---|---|
| PR-15 | Đọc `cancel_free_hours`, `cancel_fee_percent` từ chính sách thay vì viết cứng. |
| PR-M5 | Dùng chính sách **hiện hành của cơ sở lúc huỷ** (đơn chưa có hợp đồng nên chưa gắn chính sách). |
| PR-O12 | Đơn đã thanh toán khi huỷ → task `REFUND` cho FM (BR-34), FM hoàn theo PR-O12 (có bằng chứng). |

### UC-13 / UC-14 Duyệt đơn & gán ô ✅
| Mã | Rule |
|---|---|
| BR-40 | FM thấy đơn `DEPOSIT_PAID`, chưa có ô, **thuộc cơ sở mình**, cũ nhất trước. Chưa gán cơ sở → lỗi. |
| BR-41 | Gợi ý ô `AVAILABLE` cùng cơ sở, **cùng loại**. ⚠️ Hiện nếu hết sẽ gợi ý ô **khác loại** → bỏ (L-11, D-02). |
| BR-42 | Gán ô khi đơn `DEPOSIT_PAID` và ô `AVAILABLE` — **phải đúng loại & đúng cơ sở của đơn** (L-11). 1 transaction: ô `OCCUPIED`; đơn `UNIT_ASSIGNED`; hợp đồng `HD-xxxxxx` `PENDING_CHECK_IN`; sinh task `CHECK_IN`. |
| BR-43 | Hợp đồng: start = ngày bắt đầu đơn; end = start + số tháng; `deposit_held_amount` = cọc; gắn **chính sách đang hiệu lực của cơ sở**. |

### EX-03 Khách không đến nhận kho (No-Show) & dời lịch ✅
**Đang chạy** (`ReservationService.handleNoShow / rescheduleReservation`, `NoShowModal.jsx`, `RescheduleModal.jsx`)
| Mã | Rule |
|---|---|
| BR-50 | Danh sách No-Show: đơn đã gán ô của cơ sở mà **ngày bắt đầu đã qua** (task check-in đã `OVERDUE`). |
| BR-51 | No-Show (đơn `DEPOSIT_PAID`/`UNIT_ASSIGNED`): đơn `CANCELLED`; ô `AVAILABLE`; hợp đồng `TERMINATED`; huỷ task `CHECK_IN`; ghi log kèm lý do. ⚠️ Tiền xử lý theo PR-X1 (L-06). |
| BR-52 | Dời lịch (gọi được khách): ngày mới không ở quá khứ; đơn `DEPOSIT_PAID`/`UNIT_ASSIGNED`; cập nhật start/end hợp đồng (giữ số tháng); dời hạn task `CHECK_IN`, task `OVERDUE` được mở lại. |
| BR-53 | (#52) **Báo cáo liên hệ**: Staff cùng cơ sở ghi kết quả cuộc gọi + ghi chú trên task `CHECK_IN` quá hạn → lưu vào `note` của task (ghi đè lần trước) và `activity_logs` (`target_entity = 'facility_tasks'`); task chưa ai nhận thì gán cho Staff báo cáo. FM xem báo cáo để quyết định dời lịch / No-Show. |

**Đã chốt**
| Mã | Rule |
|---|---|
| PR-X1 | (D-07) No-Show: **tịch thu 100% cọc, hoàn toàn bộ tiền thuê** (tạo `REFUND` → PR-O12). FM chọn **"Miễn phạt"** (bắt buộc lý do) → hoàn cả cọc. FE hiện số tiền hoàn trước khi xác nhận. |
| PR-X2 | API No-Show tự kiểm tra ngày bắt đầu đã qua (L-10). Log ghi **người thao tác là FM** (PR-A8). |
| PR-X3 | **Điều kiện bấm No-Show**: có **≥ 2 báo cáo liên hệ thất bại** (BR-53) **cách nhau ≥ 24h**, **và** đã qua **48h** kể từ giờ hẹn (`expected_appointment_time`). Chưa đủ → nút No-Show bị khoá, BE trả 409 `NO_SHOW_NOT_ALLOWED_YET`. Số lần liên hệ đếm từ `activity_logs` của task (mã nghiệp vụ `[CONTACT]` — PR-A10), không dựa vào `note` vì `note` bị ghi đè. Trong thời gian chờ, ô vẫn giữ cho khách; liên hệ được thì dời lịch (BR-52). |
| PR-C3 | Đây là **lối duy nhất** xử lý task `CHECK_IN` quá hạn (không có nút "hoàn thành task quá hạn"). |

### UC-16 / UC-17 Bảng công việc & nhận việc ✅
| Mã | Rule |
|---|---|
| BR-60 | Task sinh tự động (`CHECK_IN`, `CHECK_OUT`, `SUPPORT`). Mỗi hợp đồng chỉ có **1 task `CHECK_IN`/`CHECK_OUT` đang mở cùng loại**. |
| BR-61 | `due_at` = **21:00 ngày hẹn**; mốc đã qua → 21:00 hôm nay (trước 21h) hoặc hôm sau. |
| BR-62 | Job mỗi phút: task `OPEN`/`IN_PROGRESS` quá hạn → `OVERDUE`. |
| BR-63 | Staff + FM **cùng cơ sở** xem bảng; lọc trạng thái, loại, "Việc của tôi", tìm kiếm. |
| BR-64 | Chỉ **STAFF cùng cơ sở** nhận task `OPEN` chưa quá hạn; ai bấm trước người đó nhận; không tự trả việc. |
| BR-65 | Chỉ **FM cùng cơ sở** gỡ người nhận của task `IN_PROGRESS` → `OPEN`. |
| PR-C6 | Staff chỉ nhận task có hạn **trong 3 ngày tới** → 409 `TASK_TOO_FAR`. |
| PR-34 | Task `SUPPORT` khẩn (PR-S1) nổi lên đầu bảng. |

### UC-18 Check-in & biên bản bàn giao ✅
**Đang chạy** (`StaffTaskService.checkIn`, `StaffTaskDetailPage.jsx`)
| Mã | Rule |
|---|---|
| BR-70 | Chỉ Staff **đang giữ** task `CHECK_IN` `IN_PROGRESS`, chưa quá hạn, hợp đồng `PENDING_CHECK_IN`. |
| BR-71 | Checklist bắt buộc đủ: xác minh danh tính, ô trống, ô sạch, khoá nguyên vẹn, khách xác nhận ký (code hiện có 5 mục — thêm mục 6 theo PR-C7). |
| BR-72 | PIN đúng 6 chữ số do BE gợi ý ("Sinh lại"); RFID bắt buộc, ≤ 50 ký tự; ghi chú ≤ 1000 ký tự. |
| BR-73 | PIN và RFID không trùng với hợp đồng `ACTIVE` / `OVERDUE` / `TERMINATION_PENDING`. |
| BR-74 | 1 transaction: biên bản `CHECK_IN`; hợp đồng `ACTIVE` + PIN + RFID; task `COMPLETED`; log. Không đổi start/end. |

**Đã chốt**
| Mã | Rule |
|---|---|
| PR-C1 | Chỉ check-in **trong ngày hẹn** (trước 21:00). Khách muốn nhận sớm → FM dời lịch trước. Sớm → 409 `CHECK_IN_TOO_EARLY`. (sửa L-17) |
| PR-C2 | Chi tiết task hiện **họ tên + SĐT + CCCD**; "xác minh danh tính" = CCCD khớp CCCD đã lưu (PR-B5). |
| PR-C4 | Giữ nút **"Giả lập hoàn thiện"** (sản phẩm môn học). |
| PR-C5 | Chỉ khách **chủ hợp đồng** xem PIN/RFID; Staff/FM không thấy sau check-in. *(làm cùng PR-90)* |
| PR-C7 | **Mục 6 checklist — cam kết hàng cấm**: "Khách đã ký cam kết không lưu trữ chất cháy nổ (xăng, gas, pháo…), vũ khí, hoá chất độc hại, động vật sống, chất dễ phân huỷ / bốc mùi và hàng cấm theo quy định pháp luật." Bắt buộc tick; lưu vào cột mới `handover_records.is_prohibited_goods_committed`; nút "Giả lập hoàn thiện" tick cả mục này. Checkbox "đồng ý cam kết" lúc đặt chỗ (UC-10) ghi rõ cùng nội dung này. |

### UC-19 Hợp đồng của tôi ✅
| Mã | Rule |
|---|---|
| BR-80 | "Tổng đã đóng" = Σ `SUCCESS` (`DEPOSIT` + `MONTHLY_RENT`); "tiền thuê đã đóng" = tổng − cọc đang giữ. Hiện PIN/RFID cho khách. |
| — | Hợp đồng `PENDING_CHECK_IN`: chưa có nút gia hạn / trả kho. `OVERDUE`: hiện "PIN đã khoá", số ngày quá hạn, phí trễ (PR-Q5). `LIQUIDATED` / `TERMINATED`: ẩn nút tuỳ chọn (PR-R1). |

### UC-20 Lịch sử & khoản phải thanh toán ⬜ (đổi phạm vi)
| Mã | Rule |
|---|---|
| PR-50 | (D-01) Không thu hằng tháng → "Pay Monthly Rent" trùng UC-21. UC-20 đổi thành: xem **mọi giao dịch** của khách (cọc, thuê, gia hạn, phí trễ, phí sự cố, hoàn tiền) + **trả các khoản nợ** phát sinh (`DAMAGE_FEE` vượt cọc — PR-O9) qua VNPAY. |

### UC-21 Gia hạn hợp đồng ✅
**Đang chạy** (`VnpayService.createRenewal / settleRenewal`, `ContractOptionsModal.jsx`)
| Mã | Rule |
|---|---|
| BR-81 | Gói +1 / +3 / +6 / +12 tháng; giá = **giá niêm yết hiện tại** × số tháng × (1 − ưu đãi 0/0/5/10%) (D-08). |
| BR-82 | Còn hạn → nối tiếp `end_date`; đã qua `end_date` → **tính từ hôm nay** (PR-R3). |
| BR-83 | Gia hạn khi `OVERDUE`/`TERMINATION_PENDING` → hợp đồng `ACTIVE`, đơn `UNIT_ASSIGNED`, huỷ task `CHECK_OUT`. |

**Đã chốt**
| Mã | Rule |
|---|---|
| PR-R1 | Chỉ gia hạn khi `ACTIVE` / `TERMINATION_PENDING` / `OVERDUE` → khác 409 `CONTRACT_NOT_RENEWABLE`. FE ẩn tab Gia hạn tương ứng. (sửa L-23) |
| PR-R2 | BE chỉ nhận **1 / 3 / 6 / 12**; số tháng lưu tường minh, không cắt từ mã giao dịch. (sửa L-20) |
| PR-R3 | Giữ BR-82: ngày quá hạn trước đó không nằm trong kỳ mới → thu bằng **phí trễ** (PR-Q6). Gia hạn khi đang trong ân hạn của `TERMINATION_PENDING`: kỳ mới tính từ hôm nay, các ngày ân hạn đã qua (từ ngày 2) tính theo PR-O14 và cộng vào lần thanh toán gia hạn. |
| PR-R4 | Giá = giá niêm yết hiện tại (PR-12); FE báo nếu giá đã đổi so với lúc ký. |
| PR-R5 | Mỗi hợp đồng **1 giao dịch gia hạn `PENDING`**; link mới → giao dịch cũ `FAILED`; IPN về muộn của giao dịch cũ → `SUCCESS` + yêu cầu hoàn tiền (PR-O12). |
| PR-R6 | **Xoá** `POST /contracts/{id}/renew` — chỉ gia hạn qua VNPAY. (sửa L-02) |
| PR-R7 | Gia hạn khi `TERMINATION_PENDING` → huỷ task trả kho, bỏ thông tin hoàn cọc, báo "Yêu cầu trả kho đã được huỷ". |
| PR-R8 | Trang hợp đồng đọc đúng `vnpResponse` + `orderId`, hỏi trạng thái giao dịch rồi hiện toast. (sửa L-19) |
| PR-R9 | Còn ≤ 7 ngày đến `end_date` → banner nhắc ở "Kho của tôi", trang hợp đồng và dashboard FM. |
| PR-Q6 | Gia hạn hợp đồng `OVERDUE`: 1 lần VNPAY = **phí trễ + tiền kỳ mới** → ghi 2 giao dịch `LATE_FEE` + `MONTHLY_RENT`; PIN mở lại. |

### UC-22 Yêu cầu trả kho ✅ (cần sửa)
**Đang chạy** (`ContractService.requestCheckout`)
| Mã | Rule |
|---|---|
| BR-84 | Hợp đồng `ACTIVE`/`OVERDUE`. Ngày hẹn mặc định `end_date`. Hợp đồng + đơn → `TERMINATION_PENDING`; sinh task `CHECK_OUT` (ghi chú chứa thông tin hoàn cọc). PIN vẫn dùng được để dọn đồ. |

**Đã chốt**
| Mã | Rule |
|---|---|
| PR-O1 | Ngày hẹn: **từ ngày mai đến `end_date` + 5 ngày** (ân hạn chuyển đồ; phí theo PR-O14). Hợp đồng `OVERDUE` → hẹn trong **3 ngày tới**. Kiểm tra cả FE + BE. (sửa L-09) |
| PR-O14 | (D-11) **Phí ân hạn**: ngày `end_date` + 1 **miễn phí**; ngày + 2 → + 5 tính **tiền thuê theo ngày = giá niêm yết lúc ký / 30** mỗi ngày (không phải phí phạt). Tính đến ngày nghiệm thu thực tế, **trừ vào cọc** khi hoàn (`LATE_FEE` method `DEPOSIT_OFFSET`). FE hiện số phí dự kiến khi khách chọn ngày hẹn sau `end_date` + 1. Lỡ ân hạn (qua + 5 chưa nghiệm thu) → chuyển sang phí trễ PR-Q3 (tính từ `end_date` + 1, **thay** phí ân hạn, không cộng dồn hai loại). |
| PR-O2 | (D-10) **Trả sớm** (ngày hẹn < `end_date`) được hoàn tiền thuê theo công thức: **Hoàn tiền thuê = tiền thuê kỳ hiện tại đã trả − (số tháng đã dùng, làm tròn lên × giá niêm yết lúc ký, *không* ưu đãi) − phí phá hợp đồng (1 tháng giá niêm yết lúc ký)**, tối thiểu 0. "Số tháng đã dùng" tính từ ngày bắt đầu kỳ hiện tại đến ngày nghiệm thu. Cọc hoàn riêng theo PR-O11. FE hiện bảng tính dự kiến trước khi khách xác nhận. *Ví dụ*: gói 12T giá 1.850.000đ (ưu đãi 15% → đã trả 18.870.000đ), dùng 2 tháng → 18.870.000 − 2 × 1.850.000 − 1.850.000 = **13.320.000đ**. |
| PR-O3 | Bắt buộc chọn cách nhận cọc: **chuyển khoản** (ngân hàng, số TK, chủ TK) hoặc **tiền mặt tại quầy**; FE gửi đủ field. (sửa L-18) |
| PR-O4 | Khách **huỷ yêu cầu trả kho** được trước ngày hẹn nếu chưa quá `end_date` → hợp đồng `ACTIVE`, đơn `UNIT_ASSIGNED`, task `CANCELLED`. |
| PR-O13 | Task `CHECK_OUT` `OVERDUE` → FM **dời ngày trả kho** (theo PR-O1) hoặc để nguyên; qua `end_date` + 5 → hợp đồng `OVERDUE` (PR-Q1). |

### UC-23 Nghiệm thu trả kho ⬜
| Mã | Rule |
|---|---|
| PR-O5 | Staff đang giữ task `CHECK_OUT` `IN_PROGRESS`, **trong ngày hẹn** (như PR-C1), hợp đồng `TERMINATION_PENDING`. Có nút "Giả lập hoàn thiện". |
| PR-O6 | "Ô trống" + "Xác minh danh tính" **bắt buộc đạt** (không đạt → không nghiệm thu, hẹn lại). "Sạch" / "Khoá nguyên vẹn" được không đạt nhưng **bắt buộc lập sự cố** (UC-24). Mục 6 (PR-C7) ở nghiệm thu đổi thành "Không phát hiện hàng cấm / chất nguy hiểm còn lại" — không đạt → bắt buộc lập sự cố. |
| PR-O7 | 1 transaction: biên bản `CHECK_OUT`; hợp đồng `TERMINATED`; đơn `COMPLETED`; **xoá PIN/RFID**; task `COMPLETED`; ô `AVAILABLE` (hoặc `MAINTENANCE` nếu có sự cố); tạo yêu cầu hoàn cọc (PR-O11); đóng ticket hỗ trợ còn mở (PR-S8); log. |

### UC-24 Ghi nhận sự cố hư hỏng ⬜
| Mã | Rule |
|---|---|
| PR-O8 | Bảng mới `damage_cases` (mục 5). 1 lần nghiệm thu có thể nhiều sự cố; chi phí ≥ 0 do Staff nhập. |
| PR-O9 | Tổng phí sự cố **trừ vào cọc** (`DAMAGE_FEE`, method `DEPOSIT_OFFSET`); vượt cọc → phần thiếu là **khoản nợ** (`DAMAGE_FEE` `PENDING`), khách trả ở UC-20, chưa trả → bị chặn đặt chỗ (PR-Q12). |
| PR-O10 | Ô `MAINTENANCE` do sự cố → FM bấm **"Sửa xong"** → `AVAILABLE` (UC-06). |

### UC-25 Hoàn tiền ⬜
| Mã | Rule |
|---|---|
| PR-O11 | **Hoàn cọc** khi trả kho = cọc đang giữ − phí sự cố − phí ân hạn (PR-O14) **hoặc** phí trễ (PR-Q3), ≥ 0. Trả sớm thì cộng thêm **hoàn tiền thuê** (PR-O2) vào cùng task `REFUND`, ghi rõ 2 phần. Bằng 0 vẫn tạo task để FM đóng hồ sơ. |
| PR-O12 | (D-04) Mỗi khoản cần hoàn sinh **1 task `REFUND`** trong `facility_tasks` của cơ sở, **FM xử lý** (không vào việc của Staff). Nguồn: huỷ đơn (UC-15), No-Show (PR-X1), IPN về muộn (PR-B6, PR-R5), trả kho thường / trả sớm (UC-23, PR-O2), phần cọc còn giữ khi thanh lý (PR-Q9). Task ghi số tiền, cách nhận (chuyển khoản / tiền mặt), thông tin tài khoản; hạn theo PR-93. FM hoàn tất → task `COMPLETED`, giao dịch `REFUND` `SUCCESS`, log người xác nhận. *(đã code ở #55, #57)* |
| PR-O15 | **Bằng chứng hoàn tiền** (bắt buộc trước khi hoàn tất task `REFUND`): **chuyển khoản** → bắt buộc nhập **mã giao dịch ngân hàng (mã FT)**; ảnh chụp màn hình chuyển khoản không bắt buộc (dán link vào `evidence_image_url`). **Tiền mặt** → bắt buộc tick "Khách đã ký nhận tiền" + ghi chú. BOM xem lại được mã FT / ảnh / ghi chú khi đối soát (UC-29). Thiếu → 400 `REFUND_EVIDENCE_REQUIRED`. *(code #57 đang cho ảnh tuỳ chọn, chưa bắt buộc mã FT — L-24)* |

### UC-28 Hợp đồng quá hạn ⬜
| Mã | Rule |
|---|---|
| PR-Q1 | Job 00:05 hằng ngày: `ACTIVE` có `end_date` < hôm nay → `OVERDUE` (**không hẹn trả kho thì không có ân hạn**). `TERMINATION_PENDING` có `end_date` + 5 < hôm nay → `OVERDUE`, huỷ task `CHECK_OUT`. Log từng hợp đồng (user `system`). |
| PR-Q2 | Số ngày quá hạn đếm từ **`end_date` + 1** cho mọi trường hợp (lỡ ân hạn thì mất quyền miễn phí). |
| PR-Q3 | **Phí trễ = cọc đang giữ × min(số ngày quá hạn, 5) × 10%** → mỗi ngày 10%, **trần 50%** từ ngày thứ 5. Không bao giờ vượt cọc. Tỉ lệ lấy từ chính sách **gắn với hợp đồng**. |
| PR-Q4 | Tính **động**, không ghi mỗi ngày. Chỉ ghi `LATE_FEE` khi khách trả (gia hạn) hoặc khi trừ vào cọc (trả kho / thanh lý, method `DEPOSIT_OFFSET`). Ngừng tăng khi ra khỏi `OVERDUE`. |
| PR-Q5 | `OVERDUE` → **PIN bị khoá** (trạng thái hiển thị). Hẹn trả kho → PIN mở lại để dọn đồ. |
| PR-Q6 | Lối ra **gia hạn** — xem UC-21. |
| PR-Q7 | Lối ra **trả kho**: hẹn trong 3 ngày (PR-O1); phí trễ tính đến ngày nghiệm thu, trừ vào cọc (PR-O11). |
| PR-Q8 | Lối ra **thanh lý**: quá `liquidation_days` (mặc định 30) → **FM bấm Thanh lý** (không tự động), bắt buộc ghi chú quá trình liên hệ khách. |
| PR-Q9 | Thanh lý: hợp đồng `LIQUIDATED`; đơn `COMPLETED`; xoá PIN/RFID; ô `MAINTENANCE` ("Dọn xong" → `AVAILABLE`); trừ phí trễ 50% cọc; **50% còn lại tạm giữ** (D-09) — hiện "Còn giữ cọc: X đ", FM bấm "Hoàn phần cọc còn lại" khi khách đến làm việc → PR-O12. Đóng ticket còn mở (PR-S8). |
| PR-Q10 | Xử lý đồ của khách khi thanh lý làm **ngoài hệ thống**, chỉ ghi chú log. |
| PR-Q11 | Màn FM **"Hợp đồng quá hạn"**: mã HĐ, khách, SĐT, ô, số ngày quá hạn, phí trễ hiện tại, ghi chú liên hệ (nhiều lần, lưu log), nút Thanh lý (bật khi đủ ngày). |
| PR-Q12 | Khách có hợp đồng `OVERDUE` hoặc còn nợ (`DAMAGE_FEE` `PENDING`) → không đặt chỗ mới, 409 `CUSTOMER_HAS_DEBT`. |

### UC-04 Quản lý cơ sở (BOM) ⬜
| Mã | Rule |
|---|---|
| PR-10 | Tên, thành phố, quận, địa chỉ bắt buộc; hotline đúng định dạng SĐT. Tạo cơ sở → **tự tạo chính sách mặc định**. |
| PR-M1 | Cột **`facilities.code`**: 2–4 chữ in hoa, duy nhất, **không sửa** sau khi tạo; dùng sinh mã ô. |
| PR-11 | `INACTIVE` → ẩn khỏi tìm kiếm, không nhận đơn mới. Chặn nếu còn đơn `PENDING`/`DEPOSIT_PAID`/`UNIT_ASSIGNED` hoặc hợp đồng còn hiệu lực. |
| PR-M2 | Không xoá cứng, chỉ `INACTIVE`. Gán FM cho cơ sở làm ở UC-08. |

### UC-05 Loại kho & giá niêm yết (BOM) ⬜
| Mã | Rule |
|---|---|
| PR-M3 | Danh mục **chung toàn hệ thống**: tên duy nhất; diện tích, thể tích, giá > 0; kích thước / sức chứa / đặc điểm mô tả tự do. |
| PR-12 | Đổi giá chỉ áp cho **đơn mới và lần gia hạn sau**; đơn / hợp đồng cũ giữ số tiền đã thu. |
| PR-M4 | Cột **`unit_types.status`** (`ACTIVE`/`INACTIVE`): `INACTIVE` ẩn khỏi tìm kiếm & đặt chỗ, FM không thêm ô mới loại đó; hợp đồng đang chạy và gia hạn không ảnh hưởng. Chỉ **xoá** được loại chưa từng có ô. |

### UC-07 Chính sách thuê (BOM) ⬜
| Mã | Rule |
|---|---|
| PR-13 | Mỗi cơ sở có đúng 1 chính sách **đang hiệu lực**. Tạo/sửa sẽ phát hành phiên bản mới và áp dụng bản đó; BOM có thể chọn lại chính phiên bản cũ làm bản hiệu lực mà không tạo bản sao. Không ghi đè nội dung; hợp đồng giữ `rental_policy_id` lúc ký. Màn hình xem được lịch sử phiên bản. |
| PR-14 | Trường & miền giá trị BOM chỉnh: hệ số cọc 1–3; % phí huỷ 0–100; giờ huỷ miễn phí ≥ 0; % phí trễ/ngày 0–50. Phiên bản mới dùng **trần phí trễ cố định 50% cọc** và **mốc xét thanh lý cố định 30 ngày**; BOM không chỉnh hai mức này. Phiên bản cũ giữ thông số đã phát hành cho hợp đồng đã ký. |
| PR-15 | Code đọc chính sách thay cho số viết cứng (cọc, phí huỷ, phí trễ, thanh lý). (sửa L-03) |
| PR-M5 | Huỷ đơn → chính sách hiện hành lúc huỷ; phí trễ / thanh lý → chính sách gắn hợp đồng. Chỉ BOM sửa, FM chỉ xem. |
| PR-M6 | BOM được chỉnh `deposit_month_multiplier` (xem UC-10). |
| PR-Q13 | Thêm entity `RentalPolicy`; đổi `late_fee_per_day` → `late_fee_percent_per_day` (mặc định 10), thêm `late_fee_max_percent` (mặc định 50); bỏ `lock_account_days` (D-05). Nghĩa làm trong nhánh UC-07. |

### UC-29 Dashboard doanh thu (BOM) ⬜
| Mã | Rule |
|---|---|
| PR-M7 | Ghi nhận theo **ngày thực thu** (`paid_at`), giao dịch `SUCCESS`. 4 chỉ số: **Doanh thu thuê** = (`DEPOSIT` − phần cọc) + `MONTHLY_RENT`; **Thu phí phạt** = `LATE_FEE` + `DAMAGE_FEE`; **Đã hoàn tiền** = `REFUND`; **Cọc đang giữ** = Σ `deposit_held_amount` hợp đồng còn hiệu lực + phần cọc còn giữ của hợp đồng thanh lý. Lọc cơ sở, tháng / quý / năm; biểu đồ theo tháng, cơ sở, loại kho; **tỉ lệ lấp đầy** = `OCCUPIED` / (tổng ô − `MAINTENANCE`); số hợp đồng mới / kết thúc. |
| PR-M8 | Phí trừ vào cọc ghi method `DEPOSIT_OFFSET` → tính vào "Thu phí phạt" nhưng **không** là tiền mới thu vào (tránh tính trùng cọc). |

### UC-06 Danh mục ô kho (FM) ✅
| Mã | Rule |
|---|---|
| PR-20 | FM chỉ thao tác ô **cơ sở mình**. |
| PR-M9 | Mã ô **tự sinh** `KV-<facilities.code>-<khu><số phòng 3 chữ số>`, duy nhất, không sửa. FM chỉ đổi tay `AVAILABLE` ↔ `MAINTENANCE`; `OCCUPIED` do hệ thống; bỏ `RESERVED`. Nút "Sửa xong" / "Dọn xong" cho ô `MAINTENANCE`. |
| PR-21 | Đổi loại / tầng / khu chỉ khi ô `AVAILABLE` hoặc `MAINTENANCE`. Không xoá ô đã từng có hợp đồng. Không thêm ô thuộc loại `INACTIVE`. |
| PR-M10 | **Không làm âm số suất** (BR-11): bảo trì, xoá, đổi loại ô đều bị chặn nếu làm suất < 0 → 409 `SLOT_IN_USE`. |
| PR-M11 | Nhãn "Quá hạn" trên lưới suy ra từ hợp đồng `OVERDUE` của ô. Bỏ toàn bộ số giả trên trang hiện tại. |

### UC-32 Quản lý nhân viên (FM) ✅
**Đang chạy** (`FacilityStaffService`, `FacilityStaffController`, `ManagerStaffPage.jsx`)
| Mã | Rule |
|---|---|
| PR-22 | (D-03) FM tạo `STAFF` cho **cơ sở mình** (BE tự gán, không cho chọn); Admin tạo cho cơ sở bất kỳ (UC-08). |
| PR-M12 | Form: họ tên, email (duy nhất), SĐT, **mật khẩu ban đầu do FM đặt** (≥ 6). FM không đổi role / cơ sở, không tạo FM. |
| PR-06 | Khoá / mở Staff cơ sở mình; không khoá Staff đang giữ task `IN_PROGRESS` (gỡ task trước). |
| PR-M13 | Danh sách: tên, SĐT, email, trạng thái, số task đang làm, số task hoàn thành trong tháng. |

### UC-30 Dashboard cơ sở (FM) 🟡
| Mã | Rule |
|---|---|
| PR-M14 | Bỏ hết số giả. Số thật của cơ sở: ô theo trạng thái + tỉ lệ lấp đầy; đơn chờ gán ô; đơn No-Show; task hôm nay (mở / đang làm / quá hạn); hợp đồng sắp hết hạn (≤ 7 ngày); hợp đồng `OVERDUE`; yêu cầu hoàn tiền chờ xử lý; doanh thu tháng (PR-M7). Mỗi ô số dẫn tới màn tương ứng. Bỏ "ca trực", "mục tiêu doanh thu". |

### UC-03 Vai trò & phân quyền (Admin) ✅
**Đang chạy** (`AdminRoleService`, `AdminRolesPage.jsx`)
| Mã | Rule |
|---|---|
| PR-A1 | **Không tạo role mới**, không xoá, không đổi tên 5 role gốc. Màn hình: danh sách role + số người dùng + ma trận quyền (mục 1.3, chỉ đọc) + sửa **mô tả**. Không làm bảng permission riêng. |
| BR-90 | Mỗi role hiện **tổng số người dùng** (mọi trạng thái) và **số đang `ACTIVE`**, không tính tài khoản `system`. Ma trận quyền là hằng số FE (`utils/roles.js`), chép từ mục 1.3. |
| BR-91 | Sửa mô tả: người thao tác phải là `ADMIN` `ACTIVE` (403 `FORBIDDEN_ROLE`); mô tả trim, bắt buộc, ≤ 255 ký tự (400 `INVALID_INPUT`); không đổi → 200, không log; đổi → log `[ROLE_UPDATE]` (`target_entity = 'roles'`). |

### UC-08 Tài khoản người dùng (Admin) ✅
**Đang chạy** (`AdminUserService`, `AdminUsersPage.jsx`)
| Mã | Rule |
|---|---|
| PR-03 | Admin tạo `STAFF` / `FACILITY_MANAGER` / `BOM` / `ADMIN`; `CUSTOMER` chỉ tự đăng ký. |
| PR-04 | `STAFF` / `FM` bắt buộc có cơ sở; role khác không gắn cơ sở. **Mỗi cơ sở tối đa 1 FM `ACTIVE`.** |
| PR-05 | Không xoá cứng: chỉ `LOCKED` / `DISABLED`. Admin không tự khoá mình. Bị khoá → không đăng nhập (PR-L1). |
| PR-A2 | **Được đổi role** giữa `STAFF` / `FACILITY_MANAGER` / `BOM` / `ADMIN` (không từ / sang `CUSTOMER`). Điều kiện: đang là `STAFF` thì không giữ task `IN_PROGRESS`; role mới `STAFF`/`FM` bắt buộc chọn cơ sở, `BOM`/`ADMIN` thì xoá cơ sở; sang `FM` phải thoả PR-04; không đổi Admin `ACTIVE` cuối cùng. Log role cũ → mới. |
| PR-A3 | Chuyển cơ sở: Staff không giữ task `IN_PROGRESS`; FM chỉ tới cơ sở chưa có FM `ACTIVE`. |
| PR-A4 | Khoá / vô hiệu FM → cảnh báo "Cơ sở X chưa có quản lý" (không chặn). |
| PR-A5 | **Không khoá / vô hiệu khách đang thuê** (còn đơn `PENDING`/`DEPOSIT_PAID`/`UNIT_ASSIGNED` hoặc hợp đồng `PENDING_CHECK_IN`/`ACTIVE`/`OVERDUE`/`TERMINATION_PENDING`) → 409 `CUSTOMER_HAS_ACTIVE_RENTAL`. |
| PR-A6 | Đặt lại mật khẩu: Admin nhập mật khẩu mới (≥ 6); không gửi email. |
| PR-A7 | Luôn còn ≥ 1 Admin `ACTIVE`. |
| BR-92 | Danh sách gồm **cả khách hàng**, ẩn tài khoản `system`; lọc tên/email/SĐT, role, trạng thái, cơ sở; 20 dòng/trang, mới tạo trước. Bộ lọc nằm trên URL (`/admin/users?role=X` từ UC-03). |
| BR-93 | Form: họ tên 1–100, email trim + lowercase, duy nhất (409 `EMAIL_EXISTS`), **không sửa email**; SĐT `^0\d{9}$`; mật khẩu ban đầu ≥ 6. Khách hàng chỉ sửa tên + SĐT. Cơ sở mới phải `ACTIVE`. |
| BR-94 | "Đang giữ task" = task `IN_PROGRESS` **hoặc `OVERDUE`** có `staff_id` = người đó → chặn đổi role / chuyển cơ sở / khoá (409 `STAFF_HAS_TASK_IN_PROGRESS`). |
| BR-95 | Admin không tự đổi role mình (409 `CANNOT_CHANGE_OWN_ROLE`), không tự khoá (409 `CANNOT_LOCK_SELF`). Mở lại FM khi cơ sở đã có FM `ACTIVE` khác → 409 `FACILITY_HAS_MANAGER`. FM `ACTIVE` bị đổi role / chuyển cơ sở cũng trả cảnh báo PR-A4. |
| BR-96 | `LOCKED` = tạm khoá, `DISABLED` = nghỉ việc / ngừng hẳn; cả hai mở lại được, bắt buộc **lý do** ≤ 255 (chỉ lưu trong log). Log `[USER_CREATE]` / `[USER_UPDATE]` / `[USER_LOCK]` / `[USER_DISABLE]` / `[USER_UNLOCK]` / `[USER_RESET_PASSWORD]`, `target_entity = 'users'`; không ghi mật khẩu; không đổi gì → không log. |

### UC-31 Nhật ký hoạt động (Admin) ✅
**Đang chạy** (`AdminActivityLogService`, `AdminDashboardService`, `AdminLogsPage.jsx`, `AdminDashboardPage.jsx`)
| Mã | Rule |
|---|---|
| PR-07 | Chỉ **xem**, không sửa / xoá. |
| PR-A8 | `user_id` = **người thực sự thao tác**; job ghi bằng tài khoản `system`. Sửa dời lịch & No-Show đang ghi nhầm id khách (L-21). |
| PR-A9 | **Bắt buộc log**: đăng ký; tạo đơn; thanh toán thành công / thất bại; hết hạn giữ chỗ; huỷ đơn; gán ô; báo cáo liên hệ khách (`[CONTACT]`, PR-X3); No-Show; dời lịch; nhận việc; gỡ người nhận; check-in; yêu cầu / huỷ trả kho; nghiệm thu; sự cố; gia hạn; chuyển quá hạn; thanh lý; hoàn tiền; ticket hỗ trợ; cấp lại PIN; mọi CRUD của BOM / FM / Admin. **Không** log đăng nhập. UC đã xong phải bổ sung: tạo đơn, thanh toán, hết hạn, gán ô, nhận việc, gỡ người nhận. |
| PR-A10 | Nội dung tiếng Việt, mở đầu **mã nghiệp vụ** (`[CHECK_IN] …`), ≤ 500 ký tự. Lỗi ghi log không làm hỏng nghiệp vụ. |
| PR-A11 | Admin xem toàn hệ thống; lọc người thao tác, role, đối tượng, mã đối tượng, khoảng ngày. *(làm sau: FM xem log cơ sở mình)* |
| BR-97 | Màn `/admin/logs`: chỉ `ADMIN` `ACTIVE` (403 `FORBIDDEN_ROLE`). Lọc: người thao tác (tên/email, hoặc bấm tên trong bảng → đúng 1 người), role người thao tác, đối tượng (`target_entity`, dropdown lấy từ dữ liệu), mã đối tượng (khớp chính xác), nội dung (gõ được `[CHECK_IN]`), từ ngày – đến ngày (trọn ngày; từ > đến → 400). 20 dòng/trang, mới nhất trước. Bộ lọc nằm trên URL. Không xuất file. |
| BR-98 | Mỗi dòng: thời gian, người thao tác (tên, email, role; tài khoản `system` hiện "Hệ thống · Tự động"), **mã nghiệp vụ** tách từ `[MÃ]` (log cũ chưa có mã → "—"), nội dung, đối tượng + mã. Bấm mã đối tượng → lọc mọi log của đối tượng đó. |
| BR-99 | Chỉ dùng **1 tài khoản job** `system@queenkho.local`; `system@queenkho.com` cũ được migration gộp vào (chuyển log rồi xoá). Dời lịch bắt buộc `managerId`, No-Show bắt buộc `staffId` → log ghi đúng FM (sửa L-21). |
| BR-100 | Dashboard `/admin`: tổng / hoạt động / khoá / vô hiệu (không tính `system`), số theo role, cơ sở `ACTIVE` chưa có FM `ACTIVE` (PR-A4), số log hôm nay, 10 log mới nhất. Mỗi ô số dẫn tới màn đã lọc sẵn. |

### UC-26 Gửi yêu cầu hỗ trợ (Customer) ⬜
| Mã | Rule |
|---|---|
| PR-51 | Ticket **bắt buộc gắn hợp đồng** `ACTIVE` / `OVERDUE` / `TERMINATION_PENDING` của chính khách; câu hỏi chung → hotline. |
| PR-S1 | Loại: `LOCK_ISSUE` (**khẩn**), `SECURITY` (**khẩn**), `FACILITY_DAMAGE`, `CLEANING`, `OTHER`. Mô tả 10–1000 ký tự. Mã `SR-xxxxxx`. |
| PR-S2 | Mỗi hợp đồng: 1 ticket mở / loại, tối đa 3 ticket mở. |
| PR-S3 | Khách huỷ ticket còn `OPEN` → `CLOSED`, task `CANCELLED`. |
| PR-52 | Ticket `RESOLVED`: "Đã ổn" → `CLOSED`; "Chưa xong" (bắt buộc lý do) → `OPEN` + task `SUPPORT` mới; 3 ngày không phản hồi → job tự `CLOSED`. |
| PR-S9 | Trang `/ho-tro`: danh sách ticket (mã, hợp đồng, loại, trạng thái, ngày tạo, kết quả xử lý) + tạo / huỷ / xác nhận. |

### UC-27 Xử lý yêu cầu hỗ trợ (Staff) ⬜
| Mã | Rule |
|---|---|
| PR-34 | Tạo ticket → task `SUPPORT` tại cơ sở của hợp đồng, hạn theo BR-61; cờ khẩn suy ra từ loại; ticket đi theo task (task `IN_PROGRESS` → ticket `IN_PROGRESS`). |
| PR-S4 | Task `SUPPORT` `OVERDUE`: Staff không làm tiếp; **FM gia hạn** (hạn mới + lý do) → `OPEN` / `IN_PROGRESS` (giữ người nhận). Log. |
| PR-S5 | Chỉ Staff giữ task `IN_PROGRESS`, chưa quá hạn, mới hoàn tất; **bắt buộc kết quả xử lý** (≤ 1000). 1 transaction: task `COMPLETED`; ticket `RESOLVED` + `resolution_note` + `resolved_at`; log. |
| PR-S6 | Ticket `LOCK_ISSUE`: nút **"Cấp lại PIN"** (6 số, không trùng — BR-73), log. Hợp đồng `OVERDUE` không cấp lại (PR-Q5). |
| PR-S7 | Hỗ trợ **không phát sinh phí**; hư hỏng do khách chỉ tính lúc nghiệm thu (UC-24). |
| PR-S8 | Hợp đồng `TERMINATED` / `LIQUIDATED` → ticket còn mở `CLOSED`, task `CANCELLED`. |

---

## 4. Lỗi trong code hiện tại

| Mã | Mức | Mô tả | Chỗ | Sửa theo |
|---|---|---|---|---|
| L-02 | 🔴 | `POST /contracts/{id}/renew` ghi giao dịch `SUCCESS` không thu tiền, không kiểm tra trạng thái hợp đồng. | `ContractService.renewContract` | PR-R6 |
| L-13 | 🔴 | Tạo đơn không kiểm tra số suất → 2 khách cùng đặt suất cuối đều thành công. | `ReservationService.createReservation` | PR-B1 |
| L-15 | 🔴 | Job huỷ đơn tính 10 phút từ lúc tạo đơn, link VNPAY sống 10 phút từ lúc tạo link → IPN thành công về sau khi đơn đã huỷ: **tiền đã trừ, đơn mất**, giao dịch kẹt `PENDING`. | `ReservationCleanupService`, `VnpayService.settleDeposit` | PR-B6 |
| L-03 | 🟠 | Phí huỷ (24h / 50%) và cọc (1 tháng) viết cứng, không đọc `rental_policy`. | `ReservationService` | PR-15, PR-M6 |
| L-04 | 🟠 | Voucher: BE luôn trừ 100.000đ; FE có 3 mã không khớp BE. | `VnpayService.createReservation`, `CreateReservationPage.jsx`, `RegisterPage.jsx` | PR-B9 |
| L-06 | 🟠 | No-Show không hoàn tiền thuê, không có "miễn phạt". | `handleNoShow`, `NoShowModal.jsx` | PR-X1 |
| L-11 | 🟠 | Gợi ý & cho gán ô **khác loại** khi hết ô cùng loại. | `getAvailableUnitsForReservation`, `assignStorageUnit` | BR-41, BR-42 |
| L-14 | 🟠 | Form đặt chỗ bắt nhập SĐT, CCCD, địa chỉ nhưng **không gửi lên BE**. | `CreateReservationPage.jsx` | PR-B5 |
| L-17 | 🟠 | Check-in được **trước** ngày hẹn. | `StaffTaskRepository.completeCheckIn` | PR-C1 |
| L-18 | 🟠 | Form trả kho không gửi thông tin ngân hàng dù BE nhận được và FE hứa "hoàn vào tài khoản". | `ContractOptionsModal.jsx` | PR-O3 |
| L-20 | 🟠 | Số tháng gia hạn không kiểm tra ở BE; số tháng bị cắt từ mã giao dịch (≥ 100 là hỏng). | `VnpayService.createRenewal / settleRenewal` | PR-R2 |
| L-23 | 🟠 | FE hiện nút gia hạn / trả kho cho mọi trạng thái trừ `PENDING_CHECK_IN` (kể cả `TERMINATED`). | `CustomerContractPage.jsx` | PR-R1 |
| L-24 | 🟠 | Hoàn tất task `REFUND` chỉ nhận ảnh bằng chứng **tuỳ chọn**, chưa bắt buộc mã FT (chuyển khoản) / xác nhận ký nhận (tiền mặt). | `StaffTaskService.completeRefund` (#57) | PR-O15 |
| L-25 | 🟠 | No-Show bấm được ngay khi task quá hạn, chưa kiểm tra số lần liên hệ / 48h; báo cáo liên hệ ghi log không có mã `[CONTACT]` nên chưa đếm được. | `handleNoShow`, `submitContactReport` (#52) | PR-X3 |
| L-26 | 🟡 | Checklist check-in mới 5 mục, thiếu cam kết hàng cấm. | `StaffTaskService.checkIn`, `StaffTaskDetailPage.jsx` | PR-C7 |
| L-27 | 🟡 | Trả kho trước `end_date` không tính hoàn tiền thuê; ngày ân hạn chưa tính phí. | `ContractService.requestCheckout`, nghiệm thu (#57) | PR-O2, PR-O14 |
| ~~L-07~~ | ✅ | ~~Login không chặn `LOCKED` / `DISABLED`; lỗi trả chuỗi thuần và phân biệt "email không tồn tại" / "mật khẩu sai".~~ Đã sửa ở UC-08. | `AuthService.login`, `AuthController` | PR-L1, PR-L2 |
| L-08 | 🟡 | Hết hạn giữ chỗ ghi `CANCELLED` thay `EXPIRED`; giao dịch `PENDING` không chuyển `FAILED`. | `ReservationCleanupService` | PR-B7 |
| L-09 | 🟡 | Ngày bắt đầu: BE cho hôm nay, FE từ ngày mai; ngày hẹn trả kho không kiểm tra ở BE. | `createReservation`, `requestCheckout` | PR-B4, PR-O1 |
| L-10 | 🟡 | API No-Show không kiểm tra ngày bắt đầu đã qua. | `handleNoShow` | PR-X2 |
| L-19 | 🟡 | Trang hợp đồng đọc `vnp_ResponseCode` nhưng BE trả `vnpResponse` → không báo kết quả gia hạn. | `CustomerContractPage.jsx` | PR-R8 |
| ~~L-21~~ | ✅ | ~~Log dời lịch (và No-Show khi thiếu `staffId`) ghi `user_id` là khách thay vì FM.~~ Đã sửa ở UC-31. | `ReservationService` | PR-A8 |
| L-22 | 🟡 | FE gửi `customerId: sessionUser.userId ?? 1` → mất phiên thì đặt hộ user 1. | `CreateReservationPage.jsx` | PR-B3 |
| L-12 | 🟡 | Comment trạng thái trong SQL chưa khớp code (`TERMINATION_PENDING`, `COMPLETED` của reservation; `RESERVED` không dùng). | `QueenKho_full.sql` | Mục 5 |

*(Đã đóng: L-01 — #55 nới ràng buộc bảng task, cho phép task `REFUND`; L-05 — hai bảng ưu đãi khác nhau là cố ý, D-08. L-16 gộp vào PR-B2.)*

---

## 5. Thay đổi schema cần làm

> Sửa `sql_script/QueenKho_full.sql` (và file con tương ứng) **trước**, rồi mới sửa Entity (`ddl-auto: validate`). Sau khi merge → nhắc cả nhóm chạy lại script.

| Bảng | Thay đổi | Vì rule | UC phụ trách |
|---|---|---|---|
| `facilities` | + `code` NVARCHAR(4) NOT NULL UNIQUE (dữ liệu mẫu: TB, BT, TD, GV, CG, Q7…) | PR-M1 | UC-04 |
| `unit_types` | + `status` NVARCHAR(20) NOT NULL DEFAULT `'ACTIVE'` | PR-M4 | UC-05 |
| `rental_policy` | − `lock_account_days`; `late_fee_per_day` → `late_fee_percent_per_day` INT DEFAULT 10; + `late_fee_max_percent` INT DEFAULT 50 | D-05, PR-Q13 | UC-07 |
| `support_requests` | + `resolution_note` NVARCHAR(1000) NULL, `resolved_at` DATETIME2 NULL, `closed_at` DATETIME2 NULL | PR-S10 | UC-26/27 |
| `damage_cases` 🆕 | `id`, `contract_id` FK, `staff_id` FK, `description` NVARCHAR(1000), `cost` DECIMAL(12,2) ≥ 0, `created_at` | PR-O8 | UC-24 |
| `payment_transactions` | `payment_type` thêm `DAMAGE_FEE`; `payment_method` thêm `DEPOSIT_OFFSET`; + cột lưu **số tháng gia hạn** (vd `months` INT NULL) | PR-O9, PR-M8, PR-R2 | UC-24, UC-29, UC-21 |
| ~~`users`~~ | ✅ Tài khoản `system@queenkho.local` (role `ADMIN`, `DISABLED`) dùng cho log của job; UC-31 gộp tài khoản trùng `system@queenkho.com` và thêm index `IX_activitylogs_created_at`. | PR-A8 | UC-31 |
| `handover_records` | + `is_prohibited_goods_committed` BIT NOT NULL DEFAULT 0 | PR-C7 | UC-18 |
| Comment trạng thái | `reservations`: thêm `TERMINATION_PENDING`, `REFUNDED` (code #57 đang dùng), dùng `EXPIRED`; `storage_units`: bỏ `RESERVED` | L-12, PR-B7, PR-M9 | ai sửa SQL trước |
| ~~`staff_tasks`~~ | ✅ Đã đổi tên thành `facility_tasks`, thêm loại `REFUND` / `MAINTENANCE`, cột `evidence_image_url` (#55). Các chỗ khác trong tài liệu nhắc "bảng task" đều là `facility_tasks`. | PR-O12 | đã xong |

---

## 6. Mã lỗi API

Trả về dạng `{ "error": "CODE", "message": "..." }`.

| HTTP | Mã | Khi nào | Rule |
|---|---|---|---|
| 400 | `INVALID_INPUT` | Thiếu / sai dữ liệu đầu vào | chung |
| 401 | `INVALID_CREDENTIALS` | Sai email hoặc mật khẩu | PR-L2 |
| 403 | `ACCOUNT_LOCKED` / `ACCOUNT_DISABLED` | Tài khoản bị khoá / vô hiệu | PR-L1 |
| 403 | `FORBIDDEN_ROLE` / `FORBIDDEN_FACILITY` | Sai role / khác cơ sở (đã có ở UC-17/18) | BR-63 → 65 |
| 409 | `OUT_OF_STOCK` | Hết suất khi tạo đơn | PR-B1 |
| 409 | `PENDING_EXISTS` | Khách đang có đơn chờ thanh toán | PR-B2 |
| 409 | `CUSTOMER_HAS_DEBT` | Khách có hợp đồng quá hạn / còn nợ | PR-Q12 |
| 409 | `CHECK_IN_TOO_EARLY` | Check-in / nghiệm thu trước ngày hẹn | PR-C1, PR-O5 |
| 409 | `TASK_TOO_FAR` | Nhận task có hạn quá 3 ngày | PR-C6 |
| 409 | `CONTRACT_NOT_RENEWABLE` | Gia hạn hợp đồng sai trạng thái | PR-R1 |
| 409 | `SLOT_IN_USE` | Thao tác ô kho làm âm số suất | PR-M10 |
| 409 | `NO_SHOW_NOT_ALLOWED_YET` | Chưa đủ 2 lần liên hệ cách 24h / chưa qua 48h | PR-X3 |
| 400 | `REFUND_EVIDENCE_REQUIRED` | Hoàn tất hoàn tiền thiếu mã FT / xác nhận ký nhận | PR-O15 |
| 409 | `CUSTOMER_HAS_ACTIVE_RENTAL` | Khoá / vô hiệu khách đang thuê | PR-A5 |
| 404 | `ROLE_NOT_FOUND` | Sửa mô tả role không tồn tại | BR-91 |
| 404 | `USER_NOT_FOUND` | Admin thao tác user không tồn tại / tài khoản `system` | UC-08 |
| 409 | `EMAIL_EXISTS` | Tạo tài khoản trùng email | BR-93 |
| 409 | `FACILITY_HAS_MANAGER` | Cơ sở đã có FM `ACTIVE` khác | PR-04, BR-95 |
| 409 | `STAFF_HAS_TASK_IN_PROGRESS` | Staff đang giữ task `IN_PROGRESS` / `OVERDUE` | BR-94 |
| 409 | `LAST_ACTIVE_ADMIN` | Khoá / đổi role Admin `ACTIVE` cuối cùng | PR-A7 |
| 409 | `CANNOT_LOCK_SELF` / `CANNOT_CHANGE_OWN_ROLE` | Admin tự khoá / tự đổi role mình | BR-95 |
| 409 | `TASK_*`, `PIN_TAKEN`, `RFID_TAKEN`, `CHECKLIST_INCOMPLETE`… | Đã có trong `StaffTaskException` (UC-17/18) | BR-64 → 74 |

---

## 7. Lịch sử thay đổi theo góp ý

### 17/10/2026 — Góp ý thành viên ("Góp ý Business rule")
| # | Góp ý | Kết quả | Rule |
|---|---|---|---|
| 1 | Trả kho sớm: thu hồi ưu đãi + phí phá hợp đồng thay vì giữ toàn bộ tiền thuê | ✅ Nhận, bổ sung công thức cụ thể | D-10, PR-O2 |
| 2 | Ân hạn: miễn phí 24h, ngày 2–5 tính phí trừ vào cọc | ✅ Nhận; mức phí = tiền thuê theo ngày (giá / 30) | D-11, PR-O1, PR-O14 |
| 3 | Tách giờ quầy 21:00 và giờ ra vào kho 24/7 | ✅ Nhận (chỉ làm rõ tài liệu) | PR-92 |
| 4 | Bắt buộc bằng chứng khi FM hoàn tiền | ✅ Nhận có điều chỉnh: bắt buộc **mã FT** (chuyển khoản) / **ký nhận** (tiền mặt); ảnh không bắt buộc vì chưa có chức năng upload | PR-O15 |
| 5 | Checklist mục 6: cam kết hàng cấm | ✅ Nhận; thêm cột `handover_records.is_prohibited_goods_committed` | PR-C7, PR-O6 |
| 6 | No-Show: ≥ 2 lần liên hệ cách 24h, sau 48h mới được bấm | ✅ Nhận; đếm theo log `[CONTACT]` | D-07, PR-X3 |

Đồng thời cập nhật tài liệu theo code mới trên `main`: `facility_tasks` + task `REFUND` do FM xử lý (#55, #57), báo cáo liên hệ No-Show (#52), trạng thái đơn `REFUNDED`.
