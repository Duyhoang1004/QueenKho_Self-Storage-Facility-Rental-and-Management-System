-- Migration: Thêm cột bank_transaction_code vào bảng payment_transactions
-- Phục vụ lưu mã giao dịch từ phía ngân hàng (FT... hoặc vnp_BankTranNo / vnp_TransactionNo)

IF COL_LENGTH('payment_transactions', 'bank_transaction_code') IS NULL
BEGIN
    ALTER TABLE payment_transactions ADD bank_transaction_code NVARCHAR(100) NULL;
    PRINT N'Đã thêm cột bank_transaction_code vào bảng payment_transactions thành công.';
END
ELSE
BEGIN
    PRINT N'Cột bank_transaction_code đã tồn tại trong payment_transactions.';
END
GO
