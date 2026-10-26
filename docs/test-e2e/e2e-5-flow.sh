#!/usr/bin/env bash
# Chạy (Git Bash, backend + DB local đang chạy): bash docs/test-e2e/e2e-5-flow.sh
# Cần: node, sqlcmd. Script tự chuẩn bị dữ liệu (1 ô Mini M trống ở Tân Bình) và trả chính sách Tân Bình về v1 khi xong.
# Lưu ý: body JSON trong script để KHÔNG DẤU — Git Bash trên Windows truyền tiếng Việt cho curl.exe sai mã hoá.
# E2E 5 flow Must-have qua API thật (backend localhost:8080, DB QueenKhoDB)
SCR="$(cd "$(dirname "$0")" && pwd)"
API=http://localhost:8080/api/v1
PAY=http://localhost:8080/api/payments/vnpay
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "  ✅ $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  ❌ $1"; }
check(){ if [ "$2" == "$3" ]; then ok "$1 ($2)"; else bad "$1: mong đợi [$3], thực tế [$2]"; fi; }
sql()  { sqlcmd -S localhost -U sa -P 12345 -d QueenKhoDB -h-1 -W -Q "SET NOCOUNT ON; $1" | tr -d '\r' | sed '/^$/d'; }
jget() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const o=JSON.parse(s);const v=($1);console.log(v===undefined?'':typeof v==='object'?JSON.stringify(v):v)}catch(e){console.log('PARSE_ERR')}})"; }
login(){ curl -s -X POST $API/auth/login -H "Content-Type: application/json" -d "{\"email\":\"$1\",\"password\":\"123456\"}" | jget "o.token"; }
call() { local m=$1 t=$2 u=$3 d=$4; if [ -n "$d" ]; then curl -s -X $m -H "Authorization: Bearer $t" -H "Content-Type: application/json" -d "$d" "$u"; else curl -s -X $m -H "Authorization: Bearer $t" "$u"; fi; }
code() { local m=$1 t=$2 u=$3 d=$4; if [ -n "$d" ]; then curl -s -o /dev/null -w "%{http_code}" -X $m -H "Authorization: Bearer $t" -H "Content-Type: application/json" -d "$d" "$u"; else curl -s -o /dev/null -w "%{http_code}" -X $m -H "Authorization: Bearer $t" "$u"; fi; }
ipn()  { curl -s "$PAY/ipn?$(node "$SCR/vnp_sign.js" "$1" "$2" "${3:-00}")" | jget "o.RspCode"; }
TODAY=$(date +%Y-%m-%d)
# Chuẩn bị: đúng 1 ô Mini M trống ở Tân Bình (để thử chống overbooking), không còn đơn chờ giữ suất
sql "UPDATE rental_contracts SET status='ACTIVE', end_date=DATEADD(month,1,CAST(GETDATE() AS date)) WHERE status='OVERDUE' AND customer_id=(SELECT id FROM users WHERE email='khachhang1@gmail.com');
     UPDATE storage_units SET status='MAINTENANCE' WHERE facility_id=1 AND unit_type_id=1 AND status='AVAILABLE';
     UPDATE storage_units SET status='AVAILABLE' WHERE id=(SELECT TOP 1 id FROM storage_units WHERE facility_id=1 AND unit_type_id=1 AND status='MAINTENANCE' ORDER BY id);
     UPDATE reservations SET status='EXPIRED' WHERE status='PENDING';" >/dev/null

KH=$(login khachhang1@gmail.com); KH2=$(login khachhang2@gmail.com)
FM=$(login fmtanbinh@gmail.com); FM2=$(login fmbinhthanh@gmail.com)
ST1=$(login stafftanbinh1@gmail.com); ST2=$(login stafftanbinh2@gmail.com)
BOM=$(login bom@queenkho.com); AD=$(login admin@queenkho.com)
STAFF1_ID=$(sql "SELECT id FROM users WHERE email='stafftanbinh1@gmail.com'"); STAFF2_ID=$(sql "SELECT id FROM users WHERE email='stafftanbinh2@gmail.com'")

