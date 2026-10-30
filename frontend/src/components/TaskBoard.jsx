import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getStaffTasks } from '../services/staffTaskService'
import { parseRefundNote } from '../utils/refundParser'

// UC-16: Bảng công việc tại cơ sở — dùng chung cho trang Staff và trang Manager.
// renderActions(task) (tuỳ chọn): trang cha truyền vào để gắn nút thao tác cho từng thẻ (UC-17, UC-18, UC-27...)
// currentStaffId (tuỳ chọn, UC-17): có thì hiện bộ lọc "Việc của tôi" + badge "Của bạn" trên thẻ mình đã nhận

const REFRESH_MS = 60000 // khớp với job quá hạn chạy mỗi phút ở backend
const PAGE_SIZE = 5 // Cập nhật: 5 task mỗi trang để giao diện gọn gàng, không phải cuộn xa

const TYPE_META = {
  CHECK_IN:    { label: 'Check-in',    icon: 'login',         cls: 'bg-[#D7FFB8] text-[#58A700] border-[#58CC02]' },
  CHECK_OUT:   { label: 'Check-out',   icon: 'logout',        cls: 'bg-[#FFE8CC] text-[#E58800] border-[#FF9600]' },
  SUPPORT:     { label: 'Hỗ trợ KH',   icon: 'support_agent', cls: 'bg-[#F3E8FF] text-[#A560E8] border-[#CE82FF]' },
  REFUND:      { label: 'Hoàn tiền',   icon: 'payments',      cls: 'bg-[#DDF4FF] text-[#1CB0F6] border-[#84D8FF]' },
  MAINTENANCE: { label: 'Bảo trì kho', icon: 'build',         cls: 'bg-[#FFDFDF] text-[#FF4B4B] border-[#FF4B4B]' },
}

const SUPPORT_ISSUE_LABEL = {
  LOCK_ISSUE: 'Sự cố khóa / Mã PIN',
  SECURITY: 'An ninh / Cảnh báo khẩn',
  FACILITY_DAMAGE: 'Hư hỏng cơ sở vật chất',
  CLEANING: 'Vệ sinh kho bãi',
  OTHER: 'Yêu cầu hỗ trợ khác',
}

const STATUS_META = {
  OPEN:        { label: 'Chờ nhận',    cls: 'bg-[#DDF4FF] text-[#1CB0F6] border-2 border-[#84D8FF]' },
  IN_PROGRESS: { label: 'Đang xử lý',  cls: 'bg-[#F3E8FF] text-[#A560E8] border-2 border-[#CE82FF]' },
  OVERDUE:     { label: 'Quá hạn',     cls: 'bg-[#FFDFDF] text-[#FF4B4B] border-2 border-[#FF4B4B]' },
  COMPLETED:   { label: 'Hoàn thành',  cls: 'bg-[#D7FFB8] text-[#58A700] border-2 border-[#58CC02]' },
  CANCELLED:   { label: 'Đã huỷ',      cls: 'bg-[#F7F7F7] text-[#777777] border-2 border-[#E5E5E5]' },
}

const TABS = [
  { key: 'ACTIVE',      label: 'Cần xử lý',      statuses: ['OPEN', 'IN_PROGRESS', 'OVERDUE'] },
  { key: 'OPEN',        label: 'Chờ nhận',       statuses: ['OPEN'] },
  { key: 'IN_PROGRESS', label: 'Đang xử lý',     statuses: ['IN_PROGRESS'] },
  { key: 'OVERDUE',     label: 'Quá hạn',        statuses: ['OVERDUE'] },
  { key: 'DONE',        label: 'Đã đóng',        statuses: ['COMPLETED', 'CANCELLED'] },
]

// Bộ tab riêng cho trang Quản lý hoàn tiền
const REFUND_TABS = [
  { key: 'REFUND_OPEN',        label: 'Chờ xử lý',      statuses: ['OPEN', 'IN_PROGRESS'], isRefundOnly: true },
  { key: 'REFUND_OVERDUE',     label: 'Quá hạn',        statuses: ['OVERDUE'], isRefundOnly: true },
  { key: 'REFUND_COMPLETED',   label: 'Đã hoàn thành',  statuses: ['COMPLETED'], isRefundOnly: true },
]

function pad(n) {
  return String(n).padStart(2, '0')
}

function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  return `${pad(d.getHours())}:${pad(d.getMinutes())} · ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

// "Hôm nay 21:00", "Ngày mai 21:00" hoặc dd/MM 21:00
function formatDue(value) {
  if (!value) return '—'
  const d = new Date(value)
  const today = new Date()
  const tomorrow = new Date()
  tomorrow.setDate(today.getDate() + 1)
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  if (d.toDateString() === today.toDateString()) return `Hôm nay ${time}`
  if (d.toDateString() === tomorrow.toDateString()) return `Ngày mai ${time}`
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${time}`
}

// Còn bao lâu tới hạn — chỉ áp dụng cho task còn mở
function dueHint(task) {
  if (!['OPEN', 'IN_PROGRESS'].includes(task.status) || !task.dueAt) return null
  const diffMin = Math.round((new Date(task.dueAt) - new Date()) / 60000)
  if (diffMin <= 0) return { text: 'Đã tới hạn', urgent: true }
  if (diffMin < 60) return { text: `Còn ${diffMin}p`, urgent: true }
  const hours = Math.floor(diffMin / 60)
  if (hours < 24) return { text: `Còn ${hours}h`, urgent: hours < 3 }
  return { text: `Còn ${Math.floor(hours / 24)} ngày`, urgent: false }
}

