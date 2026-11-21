import api, { API_ORIGIN } from './api'

// Đi qua cùng instance `api` (gắn token + tự xử lý 401). VNPAY nằm ở /api/payments (ngoài /api/v1)
// nên đổi baseURL theo từng request. Không dùng URL tuyệt đối: bản Docker có VITE_API_URL rỗng → API_ORIGIN = ''
// → đường dẫn tương đối bị nối vào baseURL thành /api/v1/api/payments/... (403 API_NOT_DECLARED).
const cfg = { baseURL: `${API_ORIGIN}/api/payments/vnpay` }

export const createVnpayPayment = async (reservationId) => (await api.post('/create', { reservationId }, cfg)).data
export const createVnpayRenewal = async (contractId, months) => (await api.post('/create-renewal', { contractId, months }, cfg)).data
// UC-20: trả khoản nợ phí sự cố (DAMAGE_FEE) còn chờ thanh toán
export const createVnpayDebt = async (paymentId) => (await api.post('/create-debt', { paymentId }, cfg)).data
export const getVnpayStatus = async (orderId) => (await api.get(`/status/${encodeURIComponent(orderId)}`, cfg)).data
