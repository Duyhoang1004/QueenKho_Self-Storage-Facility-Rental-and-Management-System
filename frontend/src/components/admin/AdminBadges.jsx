import { ROLE_STYLES, getRoleLabel } from '../../utils/roles'

// UC-31: badge dùng chung cho trang nhật ký và dashboard Admin

export function RoleBadge({ role }) {
  const style = ROLE_STYLES[role] || ROLE_STYLES.CUSTOMER
  return (
    <span className={`duo-badge border-2 gap-1 whitespace-nowrap ${style.bg} ${style.border} ${style.text}`}>
      <span className="material-symbols-outlined text-[14px]">{style.icon}</span>
      {getRoleLabel(role)}
    </span>
  )
}

// Tài khoản system (PR-A8) — job tự động, không phải người
export function SystemBadge() {
  return (
    <span className="duo-badge border-2 gap-1 whitespace-nowrap bg-[#F7F7F7] border-[#E5E5E5] text-[#777777]">
      <span className="material-symbols-outlined text-[14px]">smart_toy</span>
      Tự động
    </span>
  )
}

// Mã nghiệp vụ tách từ "[CHECK_IN] ..." (PR-A10). Log cũ chưa có mã → gạch ngang.
export function ActionCodeBadge({ code }) {
  if (!code) return <span className="text-[#E5E5E5] font-black">—</span>
  return (
    <span className="inline-block rounded-lg border-2 border-[#84D8FF] bg-[#DDF4FF] px-2 py-0.5 font-mono text-[11px] font-bold text-[#1899D6] whitespace-nowrap">
      {code}
    </span>
  )
}
