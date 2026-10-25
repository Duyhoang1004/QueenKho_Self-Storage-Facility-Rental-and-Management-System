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
#   - (UC-08) Chi bao LOCKED/DISABLED SAU KHI mat khau dung; sai email hay sai mat khau deu 401 (PR-L1, PR-L2)
#   - (UC-08) HTTP 400 { "error": "INVALID_INPUT" } khi email / mat khau rong (email duoc trim - PR-L3)


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


# ==============================================================================
# UC-03: QUAN TRI VAI TRO & PHAN QUYEN (Admin Roles)
# ==============================================================================
# Endpoint 1: GET /api/v1/admin/roles                                (danh sach 5 role + so nguoi dung)
# Endpoint 2: PUT /api/v1/admin/roles/{id}?actorUserId={adminId}    (sua mo ta role)
# ==============================================================================
#
# Quy tac (PR-A1):
#   - 5 role co dinh: khong tao / xoa / doi ten, chi sua description
#   - userCount: moi trang thai; activeCount: chi ACTIVE; khong tinh tai khoan system@queenkho.local
#   - actorUserId phai la ADMIN dang ACTIVE (tam nhan qua query - no PR-90)
#   - description: trim, bat buoc, toi da 255 ky tu
#   - Mo ta khong doi -> 200, khong ghi log
#   - Doi mo ta -> ghi activity_logs: "[ROLE_UPDATE] Sua mo ta vai tro X: "cu" → "moi"", target_entity = 'roles'
#
# --- REQUEST (Endpoint 2) ---
# { "description": "Nhân viên tại cơ sở" }
#
# --- RESPONSE THANH CONG ---
# Endpoint 1 - HTTP 200 OK: mang 5 phan tu, sap xep theo id
# [
#   { "id": 1, "name": "CUSTOMER", "description": "Khách hàng thuê kho", "userCount": 5, "activeCount": 5 },
#   { "id": 2, "name": "STAFF", "description": "Nhân viên tại cơ sở", "userCount": 18, "activeCount": 18 },
#   ...
# ]
# Endpoint 2 - HTTP 200 OK: 1 object role da cap nhat (cung format phan tu o tren)
#
# --- RESPONSE LOI ---  { "error": "CODE", "message": "..." }
# 400 INVALID_INPUT   : thieu actorUserId / mo ta rong / qua 255 ky tu
# 403 FORBIDDEN_ROLE  : nguoi thao tac khong ton tai / khong phai ADMIN / khong ACTIVE
# 404 ROLE_NOT_FOUND  : khong tim thay role


