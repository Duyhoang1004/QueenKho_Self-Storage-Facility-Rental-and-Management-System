# API CONTRACT - Authentication (UC-01 & UC-02)
# ================================================
# File nay la "hop dong" giua Frontend va Backend.
# Truoc khi code, ca team doc file nay de thong nhat format JSON.
# KHONG duoc tu y doi ten field ma khong bao ca team.
# ================================================


# ==============================================================================
# UC-02: DANG KY TAI KHOAN (Register)
# ==============================================================================
# Endpoint:  POST /api/auth/register
# Muc dich:  Khach hang tao tai khoan moi
# ==============================================================================

# --- REQUEST (Frontend gui len) ---
# Content-Type: application/json
#
# {
#   "fullName":  "Nguyen Van A",
#   "email":     "nguyenvana@gmail.com",
#   "phone":     "0901234567",
#   "password":  "MyPassword@123"
# }
#
# Quy tac:
#   - Tat ca field deu BAT BUOC (fullName, email, phone, password)
#   - Dung camelCase cho ten field (fullName, KHONG PHAI full_name)
#   - email dung de dang nhap (khong co truong username rieng)
#   - password la mat khau go (Backend se tu bam BCrypt, Frontend KHONG bam)
#   - KHONG gui "role" len - Backend tu gan role CUSTOMER mac dinh


# --- RESPONSE THANH CONG ---
# HTTP Status: 201 Created
#
# {
#   "message": "Dang ky thanh cong"
# }


# --- RESPONSE LOI ---
#
# HTTP 409 Conflict:
# { "error": "DUPLICATE_EMAIL",  "message": "Email da duoc su dung" }
#
# HTTP 400 Bad Request:
# { "error": "INVALID_EMAIL",    "message": "Email sai dinh dang" }
# { "error": "WEAK_PASSWORD",    "message": "Mat khau phai co it nhat 8 ky tu, gom chu hoa, chu thuong, so va ky tu dac biet" }
# { "error": "MISSING_FIELD",    "message": "Thieu truong bat buoc", "field": "phone" }
# { "error": "INVALID_PHONE",    "message": "So dien thoai sai dinh dang" }


# ==============================================================================
# UC-01: DANG NHAP (Login)
# ==============================================================================
# Endpoint:  POST /api/auth/login
# Muc dich:  Xac thuc tai khoan, tra ve JWT token
# ==============================================================================

# --- REQUEST (Frontend gui len) ---
# Content-Type: application/json
#
# {
#   "email":    "nguyenvana@gmail.com",
#   "password": "MyPassword@123"
# }
#
# Quy tac:
#   - Dang nhap bang EMAIL (khong phai username)
#   - password la mat khau goc, KHONG bam truoc


# --- RESPONSE THANH CONG ---
# HTTP Status: 200 OK
#
# {
#   "token":    "eyJhbGciOiJIUzI1NiJ9.xxxxx.yyyyy",
#   "userId":   1,
#   "fullName": "Nguyen Van A",
#   "email":    "nguyenvana@gmail.com",
#   "role":     "CUSTOMER"
# }
#
# Quy tac:
#   - "token" la JWT, Frontend luu vao localStorage
#   - "role" chi co 1 trong 5 gia tri: CUSTOMER | STAFF | FACILITY_MANAGER | BOM | ADMIN
#   - Frontend dung "role" de dieu huong trang:
#       CUSTOMER          -> trang chu khach hang
#       STAFF             -> dashboard nhan vien
#       FACILITY_MANAGER  -> dashboard quan ly co so
#       BOM               -> dashboard van hanh
#       ADMIN             -> trang quan tri he thong


# --- RESPONSE LOI ---
#
# HTTP 401 Unauthorized:
# { "error": "INVALID_CREDENTIALS", "message": "Email hoac mat khau khong dung" }
#
# HTTP 403 Forbidden:
# { "error": "ACCOUNT_LOCKED",   "message": "Tai khoan da bi khoa" }
# { "error": "ACCOUNT_DISABLED", "message": "Tai khoan da bi vo hieu hoa" }
#
# Luu y: Trang thai user trong DB la ACTIVE / LOCKED / DISABLED
#   - ACTIVE   -> cho dang nhap binh thuong
#   - LOCKED   -> tra loi 403 voi error = ACCOUNT_LOCKED
#   - DISABLED -> tra loi 403 voi error = ACCOUNT_DISABLED


