# Cập nhật: Sơ đồ mặt bằng ô kho (UC-06, UC-14)

> Nhánh `feature/uc06-so-do-o-kho` · 29/10/2026
> Thay danh sách phẳng ở trang **Quản lý ô kho** bằng mặt bằng trực quan từng tầng: ô kho nằm đúng vị trí, to nhỏ theo kích thước thật, tô màu theo trạng thái. Quản lý cơ sở (FM) tự vẽ mặt bằng (kéo thả ô, lối đi, cửa, thang) và chọn chỗ ngay khi thêm ô mới.

---

## 1. Sau khi pull về phải làm gì

Backend dùng `ddl-auto: validate`, thiếu bảng hoặc cột mới thì **không khởi động được**. Chọn **1** trong 2 cách:

| DB của bạn | Chạy |
|---|---|
| Đang có dữ liệu, muốn giữ | `sql_script/Update_mat_bang.sql` (chỉ thêm cột / bảng, chạy lại nhiều lần không sao) |
| Tạo lại từ đầu | `sql_script/QueenKho_TongHop.sql` (DB sạch) hoặc `sql_script/QueenKho_full.sql` (có dữ liệu mẫu). **Hai file này xoá và tạo lại `QueenKhoDB`.** |

Dùng sqlcmd thì thêm `-f 65001` để giữ tiếng Việt:

```bash
sqlcmd -S localhost -U sa -P 12345 -I -f 65001 -i sql_script/Update_mat_bang.sql
```

Kết quả cuối script: mỗi cơ sở có 1 mặt bằng `Tầng 1` (28m × 20m), 7 vật cố định, và 42 ô kho mẫu đã có vị trí.

---

## 2. Quy ước lưới

- **1 ô lưới = 0.5m.** Mặt bằng mặc định là 56 × 40 ô (28m × 20m).
- Toạ độ `(x, y)` là **góc trên-trái**, tính bằng ô lưới; `w`, `h` là chiều rộng và chiều dài.
- Kích thước mặc định của ô kho lấy từ `unit_types.dimensions` (2 số đầu, đổi ra ô lưới):

| Loại kho | dimensions | Ô lưới |
|---|---|---|
| Kho nhỏ 2m² | 1.0m × 2.0m | 2 × 4 |
| Kho Mini M | 1.5m × 2.3m | 3 × 5 |
| Kho Tiêu Chuẩn | 2.5m × 2.4m | 5 × 5 |
| Kho Gia Đình | 4.0m × 3.0m | 8 × 6 |
| Kho Lớn | 4.0m × 4.0m | 8 × 8 |
| Kho Đặc Biệt XL | 5.0m × 5.0m | 10 × 10 |

  Không đọc được `dimensions` thì lấy hình vuông theo diện tích. Hàm này có ở cả BE (`FloorPlanService.defaultSize`) và FE (`defaultUnitSize`), **sửa thì sửa cả hai**.
- **Phía cửa** của ô: `TOP` / `BOTTOM` / `LEFT` / `RIGHT`, vẽ thành vạch nhỏ trên cạnh ô.
- **Vật cố định** (`floor_fixtures`): `AISLE` lối đi, `ENTRANCE` cửa vào, `STAIRS` thang bộ, `ELEVATOR` thang máy, `OFFICE` văn phòng / lễ tân.

### Quy tắc hợp lệ (BE chặn, FE báo trước)
1. Ô kho và vật cố định phải nằm **trong** mặt bằng tầng.
2. Hai ô kho **không chồng** lên nhau. Chạm cạnh thì được, vì các ô kho dùng chung vách.
3. Ô kho **không đè** lên vật cố định. Vật cố định được chồng lên nhau, ví dụ cửa nằm trên lối đi.
4. Ô chưa đặt vị trí (`map_x` NULL) vẫn hoạt động bình thường: vẫn thuê, gán, khoá được. Ô chỉ chưa hiện trên bản đồ.

---

## 3. Thay đổi Database

### Cột mới — `storage_units`
| Cột | Kiểu | Ý nghĩa |
|---|---|---|
| `map_x`, `map_y` | INT NULL | Góc trên-trái trên mặt bằng (ô lưới) |
| `map_w`, `map_h` | INT NULL | Kích thước (ô lưới) |
| `map_door` | NVARCHAR(10) NULL | Phía cửa |

Ràng buộc `CK_storageunits_map`: 4 cột vị trí cùng NULL, hoặc cùng có giá trị (x, y ≥ 0; w, h > 0). Ràng buộc `CK_storageunits_mapdoor` giới hạn giá trị phía cửa.

