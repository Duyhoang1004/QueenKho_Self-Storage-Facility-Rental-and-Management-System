import { useState, useEffect } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { createReservation } from '../../services/reservationService'
import { createVnpayPayment } from '../../services/vnpayService'
import { getFacilityAvailability, getFacilityPricing } from '../../services/facilityService'

function buildUnit(availability, unitTypeId) {
  const slot = (availability.unitTypeAvailability || []).find((item) => item.unitTypeId === unitTypeId)
  if (!slot) return null
  const facility = availability.facility
  return {
    facilityId: facility.id,
    unitTypeId: slot.unitTypeId,
    name: slot.unitTypeName,
    area: Number(slot.areaSqm),
    dimension: slot.dimensions,
    pricePerMonth: Number(slot.basePriceMonthly),
    depositMonthMultiplier: Number(facility.depositMonthMultiplier || 1),
    availableCount: slot.availableCount,
    branch: facility.name,
    address: facility.address,
    hotline: facility.hotline,
  }
}

// % ưu đãi ở đây chỉ là giá trị dự phòng — số thật lấy từ chính sách BOM (GET /facilities/{id}/pricing),
// đúng con số VNPAY sẽ thu (Flow 4)
const DURATION_OPTIONS = [
  { months: 1, label: '1 Tháng', sub: 'Tiêu chuẩn', discount: 0 },
  { months: 3, label: '3 Tháng', sub: 'Phổ biến nhất', discount: 5, popular: true },
  { months: 6, label: '6 Tháng', sub: 'Trung hạn', discount: 10 },
  { months: 12, label: '12 Tháng', sub: 'Dài hạn', discount: 15 },
]

// Ưu đãi đặt kho online — backend luôn trừ đúng 100.000đ (PricingService.WELCOME_VOUCHER)
const VOUCHER_DISCOUNT = 100000

function formatVND(amount) {
  return amount.toLocaleString('vi-VN') + 'đ'
}

// Chỉ nhận mã backend thực sự áp dụng, tránh hiện số tiền khác với số VNPAY thu
const VOUCHER_MAP = {
  NEWKHO: VOUCHER_DISCOUNT,
}

