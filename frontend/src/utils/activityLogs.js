// UC-31: nhãn hiển thị cho nhật ký hoạt động (dùng ở /admin/logs và dashboard /admin)

// target_entity = tên bảng bị tác động → nhãn tiếng Việt. Bảng chưa có nhãn thì hiện nguyên tên bảng.
export const TARGET_ENTITY_LABELS = {
  users: 'Người dùng',
  roles: 'Vai trò',
  facilities: 'Cơ sở',
  unit_types: 'Loại kho',
  storage_units: 'Ô kho',
  rental_policy: 'Chính sách thuê',
  reservations: 'Đơn đặt chỗ',
  rental_contracts: 'Hợp đồng',
  facility_tasks: 'Công việc',
  support_requests: 'Yêu cầu hỗ trợ',
  payment_transactions: 'Giao dịch',
}

export function getTargetEntityLabel(entity) {
  if (!entity) return '—'
  return TARGET_ENTITY_LABELS[entity] || entity
}

// BE trả LocalDateTime không múi giờ, có thể tới 7 số lẻ ("2026-10-20T07:52:12.1903430")
// → tự tách chuỗi thay vì new Date() để không lệch giờ / lỗi parse.
export function formatLogTime(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/.exec(value || '')
  if (!match) return { date: '—', time: '' }
  const [, y, m, d, hh, mm, ss] = match
  return { date: `${d}/${m}/${y}`, time: `${hh}:${mm}:${ss}` }
}

// Ngày hôm nay theo giờ máy, dạng YYYY-MM-DD (giá trị của <input type="date">)
export function toInputDate(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
