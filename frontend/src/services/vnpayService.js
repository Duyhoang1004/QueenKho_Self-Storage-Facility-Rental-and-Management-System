import axios from 'axios'
const base = 'http://localhost:8080/api/payments/vnpay'

const authConfig = () => {
  const token = sessionStorage.getItem('accessToken')
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {}
}

export const createVnpayPayment = async (reservationId) => (await axios.post(`${base}/create`, { reservationId }, authConfig())).data
export const createVnpayRenewal = async (contractId, months) => (await axios.post(`${base}/create-renewal`, { contractId, months }, authConfig())).data
export const getVnpayStatus = async (orderId) => (await axios.get(`${base}/status/${encodeURIComponent(orderId)}`, authConfig())).data
