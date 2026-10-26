import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAccessMatrix, getRoles, updateRoleDescription } from '../../services/adminService'
import { TaskToast } from '../../components/TaskActionFeedback'
import { ADMIN_ROLE_MATRIX, ROLE_ORDER, ROLE_STYLES, getRoleLabel } from '../../utils/roles'

// UC-03: Quản trị vai trò & phân quyền (Admin)
// PR-A1: 5 role cố định — chỉ xem số người dùng, ma trận quyền (chỉ đọc) và sửa mô tả.

const DESCRIPTION_MAX = 255

function getErrorMessage(err, fallback) {
  return err.response?.data?.message || fallback
}

function RoleCard({ role, onEdit }) {
  const style = ROLE_STYLES[role.name] || ROLE_STYLES.CUSTOMER
  return (
    <div className="duo-card p-5 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className={`w-12 h-12 rounded-2xl border-2 ${style.bg} ${style.border} ${style.text} flex items-center justify-center shrink-0`}>
          <span className="material-symbols-outlined text-[26px]">{style.icon}</span>
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-base font-black text-[#4B4B4B] leading-tight">{getRoleLabel(role.name)}</span>
          <span className={`duo-badge border-2 mt-1 self-start ${style.bg} ${style.border} ${style.text}`}>{role.name}</span>
        </div>
      </div>

      <p className={`text-sm font-bold leading-relaxed min-h-[40px] ${role.description ? 'text-[#777777]' : 'text-[#AFAFAF] italic'}`}>
        {role.description || 'Chưa có mô tả'}
      </p>

      <div className="flex items-center justify-between gap-2 pt-3 border-t-2 border-[#E5E5E5]">
        <Link
          to={`/admin/users?role=${role.name}`}
          className="text-xs font-bold text-[#777777] hover:text-[#1CB0F6]"
          title="Xem danh sách người dùng"
        >
          <span className="font-black text-[#4B4B4B]">{role.userCount}</span> người dùng ·{' '}
          <span className="font-black text-[#58A700]">{role.activeCount}</span> đang hoạt động
        </Link>
        <button onClick={() => onEdit(role)} className="duo-btn-white px-3 py-2 text-xs gap-1 shrink-0">
          <span className="material-symbols-outlined text-[16px]">edit</span>
          Sửa mô tả
        </button>
      </div>
    </div>
  )
}

function EditDescriptionModal({ role, onClose, onSaved }) {
  const [value, setValue] = useState(role.description || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const trimmed = value.trim()
  const tooLong = trimmed.length > DESCRIPTION_MAX
  const unchanged = trimmed === (role.description || '')
  const canSave = !saving && trimmed.length > 0 && !tooLong && !unchanged

  const handleSave = () => {
    const user = JSON.parse(sessionStorage.getItem('user') || '{}')
    setSaving(true)
    setError('')
    updateRoleDescription(role.id, trimmed, user.userId)
      .then((updated) => onSaved(updated))
      .catch((err) => {
        setError(getErrorMessage(err, 'Không lưu được mô tả. Vui lòng thử lại.'))
        setSaving(false)
      })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="duo-card bg-white w-full max-w-[520px] shadow-2xl p-6 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[#CE82FF] border-b-2 border-[#A559D9] text-white flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[24px]">edit_note</span>
          </div>
          <div className="flex flex-col">
            <h2 className="text-lg font-black text-[#4B4B4B] leading-tight">Sửa mô tả vai trò</h2>
            <span className="text-xs font-bold text-[#AFAFAF]">{getRoleLabel(role.name)} · {role.name}</span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <textarea
            value={value}
            onChange={(e) => { setValue(e.target.value); setError('') }}
            rows={4}
            autoFocus
            placeholder="Nhập mô tả vai trò..."
            className="duo-input w-full resize-none text-sm"
          />
          <span className={`self-end text-xs font-black ${tooLong ? 'text-[#FF4B4B]' : 'text-[#AFAFAF]'}`}>
            {trimmed.length}/{DESCRIPTION_MAX}
          </span>
        </div>

        {error && (
          <div role="alert" className="rounded-2xl border-2 border-b-4 border-[#FFDFDF] bg-[#FFF5F5] px-4 py-3 text-xs font-black text-[#FF4B4B] flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button onClick={onClose} disabled={saving} className="duo-btn-gray px-5 py-2.5 text-xs disabled:opacity-50">
            Huỷ
          </button>
          <button onClick={handleSave} disabled={!canSave} className="duo-btn-green px-5 py-2.5 text-xs gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed">
            {saving && <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>}
            Lưu
          </button>
        </div>
      </div>
    </div>
  )
}

function MatrixCell({ value }) {
  if (value === true) {
    return <span className="material-symbols-outlined text-[22px] text-[#58CC02]" title="Có quyền">check_circle</span>
  }
  if (typeof value === 'string') {
    return <span className="text-[11px] font-bold text-[#E58800] leading-tight">{value}</span>
  }
  return <span className="text-[#E5E5E5] font-black">—</span>
}

// PR-90: ma trận lấy thẳng từ bảng quyền backend đang áp dụng (AccessPolicy).
// Ô có chữ = phạm vi dữ liệu của vai trò đó; API lỗi thì rơi về ma trận tĩnh trong utils/roles.
function PermissionMatrix() {
  const [rows, setRows] = useState(null)
  const [fromBackend, setFromBackend] = useState(false)

  useEffect(() => {
    getAccessMatrix()
      .then((groups) => {
        setRows(groups.map((g) => ({ key: g.code, screens: g.name, description: g.description, access: g.roleScopes || {} })))
        setFromBackend(true)
      })
      .catch(() => setRows(ADMIN_ROLE_MATRIX.map((row) => ({ key: row.screens, ...row }))))
  }, [])

  if (!rows) {
    return <div className="duo-card h-[220px] animate-pulse bg-[#F7F7F7]" />
  }

  return (
    <div className="duo-card overflow-x-auto">
      {fromBackend && (
        <div className="flex items-center gap-2 px-5 pt-4 text-xs font-bold text-[#58A700]">
          <span className="material-symbols-outlined text-[18px]">verified_user</span>
          Đồng bộ với bảng phân quyền backend đang áp dụng cho mọi API ({rows.length} nhóm chức năng)
        </div>
      )}
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="border-b-2 border-[#E5E5E5]">
            <th className="text-left px-5 py-3 text-[11px] font-black uppercase tracking-wider text-[#AFAFAF]">Nhóm chức năng</th>
            {ROLE_ORDER.map((role) => (
              <th key={role} className="px-3 py-3 text-[11px] font-black uppercase tracking-wider text-[#AFAFAF] text-center w-[130px]">
                {getRoleLabel(role)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-b-2 border-[#F7F7F7] last:border-b-0">
              <td className="px-5 py-3">
                <div className="font-bold text-[#4B4B4B]">{row.screens}</div>
                {row.description && <div className="text-[11px] font-bold text-[#AFAFAF] mt-0.5">{row.description}</div>}
              </td>
              {ROLE_ORDER.map((role) => (
                <td key={role} className="px-3 py-3 text-center align-middle">
                  <MatrixCell value={row.access[role]} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function AdminRolesPage() {
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [editingRole, setEditingRole] = useState(null)
  const [toast, setToast] = useState(null)

  const fetchRoles = () => getRoles()
    .then((data) => { setRoles(data); setLoadError('') })
    .catch((err) => setLoadError(getErrorMessage(err, 'Không tải được danh sách vai trò.')))
    .finally(() => setLoading(false))

  useEffect(() => {
    fetchRoles()
  }, [])

  const handleRetry = () => {
    setLoading(true)
    fetchRoles()
  }

  const handleSaved = (updated) => {
    setRoles((current) => current.map((r) => (r.id === updated.id ? updated : r)))
    setEditingRole(null)
    setToast({ type: 'success', message: `Đã cập nhật mô tả vai trò ${getRoleLabel(updated.name)}.` })
  }

  return (
    <div className="p-8 flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-black text-[#4B4B4B]">Vai trò & phân quyền</h1>
        <p className="text-sm font-bold text-[#AFAFAF] mt-1">5 vai trò cố định của hệ thống — chỉ sửa được mô tả.</p>
      </div>

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {ROLE_ORDER.map((r) => (
            <div key={r} className="duo-card p-5 h-[190px] animate-pulse bg-[#F7F7F7]" />
          ))}
        </div>
      )}

      {!loading && loadError && (
        <div className="duo-card border-[#FFDFDF] bg-[#FFF5F5] p-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <span className="material-symbols-outlined text-[32px] text-[#FF4B4B]">cloud_off</span>
          <span className="flex-1 text-sm font-black text-[#FF4B4B]">{loadError}</span>
          <button onClick={handleRetry} className="duo-btn-white px-4 py-2 text-xs gap-1">
            <span className="material-symbols-outlined text-[16px]">refresh</span>
            Thử lại
          </button>
        </div>
      )}

      {!loading && !loadError && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {roles.map((role) => (
            <RoleCard key={role.id} role={role} onEdit={setEditingRole} />
          ))}
        </div>
      )}

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-black text-[#4B4B4B]">Ma trận quyền theo vai trò</h2>
          <p className="text-xs font-bold text-[#AFAFAF] mt-0.5">
            Quyền gắn với vai trò; phạm vi dữ liệu theo cơ sở được gán ở màn Người dùng. Gọi API ngoài quyền → 403.
          </p>
        </div>
        <PermissionMatrix />
      </section>

      {editingRole && (
        <EditDescriptionModal
          role={editingRole}
          onClose={() => setEditingRole(null)}
          onSaved={handleSaved}
        />
      )}

      <TaskToast toast={toast} onClose={() => setToast(null)} />
    </div>
  )
}
