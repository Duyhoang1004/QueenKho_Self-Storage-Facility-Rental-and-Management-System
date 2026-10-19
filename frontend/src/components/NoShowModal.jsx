import { useState } from 'react'
import { noShowReservation } from '../services/reservationService'

// [EXCEPTION] Modal xác nhận xử lý No-Show — khách không đến nhận kho (PR-X3 & PR-X1)
export default function NoShowModal({ isOpen, reservation, onClose, onSuccess }) {
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [waivePenalty, setWaivePenalty] = useState(false)
  const [waiveReason, setWaiveReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen || !reservation) return null

  const staffId = JSON.parse(sessionStorage.getItem('user') || '{}').userId ?? null
  const isEligible = reservation.noShowEligible !== false

  const handleConfirm = async () => {
    if (!isEligible) {
      setError(reservation.noShowIneligibleReason || 'Đơn chưa đủ điều kiện xử lý No-Show (PR-X3).')
      return
    }
    if (waivePenalty && !waiveReason.trim()) {
      setError('Vui lòng nhập lý do miễn phạt No-Show.')
      return
    }

    setLoading(true)
    setError('')
    try {
      await noShowReservation(reservation.id, {
        reason: reason || 'Khách không đến nhận kho',
        note: note || null,
        staffId,
        waivePenalty,
        waiveReason: waivePenalty ? waiveReason.trim() : null,
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
    setWaivePenalty(false)
    setWaiveReason('')
    setError('')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-3xl border-2 border-b-4 border-[#E5E5E5] shadow-xl w-full max-w-lg mx-4 p-6 flex flex-col gap-4">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#FF4B4B] border-b-4 border-[#CC0000] flex items-center justify-center text-white shrink-0">
            <span className="material-symbols-outlined text-[26px]">person_off</span>
          </div>
          <div>
            <h2 className="text-base font-black text-[#4B4B4B] uppercase tracking-wide">Xử lý No-Show (PR-X3)</h2>
            <p className="text-xs font-bold text-[#AFAFAF]">Đơn <span className="text-[#FF4B4B]">{reservation.reservationCode}</span> — {reservation.customerName}</p>
          </div>
          <button onClick={handleClose} className="ml-auto text-[#AFAFAF] hover:text-[#4B4B4B]">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* PR-X3: Cảnh báo điều kiện nếu chưa đủ */}
        {!isEligible ? (
          <div className="bg-[#FFF0E6] border-2 border-[#FF9600] rounded-2xl p-4 text-xs font-bold text-[#D06B00] flex gap-3">
            <span className="material-symbols-outlined text-[22px] shrink-0 text-[#E58800]">lock_clock</span>
            <div className="flex flex-col gap-1">
              <span className="font-black uppercase text-[#E58800]">Chưa đủ điều kiện xử lý No-Show (Quy định PR-X3)</span>
              <p className="leading-relaxed text-[#4B4B4B]">{reservation.noShowIneligibleReason || 'Phải quá 48h từ giờ hẹn và có tối thiểu 2 lần liên hệ thất bại cách nhau 24h.'}</p>
              <div className="flex items-center gap-2 mt-1 text-[11px]">
                <span className="px-2 py-0.5 rounded-md bg-white border border-[#FFD591] font-black text-[#B26B00]">
                  Số lần liên hệ: {reservation.failedContactCount || 0}/2 lần
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* Cảnh báo tài chính khi đủ điều kiện */
          <div className="bg-[#FFDFDF] border-2 border-[#FF4B4B] rounded-2xl p-4 text-xs font-bold text-[#FF4B4B] flex gap-2">
            <span className="material-symbols-outlined text-[18px] shrink-0">warning</span>
            <span>
              {waivePenalty ? (
                <>Thao tác này sẽ <strong>hủy đơn</strong>, kích hoạt <strong>miễn phạt No-Show (hoàn 100% tiền đã đóng)</strong> và giải phóng ô kho về trạng thái sẵn sàng.</>
              ) : (
                <>Thao tác này sẽ <strong>hủy đơn</strong>, <strong>tịch thu tiền cọc {reservation.depositAmount?.toLocaleString('vi-VN')}₫</strong> (hoàn lại tiền thuê trả trước nếu có) và giải phóng ô kho về trạng thái sẵn sàng.</>
              )}
            </span>
          </div>
        )}

        {/* PR-X1: Miễn phạt No-Show checkbox */}
        <label className="flex items-center gap-3 p-3 rounded-2xl border-2 border-[#E5E5E5] hover:border-[#1CB0F6] cursor-pointer transition-colors">
          <input
            type="checkbox"
            checked={waivePenalty}
            onChange={(e) => setWaivePenalty(e.target.checked)}
            className="w-4 h-4 rounded text-[#1CB0F6] focus:ring-0"
          />
          <div className="flex flex-col">
            <span className="text-xs font-black text-[#4B4B4B]">Miễn phạt No-Show (Quy định PR-X1)</span>
            <span className="text-[11px] font-bold text-[#AFAFAF]">Facility Manager phê duyệt hoàn 100% tiền cọc + tiền thuê (trường hợp bất khả kháng)</span>
          </div>
        </label>

        {/* Lý do miễn phạt nếu tick chọn */}
        {waivePenalty && (
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-black uppercase text-[#1CB0F6] tracking-wider">Lý do miễn phạt *</label>
            <input
              type="text"
              value={waiveReason}
              onChange={(e) => setWaiveReason(e.target.value)}
              placeholder="VD: Khách nhập viện cấp cứu, đã cung cấp giấy chứng nhận..."
              className="border-2 border-[#1CB0F6] rounded-xl px-3 py-2 text-xs font-bold text-[#4B4B4B] focus:outline-none"
            />
          </div>
        )}

        {/* Lý do No-Show */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-black uppercase text-[#AFAFAF] tracking-wider">Lý do No-Show</label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="border-2 border-[#E5E5E5] rounded-xl px-3 py-2 text-xs font-bold text-[#4B4B4B] focus:outline-none focus:border-[#FF4B4B]"
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
            placeholder="VD: Đã gọi 2 lần ngày hôm qua và sáng nay nhưng đều thuê bao..."
            className="border-2 border-[#E5E5E5] rounded-xl px-3 py-2 text-xs font-bold text-[#4B4B4B] resize-none focus:outline-none focus:border-[#FF4B4B]"
          />
        </div>

        {error && <p className="text-xs font-black text-[#FF4B4B]">{error}</p>}

        {/* Actions */}
        <div className="flex gap-3 justify-end pt-2">
          <button onClick={handleClose} disabled={loading} className="duo-btn-white px-5 py-2.5 text-xs">HỦY BỎ</button>
          <button
            onClick={handleConfirm}
            disabled={loading || !isEligible}
            className={`px-5 py-2.5 text-xs font-black uppercase tracking-wider rounded-2xl border-2 border-b-4 transition-colors ${
              !isEligible
                ? 'bg-[#E5E5E5] border-[#CCCCCC] text-[#AFAFAF] cursor-not-allowed'
                : 'border-[#CC0000] bg-[#FF4B4B] text-white hover:bg-[#e03e3e]'
            }`}
          >
            {loading ? 'Đang xử lý...' : isEligible ? 'XÁC NHẬN NO-SHOW' : 'CHƯA ĐỦ ĐIỀU KIỆN (PR-X3)'}
          </button>
        </div>
      </div>
    </div>
  )
}

