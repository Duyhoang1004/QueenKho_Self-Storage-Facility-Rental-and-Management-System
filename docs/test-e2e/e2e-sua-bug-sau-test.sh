#!/usr/bin/env bash
# E2E kiểm chứng đợt sửa lỗi sau test (02/11/2026) qua API thật — backend localhost:8080, DB QueenKhoDB
# đã chạy sql_script/Update_sua_bug_sau_test.sql (hoặc tạo mới từ QueenKho_full.sql / QueenKho_TongHop.sql).
# Chạy (Git Bash): bash docs/test-e2e/e2e-sua-bug-sau-test.sh
# Cần: node, sqlcmd. Tự tạo khách test e2e.khach@queenkho.local (mật khẩu 123456 như các tài khoản mẫu),
# dùng fmtanbinh / fmbinhthanh / stafftanbinh1 / bom@queenkho.com. Đơn đặt Kho Tiêu Chuẩn (loại 2) ở Tân Bình.
# Body JSON để KHÔNG DẤU — Git Bash trên Windows truyền tiếng Việt cho curl.exe sai mã hoá.
SCR="$(cd "$(dirname "$0")" && pwd)"
HOST=${E2E_HOST:-http://localhost:8080}
API=$HOST/api/v1
PAY=$HOST/api/payments/vnpay
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "  ✅ $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  ❌ $1"; }
check(){ if [ "$2" == "$3" ]; then ok "$1 ($2)"; else bad "$1: mong đợi [$3], thực tế [$2]"; fi; }
sql()  { sqlcmd -S localhost -U sa -P 12345 -d QueenKhoDB -C -I -h-1 -W -Q "SET NOCOUNT ON; $1" | tr -d '\r' | sed '/^$/d'; }
jget() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const o=JSON.parse(s);const v=($1);console.log(v===undefined?'':typeof v==='object'?JSON.stringify(v):v)}catch(e){console.log('PARSE_ERR')}})"; }
login(){ curl -s -X POST $API/auth/login -H "Content-Type: application/json" -d "{\"email\":\"$1\",\"password\":\"123456\"}" | jget "o.token"; }
call() { local m=$1 t=$2 u=$3 d=$4; if [ -n "$d" ]; then curl -s -X $m -H "Authorization: Bearer $t" -H "Content-Type: application/json" -d "$d" "$u"; else curl -s -X $m -H "Authorization: Bearer $t" "$u"; fi; }
code() { local m=$1 t=$2 u=$3 d=$4; if [ -n "$d" ]; then curl -s -o /dev/null -w "%{http_code}" -X $m -H "Authorization: Bearer $t" -H "Content-Type: application/json" -d "$d" "$u"; else curl -s -o /dev/null -w "%{http_code}" -X $m -H "Authorization: Bearer $t" "$u"; fi; }
ipn()  { curl -s "$PAY/ipn?$(node "$SCR/vnp_sign.js" "$1" "$2" "${3:-00}")" | jget "o.RspCode"; }
TODAY=$(date +%Y-%m-%d)
TOMORROW=$(date -d tomorrow +%Y-%m-%d)
IN10=$(date -d '+10 days' +%Y-%m-%d)

KH_EMAIL=e2e.khach@queenkho.local
curl -s -X POST $API/auth/register -H "Content-Type: application/json" \
  -d "{\"email\":\"$KH_EMAIL\",\"password\":\"123456\",\"fullName\":\"Khach E2E\",\"phone\":\"0900000211\"}" >/dev/null
