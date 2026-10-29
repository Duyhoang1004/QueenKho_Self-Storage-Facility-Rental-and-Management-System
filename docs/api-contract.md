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
#   (26/10/2026 — PR-90: managerId / staffId nay do backend tu dien theo token, FE gui hay khong deu duoc)

## UC-07: Chính sách thuê kho

Chạy `sql_script/Update_rental_policy_uc07.sql` trên database hiện có trước khi khởi động backend mới. Script này tự tạo chính sách v1 mặc định cho cơ sở nào còn thiếu; chạy lại không ghi đè chính sách hiện có. Database tạo mới dùng `QueenKho_full.sql`.

Mọi request dưới đây dùng `Authorization: Bearer <accessToken>` từ đăng nhập. BOM đang ACTIVE được xem và tạo phiên bản; FM đang ACTIVE chỉ được xem chính sách của cơ sở mình.

- `GET /api/v1/rental-policies`: phiên bản hiện hành của mỗi cơ sở (BOM).
- `GET /api/v1/rental-policies/facilities/{facilityId}`: phiên bản hiện hành (BOM hoặc FM cùng cơ sở).
- `GET /api/v1/rental-policies/facilities/{facilityId}/history`: tất cả phiên bản, mới nhất trước (BOM hoặc FM cùng cơ sở).
- `POST /api/v1/rental-policies/facilities/{facilityId}`: tạo phiên bản mới (BOM), HTTP 201.
- `POST /api/v1/rental-policies/facilities/{facilityId}/activate/{policyId}`: chọn đúng phiên bản đã có làm bản đang áp dụng (BOM), không tạo bản mới, HTTP 200.

Body tạo phiên bản: `{ "depositMonthMultiplier": 1, "cancelFeePercent": 50, "cancelFreeHours": 24, "lateFeePercentPerDay": 10 }`. Các trường là số nguyên; phí trễ mỗi ngày từ 0–50%. Phiên bản mới có trần phí trễ cố định 50% tiền cọc và mốc xét thanh lý cố định 30 ngày. Response thêm `id`, `facilityId`, `version`, `active`, `lateFeeMaxPercent`, `liquidationDays`, `createdAt`, `createdBy`. Chính sách đã phát hành không có API ghi đè/xoá vì hợp đồng cũ giữ `rental_policy_id` đã ký. Chạy `sql_script/Update_rental_policy_uc07.sql` để thêm `is_active` và ràng buộc mỗi cơ sở chỉ có một bản đang áp dụng.

## Hoàn thiện 5 flow Must-have (26/10/2026)

DB đang có dữ liệu: chạy `sql_script/Update_hoan_thien_flow.sql` (thêm cột ưu đãi / miễn phí trễ, `reservations.rent_discount_percent`, bảng `login_history`). DB mới: `QueenKho_full.sql` đã gộp sẵn.

### PR-90 — Xác thực & phân quyền theo token (áp dụng cho MỌI API)

- Mọi request `/api/**` đi qua `AccessControlFilter` + bảng quyền `AccessPolicy` (backend/api/.../security).
- API công khai (không cần token): `POST /auth/login|register|logout`, `GET /facilities`, `/facilities/search`, `/facilities/cities`, `/facilities/{id}/availability`, `/facilities/{id}/pricing`, `GET /unit-types`, VNPAY `/return` `/ipn`.
- API còn lại cần `Authorization: Bearer <accessToken>`:
  - thiếu / sai / hết hạn token → `401 { "error": "UNAUTHORIZED" }`; tài khoản bị khoá giữa phiên → `401 ACCOUNT_LOCKED` (token bị huỷ).
  - vai trò không có quyền → `403 FORBIDDEN_ROLE`; API chưa khai báo trong bảng quyền → `403 API_NOT_DECLARED`.
  - bản ghi theo id không thuộc mình → `403 FORBIDDEN_OWNER` (khách) / `403 FORBIDDEN_FACILITY` (Staff, FM).
