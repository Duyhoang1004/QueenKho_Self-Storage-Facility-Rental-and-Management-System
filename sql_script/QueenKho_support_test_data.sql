/* ==============================================================================================
   QueenKho — BỘ DỮ LIỆU TEST MẪU ĐẦY ĐỦ CÁC LUỒNG HỖ TRỢ (SUPPORT FLOWS TEST DATA)
   Mục đích: Phục vụ Demo, Kiểm thử toàn diện và Trả lời Vấn đáp Hội đồng tốt nghiệp.
   Tất cả các luồng được chuẩn bị sẵn trạng thái, có thể chạy lại nhiều lần (Idempotent).

   Cách chạy qua CMD / PowerShell:
   sqlcmd -S localhost -U sa -P 12345 -d QueenKhoDB -I -f 65001 -i sql_script/QueenKho_support_test_data.sql
   ============================================================================================== */

USE QueenKhoDB;
GO

SET NOCOUNT ON;
PRINT N'==> [BẮT ĐẦU] Nạp dữ liệu test mẫu cho toàn bộ các luồng Hỗ trợ (Support)...';

-- 1. LẤY CÁC THÔNG TIN CƠ SỞ VÀ TÀI KHOẢN MẪU TẠI QUEENKHO TÂN BÌNH (facility_id = 1)
DECLARE @facId INT = 1;
DECLARE @now DATETIME2 = SYSDATETIME();
DECLARE @today DATE = CAST(@now AS DATE);

-- Lấy tài khoản nhân viên & quản lý cơ sở
DECLARE @staff1 INT = (SELECT TOP 1 id FROM users WHERE email = 'stafftanbinh1@gmail.com');
DECLARE @staff2 INT = (SELECT TOP 1 id FROM users WHERE email = 'stafftanbinh2@gmail.com');
DECLARE @staff3 INT = (SELECT TOP 1 id FROM users WHERE email = 'stafftanbinh3@gmail.com');
DECLARE @fmId   INT = (SELECT TOP 1 id FROM users WHERE email = 'fmtanbinh@gmail.com');

-- Lấy hợp đồng hoạt động (ACTIVE) của cơ sở Tân Bình
DECLARE @contract1 INT = (SELECT TOP 1 id FROM rental_contracts WHERE status = 'ACTIVE' AND contract_code = 'HD-F7-01');
DECLARE @contract2 INT = (SELECT TOP 1 id FROM rental_contracts WHERE status = 'ACTIVE' AND contract_code = 'HD-F7-02');
DECLARE @contract3 INT = (SELECT TOP 1 id FROM rental_contracts WHERE status = 'ACTIVE' AND contract_code = 'HD-F7-03');
DECLARE @contract5 INT = (SELECT TOP 1 id FROM rental_contracts WHERE status = 'ACTIVE' AND contract_code = 'HD-F7-05');

-- Nếu thiếu hợp đồng mẫu thì tự động lấy các hợp đồng ACTIVE bất kỳ
IF @contract1 IS NULL SELECT TOP 1 @contract1 = id FROM rental_contracts WHERE status = 'ACTIVE';
IF @contract2 IS NULL SELECT TOP 1 @contract2 = id FROM rental_contracts WHERE status = 'ACTIVE' AND id <> @contract1;
IF @contract3 IS NULL SELECT TOP 1 @contract3 = id FROM rental_contracts WHERE status = 'ACTIVE' AND id NOT IN (@contract1, @contract2);
IF @contract5 IS NULL SELECT TOP 1 @contract5 = id FROM rental_contracts WHERE status = 'ACTIVE' AND id NOT IN (@contract1, @contract2, @contract3);

-- Lấy customerId tương ứng với từng hợp đồng
DECLARE @cust1 INT = (SELECT customer_id FROM rental_contracts WHERE id = @contract1);
DECLARE @cust2 INT = (SELECT customer_id FROM rental_contracts WHERE id = @contract2);
DECLARE @cust3 INT = (SELECT customer_id FROM rental_contracts WHERE id = @contract3);
DECLARE @cust5 INT = (SELECT customer_id FROM rental_contracts WHERE id = @contract5);

-- 2. DỌN DẸP DỮ LIỆU TEST CŨ (Nếu đã chạy trước đó)
DELETE FROM compensation_claims WHERE claim_code LIKE 'BT-TEST-%';
DELETE FROM facility_tasks WHERE support_request_id IN (SELECT id FROM support_requests WHERE ticket_code LIKE 'SR-TEST-%');
DELETE FROM support_requests WHERE ticket_code LIKE 'SR-TEST-%';
PRINT N'==> [CLEANUP] Đã dọn dẹp các ticket test SR-TEST-* cũ thành công.';

