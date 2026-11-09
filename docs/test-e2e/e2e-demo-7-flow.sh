#!/usr/bin/env bash
# Diễn tập kịch bản demo 7 flow qua API thật, trên dữ liệu sql_script/QueenKho_demo_data.sql.
# Mỗi check ứng với 1 ca trong docs/kich-ban-demo-7-flow.md (F1-H, F2-X3...).
#
# ⚠️ Script LÀM THẬT mọi ca nên dữ liệu demo bị dùng hết. Chạy xong PHẢI nạp lại:
#    QueenKho_setup_data.sql rồi QueenKho_demo_data.sql, sau đó mới demo.
#
# Chạy (Git Bash, backend localhost:8080, DB vừa nạp dữ liệu demo):
#    bash docs/test-e2e/e2e-demo-7-flow.sh
#    E2E_DB=TenDB bash docs/test-e2e/e2e-demo-7-flow.sh     # nếu dùng DB khác QueenKhoDB
SCR="$(cd "$(dirname "$0")" && pwd)"
HOST=${E2E_HOST:-http://localhost:8080}
DB=${E2E_DB:-QueenKhoDB}
API=$HOST/api/v1
PAY=$HOST/api/payments/vnpay
SIM=$API/dev/simulation
PASS=0; FAIL=0
TODAY=$(date +%Y-%m-%d)
IMG='http://localhost:5173/demo/hien-trang-o-kho.svg'

ok()   { PASS=$((PASS+1)); echo "  ✅ $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  ❌ $1"; }
check(){ if [ "$2" == "$3" ]; then ok "$1 ($2)"; else bad "$1: mong đợi [$3], thực tế [$2]"; fi; }
sql()  { sqlcmd -S localhost -U sa -P 12345 -d "$DB" -C -I -h-1 -W -Q "SET NOCOUNT ON; $1" | tr -d '\r' | sed '/^$/d'; }
jget() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const o=JSON.parse(s);const v=($1);console.log(v===undefined||v===null?'':typeof v==='object'?JSON.stringify(v):v)}catch(e){console.log('PARSE_ERR')}})"; }
login(){ curl -s -X POST $API/auth/login -H "Content-Type: application/json" -d "{\"email\":\"$1\",\"password\":\"123456\"}" | jget "o.token"; }
call() { local m=$1 t=$2 u=$3 d=$4; if [ -n "$d" ]; then curl -s -X $m -H "Authorization: Bearer $t" -H "Content-Type: application/json" -d "$d" "$u"; else curl -s -X $m -H "Authorization: Bearer $t" "$u"; fi; }
code() { local m=$1 t=$2 u=$3 d=$4; if [ -n "$d" ]; then curl -s -o /dev/null -w "%{http_code}" -X $m -H "Authorization: Bearer $t" -H "Content-Type: application/json" -d "$d" "$u"; else curl -s -o /dev/null -w "%{http_code}" -X $m -H "Authorization: Bearer $t" "$u"; fi; }
ipn()  { curl -s "$PAY/ipn?$(node "$SCR/vnp_sign.js" "$1" "$2" "${3:-00}")" | jget "o.RspCode"; }
plus() { date -d "$TODAY +$1 day" +%Y-%m-%d; }
rid()  { sql "SELECT id FROM reservations WHERE reservation_code='$1'"; }
cid()  { sql "SELECT id FROM rental_contracts WHERE contract_code='$1'"; }
tid()  { sql "SELECT TOP 1 t.id FROM facility_tasks t JOIN rental_contracts c ON c.id=t.contract_id WHERE c.contract_code='$1' AND t.task_type='$2' ORDER BY t.id DESC"; }
ust()  { sql "SELECT status FROM storage_units WHERE id='$1'"; }
tier() { call GET "$1" "$API/reservations/$(rid "$2")/cancel-preview" | jget 'o.policyTier'; }
kh()   { login "$1.khach@queenkho.local"; }
BOOK='"acceptedTerms":true,"goodsCategoryCodes":["HOUSEHOLD"]'
checkin_body() { echo "{\"evidenceImages\":[\"$IMG\"],\"identityVerified\":true,\"unitEmpty\":true,\"unitClean\":true,\"lockIntact\":true,\"customerSignatureConfirmed\":true,\"goodsChecked\":true,\"accessPinCode\":\"$1\",\"rfidCardCode\":\"$2\"}"; }

FM=$(login fmtanbinh@gmail.com); FMBT=$(login fmbinhthanh@gmail.com); ST1=$(login stafftanbinh1@gmail.com); ST2=$(login stafftanbinh2@gmail.com); BOM=$(login bom@queenkho.com); ADM=$(login admin@queenkho.com)
ST1_ID=$(sql "SELECT id FROM users WHERE email='stafftanbinh1@gmail.com'")
[ -n "$FM" ] && [ -n "$ST1" ] && [ -n "$BOM" ] || { echo "Không đăng nhập được tài khoản nội bộ"; exit 1; }
AN=$(kh an); [ -n "$AN" ] || { echo "Chưa nạp QueenKho_demo_data.sql?"; exit 1; }

echo "======== FLOW 1 — Đặt kho ========"
echo "== F1-H: khách tìm kho, đặt Mini M 3 tháng + voucher, thanh toán"
check "Tân Bình còn Mini M trong tìm kiếm" "$(curl -s "$API/facilities/1/availability" | jget 'o.unitTypeAvailability.find(u=>u.unitTypeId===1).availableCount>0')" "true"
check "Voucher HE2026 giảm 150.000đ" "$(call GET $AN "$API/vouchers/validate?code=HE2026&facilityId=1&unitTypeId=1&months=3" | jget 'o.discountAmount')" "150000"
R=$(call POST $AN "$API/reservations" "{\"facilityId\":1,\"unitTypeId\":1,\"startDate\":\"$(plus 7)\",\"durationMonths\":3,\"voucherCode\":\"HE2026\",$BOOK}")
RH=$(echo "$R" | jget 'o.id'); check "Tạo đơn PENDING" "$(echo "$R" | jget 'o.status')" "PENDING"
P=$(call POST $AN "$PAY/create" "{\"reservationId\":$RH}")
check "Tổng tiền 2.737.500đ (thuê 2.137.500 + cọc 750.000 − voucher 150.000)" "$(echo "$P" | jget 'Math.round(o.amount)')" "2737500"
check "IPN thành công" "$(ipn $(echo "$P" | jget 'o.orderId') $(echo "$P" | jget 'o.amount'))" "00"
check "Đơn DEPOSIT_PAID" "$(sql "SELECT status FROM reservations WHERE id=$RH")" "DEPOSIT_PAID"
check "IPN gửi lại → 02 Already confirmed (không xử lý 2 lần)" "$(ipn $(echo "$P" | jget 'o.orderId') $(echo "$P" | jget 'o.amount'))" "02"
check "Trong 30 phút xem trước huỷ: hoàn 100% (BOOKING_GRACE)" "$(call GET $AN "$API/reservations/$RH/cancel-preview" | jget 'o.policyTier')" "BOOKING_GRACE"

echo "== F1-X1: ràng buộc nhập liệu đặt kho"
check "Thực phẩm vào kho thường → GOODS_REQUIRES_COLD_STORAGE" "$(call POST $AN "$API/reservations" "{\"facilityId\":1,\"unitTypeId\":1,\"startDate\":\"$(plus 7)\",\"durationMonths\":1,\"acceptedTerms\":true,\"goodsCategoryCodes\":[\"FOOD\"]}" | jget 'o.error')" "GOODS_REQUIRES_COLD_STORAGE"
check "Chưa khai loại hàng → GOODS_CATEGORY_REQUIRED" "$(call POST $AN "$API/reservations" "{\"facilityId\":1,\"unitTypeId\":1,\"startDate\":\"$(plus 7)\",\"durationMonths\":1,\"acceptedTerms\":true}" | jget 'o.error')" "GOODS_CATEGORY_REQUIRED"
check "Không đồng ý điều khoản → TERMS_NOT_ACCEPTED" "$(call POST $AN "$API/reservations" "{\"facilityId\":1,\"unitTypeId\":1,\"startDate\":\"$(plus 7)\",\"durationMonths\":1,\"goodsCategoryCodes\":[\"HOUSEHOLD\"]}" | jget 'o.error')" "TERMS_NOT_ACCEPTED"
check "Ngày nhận sau 91 ngày → START_DATE_TOO_FAR" "$(call POST $AN "$API/reservations" "{\"facilityId\":1,\"unitTypeId\":1,\"startDate\":\"$(plus 91)\",\"durationMonths\":1,$BOOK}" | jget 'o.error')" "START_DATE_TOO_FAR"
check "Ngày nhận trong quá khứ → 400" "$(code POST $AN "$API/reservations" "{\"facilityId\":1,\"unitTypeId\":1,\"startDate\":\"$(plus -1)\",\"durationMonths\":1,$BOOK}")" "400"
for v in "LANH50" "HETHAN" "HETLUOT"; do
  check "Voucher $v trên Mini M → 400 VOUCHER_INVALID" "$(call GET $AN "$API/vouchers/validate?code=$v&facilityId=1&unitTypeId=1&months=3" | jget 'o.error')" "VOUCHER_INVALID"
