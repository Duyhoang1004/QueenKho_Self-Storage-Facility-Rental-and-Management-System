# 📋 UC-09 Changelog — Tìm Kiếm & Khám Phá Kho (Landing Page)

> **Ngày thực hiện:** 28/09/2026  
> **Sprint:** Sprint 2 (28/09 – 04/10)  
> **Use Case:** UC-09 — Màn hình Tìm kiếm & Khám phá kho  
> **Trạng thái:** ✅ Hoàn thành Backend + Frontend

---

## 1. Tổng Quan Thay Đổi

| Hạng mục | Tạo mới | Cập nhật | Tổng |
|---|---|---|---|
| Backend Entity | 1 | 2 | 3 |
| Backend Repository | 3 | 1 | 4 |
| Backend Service | 2 | 0 | 2 |
| Backend Controller | 2 | 0 | 2 |
| Backend DTO | 4 | 0 | 4 |
| Frontend Page | 2 | 0 | 2 |
| Frontend Service | 1 | 0 | 1 |
| Frontend Routing | 0 | 1 | 1 |
| SQL Script | 1 | 0 | 1 |
| **Tổng** | **16** | **4** | **20** |

---

## 2. Chi Tiết Thay Đổi

### 2.1. Backend — Entity (Cập nhật)

#### ✏️ `Facility.java` — Bổ sung fields
- **File:** `backend/api/src/main/java/com/queenkho/api/entity/Facility.java`
- **Lý do:** Entity cũ chỉ có `id` và `name`, thiếu so với DB schema
- **Thêm:** `city`, `district`, `address`, `hotline`, `status`
- **Ánh xạ:** Khớp với bảng `facilities` trong `QueenKho.sql`

#### ✏️ `UnitType.java` — Bổ sung fields
- **File:** `backend/api/src/main/java/com/queenkho/api/entity/UnitType.java`
- **Lý do:** Entity cũ chỉ có `id` và `name`, thiếu so với DB schema
- **Thêm:** `areaSqm`, `volumeCbm`, `basePriceMonthly`, `suggestedCapacity`, `dimensions`, `features`
- **Ánh xạ:** Khớp với bảng `unit_types` trong `QueenKho.sql`

#### 🆕 `StorageUnit.java` — Entity mới
- **File:** `backend/api/src/main/java/com/queenkho/api/entity/StorageUnit.java`
- **Lý do:** Bảng `storage_units` đã có trong DB nhưng chưa có entity Java
- **PK:** String (mã ô kho dạng `KV-TB-A101`)
- **Relationships:** `@ManyToOne` → `Facility`, `@ManyToOne` → `UnitType`
- **Fields:** `id`, `facility`, `unitType`, `floor`, `zone`, `roomNumber`, `status`

### 2.2. Backend — Repository

#### 🆕 `FacilityRepository.java`
- **File:** `backend/api/src/main/java/com/queenkho/api/repository/FacilityRepository.java`
- **Methods:**
  - `findByStatus(String)` — lấy cơ sở theo status
  - `search(keyword, city, Pageable)` — JPQL tìm kiếm theo tên/quận/địa chỉ + city
  - `findDistinctCities()` — danh sách thành phố cho dropdown

#### 🆕 `UnitTypeRepository.java`
- **File:** `backend/api/src/main/java/com/queenkho/api/repository/UnitTypeRepository.java`
- **Methods:** Kế thừa CRUD từ `JpaRepository`

#### 🆕 `StorageUnitRepository.java`
- **File:** `backend/api/src/main/java/com/queenkho/api/repository/StorageUnitRepository.java`
- **Methods:**
  - `countByFacility_IdAndStatus()` — đếm ô theo status
  - `countByFacility_IdAndUnitType_IdAndStatus()` — đếm ô theo facility+unitType+status
  - `countGroupedByUnitType()` — batch count AVAILABLE grouped by unitType
  - `countAllGroupedByUnitType()` — batch count tổng grouped by unitType

#### ✏️ `ReservationRepository.java`
- **File:** `backend/api/src/main/java/com/queenkho/api/repository/ReservationRepository.java`
- **Thêm:**
  - `countByFacility_IdAndUnitType_IdAndStatusInAndStorageUnitIdIsNull()` — đếm pending reservations chưa gán ô
  - `countPendingGroupedByUnitType()` — batch count pending grouped by unitType

