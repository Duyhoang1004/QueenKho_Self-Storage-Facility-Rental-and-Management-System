import { useNavigate } from 'react-router-dom'

function formatVND(amount) {
  if (!amount) return ''
  return Number(amount).toLocaleString('vi-VN') + 'đ'
}

export default function RequireAuthModal({ isOpen, onClose, target }) {
  const navigate = useNavigate()

  if (!isOpen) return null

  const bookingUrl = target?.facilityId && target?.unitTypeId
    // PR-R11: giữ ngày nhận kho tối thiểu khi đặt trước ô "sắp trống"
    ? `/booking?facilityId=${target.facilityId}&unitTypeId=${target.unitTypeId}${target.availableFrom ? `&from=${target.availableFrom}` : ''}`
    : '/tim-va-dat-kho'

  const handleLogin = () => {
    onClose()
    navigate(`/login?redirect=${encodeURIComponent(bookingUrl)}`)
  }

  const handleRegister = () => {
    onClose()
    navigate(`/register?redirect=${encodeURIComponent(bookingUrl)}`)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      {/* Click outside backdrop to close */}
      <div className="fixed inset-0" onClick={onClose}></div>

      {/* Modal Dialog Duolingo Flat 2.5D */}
      <div className="duo-card max-w-md w-full p-6 sm:p-8 bg-white relative z-10 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        
        {/* Nút đóng góc phải */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-9 h-9 rounded-xl duo-btn-gray flex items-center justify-center text-[#AFAFAF] hover:text-[#4B4B4B]"
          aria-label="Đóng"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>

        {/* Mascot / Icon Lock Duolingo */}
        <div className="w-16 h-16 mx-auto rounded-3xl bg-[#DDF4FF] border-2 border-b-4 border-[#1899D6] flex items-center justify-center text-[#1CB0F6] text-3xl mb-4 shadow-sm">
          🔐
        </div>

        {/* Tiêu đề Modal */}
        <h3 className="text-xl sm:text-2xl font-black text-[#4B4B4B] text-center tracking-tight">
          Bạn cần tài khoản để Đặt kho
        </h3>

        {/* Hộp tóm tắt khoang kho đang chọn (nếu có) */}
        {target && (
          <div className="my-4 p-3.5 rounded-2xl bg-[#F8F9FA] border-2 border-[#E5E5E5] text-xs font-bold text-[#777777]">
            <div className="flex items-center justify-between mb-1">
              <span className="font-black text-[#4B4B4B] text-sm">
                {target.unitTypeName} {target.areaSqm ? `(${target.areaSqm}m²)` : ''}
              </span>
              {target.basePriceMonthly && (
                <span className="text-[#58CC02] font-black text-sm">
                  {formatVND(target.basePriceMonthly)}/th
                </span>
              )}
            </div>
            <div className="text-[11px] text-[#AFAFAF] flex items-center gap-1 mt-1">
              <span className="material-symbols-outlined text-[15px] text-[#1CB0F6]">apartment</span>
              <span className="truncate">{target.facilityName || 'Cơ sở QueenKho'}</span>
            </div>
          </div>
        )}

        {/* Lời giải thích */}
        <p className="text-xs sm:text-sm font-bold text-[#777777] text-center leading-relaxed mt-2 mb-6">
          Để nhận <strong>mã PIN mở khóa SmartLock</strong>, quản lý hợp đồng điện tử và bảo đảm tài sản an toàn, bạn cần có tài khoản khách hàng trên QueenKho.
        </p>

        {/* 2 LỰA CHỌN: ĐĂNG NHẬP & ĐĂNG KÝ */}
        <div className="flex flex-col gap-3">
          {/* Lựa chọn 1: Đăng nhập */}
          <button
            type="button"
            onClick={handleLogin}
            className="duo-btn-green w-full py-3.5 text-xs font-black tracking-wider flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">login</span>
            <span>ĐĂNG NHẬP (NẾU ĐÃ CÓ TÀI KHOẢN)</span>
          </button>

          {/* Lựa chọn 2: Đăng ký */}
          <button
            type="button"
            onClick={handleRegister}
            className="duo-btn-white w-full py-3.5 text-xs font-black tracking-wider flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">person_add</span>
            <span>ĐĂNG KÝ TÀI KHOẢN MỚI</span>
          </button>
        </div>

        {/* Nút xem tiếp */}
        <div className="text-center mt-5">
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-black uppercase tracking-wider text-[#AFAFAF] hover:text-[#4B4B4B] transition-colors py-1 cursor-pointer"
          >
            Để sau, tôi muốn xem tiếp kho
          </button>
        </div>

      </div>
    </div>
  )
}

