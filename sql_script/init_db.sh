#!/bin/bash
set -euo pipefail

export SQLCMDPASSWORD="${MSSQL_SA_PASSWORD:?MSSQL_SA_PASSWORD is required}"
SQLCMD=(/opt/mssql-tools18/bin/sqlcmd -S db -U sa -C -b -I -f 65001 -l 10)

wait_for_database() {
    local database="$1"
    for ((attempt=1; attempt<=60; attempt++)); do
        if "${SQLCMD[@]}" -d "$database" -Q 'SET NOCOUNT ON; SELECT 1' >/dev/null 2>&1; then
            return 0
        fi
        echo "[DB-INIT] Waiting for $database ($attempt/60)..."
        sleep 2
    done
    echo "[DB-INIT] Timed out waiting for $database." >&2
    return 1
}

wait_for_database master
FRESH_DATABASE=false
CHECK_DB=$("${SQLCMD[@]}" -h -1 -W -Q "SET NOCOUNT ON; IF DB_ID('QueenKhoDB') IS NULL PRINT 'NEED_INIT' ELSE PRINT 'EXISTS'")
if [[ "$CHECK_DB" == *NEED_INIT* ]]; then
    echo '[DB-INIT] Creating QueenKhoDB with sample data...'
    "${SQLCMD[@]}" -i /scripts/QueenKho_full.sql
    FRESH_DATABASE=true
else
    echo '[DB-INIT] Keeping existing QueenKhoDB and applying updates...'
fi

wait_for_database QueenKhoDB
"${SQLCMD[@]}" -d QueenKhoDB -Q "IF OBJECT_ID('dbo.docker_schema_history', 'U') IS NULL CREATE TABLE dbo.docker_schema_history (script_name VARCHAR(150) PRIMARY KEY, applied_at DATETIME2 NOT NULL DEFAULT SYSDATETIME())"
# Ordered, repeatable updates for databases created by earlier Docker versions.
# Never rerun the destructive full seed against an existing database.
for script in \
    Migration_Consolidated_Update.sql \
    Update_cancel_business_rule_06_11.sql \
    Update_payment_bank_transaction_code.sql \
    Update_mat_bang.sql \
    Update_gia_han_doanh_thu.sql \
    Update_sua_bug_sau_test.sql \
    Update_bang_chung_chuyen_o.sql \
    Update_bao_hiem_boi_thuong.sql \
    Update_hop_nhom_05_11.sql \
    Update_kho_lanh.sql \
    Update_gop_y_product_12_11.sql \
    UC28_setup.sql \
    Update_admin_accounts.sql \
    Create_unit_access_history.sql \
    Update_tat_toan_tra_kho.sql \
    Update_hoan_tien_chinh_sach_v6.sql \
    Update_checkin_goods_value_flow.sql \
    Update_them_o_kho_21_11.sql \
    Update_hoan_tien_tat_toan_d23.sql \
    Update_gop_y_test_22_11.sql \
    Update_kho_tong_theo_thanh_pho.sql \
    Update_gop_y_test_24_11.sql \
    Update_mat_bang_4_tang.sql; do
    APPLIED=$("${SQLCMD[@]}" -d QueenKhoDB -h -1 -W -Q "SET NOCOUNT ON; SELECT COUNT(*) FROM dbo.docker_schema_history WHERE script_name = '$script'")
    if [[ "$APPLIED" == *1* ]]; then
        echo "[DB-INIT] Already applied: $script"
        continue
    fi
    # The current full seed already includes the schema updates.
    # 21/11/2026: các script từ 18/11 trở đi đều chạy lại được (IF NOT EXISTS / IF OBJECT_ID) → chạy cả khi DB mới tạo,
    # vì QueenKho_full.sql chưa có bảng unit_access_history.
    if [[ "$FRESH_DATABASE" == false || "$script" == UC28_setup.sql || "$script" == Update_admin_accounts.sql || "$script" == Update_gop_y_product_12_11.sql \
          || "$script" == Create_unit_access_history.sql || "$script" == Update_tat_toan_tra_kho.sql \
          || "$script" == Update_hoan_tien_chinh_sach_v6.sql || "$script" == Update_checkin_goods_value_flow.sql \
          || "$script" == Update_them_o_kho_21_11.sql || "$script" == Update_hoan_tien_tat_toan_d23.sql \
          || "$script" == Update_gop_y_test_22_11.sql || "$script" == Update_kho_tong_theo_thanh_pho.sql \
          || "$script" == Update_gop_y_test_24_11.sql || "$script" == Update_mat_bang_4_tang.sql ]]; then
        echo "[DB-INIT] Applying $script..."
        "${SQLCMD[@]}" -d QueenKhoDB -i "/scripts/$script"
    fi
    "${SQLCMD[@]}" -d QueenKhoDB -Q "INSERT INTO dbo.docker_schema_history (script_name) VALUES ('$script')"
done

echo '[DB-INIT] Database initialization completed successfully.'
