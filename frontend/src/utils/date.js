// (12/11/2026, góp ý test product) Thống nhất ngày tháng toàn hệ thống: dd/MM/yyyy (giờ: HH:mm dd/MM/yyyy).
// toLocaleDateString('vi-VN') ra "5/11/2026" (không đủ 2 chữ số) → không dùng cho hiển thị nữa.

const pad = (n) => String(n).padStart(2, '0')

// Chuỗi 'yyyy-MM-dd' (LocalDate) giữ nguyên ngày, không qua múi giờ; còn lại parse như Date
function toDate(value) {
  if (value instanceof Date) return value
  const s = String(value)
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return new Date(s)
}

export function formatDateVN(value, empty = '—') {
  if (!value) return empty
  const d = toDate(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

export function formatDateTimeVN(value, empty = '—') {
  if (!value) return empty
  const d = toDate(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

// 'yyyy-MM-dd' → 'dd/MM/yyyy' (rỗng nếu không có) — dùng cho ô chọn ngày
export function formatIsoDate(iso) {
  if (!iso) return ''
  const [y, m, d] = String(iso).slice(0, 10).split('-')
  return y && m && d ? `${d}/${m}/${y}` : String(iso)
}