# ==============================================================================
# UC-10: TAO DON DAT CHO KHO BAI (Create Reservation)
# ==============================================================================
# Endpoint:  POST /api/v1/reservations
# Muc dich:  Khach hang tao don dat cho kho moi
# ==============================================================================

# --- REQUEST (Frontend gui len) ---
# Content-Type: application/json
#
# {
#   "customerId":     1,
#   "facilityId":     1,
#   "unitTypeId":     1,
#   "startDate":      "2026-10-01",
#   "durationMonths": 3
# }
#
# Quy tac:
#   - Tat ca field deu BAT BUOC
#   - startDate khong duoc o qua khu (dinh dang YYYY-MM-DD)
#   - durationMonths toi thieu la 1 thang

# --- RESPONSE THANH CONG ---
# HTTP Status: 201 Created
#
# {
#   "id":              1,
#   "reservationCode": "RES-849201",
#   "depositAmount":   500000,
#   "status":          "PENDING",
#   "startDate":       "2026-10-01",
#   "durationMonths":  3,
#   "message":         "Tạo đơn đặt chỗ thành công"
# }

# --- RESPONSE LOI ---
# HTTP 400 Bad Request:
# { "error": "INVALID_INPUT", "message": "Ngày bắt đầu không được ở quá khứ" }
# { "error": "BAD_REQUEST",   "message": "Khách hàng không tồn tại" }


# ==============================================================================
# QUY TAC CHUNG CHO MOI API (AP DUNG TU SPRINT 1 TRO DI)
# ==============================================================================
#
# 1. RESPONSE LOI luon co dang:
#    { "error": "MA_LOI_VIET_HOA", "message": "Mo ta loi" }
#
# 2. RESPONSE THANH CONG co the co dang:
#    { "message": "Thao tac thanh cong", ... data ... }
#
# 3. TEN FIELD trong JSON luon dung camelCase:
#    fullName    (DUNG)     full_name    (SAI)
#    userId      (DUNG)     user_id      (SAI)
#    unitTypeId  (DUNG)     unit_type_id (SAI)
#
# 4. TRANG THAI (status) trong JSON luon VIET HOA:
#    "ACTIVE"    (DUNG)     "Active"     (SAI)
#    "LOCKED"    (DUNG)     "locked"     (SAI)
#
# 5. Spring Boot cau hinh trong application.yaml de tu dong chuyen
#    snake_case (DB) -> camelCase (JSON):
#
#    spring:
#      jackson:
#        property-naming-strategy: LOWER_CAMEL_CASE


# ==============================================================================
# HUONG DAN FRONTEND: GAN TOKEN VAO MOI REQUEST SAU KHI LOGIN
# ==============================================================================
#
# File: src/services/axiosClient.js
#
#   import axios from 'axios';
#
#   const axiosClient = axios.create({
#       baseURL: 'http://localhost:8080/api',
#       headers: { 'Content-Type': 'application/json' }
#   });
#
#   // Tu dong gan token vao header moi request
#   axiosClient.interceptors.request.use((config) => {
#       const token = localStorage.getItem("accessToken");
#       if (token) {
#           config.headers.Authorization = `Bearer ${token}`;
#       }
#       return config;
#   });
#
#   export default axiosClient;


# ==============================================================================
# UC-11: THANH TOAN TIEN DAT COC (Pay Deposit)
# ==============================================================================
# Endpoint:  POST /api/v1/payments
# Muc dich:  Xac nhan khach hang da chuyen khoan dat coc thanh cong
#            Cap nhat trang thai don dat cho tu PENDING -> DEPOSIT_PAID
# Nguoi thuc hien: Nghia
# ==============================================================================

# --- REQUEST (Frontend gui len sau khi khach hang bam "Da chuyen khoan xong") ---
# Content-Type: application/json
#
# {
#   "reservationCode": "RES-849201",
#   "amount":          500000,
#   "paymentMethod":   "VIETQR"
# }
#
# Quy tac:
#   - reservationCode: lay tu response cua UC-10
#   - amount: so tien dat coc (lay tu depositAmount cua UC-10)
#   - paymentMethod: "VIETQR" | "NAPAS247" | "CASH"