-- ==============================================================================================
-- LUỒNG 1: SỰ CỐ KHÓA Ô KHO & MÃ PIN (LOCK_ISSUE) - TEST NÚT CẤP LẠI MÃ PIN
-- Trạng thái: Ticket OPEN, Task IN_PROGRESS (giao cho Staff Tân Bình 1).
-- Hành vi test: Staff vào task, bấm "Cấp lại mã PIN ngẫu nhiên", PIN hợp đồng được đổi mới.
-- ==============================================================================================
INSERT INTO support_requests (ticket_code, contract_id, customer_id, issue_type, sub_category, description, status, created_at)
VALUES ('SR-TEST-LOCK01', @contract1, @cust1, 'LOCK_ISSUE', N'Quên mã PIN SmartLock', 
        N'Tôi quên mã PIN mở khóa kho, bàn phím không mở được, nhờ nhân viên cấp lại mã PIN mới giúp tôi.', 
        'OPEN', DATEADD(MINUTE, -45, @now));
DECLARE @t_lock1 INT = SCOPE_IDENTITY();

INSERT INTO facility_tasks (facility_id, task_type, contract_id, support_request_id, status, staff_id, due_at, note, created_at, claimed_at)
VALUES (@facId, 'SUPPORT', @contract1, @t_lock1, 'IN_PROGRESS', @staff1, 
        DATEADD(HOUR, 21, CAST(@today AS DATETIME2)),
        N'[KHẨN] [SR-TEST-LOCK01] Sự cố khóa / Mã PIN [Quên mã PIN SmartLock]: Tôi quên mã PIN mở khóa kho...',
        DATEADD(MINUTE, -45, @now), DATEADD(MINUTE, -30, @now));

-- ==============================================================================================
-- LUỒNG 2: SỰ CỐ KHÓA Ô KHO (LOCK_ISSUE) - BÀN PHÍM LIỆT / HẾT PIN (CHỜ NHẬN VIỆC)
-- Trạng thái: Ticket OPEN, Task OPEN (Chờ nhận việc).
-- Hành vi test: Staff vào tab "Chờ nhận" trên Bảng công việc, bấm "Nhận việc" -> Chuyển IN_PROGRESS.
-- ==============================================================================================
INSERT INTO support_requests (ticket_code, contract_id, customer_id, issue_type, sub_category, description, status, created_at)
VALUES ('SR-TEST-LOCK02', @contract2, @cust2, 'LOCK_ISSUE', N'Bàn phím khóa SmartLock không phản hồi / liệt phím', 
        N'Khóa điện tử bấm phím số không sáng đèn và không có tiếng kêu bip, nghi ngờ khóa bị hết pin.', 
        'OPEN', DATEADD(MINUTE, -20, @now));
DECLARE @t_lock2 INT = SCOPE_IDENTITY();

INSERT INTO facility_tasks (facility_id, task_type, contract_id, support_request_id, status, staff_id, due_at, note, created_at)
VALUES (@facId, 'SUPPORT', @contract2, @t_lock2, 'OPEN', NULL, 
        DATEADD(HOUR, 21, CAST(@today AS DATETIME2)),
        N'[KHẨN] [SR-TEST-LOCK02] Sự cố khóa / Mã PIN [Bàn phím khóa SmartLock không phản hồi / liệt phím]: Khóa điện tử bấm không sáng...',
        DATEADD(MINUTE, -20, @now));

-- ==============================================================================================
-- LUỒNG 3: HƯ HỎNG HẠ TẦNG (FACILITY_DAMAGE) - NHÁNH 1: SỬA CHỮA XONG TẠI CHỖ (FIXED)
-- Trạng thái: Đang xử lý (IN_PROGRESS), Staff Tân Bình 1 phụ trách.
-- Hành vi test: Chọn "Đã khắc phục xong tại chỗ (FIXED)", điền biên bản demo nghiệm thu đạt chuẩn -> Bấm Hoàn tất -> Ticket RESOLVED.
-- ==============================================================================================
INSERT INTO support_requests (ticket_code, contract_id, customer_id, issue_type, sub_category, description, status, created_at)
VALUES ('SR-TEST-FAC01', @contract1, @cust1, 'FACILITY_DAMAGE', N'Đèn chiếu sáng bị cháy / chập', 
        N'Bóng đèn LED chiếu sáng trước cửa ô kho bị nhấp nháy liên tục rồi tắt hẳn, khu vực rất tối.', 
        'OPEN', DATEADD(HOUR, -2, @now));
