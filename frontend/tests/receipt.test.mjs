import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { printReservationReceipt } from '../src/utils/receipt.js'

const originalWindow = globalThis.window
afterEach(() => { globalThis.window = originalWindow })

function receipt(overrides = {}) {
  let html = ''
  let closed = false
  globalThis.window = {
    open: () => ({ document: {
      open() {}, write(value) { html = value }, close() { closed = true },
    } }),
  }
  const input = {
    reservationCode: 'RES-TEST', transactionCode: 'QKD-TEST',
    customerName: 'Test customer', customerEmail: 'test@example.invalid',
    startDate: '2026-11-10', durationMonths: 3,
    rentAmount: 2850000, depositAmount: 1000000,
    insuranceAmount: 150000, insurancePlanLabel: 'Nâng cao',
    voucherCode: 'TEST', voucherDiscount: 100000, totalPaid: 3900000,
    ...overrides,
  }
  assert.equal(printReservationReceipt(input), true)
  assert.equal(closed, true)
  return html
}

test('receipt retains original transaction and reservation references', () => {
  const html = receipt()
  assert.match(html, /RES-TEST/)
  assert.match(html, /QKD-TEST/)
})

test('paid insurance has its own line rather than being hidden in rent', () => {
  const html = receipt()
  assert.match(html, /Bảo hiểm hàng hoá Nâng cao/)
  assert.ok(html.includes((150000).toLocaleString('vi-VN') + 'đ'))
  assert.ok(html.includes((2850000).toLocaleString('vi-VN') + 'đ'))
})

test('basic plan does not invent an insurance charge', () => {
  assert.doesNotMatch(receipt({ insuranceAmount: 0 }), /Bảo hiểm hàng hoá/)
})

test('no voucher means no invented voucher discount', () => {
  assert.doesNotMatch(receipt({ voucherDiscount: 0 }), /Voucher TEST/)
})

test('total paid is the actual collected amount, not recomputed from current prices', () => {
  const html = receipt({ totalPaid: 1234567 })
  assert.ok(html.includes((1234567).toLocaleString('vi-VN') + 'đ'))
})

for (const field of ['customerName', 'customerEmail', 'reservationCode', 'unitTypeName', 'facilityAddress']) {
  test(`untrusted ${field} cannot inject HTML into printable evidence`, () => {
    const html = receipt({ [field]: '<img src=x onerror="alert(1)">' })
    assert.doesNotMatch(html, /<img src=x/)
    assert.match(html, /&lt;img src=x/)
  })
}

test('blocked popup returns false so UI can explain how to print', () => {
  globalThis.window = { open: () => null }
  assert.equal(printReservationReceipt({}), false)
})

test('missing optional contact and payment data does not crash receipt rendering', () => {
  assert.match(receipt({ paidAt: null, facilityHotline: null, bankTransactionCode: null }), /Phiếu biên nhận/)
})
