import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getActivityLogTargetEntities, getActivityLogs } from '../../services/adminService'
import { ActionCodeBadge, RoleBadge, SystemBadge } from '../../components/admin/AdminBadges'
import { ROLE_ORDER, getRoleLabel } from '../../utils/roles'
import { formatLogTime, getTargetEntityLabel, toInputDate } from '../../utils/activityLogs'

// UC-31: Nhật ký hoạt động toàn hệ thống (Admin)
// PR-07: chỉ xem · PR-A8: người thao tác thật / "Tự động" cho job · PR-A11: lọc người, role, đối tượng, mã, ngày

const PAGE_SIZE = 20
const FILTER_KEYS = ['userId', 'actor', 'role', 'targetEntity', 'targetId', 'keyword', 'from', 'to']

function getErrorMessage(err, fallback) {
  return err.response?.data?.message || fallback
}

function getCurrentUser() {
  try {
    return JSON.parse(sessionStorage.getItem('user') || '{}')
  } catch {
    return {}
  }
}

function daysAgo(days) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return toInputDate(date)
}

// Ô nhập có debounce: gõ xong 400ms mới đẩy lên URL.
// Khi URL đổi từ bên ngoài (Xoá lọc, bấm mã đối tượng trong bảng) → đồng bộ lại chữ trong ô.
function DebouncedInput({ value, onCommit, icon, ...props }) {
  const [draft, setDraft] = useState(value)
  const [lastValue, setLastValue] = useState(value)
  if (value !== lastValue) {
    setLastValue(value)
    setDraft(value)
  }

  useEffect(() => {
    if (draft.trim() === value) return undefined
    const timer = setTimeout(() => onCommit(draft.trim()), 400)
    return () => clearTimeout(timer)
  }, [draft, value, onCommit])

  return (
    <div className="relative">
      {icon && (
        <span className="material-symbols-outlined text-[20px] text-[#AFAFAF] absolute left-3 top-1/2 -translate-y-1/2">{icon}</span>
      )}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className={`duo-input w-full text-sm ${icon ? 'pl-10' : ''}`}
        {...props}
      />
    </div>
  )
}

function FilterChip({ label, onRemove }) {
  return (
    <span className="duo-badge border-2 gap-1 bg-[#DDF4FF] border-[#84D8FF] text-[#1899D6]">
      {label}
      <button type="button" onClick={onRemove} aria-label={`Bỏ lọc ${label}`} className="flex items-center hover:text-[#FF4B4B] cursor-pointer">
        <span className="material-symbols-outlined text-[14px]">close</span>
      </button>
    </span>
  )
}

