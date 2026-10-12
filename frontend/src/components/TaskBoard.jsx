import { useCallback, useEffect, useMemo, useState } from 'react'
import { getStaffTasks } from '../services/staffTaskService'

// UC-16: Bảng công việc tại cơ sở — dùng chung cho trang Staff và trang Manager.
// renderActions(task) (tuỳ chọn): trang cha truyền vào để gắn nút thao tác cho từng thẻ (UC-17, UC-18...)

const REFRESH_MS = 60000 // khớp với job quá hạn chạy mỗi phút ở backend

const TYPE_META = {
  CHECK_IN:  { label: 'Check-in',  icon: 'login',  cls: 'bg-[#D7FFB8] text-[#58A700] border-[#58CC02]' },
  CHECK_OUT: { label: 'Check-out', icon: 'logout', cls: 'bg-[#FFE8CC] text-[#E58800] border-[#FF9600]' },
}

const STATUS_META = {
  OPEN:        { label: 'Chờ nhận',  cls: 'bg-[#DDF4FF] text-[#1CB0F6] border-2 border-[#84D8FF]' },
  IN_PROGRESS: { label: 'Đang xử lý', cls: 'bg-[#F3E8FF] text-[#A560E8] border-2 border-[#CE82FF]' },
  OVERDUE:     { label: 'Quá hạn',   cls: 'bg-[#FFDFDF] text-[#FF4B4B] border-2 border-[#FF4B4B]' },
  COMPLETED:   { label: 'Hoàn thành', cls: 'bg-[#D7FFB8] text-[#58A700] border-2 border-[#58CC02]' },
  CANCELLED:   { label: 'Đã huỷ',    cls: 'bg-[#F7F7F7] text-[#777777] border-2 border-[#E5E5E5]' },
}

const TABS = [
  { key: 'ACTIVE',      label: 'Cần xử lý',  statuses: ['OPEN', 'IN_PROGRESS', 'OVERDUE'] },
  { key: 'OPEN',        label: 'Chờ nhận',   statuses: ['OPEN'] },
  { key: 'IN_PROGRESS', label: 'Đang xử lý', statuses: ['IN_PROGRESS'] },
  { key: 'OVERDUE',     label: 'Quá hạn',    statuses: ['OVERDUE'] },
  { key: 'DONE',        label: 'Đã đóng',    statuses: ['COMPLETED', 'CANCELLED'] },
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
  if (diffMin < 60) return { text: `Còn ${diffMin} phút`, urgent: true }
  const hours = Math.floor(diffMin / 60)
  if (hours < 24) return { text: `Còn ${hours} giờ`, urgent: hours < 3 }
  return { text: `Còn ${Math.floor(hours / 24)} ngày`, urgent: false }
}