- Backend **ghi đè** tham số danh tính theo token (FE gửi sai cũng không có tác dụng): `actorUserId`, header `X-User-Id`, `userId` (trừ màn nhật ký Admin), `customerId` (khách), `staffId` (Staff), `managerId` (FM), `facilityId` + header `X-Facility-Id` (Staff, FM — luôn là cơ sở được gán). Body của tạo đơn / No-Show / dời lịch / thanh lý / liên hệ quá hạn / báo cáo liên hệ cũng lấy người thao tác từ token.
- `GET /api/v1/admin/roles/access-matrix` (ADMIN): ma trận quyền backend đang áp dụng
  `[{ "code": "TASK_MANAGE", "name": "...", "description": "...", "roleScopes": { "FACILITY_MANAGER": "Cơ sở được gán" } }]`.
- `POST /api/v1/auth/logout`: huỷ token phía server + ghi lịch sử đăng xuất. Luôn 200 `{ "message": "Đã đăng xuất" }`.

### Flow 1 / 4 — Giá gói & ưu đãi theo chính sách

- `GET /api/v1/facilities/{id}/pricing` (công khai):
  `{ "facilityId": 1, "policyVersion": 2, "depositMonthMultiplier": 1, "bookingPackages": [{ "months": 3, "discountPercent": 5 }, ...], "renewalPackages": [...], "welcomeVoucher": 100000, "cancelFreeHours": 24, "cancelFeePercent": 50, "lateFeePercentPerDay": 10, "lateFeeMaxPercent": 50, "liquidationDays": 30, "allowLateFeeWaiver": true }`
- `POST /api/v1/reservations`: % ưu đãi gói được chốt vào đơn (`rent_discount_percent`) như tiền cọc. Lỗi mới:
  `409 NO_AVAILABILITY` (hết suất đúng loại + cơ sở, PR-B1), `400` "Cơ sở này đang tạm ngưng nhận đặt chỗ mới".
- `POST /api/v1/rental-policies/facilities/{facilityId}` (BOM): body thêm (không bắt buộc, bỏ trống = kế thừa bản đang hiệu lực)
  `bookingDiscount3m|6m|12m`, `renewalDiscount3m|6m|12m` (0–50) và `allowLateFeeWaiver` (true/false). Response trả thêm đúng các trường này.

### Flow 1 — Gán ô (sửa L-11)

- `GET /api/v1/reservations/{id}/available-units`: chỉ ô AVAILABLE **cùng cơ sở + cùng loại** với đơn; hết thì trả `[]`.
- `POST /api/v1/reservations/{id}/assign`: ô khác cơ sở / khác loại → `400`; 2 người gán cùng 1 ô → người sau `400` "không khả dụng".

### Flow 2 — Check-in (sửa L-17)

- `POST /api/v1/staff-tasks/{id}/check-in`: trước ngày khách hẹn nhận kho → `409 CHECK_IN_TOO_EARLY`.

### Flow 5 — FM giao việc

- `POST /api/v1/staff-tasks/{id}/assign?staffId=13` (FM): task `OPEN` → `IN_PROGRESS` với người được giao; task `IN_PROGRESS` → đổi người. Trả `StaffTaskResponse`. Log `[TASK_ASSIGN]`.
  Lỗi: `400 INVALID_STAFF` (không phải Staff cùng cơ sở), `400 STAFF_INACTIVE`, `409 TASK_ALREADY_ASSIGNED`, `409 TASK_NOT_ASSIGNABLE` (task REFUND / đã đóng), `409 TASK_OVERDUE`, `403 FORBIDDEN_FACILITY`.
- `POST /api/v1/staff-tasks/{id}/claim`: không cần `staffId` nữa (lấy từ token).

### Flow 5 / 4 — Báo cáo cơ sở cho FM

- FM được gọi `GET /api/v1/bom/revenue/overview|timeline|by-unit-type|transactions|occupancy` — `facilityId` luôn bị khoá về cơ sở của FM. `by-facility` (so sánh các cơ sở) chỉ BOM.
- `GET /api/v1/facilities/{id}/dashboard`: FM chỉ xem cơ sở của mình (`403 FORBIDDEN_FACILITY`).

### Flow 6 — Gia hạn & miễn phí trễ

- `GET /api/v1/contracts/{id}/renewal-quote` (khách chủ HĐ): báo giá 4 gói, đúng số VNPAY sẽ thu
  `[{ "months": 1, "discountPercent": 0, "monthlyPrice": 500000, "subtotal": 500000, "discountAmount": 0, "rentAmount": 500000, "lateFeeAmount": 150000, "lateFeeWaived": false, "totalAmount": 650000 }, ...]`