done
check "Voucher DAIHAN10 gói 1 tháng → 400 VOUCHER_INVALID" "$(call GET $AN "$API/vouchers/validate?code=DAIHAN10&facilityId=1&unitTypeId=1&months=1" | jget 'o.error')" "VOUCHER_INVALID"

echo "== F1-X2: ô sắp trống — Kho XL hết ô, hiện Trống từ dd/MM"
check "XL báo trống từ ngày hẹn trả + 1" "$(curl -s "$API/facilities/1/availability" | jget 'o.unitTypeAvailability.find(u=>u.unitTypeId===5).availableFrom')" "$(plus 6)"
check "Đặt XL trước ngày đó → NO_AVAILABILITY" "$(call POST $AN "$API/reservations" "{\"facilityId\":1,\"unitTypeId\":5,\"startDate\":\"$(plus 3)\",\"durationMonths\":1,$BOOK}" | jget 'o.error')" "NO_AVAILABILITY"
check "Hỏi XL từ ngày đó → còn suất" "$(curl -s "$API/reservations/availability?facilityId=1&unitTypeId=5&startDate=$(plus 6)&durationMonths=1" | jget 'o.available')" "true"

echo "== F1-X3: khách còn nợ bị chặn; trả nợ xong đặt lại được"
DUC=$(kh duc)
check "Đặt kho → 409 CUSTOMER_HAS_DEBT" "$(call POST $DUC "$API/reservations" "{\"facilityId\":1,\"unitTypeId\":1,\"startDate\":\"$(plus 7)\",\"durationMonths\":1,$BOOK}" | jget 'o.error')" "CUSTOMER_HAS_DEBT"
DEBT=$(sql "SELECT id FROM payment_transactions WHERE transaction_code='DMG-DEBT-F1-06'")
PD=$(call POST $DUC "$PAY/create-debt" "{\"paymentId\":$DEBT}")
check "Trả nợ qua VNPAY" "$(ipn $(echo "$PD" | jget 'o.orderId') $(echo "$PD" | jget 'o.amount'))" "00"
check "Hết nợ → đặt kho được" "$(call POST $DUC "$API/reservations" "{\"facilityId\":1,\"unitTypeId\":1,\"startDate\":\"$(plus 7)\",\"durationMonths\":1,$BOOK}" | jget 'o.status')" "PENDING"

echo "== F1-X4: số ô trống theo khoảng ngày (Kho Gia Đình: B201 đã gán khách nhận sau 60 ngày)"
check "1 tháng từ tuần sau → còn 1 ô" "$(curl -s "$API/reservations/availability?facilityId=1&unitTypeId=3&startDate=$(plus 7)&durationMonths=1" | jget 'o.freeSlots')" "1"
check "3 tháng từ tuần sau → hết ô" "$(curl -s "$API/reservations/availability?facilityId=1&unitTypeId=3&startDate=$(plus 7)&durationMonths=3" | jget 'o.available')" "false"

echo "== F1-X5..X8: các mức huỷ đơn"
HAI=$(kh hai)
check "Còn ≥ 48h → FULL_REFUND" "$(tier $HAI RES-F1-01)" "FULL_REFUND"
check "Còn 24–48h → HALF_DEPOSIT" "$(tier $HAI RES-F1-02)" "HALF_DEPOSIT"
check "Còn < 24h → FULL_DEPOSIT" "$(tier $HAI RES-F1-03)" "FULL_DEPOSIT"
check "Qua giờ hẹn → AFTER_APPOINTMENT" "$(tier $HAI RES-F1-04)" "AFTER_APPOINTMENT"
check "Tới ngày mà chưa gán ô → FACILITY_FAULT hoàn 100%" "$(tier $HAI RES-F1-05)" "FACILITY_FAULT"
check "Giữ 50% cọc = 925.000đ" "$(call GET $HAI "$API/reservations/$(rid RES-F1-02)/cancel-preview" | jget 'Math.round(o.penaltyAmount)')" "925000"
check "Khách khác xem / huỷ đơn của Hải → 403" "$(code GET $AN "$API/reservations/$(rid RES-F1-01)/cancel-preview")" "403"
CANCEL=$(call POST $HAI "$API/reservations/$(rid RES-F1-02)/cancel" '{"reason":"Doi ke hoach","refundMethod":"CASH"}')
check "Huỷ 24–48h: đơn chờ hoàn" "$(sql "SELECT status FROM reservations WHERE reservation_code='RES-F1-02'")" "REFUND_PENDING"
check "Có task REFUND cho FM" "$(sql "SELECT COUNT(*) FROM facility_tasks WHERE task_type='REFUND' AND note LIKE '%RES-F1-02%'")" "1"

echo "== F1-X9: tranh suất cuối Kho Lạnh"
KH2=$(kh khanh)
check "Lúc đầu còn 1 suất" "$(curl -s "$API/reservations/availability?facilityId=1&unitTypeId=7&startDate=$(plus 7)&durationMonths=1" | jget 'o.freeSlots')" "1"
FOOD='"acceptedTerms":true,"goodsCategoryCodes":["FOOD"]'
check "Khách 1 tạo đơn trước → giữ suất" "$(call POST $AN "$API/reservations" "{\"facilityId\":1,\"unitTypeId\":7,\"startDate\":\"$(plus 7)\",\"durationMonths\":1,$FOOD}" | jget 'o.status')" "PENDING"
check "Khách 2 bấm sau → NO_AVAILABILITY" "$(call POST $KH2 "$API/reservations" "{\"facilityId\":1,\"unitTypeId\":7,\"startDate\":\"$(plus 7)\",\"durationMonths\":1,$FOOD}" | jget 'o.error')" "NO_AVAILABILITY"

echo "== F1-X10: quá 15 phút chưa thanh toán → hết giữ chỗ"
RP=$(sql "SELECT TOP 1 id FROM reservations WHERE status='PENDING' AND unit_type_id=7 ORDER BY id DESC")
check "⚡ Quá 15p" "$(code POST $AN "$SIM/reservations/$RP/expire-hold")" "200"
check "Đơn EXPIRED" "$(sql "SELECT status FROM reservations WHERE id=$RP")" "EXPIRED"
check "Thanh toán đơn hết hạn → 400 PAYMENT_ERROR" "$(call POST $AN "$PAY/create" "{\"reservationId\":$RP}" | jget 'o.error')" "PAYMENT_ERROR"
check "Nhả suất: Kho Lạnh lại còn 1" "$(curl -s "$API/reservations/availability?facilityId=1&unitTypeId=7&startDate=$(plus 7)&durationMonths=1" | jget 'o.freeSlots')" "1"

echo "======== FLOW 2 — Gán ô, giao việc, check-in ========"
echo "== F2-H: ca chính"
R1=$(rid RES-F2-01)
UNIT=$(call GET $FM "$API/reservations/$R1/available-units" | jget 'o[0].id')
check "Gợi ý ô đúng loại Tiêu Chuẩn" "$(call GET $FM "$API/reservations/$R1/available-units" | jget 'o.every(u=>u.unitTypeName===o[0].unitTypeName)&&o.length>0')" "true"
check "Sai loại: gán ô Mini M → 400" "$(code POST $FM "$API/reservations/$R1/assign" '{"storageUnitId":"KV-TB-A107"}')" "400"
check "Sai cơ sở: gán ô Bình Thạnh → 400" "$(code POST $FM "$API/reservations/$R1/assign" '{"storageUnitId":"KV-BT-A101"}')" "400"
check "FM Bình Thạnh gán đơn Tân Bình → 403" "$(code POST $FMBT "$API/reservations/$R1/assign" "{\"storageUnitId\":\"$UNIT\"}")" "403"
check "FM Tân Bình gán ô $UNIT" "$(code POST $FM "$API/reservations/$R1/assign" "{\"storageUnitId\":\"$UNIT\"}")" "200"
check "Ô OCCUPIED (nhận kho hôm nay)" "$(ust $UNIT)" "OCCUPIED"
C1=$(sql "SELECT id FROM rental_contracts WHERE reservation_id=$R1")
check "Hợp đồng PENDING_CHECK_IN" "$(sql "SELECT status FROM rental_contracts WHERE id=$C1")" "PENDING_CHECK_IN"
T1=$(sql "SELECT id FROM facility_tasks WHERE contract_id=$C1 AND task_type='CHECK_IN'")
check "FM giao việc Staff 1" "$(call POST $FM "$API/staff-tasks/$T1/assign?staffId=$ST1_ID" | jget 'o.status')" "IN_PROGRESS"
check "Staff 2 không giữ task → TASK_NOT_YOURS" "$(call POST $ST2 "$API/staff-tasks/$T1/check-in" "$(checkin_body 246801 RFID-F2H)" | jget 'o.error')" "TASK_NOT_YOURS"
check "Thiếu ảnh → HANDOVER_PHOTO_REQUIRED" "$(call POST $ST1 "$API/staff-tasks/$T1/check-in" '{"evidenceImages":[],"identityVerified":true,"unitEmpty":true,"unitClean":true,"lockIntact":true,"customerSignatureConfirmed":true,"goodsChecked":true,"accessPinCode":"246801","rfidCardCode":"RFID-F2H"}' | jget 'o.error')" "HANDOVER_PHOTO_REQUIRED"
check "Thiếu mục checklist → CHECKLIST_INCOMPLETE" "$(call POST $ST1 "$API/staff-tasks/$T1/check-in" "{\"evidenceImages\":[\"$IMG\"],\"identityVerified\":false,\"unitEmpty\":true,\"unitClean\":true,\"lockIntact\":true,\"customerSignatureConfirmed\":true,\"goodsChecked\":true,\"accessPinCode\":\"246801\",\"rfidCardCode\":\"RFID-F2H\"}" | jget 'o.error')" "CHECKLIST_INCOMPLETE"
check "Chưa kiểm tra hàng → GOODS_CHECK_REQUIRED" "$(call POST $ST1 "$API/staff-tasks/$T1/check-in" "{\"evidenceImages\":[\"$IMG\"],\"identityVerified\":true,\"unitEmpty\":true,\"unitClean\":true,\"lockIntact\":true,\"customerSignatureConfirmed\":true,\"goodsChecked\":false,\"accessPinCode\":\"246801\",\"rfidCardCode\":\"RFID-F2H\"}" | jget 'o.error')" "GOODS_CHECK_REQUIRED"
check "RFID trùng hợp đồng đang thuê → RFID_TAKEN" "$(call POST $ST1 "$API/staff-tasks/$T1/check-in" "$(checkin_body 246801 RFID-DEMO-F3-01)" | jget 'o.error')" "RFID_TAKEN"
check "PIN trùng hợp đồng đang thuê → PIN_TAKEN" "$(call POST $ST1 "$API/staff-tasks/$T1/check-in" "$(checkin_body 135001 RFID-F2H)" | jget 'o.error')" "PIN_TAKEN"
check "Check-in hợp lệ" "$(code POST $ST1 "$API/staff-tasks/$T1/check-in" "$(checkin_body 246801 RFID-F2H)")" "200"
check "Hợp đồng ACTIVE" "$(sql "SELECT status FROM rental_contracts WHERE id=$C1")" "ACTIVE"
BINH=$(kh binh)
check "Khách thấy PIN trên hợp đồng" "$(call GET $BINH "$API/contracts/$C1" | jget 'o.accessPinCode')" "246801"
check "Khách xem được biên bản" "$(call GET $BINH "$API/contracts/$C1/handover-records" | jget 'o.length')" "1"

