# QueenKho — Hệ thống cho thuê & quản lý kho tự quản (SWP391)

Monorepo: `backend/api` (Spring Boot) · `frontend` (React) · `sql_script` (SQL Server) · `docs`.
README.md là tài liệu cho người; file này là ghi chú cho agent. `Init.md` đã cũ (ghi MySQL / Spring Boot 3) — tin code, không tin Init.md.

## Stack thực tế
- Backend: Spring Boot 4.1.x, Java 17, Spring Data JPA, Lombok, Spring Security (đang `permitAll` toàn bộ), SQL Server (`mssql-jdbc`).
- `ddl-auto: validate` → **schema do `sql_script/QueenKho.sql` quyết định**. Thêm/sửa cột = sửa SQL script trước, rồi mới sửa Entity.
- Frontend: React 19, Vite 8, Tailwind 3 (màu brand trong `tailwind.config.js`), React Router 7, Axios.
- Base URL API: `http://localhost:8080/api/v1` (`frontend/src/services/api.js`).

## Chạy
- DB: chạy `sql_script/QueenKho.sql` trên SSMS, sau đó các file dữ liệu mẫu (`QueenKhoDuLieuMau_UC09.sql`, `setup_test_env.sql`). Biến môi trường `DB_PASSWORD`/`DB_USERNAME`/`DB_NAME`/`DB_PORT` (mặc định `12345`/`sa`/`QueenKhoDB`/`1433`).
- Backend: `cd backend/api && ./mvnw spring-boot:run` (port 8080). Build kiểm tra: `./mvnw -q compile`.
- Frontend: `cd frontend && npm install && npm run dev` (port 5173). Kiểm tra: `npm run lint`, `npm run build`.

## Luồng làm một UC (theo thứ tự)
1. SQL (nếu cần bảng/cột mới) → `sql_script/`
2. Entity → `entity/` · Repository → `repository/`
3. DTO request/response → `dto/` (tên `XxxRequest`, `XxxResponse`)
4. Service (nghiệp vụ, `@Transactional`) → `service/`
5. Controller → `controller/`, prefix `/api/v1/...`
6. FE service → `frontend/src/services/xxxService.js` (hàm async trả `response.data`)
7. Page → `frontend/src/pages/<nhóm>/XxxPage.jsx`
8. Route trong `App.jsx` (bên trong `CustomerLayout` hoặc `ManagerLayout`) + menu trong `menuItems` của Layout
9. Cập nhật `docs/api-contract.md` nếu có endpoint mới

## Quy ước
- JSON field camelCase; status/enum CHỮ HOA (`DEPOSIT_PAID`, `UNIT_ASSIGNED`...).
- Lỗi trả về `{ "error": "CODE", "message": "..." }`; hiện controller tự try/catch `IllegalArgumentException`/`IllegalStateException` → 400.
- Comment ghi mã UC: `// UC-14: ...`. Comment tiếng Việt được.
- Import class bình thường, không viết tên đầy đủ `com.queenkho.api...` giữa code.
- FE lưu user đăng nhập ở `sessionStorage.getItem('user')` (JSON). Role: `CUSTOMER`, `STAFF`, `FACILITY_MANAGER`, `BOM`, `ADMIN`.
- Sửa file trực tiếp; **không** tạo script kiểu `fix_*.js` để patch code.

## Git
- `main` là nhánh chung. Mỗi UC một nhánh tạm, merge vào `main` qua PR, xong xoá nhánh.
- Trước khi code mỗi ngày: pull `main` mới nhất. Nếu pull có thay đổi trong `sql_script/` → nhắc chạy lại script trên DB local.
- Agent **không tự commit/push/merge** — chỉ làm khi được yêu cầu.
- Không commit: `*.class`, `target/`, `frontend/dist/`, `node_modules/`, `.idea/`.

## Nợ kỹ thuật đã biết (chưa xử lý)
- ~~Security mở hoàn toàn~~ → đã có `security/AccessControlFilter` + bảng quyền `AccessPolicy` (26/10/2026). API mới **phải khai báo luật** trong `AccessPolicy`, nếu không filter trả 403 `API_NOT_DECLARED` (test `AccessPolicyTest` quét mọi controller sẽ fail). Người thao tác lấy qua `CurrentUserProvider`; bản ghi theo id kiểm tra bằng `OwnershipGuard`. Controller cũ vẫn nhận `customerId/managerId/staffId` nhưng giá trị bị filter ghi đè theo token.
- Chưa có test ngoài `ApiApplicationTests`.
- File rác trên `main`: `fix_front.js`, `fix_service.js`, `backend/api/HashGen.java|.class`, thư mục `.idea/` đang bị track.
