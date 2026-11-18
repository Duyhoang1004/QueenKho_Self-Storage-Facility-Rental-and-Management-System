import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseRefundNote } from '../src/utils/refundParser.js'

test('No-Show refund keeps the deposit and one month rent', () => {
  const note = '[HOÀN TIỀN NO-SHOW] Đơn: RES-410465 | Khách: Nhiêu Sĩ Luân (SĐT: 0989702203) | Số tiền hoàn: 1358333.00 VND (Giữ cọc + 1 tháng tiền thuê: 1429167.00 VND, hoàn tiền thuê các tháng còn lại) | Lý do No-Show: Khách không liên lạc được'
  const parsed = parseRefundNote(note)

  assert.equal(parsed.isNoShow, true)
  assert.equal(parsed.isFull100, false)
  assert.equal(parsed.refundAmountNum, 1358333)
  assert.equal(parsed.noShowKeptAmountNum, 1429167)
  assert.equal(parsed.originalTotalNum, 2787500)
  assert.equal(parsed.reason, 'Khách không liên lạc được')
})
