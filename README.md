# QueenKho - Self-Storage Facility Rental and Management System

> SWP391 Course Project — FPTU  
> **Tech Stack:** ReactJS (Vite) + Spring Boot 4.x + SQL Server  
> **Repo:** Monorepo (`frontend/` + `backend/` + `sql_script/`)

---

## Muc Luc

1. [Cai Dat Moi Truong](#1-cai-dat-moi-truong)
2. [Cau Hinh Database](#2-cau-hinh-database)
3. [Chay Du An](#3-chay-du-an)
4. [Quy Tac JSON API](#4-quy-tac-json-api)
5. [Vi Du JSON Cu The](#5-vi-du-json-cu-the)
6. [Lam Viec Nhom Tren Git](#6-lam-viec-nhom-tren-git)

---

## 1. Cai Dat Moi Truong

### Yeu cau

| Tool           | Version       | Link tai                                    |
|----------------|---------------|---------------------------------------------|
| JDK            | 17 LTS        | https://adoptium.net                        |
| Node.js        | 18+           | https://nodejs.org                          |
| SQL Server     | 2019/2022     | Co san hoac dung Express                    |
| IDE Backend    | IntelliJ IDEA | https://www.jetbrains.com/idea              |
| IDE Frontend   | VS Code       | https://code.visualstudio.com               |

### Cai dat bien moi truong (Database)

File `application.yaml` dung cu phap `${BIEN:gia_tri_mac_dinh}`.  
Neu password SQL Server cua ban **trung voi gia tri mac dinh** (`12345`) thi **khong can lam gi**.  
Neu password **khac** thi lam theo 1 trong 2 cach:

#### Cach 1: Dung GUI Windows

1. Nhan phim **Windows**, go **"Environment Variables"**
2. Chon **"Edit the system environment variables"**
3. Bam **"Environment Variables..."**
4. O phan **User variables**, bam **"New..."**:
   - Variable name: `DB_PASSWORD`
   - Variable value: `MatKhauCuaBan`
5. Bam **OK** tat ca cac cua so
6. **Khoi dong lai IntelliJ / VS Code**

#### Cach 2: Dung PowerShell

```powershell
# Tao bien moi truong cap User (ton tai vinh vien, khong mat khi tat may)
[System.Environment]::SetEnvironmentVariable("DB_PASSWORD", "MatKhauCuaBan", "User")
```

Khoi dong lai IDE sau khi chay lenh.

#### Kiem tra da thanh cong

Mo PowerShell **moi**, go:

```powershell
echo $env:DB_PASSWORD
```

Neu hien ra password ban vua dat -> Thanh cong.

#### Bang tham chieu cac bien moi truong

| Bien          | Mac dinh    | Khi nao can dat                            |
|---------------|-------------|--------------------------------------------|
| `DB_PASSWORD` | `12345`     | Password SQL Server cua ban khac `12345`   |
| `DB_USERNAME` | `sa`        | Username SQL Server cua ban khac `sa`      |
| `DB_NAME`     | `QueenKhoDB`| Ten database cua ban khac `QueenKhoDB`     |
| `DB_PORT`     | `1433`      | Port SQL Server cua ban khac `1433`        |

---

## 2. Cau Hinh Database

### Buoc 1: Tao database va cac bang

Mo SQL Server Management Studio (SSMS), mo file `sql_script/QueenKho.sql` va **chay toan bo**.  
Script se tu dong:
- Tao database `QueenKhoDB`
- Tao 12 bang (theo thu tu phu thuoc FK)
- Seed 5 roles: `CUSTOMER`, `STAFF`, `FACILITY_MANAGER`, `BOM`, `ADMIN`

### Buoc 2: Kiem tra

```sql
USE QueenKhoDB;
SELECT * FROM roles;
```

Thay 5 dong du lieu -> Thanh cong.

---

## 3. Chay Du An

### Backend (Spring Boot)

```bash
cd backend/api
./mvnw spring-boot:run
```

Backend chay tai: `http://localhost:8080`

### Frontend (ReactJS)

```bash
cd frontend
npm install
npm run dev
```

Frontend chay tai: `http://localhost:5173`

---

## 4. Quy Tac JSON API

> **QUAN TRONG:** Ca team (Frontend + Backend) phai doc va lam theo cac quy tac nay.  
> Chi tiet day du xem file `docs/api-contract.md`.

### 5 quy tac bat buoc

| #  | Quy tac                                 | Dung                  | Sai                   |
|----|------------------------------------------|-----------------------|-----------------------|
| 1  | Ten field dung **camelCase**             | `fullName`            | `full_name`           |
| 2  | Trang thai dung **CHU HOA**              | `"ACTIVE"`            | `"Active"`            |
| 3  | Response loi co `error` + `message`      | (xem vi du ben duoi)  |                       |
| 4  | Dang nhap bang **email**                 | `"email": "..."`      | `"username": "..."`   |
| 5  | FE gui password tho, BE tu bam BCrypt    | FE khong hash truoc   |                       |

### Cau hinh Spring Boot de tu dong chuyen snake_case -> camelCase

Them vao `application.yaml`:

```yaml
spring:
  jackson:
    property-naming-strategy: LOWER_CAMEL_CASE
```

---

## 5. Vi Du JSON Cu The

### UC-02: Dang Ky — `POST /api/auth/register`

**Frontend gui len (Request Body):**

```json
{
  "fullName": "Nguyen Van A",
  "email":    "nguyenvana@gmail.com",
  "phone":    "0901234567",
  "password": "MyPassword@123"
}
```

**Backend tra ve khi THANH CONG (201 Created):**

```json
{
  "message": "Dang ky thanh cong"
}
```

**Backend tra ve khi LOI — email da ton tai (409 Conflict):**

```json
{
  "error":   "DUPLICATE_EMAIL",
  "message": "Email da duoc su dung"
}
```

**Backend tra ve khi LOI — thieu field (400 Bad Request):**

```json
{
  "error":   "MISSING_FIELD",
  "message": "Thieu truong bat buoc",
  "field":   "phone"
}
```

---

### UC-01: Dang Nhap — `POST /api/auth/login`

**Frontend gui len (Request Body):**

```json
{
  "email":    "nguyenvana@gmail.com",
  "password": "MyPassword@123"
}
```

**Backend tra ve khi THANH CONG (200 OK):**

```json
{
  "token":    "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJuZ3V5ZW52YW5hQGdtYWlsLmNvbSIsInJvbGUiOiJDVVNUT01FUiIsImlhdCI6MTcyNjk4MDAwMH0.abcdef123456",
  "userId":   1,
  "fullName": "Nguyen Van A",
  "email":    "nguyenvana@gmail.com",
  "role":     "CUSTOMER"
}
```

**Backend tra ve khi LOI — sai mat khau (401 Unauthorized):**

```json
{
  "error":   "INVALID_CREDENTIALS",
  "message": "Email hoac mat khau khong dung"
}
```

**Backend tra ve khi LOI — tai khoan bi khoa (403 Forbidden):**

```json
{
  "error":   "ACCOUNT_LOCKED",
  "message": "Tai khoan da bi khoa"
}
```

---

### Frontend: Gui token theo moi request sau khi login

Sau khi login thanh cong, luu token vao localStorage:

```javascript
localStorage.setItem("accessToken", response.data.token);
```

Cau hinh Axios tu dong dinh kem token:

```javascript
// file: src/services/axiosClient.js
import axios from 'axios';

const axiosClient = axios.create({
    baseURL: 'http://localhost:8080/api',
    headers: { 'Content-Type': 'application/json' }
});

axiosClient.interceptors.request.use((config) => {
    const token = localStorage.getItem("accessToken");
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default axiosClient;
```

---

### Bang tom tat API

| API       | Method | URL                  | Request Body                         | Success Response                                  |
|-----------|--------|----------------------|--------------------------------------|----------------------------------------------------|
| Dang ky   | POST   | /api/auth/register   | { fullName, email, phone, password } | 201: { message }                                   |
| Dang nhap | POST   | /api/auth/login      | { email, password }                  | 200: { token, userId, fullName, email, role }      |

---

## 6. Lam Viec Nhom Tren Git

### Branching Strategy

```
main          <- Code on dinh, chi merge qua Pull Request
  |
  +-- dev     <- Nhanh tich hop, merge feature vao day truoc
       |
       +-- feature/UC-01-login        (nhanh ca nhan)
       +-- feature/UC-02-register     (nhanh ca nhan)
       +-- feature/UC-03-reservation  (nhanh ca nhan)
```

### Quy trinh lam viec hang ngay

```bash
# 1. Sang som: Cap nhat code moi nhat tu dev
git checkout feature/UC-xx-ten-tinh-nang
git pull origin dev

# 2. Code suot ngay, commit thuong xuyen
git add .
git commit -m "feat(UC-01): Hoan thanh login API"

# 3. Chieu toi: Push len va tao Pull Request
git push origin feature/UC-xx-ten-tinh-nang
# -> Len GitHub tao PR tu feature/UC-xx vao dev
# -> Can 1 nguoi review + approve moi duoc merge
```

### Quy tac commit message

```
feat(UC-01): Mo ta tinh nang moi
fix(UC-02):  Sua loi gi do
docs:        Cap nhat tai lieu
chore:       Cong viec linh tinh (config, dependency)
```
