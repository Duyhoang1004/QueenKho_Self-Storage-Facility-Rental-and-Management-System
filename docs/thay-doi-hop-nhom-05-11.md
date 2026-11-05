# Thay đổi theo họp nhóm — 05/11/2026 (D-15)

> Toàn bộ **chưa commit**, đang nằm trên `main` local (sau commit `9d7dd5c` #107). Backend **212/212** unit test pass; E2E `docs/test-e2e/e2e-hop-nhom-05-11.sh` **44/44**, `e2e-bao-hiem-boi-thuong.sh` 36/36, `e2e-sua-bug-sau-test.sh` 48/48; FE `npm run build` pass (lint chỉ còn lỗi có sẵn từ trước).

## 0. Việc cần làm trước khi test

1. Chạy `sql_script/Update_hop_nhom_05_11.sql` trên DB local (DB của bạn đã chạy rồi; cả nhóm cần chạy sau khi merge). DB tạo mới: `QueenKho.sql` / `QueenKho_full.sql` / `QueenKho_TongHop.sql` đã gộp sẵn.
2. Khởi động lại backend.
3. Mặc định **mọi loại kho đang là kho thường (NORMAL)** → muốn thử đặt thực phẩm, BOM vào "Bảng giá dịch vụ" đổi 1 loại kho sang **Kho lạnh / Kho đông**.

## 1. Các thay đổi

| # | Họp nhóm | Đã làm | Ai dùng / ở đâu |
|---|---|---|---|
| 1 | Dropdown loại hàng khi đặt kho, BOM quản lý; thực phẩm chỉ kho lạnh / đông; check-in kiểm tra hàng | **BR-131**: danh mục 7 loại (Gia dụng, Văn phòng phẩm, Thực phẩm, Quần áo, Nội thất, Điện tử, Khác). Khách chọn nhiều loại trong dropdown; Thực phẩm bị khoá khi loại kho là kho thường; chọn "Khác" phải mô tả. Loại kho có thêm **nhiệt độ: thường / lạnh / đông**. **BR-132**: check-in có **mục 6 "Đã kiểm tra hàng mang vào"** (bắt buộc), Staff thấy loại hàng khách khai báo ngay trên form. | Khách: trang đặt kho. BOM: menu mới **"Loại hàng gửi kho"** + chọn nhiệt độ ở "Bảng giá dịch vụ". Staff: chi tiết task check-in |
| 2 | Ngày nhận kho lên đầu trang đặt | Khối **1. Ngày bắt đầu nhận kho** nằm trên cùng; sau đó: thông tin ô (có nhãn kho thường / lạnh / đông) → gói thuê & bảo hiểm → loại hàng → thông tin khách. | Khách: `/booking` |
| 3 | Voucher theo loại kho | **BR-133**: BOM chọn "Loại kho áp dụng" khi tạo / sửa voucher; sai loại kho → báo "Mã voucher không áp dụng cho loại kho này". | BOM: `/bom/vouchers` |
| 4 | Nhắc 15/10/7/3/1 ngày, **bỏ ân hạn 5 ngày**, hết hạn chuyển hàng kho tổng | Job nhắc gia hạn 08:00 gửi ở mốc **15 / 10 / 7 / 3 / 1 ngày** (chuông + email). Hẹn trả kho **chậm nhất ngày hết hạn**. Hợp đồng điều khoản **v4**: hết hạn không gia hạn / không trả → **00:05 hôm sau tự thanh lý** (trừ phí trễ + chiếm dụng + phí di dời vào cọc) và sinh việc **chuyển hàng vào kho tổng**; ô cho thuê lại từ ngày hết hạn + 2. | Tự động (job). Khách: popup hẹn trả kho, trang hợp đồng |
| 5 | Kho tổng giữ hàng, **không bán**, khách quá hạn xem được thông tin | **BR-134**: bảng kho tổng do BOM quản lý (mặc định "Kho tổng QueenKho"). "Dọn xong" task thanh lý phải chọn kho tổng + vị trí kệ. Hàng giữ **tới khi khách nhận lại**, phí lưu giữ 20% giá ngày tính tới ngày nhận. **Không bán / tiêu huỷ cho mọi hợp đồng** (cả điều khoản cũ). Khách thấy thẻ "Hàng của bạn đang ở kho tổng": tên, địa chỉ, hotline, vị trí, số ngày, phí, **số tiền cần trả để nhận lại**. | BOM: menu **"Kho tổng"**. FM: trang đổi tên **"Hàng ở kho tổng"** (chỉ còn: khách nhận lại / giao cơ quan chức năng). Khách: trang hợp đồng |
| 6 | Trả sớm giữ PR-O2 | Không đổi | — |

**Điều khoản xử lý tài sản lên v4** (popup điều khoản + câu tick ở trang đặt kho đã viết lại). Hợp đồng điều khoản cũ (v1–v3) vẫn đi luồng cũ (quá hạn 15 / 30 ngày + 3 lần liên hệ mới thanh lý), chỉ khác là **cũng không bị bán hàng** và không còn ân hạn khi hẹn trả.

## 2. Nút giả lập (demo) mới / đổi

| Ở đâu | Nút | Kết quả |
|---|---|---|
| FM: chi tiết hợp đồng | **Còn 15 ngày hết hạn** (mới) | Khách nhận nhắc mốc 15 ngày |
| FM: chi tiết hợp đồng | **Quá hạn 1 ngày** (mới) | Hợp đồng v4: thanh lý ngay + sinh việc chuyển kho tổng. Hợp đồng cũ: chỉ quá hạn |
| FM: Hàng ở kho tổng | ~~Hết hạn lưu giữ~~ | Đã bỏ (không còn bán / tiêu huỷ) |

## 3. Kịch bản test nhanh (khoảng 10 phút)

1. **BOM** → "Bảng giá dịch vụ" → sửa 1 loại kho sang **Kho lạnh**. → "Voucher đặt kho" tạo mã chỉ áp cho loại kho lạnh đó. → "Loại hàng gửi kho" thử thêm / ngừng 1 loại.
2. **Khách** đặt loại kho thường: dropdown thấy Thực phẩm bị khoá. Đặt loại kho lạnh: chọn Thực phẩm + Gia dụng, áp voucher vừa tạo → thanh toán.
3. **FM** gán ô → **Staff** check-in: thấy "Hàng khách khai báo", không tick mục 6 thì nút xác nhận không bấm được.
4. **FM** ở chi tiết hợp đồng bấm **Còn 15 ngày hết hạn** → khách có thông báo. Khách mở "Trả kho": không chọn được ngày sau ngày hết hạn.
5. **FM** bấm **Quá hạn 1 ngày** → hợp đồng thành "Đã thanh lý"; khách thấy "đang chuyển hàng vào kho tổng".
6. **Staff / FM** mở task dọn ô → "Dọn xong": chọn kho tổng + vị trí kệ + ảnh. → Khách thấy thẻ kho tổng + số tiền cần trả. → **FM** "Hàng ở kho tổng": chỉ còn 2 nút.

## 4. Lưu ý

- `docs/test-e2e/e2e-5-flow.sh` đã cập nhật theo rule mới nhưng **chưa chạy được trên DB local** vì tài khoản `khachhang1@gmail.com` / `khachhang2@gmail.com` không còn mật khẩu `123456` (lỗi đăng nhập, không liên quan code). Lần chạy thử đó vẫn kịp chạy bước chuẩn bị dữ liệu của script: các ô Mini M trống ở Tân Bình bị đưa về bảo trì (chừa 1 ô), đơn `PENDING` toàn hệ thống chuyển `EXPIRED`, HĐ quá hạn của `khachhang1` (nếu có) được đặt lại `ACTIVE` +1 tháng, BOM tạo thêm phiên bản chính sách Tân Bình rồi trả về v1.
- Các script e2e đã thêm cờ `-I` cho `sqlcmd` (thiếu cờ này lệnh UPDATE dọn dữ liệu bị SQL Server từ chối do `QUOTED_IDENTIFIER`).
- Khách test `e2e.khach@queenkho.local`: script mới tạo thêm HĐ (đã thanh lý, hàng đang ở kho tổng) — dùng xem thẻ kho tổng ở trang hợp đồng.
