// Góp ý test 24/11/2026 (PR-B14): popup "Số tiền đã đóng" của đơn đặt chỗ — cách ra con số khách đã trả lúc đặt kho.
// lines: [{ label, amount, note }] do backend tính (cùng công thức lúc tạo đơn / VNPAY), số âm = khoản giảm.
// transactions: [{ code, type, method, amount, paidAt }] giao dịch thanh toán thành công của đơn.

function formatVND(v) {
  return Number(v || 0).toLocaleString('vi-VN') + '₫'
}

function Line({ l }) {
  const minus = Number(l.amount) < 0
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="flex flex-col min-w-0">
        <span className="text-sm font-bold text-[#4B4B4B]">{l.label}</span>
        {l.note && <span className="text-[11px] font-bold text-[#AFAFAF]">{l.note}</span>}
      </span>
      <span className={`text-sm font-black whitespace-nowrap ${minus ? 'text-[#58A700]' : 'text-[#4B4B4B]'}`}>
        {minus ? '− ' : ''}{formatVND(Math.abs(Number(l.amount)))}
      </span>
    </div>
  )
}

const METHOD_LABELS = { VNPAY: 'VNPAY', BANK_TRANSFER: 'Chuyển khoản', CASH: 'Tiền mặt' }

export default function BookingPaidModal({ open, reservationCode, lines = [], transactions = [], totalPaid, onClose }) {
  if (!open) return null
  const total = lines.reduce((s, l) => s + Number(l.amount || 0), 0)
  const rentLines = lines.filter((l) => !/^Bảo hiểm|^Tiền cọc/.test(l.label))
  const otherLines = lines.filter((l) => /^Bảo hiểm|^Tiền cọc/.test(l.label))
  const rentNet = rentLines.reduce((s, l) => s + Number(l.amount || 0), 0)
  const paid = Number(totalPaid || 0)
  const matches = Math.round(total) === Math.round(paid)

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-3xl border-2 border-[#E5E5E5] shadow-2xl w-full max-w-md p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[#58CC02] border-b-2 border-[#58A700] text-white flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[24px]">receipt_long</span>
          </div>
          <div>
            <h2 className="text-lg font-black text-[#4B4B4B]">Số tiền đã đóng</h2>
            <p className="text-xs font-bold text-[#777777]">Đơn {reservationCode} · tính lúc đặt kho</p>
          </div>
        </div>

        <div className="border-2 border-[#E5E5E5] rounded-xl px-4 py-2 divide-y divide-[#F0F0F0]">
          {rentLines.map((l, i) => <Line key={`r${i}`} l={l} />)}
          <div className="flex items-center justify-between gap-3 py-2 bg-[#F3FEE7] -mx-4 px-4">
            <span className="text-sm font-black text-[#58A700]">Tiền thuê thực đóng</span>
            <span className="text-sm font-black text-[#58A700]">{formatVND(rentNet)}</span>
          </div>
          {otherLines.map((l, i) => <Line key={`o${i}`} l={l} />)}
          <div className="flex items-center justify-between gap-3 py-2.5">
            <span className="flex flex-col">
              <span className="text-sm font-black uppercase text-[#4B4B4B]">Tổng đã đóng</span>
              <span className="text-[10px] font-bold text-[#AFAFAF]">= tiền thuê thực đóng + bảo hiểm + tiền cọc</span>
            </span>
            <span className="text-2xl font-black text-[#FF9600]">{formatVND(total)}</span>
          </div>
        </div>

        {transactions.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-black uppercase tracking-wider text-[#777777]">Giao dịch thanh toán</span>
            {transactions.map((t, i) => (
              <div key={t.code || i} className="flex items-center justify-between gap-3 rounded-xl bg-[#F7F7F7] px-3 py-2 text-xs font-bold text-[#4B4B4B]">
                <span className="flex flex-col min-w-0">
                  <span>{METHOD_LABELS[t.method] || t.method}{t.paidAt ? ` · ${new Date(t.paidAt).toLocaleString('vi-VN')}` : ''}</span>
                  {t.code && <span className="text-[10px] font-mono text-[#AFAFAF] break-all">{t.code}</span>}
                </span>
                <span className="font-black whitespace-nowrap">{formatVND(t.amount)}</span>
              </div>
            ))}
          </div>
        )}

        <p className={`text-xs font-bold rounded-xl px-3 py-2 ${matches ? 'bg-[#F3FEE7] text-[#58A700]' : 'bg-[#FFF8E6] text-[#D96B00]'}`}>
          {matches
            ? `Khớp số tiền đã thanh toán ${formatVND(paid)}.`
            : `Số đã thanh toán ghi nhận ${formatVND(paid)} khác bảng tính (giá niêm yết có thể đã đổi sau khi bạn đặt). Liên hệ cơ sở nếu cần đối chiếu.`}
        </p>

        <div className="flex justify-end">
          <button type="button" onClick={onClose} className="duo-btn-blue px-5 py-2.5 text-xs">Đóng</button>
        </div>
      </div>
    </div>
  )
}