export default function AdminLogsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const currentUserId = getCurrentUser().userId

  // Bộ lọc nằm trên URL → F5 không mất lọc, dashboard link /admin/logs?from=...&to=... được
  const filters = Object.fromEntries(FILTER_KEYS.map((key) => [key, searchParams.get(key) || '']))
  const page = Math.max(Number(searchParams.get('page')) || 0, 0)

  const [targetEntities, setTargetEntities] = useState([])
  const [reloadTick, setReloadTick] = useState(0)
  // result.key = bộ lọc đã tải xong; khác queryKey hiện tại → đang tải (không cần setLoading trong effect)
  const [result, setResult] = useState({ key: null, data: null, error: '' })

  const queryKey = `${searchParams.toString()}#${reloadTick}`
  const loading = result.key !== queryKey
  const data = result.data
  const dateError = filters.from && filters.to && filters.from > filters.to
    ? 'Từ ngày phải trước hoặc bằng đến ngày' : ''

  useEffect(() => {
    getActivityLogTargetEntities(currentUserId)
      .then(setTargetEntities)
      .catch(() => setTargetEntities([]))
  }, [currentUserId])

  useEffect(() => {
    let cancelled = false
    const params = { page, size: PAGE_SIZE }
    FILTER_KEYS.forEach((key) => { if (filters[key]) params[key] = filters[key] })
    getActivityLogs(params, currentUserId)
      .then((res) => { if (!cancelled) setResult({ key: queryKey, data: res, error: '' }) })
      .catch((err) => {
        if (!cancelled) {
          setResult((current) => ({ key: queryKey, data: current.data, error: getErrorMessage(err, 'Không tải được nhật ký hoạt động.') }))
        }
      })
    return () => { cancelled = true }
    // queryKey gói đủ bộ lọc + trang + lần tải lại
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey])

  const updateParams = useCallback((changes) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      Object.entries(changes).forEach(([key, value]) => {
        if (value === '' || value == null) next.delete(key)
        else next.set(key, String(value))
      })
      // Đổi bộ lọc → về trang đầu
      if (!('page' in changes)) next.delete('page')
      return next
    }, { replace: true })
  }, [setSearchParams])

  const commitKeyword = useCallback((value) => updateParams({ keyword: value }), [updateParams])
  const commitActor = useCallback((value) => updateParams({ actor: value }), [updateParams])
  const commitTargetId = useCallback((value) => updateParams({ targetId: value }), [updateParams])

  const hasFilter = FILTER_KEYS.some((key) => filters[key])
  const logs = data?.content || []
  const totalPages = data?.totalPages || 0

  // Tên người đang lọc theo userId: mọi dòng đều của người đó → lấy từ dòng đầu
  const filteredUserName = filters.userId
    ? (logs.find((l) => String(l.userId) === filters.userId)?.userFullName || `#${filters.userId}`)
    : ''

  const today = toInputDate()
  const quickRanges = [
    { label: 'Hôm nay', from: today, to: today },
    { label: '7 ngày', from: daysAgo(6), to: today },
    { label: '30 ngày', from: daysAgo(29), to: today },
  ]

  return (
    <div className="p-8 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-black text-[#4B4B4B]">Nhật ký hoạt động</h1>
        <p className="text-sm font-bold text-[#AFAFAF] mt-1">
          {data ? `${data.totalElements} bản ghi` : 'Toàn hệ thống'} · chỉ xem, không sửa / xoá
        </p>
      </div>

      {/* Bộ lọc */}
      <div className="duo-card p-4 flex flex-col gap-3">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[1.6fr_1.2fr_1fr_1fr] gap-3">
          <DebouncedInput
            value={filters.keyword}
            onCommit={commitKeyword}
            icon="search"
            placeholder="Tìm trong nội dung, vd [CHECK_IN]..."
          />
          <DebouncedInput
            value={filters.actor}
            onCommit={commitActor}
            icon="person_search"
            placeholder="Người thao tác (tên / email)"
          />
          <select value={filters.role} onChange={(e) => updateParams({ role: e.target.value })} className="duo-input w-full text-sm">
            <option value="">Tất cả vai trò</option>
            {ROLE_ORDER.map((role) => <option key={role} value={role}>{getRoleLabel(role)}</option>)}
          </select>
          <select value={filters.targetEntity} onChange={(e) => updateParams({ targetEntity: e.target.value })} className="duo-input w-full text-sm">
            <option value="">Tất cả đối tượng</option>
            {/* Giữ lựa chọn đang có trên URL dù danh sách chưa tải xong */}
            {[...new Set([...targetEntities, ...(filters.targetEntity ? [filters.targetEntity] : [])])].map((entity) => (
              <option key={entity} value={entity}>{getTargetEntityLabel(entity)}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="w-full lg:w-[180px]">
            <DebouncedInput
              value={filters.targetId}
              onCommit={commitTargetId}
              icon="tag"
              placeholder="Mã đối tượng"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={filters.from}
              max={filters.to || undefined}
              onChange={(e) => updateParams({ from: e.target.value })}
              className="duo-input text-sm"
              aria-label="Từ ngày"
            />
            <span className="text-xs font-black text-[#AFAFAF]">→</span>
            <input
              type="date"
              value={filters.to}
              min={filters.from || undefined}
              onChange={(e) => updateParams({ to: e.target.value })}
              className="duo-input text-sm"
              aria-label="Đến ngày"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {quickRanges.map((range) => {
              const active = filters.from === range.from && filters.to === range.to
              return (
                <button
                  key={range.label}
                  type="button"
                  onClick={() => updateParams({ from: range.from, to: range.to })}
                  className={`${active ? 'duo-btn-blue' : 'duo-btn-white'} px-3 py-2 text-xs`}
                >
                  {range.label}
                </button>
              )
            })}
          </div>
          <button
            onClick={() => setSearchParams({}, { replace: true })}
            disabled={!hasFilter}
            className="duo-btn-white px-4 py-2.5 text-xs gap-1 lg:ml-auto disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-[16px]">filter_alt_off</span>
            Xoá lọc
          </button>
        </div>

        {filters.userId && (
          <div className="flex flex-wrap gap-2">
            <FilterChip label={`Người thao tác: ${filteredUserName}`} onRemove={() => updateParams({ userId: '' })} />
          </div>
        )}
      </div>

      {/* Lỗi tải (gồm lỗi khoảng ngày do BE trả về) */}
      {!loading && (result.error || dateError) && (
        <div className="duo-card border-[#FFDFDF] bg-[#FFF5F5] p-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <span className="material-symbols-outlined text-[32px] text-[#FF4B4B]">{dateError ? 'event_busy' : 'cloud_off'}</span>
          <span className="flex-1 text-sm font-black text-[#FF4B4B]">{dateError || result.error}</span>
          {!dateError && (
            <button onClick={() => setReloadTick((t) => t + 1)} className="duo-btn-white px-4 py-2 text-xs gap-1">
              <span className="material-symbols-outlined text-[16px]">refresh</span>
              Thử lại
            </button>
          )}
        </div>
      )}

      {/* Bảng */}
      {!result.error && !dateError && (
        <div className="duo-card overflow-x-auto">
          <table className="w-full min-w-[1000px] text-sm">
            <thead>
              <tr className="border-b-2 border-[#E5E5E5]">
                {['Thời gian', 'Người thao tác', 'Mã nghiệp vụ', 'Nội dung', 'Đối tượng'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-[#AFAFAF]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && !data && Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b-2 border-[#F7F7F7]">
                  <td colSpan={5} className="px-4 py-3">
                    <div className="h-9 rounded-xl bg-[#F7F7F7] animate-pulse" />
                  </td>
                </tr>
              ))}

              {data && logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-14 text-center">
                    <span className="material-symbols-outlined text-[40px] text-[#E5E5E5]">manage_search</span>
                    <p className="text-sm font-black text-[#AFAFAF] mt-2">
                      {hasFilter ? 'Không có bản ghi phù hợp bộ lọc' : 'Chưa có hoạt động nào được ghi lại'}
                    </p>
                  </td>
                </tr>
              )}

              {logs.map((log) => {
                const time = formatLogTime(log.createdAt)
                return (
                  <tr key={log.id} className={`border-b-2 border-[#F7F7F7] last:border-b-0 align-top ${loading ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="font-black text-[#4B4B4B]">{time.date}</span>
                        <span className="text-xs font-bold text-[#AFAFAF]">{time.time}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1 min-w-0 max-w-[230px]">
                        <button
                          type="button"
                          onClick={() => updateParams({ userId: log.userId })}
                          title="Chỉ xem log của người này"
                          className="text-left font-black text-[#4B4B4B] hover:text-[#1CB0F6] truncate cursor-pointer"
                        >
                          {log.systemAccount ? 'Hệ thống' : log.userFullName}
                        </button>
                        {!log.systemAccount && <span className="text-xs font-bold text-[#AFAFAF] truncate">{log.userEmail}</span>}
                        <span className="self-start">{log.systemAccount ? <SystemBadge /> : <RoleBadge role={log.userRole} />}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3"><ActionCodeBadge code={log.actionCode} /></td>
                    <td className="px-4 py-3 font-bold text-[#777777] leading-relaxed break-words whitespace-pre-wrap max-w-[460px]">
                      {log.content}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {log.targetEntity ? (
                        <div className="flex flex-col">
                          <span className="font-bold text-[#777777]">{getTargetEntityLabel(log.targetEntity)}</span>
                          {log.targetId && (
                            <button
                              type="button"
                              onClick={() => updateParams({ targetEntity: log.targetEntity, targetId: log.targetId })}
                              title="Xem mọi log của đối tượng này"
                              className="self-start font-black text-[#1CB0F6] hover:underline cursor-pointer"
                            >
                              #{log.targetId}
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-[#E5E5E5] font-black">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Phân trang */}
      {data && !result.error && !dateError && totalPages > 1 && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-bold text-[#AFAFAF]">
            Trang <span className="font-black text-[#4B4B4B]">{data.page + 1}</span> / {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => updateParams({ page: page - 1 || '' })}
              disabled={page <= 0 || loading}
              className="duo-btn-white px-4 py-2 text-xs gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-[16px]">chevron_left</span>
              Trước
            </button>
            <button
              onClick={() => updateParams({ page: page + 1 })}
              disabled={page >= totalPages - 1 || loading}
              className="duo-btn-white px-4 py-2 text-xs gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Sau
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
