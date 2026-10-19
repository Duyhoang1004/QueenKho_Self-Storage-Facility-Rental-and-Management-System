#!/bin/bash
set -e

echo "[DB-INIT] Đang chờ SQL Server sẵn sàng tiếp nhận kết nối..."
for i in {1..50}; do
    if /opt/mssql-tools18/bin/sqlcmd -S db -U sa -P '12345678@Password' -C -Q 'SELECT 1' > /dev/null 2>&1; then
        echo "[DB-INIT] SQL Server đã sẵn sàng!"
        break
    fi
    echo "[DB-INIT] SQL Server chưa sẵn sàng, thử lại sau 2 giây (lần $i)..."
    sleep 2
done

echo "[DB-INIT] Kiểm tra database QueenKhoDB..."
CHECK_DB=$(/opt/mssql-tools18/bin/sqlcmd -S db -U sa -P '12345678@Password' -C -h -1 -Q "SET NOCOUNT ON; IF DB_ID('QueenKhoDB') IS NULL PRINT 'NEED_INIT' ELSE PRINT 'EXISTS'")

if echo "$CHECK_DB" | grep -q "NEED_INIT"; then
    echo "[DB-INIT] QueenKhoDB chưa tồn tại. Đang khởi tạo toàn bộ database từ QueenKho_full.sql..."
    /opt/mssql-tools18/bin/sqlcmd -S db -U sa -P '12345678@Password' -C -i /scripts/QueenKho_full.sql
    echo "[DB-INIT] Đang chờ database QueenKhoDB sẵn sàng..."
    for i in {1..30}; do
        if /opt/mssql-tools18/bin/sqlcmd -S db -U sa -P '12345678@Password' -C -d QueenKhoDB -Q 'SELECT 1' > /dev/null 2>&1; then
            break
        fi
        sleep 2
    done
    echo "[DB-INIT] Đang áp dụng bổ sung kịch bản UC28_setup.sql..."
    /opt/mssql-tools18/bin/sqlcmd -S db -U sa -P '12345678@Password' -C -d QueenKhoDB -i /scripts/UC28_setup.sql
    echo "[DB-INIT] Đang áp dụng bổ sung tài khoản Admin Update_admin_accounts.sql..."
    /opt/mssql-tools18/bin/sqlcmd -S db -U sa -P '12345678@Password' -C -d QueenKhoDB -i /scripts/Update_admin_accounts.sql
    echo "[DB-INIT] ✅ Khởi tạo Database QueenKhoDB thành công!"
else
    echo "[DB-INIT] Database QueenKhoDB đã tồn tại. Đang chờ database hoàn tất mở (ONLINE)..."
    for i in {1..30}; do
        if /opt/mssql-tools18/bin/sqlcmd -S db -U sa -P '12345678@Password' -C -d QueenKhoDB -Q 'SELECT 1' > /dev/null 2>&1; then
            echo "[DB-INIT] Database QueenKhoDB đã sẵn sàng!"
            break
        fi
        echo "[DB-INIT] Database QueenKhoDB đang trong quá trình khôi phục, chờ 2 giây (lần $i)..."
        sleep 2
    done
    echo "[DB-INIT] Đang đồng bộ cập nhật bổ sung kịch bản UC28_setup.sql..."
    /opt/mssql-tools18/bin/sqlcmd -S db -U sa -P '12345678@Password' -C -d QueenKhoDB -i /scripts/UC28_setup.sql
    echo "[DB-INIT] Đang đồng bộ cập nhật tài khoản Admin Update_admin_accounts.sql..."
    /opt/mssql-tools18/bin/sqlcmd -S db -U sa -P '12345678@Password' -C -d QueenKhoDB -i /scripts/Update_admin_accounts.sql
    echo "[DB-INIT] ✅ Đồng bộ database thành công!"
fi
