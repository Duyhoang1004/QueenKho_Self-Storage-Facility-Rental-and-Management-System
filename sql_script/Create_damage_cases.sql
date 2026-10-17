USE QueenKhoDB;
GO

/* =========================================================================
   UC-23 & UC-24: BẢNG GHI NHẬN SỰ CỐ HƯ HỎNG KHI NGHIỆM THU TRẢ KHO (damage_cases)
   ========================================================================= */
IF OBJECT_ID('damage_cases', 'U') IS NULL
BEGIN
    CREATE TABLE damage_cases (
        id                  INT IDENTITY(1,1) PRIMARY KEY,
        contract_id         INT NOT NULL,
        task_id             INT NOT NULL,                             -- ID task CHECK_OUT ở facility_tasks
        title               NVARCHAR(150) NOT NULL,                   -- Ví dụ: 'Vệ sinh rác', 'Hỏng khóa', 'Vỡ vách ngăn'
        description         NVARCHAR(1000) NULL,                      -- Mô tả chi tiết mức độ hư hại
        estimated_cost      DECIMAL(12,2) NOT NULL DEFAULT 0,         -- Chi phí đền bù (>= 0)
        evidence_image_urls NVARCHAR(MAX) NULL,                       -- Danh sách link ảnh / base64 (JSON array hoặc phân tách)
        created_at          DATETIME2(7) NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT FK_damagecases_contract FOREIGN KEY (contract_id) REFERENCES rental_contracts(id),
        CONSTRAINT FK_damagecases_task     FOREIGN KEY (task_id) REFERENCES facility_tasks(id)
    );

    CREATE INDEX IX_damagecases_contract ON damage_cases(contract_id);
    CREATE INDEX IX_damagecases_task ON damage_cases(task_id);

    PRINT N'==> Đã tạo bảng damage_cases thành công!';
END
ELSE
BEGIN
    PRINT N'==> Bảng damage_cases đã tồn tại.';
END
GO
