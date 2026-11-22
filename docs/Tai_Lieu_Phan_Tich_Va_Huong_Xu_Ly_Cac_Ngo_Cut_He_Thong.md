# TÀI LIỆU PHÂN TÍCH CÁC NGÕ CỤT NGHIỆP VỤ (DEAD-ENDS) & ĐỀ XUẤT HƯỚNG XỬ LÝ TRONG HỆ THỐNG QUEENKHO

> **Ngày lập:** 22/11/2026  
> **Người thực hiện:** Trọng Hiếu (QueenKho Development Team)  
> **Mục tiêu:** Rà soát toàn bộ các luồng nghiệp vụ trong mã nguồn (Backend & Frontend), nhận diện các trạng thái bị khóa cứng không có lối thoát (ngõ cụt / dead-end) hoặc thiếu nhánh xử lý ngoại lệ, đồng thời đề xuất các phương án giải quyết để thống nhất trước khi tiến hành viết code.

---

## I. TỔNG QUAN CÁC VẤN ĐỀ ĐƯỢC PHÁT HIỆN

Qua quá trình rà soát logic tại các Service cốt lõi (`CheckoutSettlementService`, `StaffTaskService`, `ReservationService`, `ContractService`, `UnitTransferService`, `HeldGoodsService`, `RenewalPolicyService`) và các giao diện quản lý/khách hàng, nhóm phát hiện **06 vấn đề ngõ cụt nghiêm trọng**:

| STT | Vấn đề phát hiện | Module / Nghiệp vụ | Mức độ | Hậu quả nếu không xử lý |
| :--- | :--- | :--- | :---: | :--- |
| **01** | Quyết toán trả kho bị kẹt vĩnh viễn ở `WAITING_CLAIM` khi khách hủy ticket hỗ trợ | Trả kho / Quyết toán / Hỗ trợ | **Nghiêm trọng (Blocker)** | Khách không thể xác nhận bảng quyết toán, không được hoàn cọc, hợp đồng bị treo vĩnh viễn ở `SETTLEMENT_PENDING`. |
| **02** | Khóa chết đơn nhận kho khi task `CHECK_IN` bị `OVERDUE` sau khi đã lập biên bản nháp | Đặt chỗ / Nhận kho / No-Show | **Nghiêm trọng (Blocker)** | Không thể dời lịch (bị lọc mất khỏi tab No-Show), không thể mở lại biên bản nháp (bị chặn 409). Hợp đồng kẹt ở `PENDING_CHECK_IN`. |
| **03** | Lỗi logic ngày hẹn trả kho (Ngày cuối hợp đồng & Dời lịch trả quá hạn) + Thiếu UI gia hạn task `[RECHECK]` | Hợp đồng / Trả kho / Task Board | **Cao** | Khách vào ngày hết hạn hợp đồng không thể bấm trả kho; dời lịch trả khi task trễ hạn bị lỗi logic so sánh ngày; FM không có nút gia hạn task phúc tra `[RECHECK]`. |
| **04** | Yêu cầu gán lại ô gia hạn bị chặn với hợp đồng `OVERDUE` tại Service chuyển ô | Gia hạn / Chuyển ô / Quá hạn | **Cao** | Khách quá hạn (< 5 ngày) xin đổi ô để gia hạn thành công nhưng FM bấm duyệt chuyển ô thì bị chặn lỗi `409 CONTRACT_NOT_TRANSFERABLE`. |
| **05** | Hoàn tiền cọc sau thanh lý bị chặn vĩnh viễn nếu từng có task `REFUND` bị hủy | Hàng lưu giữ / Thanh lý / Hoàn cọc | **Trung bình - Cao** | Hợp đồng thanh lý còn cọc nhưng không thể tạo lệnh hoàn cọc vì câu lệnh đếm task REFUND thiếu điều kiện `status != 'CANCELLED'`. |
| **06** | Lỗ hổng cho phép gia hạn trực tiếp trên ô kho khẩn cấp (`is_emergency = 1`) | Gia hạn / Ô khẩn cấp (BR-140) | **Trung bình** | Khách được cấp ô khẩn cấp có thể gia hạn dài hạn trực tiếp trên ô này, chiếm dụng kho đệm sự cố của chi nhánh. |

---

## II. CHI TIẾT TỪNG VẤN ĐỀ & CÁC HƯỚNG XỬ LÝ ĐỀ XUẤT

---

### VẤN ĐỀ 1: Quyết toán trả kho bị kẹt vĩnh viễn ở `WAITING_CLAIM` khi khách hủy ticket hỗ trợ