- `POST /api/v1/contracts/{id}/waive-late-fee` (FM) body `{ "reason": "5–400 ký tự" }` → `{ "message", "contractId", "lateFeeWaived": true, "waivedAmount" }`. Huỷ link gia hạn đang chờ (đã chốt phí trễ cũ). Log `[FEE_WAIVE]`.
  Lỗi: `400 INVALID_INPUT` (lý do), `403 WAIVER_NOT_ALLOWED` (BOM tắt trong chính sách), `403 FORBIDDEN_FACILITY`, `409 CONTRACT_NOT_OVERDUE`, `409 LATE_FEE_ALREADY_WAIVED`.
- `GET /api/v1/contracts/{id}` và `GET /contracts/manager/overdue`: trả thêm `lateFeeWaived`, `lateFeeWaiverNote` (HĐ chi tiết có thêm `facilityId`). Gia hạn thành công / đợt quá hạn mới → cờ tự tắt. Thanh lý vẫn trừ phí trễ theo D-09.

### UC-20 — Thanh toán của khách

- `GET /api/v1/payments/my` (khách, lấy từ token):
  `{ "summary": { "totalPaid", "totalRefunded", "pendingRefund", "outstandingDebt", "depositOffset" }, "debts": [PaymentItem], "overdueContracts": [{ "contractId", "contractCode", "reservationId", "facilityName", "overdueDays", "lateFeeAmount", "lateFeeWaived" }], "transactions": [PaymentItem] }`
  `PaymentItem = { id, transactionCode, paymentType, paymentMethod, amount, status, paidAt, renewalMonths, reservationId, reservationCode, contractId, contractCode, facilityName, unitTypeName }`
- `POST /api/payments/vnpay/create-debt` body `{ "paymentId": 70 }` → `{ "orderId": "QKF...", "payUrl", "amount" }`. Chỉ khoản `DAMAGE_FEE / VNPAY / PENDING` của chính khách (`403` / `409`).
  IPN thành công → khoản nợ `SUCCESS`, log `[DEBT_PAID]`, khách hết bị chặn `CUSTOMER_HAS_DEBT`. Khách huỷ trên VNPAY → khoản nợ **vẫn PENDING**. VNPAY trả về `/thanh-toan?orderId=...&vnpResponse=..`.
- Lỗi VNPAY (create / create-renewal / create-debt / status) nay trả `{ "error": "PAYMENT_ERROR", "message": "..." }`.

### Admin — Lịch sử đăng nhập

- `GET /api/v1/admin/login-history?keyword=&eventType=LOGIN_SUCCESS|LOGIN_FAILED|LOGOUT&from=YYYY-MM-DD&to=YYYY-MM-DD&page=0&size=20` (ADMIN)
  → `PageResponse<{ id, userId, email, fullName, role, eventType, failureReason, ipAddress, userAgent, createdAt }>`. `400 INVALID_INPUT` khi loại sự kiện sai / from > to.
- `GET /api/v1/admin/dashboard`: thêm `loginsToday`, `failedLoginsToday`.

### Log mới (PR-A9)

`[RESERVATION_CREATE]` (khách tạo đơn) · `[UNIT_ASSIGN]` (FM gán ô) · `[TASK_ASSIGN]` · `[FEE_WAIVE]` · `[DEBT_PAID]`.

## Demo — Giả lập tua thời gian (nút "⚡ Giả lập")

Bật / tắt: `queenkho.simulation.enabled` trong `application.yaml` (mặc định bật; tắt bằng biến môi trường `SIMULATION_ENABLED=false`). Khi tắt mọi API dưới đây (trừ `/status`) trả `404 SIMULATION_DISABLED`, FE ẩn toàn bộ nút. Mỗi lần giả lập ghi log `[SIMULATION] <người bấm> giả lập: ...`.