echo "== F2-X1 / X2: check-in sớm, sai người"
T2=$(tid HD-F2-02 CHECK_IN)
check "Check-in trước ngày hẹn → CHECK_IN_TOO_EARLY" "$(call POST $ST1 "$API/staff-tasks/$T2/check-in" "$(checkin_body 246802 RFID-X2)" | jget 'o.error')" "CHECK_IN_TOO_EARLY"

echo "== F2-X3: khung 30 ngày giao việc"
T3=$(tid HD-F2-03 CHECK_IN)
check "FM giao sớm → TASK_NOT_IN_WINDOW" "$(call POST $FM "$API/staff-tasks/$T3/assign?staffId=$ST1_ID" | jget 'o.error')" "TASK_NOT_IN_WINDOW"
check "Staff nhận sớm → TASK_NOT_IN_WINDOW" "$(call POST $ST1 "$API/staff-tasks/$T3/claim" | jget 'o.error')" "TASK_NOT_IN_WINDOW"
check "⚡ Hẹn còn 30 ngày: Staff → 403" "$(code POST $ST1 "$SIM/tasks/$T3/appointment-in?days=30")" "403"
check "⚡ Hẹn còn 30 ngày: FM" "$(code POST $FM "$SIM/tasks/$T3/appointment-in?days=30")" "200"
check "Vào khung → giao được" "$(call POST $FM "$API/staff-tasks/$T3/assign?staffId=$ST1_ID" | jget 'o.status')" "IN_PROGRESS"

echo "== F2-X4: kịch bản GV — lấp khoảng trống trước khách nhận sau 60 ngày"
RB=$(rid RES-F2-05); RE=$(rid RES-F2-06)
check "Ô C101 vẫn AVAILABLE dù đã gán khách A" "$(ust KV-TB-C101)" "AVAILABLE"
check "Đơn 1 tháng: C101 xếp đầu (vừa khít), trống đến ngày A nhận" "$(call GET $FM "$API/reservations/$RB/available-units" | jget 'o[0].id+"|"+o[0].freeUntil')" "KV-TB-C101|$(plus 60)"
check "Đơn 3 tháng: không gợi ý C101" "$(call GET $FM "$API/reservations/$RE/available-units" | jget "o.some(u=>u.id==='KV-TB-C101')")" "false"
check "Gán ép đơn 3 tháng vào C101 → 400" "$(code POST $FM "$API/reservations/$RE/assign" '{"storageUnitId":"KV-TB-C101"}')" "400"
check "Gán đơn 1 tháng vào C101" "$(code POST $FM "$API/reservations/$RB/assign" '{"storageUnitId":"KV-TB-C101"}')" "200"
CB=$(sql "SELECT id FROM rental_contracts WHERE reservation_id=$RB")
check "Dời khách B đè lên ngày A nhận → UNIT_SCHEDULE_CONFLICT" "$(call PUT $FM "$API/reservations/$RB/reschedule" "{\"newStartDate\":\"$(plus 40)\",\"reason\":\"e2e\"}" | jget 'o.error')" "UNIT_SCHEDULE_CONFLICT"
SCHED=$(call GET $FM "$API/storage-units/schedule?from=$TODAY&to=$(plus 120)&unitTypeId=6")
check "Lịch: C101 có 2 hợp đồng + khoảng trống giữa" "$(echo "$SCHED" | jget "(u=>u.bookings.length+'|'+u.freeRanges.some(r=>r.to==='$(plus 60)'))(o.units.find(u=>u.unitId==='KV-TB-C101'))")" "2|true"

echo "== F2-X5: ô bảo trì mà khách đã gán trước, hôm nay nhận"
T5=$(tid HD-F2-07 CHECK_IN); C5=$(cid HD-F2-07)
check "Check-in → UNIT_IN_MAINTENANCE" "$(call POST $ST1 "$API/staff-tasks/$T5/check-in" "$(checkin_body 246805 RFID-X5)" | jget 'o.error')" "UNIT_IN_MAINTENANCE"
check "Danh mục ô có cảnh báo D204" "$(call GET $FM "$API/storage-units?facilityId=1" | jget "!!o.units.find(u=>u.id==='KV-TB-D204').scheduleWarning")" "true"
OPT5=$(call GET $FM "$API/contracts/$C5/transfer-options"); Y5=$(echo "$OPT5" | jget 'o[0].id'); [ "$Y5" == "PARSE_ERR" ] && echo "  [debug] transfer-options: $OPT5"
check "FM đổi ô" "$(call POST $FM "$API/contracts/$C5/transfer-unit" "{\"toUnitId\":\"$Y5\",\"reasonType\":\"FACILITY_ISSUE\",\"reason\":\"Tham nuoc tran o D204\"}" | jget 'o.toUnitId')" "$Y5"
check "Check-in ở ô mới" "$(code POST $ST1 "$API/staff-tasks/$T5/check-in" "$(checkin_body 246805 RFID-X5)")" "200"

echo "== F2-X6..X8: No-Show"
LAN=$(kh lan)
LIST=$(call GET $FM "$API/reservations/overdue-no-show?facilityId=1")
check "Danh sách chỉ có đơn chưa nhận kho (3 đơn)" "$(echo "$LIST" | jget 'o.length')" "3"
check "Khách đã nhận kho không huỷ No-Show được → 400" "$(code POST $FM "$API/reservations/$(rid RES-F3-08)/no-show" '{"reason":"Thu huy nham"}')" "400"
check "Khách đã nhận kho không dời lịch được → 400" "$(code PUT $FM "$API/reservations/$(rid RES-F3-08)/reschedule" "{\"newStartDate\":\"$(plus 3)\",\"reason\":\"x\"}")" "400"
check "Khách từ chối tới → đủ điều kiện ngay" "$(echo "$LIST" | jget "o.find(r=>r.reservationCode==='RES-F2-08').noShowEligible")" "true"
check "Không liên lạc được, đủ 2 lần + 48h → đủ điều kiện" "$(echo "$LIST" | jget "o.find(r=>r.reservationCode==='RES-F2-09').noShowEligible")" "true"
check "Mới 1 lần, chưa 48h → chưa đủ" "$(echo "$LIST" | jget "o.find(r=>r.reservationCode==='RES-F2-10').noShowEligible")" "false"
check "Huỷ No-Show khi chưa đủ → 409 NO_SHOW_NOT_ALLOWED_YET" "$(call POST $FM "$API/reservations/$(rid RES-F2-10)/no-show" '{"reason":"Khach khong den"}' | jget 'o.error')" "NO_SHOW_NOT_ALLOWED_YET"
check "No-Show RES-F2-09" "$(code POST $FM "$API/reservations/$(rid RES-F2-09)/no-show" '{"reason":"Khong lien lac duoc"}')" "200"
check "Ô D206 trống lại" "$(ust KV-TB-D206)" "AVAILABLE"
check "Đơn CANCELLED, hợp đồng TERMINATED" "$(sql "SELECT r.status+'|'+c.status FROM reservations r JOIN rental_contracts c ON c.reservation_id=r.id WHERE r.reservation_code='RES-F2-09'")" "CANCELLED|TERMINATED"
check "Giữ cọc + 1 tháng: hoàn phần thuê còn lại > 0" "$(sql "SELECT CASE WHEN amount>0 THEN 1 ELSE 0 END FROM payment_transactions WHERE payment_type='REFUND' AND reservation_id=$(rid RES-F2-09)")" "1"
check "No-Show RES-F2-08 miễn phạt → hoàn toàn bộ" "$(code POST $FM "$API/reservations/$(rid RES-F2-08)/no-show" '{"reason":"Khach tu choi","waivePenalty":true,"waiveReason":"Khach benh, co giay vien"}')" "200"
check "Dời lịch RES-F2-10 về hôm nay" "$(code PUT $FM "$API/reservations/$(rid RES-F2-10)/reschedule" "{\"newStartDate\":\"$TODAY\",\"reason\":\"Khach xin doi\"}")" "200"
check "Giờ hẹn dời theo" "$(sql "SELECT CAST(CAST(expected_appointment_time AS DATE) AS CHAR(10)) FROM reservations WHERE reservation_code='RES-F2-10'")" "$TODAY"
T10=$(tid HD-F2-10 CHECK_IN)
check "Task mở lại sau dời lịch" "$(sql "SELECT status FROM facility_tasks WHERE id=$T10")" "OPEN"
call POST $FM "$API/staff-tasks/$T10/assign?staffId=$ST1_ID" >/dev/null
check "Dời về hôm nay → check-in được" "$(code POST $ST1 "$API/staff-tasks/$T10/check-in" "$(checkin_body 246810 RFID-X10)")" "200"