KH_ID=$(sql "SELECT id FROM users WHERE email='$KH_EMAIL'")
# Dọn lần chạy trước: đơn PENDING của khách test hết hạn; HĐ còn mở của khách test kết thúc để trả ô
sql "UPDATE reservations SET status='EXPIRED' WHERE status='PENDING' AND customer_id=$KH_ID;
     UPDATE storage_units SET status='AVAILABLE' WHERE id IN (SELECT storage_unit_id FROM rental_contracts WHERE customer_id=$KH_ID AND status IN ('ACTIVE','OVERDUE','PENDING_CHECK_IN','TERMINATION_PENDING'));
     UPDATE rental_contracts SET status='TERMINATED', access_pin_code=NULL, rfid_card_code=NULL WHERE customer_id=$KH_ID AND status IN ('ACTIVE','OVERDUE','PENDING_CHECK_IN','TERMINATION_PENDING');" >/dev/null

KH=$(login $KH_EMAIL); FM=$(login fmtanbinh@gmail.com); FM2=$(login fmbinhthanh@gmail.com)
ST1=$(login stafftanbinh1@gmail.com); BOM=$(login bom@queenkho.com)
ST1_ID=$(sql "SELECT id FROM users WHERE email='stafftanbinh1@gmail.com'")
[ -n "$KH" ] && [ -n "$FM" ] && [ -n "$ST1" ] && [ -n "$BOM" ] || { echo "Không đăng nhập được tài khoản test"; exit 1; }

echo "== BR-113: thông báo lưu DB, không còn thông báo mẫu"
check "FM không nhận thông báo mẫu viết cứng" "$(call GET $FM "$API/notifications?limit=100" | jget 'o.filter(n=>/RES-739909|RES-108234|HD-991779/.test(n.message)).length')" "0"

echo "== BR-25: voucher"
check "Không nhập mã → mã mặc định NEWKHO 100.000" "$(call GET $KH "$API/vouchers/validate?facilityId=1&unitTypeId=2&months=3" | jget 'o.code+"/"+o.discountAmount')" "NEWKHO/100000"
check "Mã không tồn tại → 400" "$(call GET $KH "$API/vouchers/validate?code=KHONGCO&facilityId=1&unitTypeId=2&months=3" | jget 'o.error')" "VOUCHER_INVALID"
VC="E2E$(date +%H%M%S)"
R=$(call POST $BOM "$API/bom/vouchers" "{\"code\":\"$VC\",\"name\":\"E2E giam 10 phan tram\",\"discountType\":\"PERCENT\",\"discountValue\":10,\"maxDiscount\":200000,\"minMonths\":3,\"perUserLimit\":1}")
check "BOM tạo voucher % có trần, gói từ 3 tháng, 1 lượt / khách" "$(echo "$R" | jget 'o.code')" "$VC"
check "FM không tạo được voucher → 403" "$(code POST $FM "$API/bom/vouchers" "{\"code\":\"FMTHU\",\"name\":\"x\",\"discountType\":\"FIXED\",\"discountValue\":1000}")" "403"
check "Gói 1 tháng chưa đủ điều kiện → 400" "$(call GET $KH "$API/vouchers/validate?code=$VC&facilityId=1&unitTypeId=2&months=1" | jget 'o.error')" "VOUCHER_INVALID"
Q=$(call GET $KH "$API/vouchers/validate?code=$VC&facilityId=1&unitTypeId=2&months=3")
RENT=$(echo "$Q" | jget 'Math.round(o.rentAmount)')
check "Giảm 10% tiền thuê nhưng chạm trần 200.000" "$(echo "$Q" | jget 'o.discountAmount')" "200000"

