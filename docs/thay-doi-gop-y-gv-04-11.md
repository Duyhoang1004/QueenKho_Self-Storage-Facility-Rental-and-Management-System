# Thay đổi theo góp ý giảng viên — 04/11/2026

> Toàn bộ **chưa commit**, đang nằm trên `main` local. Backend 208/208 unit test pass; E2E `docs/test-e2e/e2e-bao-hiem-boi-thuong.sh` 36/36 đạt; FE `npm run build` pass (lint chỉ còn lỗi có sẵn từ trước).

## 0. Việc cần làm trước khi test

1. Chạy SQL theo thứ tự trên DB local (DB của bạn đã chạy cả 2 rồi; cả nhóm cần chạy sau khi merge):
   - `sql_script/Update_bang_chung_chuyen_o.sql`
   - `sql_script/Update_bao_hiem_boi_thuong.sql`
   - DB tạo mới: `QueenKho_full.sql` / `QueenKho_TongHop.sql` / `QueenKho.sql` đã gộp sẵn.
2. Khởi động lại backend.
3. Dữ liệu test có sẵn: HĐ id 7 (khách `e2e.khach@queenkho.local` / 123456) đang **chờ nhận kho** — dùng để thử check-in online. HĐ id 8 + hồ sơ bồi thường `BT-…` id 1 do script E2E tạo (đã chi trả, đã bảo hiểm trả, HĐ đang quá hạn đã được BOM miễn phí trễ).

## 1. Đợt 1 — bằng chứng bàn giao, chuyển ô, ưu tiên, check-in online, phí di dời

| Mã | Thay đổi | Ai dùng / ở đâu |
|---|---|---|
| BR-121 | Check-in & nghiệm thu trả kho **bắt buộc 1–10 ảnh hiện trạng ô**. Khách + FM xem lại biên bản kèm ảnh. | Staff: chi tiết task. Khách: trang hợp đồng. FM: `/manager/contracts/:id` |
| BR-122 | FM **chuyển hợp đồng sang ô khác cùng loại, cùng cơ sở** (lý do: sự cố cơ sở / khách xin / sắp xếp lại). PIN, giá, ngày hết hạn giữ nguyên; có lịch sử chuyển ô. | FM: nút "Chuyển sang ô khác" ở chi tiết hợp đồng |
| BR-123 | Đơn chờ gán ô **xếp ưu tiên khách cũ + gói dài**, có nhãn "Ưu tiên · Khách cũ · Gói 12 tháng". | FM: `/manager/pending` |
| BR-124 | **Check-in online**: đúng ngày hẹn, khách nhập CCCD, tự kiểm tra ô, chụp ảnh, cam kết hàng cấm → có PIN ngay (không cấp RFID). | Khách: nút "Check-in online" ở trang hợp đồng |
| PR-Q16 | **Phí dọn & di dời hàng** khi thanh lý = 30% giá tháng (BOM chỉnh), trừ cọc, vượt cọc thành nợ; mã giao dịch `MV-`. Chỉ áp dụng điều khoản **v3**. | FM: popup thanh lý. BOM: chính sách thuê |
| Điều khoản | Điều khoản tài sản lên **v3** (thêm phí di dời, quyền chuyển ô, ảnh biên bản). | Trang đặt kho |

## 2. Đợt 2 — bảo hiểm, bồi thường hàng hư / mất, cảm biến, BOM miễn phí trễ

### 2.1 Gói bảo hiểm khi đặt kho (BR-125)
- 3 gói: **Cơ bản** miễn phí, trần 20tr, cơ sở tự chịu · **Nâng cao** 50.000đ/tháng, trần 200tr · **Cao cấp** 120.000đ/tháng, trần 500tr (có bảo hiểm).
- Khách khai báo **giá trị hàng** (tuỳ chọn). Trần bồi thường = min(giá trị khai báo, trần gói); không khai báo → tối đa 5tr.
- Phí bảo hiểm cộng vào tiền VNPAY lúc đặt và lúc gia hạn (giữ gói cũ); **không hoàn khi khách tự trả sớm**.
- Phiếu biên nhận có dòng bảo hiểm. Trang hợp đồng có khối "Bảo hiểm & giám sát".

### 2.2 Bồi thường hàng hư / mất qua yêu cầu hỗ trợ (BR-126 → BR-128)
1. **Khách** gửi hỗ trợ loại mới **"Hàng bị hư hỏng" / "Mất hàng"** (khẩn): danh sách hàng + giá trị, số tiền đề nghị, ngày phát hiện, ảnh (hàng hư bắt buộc ≥ 1) → hồ sơ `BT-xxxxxx` (Chờ kiểm tra).
2. **Staff** nhận task hỗ trợ đó = **kiểm tra hiện trường**: biên bản ≥ 10 ký tự + ảnh + nguyên nhân sơ bộ → Chờ thẩm định. Phiếu hỗ trợ vẫn "Đang xử lý".
3. **FM** (menu mới **"Bồi thường hàng hoá"** `/manager/claims`): xem ảnh khách, ảnh kiểm tra, ảnh biên bản nhận kho, biểu đồ cảm biến ±3 ngày → chọn bên chịu lỗi, giá trị thẩm định, % hư hại, số ngày ô không dùng được, hướng xử lý → **Tính thử** → **Chốt**.
   - Lỗi cơ sở: tiền hàng (≤ trần) + **phạt vi phạm 1 tháng tiền thuê** + hoàn tiền thuê theo ngày. *(Không đền "gấp đôi giá trị hàng" vì dễ trục lợi.)*
   - Bất khả kháng: chỉ gói có bảo hiểm được tiền hàng; + hoàn tiền thuê theo ngày; không phạt.
   - Lỗi khách: 0 → từ chối, khách có thể bấm "Chưa xong" để khiếu nại (kiểm tra lại).
   - Hướng xử lý **Chấm dứt HĐ**: khách hẹn trả kho bình thường nhưng **không phí phá HĐ**, tiền thuê còn lại hoàn theo ngày.
