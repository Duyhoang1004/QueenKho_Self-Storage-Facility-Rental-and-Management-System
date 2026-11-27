#!/usr/bin/env bash
# Kiểm thử các trường hợp TRẢ KHO qua API thật trên Docker (27/11/2026).
# Hợp đồng test: Kho Tiêu Chuẩn (1.850.000đ/tháng), gói 6 tháng (−10%), bảo hiểm cơ bản, không voucher
#   → tiền thuê 9.990.000đ + cọc 1.850.000đ = 11.840.000đ. Hợp đồng được dựng sẵn bằng SQL ở trạng thái ACTIVE
#   (đã nhận kho) với ngày bắt đầu tuỳ ca, phần trả kho (hẹn → nghiệm thu → quyết toán → hoàn tiền) chạy API thật.
# Chạy: bash docs/test-e2e/e2e-tra-kho-27-11.sh   (Docker đang chạy: backend :8080, container queenkho-db-1)
# ⚠️ Script ghi dữ liệu thật vào DB Docker (khách khachhang2, cơ sở Tân Bình, mã HD-T27…).
HOST=${E2E_HOST:-http://localhost:8080}
API=$HOST/api/v1
SIM=$API/dev/simulation
IMG='http://localhost:5173/demo/hien-trang-o-kho.svg'
PASS=0; FAIL=0
TODAY=$(date +%Y-%m-%d)
TOMORROW=$(date -d "$TODAY +1 day" +%Y-%m-%d)
STAMP=$(date +%H%M%S)

ok()   { PASS=$((PASS+1)); echo "  ✅ $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  ❌ $1"; }
check(){ if [ "$2" == "$3" ]; then ok "$1 ($2)"; else bad "$1: mong đợi [$3], thực tế [$2]"; fi; }
info() { echo "     · $1"; }
sql()  { MSYS_NO_PATHCONV=1 docker exec queenkho-db-1 /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P '12345678@Password' -C -I -f 65001 -d QueenKhoDB -h-1 -W -Q "SET NOCOUNT ON; $1" | tr -d '\r' | sed '/^$/d'; }
jget() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const o=JSON.parse(s);const v=($1);console.log(v===undefined||v===null?'':typeof v==='object'?JSON.stringify(v):v)}catch(e){console.log('PARSE_ERR:'+s.slice(0,200))}})"; }
login(){ curl -s -X POST $API/auth/login -H "Content-Type: application/json" -d "{\"email\":\"$1\",\"password\":\"123456\"}" | jget "o.token||o.accessToken"; }
# body JSON đi qua stdin: Git Bash trên Windows làm hỏng tiếng Việt khi truyền qua tham số dòng lệnh
call() { local m=$1 t=$2 u=$3 d=$4; if [ -n "$d" ]; then printf '%s' "$d" | curl -s -X $m -H "Authorization: Bearer $t" -H "Content-Type: application/json; charset=utf-8" --data-binary @- "$u"; else curl -s -X $m -H "Authorization: Bearer $t" "$u"; fi; }
tid()  { sql "SELECT TOP 1 id FROM facility_tasks WHERE contract_id=$1 AND task_type='$2' ORDER BY id DESC"; }
lines(){ jget "(o.lines||[]).map(l=>l.group+' | '+l.label+' | '+Math.round(l.amount)+(l.note?' | '+l.note:'')).join('\n')"; }

KH=$(login khachhang2@gmail.com); FM=$(login fmtanbinh@gmail.com); ST1=$(login stafftanbinh1@gmail.com)
ST1_ID=$(sql "SELECT id FROM users WHERE email='stafftanbinh1@gmail.com'")
FM_ID=$(sql "SELECT id FROM users WHERE email='fmtanbinh@gmail.com'")
[ -n "$KH" ] && [ -n "$FM" ] && [ -n "$ST1" ] || { echo "Không đăng nhập được"; exit 1; }

