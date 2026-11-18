import { useEffect, useState } from 'react'
import { getMyProfile, updateMyProfile, changeMyPassword } from '../../services/authService'
import { CCCD_ERROR, digitsOnly, isValidCccd, isValidPhone, PHONE_ERROR } from '../../utils/validators'

const ROLE_LABELS = {
  CUSTOMER: 'Khách hàng',
  STAFF: 'Nhân viên cơ sở',
  FACILITY_MANAGER: 'Quản lý cơ sở',
  BOM: 'Giám đốc vận hành (BOM)',
  ADMIN: 'Quản trị hệ thống',
}

function getInitials(fullName) {
  if (!fullName) return 'QK'
  const parts = String(fullName).trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return parts[0][0].toUpperCase()
}

function formatCreatedAt(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export default function UserProfilePage() {
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)

  // Form thông tin cá nhân
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [cccd, setCccd] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMsg, setProfileMsg] = useState(null) // { ok: boolean, text: string }

  // Form đổi mật khẩu
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPwd, setShowCurrentPwd] = useState(false)
  const [showNewPwd, setShowNewPwd] = useState(false)
  const [showConfirmPwd, setShowConfirmPwd] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordMsg, setPasswordMsg] = useState(null) // { ok: boolean, text: string }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getMyProfile()
      .then((data) => {
        if (cancelled) return
        setProfile(data)
        setFullName(data.fullName || '')
        setPhone(data.phone || '')
        setCccd(data.cccd || '')
      })
      .catch(() => {
        if (cancelled) return
        try {
          const cached = JSON.parse(sessionStorage.getItem('user') || '{}')
          setProfile(cached)
          setFullName(cached.fullName || '')
          setPhone(cached.phone || '')
          setCccd(cached.cccd || '')
        } catch {
          // ignore
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    setProfileMsg(null)

    const trimmedName = fullName.trim()
    const trimmedPhone = phone.trim()
    const trimmedCccd = cccd.trim()

    if (trimmedName.length < 2) {
      setProfileMsg({ ok: false, text: 'Họ và tên phải có ít nhất 2 ký tự.' })
      return
    }
    if (!isValidPhone(trimmedPhone)) {
      setProfileMsg({ ok: false, text: PHONE_ERROR })
      return
    }
    if (trimmedCccd && !isValidCccd(trimmedCccd)) {
      setProfileMsg({ ok: false, text: CCCD_ERROR })
      return
    }

    try {
      setSavingProfile(true)
      const updated = await updateMyProfile({
        fullName: trimmedName,
        phone: trimmedPhone,
        cccd: trimmedCccd || null,
      })
      setProfile(updated)
      setFullName(updated.fullName || trimmedName)
      setPhone(updated.phone || trimmedPhone)
      setCccd(updated.cccd || '')
      setProfileMsg({ ok: true, text: 'Đã cập nhật thông tin cá nhân thành công!' })
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data || 'Không thể cập nhật thông tin. Vui lòng thử lại.'
      setProfileMsg({ ok: false, text: String(msg) })
    } finally {
      setSavingProfile(false)
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    setPasswordMsg(null)

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordMsg({ ok: false, text: 'Vui lòng nhập đầy đủ mật khẩu hiện tại, mật khẩu mới và xác nhận mật khẩu.' })
      return
    }
    if (newPassword.length < 6) {
      setPasswordMsg({ ok: false, text: 'Mật khẩu mới phải có ít nhất 6 ký tự.' })
      return
    }
    if (newPassword === currentPassword) {
      setPasswordMsg({ ok: false, text: 'Mật khẩu mới phải khác mật khẩu hiện tại.' })
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ ok: false, text: 'Mật khẩu xác nhận không khớp với mật khẩu mới.' })
      return
    }

    try {
      setSavingPassword(true)
      await changeMyPassword({
        currentPassword,
        newPassword,
      })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordMsg({ ok: true, text: 'Đổi mật khẩu thành công!' })
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data || 'Không thể đổi mật khẩu. Vui lòng kiểm tra lại.'
      setPasswordMsg({ ok: false, text: String(msg) })
    } finally {
      setSavingPassword(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="duo-card p-8 text-center font-black text-[#AFAFAF]">
          Đang tải thông tin hồ sơ cá nhân...
        </div>
      </div>
    )
  }

  const emailDisplay = profile?.email || JSON.parse(sessionStorage.getItem('user') || '{}').email || '—'
  const roleLabel = ROLE_LABELS[profile?.role] || profile?.role || 'Khách hàng'

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 flex flex-col gap-6">
      {/* Tiêu đề trang */}
      <div>
        <h1 className="text-3xl font-black text-[#4B4B4B] tracking-tight">
          Hồ sơ cá nhân
        </h1>
        <p className="text-xs font-bold text-[#AFAFAF] mt-1 uppercase tracking-wider">
          Quản lý thông tin liên hệ và bảo mật mật khẩu tài khoản của bạn.
        </p>
      </div>

      {/* Thẻ tóm tắt tài khoản */}
      <div className="duo-card p-6 bg-gradient-to-r from-[#F0FAFF] via-white to-[#F4FFE8] border-2 border-b-4 border-[#E5E5E5] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-[#58CC02] border-b-4 border-[#58A700] text-white flex items-center justify-center font-black text-2xl shrink-0 shadow-xs">
            {getInitials(profile?.fullName || fullName)}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-black text-[#4B4B4B]">
                {profile?.fullName || fullName || 'Người dùng'}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase bg-[#DDF4FF] text-[#1CB0F6] border border-[#84D8FF]">
                {roleLabel}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase bg-[#D7FFB8] text-[#58A700] border border-[#58CC02]">
                Đang hoạt động
              </span>
            </div>
            <p className="text-xs font-bold text-[#777777] mt-1 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-[#AFAFAF]">mail</span>
              <span>{emailDisplay}</span>
            </p>
            {profile?.facilityName && (
              <p className="text-xs font-bold text-[#1CB0F6] mt-0.5 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">warehouse</span>
                <span>Cơ sở: {profile.facilityName}</span>
              </p>
            )}
          </div>
        </div>
        {profile?.createdAt && (
          <div className="text-left sm:text-right bg-white px-4 py-2.5 rounded-2xl border-2 border-[#E5E5E5]">
            <span className="block text-[10px] font-black uppercase tracking-wider text-[#AFAFAF]">Ngày tham gia</span>
            <span className="text-xs font-black text-[#4B4B4B]">{formatCreatedAt(profile.createdAt)}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Cột 1: Thông tin cá nhân */}
        <form onSubmit={handleSaveProfile} className="duo-card p-6 flex flex-col gap-4">
          <div className="flex items-center gap-3 pb-3 border-b-2 border-[#F0F0F0]">
            <div className="w-10 h-10 rounded-2xl bg-[#1CB0F6] border-b-2 border-[#1899D6] text-white flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[22px]">badge</span>
            </div>
            <div>
              <h3 className="text-base font-black text-[#4B4B4B]">Thông tin cá nhân</h3>
              <p className="text-[11px] font-bold text-[#AFAFAF]">Cập nhật họ tên, số điện thoại và CCCD</p>
            </div>
          </div>

          {profileMsg && (
            <div
              className={`p-3.5 rounded-2xl border-2 text-xs font-bold flex items-start gap-2 ${
                profileMsg.ok
                  ? 'bg-[#D7FFB8]/60 border-[#58CC02] text-[#58A700]'
                  : 'bg-[#FFDFDF]/60 border-[#FF4B4B] text-[#FF4B4B]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px] shrink-0">
                {profileMsg.ok ? 'check_circle' : 'error'}
              </span>
              <span>{profileMsg.text}</span>
            </div>
          )}

          {/* Email / Tên đăng nhập (Khóa, không cho sửa) */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-[#777777] mb-1.5">
              Email / Tên đăng nhập <span className="text-[#AFAFAF] font-bold normal-case">(Cố định)</span>
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#AFAFAF] text-[19px]">
                lock
              </span>
              <input
                type="text"
                value={emailDisplay}
                disabled
                readOnly
                className="duo-input w-full pl-11 bg-[#F7F7F7] text-[#777777] cursor-not-allowed select-all"
              />
            </div>
            <p className="text-[11px] font-bold text-[#AFAFAF] mt-1">
              Email dùng làm tên đăng nhập định danh tài khoản và không thể thay đổi.
            </p>
          </div>

          {/* Họ và tên */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-[#4B4B4B] mb-1.5">
              Họ và tên <span className="text-[#FF4B4B]">*</span>
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#AFAFAF] text-[19px]">
                person
              </span>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nhập họ và tên đầy đủ"
                maxLength={100}
                className="duo-input w-full pl-11"
              />
            </div>
          </div>

          {/* Số điện thoại */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-[#4B4B4B] mb-1.5">
              Số điện thoại <span className="text-[#FF4B4B]">*</span>
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#AFAFAF] text-[19px]">
                call
              </span>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={phone}
                onChange={(e) => setPhone(digitsOnly(e.target.value).slice(0, 10))}
                placeholder="09xxxxxxxx (10 chữ số)"
                className="duo-input w-full pl-11"
              />
            </div>
          </div>

          {/* Số CCCD / Passport */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-[#4B4B4B] mb-1.5">
              Số CCCD / Hộ chiếu
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#AFAFAF] text-[19px]">
                id_card
              </span>
              <input
                type="text"
                maxLength={12}
                value={cccd}
                onChange={(e) => setCccd(e.target.value.replace(/[^0-9A-Za-z]/g, '').slice(0, 12))}
                placeholder="12 chữ số CCCD hoặc mã hộ chiếu"
                className="duo-input w-full pl-11"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={savingProfile}
            className="duo-btn-green w-full py-3 text-xs tracking-wider mt-2 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">save</span>
            <span>{savingProfile ? 'ĐANG LƯU...' : 'LƯU THÔNG TIN CÁ NHÂN'}</span>
          </button>
        </form>

        {/* Cột 2: Đổi mật khẩu */}
        <form onSubmit={handleChangePassword} className="duo-card p-6 flex flex-col gap-4">
          <div className="flex items-center gap-3 pb-3 border-b-2 border-[#F0F0F0]">
            <div className="w-10 h-10 rounded-2xl bg-[#FF9600] border-b-2 border-[#E58800] text-white flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[22px]">key</span>
            </div>
            <div>
              <h3 className="text-base font-black text-[#4B4B4B]">Đổi mật khẩu</h3>
              <p className="text-[11px] font-bold text-[#AFAFAF]">Yêu cầu xác nhận mật khẩu hiện tại trước khi đổi</p>
            </div>
          </div>

          {passwordMsg && (
            <div
              className={`p-3.5 rounded-2xl border-2 text-xs font-bold flex items-start gap-2 ${
                passwordMsg.ok
                  ? 'bg-[#D7FFB8]/60 border-[#58CC02] text-[#58A700]'
                  : 'bg-[#FFDFDF]/60 border-[#FF4B4B] text-[#FF4B4B]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px] shrink-0">
                {passwordMsg.ok ? 'check_circle' : 'error'}
              </span>
              <span>{passwordMsg.text}</span>
            </div>
          )}

          {/* Mật khẩu hiện tại */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-[#4B4B4B] mb-1.5">
              Mật khẩu hiện tại <span className="text-[#FF4B4B]">*</span>
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#AFAFAF] text-[19px]">
                lock_open
              </span>
              <input
                type={showCurrentPwd ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Nhập mật khẩu đang sử dụng"
                className="duo-input w-full pl-11 pr-11"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPwd((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#AFAFAF] hover:text-[#4B4B4B] cursor-pointer"
                title={showCurrentPwd ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                <span className="material-symbols-outlined text-[19px]">
                  {showCurrentPwd ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
          </div>

          {/* Mật khẩu mới */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-[#4B4B4B] mb-1.5">
              Mật khẩu mới <span className="text-[#FF4B4B]">*</span>
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#AFAFAF] text-[19px]">
                enhanced_encryption
              </span>
              <input
                type={showNewPwd ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Tối thiểu 6 ký tự"
                className="duo-input w-full pl-11 pr-11"
              />
              <button
                type="button"
                onClick={() => setShowNewPwd((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#AFAFAF] hover:text-[#4B4B4B] cursor-pointer"
                title={showNewPwd ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                <span className="material-symbols-outlined text-[19px]">
                  {showNewPwd ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
          </div>

          {/* Xác nhận mật khẩu mới */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-[#4B4B4B] mb-1.5">
              Xác nhận mật khẩu mới <span className="text-[#FF4B4B]">*</span>
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#AFAFAF] text-[19px]">
                verified_user
              </span>
              <input
                type={showConfirmPwd ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Nhập lại mật khẩu mới"
                className="duo-input w-full pl-11 pr-11"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPwd((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#AFAFAF] hover:text-[#4B4B4B] cursor-pointer"
                title={showConfirmPwd ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                <span className="material-symbols-outlined text-[19px]">
                  {showConfirmPwd ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={savingPassword}
            className="duo-btn-blue w-full py-3 text-xs tracking-wider mt-2 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">lock_reset</span>
            <span>{savingPassword ? 'ĐANG CẬP NHẬT...' : 'ĐỔI MẬT KHẨU'}</span>
          </button>
        </form>
      </div>
    </div>
  )
}