echo "== Flow 4a: BOM đặt chính sách (ưu đãi 3 tháng 8%, cọc 1 tháng, cho phép miễn phí trễ)"
R=$(call POST $BOM "$API/rental-policies/facilities/1" '{"depositMonthMultiplier":1,"cancelFeePercent":50,"cancelFreeHours":24,"lateFeePercentPerDay":10,"bookingDiscount3m":8,"allowLateFeeWaiver":true}')
check "Tạo phiên bản chính sách mới" "$(echo "$R" | jget 'o.active')" "true"
check "Ưu đãi 3 tháng = 8%" "$(curl -s $API/facilities/1/pricing | jget 'o.bookingPackages[1].discountPercent')" "8"
check "FM không sửa được chính sách" "$(code POST $FM "$API/rental-policies/facilities/1" '{"depositMonthMultiplier":1,"cancelFeePercent":50,"cancelFreeHours":24,"lateFeePercentPerDay":10}')" "403"

echo "== Flow 1: Đặt kho Mini M (Tân Bình) 3 tháng, ngày bắt đầu hôm nay"
FREE=$(sql "SELECT COUNT(*) FROM storage_units WHERE facility_id=1 AND unit_type_id=1 AND status='AVAILABLE'")
R=$(call POST $KH "$API/reservations" "{\"customerId\":2,\"facilityId\":1,\"unitTypeId\":1,\"startDate\":\"$TODAY\",\"durationMonths\":3}")
RES1=$(echo "$R" | jget 'o.id'); echo "  đơn #$RES1 $(echo "$R" | jget 'o.reservationCode')"
check "Đơn đứng tên KH1 dù gửi customerId=2" "$(sql "SELECT customer_id FROM reservations WHERE id=$RES1")" "$(sql "SELECT id FROM users WHERE email='khachhang1@gmail.com'")"
check "Chốt % ưu đãi 8% vào đơn" "$(sql "SELECT rent_discount_percent FROM reservations WHERE id=$RES1")" "8"
if [ "$FREE" == "1" ]; then
  R2=$(call POST $KH2 "$API/reservations" "{\"facilityId\":1,\"unitTypeId\":1,\"startDate\":\"$TODAY\",\"durationMonths\":1}")
  check "KH2 đặt suất Mini M cuối cùng → hết chỗ (L-13)" "$(echo "$R2" | jget 'o.error')" "NO_AVAILABILITY"
fi
P=$(call POST $KH "$PAY/create" "{\"reservationId\":$RES1}")
REF=$(echo "$P" | jget 'o.orderId'); AMT=$(echo "$P" | jget 'o.amount')
# 750.000×3 = 2.250.000 − 8% (180.000) + cọc 750.000 − 100.000 = 2.720.000
check "Số tiền VNPAY theo ưu đãi chính sách" "$AMT" "2720000"
check "KH2 không thanh toán được đơn KH1" "$(code POST $KH2 "$PAY/create" "{\"reservationId\":$RES1}")" "403"
check "IPN thành công" "$(ipn $REF $AMT)" "00"
check "Đơn DEPOSIT_PAID" "$(sql "SELECT status FROM reservations WHERE id=$RES1")" "DEPOSIT_PAID"
check "KH2 xem trước phí huỷ đơn của KH1 → 403" "$(code GET $KH2 "$API/reservations/$RES1/cancel-preview")" "403"

echo "== Flow 1 (FM): gán ô đúng loại"
check "FM cơ sở 2 không thấy/không gán đơn cơ sở 1" "$(code GET $FM2 "$API/reservations/$RES1/available-units")" "403"
UNITS=$(call GET $FM "$API/reservations/$RES1/available-units")
UNIT=$(echo "$UNITS" | jget 'o[0].id'); TYPES=$(echo "$UNITS" | jget '[...new Set(o.map(u=>u.unitTypeName))].length')
check "Chỉ gợi ý ô cùng loại (BR-41)" "$TYPES" "1"
OTHER=$(sql "SELECT TOP 1 id FROM storage_units WHERE facility_id=1 AND unit_type_id<>1 AND status='AVAILABLE'")
check "Gán ô khác loại bị chặn (L-11)" "$(code POST $FM "$API/reservations/$RES1/assign" "{\"storageUnitId\":\"$OTHER\"}")" "400"
check "Gán ô đúng loại" "$(code POST $FM "$API/reservations/$RES1/assign" "{\"storageUnitId\":\"$UNIT\"}")" "200"
C1=$(sql "SELECT id FROM rental_contracts WHERE reservation_id=$RES1")
T1=$(sql "SELECT id FROM facility_tasks WHERE contract_id=$C1 AND task_type='CHECK_IN'")
check "HĐ chờ check-in, gắn chính sách đang hiệu lực" "$(sql "SELECT status FROM rental_contracts WHERE id=$C1")" "PENDING_CHECK_IN"