# --- RESPONSE THANH CONG ---
# HTTP Status: 200 OK
#
# {
#   "paymentId":       1,
#   "reservationCode": "RES-849201",
#   "status":          "DEPOSIT_PAID",
#   "paidAt":          "2026-10-01T10:45:00",
#   "message":         "Thanh toán đặt cọc thành công"
# }

# --- RESPONSE LOI ---
# HTTP 404 Not Found:
# { "error": "RESERVATION_NOT_FOUND", "message": "Không tìm thấy đơn đặt chỗ" }
#
# HTTP 400 Bad Request:
# { "error": "ALREADY_PAID",    "message": "Đơn này đã được thanh toán" }
# { "error": "WRONG_AMOUNT",    "message": "Số tiền không khớp" }

# --- GHI CHU CHO NGHIA ---
# 1. Sau khi thanh toan thanh cong, UPDATE reservations SET status = 'DEPOSIT_PAID' WHERE reservation_code = ?
# 2. UC-13 (Facility Manager) chi hien don co status = 'DEPOSIT_PAID' -> NEU SAI status, UC-13 se khong hoat dong
# 3. Frontend dang cho tai PaymentQRPage.jsx - Luon goi api.post('/payments', data) sau khi khach bam nut xac nhan
# 4. Sau khi API tra ve thanh cong -> Frontend tu dong chuyen sang /booking/confirmation

# ==============================================================================
# BANG TOM TAT
# ==============================================================================
#
# | API              | Method | URL                   | Request Body                                                      | Success                                              |
# |------------------|--------|-----------------------|-------------------------------------------------------------------|------------------------------------------------------|
# | Dang ky          | POST   | /api/auth/register    | { fullName, email, phone, password }                              | 201: { message }                                     |
# | Dang nhap        | POST   | /api/auth/login       | { email, password }                                               | 200: { token, userId, fullName, email, role }        |
# | Tao don dat kho  | POST   | /api/v1/reservations  | { customerId, facilityId, unitTypeId, startDate, durationMonths } | 201: { id, reservationCode, depositAmount, status }  |
# | Thanh toan coc   | POST   | /api/v1/payments      | { reservationCode, amount, paymentMethod }                        | 200: { paymentId, reservationCode, status, paidAt }  |


# ==============================================================================
# UC-16: BANG CONG VIEC TAI CO SO (Staff Task Board)
# ==============================================================================
# Endpoint:  GET /api/v1/staff-tasks?facilityId={id}[&status={STATUS}]
# Muc dich:  Staff va Facility Manager xem cac viec check-in / check-out cua co so minh
# ==============================================================================
#
# Task duoc SINH TU DONG, khong co API tao tay:
#   - CHECK_IN : khi Manager gan o (UC-14). Hop dong tao ra o trang thai PENDING_CHECK_IN
#   - CHECK_OUT: khi khach yeu cau tra kho (UC-22). Chi cho phep khi hop dong ACTIVE / OVERDUE
#   - Khach gia han (UC-21, ke ca qua VNPAY) khi dang TERMINATION_PENDING -> task CHECK_OUT dang mo bi CANCELLED
#   - dueAt = 21:00 ngay hen (check-in: expectedAppointmentTime, check-out: checkoutDate).
#     Moc do da qua -> truoc 21h: 21:00 hom nay, sau 21h: 21:00 hom sau
#   - Job moi phut: task OPEN / IN_PROGRESS qua dueAt -> OVERDUE
#
# Query params:
#   - facilityId (BAT BUOC): lay tu sessionStorage user.facilityId (login da tra ve)
#   - status (tuy chon): OPEN | IN_PROGRESS | OVERDUE | COMPLETED | CANCELLED. Khong truyen = tat ca
#
# --- RESPONSE THANH CONG ---
# HTTP Status: 200 OK  (sap xep dueAt tang dan)
#
# [
#   {
#     "id": 1,
#     "taskType": "CHECK_IN",              // CHECK_IN | CHECK_OUT
#     "status": "OPEN",
#     "dueAt": "2026-10-14T21:00:00",
#     "createdAt": "2026-10-12T21:51:23",
#     "claimedAt": null,
#     "completedAt": null,
#     "note": null,                        // CHECK_OUT: ngay tra kho + STK hoan coc + ghi chu cua khach
#     "staffId": null,                     // nhan vien da nhan viec (UC-17), null = chua ai nhan
#     "staffName": null,
#     "contractId": 4,
#     "contractCode": "HD-383974",
#     "contractStatus": "PENDING_CHECK_IN",
#     "customerName": "Nguyen Van A",
#     "customerPhone": "0354401156",
#     "storageUnitId": "KV-TB-T901",
#     "unitTypeName": "Kho Mini M"
#   }
# ]
#
# --- RESPONSE LOI ---
# HTTP 400 Bad Request:
# { "error": "INVALID_INPUT", "message": "Trạng thái không hợp lệ: abc" }
#
# --- THAY DOI LIEN QUAN ---
# POST /api/v1/auth/login tra them: "facilityId", "facilityName" (null voi CUSTOMER)
# rental_contracts.status them gia tri: PENDING_CHECK_IN (sau UC-14, truoc khi check-in)