export default function TaskBoard({ facilityId, renderActions, reloadKey = 0 }) {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('ACTIVE')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const [lastUpdated, setLastUpdated] = useState(null)

  // Chỉ setState trong callback của promise (không set đồng bộ trong effect)
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

  const stats = useMemo(() => {
    const today = new Date().toDateString()
    return {
      open: tasks.filter(t => t.status === 'OPEN').length,
      inProgress: tasks.filter(t => t.status === 'IN_PROGRESS').length,
      overdue: tasks.filter(t => t.status === 'OVERDUE').length,
      doneToday: tasks.filter(t => t.status === 'COMPLETED' && t.completedAt
        && new Date(t.completedAt).toDateString() === today).length,
    }
  }, [tasks])

  const tabCounts = useMemo(() => {
    const counts = {}
    TABS.forEach(t => { counts[t.key] = tasks.filter(task => t.statuses.includes(task.status)).length })
    return counts
  }, [tasks])

  const visibleTasks = useMemo(() => {
    const statuses = TABS.find(t => t.key === tab).statuses
    const keyword = search.trim().toLowerCase()
    return tasks
      .filter(t => statuses.includes(t.status))
      .filter(t => typeFilter === 'ALL' || t.taskType === typeFilter)
      .filter(t => !keyword
        || t.contractCode?.toLowerCase().includes(keyword)
        || t.customerName?.toLowerCase().includes(keyword)
        || t.customerPhone?.includes(keyword)
        || t.storageUnitId?.toLowerCase().includes(keyword))
  }, [tasks, tab, typeFilter, search])

  return (
    <div className="flex flex-col gap-6">
      {/* Thống kê nhanh */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Chờ nhận', value: stats.open, icon: 'assignment', color: 'text-[#1CB0F6]', bg: 'bg-[#DDF4FF]', border: 'border-[#1CB0F6]' },
          { label: 'Đang xử lý', value: stats.inProgress, icon: 'pending', color: 'text-[#A560E8]', bg: 'bg-[#F3E8FF]', border: 'border-[#CE82FF]' },
          { label: 'Quá hạn', value: stats.overdue, icon: 'alarm', color: 'text-[#FF4B4B]', bg: 'bg-[#FFDFDF]', border: 'border-[#FF4B4B]' },
          { label: 'Xong hôm nay', value: stats.doneToday, icon: 'task_alt', color: 'text-[#58CC02]', bg: 'bg-[#D7FFB8]', border: 'border-[#58CC02]' },
        ].map(s => (
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
          {TABS.map(t => (
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
              placeholder="Tìm theo mã hợp đồng, tên / SĐT khách, mã ô kho..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="duo-input w-full pl-11 text-xs"
            />
          </div>
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="duo-input text-xs md:w-48 cursor-pointer"
          >
            <option value="ALL">Tất cả loại việc</option>
            <option value="CHECK_IN">Check-in</option>
            <option value="CHECK_OUT">Check-out</option>
          </select>
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

      {/* Danh sách thẻ công việc */}
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
            {search || typeFilter !== 'ALL' ? 'Không có công việc phù hợp bộ lọc.' : 'Không có công việc nào trong mục này.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {visibleTasks.map(task => {
            const type = TYPE_META[task.taskType] || { label: task.taskType, icon: 'task', cls: 'bg-[#F7F7F7] text-[#777777] border-[#E5E5E5]' }
            const status = STATUS_META[task.status] || { label: task.status, cls: 'bg-[#F7F7F7] text-[#777777] border-2 border-[#E5E5E5]' }
            const hint = dueHint(task)
            const actions = renderActions ? renderActions(task) : null
            return (
              <div
                key={task.id}
                className={`duo-card p-5 flex flex-col gap-4 ${task.status === 'OVERDUE' ? 'border-[#FF4B4B]' : ''}`}
              >
                {/* Dòng đầu: loại việc + trạng thái */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-2xl border-2 border-b-4 flex items-center justify-center shrink-0 ${type.cls}`}>
                      <span className="material-symbols-outlined text-[22px]">{type.icon}</span>
                    </div>
                    <div>
                      <p className="text-sm font-black text-[#4B4B4B] uppercase tracking-wide">{type.label}</p>
                      <p className="text-[11px] font-bold text-[#AFAFAF]">
                        Task #{task.id} · HĐ <span className="font-mono text-[#1CB0F6]">{task.contractCode || '—'}</span>
                      </p>
                    </div>
                  </div>
                  <span className={`duo-badge whitespace-nowrap ${status.cls}`}>{status.label}</span>
                </div>

                {/* Thông tin khách + ô kho */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-black uppercase text-[#AFAFAF]">Khách hàng</span>
                    <span className="font-black text-[#4B4B4B]">{task.customerName || '—'}</span>
                    <span className="font-bold text-[#777777]">{task.customerPhone || ''}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-black uppercase text-[#AFAFAF]">Ô kho</span>
                    <span className="font-black text-[#4B4B4B] font-mono">{task.storageUnitId || '—'}</span>
                    <span className="font-bold text-[#777777]">{task.unitTypeName || ''}</span>
                  </div>
                </div>

                {/* Hạn + người nhận */}
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#F7F7F7] px-4 py-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className={`material-symbols-outlined text-[18px] ${task.status === 'OVERDUE' || hint?.urgent ? 'text-[#FF4B4B]' : 'text-[#AFAFAF]'}`}>schedule</span>
                    <span className="font-black text-[#4B4B4B]">Hạn: {formatDue(task.dueAt)}</span>
                    {hint && (
                      <span className={`font-black ${hint.urgent ? 'text-[#FF4B4B]' : 'text-[#58A700]'}`}>· {hint.text}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 font-bold text-[#777777]">
                    <span className="material-symbols-outlined text-[18px] text-[#AFAFAF]">person</span>
                    {task.staffName ? <span className="font-black text-[#4B4B4B]">{task.staffName}</span> : <span>Chưa có người nhận</span>}
                  </div>
                </div>

                {task.note && (
                  <p className="text-[11px] font-bold text-[#777777] leading-relaxed">
                    <span className="font-black text-[#AFAFAF] uppercase mr-1">Ghi chú:</span>{task.note}
                  </p>
                )}

                {actions && <div className="flex justify-end gap-2 pt-1">{actions}</div>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
