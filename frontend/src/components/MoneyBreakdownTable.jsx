// D-22: bảng "Bạn đã đóng − Cơ sở giữ lại (+ Bồi thường) = Hoàn" — dùng chung cho màn hẹn trả kho và bảng quyết toán.
// lines: [{ group: PAID | KEPT | ADDED, label, amount, note }] do backend tính (RefundBreakdown) → số luôn khớp tiền thu / hoàn thật.

function formatVND(v) {
  if (v == null) return '—'
  return Number(v).toLocaleString('vi-VN') + '₫'
}

const GROUPS = [
  { key: 'PAID', title: 'A. Bạn đã đóng', sign: '', cls: 'text-[#4B4B4B]' },
  { key: 'KEPT', title: 'B. Cơ sở giữ lại', sign: '−', cls: 'text-[#FF4B4B]' },
  { key: 'ADDED', title: 'C. Cơ sở trả thêm', sign: '+', cls: 'text-[#58A700]' },
]

export default function MoneyBreakdownTable({ lines, viewer = 'CUSTOMER', estimate = false }) {
  if (!lines || lines.length === 0) return null
  const sum = (g) => lines.filter((l) => l.group === g).reduce((s, l) => s + Number(l.amount || 0), 0)
  const paid = sum('PAID')
  const kept = sum('KEPT')
  const added = sum('ADDED')
  const hasPaid = lines.some((l) => l.group === 'PAID')
  const hasKept = lines.some((l) => l.group === 'KEPT')
  const hasAdded = lines.some((l) => l.group === 'ADDED')
  const net = paid - kept + added
  const pays = net < 0
  const you = viewer === 'CUSTOMER'
  const formulaLabel = (() => {
    const parts = []
    if (hasPaid) parts.push('A')
    if (hasKept) parts.push('− B')
    if (hasAdded) parts.push('+ C')
    if (parts.length <= 1) {
      return hasPaid
        ? (you ? 'Hoàn 100% khoản bạn đã đóng (không phát sinh khấu trừ)' : 'Hoàn 100% khoản khách đã đóng (không phát sinh khấu trừ)')
        : ''
    }
    return `= ${parts.join(' ')}`
  })()

  return (
    <div className="border-2 border-[#E5E5E5] rounded-xl overflow-hidden bg-white">
      {GROUPS.map((g) => {
        const rows = lines.filter((l) => l.group === g.key)
        if (rows.length === 0) return null
        const total = sum(g.key)
        return (
          <div key={g.key} className="px-4 py-2.5 border-b border-[#F0F0F0]">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#777777]">
                {g.key === 'PAID' && !you ? 'A. Khách đã đóng' : g.title}
              </span>
              <span className={`text-sm font-black ${g.cls}`}>{g.sign}{formatVND(total)}</span>
            </div>
            {rows.map((l, i) => {
              const negative = Number(l.amount) < 0
              return (
                <div key={i} className="flex justify-between gap-3 py-1 pl-3">
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-[#4B4B4B]">{l.label}</span>
                    {l.note && <span className="text-[11px] font-semibold text-[#AFAFAF]">{l.note}</span>}
                  </div>
                  <span className={`text-xs font-black whitespace-nowrap ${negative ? 'text-[#58A700]' : 'text-[#777777]'}`}>
                    {negative ? '−' + formatVND(Math.abs(Number(l.amount))) : formatVND(l.amount)}
                  </span>
                </div>
              )
            })}
          </div>
        )
      })}
      <div className={`px-4 py-3 flex justify-between items-center ${pays ? 'bg-[#FFF2F2]' : 'bg-[#F3FEE7]'}`}>
        <div className="flex flex-col">
          <span className="text-xs font-black uppercase text-[#4B4B4B]">
            {pays
              ? (you ? 'Bạn cần trả thêm' : 'Khách cần trả thêm')
              : (you ? (estimate ? 'Dự kiến hoàn cho bạn' : 'Cơ sở hoàn cho bạn') : (estimate ? 'Dự kiến hoàn khách' : 'Cơ sở hoàn khách'))}
          </span>
          {formulaLabel && <span className="text-[10px] font-bold text-[#777777]">{formulaLabel}</span>}
        </div>
        <span className={`text-xl font-black ${pays ? 'text-[#FF4B4B]' : 'text-[#58A700]'}`}>{formatVND(Math.abs(net))}</span>
      </div>
    </div>
  )
}
