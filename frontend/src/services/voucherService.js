import api from './api'

// BR-25: khách kiểm tra voucher cho đơn sắp đặt. code trống = mã mặc định (NEWKHO)
// → { voucherId, code, name, discountAmount, rentAmount } (voucherId null = không có mã nào áp được)
export async function validateVoucher({ code, facilityId, unitTypeId, months }) {
  const res = await api.get('/vouchers/validate', { params: { code: code || undefined, facilityId, unitTypeId, months } })
  return res.data
}

// BR-25: BOM quản lý voucher
export async function getBomVouchers() {
  const res = await api.get('/bom/vouchers')
  return res.data
}

export async function createBomVoucher(payload) {
  const res = await api.post('/bom/vouchers', payload)
  return res.data
}

export async function updateBomVoucher(id, payload) {
  const res = await api.put(`/bom/vouchers/${id}`, payload)
  return res.data
}

export async function setBomVoucherStatus(id, status) {
  const res = await api.patch(`/bom/vouchers/${id}/status`, { status })
  return res.data
}
