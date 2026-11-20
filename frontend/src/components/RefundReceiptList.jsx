import { useEffect, useState } from 'react'
import { getMyRefundReceipts, confirmRefundReceipt, disputeRefundReceipt } from '../services/refundReceiptService'

// D-22 (PR-O25 → PR-O27): khoản hoàn cơ sở đã chi — khách bấm "Đã nhận được" / "Chưa nhận được"
// contractId: chỉ khoản hoàn của 1 hợp đồng; onlyPending: chỉ hiện khoản đang chờ / đang xử lý

function formatVND(v) {
  if (v == null) return '—'
  return Number(v).toLocaleString('vi-VN') + '₫'
}

function formatDateTime(val) {
  if (!val) return '—'
  const d = new Date(val)
  if (Number.isNaN(d.getTime())) return String(val)
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

const STATUS = {
  WAITING_CUSTOMER: { label: 'Chờ bạn xác nhận', cls: 'bg-[#DDF4FF] text-[#1899D6] border-[#84D8FF]' },
  DISPUTED: { label: 'Cơ sở đang kiểm tra', cls: 'bg-[#FFE8CC] text-[#E58800] border-[#FF9600]' },
  CONFIRMED: { label: 'Đã nhận', cls: 'bg-[#D7FFB8] text-[#58A700] border-[#58CC02]' },
  AUTO_CONFIRMED: { label: 'Đã nhận (tự xác nhận)', cls: 'bg-[#F7F7F7] text-[#777777] border-[#E5E5E5]' },
}

export default function RefundReceiptList({ contractId, onlyPending = false, title = 'Tiền hoàn của bạn' }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  const [disputeId, setDisputeId] = useState(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    let cancelled = false
    getMyRefundReceipts(contractId)
      .then((data) => { if (!cancelled) setItems(data || []) })
      .catch(() => { if (!cancelled) setItems([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [contractId, reloadKey])

  const shown = onlyPending ? items.filter((i) => ['WAITING_CUSTOMER', 'DISPUTED'].includes(i.receiptStatus)) : items
  if (loading || shown.length === 0) return null

  const act = async (fn, ok) => {
    setBusy(true)
    setMessage(null)
    try {
      await fn()
      setMessage({ ok: true, text: ok })
      setDisputeId(null)
      setReason('')
      setReloadKey((k) => k + 1)
    } catch (err) {
      setMessage({ ok: false, text: err.response?.data?.message || 'Thao tác không thành công.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-white border-2 border-[#84D8FF] rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-[22px] text-[#1CB0F6]">account_balance_wallet</span>
        <h3 className="text-sm font-black uppercase tracking-wide text-[#4B4B4B]">{title}</h3>
      </div>
      {message && (
        <div className={`rounded-xl border-2 p-2.5 text-xs font-black ${message.ok ? 'bg-[#D7FFB8] border-[#58CC02] text-[#58A700]' : 'bg-[#FFF2F2] border-[#FFB8B8] text-[#FF4B4B]'}`}>
          {message.text}
        </div>
      )}
      {shown.map((r) => {
        const st = STATUS[r.receiptStatus] || STATUS.CONFIRMED
        return (
          <div key={r.taskId} className="border-2 border-[#F0F0F0] rounded-xl p-3 flex flex-col gap-2">
            <div className="flex flex-wrap justify-between items-start gap-2">
              <div className="flex flex-col">
                <span className="text-lg font-black text-[#58A700]">{formatVND(r.amount)}</span>
                <span className="text-[11px] font-bold text-[#777777]">
                  {r.contractCode ? `HĐ ${r.contractCode}` : r.reservationCode ? `Đơn ${r.reservationCode}` : `Khoản hoàn #${r.taskId}`}
                  {r.facilityName ? ` · ${r.facilityName}` : ''} · {formatDateTime(r.completedAt)}
                </span>
              </div>
              <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg border ${st.cls}`}>{st.label}</span>
            </div>
            <div className="text-xs font-semibold text-[#4B4B4B] flex flex-wrap gap-x-4 gap-y-1">
              <span>{r.paymentMethod === 'CASH' ? 'Tiền mặt tại quầy' : 'Chuyển khoản'}</span>
              {r.bankTransactionCode && !String(r.bankTransactionCode).startsWith('CASH-') && r.bankTransactionCode !== 'UNC-IMAGE' && (
                <span>Mã giao dịch: <span className="font-mono font-black">{r.bankTransactionCode}</span></span>
              )}
              {r.evidenceImageUrl && (
                <a href={r.evidenceImageUrl} target="_blank" rel="noreferrer" className="text-[#1CB0F6] font-black underline">Xem chứng từ</a>
              )}
            </div>
            {r.managerNote && r.receiptRound > 1 && (
              <p className="text-xs text-[#4B4B4B]"><span className="font-black">Cơ sở phản hồi:</span> {r.managerNote}</p>
            )}
            {r.receiptStatus === 'DISPUTED' && (
              <p className="text-xs font-bold text-[#E58800]">Bạn đã báo: “{r.disputeReason}”. Quản lý cơ sở sẽ kiểm tra trong 24 giờ.</p>
            )}
            {r.canConfirm && disputeId !== r.taskId && (
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" disabled={busy}
                  onClick={() => act(() => confirmRefundReceipt(r.taskId), 'Cảm ơn bạn đã xác nhận đã nhận tiền.')}
                  className="duo-btn-green px-4 py-2 text-xs uppercase cursor-pointer disabled:opacity-60">Đã nhận được</button>
                <button type="button" disabled={busy} onClick={() => { setDisputeId(r.taskId); setReason('') }}
                  className="duo-btn-white px-4 py-2 text-xs uppercase cursor-pointer">Chưa nhận được</button>
                {r.autoConfirmAt && (
                  <span className="text-[11px] font-bold text-[#AFAFAF]">Không phản hồi, hệ thống tự xác nhận lúc {formatDateTime(r.autoConfirmAt)}</span>
                )}
              </div>
            )}
            {disputeId === r.taskId && (
              <div className="flex flex-col gap-2">
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={500}
                  placeholder="Ví dụ: đã 2 ngày chưa thấy tiền về tài khoản / nhận thiếu 100.000đ"
                  className="border-2 border-[#E5E5E5] rounded-xl p-2.5 text-xs font-bold outline-none focus:border-[#1CB0F6]" />
                <div className="flex gap-2">
                  <button type="button" disabled={busy || reason.trim().length < 10}
                    onClick={() => act(() => disputeRefundReceipt(r.taskId, reason.trim()), 'Đã báo quản lý cơ sở kiểm tra lại.')}
                    className="duo-btn-red px-4 py-2 text-xs uppercase cursor-pointer disabled:opacity-60">Gửi</button>
                  <button type="button" onClick={() => setDisputeId(null)} className="duo-btn-gray px-4 py-2 text-xs uppercase cursor-pointer">Huỷ</button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