| API | Vai trò | Làm gì | Lỗi |
|---|---|---|---|
| `GET /api/v1/dev/simulation/status` | đã đăng nhập | `{ "enabled": true }` | |
| `POST /api/v1/dev/simulation/tasks/{taskId}/arrive-today` | STAFF, FM (cùng cơ sở) | Task CHECK_IN + HĐ PENDING_CHECK_IN: ngày hẹn / ngày bắt đầu HĐ = hôm nay, ngày kết thúc = hôm nay + số tháng, task hạn 21:00 (sau 21h → 21:00 ngày mai), task quá hạn được mở lại | `409 SIMULATION_NOT_APPLICABLE`, `403 FORBIDDEN_FACILITY` |
| `POST /api/v1/dev/simulation/reservations/{id}/expire-hold` | CUSTOMER (đơn của mình), FM | Đơn PENDING: lùi giờ tạo 16 phút rồi chạy ngay job huỷ giữ chỗ → `{ "status": "EXPIRED" }` | `409`, `403 FORBIDDEN_OWNER` |
| `POST /api/v1/dev/simulation/reservations/{id}/trigger-noshow` | FM | Đơn UNIT_ASSIGNED chưa check-in: giờ hẹn lùi 49h, task CHECK_IN quá hạn, ghi 2 log `[CONTACT][FAILED]` cách nhau 25h → đơn hiện ở tab No-Show và đủ điều kiện | `409`, `403` |
| `POST /api/v1/dev/simulation/contracts/{id}/make-overdue?days=3` | FM | HĐ ACTIVE / OVERDUE: hết hạn `days` ngày trước (start = end − số tháng), OVERDUE, tắt miễn phí trễ, huỷ link gia hạn đang chờ. `days=31` để vượt mốc thanh lý 30 ngày. HĐ **TERMINATION_PENDING** = khách không tới trả kho: thêm đơn về UNIT_ASSIGNED, huỷ task CHECK_OUT (giống job PR-Q1), `days` phải > 5 (ân hạn) | `400 INVALID_INPUT` (days ngoài 1–90, hoặc ≤ 5 với HĐ chờ trả kho), `409`, `403` |
| `POST /api/v1/dev/simulation/tasks/{taskId}/checkout-today` | STAFF, FM (cùng cơ sở) | Task CHECK_OUT + HĐ TERMINATION_PENDING: hạn task (= ngày hẹn trả kho) về 21:00 hôm nay, task quá hạn được mở lại → nghiệm thu được ngay | `409 SIMULATION_NOT_APPLICABLE`, `403` |
| `POST /api/v1/dev/simulation/contracts/{id}/add-failed-contacts` | FM | HĐ OVERDUE: ghi 3 log `[OVERDUE_CONTACT] HĐ <mã>: [SIMULATION] Gọi khách không nghe máy...` (cách nhau 1 tuần) → đủ điều kiện liên hệ để thanh lý | `409`, `403` |
| `POST /api/v1/dev/simulation/support-requests/{id}/auto-close` | CUSTOMER (ticket của mình), FM | Ticket RESOLVED: lùi thời điểm xử lý 4 ngày rồi chạy ngay job tự đóng → `{ "status": "CLOSED" }` | `409`, `403` |

## Bảo trì sau trả kho + Điều khoản xử lý tài sản (27/10/2026)

DB đang có dữ liệu: chạy `sql_script/Update_bao_tri.sql` (thêm `damage_cases.liable_party`, `reservations.terms_version` / `terms_accepted_at`). DB mới: `QueenKho.sql` / `QueenKho_full.sql` đã gộp sẵn.

### UC-24 — Phân lỗi sự cố khi nghiệm thu (`POST /api/v1/staff-tasks/{id}/check-out`)

- Mỗi phần tử `damageCases[]` **bắt buộc** thêm `"liableParty": "CUSTOMER" | "FACILITY"` → thiếu / sai: `400 INVALID_DAMAGE_ITEM`.
- `CUSTOMER` (lỗi khách): trừ vào cọc, vượt cọc thành nợ `DAMAGE_FEE PENDING` như cũ. `FACILITY` (lỗi cơ sở): chỉ ghi nhận chi phí, **không** tính khách — cọc hoàn bình thường.
- Có sự cố (kể cả chỉ lỗi cơ sở) → ô `MAINTENANCE` + sinh task `MAINTENANCE` (OPEN, hạn 21:00 sau 3 ngày).
- Response chi tiết task (`GET /staff-tasks/{id}`): `damageCases[].liableParty`; `totalDamageCost` = phần lỗi khách; thêm `facilityDamageCost`. Task `MAINTENANCE` cũng trả `damageCases` của hợp đồng.
- `GET /api/v1/contracts/{id}` (+ các API trả `CustomerContractResponse`): `damageFee` chỉ tính lỗi khách; thêm `facilityDamageFee`, `termsVersion`, `termsAcceptedAt`.

