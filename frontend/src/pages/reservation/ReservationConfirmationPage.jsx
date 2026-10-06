import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getVnpayStatus } from '../../services/vnpayService'
import { useSearchParams } from 'react-router-dom'

function formatVND(amount) {
  return Number(amount || 0).toLocaleString('vi-VN') + 'Ä‘'
}

export default function ReservationConfirmationPage() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const [finalStatus, setFinalStatus] = useState('PENDING')

  let savedContext = {}
  try {
    savedContext = JSON.parse(sessionStorage.getItem('queenkhoPaymentContext') || '{}')
  } catch {
    savedContext = {}
  }

  const paymentContext = state || savedContext
  const reservation = paymentContext.reservation || {}
  const customerInfo = paymentContext.customerInfo || {}
  const selectedMonths = paymentContext.selectedMonths || reservation.durationMonths || 1
  const startDate = paymentContext.startDate || reservation.startDate || ''
  const totalPayment = paymentContext.totalPayment || 0
  const depositAmount = paymentContext.deposit || reservation.depositAmount || 0
  const storage = paymentContext.storage || {}
  const reservationCode = reservation.reservationCode || 'RES-000000'
  const branch = storage.branch || 'â€”'
  const address = storage.address || 'â€”'
  const unitName = storage.name || 'â€”'
  const area = storage.area ?? 'â€”'
  const dimension = storage.dimension || 'â€”'

  const now = new Date()
  const timeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')} ngÃ y ${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`

  const startDateObj = startDate ? new Date(startDate) : new Date()
  const startDateStr = `${startDateObj.getDate()}/${startDateObj.getMonth() + 1}/${startDateObj.getFullYear()}`

  useEffect(() => {
    const resId = reservation.id
    if (resId) {
      confirmPaymentAfterCheckout(resId, totalPayment, reservationCode)
        .then((data) => {
          if (data && data.status) {
            setFinalStatus(data.status)
          } else {
            setFinalStatus('DEPOSIT_PAID')
          }
        })
        .catch((err) => {
          console.warn('[QueenKho] Lá»—i khi tá»± Ä‘á»™ng cáº­p nháº­t thanh toÃ¡n:', err)
        })
    }
  }, [reservation.id, totalPayment, reservationCode])

  return (
    <div className="p-6 max-w-3xl mx-auto select-none">

      {/* Step indicator */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-2xl bg-[#58CC02] border-b-2 border-[#58A700] flex items-center justify-center text-white text-xs font-black">
            3
          </div>
          <span className="text-base font-black text-[#4B4B4B]">BiÃªn Nháº­n XÃ¡c Nháº­n Äáº·t Chá»—</span>
        </div>
        <span className="duo-badge bg-[#D7FFB8] text-[#58A700] border-2 border-[#58CC02]">
          <span className="material-symbols-outlined text-[16px]">check_circle</span>
          Há»‡ Thá»‘ng ÄÃ£ Ghi Nháº­n
        </span>
      </div>

      <div className="duo-card overflow-hidden">

        {/* Pháº§n Ä‘áº§u - Biá»ƒu tÆ°á»£ng thÃ nh cÃ´ng */}
        {finalStatus === 'REFUND_PENDING' ? (
          <div className="flex flex-col items-center py-8 px-6 border-b-2 border-[#E5E5E5] bg-[#FFE8CC]">
            <div className="w-16 h-16 rounded-2xl bg-[#FF9600] border-b-4 border-[#E58800] flex items-center justify-center text-white text-2xl mb-4">
              âš ï¸
            </div>
            <p className="text-xs font-black text-[#E58800] uppercase tracking-wider mb-2">
              QuÃ¡ háº¡n thanh toÃ¡n
            </p>
            <h1 className="text-2xl font-black text-[#4B4B4B] text-center uppercase">
              Thanh toÃ¡n trá»… â€¢ ÄÆ¡n Ä‘Ã£ bá»‹ há»§y
            </h1>
            <div className="duo-card p-4 mt-3 text-xs font-bold text-[#E58800] text-center max-w-lg">
              ÄÆ¡n Ä‘áº·t chá»— <span className="font-black text-[#4B4B4B]">#{reservationCode}</span> Ä‘Ã£ quÃ¡ háº¡n 10 phÃºt thanh toÃ¡n.<br/>
              ChÃºng tÃ´i Ä‘Ã£ ghi nháº­n khoáº£n tiá»n cá»§a báº¡n. Vui lÃ²ng liÃªn há»‡ há»— trá»£ Ä‘á»ƒ Ä‘Æ°á»£c hoÃ n tiá»n ngay!
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center py-8 px-6 border-b-2 border-[#E5E5E5] bg-[#FAFAFA]">
            <div className="w-20 h-20 rounded-3xl bg-[#58CC02] border-b-4 border-[#58A700] flex items-center justify-center text-white text-4xl mb-4">
              ðŸŽ‰
            </div>
            <p className="text-xs font-black text-[#58CC02] uppercase tracking-wider mb-1">
              Äáº¶T CHá»– THÃ€NH CÃ”NG!
            </p>
            <h1 className="text-2xl sm:text-3xl font-black text-[#4B4B4B] text-center">
              THANH TOÃN THÃ€NH CÃ”NG â€¢ ÄÃƒ XÃC NHáº¬N
            </h1>
            <p className="text-xs font-bold text-[#AFAFAF] mt-2 text-center">
              ÄÆ¡n Ä‘áº·t chá»—{' '}
              <span className="font-black text-[#4B4B4B]">#{reservationCode}</span>{' '}
              Ä‘Ã£ thanh toÃ¡n thÃ nh cÃ´ng vÃ o lÃºc {timeStr}.
            </p>
          </div>
        )}

        {/* Banner thÃ´ng bÃ¡o bÆ°á»›c tiáº¿p theo */}
        <div className="bg-[#DDF4FF] border-2 border-b-4 border-[#84D8FF] mx-6 mt-6 rounded-2xl p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <p className="text-sm font-black text-[#1CB0F6] uppercase mb-1">
                Thanh toÃ¡n: ÄÃ£ hoÃ n táº¥t thÃ nh cÃ´ng
              </p>
              <p className="text-xs font-bold text-[#4B4B4B]">
                Há»‡ thá»‘ng Ä‘Ã£ nháº­n thanh toÃ¡n Ä‘á»£t 1{' '}
                <span className="font-black text-[#58CC02]">{formatVND(totalPayment)}</span>.
                {' '}Quáº£n lÃ½ cÆ¡ sá»Ÿ sáº½ gÃ¡n Ã´ kho vÃ  cáº¥p phÃ¡t mÃ£ má»Ÿ khÃ³a SmartLock cho báº¡n.
              </p>
            </div>
          </div>
        </div>

        {/* 3 thÃ´ng tin nhanh */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mx-6 mt-4">
          <div className="bg-[#F7F7F7] border-2 border-[#E5E5E5] rounded-2xl p-3.5">
            <span className="text-[11px] font-black uppercase text-[#AFAFAF] block">CÆ¡ sá»Ÿ hoáº¡t Ä‘á»™ng</span>
            <p className="text-sm font-black text-[#4B4B4B] mt-1">{branch}</p>
          </div>
          <div className="bg-[#F7F7F7] border-2 border-[#E5E5E5] rounded-2xl p-3.5">
            <span className="text-[11px] font-black uppercase text-[#AFAFAF] block">KÃ­ch thÆ°á»›c khoang</span>
            <p className="text-sm font-black text-[#4B4B4B] mt-1">{area} mÂ² â€¢ {dimension}</p>
          </div>
          <div className="bg-[#F7F7F7] border-2 border-[#E5E5E5] rounded-2xl p-3.5">
            <span className="text-[11px] font-black uppercase text-[#AFAFAF] block">ÄÃ£ thanh toÃ¡n</span>
            <p className="text-sm font-black text-[#58CC02] mt-1">{formatVND(totalPayment)}</p>
          </div>
        </div>

        {/* Chi tiáº¿t Ä‘Æ¡n */}
        <div className="mx-6 mt-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-black uppercase tracking-wider text-[#AFAFAF]">
              CHI TIáº¾T ÄÆ N Äáº¶T CHá»–
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 border-2 border-[#E5E5E5] rounded-2xl p-5 bg-white">
            <div>
              <p className="text-[11px] font-black uppercase text-[#AFAFAF] mb-1">MÃ£ Ä‘áº·t chá»—</p>
              <div className="flex items-center gap-2">
                <span className="text-base font-black text-[#1CB0F6]">
                  #{reservationCode}
                </span>
                <button
                  onClick={() => navigator.clipboard.writeText(reservationCode)}
                  className="text-[#AFAFAF] hover:text-[#1CB0F6] transition-colors cursor-pointer"
                  title="Sao chÃ©p"
                >
                  <span className="material-symbols-outlined text-[16px]">content_copy</span>
                </button>
              </div>
            </div>

            <div>
              <p className="text-[11px] font-black uppercase text-[#AFAFAF] mb-1">Loáº¡i kho Ä‘Äƒng kÃ½</p>
              <p className="text-sm font-black text-[#4B4B4B]">{unitName}</p>
              <p className="text-xs font-bold text-[#AFAFAF]">{area} mÂ² â€¢ {dimension}</p>
            </div>

            <div>
              <p className="text-[11px] font-black uppercase text-[#AFAFAF] mb-1">KhÃ¡ch hÃ ng</p>
              <p className="text-sm font-black text-[#4B4B4B]">{customerInfo.fullName || 'KhÃ¡ch hÃ ng'}</p>
              <p className="text-xs font-bold text-[#AFAFAF]">{customerInfo.phone || '---'}</p>
            </div>

            <div>
              <p className="text-[11px] font-black uppercase text-[#AFAFAF] mb-1">Thá»i háº¡n thuÃª</p>
              <p className="text-sm font-black text-[#4B4B4B]">{selectedMonths} ThÃ¡ng</p>
              <p className="text-xs font-bold text-[#AFAFAF]">Báº¯t Ä‘áº§u tá»«: {startDateStr}</p>
            </div>

            <div>
              <p className="text-[11px] font-black uppercase text-[#AFAFAF] mb-1">Thanh toÃ¡n Ä‘á»£t 1</p>
              <p className="text-base font-black text-[#58CC02]">{formatVND(totalPayment)}</p>
              <p className="text-[11px] font-bold text-[#AFAFAF]">Cá»c an toÃ n: {formatVND(depositAmount)}</p>
            </div>

            <div>
              <p className="text-[11px] font-black uppercase text-[#AFAFAF] mb-1">Äá»‹a chá»‰ kho</p>
              <p className="text-sm font-black text-[#4B4B4B]">{branch}</p>
              <p className="text-xs font-bold text-[#AFAFAF]">{address}</p>
            </div>
          </div>
        </div>

        {/* NÃºt hÃ nh Ä‘á»™ng */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mx-6 mt-6 mb-6">
          <button
            onClick={() => navigate('/booking')}
            className="duo-btn-white w-full sm:w-auto px-5 py-3 text-xs tracking-wider"
          >
            <span className="material-symbols-outlined text-[18px] mr-1">download</span>
            <span>Táº¢I PHIáº¾U BIÃŠN NHáº¬N</span>
          </button>
          <button
            onClick={() => navigate('/kho-cua-toi')}
            className="duo-btn-green w-full sm:w-auto px-6 py-3.5 text-xs tracking-wider"
          >
            <span className="material-symbols-outlined text-[18px] mr-1">warehouse</span>
            <span>XEM KHO Cá»¦A TÃ”I</span>
          </button>
        </div>

      </div>
    </div>
  )
}