### 2.3. Backend — DTO (Mới)

| DTO | Mục đích |
|---|---|
| `UnitTypeResponse` | Response cho API lấy danh sách loại kho |
| `FacilitySummaryResponse` | Response cho API lấy danh sách cơ sở (kèm totalAvailableUnits) |
| `FacilitySearchResultItem` | Response cho API search (facility + unitType + availableCount) |
| `FacilityAvailabilityResponse` | Response cho API chi tiết availability 1 cơ sở (nested: FacilityInfo + List UnitTypeSlot) |

### 2.4. Backend — Service (Mới)

#### 🆕 `FacilityService.java`
- **Core logic UC-09:**
  - `getAllActiveFacilities()` → lấy tất cả facility ACTIVE kèm tổng ô trống
  - `searchFacilities(keyword, city, unitTypeId, minPrice, maxPrice, minArea, maxArea, Pageable)` → tìm kiếm với bộ lọc + tính `available_count = physical_available - pending_reservations`
  - `getFacilityAvailability(facilityId)` → chi tiết availability theo từng unitType tại 1 cơ sở
  - `getActiveCities()` → danh sách thành phố có cơ sở hoạt động
- **Tối ưu:** Dùng batch queries (GROUP BY) thay vì N+1 để tính available_count

#### 🆕 `UnitTypeService.java`
- `getAllUnitTypes()` → lấy tất cả loại kho cho dropdown filter

### 2.5. Backend — Controller (Mới)

#### 🆕 `FacilityController.java` — 4 endpoints
| Method | URL | Mô tả |
|---|---|---|
| `GET` | `/api/v1/facilities` | Lấy tất cả cơ sở ACTIVE |
| `GET` | `/api/v1/facilities/search` | Tìm kiếm với bộ lọc |
| `GET` | `/api/v1/facilities/{id}/availability` | Chi tiết availability 1 cơ sở |
| `GET` | `/api/v1/facilities/cities` | Danh sách thành phố |

#### 🆕 `UnitTypeController.java` — 1 endpoint
| Method | URL | Mô tả |
|---|---|---|
| `GET` | `/api/v1/unit-types` | Lấy tất cả loại kho |

### 2.6. Frontend — Pages (Mới)

#### 🆕 `SearchLandingPage.jsx` — Landing Page
- **Route:** `/tim-va-dat-kho`
- **File:** `frontend/src/pages/search/SearchLandingPage.jsx`
- **Gồm:**
  - Hero section gradient + search bar (keyword, city, unitType dropdowns)
  - Grid danh sách loại kho (6 cards) — click → search theo unitType
  - Grid danh sách chi nhánh (cards) — click → xem availability chi tiết
  - Banner ưu đãi khách mới
- **API calls on load:** `GET /facilities`, `GET /unit-types`, `GET /facilities/cities`

#### 🆕 `SearchResultsPage.jsx` — Trang kết quả
- **Route:** `/tim-va-dat-kho/ket-qua?keyword=...&city=...&unitTypeId=...`
- **File:** `frontend/src/pages/search/SearchResultsPage.jsx`
- **Gồm:**
  - Filter bar (keyword, city, unitType, price range)
  - Grid kết quả (facility + unitType + available count + giá)
  - Nút "Đặt kho" → navigate `/booking?facilityId=X&unitTypeId=Y`
  - Modal chi tiết facility → hiển thị tất cả unitType availability
  - Pagination
  - Empty state khi không có kết quả

### 2.7. Frontend — Service (Mới)

#### 🆕 `facilityService.js`
- **File:** `frontend/src/services/facilityService.js`
- **Functions:** `getAllFacilities()`, `searchFacilities()`, `getFacilityAvailability()`, `getCities()`, `getAllUnitTypes()`

### 2.8. Frontend — Routing (Cập nhật)