# ==============================================================================
# UC-08: QUAN LY TAI KHOAN NGUOI DUNG (Admin Users)
# ==============================================================================
# Endpoint 1: GET   /api/v1/admin/users?keyword=&role=&status=&facilityId=&page=0&size=20   (danh sach + loc)
# Endpoint 2: GET   /api/v1/admin/users/facility-options                                     (dropdown co so + FM hien tai)
# Endpoint 3: POST  /api/v1/admin/users?actorUserId={adminId}                                (tao tai khoan noi bo)
# Endpoint 4: PUT   /api/v1/admin/users/{id}?actorUserId={adminId}                           (sua ten / SDT / role / co so)
# Endpoint 5: PATCH /api/v1/admin/users/{id}/status?actorUserId={adminId}                    (khoa / vo hieu / mo lai)
# Endpoint 6: PUT   /api/v1/admin/users/{id}/password?actorUserId={adminId}                  (dat lai mat khau)
# ==============================================================================
#
# Quy tac (PR-03..05, PR-A2..A7):
#   - Danh sach gom CA khach hang; an tai khoan system@queenkho.local. Sap xep createdAt DESC, id DESC
#   - keyword tim trong ho ten / email / SDT (khong phan biet hoa thuong); size toi da 100 (sai -> 20)
#   - Admin chi tao / doi qua lai STAFF, FACILITY_MANAGER, BOM, ADMIN. CUSTOMER chi tu dang ky
#   - STAFF / FM bat buoc co so ACTIVE (giu nguyen co so cu dang INACTIVE thi van cho); BOM / ADMIN -> facilityId = null
#   - Moi co so toi da 1 FM ACTIVE (tao / doi role / chuyen co so / mo lai deu kiem tra)
#   - Email: trim + lowercase, khong trung, KHONG sua duoc. SDT: ^0\d{9}$. Ho ten 1-100. Mat khau >= 6 (BCrypt)
#   - Khach hang: chi sua ho ten + SDT (roleName / facilityId bi bo qua)
#   - Staff dang giu task IN_PROGRESS / OVERDUE (staff_id = minh) -> khong doi role / chuyen co so / khoa
#   - Khong tu khoa minh, khong tu doi role minh; luon con >= 1 Admin ACTIVE
#   - Khoa / vo hieu bat buoc reason (<= 255, chi luu trong log). Khoa khach dang thue -> 409
#   - Khoa FM / FM roi co so -> van thanh cong, tra kem "warning": "Co so X chua co quan ly" (PR-A4)
#   - Khong doi gi -> 200, khong ghi log
#   - Log activity_logs (target_entity = 'users', target_id = id user):
#       [USER_CREATE] [USER_UPDATE] [USER_LOCK] [USER_DISABLE] [USER_UNLOCK] [USER_RESET_PASSWORD]
#     (khong ghi mat khau vao log)
#
# --- REQUEST ---
# Endpoint 3: { "fullName": "Nguyễn Văn A", "email": "a@queenkho.com", "phone": "0901234567",
#               "roleName": "STAFF", "facilityId": 2, "password": "123456" }
# Endpoint 4: { "fullName": "Nguyễn Văn A", "phone": "0901234567", "roleName": "FACILITY_MANAGER", "facilityId": 3 }
# Endpoint 5: { "status": "LOCKED", "reason": "Vi phạm quy định" }     // status: ACTIVE | LOCKED | DISABLED
# Endpoint 6: { "newPassword": "654321" }
#
# --- RESPONSE THANH CONG ---
# Endpoint 1 - HTTP 200:
# {
#   "content": [
#     { "id": 34, "fullName": "Staff UC08", "email": "uc08.staff@queenkho.com", "phone": "0900000003",
#       "role": "STAFF", "status": "ACTIVE", "facilityId": 2, "facilityCode": "BT",
#       "facilityName": "QueenKho Bình Thạnh", "createdAt": "2026-10-20T07:46:59.11" }
#   ],
#   "page": 0, "size": 20, "totalElements": 33, "totalPages": 2
# }
# Endpoint 2 - HTTP 200:
# [ { "id": 1, "code": "TB", "name": "QueenKho Tân Bình", "status": "ACTIVE", "managerId": 6, "managerName": "Quản lý Tân Bình" } ]
# Endpoint 3 - HTTP 201, Endpoint 4/5/6 - HTTP 200:
# { "user": { ...giong 1 phan tu content... }, "warning": null }
#   (Endpoint 3: user.createdAt = null vi DB moi dien DEFAULT - FE tai lai danh sach)
#
# --- RESPONSE LOI ---  { "error": "CODE", "message": "..." }
# 400 INVALID_INPUT               : thieu actorUserId / body; sai ten, SDT, email, mat khau; role khong hop le;
#                                   thieu co so / co so INACTIVE; thieu ly do khoa; status sai
# 403 FORBIDDEN_ROLE              : nguoi thao tac khong phai ADMIN dang ACTIVE
# 404 USER_NOT_FOUND              : khong co user / la tai khoan system
# 409 EMAIL_EXISTS                : email da dung
# 409 FACILITY_HAS_MANAGER        : co so da co FM ACTIVE khac
# 409 STAFF_HAS_TASK_IN_PROGRESS  : Staff dang giu task IN_PROGRESS / OVERDUE
# 409 LAST_ACTIVE_ADMIN           : khoa / doi role Admin ACTIVE cuoi cung
# 409 CANNOT_LOCK_SELF            : tu khoa minh
# 409 CANNOT_CHANGE_OWN_ROLE      : tu doi role minh
# 409 CUSTOMER_HAS_ACTIVE_RENTAL  : khach con don PENDING/DEPOSIT_PAID/UNIT_ASSIGNED
#                                   hoac hop dong PENDING_CHECK_IN/ACTIVE/OVERDUE/TERMINATION_PENDING

