// D-22: "Bảng phí & hoàn tiền" bằng số tiền của chính đơn / hợp đồng (backend PolicySummaryService tính bằng đúng
// công thức thu / hoàn thật). summary: { sections: [{ key, title, subtitle, rows: [{ label, amount, note, tone, total }] }] }

function formatVND(v) {
  if (v == null) return null
  return Number(v).toLocaleString('vi-VN') + '₫'
}

const SECTION_STYLE = {
  BOOKING: 'border-[#84D8FF] bg-[#F5FBFF]',
  CANCEL: 'border-[#E5E5E5] bg-white',
  EARLY: 'border-[#D0F8AB] bg-[#F7FEF0]',
  ON_TIME: 'border-[#E5E5E5] bg-white',
  OVERDUE: 'border-[#FFD8A8] bg-[#FFF8EE]',
  REFUND: 'border-[#E5E5E5] bg-white',
}

export default function PolicySummary({ summary, loading, compact = false, sectionKeys }) {
  if (loading && !summary) {
    return <div className="text-xs font-bold text-[#AFAFAF] p-3">Đang tính bảng phí theo đơn của bạn...</div>
  }
  if (!summary) return null
  const sections = (summary.sections || []).filter((s) => !sectionKeys || sectionKeys.includes(s.key))

  return (
    <div className="flex flex-col gap-2.5">
      {!compact && (
        <p className="text-[11px] font-bold text-[#777777]">
          Giá niêm yết {formatVND(summary.monthlyPrice)}/tháng
          {summary.unitTypeName ? ` · ${summary.unitTypeName}` : ''}{summary.facilityName ? ` · ${summary.facilityName}` : ''}
          {summary.termsVersion ? ` · điều khoản ${summary.termsVersion}` : ''}
          {summary.policyVersion ? ` · chính sách phiên bản ${summary.policyVersion}` : ''}
        </p>
      )}
      {sections.map((sec) => (
        <div key={sec.key} className={`rounded-xl border-2 p-3 ${SECTION_STYLE[sec.key] || 'border-[#E5E5E5] bg-white'}`}>
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1.5">
            <span className="text-xs font-black text-[#4B4B4B]">{sec.title}</span>
            {sec.subtitle && <span className="text-[10px] font-bold text-[#AFAFAF] uppercase">{sec.subtitle}</span>}
          </div>
          <div className="flex flex-col">
            {sec.rows.map((r, i) => (
              <div key={i} className={`flex justify-between gap-3 py-1 ${r.total ? 'border-t border-[#E5E5E5] mt-1 pt-1.5' : ''}`}>
                <div className="flex flex-col min-w-0">
                  <span className={`text-xs ${r.total ? 'font-black text-[#4B4B4B]' : 'font-bold text-[#4B4B4B]'}`}>{r.label}</span>
                  {r.note && <span className="text-[11px] font-semibold text-[#777777] leading-snug whitespace-pre-line">{r.note}</span>}
                </div>
                {r.amount != null && (
                  <span className={`text-xs font-black whitespace-nowrap ${
                    r.total ? 'text-[#1899D6] text-sm' : r.tone === 'REFUND' ? 'text-[#58A700]' : r.tone === 'KEEP' ? 'text-[#FF4B4B]' : 'text-[#4B4B4B]'}`}>
                    {formatVND(r.amount)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
