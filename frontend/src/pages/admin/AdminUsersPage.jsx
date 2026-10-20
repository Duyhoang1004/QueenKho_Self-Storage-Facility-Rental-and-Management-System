import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  changeUserStatus,
  createUser,
  getUserFacilityOptions,
  getUsers,
  resetUserPassword,
  updateUser,
} from '../../services/adminService'
import { TaskToast } from '../../components/TaskActionFeedback'
import {
  FACILITY_ROLES,
  INTERNAL_ROLES,
  ROLE_ORDER,
  ROLE_STYLES,
  USER_STATUS_ORDER,
  USER_STATUS_STYLES,
  getRoleLabel,
} from '../../utils/roles'

// UC-08: Quản lý tài khoản người dùng toàn hệ thống (Admin)
// PR-03..05, PR-A2..A7 — mọi rule chặn nằm ở BE; FE chỉ kiểm tra sớm cho tiện và hiện lỗi BE trả về.

const PAGE_SIZE = 20
const NAME_MAX = 100
const REASON_MAX = 255
const PASSWORD_MIN = 6
const PHONE_REGEX = /^0\d{9}$/
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('vi-VN')
}

// ──────────────────────────────────────────────────────
// Thành phần nhỏ
// ──────────────────────────────────────────────────────

function RoleBadge({ role }) {
  const style = ROLE_STYLES[role] || ROLE_STYLES.CUSTOMER
  return (
    <span className={`duo-badge border-2 gap-1 whitespace-nowrap ${style.bg} ${style.border} ${style.text}`}>
      <span className="material-symbols-outlined text-[14px]">{style.icon}</span>
      {getRoleLabel(role)}
    </span>
  )
}

function StatusBadge({ status }) {
  const style = USER_STATUS_STYLES[status] || USER_STATUS_STYLES.DISABLED
  return (
    <span className={`duo-badge border-2 gap-1 whitespace-nowrap ${style.className}`}>
      <span className="material-symbols-outlined text-[14px]">{style.icon}</span>
      {style.label}
    </span>
  )
}

function IconButton({ icon, label, onClick, tone = 'text-[#777777] hover:text-[#1CB0F6]' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`w-9 h-9 rounded-xl border-2 border-[#E5E5E5] bg-white flex items-center justify-center hover:bg-[#F7F7F7] cursor-pointer ${tone}`}
    >
      <span className="material-symbols-outlined text-[18px]">{icon}</span>
    </button>
  )
}

