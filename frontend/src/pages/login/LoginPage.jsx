import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { login, saveSession } from '../../services/authService'

function DuoBrandMark() {
  return (
    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#58CC02] border-b-4 border-[#58A700] text-white">
      <span className="material-symbols-outlined text-[32px]">warehouse</span>
    </div>
  )
}

function EyeIcon({ open }) {
  return open ? (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="2" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <path d="m4 4 16 16M10.7 6.1A10 10 0 0 1 12 6c6 0 9.5 6 9.5 6a16 16 0 0 1-2.2 2.8M7.4 7.4C4.2 9.1 2.5 12 2.5 12s3.5 6 9.5 6a9 9 0 0 0 3.2-.6M10.2 10.2a2.5 2.5 0 0 0 3.6 3.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export default function LoginPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    setError('')
  }

  const validate = () => {
    if (!form.email.trim()) return 'Vui lòng nhập email.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Email không đúng định dạng.'
    if (!form.password) return 'Vui lòng nhập mật khẩu.'
    return ''
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const validationError = validate()

    if (validationError) {
      setError(validationError)
      return
    }

    try {
      setLoading(true)
      setError('')

      const response = await login({
        email: form.email.trim(),
        password: form.password,
      })

      saveSession(response, form.email.trim())
      const role = response.role
      if (role === 'FACILITY_MANAGER' || role === 'MANAGER' || role === 'ADMIN') {
        navigate('/manager', { replace: true })
      } else {
        navigate('/', { replace: true })
      }
    } catch (requestError) {
      const status = requestError.response?.status
      const errorCode = requestError.response?.data?.error

      if (status === 401 || errorCode === 'INVALID_CREDENTIALS') {
        setError('Email hoặc mật khẩu không đúng.')
      } else if (errorCode === 'ACCOUNT_LOCKED') {
        setError('Tài khoản đã bị khóa. Vui lòng liên hệ hỗ trợ.')
      } else if (errorCode === 'ACCOUNT_DISABLED') {
        setError('Tài khoản đã bị vô hiệu hóa.')
      } else {
        setError(requestError.response?.data?.message || 'Không thể kết nối đến hệ thống. Vui lòng thử lại.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-white lg:grid lg:grid-cols-[1.05fr_0.95fr] select-none">
      {/* Duolingo Brand Showcase Hero (Left Panel) */}
      <section className="relative hidden min-h-screen flex-col justify-between bg-[#58CC02] border-r-4 border-[#58A700] px-12 py-12 text-white lg:flex xl:px-20">
        {/* Top brand */}
        <div className="flex items-center gap-3.5">
          <div className="h-12 w-12 rounded-2xl bg-white border-b-4 border-[#E5E5E5] flex items-center justify-center text-[#58CC02] shadow-sm">
            <span className="material-symbols-outlined text-[28px]">warehouse</span>
          </div>
          <div>
            <p className="text-2xl font-black uppercase tracking-wider">QueenKho</p>
            <p className="text-xs font-black uppercase tracking-widest text-emerald-100">Kho tự quản Flat & Smart</p>
          </div>
        </div>

        {/* Center Gamified Hero Card */}
        <div className="my-auto max-w-lg space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-1.5 text-xs font-black uppercase tracking-wider backdrop-blur-xs">
            <span>🎉</span>
            <span>Hệ thống kho tự quản thông minh 2026</span>
          </div>

          <h1 className="text-4xl font-black leading-tight tracking-tight xl:text-5xl">
            Lưu trữ gọn gàng, khởi đầu thảnh thơi!
          </h1>
          
          <p className="text-base font-bold text-emerald-50 leading-relaxed xl:text-lg">
            Đăng nhập để xem mã mở khóa SmartLock, thời hạn hợp đồng và quản lý kho lưu trữ của bạn mọi lúc mọi nơi.
          </p>


        </div>

        <p className="text-xs font-extrabold uppercase tracking-widest text-emerald-100">
          © 2026 QueenKho. All rights reserved.
        </p>
      </section>

      {/* Login Form Panel (Right Panel) */}
      <section className="flex min-h-screen items-center justify-center px-6 py-12 sm:px-12 lg:px-16 xl:px-24 bg-white">
        <div className="w-full max-w-md">
          {/* Mobile Header */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <DuoBrandMark />
            <div>
              <p className="text-2xl font-black text-[#58CC02] uppercase tracking-wider">QueenKho</p>
              <p className="text-xs font-black text-[#AFAFAF] uppercase tracking-widest">Self-Storage</p>
            </div>
          </div>

          <div>
            <h2 className="text-3xl font-black tracking-tight text-[#4B4B4B] sm:text-4xl">
              Đăng nhập
            </h2>
            <p className="mt-2 text-sm font-bold text-[#AFAFAF]">
              Nhập email và mật khẩu để tiếp tục quản lý kho của bạn!
            </p>
          </div>

          <form className="mt-8 space-y-4" onSubmit={handleSubmit} noValidate>
            <div>
              <label htmlFor="email" className="mb-1.5 block text-xs font-black uppercase tracking-wider text-[#777777]">
                Email tài khoản
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="example@gmail.com"
                autoComplete="email"
                disabled={loading}
                className="duo-input w-full"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-xs font-black uppercase tracking-wider text-[#777777]">
                  Mật khẩu
                </label>
              </div>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Nhập mật khẩu của bạn"
                  autoComplete="current-password"
                  disabled={loading}
                  className="duo-input w-full pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-[#AFAFAF] transition hover:text-[#58CC02] cursor-pointer"
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
            </div>

            {error && (
              <div role="alert" className="rounded-2xl border-2 border-b-4 border-[#FFDFDF] bg-[#FFF5F5] px-4 py-3 text-xs font-black text-[#FF4B4B] flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">error</span>
                <span>{error}</span>
              </div>
            )}

            {/* Giant Pushable Green CTA Button */}
            <button
              type="submit"
              disabled={loading}
              className="duo-btn-green w-full py-4 text-base tracking-wider mt-2 disabled:opacity-50"
            >
              {loading && <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white mr-2" />}
              {loading ? 'Đang đăng nhập...' : 'ĐĂNG NHẬP'}
            </button>
            
            {/* White/Gray Pushable Button for Registration */}
            <div className="pt-4 border-t-2 border-[#E5E5E5] text-center">
              <p className="text-xs font-bold text-[#AFAFAF] mb-3">
                Bạn chưa có tài khoản QueenKho?
              </p>
              <Link
                to="/register"
                className="duo-btn-white w-full py-3.5 text-xs uppercase tracking-wider block text-center"
              >
                TẠO TÀI KHOẢN MỚI
              </Link>
            </div>
          </form>
        </div>
      </section>
    </main>
  )
}