# Dựng hợp đồng ACTIVE: $1 = hậu tố mã, $2 = số ngày lùi ngày bắt đầu so với hôm nay
mk_contract() {
  local code=$1 off=$2
  local unit; unit=$(sql "SELECT TOP 1 id FROM storage_units WHERE facility_id=1 AND unit_type_id=2 AND status='AVAILABLE' AND is_emergency=0 AND id NOT IN (SELECT storage_unit_id FROM rental_contracts WHERE status IN ('ACTIVE','TERMINATION_PENDING','PENDING_CHECK_IN','OVERDUE','SETTLEMENT_PENDING')) ORDER BY id")
  local start; start=$(date -d "$TODAY $off day" +%Y-%m-%d)
  sql "DECLARE @s date='$start', @rid int, @cid int;
INSERT INTO reservations (reservation_code, customer_id, facility_id, unit_type_id, storage_unit_id, status, duration_months, deposit_amount,
  total_deposit_paid, expected_appointment_time, start_date, rent_discount_percent, terms_version, terms_accepted_at, insurance_plan,
  insurance_premium_monthly, declared_goods_value, goods_category_codes, created_at)
VALUES ('RES-T27$code$STAMP', 2, 1, 2, '$unit', 'UNIT_ASSIGNED', 6, 1850000, 11840000, DATEADD(HOUR, 9, CAST(@s AS datetime2)), @s, 10, 'v7',
  DATEADD(DAY,-2,CAST(@s AS datetime2)), 'BASIC', 0, 20000000, 'HOUSEHOLD', DATEADD(DAY,-2,CAST(@s AS datetime2)));
SET @rid = SCOPE_IDENTITY();
INSERT INTO rental_contracts (contract_code, reservation_id, customer_id, storage_unit_id, rental_policy_id, status, start_date, end_date,
  billing_cycle_months, deposit_held_amount, access_pin_code, rfid_card_code, late_fee_waived, overstay_fee_waived, fault_termination)
VALUES ('HD-T27$code$STAMP', @rid, 2, '$unit', 1, 'ACTIVE', @s, DATEADD(MONTH, 6, @s), 6, 1850000,
  RIGHT('00000' + CAST(ABS(CHECKSUM(NEWID())) % 1000000 AS varchar(6)), 6), 'RFID-T27$code$STAMP', 0, 0, 0);
SET @cid = SCOPE_IDENTITY();
INSERT INTO payment_transactions (transaction_code, user_id, reservation_id, contract_id, payment_type, payment_method, amount, status, paid_at)
VALUES ('T27-$code$STAMP', 2, @rid, @cid, 'DEPOSIT', 'VNPAY', 11840000, 'SUCCESS', DATEADD(DAY,-2,CAST(@s AS datetime2)));
UPDATE storage_units SET status='OCCUPIED' WHERE id='$unit';
SELECT @cid;"
}

GOOD='"identityVerified":true,"unitEmpty":true,"unitClean":true,"lockIntact":true,"customerSignatureConfirmed":true,"evidenceImages":["'$IMG'"]'

# Hẹn trả ngày mai (tiền mặt) → giao Staff 1 → giả lập "khách tới đúng ngày hẹn"; in ra id task CHECK_OUT
request_and_prepare() {
  local cid=$1
  local r; r=$(call POST $KH "$API/contracts/$cid/request-checkout" "{\"checkoutDate\":\"$TOMORROW\",\"refundMethod\":\"CASH\"}")
  local st; st=$(sql "SELECT status FROM rental_contracts WHERE id=$cid")
  [ "$st" == "TERMINATION_PENDING" ] || echo "     ! hẹn trả lỗi: $r" >&2
  local t; t=$(tid $cid CHECK_OUT)
  call POST $FM "$API/staff-tasks/$t/assign?staffId=$ST1_ID" >/dev/null
  call POST $ST1 "$SIM/tasks/$t/checkout-today" >/dev/null
  echo $t
}

# Khách xác nhận quyết toán → FM hoàn tiền mặt → khách xác nhận đã nhận
settle_and_refund() {
  local cid=$1
  call POST $KH "$API/contracts/$cid/settlement/confirm" >/dev/null
  local rt; rt=$(tid $cid REFUND)
  if [ -n "$rt" ]; then
    check "FM hoàn tiền mặt (task #$rt)" "$(call POST $FM "$API/staff-tasks/$rt/complete-refund?managerId=$FM_ID" "{\"paymentMethod\":\"CASH\",\"evidenceImageUrl\":\"$IMG\",\"cashReceiptConfirmed\":true,\"note\":\"Khách nhận tiền mặt tại quầy (e2e)\"}" | jget 'o.status')" "COMPLETED"
    call POST $KH "$API/refunds/$rt/confirm" >/dev/null
  fi
  info "Hợp đồng sau cùng: $(sql "SELECT status FROM rental_contracts WHERE id=$cid") · quyết toán: $(sql "SELECT TOP 1 status FROM checkout_settlements WHERE contract_id=$cid ORDER BY id DESC")"
}