#### ✏️ `App.jsx`
- **Thay đổi chính:** Route `/tim-va-dat-kho` đổi từ `CreateReservationPage` → `SearchLandingPage`
- **Route mới:** `/tim-va-dat-kho/ket-qua` → `SearchResultsPage`
- Route `/booking` giữ nguyên cho `CreateReservationPage` (UC-10)

### 2.9. SQL Script (Mới)

#### 🆕 `QueenKhoDuLieuMau_UC09.sql`
- **File:** `sql_script/QueenKhoDuLieuMau_UC09.sql`
- **Nội dung:**
  - Cập nhật facility `QueenKho Quận 7` (thêm city/district/address/hotline)
  - Cập nhật unit_type `Kho nhỏ 2m²` (thêm đầy đủ fields)
  - Thêm 5 facilities mới (Tân Bình, Bình Thạnh, Thủ Đức, Gò Vấp, Cầu Giấy)
  - Thêm 5 unit_types mới (Mini M, Tiêu Chuẩn, Gia Đình, Lớn, Đặc Biệt XL)
  - Thêm 42 storage_units phân bố đều 6 cơ sở, mixed status
  - Script idempotent (IF NOT EXISTS)

---

## 3. Lưu Ý Quan Trọng

### ⚠️ Breaking Changes
1. **Route `/tim-va-dat-kho`** giờ trỏ sang `SearchLandingPage` thay vì `CreateReservationPage`. Link "Tìm & Đặt Kho" trên Sidebar và HomePage giờ sẽ mở trang tìm kiếm mới.
2. **Entity `Facility`** thêm nhiều fields mới — cần chạy SQL seed mới để có dữ liệu đầy đủ.
3. **Entity `UnitType`** thêm nhiều fields mới — cần chạy SQL seed mới.

### 📋 Bước Chạy Thử
1. Chạy `QueenKho.sql` (nếu chưa có DB)
2. Chạy `QueenKhoDuLieuMau1.sql` (dữ liệu test cơ bản)
3. Chạy `QueenKhoDuLieuMau_UC09.sql` (dữ liệu cho UC-09)
4. Start backend: `./mvnw spring-boot:run`
5. Start frontend: `npm run dev`
6. Mở browser → Login → Click "Tìm & Đặt Kho" hoặc truy cập `/tim-va-dat-kho`

### 🔗 Kết Nối UC-10
- Khi user bấm "Đặt kho" từ trang kết quả, sẽ navigate sang `/booking?facilityId=X&unitTypeId=Y`
- `CreateReservationPage` hiện tại dùng `MOCK_UNIT` cố định → **Sprint tiếp theo** sẽ đọc `facilityId` và `unitTypeId` từ URL params để load đúng thông tin kho từ API.

---

## 4. Cây File Thay Đổi

```
QueenKho/
├── backend/api/src/main/java/com/queenkho/api/
│   ├── controller/
│   │   ├── 🆕 FacilityController.java
│   │   └── 🆕 UnitTypeController.java
│   ├── dto/
│   │   ├── 🆕 FacilityAvailabilityResponse.java
│   │   ├── 🆕 FacilitySearchResultItem.java
│   │   ├── 🆕 FacilitySummaryResponse.java
│   │   └── 🆕 UnitTypeResponse.java
│   ├── entity/
│   │   ├── ✏️ Facility.java               (+city, district, address, hotline, status)
│   │   ├── 🆕 StorageUnit.java
│   │   └── ✏️ UnitType.java               (+areaSqm, volumeCbm, basePriceMonthly, ...)
│   ├── repository/
│   │   ├── 🆕 FacilityRepository.java
│   │   ├── ✏️ ReservationRepository.java   (+count queries)
│   │   ├── 🆕 StorageUnitRepository.java
│   │   └── 🆕 UnitTypeRepository.java
│   └── service/
│       ├── 🆕 FacilityService.java
│       └── 🆕 UnitTypeService.java
├── frontend/src/
│   ├── pages/search/
│   │   ├── 🆕 SearchLandingPage.jsx
│   │   └── 🆕 SearchResultsPage.jsx
│   ├── services/
│   │   └── 🆕 facilityService.js
│   └── ✏️ App.jsx                          (routing update)
└── sql_script/
    └── 🆕 QueenKhoDuLieuMau_UC09.sql
```
