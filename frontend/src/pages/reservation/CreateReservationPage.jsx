import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { createReservation } from '../../services/reservationService'

// Du lieu mock - thay bang API that sau khi UC-09 hoan thanh
const MOCK_UNIT = {
  code: 'TB-104',
  name: 'Khoang Tiêu Chuẩn',
  area: 6.0,
  floor: 'Tầng trệt',
  branch: 'QueenKho Tân Bình',
  address: '142 Cộng Hòa, P.13',
  dimension: '2.5m × 2.4m × 2.7m (Thể tích 16.2 m³)',
  pricePerMonth: 1850000,
  facilityId: 1,
  unitTypeId: 1,
}

const DURATION_OPTIONS = [
  { months: 1, label: '1 Tháng', sub: 'Tiêu chuẩn', note: 'Giá chuẩn', discount: 0 },
  { months: 3, label: '3 Tháng', sub: 'Phổ biến nhất', note: 'Tiết kiệm 5%', discount: 5, popular: true },
  { months: 6, label: '6 Tháng', sub: 'Trung hạn', note: 'Tiết kiệm 10%', discount: 10 },
  { months: 12, label: '12 Tháng', sub: 'Dài hạn', note: 'Tiết kiệm 15%', discount: 15 },
]

const VOUCHER_DISCOUNT = 100000

function formatVND(amount) {
  return amount.toLocaleString('vi-VN') + 'đ'
}