#### 1. Hiện tượng & Bản chất lỗi
- **Bối cảnh:** Khi khách hàng hẹn trả kho, nhân viên tiến hành nghiệm thu trả kho. Nếu tại thời điểm này hợp đồng có phát sinh hồ sơ bồi thường hàng hóa (`CompensationClaim`) ở trạng thái đã khảo sát (`INSPECTED`), hệ thống tạo bảng quyết toán trả kho vòng 1 với trạng thái `WAITING_CLAIM` (Chờ quản lý chốt hồ sơ bồi thường để tính tiền).
- **Ngõ cụt xuất hiện khi:**
  1. Khách hàng hủy Ticket hỗ trợ (theo quy định PR-S3a, khách được hủy ticket khi đang mở).
  2. Hàm `CompensationClaimService.withdrawForTicket(ticketId)` cập nhật hồ sơ bồi thường sang trạng thái `WITHDRAWN` (Rút hồ sơ).
  3. **TUY NHIÊN**, hàm này **KHÔNG** hề gọi `checkoutSettlementService.onClaimDecided()`!
  4. Quản lý cơ sở (FM) vào trang bồi thường thì không thể "Chốt" hồ sơ này nữa vì hồ sơ đã ở trạng thái `WITHDRAWN` (FM chỉ chốt được `INSPECTED`).
  5. Bảng quyết toán (`CheckoutSettlement`) mãi mãi dừng ở `WAITING_CLAIM`. Hợp đồng mãi mãi dừng ở `SETTLEMENT_PENDING`. Khách không nhận được tiền cọc hoàn lại, không kết thúc được hợp đồng!

#### 2. Vị trí mã nguồn liên quan
- `backend/api/src/main/java/com/queenkho/api/service/CompensationClaimService.java`:
  ```java
  @Transactional
  public void withdrawForTicket(Integer ticketId) {
      claimRepository.findByTicketId(ticketId).ifPresent(c -> {
          if (List.of("SUBMITTED", "INSPECTED").contains(c.getStatus())) {
              c.setStatus("WITHDRAWN");
              claimRepository.save(c);
              // THIẾU: Không thông báo cho CheckoutSettlementService tính lại quyết toán!
          }
      });
  }
  ```
- `backend/api/src/main/java/com/queenkho/api/service/CheckoutSettlementService.java` (dòng 293): Hàm `onClaimDecided(CompensationClaim claim, Integer managerId)` tính lại quyết toán sang vòng mới.

#### 3. Các hướng xử lý & Quyết định

* **Hướng 1: Tự động tính lại quyết toán ngay khi rút hồ sơ bồi thường**
  - **Cách thực hiện:** Trong `CompensationClaimService.withdrawForTicket()`, sau khi cập nhật `c.setStatus("WITHDRAWN")`, kiểm tra nếu hợp đồng đang có settlement ở `WAITING_CLAIM` thì kích hoạt `checkoutSettlementService.onClaimDecided(c, ticket.getCustomerId())` (với số tiền bồi thường = 0).
  - **Kết quả:** Settlement tự động chuyển sang vòng tiếp theo với trạng thái `WAITING_CUSTOMER` (Chờ khách xác nhận quyết toán mà không còn vướng khoản bồi thường).
  - **Ưu điểm:** Liền mạch, tự động 100%, khách hủy ticket thì quyết toán giải phóng ngay lập tức mà không cần FM can thiệp thủ công.

* **Hướng 2: Bổ sung nút xử lý thủ công cho Quản lý cơ sở (FM)**
  - **Cách thực hiện:** Cho phép FM tại trang Quản lý quyết toán (`ManagerSettlementsPage`) thấy trạng thái cảnh báo "Hồ sơ bồi thường liên quan đã bị rút" và có nút "Tính lại quyết toán bỏ qua bồi thường".
  - **Ưu điểm:** FM kiểm soát được trước khi bảng quyết toán mới được gửi cho khách.
  - **Nhược điểm:** Phải chờ FM thao tác thủ công, nếu FM không để ý thì khách vẫn phải chờ đợi.

* **Hướng 3 (Hybrid - ĐÃ CHỐT THỰC HIỆN): Tự động mở khóa quyết toán + Gửi thông báo cho Quản lý cơ sở**
  - **Cách thực hiện:** 
    1. Khi khách hủy ticket, hồ sơ bồi thường chuyển sang `WITHDRAWN`, hệ thống tự động sinh Round mới cho bảng quyết toán với trạng thái `WAITING_CUSTOMER`, tiền bồi thường = 0đ (giải phóng ngõ cụt 100% cho khách).
    2. Đồng thời, hệ thống tự động gửi thông báo nội bộ cho Quản lý cơ sở (FM): *"Khách hàng đã hủy ticket bồi thường [mã ticket]. Bảng quyết toán HĐ [mã HĐ] đã được tự động tính lại sang trạng thái Chờ khách xác nhận."*
    3. Ghi nhật ký hoạt động (`activity_logs`) rõ ràng lý do chuyển vòng quyết toán.
  - **Ưu điểm:** Đạt được cả hai mục tiêu: Khách không bị kẹt luồng, có thể xác nhận nhận cọc ngay, mà Quản lý cơ sở vẫn luôn được thông báo minh bạch tình trạng tài chính của cơ sở.

👉 **TRẠNG THÁI: [ĐÃ CHỐT PHƯƠNG ÁN HƯỚNG 3 - CHỜ TRIỂN KHAI CODE SAU KHI CHỐT ĐỦ 6 TRƯỜNG HỢP]**

