#!/usr/bin/env bash
# E2E D-18 (08/11/2026 chiều — góp ý buổi test lần 2 + giảng viên): ô kho tính theo LỊCH qua API thật
#  - Kịch bản GV: khách A thuê 12 tháng, 2 tháng sau mới nhận → ô vẫn trống; khách B thuê 1 tháng từ tuần sau gán được vào đúng ô đó
#  - Đặt trước tối đa 90 ngày (PR-B4), số ô trống theo khoảng ngày (GET /reservations/availability)
#  - Dời lịch đè lên khách khác cùng ô → 409 UNIT_SCHEDULE_CONFLICT
#  - Lịch ô kho (GET /storage-units/schedule), trạng thái ô theo ngày nhận kho
#  - Ô có sự cố khi khách B đang thuê → chuyển B sang ô khác, ô cũ bảo trì, hệ thống trả khách A cần đổi ô;
#    check-in A vào ô bảo trì bị chặn; đổi ô cho A trước ngày nhận
#  - Giả lập "Hẹn còn N ngày" chỉ FM
# Backend localhost:8080, bật giả lập. Chạy (Git Bash): bash docs/test-e2e/e2e-gan-o-theo-lich-08-11.sh
# Dùng khách e2e.khach@queenkho.local, fmtanbinh / stafftanbinh1 (mật khẩu 123456). Script để lại dữ liệu để xem trên giao diện.
SCR="$(cd "$(dirname "$0")" && pwd)"
HOST=${E2E_HOST:-http://localhost:8080}
API=$HOST/api/v1
PAY=$HOST/api/payments/vnpay
SIM=$API/dev/simulation
PASS=0; FAIL=0
TODAY=$(date +%Y-%m-%d)

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
# Khách e2e có thể còn hợp đồng quá hạn từ script khác → chặn đặt kho (PR-Q12); dọn để test độc lập
sql "UPDATE rental_contracts SET status='TERMINATED' WHERE customer_id=$KH_ID AND status='OVERDUE';" >/dev/null

KH=$(login $KH_EMAIL); FM=$(login fmtanbinh@gmail.com); ST1=$(login stafftanbinh1@gmail.com)
ST1_ID=$(sql "SELECT id FROM users WHERE email='stafftanbinh1@gmail.com'")
[ -n "$KH" ] && [ -n "$FM" ] && [ -n "$ST1" ] || { echo "Không đăng nhập được tài khoản test"; exit 1; }

TYPE=$(sql "SELECT TOP 1 su.unit_type_id FROM storage_units su JOIN unit_types ut ON ut.id = su.unit_type_id
            WHERE su.facility_id=1 AND su.status='AVAILABLE' AND ut.temperature_class='NORMAL'
              AND NOT EXISTS (SELECT 1 FROM rental_contracts c WHERE c.storage_unit_id = su.id AND c.status = 'PENDING_CHECK_IN')
            GROUP BY su.unit_type_id HAVING COUNT(*) >= 3 ORDER BY COUNT(*) DESC, su.unit_type_id")
[ -n "$TYPE" ] || { echo "Tân Bình không còn loại kho thường nào đủ 3 ô trống để test"; exit 1; }
echo "Loại kho #$TYPE ở Tân Bình"

book() { # đặt + thanh toán (IPN giả lập) → in id đơn
  local start=$1 months=$2
  local r=$(call POST $KH "$API/reservations" "{\"facilityId\":1,\"unitTypeId\":$TYPE,\"startDate\":\"$start\",\"durationMonths\":$months,\"acceptedTerms\":true,\"goodsCategoryCodes\":[\"HOUSEHOLD\"]}")
  local id=$(echo "$r" | jget 'o.id')
  local p=$(call POST $KH "$PAY/create" "{\"reservationId\":$id}")
  [ "$(ipn $(echo "$p" | jget 'o.orderId') $(echo "$p" | jget 'o.amount'))" == "00" ] || echo "IPN_FAIL" >&2
  echo "$id"
}
unit_status() { sql "SELECT status FROM storage_units WHERE id='$1'"; }
contract_of() { sql "SELECT id FROM rental_contracts WHERE reservation_id=$1"; }

echo "== PR-B4: đặt trước tối đa 90 ngày + số ô trống theo khoảng ngày"
check "Nhận kho sau 91 ngày → 400 START_DATE_TOO_FAR" \
  "$(call POST $KH "$API/reservations" "{\"facilityId\":1,\"unitTypeId\":$TYPE,\"startDate\":\"$(plus 91)\",\"durationMonths\":1,\"acceptedTerms\":true,\"goodsCategoryCodes\":[\"HOUSEHOLD\"]}" | jget 'o.error')" "START_DATE_TOO_FAR"
check "API số ô trống công khai (không token)" \
  "$(curl -s "$API/reservations/availability?facilityId=1&unitTypeId=$TYPE&startDate=$(plus 7)&durationMonths=1" | jget 'o.available')" "true"
check "Hỏi ngày quá 90 → available=false" \
  "$(curl -s "$API/reservations/availability?facilityId=1&unitTypeId=$TYPE&startDate=$(plus 95)&durationMonths=1" | jget 'o.available')" "false"

echo "== Kịch bản GV: A thuê 12 tháng nhận sau 60 ngày, B thuê 1 tháng nhận sau 7 ngày — cùng 1 ô"
RA=$(book "$(plus 60)" 12)
X=$(call GET $FM "$API/reservations/$RA/available-units" | jget 'o[o.length-1].id')
check "FM gán ô $X cho A" "$(code POST $FM "$API/reservations/$RA/assign" "{\"storageUnitId\":\"$X\"}")" "200"
CA=$(contract_of $RA)
check "Ô $X vẫn AVAILABLE (A chưa tới ngày nhận)" "$(unit_status $X)" "AVAILABLE"

RB=$(book "$(plus 7)" 1)
check "Gợi ý ô cho B có $X, trống đến ngày A nhận" \
  "$(call GET $FM "$API/reservations/$RB/available-units" | jget "(o.find(u=>u.id==='$X')||{}).freeUntil")" "$(plus 60)"
check "Ô vừa khít ($X) xếp đầu danh sách" "$(call GET $FM "$API/reservations/$RB/available-units" | jget 'o[0].id')" "$X"
check "FM gán đúng ô $X cho B" "$(code POST $FM "$API/reservations/$RB/assign" "{\"storageUnitId\":\"$X\"}")" "200"
CB=$(contract_of $RB)

RC=$(book "$(plus 7)" 3)
check "Đơn C thuê 3 tháng (đè ngày A nhận) không được gợi ý ô $X" \
  "$(call GET $FM "$API/reservations/$RC/available-units" | jget "o.some(u=>u.id==='$X')")" "false"
check "Gán ép ô $X cho C → 400" "$(code POST $FM "$API/reservations/$RC/assign" "{\"storageUnitId\":\"$X\"}")" "400"

echo "== BR-136: dời lịch đè lên khách khác cùng ô"
check "Dời B sang +40 ngày (đè A) → 409 UNIT_SCHEDULE_CONFLICT" \
  "$(call PUT $FM "$API/reservations/$RB/reschedule" "{\"newStartDate\":\"$(plus 40)\",\"reason\":\"e2e\"}" | jget 'o.error')" "UNIT_SCHEDULE_CONFLICT"
check "Dời B sang +10 ngày (vẫn trước A) → 200" \
  "$(code PUT $FM "$API/reservations/$RB/reschedule" "{\"newStartDate\":\"$(plus 10)\",\"reason\":\"e2e\"}")" "200"

echo "== BR-137: lịch ô kho"
SCHED=$(call GET $FM "$API/storage-units/schedule?from=$TODAY&to=$(plus 120)&unitTypeId=$TYPE")
check "Ô $X có 2 hợp đồng trên lịch" "$(echo "$SCHED" | jget "o.units.find(u=>u.unitId==='$X').bookings.length")" "2"
check "Có khoảng trống giữa B và A" "$(echo "$SCHED" | jget "o.units.find(u=>u.unitId==='$X').freeRanges.some(r=>r.to==='$(plus 60)')")" "true"
check "Không trùng lịch" "$(echo "$SCHED" | jget "o.units.find(u=>u.unitId==='$X').conflict")" "false"
check "Staff không xem được lịch ô kho → 403" "$(code GET $ST1 "$API/storage-units/schedule")" "403"

echo "== Trạng thái ô theo ngày nhận kho + check-in"
TB=$(sql "SELECT id FROM facility_tasks WHERE contract_id=$CB AND task_type='CHECK_IN'")
check "⚡ Hẹn còn N ngày: Staff → 403 (chỉ FM)" "$(code POST $ST1 "$SIM/tasks/$TB/appointment-in?days=30")" "403"
check "⚡ B tới nhận hôm nay" "$(code POST $FM "$SIM/tasks/$TB/arrive-today")" "200"
check "Ô $X thành OCCUPIED khi tới ngày nhận của B" "$(unit_status $X)" "OCCUPIED"
call POST $FM "$API/staff-tasks/$TB/assign?staffId=$ST1_ID" >/dev/null
BODY="{\"evidenceImages\":[\"http://e2e/hien-trang.png\"],\"identityVerified\":true,\"unitEmpty\":true,\"unitClean\":true,\"lockIntact\":true,\"customerSignatureConfirmed\":true,\"goodsChecked\":true,\"accessPinCode\":\"$((RANDOM%900000+100000))\",\"rfidCardCode\":\"RFID-D18-$RB\"}"
check "Staff check-in B" "$(code POST $ST1 "$API/staff-tasks/$TB/check-in" "$BODY")" "200"

echo "== BR-139: ô có sự cố khi B đang thuê → chuyển B, ô bảo trì, A phải đổi ô"
Y=$(call GET $FM "$API/contracts/$CB/transfer-options" | jget 'o[0].id')
TR=$(call POST $FM "$API/contracts/$CB/transfer-unit" "{\"toUnitId\":\"$Y\",\"reasonType\":\"FACILITY_ISSUE\",\"reason\":\"May lanh o $X hong, can sua\"}")
check "Chuyển B sang ô $Y" "$(echo "$TR" | jget 'o.toUnitId')" "$Y"
check "Response báo khách A cần đổi ô" "$(echo "$TR" | jget "o.affectedContracts.map(c=>c.contractId).join(',')")" "$CA"
check "Ô $X vào bảo trì" "$(unit_status $X)" "MAINTENANCE"
check "Danh mục ô có cảnh báo lịch cho ô $X" \
  "$(call GET $FM "$API/storage-units?facilityId=1" | jget "!!o.units.find(u=>u.id==='$X').scheduleWarning")" "true"
check "Lịch đánh dấu HĐ A trùng ô bảo trì" \
  "$(call GET $FM "$API/storage-units/schedule?from=$TODAY&to=$(plus 120)&unitTypeId=$TYPE" | jget "o.units.find(u=>u.unitId==='$X').bookings.find(b=>b.contractId===$CA).conflict")" "true"
TA=$(sql "SELECT id FROM facility_tasks WHERE contract_id=$CA AND task_type='CHECK_IN'")
call POST $FM "$SIM/tasks/$TA/arrive-today" >/dev/null
call POST $FM "$API/staff-tasks/$TA/assign?staffId=$ST1_ID" >/dev/null
BODY_A="{\"evidenceImages\":[\"http://e2e/hien-trang.png\"],\"identityVerified\":true,\"unitEmpty\":true,\"unitClean\":true,\"lockIntact\":true,\"customerSignatureConfirmed\":true,\"goodsChecked\":true,\"accessPinCode\":\"$((RANDOM%900000+100000))\",\"rfidCardCode\":\"RFID-D18-$RA\"}"
check "Check-in A vào ô đang bảo trì → 409 UNIT_IN_MAINTENANCE" \
  "$(call POST $ST1 "$API/staff-tasks/$TA/check-in" "$BODY_A" | jget 'o.error')" "UNIT_IN_MAINTENANCE"
Z=$(call GET $FM "$API/contracts/$CA/transfer-options" | jget 'o[0].id')
check "FM đổi ô cho A trước khi bàn giao" \
  "$(code POST $FM "$API/contracts/$CA/transfer-unit" "{\"toUnitId\":\"$Z\",\"reasonType\":\"FACILITY_ISSUE\",\"reason\":\"O $X dang sua may lanh\"}")" "200"
check "Check-in A ở ô mới $Z" "$(code POST $ST1 "$API/staff-tasks/$TA/check-in" "$BODY_A")" "200"

echo "== BR-138: ô đang có hợp đồng không sửa thông tin được"
check "API ô trả locked=true" "$(call GET $FM "$API/storage-units/$Y" | jget 'o.locked')" "true"
# Gửi lại đúng khu / phòng hiện tại, không gửi tầng (curl Git Bash không gửi được chữ có dấu) → lỡ không bị chặn cũng không hỏng dữ liệu mẫu
Y_ZONE=$(sql "SELECT zone FROM storage_units WHERE id='$Y'"); Y_ROOM=$(sql "SELECT room_number FROM storage_units WHERE id='$Y'")
check "Sửa thông tin ô $Y (B đang thuê) → 409 UNIT_IN_USE" \
  "$(call PUT $FM "$API/storage-units/$Y" "{\"unitTypeId\":$TYPE,\"zone\":\"$Y_ZONE\",\"roomNumber\":\"$Y_ROOM\"}" | jget 'o.error')" "UNIT_IN_USE"

echo
echo "Kết quả: $PASS đạt, $FAIL lỗi. Để lại: đơn A #$RA (HĐ #$CA, ô $Z), B #$RB (HĐ #$CB, ô $Y), C #$RC (chưa gán), ô $X đang bảo trì."
[ $FAIL -eq 0 ]
