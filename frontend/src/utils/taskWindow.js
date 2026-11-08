// PR-T1 (08/11/2026): task CHECK_IN / CHECK_OUT chỉ giao / nhận được trong vòng 30 ngày trước ngày hẹn.
// Backend trả assignableFrom (null = không giới hạn). Trả về "dd/MM/yyyy" nếu task còn bị khoá, ngược lại null.
export function assignLockedUntil(task) {
  if (!task?.assignableFrom) return null
  const opensAt = new Date(task.assignableFrom)
  if (Number.isNaN(opensAt.getTime()) || opensAt <= new Date()) return null
  const dd = String(opensAt.getDate()).padStart(2, '0')
  const mm = String(opensAt.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${opensAt.getFullYear()}`
}
