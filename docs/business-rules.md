# QueenKho — Business Rules

> Cập nhật: **05/11/2026** · Đối chiếu với code trên `main` `9d7dd5c` + thay đổi chưa commit ngày 05/11 — 212 unit test + E2E `docs/test-e2e/e2e-hop-nhom-05-11.sh` (44 bước), `e2e-bao-hiem-boi-thuong.sh` (36), `e2e-sua-bug-sau-test.sh` (48) chạy pass cùng ngày.
> Các lần cập nhật: 16–17/10 tổng hợp + góp ý thành viên · 26/10 hoàn thiện 5 flow Must-have · 27/10 góp ý giảng viên — gia hạn báo trước 3 ngày & tối ưu doanh thu ô kho (D-12) · 01/11 đồng bộ toàn bộ tài liệu với code · 02/11 sửa lỗi sau đợt test · 04/11 góp ý giảng viên — bằng chứng bàn giao, chuyển ô, ưu tiên khách cũ, check-in online, phí di dời hàng (D-13), bảo hiểm & bồi thường (D-14) · 05/11 họp nhóm — loại hàng khi đặt kho, kiểm tra hàng lúc check-in, voucher theo loại kho, bỏ ân hạn 5 ngày, kho tổng thay bán thanh lý (D-15, mục 7).
>
> **Ký hiệu**
> - **BR-xx** — rule mô tả hành vi **code đang chạy**. BR-01 → BR-100 có từ đợt tổng hợp đầu; **BR-101 trở đi** bổ sung 01/11/2026 cho các tính năng làm sau 27/10 (mặt bằng, thông báo, mô phỏng demo…).
> - **PR-xx** — rule nhóm **chốt qua các buổi họp / góp ý**, sau đó mới code. Đến 01/11/2026 phần lớn PR đã code xong.
> - **D-xx** — quyết định nghiệp vụ lớn (mục 1.2). **L-xx** — chỗ code còn lệch rule (mục 4).
> - **Trạng thái code** của từng dòng (đối chiếu 01/11/2026): **không đánh dấu** = code đã chạy đúng rule · ⬜ = chưa code · ⚠️ = code đang khác rule (xem L-xx) · 🔸 = mô phỏng / giới hạn của sản phẩm môn học. Dòng có ~~gạch~~ là rule cũ **đã bị thay** bởi rule ghi bên cạnh.
> - Tiêu đề UC: ✅ đã có code và màn hình.
>
> Mã rule giữ nguyên qua các lần sửa để PR/commit trích dẫn được — **không đánh số lại**.
> Mã đã bỏ (bị gộp vào mã khác): PR-01, 02 → PR-A1 · PR-16 → PR-M7 · PR-23 → PR-M14 · PR-30…33 → PR-O5…O9 · PR-40, 41 → PR-O11, O12 · PR-42…44 → PR-Q1…Q10 · PR-45 → PR-Q12 · PR-53 → PR-R9.

