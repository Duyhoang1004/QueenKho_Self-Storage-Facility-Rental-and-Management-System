import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getPendingReservations, getOverdueNoShowReservations } from '../../services/reservationService'
import AssignUnitModal from '../../components/AssignUnitModal'
import NoShowModal from '../../components/NoShowModal'
import RescheduleModal from '../../components/RescheduleModal'
import PaginationBar, { ListBoxHeader } from '../../components/PaginationBar'

const PAGE_SIZE = 5

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
  const [activeTab, setActiveTab] = useState('pending')
  const [pendingPage, setPendingPage] = useState(1)
  const [overduePage, setOverduePage] = useState(1)

  // Tab 1: đơn chờ gán ô
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(Boolean(userId))
  const [error, setError] = useState(userId ? '' : 'Bạn cần đăng nhập để xem danh sách đơn chờ gán ô.')
  const [reloadKey, setReloadKey] = useState(0)

  // Tab 2: đơn quá hạn no-show
  const [overdueItems, setOverdueItems] = useState([])
  const [overdueLoading, setOverdueLoading] = useState(Boolean(userId))
  const [overdueError, setOverdueError] = useState('')
  const [overdueReloadKey, setOverdueReloadKey] = useState(0)

  const [selectedReservation, setSelectedReservation] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [toast, setToast] = useState(null)

  const [noShowTarget, setNoShowTarget] = useState(null)
  const [rescheduleTarget, setRescheduleTarget] = useState(null)

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

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    setOverdueLoading(true)
    getOverdueNoShowReservations({ managerId: userId })
      .then((data) => { if (!cancelled) { setOverdueItems(data); setOverdueError('') } })
      .catch((err) => { if (!cancelled) setOverdueError(err.response?.data?.message || 'Không tải được danh sách quá hạn.') })
      .finally(() => { if (!cancelled) setOverdueLoading(false) })
    return () => { cancelled = true }
  }, [userId, overdueReloadKey])

  const reloadOverdue = () => {
    setOverdueError('')
    setOverdueLoading(true)
    setOverdueReloadKey((k) => k + 1)
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

  const totalPendingPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE))
  const safePendingPage = Math.min(pendingPage, totalPendingPages)
  const paginatedPending = items.slice(
    (safePendingPage - 1) * PAGE_SIZE,
    safePendingPage * PAGE_SIZE
  )

  const totalOverduePages = Math.max(1, Math.ceil(overdueItems.length / PAGE_SIZE))
  const safeOverduePage = Math.min(overduePage, totalOverduePages)
  const paginatedOverdue = overdueItems.slice(
    (safeOverduePage - 1) * PAGE_SIZE,
    safeOverduePage * PAGE_SIZE
  )

  return (
    <div className="max-w-[1200px] mx-auto px-8 py-8">
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

        {/* Tab switcher */}
        <div className="flex gap-2 border-b-2 border-[#E5E5E5] pb-0">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-5 py-2.5 text-xs font-black uppercase tracking-wider rounded-t-xl border-2 border-b-0 transition-colors ${
              activeTab === 'pending'
                ? 'bg-white border-[#E5E5E5] text-[#FF9600]'
                : 'bg-[#F7F7F7] border-transparent text-[#AFAFAF] hover:text-[#4B4B4B]'
            }`}
          >
            <span className="material-symbols-outlined text-[15px] mr-1 align-middle">pending_actions</span>
            Chờ gán ô {!loading && <span className="ml-1 bg-[#FFE8CC] text-[#E58800] px-1.5 py-0.5 rounded-full text-[10px]">{items.length}</span>}
          </button>
          <button
            onClick={() => setActiveTab('overdue')}
            className={`px-5 py-2.5 text-xs font-black uppercase tracking-wider rounded-t-xl border-2 border-b-0 transition-colors ${
              activeTab === 'overdue'
                ? 'bg-white border-[#E5E5E5] text-[#FF4B4B]'
                : 'bg-[#F7F7F7] border-transparent text-[#AFAFAF] hover:text-[#4B4B4B]'
            }`}
          >
            <span className="material-symbols-outlined text-[15px] mr-1 align-middle">warning</span>
            Quá hạn nhận kho (Vắng mặt) {!overdueLoading && overdueItems.length > 0 && <span className="ml-1 bg-[#FFDFDF] text-[#FF4B4B] px-1.5 py-0.5 rounded-full text-[10px]">{overdueItems.length}</span>}
          </button>
        </div>

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
        {activeTab === 'pending' && (
        <div className="duo-card overflow-hidden">
          <ListBoxHeader
            icon="pending_actions"
            title="Hàng đợi đơn chờ gán ô kho"
            subtitle="Khách đã thanh toán cọc — cần chỉ định mã ô kho thực tế"
            count={items.length}
            countLabel="đơn chờ"
            accentColor="bg-[#FFE8CC] text-[#E58800] border-[#FF9600]"
          />
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
            <div className="p-12 flex flex-col items-center text-center max-w-lg mx-auto">
              <div className="w-16 h-16 rounded-3xl bg-[#D7FFB8] border-2 border-b-4 border-[#58CC02] flex items-center justify-center text-[#58A700] mb-4 shadow-sm">
                <span className="material-symbols-outlined text-[36px]">task_alt</span>
              </div>
              <h3 className="text-lg font-black text-[#4B4B4B]">
                Tuyệt vời! Không còn đơn nào chờ gán ô kho
              </h3>
              <p className="text-xs font-bold text-[#777777] mt-2 leading-relaxed">
                Tất cả các đơn cọc đều đã được phân bổ ô lưu trữ thành công. Khi đã gán ô, hệ thống tự động sinh Hợp đồng thuê và chuyển sang Bảng công việc cho nhân viên thực hiện Check-in.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
                <Link
                  to="/manager/tasks"
                  className="duo-btn-green px-5 py-2.5 text-xs flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-[16px]">assignment</span>
                  <span>XEM TASKBOARD CHECK-IN</span>
                </Link>
                <Link
                  to="/manager/customers"
                  className="duo-btn-white px-5 py-2.5 text-xs flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-[16px]">description</span>
                  <span>QUẢN LÝ HỢP ĐỒNG</span>
                </Link>
              </div>
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
                  {paginatedPending.map((r) => {
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
          {!loading && !error && items.length > 0 && (
            <PaginationBar
              currentPage={safePendingPage}
              totalItems={items.length}
              pageSize={PAGE_SIZE}
              onPageChange={setPendingPage}
              itemLabel="đơn chờ"
            />
          )}
        </div>
        )}

        {/* Tab Quá hạn No-Show */}
        {activeTab === 'overdue' && (
        <div className="duo-card overflow-hidden">
          <ListBoxHeader
            icon="warning"
            title="Danh sách đơn quá hạn nhận kho (Vắng mặt)"
            subtitle="Xử lý dời lịch hoặc ghi nhận khách không đến nhận kho"
            count={overdueItems.length}
            countLabel="đơn quá hạn"
            accentColor="bg-[#FFDFDF] text-[#FF4B4B] border-[#FF4B4B]"
          />
          {overdueLoading && <p className="p-8 text-center text-xs font-black uppercase text-[#AFAFAF]">Đang tải danh sách quá hạn...</p>}

          {!overdueLoading && overdueError && (
            <div className="p-8 flex flex-col items-center gap-3 text-center">
              <p className="text-xs font-black text-[#FF4B4B]">{overdueError}</p>
              <button type="button" onClick={reloadOverdue} className="duo-btn-green px-5 py-2.5 text-xs">THỬ LẠI</button>
            </div>
          )}

          {!overdueLoading && !overdueError && overdueItems.length === 0 && (
            <div className="p-12 flex flex-col items-center gap-2 text-center">
              <span className="material-symbols-outlined text-[48px] text-[#58CC02]">task_alt</span>
              <p className="text-sm font-black text-[#4B4B4B]">Không có đơn nào quá hạn nhận kho.</p>
            </div>
          )}

          {!overdueLoading && !overdueError && overdueItems.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-[#FFF5F5] border-b-2 border-[#FFDFDF] text-[#AFAFAF] text-[11px] font-black uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-5">Mã đơn</th>
                    <th className="py-3.5 px-5">Khách hàng</th>
                    <th className="py-3.5 px-5">Điện thoại</th>
                    <th className="py-3.5 px-5">Loại kho</th>
                    <th className="py-3.5 px-5">Hẹn nhận</th>
                    <th className="py-3.5 px-5">Tiền cọc</th>
                    <th className="py-3.5 px-5 min-w-[220px]">Báo cáo từ Staff</th>
                    <th className="py-3.5 px-5 text-right">Xử lý</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-[#FFDFDF] text-xs font-bold text-[#4B4B4B]">
                  {paginatedOverdue.map((r) => {
                    const hint = startHint(daysUntil(r.startDate))
                    return (
                      <tr key={r.id} className="hover:bg-[#FFF8F8] transition-colors">
                        <td className="py-4 px-5 font-black text-[#FF4B4B]">{r.reservationCode}</td>
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-[#FF4B4B] border-b border-[#CC0000] text-white flex items-center justify-center font-black text-xs">
                              {initials(r.customerName)}
                            </div>
                            <span className="font-black">{r.customerName}</span>
                          </div>
                        </td>
                        <td className="py-4 px-5">{r.customerPhone || '—'}</td>
                        <td className="py-4 px-5">
                          <span className="duo-badge bg-[#FFDFDF] text-[#FF4B4B] border-2 border-[#FF4B4B]">
                            {r.unitTypeName}
                          </span>
                        </td>
                        <td className="py-4 px-5">
                          <div className="flex flex-col">
                            <span>{formatDate(r.startDate)}</span>
                            {hint && <span className={`text-[10px] ${hint.className}`}>{hint.text}</span>}
                          </div>
                        </td>
                        <td className="py-4 px-5 font-black text-[#FF4B4B]">{formatVND(r.depositAmount)}</td>
                        <td className="py-4 px-5">
                          <div className="flex flex-col gap-1.5">
                            {r.staffNote ? (
                              <div className="flex flex-col gap-1 p-2.5 rounded-xl bg-[#FFF0E6] border-2 border-[#FF9600] text-[11px] font-bold text-[#D06B00]">
                                <div className="flex items-center gap-1 text-[10px] uppercase font-black text-[#E58800]">
                                  <span className="material-symbols-outlined text-[14px]">support_agent</span>
                                  <span>{r.staffName ? `NV ${r.staffName}` : 'Nhân viên'}</span>
                                </div>
                                <p className="leading-snug text-[#4B4B4B]">{r.staffNote}</p>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-[#AFAFAF] text-[11px] italic">
                                <span className="material-symbols-outlined text-[14px]">pending</span>
                                <span>Chưa có báo cáo liên hệ</span>
                              </div>
                            )}

                            {/* PR-X3: Đếm số lần liên hệ thất bại và chỉ báo đủ điều kiện */}
                            <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black border ${
                                (r.failedContactCount || 0) >= 2
                                  ? 'bg-[#EBFBF0] text-[#188838] border-[#A3E5B5]'
                                  : 'bg-[#FFF8E6] text-[#B26B00] border-[#FFD591]'
                              }`}>
                                <span className="material-symbols-outlined text-[12px]">phone_missed</span>
                                Liên hệ: {r.failedContactCount || 0}/2 lần
                              </span>

                              {r.noShowEligible ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black bg-[#EBFBF0] text-[#188838] border border-[#A3E5B5]">
                                  <span className="material-symbols-outlined text-[12px]">check_circle</span>
                                  Đủ ĐK vắng mặt
                                </span>
                              ) : (
                                <span
                                  title={r.noShowEligible === false ? (r.noShowIneligibleReason || 'Chưa đủ điều kiện xử lý vắng mặt') : 'Đủ điều kiện xử lý'}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black bg-[#FFF0E6] text-[#E05300] border border-[#FFBB96] cursor-help"
                                >
                                  <span className="material-symbols-outlined text-[12px]">schedule</span>
                                  Chưa đủ điều kiện
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-5 text-right whitespace-nowrap">
                          <div className="flex gap-2 justify-end">
                            <button
                              type="button"
                              onClick={() => setRescheduleTarget(r)}
                              className="px-3 py-2 text-xs font-black uppercase tracking-wider rounded-2xl border-2 border-b-4 border-[#1899D6] bg-[#1CB0F6] text-white hover:bg-[#1899D6] transition-colors"
                            >
                              <span className="material-symbols-outlined text-[14px] mr-1 align-middle">edit_calendar</span>
                              Dời lịch
                            </button>
                            <button
                              type="button"
                              onClick={() => setNoShowTarget(r)}
                              className={`px-3 py-2 text-xs font-black uppercase tracking-wider rounded-2xl border-2 border-b-4 transition-colors ${
                                r.noShowEligible === false
                                  ? 'border-[#FFA39E] bg-[#FFF1F0] text-[#CF1322] hover:bg-[#FFCCC7]'
                                  : 'border-[#CC0000] bg-[#FF4B4B] text-white hover:bg-[#e03e3e]'
                              }`}
                              title={r.noShowEligible === false ? r.noShowIneligibleReason : 'Xử lý khách vắng mặt'}
                            >
                              <span className="material-symbols-outlined text-[14px] mr-1 align-middle">
                                {r.noShowEligible === false ? 'info' : 'person_off'}
                              </span>
                              Khách vắng mặt
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          {!overdueLoading && !overdueError && overdueItems.length > 0 && (
            <PaginationBar
              currentPage={safeOverduePage}
              totalItems={overdueItems.length}
              pageSize={PAGE_SIZE}
              onPageChange={setOverduePage}
              itemLabel="đơn quá hạn"
            />
          )}
        </div>
        )}
      </div>

      <AssignUnitModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        reservation={selectedReservation}
        onSuccess={handleAssignSuccess}
      />

      <NoShowModal
        isOpen={!!noShowTarget}
        reservation={noShowTarget}
        onClose={() => setNoShowTarget(null)}
        onSuccess={(code) => {
          setToast({ title: 'Đã xử lý khách vắng mặt!', desc: `Đơn ${code} đã bị hủy, ô kho đã được giải phóng.` })
          setTimeout(() => setToast(null), 4500)
          reloadOverdue()
        }}
      />

      <RescheduleModal
        isOpen={!!rescheduleTarget}
        reservation={rescheduleTarget}
        onClose={() => setRescheduleTarget(null)}
        onSuccess={(code, newDate) => {
          setToast({ title: 'Đã dời lịch thành công!', desc: `Đơn ${code} đã được dời sang ngày ${newDate}.` })
          setTimeout(() => setToast(null), 4500)
          reloadOverdue()
        }}
      />
    </div>
  )
}
