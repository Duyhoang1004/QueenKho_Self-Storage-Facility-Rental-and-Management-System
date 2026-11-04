import api from './api'

// BR-125 → BR-128: gói bảo hiểm + hồ sơ bồi thường hàng hư / mất

// Danh sách gói bảo hiểm (công khai): [{ code, label, monthlyPremium, coverageLimit, insured, noDeclarationCap }]
export async function getInsurancePlans() {
  const res = await api.get('/insurance-plans')
  return res.data
}

// FM: hồ sơ cơ sở mình · BOM: toàn chuỗi (facilityId tuỳ chọn)
export async function getClaims(facilityId) {
  const res = await api.get('/claims', { params: facilityId ? { facilityId } : {} })
  return res.data
}

export async function getClaimDetail(claimId) {
  const res = await api.get(`/claims/${claimId}`)
  return res.data
}

// Xem trước bảng tính: data = { liableParty, assessedValue, damagePercent, unusableDays }
// trả { goodsLoss, coverageCap, goodsCompensation, penaltyAmount, rentRefundAmount, totalCompensation, insuranceClaimable, explanation }
export async function quoteClaim(claimId, data) {
  const res = await api.post(`/claims/${claimId}/quote`, data)
  return res.data
}

// FM chốt: data = { liableParty, assessedValue, damagePercent, unusableDays, resolution: CONTINUE | TERMINATE, note }
export async function decideClaim(claimId, data) {
  const res = await api.post(`/claims/${claimId}/decide`, data)
  return res.data
}

// FM chi trả: data = { paymentMethod: BANK_TRANSFER | CASH, evidenceImageUrl, bankTransactionCode, cashReceiptConfirmed }
export async function payClaim(claimId, data) {
  const res = await api.post(`/claims/${claimId}/pay`, data)
  return res.data
}