### PR-O10 — Hoàn tất task bảo trì

`POST /api/v1/staff-tasks/{id}/complete-maintenance` — STAFF đang giữ task, hoặc FM cùng cơ sở (đóng thẳng, không cần nhận việc; task quá hạn vẫn đóng được).

```json
{ "note": "Đã thay vách tôn, chống thấm trần", "evidenceImageUrl": "http://localhost:8080/uploads/x.png" }
```
- `note` bắt buộc 10–1000 ký tự; `evidenceImageUrl` không bắt buộc (upload qua `POST /api/v1/uploads`).
- Thành công: task `COMPLETED` (ghi chú nối `[Hoàn tất bởi ...]`), ô `MAINTENANCE → AVAILABLE`, log `[MAINTENANCE_DONE]`. Trả `StaffTaskDetailResponse`.
- Lỗi: `400 INVALID_INPUT` · `403 FORBIDDEN_ROLE` / `FORBIDDEN_FACILITY` · `409 TASK_NOT_MAINTENANCE` / `TASK_NOT_YOURS` / `TASK_ALREADY_COMPLETED` / `TASK_CANCELLED` / `TASK_NOT_IN_PROGRESS`.
- Quyền: nhóm mới `TASK_MAINTENANCE` (STAFF + FM, phạm vi cơ sở).

Thay đổi liên quan:
- `PUT /api/v1/storage-units/{id}/status` `AVAILABLE` (FM "Mở lại kho"): tự đóng task `MAINTENANCE` còn mở của ô.
- `GET /api/v1/storage-units...`: ô `MAINTENANCE` có task đang mở trả thêm `maintenanceTaskId`, `maintenanceReason` (`DAMAGE` / `LIQUIDATION`).

### Điều khoản xử lý tài sản khi không trả kho

- `POST /api/v1/reservations` body thêm `"acceptedTerms": true` (**bắt buộc**) → thiếu: `400 TERMS_NOT_ACCEPTED`. Backend lưu `terms_version = "v1"` + `terms_accepted_at`. Nội dung điều khoản: `frontend/src/components/AssetTermsModal.jsx`.
- `POST /api/v1/contracts/{id}/liquidate`: cần ≥ 3 log liên hệ `[OVERDUE_CONTACT]` → thiếu: `409 NOT_ENOUGH_CONTACTS`. Thanh lý xong sinh task `MAINTENANCE` "Dọn ô sau thanh lý" (FM / Staff bấm "Dọn xong" → ô `AVAILABLE`).
- `GET /api/v1/contracts/manager/overdue`: thêm `minContactsRequired` (3), `termsVersion` (NULL = đơn cũ chưa đồng ý → không được bán hàng).

### PR-Q10 — Hàng lưu giữ sau thanh lý (PR B)

DB: `Update_bao_tri.sql` mục 3–4 (cột `facility_tasks.maintenance_reason`, bảng `held_goods`).

**Dọn xong task thanh lý** (`POST /staff-tasks/{id}/complete-maintenance`, task có `maintenanceReason = "LIQUIDATION"`) — body thêm biên bản kiểm kê:
```json
{ "note": "...", "inventoryNote": "12 thùng carton, 1 tủ lạnh mini", "witnessNote": "Staff 1 + FM",
  "storageLocation": "Khu K2 - kệ 3", "inventoryImages": ["http://localhost:8080/uploads/a.png"] }
```
- Hoặc `"noGoodsLeft": true` nếu ô trống (không lập hồ sơ). Thiếu → `400 INVENTORY_REQUIRED`.
- Thành công: lập `held_goods` `HOLDING`, `hold_until` = ngày thanh lý + 60. Chi tiết task trả thêm `maintenanceReason`, `heldGoodsId`, `heldGoodsStatus`, `heldGoodsHoldUntil`.

**FM** (quyền `HELD_GOODS_MANAGE`, cơ sở theo token):