echo "== Flow 5: FM giao việc check-in cho Staff1"
check "Staff không tự giao việc" "$(code POST $ST1 "$API/staff-tasks/$T1/assign?staffId=$STAFF1_ID")" "403"
R=$(call POST $FM "$API/staff-tasks/$T1/assign?staffId=$STAFF1_ID")
check "Task IN_PROGRESS, người nhận Staff1" "$(echo "$R" | jget 'o.status+"/"+o.staffId')" "IN_PROGRESS/$STAFF1_ID"
check "Giao lại đúng người → 409" "$(code POST $FM "$API/staff-tasks/$T1/assign?staffId=$STAFF1_ID")" "409"

echo "== Flow 2: Staff1 check-in, bàn giao PIN + thẻ"
PIN=$(call GET $ST1 "$API/staff-tasks/pin-suggestion" | jget 'o.accessPinCode')
BODY="{\"identityVerified\":true,\"unitEmpty\":true,\"unitClean\":true,\"lockIntact\":true,\"customerSignatureConfirmed\":true,\"accessPinCode\":\"$PIN\",\"rfidCardCode\":\"RFID-E2E-$RES1\"}"
check "Staff2 check-in task của Staff1 → 409" "$(code POST $ST2 "$API/staff-tasks/$T1/check-in" "$BODY")" "409"
check "Staff1 check-in" "$(code POST $ST1 "$API/staff-tasks/$T1/check-in" "$BODY")" "200"
check "HĐ ACTIVE" "$(sql "SELECT status FROM rental_contracts WHERE id=$C1")" "ACTIVE"

echo "== Flow 3: Khách quản lý kho đang thuê"
check "KH1 xem HĐ của mình" "$(code GET $KH "$API/contracts/$C1")" "200"
check "KH2 xem HĐ của KH1 → 403" "$(code GET $KH2 "$API/contracts/$C1")" "403"
check "KH lọc ?facilityId=1 vẫn chỉ ra HĐ của mình" "$(call GET $KH "$API/contracts?facilityId=1" | jget '[...new Set(o.map(c=>c.customerId))].length')" "1"
check "Báo giá gia hạn 4 gói" "$(call GET $KH "$API/contracts/$C1/renewal-quote" | jget 'o.length')" "4"
check "KH2 yêu cầu trả kho HĐ KH1 → 403 (I13)" "$(code POST $KH2 "$API/contracts/$C1/request-checkout" "{\"checkoutDate\":\"$TODAY\"}")" "403"
R=$(call POST $KH "$API/contracts/$C1/request-checkout" "{\"checkoutDate\":\"$TODAY\",\"refundMethod\":\"BANK_TRANSFER\",\"bankName\":\"VCB\",\"bankAccountNumber\":\"0123456789\",\"bankAccountName\":\"KHACH HANG 1\"}")
check "Yêu cầu trả kho" "$(sql "SELECT status FROM rental_contracts WHERE id=$C1")" "TERMINATION_PENDING"
T2=$(sql "SELECT id FROM facility_tasks WHERE contract_id=$C1 AND task_type='CHECK_OUT' AND status='OPEN'")
check "FM giao nghiệm thu cho Staff2" "$(call POST $FM "$API/staff-tasks/$T2/assign?staffId=$STAFF2_ID" | jget 'o.staffId')" "$STAFF2_ID"
OUT="{\"identityVerified\":true,\"unitEmpty\":true,\"unitClean\":false,\"lockIntact\":true,\"customerSignatureConfirmed\":true,\"notes\":\"E2E\",\"damageCases\":[{\"title\":\"Vo ke\",\"estimatedCost\":3000000,\"evidenceImages\":[\"http://localhost:8080/uploads/demo.png\"]}]}"
check "Staff2 nghiệm thu có sự cố 3.000.000 (vượt cọc)" "$(code POST $ST2 "$API/staff-tasks/$T2/check-out" "$OUT")" "200"
check "HĐ TERMINATED, ô bảo trì" "$(sql "SELECT rc.status+'/'+su.status FROM rental_contracts rc JOIN storage_units su ON su.id=rc.storage_unit_id WHERE rc.id=$C1")" "TERMINATED/MAINTENANCE"
DEBT=$(sql "SELECT id FROM payment_transactions WHERE contract_id=$C1 AND payment_type='DAMAGE_FEE' AND status='PENDING'")
[ -n "$DEBT" ] && ok "Phát sinh khoản nợ phí sự cố #$DEBT" || bad "Không có khoản nợ phí sự cố"
R=$(call POST $KH "$API/reservations" "{\"facilityId\":1,\"unitTypeId\":6,\"startDate\":\"$TODAY\",\"durationMonths\":1}")
check "Còn nợ → không đặt được kho mới" "$(echo "$R" | jget 'o.error')" "CUSTOMER_HAS_DEBT"