function ModalShell({ icon, iconClass, title, subtitle, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="duo-card bg-white w-full max-w-[560px] max-h-[92vh] overflow-y-auto shadow-2xl p-6 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-2xl border-b-2 text-white flex items-center justify-center shrink-0 ${iconClass}`}>
            <span className="material-symbols-outlined text-[24px]">{icon}</span>
          </div>
          <div className="flex flex-col min-w-0">
            <h2 className="text-lg font-black text-[#4B4B4B] leading-tight">{title}</h2>
            {subtitle && <span className="text-xs font-bold text-[#AFAFAF] truncate">{subtitle}</span>}
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}

function ErrorAlert({ message }) {
  if (!message) return null
  return (
    <div role="alert" className="rounded-2xl border-2 border-b-4 border-[#FFDFDF] bg-[#FFF5F5] px-4 py-3 text-xs font-black text-[#FF4B4B] flex items-center gap-2">
      <span className="material-symbols-outlined text-[18px]">error</span>
      {message}
    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-black text-[#4B4B4B]">{label}</span>
      {children}
      {hint && <span className="text-[11px] font-bold text-[#AFAFAF]">{hint}</span>}
    </label>
  )
}

function ModalActions({ onClose, saving, canSave, onSave, saveLabel, saveClass = 'duo-btn-green' }) {
  return (
    <div className="flex justify-end gap-3 pt-1">
      <button type="button" onClick={onClose} disabled={saving} className="duo-btn-gray px-5 py-2.5 text-xs disabled:opacity-50">
        Huỷ
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={!canSave || saving}
        className={`${saveClass} px-5 py-2.5 text-xs gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {saving && <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>}
        {saveLabel}
      </button>
    </div>
  )
}

// ──────────────────────────────────────────────────────
// Modal Tạo / Sửa tài khoản
// ──────────────────────────────────────────────────────

function UserFormModal({ user, facilities, currentUserId, onClose, onDone }) {
  const isCreate = !user
  const isCustomer = user?.role === 'CUSTOMER'
  const isSelf = user?.id === currentUserId

  const [form, setForm] = useState({
    fullName: user?.fullName || '',
    email: user?.email || '',
    phone: user?.phone || '',
    roleName: user?.role && user.role !== 'CUSTOMER' ? user.role : 'STAFF',
    facilityId: user?.facilityId ? String(user.facilityId) : '',
    password: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const setField = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }))
    setError('')
  }

  const needsFacility = !isCustomer && FACILITY_ROLES.includes(form.roleName)

  // Cơ sở chọn được: đang ACTIVE, hoặc chính cơ sở hiện tại của user (BE cho giữ nguyên dù INACTIVE)
  const facilityChoices = facilities.filter(
    (f) => f.status === 'ACTIVE' || f.id === user?.facilityId,
  )

  // PR-04: sang FM → cơ sở đã có FM ACTIVE khác bị khoá
  const isFacilityTaken = (f) =>
    form.roleName === 'FACILITY_MANAGER' && f.managerId != null && f.managerId !== user?.id

  const validate = () => {
    const name = form.fullName.trim()
    if (!name || name.length > NAME_MAX) return `Họ tên bắt buộc, tối đa ${NAME_MAX} ký tự`
    if (isCreate && !EMAIL_REGEX.test(form.email.trim())) return 'Email không hợp lệ'
    if (!PHONE_REGEX.test(form.phone.trim())) return 'Số điện thoại phải gồm 10 chữ số, bắt đầu bằng 0'
    if (needsFacility && !form.facilityId) return 'Nhân viên / Quản lý cơ sở bắt buộc chọn cơ sở'
    if (isCreate && form.password.length < PASSWORD_MIN) return `Mật khẩu tối thiểu ${PASSWORD_MIN} ký tự`
    return ''
  }

  const handleSave = () => {
    const message = validate()
    if (message) {
      setError(message)
      return
    }
    const facilityId = needsFacility ? Number(form.facilityId) : null
    const request = isCreate
      ? createUser({
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          roleName: form.roleName,
          facilityId,
          password: form.password,
        }, currentUserId)
      : updateUser(user.id, {
          fullName: form.fullName.trim(),
          phone: form.phone.trim(),
          roleName: isCustomer ? null : form.roleName,
          facilityId,
        }, currentUserId)

    setSaving(true)
    setError('')
    request
      .then((result) => onDone(result, isCreate
        ? `Đã tạo tài khoản ${result.user.email}.`
        : `Đã cập nhật tài khoản ${result.user.email}.`))
      .catch((err) => {
        setError(getErrorMessage(err, 'Không lưu được tài khoản. Vui lòng thử lại.'))
        setSaving(false)
      })
  }

  return (
    <ModalShell
      icon={isCreate ? 'person_add' : 'manage_accounts'}
      iconClass={isCreate ? 'bg-[#58CC02] border-[#58A700]' : 'bg-[#1CB0F6] border-[#1899D6]'}
      title={isCreate ? 'Tạo tài khoản nội bộ' : 'Sửa tài khoản'}
      subtitle={isCreate ? 'Khách hàng tự đăng ký — không tạo ở đây' : user.email}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Họ tên *">
          <input
            value={form.fullName}
            onChange={(e) => setField('fullName', e.target.value)}
            maxLength={NAME_MAX}
            autoFocus
            className="duo-input w-full text-sm"
            placeholder="Nguyễn Văn A"
          />
        </Field>
        <Field label="Số điện thoại *">
          <input
            value={form.phone}
            onChange={(e) => setField('phone', e.target.value)}
            inputMode="numeric"
            maxLength={10}
            className="duo-input w-full text-sm"
            placeholder="09xxxxxxxx"
          />
        </Field>

        <div className="sm:col-span-2">
          <Field label={isCreate ? 'Email *' : 'Email'} hint={isCreate ? 'Dùng để đăng nhập, không sửa được sau khi tạo' : 'Email là tên đăng nhập — không sửa được'}>
            <input
              value={form.email}
              onChange={(e) => setField('email', e.target.value)}
              disabled={!isCreate}
              type="email"
              className="duo-input w-full text-sm disabled:bg-[#F7F7F7] disabled:text-[#AFAFAF]"
              placeholder="ten@queenkho.com"
            />
          </Field>
        </div>

        {isCustomer ? (
          <div className="sm:col-span-2 rounded-2xl border-2 border-[#E5E5E5] bg-[#F7F7F7] px-4 py-3 text-xs font-bold text-[#777777]">
            Khách hàng chỉ sửa được họ tên và số điện thoại — không đổi vai trò / cơ sở.
          </div>
        ) : (
          <>
            <Field label="Vai trò *" hint={isSelf ? 'Không thể tự đổi vai trò của chính mình' : undefined}>
              <select
                value={form.roleName}
                onChange={(e) => setField('roleName', e.target.value)}
                disabled={isSelf}
                className="duo-input w-full text-sm disabled:bg-[#F7F7F7] disabled:text-[#AFAFAF]"
              >
                {INTERNAL_ROLES.map((role) => (
                  <option key={role} value={role}>{getRoleLabel(role)}</option>
                ))}
              </select>
            </Field>

            {needsFacility ? (
              <Field label="Cơ sở *">
                <select
                  value={form.facilityId}
                  onChange={(e) => setField('facilityId', e.target.value)}
                  className="duo-input w-full text-sm"
                >
                  <option value="">— Chọn cơ sở —</option>
                  {facilityChoices.map((f) => {
                    const taken = isFacilityTaken(f)
                    return (
                      <option key={f.id} value={f.id} disabled={taken}>
                        {f.code} · {f.name}
                        {f.status !== 'ACTIVE' ? ' (ngừng hoạt động)' : ''}
                        {taken ? ` (đã có QL: ${f.managerName})` : ''}
                      </option>
                    )
                  })}
                </select>
              </Field>
            ) : (
              <Field label="Cơ sở">
                <div className="duo-input w-full text-sm bg-[#F7F7F7] text-[#AFAFAF]">Không gắn cơ sở</div>
              </Field>
            )}
          </>
        )}

        {isCreate && (
          <div className="sm:col-span-2">
            <Field label="Mật khẩu ban đầu *" hint={`Tối thiểu ${PASSWORD_MIN} ký tự — gửi cho người dùng qua kênh nội bộ`}>
              <input
                value={form.password}
                onChange={(e) => setField('password', e.target.value)}
                type="password"
                autoComplete="new-password"
                className="duo-input w-full text-sm"
              />
            </Field>
          </div>
        )}
      </div>

      <ErrorAlert message={error} />
      <ModalActions
        onClose={onClose}
        saving={saving}
        canSave
        onSave={handleSave}
        saveLabel={isCreate ? 'Tạo tài khoản' : 'Lưu thay đổi'}
      />
    </ModalShell>
  )
}

// ──────────────────────────────────────────────────────
// Modal Khoá / Vô hiệu / Mở lại
// ──────────────────────────────────────────────────────

const STATUS_ACTIONS = {
  LOCKED: {
    title: 'Khoá tài khoản',
    icon: 'lock',
    iconClass: 'bg-[#FF9600] border-[#E58800]',
    saveLabel: 'Khoá',
    saveClass: 'duo-btn-orange',
    done: 'Đã khoá',
  },
  DISABLED: {
    title: 'Vô hiệu tài khoản',
    icon: 'block',
    iconClass: 'bg-[#FF4B4B] border-[#EA2B2B]',
    saveLabel: 'Vô hiệu',
    saveClass: 'duo-btn-red',
    done: 'Đã vô hiệu',
  },
  ACTIVE: {
    title: 'Mở lại tài khoản',
    icon: 'lock_open',
    iconClass: 'bg-[#58CC02] border-[#58A700]',
    saveLabel: 'Mở lại',
    saveClass: 'duo-btn-green',
    done: 'Đã mở lại',
  },
}

function StatusModal({ user, targetStatus, currentUserId, onClose, onDone }) {
  const action = STATUS_ACTIONS[targetStatus]
  const needsReason = targetStatus !== 'ACTIVE'
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const trimmed = reason.trim()
  const tooLong = trimmed.length > REASON_MAX
  const canSave = !needsReason || (trimmed.length > 0 && !tooLong)

  const handleSave = () => {
    setSaving(true)
    setError('')
    changeUserStatus(user.id, targetStatus, needsReason ? trimmed : null, currentUserId)
      .then((result) => onDone(result, `${action.done} tài khoản ${result.user.email}.`))
      .catch((err) => {
        setError(getErrorMessage(err, 'Không đổi được trạng thái. Vui lòng thử lại.'))
        setSaving(false)
      })
  }

  return (
    <ModalShell icon={action.icon} iconClass={action.iconClass} title={action.title} subtitle={`${user.fullName} · ${user.email}`}>
      {targetStatus === 'LOCKED' && (
        <p className="text-sm font-bold text-[#777777]">
          Tạm khoá — người dùng không đăng nhập được cho tới khi được mở lại.
        </p>
      )}
      {targetStatus === 'DISABLED' && (
        <div className="rounded-2xl border-2 border-[#FFC800] bg-[#FFF9D6] px-4 py-3 text-xs font-bold text-[#B38F00] flex gap-2">
          <span className="material-symbols-outlined text-[18px]">warning</span>
          Dành cho nhân sự nghỉ việc / tài khoản ngừng sử dụng hẳn. Vẫn có thể mở lại khi cần.
        </div>
      )}
      {targetStatus === 'ACTIVE' && (
        <p className="text-sm font-bold text-[#777777]">
          Người dùng sẽ đăng nhập lại được với mật khẩu hiện tại.
        </p>
      )}
      {user.role === 'FACILITY_MANAGER' && needsReason && user.status === 'ACTIVE' && (
        <p className="text-xs font-bold text-[#E58800]">
          Cơ sở {user.facilityName || ''} có thể sẽ không còn quản lý sau thao tác này.
        </p>
      )}

      {needsReason && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-black text-[#4B4B4B]">Lý do *</span>
          <textarea
            value={reason}
            onChange={(e) => { setReason(e.target.value); setError('') }}
            rows={3}
            autoFocus
            placeholder="Ghi rõ lý do (lưu vào nhật ký hoạt động)..."
            className="duo-input w-full resize-none text-sm"
          />
          <span className={`self-end text-xs font-black ${tooLong ? 'text-[#FF4B4B]' : 'text-[#AFAFAF]'}`}>
            {trimmed.length}/{REASON_MAX}
          </span>
        </div>
      )}

      <ErrorAlert message={error} />
      <ModalActions
        onClose={onClose}
        saving={saving}
        canSave={canSave}
        onSave={handleSave}
        saveLabel={action.saveLabel}
        saveClass={action.saveClass}
      />
    </ModalShell>
  )
}

// ──────────────────────────────────────────────────────
// Modal Đặt lại mật khẩu (PR-A6)
// ──────────────────────────────────────────────────────

function PasswordModal({ user, currentUserId, onClose, onDone }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const mismatch = confirm.length > 0 && confirm !== password
  const canSave = password.length >= PASSWORD_MIN && confirm === password

  const handleSave = () => {
    setSaving(true)
    setError('')
    resetUserPassword(user.id, password, currentUserId)
      .then((result) => onDone(result, `Đã đặt lại mật khẩu cho ${result.user.email}.`))
      .catch((err) => {
        setError(getErrorMessage(err, 'Không đặt lại được mật khẩu. Vui lòng thử lại.'))
        setSaving(false)
      })
  }

  return (
    <ModalShell icon="key" iconClass="bg-[#CE82FF] border-[#A559D9]" title="Đặt lại mật khẩu" subtitle={`${user.fullName} · ${user.email}`}>
      <p className="text-sm font-bold text-[#777777]">
        Hệ thống không gửi email — hãy báo mật khẩu mới cho người dùng qua kênh nội bộ.
      </p>
      <Field label="Mật khẩu mới *" hint={`Tối thiểu ${PASSWORD_MIN} ký tự`}>
        <input
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError('') }}
          type="password"
          autoComplete="new-password"
          autoFocus
          className="duo-input w-full text-sm"
        />
      </Field>
      <Field label="Nhập lại mật khẩu *">
        <input
          value={confirm}
          onChange={(e) => { setConfirm(e.target.value); setError('') }}
          type="password"
          autoComplete="new-password"
          className={`duo-input w-full text-sm ${mismatch ? 'border-[#FF4B4B]' : ''}`}
        />
      </Field>
      {mismatch && <span className="text-xs font-black text-[#FF4B4B] -mt-2">Mật khẩu nhập lại không khớp</span>}

      <ErrorAlert message={error} />
      <ModalActions onClose={onClose} saving={saving} canSave={canSave} onSave={handleSave} saveLabel="Đặt lại" saveClass="duo-btn-blue" />
    </ModalShell>
  )
}

// ──────────────────────────────────────────────────────
// Trang chính
// ──────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const currentUserId = getCurrentUser().userId

  // Bộ lọc nằm trên URL → link /admin/users?role=STAFF từ UC-03 tự áp lọc, F5 không mất lọc
  const filters = {
    keyword: searchParams.get('keyword') || '',
    role: searchParams.get('role') || '',
    status: searchParams.get('status') || '',
    facilityId: searchParams.get('facilityId') || '',
  }
  const page = Math.max(Number(searchParams.get('page')) || 0, 0)

  const [keywordInput, setKeywordInput] = useState(filters.keyword)
  const [facilities, setFacilities] = useState([])
  const [reloadTick, setReloadTick] = useState(0)
  // result.key = bộ lọc đã tải xong; khác queryKey hiện tại → đang tải (không cần setLoading trong effect)
  const [result, setResult] = useState({ key: null, data: null, error: '' })
  const [modal, setModal] = useState(null) // { type: 'form' | 'status' | 'password', user, targetStatus }
  const [toast, setToast] = useState(null)

  const queryKey = `${searchParams.toString()}#${reloadTick}`
  const loading = result.key !== queryKey
  const data = result.data

  useEffect(() => {
    getUserFacilityOptions()
      .then(setFacilities)
      .catch(() => setFacilities([]))
  }, [reloadTick])

  useEffect(() => {
    let cancelled = false
    getUsers({
      keyword: filters.keyword || undefined,
      role: filters.role || undefined,
      status: filters.status || undefined,
      facilityId: filters.facilityId || undefined,
      page,
      size: PAGE_SIZE,
    })
      .then((res) => { if (!cancelled) setResult({ key: queryKey, data: res, error: '' }) })
      .catch((err) => {
        if (!cancelled) {
          setResult((current) => ({ key: queryKey, data: current.data, error: getErrorMessage(err, 'Không tải được danh sách người dùng.') }))
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

  // Ô tìm kiếm: debounce 400ms rồi mới đẩy lên URL
  useEffect(() => {
    if (keywordInput.trim() === filters.keyword) return undefined
    const timer = setTimeout(() => updateParams({ keyword: keywordInput.trim() }), 400)
    return () => clearTimeout(timer)
  }, [keywordInput, filters.keyword, updateParams])

  const hasFilter = Boolean(filters.keyword || filters.role || filters.status || filters.facilityId)

  const clearFilters = () => {
    setKeywordInput('')
    setSearchParams({}, { replace: true })
  }

  const closeModal = () => setModal(null)
  const closeToast = useCallback(() => setToast(null), [])

  const handleDone = (actionResult, message) => {
    setModal(null)
    setToast(actionResult.warning
      ? { type: 'warning', message: `${message} ⚠ ${actionResult.warning}.` }
      : { type: 'success', message })
    setReloadTick((tick) => tick + 1)
  }

  const users = data?.content || []
  const totalPages = data?.totalPages || 0

  return (
    <div className="p-8 flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#4B4B4B]">Người dùng</h1>
          <p className="text-sm font-bold text-[#AFAFAF] mt-1">
            {data ? `${data.totalElements} tài khoản` : 'Tài khoản toàn hệ thống'} · không xoá cứng, chỉ khoá / vô hiệu
          </p>
        </div>
        <button onClick={() => setModal({ type: 'form', user: null })} className="duo-btn-green px-5 py-3 text-sm gap-1.5 self-start sm:self-auto">
          <span className="material-symbols-outlined text-[20px]">person_add</span>
          Tạo tài khoản
        </button>
      </div>

      {/* Bộ lọc */}
      <div className="duo-card p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[1.6fr_1fr_1fr_1.2fr_auto] gap-3 items-center">
        <div className="relative">
          <span className="material-symbols-outlined text-[20px] text-[#AFAFAF] absolute left-3 top-1/2 -translate-y-1/2">search</span>
          <input
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            placeholder="Tìm tên, email, số điện thoại..."
            className="duo-input w-full text-sm pl-10"
          />
        </div>
        <select value={filters.role} onChange={(e) => updateParams({ role: e.target.value })} className="duo-input w-full text-sm">
          <option value="">Tất cả vai trò</option>
          {ROLE_ORDER.map((role) => <option key={role} value={role}>{getRoleLabel(role)}</option>)}
        </select>
        <select value={filters.status} onChange={(e) => updateParams({ status: e.target.value })} className="duo-input w-full text-sm">
          <option value="">Tất cả trạng thái</option>
          {USER_STATUS_ORDER.map((s) => <option key={s} value={s}>{USER_STATUS_STYLES[s].label}</option>)}
        </select>
        <select value={filters.facilityId} onChange={(e) => updateParams({ facilityId: e.target.value })} className="duo-input w-full text-sm">
          <option value="">Tất cả cơ sở</option>
          {facilities.map((f) => (
            <option key={f.id} value={f.id}>{f.code} · {f.name}{f.status !== 'ACTIVE' ? ' (ngừng)' : ''}</option>
          ))}
        </select>
        <button
          onClick={clearFilters}
          disabled={!hasFilter && !keywordInput}
          className="duo-btn-white px-4 py-2.5 text-xs gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span className="material-symbols-outlined text-[16px]">filter_alt_off</span>
          Xoá lọc
        </button>
      </div>

      {/* Lỗi tải */}
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

      {/* Bảng */}
      {!result.error && (
        <div className="duo-card overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b-2 border-[#E5E5E5]">
                {['Người dùng', 'SĐT', 'Vai trò', 'Cơ sở', 'Trạng thái', 'Ngày tạo', 'Thao tác'].map((h) => (
                  <th key={h} className={`px-4 py-3 text-[11px] font-black uppercase tracking-wider text-[#AFAFAF] ${h === 'Thao tác' ? 'text-right' : 'text-left'}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && !data && Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b-2 border-[#F7F7F7]">
                  <td colSpan={7} className="px-4 py-3">
                    <div className="h-9 rounded-xl bg-[#F7F7F7] animate-pulse" />
                  </td>
                </tr>
              ))}

              {data && users.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-14 text-center">
                    <span className="material-symbols-outlined text-[40px] text-[#E5E5E5]">person_search</span>
                    <p className="text-sm font-black text-[#AFAFAF] mt-2">Không có người dùng phù hợp</p>
                  </td>
                </tr>
              )}

              {users.map((u) => {
                const isSelf = u.id === currentUserId
                return (
                  <tr key={u.id} className={`border-b-2 border-[#F7F7F7] last:border-b-0 ${loading ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex flex-col min-w-0">
                        <span className="font-black text-[#4B4B4B] truncate">
                          {u.fullName}
                          {isSelf && <span className="ml-1.5 text-xs font-bold text-[#1CB0F6]">(Bạn)</span>}
                        </span>
                        <span className="text-xs font-bold text-[#AFAFAF] truncate">{u.email}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-bold text-[#777777] whitespace-nowrap">{u.phone}</td>
                    <td className="px-4 py-3"><RoleBadge role={u.role} /></td>
                    <td className="px-4 py-3 font-bold text-[#777777]">
                      {u.facilityId
                        ? <span className="whitespace-nowrap"><span className="font-black text-[#4B4B4B]">{u.facilityCode}</span> · {u.facilityName}</span>
                        : <span className="text-[#E5E5E5] font-black">—</span>}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={u.status} /></td>
                    <td className="px-4 py-3 font-bold text-[#777777] whitespace-nowrap">{formatDate(u.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <IconButton icon="edit" label="Sửa" onClick={() => setModal({ type: 'form', user: u })} />
                        {u.status === 'ACTIVE' && !isSelf && (
                          <>
                            <IconButton icon="lock" label="Khoá" tone="text-[#E58800] hover:text-[#FF9600]"
                              onClick={() => setModal({ type: 'status', user: u, targetStatus: 'LOCKED' })} />
                            <IconButton icon="block" label="Vô hiệu" tone="text-[#FF4B4B] hover:text-[#EA2B2B]"
                              onClick={() => setModal({ type: 'status', user: u, targetStatus: 'DISABLED' })} />
                          </>
                        )}
                        {u.status === 'LOCKED' && (
                          <IconButton icon="block" label="Vô hiệu" tone="text-[#FF4B4B] hover:text-[#EA2B2B]"
                            onClick={() => setModal({ type: 'status', user: u, targetStatus: 'DISABLED' })} />
                        )}
                        {u.status !== 'ACTIVE' && (
                          <IconButton icon="lock_open" label="Mở lại" tone="text-[#58A700] hover:text-[#58CC02]"
                            onClick={() => setModal({ type: 'status', user: u, targetStatus: 'ACTIVE' })} />
                        )}
                        <IconButton icon="key" label="Đặt lại mật khẩu" tone="text-[#A559D9] hover:text-[#CE82FF]"
                          onClick={() => setModal({ type: 'password', user: u })} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Phân trang */}
      {data && totalPages > 1 && (
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

      {modal?.type === 'form' && (
        <UserFormModal user={modal.user} facilities={facilities} currentUserId={currentUserId} onClose={closeModal} onDone={handleDone} />
      )}
      {modal?.type === 'status' && (
        <StatusModal user={modal.user} targetStatus={modal.targetStatus} currentUserId={currentUserId} onClose={closeModal} onDone={handleDone} />
      )}
      {modal?.type === 'password' && (
        <PasswordModal user={modal.user} currentUserId={currentUserId} onClose={closeModal} onDone={handleDone} />
      )}

      <TaskToast toast={toast} onClose={closeToast} />
    </div>
  )
}