export default function CreateReservationPage() {
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const facilityId = Number(searchParams.get('facilityId'))
  const unitTypeId = Number(searchParams.get('unitTypeId'))
  const hasParams = facilityId > 0 && unitTypeId > 0
  const loginRedirectTarget = location.pathname + location.search

  const [unit, setUnit] = useState(null)
  const [unitLoading, setUnitLoading] = useState(hasParams)
  const [unitError, setUnitError] = useState('')

  const [selectedMonths, setSelectedMonths] = useState(3)
  const [startDate, setStartDate] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [voucherCode, setVoucherCode] = useState('')
  const [voucherApplied, setVoucherApplied] = useState({ code: 'NEWKHO', discount: VOUCHER_DISCOUNT })
  const [voucherError, setVoucherError] = useState('')
  const [hasDebtError, setHasDebtError] = useState(false)

  const handleApplyVoucher = () => {
    const code = voucherCode.trim().toUpperCase()
    if (!code) return
    const discount = VOUCHER_MAP[code]
    if (discount) {
      setVoucherApplied({ code, discount })
      setVoucherError('')
      setVoucherCode('')
    } else {
      setVoucherError('Mã voucher không hợp lệ hoặc đã hết hạn.')
    }
  }

  const sessionUser = (() => {
    try {
      return JSON.parse(sessionStorage.getItem('user') || '{}')
    } catch {
      return {}
    }
  })()
  const isAuthenticated = Boolean(sessionUser?.userId)

  const [customerInfo, setCustomerInfo] = useState({
    fullName: sessionUser.fullName || '',
    phone: sessionUser.phone || '',
    cccd: '',
    email: sessionUser.email || '',
    address: '',
  })

  // Flow 4: % ưu đãi từng gói theo chính sách đang hiệu lực của cơ sở
  const [pricing, setPricing] = useState(null)
  useEffect(() => {
    if (!hasParams) return
    getFacilityPricing(facilityId).then(setPricing).catch(() => setPricing(null))
  }, [hasParams, facilityId])
  const durationOptions = DURATION_OPTIONS.map((opt) => {
    const fromPolicy = pricing?.bookingPackages?.find((p) => p.months === opt.months)
    return fromPolicy ? { ...opt, discount: fromPolicy.discountPercent } : opt
  })

  useEffect(() => {
    if (!hasParams) return

    let cancelled = false
    getFacilityAvailability(facilityId)
      .then((data) => {
        if (cancelled) return
        const found = buildUnit(data, unitTypeId)
        if (found) setUnit(found)
        else setUnitError('Cơ sở này không có loại kho bạn đã chọn.')
      })
      .catch(() => {
        if (!cancelled) setUnitError('Không tải được thông tin kho. Vui lòng thử lại.')
      })
      .finally(() => {
        if (!cancelled) setUnitLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [hasParams, facilityId, unitTypeId])

  useEffect(() => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    setStartDate(tomorrow.toISOString().split('T')[0])

    const paymentResult = new URLSearchParams(window.location.search).get('payment')
    if (paymentResult === 'failed') {
      setError('Thanh toán thất bại hoặc đã bị hủy. Vui lòng thử lại.')
    }
  }, [])

  if (!hasParams || unitLoading || unitError || !unit) {
    const message = !hasParams
      ? 'Bạn chưa chọn kho. Vui lòng chọn cơ sở và loại kho trước khi đặt chỗ.'
      : unitLoading
        ? 'Đang tải thông tin kho...'
        : unitError || 'Không tìm thấy thông tin kho.'
    return (
      <div className="p-8 max-w-3xl mx-auto flex flex-col items-center gap-4 text-center">
        <p className={`font-black ${unitLoading ? 'text-[#AFAFAF]' : 'text-[#FF4B4B]'}`}>{message}</p>
        {!unitLoading && (
          <Link
            to="/tim-va-dat-kho"
            className="duo-btn-green px-6 py-3 text-xs tracking-wider"
          >
            TÌM & CHỌN KHO
          </Link>
        )}
      </div>
    )
  }

  const selectedOption = durationOptions.find(o => o.months === selectedMonths)
  const baseTotal = unit.pricePerMonth * selectedMonths
  const discountAmount = Math.round(baseTotal * (selectedOption.discount / 100))
  const netRent = baseTotal - discountAmount
  const deposit = unit.pricePerMonth * unit.depositMonthMultiplier
  const totalPayment = netRent + deposit - voucherApplied.discount

  const handleSubmit = async () => {
    if (!isAuthenticated || !sessionUser?.userId) {
      setError('Bạn cần đăng nhập tài khoản trước khi thực hiện thanh toán đặt chỗ.')
      return
    }
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
      setHasDebtError(false)
      const response = await createReservation({
        customerId: sessionUser.userId,
        facilityId: unit.facilityId,
        unitTypeId: unit.unitTypeId,
        startDate,
        durationMonths: selectedMonths,
      })
      const paymentData = await createVnpayPayment(response.id)
      
      sessionStorage.setItem('queenkhoPaymentContext', JSON.stringify({
        reservation: response,
        customerInfo,
        selectedMonths,
        startDate,
        totalPayment: Number(paymentData.amount || totalPayment),
        deposit: Number(paymentData.depositAmount || deposit),
        storage: unit,
      }))

      window.location.assign(paymentData.payUrl)

    } catch (err) {
      const errData = err.response?.data
      if (err.response?.status === 409 && errData?.error === 'CUSTOMER_HAS_DEBT') {
        setHasDebtError(true)
        setError(errData.message || 'Quý khách đang có hợp đồng quá hạn chưa thanh toán hoặc chưa bàn giao kho.')
      } else {
        setHasDebtError(false)
        setError(errData?.detail || errData?.message || 'Có lỗi xảy ra. Vui lòng thử lại.')
      }
      setLoading(false)
    }
  }

  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0]

  return (
    <div className="max-w-[1100px] mx-auto px-6 py-8">
      {/* Tiêu đề trang */}
      <div className="mb-6">
        <h1 className="text-3xl font-black text-[#4B4B4B] tracking-tight">
          Hoàn tất đặt chỗ & Hợp đồng
        </h1>
        <p className="text-xs font-bold text-[#AFAFAF] mt-1 uppercase tracking-wider">
          Xác nhận thông tin hợp đồng điện tử và tiếp tục thanh toán giữ chỗ.
        </p>
      </div>

      {!isAuthenticated && (
        <div className="mb-6 duo-card p-5 border-2 border-b-4 border-[#FFE8CC] bg-[#FFF9F0] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#FF9600] border-b-2 border-[#E58800] flex items-center justify-center text-white shrink-0 mt-0.5 sm:mt-0">
              <span className="material-symbols-outlined text-[22px]">account_circle</span>
            </div>
            <div>
              <p className="text-sm font-black text-[#4B4B4B]">Bạn chưa đăng nhập tài khoản</p>
              <p className="text-xs font-bold text-[#777777] mt-0.5">
                Vui lòng đăng nhập để đơn đặt cọc được liên kết chính xác với tài khoản và theo dõi tại "Kho của tôi".
              </p>
            </div>
          </div>
          <Link
            to={`/login?redirect=${encodeURIComponent(loginRedirectTarget)}`}
            className="duo-btn-green px-5 py-2.5 text-xs tracking-wider shrink-0 whitespace-nowrap inline-flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">login</span>
            <span>ĐĂNG NHẬP NGAY</span>
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">

        {/* Cột trái */}
        <div className="flex flex-col gap-6">

          {/* Section 1: Thông tin khoang kho */}
          <div className="duo-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-2xl bg-[#58CC02] border-b-2 border-[#58A700] flex items-center justify-center text-white text-xs font-black">
                  1
                </div>
                <span className="text-base font-black text-[#4B4B4B]">Thông tin khoang kho</span>
              </div>
              <span className="text-xs font-black uppercase text-[#58A700] bg-[#D7FFB8] border-2 border-[#58CC02] px-3 py-1 rounded-full">
                Tự quản 24/7
              </span>
            </div>

            <div className="flex items-start gap-4 bg-[#F7F7F7] border-2 border-[#E5E5E5] rounded-2xl p-4">
              <div className="w-12 h-12 rounded-2xl bg-[#58CC02] border-b-2 border-[#58A700] flex items-center justify-center text-white flex-shrink-0">
                <span className="material-symbols-outlined text-[24px]">warehouse</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-base font-black text-[#4B4B4B]">
                    {unit.name} ({unit.area} m²)
                  </span>
                  <span className="text-[11px] font-black uppercase bg-[#DDF4FF] border border-[#84D8FF] text-[#1CB0F6] px-2 py-0.5 rounded-full">
                    Còn {unit.availableCount} ô trống
                  </span>
                </div>
                <p className="text-xs font-bold text-[#AFAFAF] mt-1">
                  Chi nhánh: {unit.branch} ({unit.address})
                </p>
                <p className="text-xs font-bold text-[#AFAFAF]">
                  Kích thước: {unit.dimension}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-[11px] font-black text-[#AFAFAF] uppercase">Đơn giá chuẩn:</div>
                <div className="text-base font-black text-[#58CC02]">
                  {formatVND(unit.pricePerMonth)}
                  <span className="text-xs text-[#AFAFAF]">/th</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Thời hạn thuê */}
          <div className="duo-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-2xl bg-[#1CB0F6] border-b-2 border-[#1899D6] flex items-center justify-center text-white text-xs font-black">
                  2
                </div>
                <span className="text-base font-black text-[#4B4B4B]">Thời hạn thuê & Ngày nhận kho</span>
              </div>
              <span className="text-xs font-black uppercase text-[#1CB0F6] bg-[#DDF4FF] border-2 border-[#84D8FF] px-3 py-1 rounded-full">
                Linh hoạt gia hạn
              </span>
            </div>

            <p className="text-xs font-black text-[#AFAFAF] uppercase tracking-wider mb-3">
              Thời hạn cam kết thuê tối thiểu
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              {durationOptions.map((opt) => (
                <button
                  key={opt.months}
                  onClick={() => setSelectedMonths(opt.months)}
                  className={`duo-btn p-3 flex flex-col items-start justify-start text-left relative h-auto ${
                    selectedMonths === opt.months
                      ? 'bg-[#DDF4FF] border-2 border-b-4 border-[#1899D6] text-[#1CB0F6]'
                      : 'bg-white border-2 border-b-4 border-[#E5E5E5] text-[#4B4B4B] hover:bg-[#F7F7F7]'
                  }`}
                >
                  {opt.popular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-black uppercase bg-[#FF9600] border border-[#E58800] text-white px-2 py-0.5 rounded-full whitespace-nowrap">
                      {opt.discount > 0 ? `Tiết kiệm ${opt.discount}%` : 'Phổ biến'}
                    </span>
                  )}
                  {!opt.popular && opt.discount > 0 && (
                    <span className="absolute -top-3 right-2 text-[10px] font-black uppercase bg-[#58CC02] text-white px-2 py-0.5 rounded-full">
                      -{opt.discount}%
                    </span>
                  )}
                  <div className="text-sm font-black mb-0.5">
                    {opt.label}
                  </div>
                  <div className="text-xs font-bold text-[#AFAFAF]">
                    {opt.sub}
                  </div>
                  {selectedMonths === opt.months && opt.discount > 0 && (
                    <div className="text-[10px] font-black text-[#1CB0F6] mt-1">
                      Giảm {formatVND(Math.round(unit.pricePerMonth * opt.months * opt.discount / 100))}
                    </div>
                  )}
                </button>
              ))}
            </div>

            <div>
              <label className="text-xs font-black uppercase tracking-wider text-[#777777] mb-2 block">
                Ngày bắt đầu nhận kho <span className="text-[#FF4B4B]">*</span>
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#AFAFAF] text-[20px]">
                  calendar_month
                </span>
                <input
                  type="date"
                  value={startDate}
                  min={tomorrowStr}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="duo-input w-full pl-11"
                />
              </div>
              <p className="text-xs font-bold text-[#AFAFAF] mt-2">
                🕐 Hỗ trợ dời ngày nhận tối đa 3 ngày trước khi kích hoạt không phụ phí.
              </p>
            </div>
          </div>

          {/* Section 3: Thông tin khách hàng */}
          <div className="duo-card p-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-2xl bg-[#FF9600] border-b-2 border-[#E58800] flex items-center justify-center text-white text-xs font-black">
                  3
                </div>
                <span className="text-base font-black text-[#4B4B4B]">Thông tin khách hàng</span>
              </div>
              <div className="flex items-center gap-2">
                {isAuthenticated ? (
                  <span className="text-[11px] font-black uppercase text-[#58A700] bg-[#D7FFB8] border border-[#58CC02] px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">verified</span>
                    Tài khoản đã xác thực
                  </span>
                ) : (
                  <span className="text-[11px] font-black uppercase text-[#E58800] bg-[#FFE8CC] border border-[#FF9600] px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">warning</span>
                    Chưa đăng nhập
                  </span>
                )}
                <span className="text-xs font-black text-[#FF4B4B] uppercase tracking-wider">* Bắt buộc</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-black uppercase tracking-wider text-[#777777] mb-1 block">
                  Họ và Tên cá nhân / Doanh nghiệp <span className="text-[#FF4B4B]">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Nguyễn Thu Trang"
                  value={customerInfo.fullName}
                  onChange={(e) => setCustomerInfo({ ...customerInfo, fullName: e.target.value })}
                  className="duo-input w-full"
                />
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-wider text-[#777777] mb-1 block">
                  Số điện thoại / Zalo <span className="text-[#FF4B4B]">*</span>
                </label>
                <input
                  type="tel"
                  placeholder="0909 123 456"
                  value={customerInfo.phone}
                  onChange={(e) => setCustomerInfo({ ...customerInfo, phone: e.target.value })}
                  className="duo-input w-full"
                />
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-wider text-[#777777] mb-1 block">
                  Số CCCD / Passport <span className="text-[#FF4B4B]">*</span>
                </label>
                <input
                  type="text"
                  placeholder="07919800xxxx"
                  value={customerInfo.cccd}
                  onChange={(e) => setCustomerInfo({ ...customerInfo, cccd: e.target.value })}
                  className="duo-input w-full"
                />
                <p className="text-[11px] font-bold text-[#AFAFAF] mt-1">
                  Cấp quyền mở khóa SmartLock điện tử
                </p>
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-wider text-[#777777] mb-1 block">
                  Email nhận hợp đồng & hóa đơn <span className="text-[#FF4B4B]">*</span>
                </label>
                <input
                  type="email"
                  placeholder="thutrang@gmail.com"
                  value={customerInfo.email}
                  onChange={(e) => setCustomerInfo({ ...customerInfo, email: e.target.value })}
                  className="duo-input w-full"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-black uppercase tracking-wider text-[#777777] mb-1 block">
                  Địa chỉ thường trú / Trụ sở ghi nhận hợp đồng <span className="text-[#FF4B4B]">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Phường 13, Quận Tân Bình, TP. Hồ Chí Minh"
                  value={customerInfo.address}
                  onChange={(e) => setCustomerInfo({ ...customerInfo, address: e.target.value })}
                  className="duo-input w-full"
                />
              </div>
            </div>

            {/* Checkbox cam kết */}
            <div className="flex items-start gap-3 mt-4 pt-4 border-t-2 border-[#E5E5E5]">
              <input
                type="checkbox"
                id="agreed"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-1 w-5 h-5 accent-[#58CC02] cursor-pointer"
              />
              <label htmlFor="agreed" className="text-xs font-bold text-[#4B4B4B] cursor-pointer leading-relaxed">
                Tôi cam kết{' '}
                <span className="font-black text-[#FF4B4B]">
                  không lưu trữ chất dễ cháy nổ, hàng lậu, hóa chất độc hại hoặc hàng cấm
                </span>{' '}
                theo quy định của pháp luật và nội quy QueenKho.
              </label>
            </div>
          </div>

          {error && (
            <div className="rounded-2xl border-2 border-b-4 border-[#FFDFDF] bg-[#FFF5F5] text-[#FF4B4B] text-xs font-black p-4 flex flex-col gap-2.5">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">error</span>
                <span>{error}</span>
              </div>
              {hasDebtError && (
                <div className="pt-2 border-t border-red-200 flex justify-end">
                  <Link
                    to="/kho-cua-toi"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FF4B4B] hover:bg-red-600 text-white rounded-xl text-xs font-black transition-colors"
                  >
                    <span>Xem hợp đồng của tôi</span>
                    <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Cột phải - Chi tiết thanh toán Duolingo Card */}
        <div className="lg:sticky lg:top-24 h-fit">
          <div className="duo-card overflow-hidden">
            {/* Header Duolingo Green */}
            <div className="bg-[#58CC02] border-b-4 border-[#58A700] px-6 py-5 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-base font-black uppercase tracking-wider">Chi Tiết Thanh Toán</p>
                  <p className="text-xs font-bold text-emerald-100 mt-0.5">
                    Mã đơn sẽ cấp ngay sau khi giữ chỗ
                  </p>
                </div>
                <span className="material-symbols-outlined text-white text-[24px]">receipt_long</span>
              </div>
            </div>

            {/* Breakdown giá */}
            <div className="p-6 flex flex-col gap-3.5 bg-white">
              <div className="flex justify-between items-start text-xs font-bold">
                <div>
                  <p className="text-[#4B4B4B]">Tiền thuê ({selectedMonths} tháng)</p>
                  <p className="text-[#AFAFAF]">{formatVND(unit.pricePerMonth)} × {selectedMonths}</p>
                </div>
                <span className="font-black text-[#4B4B4B]">{formatVND(baseTotal)}</span>
              </div>

              {selectedOption.discount > 0 && (
                <div className="flex justify-between items-center text-xs font-bold text-[#58A700] bg-[#D7FFB8] px-3 py-1.5 rounded-xl border border-[#58CC02]">
                  <span>Ưu đãi gói {selectedMonths}T (-{selectedOption.discount}%)</span>
                  <span className="font-black">-{formatVND(discountAmount)}</span>
                </div>
              )}

              <div className="flex justify-between items-center text-xs font-bold pt-1">
                <span className="text-[#4B4B4B]">
                  Tiền cọc theo chính sách ({unit.depositMonthMultiplier} tháng)
                </span>
                <span className="font-black text-[#4B4B4B]">{formatVND(deposit)}</span>
              </div>

              {/* Voucher input */}
              <div className="flex flex-col gap-1.5">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Nhập mã voucher..."
                    value={voucherCode}
                    onChange={(e) => { setVoucherCode(e.target.value); setVoucherError('') }}
                    onKeyDown={(e) => e.key === 'Enter' && handleApplyVoucher()}
                    className="duo-input flex-1 text-xs py-2"
                  />
                  <button
                    type="button"
                    onClick={handleApplyVoucher}
                    className="duo-btn-white px-3 py-2 text-xs tracking-wider shrink-0"
                  >
                    ÁP DỤNG
                  </button>
                </div>
                {voucherError && (
                  <p className="text-[11px] font-bold text-[#FF4B4B]">⚠️ {voucherError}</p>
                )}
              </div>

              {/* Dòng voucher đang áp dụng */}
              <div className="flex justify-between items-center text-xs font-bold text-[#58A700] bg-[#D7FFB8] px-3 py-1.5 rounded-xl border border-[#58CC02]">
                <span>🎫 Voucher <span className="font-black">{voucherApplied.code}</span></span>
                <span className="font-black">-{formatVND(voucherApplied.discount)}</span>
              </div>

              {/* Tổng tiền */}
              <div className="border-t-2 border-[#E5E5E5] pt-4 mt-1">
                <p className="text-xs font-black uppercase tracking-wider text-[#AFAFAF]">
                  TỔNG CỘNG THANH TOÁN ĐỢT 1
                </p>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-2xl font-black text-[#58CC02]">
                    {formatVND(totalPayment)}
                  </span>
                  {selectedOption.discount > 0 && (
                    <span className="text-[11px] font-black uppercase bg-[#D7FFB8] text-[#58A700] px-2.5 py-0.5 rounded-full border border-[#58CC02]">
                      Tiết kiệm {formatVND(discountAmount + voucherApplied.discount)}
                    </span>
                  )}
                </div>
              </div>

              

              {/* Giant CTA Button */}
              {!isAuthenticated ? (
                <Link
                  to={`/login?redirect=${encodeURIComponent(loginRedirectTarget)}`}
                  className="duo-btn-blue w-full py-4 text-sm tracking-wider mt-2 flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-[18px]">login</span>
                  <span>ĐĂNG NHẬP ĐỂ GIỮ KHO</span>
                </Link>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="duo-btn-green w-full py-4 text-sm tracking-wider mt-2 disabled:opacity-50 flex items-center justify-center gap-1"
                >
                  <span className="material-symbols-outlined text-[18px]">lock</span>
                  <span>{loading ? 'Đang chuyển sang VNPAY...' : 'THANH TOÁN GIỮ KHO'}</span>
                </button>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
