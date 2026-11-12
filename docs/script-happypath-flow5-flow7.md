# 🎤 Script Demo — Happy Path Flow 5 & Flow 7

> **Phong cách:** Nói tự nhiên, chỉ tay vào màn hình khi thao tác. Câu in *nghiêng* = nói với hội đồng. Câu in `code` = thao tác trên máy.
> **Tài khoản:** FM = `fmtanbinh@gmail.com` | Staff = `stafftanbinh1@gmail.com` | Khách = `phuc.khach@queenkho.local` | Mật khẩu: `123456`

---

# ⚡ FLOW 5 — Facility Storage and Staff Management

---

## 🔷 BƯỚC 1 — Dashboard tổng quan `/manager`

> *(Mở trình duyệt, đăng nhập FM Tân Bình)*

*"Đây là cổng quản lý của Facility Manager — người chịu trách nhiệm vận hành toàn bộ cơ sở Tân Bình."*

*"Ngay khi đăng nhập, hệ thống hiển thị Dashboard với các chỉ số realtime:"*
- *"Số ô kho theo từng trạng thái — Available, Occupied, Maintenance."*
- *"Tỷ lệ lấp đầy theo khu."*
- *"Các đơn đang chờ gán ô, hợp đồng sắp hết hạn, và công việc cần xử lý."*
- *"Mỗi thẻ có thể bấm thẳng vào màn hình chi tiết tương ứng."*

---

## 🔷 BƯỚC 2 — Mặt bằng kho `/manager/storage`

> *(Chuyển sang tab Storage, chọn Tầng 2)*

*"Đây là sơ đồ mặt bằng kho theo từng tầng. Hệ thống hiển thị trực quan từng ô kho với nhãn trạng thái thời gian thực:"*

- *"Ô màu xanh lá — đang trống, có thể gán cho khách mới."*
- *"Ô màu cam với nhãn 'Còn N ngày' — đang thuê, sắp hết hạn."*
- *"Ô màu xanh dương nhạt với nhãn 'Sắp trống' — khách đã hẹn trả, có thể bán trước cho đơn tiếp theo."*
- *"Ô có nhãn 'Đã có khách đặt từ dd/MM' — đã được đặt tương lai."*

*"Nhờ sơ đồ này, FM nhìn một lần là biết toàn bộ tình trạng cơ sở mà không cần tra từng hồ sơ."*

---

## 🔷 BƯỚC 3 — Lịch ô kho (Timeline)

> *(Bấm nút LỊCH Ô KHO, đổi khoảng xem sang 3 tháng, lọc theo Tiêu Chuẩn)*

*"Đây là chức năng Lịch ô kho — hiển thị dạng timeline, tương tự Gantt chart."*

*"FM có thể xem từng ô đang được đặt khoảng thời gian nào, khoảng nào đang trống để lấp vào."*

- *"Thanh màu xanh đậm là khoảng đang có hợp đồng."*
- *"Nền trắng giữa hai thanh là khoảng trống — có thể gán đơn mới vào đây."*

> *(Bấm vào 1 thanh hợp đồng)*

*"Khi bấm vào một hợp đồng bất kỳ, hệ thống mở popup chi tiết ngay tại chỗ — không chuyển tab mới, không mất phiên đăng nhập. Đây là thiết kế quan trọng vì hệ thống lưu phiên theo tab."*

---

## 🔷 BƯỚC 4 — Thêm ô kho & Khoá bảo trì

> *(Bấm + THÊM Ô KHO MỚI)*

*"FM có thể bổ sung ô kho mới bất cứ lúc nào. Hệ thống tự động sinh mã ô theo chuẩn `KV-<cơ sở>-<khu><phòng>`, ví dụ `KV-TB-C110`."*

> *(Chọn ô trống KV-TB-C105 → bấm KHOÁ BẢO TRÌ, nhập lý do ≥ 10 ký tự)*

*"Khi một ô cần sửa chữa, FM khoá lại thành trạng thái Maintenance — ô này sẽ không xuất hiện trong danh sách gán cho khách mới."*

*"Lý do phải nhập tối thiểu 10 ký tự để đảm bảo có ghi chú rõ ràng cho team vận hành."*

> *(Bấm MỞ LẠI KHO)*

*"Sau khi sửa xong, FM mở lại — ô trở về Available và hệ thống tính lại số suất còn trống."*

---

## 🔷 BƯỚC 5 — Quản lý nhân viên `/manager/staff`

> *(Chuyển sang trang Staff, bấm THÊM NHÂN VIÊN)*

*"FM quản lý toàn bộ nhân viên trong cơ sở mình. Khi tạo tài khoản nhân viên mới, hệ thống tự động gán vào đúng cơ sở — Staff Tân Bình sẽ chỉ thấy công việc tại Tân Bình."*

*"Danh sách nhân viên kèm theo thống kê: số việc đang làm, số việc hoàn thành trong tháng — giúp FM đánh giá hiệu suất."*

> *(Nhập họ tên, email mới, mật khẩu → bấm Tạo)*

*"Tài khoản được tạo thành công và nhân viên có thể đăng nhập ngay."*

---

## 🔷 BƯỚC 6 — Quản lý task `/manager/tasks`

> *(Chuyển sang trang Tasks, bấm lọc Hạn chót · Sớm nhất trước)*

*"Đây là bảng công việc của cơ sở. FM có thể lọc theo hạn chót để ưu tiên xử lý việc khẩn."*

*"Các task khẩn — ví dụ task hỗ trợ hay task kiểm tra cảm biến — tự động được ghim lên đầu danh sách."*

