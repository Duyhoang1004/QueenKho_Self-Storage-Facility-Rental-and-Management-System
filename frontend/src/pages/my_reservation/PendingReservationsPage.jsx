import { useEffect, useState } from 'react'
import {
  getPendingReservations,
  getAvailableUnits,
  assignStorageUnit,
} from '../../services/reservationService'

const cardStyle = {
  backgroundColor: 'rgb(255, 255, 255)',
  border: '1px solid rgb(203, 213, 225)',
  borderRadius: '0.75rem',
  boxShadow: 'rgba(0, 0, 0, 0.05) 0px 1px 2px 0px',
}

function formatVND(amount) {
  if (amount === null || amount === undefined) return '—'
  return Number(amount).toLocaleString('vi-VN') + '₫'
}

// yyyy-MM-dd -> dd/MM/yyyy (không qua Date để tránh lệch múi giờ)
function formatDate(value) {
  if (!value) return '—'
  const [y, m, d] = String(value).split('-')
  return `${d}/${m}/${y}`
}

function formatDateOnly(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('vi-VN')
}

// Số ngày còn lại tới ngày khách hẹn nhận kho (âm = đã quá hạn)
function daysUntil(value) {
  if (!value) return null
  const [y, m, d] = String(value).split('-').map(Number)
  const target = new Date(y, m - 1, d)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((target - today) / 86400000)
}

function startHint(diff) {
  if (diff === null) return null
  if (diff < 0) return { text: `Quá hạn ${-diff} ngày`, className: 'text-error font-semibold' }
  if (diff === 0) return { text: 'Hôm nay', className: 'text-error font-semibold' }
  if (diff === 1) return { text: 'Ngày mai', className: 'text-secondary font-semibold' }
  return { text: `Còn ${diff} ngày`, className: 'text-outline' }
}

