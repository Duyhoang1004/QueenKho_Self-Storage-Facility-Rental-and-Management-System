import { useEffect, useState } from 'react'
import { getPendingReservations } from '../../services/reservationService'
import AssignUnitModal from '../../components/AssignUnitModal'

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

  // State cho Pop-up Gán ô kho (Modal)
  const [selectedReservation, setSelectedReservation] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [toast, setToast] = useState(null)

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

  // Mở popup gán ô kho thực tế (Stitch modal)
  const openAssign = (item) => {
    setSelectedReservation(item)
    setIsModalOpen(true)
  }

  const handleAssignSuccess = (unitId, code) => {
    setToast({
      title: 'Gán ô kho thành công!',
      desc: `Đã phân bổ ô ${unitId} cho đơn ${code} & kích hoạt trạng thái gán kho.`,
    })
    reload()
    setTimeout(() => {
      setToast(null)
    }, 4500)
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
                Các đơn khách hàng đã đặt đang chờ gán ô kho thực tế. Đơn cũ nhất được xếp trước.
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
                      <th className="py-3.5 px-space-md">Mã đơn</th>
                      <th className="py-3.5 px-space-md">Ngày đặt</th>
                      <th className="py-3.5 px-space-md">Khách hàng</th>
                      <th className="py-3.5 px-space-md">Số điện thoại</th>
                      <th className="py-3.5 px-space-md">Loại kho đã chọn</th>
                      <th className="py-3.5 px-space-md">Chu kỳ thuê</th>
                      <th className="py-3.5 px-space-md">Ngày hẹn nhận kho</th>
                      <th className="py-3.5 px-space-md">Tiền cọc đã thu</th>
                      <th className="py-3.5 px-space-md">Tiền cọc</th>
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
                              onClick={() => openAssign(r)}
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

      {/* Pop-up Modal Phân Bổ Ô Kho Thực Tế (Stitch Design) */}
      <AssignUnitModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        reservation={selectedReservation}
        onSuccess={handleAssignSuccess}
      />

      {/* Toast Notification khi Gán Kho Thành Công */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 transform transition-all duration-300 flex items-center gap-3 bg-primary text-on-primary px-space-lg py-space-md rounded-xl shadow-2xl">
          <div className="w-8 h-8 rounded-full bg-tertiary-container flex items-center justify-center text-on-tertiary-container">
            <span className="material-symbols-outlined text-[20px]">check</span>
          </div>
          <div className="flex flex-col">
            <span className="font-title-md text-body-md font-semibold text-on-primary">{toast.title}</span>
            <span className="font-body-sm text-label-sm text-surface-container-high">{toast.desc}</span>
          </div>
        </div>
      )}
    </div>
  )
}