import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getMyPayments } from '../../services/paymentService'
import { createVnpayDebt } from '../../services/vnpayService'

// UC-20 (PR-50): khách xem MỌI giao dịch của mình và trả các khoản còn nợ.
//  - Phí sự cố / phí chiếm dụng vượt cọc (DAMAGE_FEE / OVERSTAY_FEE) → trả ngay qua VNPAY tại đây; trả xong được đặt kho mới.
//  - Hợp đồng quá hạn → trả bằng cách gia hạn ở trang hợp đồng (tiền thuê + phí trễ).

const TYPE_LABELS = {
  DEPOSIT: { label: 'Đặt cọc + tiền thuê', icon: 'savings' },
  MONTHLY_RENT: { label: 'Gia hạn thuê', icon: 'event_repeat' },
  LATE_FEE: { label: 'Phí trễ hạn', icon: 'timer_off' },
  DAMAGE_FEE: { label: 'Phí sự cố', icon: 'construction' },
  OVERSTAY_FEE: { label: 'Phí chiếm dụng / lưu giữ', icon: 'door_front' }, // PR-Q14 / PR-Q15
  REFUND: { label: 'Hoàn tiền', icon: 'currency_exchange' },
}

const METHOD_LABELS = {
  VNPAY: 'VNPAY',
  BANK_TRANSFER: 'Chuyển khoản',
  CASH: 'Tiền mặt',
  DEPOSIT_OFFSET: 'Trừ vào tiền cọc',
}

const STATUS_STYLES = {
  SUCCESS: { label: 'Thành công', className: 'bg-[#D7FFB8] text-[#58A700] border-[#58CC02]' },
  PENDING: { label: 'Đang chờ', className: 'bg-[#FFF3B3] text-[#B38F00] border-[#FFC800]' },
  FAILED: { label: 'Thất bại', className: 'bg-[#F7F7F7] text-[#AFAFAF] border-[#E5E5E5]' },
  REFUNDED: { label: 'Đã hoàn', className: 'bg-[#DDF4FF] text-[#1899D6] border-[#84D8FF]' },
}

function formatVND(value) {
  return `${Number(value || 0).toLocaleString('vi-VN')}đ`
}

function formatTime(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })
}

function SummaryTile({ icon, label, value, tone, hint }) {
  return (
    <div className={`duo-card p-4 flex items-center gap-3 border-2 ${tone}`}>
      <span className="material-symbols-outlined text-[28px]">{icon}</span>
      <div className="flex flex-col min-w-0">
        <span className="text-[11px] font-black uppercase tracking-wider opacity-80">{label}</span>
        <span className="text-xl font-black">{formatVND(value)}</span>
        {hint && <span className="text-[11px] font-bold opacity-70">{hint}</span>}
      </div>
    </div>
  )
}