function initials(name) {
  if (!name) return 'KH'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function readUserId() {
  const user = JSON.parse(sessionStorage.getItem('user') || '{}')
  return user.userId ?? null
}

export default function PendingReservationsPage() {
  const userId = readUserId()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(Boolean(userId))
  const [error, setError] = useState(userId ? '' : 'Bạn cần đăng nhập để xem danh sách đơn chờ gán ô.')
  const [reloadKey, setReloadKey] = useState(0)

  // Modal gán ô kho (UC-14 Stitch popup)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [availableUnits, setAvailableUnits] = useState([])
  const [loadingUnits, setLoadingUnits] = useState(false)
  const [unitError, setUnitError] = useState('')
  const [selectedUnitId, setSelectedUnitId] = useState('')
  const [internalNotes, setInternalNotes] = useState('Đã vệ sinh sạch sẽ, mã thẻ từ/mã PIN đã sẵn sàng cấp phát.')
  const [sendSms, setSendSms] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (!userId) return

    let cancelled = false
    // Backend tự lấy cơ sở của quản lý theo userId (users.facility_id)
    getPendingReservations({ managerId: userId })
      .then((data) => {
        if (cancelled) return
        setItems(data)
        setError('')
      })
      .catch((err) => {
        if (cancelled) return
        setError(err.response?.data?.message || 'Không tải được danh sách đơn chờ gán ô. Vui lòng thử lại.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [userId, reloadKey])

  const reload = () => {
    setError('')
    setLoading(true)
    setReloadKey((k) => k + 1)
  }

  // Mở popup Duyệt & Gán ô kho (Stitch modal)
  const openAssignModal = async (order) => {
    setSelectedOrder(order)
    setSelectedUnitId('')
    setUnitError('')
    setInternalNotes('Đã vệ sinh sạch sẽ, mã thẻ từ/mã PIN đã sẵn sàng cấp phát.')
    setSendSms(true)
    setIsModalOpen(true)
    setLoadingUnits(true)

    try {
      const units = await getAvailableUnits(order.id)
      setAvailableUnits(units || [])
      if (units && units.length > 0) {
        setSelectedUnitId(units[0].id)
      }
    } catch (err) {
      setUnitError(err.response?.data?.message || 'Không tải được danh sách ô kho trống phù hợp.')
    } finally {
      setLoadingUnits(false)
    }
  }

  const closeModal = () => {
    if (submitting) return
    setIsModalOpen(false)
    setSelectedOrder(null)
    setAvailableUnits([])
    setSelectedUnitId('')
    setUnitError('')
  }

  const handleConfirmAssignment = async () => {
    if (!selectedOrder || !selectedUnitId) return
    setSubmitting(true)
    try {
      await assignStorageUnit(selectedOrder.id, {
        storageUnitId: selectedUnitId,
        notes: internalNotes,
      })
      const assignedCode = selectedUnitId
      const orderCode = selectedOrder.reservationCode
      closeModal()
      setToast({
        type: 'success',
        message: `Đã gán ô kho ${assignedCode} cho đơn #${orderCode} thành công! Đơn đã chuyển sang trạng thái "Đã gán ô".`,
      })
      reload()
    } catch (err) {
      alert(err.response?.data?.message || 'Có lỗi xảy ra khi gán ô kho. Vui lòng thử lại.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-content-max-width mx-auto px-gutter py-space-lg">
      <div className="flex flex-col w-full gap-space-lg">
        {/* Banner tiêu đề */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md bg-surface-container-lowest rounded-xl p-space-lg shadow-sm">
          <div className="flex items-start gap-space-md">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-on-primary shrink-0 shadow-sm">
              <span className="material-symbols-outlined text-[28px]">pending_actions</span>
            </div>
            <div className="flex flex-col">
              <span className="self-start font-label-sm text-label-sm text-secondary uppercase tracking-wider bg-secondary-fixed/50 px-2 py-0.5 rounded-full">
                Hàng đợi xử lý
              </span>
              <h1 className="font-display-lg text-display-lg text-primary tracking-tight mt-1">
                Đơn chờ gán ô kho
              </h1>
              <p className="font-body-md text-body-md text-on-surface-variant mt-1">
                Các đơn khách đã thanh toán cọc nhưng chưa được gán ô kho thực tế. Đơn cũ nhất được xếp trước.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-space-md shrink-0 self-start md:self-center">
            <div className="bg-surface-container-low px-space-md py-space-xs rounded-xl flex flex-col">
              <span className="font-label-sm text-label-sm text-on-surface-variant">Chờ gán kho</span>
              <span className="font-title-md text-title-md text-primary">
                {loading ? '—' : `${items.length} đơn`}
              </span>
            </div>
            <button
              type="button"
              onClick={reload}
              disabled={loading}
              className="h-10 px-space-md bg-surface-container hover:bg-surface-container-high text-on-surface font-label-lg text-label-lg rounded-lg flex items-center gap-space-xs transition-colors disabled:opacity-60"
            >
              <span className={`material-symbols-outlined text-[18px] ${loading ? 'animate-spin' : ''}`}>sync</span>
              <span>Làm mới</span>
            </button>
          </div>
        </div>

        {/* Bảng danh sách */}
        <div className="bg-surface-container-lowest overflow-hidden flex flex-col" style={cardStyle}>
          {loading && <p className="px-space-lg py-space-lg text-on-surface-variant">Đang tải danh sách...</p>}

          {!loading && error && (
            <div className="px-space-lg py-space-lg flex flex-col items-start gap-3">
              <p className="text-error">{error}</p>
              <button
                type="button"
                onClick={reload}
                className="px-4 py-2 bg-primary text-on-primary rounded font-label-lg text-label-lg hover:opacity-90"
              >
                Thử lại
              </button>
            </div>
          )}

          {!loading && !error && items.length === 0 && (
            <div className="px-space-lg py-space-2xl flex flex-col items-center gap-2 text-center">
              <span className="material-symbols-outlined text-[40px] text-outline">task_alt</span>
              <p className="text-on-surface-variant">Không có đơn nào đang chờ gán ô kho.</p>
            </div>
          )}

          {!loading && !error && items.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low/50 text-outline text-label-sm font-label-sm uppercase tracking-wider">
                      <th className="py-3.5 px-space-md">Mã đặt cọc</th>
                      <th className="py-3.5 px-space-md">Ngày cọc</th>
                      <th className="py-3.5 px-space-md">Khách hàng</th>
                      <th className="py-3.5 px-space-md">Số điện thoại</th>
                      <th className="py-3.5 px-space-md">Loại kho đã chọn</th>
                      <th className="py-3.5 px-space-md">Chu kỳ thuê</th>
                      <th className="py-3.5 px-space-md">Ngày hẹn nhận kho</th>
                      <th className="py-3.5 px-space-md">Tiền cọc đã thu</th>
                      <th className="py-3.5 px-space-md text-right pr-space-lg">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container text-body-md font-body-md text-on-surface">
                    {items.map((r) => {
                      const hint = startHint(daysUntil(r.startDate))
                      return (
                        <tr key={r.id} className="transition-colors hover:bg-slate-50">
                          <td className="py-4 px-4 align-middle font-code-md text-code-md font-semibold text-secondary">
                            {r.reservationCode}
                          </td>
                          <td className="py-4 px-4 align-middle text-on-surface-variant font-code-md text-code-md">
                            {formatDateOnly(r.createdAt)}
                          </td>
                          <td className="py-4 px-4 align-middle">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center font-title-md text-label-sm">
                                {initials(r.customerName)}
                              </div>
                              <span className="font-title-md text-body-md text-on-surface leading-snug">
                                {r.customerName}
                              </span>
                            </div>
                          </td>
                          <td className="py-4 px-4 align-middle font-code-md text-code-md">{r.customerPhone || '—'}</td>
                          <td className="py-4 px-4 align-middle">
                            <span
                              className="inline-flex items-center px-2.5 py-1 rounded-md font-label-md text-label-md"
                              style={{ color: '#1D4ED8', border: '1px solid #93C5FD', backgroundColor: '#DBEAFE' }}
                            >
                              {r.unitTypeName}
                            </span>
                          </td>
                          <td className="py-4 px-4 align-middle font-label-lg text-label-lg">Thuê {r.durationMonths} tháng</td>
                          <td className="py-4 px-4 align-middle">
                            <div className="flex flex-col">
                              <span className="font-code-md text-code-md">{formatDate(r.startDate)}</span>
                              {hint && <span className={`text-label-sm font-label-sm ${hint.className}`}>{hint.text}</span>}
                            </div>
                          </td>
                          <td className="py-4 px-4 align-middle font-title-md text-title-md text-tertiary-container font-semibold">
                            {formatVND(r.depositAmount)}
                          </td>
                          <td className="py-4 px-4 align-middle text-right pr-space-lg">
                            <button
                              type="button"
                              onClick={() => openAssignModal(r)}
                              className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-container text-on-primary rounded-lg font-label-lg text-label-lg shadow-sm transition-all active:scale-95"
                            >
                              <span className="material-symbols-outlined text-[18px]">domain_verification</span>
                              <span>Gán ô kho</span>
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-space-lg py-3.5 bg-surface-container-low/40 font-body-sm text-body-sm text-on-surface-variant">
                Tổng cộng <span className="font-semibold text-on-surface">{items.length}</span> đơn đang chờ gán ô kho
              </div>
            </>
          )}
        </div>
      </div>

      {/* Pop-up Duyệt Đơn & Gán Ô Kho theo thiết kế Stitch */}
      {isModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 relative flex flex-col max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Gán Ô Kho - Mã #{selectedOrder.reservationCode}
                </h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  Khách hàng: <span className="font-medium text-slate-700">{selectedOrder.customerName}</span> • Nhu cầu: <span className="font-medium text-slate-700">{selectedOrder.unitTypeName}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                disabled={submitting}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100"
              >
                <span className="material-symbols-outlined text-[22px]">close</span>
              </button>
            </div>

            {/* Khung tóm tắt 3 cột */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 my-4 grid grid-cols-3 gap-2 text-center">
              <div className="flex flex-col">
                <span className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Mã đặt cọc</span>
                <span className="font-bold text-sm text-slate-800 font-mono mt-0.5">#{selectedOrder.reservationCode}</span>
              </div>
              <div className="flex flex-col border-x border-slate-200">
                <span className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Tiền cọc đã thu</span>
                <span className="font-bold text-sm text-emerald-600 mt-0.5">{formatVND(selectedOrder.depositAmount)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Hẹn nhận dự kiến</span>
                <span className="font-bold text-sm text-slate-800 mt-0.5">{formatDate(selectedOrder.startDate)}</span>
              </div>
            </div>

            {/* Danh sách chọn ô kho */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Chọn ô kho trống phù hợp để cấp quyền <span className="text-error">*</span>
                </label>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  • {availableUnits.length} ô đang khả dụng
                </span>
              </div>

              {loadingUnits && (
                <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-500">
                  <span className="material-symbols-outlined animate-spin text-[28px] text-primary">sync</span>
                  <span className="text-xs">Đang tìm các ô kho khả dụng...</span>
                </div>
              )}

              {!loadingUnits && unitError && (
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200">
                  {unitError}
                </div>
              )}

              {!loadingUnits && !unitError && availableUnits.length === 0 && (
                <div className="p-4 bg-amber-50 text-amber-800 text-xs rounded-lg border border-amber-200 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-amber-600">warning</span>
                  <span>Hiện tại không có ô kho trống nào phù hợp với loại kho này tại cơ sở.</span>
                </div>
              )}

              {!loadingUnits && !unitError && availableUnits.length > 0 && (
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {availableUnits.map((u, idx) => {
                    const isSelected = selectedUnitId === u.id
                    const isRecommended = idx === 0
                    return (
                      <div
                        key={u.id}
                        onClick={() => setSelectedUnitId(u.id)}
                        className={`p-3 rounded-xl cursor-pointer flex items-center justify-between transition-all ${
                          isSelected
                            ? 'border-2 border-blue-600 bg-blue-50/70 shadow-sm'
                            : 'border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                              isSelected ? 'border-2 border-blue-600' : 'border border-slate-300'
                            }`}
                          >
                            {isSelected && <div className="w-2 h-2 rounded-full bg-blue-600" />}
                          </div>
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-sm text-slate-900">{u.id}</span>
                              <span className="text-slate-400">•</span>
                              <span className="text-xs font-semibold text-slate-700">
                                {u.areaSqm ? `${u.areaSqm} m²` : (selectedOrder.unitTypeName || '')}
                              </span>
                              {isRecommended && (
                                <span className="text-[11px] font-semibold text-amber-700 bg-amber-100/90 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                                  ⚡ Khuyên dùng gán ngay
                                </span>
                              )}
                            </div>
                            <div className={`text-xs mt-0.5 ${isSelected ? 'text-blue-700 font-medium' : 'text-slate-500'}`}>
                              Tầng {u.floor || '1'} • Khu vực {u.zone || 'A'} • {u.roomNumber ? `Phòng ${u.roomNumber}` : 'Giữa dãy hành lang • Thông thoáng'}
                            </div>
                          </div>
                        </div>
                        <div>
                          {isSelected ? (
                            <span className="bg-blue-600 text-white font-semibold text-xs px-3 py-1 rounded-md shadow-sm">
                              Đang chọn
                            </span>
                          ) : (
                            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs px-2.5 py-1 rounded-full font-medium">
                              • Sẵn sàng
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Ghi chú bàn giao nội bộ */}
            <div className="mt-4">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">edit_note</span>
                Ghi chú bàn giao nội bộ
              </label>
              <textarea
                rows={2}
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                placeholder="Đã vệ sinh sạch sẽ, mã thẻ từ/mã PIN đã sẵn sàng cấp phát..."
                className="w-full mt-1.5 p-2.5 text-xs text-slate-700 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50 resize-none"
              />
            </div>

            {/* Checkbox gửi SMS */}
            <label className="flex items-center gap-2 mt-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={sendSms}
                onChange={(e) => setSendSms(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
              />
              <span className="text-xs text-slate-600">
                Tự động gửi tin nhắn SMS Brandname QueenKho & thông báo Zalo ZNS kèm mã nhận phòng cho khách
              </span>
            </label>

            {/* Actions Footer */}
            <div className="flex items-center justify-end gap-3 mt-5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={closeModal}
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors disabled:opacity-60"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmAssignment}
                disabled={submitting || !selectedUnitId || availableUnits.length === 0}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-all flex items-center gap-2 shadow-sm disabled:opacity-50 active:scale-95"
              >
                {submitting ? (
                  <>
                    <span className="material-symbols-outlined text-[18px] animate-spin">sync</span>
                    <span>Đang xử lý...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">verified</span>
                    <span>Xác nhận gán phòng & Gửi SMS</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast thông báo thành công */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 border border-slate-700">
          <span className="material-symbols-outlined text-emerald-400 text-[24px]">check_circle</span>
          <div className="flex-1 text-xs">{toast.message}</div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-white p-1"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}
    </div>
  )
}