| API | Mô tả |
|---|---|
| `GET /api/v1/held-goods?scope=HOLDING\|RESOLVED` | Danh sách: `contractCode`, khách, ô, `inventoryNote`, `evidenceImages[]`, `witnessNote`, `storageLocation`, `holdUntil`, `daysLeft`, `holdExpired`, `termsVersion`, `canSell`, `customerDebt`, `depositHeld`, kết quả xử lý (`proceedsAmount`, `debtOffsetAmount`, `refundAmount`, `resolvedNote`, `resolvedByName`, `resolvedAt`) |
| `POST /api/v1/held-goods/{id}/resolve` | Body `{ "outcome": "RETURNED\|SOLD\|DESTROYED\|HANDED_TO_AUTHORITY", "note": "10–1000 ký tự", "proceedsAmount": 2000000 }` |

Quy tắc `resolve`:
- `RETURNED`: khách hết nợ `DAMAGE_FEE PENDING` (không thì `409 CUSTOMER_HAS_DEBT`); làm bất cứ lúc nào trong thời hạn.
- `SOLD`: đã hết hạn (`409 HOLD_NOT_EXPIRED`) + khách đã đồng ý điều khoản (`409 TERMS_NOT_ACCEPTED`) + `proceedsAmount ≥ 0` (`400`). Tiền bán trừ nợ `DAMAGE_FEE PENDING` cũ nhất trước (đổi sang `SUCCESS`, method `GOODS_SALE`; trừ không hết thì tách khoản). Phần dư + cọc còn giữ (nếu FM chưa tạo yêu cầu hoàn cọc riêng) → 1 task `REFUND` cho FM + giao dịch `REFUND PENDING` (`REF-SALE-...`).
- `DESTROYED`: đã hết hạn. `HANDED_TO_AUTHORITY`: bất cứ lúc nào.
- Đã xử lý / 2 người bấm cùng lúc → `409 HELD_GOODS_ALREADY_RESOLVED`. Log `[GOODS_HELD]`, `[GOODS_<OUTCOME>]`.
- `CustomerContractResponse` thêm `heldGoodsStatus`, `heldGoodsHoldUntil`, `heldGoodsLocation`.

**Giả lập**: `POST /api/v1/dev/simulation/held-goods/{id}/expire-hold` (FM) — `hold_until` = hôm qua → bán / tiêu huỷ được ngay. `409` nếu đã xử lý, `403` khác cơ sở.

---

## Gia hạn báo trước 3 ngày & tối ưu doanh thu ô kho (27/10/2026)

> Rule: `business-rules.md` D-12, PR-R10 → R12, PR-Q8, PR-Q14, PR-Q15. ⚠️ Sau khi pull: chạy `sql_script/Update_gia_han_doanh_thu.sql` (DB cũ) hoặc chạy lại `QueenKho_full.sql` (DB mới) — backend `ddl-auto: validate` sẽ không khởi động nếu thiếu cột.

### API mới — `GET /api/v1/contracts/{id}/renewal-eligibility` (khách chủ HĐ, nhóm quyền `CUSTOMER_RENTAL`)
```json
{
  "contractId": 31, "status": "ACTIVE", "endDate": "2026-10-28",
  "priorityDeadline": "2026-10-25",   // end_date − 3: hết ngày này là hạn chót gia hạn ưu tiên
  "daysUntilDeadline": -2,            // âm = đã qua hạn chót
  "window": "LATE",                   // PRIORITY | LATE | CLOSED
  "renewable": false,
  "unitReleasing": true,              // ô đang được tính "sắp trống" cho đơn đặt mới
  "blockedReason": "Đã quá hạn chót gia hạn ưu tiên (25/10/2026) và ô kho này đã có khách khác đặt trước. ...",
  "packages": [ { "months": 1, "newEndDate": "2026-11-28" }, { "months": 3, "newEndDate": "2027-01-28" }, ... ]
}
```

