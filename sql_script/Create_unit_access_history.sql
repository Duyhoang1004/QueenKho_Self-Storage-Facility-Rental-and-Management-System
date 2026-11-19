USE QueenKhoDB;
GO

/* =========================================================================
   BẢNG GHI NHẬN LỊCH SỬ RA VÀO Ô KHO / IOT SMARTLOCK & RFID (unit_access_history)
   Chạy bằng UTF-8: sqlcmd -S localhost -U sa -P 12345 -I -f 65001 -i sql_script/Create_unit_access_history.sql
   ========================================================================= */
IF OBJECT_ID('unit_access_history', 'U') IS NULL
BEGIN
    CREATE TABLE unit_access_history (
        id                  BIGINT IDENTITY(1,1) PRIMARY KEY,
        contract_id         INT NOT NULL,
        storage_unit_id     NVARCHAR(20) NOT NULL,
        access_method       NVARCHAR(20) NOT NULL,         -- 'PIN', 'RFID'
        credential_code     NVARCHAR(50) NULL,             -- Mã PIN hoặc mã RFID đã sử dụng
        device_code         NVARCHAR(50) NOT NULL,         -- Ví dụ: 'SMARTLOCK-B204'
        status              NVARCHAR(20) NOT NULL,         -- 'SUCCESS', 'DENIED'
        failure_reason      NVARCHAR(255) NULL,            -- Lý do từ chối nếu status = 'DENIED'
        battery_percentage  INT NOT NULL DEFAULT 95,       -- Dung lượng pin khóa điện tử (%)
        accessed_at         DATETIME2(7) NOT NULL DEFAULT SYSDATETIME(),
        notes               NVARCHAR(255) NULL,            -- Ghi chú trạng thái chốt cửa / cảnh báo
        CONSTRAINT FK_unitaccesshistory_contract FOREIGN KEY (contract_id) REFERENCES rental_contracts(id),
        CONSTRAINT FK_unitaccesshistory_unit     FOREIGN KEY (storage_unit_id) REFERENCES storage_units(id)
    );

    CREATE INDEX IX_unitaccesshistory_contract ON unit_access_history(contract_id, accessed_at DESC);
    CREATE INDEX IX_unitaccesshistory_unit ON unit_access_history(storage_unit_id, accessed_at DESC);

    PRINT N'==> Đã tạo bảng unit_access_history thành công!';
END
ELSE
BEGIN
    PRINT N'==> Bảng unit_access_history đã tồn tại.';
END
GO

/* ---------- Seed dữ liệu mẫu lịch sử ra vào cho các hợp đồng đang hoạt động ---------- */
IF NOT EXISTS (SELECT 1 FROM unit_access_history)
BEGIN
    INSERT INTO unit_access_history (contract_id, storage_unit_id, access_method, credential_code, device_code, status, failure_reason, battery_percentage, accessed_at, notes)
    SELECT 
        c.id, 
        c.storage_unit_id, 
        'RFID', 
        ISNULL(c.rfid_card_code, 'RFID-CARD'), 
        'SMARTLOCK-' + REPLACE(c.storage_unit_id, 'KV-', ''), 
        'SUCCESS', 
        NULL, 
        98, 
        DATEADD(DAY, -2, DATEADD(HOUR, 9, CAST(CAST(GETDATE() AS DATE) AS DATETIME2))), 
        N'Quẹt thẻ RFID hợp lệ - Mở chốt cửa 5 giây'
    FROM rental_contracts c
    WHERE c.status IN ('ACTIVE', 'OVERDUE', 'TERMINATION_PENDING') AND c.storage_unit_id IS NOT NULL;

    INSERT INTO unit_access_history (contract_id, storage_unit_id, access_method, credential_code, device_code, status, failure_reason, battery_percentage, accessed_at, notes)
    SELECT 
        c.id, 
        c.storage_unit_id, 
        'PIN', 
        ISNULL(c.access_pin_code, '123456'), 
        'SMARTLOCK-' + REPLACE(c.storage_unit_id, 'KV-', ''), 
        'SUCCESS', 
        NULL, 
        96, 
        DATEADD(DAY, -1, DATEADD(HOUR, 14, CAST(CAST(GETDATE() AS DATE) AS DATETIME2))), 
        N'Xác thực mã PIN thành công - Mở chốt cửa 5 giây'
    FROM rental_contracts c
    WHERE c.status IN ('ACTIVE', 'OVERDUE', 'TERMINATION_PENDING') AND c.storage_unit_id IS NOT NULL;

    PRINT N'==> Đã thêm dữ liệu mẫu lịch sử ra vào kho!';
END
GO