DECLARE @t_fac1 INT = SCOPE_IDENTITY();

INSERT INTO facility_tasks (facility_id, task_type, contract_id, support_request_id, status, staff_id, due_at, note, created_at, claimed_at)
VALUES (@facId, 'SUPPORT', @contract1, @t_fac1, 'IN_PROGRESS', @staff1, 
        DATEADD(HOUR, 21, CAST(@today AS DATETIME2)),
        N'[SR-TEST-FAC01] Hư hỏng hạ tầng ô kho [Đèn chiếu sáng bị cháy / chập]: Bóng đèn LED trước cửa ô...',
        DATEADD(HOUR, -2, @now), DATEADD(HOUR, -1, @now));

-- ==============================================================================================
-- LUỒNG 4: HƯ HỎNG HẠ TẦNG (FACILITY_DAMAGE) - NHÁNH 2: BẢO TRÌ CHUYÊN SÂU (ESCALATED_MAINTENANCE)
-- Trạng thái: Đang xử lý (IN_PROGRESS), Staff Tân Bình 3 phụ trách.
-- Hành vi test: Chọn "Sự cố phức tạp, đã lập phiếu yêu cầu kỹ thuật bảo trì chuyên sâu" -> Nội dung biên bản tự khớp sang cô lập an toàn
-- -> Bấm Hoàn tất -> Tự động sinh Task bảo trì mới gán cho Staff, xuất hiện Banner cam bấm vào chuyển thẳng sang Task bảo trì.
-- ==============================================================================================
INSERT INTO support_requests (ticket_code, contract_id, customer_id, issue_type, sub_category, description, status, created_at)
VALUES ('SR-TEST-FAC02', @contract5, @cust5, 'FACILITY_DAMAGE', N'Hệ thống thông gió / quạt gió kêu to', 
        N'Quạt thông gió trên trần hành lang ô kho kêu rít cơ học rất to và rung lắc mạnh, có mùi khét nhẹ.', 
        'OPEN', DATEADD(HOUR, -1, @now));
DECLARE @t_fac2 INT = SCOPE_IDENTITY();

INSERT INTO facility_tasks (facility_id, task_type, contract_id, support_request_id, status, staff_id, due_at, note, created_at, claimed_at)
VALUES (@facId, 'SUPPORT', @contract5, @t_fac2, 'IN_PROGRESS', @staff3, 
        DATEADD(HOUR, 21, CAST(@today AS DATETIME2)),
        N'[SR-TEST-FAC02] Hư hỏng hạ tầng ô kho [Hệ thống thông gió / quạt gió kêu to]: Quạt thông gió trần kêu to...',
        DATEADD(HOUR, -1, @now), DATEADD(MINUTE, -40, @now));

-- ==============================================================================================
-- LUỒNG 5: SỰ CỐ AN NINH (SECURITY) - BẮT BUỘC KIỂM TRA KHÓA & CHỤP ẢNH HIỆN TRƯỜNG
-- Trạng thái: Đang xử lý (IN_PROGRESS).
-- Hành vi test: Form bắt buộc chọn Tình trạng khóa (INTACT / TAMPERED), bắt buộc có ảnh bằng chứng và biên bản an ninh.
-- ==============================================================================================
INSERT INTO support_requests (ticket_code, contract_id, customer_id, issue_type, sub_category, description, status, created_at)
VALUES ('SR-TEST-SEC01', @contract2, @cust2, 'SECURITY', N'Nghi ngờ ổ khóa có dấu hiệu cạy phá / can thiệp', 
        N'Bề mặt kim loại ổ khóa SmartLock có nhiều vết cào xước sâu bất thường, nghi có người thử cạy mở.', 
        'OPEN', DATEADD(HOUR, -2, @now));
DECLARE @t_sec1 INT = SCOPE_IDENTITY();

INSERT INTO facility_tasks (facility_id, task_type, contract_id, support_request_id, status, staff_id, due_at, note, created_at, claimed_at)
VALUES (@facId, 'SUPPORT', @contract2, @t_sec1, 'IN_PROGRESS', @staff2, 
        DATEADD(HOUR, 21, CAST(@today AS DATETIME2)),
        N'[KHẨN] [SR-TEST-SEC01] Sự cố an ninh [Nghi ngờ ổ khóa có dấu hiệu cạy phá / can thiệp]: Bề mặt khóa có vết xước...',
        DATEADD(HOUR, -2, @now), DATEADD(HOUR, -1, @now));

