import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getVnpayStatus } from '../../services/vnpayService'
import { useSearchParams } from 'react-router-dom'

function formatVND(amount) {
  return Number(amount || 0).toLocaleString('vi-VN') + 'đ'
}

export default function ReservationConfirmationPage() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const [finalStatus, setFinalStatus] = useState('PENDING')
  const [searchParams] = useSearchParams()

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
  const branch = storage.branch || '—'
  const address = storage.address || '—'
  const unitName = storage.name || '—'
  const area = storage.area ?? '—'
  const dimension = storage.dimension || '—'

  const now = new Date()
  const timeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')} ngày ${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`

  const startDateObj = startDate ? new Date(startDate) : new Date()
  const startDateStr = `${startDateObj.getDate()}/${startDateObj.getMonth() + 1}/${startDateObj.getFullYear()}`

  useEffect(() => {
    const orderId = searchParams.get('orderId')
    const vnpResponse = searchParams.get('vnpResponse')

    if (vnpResponse && vnpResponse !== '00' && vnpResponse !== '24') {
      setFinalStatus('FAILED')
      return
    }
    if (vnpResponse === '24') {
      setFinalStatus('FAILED')
      return
    }

    if (orderId) {
      let active = true
      const poll = async () => {
        try {
          const result = await getVnpayStatus(orderId)
          if (!active) return
          if (result.status === 'SUCCESS') {
            setFinalStatus('DEPOSIT_PAID')
            clearInterval(intervalId)
          
          } else if (result.status === 'FAILED') {
            setFinalStatus('FAILED')
            clearInterval(intervalId)
          }
        } catch (e) {
          console.error('Polling failed', e)
        }
      }
      const intervalId = setInterval(poll, 3000)
      poll()
      return () => {
        active = false
        clearInterval(intervalId)
      }
    }
  }, [searchParams])

  return (
    <div className="p-6 max-w-3xl mx-auto select-none">

      {/* Step indicator */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-2xl border-b-2 flex items-center justify-center text-white text-xs font-black ${finalStatus === 'FAILED' ? 'bg-[#FF4B4B] border-[#EA2B2B]' : 'bg-[#58CC02] border-[#58A700]'}`}>
            3
          </div>
          <span className="text-base font-black text-[#4B4B4B]">Biên Nhận Xác Nhận Đặt Chỗ</span>
        </div>
        {finalStatus === 'FAILED' ? (
          <span className="px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider flex items-center gap-1 bg-[#FFDFDF] text-[#FF4B4B] border-2 border-[#FF4B4B]">
            <span className="material-symbols-outlined text-[16px]">cancel</span>
            Đã Hủy Giao Dịch
          </span>
        
        ) : (
          <span className="px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider flex items-center gap-1 bg-[#D7FFB8] text-[#58A700] border-2 border-[#58CC02]">
            <span className="material-symbols-outlined text-[16px]">check_circle</span>
            Hệ Thống Đã Ghi Nhận
          </span>
        )}
      </div>

      <div className="duo-card overflow-hidden">

        {finalStatus === 'FAILED' ? (
          <div className="flex flex-col items-center py-8 px-6 border-b-2 border-[#E5E5E5] bg-[#FFDFDF]">
            <div className="w-20 h-20 rounded-3xl bg-[#FF4B4B] border-b-4 border-[#EA2B2B] flex items-center justify-center text-white text-4xl mb-4">
              <span className="material-symbols-outlined text-[40px]">close</span>
            </div>
            <p className="text-xs font-black text-[#FF4B4B] uppercase tracking-wider mb-1">
              THANH TOÁN THẤT BẠI HOẶC ĐÃ HỦY
            </p>
            <h1 className="text-2xl sm:text-3xl font-black text-[#4B4B4B] text-center">
              GIAO DỊCH CHƯA HOÀN TẤT
            </h1>
            <p className="text-xs font-bold text-[#AFAFAF] mt-2 text-center">
              Đơn đặt chỗ{' '}
              <span className="font-black text-[#4B4B4B]">#{reservationCode}</span>{' '}
              đã bị hủy. Vui lòng đặt lại hoặc liên hệ hỗ trợ.
            </p>
            <button onClick={() => navigate('/tim-va-dat-kho')} className="duo-btn-white mt-6 px-8 py-3 text-xs tracking-wider shadow-sm">
              TÌM KHO MỚI
            </button>
          </div>
        
        ) : (
          <>
            <div className="flex flex-col items-center py-8 px-6 border-b-2 border-[#E5E5E5] bg-[#FAFAFA]">
              <div className="w-20 h-20 rounded-3xl bg-[#58CC02] border-b-4 border-[#58A700] flex items-center justify-center text-white text-4xl mb-4">
                🎉
              </div>
              <p className="text-xs font-black text-[#58CC02] uppercase tracking-wider mb-1">
                ĐẶT CHỖ THÀNH CÔNG!
              </p>
              <h1 className="text-2xl sm:text-3xl font-black text-[#4B4B4B] text-center">
                THANH TOÁN THÀNH CÔNG & ĐÃ XÁC NHẬN
              </h1>
              <p className="text-xs font-bold text-[#AFAFAF] mt-2 text-center">
                Đơn đặt chỗ{' '}
                <span className="font-black text-[#4B4B4B]">#{reservationCode}</span>{' '}
                đã thanh toán thành công vào lúc {timeStr}.
              </p>
            </div>

            {/* Banner thông báo bước tiếp theo */}
            <div className="bg-[#DDF4FF] border-2 border-b-4 border-[#84D8FF] mx-6 mt-6 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="text-sm font-black text-[#1CB0F6] uppercase mb-1">
                    Thanh toán: Đã hoàn tất thành công
                  </p>
                  <p className="text-xs font-bold text-[#4B4B4B]">
                    Hệ thống đã nhận thanh toán đợt 1{' '}
                    <span className="font-black text-[#58CC02]">{formatVND(totalPayment)}</span>.
                    {' '}Quản lý cơ sở sẽ gán ô kho và cấp phát mã mở khóa SmartLock cho bạn.
                  </p>
                </div>
              </div>
            </div>

            {/* 3 thông tin nhanh */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mx-6 mt-4">
              <div className="bg-[#F7F7F7] border-2 border-[#E5E5E5] rounded-2xl p-3.5">
                <span className="text-[11px] font-black uppercase text-[#AFAFAF] block">Cơ sở hoạt động</span>
                <p className="text-sm font-black text-[#4B4B4B] mt-1">{branch}</p>
              </div>
              <div className="bg-[#F7F7F7] border-2 border-[#E5E5E5] rounded-2xl p-3.5">
                <span className="text-[11px] font-black uppercase text-[#AFAFAF] block">Kích thước khoang</span>
                <p className="text-sm font-black text-[#4B4B4B] mt-1">{area} m² • {dimension}</p>
              </div>
              <div className="bg-[#F7F7F7] border-2 border-[#E5E5E5] rounded-2xl p-3.5">
                <span className="text-[11px] font-black uppercase text-[#AFAFAF] block">Đã thanh toán</span>
                <p className="text-sm font-black text-[#58CC02] mt-1">{formatVND(totalPayment)}</p>
              </div>
            </div>

            {/* Chi tiết đơn */}
            <div className="mx-6 mt-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-black uppercase tracking-wider text-[#AFAFAF]">
                  CHI TIẾT ĐƠN ĐẶT CHỖ
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 border-2 border-[#E5E5E5] rounded-2xl p-5 bg-white">
                <div>
                  <p className="text-[11px] font-black uppercase text-[#AFAFAF] mb-1">Mã đặt chỗ</p>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-black text-[#1CB0F6]">
                      #{reservationCode}
                    </span>
                    <button
                      onClick={() => navigator.clipboard.writeText(reservationCode)}
                      className="text-[#AFAFAF] hover:text-[#1CB0F6] transition-colors cursor-pointer"
                      title="Sao chép"
                    >
                      <span className="material-symbols-outlined text-[16px]">content_copy</span>
                    </button>
                  </div>
                </div>

                <div>
                  <p className="text-[11px] font-black uppercase text-[#AFAFAF] mb-1">Loại kho đăng ký</p>
                  <p className="text-sm font-black text-[#4B4B4B]">{unitName}</p>
                  <p className="text-xs font-bold text-[#AFAFAF]">{area} m² • {dimension}</p>
                </div>

                <div>
                  <p className="text-[11px] font-black uppercase text-[#AFAFAF] mb-1">Khách hàng</p>
                  <p className="text-sm font-black text-[#4B4B4B]">{customerInfo.fullName || 'Khách hàng'}</p>
                  <p className="text-xs font-bold text-[#AFAFAF]">{customerInfo.phone || '---'}</p>
                </div>

                <div>
                  <p className="text-[11px] font-black uppercase text-[#AFAFAF] mb-1">Thời hạn thuê</p>
                  <p className="text-sm font-black text-[#4B4B4B]">{selectedMonths} Tháng</p>
                  <p className="text-xs font-bold text-[#AFAFAF]">Bắt đầu từ: {startDateStr}</p>
                </div>

                <div>
                  <p className="text-[11px] font-black uppercase text-[#AFAFAF] mb-1">Thanh toán đợt 1</p>
                  <p className="text-base font-black text-[#58CC02]">{formatVND(totalPayment)}</p>
                  <p className="text-[11px] font-bold text-[#AFAFAF]">Cọc an toàn: {formatVND(depositAmount)}</p>
                </div>

                <div>
                  <p className="text-[11px] font-black uppercase text-[#AFAFAF] mb-1">Địa chỉ kho</p>
                  <p className="text-sm font-black text-[#4B4B4B]">{branch}</p>
                  <p className="text-xs font-bold text-[#AFAFAF]">{address}</p>
                </div>
              </div>
            </div>

            {/* Nút hành động */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mx-6 mt-6 mb-6">
              <button
                onClick={() => navigate('/booking')}
                className="duo-btn-white w-full sm:w-auto px-5 py-3 text-xs tracking-wider"
              >
                <span className="material-symbols-outlined text-[18px] mr-1">download</span>
                <span>TẢI PHIẾU BIÊN NHẬN</span>
              </button>
              <button
                onClick={() => navigate('/kho-cua-toi')}
                className="duo-btn-green w-full sm:w-auto px-6 py-3.5 text-xs tracking-wider"
              >
                <span className="material-symbols-outlined text-[18px] mr-1">warehouse</span>
                <span>XEM KHO CỦA TÔI</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