echo "== F2-X9: trùng lịch"
check "Lịch báo đỏ D208" "$(call GET $FM "$API/storage-units/schedule?from=$TODAY&to=$(plus 120)&unitTypeId=2" | jget "o.units.find(u=>u.unitId==='KV-TB-D208').conflict")" "true"
T9=$(tid HD-F2-12 CHECK_IN); call POST $FM "$SIM/tasks/$T9/arrive-today" >/dev/null; call POST $FM "$API/staff-tasks/$T9/assign?staffId=$ST1_ID" >/dev/null
check "Check-in khi khách trước chưa trả → UNIT_STILL_OCCUPIED" "$(call POST $ST1 "$API/staff-tasks/$T9/check-in" "$(checkin_body 246809 RFID-X9)" | jget 'o.error')" "UNIT_STILL_OCCUPIED"

echo "== F2-X10: ô hỏng khi khách B đang thuê trong khoảng trống của khách A"
CB2=$(cid HD-F2-13); CA2=$(cid HD-F2-14)
Y10=$(call GET $FM "$API/contracts/$CB2/transfer-options" | jget 'o[0].id')
check "Chuyển khách A trước kèm bảo trì khi B còn ở → OLD_UNIT_IN_USE" "$(call POST $FM "$API/contracts/$CA2/transfer-unit" "{\"toUnitId\":\"$Y10\",\"reasonType\":\"FACILITY_ISSUE\",\"reason\":\"May lanh o D209 hong\"}" | jget 'o.error')" "OLD_UNIT_IN_USE"
TR=$(call POST $FM "$API/contracts/$CB2/transfer-unit" "{\"toUnitId\":\"$Y10\",\"reasonType\":\"FACILITY_ISSUE\",\"reason\":\"May lanh o D209 hong\"}")
check "Chuyển B, hệ thống báo phải đổi ô cho A" "$(echo "$TR" | jget "o.affectedContracts.map(c=>c.contractCode).join()")" "HD-F2-14"
check "Ô D209 bảo trì" "$(ust KV-TB-D209)" "MAINTENANCE"
check "PIN của B giữ nguyên, ô đổi" "$(sql "SELECT storage_unit_id FROM rental_contracts WHERE id=$CB2")" "$Y10"
Z10=$(call GET $FM "$API/contracts/$CA2/transfer-options" | jget 'o[0].id')
check "Đổi ô cho A" "$(code POST $FM "$API/contracts/$CA2/transfer-unit" "{\"toUnitId\":\"$Z10\",\"reasonType\":\"FACILITY_ISSUE\",\"reason\":\"O cu dang sua may lanh\"}")" "200"

echo "== F2-X11: hết ô đúng loại, chỉ còn ô sắp trống (Kho Lớn)"
check "Không có ô gán được" "$(call GET $FM "$API/reservations/$(rid RES-F6-05)/available-units" | jget 'o.length')" "0"

echo "======== FLOW 3 — Kho đang thuê, trả kho ========"
echo "== F3-H: tháng cuối, chỉ hoàn cọc"
CUONG=$(kh cuong); C=$(cid HD-F3-01)
check "Khách xem hợp đồng ACTIVE" "$(call GET $CUONG "$API/contracts/$C" | jget 'o.status')" "ACTIVE"
check "Xem vị trí ô" "$(code GET $CUONG "$API/contracts/$C/unit-location")" "200"
check "Khách khác xem hợp đồng này → 403" "$(code GET $AN "$API/contracts/$C")" "403"
check "Hẹn trả hôm nay → 400 (phải từ ngày mai)" "$(code POST $CUONG "$API/contracts/$C/request-checkout" "{\"checkoutDate\":\"$TODAY\",\"refundMethod\":\"CASH\"}")" "400"
check "Hẹn trả quá hạn hợp đồng → 400" "$(code POST $CUONG "$API/contracts/$C/request-checkout" "{\"checkoutDate\":\"$(plus 30)\",\"refundMethod\":\"CASH\"}")" "400"
check "Chuyển khoản thiếu STK → INVALID_REFUND_METHOD" "$(call POST $CUONG "$API/contracts/$C/request-checkout" "{\"checkoutDate\":\"$(plus 1)\",\"refundMethod\":\"BANK_TRANSFER\"}" | jget 'o.error')" "INVALID_REFUND_METHOD"
check "Hẹn trả ngày mai" "$(code POST $CUONG "$API/contracts/$C/request-checkout" "{\"checkoutDate\":\"$(plus 1)\",\"refundMethod\":\"BANK_TRANSFER\",\"bankName\":\"Vietcombank\",\"bankAccountNumber\":\"0123456789\",\"bankAccountName\":\"LE HOANG CUONG\"}")" "200"
check "Hợp đồng TERMINATION_PENDING" "$(sql "SELECT status FROM rental_contracts WHERE id=$C")" "TERMINATION_PENDING"
TO=$(tid HD-F3-01 CHECK_OUT)
check "⚡ Khách tới trả kho hôm nay" "$(code POST $ST1 "$SIM/tasks/$TO/checkout-today")" "200"
check "Chưa nhận việc mà nghiệm thu → TASK_NOT_ASSIGNED/IN_PROGRESS" "$(call POST $ST1 "$API/staff-tasks/$TO/check-out" "{\"evidenceImages\":[\"$IMG\"],\"identityVerified\":true,\"unitEmpty\":true,\"unitClean\":true,\"lockIntact\":true,\"customerSignatureConfirmed\":true}" | jget '["TASK_NOT_IN_PROGRESS","TASK_NOT_ASSIGNED","TASK_NOT_CLAIMED"].includes(o.error)')" "true"
check "Staff nhận việc" "$(call POST $ST1 "$API/staff-tasks/$TO/claim" | jget 'o.status')" "IN_PROGRESS"
check "Ô bẩn mà không ghi sự cố → DAMAGE_REPORT_REQUIRED" "$(call POST $ST1 "$API/staff-tasks/$TO/check-out" "{\"evidenceImages\":[\"$IMG\"],\"identityVerified\":true,\"unitEmpty\":true,\"unitClean\":false,\"lockIntact\":true,\"customerSignatureConfirmed\":true}" | jget 'o.error')" "DAMAGE_REPORT_REQUIRED"
check "Nghiệm thu đạt" "$(code POST $ST1 "$API/staff-tasks/$TO/check-out" "{\"evidenceImages\":[\"$IMG\"],\"identityVerified\":true,\"unitEmpty\":true,\"unitClean\":true,\"lockIntact\":true,\"customerSignatureConfirmed\":true}")" "200"
check "Hợp đồng TERMINATED, xoá PIN" "$(sql "SELECT status+'|'+COALESCE(access_pin_code,'null') FROM rental_contracts WHERE id=$C")" "TERMINATED|null"
check "Ô D210 trống lại" "$(ust KV-TB-D210)" "AVAILABLE"
TR1=$(sql "SELECT TOP 1 id FROM facility_tasks WHERE contract_id=$C AND task_type='REFUND'")
check "Tháng cuối: chỉ hoàn cọc 1.850.000đ" "$(sql "SELECT CAST(amount AS INT) FROM payment_transactions WHERE contract_id=$C AND payment_type='REFUND'")" "1850000"
check "Staff không xử lý được REFUND → 403" "$(code POST $ST1 "$API/staff-tasks/$TR1/complete-refund" '{"paymentMethod":"BANK_TRANSFER"}')" "403"
check "Thiếu UNC → REFUND_EVIDENCE_REQUIRED" "$(call POST $FM "$API/staff-tasks/$TR1/complete-refund" '{"paymentMethod":"BANK_TRANSFER"}' | jget 'o.error')" "REFUND_EVIDENCE_REQUIRED"
check "FM hoàn tiền có UNC" "$(code POST $FM "$API/staff-tasks/$TR1/complete-refund" "{\"paymentMethod\":\"BANK_TRANSFER\",\"evidenceImageUrl\":\"$IMG\",\"bankTransactionCode\":\"FT26F3H\"}")" "200"
check "Giao dịch REFUND SUCCESS" "$(sql "SELECT status FROM payment_transactions WHERE contract_id=$C AND payment_type='REFUND'")" "SUCCESS"

