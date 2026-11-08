#!/usr/bin/env bash
# E2E góp ý sau buổi nhóm test 08/11/2026 (D-17) qua API thật:
#  - BR-32a: huỷ trong 30 phút sau thanh toán hoàn 100% (mọi đơn); BR-32: huỷ sau giờ hẹn = giữ cọc + 1 tháng thuê
#  - PR-X1 / PR-X3: No-Show — khách từ chối tới → huỷ ngay; giữ cọc + 1 tháng thuê, hoàn phần còn lại
#  - PR-T1: task CHECK_IN chỉ giao / nhận trong 30 ngày trước ngày hẹn (+ giả lập appointment-in)
#  - BR-135: FM thấy ô sắp trống (releasing, releaseDate)
# Backend localhost:8080, DB đã chạy sql_script/Update_cancel_business_rule_06_11.sql, bật giả lập.
# Chạy (Git Bash): bash docs/test-e2e/e2e-gop-y-test-08-11.sh
# Dùng khách e2e.khach@queenkho.local, fmtanbinh / stafftanbinh1 (mật khẩu 123456). Script để lại dữ liệu để xem trên giao diện.
SCR="$(cd "$(dirname "$0")" && pwd)"
HOST=${E2E_HOST:-http://localhost:8080}
API=$HOST/api/v1
PAY=$HOST/api/payments/vnpay
SIM=$API/dev/simulation
PASS=0; FAIL=0
TODAY=$(date +%Y-%m-%d)
IMG='"http://e2e/hien-trang.png"'

ok()   { PASS=$((PASS+1)); echo "  ✅ $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  ❌ $1"; }
check(){ if [ "$2" == "$3" ]; then ok "$1 ($2)"; else bad "$1: mong đợi [$3], thực tế [$2]"; fi; }
sql()  { sqlcmd -S localhost -U sa -P 12345 -d QueenKhoDB -C -I -h-1 -W -Q "SET NOCOUNT ON; $1" | tr -d '\r' | sed '/^$/d'; }
jget() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const o=JSON.parse(s);const v=($1);console.log(v===undefined?'':typeof v==='object'?JSON.stringify(v):v)}catch(e){console.log('PARSE_ERR')}})"; }
login(){ curl -s -X POST $API/auth/login -H "Content-Type: application/json" -d "{\"email\":\"$1\",\"password\":\"123456\"}" | jget "o.token"; }
call() { local m=$1 t=$2 u=$3 d=$4; if [ -n "$d" ]; then curl -s -X $m -H "Authorization: Bearer $t" -H "Content-Type: application/json" -d "$d" "$u"; else curl -s -X $m -H "Authorization: Bearer $t" "$u"; fi; }
code() { local m=$1 t=$2 u=$3 d=$4; if [ -n "$d" ]; then curl -s -o /dev/null -w "%{http_code}" -X $m -H "Authorization: Bearer $t" -H "Content-Type: application/json" -d "$d" "$u"; else curl -s -o /dev/null -w "%{http_code}" -X $m -H "Authorization: Bearer $t" "$u"; fi; }
ipn()  { curl -s "$PAY/ipn?$(node "$SCR/vnp_sign.js" "$1" "$2" "${3:-00}")" | jget "o.RspCode"; }
plus() { date -d "$TODAY +$1 day" +%Y-%m-%d; }

KH_EMAIL=e2e.khach@queenkho.local
curl -s -X POST $API/auth/register -H "Content-Type: application/json" \
  -d "{\"email\":\"$KH_EMAIL\",\"password\":\"123456\",\"fullName\":\"Khach E2E\",\"phone\":\"0900000211\"}" >/dev/null
KH_ID=$(sql "SELECT id FROM users WHERE email='$KH_EMAIL'")
sql "UPDATE reservations SET status='EXPIRED' WHERE status='PENDING' AND customer_id=$KH_ID;" >/dev/null

KH=$(login $KH_EMAIL); FM=$(login fmtanbinh@gmail.com); ST1=$(login stafftanbinh1@gmail.com)
ST1_ID=$(sql "SELECT id FROM users WHERE email='stafftanbinh1@gmail.com'")
[ -n "$KH" ] && [ -n "$FM" ] && [ -n "$ST1" ] || { echo "Không đăng nhập được tài khoản test"; exit 1; }

