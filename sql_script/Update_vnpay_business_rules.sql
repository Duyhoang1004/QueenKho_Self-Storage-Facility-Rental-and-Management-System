/* Đồng bộ vòng đời thanh toán VNPAY theo PR-B6/B7/B8 và PR-R2/R5. */
IF COL_LENGTH('payment_transactions', 'renewal_months') IS NULL
BEGIN
    ALTER TABLE payment_transactions ADD renewal_months INT NULL;
END;
GO

/* Chuyển dữ liệu cũ đúng một lần; code mới không còn suy số tháng từ mã giao dịch. */
UPDATE payment_transactions
SET renewal_months = TRY_CONVERT(INT, SUBSTRING(transaction_code, 4, 2))
WHERE payment_type = 'MONTHLY_RENT'
  AND renewal_months IS NULL
  AND transaction_code LIKE 'QKR%'
  AND TRY_CONVERT(INT, SUBSTRING(transaction_code, 4, 2)) IN (1, 3, 6, 12);
GO

UPDATE lf
SET lf.renewal_months = rent.renewal_months
FROM payment_transactions lf
JOIN payment_transactions rent ON lf.transaction_code = 'LF' + rent.transaction_code
WHERE lf.payment_type = 'LATE_FEE' AND lf.renewal_months IS NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_payments_renewal_months')
BEGIN
    ALTER TABLE payment_transactions ADD CONSTRAINT CK_payments_renewal_months
        CHECK (renewal_months IS NULL OR renewal_months IN (1, 3, 6, 12));
END;
GO

/* Dọn dữ liệu PENDING trùng trước khi tạo ràng buộc: chỉ giữ giao dịch mới nhất. */
;WITH duplicate_deposit AS (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY reservation_id ORDER BY id DESC) AS rn
    FROM payment_transactions
    WHERE payment_type = 'DEPOSIT' AND payment_method = 'VNPAY' AND status = 'PENDING'
)
UPDATE payment_transactions SET status = 'FAILED', paid_at = NULL
WHERE id IN (SELECT id FROM duplicate_deposit WHERE rn > 1);
GO

;WITH duplicate_renewal AS (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY contract_id ORDER BY id DESC) AS rn
    FROM payment_transactions
    WHERE payment_type = 'MONTHLY_RENT' AND payment_method = 'VNPAY' AND status = 'PENDING'
)
UPDATE payment_transactions SET status = 'FAILED', paid_at = NULL
WHERE id IN (SELECT id FROM duplicate_renewal WHERE rn > 1);
GO

UPDATE lf SET status = 'FAILED', paid_at = NULL
FROM payment_transactions lf
WHERE lf.payment_type = 'LATE_FEE' AND lf.payment_method = 'VNPAY' AND lf.status = 'PENDING'
  AND NOT EXISTS (
      SELECT 1 FROM payment_transactions rent
      WHERE lf.transaction_code = 'LF' + rent.transaction_code
        AND rent.payment_type = 'MONTHLY_RENT' AND rent.status = 'PENDING'
  );
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_payments_pending_deposit' AND object_id = OBJECT_ID('payment_transactions'))
BEGIN
    CREATE UNIQUE INDEX UX_payments_pending_deposit
        ON payment_transactions(reservation_id)
        WHERE payment_type = 'DEPOSIT' AND payment_method = 'VNPAY' AND status = 'PENDING';
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_payments_pending_renewal' AND object_id = OBJECT_ID('payment_transactions'))
BEGIN
    CREATE UNIQUE INDEX UX_payments_pending_renewal
        ON payment_transactions(contract_id)
        WHERE payment_type = 'MONTHLY_RENT' AND payment_method = 'VNPAY' AND status = 'PENDING';
END;
GO
