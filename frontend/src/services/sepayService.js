import axios from 'axios'

export async function createSepayPayment(reservationId) {
  const response = await axios.post(
    'http://localhost:8080/api/payments/sepay-pg/create',
    { reservationId },
  )
  return response.data
}

export async function confirmPaymentAfterCheckout(reservationId, amount, reservationCode) {
  const res = await axios.post(
    'http://localhost:8080/api/payments/sepay-pg/confirm-dev',
    { reservationId }
  )
  return res.data
}

export async function createSepayRenewalPayment(contractId, months) {
  const response = await axios.post(
    'http://localhost:8080/api/payments/sepay-pg/create-renewal',
    { contractId, months }
  )
  return response.data
}

export async function confirmSepayRenewalPayment(contractId, months, transactionCode) {
  const response = await axios.post(
    'http://localhost:8080/api/payments/sepay-pg/confirm-renewal',
    { contractId, months, transactionCode }
  )
  return response.data
}

