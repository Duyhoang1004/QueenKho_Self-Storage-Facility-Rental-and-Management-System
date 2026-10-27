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
  const [serverDetails, setServerDetails] = useState({})
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
  const storage = paymentContext.storage || {}
  const selectedMonths = serverDetails.duration_months || paymentContext.selectedMonths || reservation.durationMonths || 1
  const startDate = serverDetails.start_date || paymentContext.startDate || reservation.startDate || ''
  const totalPayment = serverDetails.payment_amount ?? paymentContext.totalPayment ?? 0
  const depositAmount = serverDetails.deposit_amount ?? paymentContext.deposit ?? reservation.depositAmount ?? 0
  const reservationCode = serverDetails.reservation_code || reservation.reservationCode || 'Đang cập nhật'
  const branch = serverDetails.facility_name || storage.branch || reservation.facilityName || 'Chưa cập nhật'
  const address = serverDetails.facility_address || storage.address || reservation.facilityAddress || 'Chưa cập nhật'
  const facilityHotline = serverDetails.facility_hotline || storage.hotline || reservation.facilityHotline || ''
  const unitName = serverDetails.unit_type_name || storage.name || reservation.unitTypeName || 'Chưa cập nhật'
  const dimension = serverDetails.dimensions || storage.dimension || reservation.dimensions || 'Chưa cập nhật'
  const storageUnitId = serverDetails.storage_unit_id || reservation.storageUnitId || ''
  const unitLocation = [
    serverDetails.storage_unit_floor || reservation.storageUnitFloor,
    (serverDetails.storage_unit_zone || reservation.storageUnitZone)
      ? `Khu ${serverDetails.storage_unit_zone || reservation.storageUnitZone}`
      : '',
    (serverDetails.storage_unit_room_number || reservation.storageUnitRoomNumber)
      ? `Phòng ${serverDetails.storage_unit_room_number || reservation.storageUnitRoomNumber}`
      : '',
  ].filter(Boolean).join(' • ')
  const customerName = serverDetails.customer_name || customerInfo.fullName || reservation.customerName || 'Khách hàng'
  const customerPhone = serverDetails.customer_phone || customerInfo.phone || reservation.customerPhone || 'Chưa cập nhật'
  const customerEmail = serverDetails.customer_email || customerInfo.email || reservation.customerEmail || 'Chưa cập nhật'
  const customerCccd = serverDetails.customer_cccd || customerInfo.cccd || reservation.customerCccd || 'Chưa cập nhật'
  const customerAddress = customerInfo.address || 'Chưa cập nhật'

  const paidAt = serverDetails.paid_at ? new Date(serverDetails.paid_at) : new Date()
  const timeStr = `${paidAt.getHours()}:${String(paidAt.getMinutes()).padStart(2, '0')} ngày ${paidAt.getDate()}/${paidAt.getMonth() + 1}/${paidAt.getFullYear()}`
  const startDateStr = startDate
    ? String(startDate).split('-').reverse().join('/')
    : 'Chưa cập nhật'

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
          setServerDetails(result || {})
          if (result.status === 'SUCCESS') {
            setFinalStatus(result.refund_status || result.reservation_status === 'REFUND_PENDING' ? 'REFUND_PENDING' : 'DEPOSIT_PAID')
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
    <div className="p-6 max-w-3xl mx-auto">

      {/* Step indicator */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-2xl border-b-2 flex items-center justify-center text-white text-xs font-black ${finalStatus === 'FAILED' ? 'bg-[#FF9600] border-[#E58800]' : finalStatus === 'REFUND_PENDING' ? 'bg-[#FF9600] border-[#E58800]' : 'bg-[#58CC02] border-[#58A700]'}`}>
            3
          </div>
          <span className="text-base font-black text-[#4B4B4B]">Biên Nhận Xác Nhận Đặt Chỗ</span>
        </div>
        {finalStatus === 'FAILED' ? (
          <span className="px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider flex items-center gap-1 bg-[#FFE8CC] text-[#E58800] border-2 border-[#FF9600]">
            <span className="material-symbols-outlined text-[16px]">schedule</span>
            Chờ thanh toán lại
          </span>
        ) : finalStatus === 'REFUND_PENDING' ? (
          <span className="px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider flex items-center gap-1 bg-[#FFE8CC] text-[#E58800] border-2 border-[#FF9600]">
            <span className="material-symbols-outlined text-[16px]">currency_exchange</span>
            Đang xử lý hoàn tiền
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
          <div className="flex flex-col items-center py-8 px-6 border-b-2 border-[#E5E5E5] bg-[#FFF4E5]">
            <div className="w-20 h-20 rounded-3xl bg-[#FF9600] border-b-4 border-[#E58800] flex items-center justify-center text-white text-4xl mb-4">
              <span className="material-symbols-outlined text-[40px]">payments</span>
            </div>
            <p className="text-xs font-black text-[#E58800] uppercase tracking-wider mb-1">
              THANH TOÁN THẤT BẠI HOẶC ĐÃ HỦY
            </p>
            <h1 className="text-2xl sm:text-3xl font-black text-[#4B4B4B] text-center">
              GIAO DỊCH CHƯA HOÀN TẤT
            </h1>
            <p className="text-xs font-bold text-[#AFAFAF] mt-2 text-center">
              Đơn đặt chỗ{' '}
              <span className="font-black text-[#4B4B4B]">#{reservationCode}</span>{' '}
              vẫn được giữ tối đa 15 phút. Bạn có thể mở danh sách đơn để thanh toán lại.
            </p>
            <button onClick={() => navigate('/kho-cua-toi')} className="duo-btn-green mt-6 px-8 py-3 text-xs tracking-wider shadow-sm">
              ĐẾN ĐƠN CỦA TÔI
            </button>
          </div>
        ) : finalStatus === 'REFUND_PENDING' ? (
          <div className="flex flex-col items-center py-8 px-6 border-b-2 border-[#E5E5E5] bg-[#FFF4E5]">
            <div className="w-20 h-20 rounded-3xl bg-[#FF9600] border-b-4 border-[#E58800] flex items-center justify-center text-white mb-4">
              <span className="material-symbols-outlined text-[40px]">currency_exchange</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#4B4B4B] text-center">ĐÃ NHẬN TIỀN SAU KHI HẾT GIỮ CHỖ</h1>
            <p className="text-xs font-bold text-[#777777] mt-3 text-center max-w-lg">
              Giao dịch đã được ghi nhận nhưng đơn không còn giữ suất. Hệ thống đã tự tạo yêu cầu hoàn toàn bộ số tiền cho Quản lý cơ sở xử lý.
            </p>
            <button onClick={() => navigate('/kho-cua-toi')} className="duo-btn-white mt-6 px-8 py-3 text-xs tracking-wider shadow-sm">
              THEO DÕI TRẠNG THÁI HOÀN TIỀN
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

            {/* Thông tin nhanh */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mx-6 mt-4">
              <div className="bg-[#F7F7F7] border-2 border-[#E5E5E5] rounded-2xl p-3.5">
                <span className="text-[11px] font-black uppercase text-[#AFAFAF] block">Cơ sở hoạt động</span>
                <p className="text-sm font-black text-[#4B4B4B] mt-1">{branch}</p>
              </div>
              <div className="bg-[#F7F7F7] border-2 border-[#E5E5E5] rounded-2xl p-3.5">
                <span className="text-[11px] font-black uppercase text-[#AFAFAF] block">Địa chỉ nhận kho</span>
                <p className="text-sm font-black text-[#4B4B4B] mt-1 leading-5">{address}</p>
              </div>
              <div className="bg-[#F7F7F7] border-2 border-[#E5E5E5] rounded-2xl p-3.5">
                <span className="text-[11px] font-black uppercase text-[#AFAFAF] block">Loại kho đăng ký</span>
                <p className="text-sm font-black text-[#4B4B4B] mt-1">{unitName}</p>
                <p className="text-[11px] font-bold text-[#AFAFAF] mt-0.5">{dimension}</p>
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
                  <p className="text-xs font-bold text-[#AFAFAF]">{dimension}</p>
                </div>

                <div>
                  <p className="text-[11px] font-black uppercase text-[#AFAFAF] mb-1">Khách hàng</p>
                  <p className="text-sm font-black text-[#4B4B4B]">{customerName}</p>
                  <p className="text-xs font-bold text-[#AFAFAF]">{customerPhone}</p>
                </div>

                <div>
                  <p className="text-[11px] font-black uppercase text-[#AFAFAF] mb-1">Liên hệ khách hàng</p>
                  <p className="text-sm font-black text-[#4B4B4B] break-all">{customerEmail}</p>
                  <p className="text-xs font-bold text-[#AFAFAF]">CCCD / Passport: {customerCccd}</p>
                </div>

                <div>
                  <p className="text-[11px] font-black uppercase text-[#AFAFAF] mb-1">Địa chỉ người thuê</p>
                  <p className="text-sm font-black text-[#4B4B4B]">{customerAddress}</p>
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
                  {facilityHotline && <p className="text-[11px] font-bold text-[#777777] mt-1">Hotline: {facilityHotline}</p>}
                </div>

                <div>
                  <p className="text-[11px] font-black uppercase text-[#AFAFAF] mb-1">Ô kho thực tế</p>
                  {storageUnitId ? (
                    <>
                      <p className="text-sm font-black font-mono text-[#1CB0F6]">{storageUnitId}</p>
                      <p className="text-xs font-bold text-[#AFAFAF]">{unitLocation || 'Vị trí đang cập nhật'}</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-black text-[#FF9600]">Chưa gán ô kho</p>
                      <p className="text-xs font-bold text-[#AFAFAF]">Quản lý cơ sở sẽ phân bổ ô phù hợp sau khi xác nhận cọc.</p>
                    </>
                  )}
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
