/* Check-in: chứng từ giá trị hàng + đối chiếu hai bên. Chạy được nhiều lần. */
USE QueenKhoDB;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('reservations') AND name = 'goods_value_evidence_images')
    ALTER TABLE reservations ADD goods_value_evidence_images NVARCHAR(MAX) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('handover_records') AND name = 'is_goods_value_verified')
    ALTER TABLE handover_records ADD is_goods_value_verified BIT NOT NULL CONSTRAINT DF_handover_goods_value_verified DEFAULT 0;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('handover_records') AND name = 'goods_value_assessment')
    ALTER TABLE handover_records ADD goods_value_assessment NVARCHAR(20) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('handover_records') AND name = 'assessed_goods_value')
    ALTER TABLE handover_records ADD assessed_goods_value DECIMAL(18,2) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('handover_records') AND name = 'goods_value_assessment_note')
    ALTER TABLE handover_records ADD goods_value_assessment_note NVARCHAR(1000) NULL;
GO

PRINT N'==> Đã cập nhật schema check-in và giá trị hàng.';
GO
