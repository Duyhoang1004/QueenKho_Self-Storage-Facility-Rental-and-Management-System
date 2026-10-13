import { useState } from 'react'
import { noShowReservation } from '../services/reservationService'

// [EXCEPTION] Modal xác nhận xử lý No-Show — khách không đến nhận kho
export default function NoShowModal({ isOpen, reservation, onClose, onSuccess }) {
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen || !reservation) return null

  const staffId = JSON.parse(sessionStorage.getItem('user') || '{}').userId ?? null

  const handleConfirm = async () => {
    setLoading(true)
    setError('')
    try {
      await noShowReservation(reservation.id, {
        reason: reason || 'Khách không đến nhận kho',
        note: note || null,
        staffId,
      })
      onSuccess(reservation.reservationCode)
      handleClose()
    } catch (err) {
      setError(err.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setReason('')
    setNote('')
    setError('')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-3xl border-2 border-b-4 border-[#E5E5E5] shadow-xl w-full max-w-md mx-4 p-6 flex flex-col gap-5">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#FF4B4B] border-b-4 border-[#CC0000] flex items-center justify-center text-white shrink-0">
            <span className="material-symbols-outlined text-[26px]">person_off</span>
          </div>
          <div>
            <h2 className="text-base font-black text-[#4B4B4B] uppercase tracking-wide">Xử lý No-Show</h2>
            <p className="text-xs font-bold text-[#AFAFAF]">Đơn <span className="text-[#FF4B4B]">{reservation.reservationCode}</span> — {reservation.customerName}</p>
          </div>
          <button onClick={handleClose} className="ml-auto text-[#AFAFAF] hover:text-[#4B4B4B]">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Cảnh báo */}
        <div className="bg-[#FFDFDF] border-2 border-[#FF4B4B] rounded-2xl p-4 text-xs font-bold text-[#FF4B4B] flex gap-2">
          <span className="material-symbols-outlined text-[18px] shrink-0">warning</span>
          <span>Thao tác này sẽ <strong>hủy đơn</strong>, <strong>tịch thu tiền cọc {reservation.depositAmount?.toLocaleString('vi-VN')}₫</strong> và giải phóng ô kho về trạng thái sẵn sàng. Không thể hoàn tác!</span>
        </div>

        {/* Lý do */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-black uppercase text-[#AFAFAF] tracking-wider">Lý do No-Show</label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="border-2 border-[#E5E5E5] rounded-xl px-3 py-2.5 text-xs font-bold text-[#4B4B4B] focus:outline-none focus:border-[#FF4B4B]"
          >
            <option value="">Khách không đến nhận kho (mặc định)</option>
            <option value="Khách không liên lạc được">Khách không liên lạc được</option>
            <option value="Khách từ chối nhận kho">Khách từ chối nhận kho</option>
            <option value="Khách hẹn lại nhưng không đến">Khách hẹn lại nhưng không đến</option>
          </select>
        </div>

        {/* Ghi chú thêm */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-black uppercase text-[#AFAFAF] tracking-wider">Ghi chú thêm (tuỳ chọn)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="VD: Đã gọi 3 lần, không bắt máy..."
            className="border-2 border-[#E5E5E5] rounded-xl px-3 py-2.5 text-xs font-bold text-[#4B4B4B] resize-none focus:outline-none focus:border-[#FF4B4B]"
          />
        </div>

        {error && <p className="text-xs font-black text-[#FF4B4B]">{error}</p>}

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button onClick={handleClose} disabled={loading} className="duo-btn-white px-5 py-2.5 text-xs">HỦY BỎ</button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="px-5 py-2.5 text-xs font-black uppercase tracking-wider rounded-2xl border-2 border-b-4 border-[#CC0000] bg-[#FF4B4B] text-white hover:bg-[#e03e3e] disabled:opacity-50 transition-colors"
          >
            {loading ? 'Đang xử lý...' : 'XÁC NHẬN NO-SHOW'}
          </button>
        </div>
      </div>
    </div>
  )
}
