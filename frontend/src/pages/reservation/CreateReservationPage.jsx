import { useState, useEffect } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { checkRangeAvailability, createReservation } from '../../services/reservationService'
import { createVnpayPayment } from '../../services/vnpayService'
import { getFacilityAvailability, getFacilityPricing } from '../../services/facilityService'
import AssetTermsModal from '../../components/AssetTermsModal'
import { validateVoucher } from '../../services/voucherService'
import { getInsurancePlans } from '../../services/claimService'
import { getGoodsCategories, TEMPERATURE_LABELS } from '../../services/catalogService'
import GoodsCategoryDropdown from '../../components/GoodsCategoryDropdown'

// BR-125: dự phòng khi chưa tải được danh sách gói từ backend (GET /insurance-plans)
const FALLBACK_PLANS = [
  { code: 'BASIC', label: 'Cơ bản', monthlyPremium: 0, coverageLimit: 20000000, insured: false },
  { code: 'ADVANCED', label: 'Nâng cao', monthlyPremium: 50000, coverageLimit: 200000000, insured: true },
  { code: 'PREMIUM', label: 'Cao cấp', monthlyPremium: 120000, coverageLimit: 500000000, insured: true },
]
const NO_DECLARATION_CAP = 5000000

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
    temperatureClass: slot.temperatureClass || 'NORMAL', // BR-131
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

// BR-25: ưu đãi mặc định NEWKHO 100.000đ — chỉ dùng để hiển thị khi chưa đăng nhập;
// đã đăng nhập thì số tiền giảm lấy từ backend (/vouchers/validate), khớp đúng số VNPAY thu
const DEFAULT_VOUCHER = { code: 'NEWKHO', name: 'Ưu đãi đặt kho trực tuyến', discount: 100000 }

function formatVND(amount) {
  return amount.toLocaleString('vi-VN') + 'đ'
}

// D-18: nhận đặt kho trước tối đa 90 ngày (PR-B4)
const MAX_LEAD_DAYS = 90
const isoDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const formatIso = (iso) => (iso ? iso.split('-').reverse().join('/') : '')

