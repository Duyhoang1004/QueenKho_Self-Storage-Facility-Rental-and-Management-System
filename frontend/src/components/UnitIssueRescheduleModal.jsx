import { useState } from 'react'
import DateInput from './DateInput'
import { formatIsoDate } from '../utils/date'
import { rescheduleForUnitIssue } from '../services/reservationService'

// BR-141 (12/11/2026): ô đã gán gặp sự cố trước ngày nhận kho → khách tự chọn ngày nhận kho mới
const toIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const addDays = (n) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return toIso(d)
}
const MAX_LEAD_DAYS = 90 // PR-B4

export default function UnitIssueRescheduleModal({ reservation, onClose, onDone }) {
  const tomorrow = addDays(1)
  const [newStartDate, setNewStartDate] = useState(() => {
    const current = reservation?.startDate
    return current && current > tomorrow ? addDaysFrom(current, 7) : addDays(7)
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (!reservation) return null

  const submit = async () => {
    if (!newStartDate) {
      setError('Vui lòng chọn ngày nhận kho mới.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = await rescheduleForUnitIssue(reservation.id, newStartDate)
      onDone?.(res?.message || `Đã dời ngày nhận kho sang ${formatIsoDate(newStartDate)}.`)
    } catch (err) {
      setError(err.response?.data?.message || 'Không dời được ngày nhận kho, vui lòng thử lại.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="duo-card bg-white w-full max-w-[460px] p-6 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-black text-[#4B4B4B]">Dời ngày nhận kho — đơn {reservation.reservationCode}</h2>
        <p className="text-xs font-bold text-[#777777] leading-relaxed">
          Ô kho đã gán cho bạn đang bảo trì do sự cố của cơ sở. Chọn ngày nhận kho mới (từ ngày mai, tối đa {MAX_LEAD_DAYS} ngày);
          hạn hợp đồng lùi theo, không thu thêm phí. Cơ sở sẽ sửa ô hoặc đổi ô cùng loại cho bạn trước ngày này.
        </p>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-black uppercase text-[#AFAFAF]">Ngày nhận kho mới *</span>
          <DateInput
            value={newStartDate}
            min={tomorrow}
            max={addDays(MAX_LEAD_DAYS)}
            onChange={(e) => { setNewStartDate(e.target.value); setError('') }}
            className="duo-input w-full text-sm"
          />
        </label>
        {error && <p className="text-xs font-bold text-[#FF4B4B]">{error}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} disabled={busy} className="duo-btn-white px-4 py-2 text-xs">Đóng</button>
          <button type="button" onClick={submit} disabled={busy} className="duo-btn-blue px-4 py-2 text-xs disabled:opacity-50">
            {busy ? 'Đang dời...' : 'Xác nhận dời lịch'}
          </button>
        </div>
      </div>
    </div>
  )
}

function addDaysFrom(iso, n) {
  const [y, m, d] = String(iso).split('-').map(Number)
  return toIso(new Date(y, m - 1, d + n))
}