echo "== UC-20: Khách xem thanh toán và trả nợ"
R=$(call GET $KH "$API/payments/my")
check "Có 1 khoản cần trả" "$(echo "$R" | jget 'o.debts.length')" "1"
P=$(call POST $KH "$PAY/create-debt" "{\"paymentId\":$DEBT}")
DREF=$(echo "$P" | jget 'o.orderId'); DAMT=$(echo "$P" | jget 'o.amount')
check "KH2 trả nợ của KH1 → 403" "$(code POST $KH2 "$PAY/create-debt" "{\"paymentId\":$DEBT}")" "403"
check "Huỷ trên VNPAY → nợ vẫn PENDING" "$(ipn $DREF $DAMT 24; sql "SELECT status FROM payment_transactions WHERE id=$DEBT")" "$(echo 00; echo PENDING)"
check "Trả thành công" "$(ipn $DREF $DAMT)" "00"
check "Khoản nợ SUCCESS" "$(sql "SELECT status FROM payment_transactions WHERE id=$DEBT")" "SUCCESS"

echo "== FM hoàn tiền: chỉ đúng giao dịch của HĐ (K08)"
RT=$(sql "SELECT TOP 1 id FROM facility_tasks WHERE contract_id=$C1 AND task_type='REFUND' ORDER BY id DESC")
OTHER_PENDING=$(sql "SELECT COUNT(*) FROM payment_transactions WHERE payment_type='REFUND' AND status='PENDING' AND ISNULL(contract_id,-1)<>$C1")
check "FM hoàn tất task hoàn tiền" "$(code POST $FM "$API/staff-tasks/$RT/complete-refund" '{"paymentMethod":"BANK_TRANSFER","bankTransactionCode":"FT2610E2E"}')" "200"
check "Giao dịch REFUND khác không bị đổi" "$(sql "SELECT COUNT(*) FROM payment_transactions WHERE payment_type='REFUND' AND status='PENDING' AND ISNULL(contract_id,-1)<>$C1")" "$OTHER_PENDING"

