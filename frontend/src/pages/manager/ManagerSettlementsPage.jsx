import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getSettlements } from '../../services/settlementService'
import SettlementPanel from '../../components/SettlementPanel'
import { SETTLEMENT_STATUS } from '../../utils/settlementStatus'

// D-21 (PR-O19 → PR-O23): FM theo dõi quyết toán trả kho của cơ sở và xử lý khi khách không đồng ý
const TABS = [
  { key: 'ACTION', label: 'Cần quản lý xử lý', icon: 'report', hint: 'Khách không đồng ý · chờ chốt hồ sơ bồi thường' },
  { key: 'CUSTOMER', label: 'Chờ khách', icon: 'how_to_reg', hint: 'Chờ khách xác nhận · đang kiểm tra lại' },
  { key: 'PAYMENT', label: 'Chờ thanh toán', icon: 'payments', hint: 'Khách đã đồng ý, chưa trả phần âm' },
  // D-23 / PR-O29: khách đã xác nhận, quyết toán chưa xong cho tới khi khách nhận được tiền
  { key: 'REFUND', label: 'Chờ hoàn tiền', icon: 'currency_exchange', hint: 'Chờ quản lý chi tiền · chờ khách xác nhận đã nhận' },
  { key: 'DONE', label: 'Đã tất toán', icon: 'task_alt', hint: 'Hợp đồng đã kết thúc' },
]

function formatVND(v) {
  if (v == null) return '—'
  return Math.abs(Number(v)).toLocaleString('vi-VN') + '₫'
}

export default function ManagerSettlementsPage() {
  const [params, setParams] = useSearchParams()
  const highlight = Number(params.get('highlight')) || null
  const [tab, setTab] = useState(params.get('tab') || 'ACTION')
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)

  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    getSettlements(highlight ? 'ALL' : tab)
      .then((data) => {
        if (cancelled) return
        const rows = data || []
        setList(highlight ? rows.filter((r) => r.id === highlight) : rows)
        setError('')
        if (highlight && rows.some((r) => r.id === highlight)) {
          setSelected(rows.find((r) => r.id === highlight).contractId)
        }
      })
      .catch((err) => { if (!cancelled) setError(err.response?.data?.message || 'Không tải được danh sách quyết toán.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [tab, highlight, reloadKey])

  const load = () => setReloadKey((k) => k + 1)

  const switchTab = (key) => {
    setLoading(true)
    setTab(key)
    setSelected(null)
    setParams({ tab: key })
  }

  return (
    <div className="flex flex-col gap-5 max-w-[1240px] mx-auto">
      <div>
        <h1 className="text-2xl font-black text-[#4B4B4B]">Quyết toán trả kho</h1>
        <p className="text-sm font-bold text-[#AFAFAF]">
          Nghiệm thu xong, hợp đồng chỉ kết thúc khi khách xác nhận quyết toán (D-21). Khách không đồng ý → sửa số tiền, giữ nguyên hoặc giao nhân viên kiểm tra lại.
        </p>
      </div>

      {!highlight && (
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button key={t.key} type="button" onClick={() => switchTab(t.key)} title={t.hint}
              className={`px-4 py-2.5 rounded-2xl border-2 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer ${
                tab === t.key ? 'bg-[#DDF4FF] border-[#1CB0F6] text-[#1899D6]' : 'bg-white border-[#E5E5E5] text-[#777777] hover:bg-[#F7F7F7]'}`}>
              <span className="material-symbols-outlined text-[18px]">{t.icon}</span>{t.label}
            </button>
          ))}
        </div>
      )}
      {highlight && (
        <button type="button" onClick={() => setParams({})} className="duo-btn-gray px-4 py-2 text-xs self-start cursor-pointer">← Xem tất cả quyết toán</button>
      )}

      {error && <div className="bg-[#FFF2F2] border-2 border-[#FFB8B8] rounded-2xl p-4 text-sm font-bold text-[#FF4B4B]">{error}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-[340px_minmax(0,1fr)] gap-5 items-start">
        <div className="flex flex-col gap-2">
          {loading ? (
            <div className="duo-card p-5 text-sm font-bold text-[#AFAFAF]">Đang tải...</div>
          ) : list.length === 0 ? (
            <div className="duo-card p-5 text-sm font-bold text-[#AFAFAF]">Không có quyết toán nào ở mục này.</div>
          ) : list.map((s) => {
            const st = SETTLEMENT_STATUS[s.status] || {}
            const pays = Number(s.netAmount) < 0
            return (
              <button key={s.id} type="button" onClick={() => setSelected(s.contractId)}
                className={`text-left bg-white border-2 rounded-2xl p-4 flex flex-col gap-1.5 cursor-pointer transition-colors ${
                  selected === s.contractId ? 'border-[#1CB0F6] bg-[#F5FBFF]' : 'border-[#E5E5E5] hover:bg-[#F7F7F7]'}`}>
                <div className="flex justify-between gap-2">
                  <span className="text-sm font-black text-[#4B4B4B] font-mono">{s.contractCode}</span>
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg border ${st.cls || ''}`}>{st.label || s.status}</span>
                </div>
                <span className="text-xs font-bold text-[#777777]">{s.customerName} · ô {s.unitId || '—'} · vòng {s.roundNo}</span>
                <span className={`text-sm font-black ${pays ? 'text-[#FF4B4B]' : 'text-[#58A700]'}`}>
                  {pays ? 'Khách trả thêm ' : 'Hoàn khách '}{formatVND(s.netAmount)}
                </span>
                {s.disputeReason && s.status === 'DISPUTED' && (
                  <span className="text-[11px] font-bold text-[#FF4B4B] line-clamp-2">“{s.disputeReason}”</span>
                )}
              </button>
            )
          })}
        </div>

        <div>
          {selected ? (
            <SettlementPanel key={selected} contractId={selected} viewer="FACILITY_MANAGER" highlight onChanged={() => load()} />
          ) : (
            <div className="duo-card p-8 text-center text-sm font-bold text-[#AFAFAF]">Chọn một quyết toán để xem chi tiết.</div>
          )}
        </div>
      </div>
    </div>
  )
}