### Bảng mới — `facility_floors`
Mặt bằng của 1 tầng. `name` **khớp với `storage_units.floor`** của cùng cơ sở; hai bảng nối với nhau qua tên tầng, không dùng khoá ngoại, để các cột và code cũ dùng `floor` không phải sửa.

| Cột | Ghi chú |
|---|---|
| `id`, `facility_id` (FK) | |
| `name` NVARCHAR(20) | `UNIQUE (facility_id, name)` |
| `grid_width`, `grid_height` | 10 – 200 ô lưới |
| `sort_order` | Thứ tự tab tầng |

### Bảng mới — `floor_fixtures`
`id`, `floor_id` (FK `ON DELETE CASCADE`), `fixture_type`, `label`, `map_x`, `map_y`, `map_w`, `map_h`.

### File SQL đã sửa
- `sql_script/Update_mat_bang.sql` — **mới**, script nâng cấp cho DB cũ.
- `sql_script/QueenKho_TongHop.sql` — schema + dữ liệu mặt bằng mẫu + 3 dòng đếm ở phần kiểm tra.
- `sql_script/QueenKho_full.sql` — giống trên.
- `sql_script/QueenKho.sql` — chỉ schema.

Cả 2 file tổng hợp đã được chạy thử trên một DB nháp: không lỗi, 42/42 ô có vị trí, 6 tầng, 42 vật cố định.

### Dữ liệu mẫu (giống nhau ở cả 6 cơ sở)
```
x:0      8   12                                         56
  ┌──────┬───┬──────────────────────────────────────────┐ y:0
  │Thang │   │  [A101][A102][A103]...   cửa ô ↓          │
  │ bộ   │ L ├──────────── Lối đi A – B ─────────────────┤ y:10–14
  │Thang │ ố │  [B201 ][B202 ][B203  ]...  cửa ô ↑       │
  │ máy  │ i │                                           │
  │      │   │  [C101][C102]...   cửa ô ↓  (Tân Bình)    │
  │Lễ tân│ đ ├──────────── Lối đi C ─────────────────────┤ y:30–34
  │Cửa   │ i │                                           │
  │chính │   │                                           │
  └──────┴───┴──────────────────────────────────────────┘ y:40
```

---

## 4. Thay đổi Backend

| File | Thay đổi |
|---|---|
| `entity/StorageUnit.java` | + `mapX`, `mapY`, `mapW`, `mapH`, `mapDoor`, `isPlacedOnMap()`, `clearMapPosition()` |
| `entity/FacilityFloor.java`, `entity/FloorFixture.java` | **Mới** |
| `repository/FacilityFloorRepository.java`, `FloorFixtureRepository.java` | **Mới** |
| `dto/FacilityLayoutResponse`, `FloorLayoutResponse`, `FloorFixtureDto`, `FloorRequest`, `UnitPlacementDto`, `SaveFloorPlanRequest` | **Mới** |
| `dto/StorageUnitDetailResponse.java` | + vị trí và `defaultMapW` / `defaultMapH` |
| `dto/CreateStorageUnitRequest.java` | + vị trí (tuỳ chọn) |
| `service/FloorPlanService.java` | **Mới** — đọc mặt bằng, tạo / sửa / xoá tầng, lưu mặt bằng, kiểm tra chồng lấn, kích thước mặc định |
| `service/StorageUnitService.java` | Trả thêm vị trí; tạo ô kèm vị trí; đổi tầng thì xoá vị trí cũ |
| `controller/FloorPlanController.java` | **Mới** — `/api/v1/storage-units/layout/**` |
| `security/OwnershipGuard.java` | + `checkFacilityFloor(floorId)` |

**Phân quyền:** API mới nằm dưới `/api/v1/storage-units/**`, nên dùng luôn luật `STORAGE_MANAGE` có sẵn trong `AccessPolicy` (chỉ FM, cơ sở của mình). Không phải thêm luật mới; `AccessPolicyTest` vẫn qua.

**API:** xem mục *UC-06 — Sơ đồ mặt bằng ô kho* trong `docs/api-contract.md`. Tóm tắt:

```
GET    /api/v1/storage-units/layout?facilityId=          mặt bằng các tầng + vật cố định
POST   /api/v1/storage-units/layout/floors?facilityId=   tạo tầng
PUT    /api/v1/storage-units/layout/floors/{floorId}     đổi tên / kích thước tầng
DELETE /api/v1/storage-units/layout/floors/{floorId}     xoá tầng (không còn ô)
PUT    /api/v1/storage-units/layout/floors/{floorId}/plan  lưu vị trí ô + vật cố định
```