export default function CreateReservationPage() {
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const facilityId = Number(searchParams.get('facilityId'))
  const unitTypeId = Number(searchParams.get('unitTypeId'))
  // PR-R11: đặt trước ô "sắp trống" → chỉ nhận kho được từ ngày này (yyyy-MM-dd)
  const availableFrom = searchParams.get('from') || ''
  const hasParams = facilityId > 0 && unitTypeId > 0
  const loginRedirectTarget = location.pathname + location.search

  const [unit, setUnit] = useState(null)
  const [unitLoading, setUnitLoading] = useState(hasParams)
  const [unitError, setUnitError] = useState('')

  const [selectedMonths, setSelectedMonths] = useState(3)
  const [startDate, setStartDate] = useState('')
  // BR-125: gói bảo hiểm hàng hoá + giá trị hàng khai báo (căn cứ trần bồi thường)
  const [insurancePlans, setInsurancePlans] = useState(FALLBACK_PLANS)
  const [insurancePlan, setInsurancePlan] = useState('BASIC')
  const [declaredValue, setDeclaredValue] = useState('')
  // BR-131 (05/11/2026): loại hàng gửi kho — BOM quản lý danh mục, thực phẩm chỉ cho kho lạnh / đông
  const [goodsCategories, setGoodsCategories] = useState([])
  const [goodsCodes, setGoodsCodes] = useState([])
  const [goodsDescription, setGoodsDescription] = useState('')
  const [agreed, setAgreed] = useState(false)
  // Điều khoản xử lý tài sản khi không trả kho — bắt buộc, backend lưu phiên bản + thời điểm đồng ý
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [termsOpen, setTermsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // (08/11/2026, góp ý test) lỗi hiện ngay trên nút thanh toán + cuộn tới đúng mục bị thiếu
  const [errorField, setErrorField] = useState('')
  // D-18: số ô còn trống cho đúng khoảng ngày khách chọn
  const [rangeInfo, setRangeInfo] = useState({ key: '', data: null })
  // Thông tin khách đã có trong tài khoản → thu gọn thành 1 dòng, bấm "Sửa" mới mở form
  const [editCustomer, setEditCustomer] = useState(false)
  const sessionUserId = (() => {
    try {
      return JSON.parse(sessionStorage.getItem('user') || '{}').userId ?? null
    } catch {
      return null
    }
  })()
  const [voucherCode, setVoucherCode] = useState('')
  // Mã khách tự nhập đã được BE chấp nhận ('' = dùng mã mặc định)
  const [customVoucherCode, setCustomVoucherCode] = useState('')
  const [voucherApplied, setVoucherApplied] = useState(DEFAULT_VOUCHER)
  const [voucherError, setVoucherError] = useState('')
  const [voucherChecking, setVoucherChecking] = useState(false)
  const [hasDebtError, setHasDebtError] = useState(false)

  const toApplied = (data) => (data?.voucherId
    ? { code: data.code, name: data.name, discount: Number(data.discountAmount || 0) }
    : { code: '', name: '', discount: 0 })

  // BR-25: mức giảm phụ thuộc gói thuê (voucher % / gói tối thiểu) → hỏi lại BE khi đổi gói hoặc đổi mã
  useEffect(() => {
    if (!sessionUserId || !unit?.facilityId || !unit?.unitTypeId) return undefined
    let cancelled = false
    validateVoucher({ code: customVoucherCode, facilityId: unit.facilityId, unitTypeId: unit.unitTypeId, months: selectedMonths })
      .then((data) => { if (!cancelled) setVoucherApplied(toApplied(data)) })
      .catch((err) => {
        if (cancelled) return
        // Mã tự nhập không còn hợp lệ với gói mới → quay về mã mặc định và báo lý do
        setVoucherError(err.response?.data?.message || 'Mã voucher không còn áp dụng được.')
        setCustomVoucherCode('')
      })
    return () => { cancelled = true }
  }, [sessionUserId, unit?.facilityId, unit?.unitTypeId, selectedMonths, customVoucherCode])

  const handleApplyVoucher = async () => {
    const code = voucherCode.trim().toUpperCase()
    if (!code) return
    if (!sessionUserId) {
      setVoucherError('Vui lòng đăng nhập để áp mã voucher.')
      return
    }
    setVoucherChecking(true)
    try {
      const data = await validateVoucher({ code, facilityId: unit.facilityId, unitTypeId: unit.unitTypeId, months: selectedMonths })
      setVoucherApplied(toApplied(data))
      setCustomVoucherCode(code)
      setVoucherError('')
      setVoucherCode('')
    } catch (err) {
      setVoucherError(err.response?.data?.message || 'Mã voucher không hợp lệ hoặc đã hết hạn.')
    } finally {
      setVoucherChecking(false)
    }
  }

  const handleRemoveVoucher = () => {
    setCustomVoucherCode('')
    setVoucherError('')
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
    cccd: sessionUser.cccd || '',
    email: sessionUser.email || '',
    address: '',
  })

  // Flow 4: % ưu đãi từng gói theo chính sách đang hiệu lực của cơ sở
  const [pricing, setPricing] = useState(null)
  useEffect(() => {
    if (!hasParams) return
    getFacilityPricing(facilityId).then(setPricing).catch(() => setPricing(null))
  }, [hasParams, facilityId])
  useEffect(() => {
    getGoodsCategories().then((list) => setGoodsCategories(Array.isArray(list) ? list : [])).catch(() => setGoodsCategories([]))
  }, [])
  useEffect(() => {
    getInsurancePlans()
      .then((plans) => { if (Array.isArray(plans) && plans.length) setInsurancePlans(plans) })
      .catch(() => {})
  }, [])
  // D-18: hỏi BE còn bao nhiêu ô trống suốt [ngày nhận, hết hạn] mỗi khi đổi ngày / gói
  const rangeKey = `${facilityId}|${unitTypeId}|${startDate}|${selectedMonths}`
  useEffect(() => {
    if (!hasParams || !startDate) return undefined
    let cancelled = false
    checkRangeAvailability({ facilityId, unitTypeId, startDate, durationMonths: selectedMonths })
      .then((data) => { if (!cancelled) setRangeInfo({ key: rangeKey, data }) })
      .catch(() => { if (!cancelled) setRangeInfo({ key: rangeKey, data: null }) })
    return () => { cancelled = true }
  }, [hasParams, facilityId, unitTypeId, startDate, selectedMonths, rangeKey])
  const range = rangeInfo.key === rangeKey ? rangeInfo.data : null

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
  // BR-125: phí bảo hiểm = phí gói / tháng × số tháng (gói Cơ bản miễn phí)
  const selectedPlan = insurancePlans.find((p) => p.code === insurancePlan) || insurancePlans[0]
  const insuranceTotal = Number(selectedPlan.monthlyPremium || 0) * selectedMonths
  const declaredNumber = Number(declaredValue || 0)
  const coverageCap = declaredNumber > 0
    ? Math.min(declaredNumber, Number(selectedPlan.coverageLimit))
    : Math.min(NO_DECLARATION_CAP, Number(selectedPlan.coverageLimit))
  const totalPayment = netRent + deposit - voucherApplied.discount + insuranceTotal
  const needsGoodsNote = goodsCategories.some((c) => c.requiresNote && goodsCodes.includes(c.code))

  // Báo lỗi cạnh nút thanh toán, cuộn tới mục cần sửa và viền đỏ mục đó
  const fail = (message, field = '') => {
    setError(message)
    setErrorField(field)
    if (field) {
      document.getElementById(field)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  const handleSubmit = async () => {
    if (!isAuthenticated || !sessionUser?.userId) {
      fail('Bạn cần đăng nhập tài khoản trước khi thực hiện thanh toán đặt chỗ.')
      return
    }
    if (!startDate) {
      fail('Vui lòng chọn ngày bắt đầu nhận kho.', 'sec-start')
      return
    }
    // PR-R11: ô "sắp trống" chỉ giao được từ ngày khách cũ hết ân hạn
    if (availableFrom && startDate < availableFrom) {
      fail(`Loại kho này hiện hết ô trống, chỉ nhận kho được từ ngày ${formatIso(availableFrom)}.`, 'sec-start')
      return
    }
    if (startDate > maxStartDate) {
      fail(`Chỉ nhận đặt kho trước tối đa ${MAX_LEAD_DAYS} ngày — ngày nhận kho xa nhất là ${formatIso(maxStartDate)}.`, 'sec-start')
      return
    }
    // D-18: khoảng ngày đã chọn hết ô
    if (range && !range.available) {
      fail(range.message || 'Không còn ô trống cho khoảng ngày này. Vui lòng chọn ngày nhận khác hoặc gói ngắn hơn.', 'sec-start')
      return
    }
    if (goodsCodes.length === 0) {
      fail('Vui lòng chọn loại hàng sẽ gửi kho.', 'sec-goods')
      return
    }
    if (needsGoodsNote && goodsDescription.trim().length < 3) {
      fail('Bạn chọn "Khác" — vui lòng mô tả rõ loại hàng sẽ gửi.', 'sec-goods')
      return
    }
    if (!customerInfo.fullName || !customerInfo.phone || !customerInfo.cccd || !customerInfo.email || !customerInfo.address) {
      if (!customerInfo.fullName || !customerInfo.phone || !customerInfo.cccd || !customerInfo.email) setEditCustomer(true)
      fail(customerInfo.address ? 'Vui lòng điền đầy đủ thông tin khách hàng.' : 'Vui lòng nhập địa chỉ thường trú / trụ sở để ghi vào hợp đồng.', 'sec-customer')
      return
    }
    if (!agreed) {
      fail('Bạn cần tick cam kết không lưu trữ hàng cấm trước khi tiếp tục.', 'sec-commit')
      return
    }
    if (!termsAccepted) {
      fail('Bạn cần đồng ý Điều khoản xử lý tài sản khi không trả kho trước khi tiếp tục.', 'sec-commit')
      return
    }

    try {
      setLoading(true)
      setError('')
      setErrorField('')
      setHasDebtError(false)
      const response = await createReservation({
        customerId: sessionUser.userId,
        facilityId: unit.facilityId,
        unitTypeId: unit.unitTypeId,
        startDate,
        durationMonths: selectedMonths,
        acceptedTerms: termsAccepted,
        phone: customerInfo.phone?.trim(),
        cccd: customerInfo.cccd?.trim(),
        voucherCode: customVoucherCode || undefined,
        insurancePlan,
        declaredGoodsValue: declaredNumber > 0 ? declaredNumber : undefined,
        goodsCategoryCodes: goodsCodes,
        goodsDescription: goodsDescription.trim() || undefined,
      })
      // Đồng bộ thông tin SĐT và CCCD mới nhất vào phiên đăng nhập hiện tại
      sessionStorage.setItem('user', JSON.stringify({
        ...sessionUser,
        phone: customerInfo.phone?.trim() || sessionUser.phone,
        cccd: customerInfo.cccd?.trim() || sessionUser.cccd,
      }))
      const paymentData = await createVnpayPayment(response.id)
      
      sessionStorage.setItem('queenkhoPaymentContext', JSON.stringify({
        reservation: response,
        customerInfo,
        selectedMonths,
        startDate,
        totalPayment: Number(paymentData.amount || totalPayment),
        deposit: Number(paymentData.depositAmount || deposit),
        voucherCode: voucherApplied.code,
        voucherDiscount: voucherApplied.discount,
        insurancePlanLabel: selectedPlan.label,
        insuranceAmount: insuranceTotal,
        storage: unit,
      }))

      window.location.assign(paymentData.payUrl)

    } catch (err) {
      const errData = err.response?.data
      if (err.response?.status === 409 && errData?.error === 'CUSTOMER_HAS_DEBT') {
        setHasDebtError(true)
        fail(errData.message || 'Quý khách đang có hợp đồng quá hạn chưa thanh toán hoặc chưa bàn giao kho.')
      } else {
        setHasDebtError(false)
        const field = ['NO_AVAILABILITY', 'START_DATE_TOO_FAR'].includes(errData?.error) ? 'sec-start'
          : String(errData?.error || '').startsWith('GOODS') ? 'sec-goods' : ''
        fail(errData?.detail || errData?.message || 'Có lỗi xảy ra. Vui lòng thử lại.', field)
      }
      setLoading(false)
    }
  }

  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0]
  const minStartDate = availableFrom && availableFrom > tomorrowStr ? availableFrom : tomorrowStr
  const maxStartDate = (() => {
    const [y, m, d] = tomorrowStr.split('-').map(Number)
    return isoDate(new Date(y, m - 1, d + MAX_LEAD_DAYS - 1)) // hôm nay + 90 ngày
  })()
  // viền đỏ mục đang lỗi
  const ring = (field) => (errorField === field ? 'ring-4 ring-[#FF4B4B]/40 border-[#FF4B4B]' : '')
  const customerSummaryReady = isAuthenticated && customerInfo.fullName && customerInfo.phone && customerInfo.cccd && customerInfo.email

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

          {/* Section 1 (họp nhóm 05/11/2026): chọn ngày nhận kho trước tiên */}
          <div id="sec-start" className={`duo-card p-6 ${ring('sec-start')}`}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-2xl bg-[#CE82FF] border-b-2 border-[#A568CC] flex items-center justify-center text-white text-xs font-black">
                1
              </div>
              <span className="text-base font-black text-[#4B4B4B]">Ngày bắt đầu nhận kho <span className="text-[#FF4B4B]">*</span></span>
            </div>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#AFAFAF] text-[20px]">
                calendar_month
              </span>
              <input
                type="date"
                value={startDate}
                min={minStartDate}
                max={maxStartDate}
                onChange={(e) => { setStartDate(e.target.value); if (errorField === 'sec-start') setErrorField('') }}
                className="duo-input w-full pl-11"
              />
            </div>
            {/* D-18: số ô trống suốt thời gian thuê đã chọn (đổi ngày / gói là tính lại) */}
            {range && (
              <p className={`text-xs font-black mt-2 flex items-start gap-1.5 ${range.available ? 'text-[#58A700]' : 'text-[#FF4B4B]'}`}>
                <span className="material-symbols-outlined text-[16px]">{range.available ? 'event_available' : 'event_busy'}</span>
                <span>{range.message}</span>
              </p>
            )}
            {availableFrom && (
              <p className="text-xs font-bold text-[#1899D6] mt-2">
                Loại kho này đang hết ô trống — quý khách đặt trước ô sắp được trả, nhận kho từ ngày {availableFrom.split('-').reverse().join('/')}.
                Nếu tới ngày nhận cơ sở chưa bàn giao được ô, quý khách được huỷ và hoàn 100%.
              </p>
            )}
            <p className="text-xs font-bold text-[#AFAFAF] mt-2">
              🕐 Đặt trước tối đa {MAX_LEAD_DAYS} ngày · hỗ trợ dời ngày nhận tối đa 3 ngày trước khi kích hoạt không phụ phí.
            </p>
          </div>

          {/* Section 2: Thông tin khoang kho */}
          <div className="duo-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-2xl bg-[#58CC02] border-b-2 border-[#58A700] flex items-center justify-center text-white text-xs font-black">
                  2
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
                    {range ? `Còn ${range.freeSlots} ô cho thời gian đã chọn` : `Còn ${unit.availableCount} ô trống`}
                  </span>
                  <span className="text-[11px] font-black uppercase bg-[#F3E5FF] border border-[#CE82FF] text-[#A568CC] px-2 py-0.5 rounded-full">
                    {TEMPERATURE_LABELS[unit.temperatureClass] || 'Kho thường'}
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

          {/* Section 3: Thời hạn thuê */}
          <div className="duo-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-2xl bg-[#1CB0F6] border-b-2 border-[#1899D6] flex items-center justify-center text-white text-xs font-black">
                  3
                </div>
                <span className="text-base font-black text-[#4B4B4B]">Thời hạn thuê & Bảo hiểm</span>
              </div>
              <span className="text-xs font-black uppercase text-[#1CB0F6] bg-[#DDF4FF] border-2 border-[#84D8FF] px-3 py-1 rounded-full">
                Linh hoạt gia hạn
              </span>
            </div>

            <p className="text-xs font-black text-[#AFAFAF] uppercase tracking-wider mb-3">
              Thời hạn cam kết thuê tối thiểu
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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

            {/* BR-125: gói bảo hiểm hàng hoá */}
            <div className="mt-6 pt-5 border-t-2 border-[#E5E5E5] flex flex-col gap-3">
              <div>
                <p className="text-sm font-black text-[#4B4B4B] flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[20px] text-[#1CB0F6]">verified_user</span>
                  Bảo hiểm hàng hoá
                </p>
                <p className="text-[11px] font-bold text-[#AFAFAF]">
                  Hàng hư / mất do lỗi kho được bồi thường tới mức trần. Gói có bảo hiểm còn được bồi thường cả khi gặp thiên tai, hoả hoạn từ bên ngoài.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {insurancePlans.map((p) => (
                  <button
                    key={p.code}
                    type="button"
                    onClick={() => setInsurancePlan(p.code)}
                    className={`rounded-2xl border-2 px-4 py-3 text-left ${
                      insurancePlan === p.code ? 'bg-[#DDF4FF] border-[#1CB0F6]' : 'bg-white border-[#E5E5E5] hover:bg-[#F7F7F7]'
                    }`}
                  >
                    <span className="block text-xs font-black text-[#4B4B4B]">{p.label}</span>
                    <span className="block text-sm font-black text-[#1CB0F6]">
                      {Number(p.monthlyPremium) > 0 ? `${formatVND(Number(p.monthlyPremium))}/tháng` : 'Miễn phí'}
                    </span>
                    <span className="block text-[10px] font-bold text-[#AFAFAF]">
                      Trần {formatVND(Number(p.coverageLimit))}{p.insured ? ' · có bảo hiểm' : ' · cơ sở tự chịu'}
                    </span>
                  </button>
                ))}
              </div>
              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] font-black uppercase text-[#AFAFAF]">Giá trị hàng gửi kho (khai báo, tuỳ chọn)</span>
                <input
                  type="number"
                  min="0"
                  step="100000"
                  value={declaredValue}
                  onChange={(e) => setDeclaredValue(e.target.value)}
                  placeholder="VD: 30000000"
                  className="duo-input"
                />
                <span className="text-[11px] font-bold text-[#777777]">
                  Trần bồi thường của bạn: <strong className="text-[#1CB0F6]">{formatVND(coverageCap)}</strong>
                  {declaredNumber > 0 ? '' : ` — không khai báo giá trị chỉ được tối đa ${formatVND(Math.min(NO_DECLARATION_CAP, Number(selectedPlan.coverageLimit)))}`}
                </span>
              </label>
            </div>
          </div>

          {/* Section 4 — BR-131: loại hàng gửi kho (Staff đối chiếu lúc nhận kho) */}
          <div id="sec-goods" className={`duo-card p-6 ${ring('sec-goods')}`}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-2xl bg-[#FFC800] border-b-2 border-[#E5A800] flex items-center justify-center text-white text-xs font-black">
                4
              </div>
              <span className="text-base font-black text-[#4B4B4B]">Loại hàng gửi kho <span className="text-[#FF4B4B]">*</span></span>
            </div>
            <GoodsCategoryDropdown
              categories={goodsCategories}
              value={goodsCodes}
              onChange={setGoodsCodes}
              temperatureClass={unit.temperatureClass}
            />
            {goodsCategories.length === 0 && (
              <p className="text-[11px] font-bold text-[#FF4B4B] mt-2">Chưa tải được danh mục loại hàng, vui lòng tải lại trang.</p>
            )}
            {(needsGoodsNote || goodsDescription) && (
              <label className="flex flex-col gap-1.5 mt-3">
                <span className="text-[11px] font-black uppercase text-[#AFAFAF]">
                  Mô tả hàng {needsGoodsNote && <span className="text-[#FF4B4B]">*</span>}
                </span>
                <input
                  type="text"
                  maxLength={500}
                  value={goodsDescription}
                  onChange={(e) => setGoodsDescription(e.target.value)}
                  placeholder="VD: dụng cụ câu cá, đồ thể thao..."
                  className="duo-input"
                />
              </label>
            )}
            <p className="text-[11px] font-bold text-[#777777] mt-3">
              Nhân viên sẽ kiểm tra hàng khi bạn nhận kho: hàng phải khớp loại đã khai báo, không có chất dễ cháy nổ, hàng cấm.
              {unit.temperatureClass === 'NORMAL' && ' Thực phẩm chỉ gửi được ở kho lạnh / kho đông.'}
            </p>
          </div>

          {/* Section 5: Thông tin khách hàng */}
          <div id="sec-customer" className={`duo-card p-6 ${ring('sec-customer')}`}>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-2xl bg-[#FF9600] border-b-2 border-[#E58800] flex items-center justify-center text-white text-xs font-black">
                  5
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

            {/* (08/11/2026) Đã có thông tin trong tài khoản → 1 dòng tóm tắt, bấm Sửa mới mở form */}
            {customerSummaryReady && !editCustomer && (
              <div className="flex items-center justify-between gap-3 rounded-2xl border-2 border-[#E5E5E5] bg-[#F7F7F7] px-4 py-3 mb-4">
                <div className="min-w-0 text-xs font-bold text-[#4B4B4B]">
                  <p className="font-black truncate">{customerInfo.fullName}</p>
                  <p className="text-[#777777] truncate">
                    {customerInfo.phone} · {customerInfo.email} · CCCD ••••{String(customerInfo.cccd).slice(-4)}
                  </p>
                </div>
                <button type="button" onClick={() => setEditCustomer(true)} className="duo-btn-white px-3 py-1.5 text-[11px] shrink-0">
                  <span className="material-symbols-outlined text-[16px] mr-0.5">edit</span>Sửa
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className={customerSummaryReady && !editCustomer ? 'hidden' : ''}>
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

              <div className={customerSummaryReady && !editCustomer ? 'hidden' : ''}>
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

              <div className={customerSummaryReady && !editCustomer ? 'hidden' : ''}>
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

              <div className={customerSummaryReady && !editCustomer ? 'hidden' : ''}>
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
            <div id="sec-commit" className={`flex items-start gap-3 mt-4 pt-4 border-t-2 border-[#E5E5E5] rounded-xl ${errorField === 'sec-commit' ? 'ring-4 ring-[#FF4B4B]/40' : ''}`}>
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

            {/* Checkbox điều khoản xử lý tài sản khi không trả kho (v4: chuyển hàng vào kho tổng, không bán) */}
            <div className="flex items-start gap-3 mt-3">
              <input
                type="checkbox"
                id="termsAccepted"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-1 w-5 h-5 accent-[#58CC02] cursor-pointer"
              />
              <label htmlFor="termsAccepted" className="text-xs font-bold text-[#4B4B4B] cursor-pointer leading-relaxed">
                Tôi đã đọc và đồng ý{' '}
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); setTermsOpen(true) }}
                  className="font-black text-[#1CB0F6] underline cursor-pointer"
                >
                  Điều khoản xử lý tài sản khi không trả kho
                </button>
                .
                <details className="mt-1 text-[11px] text-[#777777]">
                  <summary className="cursor-pointer font-black text-[#AFAFAF]">Tóm tắt</summary>
                  Hết hạn mà không gia hạn / không trả kho, hôm sau hợp đồng bị thanh lý và hàng được{' '}
                  <span className="font-black text-[#FF4B4B]">chuyển vào kho tổng, tính phí lưu giữ mỗi ngày</span>{' '}
                  (QueenKho không bán hàng của bạn).
                </details>
              </label>
            </div>
            <AssetTermsModal
              open={termsOpen}
              onClose={() => setTermsOpen(false)}
              onAccept={() => { setTermsAccepted(true); setTermsOpen(false) }}
            />
          </div>

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

              {insuranceTotal > 0 && (
                <div className="flex justify-between items-center text-xs font-bold">
                  <span className="text-[#4B4B4B]">
                    Bảo hiểm {selectedPlan.label} ({formatVND(Number(selectedPlan.monthlyPremium))} × {selectedMonths})
                  </span>
                  <span className="font-black text-[#4B4B4B]">{formatVND(insuranceTotal)}</span>
                </div>
              )}

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
                    disabled={voucherChecking}
                    className="duo-btn-white px-3 py-2 text-xs tracking-wider shrink-0 disabled:opacity-50"
                  >
                    {voucherChecking ? 'ĐANG KIỂM TRA...' : 'ÁP DỤNG'}
                  </button>
                </div>
                {voucherError && (
                  <p className="text-[11px] font-bold text-[#FF4B4B]">⚠️ {voucherError}</p>
                )}
                <p className="text-[10px] font-bold text-[#AFAFAF]">Mỗi đơn áp 1 mã, không cộng dồn. Mã do bạn nhập sẽ thay ưu đãi mặc định.</p>
              </div>

              {/* Dòng voucher đang áp dụng */}
              {voucherApplied.code && (
                <div className="flex justify-between items-center gap-2 text-xs font-bold text-[#58A700] bg-[#D7FFB8] px-3 py-1.5 rounded-xl border border-[#58CC02]">
                  <span className="min-w-0 truncate" title={voucherApplied.name}>
                    🎫 Voucher <span className="font-black">{voucherApplied.code}</span>
                    {customVoucherCode && (
                      <button
                        type="button"
                        onClick={handleRemoveVoucher}
                        className="ml-2 text-[10px] font-black uppercase text-[#FF4B4B] hover:underline cursor-pointer"
                      >
                        Bỏ mã
                      </button>
                    )}
                  </span>
                  <span className="font-black shrink-0">-{formatVND(voucherApplied.discount)}</span>
                </div>
              )}

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

              <details className="rounded-2xl border-2 border-[#84D8FF] bg-[#DDF4FF] p-3 text-[10px] font-bold leading-relaxed text-[#4B4B4B]">
                <summary className="cursor-pointer text-[11px] font-black uppercase text-[#1899D6]">Chính sách hủy trước check-in</summary>
                <p>• Còn từ 48 giờ: hoàn 100%.</p>
                <p>• Còn từ 24 đến dưới 48 giờ: giữ 50% cọc.</p>
                <p>• Còn dưới 24 giờ: giữ 100% cọc.</p>
                <p>• Đã qua giờ hẹn mà chưa nhận kho: giữ cọc + 1 tháng tiền thuê.</p>
                <p className="mt-1 text-[#777777]">Hủy trong 30 phút sau khi thanh toán (và vẫn trước giờ hẹn) luôn được hoàn 100%.</p>
              </details>

              {/* (08/11/2026, góp ý test) lỗi hiện ngay trên nút thanh toán, không phải cuộn xuống cuối trang */}
              {error && (
                <div className="rounded-2xl border-2 border-b-4 border-[#FFDFDF] bg-[#FFF5F5] text-[#FF4B4B] text-xs font-black p-3 flex flex-col gap-2.5">
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