echo "Ngày chạy: $TODAY · ngày hẹn trả: $TOMORROW"

echo; echo "======== CA 1 — Trả kho trong 3 ngày đầu (PR-O2e) ========"
C1=$(mk_contract A -1); info "HĐ id $C1 bắt đầu $(sql "SELECT start_date FROM rental_contracts WHERE id=$C1"), trả $TOMORROW (2 ngày đã dùng)"
P=$(call GET $KH "$API/contracts/$C1/checkout-refund-preview?checkoutDate=$TOMORROW")
echo "$P" | lines | sed 's/^/       /'
check "Dùng thử 3 ngày (trialReturn)" "$(echo "$P" | jget 'o.trialReturn')" "true"
check "Không phí phá HĐ" "$(echo "$P" | jget 'Math.round(o.breakFee||0)')" "0"
check "Dự kiến hoàn = 1.850.000 + 9.990.000 − 2 × 61.667" "$(echo "$P" | jget 'Math.round(o.netAmount)')" "11716666"
T=$(request_and_prepare $C1)
check "Staff nghiệm thu" "$(call POST $ST1 "$API/staff-tasks/$T/check-out" "{$GOOD}" | jget 'o.status')" "COMPLETED"
S=$(call GET $KH "$API/contracts/$C1/settlement")
check "Bảng quyết toán khớp số lúc hẹn" "$(echo "$S" | jget 'Math.round(o.netAmount)')" "11716666"
settle_and_refund $C1

echo; echo "======== CA 2 — Trả kho sau 3 ngày (PR-O2: 1 tháng + phí phá HĐ) ========"
C2=$(mk_contract B -10); info "HĐ id $C2 bắt đầu $(sql "SELECT start_date FROM rental_contracts WHERE id=$C2"), trả $TOMORROW (11 ngày → tháng thứ 1)"
P=$(call GET $KH "$API/contracts/$C2/checkout-refund-preview?checkoutDate=$TOMORROW")
echo "$P" | lines | sed 's/^/       /'
check "Không phải dùng thử" "$(echo "$P" | jget 'o.trialReturn')" "false"
check "Phí phá HĐ 1 tháng" "$(echo "$P" | jget 'Math.round(o.breakFee)')" "1850000"
check "Dự kiến hoàn = 1.850.000 + (9.990.000 − 1.850.000 − 1.850.000)" "$(echo "$P" | jget 'Math.round(o.netAmount)')" "8140000"
T=$(request_and_prepare $C2)