### Thay đổi API cũ
| API | Thay đổi |
|---|---|
| `POST /api/payments/vnpay/create-renewal` | Cửa sổ muộn mà ô đã có người đặt trước → `409 { "error": "RENEWAL_UNIT_RESERVED" }`. HĐ `OVERDUE` (điều khoản v2): tạo thêm dòng phụ `OVERSTAY_FEE` mã `OS` + `orderId`; response thêm `overstayFeeAmount`; `amount` = thuê + phí trễ + phí chiếm dụng |
| `GET /api/v1/contracts/{id}/renewal-quote` | Mỗi gói thêm `overstayFeeAmount`; `totalAmount` đã cộng phí này |
| `GET /api/v1/contracts?reservationId=` (chi tiết HĐ khách) | Thêm `overstayDailyAmount`, `overstayFeeAmount`, `totalOverdueCharge`, `amountBeyondDeposit`; `estimatedDepositRefund` / `estimatedOverdueDepositRefund` trừ cả phí chiếm dụng; `liquidationDaysThreshold` mặc định 15 |
| `GET /api/v1/contracts/manager/overdue` (FM) | Thêm `overstayFeeAmount`, `totalOverdueCharge` (HĐ đã thanh lý: lấy từ giao dịch `OS-…`) |
| `POST /api/v1/contracts/{id}/liquidate` (FM) | Response thêm `overstayFeeAmount`, `overstayDebtAmount`; ghi `OVERSTAY_FEE` `DEPOSIT_OFFSET` (mã `OS-OFF-…`) + nợ `OVERSTAY_FEE` `VNPAY` `PENDING` (mã `OS-DEBT-…`) |
| `GET /api/v1/payments/my` | `overdueContracts[]` thêm `overstayFeeAmount`; `debts[]` gồm cả `OVERSTAY_FEE` (`renewalMonths` = null) |
| `POST /api/payments/vnpay/create-debt` | Nhận cả khoản nợ `OVERSTAY_FEE` (trừ dòng phụ của link gia hạn) |
| `POST /api/v1/reservations` | Số suất cộng ô "sắp trống" có ngày giao ≤ `startDate`. Hết suất → `409 NO_AVAILABILITY`, message báo ngày nhận kho sớm nhất; đơn mới lưu `termsVersion = "v2"` |
| `GET /api/v1/reservations/{id}/cancel-preview` + `POST .../cancel` | Đơn `DEPOSIT_PAID` chưa gán ô mà đã tới `startDate` → `penaltyAmount = 0`, hoàn 100% (PR-R12) |
| `GET /api/v1/facilities/search`, `GET /api/v1/facilities/{id}/availability` | Mỗi loại kho thêm `availableFrom` (yyyy-MM-dd): `null` = còn ô ngay; có giá trị = hết ô, nhận kho được từ ngày này. Loại kho có `availableFrom` vẫn hiện dù `availableCount = 0` |
| `GET/POST /api/v1/rental-policies/...` | Thêm `overstayPercent` (100–300, mặc định 150), `heldGoodsFeePercent` (0–100, mặc định 20); không gửi = kế thừa bản đang hiệu lực. Phiên bản mới `liquidationDays = 15` |
| `GET /api/v1/held-goods` | Thêm `storageFeePerDay`, `heldDays`, `estimatedStorageFee` (đang HOLDING), `storageFeeAmount` (đã chốt); `customerDebt` gồm cả nợ `OVERSTAY_FEE` |
| `POST /api/v1/held-goods/{id}/resolve` | Body thêm `storageFeeCollected` (boolean) — `RETURNED` mà cọc không đủ trả phí lưu giữ thì bắt buộc `true`, nếu không `409 STORAGE_FEE_UNPAID` |
| Báo cáo doanh thu (BOM / FM) | `OVERSTAY_FEE` tính vào **doanh thu thuê** (`rentalRevenue`) |
| `POST /api/v1/staff-tasks/{id}/check-out` | Lỡ ân hạn (> `end_date` + 5) → trừ thêm phí chiếm dụng; vượt cọc → nợ `OVERSTAY_FEE` riêng với nợ `DAMAGE_FEE` |

---

## UC-06 — Sơ đồ mặt bằng ô kho (29/10/2026)

> Chi tiết thiết kế: `update_map.md`. ⚠️ Sau khi pull: chạy `sql_script/Update_mat_bang.sql` (DB cũ, giữ dữ liệu) hoặc chạy lại `QueenKho_full.sql` / `QueenKho_TongHop.sql` (DB mới) — backend `ddl-auto: validate` sẽ không khởi động nếu thiếu bảng `facility_floors`, `floor_fixtures`.

