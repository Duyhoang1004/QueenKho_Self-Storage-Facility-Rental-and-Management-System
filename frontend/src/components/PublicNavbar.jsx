import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import NotificationDropdown from './NotificationDropdown'

export default function PublicNavbar() {
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Kiểm tra nếu khách đã đăng nhập thì nút hiển thị "VÀO KHO CỦA TÔI" thay vì "ĐĂNG NHẬP"
  const sessionUser = (() => {
    try {
      return JSON.parse(sessionStorage.getItem('user') || 'null')
    } catch {
      return null
    }
  })()

  const scrollToSection = (id) => {
    setMobileMenuOpen(false)
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    } else {
      navigate(`/#${id}`)
    }
  }

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b-2 border-[#E5E5E5]">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
        
        {/* LOGO QUEENKHO DUOLINGO */}
        <Link to="/" className="flex items-center gap-3 select-none group">
          <div className="w-12 h-12 rounded-2xl bg-[#58CC02] border-b-4 border-[#58A700] flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform">
            <span className="material-symbols-outlined text-[28px]">warehouse</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xl sm:text-2xl font-black text-[#58CC02] tracking-tight leading-none">
              QUEENKHO
            </span>
            <span className="text-[10px] font-black text-[#AFAFAF] uppercase tracking-widest mt-0.5">
              Kho Lưu Trữ Thông Minh
            </span>
          </div>
        </Link>

        {/* NAVIGATION LINKS (DESKTOP) */}
        <nav className="hidden md:flex items-center gap-7 text-xs font-black uppercase tracking-wider text-[#777777]">
          <button
            onClick={() => scrollToSection('loai-kho')}
            className="hover:text-[#58CC02] transition-colors cursor-pointer"
          >
            Loại khoang kho
          </button>
          <button
            onClick={() => scrollToSection('vi-tri')}
            className="hover:text-[#58CC02] transition-colors cursor-pointer"
          >
            Vị trí chi nhánh
          </button>
          <button
            onClick={() => scrollToSection('tien-ich')}
            className="hover:text-[#58CC02] transition-colors cursor-pointer"
          >
            Tiện ích an ninh
          </button>
          <button
            onClick={() => scrollToSection('quy-trinh')}
            className="hover:text-[#58CC02] transition-colors cursor-pointer"
          >
            Quy trình thuê
          </button>
        </nav>

        {/* AUTH BUTTONS (DUOLINGO 2.5D FLAT) */}
        <div className="hidden sm:flex items-center gap-3">
          {sessionUser ? (
            <div className="flex items-center gap-3">
              <NotificationDropdown />
              <Link
                to="/kho-cua-toi"
                className="duo-btn-green px-5 py-2.5 text-xs tracking-wider flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[18px]">account_circle</span>
                <span>KHO CỦA TÔI ({sessionUser.fullName?.split(' ').pop() || 'BẠN'})</span>
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <NotificationDropdown />
              <Link
                to="/login"
                className="duo-btn-white px-5 py-2.5 text-xs tracking-wider"
              >
                ĐĂNG NHẬP
              </Link>
              <Link
                to="/register"
                className="duo-btn-green px-5 py-2.5 text-xs tracking-wider"
              >
                ĐĂNG KÝ
              </Link>
            </div>
          )}
        </div>

        {/* MOBILE MENU TOGGLE */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden duo-btn-gray p-2.5 rounded-xl text-[#4B4B4B]"
          aria-label="Toggle navigation"
        >
          <span className="material-symbols-outlined text-[24px]">
            {mobileMenuOpen ? 'close' : 'menu'}
          </span>
        </button>

      </div>

      {/* MOBILE DROPDOWN */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t-2 border-[#E5E5E5] bg-white px-6 py-5 flex flex-col gap-4 text-xs font-black uppercase tracking-wider">
          <button
            onClick={() => scrollToSection('loai-kho')}
            className="text-left text-[#4B4B4B] py-2 border-b border-[#F0F0F0]"
          >
            Loại khoang kho
          </button>
          <button
            onClick={() => scrollToSection('vi-tri')}
            className="text-left text-[#4B4B4B] py-2 border-b border-[#F0F0F0]"
          >
            Vị trí chi nhánh
          </button>
          <button
            onClick={() => scrollToSection('tien-ich')}
            className="text-left text-[#4B4B4B] py-2 border-b border-[#F0F0F0]"
          >
            Tiện ích an ninh
          </button>
          <button
            onClick={() => scrollToSection('quy-trinh')}
            className="text-left text-[#4B4B4B] py-2 border-b border-[#F0F0F0]"
          >
            Quy trình thuê
          </button>

          <div className="flex flex-col gap-2 pt-2">
            {sessionUser ? (
              <Link
                to="/kho-cua-toi"
                onClick={() => setMobileMenuOpen(false)}
                className="duo-btn-green w-full py-3 text-xs tracking-wider text-center"
              >
                VÀO KHO CỦA TÔI
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="duo-btn-white w-full py-3 text-xs tracking-wider text-center"
                >
                  ĐĂNG NHẬP
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="duo-btn-green w-full py-3 text-xs tracking-wider text-center"
                >
                  ĐĂNG KÝ TÀI KHOẢN
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
