import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAdminDashboard } from '../../services/adminService'
import { ActionCodeBadge, RoleBadge, SystemBadge } from '../../components/admin/AdminBadges'
import { USER_STATUS_STYLES } from '../../utils/roles'
import { formatLogTime, getTargetEntityLabel, toInputDate } from '../../utils/activityLogs'

// UC-31: Trang tổng quan Admin (/admin) — số thật, không tính tài khoản system.
// Mỗi ô số dẫn tới màn tương ứng (Người dùng đã lọc sẵn / Nhật ký hôm nay).

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

function StatTile({ to, icon, label, value, tone }) {
  return (
    <Link to={to} className="duo-card duo-card-interactive p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-2xl border-2 flex items-center justify-center shrink-0 ${tone}`}>
        <span className="material-symbols-outlined text-[26px]">{icon}</span>
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-2xl font-black text-[#4B4B4B] leading-tight">{value}</span>
        <span className="text-xs font-bold text-[#AFAFAF] truncate">{label}</span>
      </div>
    </Link>
  )
}

function SectionCard({ title, subtitle, action, children }) {
  return (
    <section className="duo-card p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-black text-[#4B4B4B]">{title}</h2>
          {subtitle && <p className="text-xs font-bold text-[#AFAFAF] mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

export default function AdminDashboardPage() {
  const currentUser = getCurrentUser()
  const [reloadTick, setReloadTick] = useState(0)
  // key = lần tải đã xong; khác reloadTick → đang tải (không setLoading trong effect)
  const [result, setResult] = useState({ key: null, data: null, error: '' })
  const loading = result.key !== reloadTick
  const data = result.data

  useEffect(() => {
    let cancelled = false
    getAdminDashboard(currentUser.userId)
      .then((res) => { if (!cancelled) setResult({ key: reloadTick, data: res, error: '' }) })
      .catch((err) => {
        if (!cancelled) setResult({ key: reloadTick, data: null, error: getErrorMessage(err, 'Không tải được số liệu tổng quan.') })
      })
    return () => { cancelled = true }
  }, [reloadTick, currentUser.userId])

  const today = toInputDate()

  return (
    <div className="p-8 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-black text-[#4B4B4B]">Tổng quan</h1>
        <p className="text-sm font-bold text-[#AFAFAF] mt-1">
          Xin chào{currentUser.fullName ? `, ${currentUser.fullName}` : ''} · tình hình tài khoản và hoạt động toàn hệ thống
        </p>
      </div>

      {loading && !data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="duo-card h-[92px] animate-pulse bg-[#F7F7F7]" />)}
        </div>
      )}

      {!loading && result.error && (
        <div className="duo-card border-[#FFDFDF] bg-[#FFF5F5] p-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <span className="material-symbols-outlined text-[32px] text-[#FF4B4B]">cloud_off</span>
          <span className="flex-1 text-sm font-black text-[#FF4B4B]">{result.error}</span>
          <button onClick={() => setReloadTick((t) => t + 1)} className="duo-btn-white px-4 py-2 text-xs gap-1">
            <span className="material-symbols-outlined text-[16px]">refresh</span>
            Thử lại
          </button>
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
            <StatTile to="/admin/users" icon="group" label="Tổng người dùng" value={data.totalUsers}
              tone="bg-[#DDF4FF] border-[#84D8FF] text-[#1899D6]" />
            <StatTile to="/admin/users?status=ACTIVE" icon={USER_STATUS_STYLES.ACTIVE.icon} label="Đang hoạt động" value={data.activeUsers}
              tone={USER_STATUS_STYLES.ACTIVE.className} />
            <StatTile to="/admin/users?status=LOCKED" icon={USER_STATUS_STYLES.LOCKED.icon} label="Đã khoá" value={data.lockedUsers}
              tone={USER_STATUS_STYLES.LOCKED.className} />
            <StatTile to="/admin/users?status=DISABLED" icon={USER_STATUS_STYLES.DISABLED.icon} label="Vô hiệu" value={data.disabledUsers}
              tone={USER_STATUS_STYLES.DISABLED.className} />
            <StatTile to={`/admin/logs?from=${today}&to=${today}`} icon="history" label="Hoạt động hôm nay" value={data.logsToday}
              tone="bg-[#F3E3FF] border-[#CE82FF] text-[#A559D9]" />
          </div>

          {/* Lịch sử đăng nhập hôm nay — nhiều lần thất bại là dấu hiệu dò mật khẩu */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <StatTile to="/admin/login-history" icon="login" label="Lượt đăng nhập hôm nay" value={data.loginsToday ?? 0}
              tone="bg-[#D7FFB8] border-[#58CC02] text-[#58A700]" />
            <StatTile to="/admin/login-history" icon="gpp_bad" label="Đăng nhập thất bại hôm nay" value={data.failedLoginsToday ?? 0}
              tone="bg-[#FFDFE0] border-[#FF4B4B] text-[#EA2B2B]" />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr] gap-6">
            <SectionCard title="Người dùng theo vai trò" subtitle="Đang hoạt động / tổng số — bấm để xem danh sách">
              <div className="flex flex-col gap-3">
                {data.roles.map((r) => {
                  const percent = r.total > 0 ? Math.round((r.active / r.total) * 100) : 0
                  return (
                    <Link key={r.role} to={`/admin/users?role=${r.role}`} className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-[#F7F7F7]">
                      <span className="w-[170px] shrink-0"><RoleBadge role={r.role} /></span>
                      <div className="flex-1 h-3 rounded-full bg-[#F7F7F7] overflow-hidden">
                        <div className="h-full rounded-full bg-[#58CC02]" style={{ width: `${percent}%` }} />
                      </div>
                      <span className="w-[70px] text-right text-sm font-bold text-[#777777]">
                        <span className="font-black text-[#58A700]">{r.active}</span> / {r.total}
                      </span>
                    </Link>
                  )
                })}
              </div>
            </SectionCard>

            <SectionCard title="Cơ sở chưa có quản lý" subtitle="Cơ sở đang hoạt động nhưng không có Quản lý cơ sở đang hoạt động (PR-A4)">
              {data.facilitiesWithoutManager.length === 0 ? (
                <div className="flex items-center gap-3 rounded-2xl border-2 border-[#58CC02] bg-[#D7FFB8] px-4 py-3">
                  <span className="material-symbols-outlined text-[22px] text-[#58A700]">verified</span>
                  <span className="text-sm font-black text-[#58A700]">Tất cả cơ sở đều đã có quản lý</span>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {data.facilitiesWithoutManager.map((f) => (
                    <div key={f.id} className="flex items-center gap-3 rounded-2xl border-2 border-[#FF9600] bg-[#FFE8CC] px-4 py-3">
                      <span className="material-symbols-outlined text-[22px] text-[#E58800]">warning</span>
                      <span className="flex-1 text-sm font-bold text-[#4B4B4B] min-w-0 truncate">
                        <span className="font-black">{f.code}</span> · {f.name}
                      </span>
                      <Link to={`/admin/users?facilityId=${f.id}`} className="duo-btn-white px-3 py-1.5 text-xs shrink-0">
                        Xem nhân sự
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>

          <SectionCard
            title="Hoạt động gần đây"
            subtitle="10 thao tác mới nhất toàn hệ thống"
            action={(
              <Link to="/admin/logs" className="duo-btn-white px-3 py-2 text-xs gap-1 shrink-0">
                Xem tất cả
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </Link>
            )}
          >
            {data.recentLogs.length === 0 ? (
              <p className="text-sm font-black text-[#AFAFAF] text-center py-6">Chưa có hoạt động nào được ghi lại</p>
            ) : (
              <ul className="flex flex-col">
                {data.recentLogs.map((log) => {
                  const time = formatLogTime(log.createdAt)
                  return (
                    <li key={log.id} className="flex flex-col md:flex-row md:items-start gap-2 md:gap-4 py-3 border-b-2 border-[#F7F7F7] last:border-b-0">
                      <span className="w-[130px] shrink-0 text-xs font-bold text-[#AFAFAF]">{time.date} {time.time}</span>
                      <div className="w-[200px] shrink-0 flex items-center gap-2 min-w-0">
                        <span className="text-sm font-black text-[#4B4B4B] truncate">{log.systemAccount ? 'Hệ thống' : log.userFullName}</span>
                        {log.systemAccount ? <SystemBadge /> : null}
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col gap-1">
                        <span className="self-start"><ActionCodeBadge code={log.actionCode} /></span>
                        <span className="text-sm font-bold text-[#777777] break-words">{log.content}</span>
                      </div>
                      <span className="shrink-0 text-xs font-bold text-[#AFAFAF] whitespace-nowrap">
                        {getTargetEntityLabel(log.targetEntity)}{log.targetId ? ` #${log.targetId}` : ''}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </SectionCard>
        </>
      )}
    </div>
  )
}