TYPE=$(sql "SELECT TOP 1 su.unit_type_id FROM storage_units su JOIN unit_types ut ON ut.id = su.unit_type_id
            WHERE su.facility_id=1 AND su.status='AVAILABLE' AND ut.temperature_class='NORMAL'
            GROUP BY su.unit_type_id HAVING COUNT(*) - (SELECT COUNT(*) FROM reservations r WHERE r.facility_id=1 AND r.unit_type_id=su.unit_type_id
            AND r.storage_unit_id IS NULL AND r.status IN ('PENDING','DEPOSIT_PAID')) >= 5 ORDER BY su.unit_type_id")
[ -n "$TYPE" ] || { echo "Tân Bình không còn loại kho thường nào đủ 5 ô trống để test"; exit 1; }
echo "Loại kho #$TYPE ở Tân Bình"

# Đặt kho + thanh toán VNPAY (IPN giả lập) → in id đơn
book() {
  local start=$1 months=$2
  local r=$(call POST $KH "$API/reservations" "{\"facilityId\":1,\"unitTypeId\":$TYPE,\"startDate\":\"$start\",\"durationMonths\":$months,\"acceptedTerms\":true,\"goodsCategoryCodes\":[\"HOUSEHOLD\"]}")
  local id=$(echo "$r" | jget 'o.id')
  local p=$(call POST $KH "$PAY/create" "{\"reservationId\":$id}")
  [ "$(ipn $(echo "$p" | jget 'o.orderId') $(echo "$p" | jget 'o.amount'))" == "00" ] || echo "IPN_FAIL" >&2
  echo "$id"
}
assign() { # FM gán ô đầu tiên còn trống → in id hợp đồng
  local unit=$(call GET $FM "$API/reservations/$1/available-units" | jget 'o[0].id')
  call POST $FM "$API/reservations/$1/assign" "{\"storageUnitId\":\"$unit\"}" >/dev/null
  sql "SELECT id FROM rental_contracts WHERE reservation_id=$1"
}
checkin_task() { sql "SELECT id FROM facility_tasks WHERE contract_id=$1 AND task_type='CHECK_IN'"; }

echo "== BR-32a: huỷ trong 30 phút sau thanh toán → hoàn 100% (kể cả đơn nhận kho còn xa)"
R1=$(book "$(plus 45)" 3)
check "Vừa thanh toán, nhận kho sau 45 ngày → BOOKING_GRACE" "$(call GET $KH "$API/reservations/$R1/cancel-preview" | jget 'o.policyTier')" "BOOKING_GRACE"
sql "UPDATE payment_transactions SET paid_at = DATEADD(MINUTE, -31, paid_at) WHERE reservation_id=$R1 AND payment_type='DEPOSIT'" >/dev/null
check "Qua 30 phút → về mốc thường (còn ≥ 48h: FULL_REFUND)" "$(call GET $KH "$API/reservations/$R1/cancel-preview" | jget 'o.policyTier')" "FULL_REFUND"
check "Response preview không còn graceBookingWindowHours" "$(call GET $KH "$API/reservations/$R1/cancel-preview" | jget '"graceBookingWindowHours" in o')" "false"

echo "== PR-T1: task CHECK_IN chỉ giao / nhận trong 30 ngày trước ngày hẹn"
C1=$(assign $R1); T1=$(checkin_task $C1)
check "Task trả assignableFrom = ngày hẹn − 30" "$(call GET $FM "$API/staff-tasks/$T1" | jget 'String(o.assignableFrom).slice(0,10)')" "$(plus 15)"
check "Staff nhận việc sớm → 409 TASK_NOT_IN_WINDOW" "$(call POST $ST1 "$API/staff-tasks/$T1/claim" | jget 'o.error')" "TASK_NOT_IN_WINDOW"
check "FM giao việc sớm → 409 TASK_NOT_IN_WINDOW" "$(call POST $FM "$API/staff-tasks/$T1/assign?staffId=$ST1_ID" | jget 'o.error')" "TASK_NOT_IN_WINDOW"
check "Bảng việc cũng trả assignableFrom" "$(call GET $FM "$API/staff-tasks?facilityId=1" | jget "o.find(t=>t.id===$T1).assignableFrom!=null")" "true"
check "⚡ Hẹn còn 91 ngày → 400" "$(code POST $FM "$SIM/tasks/$T1/appointment-in?days=91")" "400"
check "⚡ Hẹn còn 30 ngày" "$(code POST $FM "$SIM/tasks/$T1/appointment-in?days=30")" "200"
check "Vào khung → FM giao được" "$(call POST $FM "$API/staff-tasks/$T1/assign?staffId=$ST1_ID" | jget 'o.status')" "IN_PROGRESS"
R2=$(book "$(plus 45)" 1); C2=$(assign $R2); T2=$(checkin_task $C2)
echo "  (để lại task #$T2 hẹn sau 45 ngày — xem nút bị khoá trên bảng việc)"

echo "== BR-32: khách tự huỷ sau giờ hẹn = giữ cọc + 1 tháng thuê"
R3=$(book "$TODAY" 3); C3=$(assign $R3)
sql "UPDATE reservations SET start_date=DATEADD(DAY,-1,CAST(GETDATE() AS DATE)), expected_appointment_time=DATEADD(HOUR,-3,GETDATE()) WHERE id=$R3;
     UPDATE payment_transactions SET paid_at = DATEADD(DAY, -2, paid_at) WHERE reservation_id=$R3" >/dev/null
PV=$(call GET $KH "$API/reservations/$R3/cancel-preview")
DEP=$(echo "$PV" | jget 'o.depositAmount'); PAID=$(echo "$PV" | jget 'o.totalPaid')
MONTH=$(node -e "console.log(Math.round(($PAID-$DEP)/3))")
check "Tier AFTER_APPOINTMENT" "$(echo "$PV" | jget 'o.policyTier')" "AFTER_APPOINTMENT"
check "Giữ = cọc + 1 tháng thuê" "$(echo "$PV" | jget "Number(o.penaltyAmount)===$DEP+$MONTH")" "true"

echo "== PR-X3 / PR-X1: No-Show — khách từ chối tới → huỷ ngay, giữ cọc + 1 tháng thuê"
T3=$(checkin_task $C3)
NS=$(call GET $FM "$API/reservations/overdue-no-show?facilityId=1" | jget "o.find(r=>r.id===$R3)")
check "Chưa liên hệ → chưa đủ điều kiện" "$(echo "$NS" | jget 'o.noShowEligible')" "false"
check "Staff báo 'Khách cúp máy' → tính 1 lần thất bại" "$(code POST $ST1 "$API/staff-tasks/$T3/contact-report" '{"callOutcome":"Kh\u00e1ch c\u00fap m\u00e1y"}')" "200"
check "Log ghi [CONTACT][FAILED]" "$(sql "SELECT COUNT(*) FROM activity_logs WHERE target_entity='facility_tasks' AND target_id='$T3' AND action LIKE '%[[]CONTACT][[]FAILED]%'")" "1"
check "1 lần thất bại, chưa qua 48h → No-Show 409" "$(call POST $FM "$API/reservations/$R3/no-show" '{"reason":"test"}' | jget 'o.error')" "NO_SHOW_NOT_ALLOWED_YET"
check "Staff báo 'Khách từ chối tới nhận kho'" "$(code POST $ST1 "$API/staff-tasks/$T3/contact-report" '{"callOutcome":"Kh\u00e1ch t\u1eeb ch\u1ed1i t\u1edbi nh\u1eadn kho"}')" "200"
NS=$(call GET $FM "$API/reservations/overdue-no-show?facilityId=1" | jget "o.find(r=>r.id===$R3)")
check "Từ chối tới → đủ điều kiện ngay" "$(echo "$NS" | jget 'o.noShowEligible')" "true"
check "Danh sách trả sẵn số tiền giữ = cọc + 1 tháng" "$(echo "$NS" | jget "Number(o.noShowPenaltyAmount)===$DEP+$MONTH && Number(o.noShowRefundAmount)===$PAID-$DEP-$MONTH")" "true"
R4=$(book "$TODAY" 3); C4=$(assign $R4); T4=$(checkin_task $C4)
sql "UPDATE reservations SET start_date=DATEADD(DAY,-1,CAST(GETDATE() AS DATE)), expected_appointment_time=DATEADD(HOUR,-3,GETDATE()) WHERE id=$R4" >/dev/null
call POST $ST1 "$API/staff-tasks/$T4/contact-report" '{"callOutcome":"Kh\u00e1ch t\u1eeb ch\u1ed1i t\u1edbi nh\u1eadn kho"}' >/dev/null
check "FM xử lý No-Show (đơn #$R4)" "$(code POST $FM "$API/reservations/$R4/no-show" '{"reason":"Khach tu choi toi nhan kho"}')" "200"
check "Giao dịch hoàn = đã trả − cọc − 1 tháng" "$(sql "SELECT CAST(amount AS BIGINT) FROM payment_transactions WHERE reservation_id=$R4 AND payment_type='REFUND'")" "$(node -e "console.log($PAID-$DEP-$MONTH)")"
echo "  (để lại đơn #$R3 ở tab No-Show — xem modal số tiền trên giao diện)"

echo "== BR-135: FM thấy ô sắp trống"
R5=$(book "$TODAY" 1); C5=$(assign $R5); T5=$(checkin_task $C5)
call POST $FM "$API/staff-tasks/$T5/assign?staffId=$ST1_ID" >/dev/null
PIN=$(call GET $ST1 "$API/staff-tasks/pin-suggestion" | jget 'o.accessPinCode')
CI="{\"identityVerified\":true,\"unitEmpty\":true,\"unitClean\":true,\"lockIntact\":true,\"customerSignatureConfirmed\":true,\"goodsChecked\":true,\"accessPinCode\":\"$PIN\",\"rfidCardCode\":\"RFID-E2E0811-$R5\",\"evidenceImages\":[$IMG]}"
check "Check-in HĐ #$C5" "$(code POST $ST1 "$API/staff-tasks/$T5/check-in" "$CI")" "200"
U5=$(sql "SELECT storage_unit_id FROM rental_contracts WHERE id=$C5")
check "HĐ còn dài → ô chưa sắp trống" "$(call GET $FM "$API/storage-units?facilityId=1" | jget "o.units.find(u=>u.id==='$U5').releasing")" "false"
check "⚡ Còn 10 ngày hết hạn (mốc nhắc mới)" "$(code POST $FM "$SIM/contracts/$C5/expire-soon?days=10")" "200"
check "Khách nhận nhắc mốc 10" "$(sql "SELECT COUNT(*) FROM notifications WHERE user_id=$KH_ID AND ref_key LIKE 'RENEWAL:$C5:%:10'")" "1"
check "⚡ Còn 2 ngày (qua hạn chót gia hạn ưu tiên)" "$(code POST $FM "$SIM/contracts/$C5/expire-soon?days=2")" "200"
SU=$(call GET $FM "$API/storage-units?facilityId=1")
check "Ô $U5 sắp trống" "$(echo "$SU" | jget "o.units.find(u=>u.id==='$U5').releasing")" "true"
check "Ngày giao = end_date + 2 (điều khoản v4)" "$(echo "$SU" | jget "o.units.find(u=>u.id==='$U5').releaseDate")" "$(plus 4)"
check "KPI releasingUnits ≥ 1" "$(echo "$SU" | jget 'o.releasingUnits>=1')" "true"
check "Lọc status=RELEASING chỉ còn ô sắp trống" "$(call GET $FM "$API/storage-units?facilityId=1&status=RELEASING" | jget 'o.units.length>0&&o.units.every(u=>u.releasing)')" "true"
check "Chi tiết ô cũng có releaseDate" "$(call GET $FM "$API/storage-units/$U5" | jget 'o.releaseDate')" "$(plus 4)"

echo
echo "Kết quả: $PASS đạt, $FAIL lỗi"
echo "Dữ liệu để xem giao diện: đơn hẹn xa #$R2 (task #$T2 bị khoá), đơn No-Show #$R3, HĐ sắp trống #$C5 (ô $U5), đơn #$R1 (HĐ #$C1)"
[ $FAIL -eq 0 ]