---

### VẤN ĐỀ 2: Đơn nhận kho bị khóa chết khi task `CHECK_IN` bị `OVERDUE` sau khi đã lập biên bản nháp

#### 1. Hiện tượng & Bản chất lỗi
- **Bối cảnh:** Khách đến nhận kho vào ngày hẹn, nhân viên tạo biên bản bàn giao nháp (`CI_DRAFT`) hoặc khách từ chối nhận do sự cố phòng (`CI_REJECT`). Cuối ngày hôm đó hoặc qua hôm sau, task `CHECK_IN` bị chuyển sang trạng thái `OVERDUE`.
- **Ngõ cụt xuất hiện khi:**
  1. Khi task bị `OVERDUE`, nhân viên bị hệ thống khóa không cho hoàn tất bàn giao.
  2. FM vào chi tiết task để bấm "Mở lại biên bản" (`reopenCheckIn`), hệ thống ném lỗi:
     `409 RESCHEDULE_REQUIRED: Task đã quá hạn hoặc không còn mở; cần dời lịch trước`.
  3. Để dời lịch, hệ thống chỉ có API `rescheduleReservation` (UC-31 / No-Show workflow).
  4. Nhưng khi FM vào tab No-Show (`getOverdueNoShowReservations`), đơn này **BỊ LOẠI BỎ KHỎI DANH SÁCH** vì hàm `wasPresentForCheckIn(r)` trả về `true` (do đã có dòng `CI_DRAFT` trong cơ sở dữ liệu)!
  5. **Hậu quả:** FM không thấy đơn trong danh sách No-Show để bấm "Dời lịch". Trên giao diện chi tiết task `CHECK_IN` cũng không có nút dời lịch. Nhân viên không hoàn thành được, khách không nhận được kho, hợp đồng treo vĩnh viễn ở `PENDING_CHECK_IN`.

#### 2. Vị trí mã nguồn liên quan
- `backend/api/src/main/java/com/queenkho/api/service/ReservationService.java` (dòng 417 & 1295):
  `filter(r -> !wasPresentForCheckIn(r))` loại bỏ hoàn toàn các đơn đã có bản ghi `CI_DRAFT`.
- `backend/api/src/main/java/com/queenkho/api/service/StaffTaskService.java` (dòng 1201):
  Hàm `reopenCheckIn` chặn cứng nếu `task.getDueAt() <= now()` và đòi hỏi dời lịch trước.

#### 3. Các hướng xử lý & Quyết định

* **Hướng 1: Cho phép FM dời lịch trực tiếp ngay tại trang chi tiết Task Check-in**
  - **Cách thực hiện:** Khi task `CHECK_IN` bị `OVERDUE`, trên trang chi tiết task (`StaffTaskDetailPage.jsx`), hiển thị cho FM một nút/form **"Dời lịch nhận kho"** (gọi API `/api/reservations/{reservationId}/reschedule`).
  - **Kết quả:** Ngày hẹn của đơn và hợp đồng được cập nhật, hạn chót (`due_at`) của task `CHECK_IN` được dời sang ngày mới, trạng thái task từ `OVERDUE` chuyển lại thành `IN_PROGRESS` (hoặc `OPEN`).
  - **Ưu điểm:** Đúng vị trí ngữ cảnh (FM đang xem task thì xử lý ngay), nhanh chóng.

* **Hướng 2: Sửa điều kiện `wasPresentForCheckIn` trong danh sách No-Show**
  - **Cách thực hiện:** Cho phép các đơn có biên bản nháp dở dang nhưng quá hạn vẫn hiển thị trên tab No-Show ở trang đặt chỗ, nhưng vô hiệu hóa nút phạt No-Show và chỉ cho phép dời lịch.
  - **Ưu điểm:** Tập trung quản lý toàn bộ các đơn quá hạn tại một màn hình.

* **Hướng 3 (Kết hợp Hướng 1 & Hướng 2 - ĐÃ CHỐT THỰC HIỆN): Xử lý trọn vẹn cả trên Task Detail lẫn trên Danh sách Đặt chỗ**
  - **Cách thực hiện:**
    1. **Tại trang Task (`StaffTaskDetailPage.jsx`):** FM có nút/khối **"Dời lịch nhận kho"** ngay trên task quá hạn để xử lý tại chỗ và mở khóa task ngay lập tức.
    2. **Tại trang Đặt kho (`PendingReservationsPage.jsx`):** Vẫn hiển thị các đơn này với badge cảnh báo rõ ràng: *"Đang làm thủ tục dở dang"*, đồng thời **khóa nút phạt No-Show** và **bật nút Dời lịch** để FM xử lý từ danh sách đơn.
  - **Ưu điểm:** Triệt tiêu hoàn toàn ngõ cụt ở cả 2 luồng tiếp cận của Quản lý cơ sở (từ màn hình Công việc hoặc từ màn hình Quản lý đơn đặt kho), không thể xảy ra tình trạng sót đơn.

