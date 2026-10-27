import api from './api';

const base = '/rental-policies';

function optionalNumber(value) {
  return value === undefined || value === null || value === '' ? null : Number(value);
}

export async function getRentalPolicies() {
  const response = await api.get(base);
  return response.data;
}

export async function getRentalPolicyHistory(facilityId) {
  const response = await api.get(`${base}/facilities/${facilityId}/history`);
  return response.data;
}

export async function createRentalPolicyVersion(facilityId, values) {
  const response = await api.post(`${base}/facilities/${facilityId}`, {
    depositMonthMultiplier: Number(values.depositMonthMultiplier),
    cancelFeePercent: Number(values.cancelFeePercent),
    cancelFreeHours: Number(values.cancelFreeHours),
    lateFeePercentPerDay: Number(values.lateFeePercentPerDay),
    // Flow 4: ưu đãi theo gói + quyền miễn phí trễ (bỏ trống → backend kế thừa bản đang hiệu lực)
    bookingDiscount3m: optionalNumber(values.bookingDiscount3m),
    bookingDiscount6m: optionalNumber(values.bookingDiscount6m),
    bookingDiscount12m: optionalNumber(values.bookingDiscount12m),
    renewalDiscount3m: optionalNumber(values.renewalDiscount3m),
    renewalDiscount6m: optionalNumber(values.renewalDiscount6m),
    renewalDiscount12m: optionalNumber(values.renewalDiscount12m),
    allowLateFeeWaiver: values.allowLateFeeWaiver,
    // PR-Q14 / PR-Q15: % phí chiếm dụng khi quá hạn + % phí lưu giữ hàng sau thanh lý
    overstayPercent: optionalNumber(values.overstayPercent),
    heldGoodsFeePercent: optionalNumber(values.heldGoodsFeePercent),
  });
  return response.data;
}

export async function activateRentalPolicyVersion(policy) {
  const response = await api.post(`${base}/facilities/${policy.facilityId}/activate/${policy.id}`);
  return response.data;
}

export function rentalPolicyError(error) {
  return error?.response?.data?.message || error?.response?.data?.detail || 'Không thể kết nối máy chủ. Vui lòng thử lại.';
}