**Nhật ký hoạt động:** `[FLOOR_CREATE]`, `[FLOOR_UPDATE]`, `[FLOOR_DELETE]`, `[FLOOR_PLAN]`.

---

## 5. Thay đổi Frontend

| File | Thay đổi |
|---|---|
| `services/storageUnitService.js` | + `getFacilityLayout`, `createFloor`, `updateFloor`, `deleteFloor`, `saveFloorPlan` |
| `utils/floorPlan.js` | **Mới** — lưới, loại vật cố định, kích thước mặc định, kiểm tra chồng lấn, tìm chỗ trống |
| `utils/unitDisplayState.js` | **Mới** — màu trạng thái hiển thị (dùng chung cho bảng và sơ đồ) |
| `utils/useElementWidth.js` | **Mới** — đo bề rộng khung để tự tính cỡ ô lưới |
| `components/FloorPlanCanvas.jsx` | **Mới** — vẽ 1 tầng, kéo thả, khung xem trước |
| `components/FloorPlanBoard.jsx` | **Mới** — tab tầng, thu phóng, chế độ xem / chỉnh sửa, quản lý tầng |
| `components/UnitPositionPicker.jsx` | **Mới** — chọn chỗ cho ô mới trong form "Thêm ô kho" |
| `components/UnitGridMap.jsx` | **Xoá** (bản lưới thử nghiệm trước đó) |
| `pages/manager/StorageManagementPage.jsx` | Tab Sơ đồ / Danh sách, panel chi tiết ô, form thêm ô có chọn vị trí |

### Màu trạng thái (dùng chung cho sơ đồ và bảng)
| Màu | Trạng thái hiển thị | Suy ra từ |
|---|---|---|
| 🟩 Xanh lá | Còn trống | `status = AVAILABLE` |
| 🟨 Vàng | Chờ check-in | hợp đồng `PENDING_CHECK_IN` |
| 🟦 Xanh dương | Đang thuê | `status = OCCUPIED` |
| 🟦 Viền nét đứt | Đang trả kho | hợp đồng `TERMINATION_PENDING` |
| 🟥 Đỏ | Quá hạn | `overdue = true` |
| ⬜ Xám | Bảo trì | `status = MAINTENANCE` |

Đây là trạng thái **hiển thị**: không thêm giá trị mới vào `storage_units.status`. Thứ tự ưu tiên khi một ô thoả nhiều điều kiện: Bảo trì > Quá hạn > Chờ check-in > Đang trả kho > Đang thuê > Còn trống.

---

## 6. Hướng dẫn dùng (FM)

**Xem:** Quản lý danh mục kho → tab **Sơ đồ**.
- Chọn tầng bằng tab phía trên, nút 🔍 để thu phóng.
- Rê chuột lên ô để xem loại kho, diện tích, hợp đồng, khách thuê. Bấm vào ô để mở panel chi tiết với các nút Khoá bảo trì, Mở lại, Xem HĐ, Xoá.
- Bộ lọc (trạng thái, tầng, loại, từ khoá) **làm mờ** các ô không khớp thay vì giấu đi, nên vẫn thấy được vị trí. Ví dụ gõ "A103" thì chỉ A103 sáng.
- Ô chưa có vị trí được liệt kê dưới bản đồ.

**Chỉnh sửa:** bấm **Chỉnh sửa mặt bằng**.
- **Kéo** ô kho hoặc vật cố định để dời; vị trí tự bám theo lưới 0.5m.
- **+ Lối đi / Cửa vào / Thang bộ / Thang máy / Văn phòng**: thêm vật cố định vào chỗ trống đầu tiên. Kéo góc xanh dưới-phải, hoặc nhập Rộng / Dài (m), để đổi kích thước; đặt tên hiển thị trong ô "Tên hiển thị".
- **Đặt ô chưa có vị trí:** bấm ô trong danh sách "Ô chưa đặt vị trí", rồi bấm vào chỗ trống trên mặt bằng. Khung xanh nghĩa là đặt được, khung đỏ là bị chồng.
- Với mục đang chọn: **Xoay** (phím `R`), **Phía cửa**, **Gỡ khỏi mặt bằng** / **Xoá** (phím `Delete`). Phím mũi tên dời 0.5m, giữ `Shift` để dời 1m; `Esc` bỏ chọn.
- Mục bị chồng hoặc ra ngoài được viền đỏ và liệt kê trong khung "Chưa lưu được". Nút **Lưu mặt bằng** chỉ bấm được khi hết lỗi.
- **⚙ (tune)** đổi tên / kích thước tầng. **+ Tầng** tạo tầng mới. **🗑** xoá tầng (chỉ được khi tầng không còn ô kho). Ba thao tác này chỉ dùng được khi không còn thay đổi chưa lưu.