**Mục lục**
0. [Tổng quan](#0-tổng-quan)
1. [Quy ước chung & quyết định lớn](#1-quy-ước-chung--quyết-định-lớn)
2. [Vòng đời trạng thái](#2-vòng-đời-trạng-thái)
3. [Rule theo từng UC](#3-rule-theo-từng-uc)
4. [Chỗ code còn lệch rule](#4-chỗ-code-còn-lệch-rule)
5. [Thay đổi schema](#5-thay-đổi-schema)
6. [Mã lỗi API](#6-mã-lỗi-api)
7. [Lịch sử thay đổi theo góp ý](#7-lịch-sử-thay-đổi-theo-góp-ý)
8. [Truy vết rule ↔ kiểm thử](#8-truy-vết-rule--kiểm-thử)

---

## 0. Tổng quan

### 0.1 Tính năng theo vai trò

| Vai trò | UC | Trạng thái |
|---|---|---|
| **Customer** | UC-02 Đăng ký · UC-09 Tìm kho · UC-10 Đặt chỗ · UC-11 Thanh toán cọc · UC-12 Đơn của tôi · UC-15 Huỷ đơn · UC-19 Hợp đồng của tôi · UC-20 Thanh toán & khoản nợ (PR-50) · UC-21 Gia hạn · UC-22 Yêu cầu trả kho · UC-26 Gửi yêu cầu hỗ trợ · Xem vị trí ô trên mặt bằng (BR-109) · Check-in online (BR-124) · Xem biên bản bàn giao + ảnh (BR-121) · Chọn gói bảo hiểm hàng hoá (BR-125) · Báo hàng hư / mất, theo dõi hồ sơ bồi thường (BR-126) · Xem nhiệt độ / độ ẩm ô (BR-129) · Khai báo loại hàng khi đặt kho (BR-131) · Xem hàng của mình ở kho tổng + số tiền cần trả để nhận lại (BR-134) | ✅ |
| **Staff** | UC-16 Bảng công việc · UC-17 Nhận việc · UC-18 Check-in & biên bản · UC-23 Nghiệm thu trả kho · UC-24 Sự cố hư hỏng · UC-27 Xử lý hỗ trợ · Bảo trì ô (PR-O10) | ✅ |
| **Facility Manager** | UC-06 Ô kho & sơ đồ mặt bằng · UC-13 Đơn chờ gán ô · UC-14 Gán ô (chọn trên mặt bằng, ưu tiên khách cũ + gói dài — BR-123) + sinh hợp đồng · Chuyển ô cho hợp đồng (BR-122) · Bồi thường hàng hoá: thẩm định, chốt, chi trả (BR-127, BR-128) · EX-03 No-Show / dời lịch · UC-16/17 Bảng việc, giao việc, gỡ người nhận · UC-25 Hoàn tiền · UC-28 Hợp đồng quá hạn & thanh lý · Hàng ở kho tổng (PR-Q10, BR-134) · UC-30 Dashboard · Báo cáo cơ sở · UC-32 Quản lý nhân viên · Xem khách hàng & hợp đồng | ✅ |
| **BOM** | UC-04 Cơ sở · UC-05 Loại kho & giá · UC-07 Chính sách thuê · UC-29 Doanh thu toàn chuỗi (có chi bồi thường) · Hợp đồng quá hạn toàn chuỗi + miễn phí trễ (BR-130) · Xem hồ sơ bồi thường (BR-128) · Loại hàng gửi kho + loại kho thường / lạnh / đông (BR-131) · Voucher theo loại kho (BR-133) · Kho tổng (BR-134) | ✅ |
| **Admin** | UC-03 Vai trò · UC-08 Tài khoản · UC-31 Nhật ký + lịch sử đăng nhập · Dashboard `/admin` | ✅ |
| **Chung** | UC-01 Đăng nhập · Thông báo trong ứng dụng (BR-111 → BR-113, 🔸 lưu bộ nhớ) | ✅ |
| **Hệ thống** | EX-01 Hết hạn giữ chỗ · EX-02 Thanh toán lỗi · job quá hạn hợp đồng 00:05 (điều khoản v4: thanh lý + sinh việc chuyển kho tổng — D-15) · job nhắc gia hạn 08:00 (15/10/7/3/1 ngày) · job task quá hạn + tự đóng ticket (mỗi phút) | ✅ |
| **Demo** | Mô phỏng thời gian để trình diễn (BR-114 → BR-116) | ✅ |

Rule còn chưa code hoặc code đang lệch: xem **mục 4**.

### 0.2 Việc tiên quyết
✅ Đã xong toàn bộ (01/11/2026): portal `/bom`, `/admin` (`getHomePath(role)`); entity `RentalPolicy` (PR-Q13); task `REFUND` cho FM (PR-O12) dùng chung cho UC-15, EX-03, UC-23, UC-28.

---

## 1. Quy ước chung & quyết định lớn

### 1.1 Rule chung
| Mã | Rule |
|---|---|
| PR-90 | Mọi API lấy người thao tác từ **token**, không nhận `customerId`/`managerId`/`staffId` qua query. Khách chỉ xem/thao tác **đơn & hợp đồng của mình**; FM/Staff chỉ dữ liệu **cơ sở mình**. ✅ *Đã làm 26/10/2026: `AccessControlFilter` + `AccessPolicy` + `OwnershipGuard` (xem mục 7).* |
| PR-91 | Mọi thay đổi trạng thái nằm trong 1 `@Transactional` và ghi `activity_logs` (chi tiết: PR-A9). |
| PR-92 | Tiền VND, làm tròn đến đồng; giờ `Asia/Ho_Chi_Minh`. Tách 2 khung giờ: **Giờ quầy (Staff Desk Hours) đóng lúc 21:00** — là hạn của mọi task (check-in, nghiệm thu, hỗ trợ); **Giờ ra vào kho (Customer Access) 24/7** — khách có hợp đồng `ACTIVE` / `TERMINATION_PENDING` tự ra vào bằng PIN / RFID bất kể giờ nào (`OVERDUE` bị khoá PIN — PR-Q5). |
| PR-93 | Hạn xử lý tiền hoàn: **24h, không tính Chủ Nhật** (`ReservationService.calculateRefundDeadline`). |

### 1.2 Quyết định lớn (đã chốt 16/10/2026)
| Mã | Quyết định | Ảnh hưởng |
|---|---|---|
| D-01 | **Trả trước theo kỳ**: lúc đặt trả **cọc** (mặc định 1 tháng; BOM chỉnh hệ số — PR-M6) **+ tiền thuê cả kỳ**. Hết kỳ muốn thuê tiếp thì trả kỳ mới, chọn lại 1 / 3 / 6 / 12 tháng. Không thu hằng tháng. | Code đã đúng (BR-24). UC-20 đổi phạm vi (PR-50). |
| D-02 | Chỉ đặt được khi **còn suất** đúng loại + cơ sở. Đặt chỗ **giữ tạm** 1 suất, gán ô mới **trừ thật**. FM chỉ gán **đúng loại**. | PR-B1, PR-M10 (L-11, L-13 đã sửa 26/10). |
| D-03 | Tài khoản `STAFF` do **cả FM và Admin** tạo. | PR-22. |
| D-04 | **FM** thực hiện hoàn tiền, qua task `REFUND` trong `facility_tasks` (đã code ở #55, #57). | PR-O12; L-01 đã sửa. |
| D-05 | **Bỏ cột** `rental_policy.lock_account_days`. | ✅ Đã bỏ (UC-07). |
| D-06 | *(chốt lại 01/11/2026)* **Giữ voucher**: mỗi đơn đặt kho trực tuyến được **giảm cố định 100.000đ** (mã `NEWKHO`, tự áp). Dùng làm ưu đãi thu hút khách đặt online. *(Bản 16/10 quyết định bỏ voucher nhưng code và trang chủ vẫn giữ, nên nhóm chốt giữ theo sản phẩm.)* | BR-24, BR-25 (PR-B9 bỏ); câu chữ quảng cáo cần sửa — L-04. |
| D-07 | **No-Show**: mặc định tịch thu 100% cọc, **hoàn toàn bộ tiền thuê**. FM được **"Miễn phạt"** (bắt buộc lý do) → hoàn cả cọc. Chỉ được bấm No-Show sau **≥ 2 lần liên hệ thất bại cách nhau ≥ 24h** và đã qua **48h** từ giờ hẹn. | PR-X1, PR-X3 (L-06, L-25 đã sửa). |
| D-08 | **Giữ 2 bảng ưu đãi**: đặt mới 1/3/6/12T mặc định giảm **0/5/10/15%**; gia hạn mặc định **0/0/5/10%**. *(26/10/2026)* BOM chỉnh được theo từng cơ sở trong chính sách thuê (0–50%, gói 1 tháng luôn 0%); đơn mới **chốt %** vào `reservations.rent_discount_percent`; gia hạn dùng bản chính sách đang hiệu lực. | Mọi chỗ tính tiền dùng chung `PricingService`; FE lấy % từ API `/facilities/{id}/pricing`. |
| D-09 | **Thanh lý**: trừ phí trễ (trần 50% cọc) **+ phí chiếm dụng** (PR-Q14) vào cọc; phần cọc còn lại **tạm giữ**, chỉ hoàn khi khách đến cơ sở làm việc với FM; phí vượt cọc thành **khoản nợ** của khách. *(sửa 27/10/2026 — trước đây chỉ trừ 50% cọc)* | PR-Q9. |
| D-10 | **Trả kho sớm được hoàn tiền thuê** theo nguyên tắc *thu hồi ưu đãi + phí phá hợp đồng* (thay quy định "trả sớm không hoàn"). | PR-O2. |
| D-11 | ~~**Ân hạn dọn đồ**: miễn phí 1 ngày sau `end_date`; ngày 2 → 5 tính tiền thuê theo ngày, trừ vào cọc.~~ → **Bỏ từ 05/11/2026 (D-15)**: nhóm thấy ân hạn dễ bị lợi dụng (hẹn trả sau hạn để dùng thêm 5 ngày gần như miễn phí). Muốn dùng thêm phải gia hạn. | PR-O1, PR-O14 (đã thay). |
| D-12 | (27/10/2026, góp ý giảng viên) **Tối ưu doanh thu ô kho** — khách cũ không được giữ ô "miễn phí" khi không thuê tiếp. 4 tầng: **(1)** gia hạn phải báo trước 3 ngày, quá mốc thì ô thành *sắp trống* và được bán trước cho khách khác; **(2)** quá hạn tính **phí chiếm dụng** mỗi ngày, không trần, để quá hạn luôn đắt hơn gia hạn; **(3)** thanh lý sau **15 ngày** (thay 30) để ô sớm cho thuê lại; **(4)** hàng lưu giữ sau thanh lý tính **phí lưu giữ**. Tầng 2–4 chỉ áp dụng cho khách đã đồng ý **điều khoản v2**. | PR-R10, PR-R11, PR-R12, PR-Q8, PR-Q14, PR-Q15. |
| D-13 | (04/11/2026, góp ý giảng viên cho nhóm cùng đề tài) **Không gắn chết khách với 1 ô, có bằng chứng khi bàn giao, ưu tiên khách gắn bó**: **(1)** biên bản nhận / trả kho bắt buộc **ảnh hiện trạng ô** — so hai bộ ảnh để biết hư hỏng do ai; **(2)** FM được **chuyển hợp đồng sang ô khác cùng loại** (sự cố cơ sở / khách xin / sắp xếp lại, kể cả lúc gia hạn); **(3)** đơn chờ gán ô xếp **khách cũ + gói dài** lên trước; **(4)** khách **tự check-in online** đúng ngày hẹn; **(5)** thanh lý thu thêm **phí dọn & di dời hàng** một lần. Điều khoản tài sản lên **v3**. | BR-121 → BR-124, PR-Q16. |
| D-14 | (04/11/2026, góp ý giảng viên: hàng hư / mất do kho, nhiệt độ, bảo hiểm, IoT) **Bảo hiểm hàng hoá + bồi thường qua yêu cầu hỗ trợ**: khách chọn gói bảo hiểm khi đặt kho (Cơ bản miễn phí / Nâng cao / Cao cấp) và khai báo giá trị hàng; hàng hư / mất gửi ticket hỗ trợ loại mới → Staff kiểm tra hiện trường → FM đối chiếu ảnh bàn giao + cảm biến, chốt lỗi và số tiền → chi trả có bằng chứng → gói có bảo hiểm thì cơ sở đòi lại bên bảo hiểm. Lỗi cơ sở **không đền gấp đôi giá trị hàng** (dễ trục lợi) mà đền tiền hàng tới trần + **phạt vi phạm 1 tháng tiền thuê** + hoàn tiền thuê ngày ô không dùng được, khách được chấm dứt hợp đồng không phí phá HĐ. Giữ quyền FM miễn phí trễ và **thêm quyền này cho BOM**. | BR-125 → BR-130. |
| D-15 | (05/11/2026, họp nhóm) **Rõ ràng từ lúc đặt tới lúc hết hạn, không bán hàng của khách**: **(1)** khách **khai báo loại hàng** khi đặt kho (danh mục do BOM quản lý; thực phẩm chỉ gửi kho lạnh / kho đông), ngày nhận kho chọn đầu tiên trên trang đặt; **(2)** Staff **kiểm tra hàng** lúc check-in (mục 6 checklist); **(3)** voucher gắn được **từng loại kho**; **(4)** nhắc gia hạn **15 / 10 / 7 / 3 / 1 ngày**, **bỏ ân hạn 5 ngày**; **(5)** hết hạn không gia hạn / không trả kho → hôm sau (job 00:05) hợp đồng **thanh lý ngay**, hàng được kiểm kê và **chuyển vào kho tổng**, ô mở cho thuê lại; **(6)** kho tổng giữ hàng **tới khi khách nhận lại**, tính phí lưu giữ theo ngày, **không bán / không tiêu huỷ**; khách quá hạn xem được kho tổng, hotline và số tiền cần trả. Giữ nguyên PR-O2 (trả sớm). Điều khoản tài sản lên **v4**; hợp đồng điều khoản cũ vẫn đi luồng thanh lý cũ nhưng cũng **không bị bán hàng**. | BR-131 → BR-134, PR-R9, PR-O1, PR-Q1, PR-Q8, PR-Q10, PR-Q15, PR-R11. |

### 1.3 Ma trận vai trò → màn hình
| Nhóm màn hình | CUSTOMER | STAFF | FM | BOM | ADMIN |
|---|:-:|:-:|:-:|:-:|:-:|
| Tìm & đặt kho, Kho của tôi, Thanh toán & khoản nợ, Hỗ trợ | ✔ | | | | |
| Xem vị trí ô của hợp đồng trên mặt bằng (BR-109) | ✔ (hợp đồng của mình) | ✔ | ✔ | | |
| Bảng công việc, check-in / nghiệm thu, sự cố, xử lý hỗ trợ (kể cả kiểm tra hiện trường hồ sơ bồi thường), bảo trì ô | | ✔ | xem, giao việc, gỡ người nhận, gia hạn task hỗ trợ, đóng task bảo trì | | |
| Đơn chờ gán ô, No-Show, ô kho & sơ đồ mặt bằng, hợp đồng quá hạn, hàng lưu giữ, dashboard & báo cáo cơ sở, hoàn tiền | | | ✔ | | |
| Tạo / khoá tài khoản Staff | | | ✔ (cơ sở mình) | | ✔ |
| Cơ sở, loại kho & giá, chính sách, doanh thu toàn chuỗi | | | xem chính sách | ✔ | |
| Vai trò, người dùng, nhật ký, lịch sử đăng nhập | | | | | ✔ |

Nguồn đúng duy nhất của phân quyền là bảng `AccessPolicy` (PR-90); ma trận ở `/admin/roles` đọc thẳng từ bảng này. API mới không khai báo luật → 403 `API_NOT_DECLARED`.

### 1.4 Thuật ngữ
| Thuật ngữ | Nghĩa trong hệ thống |
|---|---|
| **BOM** | *Business Operations Manager* — quản lý vận hành kinh doanh toàn chuỗi (danh mục cơ sở, loại kho, giá, chính sách, doanh thu). Mọi tài liệu khác (slide, sơ đồ) dùng đúng tên này. |
| **FM** | *Facility Manager* — quản lý một cơ sở. **Staff** — nhân viên tại cơ sở. |
| **Cơ sở / Loại kho / Ô kho** | Cơ sở = một địa điểm kho (`facilities`). Loại kho = danh mục kích thước + giá chung toàn hệ thống (`unit_types`). Ô kho = một ô vật lý cụ thể, mã `KV-<mã cơ sở>-<khu><số>` (`storage_units`). |
| **Suất** | Số đơn còn nhận được cho một (cơ sở × loại kho) = ô `AVAILABLE` − đơn đang giữ suất (BR-11). Khách đặt theo **suất của loại kho**, không chọn ô; FM gán ô sau khi đơn đã cọc. |
| **Ô sắp trống** | Ô `OCCUPIED` của hợp đồng đã qua hạn chót gia hạn ưu tiên — được tính là suất cho đơn mới có ngày nhận kho ≥ ngày giao ô (PR-R11). |
| **Hạn chót gia hạn ưu tiên / cửa sổ muộn** | Hết ngày `end_date − 3`. Trước mốc gia hạn tự do; sau mốc chỉ gia hạn khi ô chưa ai cần (PR-R10). |
| **Ân hạn dọn đồ** | ~~5 ngày sau `end_date` khi khách đã hẹn trả kho~~ — **đã bỏ 05/11/2026 (D-15)**: ngày hẹn trả kho chậm nhất là `end_date`. |
| **Phí trễ** | Phạt quá hạn: 10% cọc mỗi ngày, trần 50% cọc (PR-Q3). |
| **Phí chiếm dụng** | Tiền dùng ô những ngày quá hạn: giá ngày × 150%, không trần (PR-Q14). Tính vào doanh thu thuê, không phải phạt. |
| **Phí lưu giữ hàng** | Giá ngày của ô cũ × 20% cho mỗi ngày hàng nằm ở kho tổng sau thanh lý (PR-Q15). Điều khoản v4 tính tới ngày khách nhận lại (không giới hạn 60 ngày). |
| **Trừ cọc** | Ghi khoản phí bằng giao dịch method `DEPOSIT_OFFSET` — không phải tiền mới thu vào (PR-M8). |
| **Khoản nợ** | Phí vượt cọc (`DAMAGE_FEE` / `OVERSTAY_FEE`, method `VNPAY`, `PENDING`); còn nợ thì không đặt kho mới (PR-Q12), trả ở UC-20. |
| **Thanh lý** | Chấm dứt hợp đồng quá hạn để giải phóng ô (PR-Q8, PR-Q9). Điều khoản v4: hệ thống tự thanh lý hôm sau ngày hết hạn (D-15); điều khoản cũ: FM bấm khi quá `liquidation_days`. Hàng của khách chuyển vào **kho tổng** (BR-134). |
| **Kho tổng** | Kho trung tâm của QueenKho (bảng `central_warehouses`, BOM quản lý) giữ hàng của khách bị thanh lý. Hàng được giữ tới khi khách nhận lại (trả hết nợ + phí lưu giữ) hoặc giao cơ quan chức năng nếu là hàng cấm — **không bán** (BR-134). |
| **Loại hàng / loại kho nhiệt độ** | Loại hàng = danh mục khách chọn khi đặt (`goods_categories`: gia dụng, văn phòng phẩm, thực phẩm, quần áo, nội thất, điện tử, khác). Loại kho nhiệt độ = `unit_types.temperature_class` `NORMAL` (thường) / `COLD` (lạnh) / `FROZEN` (đông) (BR-131). |
| **Giờ quầy / giờ ra vào** | Giờ quầy đóng 21:00 = hạn mọi task; khách ra vào kho 24/7 bằng PIN / RFID (PR-92). |
| **Điều khoản v1 → v4** | Điều khoản xử lý tài sản khách đồng ý khi đặt (`reservations.terms_version`). v2 (từ 27/10/2026) thêm phí chiếm dụng, thanh lý 15 ngày, phí lưu giữ; đơn v1 giữ rule cũ (D-12). v3 (từ 04/11/2026) thêm phí dọn & di dời hàng khi thanh lý, quyền chuyển ô cùng loại, ảnh biên bản (D-13); đơn v2 không bị tính phí di dời. **v4 (từ 05/11/2026)**: không ân hạn, hết hạn là thanh lý + chuyển kho tổng ngay, kho tổng giữ hàng không thời hạn và không bán, khai báo + kiểm tra loại hàng (D-15). |
| **Chuyển ô** | FM đổi ô của hợp đồng sang ô khác cùng loại, cùng cơ sở; giá, cọc, PIN, ngày hết hạn giữ nguyên (BR-122). |
| **Check-in online** | Khách tự nhận kho trên app đúng ngày hẹn: nhập CCCD, tự kiểm tra ô, chụp ảnh, cam kết hàng cấm → hợp đồng `ACTIVE` + PIN, không cần Staff (BR-124). |
| **Mã FT** | Mã giao dịch ngân hàng của lệnh chuyển khoản, lưu ở `payment_transactions.bank_transaction_code` để đối soát. |

---

## 2. Vòng đời trạng thái

> Sơ đồ khớp code ngày 01/11/2026. Bản UML đầy đủ (kèm bảng chuyển trạng thái) nằm ở tài liệu Statechart; khi sửa một bên phải sửa cả bên kia.

### 2.1 Đơn đặt chỗ — `reservations.status`
```
                 ┌── VNPAY lỗi / khách huỷ trên VNPAY: vẫn PENDING, "Thanh toán lại" (PR-B8)
                 │
PENDING ──(VNPAY OK)──▶ DEPOSIT_PAID ──(FM gán ô, UC-14)──▶ UNIT_ASSIGNED ──(yêu cầu trả kho, UC-22)──▶ TERMINATION_PENDING ──(nghiệm thu UC-23)──▶ COMPLETED
   │                        │                                   │                                              │
   │ quá 15 phút → EXPIRED  │ khách huỷ (UC-15) → REFUND_PENDING │ No-Show (EX-03) → CANCELLED                  │ gia hạn (UC-21) / huỷ yêu cầu (PR-O4) → UNIT_ASSIGNED
   │ khách huỷ → CANCELLED  │ No-Show (EX-03) → CANCELLED        │ thanh lý hợp đồng (UC-28) → COMPLETED

EXPIRED / CANCELLED ──(IPN hợp lệ về muộn, PR-B6)──▶ REFUND_PENDING ──(FM hoàn tất task REFUND)──▶ REFUNDED
CANCELLED (No-Show còn tiền phải hoàn) ──(FM hoàn tất task REFUND)──▶ REFUNDED
```
- `REFUND_PENDING` = tiền đã thu nhưng phải hoàn (khách huỷ đơn đã cọc, IPN về muộn). `REFUNDED` do FM hoàn tất task `REFUND` (`StaffTaskService` + trigger `trg_facility_tasks_refund_sync`).
- Thanh lý (UC-28) chuyển đơn sang `COMPLETED` từ trạng thái hiện tại của đơn (thường là `UNIT_ASSIGNED`, vì hợp đồng quá hạn mà khách chưa hẹn trả kho).
- Comment trạng thái trong `QueenKho.sql` chưa liệt kê đủ các trạng thái trên (L-12).

### 2.2 Hợp đồng — `rental_contracts.status`
```
PENDING_CHECK_IN ──(check-in, UC-18)──▶ ACTIVE ──(yêu cầu trả kho, UC-22)──▶ TERMINATION_PENDING ──(nghiệm thu, UC-23)──▶ TERMINATED
      │                                   │  ▲                                  │   ▲
      │ No-Show → TERMINATED              │  └──(gia hạn UC-21 / huỷ yêu cầu)───┘   │ hẹn trả kho (≤ 3 ngày)
                                          │                                        │
                    (job 00:05, end_date < hôm nay)          (qua ngày hẹn mà không tới)
                                          ▼                                        │
                                       OVERDUE ◀───────────────────────────────────┘
                                          │  ├──(gia hạn + trả phí trễ + phí chiếm dụng)──▶ ACTIVE
                                          │  └──(hẹn trả kho)──▶ TERMINATION_PENDING
                                          └──(điều khoản v4: job 00:05 tự thanh lý ngay; điều khoản cũ: quá liquidation_days, FM bấm)──▶ LIQUIDATED
```
*(05/11/2026, D-15)* Hẹn trả kho chậm nhất là `end_date` (bỏ ân hạn). Hợp đồng điều khoản v4 chỉ ở `OVERDUE` trong vài phút của job 00:05 rồi sang `LIQUIDATED`; hàng chuyển vào kho tổng (BR-134).
**Mốc gia hạn (PR-R10 / PR-R11)** — không đổi trạng thái hợp đồng, chỉ đổi cách tính suất:
```
            end_date − 3 (hết ngày)                end_date
  ───────────────────┼─────────────────────────────────┼──────────────────────▶
   ƯU TIÊN: gia hạn  │ MUỘN: ô "sắp trống", người khác  │ OVERDUE: vẫn "sắp trống",
   tự do             │ đặt trước được; khách cũ chỉ gia │ + phí trễ + phí chiếm dụng
                     │ hạn nếu chưa ai cần ô            │
```
- Job `ContractOverdueJob` chạy **00:05 hằng ngày** (và chạy bù 1 lần khi server khởi động): `ACTIVE` có `end_date` < hôm nay → `OVERDUE`; `TERMINATION_PENDING` có `end_date + 5` < hôm nay → `OVERDUE` (PR-Q1). Ân hạn 5 ngày tính từ **`end_date`**, không tính từ ngày hẹn.
- 🔸 "PIN bị khoá" khi `OVERDUE` là trạng thái hiển thị (mô phỏng SmartLock, chưa nối thiết bị) — PR-Q5.

### 2.3 Ô kho — `storage_units.status`
```
AVAILABLE ──(gán ô)──▶ OCCUPIED ──(nghiệm thu đạt / No-Show)──▶ AVAILABLE
    ▲  │                   │
    │  │ FM bảo trì        │ nghiệm thu có sự cố / thanh lý
    │  ▼                   ▼
    └─ MAINTENANCE ◀───────┘   (FM "Sửa xong" / "Dọn xong" → AVAILABLE)
```
`RESERVED` **không dùng** (PR-M9; comment SQL còn ghi — L-12). Nhãn "Quá hạn" trên lưới ô là suy ra từ hợp đồng (PR-M11).
Vị trí ô trên sơ đồ mặt bằng (UC-06, BR-105 → BR-109) **không ảnh hưởng trạng thái**: ô chưa đặt lên mặt bằng vẫn cho thuê, gán được bình thường.

### 2.4 Công việc — `facility_tasks` (đổi tên từ `staff_tasks` ở #55)
- Loại: `CHECK_IN` (sinh khi gán ô) · `CHECK_OUT` (sinh khi yêu cầu trả kho) · `SUPPORT` (sinh khi khách tạo ticket) · `REFUND` (sinh khi phát sinh tiền hoàn — **FM xử lý**, PR-O12) · `MAINTENANCE` (sinh khi nghiệm thu có sự cố hoặc thanh lý — Staff / FM bấm "Sửa xong / Dọn xong", PR-O10).
- `OPEN` ──nhận──▶ `IN_PROGRESS` ──xong──▶ `COMPLETED`; FM gỡ người nhận → `OPEN`; quá `due_at` → `OVERDUE`; huỷ → `CANCELLED`.
- `OVERDUE` thoát ra: `CHECK_IN` — FM dời lịch hoặc No-Show (EX-03); `CHECK_OUT` — FM dời ngày trả kho (PR-O13); `SUPPORT` — FM gia hạn task (PR-S4); `REFUND` — FM vẫn hoàn tất được (task hiện đỏ).
- Cột `evidence_image_url` lưu bằng chứng hoàn tiền (PR-O12).

### 2.5 Ticket hỗ trợ — `support_requests.status`
`OPEN` ──Staff nhận──▶ `IN_PROGRESS` ──Staff xong──▶ `RESOLVED` ──khách "Đã ổn" / 3 ngày──▶ `CLOSED`
`RESOLVED` ──khách "Chưa xong"──▶ `OPEN` (task mới). `OPEN` ──khách huỷ / hợp đồng kết thúc──▶ `CLOSED`.

### 2.6 Giao dịch — `payment_transactions`
| `payment_type` | Khi nào |
|---|---|
| `DEPOSIT` | Thanh toán lúc đặt (cọc + tiền thuê cả kỳ) |
| `MONTHLY_RENT` | Gia hạn |
| `LATE_FEE` | Phí trễ (trả khi gia hạn, hoặc trừ vào cọc) |
| `DAMAGE_FEE` | Phí sự cố hư hỏng (trừ cọc; phần vượt cọc thành khoản nợ) |
| `OVERSTAY_FEE` | (27/10/2026) **Phí chiếm dụng** ô khi quá hạn (PR-Q14) và **phí lưu giữ** hàng sau thanh lý (PR-Q15). Là tiền cho việc dùng chỗ → tính vào **doanh thu thuê** (PR-M7). Dòng phụ của link gia hạn có `renewal_months` ≠ NULL (mã `OS` + mã giao dịch chính); khoản nợ có `renewal_months` = NULL. |
| `REFUND` | Hoàn tiền (huỷ đơn, No-Show, trả kho, thanh lý, IPN về trễ) |

`payment_method`: `VNPAY` · `BANK_TRANSFER` · `CASH` · `DEPOSIT_OFFSET` (trừ vào cọc, không phải tiền mới — PR-M8) · `GOODS_SALE` (trừ từ tiền bán hàng lưu giữ — PR-Q10).
`status`: `PENDING` → `SUCCESS` / `FAILED`; giao dịch `FAILED` có IPN hợp lệ về muộn → `SUCCESS` + tự sinh `REFUND` `PENDING` (PR-B6, PR-R5). Hoàn tiền là **một giao dịch `REFUND` riêng** — giá trị `REFUNDED` ghi trong comment SQL không dùng (L-12).
`bank_transaction_code` (BR-103, #96): mã giao dịch phía ngân hàng để đối soát — VNPAY lấy `vnp_BankTranNo`, không có thì `vnp_TransactionNo`; hoàn tiền chuyển khoản lấy mã FT do FM nhập (PR-O15).

---

## 3. Rule theo từng UC

### UC-01 Đăng nhập ✅
**Đang chạy** (`AuthService`, `LoginPage.jsx`, các Layout)
| Mã | Rule |
|---|---|
| BR-03 | Đăng nhập bằng email + mật khẩu (BCrypt). Trả `token` (UUID), `role`, `userId`, `fullName`, `facilityId`, `facilityName`. *(26/10/2026)* Mọi API trừ nhóm công khai (tìm kho, xem giá, đăng nhập / đăng ký, IPN VNPAY) **bắt buộc token** qua `AccessControlFilter` (PR-90): thiếu / sai → 401; tài khoản bị khoá giữa phiên → 401 `ACCOUNT_LOCKED` và huỷ token. FE kiểm tra email đúng định dạng, mật khẩu không rỗng. |
| BR-04 | Điều hướng theo role (`getHomePath`): `CUSTOMER` → `/`; `STAFF` → `/staff`; `FACILITY_MANAGER` → `/manager`; `BOM` → `/bom`; `ADMIN` → `/admin`. Mỗi layout tự kiểm tra role. |
| BR-05 | Phiên ở `sessionStorage` (`accessToken`, `user`) → đóng tab là mất phiên; đăng xuất = xoá 2 khoá. |
| BR-101 | *(26/10/2026)* **Lịch sử đăng nhập** (`login_history`): ghi mọi lần đăng nhập thành công, thất bại (kèm lý do `INVALID_CREDENTIALS` / `ACCOUNT_LOCKED` / `ACCOUNT_DISABLED`) và đăng xuất, cùng email, IP (sau proxy lấy IP đầu trong `X-Forwarded-For`), trình duyệt. Email không tồn tại vẫn ghi (`user_id` NULL) để phát hiện dò tài khoản. Lỗi ghi lịch sử **không chặn** đăng nhập. Admin xem ở `/admin/login-history`. Đây là bảng riêng, không ghi vào `activity_logs` (PR-A9). |

**Đã chốt**
| Mã | Rule |
|---|---|
| PR-L1 | `LOCKED` → 403 `ACCOUNT_LOCKED`; `DISABLED` → 403 `ACCOUNT_DISABLED`. Chỉ kiểm tra **sau khi** mật khẩu đúng. (sửa L-07) |
| PR-L2 | Sai email hay sai mật khẩu đều 401 `INVALID_CREDENTIALS`, cùng message "Email hoặc mật khẩu không đúng". |
| PR-L3 | BE trim email; email / mật khẩu rỗng → 400 `INVALID_INPUT`. |

*Để sau (chưa làm, ngoài phạm vi môn học):* chặn STAFF/FM chưa gán cơ sở, tự chuyển khi đã đăng nhập mà vào `/login`, khoá tài khoản sau N lần sai. *(Portal theo role cho BOM / ADMIN — PR-L4 — đã làm.)*

### UC-02 Đăng ký ✅
| Mã | Rule |
|---|---|
| BR-01 | Chỉ tạo role `CUSTOMER`, status `ACTIVE`. Role khác tạo ở UC-08 / UC-32. |
| BR-02 | Email bắt buộc, đúng định dạng, **duy nhất**; mật khẩu ≥ 6 ký tự; họ tên, SĐT bắt buộc. |
| — | Giữ dòng giới thiệu ưu đãi 100.000₫ ở `RegisterPage.jsx` (D-06), nhưng sửa chữ "cho đơn đầu tiên" cho khớp BR-25 (L-04). |

### UC-09 Tìm kiếm & khám phá kho ✅
| Mã | Rule |
|---|---|
| BR-10 | Chỉ cơ sở `ACTIVE`. Lọc từ khoá, thành phố, loại kho, khoảng giá, khoảng diện tích. |
| BR-11 | **Số suất** của (cơ sở × loại kho) = ô `AVAILABLE` − đơn `PENDING` − đơn `DEPOSIT_PAID` (≥ 0). Suất = 0 → ẩn. Đây là công thức "giữ tạm" của D-02, dùng chung cho PR-B1, PR-M10. *(27/10/2026)* Suất = 0 nhưng có ô **sắp trống** (PR-R11) → vẫn hiện, nhãn **"Trống từ dd/MM"** (`availableFrom`); bấm Đặt kho thì ngày nhận kho tối thiểu là ngày đó. |
| PR-M4 | Loại kho `INACTIVE` không hiện trong tìm kiếm. |

### UC-10 / UC-11 / EX-01 / EX-02 Đặt chỗ & thanh toán cọc ✅
**Đang chạy** (`ReservationService`, `VnpayService`, `ReservationCleanupService`, `CreateReservationPage.jsx`)
| Mã | Rule |
|---|---|
| ~~BR-20~~ | ~~Ngày bắt đầu không ở quá khứ~~ → **PR-B4** |
| BR-21 | Gói thuê 1 / 3 / 6 / 12 tháng (BE chỉ kiểm tra ≥ 1). |
| BR-22 | Mã đơn `RES-xxxxxx`. Đơn mới `PENDING`, chưa có ô. |
| ~~BR-23~~ | ~~Cọc = 1 tháng, viết cứng~~ → **PR-M6** |
| BR-24 | **Tổng trả lúc đặt = giá × số tháng × (1 − ưu đãi gói theo chính sách, D-08) + cọc − voucher đã chốt trên đơn (BR-25).** |
| BR-25 | *(sửa 02/11/2026 — voucher thật, bảng `vouchers`)* **Voucher đặt kho trực tuyến do BOM quản lý** (màn `/bom/vouchers`): mã 3–30 ký tự, giảm **số tiền cố định** hoặc **% tiền thuê** (có trần), điều kiện gói tối thiểu 1/3/6/12 tháng, cơ sở áp dụng (trống = mọi cơ sở), thời gian hiệu lực, tổng lượt và lượt / khách; BOM tạm dừng / mở lại được, không xoá (giữ lịch sử). **Mỗi đơn tối đa 1 mã, không cộng dồn**; khách không nhập mã → tự áp **mã mặc định** `NEWKHO` (giảm 100.000đ, chỉ 1 mã mặc định). Mã khách nhập không hợp lệ → 400 `VOUCHER_INVALID` kèm lý do (không tồn tại / tạm dừng / chưa tới hạn / hết hạn / sai cơ sở / gói chưa đủ tháng / hết lượt / khách đã dùng hết lượt). Mức giảm **không vượt tiền thuê** (không giảm vào cọc). Mã + số tiền giảm **chốt trên đơn lúc tạo** (`reservations.voucher_code`, `voucher_discount`); VNPAY trừ đúng số đã chốt. Lượt dùng cộng khi **cọc thành công**; đơn `PENDING` còn trong 15 phút giữ chỗ được tính là đang giữ lượt; **huỷ đơn không trả lại lượt**. Chỉ áp **lúc đặt kho** — không áp cho gia hạn, trả nợ. Huỷ đơn thì hoàn theo số tiền khách **thực trả** (đã trừ voucher). API `GET /vouchers/validate`, `/bom/vouchers`. |
| BR-133 | *(05/11/2026, D-15)* **Voucher theo loại kho**: BOM chọn thêm **loại kho áp dụng** khi tạo / sửa voucher (`vouchers.unit_type_id`, trống = mọi loại kho). Đơn đặt loại kho khác → 400 `VOUCHER_INVALID` "Mã voucher không áp dụng cho loại kho này". Bảng voucher của BOM hiện cột loại kho. |
| ~~BR-26~~ | ~~Giữ đơn 10 phút~~ → **PR-B6, PR-B7** |
| BR-27 | IPN: kiểm tra chữ ký HMAC, khớp số tiền, mỗi giao dịch chỉ xử lý 1 lần (khoá dòng). |
| ~~BR-28~~ | ~~VNPAY lỗi → huỷ đơn ngay~~ → **PR-B8**. (VNPAY OK → giao dịch `SUCCESS`, đơn `DEPOSIT_PAID` vẫn giữ.) |
| BR-102 | **Điều khoản xử lý tài sản**: khách bắt buộc tick đồng ý khi đặt, thiếu → 400 `TERMS_NOT_ACCEPTED`. Lưu `reservations.terms_version` (hiện là `v4` — từ 05/11/2026; `v3` từ 04/11) + `terms_accepted_at`. *(29/10/2026, #97)* Khách xem lại bản điều khoản mình đã đồng ý ở "Kho của tôi" / trang hợp đồng; đơn cũ chưa đồng ý hiện ghi chú "hợp đồng tạo trước khi có điều khoản". Nội dung điều khoản: PR-Q10. |
| BR-131 | *(05/11/2026, D-15)* **Khai báo loại hàng khi đặt kho**: dropdown chọn nhiều loại từ danh mục `goods_categories` do **BOM quản lý** (màn `/bom/goods-categories`: thêm, sửa, ngừng / mở lại; không xoá). Mặc định 7 loại: Gia dụng · Văn phòng phẩm · **Thực phẩm** (chỉ kho lạnh / kho đông) · Quần áo · Nội thất · Điện tử · **Khác** (bắt buộc mô tả). Bắt buộc ≥ 1 loại → thiếu 400 `GOODS_CATEGORY_REQUIRED`; mã không tồn tại / đã ngừng → 400 `INVALID_GOODS_CATEGORY`; loại cần kho lạnh mà loại kho là `NORMAL` → 400 `GOODS_REQUIRES_COLD_STORAGE` (FE khoá sẵn lựa chọn); chọn "Khác" mà mô tả < 3 ký tự → 400 `GOODS_DESCRIPTION_REQUIRED`. Lưu `reservations.goods_category_codes` (mã, ngăn bởi dấu phẩy) + `goods_description` (≤ 500 ký tự). Loại kho có thêm thuộc tính **nhiệt độ** `unit_types.temperature_class` = `NORMAL` / `COLD` / `FROZEN` (BOM chọn ở bảng giá; sai giá trị → 400 `INVALID_INPUT`), hiện trên trang đặt kho. Trang đặt kho (05/11) đưa **ngày nhận kho lên đầu**, sau đó mới tới thông tin ô, gói thuê, loại hàng, thông tin khách. API `GET /goods-categories` (công khai), `/bom/goods-categories`. |
| BR-103 | *(29/10/2026, #96)* IPN thành công lưu **mã giao dịch ngân hàng** vào `payment_transactions.bank_transaction_code`: `vnp_BankTranNo`, không có thì `vnp_TransactionNo`. Áp dụng cho cọc, gia hạn, trả nợ; BOM thấy mã này trong danh sách đối soát (UC-29). |
| BR-120 | *(02/11/2026)* **Phiếu biên nhận đặt kho**: nút "Tải phiếu biên nhận" ở trang xác nhận thanh toán mở bản in (khách in hoặc "Lưu thành PDF") gồm mã đơn, mã giao dịch VNPAY + mã ngân hàng, thời điểm thanh toán, khách, cơ sở, loại kho, ngày nhận, số tháng, tiền thuê, cọc, voucher, tổng đã trả. Email "Đặt cọc thành công" (BR-117) gửi kèm các thông tin chính. |

**Đã chốt**
| Mã | Rule |
|---|---|
| PR-B1 | Tạo đơn **tính lại số suất (BR-11) trong transaction có khoá** theo cơ sở + loại kho (sửa L-13). *(27/10/2026)* Số suất cộng thêm các ô **sắp trống** có ngày giao ≤ ngày nhận kho của đơn (PR-R11). Hết → 409 `NO_AVAILABILITY`, message báo **ngày nhận kho sớm nhất** nếu có ô sắp trống. |
| PR-B2 | ⬜ Mỗi khách tối đa **1 đơn `PENDING`** → 409 `PENDING_EXISTS`. *(chưa code — L-28)* |
| PR-B3 | Chỉ `CUSTOMER` `ACTIVE` được đặt; cơ sở và loại kho phải `ACTIVE`. Khách có hợp đồng `OVERDUE` hoặc còn nợ → PR-Q12. Khách lấy từ token, không nhận `customerId` từ FE (L-22 đã sửa). |
| PR-B4 | ⚠️ Ngày bắt đầu: **từ ngày mai đến tối đa 30 ngày tới** (FE + BE). *Hiện: FE từ ngày mai (hoặc ngày ô sắp trống được giao — PR-R11), BE vẫn nhận hôm nay; cả hai chưa chặn 30 ngày — L-09.* |
| PR-B5 | *(sửa 30/10/2026, #101)* Họ tên, email lấy từ tài khoản (chỉ đọc). **SĐT và CCCD** tự điền từ tài khoản, khách sửa được; **CCCD bắt buộc**. Khi tạo đơn, BE lưu SĐT / CCCD khách nhập vào `users.phone` / `users.cccd` (lần sau tự điền). ⚠️ Form vẫn còn ô địa chỉ bắt buộc nhưng không lưu đi đâu — cần bỏ (L-35). |
| PR-B6 | Đơn `PENDING` giữ suất **15 phút** (link VNPAY 10 phút + 5 phút đệm). IPN thành công về cho đơn đã hết hạn / huỷ → giao dịch vẫn `SUCCESS` + **tự tạo yêu cầu hoàn tiền** (PR-O12). (sửa L-15) |
| PR-B7 | Hết hạn → đơn **`EXPIRED`**, giao dịch `PENDING` → `FAILED`. (sửa L-08) |
| PR-B8 | VNPAY lỗi / khách huỷ trên VNPAY → **đơn giữ `PENDING`**, nút **"Thanh toán lại"** (link mới, giao dịch cũ `FAILED`) đến hết 15 phút. Muốn bỏ thì huỷ đơn (UC-15). |
| ~~PR-B9~~ | ~~Gỡ voucher ở FE + BE~~ → bỏ, giữ voucher theo D-06 (01/11/2026); công thức tổng trả xem BR-24. |
| PR-B10 | Giờ nhận kho mặc định **09:00 ngày bắt đầu**, ghi vào `expected_appointment_time` lúc tạo đơn; dùng chung cho mốc phí huỷ và hạn task check-in. |
| PR-M6 | Cọc = giá niêm yết × `deposit_month_multiplier` của chính sách hiện hành lúc đặt; lưu vào `reservations.deposit_amount`, không đổi về sau. |

### UC-12 Đơn đặt chỗ của tôi ✅
| Mã | Rule |
|---|---|
| BR-12 | Khách xem đơn của mình, mới nhất trước; mỗi đơn hiện "đã thanh toán thực tế" = Σ giao dịch `SUCCESS` (`DEPOSIT` + `MONTHLY_RENT`) và ngày kết thúc hợp đồng (nếu có). |
| — | Đơn `PENDING`, `DEPOSIT_PAID` hiện "Huỷ"; đơn `UNIT_ASSIGNED` chỉ hiện "Huỷ" khi hợp đồng còn `PENDING_CHECK_IN`. |

### UC-15 Huỷ đơn đặt chỗ ✅
**Đang chạy** (`ReservationService.previewCancel / cancelReservation`, `CancelReservationModal.jsx`)
| Mã | Rule |
|---|---|
| BR-30 | Khách được huỷ trước khi check-in: `PENDING`, `DEPOSIT_PAID`, hoặc `UNIT_ASSIGNED` khi hợp đồng còn `PENDING_CHECK_IN`. Nếu đã gán ô: hợp đồng → `TERMINATED`, task `CHECK_IN` → `CANCELLED`, ô → `AVAILABLE`. Sau check-in phải dùng luồng trả kho. |
| BR-31 | Mốc tính phí = `expected_appointment_time`, trống → 09:00 ngày bắt đầu (PR-B10 làm cho luôn có giá trị). |
| BR-32 | Quy tắc cố định toàn hệ thống: còn **≥48h** → hoàn 100%; còn **≥24h và <48h** → giữ 50% cọc; còn **<24h hoặc đã qua giờ hẹn nhưng chưa check-in** → giữ 100% cọc. Tiền hoàn = tổng `SUCCESS` (`DEPOSIT` + `MONTHLY_RENT`) − phần cọc bị giữ, không âm. Đúng 48h thuộc hoàn đủ; đúng 24h thuộc giữ 50% cọc. |
| BR-32a | Ân hạn đơn đặt sát giờ: nếu thanh toán thành công khi còn **<48h** tới check-in, khách hủy trong **≤30 phút** sau thanh toán và vẫn trước giờ check-in → hoàn 100%. Thanh toán đúng 48h không thuộc ân hạn này. |
| BR-33 | Lý do: 4 lý do có sẵn hoặc "Lý do khác" (bắt buộc nhập). Khoản hoàn > 0 bắt buộc có cách nhận tiền hợp lệ; UI khách hiện dùng chuyển khoản và yêu cầu đủ ngân hàng, STK 6–20 chữ số, tên chủ tài khoản. |
| BR-34 | Khi xác nhận huỷ, backend tính một lần và lưu `cancelled_at`, `cancellation_tier`, `cancellation_penalty_amount`, `cancellation_refund_amount`; tạo đúng 1 giao dịch `REFUND/PENDING` (`paid_at = NULL`) và task `REFUND` chỉ khi số hoàn > 0. FM **không tính/chỉnh lại tiền cọc**, chỉ hoàn đúng số đã chốt, tải bằng chứng và xác nhận; khi đó giao dịch → `SUCCESS`, đơn → `REFUNDED`. Không có tiền cần hoàn → `CANCELLED`, không sinh task/giao dịch REFUND. |
| BR-35 | Mọi lần huỷ ghi `activity_logs`. |

**Đã chốt**
| Mã | Rule |
|---|---|
| PR-15 | Mốc hủy 48h / 24h / 30 phút và tỷ lệ giữ cọc 50% / 100% là **quy tắc cố định toàn hệ thống**; BOM và FM không chỉnh theo cơ sở. Hai cột cũ `cancel_free_hours`, `cancel_fee_percent` chỉ giữ để tương thích. |
| PR-M5 | Chính sách hủy dùng bộ tính tập trung `CancellationPolicyService` và đóng băng kết quả tại thời điểm khách xác nhận; không đọc lại chính sách khi FM hoàn tiền. |
| PR-O12 | Đơn đã thanh toán khi huỷ → task `REFUND` cho FM (BR-34), FM hoàn theo PR-O12 (có bằng chứng). |
| PR-R12 | (27/10/2026) Đơn `DEPOSIT_PAID` **đã tới ngày nhận kho mà cơ sở chưa gán được ô** (ô sắp trống khách cũ chưa trả — PR-R11) → lỗi cơ sở: khách huỷ được **hoàn 100%**, không tính `cancel_fee_percent`. FM vẫn có thể gán ô khác cùng loại nếu có ô `AVAILABLE`. |

### UC-13 / UC-14 Duyệt đơn & gán ô ✅
| Mã | Rule |
|---|---|
| BR-40 | FM thấy đơn `DEPOSIT_PAID`, chưa có ô, **thuộc cơ sở mình**. ~~Cũ nhất trước~~ → *(04/11/2026)* xếp theo **BR-123**. Chưa gán cơ sở → lỗi. |
| BR-123 | *(04/11/2026, D-13)* **Ưu tiên khách cũ + hợp đồng dài khi gán ô**: điểm ưu tiên = gói (12T: 3 · 6T: 2 · 3T: 1 · 1T: 0) + khách cũ (đã nhận kho ≥ 1 hợp đồng: +2; ≥ 3 hợp đồng: +3). "Đã nhận kho" = có biên bản `CHECK_IN` (No-Show không tính). Danh sách đơn chờ gán ô xếp điểm cao trước; cùng điểm thì **ngày nhận kho gần hơn** trước, rồi đơn cọc trước. Mỗi đơn hiện nhãn "Ưu tiên · Khách cũ (n HĐ) · Gói 12 tháng". Chỉ đổi **thứ tự xử lý** của FM — không giữ / chặn suất của ai (đơn đã cọc đều đã giữ suất, BR-11). |
| BR-122 | *(04/11/2026, D-13)* **FM chuyển hợp đồng sang ô khác** (không gắn cứng khách với 1 ô): hợp đồng `PENDING_CHECK_IN` / `ACTIVE` / `TERMINATION_PENDING` (quá hạn phải xử lý quá hạn trước → 409 `CONTRACT_NOT_TRANSFERABLE`); ô mới **cùng cơ sở + cùng loại** (khác loại → 400 `UNIT_TYPE_MISMATCH`, để giá thuê / cọc / phí không đổi) và `AVAILABLE` (chiếm bằng UPDATE có điều kiện, trùng → 409 `UNIT_NOT_AVAILABLE`). Lý do: `FACILITY_ISSUE` (ô có sự cố do cơ sở — ô cũ **bắt buộc** vào bảo trì, cơ sở hỗ trợ chuyển hàng miễn phí) · `CUSTOMER_REQUEST` · `REARRANGE` (vd sắp xếp lại lúc gia hạn) + mô tả 10–500 ký tự. Ô cũ → `AVAILABLE`, hoặc `MAINTENANCE` kèm ghi chú (PR-M9; không làm âm số suất — 409 `SLOT_IN_USE`). 1 transaction: đổi ô của hợp đồng + đơn, lưu `unit_transfers`, log `[UNIT_TRANSFER]`, thông báo + email cho khách (vị trí ô mới, lý do). **PIN, ngày hết hạn, tiền không đổi.** Khách và FM xem **lịch sử chuyển ô** ở trang hợp đồng. API `GET /contracts/{id}/transfer-options`, `POST /contracts/{id}/transfer-unit`, `GET /contracts/{id}/unit-transfers`. |
| BR-41 | Gợi ý ô `AVAILABLE` cùng cơ sở, **cùng loại** (hết thì không gợi ý ô khác loại — D-02). |
| BR-42 | Gán ô khi đơn `DEPOSIT_PAID` và ô `AVAILABLE` — **phải đúng loại & đúng cơ sở của đơn**; chiếm ô bằng UPDATE có điều kiện để hai FM không gán trùng. 1 transaction: ô `OCCUPIED`; đơn `UNIT_ASSIGNED`; hợp đồng `HD-xxxxxx` `PENDING_CHECK_IN`; sinh task `CHECK_IN`; thông báo cho khách (BR-111). |
| BR-43 | Hợp đồng: start = ngày bắt đầu đơn; end = start + số tháng; `deposit_held_amount` = cọc; gắn **chính sách đang hiệu lực của cơ sở**. |
| BR-110 | *(30/10/2026, #100)* **Chọn ô trên sơ đồ mặt bằng** trong modal gán ô: chỉ các ô gán được theo BR-41 bấm được, ô khác làm mờ; tự mở tầng có ô gán được; ô chưa đặt lên mặt bằng vẫn chọn được ở danh sách; không tải được mặt bằng thì chỉ dùng danh sách. Mặt bằng chỉ hỗ trợ chọn — điều kiện gán vẫn là BR-42. |
| BR-119 | *(02/11/2026)* **Xem chi tiết đơn trước khi gán ô**: nút "Chi tiết" ở danh sách đơn chờ gán mở panel gồm khách (tên, SĐT, email, **CCCD che giữa** `079******123`, ngày tạo tài khoản, số HĐ đã kết thúc / đang thuê, **khoản nợ còn lại** nếu có), loại kho + giá niêm yết, ngày + giờ hẹn nhận, số tháng, tiền thuê (% ưu đãi), cọc, voucher, tổng đã trả, mã giao dịch VNPAY + ngân hàng, thời điểm cọc, phiên bản điều khoản đã đồng ý. Có nút "Gán ô kho" ngay trong panel. Chỉ FM của đúng cơ sở (OwnershipGuard). API `GET /reservations/{id}/manager-detail`. |

### EX-03 Khách không đến nhận kho (No-Show) & dời lịch ✅
**Đang chạy** (`ReservationService.handleNoShow / rescheduleReservation`, `NoShowModal.jsx`, `RescheduleModal.jsx`)
| Mã | Rule |
|---|---|
| BR-50 | Danh sách No-Show: đơn đã gán ô của cơ sở mà **ngày bắt đầu đã qua** (task check-in đã `OVERDUE`). |
| BR-51 | No-Show (đơn `DEPOSIT_PAID`/`UNIT_ASSIGNED`): đơn `CANCELLED`; ô `AVAILABLE`; hợp đồng `TERMINATED`; huỷ task `CHECK_IN`; ghi log kèm lý do. Tiền xử lý theo PR-X1; còn tiền phải hoàn → task `REFUND`, hoàn xong đơn `REFUNDED`. |
| BR-52 | Dời lịch (gọi được khách): ngày mới không ở quá khứ; đơn `DEPOSIT_PAID`/`UNIT_ASSIGNED`; cập nhật start/end hợp đồng (giữ số tháng); dời hạn task `CHECK_IN`, task `OVERDUE` được mở lại. |
| BR-53 | (#52) **Báo cáo liên hệ**: Staff cùng cơ sở ghi kết quả cuộc gọi + ghi chú trên task `CHECK_IN` quá hạn → lưu vào `note` của task (ghi đè lần trước) và `activity_logs` (`target_entity = 'facility_tasks'`); task chưa ai nhận thì gán cho Staff báo cáo. FM xem báo cáo để quyết định dời lịch / No-Show. |

**Đã chốt**
| Mã | Rule |
|---|---|
| PR-X1 | (D-07) No-Show: **tịch thu 100% cọc, hoàn toàn bộ tiền thuê** (tạo `REFUND` → PR-O12). FM chọn **"Miễn phạt"** (bắt buộc lý do) → hoàn cả cọc. FE hiện số tiền hoàn trước khi xác nhận. |
| PR-X2 | API No-Show tự kiểm tra ngày bắt đầu đã qua (L-10). Log ghi **người thao tác là FM** (PR-A8). |
| PR-X3 | **Điều kiện bấm No-Show**: có **≥ 2 báo cáo liên hệ thất bại** (BR-53) **cách nhau ≥ 24h**, **và** đã qua **48h** kể từ giờ hẹn (`expected_appointment_time`). Chưa đủ → nút No-Show bị khoá, BE trả 409 `NO_SHOW_NOT_ALLOWED_YET`. Số lần liên hệ đếm từ `activity_logs` của task (mã nghiệp vụ `[CONTACT]` — PR-A10), không dựa vào `note` vì `note` bị ghi đè. Trong thời gian chờ, ô vẫn giữ cho khách; liên hệ được thì dời lịch (BR-52). |
| PR-C3 | Đây là **lối duy nhất** xử lý task `CHECK_IN` quá hạn (không có nút "hoàn thành task quá hạn"). |

### UC-16 / UC-17 Bảng công việc & nhận việc ✅
| Mã | Rule |
|---|---|
| BR-60 | Task sinh tự động (`CHECK_IN`, `CHECK_OUT`, `SUPPORT`). Mỗi hợp đồng chỉ có **1 task `CHECK_IN`/`CHECK_OUT` đang mở cùng loại**. |
| BR-61 | `due_at` = **21:00 ngày hẹn**; mốc đã qua → 21:00 hôm nay (trước 21h) hoặc hôm sau. |
| BR-62 | Job mỗi phút: task `OPEN`/`IN_PROGRESS` quá hạn → `OVERDUE`. |
| BR-63 | Staff + FM **cùng cơ sở** xem bảng; lọc trạng thái, loại, "Việc của tôi", tìm kiếm. |
| BR-64 | Chỉ **STAFF cùng cơ sở** nhận task `OPEN` chưa quá hạn; ai bấm trước người đó nhận; không tự trả việc. |
| BR-65 | Chỉ **FM cùng cơ sở** gỡ người nhận của task `IN_PROGRESS` → `OPEN`. |
| PR-C6 | ⬜ Staff chỉ nhận task có hạn **trong 3 ngày tới** → 409 `TASK_TOO_FAR`. *(chưa code — L-29)* |
| — | *(26/10/2026)* FM **giao việc**: task `CHECK_IN` / `CHECK_OUT` / `SUPPORT` / `MAINTENANCE` chưa quá hạn, chỉ cho Staff `ACTIVE` cùng cơ sở (khác → 400 `INVALID_STAFF` / `STAFF_INACTIVE`); giao lại = đổi người (trùng người → 409 `TASK_ALREADY_ASSIGNED`); task `REFUND` là việc của FM, không giao. Log `[TASK_ASSIGN]`, thông báo cho Staff được giao (BR-111). |
| PR-34 | Task `SUPPORT` khẩn (PR-S1) nổi lên đầu bảng. |

### UC-18 Check-in & biên bản bàn giao ✅
**Đang chạy** (`StaffTaskService.checkIn`, `StaffTaskDetailPage.jsx`)
| Mã | Rule |
|---|---|
| BR-70 | Chỉ Staff **đang giữ** task `CHECK_IN` `IN_PROGRESS`, chưa quá hạn, hợp đồng `PENDING_CHECK_IN`. |
| BR-71 | Checklist bắt buộc đủ **6 mục**: xác minh danh tính, ô trống, ô sạch, khoá nguyên vẹn, khách xác nhận ký, **đã kiểm tra hàng mang vào** (PR-C7 / BR-132, thêm 05/11/2026). |
| BR-72 | PIN đúng 6 chữ số do BE gợi ý ("Sinh lại"); RFID bắt buộc, ≤ 50 ký tự; ghi chú ≤ 1000 ký tự. |
| BR-73 | PIN và RFID không trùng với hợp đồng `ACTIVE` / `OVERDUE` / `TERMINATION_PENDING`. |
| BR-74 | 1 transaction: biên bản `CHECK_IN`; hợp đồng `ACTIVE` + PIN + RFID; task `COMPLETED`; log. Không đổi start/end. |
| BR-121 | *(04/11/2026, D-13)* **Ảnh hiện trạng ô trong biên bản**: check-in (UC-18), nghiệm thu trả kho (UC-23) và check-in online (BR-124) bắt buộc **1–10 ảnh** (thiếu → 400 `HANDOVER_PHOTO_REQUIRED`), lưu `handover_records.evidence_image_urls`. Hư hỏng của ô được xác định bằng cách **đối chiếu ảnh lúc nhận với ảnh lúc trả** — không có trong ảnh lúc nhận mà có lúc trả thì là phát sinh trong thời gian thuê. Khách xem lại mọi biên bản + ảnh ở trang hợp đồng; FM xem ở chi tiết hợp đồng (`GET /contracts/{id}/handover-records`). Nút "Giả lập hoàn thiện" thêm 1 ảnh mẫu. Biên bản cũ (trước 04/11) không có ảnh. |
| BR-124 | *(04/11/2026, D-13)* **Check-in online** (khách tự nhận kho, không cần Staff): hợp đồng `PENDING_CHECK_IN` của chính khách; từ **ngày hẹn**, trước 21:00 (cùng mốc PR-C1; sớm → 409 `CHECK_IN_TOO_EARLY`, task đã quá hạn → 409 `TASK_OVERDUE`, FM dời lịch). Xác minh danh tính = **CCCD nhập khớp CCCD đã lưu** (sai → 400 `IDENTITY_MISMATCH`; tài khoản chưa có CCCD → 409 `IDENTITY_MISSING`, nhận tại quầy). Khách tự tick: ô trống, ô sạch, khoá nguyên vẹn, **cam kết không lưu hàng cấm** — ô không đạt thì **không được tự nhận** (400 `CHECKLIST_INCOMPLETE`), báo nhân viên để đổi ô; ảnh hiện trạng theo BR-121. 1 transaction: task `CHECK_IN` `COMPLETED` (ghi chú "Khách tự check-in online", kể cả khi Staff đang giữ task); biên bản `CHECK_IN` với `check_in_method = ONLINE`, `staff_id` NULL; hợp đồng `ACTIVE` + PIN (không cấp RFID — cần thẻ thì nhận tại quầy); log `[CHECK_IN_ONLINE]`; thông báo khách (+ email, không gửi PIN), FM, Staff đang giữ task. 🔸 Chưa xác minh khách có mặt tại cơ sở (không GPS / QR tại ô) — ảnh hiện trạng là căn cứ. API `POST /contracts/{id}/online-check-in`. |
| BR-132 | *(05/11/2026, D-15 — đóng L-26)* **Kiểm tra hàng lúc check-in**: màn check-in của Staff hiện **loại hàng + mô tả khách khai báo** (BR-131); mục 6 "Đã kiểm tra hàng mang vào — khớp loại đã khai báo, không có chất dễ cháy nổ / hàng cấm" bắt buộc tick, thiếu → 400 `GOODS_CHECK_REQUIRED` (không bàn giao ô). Lưu `handover_records.is_prohibited_goods_committed = 1`; check-in online (BR-124) ghi = 1 vì khách đã tick cam kết. Biên bản cũ (trước 05/11) không có mục này thì không hiện. Nút "Giả lập hoàn thiện" tick cả mục 6. |

**Đã chốt**
| Mã | Rule |
|---|---|
| PR-C1 | Chỉ check-in **trong ngày hẹn** (trước 21:00). Khách muốn nhận sớm → FM dời lịch trước. Sớm → 409 `CHECK_IN_TOO_EARLY`. (sửa L-17) |
| PR-C2 | Chi tiết task hiện **họ tên + SĐT + CCCD**; "xác minh danh tính" = CCCD khớp CCCD đã lưu (PR-B5). |
| PR-C4 | Giữ nút **"Giả lập hoàn thiện"** (sản phẩm môn học). |
| PR-C5 | ⚠️ Chỉ khách **chủ hợp đồng** xem PIN/RFID; Staff/FM không thấy sau check-in. *(Hiện API chi tiết task vẫn trả PIN / RFID cho Staff / FM — L-30.)* |
| PR-C7 | ✅ *(code 05/11/2026 — BR-132)* **Mục 6 checklist — kiểm tra hàng / cam kết hàng cấm**: "Khách đã ký cam kết không lưu trữ chất cháy nổ (xăng, gas, pháo…), vũ khí, hoá chất độc hại, động vật sống, chất dễ phân huỷ / bốc mùi và hàng cấm theo quy định pháp luật" + Staff đối chiếu hàng với loại đã khai báo. Bắt buộc tick; lưu `handover_records.is_prohibited_goods_committed`; nút "Giả lập hoàn thiện" tick cả mục này. Checkbox "đồng ý cam kết" lúc đặt chỗ (UC-10) ghi rõ cùng nội dung này. |

### UC-19 Hợp đồng của tôi ✅
| Mã | Rule |
|---|---|
| BR-80 | "Tổng đã đóng" = Σ `SUCCESS` (`DEPOSIT` + `MONTHLY_RENT`); "tiền thuê đã đóng" = tổng − cọc đang giữ. Hiện PIN/RFID cho khách. |
| — | Hợp đồng `PENDING_CHECK_IN`: chưa có nút gia hạn / trả kho. `OVERDUE`: hiện "PIN đã khoá", số ngày quá hạn, phí trễ (PR-Q5). `LIQUIDATED` / `TERMINATED`: ẩn nút tuỳ chọn (PR-R1). |

### UC-20 Lịch sử & khoản phải thanh toán ✅ (đổi phạm vi)
**Đang chạy** (`CustomerPaymentService`, `VnpayService.createDebtPayment`, trang `/thanh-toan`)
| Mã | Rule |
|---|---|
| PR-50 | (D-01) Không thu hằng tháng → "Pay Monthly Rent" trùng UC-21. UC-20 đổi thành: xem **mọi giao dịch** của khách (cọc, thuê, gia hạn, phí trễ, phí sự cố, phí chiếm dụng / lưu giữ, hoàn tiền) + **trả các khoản nợ** phát sinh (`DAMAGE_FEE` vượt cọc — PR-O9; `OVERSTAY_FEE` vượt cọc — PR-Q14) qua VNPAY. Mục "Hợp đồng quá hạn" hiện cả phí chiếm dụng đang tăng theo ngày. Trả nợ dùng lại chính dòng nợ (đổi mã giao dịch, không tạo dòng mới); chỉ trả nợ của mình (403); khoản đã trả → 409; khách huỷ trên VNPAY → nợ vẫn `PENDING`; IPN thành công → `SUCCESS` + log `[DEBT_PAID]`, hết nợ thì đặt kho lại được. |

### UC-21 Gia hạn hợp đồng ✅
**Đang chạy** (`VnpayService.createRenewal / settleRenewal`, `ContractOptionsModal.jsx`)
| Mã | Rule |
|---|---|
| BR-81 | Gói +1 / +3 / +6 / +12 tháng; giá = **giá niêm yết hiện tại** × số tháng × (1 − ưu đãi 0/0/5/10%) (D-08). |
| BR-82 | Còn hạn → nối tiếp `end_date`; đã qua `end_date` → **tính từ hôm nay** (PR-R3). |
| BR-83 | Gia hạn khi `OVERDUE`/`TERMINATION_PENDING` → hợp đồng `ACTIVE`, đơn `UNIT_ASSIGNED`, huỷ task `CHECK_OUT`. |

**Đã chốt**
| Mã | Rule |
|---|---|
| PR-R1 | Chỉ gia hạn khi `ACTIVE` / `TERMINATION_PENDING` / `OVERDUE` → khác 409 `CONTRACT_NOT_RENEWABLE`. FE ẩn tab Gia hạn tương ứng. (sửa L-23) |
| PR-R2 | BE chỉ nhận **1 / 3 / 6 / 12**; số tháng lưu tường minh, không cắt từ mã giao dịch. (sửa L-20) |
| PR-R3 | Giữ BR-82: ngày quá hạn trước đó không nằm trong kỳ mới → thu bằng **phí trễ + phí chiếm dụng** (PR-Q6, PR-Q14). Gia hạn khi đang trong ân hạn của `TERMINATION_PENDING`: kỳ mới tính từ hôm nay, các ngày ân hạn đã qua (từ ngày 2) tính theo PR-O14 và cộng vào lần thanh toán gia hạn. |
| PR-R4 | Giá = giá niêm yết hiện tại (PR-12). ⬜ FE báo nếu giá đã đổi so với lúc ký *(chưa làm — L-33)*. |
| PR-R5 | Mỗi hợp đồng **1 giao dịch gia hạn `PENDING`**; link mới → giao dịch cũ `FAILED`; IPN về muộn của giao dịch cũ → `SUCCESS` + yêu cầu hoàn tiền (PR-O12). |
| PR-R6 | **Xoá** `POST /contracts/{id}/renew` — chỉ gia hạn qua VNPAY. (sửa L-02) |
| PR-R7 | Gia hạn khi `TERMINATION_PENDING` → huỷ task trả kho, bỏ thông tin hoàn cọc, báo "Yêu cầu trả kho đã được huỷ". |
| PR-R8 | Trang hợp đồng đọc đúng `vnpResponse` + `orderId`, hỏi trạng thái giao dịch rồi hiện toast. (sửa L-19) |
| PR-R9 | Còn ≤ 7 ngày đến `end_date` → banner nhắc ở "Kho của tôi", trang hợp đồng và dashboard FM. *(27/10/2026: banner trang hợp đồng ghi rõ hạn chót gia hạn ưu tiên của PR-R10.)* *(02/11/2026)* **Job nhắc gia hạn** 08:00 hằng ngày → thông báo trong chuông + email (BR-117), nội dung ghi hạn chót gia hạn ưu tiên (PR-R10); mỗi mốc gửi 1 lần cho mỗi kỳ (`ref_key` `RENEWAL:{hợp đồng}:{end_date}:{mốc}`, gia hạn xong nhắc lại từ đầu); lỡ ngày chạy vẫn gửi mốc gần nhất. *(sửa 05/11/2026, D-15)* Mốc nhắc: còn **15 / 10 / 7 / 3 / 1 ngày** (trước đây 7 / 3 / 1; còn 12 ngày → mốc 15, còn 8 → mốc 10, còn 5 → mốc 7); với điều khoản v4 nội dung nhắc thêm câu "hết hạn không gia hạn / không trả kho, hàng sẽ được chuyển vào kho tổng và tính phí lưu giữ". Hợp đồng đã hẹn trả kho không nhắc. Demo: nút giả lập "Còn 15 / 3 ngày hết hạn" (BR-115, tối đa 15 ngày). |
| PR-Q6 | Gia hạn hợp đồng `OVERDUE`: 1 lần VNPAY = **phí trễ + phí chiếm dụng + tiền kỳ mới** → ghi giao dịch `MONTHLY_RENT` + `LATE_FEE` (mã `LF…`) + `OVERSTAY_FEE` (mã `OS…`); IPN đối soát tổng cả nhóm; PIN mở lại. |
| PR-R10 | (27/10/2026, D-12) **Gia hạn báo trước 3 ngày**: hạn chót gia hạn ưu tiên = **hết ngày `end_date` − 3**. Trước mốc: gia hạn tự do. Sau mốc (còn < 3 ngày, ngày cuối, đã hẹn trả kho `TERMINATION_PENDING`, hoặc đã `OVERDUE`) → **cửa sổ muộn**: chỉ gia hạn được khi ô **chưa có ai đặt trước** (PR-R11), ngược lại 409 `RENEWAL_UNIT_RESERVED` (kiểm tra lại ngay trước khi tạo link VNPAY, sau khi khoá hợp đồng). Màn gia hạn hiện: hạn chót + số ngày còn lại, hạn mới của từng gói 1/3/6/12, banner cửa sổ muộn; bị chặn thì khoá nút thanh toán và gợi ý "Hẹn trả kho". API `GET /contracts/{id}/renewal-eligibility`. |
| PR-R11 | (27/10/2026, D-12) **Ô "sắp trống"**: ô `OCCUPIED` của hợp đồng đang ở cửa sổ muộn (PR-R10) được tính là suất cho **đơn đặt mới cùng cơ sở + loại kho có ngày nhận kho ≥ ngày giao ô**. Ngày giao ô (ước tính an toàn): `ACTIVE` (qua mốc, chưa hẹn trả) → `end_date` + 6 (khách còn quyền hẹn tới `end_date` + 5, PR-O1); *(sửa 02/11/2026)* `TERMINATION_PENDING` → **ngày hẹn trả + 1** (khách hẹn trả sớm thì ô mở bán sớm, không còn "giam" ô 5 ngày; khách chỉ được dời lịch sớm hơn nên ngày này không lùi ra sau); `OVERDUE` → `end_date` + `liquidation_days` + 2 (thanh lý + 1 ngày dọn ô). Không đổi dữ liệu nào trong DB — chỉ là cách đếm suất (BR-11, PR-B1). Ô **đã có người cần** khi: số đơn đang giữ suất > ô `AVAILABLE` + các ô sắp trống **khác** → khách cũ không gia hạn được. Ô chỉ thật sự gán khi khách cũ trả kho / bị thanh lý xong (UC-14 như cũ). ⚠️ Giới hạn: khoảng ~15 phút giữa lúc khách cũ tạo link VNPAY và lúc IPN về, ô vẫn được tính sắp trống — nếu trùng, đơn mới xử lý theo PR-R12. |
| PR-R11a | *(05/11/2026, D-15)* **Ngày ô sắp trống được giao** cho đơn mới: hợp đồng đã hẹn trả kho → ngày sau ngày hẹn (không còn + 5 ân hạn); hợp đồng điều khoản **v4** không gia hạn → **`end_date` + 2** (ngày + 1 job thanh lý và chuyển hàng vào kho tổng); điều khoản cũ → `end_date` + `liquidation_days` + 2 như trước. |

### UC-22 Yêu cầu trả kho ✅
**Đang chạy** (`ContractService.requestCheckout`)
| Mã | Rule |
|---|---|
| BR-84 | Hợp đồng `ACTIVE`/`OVERDUE`. Ngày hẹn mặc định `end_date`. Hợp đồng + đơn → `TERMINATION_PENDING`; sinh task `CHECK_OUT` (ghi chú chứa thông tin hoàn cọc). PIN vẫn dùng được để dọn đồ. |

**Đã chốt**
| Mã | Rule |
|---|---|
| PR-O1 | *(sửa 05/11/2026, D-15 — bỏ ân hạn)* Ngày hẹn: **từ ngày mai đến hết `end_date`** (~~đến `end_date` + 5 ngày ân hạn~~); hẹn sau `end_date` → 400 "Muốn dùng kho lâu hơn vui lòng gia hạn". Hợp đồng `OVERDUE` (chỉ còn với điều khoản cũ) → hẹn trong **3 ngày tới** (từ ngày mai). Kiểm tra cả FE + BE, "hôm nay" tính theo giờ Việt Nam. (sửa L-09; *02/11/2026* sửa L-36.) Dời lịch (`TERMINATION_PENDING`) chỉ được **sớm hơn** ngày đã hẹn. |
| PR-O14 | ~~(D-11) **Phí ân hạn**: ngày `end_date` + 1 miễn phí; ngày + 2 → + 5 tính tiền thuê theo ngày.~~ → **Bỏ 05/11/2026 (D-15)** cùng với ân hạn. Hẹn trả mà không tới thì hôm sau `end_date` hợp đồng thành `OVERDUE` (PR-Q1) và tính phí trễ PR-Q3 + phí chiếm dụng PR-Q14; điều khoản v4 thì thanh lý + chuyển kho tổng ngay (BR-134). Hợp đồng cũ đang `TERMINATION_PENDING` với ngày hẹn sau `end_date` (đặt trước 05/11) vẫn được nghiệm thu và tính phí theo ngày thực tế như cũ. |
| PR-O2 | (D-10) **Trả sớm** (ngày hẹn < `end_date`) được hoàn tiền thuê theo công thức: **Hoàn tiền thuê = tiền thuê kỳ hiện tại đã trả − (số tháng đã dùng, làm tròn lên × giá niêm yết lúc ký, *không* ưu đãi) − phí phá hợp đồng (1 tháng giá niêm yết lúc ký)**, tối thiểu 0. "Số tháng đã dùng" tính từ ngày bắt đầu kỳ hiện tại đến ngày nghiệm thu. Cọc hoàn riêng theo PR-O11. FE hiện bảng tính dự kiến trước khi khách xác nhận. *Ví dụ*: gói 12T giá 1.850.000đ (ưu đãi 15% → đã trả 18.870.000đ), dùng 2 tháng → 18.870.000 − 2 × 1.850.000 − 1.850.000 = **13.320.000đ**. |
| PR-O2a | *(02/11/2026)* **Trả trong tháng cuối của kỳ** (số tháng đã dùng làm tròn lên = số tháng của kỳ): **không hoàn tiền thuê và không thu phí phá hợp đồng** — coi như trả đúng hạn, chỉ hoàn cọc (PR-O11). Bảng quyết toán ghi rõ "Trả trong tháng cuối". *Ví dụ*: gói 3T bắt đầu 01/01, trả 15/03 → đã dùng 3 tháng → hoàn tiền thuê 0, phí phá HĐ 0. |
| PR-O2b | *(02/11/2026)* **Trả quá sớm** so với thời hạn thuê: chỉ hẹn trả được sau khi đã nhận kho (hợp đồng `ACTIVE` / `OVERDUE`) — **chưa check-in thì dùng huỷ đơn (UC-15)**, không hẹn trả kho. Đã nhận kho thì áp đúng công thức PR-O2: dùng ít nhất **1 tháng** + **1 tháng phí phá HĐ**, số hoàn không âm. *Ví dụ*: gói 6T giá 1.850.000đ (ưu đãi 10% → đã trả 9.990.000đ), trả sau 4 ngày → 9.990.000 − 1.850.000 − 1.850.000 = **6.290.000đ**. |
| PR-O2c | *(02/11/2026)* **Kỳ hiện tại** = kỳ gia hạn gần nhất (bắt đầu = `end_date` − số tháng của lần gia hạn cuối); chưa gia hạn thì từ ngày bắt đầu hợp đồng. "Tiền thuê kỳ hiện tại đã trả" = số tiền lần gia hạn gần nhất (chưa gia hạn: tổng đã trả lúc đặt − cọc). |
| PR-O3 | Bắt buộc chọn cách nhận cọc: **chuyển khoản** (ngân hàng, số TK 6–20 chữ số, chủ TK) hoặc **tiền mặt tại quầy**; FE gửi `refundMethod` + đủ field. *(02/11/2026)* BE cũng kiểm tra — thiếu / sai → 400 `INVALID_REFUND_METHOD` (trước đó BE tự hiểu là tiền mặt khi thiếu số TK — L-37). (sửa L-18) |
| PR-O4 | Khách **huỷ yêu cầu trả kho** được trước ngày hẹn nếu chưa quá `end_date` → hợp đồng `ACTIVE`, đơn `UNIT_ASSIGNED`, task `CANCELLED`. |
| PR-O13 | Task `CHECK_OUT` `OVERDUE` → FM **dời ngày trả kho** (theo PR-O1) hoặc để nguyên; *(sửa 02/11/2026)* qua **ngày hẹn** mà khách không tới (và đã qua `end_date`) → hợp đồng `OVERDUE` (PR-Q1). |

### UC-23 Nghiệm thu trả kho ✅
**Đang chạy** (`StaffTaskService.checkOut / calculateCheckoutRefund`, `StaffTaskDetailPage.jsx`)
| Mã | Rule |
|---|---|
| PR-O5 | Staff đang giữ task `CHECK_OUT` `IN_PROGRESS`, **trong ngày hẹn** (như PR-C1), hợp đồng `TERMINATION_PENDING`. Có nút "Giả lập hoàn thiện". |
| PR-O6 | "Ô trống" + "Xác minh danh tính" **bắt buộc đạt** (không đạt → không nghiệm thu, hẹn lại). "Sạch" / "Khoá nguyên vẹn" được không đạt nhưng **bắt buộc lập sự cố** (UC-24, thiếu → `DAMAGE_REPORT_REQUIRED`). ⬜ Mục 6 (PR-C7) ở nghiệm thu đổi thành "Không phát hiện hàng cấm / chất nguy hiểm còn lại" — chưa có vì PR-C7 chưa code (L-26). |
| — | *(04/11/2026)* Biên bản nghiệm thu bắt buộc **ảnh hiện trạng ô lúc trả** (BR-121), đối chiếu với ảnh lúc nhận để quyết định sự cố là lỗi khách hay lỗi cơ sở (PR-O16). |
| PR-O7 | 1 transaction: biên bản `CHECK_OUT`; hợp đồng `TERMINATED`; đơn `COMPLETED`; **xoá PIN/RFID**; task `COMPLETED`; ô `AVAILABLE` (hoặc `MAINTENANCE` nếu có sự cố); tạo yêu cầu hoàn cọc (PR-O11); đóng ticket hỗ trợ còn mở (PR-S8); log. |

### UC-24 Ghi nhận sự cố hư hỏng ✅
| Mã | Rule |
|---|---|
| PR-O8 | Bảng `damage_cases`. 1 lần nghiệm thu có thể nhiều sự cố; mỗi sự cố có tiêu đề, mô tả, chi phí ≥ 0 do Staff nhập và **bắt buộc ≥ 1 ảnh bằng chứng** (thiếu → 400 `EVIDENCE_IMAGE_REQUIRED`; sai dữ liệu → 400 `INVALID_DAMAGE_ITEM`). Ghi sự cố → thông báo cho FM cơ sở (BR-111). |
| PR-O9 | Tổng phí sự cố **trừ vào cọc** (`DAMAGE_FEE`, method `DEPOSIT_OFFSET`); vượt cọc → phần thiếu là **khoản nợ** (`DAMAGE_FEE` `PENDING`), khách trả ở UC-20, chưa trả → bị chặn đặt chỗ (PR-Q12). |
| PR-O10 | Ô `MAINTENANCE` do sự cố → sinh task `MAINTENANCE` (hạn 21:00 sau 3 ngày). Staff đang giữ task hoặc FM (đóng thẳng) bấm **"Sửa xong"** (ghi chú ≥ 10 ký tự, ảnh sau sửa tuỳ chọn) → task `COMPLETED`, ô `AVAILABLE`. Task quá hạn vẫn đóng được. FM "Mở lại kho" (UC-06) cũng tự đóng task. *(27/10/2026)* |
| PR-O16 | (27/10/2026) Mỗi sự cố **bắt buộc** chọn lỗi: **khách** (`CUSTOMER`) → trừ cọc theo PR-O9; **cơ sở** (`FACILITY`) → chỉ ghi chi phí nội bộ, **không** tính khách, cọc hoàn bình thường. Cả hai đều đưa ô vào bảo trì. |

### UC-25 Hoàn tiền ✅
| Mã | Rule |
|---|---|
| PR-O11 | **Hoàn cọc** khi trả kho = cọc đang giữ − phí sự cố − phí ân hạn (PR-O14) **hoặc** phí trễ (PR-Q3) − phí chiếm dụng (PR-Q14), ≥ 0. *(27/10/2026)* Cọc trừ **theo thứ tự**: sự cố → ân hạn / phí trễ → phí chiếm dụng; mỗi khoản ghi giao dịch `DEPOSIT_OFFSET` riêng. Phí trễ không bao giờ vượt cọc; sự cố vượt cọc → nợ `DAMAGE_FEE`, phí chiếm dụng vượt cọc → nợ `OVERSTAY_FEE` (cả hai `VNPAY` `PENDING`, khách trả ở UC-20). Trả sớm thì cộng thêm **hoàn tiền thuê** (PR-O2) vào cùng task `REFUND`, ghi rõ 2 phần. Bằng 0 vẫn tạo task để FM đóng hồ sơ. |
| PR-O12 | (D-04) Mỗi khoản cần hoàn sinh **1 task `REFUND`** trong `facility_tasks` của cơ sở, **FM xử lý** (không vào việc của Staff). Nguồn: huỷ đơn (UC-15), No-Show (PR-X1), IPN về muộn (PR-B6, PR-R5), trả kho thường / trả sớm (UC-23, PR-O2), phần cọc còn giữ khi thanh lý (PR-Q9). Task ghi số tiền, cách nhận (chuyển khoản / tiền mặt), thông tin tài khoản; hạn theo PR-93. FM hoàn tất → task `COMPLETED`, giao dịch `REFUND` `SUCCESS`, log người xác nhận. *(đã code ở #55, #57)* |
| PR-O15 | *(sửa 29/10/2026, #96 + #97)* **Bằng chứng hoàn tiền** (bắt buộc trước khi hoàn tất task `REFUND`): **chuyển khoản** → bắt buộc **ảnh / link ủy nhiệm chi** (`evidence_image_url`, tải ảnh lên được); **mã FT** nhập nếu có, lưu vào `bank_transaction_code` của giao dịch `REFUND`. **Tiền mặt** → bắt buộc tick "Khách đã ký nhận tiền" (hoặc có ảnh / ghi chú). BOM xem lại mã FT / ảnh / ghi chú khi đối soát (UC-29). Thiếu → 400 `REFUND_EVIDENCE_REQUIRED`. ⚠️ Không nhập mã FT thì code tự ghi `UNC-IMAGE` (chuyển khoản) / `CASH-<id>` (tiền mặt) vào `bank_transaction_code` — lẫn mã giả với mã thật khi đối soát (L-32). *(Bản 17/10 bắt buộc mã FT, ảnh tuỳ chọn; đổi lại vì đã có chức năng tải ảnh.)* |

### UC-28 Hợp đồng quá hạn ✅
**Đang chạy** (`ContractOverdueJob`, `LateFeeService`, `ContractService.liquidateContract / waiveLateFee`, `HeldGoodsService`, `OverdueContractsPage.jsx`, `HeldGoodsPage.jsx`)
| Mã | Rule |
|---|---|
| PR-Q1 | Job 00:05 hằng ngày: `ACTIVE` có `end_date` < hôm nay → `OVERDUE`. `TERMINATION_PENDING` **đã qua ngày hẹn trả mà khách không tới** và đã qua `end_date` → `OVERDUE`, huỷ task `CHECK_OUT` *(sửa 02/11/2026 — L-38)*; *(05/11/2026)* không còn task `CHECK_OUT` mở thì dùng `end_date` (bỏ + 5 ân hạn). Chuyển `OVERDUE` → khách nhận thông báo + email, FM nhận thông báo (mỗi đợt 1 lần). *(05/11/2026, D-15)* Ngay sau bước này job **tự thanh lý** mọi hợp đồng `OVERDUE` của khách đồng ý **điều khoản v4** (`ContractService.autoRelocateToCentralWarehouse`, từng hợp đồng một transaction): trừ phí trễ + phí chiếm dụng + phí di dời vào cọc như PR-Q9 / PR-Q16, sinh task `MAINTENANCE` lý do `LIQUIDATION` "chuyển hàng vào kho tổng" và thông báo + email cho khách. Phí khi trả kho luôn tính theo **ngày nghiệm thu thực tế** (PR-Q3), không theo trạng thái. Log từng hợp đồng (user `system`). |
| PR-Q2 | Số ngày quá hạn đếm từ **`end_date` + 1** cho mọi trường hợp (lỡ ân hạn thì mất quyền miễn phí). |
| PR-Q3 | **Phí trễ = cọc đang giữ × min(số ngày quá hạn, 5) × 10%** → mỗi ngày 10%, **trần 50%** từ ngày thứ 5. Không bao giờ vượt cọc. Tỉ lệ lấy từ chính sách **gắn với hợp đồng**. |
| PR-Q4 | Tính **động**, không ghi mỗi ngày. Chỉ ghi `LATE_FEE` khi khách trả (gia hạn) hoặc khi trừ vào cọc (trả kho / thanh lý, method `DEPOSIT_OFFSET`). Ngừng tăng khi ra khỏi `OVERDUE`. |
| PR-Q5 | 🔸 `OVERDUE` → **PIN bị khoá** (trạng thái hiển thị — mô phỏng SmartLock, chưa nối thiết bị). Hẹn trả kho / gia hạn → PIN mở lại. FM miễn phí trễ vẫn giữ trạng thái khoá PIN. |
| PR-Q6 | Lối ra **gia hạn** — xem UC-21. |
| PR-Q7 | Lối ra **trả kho**: hẹn trong 3 ngày (PR-O1); phí trễ tính đến ngày nghiệm thu, trừ vào cọc (PR-O11). |
| PR-Q8 | Lối ra **thanh lý**: quá `liquidation_days` → **FM bấm Thanh lý** (không tự động; chưa đủ ngày → 409 `LIQUIDATION_NOT_ALLOWED_YET`), bắt buộc ghi chú quá trình liên hệ khách. *(27/10/2026, D-12)* Phiên bản chính sách mới: **15 ngày** (bản cũ 30 — hợp đồng đã ký giữ mốc của bản gắn với nó, PR-M5). Lịch liên hệ đề xuất: ngày quá hạn thứ **1 · 3 · 7** (đủ 3 lần của PR-Q10) để kịp thanh lý ngay khi qua mốc. Mục đích: **thanh lý là giải phóng ô**, không phải xử lý hàng — ô dọn xong là cho thuê lại. *(05/11/2026, D-15)* Hợp đồng **điều khoản v4** không chờ `liquidation_days` / 3 lần liên hệ: job 00:05 thanh lý ngay hôm sau ngày hết hạn (PR-Q1); FM vẫn bấm tay được nếu cần. Mốc 15 ngày + 3 lần liên hệ chỉ còn cho hợp đồng điều khoản cũ. |
| PR-Q9 | Thanh lý: hợp đồng `LIQUIDATED`; đơn `COMPLETED`; xoá PIN/RFID; ô `MAINTENANCE` ("Dọn xong" → `AVAILABLE`); trừ vào cọc **phí trễ** (trần 50% cọc, `LATE_FEE` `DEPOSIT_OFFSET`) rồi **phí chiếm dụng** (PR-Q14, `OVERSTAY_FEE` `DEPOSIT_OFFSET`); phí chiếm dụng vượt cọc → **nợ** `OVERSTAY_FEE` `VNPAY` `PENDING`. Cọc còn lại **tạm giữ** (D-09) — hiện "Còn giữ cọc: X đ", FM bấm "Hoàn phần cọc còn lại" khi khách đến làm việc → PR-O12. Thanh lý luôn tắt miễn phí trễ (tính đủ 150%). Đóng ticket còn mở (PR-S8). |
| PR-Q10 | (sửa 27/10/2026, **sửa 05/11/2026 — D-15**) **Điều khoản xử lý tài sản khi không trả kho** — khách bắt buộc đồng ý khi đặt kho (lưu `reservations.terms_version`, `terms_accepted_at`; hiện **v4**). Thanh lý (điều khoản cũ) cần **≥ 3 lần liên hệ** (409 `NOT_ENOUGH_CONTACTS`); thanh lý sinh task `MAINTENANCE` "Dọn ô sau thanh lý" (≥ 2 người mở kho, kiểm kê, chụp ảnh, biên bản, **chuyển vào kho tổng**). "Dọn xong" bắt buộc biên bản kiểm kê (danh sách, người chứng kiến, **kho tổng nhận hàng** đang hoạt động, vị trí kệ, ≥ 1 ảnh) → bảng `held_goods` (+ `central_warehouse_id`). FM xử lý ở trang **Hàng ở kho tổng**: **khách nhận lại** (phải hết nợ + trả phí lưu giữ PR-Q15) · **giao cơ quan chức năng** (hàng cấm / giấy tờ tuỳ thân, bất cứ lúc nào). ~~Bán thanh lý / tiêu huỷ sau 60 ngày~~ → **bỏ 05/11/2026 cho mọi hợp đồng** (kể cả điều khoản cũ): `SOLD` / `DESTROYED` → 409 `GOODS_SALE_NOT_ALLOWED`; hồ sơ đã bán / tiêu huỷ trước đây vẫn hiện trong lịch sử. Căn cứ: BLDS 2015 Điều 346–350 (bên giữ tài sản chỉ được cầm giữ, bảo quản). |
| PR-Q11 | Màn FM **"Hợp đồng quá hạn"**: mã HĐ, khách, SĐT, ô, số ngày quá hạn, phí trễ hiện tại **+ phí chiếm dụng**, ghi chú liên hệ (nhiều lần, lưu log), nút Thanh lý (bật khi đủ ngày). Popup thanh lý hiện cọc còn lại và phần **vượt cọc thành nợ**. |
| PR-Q12 | Khách có hợp đồng `OVERDUE` hoặc còn nợ (`DAMAGE_FEE` `PENDING`, hoặc `OVERSTAY_FEE` `PENDING` không phải dòng phụ gia hạn) → không đặt chỗ mới, 409 `CUSTOMER_HAS_DEBT`. |
| PR-Q14 | (27/10/2026, D-12) **Phí chiếm dụng** (overstay): mỗi ngày quá hạn (đếm như PR-Q2) = **giá niêm yết / 30 × `rental_policy.overstay_percent`** (mặc định **150%**, BOM chỉnh 100–300%), **không trần** → quá hạn luôn đắt hơn gia hạn. Cộng **thêm** vào phí trễ PR-Q3 (phí trễ vẫn là phạt một lần, trần 50% cọc). Tính động như PR-Q4, chỉ ghi giao dịch `OVERSTAY_FEE` khi: khách gia hạn (dòng phụ VNPAY), trả kho lỡ ân hạn (trừ cọc / nợ — PR-O11), bị thanh lý (PR-Q9). FM **miễn phí trễ** (Flow 6) → phí trễ = 0 và phí chiếm dụng chỉ còn **100%** giá ngày (bỏ phần phạt, vẫn thu tiền những ngày đã chiếm ô). Chỉ áp dụng khi khách đã đồng ý **điều khoản v2**; đơn cũ (v1 / chưa đồng ý) phí chiếm dụng = 0. |
| PR-Q15 | (27/10/2026, D-12) **Phí lưu giữ hàng** sau thanh lý: mỗi ngày ở kho tổng = **giá ngày của ô cũ × `rental_policy.held_goods_fee_percent`** (mặc định **20%**, BOM chỉnh 0–100%). Tính từ ngày thanh lý; điều khoản v2 / v3 tối đa 60 ngày, *(05/11/2026)* **điều khoản v4 tính tới ngày khách nhận lại** (không giới hạn vì hàng không bị bán). Thu khi FM chốt "khách nhận lại": trừ cọc còn giữ → thiếu thì khách trả tại quầy — FM phải tick "Đã thu tại quầy", thiếu → 409 `STORAGE_FEE_UNPAID`. **Giao cơ quan chức năng** không tính phí. Ghi `OVERSTAY_FEE` `SUCCESS` (method `DEPOSIT_OFFSET` / `CASH`) + lưu `held_goods.storage_fee_amount`. Áp dụng từ điều khoản v2. Trang hợp đồng của khách hiện: kho tổng, địa chỉ, hotline, vị trí kệ, số ngày đã giữ, phí lưu giữ tạm tính và **số tiền cần thanh toán để nhận lại** = nợ còn lại + phí lưu giữ − cọc còn giữ. |
| PR-Q16 | *(04/11/2026, D-13 — góp ý "tính phí đẩy hàng lúc xử lý kho quá hạn")* **Phí dọn & di dời hàng** khi thanh lý (mở ô, kiểm kê, chuyển hàng sang khu lưu giữ): thu **1 lần** = giá niêm yết tháng × `rental_policy.goods_moving_fee_percent` (mặc định **30%**, BOM chỉnh 0–100). Trừ vào cọc **sau** phí trễ và phí chiếm dụng; vượt cọc → nợ. Ghi chung loại `OVERSTAY_FEE` (tiền dịch vụ chỗ / xử lý hàng, tính vào doanh thu thuê như phí lưu giữ) với mã **`MV-OFF-…`** (trừ cọc, `DEPOSIT_OFFSET`) / **`MV-DEBT-…`** (nợ, `VNPAY` `PENDING`, trả ở UC-20). Popup thanh lý của FM hiện khoản này. Chỉ áp dụng **điều khoản v3**. |
| BR-134 | *(05/11/2026, D-15)* **Kho tổng**: bảng `central_warehouses` (tên, địa chỉ, hotline, ghi chú, `ACTIVE` / `INACTIVE`) do **BOM quản lý** ở `/bom/central-warehouses` (thêm, sửa, ngừng; hotline phải là số bắt đầu bằng 0). Mặc định có "Kho tổng QueenKho". Khi Staff / FM "Dọn xong" task thanh lý phải **chọn kho tổng đang hoạt động** (thiếu → 400 `INVENTORY_REQUIRED`). Hàng giữ ở kho tổng **không thời hạn, không bán, không tiêu huỷ**; khách quá hạn thấy thẻ "Hàng của bạn đang ở kho tổng" trong trang hợp đồng (`centralStorage`; khi đã thanh lý mà Staff chưa chuyển xong → `relocationPending = true`). API `GET /central-warehouses` (mọi tài khoản đăng nhập), `/bom/central-warehouses`. Trang FM đổi tên **"Hàng ở kho tổng"**, bỏ nút bán / tiêu huỷ và nút giả lập hết hạn lưu giữ. |

### UC-04 Quản lý cơ sở (BOM) ✅
| Mã | Rule |
|---|---|
| PR-10 | Tên, thành phố, quận, địa chỉ bắt buộc; hotline đúng định dạng SĐT. Tạo cơ sở → **tự tạo chính sách mặc định**. |
| PR-M1 | Cột **`facilities.code`**: 2–4 chữ in hoa (sai → 400 `INVALID_FACILITY_CODE`), duy nhất (trùng → 409 `FACILITY_CODE_EXISTS`), **không sửa** sau khi tạo; dùng sinh mã ô. |
| PR-11 | `INACTIVE` → ẩn khỏi tìm kiếm, không nhận đơn mới. Chặn nếu còn đơn `PENDING`/`DEPOSIT_PAID`/`UNIT_ASSIGNED` hoặc hợp đồng còn hiệu lực. |
| PR-M2 | Không xoá cứng, chỉ `INACTIVE`. Gán FM cho cơ sở làm ở UC-08. |

### UC-05 Loại kho & giá niêm yết (BOM) ✅
| Mã | Rule |
|---|---|
| PR-M3 | Danh mục **chung toàn hệ thống**: tên duy nhất (trùng → 409 `UNIT_TYPE_NAME_EXISTS`); diện tích, thể tích, giá > 0 (→ 400 `INVALID_INPUT`); kích thước / sức chứa / đặc điểm mô tả tự do. Kích thước (`dimensions`) còn dùng để vẽ ô mặc định trên mặt bằng (BR-107). |
| PR-12 | Đổi giá chỉ áp cho **đơn mới và lần gia hạn sau**; đơn / hợp đồng cũ giữ số tiền đã thu. |
| PR-M4 | Cột **`unit_types.status`** (`ACTIVE`/`INACTIVE`): `INACTIVE` ẩn khỏi tìm kiếm & đặt chỗ, FM không thêm ô mới loại đó; hợp đồng đang chạy và gia hạn không ảnh hưởng. Chỉ **xoá** được loại chưa từng có ô (→ 409 `UNIT_TYPE_HAS_UNITS`). |

### UC-07 Chính sách thuê (BOM) ✅
**Đang chạy** (`RentalPolicyService`, `PricingService`, `BomRentalPoliciesPage.jsx`)
| Mã | Rule |
|---|---|
| PR-13 | Mỗi cơ sở có đúng 1 chính sách **đang hiệu lực**. Tạo/sửa sẽ phát hành phiên bản mới và áp dụng bản đó; BOM có thể chọn lại chính phiên bản cũ làm bản hiệu lực mà không tạo bản sao. Không ghi đè nội dung; hợp đồng giữ `rental_policy_id` lúc ký. Màn hình xem được lịch sử phiên bản. |
| PR-14 | Trường & miền giá trị BOM chỉnh: hệ số cọc 1–3; % phí huỷ 0–100; giờ huỷ miễn phí ≥ 0; % phí trễ/ngày 0–50; *(27/10/2026)* **% phí chiếm dụng 100–300** (mặc định 150, PR-Q14); **% phí lưu giữ hàng 0–100** (mặc định 20, PR-Q15); *(04/11/2026)* **% phí dọn & di dời hàng 0–100 giá tháng** (mặc định 30, PR-Q16). Phiên bản mới dùng **trần phí trễ cố định 50% cọc** và **mốc xét thanh lý cố định 15 ngày** *(trước 27/10/2026 là 30)*; BOM không chỉnh hai mức này. Phiên bản cũ giữ thông số đã phát hành cho hợp đồng đã ký — script `Update_gia_han_doanh_thu.sql` tạo **phiên bản mới** cho mỗi cơ sở thay vì sửa bản cũ. |
| PR-15 | Cọc, phí trễ, thanh lý đọc từ chính sách; riêng chính sách khách hủy trước check-in cố định toàn hệ thống theo BR-32/BR-32a. |
| PR-M5 | Hủy đơn đóng băng kết quả lúc khách xác nhận; phí trễ / thanh lý vẫn theo chính sách gắn hợp đồng. |
| PR-M6 | BOM được chỉnh `deposit_month_multiplier` (xem UC-10). |
| PR-Q13 | Entity `RentalPolicy`; `late_fee_percent_per_day` (mặc định 10), `late_fee_max_percent` (mặc định 50); đã bỏ `lock_account_days` (D-05). |
| — | *(26/10/2026)* Thêm vào chính sách: % ưu đãi đặt mới / gia hạn 3·6·12 tháng (0–50%, D-08) và cờ `allow_late_fee_waiver` — BOM bật/tắt quyền FM miễn phí trễ (tắt → 403 `WAIVER_NOT_ALLOWED`). Phiên bản mới **kế thừa** ưu đãi của bản trước nếu BOM không sửa. |
| BR-130 | *(04/11/2026, D-14)* **BOM cũng được miễn phí trễ**: miễn cho hợp đồng `OVERDUE` của **mọi cơ sở**, không phụ thuộc cờ `allow_late_fee_waiver` (cờ này chỉ giới hạn FM). Cùng điều kiện như FM: lý do 5–400 ký tự, mỗi đợt quá hạn 1 lần (409 `LATE_FEE_ALREADY_WAIVED`), thanh lý vẫn tính đủ phí. Log `[FEE_WAIVE] BOM …`, FM cơ sở nhận thông báo. Màn **Hợp đồng quá hạn** của BOM (`/bom/overdue`, API `GET /contracts/overdue-all`) liệt kê quá hạn toàn chuỗi kèm tên cơ sở. Nhóm quyền mới `LATE_FEE_WAIVE` (FM cơ sở mình + BOM toàn hệ thống). |

### UC-29 Dashboard doanh thu (BOM) ✅
**Đang chạy** (`BomRevenueService`, `BomRevenuePage.jsx`; FM dùng chung API, bị khoá về cơ sở mình — `ManagerReportsPage.jsx`, xuất CSV)
| Mã | Rule |
|---|---|
| PR-M7 | Ghi nhận theo **ngày thực thu** (`paid_at`), giao dịch `SUCCESS`. 4 chỉ số: **Doanh thu thuê** = (`DEPOSIT` − phần cọc) + `MONTHLY_RENT` + `OVERSTAY_FEE` *(27/10/2026: phí chiếm dụng / lưu giữ là tiền cho việc dùng chỗ, không phải phạt)*; **Thu phí phạt** = `LATE_FEE` + `DAMAGE_FEE`; **Đã hoàn tiền** = `REFUND`; **Cọc đang giữ** = Σ `deposit_held_amount` hợp đồng còn hiệu lực + phần cọc còn giữ của hợp đồng thanh lý. Lọc cơ sở, tháng / quý / năm; biểu đồ theo tháng, cơ sở, loại kho; **tỉ lệ lấp đầy** = `OCCUPIED` / (tổng ô − `MAINTENANCE`); số hợp đồng mới / kết thúc. |
| PR-M8 | Phí trừ vào cọc ghi method `DEPOSIT_OFFSET` → tính vào "Thu phí phạt" nhưng **không** là tiền mới thu vào (tránh tính trùng cọc). |
| — | Báo cáo còn có: **tỉ lệ tái ký** = hợp đồng gia hạn / (gia hạn + kết thúc), không có phát sinh thì 0%; timeline luôn đủ 12 tháng; cơ cấu doanh thu theo loại kho (%); danh sách đối soát kèm thông tin ngân hàng và mã FT (BR-103, PR-O15). |

### UC-06 Danh mục ô kho & sơ đồ mặt bằng (FM) ✅
**Đang chạy** (`StorageUnitService`, `FloorPlanService`, `StorageManagementPage.jsx`, `FloorPlanBoard.jsx` / `FloorPlanCanvas.jsx`, `UnitLocationMap.jsx`, `UnitPickerMap.jsx`)
| Mã | Rule |
|---|---|
| PR-20 | FM chỉ thao tác ô **cơ sở mình**. |
| PR-M9 | Mã ô **tự sinh** `KV-<facilities.code>-<khu><số phòng 3 chữ số>`, duy nhất, không sửa. FM chỉ đổi tay `AVAILABLE` ↔ `MAINTENANCE`; `OCCUPIED` do hệ thống; bỏ `RESERVED`. Nút "Sửa xong" / "Dọn xong" cho ô `MAINTENANCE`. *(02/11/2026)* Chuyển sang `MAINTENANCE` **bắt buộc ghi chú lý do 10–500 ký tự** (thiếu → 400 `INVALID_INPUT`), lưu vào `storage_units.maintenance_note` + `maintenance_since` và **hiện ở danh sách ô, chi tiết ô, tooltip mặt bằng**; mở lại `AVAILABLE` (hoặc "Sửa xong") thì xoá ghi chú — lịch sử vẫn còn trong nhật ký `[UNIT_STATUS]` (trước đây ghi chú chỉ vào nhật ký nên FM không xem lại được — L-39). |
| PR-21 | Đổi loại / tầng / khu chỉ khi ô `AVAILABLE` hoặc `MAINTENANCE`. Không xoá ô đã từng có hợp đồng. Không thêm ô thuộc loại `INACTIVE`. |
| PR-M10 | **Không làm âm số suất** (BR-11): bảo trì, xoá, đổi loại ô đều bị chặn nếu làm suất < 0 → 409 `SLOT_IN_USE`. |
| PR-M11 | Nhãn "Quá hạn" trên lưới suy ra từ hợp đồng `OVERDUE` của ô. Bỏ toàn bộ số giả trên trang hiện tại. |
| BR-105 | *(29/10/2026, #98)* **Mặt bằng theo tầng** (`facility_floors`): mỗi cơ sở có nhiều tầng; tên tầng duy nhất trong cơ sở (→ 409 `DUPLICATE_FLOOR`) và chính là giá trị `storage_units.floor`. Lưới mặc định **56 × 40 ô, 1 ô = 0,5 m** (28 × 20 m), mỗi chiều 10–200 ô. Đổi tên tầng → đổi luôn `storage_units.floor` của các ô. Thu nhỏ lưới làm ô / vật cố định nằm ngoài → 400 `MAP_OUT_OF_BOUNDS`. Chỉ xoá được tầng **không còn ô kho nào** → 409 `FLOOR_HAS_UNITS`. |
| BR-106 | **Vật cố định** (`floor_fixtures`): lối đi `AISLE`, cửa ra vào `ENTRANCE`, cầu thang `STAIRS`, thang máy `ELEVATOR`, văn phòng `OFFICE` (loại khác → 400 `INVALID_FIXTURE_TYPE`); là hình chữ nhật trên lưới, mỗi chiều tối đa 100 ô; xoá tầng thì xoá theo. |
| BR-107 | **Đặt ô lên mặt bằng**: kích thước mặc định suy từ `unit_types.dimensions` (0,5 m / ô), không có thì theo diện tích; phía cửa `TOP` / `BOTTOM` / `LEFT` / `RIGHT` (mặc định `BOTTOM`). Bị chặn khi: ô / vật cố định ra ngoài lưới (`MAP_OUT_OF_BOUNDS`); hai ô chồng nhau hoặc ô đè lên vật cố định (400 `MAP_CONFLICT` — chạm cạnh không tính là chồng); ô của cơ sở khác (`UNIT_NOT_IN_FACILITY`); một ô đặt hai lần (`DUPLICATE_PLACEMENT`). Lưu cả tầng trong **1 transaction** — có lỗi thì không lưu gì. Gỡ ô khỏi mặt bằng → ô vẫn thuộc tầng, vẫn cho thuê được. |
| BR-108 | Thêm ô mới chọn được vị trí trên mặt bằng ngay lúc tạo (#98); mã ô vẫn tự sinh theo PR-M9. |
| BR-109 | *(29/10/2026, #99)* **Xem vị trí ô**: khách xem vị trí ô của **hợp đồng mình** khi hợp đồng `PENDING_CHECK_IN` / `ACTIVE` / `OVERDUE` / `TERMINATION_PENDING` (đã kết thúc → 409 `CONTRACT_NOT_ACTIVE`). Các ô khác trên tầng chỉ hiện hình khối — **không mã, không trạng thái** — để khách không biết ô nào đang có người thuê. Kèm 1 dòng chỉ dẫn "Tầng · Khu · Phòng · cửa quay ra …". Staff / FM xem vị trí ở mọi trạng thái hợp đồng. |

### UC-32 Quản lý nhân viên (FM) ✅
**Đang chạy** (`FacilityStaffService`, `FacilityStaffController`, `ManagerStaffPage.jsx`)
| Mã | Rule |
|---|---|
| PR-22 | (D-03) FM tạo `STAFF` cho **cơ sở mình** (BE tự gán, không cho chọn); Admin tạo cho cơ sở bất kỳ (UC-08). |
| PR-M12 | Form: họ tên, email (duy nhất), SĐT, **mật khẩu ban đầu do FM đặt** (≥ 6). FM không đổi role / cơ sở, không tạo FM. |
| PR-06 | Khoá / mở Staff cơ sở mình; không khoá Staff đang giữ task `IN_PROGRESS` (gỡ task trước). |
| PR-M13 | Danh sách: tên, SĐT, email, trạng thái, số task đang làm, số task hoàn thành trong tháng. |

### UC-30 Dashboard cơ sở (FM) ✅
| Mã | Rule |
|---|---|
| PR-M14 | Bỏ hết số giả. Số thật của cơ sở: ô theo trạng thái + tỉ lệ lấp đầy; đơn chờ gán ô; đơn No-Show; task hôm nay (mở / đang làm / quá hạn); hợp đồng sắp hết hạn (≤ 7 ngày); hợp đồng `OVERDUE`; yêu cầu hoàn tiền chờ xử lý; doanh thu tháng (PR-M7). Mỗi ô số dẫn tới màn tương ứng. Bỏ "ca trực", "mục tiêu doanh thu". |

### UC-03 Vai trò & phân quyền (Admin) ✅
**Đang chạy** (`AdminRoleService`, `AdminRolesPage.jsx`)
| Mã | Rule |
|---|---|
| PR-A1 | **Không tạo role mới**, không xoá, không đổi tên 5 role gốc. Màn hình: danh sách role + số người dùng + ma trận quyền (mục 1.3, chỉ đọc) + sửa **mô tả**. Không làm bảng permission riêng. |
| BR-90 | Mỗi role hiện **tổng số người dùng** (mọi trạng thái) và **số đang `ACTIVE`**, không tính tài khoản `system`. Ma trận quyền là hằng số FE (`utils/roles.js`), chép từ mục 1.3. |
| BR-91 | Sửa mô tả: người thao tác phải là `ADMIN` `ACTIVE` (403 `FORBIDDEN_ROLE`); mô tả trim, bắt buộc, ≤ 255 ký tự (400 `INVALID_INPUT`); không đổi → 200, không log; đổi → log `[ROLE_UPDATE]` (`target_entity = 'roles'`). |

### UC-08 Tài khoản người dùng (Admin) ✅
**Đang chạy** (`AdminUserService`, `AdminUsersPage.jsx`)
| Mã | Rule |
|---|---|
| PR-03 | Admin tạo `STAFF` / `FACILITY_MANAGER` / `BOM` / `ADMIN`; `CUSTOMER` chỉ tự đăng ký. |
| PR-04 | `STAFF` / `FM` bắt buộc có cơ sở; role khác không gắn cơ sở. **Mỗi cơ sở tối đa 1 FM `ACTIVE`.** |
| PR-05 | Không xoá cứng: chỉ `LOCKED` / `DISABLED`. Admin không tự khoá mình. Bị khoá → không đăng nhập (PR-L1). |
| PR-A2 | **Được đổi role** giữa `STAFF` / `FACILITY_MANAGER` / `BOM` / `ADMIN` (không từ / sang `CUSTOMER`). Điều kiện: đang là `STAFF` thì không giữ task `IN_PROGRESS`; role mới `STAFF`/`FM` bắt buộc chọn cơ sở, `BOM`/`ADMIN` thì xoá cơ sở; sang `FM` phải thoả PR-04; không đổi Admin `ACTIVE` cuối cùng. Log role cũ → mới. |
| PR-A3 | Chuyển cơ sở: Staff không giữ task `IN_PROGRESS`; FM chỉ tới cơ sở chưa có FM `ACTIVE`. |
| PR-A4 | Khoá / vô hiệu FM → cảnh báo "Cơ sở X chưa có quản lý" (không chặn). |
| PR-A5 | **Không khoá / vô hiệu khách đang thuê** (còn đơn `PENDING`/`DEPOSIT_PAID`/`UNIT_ASSIGNED` hoặc hợp đồng `PENDING_CHECK_IN`/`ACTIVE`/`OVERDUE`/`TERMINATION_PENDING`) → 409 `CUSTOMER_HAS_ACTIVE_RENTAL`. |
| PR-A6 | Đặt lại mật khẩu: Admin nhập mật khẩu mới (≥ 6); không gửi email. |
| PR-A7 | Luôn còn ≥ 1 Admin `ACTIVE`. |
| BR-92 | Danh sách gồm **cả khách hàng**, ẩn tài khoản `system`; lọc tên/email/SĐT, role, trạng thái, cơ sở; 20 dòng/trang, mới tạo trước. Bộ lọc nằm trên URL (`/admin/users?role=X` từ UC-03). |
| BR-93 | Form: họ tên 1–100, email trim + lowercase, duy nhất (409 `EMAIL_EXISTS`), **không sửa email**; SĐT `^0\d{9}$`; mật khẩu ban đầu ≥ 6. Khách hàng chỉ sửa tên + SĐT. Cơ sở mới phải `ACTIVE`. |
| BR-94 | "Đang giữ task" = task `IN_PROGRESS` **hoặc `OVERDUE`** có `staff_id` = người đó → chặn đổi role / chuyển cơ sở / khoá (409 `STAFF_HAS_TASK_IN_PROGRESS`). |
| BR-95 | Admin không tự đổi role mình (409 `CANNOT_CHANGE_OWN_ROLE`), không tự khoá (409 `CANNOT_LOCK_SELF`). Mở lại FM khi cơ sở đã có FM `ACTIVE` khác → 409 `FACILITY_HAS_MANAGER`. FM `ACTIVE` bị đổi role / chuyển cơ sở cũng trả cảnh báo PR-A4. |
| BR-96 | `LOCKED` = tạm khoá, `DISABLED` = nghỉ việc / ngừng hẳn; cả hai mở lại được, bắt buộc **lý do** ≤ 255 (chỉ lưu trong log). Log `[USER_CREATE]` / `[USER_UPDATE]` / `[USER_LOCK]` / `[USER_DISABLE]` / `[USER_UNLOCK]` / `[USER_RESET_PASSWORD]`, `target_entity = 'users'`; không ghi mật khẩu; không đổi gì → không log. |

### UC-31 Nhật ký hoạt động (Admin) ✅
**Đang chạy** (`AdminActivityLogService`, `AdminDashboardService`, `AdminLogsPage.jsx`, `AdminDashboardPage.jsx`)
| Mã | Rule |
|---|---|
| PR-07 | Chỉ **xem**, không sửa / xoá. |
| PR-A8 | `user_id` = **người thực sự thao tác**; job ghi bằng tài khoản `system`. Sửa dời lịch & No-Show đang ghi nhầm id khách (L-21). |
| PR-A9 | **Bắt buộc log**: đăng ký; tạo đơn; thanh toán thành công / thất bại; hết hạn giữ chỗ; huỷ đơn; gán ô; báo cáo liên hệ khách (`[CONTACT]`, PR-X3); No-Show; dời lịch; nhận việc; gỡ người nhận; check-in; yêu cầu / huỷ trả kho; nghiệm thu; sự cố; gia hạn; chuyển quá hạn; thanh lý; hoàn tiền; ticket hỗ trợ; cấp lại PIN; mọi CRUD của BOM / FM / Admin. **Không** log đăng nhập. UC đã xong phải bổ sung: tạo đơn, thanh toán, hết hạn, gán ô, nhận việc, gỡ người nhận. |
| PR-A10 | Nội dung tiếng Việt, mở đầu **mã nghiệp vụ** (`[CHECK_IN] …`), ≤ 500 ký tự. Lỗi ghi log không làm hỏng nghiệp vụ. |
| PR-A11 | Admin xem toàn hệ thống; lọc người thao tác, role, đối tượng, mã đối tượng, khoảng ngày. *(làm sau: FM xem log cơ sở mình)* |
| BR-97 | Màn `/admin/logs`: chỉ `ADMIN` `ACTIVE` (403 `FORBIDDEN_ROLE`). Lọc: người thao tác (tên/email, hoặc bấm tên trong bảng → đúng 1 người), role người thao tác, đối tượng (`target_entity`, dropdown lấy từ dữ liệu), mã đối tượng (khớp chính xác), nội dung (gõ được `[CHECK_IN]`), từ ngày – đến ngày (trọn ngày; từ > đến → 400). 20 dòng/trang, mới nhất trước. Bộ lọc nằm trên URL. Không xuất file. |
| BR-98 | Mỗi dòng: thời gian, người thao tác (tên, email, role; tài khoản `system` hiện "Hệ thống · Tự động"), **mã nghiệp vụ** tách từ `[MÃ]` (log cũ chưa có mã → "—"), nội dung, đối tượng + mã. Bấm mã đối tượng → lọc mọi log của đối tượng đó. |
| BR-99 | Chỉ dùng **1 tài khoản job** `system@queenkho.local`; `system@queenkho.com` cũ được migration gộp vào (chuyển log rồi xoá). Dời lịch bắt buộc `managerId`, No-Show bắt buộc `staffId` → log ghi đúng FM (sửa L-21). |
| BR-100 | Dashboard `/admin`: tổng / hoạt động / khoá / vô hiệu (không tính `system`), số theo role, cơ sở `ACTIVE` chưa có FM `ACTIVE` (PR-A4), số log hôm nay, 10 log mới nhất. Mỗi ô số dẫn tới màn đã lọc sẵn. |

### UC-26 Gửi yêu cầu hỗ trợ (Customer) ✅
**Đang chạy** (`SupportRequestService`, trang `/ho-tro`)
| Mã | Rule |
|---|---|
| PR-51 | Ticket **bắt buộc gắn hợp đồng** `ACTIVE` / `OVERDUE` / `TERMINATION_PENDING` của chính khách; câu hỏi chung → hotline. |
| PR-S1 | Loại: `LOCK_ISSUE` (**khẩn**), `SECURITY` (**khẩn**), `FACILITY_DAMAGE`, `CLEANING`, `OTHER`; *(04/11/2026)* `GOODS_DAMAGE` (**khẩn**), `GOODS_LOSS` (**khẩn**) — hàng hư / mất, kèm hồ sơ bồi thường (BR-126). Mô tả 10–1000 ký tự. Mã `SR-xxxxxx`. |
| PR-S2 | Mỗi hợp đồng: 1 ticket mở / loại (→ 409 `DUPLICATE_ISSUE_TYPE`), tối đa 3 ticket mở (→ 409 `MAX_OPEN_TICKETS_REACHED`). |
| PR-S3 | Khách huỷ ticket còn `OPEN` → `CLOSED`, task `CANCELLED`. |
| PR-52 | Ticket `RESOLVED`: "Đã ổn" → `CLOSED`; "Chưa xong" (bắt buộc lý do) → `OPEN` + task `SUPPORT` mới; 3 ngày không phản hồi → job tự `CLOSED`. |
| PR-S9 | Trang `/ho-tro`: danh sách ticket (mã, hợp đồng, loại, trạng thái, ngày tạo, kết quả xử lý) + tạo / huỷ / xác nhận. |

### UC-27 Xử lý yêu cầu hỗ trợ (Staff) ✅
| Mã | Rule |
|---|---|
| PR-34 | Tạo ticket → task `SUPPORT` tại cơ sở của hợp đồng, hạn theo BR-61; cờ khẩn suy ra từ loại; ticket đi theo task (task `IN_PROGRESS` → ticket `IN_PROGRESS`). |
| PR-S4 | Task `SUPPORT` `OVERDUE`: Staff không làm tiếp; **FM gia hạn** (hạn mới + lý do) → `OPEN` / `IN_PROGRESS` (giữ người nhận). Log. *(mở rộng 02/11/2026)* Áp dụng cả task **`MAINTENANCE`** quá hạn; hạn mới **tối đa 7 ngày** kể từ hôm nay; nhân viên giữ task nhận thông báo hạn mới. Task `CHECK_IN` quá hạn dùng dời lịch nhận kho (EX-03), `CHECK_OUT` do khách dời lịch trả (PR-O1), `REFUND` là việc của FM — không gia hạn. API `POST /staff-tasks/{id}/extend`. Demo: nút giả lập "Task quá hạn ngay" (BR-115). |
| PR-S5 | Chỉ Staff giữ task `IN_PROGRESS`, chưa quá hạn, mới hoàn tất; **bắt buộc kết quả xử lý** (≤ 1000). 1 transaction: task `COMPLETED`; ticket `RESOLVED` + `resolution_note` + `resolved_at`; log. |
| PR-S6 | Ticket `LOCK_ISSUE`: nút **"Cấp lại PIN"** (6 số, không trùng — BR-73), log. Hợp đồng `OVERDUE` không cấp lại (PR-Q5). |
| PR-S7 | Hỗ trợ **không phát sinh phí**; hư hỏng do khách chỉ tính lúc nghiệm thu (UC-24). *(04/11/2026)* Ngoại lệ: ticket hàng hư / mất của khách → hồ sơ bồi thường (BR-126 → BR-128), cơ sở có thể phải **chi tiền** cho khách. |
| BR-125 | *(04/11/2026, D-14)* **Gói bảo hiểm hàng hoá** chọn khi đặt kho (`reservations.insurance_plan`, phí / tháng chốt vào `insurance_premium_monthly`): **Cơ bản** miễn phí, trần 20 triệu, cơ sở tự chịu · **Nâng cao** 50.000đ/tháng, trần 200 triệu · **Cao cấp** 120.000đ/tháng, trần 500 triệu (hai gói sau có đối tác bảo hiểm). Khách khai báo **giá trị hàng** (tuỳ chọn, 0–10 tỷ — `declared_goods_value`); **trần bồi thường = min(giá trị khai báo, trần gói)**, không khai báo → tối đa 5 triệu. Phí bảo hiểm cộng vào số tiền VNPAY lúc đặt (× số tháng) và lúc gia hạn (giữ gói cũ, `insuranceAmount` trong báo giá, ghi chung dòng `MONTHLY_RENT`); **không hoàn khi khách tự trả sớm** (trừ ra khỏi tiền thuê kỳ trước khi áp PR-O2). Gói lạ → 400 `INVALID_INSURANCE_PLAN`. 🔸 Mức phí / trần cố định trong code (`InsurancePlan`), chưa cho BOM chỉnh. API công khai `GET /insurance-plans`. |
| BR-126 | *(04/11/2026, D-14)* **Khách báo hàng hư / mất** qua yêu cầu hỗ trợ `GOODS_DAMAGE` / `GOODS_LOSS` (hợp đồng `ACTIVE` / `OVERDUE` / `TERMINATION_PENDING`): bắt buộc danh sách hàng + giá trị (10–2000 ký tự), số tiền đề nghị > 0, ngày phát hiện (trong thời gian thuê, không ở tương lai), hàng hư bắt buộc ≥ 1 ảnh (tối đa 10) → sinh **hồ sơ bồi thường** `BT-xxxxxx` (`compensation_claims`, `SUBMITTED`) + task `SUPPORT` khẩn như PR-34. Task hỗ trợ của ticket này là **kiểm tra hiện trường**: Staff đang giữ task mở ô cùng khách, bắt buộc biên bản ≥ 10 ký tự + ≥ 1 ảnh + **nguyên nhân sơ bộ** (`CUSTOMER` / `FACILITY` / `FORCE_MAJEURE` / `UNKNOWN`) → hồ sơ `INSPECTED`, ticket **vẫn `IN_PROGRESS`** chờ FM (không chuyển RESOLVED). Khách huỷ ticket `OPEN` → hồ sơ `WITHDRAWN`. Khách bấm "Chưa xong" (khiếu nại): hồ sơ bị từ chối → quay lại `SUBMITTED` để kiểm tra lại; hồ sơ đã chấp nhận / chi trả → 409 `CLAIM_ALREADY_SETTLED`. Khách xem tiến độ hồ sơ ngay trong ticket. |
| BR-127 | *(04/11/2026, D-14)* **FM thẩm định & chốt** (hồ sơ `INSPECTED`, cơ sở mình) ở màn **Bồi thường hàng hoá** (`/manager/claims`): đối chiếu ảnh khách gửi, ảnh kiểm tra, **ảnh biên bản nhận kho** (BR-121), **cảm biến ±3 ngày** quanh ngày sự cố (BR-129). Nhập bên chịu lỗi, giá trị thẩm định (≤ số khách đề nghị), % hư hại (mất = 100%), số ngày ô không dùng được (0–90), hướng xử lý, kết luận gửi khách (10–1000 ký tự); nút **Tính thử** (`POST /claims/{id}/quote`, cùng hàm tính với lúc chốt). Bảng tính: thiệt hại = giá trị thẩm định × %; **lỗi cơ sở** → tiền hàng (≤ trần BR-125) + **phạt vi phạm 1 tháng giá niêm yết** + hoàn tiền thuê theo ngày (giá / 30 × số ngày); **bất khả kháng** → tiền hàng chỉ khi gói có bảo hiểm, + hoàn tiền thuê theo ngày, không phạt; **lỗi khách** → 0. Lỗi khách hoặc tổng = 0 → `REJECTED`, ticket `RESOLVED` kèm kết luận; ngược lại `APPROVED`. Hướng xử lý: **CONTINUE** (tiếp tục thuê, FM có thể chuyển ô cùng loại miễn phí — BR-122) hoặc **TERMINATE** (bật `rental_contracts.fault_termination`: khách hẹn trả kho như UC-22 nhưng **không phí phá HĐ**, tiền thuê kỳ hiện tại hoàn **theo số ngày còn lại**, thay công thức PR-O2). Log `[CLAIM_DECIDE]`, thông báo + email cho khách. |
| BR-128 | *(04/11/2026, D-14)* **Chi trả & đòi bảo hiểm**: FM chi trả hồ sơ `APPROVED` — chuyển khoản bắt buộc ảnh ủy nhiệm chi (mã FT tuỳ chọn), tiền mặt bắt buộc tick khách ký nhận (thiếu → 400 `PAYMENT_EVIDENCE_REQUIRED`) → giao dịch **`COMPENSATION`** `SUCCESS` (mã `BT-PAY-…`), hồ sơ `PAID`, ticket `RESOLVED` (khách xác nhận "Đã ổn" như PR-52). Gói có bảo hiểm và tiền hàng > 0 → **cơ sở chi trước rồi gửi hồ sơ đòi lại** qua `InsuranceProviderClient` (🔸 đối tác mô phỏng, mã `QKINS-xxxxxx`, `SUBMITTED`); nút ⚡ "Bảo hiểm duyệt & chi trả" → `PAID` + số tiền bảo hiểm trả cơ sở. BOM xem mọi hồ sơ (`/bom/claims`, chỉ đọc); báo cáo doanh thu hiện **Chi bồi thường hàng** và **Bảo hiểm trả lại** (chi phí riêng, không trừ vào doanh thu ròng). Trang Thanh toán của khách hiện khoản bồi thường như tiền nhận lại. |
| BR-129 | *(04/11/2026, D-14 — "liên hệ IoT hệ thống giám sát")* **Cảm biến nhiệt độ / độ ẩm từng ô** (`unit_sensor_readings`): ngưỡng an toàn **15–30°C, độ ẩm ≤ 75%**, vượt ngưỡng → bản ghi cảnh báo → báo khách đang thuê (+ email) và FM (chống trùng theo ô + giờ), sinh task `MAINTENANCE` lý do **`SENSOR`** (đóng task không đổi trạng thái ô đang có khách). Khách / Staff / FM xem số liệu 3 ngày gần nhất ở trang hợp đồng (`GET /contracts/{id}/sensor-readings`). 🔸 Chưa nối thiết bị thật — số liệu sinh bằng nút ⚡ "Cảm biến vượt ngưỡng" (12 giờ số đo, nóng / ẩm dần tới 36°C, 88%). |
| PR-S8 | Hợp đồng `TERMINATED` / `LIQUIDATED` → ticket còn mở `CLOSED`, task `CANCELLED`. |
| PR-S10 | Bảng `support_requests` có thêm `resolution_note`, `resolved_at`, `closed_at` để lưu kết quả xử lý và đếm mốc 3 ngày tự đóng (PR-52). ⚠️ Các cột này hiện được `SupportRequestSchemaInitializer` tự thêm lúc khởi động và có trong script cập nhật, nhưng **chưa có trong `QueenKho.sql`** (L-34). |

### Thông báo trong ứng dụng & email ✅
**Đang chạy** (#102 — `NotificationService`, `NotificationController`, `NotificationDropdown.jsx` trên header các layout; *02/11/2026* `EmailService`, `RenewalReminderService`)
| Mã | Rule |
|---|---|
| BR-111 | **Sự kiện sinh thông báo** *(bổ sung 02/11/2026)*. **FM cơ sở**: khách cọc thành công ("Đơn đặt kho mới chờ gán ô"); khách huỷ đơn đã cọc (chờ hoàn cọc); **khách gửi / mở lại yêu cầu hỗ trợ** (loại khẩn ghi `[KHẨN]`); **khách hẹn / dời lịch trả kho**; **khách gia hạn**; Staff ghi sự cố khi nghiệm thu; **nghiệm thu xong → việc hoàn tiền**; **Staff bảo trì / dọn kho xong**; **hợp đồng chuyển quá hạn**; **task quá hạn**. **Staff**: được giao task; **bị gỡ khỏi task**; **task đang giữ bị quá hạn / được gia hạn**; khách dời lịch trả kho của task mình giữ. **Khách** (kèm email BR-117): cọc thành công; gán ô; dời lịch nhận kho; No-Show huỷ đơn; nhận kho (check-in) xong; ghi nhận / dời lịch trả kho; nghiệm thu xong (số tiền hoàn dự kiến, khoản vượt cọc); đã hoàn tiền; yêu cầu hỗ trợ đã xử lý; gia hạn thành công; nhắc gia hạn (PR-R9); hợp đồng quá hạn; bị thanh lý. *(03/11/2026)* thêm: **khách tự huỷ đơn** (kèm số tiền hoàn dự kiến / phí huỷ); **đơn hết hạn giữ chỗ 15 phút**; **đã nhận yêu cầu hỗ trợ / yêu cầu xử lý lại**; **cảnh báo sắp thanh lý** (hợp đồng quá hạn còn ≤ 3 ngày tới mốc thanh lý) và **đã tới mốc thanh lý** — job 08:00 cùng PR-R9, mỗi loại 1 lần cho mỗi kỳ `end_date`, nút giả lập quá hạn N ngày chạy ngay. **Admin**: FM tạo tài khoản Staff; tóm tắt khi đăng nhập. Mỗi thông báo có loại và đường dẫn tới màn liên quan. |
| BR-112 | Người dùng chỉ xem / đánh dấu đã đọc **thông báo của mình** (của người khác → lỗi); có số chưa đọc, "đánh dấu tất cả đã đọc"; bấm thông báo → chuyển tới màn liên quan. |
| BR-113 | *(sửa 02/11/2026 — đóng L-31)* Thông báo lưu **bảng `notifications`** (không mất khi khởi động lại), rollback cùng nghiệp vụ. **Không còn thông báo mẫu viết cứng** — tài khoản chưa có sự kiện nào thì chuông trống. Thông báo do job sinh (nhắc gia hạn, quá hạn) chống gửi trùng bằng `ref_key`. |
| BR-117 | *(02/11/2026)* **Email cho khách**: mọi thông báo gửi cho khách (BR-111) gửi kèm email tới `users.email` (nút "Xem chi tiết" dẫn về đúng màn). Gửi **sau khi transaction commit** (nghiệp vụ lỗi thì không gửi), chạy nền; SMTP lỗi không làm hỏng nghiệp vụ. **Không gửi mã PIN / mật khẩu qua email.** Cấu hình `MAIL_USERNAME` / `MAIL_PASSWORD` (Gmail: mật khẩu ứng dụng) → gửi thật *(03/11/2026: mặc định bật, người gửi = `MAIL_USERNAME` nếu không đặt `MAIL_FROM`)*; chưa có tài khoản SMTP hoặc `MAIL_ENABLED=false` → chỉ in nội dung email ra console. Chỉ khách nhận email; FM / Staff / Admin chỉ nhận thông báo trong chuông. |

### Mô phỏng thời gian phục vụ demo ✅
**Đang chạy** (`DemoSimulationService`, `DemoSimulationController` — `/api/v1/dev/simulation/*`, nút "⚡ Giả lập" trên các màn liên quan)
| Mã | Rule |
|---|---|
| BR-114 | Chỉ chạy khi cấu hình `queenkho.simulation.enabled = true`, tắt → 404 `SIMULATION_DISABLED`. ⚠️ `application.yaml` đang để mặc định **bật** (`SIMULATION_ENABLED:true`) cho buổi demo — **phải tắt khi chạy thật**. |
| BR-115 | Giả lập **chỉ dời mốc thời gian** rồi để nghiệp vụ thật xử lý tiếp (job, nút No-Show, nút Thanh lý…) — không có lối tắt đổi trạng thái. Các thao tác: khách tới nhận kho / trả kho hôm nay; đơn quá 15 phút giữ chỗ (chạy job huỷ ngay); đủ điều kiện No-Show (lùi giờ hẹn 49h + 2 lần liên hệ thất bại cách nhau ≥ 24h); hợp đồng quá hạn N ngày; thêm lần liên hệ thất bại; hàng lưu giữ hết hạn; ticket đã xử lý quá 3 ngày; *(02/11/2026)* **hợp đồng còn 7 / 3 / 1 ngày hết hạn** (chạy ngay job nhắc gia hạn — khách / FM); **task hỗ trợ / bảo trì quá hạn ngay** (chạy ngay job đánh quá hạn — FM, để demo "Gia hạn xử lý"). Vẫn kiểm tra quyền và phạm vi cơ sở như thao tác thật (đơn của người khác → 403, sai trạng thái → 409 `SIMULATION_NOT_APPLICABLE`). |
| BR-116 | Mỗi lần giả lập ghi log `[SIMULATION]` kèm người bấm, để hội đồng thấy rõ đây là thao tác tua thời gian. |

---

## 4. Chỗ code còn lệch rule

> Đối chiếu 02/11/2026. Mức: 🔴 sai tiền / mất dữ liệu · 🟠 trái quyết định đã chốt hoặc hội đồng dễ thấy · 🟡 nhỏ.

### 4.1 Còn mở
| Mã | Mức | Mô tả | Chỗ | Rule |
|---|---|---|---|---|
| L-09 | 🟡 | Ngày bắt đầu: BE nhận cả hôm nay, FE từ ngày mai; cả hai chưa chặn quá 30 ngày. | `ReservationService.createReservation`, `CreateReservationPage.jsx` | PR-B4 |
| L-12 | 🟡 | Comment trạng thái trong SQL chưa khớp code: `reservations` thiếu `EXPIRED`, `TERMINATION_PENDING`, `REFUND_PENDING`, `REFUNDED`; `storage_units` còn `RESERVED`; `payment_transactions` ghi `REFUNDED` nhưng không dùng. | `sql_script/QueenKho.sql` | Mục 2 |
| L-28 🆕 | 🟡 | Chưa giới hạn mỗi khách 1 đơn `PENDING`. | `ReservationService.createReservation` | PR-B2 |
| L-29 🆕 | 🟡 | Staff nhận được task có hạn xa hơn 3 ngày. | `StaffTaskService.claimTask` | PR-C6 |
| L-30 🆕 | 🟡 | API chi tiết task vẫn trả PIN / RFID cho Staff / FM sau check-in. | `StaffTaskService` (dựng `StaffTaskDetailResponse`) | PR-C5 |
| L-32 🆕 | 🟡 | Hoàn tiền không nhập mã FT thì code tự ghi `UNC-IMAGE` / `CASH-<id>` vào `bank_transaction_code` → danh sách đối soát lẫn mã giả với mã thật. | `StaffTaskService.completeRefund` | PR-O15 |
| L-33 🆕 | 🟡 | Màn gia hạn chưa báo khi giá niêm yết đã đổi so với lúc ký. | `ContractOptionsModal.jsx` | PR-R4 |
| L-34 🆕 | 🟡 | Cột `resolution_note`, `resolved_at`, `closed_at` của `support_requests` không có trong `QueenKho.sql` (được tự thêm lúc khởi động) — trái quy ước "schema do SQL script quyết định". | `sql_script/QueenKho.sql`, `SupportRequestSchemaInitializer` | PR-S10 |
| L-35 🆕 | 🟡 | Form đặt kho vẫn bắt buộc nhập địa chỉ nhưng không gửi lên BE, không lưu. | `CreateReservationPage.jsx` | PR-B5 |

### 4.2 Đã đóng
| Mã | Nội dung | Xử lý |
|---|---|---|
| L-01 | Bảng task không cho loại `REFUND` | #55 nới ràng buộc |
| L-02 | `POST /contracts/{id}/renew` ghi tiền mà không thu | Đã xoá API (PR-R6) |
| L-03 | Logic phí huỷ rải rác, dễ đổi sai | Tập trung trong `CancellationPolicyService`, cố định toàn hệ thống và có test biên; cọc khi đặt vẫn theo PR-M6 |
| L-05 | Hai bảng ưu đãi khác nhau | Cố ý — D-08 |
| L-06 | No-Show không hoàn tiền thuê, không có miễn phạt | PR-X1 |
| L-07 | Login không chặn `LOCKED` / `DISABLED` | UC-08 (PR-L1, PR-L2) |
| L-08 | Hết hạn giữ chỗ ghi `CANCELLED` | `EXPIRED` + giao dịch `FAILED` (PR-B7) |
| L-10 | API No-Show không kiểm tra ngày | PR-X2, PR-X3 |
| L-11 | Gợi ý / gán ô khác loại | 26/10 (BR-41, BR-42) |
| L-13 | Không kiểm tra số suất khi tạo đơn | 26/10, khoá dòng (PR-B1) |
| L-14 | Form đặt chỗ không gửi SĐT / CCCD | #101 (PR-B5); phần ô địa chỉ còn lại → L-35 |
| L-15 | IPN về sau khi đơn bị huỷ → tiền đã trừ, đơn mất | Giữ chỗ 15 phút + tự sinh hoàn tiền (PR-B6) |
| L-17 | Check-in trước ngày hẹn | `CHECK_IN_TOO_EARLY` (PR-C1) |
| L-18 | Form trả kho không gửi thông tin ngân hàng | PR-O3 |
| L-19 | Trang hợp đồng đọc sai tham số kết quả VNPAY | PR-R8 |
| L-20 | Số tháng gia hạn cắt từ mã giao dịch | Cột `renewal_months`, chỉ nhận 1/3/6/12 (PR-R2) |
| L-21 | Log dời lịch / No-Show ghi nhầm người thao tác | UC-31 (PR-A8) |
| L-22 | FE gửi `customerId ?? 1` | 26/10, lấy khách từ token (PR-90) |
| L-23 | Nút gia hạn / trả kho hiện cả khi hợp đồng đã kết thúc | PR-R1 |
| L-24 | Hoàn tất hoàn tiền không bắt buộc bằng chứng | #97 (PR-O15) |
| L-25 | No-Show bấm được ngay khi task quá hạn | PR-X3 |
| L-27 | Trả sớm không hoàn tiền thuê; ngày ân hạn chưa tính phí | PR-O2, PR-O14 |
| L-26 | Checklist check-in 5 mục, chưa có cam kết hàng cấm / kiểm tra hàng | 05/11 — mục 6 bắt buộc + cột `is_prohibited_goods_committed` (BR-132) |
| L-04 | Trang chủ / đăng ký ghi ưu đãi "cho đơn đầu tiên" | 02/11 — sửa câu chữ "cho mỗi đơn đặt kho trực tuyến" (BR-25) |
| L-31 | Thông báo lưu RAM; tài khoản mới được sinh thông báo mẫu viết cứng | 02/11 — bảng `notifications`, bỏ thông báo mẫu (BR-113) |
| L-36 | Ngày hẹn trả kho nhận cả hôm nay; FE lấy ngày theo giờ UTC | 02/11 — từ ngày mai, giờ VN (PR-O1) |
| L-37 | BE không kiểm tra cách nhận cọc, thiếu số TK thì tự hiểu là tiền mặt | 02/11 — 400 `INVALID_REFUND_METHOD` (PR-O3) |
| L-38 | Job quá hạn huỷ lịch trả kho của khách `OVERDUE` vừa hẹn (điều kiện cố định `end_date` + 5) | 02/11 — theo ngày hẹn (PR-Q1); ô sắp trống tính theo ngày hẹn + 1 (PR-R11) |
| L-39 | Ghi chú khi FM khoá bảo trì chỉ nằm trong nhật ký, không hiện lại | 02/11 — cột `maintenance_note` (PR-M9) |
| L-40 | Danh sách "Kho của tôi" ghi "Chờ hoàn tiền" nhưng chi tiết hợp đồng ghi "Đã hoàn tiền thành công" (chi tiết coi `TERMINATED` = đã hoàn) | 02/11 — `RefundStatusService` dùng chung, API trả `refundStatus` (PR-O12) |
| L-41 | Nút "Tải phiếu biên nhận" chỉ quay về trang đặt kho; link thông báo gán ô dùng id hợp đồng thay vì id đơn | 02/11 — bản in phiếu biên nhận (BR-120); sửa link |
| L-42 | Chưa có voucher thật (chỉ mã cứng `NEWKHO`), chưa gửi email, chưa nhắc gia hạn tự động, FM không xem được chi tiết đơn khi gán ô, chỉ gia hạn được task hỗ trợ | 02/11 — BR-25, BR-117, PR-R9, BR-119, PR-S4 |

*(L-16 đã gộp vào PR-B2 — nay theo dõi ở L-28.)*

---

## 5. Thay đổi schema

> File schema chính: **`sql_script/QueenKho.sql`** (`ddl-auto: validate` → sửa SQL trước, rồi mới sửa Entity). DB cũ chạy thêm các script `Update_*.sql` tương ứng. Thư mục `backend/api/src/main/resources/db/migration` đã có bản Flyway V1 / V2 (#103) nhưng **chưa kích hoạt**. Sau mỗi lần merge có đổi SQL → nhắc cả nhóm chạy lại script.

| Bảng | Thay đổi | Rule | Trạng thái |
|---|---|---|---|
| `facilities` | + `code` NVARCHAR(4) NOT NULL UNIQUE | PR-M1 | ✅ |
| `unit_types` | + `status` (`ACTIVE` / `INACTIVE`); tên UNIQUE | PR-M3, PR-M4 | ✅ |
| `rental_policy` | bỏ `lock_account_days`; `late_fee_percent_per_day`, `late_fee_max_percent`; ưu đãi đặt mới / gia hạn 3·6·12T; `allow_late_fee_waiver`; `overstay_percent`, `held_goods_fee_percent`; `liquidation_days` mặc định 15; `version` + `is_active` (1 bản hiệu lực / cơ sở) | D-05, PR-Q13, D-08, PR-Q8, PR-Q14, PR-Q15, PR-13 | ✅ |
| `reservations` | + `rent_discount_percent`, `terms_version`, `terms_accepted_at` | D-08, BR-102 | ✅ |
| `rental_contracts` | + `late_fee_waived`, `late_fee_waiver_note` | Miễn phí trễ (26/10) | ✅ |
| `payment_transactions` | `payment_type` thêm `DAMAGE_FEE`, `OVERSTAY_FEE`; `payment_method` thêm `DEPOSIT_OFFSET`, `GOODS_SALE`; + `renewal_months` (1/3/6/12); + `bank_transaction_code` | PR-O9, PR-Q14, PR-M8, PR-R2, BR-103 | ✅ |
| `facility_tasks` | (đổi tên từ `staff_tasks`) thêm loại `REFUND`, `MAINTENANCE`; `evidence_image_url`, `maintenance_reason` | PR-O10, PR-O12 | ✅ |
| `damage_cases` 🆕 | sự cố khi nghiệm thu, có `liable_party` | PR-O8, PR-O16 | ✅ |
| `held_goods` 🆕 | hàng lưu giữ sau thanh lý, có `storage_fee_amount` | PR-Q10, PR-Q15 | ✅ |
| `facility_floors`, `floor_fixtures` 🆕; `storage_units` + `map_x`, `map_y`, `map_w`, `map_h`, `map_door` | sơ đồ mặt bằng | BR-105 → BR-107 | ✅ |
| `login_history` 🆕 | lịch sử đăng nhập | BR-101 | ✅ |
| `users` | tài khoản job `system@queenkho.local` (gộp `system@queenkho.com` cũ) | PR-A8 | ✅ |
| `support_requests` | + `resolution_note`, `resolved_at`, `closed_at` | PR-S10 | ⚠️ có trong script cập nhật, **chưa có trong `QueenKho.sql`** (L-34) |
| `notifications` 🆕 | thông báo trong chuông (thay bộ nhớ RAM), `ref_key` chống gửi trùng | BR-113 | ✅ (02/11, `Update_sua_bug_sau_test.sql`) |
| `vouchers` 🆕; `reservations` + `voucher_id`, `voucher_code`, `voucher_discount` | voucher đặt kho, chốt mức giảm trên đơn (đơn cũ được gán `NEWKHO` 100.000đ) | BR-25 | ✅ (02/11) |
| `storage_units` + `maintenance_note`, `maintenance_since` | ghi chú khi FM khoá bảo trì | PR-M9 | ✅ (02/11) |
| `handover_records` | + `is_prohibited_goods_committed` BIT NOT NULL DEFAULT 0 | PR-C7, BR-132 | ✅ (05/11, `Update_hop_nhom_05_11.sql`) |
| `handover_records` | + `evidence_image_urls` (ảnh, ngăn bởi `\|\|\|`), + `check_in_method` (`COUNTER` / `ONLINE`), `staff_id` cho phép NULL | BR-121, BR-124 | ✅ (04/11, `Update_bang_chung_chuyen_o.sql`) |
| `unit_transfers` 🆕 | lịch sử chuyển ô: hợp đồng, ô cũ → ô mới, loại lý do, mô tả, trạng thái ô cũ, người chuyển | BR-122 | ✅ (04/11) |
| `rental_policy` | + `goods_moving_fee_percent` INT NOT NULL DEFAULT 30 (0–100) | PR-Q16 | ✅ (04/11) |
| `reservations` | + `insurance_plan` (BASIC / ADVANCED / PREMIUM, mặc định BASIC), `insurance_premium_monthly`, `declared_goods_value` | BR-125 | ✅ (04/11, `Update_bao_hiem_boi_thuong.sql`) |
| `rental_contracts` | + `fault_termination` BIT DEFAULT 0 | BR-127 | ✅ (04/11) |
| `compensation_claims` 🆕 | hồ sơ bồi thường: ticket, khách đề nghị, kiểm tra hiện trường, quyết định, chi trả, hồ sơ bảo hiểm | BR-126 → BR-128 | ✅ (04/11) |
| `unit_sensor_readings` 🆕 | nhiệt độ / độ ẩm từng ô, cờ vượt ngưỡng | BR-129 | ✅ (04/11) |
| `payment_transactions` | `payment_type` thêm `COMPENSATION` (cơ sở chi cho khách) | BR-128 | ✅ (04/11) |
| `goods_categories` 🆕 | danh mục loại hàng: `code` (duy nhất), `name`, `description`, `requires_cold_storage`, `requires_note`, `sort_order`, `status`; seed 7 loại | BR-131 | ✅ (05/11, `Update_hop_nhom_05_11.sql`) |
| `unit_types` | + `temperature_class` NVARCHAR(20) NOT NULL DEFAULT `NORMAL` (CK `NORMAL` / `COLD` / `FROZEN`) | BR-131 | ✅ (05/11) |
| `reservations` | + `goods_category_codes` NVARCHAR(300), `goods_description` NVARCHAR(500) | BR-131 | ✅ (05/11) |
| `vouchers` | + `unit_type_id` (FK `unit_types`, NULL = mọi loại kho) | BR-133 | ✅ (05/11) |
| `central_warehouses` 🆕 | kho tổng: `name`, `address`, `hotline`, `note`, `status`; seed "Kho tổng QueenKho" | BR-134 | ✅ (05/11) |
| `held_goods` | + `central_warehouse_id` (FK `central_warehouses`) | BR-134 | ✅ (05/11) |
| Comment trạng thái | khớp mục 2 | — | ⬜ (L-12) |

---

## 6. Mã lỗi API

Trả về dạng `{ "error": "CODE", "message": "..." }`.

| HTTP | Mã | Khi nào | Rule |
|---|---|---|---|
| 400 | `INVALID_INPUT` | Thiếu / sai dữ liệu đầu vào | chung |
| 401 | `INVALID_CREDENTIALS` | Sai email hoặc mật khẩu | PR-L2 |
| 403 | `ACCOUNT_LOCKED` / `ACCOUNT_DISABLED` | Tài khoản bị khoá / vô hiệu | PR-L1 |
| 403 | `FORBIDDEN_ROLE` / `FORBIDDEN_FACILITY` | Sai role / khác cơ sở (đã có ở UC-17/18) | BR-63 → 65 |
| 401 | `UNAUTHORIZED` | Thiếu / sai token | PR-90 |
| 401 | `ACCOUNT_LOCKED` | Tài khoản bị khoá giữa phiên → huỷ token | BR-03 |
| 403 | `API_NOT_DECLARED` | API chưa khai báo luật trong `AccessPolicy` | PR-90 |
| ~~409~~ | ~~`OUT_OF_STOCK`~~ | ~~Hết suất khi tạo đơn~~ → dùng `NO_AVAILABILITY` | PR-B1 |
| 409 | `PENDING_EXISTS` ⬜ | Khách đang có đơn chờ thanh toán *(chưa code — L-28)* | PR-B2 |
| 400 | `TERMS_NOT_ACCEPTED` | Đặt kho chưa đồng ý điều khoản | BR-102 |
| 409 | `CUSTOMER_HAS_DEBT` | Khách có hợp đồng quá hạn / còn nợ | PR-Q12 |
| 409 | `CHECK_IN_TOO_EARLY` | Check-in / nghiệm thu trước ngày hẹn | PR-C1, PR-O5 |
| 409 | `TASK_TOO_FAR` ⬜ | Nhận task có hạn quá 3 ngày *(chưa code — L-29)* | PR-C6 |
| 409 | `CONTRACT_NOT_RENEWABLE` | Gia hạn hợp đồng sai trạng thái | PR-R1 |
| 409 | `RENEWAL_UNIT_RESERVED` | Gia hạn sau hạn chót ưu tiên (`end_date` − 3) mà ô đã có khách khác đặt trước | PR-R10, PR-R11 |
| 409 | `NO_AVAILABILITY` | Hết suất khi tạo đơn; message báo ngày nhận kho sớm nhất nếu có ô sắp trống | PR-B1, PR-R11 |
| 409 | `STORAGE_FEE_UNPAID` | Khách nhận lại hàng lưu giữ mà chưa thu đủ phí lưu giữ tại quầy | PR-Q15 |
| 409 | `SLOT_IN_USE` | Thao tác ô kho làm âm số suất | PR-M10 |
| 409 | `NO_SHOW_NOT_ALLOWED_YET` | Chưa đủ 2 lần liên hệ cách 24h / chưa qua 48h | PR-X3 |
| 400 | `REFUND_EVIDENCE_REQUIRED` | Hoàn tất hoàn tiền thiếu ảnh / link ủy nhiệm chi (chuyển khoản) hoặc xác nhận ký nhận (tiền mặt) | PR-O15 |
| 409 | `NOT_ENOUGH_CONTACTS` | Thanh lý khi chưa đủ 3 lần liên hệ khách | PR-Q10 |
| 409 | `LIQUIDATION_NOT_ALLOWED_YET` | Thanh lý khi chưa quá `liquidation_days` | PR-Q8 |
| 409 | ~~`HOLD_NOT_EXPIRED`~~ | ~~Bán / tiêu huỷ hàng lưu giữ khi chưa hết 60 ngày~~ — không còn dùng từ 05/11/2026 (thay bằng `GOODS_SALE_NOT_ALLOWED`) | PR-Q10 |
| 400 | `INVENTORY_REQUIRED` | "Dọn xong" sau thanh lý thiếu biên bản kiểm kê | PR-Q10 |
| 400 | `DAMAGE_REPORT_REQUIRED` | Nghiệm thu "không sạch / khoá hỏng" mà chưa lập sự cố | PR-O6 |
| 400 | `EVIDENCE_IMAGE_REQUIRED` / `INVALID_DAMAGE_ITEM` | Sự cố thiếu ảnh bằng chứng / thiếu bên chịu lỗi hoặc dữ liệu sai | PR-O8, PR-O16 |
| 403 | `WAIVER_NOT_ALLOWED` | Chính sách cơ sở không cho FM miễn phí trễ | UC-07 |
| 409 | `CONTRACT_NOT_OVERDUE` / `LATE_FEE_ALREADY_WAIVED` | Miễn phí trễ cho hợp đồng không quá hạn / đã miễn trong đợt này | UC-28 |
| 409 | `DUPLICATE_ISSUE_TYPE` / `MAX_OPEN_TICKETS_REACHED` | Trùng loại ticket đang mở / quá 3 ticket mở | PR-S2 |
| 409 | `CONTRACT_NOT_ACTIVE` | Khách xem vị trí ô khi hợp đồng đã kết thúc | BR-109 |
| 400 | `MAP_CONFLICT` / `MAP_OUT_OF_BOUNDS` | Ô chồng nhau hoặc đè vật cố định / ra ngoài mặt bằng | BR-105, BR-107 |
| 400 | `UNIT_NOT_IN_FACILITY` / `DUPLICATE_PLACEMENT` / `INVALID_FIXTURE_TYPE` | Dữ liệu sai khi lưu mặt bằng | BR-106, BR-107 |
| 409 | `DUPLICATE_FLOOR` / `FLOOR_HAS_UNITS` | Trùng tên tầng / xoá tầng còn ô | BR-105 |
| 409 | `UNIT_TYPE_NAME_EXISTS` / `UNIT_TYPE_HAS_UNITS` | Trùng tên loại kho / xoá loại đã từng có ô | PR-M3, PR-M4 |
| 400 / 409 | `INVALID_FACILITY_CODE` / `FACILITY_CODE_EXISTS` | Mã cơ sở sai định dạng / trùng | PR-M1 |
| 409 | `UNIT_HAS_CONTRACT_HISTORY` | Xoá ô đã từng có hợp đồng | PR-21 |
| 400 / 409 | `INVALID_STAFF`, `STAFF_INACTIVE` / `TASK_ALREADY_ASSIGNED` | Giao việc cho Staff khác cơ sở hoặc bị khoá / giao trùng người | UC-16 (giao việc) |
| 404 / 409 | `SIMULATION_DISABLED` / `SIMULATION_NOT_APPLICABLE` | Giả lập đang tắt / sai trạng thái để giả lập | BR-114, BR-115 |
| 409 | `CUSTOMER_HAS_ACTIVE_RENTAL` | Khoá / vô hiệu khách đang thuê | PR-A5 |
| 404 | `ROLE_NOT_FOUND` | Sửa mô tả role không tồn tại | BR-91 |
| 404 | `USER_NOT_FOUND` | Admin thao tác user không tồn tại / tài khoản `system` | UC-08 |
| 409 | `EMAIL_EXISTS` | Tạo tài khoản trùng email | BR-93 |
| 409 | `FACILITY_HAS_MANAGER` | Cơ sở đã có FM `ACTIVE` khác | PR-04, BR-95 |
| 409 | `STAFF_HAS_TASK_IN_PROGRESS` | Staff đang giữ task `IN_PROGRESS` / `OVERDUE` | BR-94 |
| 409 | `LAST_ACTIVE_ADMIN` | Khoá / đổi role Admin `ACTIVE` cuối cùng | PR-A7 |
| 409 | `CANNOT_LOCK_SELF` / `CANNOT_CHANGE_OWN_ROLE` | Admin tự khoá / tự đổi role mình | BR-95 |
| 409 | `TASK_*`, `PIN_TAKEN`, `RFID_TAKEN`, `CHECKLIST_INCOMPLETE`… | Đã có trong `StaffTaskException` (UC-17/18) | BR-64 → 74 |
| 400 | `VOUCHER_INVALID` | Mã voucher khách nhập không áp được (message ghi lý do) | BR-25 |
| 400 / 404 | `DUPLICATE_CODE`, `VOUCHER_IN_USE` / `VOUCHER_NOT_FOUND` | BOM tạo trùng mã / đổi mã voucher đã có người dùng / sai id | BR-25 |
| 400 | `INVALID_REFUND_METHOD` | Hẹn trả kho thiếu cách nhận cọc hoặc thiếu thông tin chuyển khoản | PR-O3 |
| 409 | `TASK_NOT_EXTENDABLE` | Gia hạn task không phải `SUPPORT` / `MAINTENANCE` | PR-S4 |
| 400 | `HANDOVER_PHOTO_REQUIRED` | Biên bản check-in / nghiệm thu / check-in online thiếu ảnh hiện trạng ô | BR-121 |
| 400 / 409 | `IDENTITY_MISMATCH` / `IDENTITY_MISSING` | Check-in online: CCCD không khớp / tài khoản chưa có CCCD | BR-124 |
| 409 | `CONTRACT_NOT_TRANSFERABLE` | Chuyển ô cho hợp đồng quá hạn / đã kết thúc | BR-122 |
| 400 / 409 | `UNIT_TYPE_MISMATCH`, `UNIT_NOT_IN_FACILITY` / `UNIT_NOT_AVAILABLE` | Chuyển sang ô khác loại, khác cơ sở / ô không còn trống | BR-122 |
| 400 | `INVALID_INSURANCE_PLAN` | Đặt kho với gói bảo hiểm không tồn tại | BR-125 |
| 400 | `INVALID_CLAIM` / `EVIDENCE_IMAGE_REQUIRED` | Hồ sơ bồi thường thiếu danh sách hàng / số tiền / ngày; hàng hư hoặc biên bản kiểm tra thiếu ảnh | BR-126 |
| 409 | `CLAIM_STATUS_INVALID` / `CLAIM_ALREADY_SETTLED` | Thao tác sai trạng thái hồ sơ / khiếu nại hồ sơ đã chấp nhận | BR-126, BR-127 |
| 400 | `PAYMENT_EVIDENCE_REQUIRED` | Chi trả bồi thường thiếu ủy nhiệm chi / xác nhận ký nhận | BR-128 |
| 400 | `GOODS_CATEGORY_REQUIRED` / `INVALID_GOODS_CATEGORY` | Đặt kho chưa chọn loại hàng / mã loại hàng không có hoặc đã ngừng | BR-131 |
| 400 | `GOODS_REQUIRES_COLD_STORAGE` | Chọn thực phẩm (loại cần kho lạnh) cho loại kho thường | BR-131 |
| 400 | `GOODS_DESCRIPTION_REQUIRED` | Chọn "Khác" mà không mô tả hàng | BR-131 |
| 409 | `DUPLICATE_CODE` | BOM thêm loại hàng trùng mã | BR-131 |
| 400 | `GOODS_CHECK_REQUIRED` | Check-in chưa tick mục 6 kiểm tra hàng | BR-132 |
| 409 | `GOODS_SALE_NOT_ALLOWED` | FM chọn bán thanh lý / tiêu huỷ hàng ở kho tổng | PR-Q10, BR-134 |

Các mã kỹ thuật khác (`*_NOT_FOUND`, `INVALID_*`, `FORBIDDEN_CONTRACT`, `TASK_NOT_*`…) giữ nguyên trong code, không liệt kê hết ở đây.

---

## 7. Lịch sử thay đổi theo góp ý

### 17/10/2026 — Góp ý thành viên ("Góp ý Business rule")
| # | Góp ý | Kết quả | Rule |
|---|---|---|---|
| 1 | Trả kho sớm: thu hồi ưu đãi + phí phá hợp đồng thay vì giữ toàn bộ tiền thuê | ✅ Nhận, bổ sung công thức cụ thể | D-10, PR-O2 |
| 2 | Ân hạn: miễn phí 24h, ngày 2–5 tính phí trừ vào cọc | ✅ Nhận; mức phí = tiền thuê theo ngày (giá / 30) | D-11, PR-O1, PR-O14 |
| 3 | Tách giờ quầy 21:00 và giờ ra vào kho 24/7 | ✅ Nhận (chỉ làm rõ tài liệu) | PR-92 |
| 4 | Bắt buộc bằng chứng khi FM hoàn tiền | ✅ Nhận có điều chỉnh: bắt buộc **mã FT** (chuyển khoản) / **ký nhận** (tiền mặt); ảnh không bắt buộc vì chưa có chức năng upload | PR-O15 |
| 5 | Checklist mục 6: cam kết hàng cấm | ✅ Nhận; thêm cột `handover_records.is_prohibited_goods_committed` | PR-C7, PR-O6 |
| 6 | No-Show: ≥ 2 lần liên hệ cách 24h, sau 48h mới được bấm | ✅ Nhận; đếm theo log `[CONTACT]` | D-07, PR-X3 |

Đồng thời cập nhật tài liệu theo code mới trên `main`: `facility_tasks` + task `REFUND` do FM xử lý (#55, #57), báo cáo liên hệ No-Show (#52), trạng thái đơn `REFUNDED`.

### 26/10/2026 — Hoàn thiện 5 flow Must-have
| Hạng mục | Rule / quyết định | Chỗ trong code |
|---|---|---|
| **PR-90 đã làm**: mọi API lấy người thao tác từ token; khách chỉ thấy dữ liệu của mình, Staff/FM chỉ cơ sở được gán | Bảng quyền duy nhất `AccessPolicy` (18 nhóm chức năng); filter ghi đè `customerId/staffId/managerId/actorUserId/facilityId` theo token; `OwnershipGuard` kiểm tra bản ghi theo id. Ma trận ở `/admin/roles` đọc thẳng từ bảng này | `security/*`, `/admin/roles/access-matrix` |
| FM **giao việc** cho nhân viên (Flow 5) | Task `CHECK_IN / CHECK_OUT / SUPPORT / MAINTENANCE` chưa quá hạn; chỉ Staff ACTIVE cùng cơ sở; giao lại = đổi người. REFUND vẫn là việc của FM. Log `[TASK_ASSIGN]` | `StaffTaskService.assignTask` |
| **UC-20** Thanh toán của khách (PR-50) | Xem mọi giao dịch + trả nợ phí sự cố (`DAMAGE_FEE` VNPAY PENDING) qua VNPAY; huỷ trên VNPAY → nợ vẫn PENDING; trả xong hết bị chặn đặt kho (PR-Q12) | `CustomerPaymentService`, `VnpayService.createDebtPayment`, `/thanh-toan` |
| **D-08 → BOM chỉnh được ưu đãi gói** (PR-15) | `rental_policy.booking_discount_3m/6m/12m`, `renewal_discount_3m/6m/12m` (0–50%). Đặt mới **chốt %** vào `reservations.rent_discount_percent` (như cọc — PR-M6); gia hạn theo bản đang hiệu lực. Mọi chỗ tính tiền dùng chung `PricingService` | `PricingService`, `/facilities/{id}/pricing`, `/contracts/{id}/renewal-quote` |
| **Miễn phí trễ** (Flow 4 / 6) | BOM bật/tắt `allow_late_fee_waiver` theo cơ sở; FM miễn cho HĐ `OVERDUE` của cơ sở mình, lý do 5–400 ký tự, log `[FEE_WAIVE]`. Chỉ áp dụng đợt quá hạn hiện tại (gia hạn xong / đợt quá hạn mới → tắt). Thanh lý vẫn trừ phí trễ theo D-09 | `ContractService.waiveLateFee`, `LateFeeService` |
| **Báo cáo cơ sở** cho FM (`/manager/reports`) | Dùng chung API doanh thu của BOM, `facilityId` bị khoá về cơ sở FM; xuất CSV | `ManagerReportsPage.jsx` |
| **Lịch sử đăng nhập** (Admin) | Bảng `login_history`: đăng nhập thành công / thất bại (kèm lý do) / đăng xuất, IP, trình duyệt; lỗi ghi lịch sử không chặn đăng nhập | `LoginHistoryService`, `/admin/login-history` |
| Sửa lỗi | L-11, L-13, L-17, L-22 (mục 4); BUG-06 (hoàn tất 1 task hoàn tiền làm SUCCESS mọi REFUND của cơ sở); BUG-07 (No-Show thiếu giao dịch REFUND); I12 (huỷ trả kho đóng nhầm ticket hỗ trợ); log thiếu khi tạo đơn / gán ô (PR-A9) | xem `docs/bug-log.md` |

### 27/10/2026 — Góp ý giảng viên: gia hạn & tối ưu doanh thu ô kho (D-12)
Góp ý: *"ước lượng thời gian gia hạn, ít nhất báo trước 3 ngày mới cho thuê tiếp; gia hạn ngày cuối thì ô phải chưa ai đặt trước"* + nhóm phân tích thêm: với rule cũ, khách quá hạn chiếm ô tới 30 ngày mà cơ sở chỉ thu tối đa 50% cọc (từ ngày 6 coi như ở miễn phí, hàng lưu giữ 60 ngày cũng miễn phí) → khách **có lợi khi cố tình quá hạn**.

| Tầng | Rule | Trước | Sau |
|---|---|---|---|
| 1. Gia hạn báo trước 3 ngày | PR-R10, PR-R11, PR-R12 | Gia hạn được bất cứ lúc nào khi `ACTIVE`/`TERMINATION_PENDING`/`OVERDUE`; ô đang thuê không bao giờ bán trước được | Hạn chót ưu tiên `end_date` − 3. Qua mốc → ô **sắp trống**, khách khác đặt trước được (ngày nhận ≥ ngày giao ô); khách cũ chỉ gia hạn khi chưa ai cần ô (409 `RENEWAL_UNIT_RESERVED`). Tìm kho hiện "Trống từ dd/MM". Tới ngày nhận mà cơ sở chưa có ô → khách huỷ hoàn 100% |
| 2. Phí chiếm dụng | PR-Q14, PR-Q6, PR-O11, PR-O14 | Chỉ phí trễ 10% cọc/ngày, trần 50% cọc | + giá ngày × 150% mỗi ngày quá hạn, **không trần**; trừ cọc sau phí trễ, vượt cọc thành nợ `OVERSTAY_FEE` trả qua VNPAY, chưa trả bị chặn đặt kho |
| 3. Thanh lý sớm | PR-Q8, PR-Q9, PR-14, D-09 | Quá 30 ngày | Quá **15 ngày** (phiên bản chính sách mới); lịch liên hệ 1 · 3 · 7; thanh lý = giải phóng ô, hàng vẫn giữ 60 ngày |
| 4. Phí lưu giữ hàng | PR-Q15, PR-Q10 | Lưu giữ 60 ngày miễn phí | Giá ngày × 20% mỗi ngày lưu giữ; thu từ tiền bán → cọc → tại quầy khi khách nhận lại |

Ví dụ (ô 1.500.000đ/tháng, cọc 1 tháng, khách bỏ mặc kho): **trước** — ô bị giữ ~30 ngày, cơ sở thu 750.000đ; **sau** — ô bị giữ ≤ 15 ngày (và đã bán trước được từ `end_date` − 2), cơ sở thu 750.000đ phí trễ + 15 × 75.000đ = 1.125.000đ phí chiếm dụng (trừ hết cọc, 375.000đ còn lại thành nợ).

Tầng 2–4 chỉ áp dụng cho đơn đặt từ **điều khoản v2** (`reservations.terms_version = 'v2'`); hợp đồng cũ giữ rule cũ (pháp lý: khách chưa đồng ý mức phí mới). Code: `RenewalPolicyService` (mới), `LateFeeService`, `PricingService.quoteRenewal`, `VnpayService.createRenewal`, `ContractService.liquidateContract`, `StaffTaskService.calculateCheckoutRefund`, `HeldGoodsService.resolve`, `ReservationService.countFreeSlots / previewCancel`, `FacilityService` (tìm kho), `BomRevenueService`; FE `ContractOptionsModal`, `CustomerContractPage`, `OverdueContractsPage`, `HeldGoodsPage`, `BomRentalPoliciesPage`, `SearchResultsPage`, `CreateReservationPage`, `AssetTermsModal` (v2).

### 28/10 → 01/11/2026 — Tính năng mới & đồng bộ tài liệu với code
| Hạng mục | Rule | PR |
|---|---|---|
| Lưu mã giao dịch ngân hàng cho giao dịch VNPAY và hoàn tiền | BR-103, PR-O15 | #96 |
| Hoàn tiền chuyển khoản bắt buộc ảnh / link ủy nhiệm chi; nút xem điều khoản ở Kho của tôi | PR-O15 (sửa), BR-102 | #97 |
| Sơ đồ mặt bằng: tầng, kéo thả ô, lối đi, cửa, thang; chọn vị trí khi thêm ô | BR-105 → BR-108 | #98 |
| Khách / Staff xem vị trí ô trên mặt bằng | BR-109 | #99 |
| Chọn ô trên mặt bằng khi gán ô | BR-110 | #100 |
| Đồng bộ SĐT / CCCD nhập lúc đặt kho xuống tài khoản | PR-B5 (sửa) | #101 |
| Thông báo trong ứng dụng | BR-111 → BR-113 | #102 |
| Script Flyway V1 / V2 (chưa kích hoạt) | mục 5 | #103 |

**Đồng bộ tài liệu 01/11/2026** — đối chiếu từng rule với code `96c854a`:
- Cập nhật trạng thái mọi UC (bảng 0.1 và tiêu đề mục). Đổi chú giải: dòng **không đánh dấu** = đã chạy đúng trong code; ⬜ / ⚠️ / 🔸 đánh dấu phần còn lại.
- Sửa rule đã cũ so với code: BR-03, BR-04, BR-32, BR-34, BR-41, BR-42, BR-51, D-08, PR-B5, PR-O15; sơ đồ 2.1 thêm `REFUND_PENDING`, `REFUNDED`, thanh lý đi từ `UNIT_ASSIGNED`.
- Bổ sung rule cho phần đã code nhưng chưa ghi: BR-101 → BR-116, PR-S10, giao việc, tỉ lệ tái ký, trả nợ, chính sách kế thừa ưu đãi.
- Mục 4 tách **còn mở / đã đóng**: 22 mục cũ đã đóng; còn mở L-04, L-09, L-12, L-26 và 8 mục mới L-28 → L-35.
- Thêm thuật ngữ (1.4), bổ sung mã lỗi (mục 6), bảng truy vết rule ↔ test (mục 8).
- **Chốt D-06 (01/11/2026): giữ voucher** — mọi đơn đặt mới giảm cố định 100.000đ (BR-25 khôi phục, PR-B9 bỏ). Còn sửa câu chữ quảng cáo "cho đơn đầu tiên" (L-04).

### 02/11/2026 — Sửa lỗi sau đợt test sản phẩm
| Lỗi phát hiện khi test | Sửa | Rule |
|---|---|---|
| Nút "Tải phiếu biên nhận" không hoạt động | Mở bản in phiếu biên nhận (in / lưu PDF) | BR-120 |
| Chưa có voucher | Bảng `vouchers`, BOM quản lý, khách nhập mã thật; `NEWKHO` thành mã mặc định | BR-24, BR-25 |
| Màn gán ô của FM không xem được chi tiết đơn | Panel chi tiết đơn + API `manager-detail` | BR-119 |
| Chưa gửi mail cho khách | Email kèm mọi thông báo cho khách | BR-117 |
| Chưa demo được nhắc gia hạn | Job nhắc 7 / 3 / 1 ngày + nút giả lập "Còn N ngày" | PR-R9, BR-115 |
| FM nhận thiếu thông báo (hỗ trợ, trả kho, quá hạn…); thông báo mất khi restart, có thông báo giả | Lưu DB, bỏ thông báo mẫu, bổ sung ~20 sự kiện | BR-111, BR-113 |
| Chưa demo được gia hạn task quá hạn | Nút giả lập "Task quá hạn ngay"; gia hạn mở rộng cho task bảo trì (tối đa 7 ngày) | PR-S4, BR-115 |
| Ngày hẹn trả kho nhận cả hôm nay | Từ ngày mai, giờ VN (FE + BE) | PR-O1 |
| BE không kiểm tra cách nhận cọc | 400 `INVALID_REFUND_METHOD` | PR-O3 |
| Mâu thuẫn ân hạn `end_date` + 5 với việc bán ô cho khách mới; job huỷ lịch hẹn của khách quá hạn | Ô sắp trống = ngày hẹn trả + 1; job chuyển `OVERDUE` theo ngày hẹn | PR-R11, PR-Q1, PR-O13 |
| Thiếu rule trả kho sớm trong tháng cuối / trả quá sớm | Bổ sung PR-O2a (tháng cuối không phí phá HĐ), PR-O2b (chưa nhận kho thì huỷ đơn), PR-O2c (kỳ hiện tại) | PR-O2a → PR-O2c |
| Ghi chú bảo trì không hiện | Lưu trên ô, hiện ở danh sách / chi tiết / mặt bằng | PR-M9 |
| "Kho của tôi" ghi chờ hoàn tiền nhưng chi tiết ghi đã hoàn | Một nguồn trạng thái hoàn tiền dùng chung | PR-O12 |

### 04/11/2026 — Góp ý giảng viên (dành cho nhóm cùng đề tài) (D-13)
| # | Góp ý | Hệ thống trước đó | Kết quả | Rule |
|---|---|---|---|---|
| 1 | Khách chọn cứng kho rồi tới nhận → nên để FM gán kho | Đã đúng: khách chỉ chọn cơ sở + loại kho, FM gán ô | Giữ nguyên | D-02, BR-41, BR-42 |
| 2 | Ưu tiên khách cũ + hợp đồng dài, không phải khách mới | Đơn chờ gán ô xếp cũ nhất trước; gói dài chỉ được giảm giá | ✅ Xếp theo điểm ưu tiên khách cũ + gói dài | BR-123 |
| 3 | Sắp hết hạn gửi mail hỏi thuê tiếp; thuê tiếp thì sắp xếp kho; không gắn chết 1 kho cho khách | Đã có nhắc 7 / 3 / 1 ngày + email; khách luôn ở ô cũ | ✅ FM chuyển ô cùng loại (kể cả lúc gia hạn), khách nhận thông báo + email vị trí mới | PR-R9, BR-122 |
| 4 | Quá hạn: báo trước nhiều ngày, tới ngày là dọn, doanh thu quan trọng hơn phạt cọc | Đã có D-12 (phí chiếm dụng không trần, thanh lý 15 ngày) | Giữ nguyên; nhóm chốt **giữ quyền FM miễn phí trễ và thêm cho BOM** (BR-130) | D-11, D-12, BR-130 |
| 5 | Tính phí đẩy hàng lúc xử lý kho quá hạn | Chỉ có phí lưu giữ theo ngày | ✅ Phí dọn & di dời hàng 1 lần khi thanh lý (điều khoản v3) | PR-Q16 |
| 6 | Thuê 6 tháng mà 3 tháng trả: không trả lại tiền; "dùng bao nhiêu trả bấy nhiêu" thì xử lý thế nào | Hoàn theo PR-O2 (thu hồi ưu đãi + phạt 1 tháng) | Giữ PR-O2 — trả lời được cả hai câu (không hoàn phần ưu đãi + mất 1 tháng phí phá HĐ) | D-10, PR-O2 → PR-O2c |
| 7 | Hàng hư / mất do kho (nhiệt độ, chất lượng kho): quy trình, đền bù (gấp đôi?), bảo hiểm, IoT, thanh lý HĐ, trả tiền trước, gọi API bảo hiểm | Chưa có — sự cố lỗi cơ sở chỉ ghi chi phí nội bộ; trang chủ quảng cáo "Bảo hiểm 500 triệu", "20°C" | ✅ Gói bảo hiểm khi đặt kho; hồ sơ bồi thường qua yêu cầu hỗ trợ (kiểm tra → thẩm định → chi trả trước → đòi bảo hiểm qua API mô phỏng); phạt vi phạm 1 tháng thay "đền gấp đôi"; chấm dứt HĐ không phí; cảm biến nhiệt độ mô phỏng; sửa câu chữ trang chủ | D-14, BR-125 → BR-129 |
| 8 | Check-in: khách không đến thì giữ tiền là ổn; check-in online | No-Show giữ 100% cọc; chỉ check-in tại quầy | ✅ Check-in online | D-07, BR-124 |
| 9 | Trả kho: nghiệm thu lấy gì làm bằng chứng để biết lỗi do ai | Chỉ checkbox + tick "khách đã ký"; ảnh chỉ khi có sự cố | ✅ Ảnh hiện trạng bắt buộc lúc nhận và lúc trả, khách xem lại được | BR-121 |

### 05/11/2026 — Họp nhóm (D-15)
| # | Ý kiến họp nhóm | Hệ thống trước đó | Kết quả | Rule |
|---|---|---|---|---|
| 1 | Lúc đặt kho cho chọn loại hàng (dropdown): gia dụng, văn phòng phẩm, thực phẩm (chỉ kho lạnh / kho đông), quần áo, nội thất, điện tử, khác — BOM quản lý; lúc check-in kiểm tra hàng (cấm, cháy nổ) | Không khai báo loại hàng; checklist check-in 5 mục (L-26) | ✅ Danh mục loại hàng do BOM quản lý, loại kho có nhiệt độ thường / lạnh / đông, Staff thấy hàng khai báo + mục 6 kiểm tra hàng | BR-131, BR-132, PR-C7 |
| 2 | Đưa ngày nhận kho lên đầu trang đặt | Ngày nhận kho nằm chung khối thời hạn thuê | ✅ Khối 1 của trang đặt kho | BR-131 |
| 3 | Voucher theo từng loại kho | Voucher chỉ lọc theo cơ sở + gói | ✅ BOM chọn loại kho áp dụng | BR-133 |
| 4 | Nhắc gia hạn 15 / 10 / 7 / 3 / 1 ngày; bỏ ân hạn 5 ngày vì dễ bị lợi dụng; hết hạn thì chuyển hàng vào kho tổng, nhả ô | Nhắc 7 / 3 / 1; ân hạn 5 ngày; thanh lý sau 15 ngày + 3 lần liên hệ | ✅ Mốc mới; hẹn trả chậm nhất `end_date`; điều khoản v4 thanh lý ngay hôm sau, ô giao lại từ `end_date` + 2 | PR-R9, PR-O1, PR-O14, PR-Q1, PR-Q8, PR-R11a |
| 5 | Kho tổng giữ hàng của khách bùng / quá hạn, **không bán**; khách quá hạn xem được thông tin | Hàng lưu giữ 60 ngày rồi bán thanh lý / tiêu huỷ | ✅ Bảng kho tổng do BOM quản lý; không bán / tiêu huỷ cho mọi hợp đồng; khách thấy kho tổng, hotline, số tiền cần trả | PR-Q10, PR-Q15, BR-134 |
| 6 | Trả kho sớm | PR-O2 (thu hồi ưu đãi + phí phá HĐ 1 tháng) | Giữ nguyên | D-10, PR-O2 |

Điều khoản xử lý tài sản lên **v4**; hợp đồng điều khoản cũ giữ luồng thanh lý 15 / 30 ngày nhưng cũng không bị bán hàng. Chạy `sql_script/Update_hop_nhom_05_11.sql` trên DB local (đã gộp vào `QueenKho.sql`, `QueenKho_full.sql`, `QueenKho_TongHop.sql`).

---

## 8. Truy vết rule ↔ kiểm thử

> `./mvnw test` ngày 05/11/2026: **212 test, 0 lỗi** — 27 lớp test, chủ yếu kiểm thử tầng service bằng JUnit 5 + Mockito. Bảng dưới cho biết rule nào đã có test tự động kiểm chứng.

| Lớp test | Số test | Rule được kiểm chứng |
|---|:-:|---|
| `AccessPolicyTest` | 10 | PR-90, ma trận 1.3 (mọi API đều khai báo luật; phạm vi từng vai trò), BR-128 / BR-130 (BOM miễn phí trễ, xem bồi thường; chỉ FM chốt) |
| `AccessControlFilterTest` | 10 | PR-90, BR-03 (thiếu token, khoá giữa phiên, ghi đè `customerId` / `facilityId` theo token) |
| `ReservationServiceTest` | 11 | BR-21, PR-B1, PR-B3, PR-M4, PR-M6, PR-Q12 |
| `NoShowServiceTest` | 8 | BR-51, BR-52, PR-X1, PR-X2, PR-X3 |
| `StaffTaskAssignAndRefundTest` | 14 | Giao việc (UC-16/17), PR-O12, PR-C1, BR-121 (check-in thiếu ảnh), BR-132 (mục 6 kiểm tra hàng) |
| `LecturerFeedbackRulesTest` | 8 | BR-122 (chuyển ô khác loại, hết suất khi đưa ô cũ vào bảo trì, hợp đồng quá hạn), BR-123 (điểm ưu tiên), BR-124 (CCCD sai, ô không đạt, sai chủ hợp đồng), PR-Q16 (chỉ điều khoản v3) |
| `CompensationRulesTest` | 7 | BR-125 (trần bồi thường), BR-127 (lỗi cơ sở / bất khả kháng / lỗi khách, chấm dứt hoàn theo ngày), BR-129 (ngưỡng cảm biến) |
| `MaintenanceTaskTest` | 9 | PR-O10, PR-Q10 (biên bản kiểm kê → hàng ở kho tổng), BR-134 (bắt buộc kho tổng đang hoạt động) |
| `HeldGoodsServiceTest` | 7 | PR-Q10 (không bán / tiêu huỷ → `GOODS_SALE_NOT_ALLOWED`, giao cơ quan chức năng bất cứ lúc nào), PR-Q12, PR-Q15 (v4 tính phí tới ngày nhận lại, v2 chặn 60 ngày) |
| `LateFeePolicyTest` | 6 | PR-Q3, PR-Q5, PR-Q8, PR-Q14, PR-M5, D-12 (điều khoản v1 không tính phí chiếm dụng) |
| `ContractWaiveLateFeeTest` | 8 | Miễn phí trễ (UC-07, UC-28), BR-130 (BOM miễn mọi cơ sở kể cả khi chính sách tắt quyền FM) |
| `PricingServiceTest` | 8 | D-08, BR-24, BR-81, PR-Q6 |
| `RenewalPolicyServiceTest` | 8 | PR-R10, PR-R11 |
| `RentalPolicyServiceTest` | 5 | PR-13, PR-14, D-08 (phiên bản mới kế thừa ưu đãi) |
| `UnitTypeServiceTest` | 8 | PR-M3, PR-M4 |
| `FloorPlanServiceTest` | 10 | BR-105, BR-107 |
| `FacilityStaffServiceTest` | 8 | PR-22, PR-M12, PR-06 |
| `BomRevenueServiceTest` | 7 | PR-M7, BR-103 (đối soát mã FT) |
| `CustomerPaymentServiceTest` | 3 | PR-50 |
| `VnpayDebtPaymentTest` | 6 | PR-50, PR-O9, PR-Q12 |
| `LoginHistoryServiceTest` | 5 | BR-101 |
| `NotificationServiceTest` | 11 | BR-111 → BR-113 (không sinh thông báo mẫu, chống gửi trùng `ref_key`) |
| `BugFixRulesTest` | 6 | PR-O2, PR-O2a, PR-O2b (trả kho sớm), PR-R9 (mốc nhắc 15 / 10 / 7 / 3 / 1), BR-119 (che CCCD) |
| `DemoSimulationServiceTest` | 19 | BR-114 → BR-116, D-15 (không ân hạn khi giả lập khách không tới trả kho; giả lập quá hạn điều khoản v4 chạy luôn bước chuyển kho tổng) |
| `TeamMeetingRulesTest` 🆕 | 5 | BR-131 (bắt buộc loại hàng, thực phẩm cần kho lạnh, "Khác" phải mô tả, loại kho NORMAL / COLD / FROZEN), BR-133 (voucher theo loại kho) |
| `ApiApplicationTests` | 1 | Khởi động ứng dụng + đối chiếu Entity với schema (`ddl-auto: validate`) |

**Rule quan trọng chưa có test tự động** (nên bổ sung nếu còn thời gian): PR-B6 / PR-B7 (giữ chỗ 15 phút, IPN về muộn), BR-27 (chữ ký IPN), PR-C1 + BR-73 (check-in đúng ngày, PIN không trùng), PR-O11 / PR-O14 (quyết toán cọc khi trả kho), PR-Q1 (job quá hạn), BR-25 (điều kiện voucher), PR-Q9 (thanh lý), PR-S2 / PR-S5 / PR-52 (ticket), PR-R12. BR-32 / BR-32a đã có `CancellationPolicyServiceTest`.
