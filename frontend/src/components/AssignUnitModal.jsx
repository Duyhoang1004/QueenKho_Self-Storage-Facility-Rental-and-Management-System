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
          // Ưu tiên chọn ô kho có cùng loại với đơn khách đặt
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-inverse-surface/45 backdrop-blur-sm transition-opacity duration-200">
      <div
        className="bg-surface-container-lowest rounded-2xl w-full max-w-[620px] shadow-2xl flex flex-col overflow-hidden max-h-[92vh]"
        style={{ backgroundColor: 'rgb(255, 255, 255)', border: '1px solid rgb(203, 213, 225)', borderRadius: '1rem', color: 'rgb(31, 41, 55)' }}
      >
        {/* Modal Header */}
        <div className="bg-surface-container-low px-space-lg py-space-md flex items-start justify-between border-b border-surface-container">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
              <span className="material-symbols-outlined text-[24px]">key</span>
            </div>
            <div className="flex flex-col">
              <h2 className="font-title-lg text-title-lg text-primary tracking-tight">
                Phân Bổ Ô Kho Thực Tế Cho Đơn {reservation.reservationCode}
              </h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                Khách hàng: <span className="font-semibold text-on-surface">{reservation.customerName}</span> • Yêu cầu:{' '}
                <span className="font-semibold text-secondary">{reservation.unitTypeName}</span>
              </p>
            </div>
          </div>
          <button
            className="w-8 h-8 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container flex items-center justify-center transition-colors"
            onClick={onClose}
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-space-lg overflow-y-auto flex flex-col gap-space-lg">
          {/* Summary Box */}
          <div className="bg-surface-container-low p-space-md rounded-xl grid grid-cols-3 gap-space-sm text-left">
            <div className="flex flex-col">
              <span className="font-label-sm text-label-sm text-on-surface-variant">Mã đặt cọc</span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">Mã đơn</span>
              <span className="font-code-md text-code-md text-primary font-bold">{reservation.reservationCode}</span>
            </div>
            <div className="flex flex-col">
              <span className="font-label-sm text-label-sm text-on-surface-variant">Tiền cọc đã thu</span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">Tiền cọc</span>
              <span className="font-title-md text-title-md text-tertiary-container font-semibold">
                {formatVND(reservation.depositAmount)}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="font-label-sm text-label-sm text-on-surface-variant">Hẹn nhận dự kiến</span>
              <span className="font-code-md text-code-md text-on-surface font-semibold">
                {formatDate(reservation.startDate)}
              </span>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-error-container/30 border border-error-container text-error rounded-xl font-body-sm text-body-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span>{error}</span>
            </div>
          )}

          {/* Unit Selection Section */}
          <div className="flex flex-col gap-space-sm">
            <div className="flex items-center justify-between">
              <label className="font-title-md text-title-md flex items-center gap-1.5" style={{ color: '#1F2937' }}>
                <span>Chọn ô kho trống phù hợp để cấp quyền</span>
                <span className="text-error">*</span>
              </label>
              {!loadingUnits && (
                <span className="font-label-sm text-label-sm font-semibold flex items-center gap-1" style={{ color: '#15803D' }}>
                  <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: '#15803D' }}></span>
                  {units.length} ô đang khả dụng
                </span>
              )}
            </div>

            {loadingUnits && (
              <div className="py-8 flex flex-col items-center justify-center gap-2 text-on-surface-variant">
                <span className="material-symbols-outlined animate-spin text-[28px] text-primary">sync</span>
                <span className="text-body-sm font-body-sm">Đang tải danh sách ô kho trống...</span>
              </div>
            )}

            {!loadingUnits && units.length === 0 && (
              <div className="py-6 text-center text-outline bg-surface-container-low rounded-xl">
                Không tìm thấy ô kho nào đang ở trạng thái Trống (AVAILABLE) tại cơ sở này.
              </div>
            )}

            {!loadingUnits && units.length > 0 && (
              <div className="flex flex-col gap-2.5 max-h-[260px] overflow-y-auto pr-1">
                {units.map((unit) => {
                  const isSelected = selectedUnitId === unit.id
                  const isRecommended = unit.unitTypeName === reservation.unitTypeName

                  return (
                    <label
                      key={unit.id}
                      onClick={() => setSelectedUnitId(unit.id)}
                      className={`relative flex items-center justify-between p-space-md rounded-xl cursor-pointer transition-all shadow-sm ${
                        isSelected
                          ? 'bg-[#F0F7FF] border-[1.5px] border-[#93C5FD]'
                          : 'bg-white border border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-space-md">
                        <input
                          type="radio"
                          name="unit_select"
                          checked={isSelected}
                          onChange={() => setSelectedUnitId(unit.id)}
                          className="w-4 h-4 text-secondary focus:ring-secondary accent-secondary cursor-pointer"
                        />
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className={`font-code-md text-title-md font-bold ${isSelected ? 'text-secondary' : 'text-on-surface'}`}>
                              {unit.id}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-surface-container font-label-sm text-label-sm text-on-surface-variant">
                              {unit.areaSqm} m²
                            </span>
                            {isRecommended && (
                              <span
                                className="px-2 py-0.5 rounded-full font-label-sm text-[11px] font-bold flex items-center gap-1"
                                style={{ color: '#15803D', border: '1px solid #86EFAC', backgroundColor: '#DCFCE7' }}
                              >
                                <span className="material-symbols-outlined text-[13px]">thumb_up</span>
                                Đúng loại kho khách đặt
                              </span>
                            )}
                          </div>
                          <div className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                            {unit.locationDesc || `Phòng ${unit.roomNumber || unit.id} • Sẵn sàng`}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isSelected ? (
                          <span
                            className="px-2.5 py-1 rounded-full font-label-sm text-label-sm font-bold"
                            style={{ color: '#1D4ED8', border: '1px solid #93C5FD', backgroundColor: '#DBEAFE' }}
                          >
                            Đang chọn
                          </span>
                        ) : (
                          <span
                            className="px-2.5 py-1 rounded-full font-label-sm text-label-sm font-semibold flex items-center gap-1"
                            style={{ color: '#15803D', border: '1px solid #86EFAC', backgroundColor: '#DCFCE7' }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#15803D' }}></span>
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

          {/* Internal Notes */}
          <div className="flex flex-col gap-space-xs">
            <label className="font-title-md text-body-md text-primary flex items-center gap-1.5" htmlFor="assignNote">
              <span className="material-symbols-outlined text-[18px] text-on-surface-variant">edit_note</span>
              <span>Ghi chú bàn giao &amp; Kích hoạt thẻ bảo mật</span>
            </label>
            <div className="relative">
              <textarea
                className="w-full p-space-sm bg-surface-container-lowest border border-slate-300 text-on-surface rounded-lg font-body-sm text-body-sm focus:outline-none focus:ring-2 focus:ring-secondary transition-all"
                id="assignNote"
                rows="2"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            <p className="font-label-sm text-label-sm text-outline flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">info</span>
              Nội dung này sẽ lưu vào biên bản bàn giao cơ sở và thông báo gửi kèm khách hàng.
            </p>
          </div>

          {/* Automated Notification */}
          <div className="flex items-center gap-space-sm p-3 bg-surface-container-low/70 rounded-xl border border-surface-container">
            <input
              id="autoNotify"
              type="checkbox"
              checked={autoNotify}
              onChange={(e) => setAutoNotify(e.target.checked)}
              className="w-4 h-4 text-secondary accent-secondary rounded cursor-pointer"
            />
            <label className="font-body-sm text-body-sm text-on-surface cursor-pointer select-none" htmlFor="autoNotify">
              Tự động gửi tin nhắn SMS Brandname &amp; thông báo Zalo ZNS kèm mã QR mở khóa phòng lưu kho cho khách.
            </label>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-surface-container-low px-space-lg py-space-md flex items-center justify-between border-t border-surface-container">
          <button
            className="h-10 px-space-md bg-surface-container hover:bg-surface-container-high text-on-surface font-label-lg text-label-lg rounded-lg transition-colors"
            onClick={onClose}
            type="button"
            disabled={submitting}
          >
            Hủy bỏ
          </button>
          <button
            className="h-10 px-space-lg bg-primary hover:bg-primary-container text-on-primary font-label-lg text-label-lg rounded-lg flex items-center gap-2 shadow-sm transition-all disabled:opacity-60"
            onClick={handleConfirm}
            type="button"
            disabled={submitting || !selectedUnitId || units.length === 0}
          >
            {submitting ? (
              <>
                <span className="material-symbols-outlined text-[20px] animate-spin">sync</span>
                <span>Đang xử lý...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[20px]">assignment_turned_in</span>
                <span>Xác nhận gán phòng &amp; Cấp quyền</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
