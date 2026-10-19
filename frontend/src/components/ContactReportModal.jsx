import { useState } from 'react'
import { submitContactReport } from '../services/staffTaskService'

export default function ContactReportModal({ isOpen, task, onClose, onSuccess }) {
  const [callOutcome, setCallOutcome] = useState('Khách xin dời ngày nhận kho')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen || !task) return null

  const user = JSON.parse(sessionStorage.getItem('user') || '{}')
  const staffId = user.userId ?? null

  const handleConfirm = async () => {
    setLoading(true)
    setError('')
    try {
      await submitContactReport(task.id, {
        callOutcome,
        note: note.trim(),
        staffId,
      })
      onSuccess(task.id, callOutcome)
      handleClose()
    } catch (err) {
      setError(err.response?.data?.message || 'Có lỗi xảy ra khi gửi báo cáo, vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setCallOutcome('Khách xin dời ngày nhận kho')
    setNote('')
    setError('')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-3xl border-2 border-b-4 border-[#E5E5E5] shadow-xl w-full max-w-md mx-4 p-6 flex flex-col gap-5">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#1CB0F6] border-b-4 border-[#1899D6] flex items-center justify-center text-white shrink-0">
            <span className="material-symbols-outlined text-[26px]">phone_in_talk</span>
          </div>
          <div>
            <h2 className="text-base font-black text-[#4B4B4B] uppercase tracking-wide">Báo cáo liên hệ khách</h2>
            <p className="text-xs font-bold text-[#AFAFAF]">
              Task #{task.id} · HĐ <span className="text-[#1CB0F6]">{task.contractCode || '—'}</span>
            </p>
          </div>
          <button onClick={handleClose} className="ml-auto text-[#AFAFAF] hover:text-[#4B4B4B]">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Thẻ thông tin khách */}
        <div className="bg-[#F7F7F7] border-2 border-[#E5E5E5] rounded-2xl p-3 flex justify-between items-center text-xs">
          <div>
            <span className="text-[10px] font-black uppercase text-[#AFAFAF] block">Khách hàng</span>
            <span className="font-black text-[#4B4B4B]">{task.customerName || '—'}</span>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-black uppercase text-[#AFAFAF] block">Số điện thoại</span>
            {task.customerPhone ? (
              <a
                href={`tel:${task.customerPhone}`}
                className="font-black text-[#1CB0F6] hover:underline flex items-center gap-1 justify-end"
              >
                <span className="material-symbols-outlined text-[15px]">call</span>
                {task.customerPhone}
              </a>
            ) : (
              <span className="font-bold text-[#AFAFAF]">—</span>
            )}
          </div>
        </div>

        {/* Kết quả cuộc gọi */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-black uppercase text-[#AFAFAF] tracking-wider">
            Kết quả cuộc gọi <span className="text-[#FF4B4B]">*</span>
          </label>
          <select
            value={callOutcome}
            onChange={(e) => setCallOutcome(e.target.value)}
            className="border-2 border-[#E5E5E5] rounded-xl px-3 py-2.5 text-xs font-bold text-[#4B4B4B] focus:outline-none focus:border-[#1CB0F6]"
          >
            <option value="Khách xin dời ngày nhận kho">Khách xin dời ngày nhận kho</option>
            <option value="Khách không nghe máy / Thuê bao">Khách không nghe máy / Thuê bao</option>
            <option value="Khách từ chối nhận kho / Xin hủy đơn">Khách từ chối nhận kho / Xin hủy đơn</option>
            <option value="Khách hẹn sẽ đến trong ngày hôm nay">Khách hẹn sẽ đến trong ngày hôm nay</option>
            <option value="Khác">Khác</option>
          </select>
        </div>

        {/* Chi tiết trao đổi */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-black uppercase text-[#AFAFAF] tracking-wider">
            Ghi chú chi tiết gửi Quản lý
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="VD: Khách bận đột xuất, xin dời nhận kho sang ngày 18/10..."
            className="border-2 border-[#E5E5E5] rounded-xl px-3 py-2.5 text-xs font-bold text-[#4B4B4B] resize-none focus:outline-none focus:border-[#1CB0F6]"
          />
        </div>

        {error && <p className="text-xs font-black text-[#FF4B4B]">{error}</p>}

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button onClick={handleClose} disabled={loading} className="duo-btn-white px-5 py-2.5 text-xs">
            HỦY BỎ
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="duo-btn-green px-5 py-2.5 text-xs flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">send</span>
            <span>{loading ? 'Đang gửi...' : 'GỬI QUẢN LÝ'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
