import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

function formatVND(amount) {
  return amount?.toLocaleString('vi-VN') + 'đ'
}

// Tao QR VietQR tu thong tin dat coc
function buildVietQRUrl(amount, reservationCode) {
  const bankBin = '970422'        // MB Bank
  const accountNo = '0966666666'  // So tai khoan mock QueenKho
  const accountName = 'QUEENKHO STORAGE'
  const addInfo = encodeURIComponent(reservationCode)
  return `https://img.vietqr.io/image/${bankBin}-${accountNo}-compact2.png?amount=${amount}&addInfo=${addInfo}&accountName=${encodeURIComponent(accountName)}`
}

// Dem nguoc 15 phut
function useCountdown(seconds) {
  const [timeLeft, setTimeLeft] = useState(seconds)
  useEffect(() => {
    if (timeLeft <= 0) return
    const timer = setInterval(() => setTimeLeft(t => t - 1), 1000)
    return () => clearInterval(timer)
  }, [timeLeft])
  const mm = String(Math.floor(timeLeft / 60)).padStart(2, '0')
  const ss = String(timeLeft % 60).padStart(2, '0')
  return { timeLeft, display: `${mm}:${ss}` }
}

export default function PaymentQRPage() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  // Nhan du lieu tu trang dat kho
  const reservation = state?.reservation || {}
  const customerInfo = state?.customerInfo || {}
  const selectedMonths = state?.selectedMonths || 3
  const startDate = state?.startDate || ''
  const depositAmount = reservation.depositAmount || 500000
  const reservationCode = reservation.reservationCode || 'RES-000000'

  const { timeLeft, display: countdownDisplay } = useCountdown(15 * 60)
  const isExpired = timeLeft <= 0

  const qrUrl = buildVietQRUrl(depositAmount, reservationCode)

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Goi UC-11 API xac nhan thanh toan
  const handleConfirmPayment = async () => {
    try {
      setLoading(true)

      // TODO: Sau khi Nghia lam xong UC-11, thay bang:
      // await api.post('/payments', { reservationCode, amount: depositAmount, paymentMethod: 'VIETQR' })

      // Tam thoi mock thanh cong de demo
      await new Promise(resolve => setTimeout(resolve, 1200))

      navigate('/booking/confirmation', {
        state: {
          reservation: {
            ...reservation,
            status: 'DEPOSIT_PAID',
          },
          customerInfo,
          selectedMonths,
          startDate,
        },
      })
    } catch {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">

      {/* Step indicator */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-on-primary text-sm font-bold">2</div>
          <span className="text-title-md font-title-md text-on-surface">Thanh Toán Đặt Cọc</span>
        </div>
        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-label-md font-label-md ${
          isExpired ? 'bg-error-container text-on-error-container' : 'bg-[#FFFBEB] text-[#D97706]'
        }`}>
          <span className="material-symbols-outlined text-[16px]">timer</span>
          {isExpired ? 'Hết thời gian' : `Còn lại: ${countdownDisplay}`}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-surface-container-high overflow-hidden">

        {/* Header */}
        <div className="bg-primary px-6 py-5">
          <p className="text-label-md font-label-md text-on-primary/70 uppercase tracking-wider mb-1">
            Quét mã để thanh toán đặt cọc
          </p>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-headline-md font-headline-md text-on-primary">{formatVND(depositAmount)}</p>
              <p className="text-body-sm font-body-sm text-on-primary/70 mt-0.5">
                Mã đơn: <span className="font-semibold text-on-primary">{reservationCode}</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <img src="/public/icons.svg" alt="" className="h-6 w-6 opacity-60" onError={() => {}} />
              <span className="text-body-sm font-body-sm text-on-primary/70">Napas 247 • VietQR</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-6 p-6">

          {/* QR Code */}
          <div className="flex flex-col items-center gap-3 md:w-56 flex-shrink-0">
            <div className="border-2 border-surface-container-high rounded-xl p-2 bg-white">
              <img
                src={qrUrl}
                alt="QR thanh toán VietQR"
                className="w-48 h-48 object-contain"
                onError={(e) => {
                  e.target.style.display = 'none'
                  e.target.nextSibling.style.display = 'flex'
                }}
              />
              {/* Fallback neu khong load duoc QR */}
              <div className="w-48 h-48 hidden items-center justify-center bg-surface-container-low rounded-xl flex-col gap-2">
                <span className="material-symbols-outlined text-on-surface-variant text-[40px]">qr_code_2</span>
                <p className="text-body-sm font-body-sm text-on-surface-variant text-center px-2">
                  Vui lòng chuyển khoản theo thông tin bên phải
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <img
                src="https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/MB_Bank_logo_2023.svg/120px-MB_Bank_logo_2023.svg.png"
                alt="MB Bank"
                className="h-5 object-contain"
                onError={(e) => e.target.style.display='none'}
              />
              <span className="text-body-sm font-body-sm text-on-surface-variant">MB Bank</span>
            </div>
          </div>

          {/* Thong tin chuyen khoan */}
          <div className="flex-1 flex flex-col gap-3">
            <p className="text-title-md font-title-md text-on-surface">Thông tin chuyển khoản</p>

            {/* Ngan hang */}
            <div className="bg-surface-container-low rounded-xl p-3">
              <p className="text-label-sm font-label-sm text-on-surface-variant mb-0.5">NGÂN HÀNG</p>
              <p className="text-body-md font-body-md text-on-surface font-semibold">MB Bank (Ngân hàng Quân đội)</p>
            </div>

            {/* So tai khoan */}
            <div className="bg-surface-container-low rounded-xl p-3">
              <p className="text-label-sm font-label-sm text-on-surface-variant mb-0.5">SỐ TÀI KHOẢN</p>
              <div className="flex items-center justify-between">
                <p className="text-body-md font-body-md text-on-surface font-semibold font-mono tracking-widest">0966 666 666</p>
                <button
                  onClick={() => handleCopy('0966666666')}
                  className="text-secondary text-label-sm font-label-sm flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">content_copy</span>
                  {copied ? 'Đã sao chép!' : 'Sao chép'}
                </button>
              </div>
            </div>

            {/* Chu tai khoan */}
            <div className="bg-surface-container-low rounded-xl p-3">
              <p className="text-label-sm font-label-sm text-on-surface-variant mb-0.5">CHỦ TÀI KHOẢN</p>
              <p className="text-body-md font-body-md text-on-surface font-semibold">QUEENKHO STORAGE</p>
            </div>

            {/* So tien */}
            <div className="bg-surface-container-low rounded-xl p-3">
              <p className="text-label-sm font-label-sm text-on-surface-variant mb-0.5">SỐ TIỀN</p>
              <div className="flex items-center justify-between">
                <p className="text-title-md font-title-md text-secondary font-bold">{formatVND(depositAmount)}</p>
                <button
                  onClick={() => handleCopy(String(depositAmount))}
                  className="text-secondary text-label-sm font-label-sm flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">content_copy</span>
                  Sao chép
                </button>
              </div>
            </div>

            {/* Noi dung CK */}
            <div className="bg-[#FFFBEB] border border-[#FCD34D] rounded-xl p-3">
              <p className="text-label-sm font-label-sm text-[#D97706] mb-0.5 uppercase">
                ⚠️ Nội dung chuyển khoản (BẮT BUỘC)
              </p>
              <div className="flex items-center justify-between">
                <p className="text-body-md font-body-md text-on-surface font-semibold font-mono">{reservationCode}</p>
                <button
                  onClick={() => handleCopy(reservationCode)}
                  className="text-[#D97706] text-label-sm font-label-sm flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">content_copy</span>
                  Sao chép
                </button>
              </div>
              <p className="text-body-sm font-body-sm text-on-surface-variant mt-1">
                Nhập đúng mã này để hệ thống tự động xác nhận thanh toán
              </p>
            </div>
          </div>
        </div>

        {/* Nut xac nhan */}
        <div className="px-6 pb-6 flex flex-col gap-3">
          <button
            onClick={handleConfirmPayment}
            disabled={loading || isExpired}
            className="w-full bg-primary text-on-primary py-3.5 rounded-xl text-title-md font-title-md flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-60 cursor-pointer"
          >
            {loading ? (
              <>
                <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                Đang xác nhận thanh toán...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                Tôi đã chuyển khoản xong
              </>
            )}
          </button>

          <button
            onClick={() => navigate('/booking', { state: { reservationCode } })}
            className="text-on-surface-variant text-body-sm font-body-sm text-center hover:text-on-surface transition-colors cursor-pointer"
          >
            ← Quay lại đặt kho
          </button>
        </div>

        {/* Footer */}
        <div className="border-t border-surface-container px-6 py-3 flex items-center justify-between">
          <span className="text-body-sm font-body-sm text-on-surface-variant">Hotline: 1900 6868</span>
          <span className="text-body-sm font-body-sm text-on-surface-variant flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">lock</span>
            Giao dịch mã hóa SSL 256-bit
          </span>
        </div>
      </div>
    </div>
  )
}