-- ==============================================================================================
-- LUỒNG 6: VỆ SINH KHO BÃI & MÔI TRƯỜNG (CLEANING) - BẮT BUỘC ẢNH NGHIỆM THU SAU KHI DỌN
-- Trạng thái: Đang xử lý (IN_PROGRESS).
-- Hành vi test: Bắt buộc đính kèm ảnh sau khi dọn sạch sẽ, biên bản vệ sinh môi trường.
-- ==============================================================================================
INSERT INTO support_requests (ticket_code, contract_id, customer_id, issue_type, sub_category, description, status, created_at)
VALUES ('SR-TEST-CLN01', @contract3, @cust3, 'CLEANING', N'Rác thải / thùng carton trước cửa ô', 
        N'Trước cửa ô kho của tôi có nhiều vỏ thùng carton và bọc xốp bừa bãi cản trở lối đi bốc xếp hàng.', 
        'OPEN', DATEADD(HOUR, -3, @now));
DECLARE @t_cln1 INT = SCOPE_IDENTITY();

INSERT INTO facility_tasks (facility_id, task_type, contract_id, support_request_id, status, staff_id, due_at, note, created_at, claimed_at)
VALUES (@facId, 'SUPPORT', @contract3, @t_cln1, 'IN_PROGRESS', @staff1, 
        DATEADD(HOUR, 21, CAST(@today AS DATETIME2)),
        N'[SR-TEST-CLN01] Vệ sinh kho bãi [Rác thải / thùng carton trước cửa ô]: Có nhiều vỏ thùng carton bừa bãi...',
        DATEADD(HOUR, -3, @now), DATEADD(HOUR, -2, @now));

-- ==============================================================================================
-- LUỒNG 7: KHIẾU NẠI BỒI THƯỜNG HÀNG HÓA (GOODS_DAMAGE) - BẮT BUỘC NGUYÊN NHÂN & BIÊN BẢN HỘI ĐỒNG
-- Trạng thái: Ticket IN_PROGRESS, Claim SUBMITTED, Task IN_PROGRESS.
-- Hành vi test: Staff vào lập biên bản kiểm tra hiện trường hàng hư hỏng, chọn Nguyên nhân sơ bộ (FACILITY/CUSTOMER)
-- -> Bấm Hoàn tất -> Task COMPLETED, Claim chuyển sang INSPECTED chờ Quản lý cơ sở (FM) chốt bồi thường.
-- ==============================================================================================
INSERT INTO support_requests (ticket_code, contract_id, customer_id, issue_type, sub_category, description, status, created_at)
VALUES ('SR-TEST-CLM01', @contract3, @cust3, 'GOODS_DAMAGE', N'Hàng bị hư hỏng (Bồi thường)', 
        N'Một số thùng carton đựng sách và tài liệu bên trong ô kho bị ẩm ướt ở phần đáy tiếp giáp sàn.', 
        'IN_PROGRESS', DATEADD(HOUR, -4, @now));
DECLARE @t_clm1 INT = SCOPE_IDENTITY();

INSERT INTO compensation_claims (claim_code, support_request_id, contract_id, customer_id, facility_id, claim_type, incident_date, 
                                 items_description, claimed_amount, customer_images, status, created_at)
VALUES ('BT-TEST-01', @t_clm1, @contract3, @cust3, @facId, 'GOODS_DAMAGE', DATEADD(DAY, -1, @today),
        N'10 thùng sách và tài liệu lưu trữ kinh doanh, ước tính thiệt hại 5.000.000đ', 5000000,
        'http://localhost:5173/demo/hien-trang-o-kho.svg', 'SUBMITTED', DATEADD(HOUR, -4, @now));

INSERT INTO facility_tasks (facility_id, task_type, contract_id, support_request_id, status, staff_id, due_at, note, created_at, claimed_at)
VALUES (@facId, 'SUPPORT', @contract3, @t_clm1, 'IN_PROGRESS', @staff2, 
        DATEADD(HOUR, 21, CAST(@today AS DATETIME2)),
        N'[KHẨN] [SR-TEST-CLM01] Hàng bị hư hỏng (Bồi thường): Kiểm tra hiện trường hồ sơ bồi thường BT-TEST-01',
        DATEADD(HOUR, -4, @now), DATEADD(HOUR, -3, @now));

