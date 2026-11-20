import api from './api'

// D-22: "Bảng phí & hoàn tiền" bằng số tiền của chính đơn / hợp đồng

// Đơn mới (trang đặt kho): theo chính sách đang hiệu lực của cơ sở
export async function getQuotePolicySummary(facilityId, { unitTypeId, months, insurancePlan, voucherDiscount }) {
  const res = await api.get(`/facilities/${facilityId}/policy-summary`, {
    params: { unitTypeId, months, insurancePlan, voucherDiscount: voucherDiscount || undefined },
  })
  return res.data
}

// Hợp đồng đã ký: chính sách đã chốt lúc đặt
export async function getContractPolicySummary(contractId) {
  const res = await api.get(`/contracts/${contractId}/policy-summary`)
  return res.data
}