👉 **TRẠNG THÁI: [ĐÃ CHỐT PHƯƠNG ÁN HƯỚNG 3 - CHỜ TRIỂN KHAI CODE SAU KHI CHỐT ĐỦ 6 TRƯỜNG HỢP]**

---

### VẤN ĐỀ 3: Lỗi logic ngày hẹn trả kho & Thiếu UI gia hạn cho Task `[RECHECK]`

#### 1. Hiện tượng & Bản chất lỗi
Vấn đề này gồm 3 lỗi logic liên quan đến thời gian và giao diện trong luồng trả kho:
- **Lỗi 3A (Toán tử ngày bất khả thi vào ngày cuối hợp đồng):**
  - Theo quy tắc `PR-O1`: Hẹn trả kho phải từ ngày mai trở đi (`checkoutDate.isAfter(today)`).
  - Đồng thời với hợp đồng `ACTIVE`, ngày hẹn trả không được vượt quá ngày kết thúc (`checkoutDate.isBeforeOrEqual(contract.getEndDate())`).
  - **Ngõ cụt:** Nếu hôm nay chính là ngày kết thúc hợp đồng (`today == contract.getEndDate()`), điều kiện trở thành: Ngày chọn phải `> today` VÀ `<= today`. Đây là **phép toán vô nghiệm**! Khách hàng vào đúng ngày cuối hạn của mình hoàn toàn không thể gửi yêu cầu trả kho!
- **Lỗi 3B (Dời lịch trả kho bị chặn khi task trước đó quá hạn):**
  - Khi hợp đồng đang `TERMINATION_PENDING`, nếu khách đã từng hẹn một ngày nhưng ngày đó trôi qua mà nhân viên chưa nghiệm thu (task `CHECK_OUT` thành `OVERDUE`):
  - Logic dòng 169 `ContractService.java`: `if (checkoutDate.isAfter(prevCheckoutDate)) throw Exception`.
  - Vì `prevCheckoutDate <= today`, nên mọi ngày mới trong tương lai (`> today`) đều `> prevCheckoutDate`. Khách bị chặn vĩnh viễn không thể dời ngày trả kho mới!
- **Lỗi 3C (Thiếu nút "Gia hạn xử lý" cho Task `CHECK_OUT [RECHECK]`):**
  - Khi khách hàng khiếu nại kết quả nghiệm thu trả kho, hệ thống sinh ra task phúc tra `CHECK_OUT` có tiền tố ghi chú `[RECHECK]`.
  - Backend `StaffTaskService.java` (dòng 1935) đã hỗ trợ cho phép FM gia hạn task này nếu bị quá hạn (`recheck == true`).
  - Nhưng trên Frontend (`ManagerTaskBoardPage.jsx` và `StaffTaskDetailPage.jsx`), nút "Gia hạn xử lý" lại bị code cứng chỉ dành cho `taskType === 'SUPPORT'` hoặc `taskType === 'MAINTENANCE'`. Dẫn đến FM không có nút để bấm gia hạn trên giao diện!

#### 2. Vị trí mã nguồn liên quan
- `backend/api/src/main/java/com/queenkho/api/service/ContractService.java` (dòng 142, 169-178): Kiểm tra ngày hẹn trả kho `requestCheckout`.
- `frontend/src/pages/manager/ManagerTaskBoardPage.jsx` (dòng 466, 520): Điều kiện hiển thị nút gia hạn task quá hạn.
- `frontend/src/pages/staff/StaffTaskDetailPage.jsx` (dòng 2235): Điều kiện hiển thị form gia hạn task.

#### 3. Các hướng xử lý & Quyết định chi tiết (ĐÃ CHỐT VỚI USER)

* **Đối với 3A & 3B (Hẹn trả kho ngày cuối HĐ & Dời lịch khi lịch cũ đã qua):**
  - **Quy tắc thời gian:** Khách được phép hẹn ngày trả kho trễ hơn hạn hợp đồng, nhưng **trễ tối đa 5 ngày** kể từ ngày hết hạn hợp đồng.  
    *(Lý do: Sau ngày thứ 5 quá hạn, theo quy trình cưỡng chế Flow 6, kho sẽ bị niêm phong, hàng hóa tự động được dọn chuyển vào kho tổng. Khách lúc đó bắt buộc phải làm theo luồng lấy lại hàng từ kho tổng và thanh toán các chi phí lưu kho tổng).*
  - **Giao diện hiển thị chiết tính phí trễ (UI Breakdown):** Khi khách chọn ngày trả kho trễ hơn hạn hợp đồng (trong khung 5 ngày cho phép), modal trả kho/dời ngày **bắt buộc phải hiển thị rõ ràng và đầy đủ bảng tính phí phạt trễ** tương tự như phần chiết tính phí phạt trả sớm. Bảng chiết tính gồm:
    - Số ngày trễ dự kiến
    - Phí trễ hạn: 10% cọc / ngày (tối đa 50% cọc)
    - Phí chiếm dụng ô: 150% giá thuê ngày $\times$ số ngày trễ (với giá thuê ngày = giá thuê tháng / 30)
    - Dự kiến số tiền cọc còn lại sau khi khấu trừ (hoặc khoản tiền cần thanh toán thêm nếu âm cọc).