Lưới: **1 ô = 0.5m**, toạ độ `(x, y)` là góc trên-trái tính bằng ô lưới. Mọi API dưới đây thuộc nhóm quyền `STORAGE_MANAGE` (chỉ `FACILITY_MANAGER`, cơ sở của mình — `facilityId` bị filter ghi đè theo token, `floorId` kiểm tra bằng `OwnershipGuard.checkFacilityFloor`).

### API mới
| API | Mô tả |
|---|---|
| `GET /api/v1/storage-units/layout?facilityId=` | Mặt bằng cơ sở: `{ facilityId, cellMeters: 0.5, floors: [{ id, name, gridWidth, gridHeight, sortOrder, fixtures: [{ id, type, label, x, y, w, h }] }] }`. Vị trí ô kho lấy từ `GET /storage-units` |
| `POST /api/v1/storage-units/layout/floors?facilityId=` | Tạo tầng. Body `{ name, gridWidth, gridHeight }` (10–200 ô). Trùng tên → `409 DUPLICATE_FLOOR` |
| `PUT /api/v1/storage-units/layout/floors/{floorId}` | Đổi tên / kích thước. Đổi tên → đổi luôn `storage_units.floor` của các ô thuộc tầng. Thu nhỏ làm ô / vật cố định ra ngoài → `400 MAP_OUT_OF_BOUNDS` |
| `DELETE /api/v1/storage-units/layout/floors/{floorId}` | Xoá tầng (kèm vật cố định). Còn ô kho thuộc tầng → `409 FLOOR_HAS_UNITS` |
| `PUT /api/v1/storage-units/layout/floors/{floorId}/plan` | Lưu mặt bằng 1 tầng trong 1 giao dịch (xem dưới) |

`PUT .../plan` body:
```json
{
  "units": [
    { "unitId": "KV-TB-A106", "x": 37, "y": 5, "w": 5, "h": 5, "door": "BOTTOM" },  // đặt / dời; w,h bỏ trống = mặc định theo loại kho
    { "unitId": "KV-TB-C105", "x": null }                                              // gỡ khỏi mặt bằng
  ],
  "fixtures": [ { "type": "AISLE", "label": "Lối đi A – B", "x": 12, "y": 10, "w": 44, "h": 4 } ]  // thay TOÀN BỘ
}
```
- `type`: `AISLE` / `ENTRANCE` / `STAIRS` / `ELEVATOR` / `OFFICE`; `door`: `TOP` / `BOTTOM` / `LEFT` / `RIGHT`.
- Ô đang thuộc tầng khác được đặt vào tầng này → `storage_units.floor` đổi theo.
- Kiểm tra cả tầng sau khi áp dụng: ra ngoài mặt bằng, 2 ô chồng nhau, ô đè vật cố định → `400 MAP_CONFLICT` (message liệt kê tối đa 5 lỗi), không lưu gì.
- Lỗi khác: `UNIT_NOT_IN_FACILITY`, `DUPLICATE_PLACEMENT`, `INVALID_FIXTURE_TYPE`, `INVALID_DOOR_SIDE`, `INVALID_SIZE`, `FLOOR_NOT_FOUND`.
- Ghi nhật ký `[FLOOR_CREATE]`, `[FLOOR_UPDATE]`, `[FLOOR_DELETE]`, `[FLOOR_PLAN]` (`target_entity = facility_floors`).

### Thay đổi API cũ
| API | Thay đổi |
|---|---|
| `GET /api/v1/storage-units`, `GET /api/v1/storage-units/{id}` | Mỗi ô thêm `mapX`, `mapY`, `mapW`, `mapH`, `mapDoor` (null = chưa đặt) và `defaultMapW`, `defaultMapH` (kích thước theo `unit_types.dimensions`) |
| `POST /api/v1/storage-units` | Body thêm tuỳ chọn `mapX`, `mapY`, `mapW`, `mapH`, `mapDoor`. Có `mapX` mà tầng chưa có mặt bằng → `400 FLOOR_HAS_NO_MAP`; chồng ô / vật cố định → `400 MAP_CONFLICT` |
| `PUT /api/v1/storage-units/{id}` | Đổi sang tầng khác → xoá vị trí cũ (ô về danh sách "chưa đặt") |
