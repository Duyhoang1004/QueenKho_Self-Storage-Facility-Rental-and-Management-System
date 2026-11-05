#!/usr/bin/env bash
# E2E góp ý giảng viên 04/11/2026 qua API thật — bảo hiểm hàng hoá, bồi thường hàng hư / mất, cảm biến, BOM miễn phí trễ,
# ảnh biên bản bàn giao, chuyển ô, ưu tiên khách cũ. Backend localhost:8080, DB đã chạy
# sql_script/Update_bang_chung_chuyen_o.sql + Update_bao_hiem_boi_thuong.sql (hoặc tạo mới từ QueenKho_full.sql).
# Chạy (Git Bash): bash docs/test-e2e/e2e-bao-hiem-boi-thuong.sh
# Cần: node, sqlcmd, backend bật giả lập (SIMULATION_ENABLED mặc định true). Dùng khách test e2e.khach@queenkho.local
# (tự đăng ký nếu chưa có, mật khẩu 123456), fmtanbinh / stafftanbinh1 / bom@queenkho.com. Không đụng hợp đồng của khách khác.
# Body JSON để KHÔNG DẤU — Git Bash trên Windows truyền tiếng Việt cho curl.exe sai mã hoá.
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

KH_EMAIL=e2e.khach@queenkho.local
curl -s -X POST $API/auth/register -H "Content-Type: application/json" \
  -d "{\"email\":\"$KH_EMAIL\",\"password\":\"123456\",\"fullName\":\"Khach E2E\",\"phone\":\"0900000211\"}" >/dev/null
KH_ID=$(sql "SELECT id FROM users WHERE email='$KH_EMAIL'")
# Đơn PENDING cũ của khách test hết hạn; khách không được có HĐ quá hạn / nợ (PR-Q12) → kết thúc HĐ OVERDUE cũ của khách test, xoá nợ test cũ
sql "UPDATE reservations SET status='EXPIRED' WHERE status='PENDING' AND customer_id=$KH_ID;
     UPDATE storage_units SET status='AVAILABLE' WHERE id IN (SELECT storage_unit_id FROM rental_contracts WHERE customer_id=$KH_ID AND status='OVERDUE');
     UPDATE rental_contracts SET status='TERMINATED', access_pin_code=NULL, rfid_card_code=NULL WHERE customer_id=$KH_ID AND status='OVERDUE';
     UPDATE payment_transactions SET status='FAILED' WHERE user_id=$KH_ID AND status='PENDING' AND payment_type IN ('DAMAGE_FEE','OVERSTAY_FEE');" >/dev/null

KH=$(login $KH_EMAIL); FM=$(login fmtanbinh@gmail.com); ST1=$(login stafftanbinh1@gmail.com); BOM=$(login bom@queenkho.com)
ST1_ID=$(sql "SELECT id FROM users WHERE email='stafftanbinh1@gmail.com'")
[ -n "$KH" ] && [ -n "$FM" ] && [ -n "$ST1" ] && [ -n "$BOM" ] || { echo "Không đăng nhập được tài khoản test"; exit 1; }

