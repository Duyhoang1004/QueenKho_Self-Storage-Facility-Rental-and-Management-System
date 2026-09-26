import { useLocation, useNavigate } from 'react-router-dom'

// Format tien VND
function formatVND(amount) {
  return Number(amount || 0).toLocaleString('vi-VN') + 'đ'
}

export default function ReservationConfirmationPage() {
  const navigate = useNavigate()
  const { state } = useLocation()

  // Hosted Checkout lam mat navigate state, nen doc lai du lieu da luu truoc khi sang SePay.
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

  // Format ngay hien thi
  const now = new Date()
  const timeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')} ngày ${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`

  const startDateObj = startDate ? new Date(startDate) : new Date()
  const startDateStr = `${startDateObj.getDate()}/${startDateObj.getMonth() + 1}/${startDateObj.getFullYear()}`

  return (
    <div className="p-6 max-w-3xl mx-auto">

      {/* Step indicator */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-on-primary text-sm font-bold">3</div>
          <span className="text-title-md font-title-md text-on-surface">Biên Nhận Xác Nhận Đặt Chỗ</span>
        </div>
        <span className="text-label-md font-label-md text-[#10B981] bg-[#ECFDF5] px-3 py-1 rounded-full flex items-center gap-1">
          <span className="material-symbols-outlined text-[14px]">check_circle</span>
          Hệ Thống Đã Ghi Nhận
        </span>
      </div>

      <div className="bg-white rounded-xl border border-surface-container-high overflow-hidden">

        {/* Phan dau - icon va tieu de */}
        <div className="flex flex-col items-center py-8 px-6 border-b border-surface-container">
          <div className="w-16 h-16 rounded-full bg-[#ECFDF5] flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-[#10B981] text-[40px]">check_circle</span>
          </div>
          <p className="text-label-md font-label-md text-[#D97706] uppercase tracking-wider mb-2">
            Đặt chỗ tự động
          </p>
          <h1 className="text-headline-md font-headline-md text-on-surface text-center">
            THANH TOÁN THÀNH CÔNG • ĐẶT CHỖ ĐÃ XÁC NHẬN
          </h1>
          <p className="text-body-sm font-body-sm text-on-surface-variant mt-2 text-center">
            Đơn đặt chỗ{' '}
            <span className="font-semibold text-on-surface">#{reservationCode}</span>{' '}
            đã thanh toán thành công vào lúc {timeStr}.
          </p>
        </div>

        {/* Banner thong bao buoc tiep theo */}
        <div className="bg-secondary-fixed/50 border-l-4 border-secondary mx-6 mt-5 rounded-xl p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <p className="text-title-md font-title-md text-on-surface mb-1">
                Thanh toán:{' '}
                <span className="text-secondary">Đã hoàn tất</span>
              </p>
              <p className="text-body-sm font-body-sm text-on-surface-variant">
                Hệ thống đã ghi nhận khoản thanh toán đợt 1{' '}
                <span className="font-semibold text-on-surface">{formatVND(totalPayment)}</span>.
                {' '}Quản lý cơ sở sẽ gán ô kho và gửi thông báo cho bạn.
              </p>
              <div className="flex items-center gap-4 mt-2">
                <span className="text-body-sm font-body-sm text-[#10B981] flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">check</span>
                  Tự động kiểm tra tồn kho
                </span>
                <span className="text-body-sm font-body-sm text-[#10B981] flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">check</span>
                  Mã khóa tự sinh
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 3 thong tin nhanh */}
        <div className="grid grid-cols-3 gap-3 mx-6 mt-4">
          <div className="bg-surface-container-low rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="material-symbols-outlined text-on-surface-variant text-[16px]">location_on</span>
              <span className="text-label-sm font-label-sm text-on-surface-variant uppercase">Cơ sở hoạt động</span>
            </div>
            <p className="text-body-md font-body-md text-on-surface font-semibold">{storage.branch || 'QueenKho Tân Bình'}</p>
          </div>
          <div className="bg-surface-container-low rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="material-symbols-outlined text-on-surface-variant text-[16px]">straighten</span>
              <span className="text-label-sm font-label-sm text-on-surface-variant uppercase">Kích thước khoang</span>
            </div>
            <p className="text-body-md font-body-md text-on-surface font-semibold">{storage.area || 6.0} m² • {storage.dimension || '16.2 m³'}</p>
          </div>
          <div className="bg-surface-container-low rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="material-symbols-outlined text-on-surface-variant text-[16px]">payments</span>
              <span className="text-label-sm font-label-sm text-on-surface-variant uppercase">Đã thanh toán</span>
            </div>
            <p className="text-body-md font-body-md text-secondary font-semibold">{formatVND(totalPayment)}</p>
          </div>
        </div>

        {/* Chi tiet hop dong */}
        <div className="mx-6 mt-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-label-md font-label-md text-on-surface-variant uppercase tracking-wider">
              Chi tiết đơn đặt chỗ
            </span>
            <span className="text-label-sm font-label-sm text-on-surface-variant">QueenKho SAAS v4.2</span>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-4 border border-surface-container-high rounded-xl p-4">

            <div>
              <p className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider mb-1">Mã đặt chỗ</p>
              <div className="flex items-center gap-2">
                <span className="text-title-md font-title-md text-secondary font-bold">
                  #{reservationCode}
                </span>
                <button
                  onClick={() => navigator.clipboard.writeText(reservationCode)}
                  className="text-on-surface-variant hover:text-secondary transition-colors cursor-pointer"
                  title="Sao chép"
                >
                  <span className="material-symbols-outlined text-[16px]">content_copy</span>
                </button>
              </div>
            </div>

            <div>
              <p className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider mb-1">Loại kho đăng ký</p>
              <p className="text-body-md font-body-md text-on-surface font-semibold">{storage.name || 'Khoang Tiêu Chuẩn'}</p>
              <p className="text-body-sm font-body-sm text-on-surface-variant">{storage.area || 6.0} m² diện tích sàn • {storage.dimension || '16.2 m³'}</p>
            </div>

            <div>
              <p className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider mb-1">Khách hàng đăng ký</p>
              <p className="text-body-md font-body-md text-on-surface font-semibold">{customerInfo.fullName || 'Khách hàng'}</p>
              <p className="text-body-sm font-body-sm text-on-surface-variant flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">phone</span>
                {customerInfo.phone || '---'}
              </p>
            </div>

            <div>
              <p className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider mb-1">Thời hạn thuê</p>
              <p className="text-body-md font-body-md text-on-surface font-semibold">{selectedMonths} Tháng</p>
              <p className="text-body-sm font-body-sm text-on-surface-variant">Bắt đầu tính phí từ: {startDateStr}</p>
            </div>

            <div>
              <p className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider mb-1">Số CCCD / Định danh</p>
              <p className="text-body-md font-body-md text-on-surface">{customerInfo.cccd || '---'}</p>
            </div>

            <div>
              <p className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider mb-1">Thanh toán đợt 1</p>
              <div className="flex items-center gap-2">
                <p className="text-body-md font-body-md text-on-surface font-semibold">{formatVND(totalPayment)}</p>
                <span className="text-label-sm font-label-sm text-[#10B981] bg-[#ECFDF5] px-2 py-0.5 rounded-full">
                  Đã thanh toán
                </span>
              </div>
              <p className="text-label-sm font-label-sm text-on-surface-variant mt-1">Trong đó tiền cọc: {formatVND(depositAmount)}</p>
            </div>

            <div>
              <p className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider mb-1">Cơ sở lưu trữ</p>
              <p className="text-body-md font-body-md text-on-surface font-semibold">{storage.branch || 'QueenKho Tân Bình'}</p>
              <p className="text-body-sm font-body-sm text-on-surface-variant">{storage.address || '142 Cộng Hòa, P.13'}</p>
            </div>

            <div>
              <p className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider mb-1">Email nhận hóa đơn</p>
              <p className="text-body-md font-body-md text-on-surface">{customerInfo.email || '---'}</p>
            </div>
          </div>
        </div>

        {/* Hai card thong tin bottom */}
        <div className="grid grid-cols-2 gap-4 mx-6 mt-4">
          <div className="bg-surface-container-low rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-secondary text-[18px]">checklist</span>
              <span className="text-title-md font-title-md text-on-surface">Cần chuẩn bị gì khi nhận kho?</span>
            </div>
            <p className="text-body-sm font-body-sm text-on-surface-variant">
              Vui lòng mang theo bản gốc CCCD gắn chip để đối chiếu và lấy thẻ từ truy cập tầng lưu trữ.
            </p>
          </div>
          <div className="bg-surface-container-low rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-secondary text-[18px]">schedule</span>
              <span className="text-title-md font-title-md text-on-surface">Thời gian kho mở cửa?</span>
            </div>
            <p className="text-body-sm font-body-sm text-on-surface-variant">
              Cơ sở mở cửa 24/7 với khách hàng đã kích hoạt thẻ điện tử. Hỗ trợ trực tiếp từ 08:00 - 20:00 hàng ngày.
            </p>
          </div>
        </div>

        {/* Nut hanh dong */}
        <div className="flex items-center justify-between mx-6 mt-5 mb-5">
          <button
            onClick={() => navigate('/booking')}
            className="flex items-center gap-2 text-body-md font-body-md text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            Tải phiếu biên nhận PDF
          </button>
          <button
            onClick={() => navigate('/my-storage')}
            className="bg-primary text-on-primary px-6 py-2.5 rounded-xl text-title-md font-title-md flex items-center gap-2 hover:bg-primary/90 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">warehouse</span>
            Xem kho của tôi
          </button>
        </div>

        {/* Footer */}
        <div className="border-t border-surface-container px-6 py-3 flex items-center justify-between">
          <span className="text-body-sm font-body-sm text-on-surface-variant">
            Hotline Tân Bình: <span className="font-semibold text-on-surface">1900 6868</span>
          </span>
          <span className="text-body-sm font-body-sm text-on-surface-variant flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">lock</span>
            Giao dịch mã hóa SSL 256-bit
          </span>
        </div>
      </div>
    </div>
  )
}