* **Đối với 3C (Nút gia hạn task `[RECHECK]` và Hệ thống thông báo/Email):**
  - **Cập nhật giao diện:** Bổ sung nút và form "Gia hạn xử lý" cho task phúc tra `CHECK_OUT [RECHECK]` trên cả `ManagerTaskBoardPage.jsx` và `StaffTaskDetailPage.jsx`.
  - **Bắn chuông thông báo (In-app Notification):** Khi FM gia hạn bất kỳ task nào (áp dụng đồng bộ cho `CHECK_OUT [RECHECK]`, `SUPPORT`, `MAINTENANCE`), hệ thống tự động bắn chuông thông báo cho **cả Nhân viên được giao task lẫn Khách hàng liên quan**, ghi rõ nội dung: Task đã được gia hạn dời sang ngày bao nhiêu, kèm lý do gia hạn.
  - **Gửi Email thông báo:** Hệ thống tự động gửi email cho cả Nhân viên và Khách hàng với đầy đủ thông tin: Mã task / Mã hợp đồng, hạn hoàn thành mới (ngày giờ cụ thể), người phê duyệt gia hạn và lý do gia hạn.

👉 **TRẠNG THÁI: [ĐÃ CHỐT CHI TIẾT - CHỜ TRIỂN KHAI CODE SAU KHI CHỐT ĐỦ 6 TRƯỜNG HỢP]**

---

### VẤN ĐỀ 4: Yêu cầu gán lại ô gia hạn bị chặn với hợp đồng `OVERDUE` tại Service chuyển ô

#### 1. Hiện tượng & Bản chất lỗi
- **Bối cảnh:** Ở chức năng gia hạn vừa phát triển, khách hàng có hợp đồng sắp hết hạn hoặc đã quá hạn (< 5 ngày) nếu bị trùng lịch ô kho (có người khác đã đặt trước) thì có thể gửi yêu cầu FM gán lại ô kho khác để tiếp tục gia hạn (`renewal-reassign-request`).
- **Ngõ cụt xuất hiện khi:**
  1. Hợp đồng của khách ở trạng thái `OVERDUE` (quá hạn 1–4 ngày, vẫn được phép gia hạn theo chính sách PR-R1/PR-R3 nếu nộp phạt trễ hạn).
  2. Khách gửi yêu cầu gán ô khác thành công.
  3. FM mở danh sách hợp đồng, thấy yêu cầu và bấm "Chuyển ô & duyệt gia hạn" (`transferUnit`).
  4. Hàm `UnitTransferService.transferUnit()` kiểm tra trạng thái hợp đồng:
     ```java
     static final List<String> TRANSFERABLE_STATUSES = List.of("PENDING_CHECK_IN", "ACTIVE", "TERMINATION_PENDING");
     if (!TRANSFERABLE_STATUSES.contains(contract.getStatus())) {
         throw new ContractException(HttpStatus.CONFLICT, "CONTRACT_NOT_TRANSFERABLE", ...);
     }
     ```
  5. **Hậu quả:** Vì `TRANSFERABLE_STATUSES` không có `OVERDUE`, request bị ném lỗi `409 CONTRACT_NOT_TRANSFERABLE`. FM hoàn toàn không thể thực hiện việc đổi ô cho khách quá hạn theo yêu cầu!

#### 2. Vị trí mã nguồn liên quan
- `backend/api/src/main/java/com/queenkho/api/service/UnitTransferService.java` (dòng 43 và dòng 181).

#### 3. Các hướng xử lý & Quyết định (ĐÃ CHỐT VỚI USER)

* **Hướng 1 (ĐÃ CHỐT THỰC HIỆN): Mở rộng `TRANSFERABLE_STATUSES` cho hợp đồng `OVERDUE` có yêu cầu gia hạn**
  - **Cách thực hiện:** Cho phép `UnitTransferService.transferUnit()` chuyển ô đối với hợp đồng `OVERDUE` khi thỏa mãn:
    1. Hợp đồng có yêu cầu gán ô gia hạn đang ở trạng thái `PENDING` (`"PENDING".equals(contract.getReassignRequestStatus())`).
    2. Hợp đồng chưa bị thanh lý cưỡng chế dọn kho (`daysOverdue <= 5` và chưa có task bảo trì dọn kho).
  - **Kết quả:** FM thực hiện gán ô mới thành công. Toàn bộ tiền phạt trễ hạn tích lũy được tự động gộp vào hóa đơn thanh toán gia hạn của khách. Khi khách thanh toán qua VNPAY, hợp đồng tự động khôi phục về `ACTIVE`.
  - **Ưu điểm:** Liền mạch 100%, bảo vệ quyền lợi chính đáng của khách hàng, đảm bảo doanh thu cho cơ sở và cứu được hợp đồng không bị thanh lý oan.

