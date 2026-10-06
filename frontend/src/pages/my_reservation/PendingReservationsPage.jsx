import { useEffect, useState } from 'react'
import { getPendingReservations } from '../../services/reservationService'
import AssignUnitModal from '../../components/AssignUnitModal'

function formatVND(amount) {
  if (amount === null || amount === undefined) return '—'
  return Number(amount).toLocaleString('vi-VN') + '₫'
}

function formatDate(value) {
  if (!value) return '—'
  const [y, m, d] = String(value).split('-')
  return `${d}/${m}/${y}`
}

function formatDateOnly(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('vi-VN')
}

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
  if (diff < 0) return { text: `Quá hạn ${-diff} ngày`, className: 'text-[#FF4B4B] font-black' }
  if (diff === 0) return { text: 'Hôm nay', className: 'text-[#FF4B4B] font-black' }
  if (diff === 1) return { text: 'Ngày mai', className: 'text-[#FF9600] font-black' }
  return { text: `Còn ${diff} ngày`, className: 'text-[#AFAFAF] font-bold' }
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

  const [selectedReservation, setSelectedReservation] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    if (!userId) return

    let cancelled = false
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

  const openAssign = (item) => {
    setSelectedReservation(item)
    setIsModalOpen(true)
  }

  const handleAssignSuccess = (unitId, code) => {
    setToast({
      title: 'Gán ô kho thành công!',
      desc: `Đã phân bổ ô ${unitId} cho đơn ${code} & kích hoạt mã mở khóa.`,
    })
    reload()
    setTimeout(() => {
      setToast(null)
    }, 4500)
  }

  return (
    <div className="max-w-[1200px] mx-auto px-8 py-8 select-none">
      <div className="flex flex-col gap-6">

        {/* Toast notification */}
        {toast && (
          <div className="duo-card p-4 bg-[#D7FFB8] border-2 border-[#58CC02] flex items-center justify-between text-[#58A700]">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[24px]">check_circle</span>
              <div>
                <p className="font-black text-sm uppercase">{toast.title}</p>
                <p className="font-bold text-xs">{toast.desc}</p>
              </div>
            </div>
            <button onClick={() => setToast(null)} className="text-[#58A700] hover:text-[#4B4B4B]">
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        )}

        {/* Banner tiêu đề Duolingo Card */}
        <div className="duo-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#FF9600] border-b-4 border-[#E58800] flex items-center justify-center text-white shrink-0">
              <span className="material-symbols-outlined text-[30px]">pending_actions</span>
            </div>
            <div className="flex flex-col">
              <span className="self-start text-[11px] font-black text-[#E58800] uppercase tracking-wider bg-[#FFE8CC] border border-[#FF9600] px-2.5 py-0.5 rounded-full">
                Hàng đợi phê duyệt
              </span>
              <h1 className="text-2xl font-black text-[#4B4B4B] tracking-tight mt-1">
                Đơn chờ gán ô kho thực tế
              </h1>
              <p className="text-xs font-bold text-[#AFAFAF] mt-1">
                Khách hàng đã thanh toán cọc thành công. Cần chỉ định mã ô kho vật lý trước ngày hẹn nhận kho.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 self-start md:self-center">
            <div className="bg-[#DDF4FF] border-2 border-[#84D8FF] px-4 py-2 rounded-2xl flex flex-col">
              <span className="text-[10px] font-black uppercase text-[#1CB0F6]">Chờ phân bổ</span>
              <span className="text-xl font-black text-[#1CB0F6]">
                {loading ? '—' : `${items.length} đơn`}
              </span>
            </div>
            <button
              type="button"
              onClick={reload}
              disabled={loading}
              className="duo-btn-white px-4 py-2.5 text-xs tracking-wider"
            >
              <span className={`material-symbols-outlined text-[18px] mr-1 ${loading ? 'animate-spin' : ''}`}>sync</span>
              <span>LÀM MỚI</span>
            </button>
          </div>
        </div>

        {/* Bảng danh sách Duolingo Card */}
        <div className="duo-card overflow-hidden">
          {loading && <p className="p-8 text-center text-xs font-black uppercase text-[#AFAFAF]">Đang tải danh sách hàng đợi...</p>}

          {!loading && error && (
            <div className="p-8 flex flex-col items-center gap-3 text-center">
              <p className="text-xs font-black text-[#FF4B4B]">{error}</p>
              <button
                type="button"
                onClick={reload}
                className="duo-btn-green px-5 py-2.5 text-xs"
              >
                THỬ LẠI
              </button>
            </div>
          )}

          {!loading && !error && items.length === 0 && (
            <div className="p-12 flex flex-col items-center gap-2 text-center">
              <span className="material-symbols-outlined text-[48px] text-[#58CC02]">task_alt</span>
              <p className="text-sm font-black text-[#4B4B4B]">Tuyệt vời! Không còn đơn nào chờ gán kho.</p>
            </div>
          )}

          {!loading && !error && items.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-[#F7F7F7] border-b-2 border-[#E5E5E5] text-[#AFAFAF] text-[11px] font-black uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-5">Mã đơn</th>
                    <th className="py-3.5 px-5">Ngày cọc</th>
                    <th className="py-3.5 px-5">Khách hàng</th>
                    <th className="py-3.5 px-5">Điện thoại</th>
                    <th className="py-3.5 px-5">Loại kho</th>
                    <th className="py-3.5 px-5">Thời hạn</th>
                    <th className="py-3.5 px-5">Hẹn nhận</th>
                    <th className="py-3.5 px-5">Tiền cọc</th>
                    <th className="py-3.5 px-5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-[#E5E5E5] text-xs font-bold text-[#4B4B4B]">
                  {items.map((r) => {
                    const hint = startHint(daysUntil(r.startDate))
                    return (
                      <tr key={r.id} className="hover:bg-[#FDFDFD] transition-colors">
                        <td className="py-4 px-5 font-black text-[#1CB0F6]">
                          {r.reservationCode}
                        </td>
                        <td className="py-4 px-5 text-[#AFAFAF]">
                          {formatDateOnly(r.createdAt)}
                        </td>
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-[#58CC02] border-b border-[#58A700] text-white flex items-center justify-center font-black text-xs">
                              {initials(r.customerName)}
                            </div>
                            <span className="font-black text-[#4B4B4B]">
                              {r.customerName}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-5">{r.customerPhone || '—'}</td>
                        <td className="py-4 px-5">
                          <span className="duo-badge bg-[#DDF4FF] text-[#1CB0F6] border-2 border-[#84D8FF]">
                            {r.unitTypeName}
                          </span>
                        </td>
                        <td className="py-4 px-5 font-black">{r.durationMonths} tháng</td>
                        <td className="py-4 px-5">
                          <div className="flex flex-col">
                            <span>{formatDate(r.startDate)}</span>
                            {hint && <span className={`text-[10px] ${hint.className}`}>{hint.text}</span>}
                          </div>
                        </td>
                        <td className="py-4 px-5 font-black text-[#58CC02]">
                          {formatVND(r.depositAmount)}
                        </td>
                        <td className="py-4 px-5 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => openAssign(r)}
                            className="duo-btn-green px-4 py-2 text-xs"
                          >
                            <span className="material-symbols-outlined text-[16px] mr-1">key</span>
                            <span>GÁN Ô KHO</span>
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <AssignUnitModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        reservation={selectedReservation}
        onSuccess={handleAssignSuccess}
      />
    </div>
  )
}