import { useState } from 'react'
import { rescheduleReservation } from '../services/reservationService'

// [EXCEPTION] Modal dời lịch hẹn nhận kho — khách muốn đổi ngày
export default function RescheduleModal({ isOpen, reservation, onClose, onSuccess }) {
  const [newStartDate, setNewStartDate] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen || !reservation) return null

  const today = new Date().toISOString().split('T')[0]

  const handleConfirm = async () => {
    if (!newStartDate) {
      setError('Vui lòng chọn ngày nhận kho mới.')
      return
    }
    setLoading(true)
    setError('')
    try {
      // UC-31 / PR-A8: gửi id FM đang đăng nhập để log ghi đúng người thao tác
      const managerId = JSON.parse(sessionStorage.getItem('user') || '{}').userId ?? null
      await rescheduleReservation(reservation.id, {
        newStartDate,
        reason: reason || null,
        managerId,
      })
      onSuccess(reservation.reservationCode, newStartDate)
      handleClose()
    } catch (err) {
      setError(err.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setNewStartDate('')
    setReason('')
    setError('')
    onClose()
  }

  const formatDate = (val) => {
    if (!val) return '—'
    const [y, m, d] = String(val).split('-')
    return `${d}/${m}/${y}`
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-3xl border-2 border-b-4 border-[#E5E5E5] shadow-xl w-full max-w-md mx-4 p-6 flex flex-col gap-5">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#1CB0F6] border-b-4 border-[#1899D6] flex items-center justify-center text-white shrink-0">
            <span className="material-symbols-outlined text-[26px]">edit_calendar</span>
          </div>
          <div>
            <h2 className="text-base font-black text-[#4B4B4B] uppercase tracking-wide">Dời lịch nhận kho</h2>
            <p className="text-xs font-bold text-[#AFAFAF]">Đơn <span className="text-[#1CB0F6]">{reservation.reservationCode}</span> — {reservation.customerName}</p>
          </div>
          <button onClick={handleClose} className="ml-auto text-[#AFAFAF] hover:text-[#4B4B4B]">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Ngày hiện tại */}
        <div className="bg-[#F7F7F7] border-2 border-[#E5E5E5] rounded-2xl p-3 flex justify-between items-center text-xs">
          <span className="font-black text-[#AFAFAF] uppercase">Ngày hẹn cũ</span>
          <span className="font-black text-[#FF4B4B]">{formatDate(reservation.startDate)}</span>
        </div>

        {/* Chọn ngày mới */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-black uppercase text-[#AFAFAF] tracking-wider">Ngày nhận kho mới <span className="text-[#FF4B4B]">*</span></label>
          <input
            type="date"
            min={today}
            value={newStartDate}
            onChange={(e) => setNewStartDate(e.target.value)}
            className="border-2 border-[#E5E5E5] rounded-xl px-3 py-2.5 text-xs font-bold text-[#4B4B4B] focus:outline-none focus:border-[#1CB0F6]"
          />
        </div>

        {/* Lý do */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-black uppercase text-[#AFAFAF] tracking-wider">Lý do dời lịch (tuỳ chọn)</label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="border-2 border-[#E5E5E5] rounded-xl px-3 py-2.5 text-xs font-bold text-[#4B4B4B] focus:outline-none focus:border-[#1CB0F6]"
          >
            <option value="">Chọn lý do...</option>
            <option value="Khách bận đột xuất">Khách bận đột xuất</option>
            <option value="Khách chưa chuẩn bị xong đồ">Khách chưa chuẩn bị xong đồ</option>
            <option value="Thỏa thuận với khách hàng">Thỏa thuận với khách hàng</option>
            <option value="Khách yêu cầu dời lịch">Khách yêu cầu dời lịch</option>
          </select>
        </div>

        {error && <p className="text-xs font-black text-[#FF4B4B]">{error}</p>}

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button onClick={handleClose} disabled={loading} className="duo-btn-white px-5 py-2.5 text-xs">HỦY BỎ</button>
          <button
            onClick={handleConfirm}
            disabled={loading || !newStartDate}
            className="duo-btn-blue px-5 py-2.5 text-xs disabled:opacity-50"
          >
            {loading ? 'Đang cập nhật...' : 'XÁC NHẬN DỜI LỊCH'}
          </button>
        </div>
      </div>
    </div>
  )
}
