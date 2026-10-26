import { useEffect, useState } from 'react'
import { getLoginHistory } from '../../services/adminService'
import { RoleBadge } from '../../components/admin/AdminBadges'
import { formatLogTime, toInputDate } from '../../utils/activityLogs'

// Admin: lịch sử đăng nhập / đăng xuất toàn hệ thống (ai, lúc nào, từ IP nào, thành công hay thất bại)

const PAGE_SIZE = 20

const EVENT_STYLES = {
  LOGIN_SUCCESS: { label: 'Đăng nhập', icon: 'login', className: 'bg-[#D7FFB8] text-[#58A700] border-[#58CC02]' },
  LOGIN_FAILED: { label: 'Thất bại', icon: 'gpp_bad', className: 'bg-[#FFDFE0] text-[#EA2B2B] border-[#FF4B4B]' },
  LOGOUT: { label: 'Đăng xuất', icon: 'logout', className: 'bg-[#F7F7F7] text-[#777777] border-[#E5E5E5]' },
}

const FAILURE_LABELS = {
  INVALID_CREDENTIALS: 'Sai email hoặc mật khẩu',
  ACCOUNT_LOCKED: 'Tài khoản đang bị khoá',
  ACCOUNT_DISABLED: 'Tài khoản đã vô hiệu hoá',
}

function daysAgo(days) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return toInputDate(date)
}

// Rút gọn User-Agent thành "Chrome · Windows" cho dễ đọc
function describeAgent(agent) {
  if (!agent) return '—'
  const browser = /Edg\//.test(agent) ? 'Edge' : /Chrome\//.test(agent) ? 'Chrome' : /Firefox\//.test(agent) ? 'Firefox'
    : /Safari\//.test(agent) ? 'Safari' : agent.split(/[ /]/)[0]
  const os = /Windows/.test(agent) ? 'Windows' : /Android/.test(agent) ? 'Android' : /iPhone|iPad/.test(agent) ? 'iOS'
    : /Mac OS/.test(agent) ? 'macOS' : /Linux/.test(agent) ? 'Linux' : ''
  return os ? `${browser} · ${os}` : browser
}