echo "== F3-X1: trả sớm gói 6 tháng (PR-O2)"
DUNG=$(kh dung); C=$(cid HD-F3-02)
call POST $DUNG "$API/contracts/$C/request-checkout" "{\"checkoutDate\":\"$(plus 1)\",\"refundMethod\":\"CASH\"}" >/dev/null
TO=$(tid HD-F3-02 CHECK_OUT); call POST $ST1 "$SIM/tasks/$TO/checkout-today" >/dev/null; call POST $ST1 "$API/staff-tasks/$TO/claim" >/dev/null
call POST $ST1 "$API/staff-tasks/$TO/check-out" "{\"evidenceImages\":[\"$IMG\"],\"identityVerified\":true,\"unitEmpty\":true,\"unitClean\":true,\"lockIntact\":true,\"customerSignatureConfirmed\":true}" >/dev/null
check "Hoàn = cọc 1.850.000 + thuê (9.890.000 − 2×1.850.000 − 1.850.000) = 6.190.000đ" "$(sql "SELECT CAST(amount AS INT) FROM payment_transactions WHERE contract_id=$C AND payment_type='REFUND'")" "6190000"

echo "== F3-X2: dời / huỷ yêu cầu trả kho"
C=$(cid HD-F3-03)
check "Dời muộn hơn ngày đã hẹn → 400" "$(code POST $DUNG "$API/contracts/$C/request-checkout" "{\"checkoutDate\":\"$(plus 8)\",\"refundMethod\":\"CASH\"}")" "400"
check "Dời sớm hơn" "$(code POST $DUNG "$API/contracts/$C/request-checkout" "{\"checkoutDate\":\"$(plus 3)\",\"refundMethod\":\"CASH\"}")" "200"
check "Huỷ yêu cầu → ACTIVE" "$(code POST $DUNG "$API/contracts/$C/cancel-checkout")" "200"
check "Hợp đồng ACTIVE, task huỷ" "$(sql "SELECT c.status+'|'+t.status FROM rental_contracts c JOIN facility_tasks t ON t.contract_id=c.id AND t.task_type='CHECK_OUT' WHERE c.id=$C")" "ACTIVE|CANCELLED"

echo "== F3-X3: sự cố lỗi khách trong cọc"
damage() { echo "{\"evidenceImages\":[\"$IMG\"],\"identityVerified\":true,\"unitEmpty\":true,\"unitClean\":false,\"lockIntact\":true,\"customerSignatureConfirmed\":true,\"damageCases\":[{\"title\":\"$1\",\"description\":\"e2e\",\"estimatedCost\":$2,\"liableParty\":\"$3\",\"evidenceImages\":[\"$IMG\"]}]}"; }
TO=$(tid HD-F3-04 CHECK_OUT); C=$(cid HD-F3-04)
check "Sự cố thiếu ảnh → EVIDENCE_IMAGE_REQUIRED" "$(call POST $ST1 "$API/staff-tasks/$TO/check-out" "{\"evidenceImages\":[\"$IMG\"],\"identityVerified\":true,\"unitEmpty\":true,\"unitClean\":false,\"lockIntact\":true,\"customerSignatureConfirmed\":true,\"damageCases\":[{\"title\":\"Vach be\",\"description\":\"x\",\"estimatedCost\":100000,\"liableParty\":\"CUSTOMER\",\"evidenceImages\":[]}]}" | jget 'o.error')" "EVIDENCE_IMAGE_REQUIRED"
check "Nghiệm thu: vách bẩn 700.000đ" "$(code POST $ST1 "$API/staff-tasks/$TO/check-out" "$(damage 'Vach ban' 700000 CUSTOMER)")" "200"
check "Hoàn cọc 1.150.000đ" "$(sql "SELECT CAST(amount AS INT) FROM payment_transactions WHERE contract_id=$C AND payment_type='REFUND'")" "1150000"
check "Trừ cọc DAMAGE_FEE DEPOSIT_OFFSET" "$(sql "SELECT CAST(amount AS INT) FROM payment_transactions WHERE contract_id=$C AND payment_type='DAMAGE_FEE' AND payment_method='DEPOSIT_OFFSET'")" "700000"
check "Ô D213 bảo trì" "$(ust KV-TB-D213)" "MAINTENANCE"

echo "== F3-X4: sự cố vượt cọc → nợ, chặn đặt kho"
TO=$(tid HD-F3-05 CHECK_OUT); C=$(cid HD-F3-05)
check "Nghiệm thu: hư cửa 2.150.000đ" "$(code POST $ST1 "$API/staff-tasks/$TO/check-out" "$(damage 'Hu cua' 2150000 CUSTOMER)")" "200"
check "Nợ vượt cọc 300.000đ" "$(sql "SELECT CAST(amount AS INT) FROM payment_transactions WHERE contract_id=$C AND payment_type='DAMAGE_FEE' AND status='PENDING'")" "300000"
MINH=$(kh minh)
check "Khách bị chặn đặt kho" "$(call POST $MINH "$API/reservations" "{\"facilityId\":1,\"unitTypeId\":1,\"startDate\":\"$(plus 7)\",\"durationMonths\":1,$BOOK}" | jget 'o.error')" "CUSTOMER_HAS_DEBT"
check "Vẫn có task REFUND 0đ để FM đóng hồ sơ" "$(sql "SELECT COUNT(*) FROM facility_tasks WHERE contract_id=$C AND task_type='REFUND'")" "1"

echo "== F3-X5: sự cố lỗi cơ sở → không trừ cọc"
TO=$(tid HD-F3-06 CHECK_OUT); C=$(cid HD-F3-06)
check "Nghiệm thu: thấm tường, lỗi cơ sở" "$(code POST $ST1 "$API/staff-tasks/$TO/check-out" "$(damage 'Tham tuong' 900000 FACILITY)")" "200"
check "Hoàn đủ cọc" "$(sql "SELECT CAST(amount AS INT) FROM payment_transactions WHERE contract_id=$C AND payment_type='REFUND'")" "1850000"
check "Ô D215 vẫn vào bảo trì" "$(ust KV-TB-D215)" "MAINTENANCE"

echo "== F3-X6: sửa xong → mở bán lại"
TM=$(tid HD-F3-07 MAINTENANCE)
check "Ghi chú quá ngắn → 400" "$(code POST $ST1 "$API/staff-tasks/$TM/complete-maintenance" '{"note":"xong"}')" "400"
check "Sửa xong" "$(code POST $ST1 "$API/staff-tasks/$TM/complete-maintenance" '{"note":"Da nan lai ban le cua, thu dong mo binh thuong"}')" "200"
check "Ô D216 AVAILABLE" "$(ust KV-TB-D216)" "AVAILABLE"

echo "== F3-X7: chuyển ô khi đang thuê"
C=$(cid HD-F3-08)
check "Chuyển sang ô khác loại → UNIT_TYPE_MISMATCH" "$(call POST $FM "$API/contracts/$C/transfer-unit" '{"toUnitId":"KV-TB-A102","reasonType":"CUSTOMER_REQUEST","reason":"Khach muon o gan cua"}' | jget 'o.error')" "UNIT_TYPE_MISMATCH"
check "Chuyển E202 → E203 theo yêu cầu khách" "$(code POST $FM "$API/contracts/$C/transfer-unit" '{"toUnitId":"KV-TB-E203","reasonType":"CUSTOMER_REQUEST","reason":"Khach muon o gan cua"}')" "200"
check "Khách xem lịch sử chuyển ô" "$(call GET $CUONG "$API/contracts/$C/unit-transfers" | jget 'o.length')" "1"

