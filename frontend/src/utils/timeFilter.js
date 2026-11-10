// (10/11/2026) Góp ý: các list (công việc, hợp đồng, đơn, giao dịch...) lọc + sắp theo thời gian.
// Giá trị ngày từ BE là chuỗi ISO: LocalDate 'yyyy-MM-dd' hoặc LocalDateTime 'yyyy-MM-ddTHH:mm:ss'
// → so sánh chuỗi trực tiếp là đúng thứ tự, 10 ký tự đầu là ngày.

// fields: [{ key, label, get: (item) => isoString }]
// filter: { field, order: 'default' | 'asc' | 'desc', from: 'yyyy-MM-dd' | '', to: 'yyyy-MM-dd' | '' }
// 'default' = giữ thứ tự BE trả về (vd. hàng đợi gán ô đã xếp theo ưu tiên)
export function makeTimeFilter(fields, order = 'asc') {
  return { field: fields[0].key, order, from: '', to: '' }
}

export function localToday() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function hasDateRange(filter) {
  return Boolean(filter?.from || filter?.to)
}

// pinFirst(item) (tuỳ chọn): phần tử true luôn nằm trên (vd. task khẩn PR-34)
export function applyTimeFilter(list, filter, fields, pinFirst) {
  const field = fields.find((f) => f.key === filter.field) || fields[0]
  const val = (item) => {
    const v = field.get(item)
    return v ? String(v) : ''
  }
  let out = list || []
  if (filter.from) out = out.filter((i) => { const v = val(i).slice(0, 10); return v && v >= filter.from })
  if (filter.to) out = out.filter((i) => { const v = val(i).slice(0, 10); return v && v <= filter.to })
  if (filter.order === 'default') return out
  const dir = filter.order === 'desc' ? -1 : 1
  return [...out].sort((a, b) => {
    if (pinFirst) {
      const pa = Boolean(pinFirst(a))
      const pb = Boolean(pinFirst(b))
      if (pa !== pb) return pa ? -1 : 1
    }
    const x = val(a)
    const y = val(b)
    if (!x && !y) return 0
    if (!x) return 1 // không có ngày → cuối danh sách
    if (!y) return -1
    return x < y ? -dir : x > y ? dir : 0
  })
}