export default function AdminLoginHistoryPage() {
  const [keywordDraft, setKeywordDraft] = useState('')
  const [filters, setFilters] = useState({ keyword: '', eventType: '', from: '', to: '' })
  const [page, setPage] = useState(0)
  const [reloadTick, setReloadTick] = useState(0)
  // result.key = bộ lọc đã tải xong; khác queryKey hiện tại → đang tải (không setState đồng bộ trong effect)
  const [result, setResult] = useState({ key: null, data: null, error: '' })
  const queryKey = JSON.stringify({ filters, page, reloadTick })
  const state = { loading: result.key !== queryKey, data: result.data, error: result.error }

  // Gõ xong 400ms mới tìm
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((current) => (current.keyword === keywordDraft.trim() ? current : { ...current, keyword: keywordDraft.trim() }))
      setPage(0)
    }, 400)
    return () => clearTimeout(timer)
  }, [keywordDraft])

  useEffect(() => {
    let cancelled = false
    const params = { page, size: PAGE_SIZE }
    Object.entries(filters).forEach(([key, value]) => { if (value) params[key] = value })
    getLoginHistory(params)
      .then((data) => { if (!cancelled) setResult({ key: queryKey, data, error: '' }) })
      .catch((err) => {
        if (!cancelled) {
          setResult((current) => ({ key: queryKey, data: current.data, error: err.response?.data?.message || 'Không tải được lịch sử đăng nhập.' }))
        }
      })
    return () => { cancelled = true }
    // queryKey gói đủ bộ lọc + trang + lần tải lại
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey])

  const updateFilter = (changes) => {
    setFilters((current) => ({ ...current, ...changes }))
    setPage(0)
  }

  const today = toInputDate()
  const quickRanges = [
    { label: 'Hôm nay', from: today, to: today },
    { label: '7 ngày', from: daysAgo(6), to: today },
    { label: '30 ngày', from: daysAgo(29), to: today },
  ]
  const rows = state.data?.content || []
  const totalPages = state.data?.totalPages || 0
  const hasFilter = Boolean(filters.keyword || filters.eventType || filters.from || filters.to)

  return (
    <div className="p-8 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-black text-[#4B4B4B]">Lịch sử đăng nhập</h1>
        <p className="text-sm font-bold text-[#AFAFAF] mt-1">
          {state.data ? `${state.data.totalElements} lượt` : 'Toàn hệ thống'} · đăng nhập thành công, thất bại và đăng xuất
        </p>
      </div>

      <div className="duo-card p-4 flex flex-col gap-3">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-3">
          <div className="relative">
            <span className="material-symbols-outlined text-[20px] text-[#AFAFAF] absolute left-3 top-1/2 -translate-y-1/2">search</span>
            <input
              value={keywordDraft}
              onChange={(e) => setKeywordDraft(e.target.value)}
              placeholder="Email, họ tên hoặc IP"
              className="duo-input w-full text-sm pl-10"
            />
          </div>
          <select value={filters.eventType} onChange={(e) => updateFilter({ eventType: e.target.value })} className="duo-input w-full text-sm">
            <option value="">Tất cả sự kiện</option>
            {Object.entries(EVENT_STYLES).map(([code, style]) => <option key={code} value={code}>{style.label}</option>)}
          </select>
        </div>
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="flex items-center gap-2">
          <input type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => updateFilter({ from: e.target.value })} className="duo-input text-sm" aria-label="Từ ngày" />
          <span className="text-xs font-black text-[#AFAFAF]">→</span>
          <input type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => updateFilter({ to: e.target.value })} className="duo-input text-sm" aria-label="Đến ngày" />
        </div>
        <div className="flex flex-wrap gap-2">
          {quickRanges.map((range) => (
            <button
              key={range.label}
              type="button"
              onClick={() => updateFilter({ from: range.from, to: range.to })}
              className={`${filters.from === range.from && filters.to === range.to ? 'duo-btn-blue' : 'duo-btn-white'} px-3 py-2 text-xs`}
            >
              {range.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => { setKeywordDraft(''); setFilters({ keyword: '', eventType: '', from: '', to: '' }); setPage(0) }}
            disabled={!hasFilter}
            className="duo-btn-white px-3 py-2 text-xs gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-[16px]">filter_alt_off</span>
            Xoá lọc
          </button>
        </div>
        </div>
      </div>

      {state.error && (
        <div className="duo-card border-[#FFDFDF] bg-[#FFF5F5] p-6 flex items-center gap-4">
          <span className="material-symbols-outlined text-[32px] text-[#FF4B4B]">cloud_off</span>
          <span className="flex-1 text-sm font-black text-[#FF4B4B]">{state.error}</span>
          <button onClick={() => setReloadTick((t) => t + 1)} className="duo-btn-white px-4 py-2 text-xs gap-1">
            <span className="material-symbols-outlined text-[16px]">refresh</span>
            Thử lại
          </button>
        </div>
      )}

      {!state.error && (
        <div className="duo-card overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b-2 border-[#E5E5E5]">
                {['Thời gian', 'Tài khoản', 'Sự kiện', 'Địa chỉ IP', 'Trình duyệt'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-[#AFAFAF]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {state.loading && !state.data && Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b-2 border-[#F7F7F7]">
                  <td colSpan={5} className="px-4 py-3"><div className="h-9 rounded-xl bg-[#F7F7F7] animate-pulse" /></td>
                </tr>
              ))}
              {state.data && rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-14 text-center">
                    <span className="material-symbols-outlined text-[40px] text-[#E5E5E5]">history</span>
                    <p className="text-sm font-black text-[#AFAFAF] mt-2">{hasFilter ? 'Không có lượt nào phù hợp bộ lọc' : 'Chưa có lượt đăng nhập nào'}</p>
                  </td>
                </tr>
              )}
              {rows.map((row) => {
                const time = formatLogTime(row.createdAt)
                const style = EVENT_STYLES[row.eventType] || EVENT_STYLES.LOGOUT
                return (
                  <tr key={row.id} className={`border-b-2 border-[#F7F7F7] last:border-b-0 ${state.loading ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="font-black text-[#4B4B4B]">{time.date}</span>
                        <span className="text-xs font-bold text-[#AFAFAF]">{time.time}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1 max-w-[260px]">
                        <span className="font-black text-[#4B4B4B] truncate">{row.fullName || 'Không có tài khoản'}</span>
                        <span className="text-xs font-bold text-[#AFAFAF] truncate">{row.email}</span>
                        {row.role && <span className="self-start"><RoleBadge role={row.role} /></span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`duo-badge border-2 gap-1 ${style.className}`}>
                        <span className="material-symbols-outlined text-[14px]">{style.icon}</span>
                        {style.label}
                      </span>
                      {row.failureReason && (
                        <p className="text-xs font-bold text-[#EA2B2B] mt-1">{FAILURE_LABELS[row.failureReason] || row.failureReason}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-bold text-[#777777]">{row.ipAddress || '—'}</td>
                    <td className="px-4 py-3 text-xs font-bold text-[#777777]" title={row.userAgent || ''}>{describeAgent(row.userAgent)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {state.data && !state.error && totalPages > 1 && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-bold text-[#AFAFAF]">
            Trang <span className="font-black text-[#4B4B4B]">{state.data.page + 1}</span> / {totalPages}
          </span>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => p - 1)} disabled={page <= 0 || state.loading} className="duo-btn-white px-4 py-2 text-xs gap-1 disabled:opacity-40 disabled:cursor-not-allowed">
              <span className="material-symbols-outlined text-[16px]">chevron_left</span>
              Trước
            </button>
            <button onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages - 1 || state.loading} className="duo-btn-white px-4 py-2 text-xs gap-1 disabled:opacity-40 disabled:cursor-not-allowed">
              Sau
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