# Loại kho còn suất ở Tân Bình (ô AVAILABLE − đơn đang giữ suất)
TYPE=$(sql "SELECT TOP 1 su.unit_type_id FROM storage_units su WHERE su.facility_id=1 AND su.status='AVAILABLE'
            GROUP BY su.unit_type_id HAVING COUNT(*) - (SELECT COUNT(*) FROM reservations r WHERE r.facility_id=1 AND r.unit_type_id=su.unit_type_id
            AND r.storage_unit_id IS NULL AND r.status IN ('PENDING','DEPOSIT_PAID')) >= 2 ORDER BY su.unit_type_id")
[ -n "$TYPE" ] || { echo "Tân Bình không còn loại kho nào đủ 2 ô trống để test"; exit 1; }
PRICE=$(sql "SELECT CAST(base_price_monthly AS INT) FROM unit_types WHERE id=$TYPE")
echo "Loại kho #$TYPE, giá $PRICE/tháng"

echo "== BR-125: gói bảo hiểm khi đặt kho"
check "Có 3 gói, Nâng cao 50.000/tháng trần 200 triệu" "$(curl -s $API/insurance-plans | jget 'o.length+"/"+o[1].code+"/"+o[1].monthlyPremium+"/"+o[1].coverageLimit')" "3/ADVANCED/50000/200000000"
check "Gói lạ → 400" "$(call POST $KH "$API/reservations" "{\"facilityId\":1,\"unitTypeId\":$TYPE,\"startDate\":\"$TODAY\",\"durationMonths\":3,\"acceptedTerms\":true,\"goodsCategoryCodes\":[\"HOUSEHOLD\"],\"insurancePlan\":\"VIP\"}" | jget 'o.error')" "INVALID_INSURANCE_PLAN"
R=$(call POST $KH "$API/reservations" "{\"facilityId\":1,\"unitTypeId\":$TYPE,\"startDate\":\"$TODAY\",\"durationMonths\":3,\"acceptedTerms\":true,\"goodsCategoryCodes\":[\"HOUSEHOLD\"],\"insurancePlan\":\"ADVANCED\",\"declaredGoodsValue\":30000000}")
RES=$(echo "$R" | jget 'o.id'); echo "  đơn #$RES $(echo "$R" | jget 'o.reservationCode')"
check "Đơn chốt gói + phí/tháng + giá trị khai báo + điều khoản v4" "$(sql "SELECT insurance_plan+'/'+CAST(CAST(insurance_premium_monthly AS INT) AS VARCHAR)+'/'+CAST(CAST(declared_goods_value AS BIGINT) AS VARCHAR)+'/'+terms_version FROM reservations WHERE id=$RES")" "ADVANCED/50000/30000000/v4"
DEP=$(sql "SELECT CAST(deposit_amount AS INT) FROM reservations WHERE id=$RES")
DISC=$(sql "SELECT CAST(rent_discount_percent AS INT) FROM reservations WHERE id=$RES")
VD=$(sql "SELECT CAST(voucher_discount AS INT) FROM reservations WHERE id=$RES")
RENT=$(node -e "const p=$PRICE*3;console.log(p-Math.round(p*$DISC/100))")
P=$(call POST $KH "$PAY/create" "{\"reservationId\":$RES}")
REF=$(echo "$P" | jget 'o.orderId'); AMT=$(echo "$P" | jget 'o.amount')
check "VNPAY = tiền thuê + cọc − voucher + bảo hiểm 3 × 50.000" "$AMT" "$((RENT + DEP - VD + 150000))"
check "IPN thành công" "$(ipn $REF $AMT)" "00"

echo "== Gán ô + BR-121 check-in bắt buộc ảnh"
UNIT=$(call GET $FM "$API/reservations/$RES/available-units" | jget 'o[0].id')
check "FM gán ô $UNIT" "$(code POST $FM "$API/reservations/$RES/assign" "{\"storageUnitId\":\"$UNIT\"}")" "200"
C=$(sql "SELECT id FROM rental_contracts WHERE reservation_id=$RES")
T=$(sql "SELECT id FROM facility_tasks WHERE contract_id=$C AND task_type='CHECK_IN'")
call POST $FM "$API/staff-tasks/$T/assign?staffId=$ST1_ID" >/dev/null
PIN=$(call GET $ST1 "$API/staff-tasks/pin-suggestion" | jget 'o.accessPinCode')
CI="\"identityVerified\":true,\"unitEmpty\":true,\"unitClean\":true,\"lockIntact\":true,\"customerSignatureConfirmed\":true,\"goodsChecked\":true,\"accessPinCode\":\"$PIN\",\"rfidCardCode\":\"RFID-E2EBH-$RES\""
check "Check-in thiếu ảnh → 400" "$(call POST $ST1 "$API/staff-tasks/$T/check-in" "{$CI}" | jget 'o.error')" "HANDOVER_PHOTO_REQUIRED"
check "Check-in có ảnh" "$(code POST $ST1 "$API/staff-tasks/$T/check-in" "{$CI,\"evidenceImages\":[$IMG]}")" "200"
check "Khách xem biên bản kèm ảnh" "$(call GET $KH "$API/contracts/$C/handover-records" | jget 'o[0].recordType+"/"+o[0].evidenceImages.length')" "CHECK_IN/1"
CT=$(call GET $KH "$API/contracts?reservationId=$RES")
check "Hợp đồng hiện gói + trần = giá trị khai báo" "$(echo "$CT" | jget 'o.insurancePlan+"/"+o.coverageCap')" "ADVANCED/30000000"
check "Gia hạn 3 tháng cộng phí bảo hiểm 150.000" "$(call GET $KH "$API/contracts/$C/renewal-quote" | jget 'o[1].months+"/"+o[1].insuranceAmount')" "3/150000"

echo "== BR-129: cảm biến vượt ngưỡng"
check "Giả lập cảm biến (khách chủ HĐ)" "$(code POST $KH "$SIM/contracts/$C/sensor-alert")" "200"
check "Có lần vượt ngưỡng trong 3 ngày" "$(call GET $FM "$API/contracts/$C/sensor-readings?days=3" | jget 'o.alertCount>0')" "true"
check "Sinh task bảo trì SENSOR, ô vẫn OCCUPIED" "$(sql "SELECT TOP 1 maintenance_reason FROM facility_tasks WHERE contract_id=$C AND task_type='MAINTENANCE' ORDER BY id DESC")/$(sql "SELECT status FROM storage_units WHERE id='$UNIT'")" "SENSOR/OCCUPIED"
check "Khách nhận cảnh báo" "$(call GET $KH "$API/notifications?limit=50" | jget 'o.some(n=>n.title.indexOf("'"$UNIT"'")>=0)')" "true"

echo "== BR-126: khách báo hàng hư → hồ sơ bồi thường"
BASE="\"contractId\":$C,\"issueType\":\"GOODS_DAMAGE\",\"description\":\"E2E hang bi am moc sau canh bao do am\",\"itemsDescription\":\"2 thung sach 4.000.000, 1 tu go 16.000.000\",\"claimedAmount\":20000000,\"incidentDate\":\"$TODAY\""
check "Hàng hư thiếu ảnh → 400" "$(call POST $KH "$API/support-requests" "{$BASE}" | jget 'o.error')" "EVIDENCE_IMAGE_REQUIRED"
TK=$(call POST $KH "$API/support-requests" "{$BASE,\"evidenceImages\":[$IMG]}")
TID=$(echo "$TK" | jget 'o.id')
check "Ticket khẩn kèm hồ sơ SUBMITTED" "$(echo "$TK" | jget 'o.urgent+"/"+o.claim.status')" "true/SUBMITTED"
CLAIM=$(echo "$TK" | jget 'o.claim.id')
ST=$(sql "SELECT TOP 1 id FROM facility_tasks WHERE support_request_id=$TID AND task_type='SUPPORT' ORDER BY id DESC")
call POST $FM "$API/staff-tasks/$ST/assign?staffId=$ST1_ID" >/dev/null
check "Kiểm tra thiếu ảnh → 400" "$(call POST $ST1 "$API/staff-tasks/$ST/resolve-support" '{"resolutionNote":"Mo o cung khach, tran o tham nuoc","preliminaryCause":"FACILITY"}' | jget 'o.error')" "EVIDENCE_IMAGE_REQUIRED"
check "Staff lập biên bản kiểm tra" "$(code POST $ST1 "$API/staff-tasks/$ST/resolve-support" "{\"resolutionNote\":\"Mo o cung khach, tran o tham nuoc, may hut am hong\",\"preliminaryCause\":\"FACILITY\",\"inspectionImages\":[$IMG]}")" "200"
check "Hồ sơ INSPECTED, ticket vẫn đang xử lý" "$(sql "SELECT status FROM compensation_claims WHERE id=$CLAIM")/$(sql "SELECT status FROM support_requests WHERE id=$TID")" "INSPECTED/IN_PROGRESS"

echo "== BR-127: FM thẩm định & chốt"
Q=$(call POST $FM "$API/claims/$CLAIM/quote" '{"liableParty":"FACILITY","assessedValue":20000000,"damagePercent":50,"unusableDays":2}')
DAILY=$(node -e "console.log(Math.round($PRICE/30))")
check "Lỗi cơ sở: hàng 10tr + phạt 1 tháng + 2 ngày tiền thuê" "$(echo "$Q" | jget 'o.goodsCompensation+"/"+o.penaltyAmount+"/"+o.rentRefundAmount')" "10000000/$PRICE/$((DAILY * 2))"
check "BOM không chốt được → 403" "$(code POST $BOM "$API/claims/$CLAIM/decide" '{"liableParty":"FACILITY"}')" "403"
D=$(call POST $FM "$API/claims/$CLAIM/decide" '{"liableParty":"FACILITY","assessedValue":20000000,"damagePercent":50,"unusableDays":2,"resolution":"TERMINATE","note":"Cam bien ghi nhan do am 88 phan tram do hong may hut am - loi co so"}')
check "Hồ sơ APPROVED" "$(echo "$D" | jget 'o.status')" "APPROVED"
check "HĐ được chấm dứt không phí phá HĐ" "$(sql "SELECT CAST(fault_termination AS INT) FROM rental_contracts WHERE id=$C")" "1"

echo "== BR-128: chi trả + đòi bảo hiểm"
check "Chuyển khoản thiếu ủy nhiệm chi → 400" "$(call POST $FM "$API/claims/$CLAIM/pay" '{"paymentMethod":"BANK_TRANSFER"}' | jget 'o.error')" "PAYMENT_EVIDENCE_REQUIRED"
PD=$(call POST $FM "$API/claims/$CLAIM/pay" "{\"paymentMethod\":\"BANK_TRANSFER\",\"evidenceImageUrl\":$IMG,\"bankTransactionCode\":\"FTE2E$RES\"}")
check "PAID + gửi hồ sơ bảo hiểm" "$(echo "$PD" | jget 'o.status+"/"+o.insuranceStatus+"/"+(o.insuranceRef||"").slice(0,6)')" "PAID/SUBMITTED/QKINS-"
TOTAL=$(echo "$PD" | jget 'o.totalCompensation')
check "Giao dịch COMPENSATION đúng tổng" "$(sql "SELECT CAST(SUM(amount) AS INT) FROM payment_transactions WHERE contract_id=$C AND payment_type='COMPENSATION' AND status='SUCCESS'")" "$(node -e "console.log(Math.round($TOTAL))")"
check "Ticket chuyển chờ khách xác nhận" "$(sql "SELECT status FROM support_requests WHERE id=$TID")" "RESOLVED"
check "Khách thấy hồ sơ PAID trong ticket" "$(call GET $KH "$API/support-requests" | jget "o.find(t=>t.id===$TID).claim.status")" "PAID"
check "Giả lập bảo hiểm chi trả" "$(call POST $FM "$SIM/claims/$CLAIM/insurance-payout" | jget 'o.insuranceStatus')" "PAID"
check "BOM xem hồ sơ toàn chuỗi" "$(call GET $BOM "$API/claims" | jget "o.some(c=>c.id===$CLAIM)")" "true"
check "Báo cáo BOM có chi bồi thường" "$(call GET $BOM "$API/bom/revenue/overview?period=YEAR&year=$(date +%Y)" | jget 'o.compensationPaid>0')" "true"

echo "== Flow 6: BOM miễn phí trễ"
# Điều khoản v4 (D-15) quá hạn là thanh lý + chuyển kho tổng ngay; miễn phí trễ chỉ còn ý nghĩa với HĐ điều khoản cũ
sql "UPDATE reservations SET terms_version='v3' WHERE id=$RES" >/dev/null
check "Giả lập quá hạn 3 ngày" "$(code POST $FM "$SIM/contracts/$C/make-overdue?days=3")" "200"
check "BOM thấy HĐ trong danh sách quá hạn toàn chuỗi" "$(call GET $BOM "$API/contracts/overdue-all" | jget "o.some(c=>c.contractId===$C)")" "true"
check "BOM miễn phí trễ" "$(call POST $BOM "$API/contracts/$C/waive-late-fee" '{"reason":"E2E BOM mien phi tre"}' | jget 'o.lateFeeWaived')" "true"
check "Staff không miễn được → 403" "$(code POST $ST1 "$API/contracts/$C/waive-late-fee" '{"reason":"thu thoi"}')" "403"

echo ""
echo "Kết quả: $PASS đạt, $FAIL lỗi"
[ $FAIL -eq 0 ]
