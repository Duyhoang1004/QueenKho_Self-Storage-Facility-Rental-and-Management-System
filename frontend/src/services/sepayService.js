import axios from 'axios'

export async function createSepayPayment(reservationId) {
  const response = await axios.post(
    'http://localhost:8080/api/payments/sepay-pg/create',
    { reservationId },
  )
  return response.data
}

export async function confirmPaymentAfterCheckout(reservationId, amount) {
  try {
    const res = await axios.post(
      'http://localhost:8080/api/payments/sepay-pg/confirm-dev',
      { reservationId }
    )
    return res.data
  } catch (err) {
    if (err.response?.status === 404) {
      // Fallback: g?i tr?c ti?p /ipn v?i webhook format n?u backend chua n?p endpoint m?i
      const invoiceNumber = `QK-RSV-${reservationId}-${Date.now()}`
      const amountStr = String(Math.round(amount || 0))
      const res = await axios.post(
        'http://localhost:8080/api/payments/sepay-pg/ipn',
        {
          notification_type: 'ORDER_PAID',
          order: {
            order_status: 'CAPTURED',
            order_currency: 'VND',
            order_invoice_number: invoiceNumber,
            order_amount: amountStr,
          },
          transaction: {
            transaction_status: 'APPROVED',
            transaction_type: 'PAYMENT',
            transaction_currency: 'VND',
            transaction_amount: amountStr,
            transaction_id: `FE-TXN-${reservationId}-${Date.now()}`,
            payment_method: 'VIETQR',
          },
        },
        {
          headers: {
            'X-Secret-Key': 'spsk_test_n1bw2dzDmSA2r7pDKrcVC35zLQPj7uFV',
          },
        }
      )
      return res.data
    }
    throw err
  }
}