// Hàm sinh danh sách các trang kèm ellipsis (...)
function getPageNumbers(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }
  const pages = []
  pages.push(1)
  if (currentPage > 3) {
    pages.push('...')
  }
  const start = Math.max(2, currentPage - 1)
  const end = Math.min(totalPages - 1, currentPage + 1)
  for (let i = start; i <= end; i++) {
    pages.push(i)
  }
  if (currentPage < totalPages - 2) {
    pages.push('...')
  }
  pages.push(totalPages)
  return pages
}

export default function TaskBoard({
  facilityId,
  renderActions,
  reloadKey = 0,
  currentStaffId,
  forceStaffId,
  initialTypeFilter = 'ALL',
  defaultLayout = 'list',
  showLayoutToggle = true
}) {
  const isRefundMode = initialTypeFilter === 'REFUND'
  const activeTabs = isRefundMode ? REFUND_TABS : TABS
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState(isRefundMode ? 'REFUND_OPEN' : 'ACTIVE')
  const [typeFilter, setTypeFilter] = useState(initialTypeFilter)
  const [search, setSearch] = useState('')
  const [mineOnly, setMineOnly] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [viewLayout, setViewLayout] = useState(defaultLayout)
  const [currentPage, setCurrentPage] = useState(1)
  const [searchParams] = useSearchParams()
  const highlightParam = searchParams.get('highlightTaskId')
  const [activeHighlightId, setActiveHighlightId] = useState(null)

  useEffect(() => {
    if (!highlightParam) return
    setActiveHighlightId(String(highlightParam))
    const timer = setTimeout(() => {
      const el = document.getElementById("task-card-" + highlightParam)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 350)
    const clearTimer = setTimeout(() => {
      setActiveHighlightId(null)
    }, 5000)
    return () => {
      clearTimeout(timer)
      clearTimeout(clearTimer)
    }
  }, [highlightParam, tasks])
  const listRef = useRef(null)

  // Cập nhật khi defaultLayout thay đổi
  useEffect(() => {
    setViewLayout(defaultLayout)
  }, [defaultLayout])

  // Cập nhật khi initialTypeFilter thay đổi
  useEffect(() => {
    if (initialTypeFilter === 'REFUND') {
      setTab('REFUND_OPEN')
      setTypeFilter('REFUND')
    } else {
      setTab('ACTIVE')
      setTypeFilter(initialTypeFilter || 'ALL')
    }
  }, [initialTypeFilter])

  // Reset về trang 1 khi thay đổi bộ lọc
  useEffect(() => {
    setCurrentPage(1)
  }, [tab, search, typeFilter, mineOnly])

  const fetchTasks = useCallback(() => {
    if (!facilityId) return Promise.resolve()
    return getStaffTasks(facilityId)
      .then(data => {
        setTasks(data)
        setError('')
        setLastUpdated(new Date())
      })
      .catch(err => setError(err.response?.data?.message || 'Không tải được bảng công việc.'))
      .finally(() => setLoading(false))
  }, [facilityId])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks, reloadKey])

  // Tự làm mới để thấy task mới sinh / task vừa chuyển quá hạn
  useEffect(() => {
    const timer = setInterval(fetchTasks, REFRESH_MS)
    return () => clearInterval(timer)
  }, [fetchTasks])

  const handleRefresh = () => {
    setLoading(true)
    fetchTasks()
  }

  const scopedTasks = useMemo(() => {
    return forceStaffId ? tasks.filter(t => t.staffId === forceStaffId) : tasks
  }, [tasks, forceStaffId])

  const stats = useMemo(() => {
    const pool = isRefundMode
      ? tasks.filter(t => t.taskType === 'REFUND')
      : tasks.filter(t => t.taskType !== 'REFUND')
    const today = new Date().toDateString()
    return {
      open: isRefundMode
        ? pool.filter(t => t.status === 'OPEN' || t.status === 'IN_PROGRESS').length
        : pool.filter(t => t.status === 'OPEN').length,
      inProgress: pool.filter(t => t.status === 'IN_PROGRESS').length,
      overdue: pool.filter(t => t.status === 'OVERDUE').length,
      completed: pool.filter(t => t.status === 'COMPLETED').length,
      doneToday: pool.filter(t => t.status === 'COMPLETED' && t.completedAt
        && new Date(t.completedAt).toDateString() === today).length,
    }
  }, [tasks, isRefundMode])

  const tabCounts = useMemo(() => {
    const counts = {}
    const baseTasks = isRefundMode
      ? scopedTasks.filter(task => task.taskType === 'REFUND')
      : scopedTasks.filter(task => task.taskType !== 'REFUND')
    activeTabs.forEach(t => {
      counts[t.key] = baseTasks.filter(task => t.statuses?.includes(task.status)).length
    })
    return counts
  }, [scopedTasks, activeTabs, isRefundMode])

  const visibleTasks = useMemo(() => {
    const currentTab = activeTabs.find(t => t.key === tab) || activeTabs[0]
    const keyword = search.trim().toLowerCase()
    const filtered = scopedTasks
      .filter(t => isRefundMode ? t.taskType === 'REFUND' : t.taskType !== 'REFUND')
      .filter(t => currentTab.statuses?.includes(t.status))
      .filter(t => {
        if (isRefundMode) return true
        return typeFilter === 'ALL' || t.taskType === typeFilter
      })
      .filter(t => !mineOnly || t.staffId === currentStaffId)
      .filter(t => !keyword
        || t.contractCode?.toLowerCase().includes(keyword)
        || t.ticketCode?.toLowerCase().includes(keyword)
        || t.customerName?.toLowerCase().includes(keyword)
        || t.customerPhone?.includes(keyword)
        || t.storageUnitId?.toLowerCase().includes(keyword)
        || t.note?.toLowerCase().includes(keyword)
        || t.ticketDescription?.toLowerCase().includes(keyword))

    // PR-34: Task SUPPORT khẩn (LOCK_ISSUE, SECURITY) còn mở nổi lên đầu bảng
    return [...filtered].sort((a, b) => {
      const aActiveUrgent = Boolean(a.urgent) && ['OPEN', 'IN_PROGRESS', 'OVERDUE'].includes(a.status)
      const bActiveUrgent = Boolean(b.urgent) && ['OPEN', 'IN_PROGRESS', 'OVERDUE'].includes(b.status)
      if (aActiveUrgent !== bActiveUrgent) {
        return aActiveUrgent ? -1 : 1
      }
      const aDue = a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER
      const bDue = b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER
      return aDue - bDue
    })
  }, [scopedTasks, activeTabs, tab, typeFilter, isRefundMode, search, mineOnly, currentStaffId])

  // Tính toán phân trang (5 task/trang)
  const totalTasks = visibleTasks.length
  const totalPages = Math.max(1, Math.ceil(totalTasks / PAGE_SIZE))

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  const startIndex = (currentPage - 1) * PAGE_SIZE
  const paginatedTasks = useMemo(() => {
    return visibleTasks.slice(startIndex, startIndex + PAGE_SIZE)
  }, [visibleTasks, startIndex])

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage)
    if (listRef.current) {
      listRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  // Component thanh điều hướng phân trang << < 1 2 3 > >>
  const renderPaginationBar = () => {
    if (totalTasks === 0) return null
    return (
      <div className="px-6 py-4 bg-[#FBFBFB] border-t-2 border-[#E5E5E5] flex flex-col sm:flex-row items-center justify-between gap-4 select-none">
        <div className="text-xs font-bold text-[#777777] flex items-center gap-1.5">
          <span>Hiển thị</span>
          <span className="font-black text-[#4B4B4B] font-mono">{startIndex + 1}</span>
          <span>–</span>
          <span className="font-black text-[#4B4B4B] font-mono">{Math.min(startIndex + PAGE_SIZE, totalTasks)}</span>
          <span>trong tổng số</span>
          <span className="font-black text-[#1CB0F6] font-mono">{totalTasks}</span>
          <span>công việc</span>
        </div>

        {totalPages >= 1 && (
          <div className="flex items-center gap-1.5 flex-wrap justify-center">
            {/* Về trang đầu << */}
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => handlePageChange(1)}
              className={`w-9 h-9 rounded-xl border-2 border-b-4 flex items-center justify-center font-black text-xs transition-all ${
                currentPage === 1
                  ? 'bg-[#F7F7F7] border-[#E5E5E5] text-[#C7C7C7] cursor-not-allowed opacity-60'
                  : 'bg-white border-[#E5E5E5] text-[#4B4B4B] hover:bg-[#F7F7F7] active:border-b-2 cursor-pointer'
              }`}
              title="Về trang đầu (<<)"
            >
              <span className="material-symbols-outlined text-[18px]">keyboard_double_arrow_left</span>
            </button>

            {/* Trang trước < */}
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
              className={`w-9 h-9 rounded-xl border-2 border-b-4 flex items-center justify-center font-black text-xs transition-all ${
                currentPage === 1
                  ? 'bg-[#F7F7F7] border-[#E5E5E5] text-[#C7C7C7] cursor-not-allowed opacity-60'
                  : 'bg-white border-[#E5E5E5] text-[#4B4B4B] hover:bg-[#F7F7F7] active:border-b-2 cursor-pointer'
              }`}
              title="Trang trước (<)"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>

            {/* Số trang */}
            {getPageNumbers(currentPage, totalPages).map((p, idx) => {
              if (p === '...') {
                return (
                  <span key={`ellipsis-${idx}`} className="w-7 text-center text-xs font-black text-[#AFAFAF]">
                    ...
                  </span>
                )
              }
              const isActive = p === currentPage
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => handlePageChange(p)}
                  className={`min-w-[36px] h-9 px-2 rounded-xl border-2 border-b-4 flex items-center justify-center font-black text-xs transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#1CB0F6] border-[#1899D6] text-white shadow-xs'
                      : 'bg-white border-[#E5E5E5] text-[#4B4B4B] hover:bg-[#F7F7F7] active:border-b-2'
                  }`}
                >
                  {p}
                </button>
              )
            })}

            {/* Trang sau > */}
            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
              className={`w-9 h-9 rounded-xl border-2 border-b-4 flex items-center justify-center font-black text-xs transition-all ${
                currentPage === totalPages
                  ? 'bg-[#F7F7F7] border-[#E5E5E5] text-[#C7C7C7] cursor-not-allowed opacity-60'
                  : 'bg-white border-[#E5E5E5] text-[#4B4B4B] hover:bg-[#F7F7F7] active:border-b-2 cursor-pointer'
              }`}
              title="Trang sau (>)"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>

            {/* Đến trang cuối >> */}
            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => handlePageChange(totalPages)}
              className={`w-9 h-9 rounded-xl border-2 border-b-4 flex items-center justify-center font-black text-xs transition-all ${
                currentPage === totalPages
                  ? 'bg-[#F7F7F7] border-[#E5E5E5] text-[#C7C7C7] cursor-not-allowed opacity-60'
                  : 'bg-white border-[#E5E5E5] text-[#4B4B4B] hover:bg-[#F7F7F7] active:border-b-2 cursor-pointer'
              }`}
              title="Đến trang cuối (>>)"
            >
              <span className="material-symbols-outlined text-[18px]">keyboard_double_arrow_right</span>
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Thống kê nhanh */}
      <div className={`grid gap-4 ${isRefundMode ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-2 lg:grid-cols-4'}`}>
        {(isRefundMode ? [
          { label: 'Chờ xử lý', value: stats.open, icon: 'assignment_late', color: 'text-[#1CB0F6]', bg: 'bg-[#DDF4FF]', border: 'border-[#1CB0F6]' },
          { label: 'Quá hạn', value: stats.overdue, icon: 'alarm', color: 'text-[#FF4B4B]', bg: 'bg-[#FFDFDF]', border: 'border-[#FF4B4B]' },
          { label: 'Đã hoàn thành', value: stats.completed, icon: 'task_alt', color: 'text-[#58CC02]', bg: 'bg-[#D7FFB8]', border: 'border-[#58CC02]' },
        ] : [
          { label: 'Chờ nhận', value: stats.open, icon: 'assignment', color: 'text-[#1CB0F6]', bg: 'bg-[#DDF4FF]', border: 'border-[#1CB0F6]' },
          { label: 'Đang xử lý', value: stats.inProgress, icon: 'pending', color: 'text-[#A560E8]', bg: 'bg-[#F3E8FF]', border: 'border-[#CE82FF]' },
          { label: 'Quá hạn', value: stats.overdue, icon: 'alarm', color: 'text-[#FF4B4B]', bg: 'bg-[#FFDFDF]', border: 'border-[#FF4B4B]' },
          { label: 'Xong hôm nay', value: stats.doneToday, icon: 'task_alt', color: 'text-[#58CC02]', bg: 'bg-[#D7FFB8]', border: 'border-[#58CC02]' },
        ]).map(s => (
          <div key={s.label} className="duo-card p-4 flex items-center gap-3.5">
            <div className={`w-12 h-12 rounded-2xl ${s.bg} border-2 border-b-4 ${s.border} flex items-center justify-center shrink-0`}>
              <span className={`material-symbols-outlined text-[24px] ${s.color}`}>{s.icon}</span>
            </div>
            <div>
              <span className="text-[11px] font-black uppercase text-[#AFAFAF] block">{s.label}</span>
              <p className="text-2xl font-black text-[#4B4B4B] mt-0.5">{loading ? '—' : s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs + bộ lọc */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {activeTabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-2xl border-2 border-b-4 text-xs font-black uppercase tracking-wide transition-all cursor-pointer ${
                tab === t.key
                  ? 'bg-[#DDF4FF] border-[#84D8FF] text-[#1CB0F6]'
                  : 'bg-white border-[#E5E5E5] text-[#777777] hover:bg-[#F7F7F7]'
              }`}
            >
              {t.label}
              <span className="ml-1.5 text-[11px] opacity-70">{tabCounts[t.key] ?? 0}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#AFAFAF] text-[20px]">search</span>
            <input
              type="text"
              placeholder={isRefundMode ? "Tìm theo mã đơn, tên / SĐT khách, số tiền..." : "Tìm theo mã hợp đồng, mã ticket (SR-...), tên / SĐT khách, mã ô kho..."}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="duo-input w-full pl-11 text-xs"
            />
          </div>
          {!isRefundMode && (
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="duo-input text-xs md:w-52 cursor-pointer"
            >
              <option value="ALL">Tất cả loại việc</option>
              <option value="CHECK_IN">Check-in</option>
              <option value="CHECK_OUT">Check-out</option>
              <option value="SUPPORT">Hỗ trợ khách hàng</option>
              <option value="MAINTENANCE">Bảo trì kho</option>
            </select>
          )}
          {currentStaffId && (
            <label
              className={`px-4 py-2 rounded-2xl border-2 border-b-4 text-xs font-black uppercase flex items-center justify-center gap-1.5 cursor-pointer select-none ${
                mineOnly ? 'bg-[#F3E8FF] border-[#CE82FF] text-[#A560E8]' : 'bg-white border-[#E5E5E5] text-[#777777] hover:bg-[#F7F7F7]'
              }`}
            >
              <input type="checkbox" checked={mineOnly} onChange={e => setMineOnly(e.target.checked)} className="accent-[#A560E8]" />
              Việc của tôi
            </label>
          )}
          <button
            onClick={handleRefresh}
            className="px-4 py-2 rounded-2xl bg-white border-2 border-b-4 border-[#E5E5E5] text-[#777777] hover:bg-[#F7F7F7] active:border-b-2 text-xs font-black uppercase flex items-center justify-center gap-1.5 cursor-pointer"
            title={lastUpdated ? `Cập nhật lúc ${formatDateTime(lastUpdated)}` : 'Làm mới'}
          >
            <span className="material-symbols-outlined text-[18px]">refresh</span>
            Làm mới
          </button>
        </div>
      </div>

      {/* Khu vực hiển thị công việc (List hoặc Grid) */}
      <div ref={listRef}>
        {loading ? (
          <div className="duo-card flex flex-col items-center justify-center py-16 gap-3">
            <span className="material-symbols-outlined text-[#58CC02] text-[36px] animate-spin">progress_activity</span>
            <span className="text-xs font-black uppercase text-[#AFAFAF]">Đang tải bảng công việc...</span>
          </div>
        ) : error ? (
          <div className="duo-card flex flex-col items-center justify-center py-16 gap-2">
            <span className="material-symbols-outlined text-[#FF4B4B] text-[40px]">error</span>
            <p className="text-xs font-black text-[#FF4B4B]">{error}</p>
          </div>
        ) : visibleTasks.length === 0 ? (
          <div className="duo-card flex flex-col items-center justify-center py-16 gap-2 text-center">
            <span className="material-symbols-outlined text-[#AFAFAF] text-[48px]">inventory</span>
            <p className="text-sm font-black text-[#4B4B4B]">
              {search || typeFilter !== 'ALL' || mineOnly ? 'Không có công việc phù hợp bộ lọc.' : 'Không có công việc nào trong mục này.'}
            </p>
          </div>
        ) : viewLayout === 'list' ? (
          /* ========================================================
             GIAO DIỆN MỚI: DANH SÁCH THUÔN DÀI - CĂN CHỈNH CỘT CHUẨN GRID
             ======================================================== */
          <div className="duo-card overflow-hidden">
            {/* Thanh tiêu đề của ô to */}
            <div className="px-5 py-3.5 bg-[#FBFBFB] border-b-2 border-[#E5E5E5] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#DDF4FF] border-2 border-[#84D8FF] flex items-center justify-center text-[#1CB0F6]">
                  <span className="material-symbols-outlined text-[20px]">format_list_bulleted</span>
                </div>
                <div>
                  <h3 className="text-sm font-black text-[#4B4B4B] uppercase tracking-wider">
                    {isRefundMode ? 'Danh sách yêu cầu hoàn tiền' : 'Danh sách công việc'}
                  </h3>
                  <p className="text-[11px] font-bold text-[#AFAFAF]">
                    Trang {currentPage} / {totalPages} · Mỗi trang 5 việc
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {showLayoutToggle && (
                  <div className="flex items-center bg-[#F0F0F0] p-1 rounded-xl border border-[#E5E5E5]">
                    <button
                      type="button"
                      onClick={() => setViewLayout('list')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                        viewLayout === 'list'
                          ? 'bg-white text-[#1CB0F6] shadow-xs'
                          : 'text-[#777777] hover:text-[#4B4B4B]'
                      }`}
                      title="Dạng danh sách thuôn dài"
                    >
                      <span className="material-symbols-outlined text-[16px]">view_list</span>
                      Danh sách
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewLayout('grid')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                        viewLayout === 'grid'
                          ? 'bg-white text-[#1CB0F6] shadow-xs'
                          : 'text-[#777777] hover:text-[#4B4B4B]'
                      }`}
                      title="Dạng thẻ lưới"
                    >
                      <span className="material-symbols-outlined text-[16px]">grid_view</span>
                      Lưới thẻ
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Danh sách 5 card thuôn dài (căn chuẩn 12 cột CSS Grid thẳng hàng) */}
            <div className="p-4 sm:p-5 flex flex-col gap-3">
              {paginatedTasks.map(task => {
                const isRefund = task.taskType === 'REFUND'
                const isSupport = task.taskType === 'SUPPORT'
                const parsed = isRefund ? parseRefundNote(task.note) : null
                const type = TYPE_META[task.taskType] || { label: task.taskType, icon: 'task', cls: 'bg-[#F7F7F7] text-[#777777] border-[#E5E5E5]' }
                const status = isRefund && task.status === 'OPEN'
                  ? { label: 'Chờ xử lý', cls: 'bg-[#DDF4FF] text-[#1CB0F6] border-2 border-[#84D8FF]' }
                  : (STATUS_META[task.status] || { label: task.status, cls: 'bg-[#F7F7F7] text-[#777777] border-2 border-[#E5E5E5]' })
                const hint = dueHint(task)
                const actions = renderActions ? renderActions(task) : null
                const isMine = Boolean(currentStaffId) && task.staffId === currentStaffId

                const customerName = task.customerName || parsed?.customerName || '—'
                const customerPhone = task.customerPhone || parsed?.customerPhone || ''
                const codeLabel = isSupport && task.ticketCode
                  ? `${task.ticketCode}${task.contractCode ? ` · HĐ ${task.contractCode}` : ''}`
                  : (task.contractCode ? `HĐ ${task.contractCode}` : (parsed?.orderCode ? `Đơn ${parsed.orderCode}` : 'Hủy đơn'))

                return (
                  <div
                    key={task.id}
                    id={`task-card-${task.id}`}
                    className={`bg-white border-2 border-b-4 rounded-2xl p-4 transition-all hover:border-[#1CB0F6] hover:shadow-xs flex flex-col gap-2.5 ${String(activeHighlightId) === String(task.id) ? 'ring-4 ring-[#58CC02] ring-offset-2 animate-pulse border-[#58CC02] shadow-xl scale-[1.01] ' : ''}${
                      task.status === 'OVERDUE' || (task.urgent && ['OPEN', 'IN_PROGRESS'].includes(task.status))
                        ? 'border-[#FF4B4B] bg-[#FFFBFB]'
                        : isMine
                        ? 'border-[#CE82FF] bg-[#FDFAFF]'
                        : 'border-[#E5E5E5]'
                    }`}
                  >
                    {/* Bố cục Grid 5 cột chuẩn tỉ lệ: mở rộng cột Trạng thái & Thao tác để hiển thị đủ 2 huy hiệu trên cùng 1 hàng, lấp khoảng trống bên trái */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[minmax(200px,2.2fr)_minmax(120px,1.4fr)_minmax(120px,1.4fr)_minmax(150px,1.6fr)_minmax(280px,3.4fr)] gap-3.5 lg:gap-4 items-center">
                      
                      {/* Cột 1: Loại việc & Mã số */}
                      <div className="col-span-1 sm:col-span-2 lg:col-span-1 flex items-center gap-3 min-w-0">
                        <div className={`w-11 h-11 rounded-2xl border-2 border-b-4 flex items-center justify-center shrink-0 ${type.cls}`}>
                          <span className="material-symbols-outlined text-[22px]">{type.icon}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-sm font-black text-[#4B4B4B] uppercase tracking-wide truncate">{type.label}</p>
                            {task.urgent && (
                              <span className="px-1.5 py-0.5 rounded-md bg-[#FF4B4B] text-white text-[9px] font-black uppercase flex items-center gap-0.5 shrink-0">
                                <span className="material-symbols-outlined text-[11px]">priority_high</span>
                                KHẨN
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] font-bold text-[#AFAFAF] mt-0.5 truncate">
                            Task #{task.id} · <span className="font-mono text-[#1CB0F6] font-black">{codeLabel}</span>
                          </p>
                        </div>
                      </div>

                      {/* Cột 2: Khách hàng */}
                      <div className="col-span-1 lg:col-span-1 flex flex-col gap-0.5 min-w-0">
                        <span className="text-[10px] font-black uppercase text-[#AFAFAF] flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px]">person</span>
                          Khách hàng
                        </span>
                        <span className="font-black text-xs text-[#4B4B4B] truncate" title={customerName}>{customerName}</span>
                        {customerPhone && <span className="font-bold text-[11px] text-[#777777] font-mono truncate">{customerPhone}</span>}
                      </div>

                      {/* Cột 3: Ô kho & Loại kho */}
                      <div className="col-span-1 lg:col-span-1 flex flex-col gap-0.5 min-w-0">
                        <span className="text-[10px] font-black uppercase text-[#AFAFAF] flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px]">grid_view</span>
                          {isRefund && !task.storageUnitId ? 'Đối tượng' : 'Ô kho'}
                        </span>
                        <span className="font-black text-xs text-[#4B4B4B] font-mono truncate">
                          {task.storageUnitId || (isRefund ? 'Đơn đặt chỗ hủy' : '—')}
                        </span>
                        <span
                          className="font-bold text-[11px] text-[#777777] truncate"
                          title={isSupport && task.issueType ? (SUPPORT_ISSUE_LABEL[task.issueType] || task.issueType) : (task.unitTypeName || '')}
                        >
                          {isSupport && task.issueType
                            ? SUPPORT_ISSUE_LABEL[task.issueType] || task.issueType
                            : (task.unitTypeName || '')}
                        </span>
                      </div>

                      {/* Cột 4: Hạn chót & Phụ trách */}
                      <div className="col-span-1 lg:col-span-1 flex flex-col gap-0.5 min-w-0">
                        <span className="text-[10px] font-black uppercase text-[#AFAFAF] flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px]">schedule</span>
                          Hạn chót
                        </span>
                        <div className="flex items-center gap-1 text-xs truncate">
                          <span className={`font-black truncate ${task.status === 'OVERDUE' ? 'text-[#FF4B4B]' : 'text-[#4B4B4B]'}`}>
                            {formatDue(task.dueAt)}
                          </span>
                          {hint && (
                            <span className={`font-black text-[10px] shrink-0 ${hint.urgent ? 'text-[#FF4B4B]' : 'text-[#58A700]'}`}>
                              ({hint.text})
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-[#777777] truncate">
                          <span className="material-symbols-outlined text-[13px] text-[#AFAFAF] shrink-0">assignment_ind</span>
                          {task.staffName ? (
                            <span className="font-bold text-[#4B4B4B] truncate" title={task.staffName}>{task.staffName}</span>
                          ) : (
                            <span className="italic text-[#AFAFAF]">Chưa nhận</span>
                          )}
                        </div>
                      </div>

                      {/* Cột 5: Trạng thái & Thao tác (Cố định vị trí nhãn Trạng thái; Khối Huy hiệu & Nút bấm căn thẳng hàng theo vạch đen) */}
                      <div className="col-span-1 sm:col-span-2 lg:col-span-1 flex items-start justify-end gap-3 min-w-0">
                        {/* Nhãn TRẠNG THÁI (Cố định ở vị trí bên trái) */}
                        <div className="flex items-center gap-1 text-[10px] font-black uppercase text-[#AFAFAF] shrink-0 h-7 select-none">
                          <span className="material-symbols-outlined text-[13px]">flag</span>
                          Trạng thái
                        </div>

                        {/* Khối Trạng thái & Nút bấm (Rộng 210px cố định, bắt đầu từ vạch đen thẳng tắp xuống các nút) */}
                        <div className="flex flex-col gap-1.5 w-full sm:w-[210px] shrink-0">
                          {/* Dòng 1: Ô trạng thái (Nếu 1 ô thì center, nếu 2 ô thì bắt đầu từ vạch đen trải đều) */}
                          <div className="h-7 flex items-center w-full">
                            {isMine ? (
                              <div className="flex items-center justify-between gap-1.5 w-full">
                                <span className={`duo-badge whitespace-nowrap text-xs ${status.cls}`}>{status.label}</span>
                                <span className="duo-badge whitespace-nowrap bg-[#A560E8] text-white border-2 border-[#A560E8] flex items-center gap-0.5 text-[10px] py-0.5 px-2 shrink-0">
                                  <span className="material-symbols-outlined text-[12px]">person_check</span>
                                  CỦA BẠN
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center w-full">
                                <span className={`duo-badge whitespace-nowrap text-xs ${status.cls}`}>{status.label}</span>
                              </div>
                            )}
                          </div>

                          {/* Dòng 2 & 3: Các nút bấm thao tác (Căn mép trái bằng điểm bắt đầu của ô ĐANG XỬ LÝ) */}
                          {actions && (
                            <div className="flex flex-col gap-1.5 w-full">
                              {actions}
                            </div>
                          )}
                        </div>
                      </div>

                    </div>

                    {/* Dòng ghi chú phụ nếu có (gói trong badge gọn gàng) */}
                    {(isRefund && parsed?.refundAmount) || isRefund || (isSupport && task.ticketDescription) || task.note ? (
                      <div className="pt-2 border-t border-[#F0F0F0] flex flex-wrap items-center gap-2 text-xs">
                        {isRefund && parsed?.refundAmount ? (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-[#805AD5] flex items-center gap-1">
                              <span className="material-symbols-outlined text-[15px]">payments</span>
                              Tổng tiền hoàn:
                            </span>
                            <span className="font-mono font-black text-sm text-[#805AD5]">{parsed.refundAmount}</span>
                            {parsed.earlyRentRefundNum > 0 && (
                              <span className="px-2 py-0.5 rounded-md bg-[#DCFCE7] text-[#15803D] text-[10px] font-black border border-[#86EFAC]">
                                Cọc + Trả sớm ({parsed.earlyRentRefund})
                              </span>
                            )}
                            {parsed.isPenalty50 && (
                              <span className="px-2 py-0.5 rounded-md bg-[#FED7D7] text-[#C53030] text-[10px] font-black border border-[#FEB2B2]">
                                Trừ 50% cọc
                              </span>
                            )}
                            {parsed.isFull100 && !parsed.earlyRentRefundNum && (
                              <span className="px-2 py-0.5 rounded-md bg-[#C6F6D5] text-[#22543D] text-[10px] font-black border border-[#9AE6B4]">
                                Hoàn 100%
                              </span>
                            )}
                          </div>
                        ) : null}

                        {isRefund ? (
                          <div className="flex items-center gap-1.5 flex-1 min-w-0 bg-[#F9F9F9] px-2.5 py-1 rounded-lg">
                            <span className="text-[10px] font-black uppercase text-[#805AD5] shrink-0 bg-[#F3E8FF] px-1.5 py-0.5 rounded">
                              Lý do hoàn
                            </span>
                            <span className="text-[11px] font-bold text-[#4B4B4B] truncate">
                              {parsed?.reason || 'Khách yêu cầu hủy đơn / hoàn tiền'}
                            </span>
                          </div>
                        ) : isSupport && task.ticketDescription ? (
                          <div className="flex items-center gap-1.5 flex-1 min-w-0 bg-[#F9F9F9] px-2.5 py-1 rounded-lg">
                            <span className="text-[10px] font-black uppercase text-[#1CB0F6] shrink-0 bg-[#DDF4FF] px-1.5 py-0.5 rounded">
                              Sự cố
                            </span>
                            <span className="text-[11px] font-bold text-[#4B4B4B] truncate" title={task.ticketDescription}>
                              {task.ticketDescription}
                            </span>
                          </div>
                        ) : task.note ? (
                          <div className="flex items-center gap-1.5 flex-1 min-w-0 bg-[#F9F9F9] px-2.5 py-1 rounded-lg">
                            <span className="text-[10px] font-black uppercase text-[#777777] shrink-0 bg-[#EAEAEA] px-1.5 py-0.5 rounded">
                              Ghi chú
                            </span>
                            <span className="text-[11px] font-bold text-[#555555] truncate" title={task.note}>
                              {task.note}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>

            {/* Footer phân trang cho Ô to */}
            {renderPaginationBar()}
          </div>
        ) : (
          /* ========================================================
             GIAO DIỆN LƯỚI THẺ CŨ (GRID) KÈM PHÂN TRANG 5 TASK
             ======================================================== */
          <div className="flex flex-col gap-4">
            {showLayoutToggle && (
              <div className="flex justify-end">
                <div className="flex items-center bg-[#F0F0F0] p-1 rounded-xl border border-[#E5E5E5]">
                  <button
                    type="button"
                    onClick={() => setViewLayout('list')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                      viewLayout === 'list'
                        ? 'bg-white text-[#1CB0F6] shadow-xs'
                        : 'text-[#777777] hover:text-[#4B4B4B]'
                    }`}
                    title="Dạng danh sách thuôn dài"
                  >
                    <span className="material-symbols-outlined text-[16px]">view_list</span>
                    Danh sách
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewLayout('grid')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                      viewLayout === 'grid'
                        ? 'bg-white text-[#1CB0F6] shadow-xs'
                        : 'text-[#777777] hover:text-[#4B4B4B]'
                    }`}
                    title="Dạng thẻ lưới"
                  >
                    <span className="material-symbols-outlined text-[16px]">grid_view</span>
                    Lưới thẻ
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {paginatedTasks.map(task => {
                const isRefund = task.taskType === 'REFUND'
                const isSupport = task.taskType === 'SUPPORT'
                const parsed = isRefund ? parseRefundNote(task.note) : null
                const type = TYPE_META[task.taskType] || { label: task.taskType, icon: 'task', cls: 'bg-[#F7F7F7] text-[#777777] border-[#E5E5E5]' }
                const status = isRefund && task.status === 'OPEN'
                  ? { label: 'Chờ xử lý', cls: 'bg-[#DDF4FF] text-[#1CB0F6] border-2 border-[#84D8FF]' }
                  : (STATUS_META[task.status] || { label: task.status, cls: 'bg-[#F7F7F7] text-[#777777] border-2 border-[#E5E5E5]' })
                const hint = dueHint(task)
                const actions = renderActions ? renderActions(task) : null
                const isMine = Boolean(currentStaffId) && task.staffId === currentStaffId

                const customerName = task.customerName || parsed?.customerName || '—'
                const customerPhone = task.customerPhone || parsed?.customerPhone || ''
                const codeLabel = isSupport && task.ticketCode
                  ? `${task.ticketCode}${task.contractCode ? ` · HĐ ${task.contractCode}` : ''}`
                  : (task.contractCode ? `HĐ ${task.contractCode}` : (parsed?.orderCode ? `Đơn ${parsed.orderCode}` : 'Hủy đơn'))

                return (
                  <div
                    key={task.id}
                    id={`task-card-${task.id}`}
                    className={`duo-card p-5 flex flex-col gap-3.5 transition-all ${String(activeHighlightId) === String(task.id) ? 'ring-4 ring-[#58CC02] ring-offset-2 animate-pulse border-[#58CC02] shadow-xl scale-[1.01] ' : ''}${
                      task.status === 'OVERDUE' || (task.urgent && ['OPEN', 'IN_PROGRESS'].includes(task.status))
                        ? 'border-[#FF4B4B]'
                        : isMine
                        ? 'border-[#CE82FF]'
                        : ''
                    }`}
                  >
                    {/* Dòng đầu: loại việc + trạng thái */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-11 h-11 rounded-2xl border-2 border-b-4 flex items-center justify-center shrink-0 ${type.cls}`}>
                          <span className="material-symbols-outlined text-[22px]">{type.icon}</span>
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="text-sm font-black text-[#4B4B4B] uppercase tracking-wide">{type.label}</p>
                            {task.urgent && (
                              <span className="px-2 py-0.5 rounded-lg bg-[#FF4B4B] text-white text-[10px] font-black uppercase flex items-center gap-0.5">
                                <span className="material-symbols-outlined text-[12px]">priority_high</span>
                                KHẨN
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] font-bold text-[#AFAFAF]">
                            Task #{task.id} · <span className="font-mono text-[#1CB0F6]">{codeLabel}</span>
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <span className={`duo-badge whitespace-nowrap ${status.cls}`}>{status.label}</span>
                        {isMine && (
                          <span className="duo-badge whitespace-nowrap bg-[#A560E8] text-white border-2 border-[#A560E8] flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">person_check</span>Của bạn
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Thông tin khách + ô kho */}
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-black uppercase text-[#AFAFAF]">Khách hàng</span>
                        <span className="font-black text-[#4B4B4B]">{customerName}</span>
                        {customerPhone && <span className="font-bold text-[#777777]">{customerPhone}</span>}
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-black uppercase text-[#AFAFAF]">
                          {isRefund && !task.storageUnitId ? 'Đối tượng' : 'Ô kho'}
                        </span>
                        <span className="font-black text-[#4B4B4B] font-mono">
                          {task.storageUnitId || (isRefund ? 'Đơn đặt chỗ hủy' : '—')}
                        </span>
                        <span className="font-bold text-[#777777]">
                          {isSupport && task.issueType
                            ? SUPPORT_ISSUE_LABEL[task.issueType] || task.issueType
                            : (task.unitTypeName || '')}
                        </span>
                      </div>
                    </div>

                    {/* Nếu là REFUND: Thẻ số tiền hoàn + tag chính sách */}
                    {isRefund && parsed?.refundAmount && (
                      <div className="flex items-center justify-between rounded-xl bg-[#FAF5FF] border border-[#E9D8FD] px-3.5 py-2 text-xs">
                        <span className="font-bold text-[#805AD5] flex items-center gap-1">
                          <span className="material-symbols-outlined text-[16px]">payments</span>
                          Tổng tiền hoàn:
                        </span>
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          <span className="font-mono font-black text-sm text-[#805AD5]">
                            {parsed.refundAmount}
                          </span>
                          {parsed.earlyRentRefundNum > 0 && (
                            <span className="px-2 py-0.5 rounded-md bg-[#DCFCE7] text-[#15803D] text-[10px] font-black border border-[#86EFAC]">
                              Cọc + Trả sớm ({parsed.earlyRentRefund})
                            </span>
                          )}
                          {parsed.isPenalty50 && (
                            <span className="px-2 py-0.5 rounded-md bg-[#FED7D7] text-[#C53030] text-[10px] font-black border border-[#FEB2B2]">
                              Trừ 50% cọc
                            </span>
                          )}
                          {parsed.isFull100 && !parsed.earlyRentRefundNum && (
                            <span className="px-2 py-0.5 rounded-md bg-[#C6F6D5] text-[#22543D] text-[10px] font-black border border-[#9AE6B4]">
                              Hoàn 100%
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Hạn + người nhận */}
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#F7F7F7] px-4 py-2.5 text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`material-symbols-outlined text-[18px] ${task.status === 'OVERDUE' || hint?.urgent ? 'text-[#FF4B4B]' : 'text-[#AFAFAF]'}`}>schedule</span>
                        <span className="font-black text-[#4B4B4B]">Hạn: {formatDue(task.dueAt)}</span>
                        {hint && (
                          <span className={`font-black ${hint.urgent ? 'text-[#FF4B4B]' : 'text-[#58A700]'}`}>· {hint.text}</span>
                        )}
                      </div>
                      {(!isRefund || task.staffName) && (
                        <div className="flex items-center gap-1.5 font-bold text-[#777777]">
                          <span className="material-symbols-outlined text-[18px] text-[#AFAFAF]">person</span>
                          {task.staffName ? <span className="font-black text-[#4B4B4B]">{task.staffName}</span> : <span>Chưa có người nhận</span>}
                        </div>
                      )}
                    </div>

                    {/* Ghi chú ngắn gọn */}
                    {isRefund ? (
                      <p className="text-[11px] font-bold text-[#4B4B4B] leading-relaxed line-clamp-2">
                        <span className="font-black text-[#AFAFAF] uppercase mr-1">Lý do:</span>
                        {parsed?.reason || 'Khách yêu cầu hủy đơn / hoàn tiền'}
                      </p>
                    ) : isSupport && task.ticketDescription ? (
                      <p className="text-[11px] font-bold text-[#4B4B4B] leading-relaxed line-clamp-2">
                        <span className="font-black text-[#AFAFAF] uppercase mr-1">Sự cố:</span>
                        {task.ticketDescription}
                      </p>
                    ) : task.note ? (
                      <p className="text-[11px] font-bold text-[#777777] leading-relaxed line-clamp-2">
                        <span className="font-black text-[#AFAFAF] uppercase mr-1">Ghi chú:</span>
                        {task.note}
                      </p>
                    ) : null}

                    {actions && <div className="flex justify-end gap-2 pt-1">{actions}</div>}
                  </div>
                )
              })}
            </div>

            {/* Footer phân trang cho Dạng Lưới */}
            <div className="duo-card overflow-hidden">
              {renderPaginationBar()}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