4. **FM chi trả** (chuyển khoản bắt buộc ảnh ủy nhiệm chi / tiền mặt bắt buộc ký nhận) → giao dịch `COMPENSATION`, phiếu hỗ trợ chuyển "Chờ khách xác nhận".
5. Gói có bảo hiểm → **cơ sở trả khách trước, hệ thống tự gửi hồ sơ đòi bảo hiểm** (API mô phỏng, mã `QKINS-…`). Nút ⚡ "Bảo hiểm duyệt & chi trả".
6. **BOM** xem mọi hồ sơ (`/bom/claims`, chỉ đọc); báo cáo doanh thu thêm "Chi bồi thường hàng" và "Bảo hiểm trả lại" (chi phí riêng, không trừ doanh thu ròng).

### 2.3 Cảm biến nhiệt độ / độ ẩm (BR-129)
- Ngưỡng an toàn 15–30°C, độ ẩm ≤ 75%. Vượt ngưỡng → báo khách (+ email), FM, sinh task bảo trì lý do `SENSOR` (ô vẫn đang cho thuê).
- Trang hợp đồng (khách + FM) có biểu đồ 3 ngày. Nút ⚡ "Cảm biến vượt ngưỡng" sinh 12 giờ số đo.
- 🔸 Chưa nối thiết bị thật.

### 2.4 Miễn phí trễ (BR-130)
- **Giữ quyền FM** như cũ (khi chính sách cho phép) và **thêm cho BOM**: miễn cho mọi cơ sở, kể cả khi đã tắt quyền của FM. FM cơ sở được báo.
- BOM có menu mới **"Hợp đồng quá hạn"** (`/bom/overdue`) — danh sách toàn chuỗi + nút "Miễn phí trễ".

### 2.5 Trang chủ
- Sửa câu chữ "Bảo hiểm 500 triệu", "20°C", "giám sát AI" cho khớp tính năng thật (gói bảo hiểm, ngưỡng cảm biến, check-in online).

## 3. API mới (đều đã khai báo trong `AccessPolicy`)

| API | Quyền |
|---|---|
| `GET /insurance-plans` | công khai |
| `GET /claims`, `GET /claims/{id}` | FM (cơ sở mình), BOM |
| `POST /claims/{id}/quote` · `/decide` · `/pay` | FM |
| `GET /contracts/{id}/sensor-readings?days=&around=` | khách chủ HĐ, Staff, FM |
| `GET /contracts/overdue-all` · `POST /contracts/{id}/waive-late-fee` | FM, BOM (nhóm mới `LATE_FEE_WAIVE`) |
| `GET /contracts/{id}/handover-records` · `/unit-transfers` · `/transfer-options`, `POST /contracts/{id}/transfer-unit` · `/online-check-in` | đợt 1 |
| `POST /dev/simulation/contracts/{id}/sensor-alert` · `/claims/{id}/insurance-payout` | giả lập |

Thay đổi API cũ: `POST /reservations` thêm `insurancePlan`, `declaredGoodsValue`; `POST /support-requests` thêm `incidentDate`, `itemsDescription`, `claimedAmount`, `evidenceImages`; `POST /staff-tasks/{id}/resolve-support` thêm `inspectionImages`, `preliminaryCause`; check-in / check-out thêm `evidenceImages` (bắt buộc); renewal quote thêm `insuranceAmount`; hợp đồng thêm `insurancePlan`, `coverageCap`, `faultTermination`…

## 4. Kịch bản test tay gợi ý

1. Khách đặt kho chọn gói **Nâng cao**, khai báo 30 triệu → tổng VNPAY cộng 50.000 × số tháng.
2. FM gán ô → Staff check-in (thử bỏ ảnh để thấy lỗi) → hợp đồng hoạt động.
3. Trang hợp đồng của khách: bấm ⚡ "Cảm biến vượt ngưỡng" → chuông cảnh báo, biểu đồ đỏ.
4. Khách gửi hỗ trợ "Hàng bị hư hỏng" kèm ảnh mẫu → Staff nhận task, lập biên bản kiểm tra → FM vào "Bồi thường hàng hoá" → Tính thử → Chốt (chọn Chấm dứt HĐ) → Chi trả → ⚡ Bảo hiểm chi trả.
5. Khách xem hồ sơ trong trang Hỗ trợ, khoản bồi thường ở trang Thanh toán; hẹn trả kho → không có phí phá HĐ.
6. BOM: "Hợp đồng quá hạn" → Miễn phí trễ; "Bồi thường hàng hoá"; Báo cáo doanh thu.
7. Khách test `e2e.khach@queenkho.local`, HĐ id 7: thử **Check-in online**.

## 5. Còn lại / giới hạn

- `docs/business-rules.md` đã ghi đủ cả 2 đợt (D-13, D-14, BR-121 → BR-130, PR-Q16, schema mục 5, mã lỗi mục 6, lịch sử góp ý mục 7, truy vết test mục 8); `docs/api-contract.md` có 2 mục mới ở cuối file.
- 🔸 Mô phỏng: đối tác bảo hiểm, cảm biến IoT; mức phí / trần bảo hiểm cố định trong code (chưa cho BOM chỉnh).
- Script E2E cũ (`e2e-5-flow.sh`, `e2e-sua-bug-sau-test.sh`) đã thêm ảnh cho check-in / check-out nhưng **chưa chạy lại** (script cũ dọn hết HĐ của khách test, sẽ làm mất HĐ id 7 để thử check-in online).
- Chưa commit / chưa tạo nhánh.
