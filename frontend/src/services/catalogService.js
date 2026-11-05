import api from './api'

// BR-131 (05/11/2026): danh mục loại hàng khách khai báo khi đặt kho
export async function getGoodsCategories() {
  const res = await api.get('/goods-categories')
  return res.data
}

export async function getBomGoodsCategories() {
  const res = await api.get('/bom/goods-categories')
  return res.data
}

export async function saveBomGoodsCategory(id, payload) {
  const res = id ? await api.put(`/bom/goods-categories/${id}`, payload) : await api.post('/bom/goods-categories', payload)
  return res.data
}

export async function setBomGoodsCategoryStatus(id, status) {
  const res = await api.patch(`/bom/goods-categories/${id}/status`, { status })
  return res.data
}

// BR-134 (05/11/2026): kho tổng giữ hàng của khách quá hạn / không tới nhận
export async function getCentralWarehouses() {
  const res = await api.get('/central-warehouses')
  return res.data
}

export async function getBomCentralWarehouses() {
  const res = await api.get('/bom/central-warehouses')
  return res.data
}

export async function saveBomCentralWarehouse(id, payload) {
  const res = id ? await api.put(`/bom/central-warehouses/${id}`, payload) : await api.post('/bom/central-warehouses', payload)
  return res.data
}

export async function setBomCentralWarehouseStatus(id, status) {
  const res = await api.patch(`/bom/central-warehouses/${id}/status`, { status })
  return res.data
}

export const TEMPERATURE_LABELS = { NORMAL: 'Kho thường', COLD: 'Kho lạnh', FROZEN: 'Kho đông' }
