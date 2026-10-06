import axios from 'axios'
const base = 'http://localhost:8080/api/payments/vnpay'
export const createVnpayPayment = async (reservationId) => (await axios.post(`${base}/create`, { reservationId })).data
export const createVnpayRenewal = async (contractId, months) => (await axios.post(`${base}/create-renewal`, { contractId, months })).data
export const getVnpayStatus = async (orderId) => (await axios.get(`${base}/status/${encodeURIComponent(orderId)}`)).data