* **Hướng 2: Bắt buộc khách phải đóng phạt trễ hạn trước khi xin đổi ô**
  - *(Phương án bị loại bỏ do trải nghiệm người dùng kém và rủi ro khách đóng phạt xong bị hết ô).*

👉 **TRẠNG THÁI: [ĐÃ CHỐT PHƯƠNG ÁN HƯỚNG 1 - CHỜ TRIỂN KHAI CODE SAU KHI CHỐT ĐỦ 6 TRƯỜNG HỢP]**

---

### VẤN ĐỀ 5: Hoàn tiền cọc sau thanh lý bị chặn vĩnh viễn nếu từng có task `REFUND` bị hủy

#### 1. Hiện tượng & Bản chất lỗi
- **Bối cảnh:** Hợp đồng quá hạn 5 ngày bị cưỡng chế dọn kho (`LIQUIDATED`). Sau khi trừ các chi phí dọn kho, di dời, nếu tiền cọc vẫn còn dư (`deposit_held_amount > 0`), FM có quyền bấm "Yêu cầu hoàn cọc còn lại" (`refundRemainingDeposit`) để tạo task hoàn trả cho khách.
- **Ngõ cụt xuất hiện khi:**
  1. Trong quá khứ của hợp đồng đó, từng phát sinh 1 task `REFUND` nhưng đã bị hủy (ví dụ: khách từng hẹn trả kho rồi lại hủy hẹn trả kho, khiến task `REFUND` chuyển sang trạng thái `CANCELLED`). Hoặc FM tạo nhầm và hủy task.
  2. Khi FM bấm yêu cầu hoàn cọc còn lại sau thanh lý, câu truy vấn SQL kiểm tra như sau:
     ```java
     Integer existingTasks = jdbcTemplate.queryForObject(
         "SELECT COUNT(1) FROM facility_tasks WHERE contract_id = ? AND task_type = 'REFUND'",
         Integer.class, contractId
     );
     if (existingTasks != null && existingTasks > 0) {
         throw new ContractException(HttpStatus.CONFLICT, "REFUND_ALREADY_REQUESTED", "Đã có yêu cầu hoàn cọc cho hợp đồng này trước đó");
     }
     ```
  3. Tương tự tại `HeldGoodsService.java` (dòng 346):
     ```java
     Integer refundTasks = jdbcTemplate.queryForObject(
         "SELECT COUNT(1) FROM facility_tasks WHERE contract_id = ? AND task_type = 'REFUND'", Integer.class, contract.getId());
     return refundTasks == null || refundTasks == 0;
     ```
  4. **Hậu quả:** Câu SQL đếm cả các task có `status = 'CANCELLED'`. Khách hàng thực tế chưa từng nhận được 1 đồng cọc nào, nhưng FM bị chặn vĩnh viễn với thông báo "Đã có yêu cầu hoàn cọc trước đó". Tiền cọc của khách bị kẹt lại trong hệ thống không thể tạo task chi trả!

#### 2. Vị trí mã nguồn liên quan
- `backend/api/src/main/java/com/queenkho/api/service/ContractService.java` (dòng 1173).
- `backend/api/src/main/java/com/queenkho/api/service/HeldGoodsService.java` (dòng 346).

#### 3. Hướng xử lý & Quyết định (ĐÃ CHỐT VỚI USER)
- Cập nhật câu lệnh SQL kiểm tra:
  ```sql
  SELECT COUNT(1) FROM facility_tasks 
  WHERE contract_id = ? AND task_type = 'REFUND' AND status != 'CANCELLED'
  ```
  áp dụng tại:
  1. `ContractService.java` (dòng 1174, hàm `refundRemainingDeposit`)
  2. `HeldGoodsService.java` (dòng 346, hàm `includeRemainingDeposit`)
- **Kết quả:** Các task đã bị hủy trong quá khứ không làm ảnh hưởng đến quyền được hoàn cọc hợp pháp của khách sau thanh lý.

👉 **TRẠNG THÁI: [ĐÃ CHỐT SỬA ĐIỀU KIỆN SQL - CHỜ TRIỂN KHAI CODE SAU KHI CHỐT ĐỦ 6 TRƯỜNG HỢP]**

---

### VẤN ĐỀ 6: Lỗ hổng cho phép gia hạn trực tiếp trên ô kho khẩn cấp (`is_emergency = 1`)

