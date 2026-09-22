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
# BANG TOM TAT
# ==============================================================================
#
# | API       | Method | URL                  | Request Body                         | Success                                           |
# |-----------|--------|----------------------|--------------------------------------|---------------------------------------------------|
# | Dang ky   | POST   | /api/auth/register   | { fullName, email, phone, password } | 201: { message }                                  |
# | Dang nhap | POST   | /api/auth/login      | { email, password }                  | 200: { token, userId, fullName, email, role }     |
