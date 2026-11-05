#!/usr/bin/env bash
# E2E quyết định họp nhóm 05/11/2026 qua API thật — loại hàng khi đặt kho (BR-131), kiểm tra hàng lúc check-in (BR-132),
# voucher theo loại kho (BR-133), nhắc gia hạn 15/10/7/3/1 ngày + bỏ ân hạn 5 ngày, hết hạn → thanh lý ngay và chuyển hàng
# vào kho tổng, không bán (D-15 / BR-134). Backend localhost:8080, DB đã chạy sql_script/Update_hop_nhom_05_11.sql.
# Chạy (Git Bash): bash docs/test-e2e/e2e-hop-nhom-05-11.sh
# Cần: node, sqlcmd, backend bật giả lập. Dùng khách test e2e.khach@queenkho.local, fmtanbinh / stafftanbinh1 / bom@queenkho.com.
# Script tạm đổi 1 loại kho ở Tân Bình sang kho lạnh (COLD) để đặt thực phẩm, chạy xong trả về NORMAL.
# Body JSON để KHÔNG DẤU — Git Bash trên Windows truyền tiếng Việt cho curl.exe sai mã hoá.
SCR="$(cd "$(dirname "$0")" && pwd)"
HOST=${E2E_HOST:-http://localhost:8080}
API=$HOST/api/v1
PAY=$HOST/api/payments/vnpay
SIM=$API/dev/simulation
PASS=0; FAIL=0
TODAY=$(date +%Y-%m-%d)
IMG='"http://e2e/hien-trang.png"'
STAMP=$(date +%H%M%S)

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
# Khách test không được có đơn giữ chỗ / HĐ quá hạn / nợ cũ (PR-Q12)
sql "UPDATE reservations SET status='EXPIRED' WHERE status='PENDING' AND customer_id=$KH_ID;
     UPDATE storage_units SET status='AVAILABLE' WHERE id IN (SELECT storage_unit_id FROM rental_contracts WHERE customer_id=$KH_ID AND status='OVERDUE');
     UPDATE rental_contracts SET status='TERMINATED', access_pin_code=NULL, rfid_card_code=NULL WHERE customer_id=$KH_ID AND status='OVERDUE';
     UPDATE payment_transactions SET status='FAILED' WHERE user_id=$KH_ID AND status='PENDING' AND payment_type IN ('DAMAGE_FEE','OVERSTAY_FEE');" >/dev/null

KH=$(login $KH_EMAIL); FM=$(login fmtanbinh@gmail.com); ST1=$(login stafftanbinh1@gmail.com); BOM=$(login bom@queenkho.com)
ST1_ID=$(sql "SELECT id FROM users WHERE email='stafftanbinh1@gmail.com'")
[ -n "$KH" ] && [ -n "$FM" ] && [ -n "$ST1" ] && [ -n "$BOM" ] || { echo "Không đăng nhập được tài khoản test"; exit 1; }

TYPE=$(sql "SELECT TOP 1 su.unit_type_id FROM storage_units su WHERE su.facility_id=1 AND su.status='AVAILABLE'
            GROUP BY su.unit_type_id HAVING COUNT(*) - (SELECT COUNT(*) FROM reservations r WHERE r.facility_id=1 AND r.unit_type_id=su.unit_type_id
            AND r.storage_unit_id IS NULL AND r.status IN ('PENDING','DEPOSIT_PAID')) >= 2 ORDER BY su.unit_type_id")
[ -n "$TYPE" ] || { echo "Tân Bình không còn loại kho nào đủ 2 ô trống để test"; exit 1; }
OTHER_TYPE=$(sql "SELECT TOP 1 id FROM unit_types WHERE id<>$TYPE ORDER BY id")
OLD_TEMP=$(sql "SELECT temperature_class FROM unit_types WHERE id=$TYPE")
trap 'sql "UPDATE unit_types SET temperature_class=N'"'"'$OLD_TEMP'"'"' WHERE id=$TYPE" >/dev/null' EXIT
echo "Loại kho #$TYPE ($OLD_TEMP), loại khác #$OTHER_TYPE"
BOOK="\"facilityId\":1,\"unitTypeId\":$TYPE,\"startDate\":\"$TODAY\",\"durationMonths\":1,\"acceptedTerms\":true"

echo "== BR-131: danh mục loại hàng (BOM quản lý)"
check "Khách thấy 7 loại, thực phẩm cần kho lạnh, Khác bắt buộc mô tả" "$(curl -s $API/goods-categories | jget 'o.length>=7&&o.find(c=>c.code==="FOOD").requiresColdStorage&&o.find(c=>c.code==="OTHER").requiresNote')" "true"
check "Mã trùng → 409" "$(call POST $BOM "$API/bom/goods-categories" '{"code":"HOUSEHOLD","name":"Trung ma"}' | jget 'o.error')" "DUPLICATE_CODE"
check "FM không quản lý loại hàng → 403" "$(code POST $FM "$API/bom/goods-categories" '{"code":"FMTHU","name":"x"}')" "403"
GC=$(call POST $BOM "$API/bom/goods-categories" "{\"code\":\"E2E_$STAMP\",\"name\":\"E2E Sach vo\",\"sortOrder\":99}" | jget 'o.id')
[ -n "$GC" ] && [ "$GC" != "PARSE_ERR" ] && ok "BOM thêm loại hàng #$GC" || bad "BOM không thêm được loại hàng"
check "BOM ngừng loại hàng" "$(call PATCH $BOM "$API/bom/goods-categories/$GC/status" '{"status":"INACTIVE"}' | jget 'o.status')" "INACTIVE"
check "Loại đã ngừng không còn hiện cho khách" "$(curl -s $API/goods-categories | jget "o.some(c=>c.id===$GC)")" "false"

echo "== BR-131: đặt kho bắt buộc khai báo loại hàng"
check "Chưa chọn loại hàng → 400" "$(call POST $KH "$API/reservations" "{$BOOK}" | jget 'o.error')" "GOODS_CATEGORY_REQUIRED"
check "Thực phẩm ở kho thường → 400" "$(call POST $KH "$API/reservations" "{$BOOK,\"goodsCategoryCodes\":[\"FOOD\"]}" | jget 'o.error')" "GOODS_REQUIRES_COLD_STORAGE"
check "Chọn Khác không mô tả → 400" "$(call POST $KH "$API/reservations" "{$BOOK,\"goodsCategoryCodes\":[\"OTHER\"]}" | jget 'o.error')" "GOODS_DESCRIPTION_REQUIRED"
check "Loại hàng đã ngừng → 400" "$(call POST $KH "$API/reservations" "{$BOOK,\"goodsCategoryCodes\":[\"E2E_$STAMP\"]}" | jget 'o.error')" "INVALID_GOODS_CATEGORY"
sql "UPDATE unit_types SET temperature_class='COLD' WHERE id=$TYPE" >/dev/null
check "Trang đặt kho thấy loại kho lạnh" "$(curl -s $API/facilities/1/availability | jget "o.unitTypeAvailability.find(u=>u.unitTypeId===$TYPE).temperatureClass")" "COLD"
check "BOM thấy loại kho lạnh trong bảng giá" "$(call GET $BOM "$API/unit-types/bom" | jget "o.find(u=>u.id===$TYPE).temperatureClass")" "COLD"

echo "== BR-133: voucher theo loại kho"
VC="E2EKL$STAMP"
check "BOM tạo voucher chỉ cho loại kho #$TYPE" "$(call POST $BOM "$API/bom/vouchers" "{\"code\":\"$VC\",\"name\":\"E2E kho lanh\",\"discountType\":\"FIXED\",\"discountValue\":50000,\"minMonths\":1,\"unitTypeId\":$TYPE}" | jget 'o.unitTypeId')" "$TYPE"
check "Loại kho khác → voucher không áp được" "$(call GET $KH "$API/vouchers/validate?code=$VC&facilityId=1&unitTypeId=$OTHER_TYPE&months=1" | jget 'o.error')" "VOUCHER_INVALID"
check "Đúng loại kho → giảm 50.000" "$(call GET $KH "$API/vouchers/validate?code=$VC&facilityId=1&unitTypeId=$TYPE&months=1" | jget 'o.discountAmount')" "50000"

R=$(call POST $KH "$API/reservations" "{$BOOK,\"goodsCategoryCodes\":[\"food\",\"HOUSEHOLD\"],\"voucherCode\":\"$VC\"}")
RES=$(echo "$R" | jget 'o.id'); echo "  đơn #$RES $(echo "$R" | jget 'o.reservationCode')"
check "Kho lạnh nhận thực phẩm; đơn lưu loại hàng + voucher + điều khoản v4" "$(sql "SELECT goods_category_codes+'/'+voucher_code+'/'+terms_version FROM reservations WHERE id=$RES")" "FOOD,HOUSEHOLD/$VC/v4"
P=$(call POST $KH "$PAY/create" "{\"reservationId\":$RES}")
check "IPN thành công" "$(ipn $(echo "$P" | jget 'o.orderId') $(echo "$P" | jget 'o.amount'))" "00"

echo "== BR-132: kiểm tra hàng lúc check-in (mục 6)"
UNIT=$(call GET $FM "$API/reservations/$RES/available-units" | jget 'o[0].id')
check "FM gán ô $UNIT" "$(code POST $FM "$API/reservations/$RES/assign" "{\"storageUnitId\":\"$UNIT\"}")" "200"
C=$(sql "SELECT id FROM rental_contracts WHERE reservation_id=$RES")
T=$(sql "SELECT id FROM facility_tasks WHERE contract_id=$C AND task_type='CHECK_IN'")
call POST $FM "$API/staff-tasks/$T/assign?staffId=$ST1_ID" >/dev/null
check "Staff thấy loại hàng khách khai báo" "$(call GET $ST1 "$API/staff-tasks/$T" | jget 'o.goodsCategories.length')" "2"
PIN=$(call GET $ST1 "$API/staff-tasks/pin-suggestion" | jget 'o.accessPinCode')
CI="\"identityVerified\":true,\"unitEmpty\":true,\"unitClean\":true,\"lockIntact\":true,\"customerSignatureConfirmed\":true,\"accessPinCode\":\"$PIN\",\"rfidCardCode\":\"RFID-E2EHN-$RES\",\"evidenceImages\":[$IMG]"
check "Chưa kiểm tra hàng → 400" "$(call POST $ST1 "$API/staff-tasks/$T/check-in" "{$CI}" | jget 'o.error')" "GOODS_CHECK_REQUIRED"
check "Check-in đủ 6 mục" "$(code POST $ST1 "$API/staff-tasks/$T/check-in" "{$CI,\"goodsChecked\":true}")" "200"
check "Biên bản ghi đã kiểm tra hàng" "$(call GET $KH "$API/contracts/$C/handover-records" | jget 'o[0].prohibitedGoodsCommitted')" "true"
check "Khách thấy loại hàng trong hợp đồng" "$(call GET $KH "$API/contracts?reservationId=$RES" | jget 'o.goodsCategories.length')" "2"

echo "== PR-O1 (D-15): bỏ ân hạn 5 ngày"
END=$(sql "SELECT CONVERT(VARCHAR(10), end_date, 23) FROM rental_contracts WHERE id=$C")
AFTER=$(date -d "$END +1 day" +%Y-%m-%d)
check "Hẹn trả kho sau ngày hết hạn ($AFTER) → 400" "$(code POST $KH "$API/contracts/$C/request-checkout" "{\"checkoutDate\":\"$AFTER\",\"refundMethod\":\"CASH\"}")" "400"

echo "== PR-R9: nhắc gia hạn mốc 15 ngày"
check "⚡ Còn 15 ngày hết hạn" "$(code POST $FM "$SIM/contracts/$C/expire-soon?days=15")" "200"
check "Khách nhận nhắc mốc 15" "$(sql "SELECT COUNT(*) FROM notifications WHERE user_id=$KH_ID AND ref_key LIKE 'RENEWAL:$C:%:15'")" "1"
check "Còn 16 ngày → ngoài khoảng giả lập" "$(code POST $FM "$SIM/contracts/$C/expire-soon?days=16")" "400"

echo "== D-15 / BR-134: hết hạn → thanh lý ngay, chuyển hàng vào kho tổng"
check "⚡ Quá hạn 1 ngày (điều khoản v4)" "$(call POST $FM "$SIM/contracts/$C/make-overdue?days=1" | jget 'o.message.indexOf("kho tổng")>=0')" "true"
check "HĐ LIQUIDATED ngay, không chờ 15 ngày / 3 lần liên hệ" "$(sql "SELECT status FROM rental_contracts WHERE id=$C")" "LIQUIDATED"
MT=$(sql "SELECT TOP 1 id FROM facility_tasks WHERE contract_id=$C AND task_type='MAINTENANCE' AND maintenance_reason='LIQUIDATION' AND status='OPEN' ORDER BY id DESC")
[ -n "$MT" ] && ok "Sinh việc chuyển hàng vào kho tổng #$MT" || bad "Không sinh task chuyển hàng vào kho tổng"
check "Khách thấy đang chờ chuyển kho tổng" "$(call GET $KH "$API/contracts?reservationId=$RES" | jget 'o.relocationPending')" "true"
check "Ghi phí dọn & di dời hàng (PR-Q16)" "$(sql "SELECT CASE WHEN COUNT(*)>0 THEN 'ok' ELSE 'khong' END FROM payment_transactions WHERE contract_id=$C AND transaction_code LIKE 'MV-%'")" "ok"
check "Ai đăng nhập cũng xem được danh sách kho tổng" "$(call GET $KH "$API/central-warehouses" | jget 'o.length>=1')" "true"
INV="\"note\":\"Da mo kho, kiem ke, chuyen hang vao kho tong\",\"inventoryNote\":\"3 thung thuc pham dong lanh, 2 thung do gia dung\",\"witnessNote\":\"Staff1 + FM Tan Binh\",\"storageLocation\":\"Day B - ke 3\",\"inventoryImages\":[$IMG]"
check "Chưa chọn kho tổng → 400" "$(call POST $FM "$API/staff-tasks/$MT/complete-maintenance" "{$INV}" | jget 'o.error')" "INVENTORY_REQUIRED"
check "Dọn xong, hàng vào kho tổng #1" "$(code POST $FM "$API/staff-tasks/$MT/complete-maintenance" "{$INV,\"centralWarehouseId\":1}")" "200"
CT=$(call GET $KH "$API/contracts?reservationId=$RES")
check "Khách thấy kho tổng + địa chỉ, hết chờ chuyển" "$(echo "$CT" | jget 'o.heldGoodsStatus+"/"+Boolean(o.centralStorage.centralWarehouseName&&o.centralStorage.centralWarehouseAddress)+"/"+o.relocationPending')" "HOLDING/true/false"
check "Phí lưu giữ tính theo ngày (điều khoản v4)" "$(echo "$CT" | jget 'o.centralStorage.storageFeePerDay>0')" "true"
check "Ô được nhả, cho thuê lại" "$(sql "SELECT status FROM storage_units WHERE id='$UNIT'")" "AVAILABLE"
HG=$(sql "SELECT id FROM held_goods WHERE contract_id=$C AND status='HOLDING'")
check "Không bán hàng của khách → 409" "$(call POST $FM "$API/held-goods/$HG/resolve" '{"outcome":"SOLD","note":"Ban thanh ly cho co so thu mua","proceedsAmount":1000000}' | jget 'o.error')" "GOODS_SALE_NOT_ALLOWED"
check "⚡ Hết hạn lưu giữ cũng không bán được" "$(code POST $FM "$SIM/held-goods/$HG/expire-hold"; call POST $FM "$API/held-goods/$HG/resolve" '{"outcome":"DESTROYED","note":"Tieu huy hang qua han"}' | jget 'o.error')" "200GOODS_SALE_NOT_ALLOWED"

echo "== BR-134: BOM quản lý kho tổng"
check "Hotline sai → 400" "$(call POST $BOM "$API/bom/central-warehouses" '{"name":"E2E Kho tong","address":"1 Duong E2E","hotline":"abc"}' | jget 'o.error')" "INVALID_INPUT"
check "FM không quản lý kho tổng → 403" "$(code POST $FM "$API/bom/central-warehouses" '{"name":"x","address":"y"}')" "403"
WH=$(call POST $BOM "$API/bom/central-warehouses" "{\"name\":\"E2E Kho tong $STAMP\",\"address\":\"1 Duong E2E\",\"hotline\":\"0900000999\"}" | jget 'o.id')
check "BOM thêm rồi ngừng kho tổng" "$(call PATCH $BOM "$API/bom/central-warehouses/$WH/status" '{"status":"INACTIVE"}' | jget 'o.status')" "INACTIVE"
check "Kho tổng đã ngừng không hiện để chọn" "$(call GET $FM "$API/central-warehouses" | jget "o.some(w=>w.id===$WH)")" "false"

# Dọn: tạm dừng voucher test
call PATCH $BOM "$API/bom/vouchers/$(call GET $BOM "$API/bom/vouchers" | jget "o.find(v=>v.code==='$VC').id")/status" '{"status":"INACTIVE"}' >/dev/null

echo ""
echo "Kết quả: $PASS đạt, $FAIL lỗi"
[ $FAIL -eq 0 ]