echo "======== FLOW 4 — Quy tắc, phí, doanh thu (BOM) ========"
check "F4-H: doanh thu có số liệu" "$(call GET $BOM "$API/bom/revenue/overview?year=$(date +%Y)" | jget 'Object.keys(o).length>0')" "true"
check "F4-H: so sánh ≥ 4 cơ sở" "$(call GET $BOM "$API/bom/revenue/by-facility?year=$(date +%Y)" | jget '(Array.isArray(o)?o:o.items||o.facilities||[]).length>=4')" "true"
UT=$(sql "SELECT id FROM unit_types WHERE name=N'Kho Đặc Biệt XL'")
BEFORE=$(sql "SELECT CAST(SUM(amount) AS INT) FROM payment_transactions WHERE reservation_id=$(rid RES-F1-10)")
check "F4-H: BOM đổi giá XL (PR-12)" "$(code PUT $BOM "$API/unit-types/$UT" '{"name":"Kho Dac Biet XL","areaSqm":25,"volumeCbm":67.5,"basePriceMonthly":6800000,"dimensions":"5.0m x 5.0m x 2.7m","temperatureClass":"NORMAL"}')" "200"
check "F4-H: hợp đồng cũ giữ số tiền đã thu" "$(sql "SELECT CAST(SUM(amount) AS INT) FROM payment_transactions WHERE reservation_id=$(rid RES-F1-10)")" "$BEFORE"
sql "UPDATE unit_types SET name=N'Kho Đặc Biệt XL' WHERE id=$UT" >/dev/null
OLD_POLICY=$(sql "SELECT rental_policy_id FROM rental_contracts WHERE contract_code='HD-CS-1'")
check "F4-H: phát hành chính sách mới Bình Thạnh" "$(code POST $BOM "$API/rental-policies/facilities/2" '{"depositMonthMultiplier":2,"cancelFeePercent":50,"cancelFreeHours":48,"lateFeePercentPerDay":10}')" "201"
check "F4-H: có phiên bản lịch sử" "$(call GET $BOM "$API/rental-policies/facilities/2/history" | jget 'o.length>=2')" "true"
check "F4-H: hợp đồng đã ký giữ chính sách cũ" "$(sql "SELECT rental_policy_id FROM rental_contracts WHERE contract_code='HD-CS-1'")" "$OLD_POLICY"
check "F4-H: tạo voucher theo loại kho" "$(code POST $BOM "$API/bom/vouchers" '{"code":"THU2026","name":"Voucher thu","discountType":"FIXED","discountValue":80000,"minMonths":1,"unitTypeId":1,"startAt":"2026-01-01T00:00:00","perUserLimit":1,"usageLimit":50}')" "200"
echo "== F4-X: chặn sai quy định"
check "Hệ số cọc 5 → 400" "$(code POST $BOM "$API/rental-policies/facilities/2" '{"depositMonthMultiplier":5,"cancelFeePercent":50,"cancelFreeHours":48,"lateFeePercentPerDay":10}')" "400"
check "Phí chiếm dụng 50% → 400" "$(code POST $BOM "$API/rental-policies/facilities/2" '{"depositMonthMultiplier":1,"cancelFeePercent":50,"cancelFreeHours":48,"lateFeePercentPerDay":10,"overstayPercent":50}')" "400"
check "Tên loại kho trùng → UNIT_TYPE_NAME_EXISTS" "$(call POST $BOM "$API/unit-types" '{"name":"Kho Mini M","areaSqm":3,"volumeCbm":8,"basePriceMonthly":700000,"dimensions":"1m x 1m x 1m","temperatureClass":"NORMAL"}' | jget 'o.error')" "UNIT_TYPE_NAME_EXISTS"
check "Giá âm → 400" "$(code POST $BOM "$API/unit-types" '{"name":"Kho Sai Gia","areaSqm":3,"volumeCbm":8,"basePriceMonthly":-1,"dimensions":"1m x 1m x 1m","temperatureClass":"NORMAL"}')" "400"
check "Xoá loại kho đã có ô → UNIT_TYPE_HAS_UNITS" "$(call DELETE $BOM "$API/unit-types/1" | jget 'o.error')" "UNIT_TYPE_HAS_UNITS"
check "Mã cơ sở chữ thường → 400" "$(code POST $BOM "$API/facilities/bom" '{"code":"abc","name":"Co so moi","city":"HCM","district":"Q1","address":"1 Le Loi","hotline":"0901234567"}')" "400"
check "Mã cơ sở trùng → FACILITY_CODE_EXISTS" "$(call POST $BOM "$API/facilities/bom" '{"code":"TB","name":"Co so moi","city":"HCM","district":"Q1","address":"1 Le Loi","hotline":"0901234567"}' | jget 'o.error')" "FACILITY_CODE_EXISTS"
check "Ngừng cơ sở còn hợp đồng → 409" "$(code PATCH $BOM "$API/facilities/bom/1/status" '{"status":"INACTIVE"}')" "409"
check "Voucher trùng mã → DUPLICATE_CODE" "$(call POST $BOM "$API/bom/vouchers" '{"code":"HE2026","name":"Trung","discountType":"FIXED","discountValue":80000,"minMonths":1,"startAt":"2026-01-01T00:00:00"}' | jget 'o.error')" "DUPLICATE_CODE"
check "FM vào API BOM → 403" "$(code GET $FM "$API/bom/vouchers")" "403"
check "Staff xem doanh thu → 403" "$(code GET $ST1 "$API/bom/revenue/overview")" "403"
CO=$(cid HD-CS-7)
check "BR-130: BOM xem quá hạn toàn chuỗi" "$(call GET $BOM "$API/contracts/overdue-all" | jget 'o.length>=2')" "true"
check "BR-130: BOM miễn phí trễ" "$(code POST $BOM "$API/contracts/$CO/waive-late-fee" '{"reason":"Khach la doi tac lau nam"}')" "200"
check "Miễn lần 2 → LATE_FEE_ALREADY_WAIVED" "$(call POST $BOM "$API/contracts/$CO/waive-late-fee" '{"reason":"Khach la doi tac lau nam"}' | jget 'o.error')" "LATE_FEE_ALREADY_WAIVED"

CB8=$(cid HD-CS-8)
check "F4-X: BOM tắt quyền FM miễn phí trễ ở Bình Thạnh" "$(code POST $BOM "$API/rental-policies/facilities/2" '{"depositMonthMultiplier":1,"cancelFeePercent":50,"cancelFreeHours":48,"lateFeePercentPerDay":10,"allowLateFeeWaiver":false}')" "201"
check "F4-X: FM Bình Thạnh miễn phí trễ → WAIVER_NOT_ALLOWED" "$(call POST $FMBT "$API/contracts/$CB8/waive-late-fee" '{"reason":"Khach la doi tac lau nam"}' | jget 'o.error')" "WAIVER_NOT_ALLOWED"

echo "======== FLOW 5 — Vận hành cơ sở & nhân viên (FM) ========"
check "F5-H: dashboard cơ sở" "$(code GET $FM "$API/facilities/1/dashboard")" "200"
check "F5-H: FM xem danh mục ô" "$(call GET $FM "$API/storage-units?facilityId=1" | jget 'o.totalUnits')" "58"
NEW=$(call POST $FM "$API/storage-units?facilityId=1" '{"unitTypeId":1,"floor":"Tang 9","zone":"Z","roomNumber":"901"}')
NEWID=$(echo "$NEW" | jget 'o.id')
check "F5-H: thêm ô mới" "$(echo "$NEWID" | cut -c1-6)" "KV-TB-"
check "F5-H: xoá ô chưa có hợp đồng" "$(code DELETE $FM "$API/storage-units/$NEWID")" "200"
check "F5-H: khoá bảo trì có ghi chú" "$(code PATCH $FM "$API/storage-units/KV-TB-C105/status" '{"status":"MAINTENANCE","note":"Thay bong den khu C"}')" "200"
check "F5-H: mở lại" "$(code PATCH $FM "$API/storage-units/KV-TB-C105/status" '{"status":"AVAILABLE","note":""}')" "200"
EMAIL="nv.demo$(date +%H%M%S)@queenkho.local"
SR=$(call POST $FM "$API/manager/staff" "{\"fullName\":\"Nhan vien moi\",\"email\":\"$EMAIL\",\"phone\":\"0912345678\",\"password\":\"123456\"}")
SID=$(echo "$SR" | jget 'o.id')
check "F5-H: tạo Staff, tự gán cơ sở mình" "$(sql "SELECT facility_id FROM users WHERE email='$EMAIL'")" "1"
echo "== F5-X: chặn sai quy định"
check "Bảo trì ghi chú ngắn → 400" "$(code PATCH $FM "$API/storage-units/KV-TB-C103/status" '{"status":"MAINTENANCE","note":"hong"}')" "400"
check "Bảo trì ô đang giữ suất → SLOT_IN_USE" "$(call PATCH $FM "$API/storage-units/KV-TB-L105/status" '{"status":"MAINTENANCE","note":"Ve sinh dan lanh dinh ky"}' | jget 'o.error')" "SLOT_IN_USE"
check "Đổi trạng thái ô đang thuê → UNIT_IN_USE" "$(call PATCH $FM "$API/storage-units/KV-TB-B202/status" '{"status":"MAINTENANCE","note":"Thu khoa o dang thue"}' | jget 'o.error')" "UNIT_IN_USE"
check "Sửa ô đang có hợp đồng → UNIT_IN_USE" "$(call PUT $FM "$API/storage-units/KV-TB-B202" '{"unitTypeId":3,"zone":"B","roomNumber":"202"}' | jget 'o.error')" "UNIT_IN_USE"
check "Xoá ô đã có hợp đồng → UNIT_HAS_CONTRACT_HISTORY" "$(call DELETE $FM "$API/storage-units/KV-TB-B202" | jget 'o.error')" "UNIT_HAS_CONTRACT_HISTORY"
check "FM Bình Thạnh sửa ô Tân Bình → 403" "$(code PATCH $FMBT "$API/storage-units/KV-TB-C103/status" '{"status":"MAINTENANCE","note":"Thu sai co so"}')" "403"
check "Email Staff trùng → 409" "$(code POST $FM "$API/manager/staff" "{\"fullName\":\"Trung\",\"email\":\"$EMAIL\",\"phone\":\"0912345678\",\"password\":\"123456\"}")" "409"
check "Mật khẩu ngắn → 400" "$(code POST $FM "$API/manager/staff" '{"fullName":"Ngan","email":"ngan.demo@queenkho.local","phone":"0912345679","password":"123"}')" "400"
check "Khoá Staff đang giữ task → 409" "$(code PATCH $FM "$API/manager/staff/$ST1_ID/status" '{"status":"LOCKED"}')" "409"
check "Khoá Staff rảnh" "$(code PATCH $FM "$API/manager/staff/$SID/status" '{"status":"LOCKED"}')" "200"
check "Staff bị khoá không đăng nhập được" "$(curl -s -o /dev/null -w '%{http_code}' -X POST $API/auth/login -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"123456\"}")" "403"
check "Không giao việc cho Staff bị khoá → STAFF_INACTIVE" "$(call POST $FM "$API/staff-tasks/$(tid HD-F2-04 CHECK_IN)/assign?staffId=$SID" | jget 'o.error')" "STAFF_INACTIVE"
TX=$(tid HD-F2-02 CHECK_IN)
check "FM gỡ người nhận" "$(call POST $FM "$API/staff-tasks/$TX/unassign" | jget 'o.status')" "OPEN"