echo "== Đặt kho bằng voucher → VNPAY trừ đúng số đã chốt"
R=$(call POST $KH "$API/reservations" "{\"facilityId\":1,\"unitTypeId\":2,\"startDate\":\"$TODAY\",\"durationMonths\":3,\"acceptedTerms\":true,\"goodsCategoryCodes\":[\"HOUSEHOLD\"],\"phone\":\"0900000211\",\"cccd\":\"079200000123\",\"voucherCode\":\"$VC\"}")
RES=$(echo "$R" | jget 'o.id'); echo "  đơn #$RES $(echo "$R" | jget 'o.reservationCode')"
check "Đơn chốt mã + số tiền giảm" "$(sql "SELECT voucher_code+'/'+CAST(CAST(voucher_discount AS INT) AS VARCHAR) FROM reservations WHERE id=$RES")" "$VC/200000"
DEP=$(sql "SELECT CAST(deposit_amount AS INT) FROM reservations WHERE id=$RES")
P=$(call POST $KH "$PAY/create" "{\"reservationId\":$RES}")
REF=$(echo "$P" | jget 'o.orderId'); AMT=$(echo "$P" | jget 'o.amount')
check "Số tiền VNPAY = tiền thuê + cọc − voucher" "$AMT" "$((RENT + DEP - 200000))"
check "IPN thành công" "$(ipn $REF $AMT)" "00"
check "Voucher +1 lượt khi cọc thành công" "$(sql "SELECT used_count FROM vouchers WHERE code='$VC'")" "1"
check "Khách dùng lại mã (hết lượt / khách) → 400" "$(call GET $KH "$API/vouchers/validate?code=$VC&facilityId=1&unitTypeId=2&months=3" | jget 'o.error')" "VOUCHER_INVALID"
check "Khách có thông báo đặt cọc thành công" "$(call GET $KH "$API/notifications" | jget 'o.some(n=>n.type==="BOOKING")')" "true"
check "Phiếu biên nhận: API trạng thái trả mã giao dịch + voucher" "$(call GET $KH "$PAY/status/$REF" | jget 'o.transaction_code+"/"+o.voucher_code+"/"+Math.round(o.voucher_discount)')" "$REF/$VC/200000"

echo "== BR-119: FM xem chi tiết đơn trước khi gán ô"
D=$(call GET $FM "$API/reservations/$RES/manager-detail")
check "CCCD che giữa" "$(echo "$D" | jget 'o.customerCccdMasked')" "079******123"
check "Voucher + tổng đã trả" "$(echo "$D" | jget 'o.voucherCode+"/"+Math.round(o.totalPaid)')" "$VC/$AMT"
check "FM cơ sở khác xem → 403" "$(code GET $FM2 "$API/reservations/$RES/manager-detail")" "403"

echo "== Gán ô + check-in (thông báo cho khách)"
UNIT=$(call GET $FM "$API/reservations/$RES/available-units" | jget 'o[0].id')
check "FM gán ô" "$(code POST $FM "$API/reservations/$RES/assign" "{\"storageUnitId\":\"$UNIT\"}")" "200"
check "Thông báo gán ô trỏ đúng trang hợp đồng (theo id đơn)" "$(call GET $KH "$API/notifications" | jget 'o.find(n=>n.type==="ASSIGNED").targetUrl')" "/kho-cua-toi/hop-dong/$RES"
C=$(sql "SELECT id FROM rental_contracts WHERE reservation_id=$RES")
T=$(sql "SELECT id FROM facility_tasks WHERE contract_id=$C AND task_type='CHECK_IN'")
call POST $FM "$API/staff-tasks/$T/assign?staffId=$ST1_ID" >/dev/null
check "Staff nhận thông báo được giao việc" "$(call GET $ST1 "$API/notifications" | jget "o.some(n=>n.targetUrl==='/staff?highlightTaskId=$T')")" "true"
PIN=$(call GET $ST1 "$API/staff-tasks/pin-suggestion" | jget 'o.accessPinCode')
check "Staff check-in" "$(code POST $ST1 "$API/staff-tasks/$T/check-in" "{\"evidenceImages\":[\"http://e2e/hien-trang.png\"],\"identityVerified\":true,\"unitEmpty\":true,\"unitClean\":true,\"lockIntact\":true,\"customerSignatureConfirmed\":true,\"goodsChecked\":true,\"accessPinCode\":\"$PIN\",\"rfidCardCode\":\"RFID-E2EBUG-$RES\"}")" "200"
check "HĐ ACTIVE" "$(sql "SELECT status FROM rental_contracts WHERE id=$C")" "ACTIVE"

