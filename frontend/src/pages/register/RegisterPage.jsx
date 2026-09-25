import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { register } from '../../services/authService'

function BrandMark() {
  return (
    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-action text-white shadow-lg shadow-blue-950/20">
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
        <path d="M4 10.5 12 4l8 6.5V20H4v-9.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M8 20v-6h8v6M9.5 9.5h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </div>
  )
}

function EyeIcon({ open }) {
  return open ? (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <path d="m4 4 16 16M10.7 6.1A10 10 0 0 1 12 6c6 0 9.5 6 9.5 6a16 16 0 0 1-2.2 2.8M7.4 7.4C4.2 9.1 2.5 12 2.5 12s3.5 6 9.5 6a9 9 0 0 0 3.2-.6M10.2 10.2a2.5 2.5 0 0 0 3.6 3.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ fullName: '', phone: '', email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    setError('')
  }

  const validate = () => {
    if (!form.fullName.trim()) return 'Vui lòng nhập họ và tên.'
    if (!form.phone.trim()) return 'Vui lòng nhập số điện thoại.'
    if (!form.email.trim()) return 'Vui lòng nhập email.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Email không đúng định dạng.'
    if (!form.password) return 'Vui lòng nhập mật khẩu.'
    if (form.password.length < 6) return 'Mật khẩu phải có ít nhất 6 ký tự.'
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

      await register({
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        password: form.password,
      })

      setSuccess('Đăng ký tài khoản thành công! Vui lòng đăng nhập.')
      setTimeout(() => navigate('/login'), 2000)
    } catch (requestError) {
      const errorMessage = requestError.response?.data?.message || requestError.response?.data || 'Không thể kết nối đến hệ thống. Vui lòng thử lại.'
      if (typeof errorMessage === 'string' && errorMessage.includes('Email')) {
        setError(errorMessage)
      } else {
        setError('Đăng ký thất bại. Vui lòng thử lại.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-page lg:grid lg:grid-cols-[1.05fr_0.95fr]">
      <section className="brand-grid relative hidden min-h-screen overflow-hidden bg-brand px-12 py-10 text-white lg:flex lg:flex-col xl:px-20">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-action/25 blur-3xl" />
        <div className="absolute -bottom-40 -right-24 h-[30rem] w-[30rem] rounded-full bg-success/20 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <BrandMark />
          <div>
            <p className="text-xl font-bold tracking-tight">QueenKho</p>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-blue-100">Self-Storage</p>
          </div>
        </div>

        <div className="relative my-auto max-w-xl py-16">
          <h1 className="text-4xl font-bold leading-tight tracking-tight xl:text-5xl">
            Quản lý kho lưu trữ
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-blue-100 xl:text-lg">
            Đăng ký tài khoản để bắt đầu trải nghiệm dịch vụ.
          </p>
        </div>

        <p className="relative text-xs text-blue-200">© 2026 QueenKho. All rights reserved.</p>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-10 lg:px-14 xl:px-24">
        <div className="w-full max-w-md">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <BrandMark />
            <div>
              <p className="text-xl font-bold text-brand">QueenKho</p>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Self-Storage</p>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-action">Bắt đầu ngay</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl">Đăng ký tài khoản</h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              Nhập thông tin của bạn để tạo tài khoản mới.
            </p>
          </div>

          <form className="mt-9 space-y-4" onSubmit={handleSubmit} noValidate>
            
            <div>
              <label htmlFor="fullName" className="mb-1 block text-sm font-semibold text-slate-700">Họ và tên</label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                value={form.fullName}
                onChange={handleChange}
                placeholder="Nguyễn Văn A"
                disabled={loading}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-ink outline-none transition placeholder:text-slate-400 focus:border-action focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
              />
            </div>
            
            <div>
              <label htmlFor="phone" className="mb-1 block text-sm font-semibold text-slate-700">Số điện thoại</label>
              <input
                id="phone"
                name="phone"
                type="text"
                value={form.phone}
                onChange={handleChange}
                placeholder="0987654321"
                disabled={loading}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-ink outline-none transition placeholder:text-slate-400 focus:border-action focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
              />
            </div>

            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-semibold text-slate-700">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="example@gmail.com"
                autoComplete="email"
                disabled={loading}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-ink outline-none transition placeholder:text-slate-400 focus:border-action focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-semibold text-slate-700">Mật khẩu</label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Ít nhất 6 ký tự"
                  autoComplete="new-password"
                  disabled={loading}
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 pr-12 text-sm text-ink outline-none transition placeholder:text-slate-400 focus:border-action focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-400 transition hover:text-action"
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
            </div>

            {error && (
              <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
            
            {success && (
              <div role="alert" className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-action px-5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-brand focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
              {loading ? 'Đang đăng ký...' : 'Đăng ký tài khoản'}
            </button>
            
            <p className="mt-6 text-center text-sm text-slate-500">
              Đã có tài khoản?{' '}
              <Link to="/login" className="font-semibold text-action transition hover:text-brand">
                Đăng nhập ngay
              </Link>
            </p>
          </form>
        </div>
      </section>
    </main>
  )
}
