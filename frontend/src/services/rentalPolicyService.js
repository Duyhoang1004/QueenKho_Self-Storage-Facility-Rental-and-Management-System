import api from './api';

const base = '/rental-policies';

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
    lateFeeMaxPercent: 50,
    liquidationDays: 30,
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