echo "======== FLOW 6 — Gia hạn & quá hạn ========"
NGA=$(kh nga)
echo "== F6-H: gia hạn ưu tiên"
C=$(cid HD-F6-01)
check "Cửa sổ ưu tiên" "$(call GET $NGA "$API/contracts/$C/renewal-eligibility" | jget 'o.window')" "PRIORITY"
END0=$(sql "SELECT CAST(end_date AS CHAR(10)) FROM rental_contracts WHERE id=$C")
PR=$(call POST $NGA "$PAY/create-renewal" "{\"contractId\":$C,\"months\":3}")
check "Thanh toán gia hạn 3 tháng" "$(ipn $(echo "$PR" | jget 'o.orderId') $(echo "$PR" | jget 'o.amount'))" "00"
check "Nối tiếp end_date" "$(sql "SELECT CAST(end_date AS CHAR(10)) FROM rental_contracts WHERE id=$C")" "$(date -d "$END0 +3 month" +%Y-%m-%d)"
check "Gói không hợp lệ (2 tháng) → 400" "$(code POST $NGA "$PAY/create-renewal" "{\"contractId\":$C,\"months\":2}")" "400"
echo "== F6-X1: cửa sổ muộn, chưa ai cần ô"
C=$(cid HD-F6-02)
check "Cửa sổ LATE, vẫn gia hạn được" "$(call GET $NGA "$API/contracts/$C/renewal-eligibility" | jget 'o.window+"|"+o.renewable')" "LATE|true"
echo "== F6-X2: cửa sổ muộn, đã có khách giữ suất"
C=$(cid HD-F6-03)
check "Bị chặn" "$(call GET $NGA "$API/contracts/$C/renewal-eligibility" | jget 'o.window+"|"+o.renewable')" "LATE|false"
check "Cố tạo link → RENEWAL_UNIT_RESERVED" "$(call POST $NGA "$PAY/create-renewal" "{\"contractId\":$C,\"months\":1}" | jget 'o.error')" "RENEWAL_UNIT_RESERVED"
echo "== F6-X3: quá hạn 3 ngày (điều khoản v3)"
GIANG=$(kh giang); C=$(cid HD-F6-06)
check "Khách quá hạn bị chặn đặt kho" "$(call POST $GIANG "$API/reservations" "{\"facilityId\":1,\"unitTypeId\":1,\"startDate\":\"$(plus 7)\",\"durationMonths\":1,$BOOK}" | jget 'o.error')" "CUSTOMER_HAS_DEBT"
OV=$(call GET $FM "$API/contracts/manager/overdue?facilityId=1")
check "Phí trễ 30% cọc = 555.000đ" "$(echo "$OV" | jget "Math.round(o.find(c=>c.contractCode==='HD-F6-06').lateFeeAmount)")" "555000"
check "Thanh lý khi chưa đủ ngày → LIQUIDATION_NOT_ALLOWED_YET" "$(call POST $FM "$API/contracts/$C/liquidate" '{"note":"Thu thanh ly som"}' | jget 'o.error')" "LIQUIDATION_NOT_ALLOWED_YET"
check "FM ghi liên hệ" "$(code POST $FM "$API/contracts/$C/overdue-contacts" '{"note":"Goi khach, khach hen tuan sau"}')" "200"
check "FM miễn phí trễ" "$(code POST $FM "$API/contracts/$C/waive-late-fee" '{"reason":"Khach dang nam vien"}')" "200"
PR=$(call POST $GIANG "$PAY/create-renewal" "{\"contractId\":$C,\"months\":1}")
check "Gia hạn khi quá hạn" "$(ipn $(echo "$PR" | jget 'o.orderId') $(echo "$PR" | jget 'o.amount'))" "00"
check "Hợp đồng ACTIVE lại" "$(sql "SELECT status FROM rental_contracts WHERE id=$C")" "ACTIVE"
echo "== F6-X4: thanh lý điều khoản cũ"
C=$(cid HD-F6-07)
check "Mới 2 lần liên hệ → NOT_ENOUGH_CONTACTS" "$(call POST $FM "$API/contracts/$C/liquidate" '{"note":"Da goi 2 lan khong duoc"}' | jget 'o.error')" "NOT_ENOUGH_CONTACTS"
check "FM ghi lần 3" "$(code POST $FM "$API/contracts/$C/overdue-contacts" '{"note":"Goi lan 3, khong nghe may"}')" "200"
check "Thanh lý" "$(code POST $FM "$API/contracts/$C/liquidate" '{"note":"Da goi 3 lan khong duoc"}')" "200"
check "Hợp đồng LIQUIDATED, ô MAINTENANCE" "$(sql "SELECT c.status+'|'+u.status FROM rental_contracts c JOIN storage_units u ON u.id=c.storage_unit_id WHERE c.id=$C")" "LIQUIDATED|MAINTENANCE"
TL=$(tid HD-F6-07 MAINTENANCE)
call POST $ST1 "$API/staff-tasks/$TL/claim" >/dev/null
check "Dọn xong thiếu kiểm kê → INVENTORY_REQUIRED" "$(call POST $ST1 "$API/staff-tasks/$TL/complete-maintenance" '{"note":"Da don xong o kho nay"}' | jget 'o.error')" "INVENTORY_REQUIRED"
check "Dọn xong đủ biên bản" "$(code POST $ST1 "$API/staff-tasks/$TL/complete-maintenance" "{\"note\":\"Da don xong o kho nay\",\"inventoryNote\":\"2 thung carton\",\"witnessNote\":\"Nhan vien 1 va Nhan vien 2\",\"storageLocation\":\"Ke A-01\",\"centralWarehouseId\":1,\"inventoryImages\":[\"$IMG\"]}")" "200"
check "Ô mở lại, hồ sơ kho tổng" "$(sql "SELECT u.status FROM storage_units u WHERE u.id='KV-TB-A103'")|$(sql "SELECT COUNT(*) FROM held_goods WHERE contract_id=$C")" "AVAILABLE|1"
echo "== F6-X5: điều khoản v4 tự thanh lý"
TAM=$(kh tam); C=$(cid HD-F6-08)
check "⚡ Quá hạn 1 ngày" "$(code POST $FM "$SIM/contracts/$C/make-overdue?days=1")" "200"
check "Tự LIQUIDATED, có task chuyển kho tổng" "$(sql "SELECT status FROM rental_contracts WHERE id=$C")|$(sql "SELECT COUNT(*) FROM facility_tasks WHERE contract_id=$C AND task_type='MAINTENANCE' AND maintenance_reason='LIQUIDATION'")" "LIQUIDATED|1"
echo "== F6-X6: khách nhận lại hàng ở kho tổng"
HG=$(sql "SELECT h.id FROM held_goods h JOIN rental_contracts c ON c.id=h.contract_id WHERE c.contract_code='HD-F6-09'")
check "Còn nợ → CUSTOMER_HAS_DEBT" "$(call POST $FM "$API/held-goods/$HG/resolve" '{"outcome":"RETURNED","note":"Khach den nhan lai hang","storageFeeCollected":true}' | jget 'o.error')" "CUSTOMER_HAS_DEBT"
check "Bán hàng → GOODS_SALE_NOT_ALLOWED" "$(call POST $FM "$API/held-goods/$HG/resolve" '{"outcome":"SOLD","note":"Thu ban hang cua khach"}' | jget 'o.error')" "GOODS_SALE_NOT_ALLOWED"
DEBT=$(sql "SELECT id FROM payment_transactions WHERE transaction_code='MV-DEBT-F6-09'")
PD=$(call POST $GIANG "$PAY/create-debt" "{\"paymentId\":$DEBT}")
check "Khách trả nợ" "$(ipn $(echo "$PD" | jget 'o.orderId') $(echo "$PD" | jget 'o.amount'))" "00"
check "Chưa thu phí lưu giữ → STORAGE_FEE_UNPAID" "$(call POST $FM "$API/held-goods/$HG/resolve" '{"outcome":"RETURNED","note":"Khach den nhan lai hang"}' | jget 'o.error')" "STORAGE_FEE_UNPAID"
check "Thu phí xong, trả hàng" "$(code POST $FM "$API/held-goods/$HG/resolve" '{"outcome":"RETURNED","note":"Khach den nhan lai hang","storageFeeCollected":true}')" "200"