#### 1. Hiện tượng & Bản chất lỗi
- **Bối cảnh:** Theo quy tắc BR-140: Ô kho khẩn cấp (`is_emergency = 1`) là kho dự phòng kỹ thuật của cơ sở, chỉ dùng để cứu hộ tạm thời khi ô của khách gặp sự cố (dột, hỏng khóa, sửa chữa lớn). Ô khẩn cấp **không được cho thuê lâu dài hoặc bán thương mại**.
- **Lỗ hổng xuất hiện khi:**
  1. Khách hàng được chuyển tạm sang ô khẩn cấp.
  2. Đến kỳ gia hạn hợp đồng, hàm `RenewalPolicyService.checkEligibility(contract)` kiểm tra xem ô kho hiện tại có bị ai đặt trước hay không.
  3. Vì ô khẩn cấp bị lọc bỏ khỏi danh mục tìm kiếm đặt phòng của khách mới (`WHERE su.is_emergency = 0`), nên ô khẩn cấp **luôn luôn không có xung đột lịch**.
  4. Hệ thống báo khách hàng đủ điều kiện gia hạn và cho phép khách thanh toán tiếp 1, 3, 6, 12 tháng trực tiếp trên ô khẩn cấp này!
  5. **Hậu quả:** Ô kho khẩn cấp bị chiếm dụng thương mại dài hạn. Cơ sở mất khoang dự phòng khi các khách hàng khác gặp sự cố khẩn cấp.

#### 2. Vị trí mã nguồn liên quan
- `backend/api/src/main/java/com/queenkho/api/service/RenewalPolicyService.java` (dòng 166-210).

#### 3. Các hướng xử lý & Quyết định chi tiết (ĐÃ CHỐT VỚI USER)

