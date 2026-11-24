import { useState } from 'react'

// 22/11/2026 (góp ý test — PR-B12): xác nhận số tiền trước khi chuyển sang VNPAY.
// Dùng chung cho đặt kho, gia hạn, trả phần âm khi quyết toán, trả nợ phí sự cố.
// lines: [{ label, amount, note?, minus? }] — minus = khoản giảm (ưu đãi, voucher)

function formatVND(v) {
  return Number(v || 0).toLocaleString('vi-VN') + '₫'
}

export default function PaymentConfirmModal({ open, title = 'Xác nhận thanh toán', subtitle, lines = [], total, note,
  confirmLabel, submitting = false, onConfirm, onCancel }) {
  if (!open) return null
  return (
    <PaymentConfirmBody title={title} subtitle={subtitle} lines={lines} total={total} note={note}
      confirmLabel={confirmLabel} submitting={submitting} onConfirm={onConfirm} onCancel={onCancel} />
  )
}

// Tách thân modal để ô tick "đồng ý" luôn bắt đầu chưa tick mỗi lần mở
function PaymentConfirmBody({ title, subtitle, lines, total, note, confirmLabel, submitting, onConfirm, onCancel }) {
  const [agreed, setAgreed] = useState(false)
  const shown = lines.filter((l) => l && Number(l.amount || 0) !== 0)
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40" onClick={submitting ? undefined : onCancel}>
      <div className="duo-card bg-white w-full max-w-[460px] p-6 flex flex-col gap-4 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[#58CC02] border-b-2 border-[#58A700] text-white flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[24px]">payments</span>
          </div>
          <div>
            <h2 className="text-lg font-black text-[#4B4B4B]">{title}</h2>
            {subtitle && <p className="text-xs font-bold text-[#777777]">{subtitle}</p>}
          </div>
        </div>

        <div className="border-2 border-[#E5E5E5] rounded-xl px-4 py-2 divide-y divide-[#F0F0F0]">
          {shown.map((l, i) => (
            <div key={i} className="flex items-start justify-between gap-3 py-2">
              <span className="flex flex-col">
                <span className="text-sm font-bold text-[#4B4B4B]">{l.label}</span>
                {l.note && <span className="text-[11px] font-bold text-[#AFAFAF]">{l.note}</span>}
              </span>
              <span className={`text-sm font-black whitespace-nowrap ${l.minus ? 'text-[#58A700]' : 'text-[#4B4B4B]'}`}>
                {l.minus ? '− ' : ''}{formatVND(Math.abs(Number(l.amount)))}
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between gap-3 py-2.5">
            <span className="text-sm font-black uppercase text-[#4B4B4B]">Tổng thanh toán</span>
            <span className="text-2xl font-black text-[#FF9600]">{formatVND(total)}</span>
          </div>
        </div>

        {note && <p className="text-xs font-bold text-[#777777] leading-relaxed">{note}</p>}

        <label className="flex items-start gap-2 text-xs font-black text-[#4B4B4B] cursor-pointer">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 accent-[#58CC02]" />
          Tôi đồng ý thanh toán {formatVND(total)} qua VNPAY.
        </label>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onCancel} disabled={submitting} className="duo-btn-gray px-5 py-2.5 text-xs disabled:opacity-50">
            Xem lại
          </button>
          <button type="button" onClick={onConfirm} disabled={!agreed || submitting}
            className="duo-btn-green px-5 py-2.5 text-xs gap-1.5 disabled:opacity-60">
            {submitting && <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>}
            {confirmLabel || `Thanh toán ${formatVND(total)} qua VNPAY`}
          </button>
        </div>
      </div>
    </div>
  )
}