echo "  -- Checklist không đủ điều kiện (trừ CCCD) --"
check "Ô chưa trống → CHECKLIST_INCOMPLETE" "$(call POST $ST1 "$API/staff-tasks/$T/check-out" "{${GOOD/\"unitEmpty\":true/\"unitEmpty\":false}}" | jget 'o.error')" "CHECKLIST_INCOMPLETE"
check "Khách chưa ký biên bản → CHECKLIST_INCOMPLETE" "$(call POST $ST1 "$API/staff-tasks/$T/check-out" "{${GOOD/\"customerSignatureConfirmed\":true/\"customerSignatureConfirmed\":false}}" | jget 'o.error')" "CHECKLIST_INCOMPLETE"
check "Bỏ trống mục sạch / khoá → CHECKLIST_INCOMPLETE" "$(call POST $ST1 "$API/staff-tasks/$T/check-out" '{"identityVerified":true,"unitEmpty":true,"customerSignatureConfirmed":true,"evidenceImages":["'$IMG'"]}' | jget 'o.error')" "CHECKLIST_INCOMPLETE"
check "Ô bẩn mà không lập sự cố → DAMAGE_REPORT_REQUIRED" "$(call POST $ST1 "$API/staff-tasks/$T/check-out" "{${GOOD/\"unitClean\":true/\"unitClean\":false}}" | jget 'o.error')" "DAMAGE_REPORT_REQUIRED"
check "Khoá hỏng mà không lập sự cố → DAMAGE_REPORT_REQUIRED" "$(call POST $ST1 "$API/staff-tasks/$T/check-out" "{${GOOD/\"lockIntact\":true/\"lockIntact\":false}}" | jget 'o.error')" "DAMAGE_REPORT_REQUIRED"
check "Không có ảnh hiện trạng → HANDOVER_PHOTO_REQUIRED" "$(call POST $ST1 "$API/staff-tasks/$T/check-out" '{"identityVerified":true,"unitEmpty":true,"unitClean":true,"lockIntact":true,"customerSignatureConfirmed":true,"evidenceImages":[]}' | jget 'o.error')" "HANDOVER_PHOTO_REQUIRED"
check "Sự cố thiếu bên chịu lỗi → INVALID_DAMAGE_ITEM" "$(call POST $ST1 "$API/staff-tasks/$T/check-out" "{${GOOD/\"unitClean\":true/\"unitClean\":false},\"damageCases\":[{\"title\":\"Rác bỏ lại\",\"estimatedCost\":200000,\"evidenceImages\":[\"$IMG\"]}]}" | jget 'o.error')" "INVALID_DAMAGE_ITEM"
check "Sự cố chi phí âm → INVALID_DAMAGE_ITEM" "$(call POST $ST1 "$API/staff-tasks/$T/check-out" "{${GOOD/\"unitClean\":true/\"unitClean\":false},\"damageCases\":[{\"title\":\"Rác bỏ lại\",\"estimatedCost\":-1,\"liableParty\":\"CUSTOMER\",\"evidenceImages\":[\"$IMG\"]}]}" | jget 'o.error')" "INVALID_DAMAGE_ITEM"
check "Sự cố không có ảnh → EVIDENCE_IMAGE_REQUIRED" "$(call POST $ST1 "$API/staff-tasks/$T/check-out" "{${GOOD/\"unitClean\":true/\"unitClean\":false},\"damageCases\":[{\"title\":\"Rác bỏ lại\",\"estimatedCost\":200000,\"liableParty\":\"CUSTOMER\",\"evidenceImages\":[]}]}" | jget 'o.error')" "EVIDENCE_IMAGE_REQUIRED"
check "Task vẫn mở sau các lần bị chặn" "$(sql "SELECT status FROM facility_tasks WHERE id=$T")" "IN_PROGRESS"
check "Nghiệm thu hợp lệ" "$(call POST $ST1 "$API/staff-tasks/$T/check-out" "{$GOOD}" | jget 'o.status')" "COMPLETED"
S=$(call GET $KH "$API/contracts/$C2/settlement")
check "Quyết toán 8.140.000" "$(echo "$S" | jget 'Math.round(o.netAmount)')" "8140000"
settle_and_refund $C2

echo; echo "======== CA 3 — Có yêu cầu hỗ trợ tiền bạc (hư hàng, lỗi cơ sở, FM chọn tiếp tục thuê) ========"
C3=$(mk_contract C -10); info "HĐ id $C3, bắt đầu $(sql "SELECT start_date FROM rental_contracts WHERE id=$C3")"
R=$(call POST $KH "$API/support-requests" "{\"contractId\":$C3,\"issueType\":\"GOODS_DAMAGE\",\"description\":\"Thùng hàng bị ướt do dột mái ô kho\",\"evidenceImages\":[\"$IMG\"],\"incidentDate\":\"$TODAY\",\"itemsDescription\":\"2 thùng quần áo bị ướt, trị giá 2.000.000đ\",\"claimedAmount\":2000000}")
TK3=$(echo "$R" | jget 'o.id'); info "Ticket hư hàng id $TK3 ($(echo "$R" | jget 'o.ticketCode||o.error'))"
CL3=$(sql "SELECT TOP 1 id FROM compensation_claims WHERE contract_id=$C3 ORDER BY id DESC")
T=$(request_and_prepare $C3)
check "Hồ sơ chưa kiểm tra hiện trường → chặn nghiệm thu CLAIM_INSPECTION_PENDING" "$(call POST $ST1 "$API/staff-tasks/$T/check-out" "{$GOOD}" | jget 'o.error')" "CLAIM_INSPECTION_PENDING"
check "Màn Staff liệt kê mục chặn" "$(call GET $ST1 "$API/staff-tasks/$T?userId=$ST1_ID" | jget '(o.checkoutBlockers||[]).map(b=>b.kind).join(",")')" "CLAIM_UNINSPECTED"
ST3=$(sql "SELECT TOP 1 id FROM facility_tasks WHERE support_request_id=$TK3 ORDER BY id DESC")
call POST $FM "$API/staff-tasks/$ST3/assign?staffId=$ST1_ID" >/dev/null
RS=$(call POST $ST1 "$API/staff-tasks/$ST3/resolve-support?staffId=$ST1_ID" "{\"resolutionNote\":\"Kiểm tra hiện trường: mái ô kho dột, 2 thùng quần áo ướt, xác nhận do cơ sở\",\"inspectionImages\":[\"$IMG\"],\"preliminaryCause\":\"FACILITY\",\"staffAssessedValue\":2000000}")
check "Staff kiểm tra hiện trường xong" "$(sql "SELECT status FROM compensation_claims WHERE id=$CL3")" "INSPECTED"
[ "$(sql "SELECT status FROM compensation_claims WHERE id=$CL3")" == "INSPECTED" ] || info "resolve-support trả về: $RS"
D=$(call POST $FM "$API/claims/$CL3/decide" '{"liableParty":"FACILITY","assessedValue":2000000,"damagePercent":100,"unusableDays":0,"resolution":"CONTINUE","note":"Lỗi mái dột của cơ sở, đền giá trị hàng"}')
check "FM chốt lỗi cơ sở, tiếp tục thuê → APPROVED" "$(echo "$D" | jget 'o.status||o.error')" "APPROVED"
info "Tiền đền bù: $(echo "$D" | jget 'Math.round(o.totalCompensation)') (hàng $(echo "$D" | jget 'Math.round(o.goodsCompensation)'), đền thêm $(echo "$D" | jget 'Math.round(o.penaltyAmount)'))"
P=$(call GET $KH "$API/contracts/$C3/checkout-refund-preview?checkoutDate=$TOMORROW")
echo "$P" | lines | sed 's/^/       /'
check "Có hồ sơ lỗi cơ sở → tính theo ngày (faultTermination)" "$(echo "$P" | jget 'o.faultTermination')" "true"
check "Tiền đền bù tách riêng, không nằm trong bảng" "$(echo "$P" | jget '(o.separateCompensations||[]).map(c=>Math.round(c.amount)).join(",")+" / ADDED="+(o.lines||[]).filter(l=>l.group==="ADDED").length')" "2000000 / ADDED=0"
NET3=$(echo "$P" | jget 'Math.round(o.netAmount)'); info "Dự kiến hoàn trả kho: $NET3"
check "Nghiệm thu được sau khi kiểm tra hiện trường" "$(call POST $ST1 "$API/staff-tasks/$T/check-out" "{$GOOD}" | jget 'o.status')" "COMPLETED"
S=$(call GET $KH "$API/contracts/$C3/settlement")
check "Quyết toán = số dự kiến, không cộng đền bù" "$(echo "$S" | jget 'Math.round(o.netAmount)+"/"+Math.round(o.compensationAmount||0)')" "$NET3/0"
settle_and_refund $C3
check "FM chi đền bù riêng (tiền mặt)" "$(call POST $FM "$API/claims/$CL3/pay" "{\"paymentMethod\":\"CASH\",\"cashReceiptConfirmed\":true}" | jget 'o.status||o.error')" "PAID"
info "Giao dịch HĐ: $(sql "SELECT STRING_AGG(payment_type+':'+CAST(CAST(amount AS bigint) AS varchar)+':'+status, ', ') FROM payment_transactions WHERE contract_id=$C3")"

echo; echo "======== CA 3b — Hư hàng nhưng lỗi khách (không bồi thường) ========"
C3B=$(mk_contract D -10)
R=$(call POST $KH "$API/support-requests" "{\"contractId\":$C3B,\"issueType\":\"GOODS_DAMAGE\",\"description\":\"Bình gốm bị vỡ trong thùng\",\"evidenceImages\":[\"$IMG\"],\"incidentDate\":\"$TODAY\",\"itemsDescription\":\"1 bình gốm trị giá 1.500.000đ\",\"claimedAmount\":1500000}")
TK3B=$(echo "$R" | jget 'o.id'); CL3B=$(sql "SELECT TOP 1 id FROM compensation_claims WHERE contract_id=$C3B ORDER BY id DESC")
ST3B=$(sql "SELECT TOP 1 id FROM facility_tasks WHERE support_request_id=$TK3B ORDER BY id DESC")
call POST $FM "$API/staff-tasks/$ST3B/assign?staffId=$ST1_ID" >/dev/null
call POST $ST1 "$API/staff-tasks/$ST3B/resolve-support?staffId=$ST1_ID" "{\"resolutionNote\":\"Hàng đóng gói không chèn lót, ô kho nguyên vẹn, lỗi do khách\",\"inspectionImages\":[\"$IMG\"],\"preliminaryCause\":\"CUSTOMER\",\"staffAssessedValue\":1500000}" >/dev/null
D=$(call POST $FM "$API/claims/$CL3B/decide" '{"liableParty":"CUSTOMER","assessedValue":1500000,"damagePercent":100,"unusableDays":0,"resolution":"CONTINUE","note":"Hàng đóng gói không đúng cách, lỗi do khách"}')
check "Lỗi khách → hồ sơ REJECTED, 0đ" "$(echo "$D" | jget '(o.status||o.error)+"/"+Math.round(o.totalCompensation||0)')" "REJECTED/0"
P=$(call GET $KH "$API/contracts/$C3B/checkout-refund-preview?checkoutDate=$TOMORROW")
check "Lỗi khách → trả sớm thường (PR-O2), có phí phá HĐ" "$(echo "$P" | jget 'o.faultTermination+"/"+Math.round(o.breakFee)+"/"+Math.round(o.netAmount)')" "false/1850000/8140000"

echo; echo "======== CA 4 — Còn yêu cầu hỗ trợ thường (khoá hỏng) ========"
C4=$(mk_contract E -10)
R=$(call POST $KH "$API/support-requests" "{\"contractId\":$C4,\"issueType\":\"LOCK_ISSUE\",\"description\":\"Không mở được khoá bằng mã PIN\",\"evidenceImages\":[\"$IMG\"]}")
TK4=$(echo "$R" | jget 'o.id'); info "Ticket khoá hỏng id $TK4 ($(echo "$R" | jget 'o.ticketCode||o.error'))"
T=$(request_and_prepare $C4)
check "Vẫn gán được task trả kho cho Staff" "$(sql "SELECT status FROM facility_tasks WHERE id=$T")" "IN_PROGRESS"
check "Màn Staff liệt kê ticket đang chặn" "$(call GET $ST1 "$API/staff-tasks/$T?userId=$ST1_ID" | jget '(o.checkoutBlockers||[]).map(b=>b.kind).join(",")')" "TICKET"
check "Staff nghiệm thu khi hỗ trợ chưa xong → OPEN_TICKETS_PENDING" "$(call POST $ST1 "$API/staff-tasks/$T/check-out" "{$GOOD}" | jget 'o.error')" "OPEN_TICKETS_PENDING"
ST4=$(sql "SELECT TOP 1 id FROM facility_tasks WHERE support_request_id=$TK4 ORDER BY id DESC")
call POST $FM "$API/staff-tasks/$ST4/assign?staffId=$ST1_ID" >/dev/null
call POST $ST1 "$API/staff-tasks/$ST4/resolve-support?staffId=$ST1_ID" "{\"resolutionNote\":\"Đã reset mã PIN và kiểm tra khoá hoạt động bình thường\",\"actionTaken\":\"PIN_RESET\",\"inspectionImages\":[\"$IMG\"]}" >/dev/null
info "Ticket sau khi Staff xử lý: $(sql "SELECT status FROM support_requests WHERE id=$TK4")"
check "Hết mục chặn → nghiệm thu được" "$(call POST $ST1 "$API/staff-tasks/$T/check-out" "{$GOOD}" | jget 'o.status||o.error')" "COMPLETED"
check "Ticket chờ khách xác nhận được tự đóng khi nghiệm thu" "$(sql "SELECT status FROM support_requests WHERE id=$TK4")" "CLOSED"

echo; echo "======== CA 5 — Sự cố khi trả kho: lỗi khách (trừ cọc) ========"
C5=$(mk_contract F -10); T=$(request_and_prepare $C5)
check "Nghiệm thu, ô bẩn, khách chịu 500.000" "$(call POST $ST1 "$API/staff-tasks/$T/check-out" "{${GOOD/\"unitClean\":true/\"unitClean\":false},\"damageCases\":[{\"title\":\"Rác và vết sơn bỏ lại\",\"estimatedCost\":500000,\"liableParty\":\"CUSTOMER\",\"evidenceImages\":[\"$IMG\"]}]}" | jget 'o.status||o.error')" "COMPLETED"
S=$(call GET $KH "$API/contracts/$C5/settlement"); echo "$S" | lines | sed 's/^/       /'
check "Quyết toán = 8.140.000 − 500.000" "$(echo "$S" | jget 'Math.round(o.netAmount)')" "7640000"
check "Ô chuyển bảo trì sau sự cố" "$(sql "SELECT su.status FROM rental_contracts c JOIN storage_units su ON su.id=c.storage_unit_id WHERE c.id=$C5")" "MAINTENANCE"
settle_and_refund $C5

echo; echo "======== CA 5b — Sự cố lỗi khách vượt cọc + tiền hoàn (khách phải trả thêm) ========"
C5B=$(mk_contract G -10); T=$(request_and_prepare $C5B)
call POST $ST1 "$API/staff-tasks/$T/check-out" "{${GOOD/\"lockIntact\":true/\"lockIntact\":false},\"damageCases\":[{\"title\":\"Phá khoá và móp vách ô\",\"estimatedCost\":10000000,\"liableParty\":\"CUSTOMER\",\"evidenceImages\":[\"$IMG\"]}]}" >/dev/null
S=$(call GET $KH "$API/contracts/$C5B/settlement"); echo "$S" | lines | sed 's/^/       /'
check "Quyết toán âm = 8.140.000 − 10.000.000" "$(echo "$S" | jget 'Math.round(o.netAmount)')" "-1860000"
call POST $KH "$API/contracts/$C5B/settlement/confirm" >/dev/null
check "Khách xác nhận → chờ khách thanh toán phần thiếu" "$(sql "SELECT TOP 1 status FROM checkout_settlements WHERE contract_id=$C5B ORDER BY id DESC")" "AWAITING_PAYMENT"
info "Khoản nợ: $(sql "SELECT STRING_AGG(payment_type+':'+CAST(CAST(amount AS bigint) AS varchar)+':'+status, ', ') FROM payment_transactions WHERE contract_id=$C5B AND status='PENDING'")"

echo; echo "======== CA 6 — Sự cố khi trả kho: lỗi cơ sở (không trừ khách) ========"
C6=$(mk_contract H -10); T=$(request_and_prepare $C6)
check "Nghiệm thu, khoá hỏng do cơ sở 1.000.000" "$(call POST $ST1 "$API/staff-tasks/$T/check-out" "{${GOOD/\"lockIntact\":true/\"lockIntact\":false},\"damageCases\":[{\"title\":\"Khoá SmartLock hỏng mạch\",\"estimatedCost\":1000000,\"liableParty\":\"FACILITY\",\"evidenceImages\":[\"$IMG\"]}]}" | jget 'o.status||o.error')" "COMPLETED"
S=$(call GET $KH "$API/contracts/$C6/settlement")
check "Quyết toán không trừ lỗi cơ sở" "$(echo "$S" | jget 'Math.round(o.netAmount)')" "8140000"
check "Sinh task bảo trì cho ô" "$(sql "SELECT COUNT(*) FROM facility_tasks WHERE contract_id=$C6 AND task_type='MAINTENANCE'")" "1"
settle_and_refund $C6

echo; echo "======== CA 7 — Các trường hợp khác ========"
C7=$(mk_contract I -10)
call POST $KH "$API/contracts/$C7/request-checkout" "{\"checkoutDate\":\"$TOMORROW\",\"refundMethod\":\"CASH\"}" >/dev/null
T=$(tid $C7 CHECK_OUT); call POST $FM "$API/staff-tasks/$T/assign?staffId=$ST1_ID" >/dev/null
check "Nghiệm thu trước ngày hẹn (không giả lập) → CHECK_OUT_TOO_EARLY" "$(call POST $ST1 "$API/staff-tasks/$T/check-out" "{$GOOD}" | jget 'o.error')" "CHECK_OUT_TOO_EARLY"
check "Hẹn trả hôm nay → bị từ chối (phải từ ngày mai)" "$(call POST $KH "$API/contracts/$C7/request-checkout" "{\"checkoutDate\":\"$TODAY\",\"refundMethod\":\"CASH\"}" | jget 'o.error')" "INVALID_INPUT"
check "Chuyển khoản thiếu số tài khoản → bị từ chối" "$(call POST $KH "$API/contracts/$C7/request-checkout" "{\"checkoutDate\":\"$TOMORROW\",\"refundMethod\":\"BANK_TRANSFER\"}" | jget 'o.error')" "INVALID_REFUND_METHOD"
call POST $ST1 "$SIM/tasks/$T/checkout-today" >/dev/null
call POST $ST1 "$API/staff-tasks/$T/check-out" "{$GOOD}" >/dev/null
check "Khách không đồng ý quyết toán → DISPUTED" "$(call POST $KH "$API/contracts/$C7/settlement/dispute" '{"reason":"Tôi muốn kiểm tra lại số ngày đã dùng"}' >/dev/null; sql "SELECT TOP 1 status FROM checkout_settlements WHERE contract_id=$C7 ORDER BY id DESC")" "DISPUTED"
RT=$(sql "SELECT TOP 1 id FROM facility_tasks WHERE task_type='REFUND' AND contract_id=(SELECT TOP 1 id FROM rental_contracts WHERE contract_code LIKE 'HD-T27A$STAMP') ORDER BY id DESC")
check "FM hoàn sai cách khách chọn (chuyển khoản cho khách chọn tiền mặt) → REFUND_METHOD_MISMATCH" "$(C=$(mk_contract J -10); T2=$(request_and_prepare $C); call POST $ST1 "$API/staff-tasks/$T2/check-out" "{$GOOD}" >/dev/null; call POST $KH "$API/contracts/$C/settlement/confirm" >/dev/null; call POST $FM "$API/staff-tasks/$(tid $C REFUND)/complete-refund?managerId=$FM_ID" "{\"paymentMethod\":\"BANK_TRANSFER\",\"bankTransactionCode\":\"FT1\",\"evidenceImageUrl\":\"$IMG\"}" | jget 'o.error')" "REFUND_METHOD_MISMATCH"

echo; echo "======== CA 8 — Trả trễ sau hạn hợp đồng ========"
C8=$(mk_contract K -185)
sql "UPDATE rental_contracts SET status='OVERDUE' WHERE id=$C8" >/dev/null
info "HĐ id $C8 hết hạn $(sql "SELECT end_date FROM rental_contracts WHERE id=$C8"), trả $TOMORROW"
P=$(call GET $KH "$API/contracts/$C8/checkout-refund-preview?checkoutDate=$TOMORROW"); echo "$P" | lines | sed 's/^/       /'
info "Phí trễ $(echo "$P" | jget 'Math.round(o.lateFee)'), phí chiếm dụng $(echo "$P" | jget 'Math.round(o.overstayFee)'), dự kiến hoàn $(echo "$P" | jget 'Math.round(o.netAmount)')"

echo; echo "======== BÁO CÁO TIỀN VÀO / TIỀN RA (cơ sở Tân Bình, hôm nay) ========"
echo "  Theo DB (payment_transactions SUCCESS của các HĐ test):"
sql "SELECT payment_type + ' / ' + payment_method + ': ' + CAST(COUNT(*) AS varchar) + ' giao dịch, ' + FORMAT(SUM(amount), 'N0') FROM payment_transactions WHERE status='SUCCESS' AND contract_id IN (SELECT id FROM rental_contracts WHERE contract_code LIKE 'HD-T27%$STAMP') GROUP BY payment_type, payment_method" | sed 's/^/     /'
OV=$(call GET $FM "$API/bom/revenue/overview?facilityId=1&from=$TODAY&to=$TODAY")
info "Báo cáo /bom/revenue/overview hôm nay (FM Tân Bình): $(echo "$OV" | jget 'JSON.stringify(o).slice(0,400)')"
TX=$(call GET $FM "$API/bom/revenue/transactions?facilityId=1&from=$TODAY&to=$TODAY&size=500")
info "Giao dịch trong báo cáo thuộc HĐ test: $(echo "$TX" | jget '((o.content||o.items||o)||[]).filter(t=>String(t.contractCode||"").includes("'$STAMP'")).map(t=>t.paymentType+":"+Math.round(t.amount)).join(", ")')"

CASHNET=$(sql "SELECT CAST(SUM(CASE WHEN p.payment_type IN ('DEPOSIT','MONTHLY_RENT','OVERSTAY_FEE','LATE_FEE','DAMAGE_FEE') THEN p.amount WHEN p.payment_type IN ('REFUND','COMPENSATION') THEN -p.amount ELSE 0 END) AS bigint) FROM payment_transactions p LEFT JOIN rental_contracts c ON c.id=p.contract_id LEFT JOIN storage_units su ON su.id=c.storage_unit_id LEFT JOIN reservations r ON r.id=p.reservation_id WHERE p.status='SUCCESS' AND p.payment_method NOT IN ('DEPOSIT_OFFSET','SETTLEMENT_OFFSET') AND COALESCE(su.facility_id, r.facility_id)=1")
check "Doanh thu ròng báo cáo = tiền thu − hoàn − đền bù thật (PR-M7a)" "$(call GET $FM "$API/bom/revenue/overview?facilityId=1" | jget 'Math.round(o.netRevenue)')" "$CASHNET"

echo; echo "======== KẾT QUẢ: $PASS đạt, $FAIL lỗi ========"
