import { useEffect, useState } from 'react'
import { getReservationManagerDetail } from '../services/reservationService'

// UC-13 / UC-14: FM xem chi tiết đơn đã cọc trước khi gán ô (panel trượt bên phải).
// CCCD hiển thị dạng che giữa — đối chiếu số đầy đủ khi khách đến nhận kho.

function formatVND(amount) {
  if (amount === null || amount === undefined) return '—'
  return Number(amount).toLocaleString('vi-VN') + '₫'
}

function formatDate(value) {
  if (!value) return '—'
  const [y, m, d] = String(value).slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

function Section({ icon, title, children }) {
  return (
    <div className="border-2 border-[#E5E5E5] rounded-2xl p-4 flex flex-col gap-2">
      <p className="text-[11px] font-black uppercase tracking-wider text-[#AFAFAF] flex items-center gap-1.5">
        <span className="material-symbols-outlined text-[16px]">{icon}</span>
        {title}
      </p>
      {children}
    </div>
  )
}

function Row({ label, value, strong, mono, tone }) {
  return (
    <div className="flex justify-between gap-3 text-xs">
      <span className="font-bold text-[#777777] shrink-0">{label}</span>
      <span className={`text-right break-all ${strong ? 'font-black' : 'font-bold'} ${mono ? 'font-mono' : ''} ${tone || 'text-[#4B4B4B]'}`}>
        {value ?? '—'}
      </span>
    </div>
  )
}

export default function ReservationDetailDrawer({ reservationId, onClose, onAssign }) {
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState('')

  // Parent truyền key={reservationId} → mỗi đơn mount lại component, state tự về rỗng
  useEffect(() => {
    if (!reservationId) return undefined
    let cancelled = false
    getReservationManagerDetail(reservationId)
      .then((data) => { if (!cancelled) setDetail(data) })
      .catch((err) => { if (!cancelled) setError(err.response?.data?.message || 'Không tải được chi tiết đơn.') })
    return () => { cancelled = true }
  }, [reservationId])

  if (!reservationId) return null

  const hasDebt = Number(detail?.pendingDebtAmount || 0) > 0

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs" onClick={onClose}>
      <div
        className="bg-white w-full max-w-[480px] h-full overflow-y-auto shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b-2 border-[#E5E5E5] bg-[#FAFAFA] flex items-center justify-between sticky top-0 z-10">
          <div>
            <p className="text-[11px] font-black uppercase tracking-wider text-[#AFAFAF]">Chi tiết đơn chờ gán ô</p>
            <h2 className="text-lg font-black text-[#1CB0F6]">#{detail?.reservationCode || '...'}</h2>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl text-[#AFAFAF] hover:text-[#4B4B4B] hover:bg-[#E5E5E5] flex items-center justify-center cursor-pointer"
            aria-label="Đóng"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4 flex-1">
          {error && (
            <div className="p-3 bg-[#FFDFDF] border border-[#FF4B4B] rounded-xl text-xs font-bold text-[#FF4B4B]">{error}</div>
          )}
          {!detail && !error && (
            <p className="text-xs font-bold text-[#AFAFAF]">Đang tải chi tiết đơn...</p>
          )}

          {detail && (
            <>
              {hasDebt && (
                <div className="p-3 bg-[#FFF8EE] border-2 border-[#FF9600] rounded-xl text-xs font-bold text-[#E58800] flex items-start gap-2">
                  <span className="material-symbols-outlined text-[18px]">warning</span>
                  <span>Khách đang còn nợ {formatVND(detail.pendingDebtAmount)} phí phát sinh từ hợp đồng trước — nhắc khách thanh toán khi đến nhận kho.</span>
                </div>
              )}

              <Section icon="person" title="Khách hàng">
                <Row label="Họ tên" value={detail.customerName} strong />
                <Row label="Số điện thoại" value={detail.customerPhone} />
                <Row label="Email" value={detail.customerEmail} />
                <Row label="CCCD (che giữa)" value={detail.customerCccdMasked || 'Chưa cập nhật'} mono />
                <Row label="Khách từ" value={formatDate(detail.customerSince)} />
                <Row
                  label="Lịch sử thuê"
                  value={`${detail.previousContracts} HĐ đã kết thúc · ${detail.activeContracts} HĐ đang thuê`}
                />
              </Section>

              <Section icon="warehouse" title="Kho yêu cầu">
                <Row label="Cơ sở" value={detail.facilityName} />
                <Row label="Loại kho" value={detail.unitTypeName} strong tone="text-[#1CB0F6]" />
                <Row label="Kích thước" value={[detail.dimensions, detail.areaSqm ? `${detail.areaSqm} m²` : null].filter(Boolean).join(' · ')} />
                <Row label="Giá niêm yết" value={`${formatVND(detail.basePriceMonthly)}/tháng`} />
              </Section>

              <Section icon="event" title="Lịch nhận kho">
                <Row label="Ngày nhận" value={formatDate(detail.startDate)} strong />
                <Row label="Giờ hẹn dự kiến" value={detail.expectedAppointmentTime ? formatDateTime(detail.expectedAppointmentTime) : 'Trong giờ mở cửa'} />
                <Row label="Thời hạn thuê" value={`${detail.durationMonths} tháng`} />
                <Row label="Trạng thái đơn" value={detail.status} mono />
              </Section>

              <Section icon="payments" title="Thanh toán đợt 1 (VNPAY)">
                <Row label={`Tiền thuê (giảm ${detail.rentDiscountPercent || 0}%)`} value={formatVND(detail.rentAmount)} />
                <Row label="Tiền cọc" value={formatVND(detail.depositAmount)} />
                <Row label={`Voucher ${detail.voucherCode || ''}`} value={`-${formatVND(detail.voucherDiscount)}`} tone="text-[#58A700]" />
                <Row label="Tổng đã thanh toán" value={formatVND(detail.totalPaid)} strong tone="text-[#58A700]" />
                <Row label="Mã giao dịch" value={detail.transactionCode} mono />
                <Row label="Mã GD ngân hàng" value={detail.bankTransactionCode} mono />
                <Row label="Thời điểm cọc" value={formatDateTime(detail.paidAt)} />
              </Section>

              <Section icon="gavel" title="Điều khoản xử lý tài sản">
                <Row
                  label="Phiên bản đã đồng ý"
                  value={detail.termsVersion ? `${detail.termsVersion} · ${formatDateTime(detail.termsAcceptedAt)}` : 'Đơn cũ — chưa đồng ý điều khoản'}
                  tone={detail.termsVersion ? 'text-[#4B4B4B]' : 'text-[#FF4B4B]'}
                />
              </Section>
            </>
          )}
        </div>

        {detail && onAssign && detail.status === 'DEPOSIT_PAID' && (
          <div className="p-4 border-t-2 border-[#E5E5E5] bg-[#FAFAFA] sticky bottom-0">
            <button onClick={onAssign} className="duo-btn-green w-full py-3 text-xs tracking-wider">
              <span className="material-symbols-outlined text-[18px] mr-1">key</span>
              GÁN Ô KHO CHO ĐƠN NÀY
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
