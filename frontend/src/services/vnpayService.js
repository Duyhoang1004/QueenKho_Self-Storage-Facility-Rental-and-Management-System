import api, { API_ORIGIN } from './api'

// Đi qua cùng instance `api` (gắn token + tự xử lý 401); URL tuyệt đối nên baseURL /api/v1 bị bỏ qua
const base = `${API_ORIGIN}/api/payments/vnpay`

export const createVnpayPayment = async (reservationId) => (await api.post(`${base}/create`, { reservationId })).data
export const createVnpayRenewal = async (contractId, months) => (await api.post(`${base}/create-renewal`, { contractId, months })).data
// UC-20: trả khoản nợ phí sự cố (DAMAGE_FEE) còn chờ thanh toán
export const createVnpayDebt = async (paymentId) => (await api.post(`${base}/create-debt`, { paymentId })).data
export const getVnpayStatus = async (orderId) => (await api.get(`${base}/status/${encodeURIComponent(orderId)}`)).data