**Thêm ô mới:** **+ Thêm ô kho mới** → chọn tầng (có gợi ý các tầng đã có mặt bằng) → bấm chỗ trống trên mặt bằng thu nhỏ → **Xoay** / chọn **phía cửa** nếu cần → **Lưu kho**. Không chọn vị trí thì ô vào danh sách "chưa đặt".

---

## 7. Đã kiểm tra

- `./mvnw test`: toàn bộ 165 test qua, kể cả `ApiApplicationTests` (sau khi chạy `Update_mat_bang.sql`) và `AccessPolicyTest`. Có thêm 8 test mới trong `FloorPlanServiceTest`: kích thước mặc định, đặt / gỡ ô, chồng ô, đè lối đi, ra ngoài mặt bằng, ô khác cơ sở, đổi tên tầng kéo theo ô, chặn thu nhỏ, chặn xoá tầng còn ô, tạo ô kèm vị trí.
- `npm run build` qua. `npm run lint` không có lỗi mới; lỗi `set-state-in-effect` ở `fetchStorageUnits` có từ trước.
- Chạy thử 2 file SQL tổng hợp trên DB nháp và `Update_mat_bang.sql` trên DB local.
- Gọi API thật (backend chạy riêng ở cổng 8090, tài khoản `fmtanbinh`):
  - Nhân viên gọi API → `403 FORBIDDEN_ROLE`; FM cơ sở khác sửa tầng → `403 FORBIDDEN_FACILITY`.
  - Dời ô chồng ô khác → `400 MAP_CONFLICT`; dời hợp lệ thì lưu được.
  - Xoá tầng còn ô → `409`; thu nhỏ tầng → `400 MAP_OUT_OF_BOUNDS`.
  - Tên tiếng Việt của lối đi / thang giữ nguyên sau khi lưu.
- Thử giao diện trên trình duyệt (1440px):
  - Sơ đồ Tân Bình hiển thị đúng.
  - Chế độ chỉnh sửa: chọn ô, dời bằng phím mũi tên thì báo chồng lấn và khoá nút Lưu; kéo thả sang chỗ trống thì lưu được.
  - Form thêm ô: bấm lên lối đi thì báo đỏ, bấm chỗ trống thì tạo ô A106 đúng vị trí.
  - Ô tìm kiếm làm mờ các ô không khớp.
  - Sau khi thử, đã xoá A106 và trả A105 về chỗ cũ; trong nhật ký hoạt động còn vài dòng `[FLOOR_PLAN]` / `[UNIT_CREATE]` / `[UNIT_DELETE]` của lần thử.

---

## 8. Giới hạn / việc để sau

- **Modal gán ô (UC-14)** vẫn là danh sách thẻ. Có thể nhúng `FloorPlanCanvas` với `pickMode`, chỉ cho bấm các ô trống đúng loại.
- Đổi **loại kho** của ô đã đặt thì kích thước trên bản đồ giữ nguyên; FM tự chỉnh lại trong chế độ chỉnh sửa.
- Chỉ hỗ trợ hình chữ nhật xoay 0° / 90°, chưa có tường xiên hay ô hình chữ L.
- Chưa có ảnh bản vẽ thật làm nền mặt bằng.
- Lưu mặt bằng là "ai lưu sau thắng": 2 FM cùng sửa một tầng thì bản lưu sau đè bản trước, vì chưa có khoá phiên bản.
- Layout `ManagerLayout` chưa thu gọn sidebar trên điện thoại (lỗi có từ trước), nên trên màn hình nhỏ bản đồ khá chật; dùng nút thu phóng và cuộn ngang trong khung.

---

## 9. Bản đồ chỉ xem cho khách & nhân viên (30/10/2026)

> Nhánh `feature/uc06-xem-vi-tri-o-kho`. Không đổi DB.