echo "== BR-111 + PR-S4: yêu cầu hỗ trợ → FM được báo; task quá hạn → FM gia hạn"
call POST $KH "$API/support-requests" "{\"contractId\":$C,\"issueType\":\"CLEANING\",\"description\":\"E2E kiem tra ve sinh khoang kho\"}" >/dev/null
SUP=$(sql "SELECT TOP 1 id FROM facility_tasks WHERE contract_id=$C AND task_type='SUPPORT' ORDER BY id DESC")
check "FM nhận thông báo yêu cầu hỗ trợ mới" "$(call GET $FM "$API/notifications?limit=100" | jget "o.some(n=>n.type==='SUPPORT'&&n.targetUrl.endsWith('highlightTaskId=$SUP'))")" "true"
check "⚡ Task hỗ trợ quá hạn ngay" "$(call POST $FM "$API/dev/simulation/tasks/$SUP/make-overdue" | jget 'o.status')" "OVERDUE"
check "FM nhận thông báo task quá hạn" "$(call GET $FM "$API/notifications?limit=100" | jget "o.some(n=>n.type==='TASK'&&n.targetUrl.endsWith('highlightTaskId=$SUP'))")" "true"
check "Gia hạn quá 7 ngày → 400" "$(code POST $FM "$API/staff-tasks/$SUP/extend" "{\"newDueDate\":\"$IN10\",\"reason\":\"E2E\"}")" "400"
check "FM gia hạn task hỗ trợ đến ngày mai" "$(call POST $FM "$API/staff-tasks/$SUP/extend" "{\"newDueDate\":\"$TOMORROW\",\"reason\":\"E2E cho ky thuat\"}" | jget 'o.status')" "OPEN"
check "Task nhận kho không gia hạn được" "$(call POST $FM "$API/staff-tasks/$T/extend" "{\"newDueDate\":\"$TOMORROW\",\"reason\":\"E2E\"}" | jget 'o.error')" "TASK_NOT_EXTENDABLE"

echo "== PR-R9: nhắc gia hạn (⚡ còn 3 ngày)"
check "⚡ Còn 3 ngày hết hạn" "$(code POST $KH "$API/dev/simulation/contracts/$C/expire-soon?days=3")" "200"
check "Khách nhận thông báo nhắc gia hạn" "$(call GET $KH "$API/notifications" | jget 'o.some(n=>n.type==="RENEWAL")')" "true"
call POST $KH "$API/dev/simulation/contracts/$C/expire-soon?days=3" >/dev/null
check "Bấm lại cùng mốc không gửi trùng" "$(sql "SELECT COUNT(*) FROM notifications WHERE user_id=$KH_ID AND ref_key LIKE 'RENEWAL:$C:%'")" "1"

echo "== PR-O1 / PR-O3: hẹn trả kho"
check "Hẹn trả hôm nay → 400" "$(code POST $KH "$API/contracts/$C/request-checkout" "{\"checkoutDate\":\"$TODAY\",\"refundMethod\":\"CASH\"}")" "400"
check "Thiếu cách nhận cọc → 400" "$(call POST $KH "$API/contracts/$C/request-checkout" "{\"checkoutDate\":\"$TOMORROW\"}" | jget 'o.error')" "INVALID_REFUND_METHOD"
check "Số tài khoản sai định dạng → 400" "$(call POST $KH "$API/contracts/$C/request-checkout" "{\"checkoutDate\":\"$TOMORROW\",\"refundMethod\":\"BANK_TRANSFER\",\"bankName\":\"VCB\",\"bankAccountNumber\":\"abc\",\"bankAccountName\":\"KHACH E2E\"}" | jget 'o.error')" "INVALID_REFUND_METHOD"
check "Hẹn trả ngày mai, nhận cọc tiền mặt" "$(code POST $KH "$API/contracts/$C/request-checkout" "{\"checkoutDate\":\"$TOMORROW\",\"refundMethod\":\"CASH\"}")" "200"
check "FM nhận thông báo khách hẹn trả kho" "$(call GET $FM "$API/notifications?limit=100" | jget 'o.some(n=>n.type==="CHECKOUT")')" "true"

