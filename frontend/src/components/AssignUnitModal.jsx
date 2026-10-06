import { useEffect, useState } from 'react'
import { getAvailableUnits, assignStorageUnit } from '../services/reservationService'

function formatVND(amount) {
  if (amount === null || amount === undefined) return '—'
  return Number(amount).toLocaleString('vi-VN') + '₫'
}

function formatDate(value) {
  if (!value) return '—'
  const [y, m, d] = String(value).split('-')
  return `${d}/${m}/${y}`
}

export default function AssignUnitModal({ isOpen, onClose, reservation, onSuccess }) {
  const [units, setUnits] = useState([])
  const [loadingUnits, setLoadingUnits] = useState(false)
  const [selectedUnitId, setSelectedUnitId] = useState('')
  const [note, setNote] = useState('Đã vệ sinh sạch sẽ, mã thẻ từ & cảm biến SmartLock đã sẵn sàng cấp phát.')
  const [autoNotify, setAutoNotify] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen || !reservation) return

    setLoadingUnits(true)
    setError('')
    setSelectedUnitId('')

    getAvailableUnits(reservation.id)
      .then((data) => {
        setUnits(data || [])
        if (data && data.length > 0) {
          const matched = data.find(u => u.unitTypeName === reservation.unitTypeName)
          setSelectedUnitId(matched ? matched.id : data[0].id)
        }
      })
      .catch((err) => {
        setError(err.response?.data?.message || 'Không thể tải danh sách ô kho trống.')
      })
      .finally(() => {
        setLoadingUnits(false)
      })
  }, [isOpen, reservation])

  if (!isOpen || !reservation) return null

  const handleConfirm = async () => {
    if (!selectedUnitId) {
      setError('Vui lòng chọn một ô kho để gán.')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      await assignStorageUnit(reservation.id, {
        storageUnitId: selectedUnitId,
        note: note.trim()
      })
      onSuccess(selectedUnitId, reservation.reservationCode)
      onClose()
    } catch (err) {
      setError(err.response?.data?.message || 'Gán ô kho thất bại. Vui lòng thử lại.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs select-none">
      <div className="duo-card bg-white w-full max-w-[620px] shadow-2xl flex flex-col overflow-hidden max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b-2 border-[#E5E5E5] bg-[#FAFAFA]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#58CC02] border-b-2 border-[#58A700] text-white flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[24px]">key</span>
            </div>
            <div>
              <h2 className="text-base font-black text-[#4B4B4B] uppercase tracking-wider">
                Gán Ô Kho: #{reservation.reservationCode}
              </h2>
              <p className="text-xs font-bold text-[#AFAFAF]">
                Khách: <span className="text-[#4B4B4B]">{reservation.customerName}</span> • Yêu cầu: <span className="text-[#1CB0F6]">{reservation.unitTypeName}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl text-[#AFAFAF] hover:text-[#4B4B4B] hover:bg-[#E5E5E5] flex items-center justify-center transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex flex-col gap-5">
          {/* Summary Box */}
          <div className="bg-[#F7F7F7] border-2 border-[#E5E5E5] p-4 rounded-2xl grid grid-cols-3 gap-3 text-left">
            <div>
              <span className="text-[10px] font-black uppercase text-[#AFAFAF]">Mã đơn</span>
              <p className="text-sm font-black text-[#1CB0F6] mt-0.5">{reservation.reservationCode}</p>
            </div>
            <div>
              <span className="text-[10px] font-black uppercase text-[#AFAFAF]">Tiền cọc</span>
              <p className="text-sm font-black text-[#58CC02] mt-0.5">{formatVND(reservation.depositAmount)}</p>
            </div>
            <div>
              <span className="text-[10px] font-black uppercase text-[#AFAFAF]">Hẹn nhận</span>
              <p className="text-sm font-black text-[#4B4B4B] mt-0.5">{formatDate(reservation.startDate)}</p>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-[#FFF5F5] border-2 border-[#FFDFDF] text-[#FF4B4B] rounded-2xl text-xs font-black flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span>{error}</span>
            </div>
          )}

          {/* Unit Selection Section */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-wider text-[#4B4B4B]">
                Chọn ô kho trống để cấp quyền <span className="text-[#FF4B4B]">*</span>
              </label>
              {!loadingUnits && (
                <span className="duo-badge bg-[#D7FFB8] text-[#58A700] border border-[#58CC02] text-[10px]">
                  {units.length} ô khả dụng
                </span>
              )}
            </div>

            {loadingUnits && (
              <div className="py-8 flex flex-col items-center justify-center gap-2 text-[#AFAFAF]">
                <span className="material-symbols-outlined animate-spin text-[28px] text-[#58CC02]">sync</span>
                <span className="text-xs font-bold">Đang tải danh sách ô kho trống...</span>
              </div>
            )}

            {!loadingUnits && units.length === 0 && (
              <div className="py-6 text-center text-xs font-bold text-[#AFAFAF] bg-[#F7F7F7] rounded-2xl border-2 border-[#E5E5E5]">
                Không tìm thấy ô kho nào đang ở trạng thái Trống tại cơ sở này.
              </div>
            )}

            {!loadingUnits && units.length > 0 && (
              <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
                {units.map((unit) => {
                  const isSelected = selectedUnitId === unit.id
                  const isRecommended = unit.unitTypeName === reservation.unitTypeName

                  return (
                    <label
                      key={unit.id}
                      onClick={() => setSelectedUnitId(unit.id)}
                      className={`duo-btn p-3 flex items-center justify-between rounded-2xl cursor-pointer text-left h-auto ${
                        isSelected
                          ? 'bg-[#DDF4FF] border-2 border-b-4 border-[#1899D6] text-[#1CB0F6]'
                          : 'bg-white border-2 border-b-4 border-[#E5E5E5] text-[#4B4B4B] hover:bg-[#F7F7F7]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="unit_select"
                          checked={isSelected}
                          onChange={() => setSelectedUnitId(unit.id)}
                          className="w-4 h-4 accent-[#1CB0F6] cursor-pointer"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-black">{unit.id}</span>
                            <span className="text-[10px] font-black uppercase bg-[#F7F7F7] px-2 py-0.5 rounded-full border border-[#E5E5E5] text-[#777777]">
                              {unit.areaSqm} m²
                            </span>
                            {isRecommended && (
                              <span className="duo-badge bg-[#D7FFB8] text-[#58A700] border border-[#58CC02] text-[9px]">
                                Đúng loại kho
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] font-bold text-[#AFAFAF] mt-0.5">
                            {unit.locationDesc || `Phòng ${unit.roomNumber || unit.id}`}
                          </div>
                        </div>
                      </div>

                      <div>
                        {isSelected ? (
                          <span className="duo-badge bg-[#DDF4FF] text-[#1CB0F6] border-2 border-[#84D8FF] text-[10px]">
                            Đang chọn
                          </span>
                        ) : (
                          <span className="duo-badge bg-[#D7FFB8] text-[#58A700] border-2 border-[#58CC02] text-[10px]">
                            Sẵn sàng
                          </span>
                        )}
                      </div>
                    </label>
                  )
                })}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-black uppercase tracking-wider text-[#777777]" htmlFor="assignNote">
              Ghi chú bàn giao & Kích hoạt SmartLock
            </label>
            <textarea
              className="duo-input w-full text-xs"
              id="assignNote"
              rows="2"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {/* Automated Notification */}
          <div className="flex items-center gap-3 p-3 bg-[#FAFAFA] rounded-2xl border-2 border-[#E5E5E5]">
            <input
              id="autoNotify"
              type="checkbox"
              checked={autoNotify}
              onChange={(e) => setAutoNotify(e.target.checked)}
              className="w-4 h-4 accent-[#58CC02] rounded cursor-pointer"
            />
            <label className="text-xs font-bold text-[#4B4B4B] cursor-pointer" htmlFor="autoNotify">
              Tự động gửi SMS & Zalo thông báo kèm mã mở khóa SmartLock cho khách hàng.
            </label>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-[#FAFAFA] border-t-2 border-[#E5E5E5] flex items-center justify-between">
          <button
            className="duo-btn-gray px-4 py-2 text-xs"
            onClick={onClose}
            type="button"
            disabled={submitting}
          >
            HỦY BỎ
          </button>
          <button
            className="duo-btn-green px-5 py-2.5 text-xs tracking-wider disabled:opacity-50"
            onClick={handleConfirm}
            type="button"
            disabled={submitting || !selectedUnitId || units.length === 0}
          >
            {submitting ? 'ĐANG XỬ LÝ...' : 'XÁC NHẬN GÁN PHÒNG'}
          </button>
        </div>
      </div>
    </div>
  )
}