# ==============================================================================
# UC-17: NHAN VIEC / GO NGUOI NHAN (Staff Task Claim)
# ==============================================================================
# Endpoint 1: POST /api/v1/staff-tasks/{id}/claim?staffId={userId}       (Staff nhan viec)
# Endpoint 2: POST /api/v1/staff-tasks/{id}/unassign?managerId={userId}  (Facility Manager go nguoi nhan)
# Khong co request body. staffId / managerId = sessionStorage user.userId
# ==============================================================================
#
# Quy tac:
#   - claim   : chi role STAFF, cung co so voi task, task phai OPEN + chua co nguoi nhan + chua qua dueAt
#               -> status IN_PROGRESS, staffId = nguoi nhan, claimedAt = now. Nhan roi khong tu tra lai.
#               2 nguoi bam cung luc: chi 1 nguoi thanh cong (UPDATE co dieu kien), nguoi kia nhan 409
#   - unassign: chi role FACILITY_MANAGER, cung co so, task phai IN_PROGRESS
#               -> status OPEN, staffId = null, claimedAt = null (nhan vien khac nhan lai duoc)
#   - Task OVERDUE: khong claim / unassign duoc (xu ly o UC khac)
#
# --- RESPONSE THANH CONG ---
# HTTP 200 OK: 1 object task da cap nhat, cung format voi phan tu cua GET /api/v1/staff-tasks
#
# --- RESPONSE LOI ---  { "error": "CODE", "message": "..." }
# 400 INVALID_INPUT          : thieu staffId / managerId
# 404 USER_NOT_FOUND         : khong tim thay tai khoan
# 404 TASK_NOT_FOUND         : khong tim thay task
# 403 FORBIDDEN_ROLE         : sai role (FM goi claim, Staff goi unassign...)
# 403 FORBIDDEN_FACILITY     : task khong thuoc co so cua nguoi thao tac
# 409 TASK_ALREADY_CLAIMED   : "Task đã được <ten> nhận trước" / "Bạn đã nhận task này rồi"
# 409 TASK_OVERDUE           : task da qua han
# 409 TASK_NOT_CLAIMABLE     : task da COMPLETED / CANCELLED
# 409 TASK_NOT_ASSIGNED      : unassign task chua co nguoi nhan
# 409 TASK_NOT_UNASSIGNABLE  : unassign task da dong