-- ==============================================================================================
-- LUỒNG 8: YÊU CẦU XỬ LÝ LẠI (REOPEN TICKET TRONG 3 NGÀY)
-- Trạng thái: Ticket RESOLVED (đã giải quyết lúc 1 ngày trước), Task cũ COMPLETED.
-- Hành vi test: Khách đăng nhập vào /ho-tro, thấy nút "Yêu cầu xử lý lại" -> Bấm gửi lý do -> Ticket quay về IN_PROGRESS, sinh Task SUPPORT mới.
-- ==============================================================================================
INSERT INTO support_requests (ticket_code, contract_id, customer_id, issue_type, sub_category, description, status, resolution_note, resolved_at, created_at)
VALUES ('SR-TEST-REOPEN', @contract1, @cust1, 'FACILITY_DAMAGE', N'Cửa cuốn bị kẹt rít / lệch ray trượt', 
        N'Cửa cuốn ô kho kéo lên rất nặng và bị kẹt lửng ở giữa.', 
        'RESOLVED', 
        N'[BIÊN BẢN XỬ LÝ SỰ CỐ & KIỂM TRA HIỆN TRƯỜNG] • Đã tra dầu mỡ bôi trơn ray cửa và cân chỉnh lò xo trợ lực.', 
        DATEADD(DAY, -1, @now), DATEADD(DAY, -2, @now));
DECLARE @t_reopen INT = SCOPE_IDENTITY();

INSERT INTO facility_tasks (facility_id, task_type, contract_id, support_request_id, status, staff_id, due_at, note, created_at, claimed_at, completed_at)
VALUES (@facId, 'SUPPORT', @contract1, @t_reopen, 'COMPLETED', @staff1, 
        DATEADD(DAY, -1, @now),
        N'[SR-TEST-REOPEN] Hư hỏng hạ tầng ô kho [Cửa cuốn bị kẹt]: Đã xử lý bôi trơn ray cửa.',
        DATEADD(DAY, -2, @now), DATEADD(DAY, -2, @now), DATEADD(DAY, -1, @now));

-- ==============================================================================================
-- LUỒNG 9: HỆ THỐNG TỰ ĐỘNG ĐÓNG PHIẾU SAU 3 NGÀY (AUTO-CLOSE)
-- Trạng thái: Ticket RESOLVED cách đây 4 ngày -> Hệ thống tự động chuyển sang CLOSED khi job chạy.
-- ==============================================================================================
INSERT INTO support_requests (ticket_code, contract_id, customer_id, issue_type, sub_category, description, status, resolution_note, resolved_at, created_at)
VALUES ('SR-TEST-CLOSED', @contract2, @cust2, 'OTHER', N'Yêu cầu hỗ trợ chung khác', 
        N'Hỗ trợ hướng dẫn sử dụng xe nâng tay tại khu vực sảnh.', 
        'RESOLVED', 
        N'Đã hướng dẫn khách sử dụng xe nâng tay và hỗ trợ chuyển hàng an toàn.', 
        DATEADD(DAY, -4, @now), DATEADD(DAY, -5, @now));
DECLARE @t_closed INT = SCOPE_IDENTITY();

INSERT INTO facility_tasks (facility_id, task_type, contract_id, support_request_id, status, staff_id, due_at, note, created_at, claimed_at, completed_at)
VALUES (@facId, 'SUPPORT', @contract2, @t_closed, 'COMPLETED', @staff2, 
        DATEADD(DAY, -4, @now),
        N'[SR-TEST-CLOSED] Hỗ trợ chung: Đã hướng dẫn xe nâng tay.',
        DATEADD(DAY, -5, @now), DATEADD(DAY, -5, @now), DATEADD(DAY, -4, @now));

-- ==============================================================================================
-- KẾT QUẢ TỔNG HỢP VÀ DANH SÁCH TEST
-- ==============================================================================================
PRINT N'==> [HOÀN TẤT] Đã tạo thành công 9 kịch bản test mẫu cho toàn bộ các luồng hỗ trợ!';
PRINT N'';
SELECT 
    sr.ticket_code          AS [Mã Ticket],
    sr.issue_type           AS [Loại sự cố],
    sr.sub_category         AS [Danh mục chi tiết],
    sr.status               AS [Trạng thái Ticket],
    ft.id                   AS [Task ID],
    ft.status               AS [Trạng thái Task],
    COALESCE(u.full_name, N'Chưa nhận') AS [Nhân viên phụ trách],
    CONCAT('http://localhost:5173/staff/tasks/', ft.id) AS [Link Test Trực Tiếp]
FROM support_requests sr
JOIN facility_tasks ft ON ft.support_request_id = sr.id
LEFT JOIN users u ON u.id = ft.staff_id
WHERE sr.ticket_code LIKE 'SR-TEST-%'
ORDER BY ft.id ASC;
GO