echo "== Nghiệm thu → trạng thái hoàn tiền thống nhất giữa danh sách và chi tiết"
T2=$(sql "SELECT id FROM facility_tasks WHERE contract_id=$C AND task_type='CHECK_OUT' AND status IN ('OPEN','IN_PROGRESS')")
check "⚡ Khách tới trả kho hôm nay" "$(code POST $FM "$API/dev/simulation/tasks/$T2/checkout-today")" "200"
call POST $FM "$API/staff-tasks/$T2/assign?staffId=$ST1_ID" >/dev/null
check "Staff nghiệm thu (nguyên vẹn)" "$(code POST $ST1 "$API/staff-tasks/$T2/check-out" "{\"evidenceImages\":[\"http://e2e/hien-trang.png\"],\"identityVerified\":true,\"unitEmpty\":true,\"unitClean\":true,\"lockIntact\":true,\"customerSignatureConfirmed\":true,\"notes\":\"E2E\"}")" "200"
check "Chi tiết HĐ: chờ hoàn tiền (không còn ghi đã hoàn)" "$(call GET $KH "$API/contracts?reservationId=$RES" | jget 'o.status+"/"+o.refundStatus')" "TERMINATED/PENDING"
check "Danh sách Kho của tôi: chờ hoàn tiền" "$(call GET $KH "$API/reservations/my" | jget "o.find(r=>r.id===$RES).status")" "REFUND_PENDING"
RT=$(sql "SELECT TOP 1 id FROM facility_tasks WHERE contract_id=$C AND task_type='REFUND' ORDER BY id DESC")
check "FM xác nhận đã hoàn tiền mặt" "$(code POST $FM "$API/staff-tasks/$RT/complete-refund" "{\"paymentMethod\":\"CASH\",\"cashReceiptConfirmed\":true,\"note\":\"E2E\"}")" "200"
check "Chi tiết HĐ: đã hoàn" "$(call GET $KH "$API/contracts?reservationId=$RES" | jget 'o.refundStatus')" "COMPLETED"
check "Danh sách Kho của tôi: đã hoàn" "$(call GET $KH "$API/reservations/my" | jget "o.find(r=>r.id===$RES).status")" "REFUNDED"
check "Khách nhận thông báo nghiệm thu + đã hoàn tiền" "$(call GET $KH "$API/notifications" | jget 'o.filter(n=>n.type==="REFUND").length>=2')" "true"

echo "== PR-M9: ghi chú bảo trì ô kho"
U6=$(sql "SELECT TOP 1 id FROM storage_units WHERE facility_id=1 AND unit_type_id=6 AND status='AVAILABLE' ORDER BY id")
check "Khoá bảo trì thiếu ghi chú → 400" "$(code PATCH $FM "$API/storage-units/$U6/status" '{"status":"MAINTENANCE"}')" "400"
check "Khoá bảo trì lưu ghi chú" "$(call PATCH $FM "$API/storage-units/$U6/status" '{"status":"MAINTENANCE","note":"E2E thay khoa SmartLock"}' | jget 'o.maintenanceNote')" "E2E thay khoa SmartLock"
check "Danh sách ô hiện ghi chú" "$(call GET $FM "$API/storage-units/$U6" | jget 'o.maintenanceNote')" "E2E thay khoa SmartLock"
check "Mở lại → xoá ghi chú" "$(call PATCH $FM "$API/storage-units/$U6/status" '{"status":"AVAILABLE"}' | jget 'o.maintenanceNote===null')" "true"

echo
echo "Kết quả: $PASS đạt, $FAIL lỗi"
[ "$FAIL" == "0" ]