echo "======== FLOW 7 — Hỗ trợ & bồi thường ========"
PHUC=$(kh phuc); C=$(cid HD-F7-01)
echo "== F7-H: báo lỗi khoá → cấp lại PIN"
S=$(call POST $PHUC "$API/support-requests" "{\"contractId\":$C,\"issueType\":\"LOCK_ISSUE\",\"description\":\"Khong mo duoc khoa bang ma PIN\"}")
SID7=$(echo "$S" | jget 'o.id'); check "Tạo ticket" "$(echo "$S" | jget 'o.status')" "OPEN"
TS=$(sql "SELECT TOP 1 id FROM facility_tasks WHERE support_request_id=$SID7 ORDER BY id DESC")
check "Staff nhận" "$(call POST $ST1 "$API/staff-tasks/$TS/claim" | jget 'o.status')" "IN_PROGRESS"
PIN0=$(sql "SELECT access_pin_code FROM rental_contracts WHERE id=$C")
check "Cấp lại PIN" "$(code POST $ST1 "$API/staff-tasks/$TS/reset-pin")" "200"
check "PIN đã đổi" "$([ "$(sql "SELECT access_pin_code FROM rental_contracts WHERE id=$C")" != "$PIN0" ] && echo yes)" "yes"
check "Kết quả rỗng → 400" "$(code POST $ST1 "$API/staff-tasks/$TS/resolve-support" '{"resolutionNote":""}')" "400"
check "Hoàn tất" "$(code POST $ST1 "$API/staff-tasks/$TS/resolve-support" '{"resolutionNote":"Da cap lai PIN moi cho khach"}')" "200"
check "Khách xác nhận Đã ổn" "$(call POST $PHUC "$API/support-requests/$SID7/confirm" | jget 'o.status')" "CLOSED"
echo "== F7-X1..X3"
C=$(cid HD-F7-02)
check "Cùng loại đang mở → DUPLICATE_ISSUE_TYPE" "$(call POST $PHUC "$API/support-requests" "{\"contractId\":$C,\"issueType\":\"CLEANING\",\"description\":\"Nho ve sinh them lan nua\"}" | jget 'o.error')" "DUPLICATE_ISSUE_TYPE"
SO=$(sql "SELECT id FROM support_requests WHERE ticket_code='SR-F7-03'")
check "Chưa xong → mở lại, task mới" "$(call POST $PHUC "$API/support-requests/$SO/reopen" '{"reason":"Cua van keu to khi keo len"}' | jget 'o.status')" "OPEN"
check "Quá 3 ticket mở → MAX_OPEN_TICKETS_REACHED" "$(call POST $PHUC "$API/support-requests" "{\"contractId\":$C,\"issueType\":\"SECURITY\",\"description\":\"Thay nguoi la o hanh lang\"}" | jget 'o.error')" "MAX_OPEN_TICKETS_REACHED"
TO7=$(sql "SELECT t.id FROM facility_tasks t JOIN support_requests s ON s.id=t.support_request_id WHERE s.ticket_code='SR-F7-02'")
check "Task quá hạn: Staff không hoàn tất được" "$(code POST $ST2 "$API/staff-tasks/$TO7/resolve-support" '{"resolutionNote":"Da thay den"}')" "409"
check "FM gia hạn xử lý" "$(code POST $FM "$API/staff-tasks/$TO7/extend" "{\"newDueDate\":\"$(plus 2)\",\"reason\":\"Cho linh kien den\"}")" "200"
check "Staff hoàn tất sau khi gia hạn" "$(code POST $ST2 "$API/staff-tasks/$TO7/resolve-support" '{"resolutionNote":"Da thay den hanh lang"}')" "200"
TP=$(sql "SELECT t.id FROM facility_tasks t JOIN support_requests s ON s.id=t.support_request_id WHERE s.ticket_code='SR-F7-07'")
sql "UPDATE rental_contracts SET status='OVERDUE' WHERE contract_code='HD-F6-06'" >/dev/null
check "F7-X7: hợp đồng quá hạn không cấp lại PIN → CONTRACT_OVERDUE" "$(call POST $ST1 "$API/staff-tasks/$TP/reset-pin" | jget 'o.error')" "CONTRACT_OVERDUE"
sql "UPDATE rental_contracts SET status='ACTIVE' WHERE contract_code='HD-F6-06'" >/dev/null
echo "== F7-X4: lỗi cơ sở, có bảo hiểm"
CL=$(sql "SELECT id FROM compensation_claims WHERE claim_code='BT-F7-04'")
DEC='{"liableParty":"FACILITY","assessedValue":12000000,"damagePercent":100,"unusableDays":2,"resolution":"CONTINUE","note":"May nen hong, loi co so, boi thuong day du"}'
check "Tính thử" "$(call POST $FM "$API/claims/$CL/quote" "$DEC" | jget 'Math.round(o.totalCompensation)>0')" "true"
check "FM chốt" "$(call POST $FM "$API/claims/$CL/decide" "$DEC" | jget 'o.status')" "APPROVED"
check "Chi trả thiếu bằng chứng → PAYMENT_EVIDENCE_REQUIRED" "$(call POST $FM "$API/claims/$CL/pay" '{"paymentMethod":"BANK_TRANSFER"}' | jget 'o.error')" "PAYMENT_EVIDENCE_REQUIRED"
check "Chi trả" "$(call POST $FM "$API/claims/$CL/pay" "{\"paymentMethod\":\"BANK_TRANSFER\",\"evidenceImageUrl\":\"$IMG\",\"bankTransactionCode\":\"FT26BT04\"}" | jget 'o.status')" "PAID"
check "Có hồ sơ đòi bảo hiểm" "$(sql "SELECT insurance_status FROM compensation_claims WHERE id=$CL")" "SUBMITTED"
check "⚡ Bảo hiểm chi trả" "$(code POST $FM "$SIM/claims/$CL/insurance-payout")" "200"
check "BOM thấy hồ sơ (chỉ đọc)" "$(code GET $BOM "$API/claims/$CL")" "200"
check "BOM không chốt được" "$(code POST $BOM "$API/claims/$CL/decide" "$DEC")" "403"
echo "== F7-X5: lỗi khách → từ chối"
CL=$(sql "SELECT id FROM compensation_claims WHERE claim_code='BT-F7-05'")
TC=$(sql "SELECT t.id FROM facility_tasks t JOIN compensation_claims c ON c.support_request_id=t.support_request_id WHERE c.id=$CL")
call POST $ST1 "$API/staff-tasks/$TC/claim" >/dev/null
check "Kiểm tra thiếu ảnh → 400" "$(code POST $ST1 "$API/staff-tasks/$TC/resolve-support" '{"resolutionNote":"Tu go nut do de sat cua so","preliminaryCause":"CUSTOMER"}')" "400"
check "Staff lập biên bản" "$(code POST $ST1 "$API/staff-tasks/$TC/resolve-support" "{\"resolutionNote\":\"Tu go nut do khach de sat cua so\",\"preliminaryCause\":\"CUSTOMER\",\"inspectionImages\":[\"$IMG\"]}")" "200"
check "Hồ sơ INSPECTED" "$(sql "SELECT status FROM compensation_claims WHERE id=$CL")" "INSPECTED"
check "FM kết luận lỗi khách → REJECTED" "$(call POST $FM "$API/claims/$CL/decide" '{"liableParty":"CUSTOMER","assessedValue":3000000,"damagePercent":50,"unusableDays":0,"resolution":"CONTINUE","note":"Do khach de hang sat cua so, khong boi thuong"}' | jget 'o.status')" "REJECTED"
echo "== F7-X6: lỗi cơ sở, chấm dứt hợp đồng"
CL=$(sql "SELECT id FROM compensation_claims WHERE claim_code='BT-F7-06'"); C=$(cid HD-F7-05)
check "FM chốt TERMINATE" "$(call POST $FM "$API/claims/$CL/decide" '{"liableParty":"FACILITY","assessedValue":4000000,"damagePercent":100,"unusableDays":0,"resolution":"TERMINATE","note":"Mat hang do loi co so, khach duoc cham dut hop dong"}' | jget 'o.status')" "APPROVED"
check "Bật fault_termination" "$(sql "SELECT CAST(fault_termination AS INT) FROM rental_contracts WHERE id=$C")" "1"
echo "== F7-X8: cảm biến"
C=$(cid HD-F7-03)
check "⚡ Cảm biến vượt ngưỡng" "$(code POST $FM "$SIM/contracts/$C/sensor-alert")" "200"
check "Sinh task SENSOR" "$(sql "SELECT COUNT(*) FROM facility_tasks WHERE contract_id=$C AND maintenance_reason='SENSOR'")" "1"

echo "======== Nhật ký hệ thống (Admin) ========"
check "Admin xem log" "$(code GET $ADM "$API/admin/activity-logs")" "200"
check "Có log gán ô" "$(sql "SELECT CASE WHEN COUNT(*)>0 THEN 1 ELSE 0 END FROM activity_logs WHERE action LIKE '[[]UNIT_ASSIGN%'")" "1"
check "Có log chuyển ô" "$(sql "SELECT CASE WHEN COUNT(*)>0 THEN 1 ELSE 0 END FROM activity_logs WHERE action LIKE '[[]UNIT_TRANSFER%'")" "1"

echo
echo "Kết quả: $PASS đạt, $FAIL lỗi."
echo "⚠️ Dữ liệu demo đã bị dùng — chạy lại QueenKho_setup_data.sql + QueenKho_demo_data.sql trước khi demo."
[ $FAIL -eq 0 ]
