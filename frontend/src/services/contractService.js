import api from './api'

// Lấy danh sách hợp đồng theo managerId (tự động lọc theo cơ sở của manager đó)
export async function getContractsByManager(managerId) {
  const res = await api.get('/contracts', { params: { managerId } })
  return res.data
}

// Lấy danh sách hợp đồng theo facilityId
export async function getContractsByFacility(facilityId) {
  const res = await api.get('/contracts', { params: { facilityId } })
  return res.data
}

// Customer: lấy HĐ theo reservationId (1 đơn → 1 HĐ)
export async function getContractByReservation(reservationId) {
  const res = await api.get('/contracts', { params: { reservationId } })
  return res.data
}

// Flow 6: báo giá gia hạn 1/3/6/12 tháng (đúng số VNPAY sẽ thu)
// trả [{ months, discountPercent, subtotal, discountAmount, rentAmount, lateFeeAmount, lateFeeWaived, overstayFeeAmount, totalAmount }]
export async function getRenewalQuote(contractId) {
  const res = await api.get(`/contracts/${contractId}/renewal-quote`)
  return res.data
}

// PR-R10 / PR-R11: còn gia hạn được không + hạn chót ưu tiên (end_date − 3) + hạn mới từng gói
// trả { window: PRIORITY | LATE | CLOSED, renewable, unitReleasing, priorityDeadline, daysUntilDeadline, blockedReason, packages: [{ months, newEndDate }] }
export async function getRenewalEligibility(contractId) {
  const res = await api.get(`/contracts/${contractId}/renewal-eligibility`)
  return res.data
}

// UC-06: vị trí ô của hợp đồng trên mặt bằng (khách / Staff / FM, chỉ xem)
// trả { unitId, floor, zone, roomNumber, locationHint, placed, unit: { x, y, w, h }, door,
//       floorPlan: { name, gridWidth, gridHeight, cellMeters, fixtures, otherUnits: [{ x, y, w, h }] } }
export async function getUnitLocation(contractId) {
  const res = await api.get(`/contracts/${contractId}/unit-location`)
  return res.data
}

// Flow 6: FM miễn phí trễ cho hợp đồng quá hạn (lý do bắt buộc 5–400 ký tự)
// waiveOverstay = true → miễn luôn phí chiếm dụng (góp ý test 12/11: FM / BOM tự quyết có thu hay không)
export async function waiveLateFee(contractId, reason, waiveOverstay = false) {
  const res = await api.post(`/contracts/${contractId}/waive-late-fee`, { reason, waiveOverstay })
  return res.data
}

// Lấy chi tiết 1 hợp đồng theo id
export async function getContractDetail(contractId) {
  const res = await api.get(`/contracts/${contractId}`)
  return res.data
}

// UC-22: Khách hàng yêu cầu trả kho & hẹn ngày checkout
export async function requestCheckout(contractId, data) {
  const res = await api.post(`/contracts/${contractId}/request-checkout`, data)
  return res.data
}

// UC-22: Khách hàng hủy yêu cầu trả kho (hủy chờ trả kho)
export async function cancelCheckout(contractId) {
  const res = await api.post(`/contracts/${contractId}/cancel-checkout`)
  return res.data
}

// UC-28: Lấy danh sách hợp đồng quá hạn / đã thanh lý cho FM
export async function getOverdueContracts(managerId, status = 'OVERDUE') {
  const res = await api.get('/contracts/manager/overdue', { params: { managerId, status } })
  return res.data
}

// UC-28: Ghi chú liên hệ khách hàng quá hạn
export async function addOverdueContact(contractId, data) {
  const res = await api.post(`/contracts/${contractId}/overdue-contacts`, data)
  return res.data
}

// UC-28: Lấy lịch sử liên hệ khách hàng quá hạn
export async function getOverdueContactLogs(contractId, managerId) {
  const res = await api.get(`/contracts/${contractId}/overdue-contacts`, { params: { managerId } })
  return res.data
}

// UC-28: FM thanh lý hợp đồng quá hạn
export async function liquidateContract(contractId, data) {
  const res = await api.post(`/contracts/${contractId}/liquidate`, data)
  return res.data
}

// UC-28: FM yêu cầu hoàn phần cọc còn lại sau thanh lý
export async function refundRemainingDeposit(contractId, data) {
  const res = await api.post(`/contracts/${contractId}/refund-remaining-deposit`, data)
  return res.data
}


// BR-121: biên bản nhận kho / trả kho của hợp đồng (kèm ảnh hiện trạng ô)
// trả [{ id, recordType: CHECK_IN | CHECK_OUT, checkInMethod: COUNTER (ONLINE = biên bản cũ), staffName, createdAt, notes,
//        identityVerified, unitEmpty, unitClean, lockIntact, customerSignatureConfirmed, evidenceImages: [url] }]
export async function getHandoverRecords(contractId) {
  const res = await api.get(`/contracts/${contractId}/handover-records`)
  return res.data
}

// BR-122: ô trống cùng loại, cùng cơ sở để FM chuyển hợp đồng sang
export async function getTransferOptions(contractId) {
  const res = await api.get(`/contracts/${contractId}/transfer-options`)
  return res.data
}

// BR-122: lịch sử chuyển ô của hợp đồng
export async function getUnitTransfers(contractId) {
  const res = await api.get(`/contracts/${contractId}/unit-transfers`)
  return res.data
}

// BR-122: FM chuyển hợp đồng sang ô khác
// data = { toUnitId, reasonType: FACILITY_ISSUE | CUSTOMER_REQUEST | REARRANGE, reason, oldUnitMaintenance }
export async function transferUnit(contractId, data) {
  const res = await api.post(`/contracts/${contractId}/transfer-unit`, data)
  return res.data
}

// BR-129: nhiệt độ / độ ẩm ô của hợp đồng — { readings: [{ temperature, humidity, alert, recordedAt }], alertCount, latest, tempMin, tempMax, humidityMax }
// around = 'yyyy-mm-dd' để xem quanh ngày xảy ra sự cố (hồ sơ bồi thường)
export async function getSensorReadings(contractId, { days = 3, around } = {}) {
  const res = await api.get(`/contracts/${contractId}/sensor-readings`, { params: { days, ...(around ? { around } : {}) } })
  return res.data
}

// Flow 6 (04/11/2026): hợp đồng quá hạn toàn chuỗi cho BOM (FM gọi chỉ thấy cơ sở mình)
export async function getOverdueContractsChain(facilityId) {
  const res = await api.get('/contracts/overdue-all', { params: facilityId ? { facilityId } : {} })
  return res.data
}
