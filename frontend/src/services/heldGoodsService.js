import api from './api'

// PR-Q10: hàng của khách lưu giữ sau thanh lý (FM) — cơ sở lấy theo token
// scope: 'HOLDING' (đang lưu giữ) | 'RESOLVED' (đã xử lý)
export async function getHeldGoods(scope = 'HOLDING') {
  const res = await api.get('/held-goods', { params: { scope } })
  return res.data
}

// payload: { outcome: 'RETURNED' | 'SOLD' | 'DESTROYED' | 'HANDED_TO_AUTHORITY', note, proceedsAmount? }
export async function resolveHeldGoods(id, payload) {
  const res = await api.post(`/held-goods/${id}/resolve`, payload)
  return res.data
}