export default function CreateReservationPage() {
  const navigate = useNavigate()
  const [selectedMonths, setSelectedMonths] = useState(3)
  const [startDate, setStartDate] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Pre-fill thong tin khach hang tu session dang nhap
  const sessionUser = JSON.parse(localStorage.getItem('user') || '{}')
  const [customerInfo, setCustomerInfo] = useState({
    fullName: sessionUser.fullName || '',
    phone: '',
    cccd: '',
    email: sessionUser.email || '',
    address: '',
  })

  // Mac dinh ngay bat dau la ngay mai
  useEffect(() => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    setStartDate(tomorrow.toISOString().split('T')[0])
  }, [])

  // Tinh tien dong
  const selectedOption = DURATION_OPTIONS.find(o => o.months === selectedMonths)
  const baseTotal = MOCK_UNIT.pricePerMonth * selectedMonths
  const discountAmount = Math.round(baseTotal * (selectedOption.discount / 100))
  const netRent = baseTotal - discountAmount
  const deposit = MOCK_UNIT.pricePerMonth
  const totalPayment = netRent + deposit - VOUCHER_DISCOUNT

  const handleSubmit = async () => {
    // Validate
    if (!agreed) {
      setError('Bạn cần đồng ý với cam kết lưu trữ trước khi tiếp tục.')
      return
    }
    if (!startDate) {
      setError('Vui lòng chọn ngày bắt đầu nhận kho.')
      return
    }
    if (!customerInfo.fullName || !customerInfo.phone || !customerInfo.cccd || !customerInfo.email || !customerInfo.address) {
      setError('Vui lòng điền đầy đủ thông tin khách hàng.')
      return
    }

    try {
      setLoading(true)
      setError('')
      const response = await createReservation({
        customerId: sessionUser.userId ?? 1,   // Fallback id=1 khi chua dang nhap (test)
        facilityId: MOCK_UNIT.facilityId,
        unitTypeId: MOCK_UNIT.unitTypeId,
        startDate,
        durationMonths: selectedMonths,
      })
      navigate('/booking/payment', {
        state: {
          reservation: response,
          customerInfo,
          selectedMonths,
          startDate,
        },
      })
    } catch (err) {
      setError(err.response?.data?.message || 'Có lỗi xảy ra. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0]

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Tieu de trang */}
      <div className="mb-6">
        <h1 className="text-headline-md font-headline-md text-on-surface">
          Hoàn Tất Đặt Chỗ & Khai Báo Thông Tin
        </h1>
        <p className="text-body-md font-body-md text-on-surface-variant mt-1">
          Xác nhận thông tin hợp đồng điện tử và giữ chỗ khoang lưu trữ chỉ trong 2 phút.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">

        {/* Cot trai */}
        <div className="flex flex-col gap-5">

          {/* Section 1: Thong tin dat kho */}
          <div className="bg-white rounded-xl border border-surface-container-high p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-on-primary text-sm font-bold">
                  1
                </div>
                <span className="text-title-md font-title-md text-on-surface">Thông tin đặt kho</span>
              </div>
              <span className="text-label-md font-label-md text-[#10B981] bg-[#ECFDF5] px-2.5 py-1 rounded-full">
                Khoang tự quản 24/7
              </span>
            </div>

            <div className="flex items-start gap-4 bg-surface-container-low rounded-xl p-4">
              <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-on-primary text-[22px]">warehouse</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-title-md font-title-md text-on-surface">
                    {MOCK_UNIT.name} ({MOCK_UNIT.area} m²)
                  </span>
                  <span className="text-label-sm font-label-sm bg-secondary-fixed text-on-secondary-fixed-variant px-2 py-0.5 rounded-full">
                    {MOCK_UNIT.floor}
                  </span>
                </div>
                <p className="text-body-sm font-body-sm text-on-surface-variant mt-1">
                  Chi nhánh: {MOCK_UNIT.branch} ({MOCK_UNIT.address})
                </p>
                <p className="text-body-sm font-body-sm text-on-surface-variant">
                  Kích thước: {MOCK_UNIT.dimension}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-label-sm font-label-sm text-on-surface-variant mb-0.5">Đơn giá chuẩn:</div>
                <div className="text-title-md font-title-md text-on-surface">
                  {formatVND(MOCK_UNIT.pricePerMonth)}
                  <span className="text-body-sm text-on-surface-variant">/tháng</span>
                </div>
                <div className="text-label-sm font-label-sm text-on-surface-variant mt-1">{MOCK_UNIT.code}</div>
              </div>
            </div>
          </div>

          {/* Section 2: Thoi han thue */}
          <div className="bg-white rounded-xl border border-surface-container-high p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-on-primary text-sm font-bold">
                  2
                </div>
                <span className="text-title-md font-title-md text-on-surface">Thời hạn thuê & Ngày nhận kho</span>
              </div>
              <span className="text-label-md font-label-md text-secondary bg-secondary-fixed px-2.5 py-1 rounded-full">
                Linh hoạt gia hạn
              </span>
            </div>

            <p className="text-label-md font-label-md text-on-surface-variant uppercase tracking-wider mb-3">
              Thời hạn cam kết thuê tối thiểu
            </p>

            <div className="grid grid-cols-4 gap-3 mb-5">
              {DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.months}
                  onClick={() => setSelectedMonths(opt.months)}
                  className={`relative rounded-xl p-3 text-left border-2 transition-all cursor-pointer ${
                    selectedMonths === opt.months
                      ? 'bg-primary border-primary text-on-primary'
                      : 'bg-white border-surface-container-high text-on-surface hover:border-secondary'
                  }`}
                >
                  {/* Badge giam gia */}
                  {opt.popular && (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-label-sm font-label-sm bg-[#D97706] text-white px-2 py-0.5 rounded-full whitespace-nowrap">
                      Giảm 5%
                    </span>
                  )}
                  {!opt.popular && opt.discount > 0 && (
                    <span className={`absolute -top-2.5 right-2 text-label-sm font-label-sm px-1.5 py-0.5 rounded-full text-white ${
                      opt.months === 6 ? 'bg-secondary' : 'bg-[#7C3AED]'
                    }`}>
                      -{opt.discount}%
                    </span>
                  )}
                  <div className={`text-title-md font-title-md mb-0.5 ${selectedMonths === opt.months ? 'text-on-primary' : 'text-on-surface'}`}>
                    {opt.label}
                  </div>
                  <div className={`text-body-sm font-body-sm ${selectedMonths === opt.months ? 'text-on-primary/80' : 'text-on-surface-variant'}`}>
                    {opt.sub}
                  </div>
                  <div className={`text-body-sm font-body-sm ${selectedMonths === opt.months ? 'text-on-primary/70' : 'text-on-surface-variant'}`}>
                    {opt.note}
                  </div>
                  {selectedMonths === opt.months && opt.discount > 0 && (
                    <div className="text-label-sm font-label-sm text-on-primary/80 mt-1">
                      Tiết kiệm {formatVND(Math.round(MOCK_UNIT.pricePerMonth * opt.months * opt.discount / 100))}
                    </div>
                  )}
                </button>
              ))}
            </div>

            <div>
              <label className="text-body-md font-body-md text-on-surface mb-2 block">
                Ngày bắt đầu nhận kho <span className="text-error">*</span>
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">
                  calendar_month
                </span>
                <input
                  type="date"
                  value={startDate}
                  min={tomorrowStr}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-outline-variant rounded-xl text-body-md font-body-md text-on-surface focus:outline-none focus:border-secondary"
                />
              </div>
              <p className="text-body-sm font-body-sm text-on-surface-variant mt-2">
                🕐 Hỗ trợ dời ngày nhận tối đa 3 ngày trước khi kích hoạt không phụ phí.
              </p>
            </div>
          </div>

          {/* Section 3: Thong tin khach hang */}
          <div className="bg-white rounded-xl border border-surface-container-high p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-on-primary text-sm font-bold">
                  3
                </div>
                <span className="text-title-md font-title-md text-on-surface">Thông tin khách hàng</span>
              </div>
              <span className="text-label-sm font-label-sm text-error">* Bắt buộc cho hợp đồng điện tử</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-body-sm font-body-sm text-on-surface-variant mb-1.5 block">
                  Họ và Tên cá nhân / Doanh nghiệp <span className="text-error">*</span>
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">person</span>
                  <input
                    type="text"
                    placeholder="Nguyễn Thu Trang"
                    value={customerInfo.fullName}
                    onChange={(e) => setCustomerInfo({ ...customerInfo, fullName: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 border border-outline-variant rounded-xl text-body-md font-body-md text-on-surface focus:outline-none focus:border-secondary"
                  />
                </div>
              </div>

              <div>
                <label className="text-body-sm font-body-sm text-on-surface-variant mb-1.5 block">
                  Số điện thoại / Zalo <span className="text-error">*</span>
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">phone</span>
                  <input
                    type="tel"
                    placeholder="0909 123 456"
                    value={customerInfo.phone}
                    onChange={(e) => setCustomerInfo({ ...customerInfo, phone: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 border border-outline-variant rounded-xl text-body-md font-body-md text-on-surface focus:outline-none focus:border-secondary"
                  />
                </div>
              </div>

              <div>
                <label className="text-body-sm font-body-sm text-on-surface-variant mb-1.5 block">
                  Số CCCD / Passport <span className="text-error">*</span>
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">badge</span>
                  <input
                    type="text"
                    placeholder="07919800xxxx"
                    value={customerInfo.cccd}
                    onChange={(e) => setCustomerInfo({ ...customerInfo, cccd: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 border border-outline-variant rounded-xl text-body-md font-body-md text-on-surface focus:outline-none focus:border-secondary"
                  />
                </div>
                <p className="text-body-sm font-body-sm text-on-surface-variant mt-1">
                  Cấp quyền mở khóa SmartLock điện tử
                </p>
              </div>

              <div>
                <label className="text-body-sm font-body-sm text-on-surface-variant mb-1.5 block">
                  Email nhận hợp đồng & hóa đơn <span className="text-error">*</span>
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">mail</span>
                  <input
                    type="email"
                    placeholder="thutrang@gmail.com"
                    value={customerInfo.email}
                    onChange={(e) => setCustomerInfo({ ...customerInfo, email: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 border border-outline-variant rounded-xl text-body-md font-body-md text-on-surface focus:outline-none focus:border-secondary"
                  />
                </div>
              </div>

              <div className="col-span-2">
                <label className="text-body-sm font-body-sm text-on-surface-variant mb-1.5 block">
                  Địa chỉ thường trú / Trụ sở ghi nhận hợp đồng <span className="text-error">*</span>
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">location_on</span>
                  <input
                    type="text"
                    placeholder="Phường 13, Quận Tân Bình, TP. Hồ Chí Minh"
                    value={customerInfo.address}
                    onChange={(e) => setCustomerInfo({ ...customerInfo, address: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 border border-outline-variant rounded-xl text-body-md font-body-md text-on-surface focus:outline-none focus:border-secondary"
                  />
                </div>
              </div>
            </div>

            {/* Checkbox cam ket */}
            <div className="flex items-start gap-3 mt-4">
              <input
                type="checkbox"
                id="agreed"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-secondary cursor-pointer"
              />
              <label htmlFor="agreed" className="text-body-sm font-body-sm text-on-surface-variant cursor-pointer">
                Tôi cam kết{' '}
                <span className="font-semibold text-error">
                  không lưu trữ chất dễ cháy nổ, hàng lậu, hóa chất độc hại hoặc hàng cấm
                </span>{' '}
                theo quy định của pháp luật và nội quy QueenKho.
              </label>
            </div>
          </div>

          {/* Thong bao loi */}
          {error && (
            <div className="bg-error-container text-on-error-container text-body-sm font-body-sm px-4 py-3 rounded-xl">
              {error}
            </div>
          )}
        </div>

        {/* Cot phai - Chi tiet thanh toan */}
        <div className="lg:sticky lg:top-20 h-fit">
          <div className="rounded-xl overflow-hidden border border-surface-container-high shadow-sm">

            {/* Header xanh dam */}
            <div className="bg-primary px-5 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-title-md font-title-md text-on-primary">Chi Tiết Thanh Toán & Đặt Cọc</p>
                  <p className="text-label-sm font-label-sm text-on-primary/70 mt-0.5">
                    Mã giao dịch tạm: QK-{MOCK_UNIT.code}-8924
                  </p>
                </div>
                <span className="material-symbols-outlined text-on-primary/60 text-[20px]">receipt_long</span>
              </div>
            </div>

            {/* Goi lua chon */}
            <div className="bg-primary/90 px-5 py-2 flex items-center justify-between">
              <span className="text-label-sm font-label-sm text-on-primary/70 uppercase">Gói lựa chọn</span>
              <span className="text-label-sm font-label-sm bg-secondary text-on-secondary px-2 py-0.5 rounded-full">
                {MOCK_UNIT.branch.replace('QueenKho ', '')}
              </span>
            </div>
            <div className="bg-primary/80 px-5 py-2">
              <span className="text-body-sm font-body-sm text-on-primary/90">
                {MOCK_UNIT.name} {MOCK_UNIT.area} m² • Gói {selectedMonths} Tháng
              </span>
            </div>

            {/* Breakdown gia */}
            <div className="bg-white px-5 py-4 flex flex-col gap-3">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-body-sm font-body-sm text-on-surface">Tiền thuê kho ({selectedMonths} tháng)</p>
                  <p className="text-label-sm font-label-sm text-on-surface-variant">
                    {formatVND(MOCK_UNIT.pricePerMonth)} × {selectedMonths}
                  </p>
                </div>
                <span className="text-body-md font-body-md text-on-surface">{formatVND(baseTotal)}</span>
              </div>

              {selectedOption.discount > 0 && (
                <div className="flex justify-between items-center text-[#10B981]">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px]">local_offer</span>
                    <span className="text-body-sm font-body-sm">
                      Chiết khấu ưu đãi gói {selectedMonths}T (-{selectedOption.discount}%)
                    </span>
                  </div>
                  <span className="text-body-md font-body-md">-{formatVND(discountAmount)}</span>
                </div>
              )}

              <div className="flex justify-between items-center border-t border-surface-container pt-2">
                <span className="text-body-sm font-body-sm text-on-surface-variant">
                  Tiền thuê kho thực trả ({selectedMonths} tháng):
                </span>
                <span className="text-body-md font-body-md text-on-surface">{formatVND(netRent)}</span>
              </div>

              <div className="flex justify-between items-start">
                <div>
                  <p className="text-body-sm font-body-sm text-on-surface">Tiền cọc an toàn (1 tháng)</p>
                  <p className="text-label-sm font-label-sm text-on-surface-variant">
                    * Hoàn trả 100% khi thanh lý hợp đồng.
                  </p>
                </div>
                <span className="text-body-md font-body-md text-on-surface">{formatVND(deposit)}</span>
              </div>

              <div className="flex justify-between items-center text-[#10B981]">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">redeem</span>
                  <span className="text-body-sm font-body-sm">Chiết khấu voucher khách mới</span>
                </div>
                <span className="text-body-md font-body-md">-{formatVND(VOUCHER_DISCOUNT)}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-body-sm font-body-sm text-on-surface-variant">
                  Phí dịch vụ & quản lý phần mềm
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-label-sm font-label-sm text-on-surface-variant line-through">150.000đ</span>
                  <span className="text-label-sm font-label-sm text-[#10B981] font-semibold">Miễn phí (0đ)</span>
                </div>
              </div>

              {/* Tong tien */}
              <div className="border-t-2 border-primary pt-3">
                <p className="text-title-md font-title-md text-on-surface font-bold">
                  TỔNG CỘNG THANH TOÁN ĐỢT 1
                </p>
                <p className="text-label-sm font-label-sm text-on-surface-variant mt-0.5">
                  ({formatVND(netRent)} thuê {selectedMonths}T + {formatVND(deposit)} cọc - {formatVND(VOUCHER_DISCOUNT)} voucher)
                </p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-headline-md font-headline-md text-primary">{formatVND(totalPayment)}</span>
                  {selectedOption.discount > 0 && (
                    <span className="text-label-sm font-label-sm bg-[#ECFDF5] text-[#10B981] px-2 py-1 rounded-full">
                      Tiết kiệm {formatVND(discountAmount + VOUCHER_DISCOUNT)}
                    </span>
                  )}
                </div>
              </div>

              {/* Nut thanh toan */}
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full bg-primary text-on-primary py-3.5 rounded-xl text-title-md font-title-md flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-60 cursor-pointer mt-1"
              >
                <span className="material-symbols-outlined text-[18px]">lock</span>
                {loading ? 'Đang xử lý...' : `Thanh toán đợt 1: ${formatVND(totalPayment)}`}
              </button>

              <p className="text-label-sm font-label-sm text-on-surface-variant text-center">
                Napas 247 • VietQR • Hoàn cọc tự động 100%
              </p>

              <div className="flex justify-between items-center text-label-sm font-label-sm text-on-surface-variant border-t border-surface-container pt-2">
                <span>Cần hỗ trợ hoá đơn VAT doanh nghiệp?</span>
                <button className="text-secondary font-semibold cursor-pointer">Gọi CSKH →</button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