**Ai thấy, ở đâu**
| Vai trò | Màn hình | Khi nào |
|---|---|---|
| Khách | `/kho-cua-toi/hop-dong/:id`, mục "Ô kho đã thuê" → "Vị trí ô kho trong cơ sở" | Hợp đồng `PENDING_CHECK_IN` / `ACTIVE` / `OVERDUE` / `TERMINATION_PENDING` |
| Staff | `/staff/tasks/:id`, thẻ "Vị trí ô trên mặt bằng" | Task có hợp đồng (check-in, trả kho, hỗ trợ, bảo trì) |
| FM | `/manager/tasks/:id` (dùng chung trang chi tiết task) | Như Staff |

**Hiển thị**
- Dòng chỉ dẫn: `Tầng 1 · Khu A · Phòng 103 · cửa quay ra Lối đi A – B`. Phần "cửa quay ra …" lấy từ vật cố định nằm sát cạnh có cửa của ô.
- Mặt bằng tầng: ô của hợp đồng màu xanh dương nhấp nháy. Các ô khác là **khối xám không mã, không trạng thái**, để khách không biết ô nào đang có người thuê. Lối đi, cửa vào, thang hiện như bản FM.
- Bản đồ tự co theo bề ngang màn hình, cuộn ngang được nếu quá hẹp.
- Ô chưa đặt vị trí, hoặc tầng chưa có mặt bằng, chỉ hiện dòng chỉ dẫn kèm câu "Cơ sở chưa cập nhật sơ đồ cho ô này".

**Thay đổi code**
| File | Thay đổi |
|---|---|
| `dto/UnitLocationResponse.java` | **Mới** |
| `service/FloorPlanService.java` | + `getUnitLocation`, `fixtureInFrontOfDoor`, `locationHint` |
| `controller/ContractController.java` | + `GET /api/v1/contracts/{id}/unit-location` |
| `security/AccessPolicy.java` | + luật cho API trên, nhóm `CONTRACT_VIEW` |
| `components/UnitLocationMap.jsx` | **Mới** — bản đồ chỉ xem |
| `components/FloorPlanCanvas.jsx` | Ô có thể đặt riêng màu / icon, và đánh dấu không bấm được (`tileClass`, `icon`, `inert`) |
| `services/contractService.js` | + `getUnitLocation` |
| `pages/my_reservation/CustomerContractPage.jsx`, `pages/staff/StaffTaskDetailPage.jsx` | Gắn bản đồ |

**Test:** `FloorPlanServiceTest` thêm 2 test (ẩn thông tin ô khác + chỉ dẫn lối đi; ô chưa đặt; khách xem HĐ đã kết thúc → 409 còn Staff vẫn xem được). `AccessPolicyTest` thêm 1 test phân quyền theo vai trò.

---

## 10. Chọn ô trên mặt bằng khi gán ô (UC-14, 30/10/2026)

> Nhánh `feature/uc14-ban-do-gan-o`. Chỉ sửa FE, không đổi DB / API.

- Modal **Gán ô kho** (màn hình "Đơn chờ gán ô" của FM) có thêm cột **"Chọn trên mặt bằng"** bên phải danh sách thẻ.
- Ô gán được (trống, đúng loại khách đặt; lấy từ `GET /reservations/{id}/available-units`) tô xanh và bấm được. Các ô khác vẫn giữ màu trạng thái nhưng mờ đi và không bấm được, để FM vẫn thấy ô nào đang thuê hay bảo trì.
- Chọn trên bản đồ hay trong danh sách thì bên kia tự cập nhật theo; chọn trên bản đồ thì danh sách tự cuộn tới thẻ của ô đó. Bấm lại ô đang chọn thì vẫn giữ lựa chọn.
- Có nhiều tầng thì hiện tab tầng kèm số ô gán được, và tự mở tầng chứa ô đang chọn.
- Ô gán được nhưng chưa có vị trí trên mặt bằng: được liệt kê dưới bản đồ, chọn trong danh sách như cũ.
- Cơ sở chưa có mặt bằng, hoặc tải mặt bằng lỗi: modal giữ nguyên dạng cũ, chỉ có danh sách.

| File | Thay đổi |
|---|---|
| `components/UnitPickerMap.jsx` | **Mới** — bản đồ chọn ô (tab tầng, ô gán được / không gán được) |
| `components/AssignUnitModal.jsx` | Tải mặt bằng + toàn bộ ô của cơ sở, bố cục 2 cột khi có mặt bằng, đồng bộ lựa chọn |

**Đã thử:** FM Tân Bình gán đơn thử. A101–A104 bấm được; A105 tạm khoá bảo trì thì bị mờ. Bấm A103 trên bản đồ thì danh sách chọn theo và cuộn tới, xác nhận thì hợp đồng tạo đúng ô A103. Dữ liệu thử đã xoá.
