/* ============================================================
   UC-03 / Portal Admin — thêm tài khoản Admin + system cho DB đang có
   Chạy lại nhiều lần được (IF NOT EXISTS). Mật khẩu Admin: 123456
   ============================================================ */
USE QueenKhoDB;
GO

DECLARE @pw NVARCHAR(255) = '$2a$10$Qr7dzmVD2myZYzHxhs4pd.I9CjytDRaXJMhSEkYdVEJ5v91FC2ZKu';
DECLARE @adminRole INT = (SELECT id FROM roles WHERE name = 'ADMIN');

IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@queenkho.com')
    INSERT INTO users (full_name, email, password_hash, phone, role_id, facility_id, status)
    VALUES (N'Quản trị viên', 'admin@queenkho.com', @pw, '0903000001', @adminRole, NULL, 'ACTIVE');

IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin2@queenkho.com')
    INSERT INTO users (full_name, email, password_hash, phone, role_id, facility_id, status)
    VALUES (N'Quản trị viên 2', 'admin2@queenkho.com', @pw, '0903000002', @adminRole, NULL, 'ACTIVE');

-- PR-A8: tài khoản của job tự động, không đăng nhập được
IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'system@queenkho.local')
    INSERT INTO users (full_name, email, password_hash, phone, role_id, facility_id, status)
    VALUES (N'Hệ thống', 'system@queenkho.local', 'NO_LOGIN', '0000000000', @adminRole, NULL, 'DISABLED');
GO

-- Kiểm tra
SELECT u.id, u.full_name, u.email, u.status
FROM users u JOIN roles r ON r.id = u.role_id
WHERE r.name = 'ADMIN';
GO