# ==============================================================================
# UC-18: CHECK-IN & LAP BIEN BAN BAN GIAO (Handover Record)
# ==============================================================================
# Endpoint 1: GET  /api/v1/staff-tasks/{id}?userId={userId}           (chi tiet task - Staff / FM cung co so)
# Endpoint 2: GET  /api/v1/staff-tasks/pin-suggestion                 (goi y ma PIN 6 so chua bi dung)
# Endpoint 3: POST /api/v1/staff-tasks/{id}/check-in?staffId={userId} (Staff check-in + lap bien ban)
# ==============================================================================
#
# Quy tac check-in:
#   - Chi role STAFF, cung co so, task CHECK_IN dang IN_PROGRESS, dung nguoi da nhan (UC-17), chua qua dueAt
#   - Hop dong phai PENDING_CHECK_IN
#   - Du 5 muc checklist = true; PIN dung 6 chu so; RFID bat buoc (<= 50 ky tu); notes <= 1000 ky tu
#   - PIN / RFID khong trung voi hop dong ACTIVE / OVERDUE / TERMINATION_PENDING
#   - Thanh cong (1 transaction):
#       handover_records  : INSERT (record_type CHECK_IN, staff_id, 5 cot BIT = 1, notes)
#       rental_contracts  : status ACTIVE, access_pin_code, rfid_card_code
#       staff_tasks       : status COMPLETED, completed_at = now
#       activity_logs     : "Check-in HĐ <ma>, ô <ma o>"
#     reservations (UNIT_ASSIGNED) va storage_units (OCCUPIED) giu nguyen
#
# --- Endpoint 2 RESPONSE ---
# HTTP 200: { "accessPinCode": "483920" }
# 409 PIN_UNAVAILABLE: khong sinh duoc PIN (thu lai)
#
# --- Endpoint 3 REQUEST BODY ---
# {
#   "identityVerified": true,             // da xac minh CCCD
#   "unitEmpty": true,                    // o kho trong
#   "unitClean": true,                    // o kho sach
#   "lockIntact": true,                   // khoa nguyen ven
#   "customerSignatureConfirmed": true,   // khach da ky bien ban
#   "accessPinCode": "483920",            // lay tu endpoint 2
#   "rfidCardCode": "RFID-TD-000201",
#   "notes": "..."                        // tuy chon
# }
#
# --- RESPONSE THANH CONG (Endpoint 1 va 3) ---
# HTTP 200 OK:
# {
#   "id": 5, "taskType": "CHECK_IN", "status": "COMPLETED",
#   "dueAt": "...", "createdAt": "...", "claimedAt": "...", "completedAt": "...", "note": null,
#   "staffId": 21, "staffName": "Nhân viên Thủ Đức 1",
#   "contractId": 5, "contractCode": "HD-805337", "contractStatus": "ACTIVE",
#   "contractStartDate": "2026-10-14", "contractEndDate": "2026-11-14",
#   "accessPinCode": "122005", "rfidCardCode": "RFID-TD-000201",
#   "customerName": "...", "customerPhone": "...", "customerEmail": "...",
#   "storageUnitId": "KV-TD-B201", "unitTypeName": "Kho Gia Đình", "facilityName": "QueenKho Thủ Đức",
#   "handoverRecord": {                   // null neu task chua COMPLETED / khong co bien ban
#     "id": 2, "recordType": "CHECK_IN",
#     "identityVerified": true, "unitEmpty": true, "unitClean": true, "lockIntact": true,
#     "customerSignatureConfirmed": true, "notes": null,
#     "staffId": 21, "staffName": "Nhân viên Thủ Đức 1", "createdAt": "2026-10-13T08:33:10"
#   }
# }
#
# --- RESPONSE LOI ---  { "error": "CODE", "message": "..." }
# 400 INVALID_INPUT           : thieu userId / staffId / body, PIN sai dinh dang, thieu RFID, qua do dai
# 400 CHECKLIST_INCOMPLETE    : chua tick du 5 muc
# 404 USER_NOT_FOUND / TASK_NOT_FOUND
# 403 FORBIDDEN_ROLE          : khong phai STAFF (check-in) / khong phai STAFF, FM (xem chi tiet)
# 403 FORBIDDEN_FACILITY      : task khong thuoc co so
# 409 TASK_NOT_CHECK_IN       : task khong phai CHECK_IN
# 409 TASK_NOT_IN_PROGRESS    : task chua nhan / da huy
# 409 TASK_NOT_YOURS          : task do nhan vien khac phu trach
# 409 TASK_OVERDUE            : task da qua han
# 409 TASK_ALREADY_COMPLETED  : da check-in roi (bam 2 lan)
# 409 CONTRACT_STATUS_INVALID : hop dong khong o PENDING_CHECK_IN
# 409 PIN_TAKEN / RFID_TAKEN  : ma da duoc cap cho hop dong khac