export default function CustomerPaymentsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [reloadTick, setReloadTick] = useState(0)
  // result.tick = lần tải đã xong; khác reloadTick → đang tải
  const [result, setResult] = useState({ tick: -1, data: null, error: '' })
  const state = { loading: result.tick !== reloadTick, data: result.data, error: result.error }
  const [payingId, setPayingId] = useState(null)
  const [payError, setPayError] = useState('')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [showFailed, setShowFailed] = useState(false)

  // Kết quả trả về từ VNPAY (/thanh-toan?orderId=...&vnpResponse=00)
  const vnpResponse = searchParams.get('vnpResponse')
  const returnNotice = vnpResponse == null ? null
    : vnpResponse === '00'
      ? { ok: true, text: 'Thanh toán phí sự cố thành công. Bạn đã có thể đặt kho mới.' }
      : { ok: false, text: 'Thanh toán chưa thành công, khoản nợ vẫn giữ nguyên. Bạn có thể thử lại.' }

  const load = useCallback(() => setReloadTick((t) => t + 1), [])

  useEffect(() => {
    let cancelled = false
    getMyPayments()
      .then((data) => { if (!cancelled) setResult({ tick: reloadTick, data, error: '' }) })
      .catch((err) => {
        if (!cancelled) setResult({ tick: reloadTick, data: null, error: err.response?.data?.message || 'Không tải được lịch sử thanh toán.' })
      })
    return () => { cancelled = true }
  }, [reloadTick])

  const handlePayDebt = async (debt) => {
    setPayingId(debt.id)
    setPayError('')
    try {
      const payment = await createVnpayDebt(debt.id)
      window.location.assign(payment.payUrl)
    } catch (err) {
      setPayError(err.response?.data?.message || 'Không tạo được link thanh toán, vui lòng thử lại.')
      setPayingId(null)
    }
  }

  const transactions = useMemo(() => {
    const all = state.data?.transactions || []
    return all
      .filter((t) => showFailed || t.status !== 'FAILED')
      .filter((t) => typeFilter === 'ALL' || t.paymentType === typeFilter)
  }, [state.data, typeFilter, showFailed])

  const summary = state.data?.summary
  const debts = state.data?.debts || []
  const overdue = state.data?.overdueContracts || []

  return (
    <div className="max-w-[1200px] mx-auto px-6 md:px-8 py-8 flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b-2 border-[#E5E5E5]">
        <div>
          <div className="flex items-center gap-2.5">
            
            <h1 className="text-2xl md:text-3xl font-black text-[#4B4B4B] tracking-tight">Thanh toán</h1>
          </div>
          <p className="text-xs font-bold text-[#777777] mt-1">
            Toàn bộ khoản đã trả, khoản được hoàn và khoản còn cần thanh toán của bạn.
          </p>
        </div>
        <button onClick={load} className="duo-btn-white px-4 py-2.5 text-xs gap-1 self-start">
          <span className="material-symbols-outlined text-[16px]">refresh</span>
          Làm mới
        </button>
      </div>

      {returnNotice && (
        <div className={`duo-card p-4 flex items-center gap-3 border-2 ${returnNotice.ok ? 'border-[#58CC02] bg-[#F1FFE7] text-[#58A700]' : 'border-[#FF9600] bg-[#FFF8EE] text-[#E58800]'}`}>
          <span className="material-symbols-outlined text-[24px]">{returnNotice.ok ? 'check_circle' : 'error'}</span>
          <span className="flex-1 text-sm font-black">{returnNotice.text}</span>
          <button onClick={() => setSearchParams({}, { replace: true })} className="text-xs font-black underline">Đóng</button>
        </div>
      )}

      {state.error && (
        <div className="duo-card border-[#FFDFDF] bg-[#FFF5F5] p-6 flex items-center gap-4">
          <span className="material-symbols-outlined text-[32px] text-[#FF4B4B]">cloud_off</span>
          <span className="flex-1 text-sm font-black text-[#FF4B4B]">{state.error}</span>
          <button onClick={load} className="duo-btn-white px-4 py-2 text-xs">Thử lại</button>
        </div>
      )}

      {state.loading && !state.data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="duo-card h-[92px] animate-pulse bg-[#F7F7F7]" />)}
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryTile icon="payments" label="Đã thanh toán" value={summary.totalPaid}
            tone="border-[#84D8FF] bg-[#F2FAFF] text-[#1899D6]" hint="Cọc, tiền thuê, gia hạn, phí" />
          <SummaryTile icon="currency_exchange" label="Đã được hoàn" value={summary.totalRefunded}
            tone="border-[#58CC02] bg-[#F1FFE7] text-[#58A700]"
            hint={Number(summary.pendingRefund) > 0 ? `Đang chờ hoàn ${formatVND(summary.pendingRefund)}` : 'Không có khoản chờ hoàn'} />
          <SummaryTile icon="account_balance_wallet" label="Trừ vào tiền cọc" value={summary.depositOffset}
            tone="border-[#E5E5E5] bg-[#F7F7F7] text-[#777777]" hint="Phí trễ / sự cố khấu trừ khi trả kho" />
          <SummaryTile icon="warning" label="Còn nợ" value={summary.outstandingDebt}
            tone={Number(summary.outstandingDebt) > 0 ? 'border-[#FF4B4B] bg-[#FFF5F5] text-[#EA2B2B]' : 'border-[#E5E5E5] bg-white text-[#AFAFAF]'}
            hint={Number(summary.outstandingDebt) > 0 ? 'Cần trả trước khi đặt kho mới' : 'Không có khoản nợ'} />
        </div>
      )}

      {/* Khoản cần thanh toán */}
      {state.data && (debts.length > 0 || overdue.length > 0) && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-black text-[#4B4B4B]">Khoản cần thanh toán</h2>
          {payError && <p className="text-sm font-black text-[#FF4B4B]">{payError}</p>}

          {debts.map((debt) => (
            <div key={debt.id} className="duo-card p-5 border-2 border-[#FF4B4B] flex flex-col md:flex-row md:items-center gap-4">
              <span className="material-symbols-outlined text-[32px] text-[#FF4B4B]">construction</span>
              <div className="flex-1 min-w-0">
                <p className="font-black text-[#4B4B4B]">{debt.paymentType === "OVERSTAY_FEE" ? "Phí chiếm dụng vượt tiền cọc" : "Phí sự cố vượt tiền cọc"} · HĐ {debt.contractCode || "—"}</p>
                <p className="text-xs font-bold text-[#777777]">
                  {debt.facilityName || ''}{debt.unitTypeName ? ` · ${debt.unitTypeName}` : ''} — phát sinh khi nghiệm thu trả kho
                </p>
              </div>
              <span className="text-xl font-black text-[#EA2B2B]">{formatVND(debt.amount)}</span>
              <button
                onClick={() => handlePayDebt(debt)}
                disabled={payingId != null}
                className="duo-btn-green px-5 py-3 text-xs disabled:opacity-50"
              >
                {payingId === debt.id ? 'ĐANG TẠO LINK...' : 'THANH TOÁN VNPAY'}
              </button>
            </div>
          ))}

          {overdue.map((c) => (
            <div key={c.contractId} className="duo-card p-5 border-2 border-[#FF9600] flex flex-col md:flex-row md:items-center gap-4">
              <span className="material-symbols-outlined text-[32px] text-[#FF9600]">event_busy</span>
              <div className="flex-1 min-w-0">
                <p className="font-black text-[#4B4B4B]">Hợp đồng {c.contractCode} quá hạn {c.overdueDays} ngày</p>
                <p className="text-xs font-bold text-[#777777]">
                  {c.facilityName} — gia hạn để mở lại mã PIN.{' '}
                  {c.lateFeeWaived ? 'Quản lý đã miễn phí trễ cho bạn.' : `Phí trễ hiện tại ${formatVND(c.lateFeeAmount)}.`}{Number(c.overstayFeeAmount) > 0 ? ` Phí chiếm dụng ô ${formatVND(c.overstayFeeAmount)} (tăng mỗi ngày).` : ''}
                </p>
              </div>
              {c.reservationId && (
                <Link to={`/kho-cua-toi/hop-dong/${c.reservationId}`} className="duo-btn-orange px-5 py-3 text-xs">
                  GIA HẠN NGAY
                </Link>
              )}
            </div>
          ))}
        </section>
      )}

      {/* Lịch sử giao dịch */}
      {state.data && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <h2 className="text-lg font-black text-[#4B4B4B]">Lịch sử giao dịch</h2>
            <div className="flex flex-wrap items-center gap-2">
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="duo-input text-sm">
                <option value="ALL">Tất cả loại</option>
                {Object.entries(TYPE_LABELS).map(([code, t]) => <option key={code} value={code}>{t.label}</option>)}
              </select>
              <label className="flex items-center gap-2 text-xs font-bold text-[#777777] cursor-pointer">
                <input type="checkbox" checked={showFailed} onChange={(e) => setShowFailed(e.target.checked)} />
                Hiện giao dịch thất bại
              </label>
            </div>
          </div>

          <div className="duo-card overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b-2 border-[#E5E5E5]">
                  {['Thời gian', 'Loại', 'Đơn / Hợp đồng', 'Phương thức', 'Số tiền', 'Trạng thái'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-[#AFAFAF]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-sm font-black text-[#AFAFAF]">Chưa có giao dịch nào</td>
                  </tr>
                )}
                {transactions.map((t) => {
                  const type = TYPE_LABELS[t.paymentType] || { label: t.paymentType, icon: 'receipt' }
                  const status = STATUS_STYLES[t.status] || STATUS_STYLES.PENDING
                  const isRefund = t.paymentType === 'REFUND'
                  return (
                    <tr key={t.id} className="border-b-2 border-[#F7F7F7] last:border-b-0">
                      <td className="px-4 py-3 whitespace-nowrap font-bold text-[#777777]">{formatTime(t.paidAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 font-black text-[#4B4B4B]">
                          <span className="material-symbols-outlined text-[18px] text-[#AFAFAF]">{type.icon}</span>
                          {type.label}{t.renewalMonths ? ` ${t.renewalMonths} tháng` : ''}
                        </div>
                        <div className="text-[11px] font-bold text-[#AFAFAF] font-mono">{t.transactionCode}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-[#4B4B4B]">{t.contractCode || t.reservationCode || '—'}</div>
                        <div className="text-[11px] font-bold text-[#AFAFAF]">{t.facilityName || ''}</div>
                      </td>
                      <td className="px-4 py-3 font-bold text-[#777777]">{METHOD_LABELS[t.paymentMethod] || t.paymentMethod}</td>
                      <td className={`px-4 py-3 font-black whitespace-nowrap ${isRefund ? 'text-[#58A700]' : 'text-[#4B4B4B]'}`}>
                        {isRefund ? '+' : ''}{formatVND(t.amount)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`duo-badge border-2 ${status.className}`}>{status.label}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