echo "== Flow 6: Quá hạn → FM miễn phí trễ → khách gia hạn chỉ trả tiền thuê"
# Chọn loại kho (khác Mini M) còn ô trống ở Tân Bình; tiền tính theo giá thật của loại đó (cọc 1 tháng, v1)
T6=$(sql "SELECT TOP 1 unit_type_id FROM storage_units WHERE facility_id=1 AND unit_type_id<>1 AND status='AVAILABLE' GROUP BY unit_type_id ORDER BY MIN(unit_type_id) DESC")
if [ -z "$T6" ]; then bad "Tân Bình hết ô trống để thử Flow 6 — mở bảo trì 1 ô ở /manager/storage rồi chạy lại"; fi
PRICE=$(sql "SELECT CAST(base_price_monthly AS INT) FROM unit_types WHERE id=$T6"); LATE=$((PRICE * 3 / 10)); RENEW_TOTAL=$((PRICE + LATE))
echo "  dùng loại kho #$T6 giá $PRICE"
R=$(call POST $KH "$API/reservations" "{\"facilityId\":1,\"unitTypeId\":$T6,\"startDate\":\"$TODAY\",\"durationMonths\":1}")
RES2=$(echo "$R" | jget 'o.id'); P=$(call POST $KH "$PAY/create" "{\"reservationId\":$RES2}")
ipn $(echo "$P" | jget 'o.orderId') $(echo "$P" | jget 'o.amount') >/dev/null
U2=$(call GET $FM "$API/reservations/$RES2/available-units" | jget 'o[0].id')
code POST $FM "$API/reservations/$RES2/assign" "{\"storageUnitId\":\"$U2\"}" >/dev/null
C2=$(sql "SELECT id FROM rental_contracts WHERE reservation_id=$RES2"); T3=$(sql "SELECT id FROM facility_tasks WHERE contract_id=$C2 AND task_type='CHECK_IN'")
call POST $ST1 "$API/staff-tasks/$T3/claim" >/dev/null
PIN2=$(call GET $ST1 "$API/staff-tasks/pin-suggestion" | jget 'o.accessPinCode')
code POST $ST1 "$API/staff-tasks/$T3/check-in" "{\"identityVerified\":true,\"unitEmpty\":true,\"unitClean\":true,\"lockIntact\":true,\"customerSignatureConfirmed\":true,\"accessPinCode\":\"$PIN2\",\"rfidCardCode\":\"RFID-E2E-$RES2\"}" >/dev/null
# Giả lập job quá hạn: hết hạn 3 ngày trước
sql "UPDATE rental_contracts SET end_date=DATEADD(day,-3,CAST(GETDATE() AS date)), status='OVERDUE' WHERE id=$C2" >/dev/null
Q=$(call GET $KH "$API/contracts/$C2/renewal-quote")
check "Báo giá gia hạn 1 tháng: thuê $PRICE + phí trễ 3 ngày 10%×3 cọc = $LATE" "$(echo "$Q" | jget 'o[0].lateFeeAmount+"/"+o[0].totalAmount')" "$LATE/$RENEW_TOTAL"
check "Lý do quá ngắn → 400" "$(code POST $FM "$API/contracts/$C2/waive-late-fee" '{"reason":"ok"}')" "400"
check "FM cơ sở 2 miễn HĐ cơ sở 1 → 403" "$(code POST $FM2 "$API/contracts/$C2/waive-late-fee" '{"reason":"Ly do hop le"}')" "403"
check "FM miễn phí trễ" "$(code POST $FM "$API/contracts/$C2/waive-late-fee" '{"reason":"Khach nam vien, cam ket gia han"}')" "200"
Q=$(call GET $KH "$API/contracts/$C2/renewal-quote")
check "Sau khi miễn: tổng = tiền thuê $PRICE" "$(echo "$Q" | jget 'o[0].totalAmount+"/"+o[0].lateFeeWaived')" "$PRICE/true"
P=$(call POST $KH "$PAY/create-renewal" "{\"contractId\":$C2,\"months\":1}")
check "Link gia hạn đúng $PRICE" "$(echo "$P" | jget 'o.amount')" "$PRICE"
check "IPN gia hạn" "$(ipn $(echo "$P" | jget 'o.orderId') $PRICE)" "00"
check "HĐ ACTIVE lại, cờ miễn reset" "$(sql "SELECT status+'/'+CAST(late_fee_waived AS varchar) FROM rental_contracts WHERE id=$C2")" "ACTIVE/0"

echo "== Flow 4b: Báo cáo"
check "FM xem báo cáo cơ sở mình (bị khoá facilityId)" "$(code GET $FM "$API/bom/revenue/overview?facilityId=3&year=2026")" "200"
check "FM không so sánh các cơ sở" "$(code GET $FM "$API/bom/revenue/by-facility?year=2026")" "403"
check "BOM so sánh các cơ sở" "$(code GET $BOM "$API/bom/revenue/by-facility?year=2026")" "200"
check "FM xem dashboard cơ sở khác → 403" "$(code GET $FM "$API/facilities/2/dashboard")" "403"

echo "== Admin: lịch sử đăng nhập + nhật ký"
for CODE in TASK_ASSIGN FEE_WAIVE DEBT_PAID UNIT_ASSIGN RESERVATION_CREATE; do
  N=$(sql "SELECT COUNT(*) FROM activity_logs WHERE action LIKE '\[$CODE]%' ESCAPE '\' AND created_at > DATEADD(minute,-10,SYSDATETIME())")
  [ "$N" -gt 0 ] && ok "Nhật ký có [$CODE] ($N dòng)" || bad "Thiếu log [$CODE]"
done
check "Lịch sử đăng nhập có lượt của 8 tài khoản test" "$(call GET $AD "$API/admin/login-history?eventType=LOGIN_SUCCESS&size=50" | jget '[...new Set(o.content.map(r=>r.email))].length>=8')" "true"

echo "== Dọn: chính sách Tân Bình về v1"
V1=$(sql "SELECT id FROM rental_policy WHERE facility_id=1 AND version=1")
check "Áp dụng lại v1" "$(call POST $BOM "$API/rental-policies/facilities/1/activate/$V1" | jget 'o.version')" "1"

echo; echo "KẾT QUẢ: $PASS PASS / $FAIL FAIL"
echo "RES1=$RES1 C1=$C1 RES2=$RES2 C2=$C2"
