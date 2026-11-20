import { useEffect, useState } from 'react'
import { getContractPolicySummary } from '../services/policySummaryService'
import PolicySummary from './PolicySummary'

// D-22: "Chính sách áp dụng cho hợp đồng này" — các mức phí đã chốt lúc đặt (PR-M5), hiện bằng số tiền
function formatDate(val) {
  if (!val) return ''
  const d = new Date(val)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

export default function ContractPolicyPanel({ contractId, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || summary || !contractId) return undefined
    let cancelled = false
    getContractPolicySummary(contractId)
      .then((data) => { if (!cancelled) setSummary(data) })
      .catch((err) => { if (!cancelled) setError(err.response?.data?.message || 'Không tải được chính sách của hợp đồng.') })
    return () => { cancelled = true }
  }, [open, summary, contractId])

  return (
    <div className="bg-white border-2 border-[#E5E5E5] rounded-2xl p-5 flex flex-col gap-3">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex items-center justify-between gap-2 cursor-pointer text-left">
        <span className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[22px] text-[#FFC800]">gavel</span>
          <span className="flex flex-col">
            <span className="text-sm font-black uppercase tracking-wide text-[#4B4B4B]">Chính sách áp dụng cho hợp đồng này</span>
            <span className="text-[11px] font-bold text-[#AFAFAF]">
              Bảng phí & hoàn tiền bằng số của hợp đồng{summary?.policyFrozenAt ? ` · chốt ngày ${formatDate(summary.policyFrozenAt)}` : ''}
            </span>
          </span>
        </span>
        <span className="material-symbols-outlined text-[22px] text-[#AFAFAF]">{open ? 'expand_less' : 'expand_more'}</span>
      </button>
      {open && (error
        ? <p className="text-xs font-bold text-[#FF4B4B]">{error}</p>
        : <PolicySummary summary={summary} loading={!summary} />)}
    </div>
  )
}