# ==============================================================================
# UC-31: NHAT KY HOAT DONG & TONG QUAN ADMIN (Admin Activity Logs / Dashboard)
# ==============================================================================
# Endpoint 1: GET /api/v1/admin/activity-logs?actorUserId={adminId}&userId=&actor=&role=&targetEntity=
#                 &targetId=&keyword=&from=YYYY-MM-DD&to=YYYY-MM-DD&page=0&size=20   (danh sach + loc)
# Endpoint 2: GET /api/v1/admin/activity-logs/target-entities?actorUserId={adminId}    (dropdown doi tuong)
# Endpoint 3: GET /api/v1/admin/dashboard?actorUserId={adminId}                        (trang /admin)
# ==============================================================================
#
# Quy tac (PR-07, PR-A8, PR-A10, PR-A11):
#   - CHI DOC: khong co API sua / xoa log
#   - Ca 3 API yeu cau actorUserId la ADMIN dang ACTIVE
#   - Sap xep createdAt DESC, id DESC; size toi da 100 (sai -> 20)
#   - userId: dung 1 nguoi (bam ten trong bang); actor: tim trong ho ten / email nguoi thao tac
#   - role: role cua nguoi thao tac; targetEntity / targetId: khop chinh xac (targetId la chuoi)
#   - keyword: tim trong noi dung log, ky tu [ ] % _ duoc hieu theo nghia den (go "[CHECK_IN]" duoc)
#   - from / to loc theo NGAY, lay tron ngay "to"; from > to -> 400
#   - actionCode tach tu "[MA] noi dung" (log cu chua co ma -> actionCode = null, content = nguyen van)
#   - systemAccount = true khi log do job ghi (system@queenkho.local) -> FE hien "He thong / Tu dong"
#   - Dashboard: so lieu KHONG tinh tai khoan system; facilitiesWithoutManager = co so ACTIVE chua co FM ACTIVE (PR-A4)
#
# --- RESPONSE THANH CONG ---
# Endpoint 1 - HTTP 200:
# {
#   "content": [
#     { "id": 17, "createdAt": "2026-10-20T07:52:12.190343",
#       "userId": 31, "userFullName": "Quản trị viên", "userEmail": "admin@queenkho.com", "userRole": "ADMIN",
#       "systemAccount": false, "actionCode": "USER_LOCK",
#       "content": "Khoá tài khoản fmquan7@gmail.com (ACTIVE → LOCKED). Lý do: ...",
#       "targetEntity": "users", "targetId": "11" }
#   ],
#   "page": 0, "size": 20, "totalElements": 18, "totalPages": 1
# }
# Endpoint 2 - HTTP 200:  [ "roles", "users" ]
# Endpoint 3 - HTTP 200:
# {
#   "totalUsers": 33, "activeUsers": 33, "lockedUsers": 0, "disabledUsers": 0,
#   "roles": [ { "role": "CUSTOMER", "total": 5, "active": 5 }, ... ],      // du 5 role theo id
#   "facilitiesWithoutManager": [ { "id": 4, "code": "GV", "name": "QueenKho Gò Vấp" } ],
#   "logsToday": 2,
#   "recentLogs": [ ...10 phan tu giong content cua Endpoint 1... ]
# }
#
# --- RESPONSE LOI ---  { "error": "CODE", "message": "..." }
# 400 INVALID_INPUT   : thieu actorUserId; from > to
# 400 (Spring)        : from / to sai dinh dang YYYY-MM-DD
# 403 FORBIDDEN_ROLE  : nguoi thao tac khong phai ADMIN dang ACTIVE
#
# --- THAY DOI API CU (PR-A8 / L-21: log ghi dung nguoi thao tac) ---
# PUT  /api/v1/reservations/{id}/reschedule : body them "managerId" (BAT BUOC, id FM dang thao tac)
#        { "newStartDate": "2026-12-01", "reason": "...", "managerId": 6 }
#        thieu -> 400 { "error": "INVALID_INPUT", "message": "Thiếu người thao tác (managerId)" }
#        log doi thanh "[RESCHEDULE] ..." voi user_id = managerId (truoc day la id khach)
# POST /api/v1/reservations/{id}/no-show    : "staffId" tro thanh BAT BUOC
#        thieu -> 400 { "error": "INVALID_ACTION", "message": "Thiếu người thao tác (staffId)" }

## UC-07: Chính sách thuê kho

Chạy `sql_script/Update_rental_policy_uc07.sql` trên database hiện có trước khi khởi động backend mới. Script này tự tạo chính sách v1 mặc định cho cơ sở nào còn thiếu; chạy lại không ghi đè chính sách hiện có. Database tạo mới dùng `QueenKho_full.sql`.

Mọi request dưới đây dùng `Authorization: Bearer <accessToken>` từ đăng nhập. BOM đang ACTIVE được xem và tạo phiên bản; FM đang ACTIVE chỉ được xem chính sách của cơ sở mình.

- `GET /api/v1/rental-policies`: phiên bản hiện hành của mỗi cơ sở (BOM).
- `GET /api/v1/rental-policies/facilities/{facilityId}`: phiên bản hiện hành (BOM hoặc FM cùng cơ sở).
- `GET /api/v1/rental-policies/facilities/{facilityId}/history`: tất cả phiên bản, mới nhất trước (BOM hoặc FM cùng cơ sở).
- `POST /api/v1/rental-policies/facilities/{facilityId}`: tạo phiên bản mới (BOM), HTTP 201.
- `POST /api/v1/rental-policies/facilities/{facilityId}/activate/{policyId}`: chọn đúng phiên bản đã có làm bản đang áp dụng (BOM), không tạo bản mới, HTTP 200.

Body tạo phiên bản: `{ "depositMonthMultiplier": 1, "cancelFeePercent": 50, "cancelFreeHours": 24, "lateFeePercentPerDay": 10 }`. Các trường là số nguyên; phí trễ mỗi ngày từ 0–50%. Phiên bản mới có trần phí trễ cố định 50% tiền cọc và mốc xét thanh lý cố định 30 ngày. Response thêm `id`, `facilityId`, `version`, `active`, `lateFeeMaxPercent`, `liquidationDays`, `createdAt`, `createdBy`. Chính sách đã phát hành không có API ghi đè/xoá vì hợp đồng cũ giữ `rental_policy_id` đã ký. Chạy `sql_script/Update_rental_policy_uc07.sql` để thêm `is_active` và ràng buộc mỗi cơ sở chỉ có một bản đang áp dụng.
