import api from './api'

// D-21 (PR-O19 → PR-O23): quyết toán trả kho — nghiệm thu xong khách xác nhận mới kết thúc hợp đồng

// Bảng quyết toán mới nhất của hợp đồng (khách / Staff / FM): { status, netAmount, direction, damages[], claims[], history[], canConfirm... }
export async function getSettlement(contractId) {
  const res = await api.get(`/contracts/${contractId}/settlement`)
  return res.data
}

// Khách xác nhận kết thúc hợp đồng. Quyết toán âm → trả { payUrl } để thanh toán VNPAY
export async function confirmSettlement(contractId) {
  const res = await api.post(`/contracts/${contractId}/settlement/confirm`, {})
  return res.data
}

// Khách "Không đồng ý": reason 10–500 ký tự
export async function disputeSettlement(contractId, reason) {
  const res = await api.post(`/contracts/${contractId}/settlement/dispute`, { reason })
  return res.data
}

// Khách tạo lại link VNPAY khi đang chờ thanh toán phần âm
export async function paySettlement(contractId) {
  const res = await api.post(`/contracts/${contractId}/settlement/pay`, {})
  return res.data
}

// Staff / FM thu tiền mặt tại quầy: data = { cashReceiptConfirmed, evidenceImageUrl, note }
export async function recordSettlementCash(contractId, data) {
  const res = await api.post(`/contracts/${contractId}/settlement/cash-payment`, data)
  return res.data
}

// FM: group = ACTION (chờ FM xử lý) / CUSTOMER / PAYMENT / DONE / ALL
export async function getSettlements(group) {
  const res = await api.get('/settlements', { params: group ? { group } : {} })
  return res.data
}

// FM sửa số tiền (chỉ giảm): data = { damages: [{ damageCaseId, estimatedCost, liableParty }], waiveLateFee, waiveOverstayFee, note }
export async function adjustSettlement(settlementId, data) {
  const res = await api.post(`/settlements/${settlementId}/adjust`, data)
  return res.data
}

// FM giữ nguyên kèm giải thích
export async function keepSettlement(settlementId, note) {
  const res = await api.post(`/settlements/${settlementId}/keep`, { note })
  return res.data
}

// FM giao nhân viên kiểm tra lại: staffId tuỳ chọn
export async function recheckSettlement(settlementId, note, staffId) {
  const res = await api.post(`/settlements/${settlementId}/recheck`, { note, staffId: staffId || null })
  return res.data
}

// 🔸 Demo: quyết toán dương chờ khách đủ 3 ngày → tự xác nhận
export async function simulateSettlementAutoConfirm(contractId) {
  const res = await api.post(`/dev/simulation/contracts/${contractId}/settlement-auto-confirm`, {})
  return res.data
}