> *(Chọn 1 task OPEN → bấm GIAO VIỆC → chọn stafftanbinh1)*

*"FM giao task cho nhân viên cụ thể. Hệ thống chỉ cho phép giao trong vòng 30 ngày trước ngày hẹn — tránh phân công quá xa khi chưa biết lịch làm việc của nhân viên."*

*"Nhân viên nhận được thông báo ngay lập tức."*

---

## 🔷 BƯỚC 7 — Danh sách hợp đồng `/manager/customers`

> *(Chuyển sang trang Customers, lọc Ngày kết thúc · Sớm nhất trước)*

*"Màn hình này giúp FM theo dõi toàn bộ hợp đồng của cơ sở. Lọc theo ngày kết thúc sớm nhất giúp FM chủ động liên hệ nhắc khách gia hạn trước khi hết hạn."*

> *(Bấm vào mã HĐ bất kỳ)*

*"Chi tiết hợp đồng mở popup ngay trên trang — đóng popup thì bộ lọc và số trang vẫn giữ nguyên, FM không cần lọc lại từ đầu."*

---

## 🔷 BƯỚC 8 — Báo cáo doanh thu `/manager/reports`

> *(Chuyển sang trang Reports)*

*"FM xem được báo cáo doanh thu của riêng cơ sở mình: tiền thuê thu được, lấp đầy theo từng loại kho, xu hướng theo tháng."*

*"Dữ liệu được cô lập theo token — FM Tân Bình không thấy được số liệu của Bình Thạnh hay Thủ Đức."*

---

---

# 🎧 FLOW 7 — Support Request and Issue Handling

---

## 🔷 BƯỚC 1 — Khách gửi yêu cầu hỗ trợ `/ho-tro`

> *(Mở cửa sổ ẩn danh, đăng nhập phuc.khach@queenkho.local)*

*"Khách hàng Phúc đang thuê kho và gặp sự cố: cửa kho bị lỗi khoá, không vào được."*

*"Khách truy cập trang Hỗ trợ và gửi yêu cầu."*

> *(Bấm GỬI YÊU CẦU HỖ TRỢ → chọn hợp đồng HD-F7-01 → chọn loại Lỗi khoá → nhập mô tả ≥ 10 ký tự → bấm Gửi)*

*"Hệ thống ghi nhận ticket với trạng thái OPEN và lập tức tạo một task SUPPORT được đánh dấu khẩn cấp."*

*"Tại sao khẩn? Vì lỗi khoá ảnh hưởng trực tiếp đến khả năng tiếp cận tài sản của khách — cần xử lý ưu tiên."*

*"Task khẩn này sẽ tự động nổi lên đầu danh sách công việc của Staff và FM."*

---

## 🔷 BƯỚC 2a — Staff nhận việc

> *(Mở cửa sổ khác, đăng nhập stafftanbinh1@gmail.com)*

*"Nhân viên Tân Bình 1 vào bảng công việc, thấy task hỗ trợ vừa tạo đang nằm đầu danh sách — được đánh dấu khẩn."*

> *(Bấm NHẬN VIỆC)*

*"Nhân viên nhận việc. Hệ thống khoá task lại — nếu Staff 2 cũng bấm vào cùng lúc, người bấm sau sẽ nhận được thông báo 'Task đã có người nhận'. Đây là cơ chế first-come-first-served để tránh trùng lặp."*

---

## 🔷 BƯỚC 2b — Staff cấp lại PIN

> *(Trong task, bấm CẤP LẠI PIN)*

*"Vì loại sự cố là Lỗi khoá, Staff có thể thực hiện tác vụ 'Cấp lại PIN' trực tiếp từ giao diện task."*

*"Hệ thống tự sinh một mã PIN 6 số mới chưa được dùng bởi bất kỳ ô kho nào trong hệ thống, gắn vào hợp đồng của khách."*

*"Khách nhận được thông báo với PIN mới."*

---

## 🔷 BƯỚC 2c — Staff hoàn tất xử lý

> *(Nhập kết quả xử lý → bấm HOÀN TẤT)*

*"Staff ghi kết quả xử lý và hoàn tất. Ticket chuyển sang trạng thái RESOLVED."*

*"Khách nhận thông báo: 'Yêu cầu hỗ trợ của bạn đã được xử lý — vui lòng xác nhận.'"*

---

## 🔷 BƯỚC 3 — Khách xác nhận "Đã ổn"

> *(Quay lại cửa sổ khách, vào trang Hỗ trợ)*

*"Khách Phúc thấy ticket đã chuyển sang trạng thái RESOLVED. Khách thử PIN mới, thấy khoá hoạt động bình thường."*

> *(Bấm ĐÃ ỔN)*

*"Khách xác nhận. Ticket đóng lại với trạng thái CLOSED."*

*"Luồng khép lại hoàn chỉnh: Khách gửi → Staff nhận → Staff xử lý → Khách xác nhận. Toàn bộ lịch sử được ghi vào activity_logs để Admin kiểm tra."*

---

## 🔷 Tổng kết Flow 7

*"Flow 7 cho thấy hệ thống xử lý hỗ trợ khách hàng khép kín: từ lúc khách báo sự cố, đến khi nhân viên xử lý xong và khách xác nhận."*

*"Điểm nổi bật là task hỗ trợ được đánh dấu khẩn tự động, cấp lại PIN ngay từ giao diện task mà không cần thao tác tay trên thiết bị vật lý — toàn bộ là SmartLock mô phỏng qua API."*

---