* **Quy trình tối ưu (ĐÃ CHỐT THỰC HIỆN): Khách gia hạn bình thường; Trách nhiệm điều phối ô chuyển giao về Task Bảo trì (`MAINTENANCE`) của Staff & FM**
  - **1. Phía Khách hàng (Gia hạn hợp đồng liền mạch):**
    - Khi hợp đồng đang lưu trữ tạm ở ô khẩn cấp (`is_emergency = 1`), khách hàng **vẫn được phép gia hạn hợp đồng bình thường** theo loại kho và mức giá gốc đã đặt (`bookedType`).
    - Khách không bị chặn luồng gia hạn, không phải tự làm đơn xin đổi kho.
    - Giao diện gia hạn hiển thị ghi chú minh bạch:  
      *"Hợp đồng của bạn đang được cơ sở hỗ trợ lưu trữ tạm thời tại khoang sự cố; mức giá và quyền lợi giữ nguyên theo loại kho bạn đã đặt."*
  - **2. Phía Nhân viên kỹ thuật (Staff - Task Bảo trì):**
    - Trách nhiệm theo dõi tiến độ sửa chữa ô kho gốc thuộc về Staff đang giữ Task `MAINTENANCE`.
    - Nếu sửa chữa nhanh: Staff sửa xong, bấm "Hoàn tất bảo trì" $\rightarrow$ dọn đồ về lại kho cũ $\rightarrow$ giải phóng ô khẩn cấp.
    - Nếu phát hiện **sự cố kéo dài** (hỏng hóc nặng, cần nhiều thời gian sửa):
      - Tại trang chi tiết task [StaffTaskDetailPage.jsx](file:///H:/Study/New%20folder/frontend/src/pages/staff/StaffTaskDetailPage.jsx), Staff có nút hành động: **"Báo cáo sự cố kéo dài & Yêu cầu FM đổi kho cho khách"**.
      - Staff nhập mô tả tình trạng hư hỏng và gửi đề xuất cho FM.
  - **3. Phía Quản lý cơ sở (FM - Phê duyệt chuyển kho chính thức):**
    - FM nhận thông báo và thấy yêu cầu chuyển kho trên task bảo trì.
    - FM bấm duyệt đổi kho $\rightarrow$ Mở modal chọn ô kho (`TransferUnitModal`), chọn một ô kho tiêu chuẩn cùng loại đang trống để chuyển vĩnh viễn hợp đồng của khách sang ô mới này.
    - Hợp đồng của khách được cập nhật sang ô tiêu chuẩn mới, gửi thông báo cho khách.
    - Nhân viên hỗ trợ chuyển đồ từ ô khẩn cấp sang ô tiêu chuẩn mới $\rightarrow$ **Ô khẩn cấp được giải phóng lập tức về quỹ dự phòng kỹ thuật (BR-140)**.
  - **Ưu điểm vượt trội:**
    - Trải nghiệm khách hàng xuất sắc (Customer-Centric), không làm phiền khách.
    - Chủ động giải phóng ô khẩn cấp sớm bất cứ lúc nào, không cần chờ đến khi hợp đồng hết hạn.
    - Đồng bộ 100% với kiến trúc phân quyền và các luồng yêu cầu đổi kho khác trong hệ thống.

👉 **TRẠNG THÁI: [ĐÃ CHỐT PHƯƠNG ÁN THEO Ý KIẾN CỦA USER - CHỜ TRIỂN KHAI CODE]**

---

## III. BẢNG TỔNG HỢP CÁC QUYẾT ĐỊNH ĐÃ THỐNG NHẤT 100% (6/6 VẤN ĐỀ)

Toàn bộ 6 vấn đề nghiệp vụ đã được thảo luận chi tiết và chốt phương án xử lý cuối cùng:

| STT | Vấn đề phát hiện | Phương án giải quyết đã chốt | Trạng thái |
| :---: | :--- | :--- | :---: |
| **01** | Kẹt `WAITING_CLAIM` khi khách hủy ticket | **Hướng 3 (Hybrid):** Tự động sinh vòng mới chuyển sang `WAITING_CUSTOMER` (tiền bồi thường = 0đ) để khách xác nhận nhận cọc ngay + Bắn thông báo nội bộ cho Quản lý cơ sở (FM). | **[X] ĐÃ CHỐT** |
| **02** | Kẹt task Check-in `OVERDUE` dở dang | **Hướng 3 (Kết hợp):** Thêm nút/khối **"Dời lịch nhận kho"** ngay trên chi tiết Task (`StaffTaskDetailPage`) + Mở nút Dời lịch trên tab Đơn đặt kho (`PendingReservationsPage`) kèm badge "Đang bàn giao dở dang" (khóa nút phạt No-Show). | **[X] ĐÃ CHỐT** |
| **03** | Toán tử ngày trả kho (3A, 3B) & Task `[RECHECK]` (3C) | **Xử lý trọn gói:**<br>- **3A & 3B:** Cho phép khách hẹn ngày trả kho trễ tối đa **5 ngày** sau hạn hợp đồng; Popup hiển thị đầy đủ bảng chiết tính phí phạt trễ (10%/ngày + chiếm dụng 150%/ngày).<br>- **3C:** Bổ sung nút/form Gia hạn task `CHECK_OUT [RECHECK]` trên Frontend + Tự động bắn chuông thông báo & gửi email cho cả Khách hàng và Staff (ghi rõ dời qua ngày bao nhiêu, áp dụng cho mọi task gia hạn). | **[X] ĐÃ CHỐT** |
| **04** | Yêu cầu đổi ô gia hạn bị chặn với HĐ `OVERDUE` | **Hướng 1:** Mở rộng quyền chuyển ô (`transferUnit`) cho hợp đồng `OVERDUE` khi có yêu cầu gán ô gia hạn đang ở trạng thái `PENDING` (chưa thanh lý dọn kho). Tiền phạt trễ tự động tích lũy vào hóa đơn gia hạn. | **[X] ĐÃ CHỐT** |
| **05** | Hoàn cọc sau thanh lý bị chặn bởi task `REFUND` đã hủy | Thêm điều kiện `AND status != 'CANCELLED'` vào 2 câu SQL đếm task REFUND tại `ContractService.java` (dòng 1174) và `HeldGoodsService.java` (dòng 346). | **[X] ĐÃ CHỐT** |
| **06** | Lỗ hổng gia hạn trực tiếp trên ô kho khẩn cấp | **Theo hướng của User:** Khách vẫn được gia hạn hợp đồng bình thường theo giá loại kho đã đặt. Trách nhiệm đổi ô thuộc về Task Bảo trì (`MAINTENANCE`): Staff thấy sửa kho lâu bấm nút **"Yêu cầu FM đổi kho cho khách"** $\rightarrow$ FM duyệt chuyển sang ô tiêu chuẩn mới $\rightarrow$ Giải phóng ô khẩn cấp về quỹ dự phòng. | **[X] ĐÃ CHỐT** |

---

## IV. KẾ HOẠCH TRIỂN KHAI MÃ NGUỒN

Sau khi toàn bộ 6 phương án đã được thống nhất, các bước tiếp theo sẽ bao gồm:
1. **Chỉnh sửa Backend:**
   - `CompensationClaimService.java` & `CheckoutSettlementService.java` (Vấn đề 1).
   - `ReservationService.java` & `StaffTaskService.java` (Vấn đề 2, 3C).
   - `ContractService.java` (Vấn đề 3A, 3B, 5).
   - `UnitTransferService.java` (Vấn đề 4, 6).
   - `HeldGoodsService.java` (Vấn đề 5).
   - `RenewalPolicyService.java` (Vấn đề 6).
   - Bổ sung logic gửi Notification & Email khi gia hạn task (Vấn đề 3C).
2. **Chỉnh sửa Frontend:**
   - `StaffTaskDetailPage.jsx` (Vấn đề 2, 3C, 6: Form dời lịch check-in, form gia hạn recheck, nút yêu cầu FM đổi kho cho task bảo trì).
   - `PendingReservationsPage.jsx` (Vấn đề 2: Hiển thị đơn dở dang quá hạn, mở nút dời lịch, khóa nút No-Show).
   - `ContractOptionsModal.jsx` / `CheckoutModal` (Vấn đề 3A, 3B: Cho phép chọn trễ tối đa 5 ngày + hiển thị chiết tính phí trễ hạn).
   - `ManagerTaskBoardPage.jsx` (Vấn đề 3C: Hiển thị nút gia hạn cho task recheck).
3. **Kiểm thử toàn diện:**
   - Chạy toàn bộ Maven Unit Tests backend (`mvn test`).
   - Chạy build frontend (`npm run build`).
4. **Cam kết tuân thủ chỉ đạo của User:**
   - **Tuyệt đối KHÔNG commit hay push lên Git** sau khi code xong. Chờ lệnh kiểm tra và chỉ đạo tiếp theo của người dùng.
