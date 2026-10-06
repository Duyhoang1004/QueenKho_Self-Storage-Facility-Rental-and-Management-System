import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { createReservation } from '../../services/reservationService'
import { createVnpayPayment } from '../../services/vnpayService'
import { getFacilityAvailability } from '../../services/facilityService'

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
    availableCount: slot.availableCount,
    branch: facility.name,
    address: facility.address,
    hotline: facility.hotline,
  }
}

const DURATION_OPTIONS = [
  { months: 1, label: '1 ThÃ¡ng', sub: 'TiÃªu chuáº©n', note: 'GiÃ¡ chuáº©n', discount: 0 },
  { months: 3, label: '3 ThÃ¡ng', sub: 'Phá»• biáº¿n nháº¥t', note: 'Tiáº¿t kiá»‡m 5%', discount: 5, popular: true },
  { months: 6, label: '6 ThÃ¡ng', sub: 'Trung háº¡n', note: 'Tiáº¿t kiá»‡m 10%', discount: 10 },
  { months: 12, label: '12 ThÃ¡ng', sub: 'DÃ i háº¡n', note: 'Tiáº¿t kiá»‡m 15%', discount: 15 },
]

const VOUCHER_DISCOUNT = 100000

function formatVND(amount) {
  return amount.toLocaleString('vi-VN') + 'Ä‘'
}

// Map mÃ£ voucher â†’ giÃ¡ trá»‹ giáº£m
const VOUCHER_MAP = {
  NEWKHO: 100000,
  WELCOME50: 50000,
  SAVE200: 200000,
}

export default function CreateReservationPage() {
  const [searchParams] = useSearchParams()
  const facilityId = Number(searchParams.get('facilityId'))
  const unitTypeId = Number(searchParams.get('unitTypeId'))
  const hasParams = facilityId > 0 && unitTypeId > 0

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

  const handleApplyVoucher = () => {
    const code = voucherCode.trim().toUpperCase()
    if (!code) return
    const discount = VOUCHER_MAP[code]
    if (discount) {
      setVoucherApplied({ code, discount })
      setVoucherError('')
      setVoucherCode('')
    } else {
      setVoucherError('MÃ£ voucher khÃ´ng há»£p lá»‡ hoáº·c Ä‘Ã£ háº¿t háº¡n.')
    }
  }

  const sessionUser = JSON.parse(sessionStorage.getItem('user') || '{}')
  const [customerInfo, setCustomerInfo] = useState({
    fullName: sessionUser.fullName || '',
    phone: '',
    cccd: '',
    email: sessionUser.email || '',
    address: '',
  })

  useEffect(() => {
    if (!hasParams) return

    let cancelled = false
    getFacilityAvailability(facilityId)
      .then((data) => {
        if (cancelled) return
        const found = buildUnit(data, unitTypeId)
        if (found) setUnit(found)
        else setUnitError('CÆ¡ sá»Ÿ nÃ y khÃ´ng cÃ³ loáº¡i kho báº¡n Ä‘Ã£ chá»n.')
      })
      .catch(() => {
        if (!cancelled) setUnitError('KhÃ´ng táº£i Ä‘Æ°á»£c thÃ´ng tin kho. Vui lÃ²ng thá»­ láº¡i.')
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
      setError('Thanh toÃ¡n tháº¥t báº¡i hoáº·c Ä‘Ã£ bá»‹ há»§y. Vui lÃ²ng thá»­ láº¡i.')
    }
  }, [])

  if (!hasParams || unitLoading || unitError || !unit) {
    const message = !hasParams
      ? 'Báº¡n chÆ°a chá»n kho. Vui lÃ²ng chá»n cÆ¡ sá»Ÿ vÃ  loáº¡i kho trÆ°á»›c khi Ä‘áº·t chá»—.'
      : unitLoading
        ? 'Äang táº£i thÃ´ng tin kho...'
        : unitError || 'KhÃ´ng tÃ¬m tháº¥y thÃ´ng tin kho.'
    return (
      <div className="p-8 max-w-3xl mx-auto flex flex-col items-center gap-4 text-center">
        <p className={`font-black ${unitLoading ? 'text-[#AFAFAF]' : 'text-[#FF4B4B]'}`}>{message}</p>
        {!unitLoading && (
          <Link
            to="/tim-va-dat-kho"
            className="duo-btn-green px-6 py-3 text-xs tracking-wider"
          >
            TÃŒM & CHá»ŒN KHO
          </Link>
        )}
      </div>
    )
  }

  const selectedOption = DURATION_OPTIONS.find(o => o.months === selectedMonths)
  const baseTotal = unit.pricePerMonth * selectedMonths
  const discountAmount = Math.round(baseTotal * (selectedOption.discount / 100))
  const netRent = baseTotal - discountAmount
  const deposit = unit.pricePerMonth
  const totalPayment = netRent + deposit - voucherApplied.discount

  const handleSubmit = async () => {
    if (!agreed) {
      setError('Báº¡n cáº§n Ä‘á»“ng Ã½ vá»›i cam káº¿t lÆ°u trá»¯ trÆ°á»›c khi tiáº¿p tá»¥c.')
      return
    }
    if (!startDate) {
      setError('Vui lÃ²ng chá»n ngÃ y báº¯t Ä‘áº§u nháº­n kho.')
      return
    }
    if (!customerInfo.fullName || !customerInfo.phone || !customerInfo.cccd || !customerInfo.email || !customerInfo.address) {
      setError('Vui lÃ²ng Ä‘iá»n Ä‘áº§y Ä‘á»§ thÃ´ng tin khÃ¡ch hÃ ng.')
      return
    }

    try {
      setLoading(true)
      setError('')
      const response = await createReservation({
        customerId: sessionUser.userId ?? 1,
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
      setError(err.response?.data?.detail || err.response?.data?.message || 'CÃ³ lá»—i xáº£y ra. Vui lÃ²ng thá»­ láº¡i.')
      setLoading(false)
    }
  }

  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0]

  return (
    <div className="max-w-[1100px] mx-auto px-6 py-8 select-none">
      {/* TiÃªu Ä‘á» trang */}
      <div className="mb-6">
        <h1 className="text-3xl font-black text-[#4B4B4B] tracking-tight">
          HoÃ n táº¥t Ä‘áº·t chá»— & Há»£p Ä‘á»“ng
        </h1>
        <p className="text-xs font-bold text-[#AFAFAF] mt-1 uppercase tracking-wider">
          XÃ¡c nháº­n thÃ´ng tin há»£p Ä‘á»“ng Ä‘iá»‡n tá»­ vÃ  tiáº¿p tá»¥c thanh toÃ¡n giá»¯ chá»—.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">

        {/* Cá»™t trÃ¡i */}
        <div className="flex flex-col gap-6">

          {/* Section 1: ThÃ´ng tin khoang kho */}
          <div className="duo-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-2xl bg-[#58CC02] border-b-2 border-[#58A700] flex items-center justify-center text-white text-xs font-black">
                  1
                </div>
                <span className="text-base font-black text-[#4B4B4B]">ThÃ´ng tin khoang kho</span>
              </div>
              <span className="text-xs font-black uppercase text-[#58A700] bg-[#D7FFB8] border-2 border-[#58CC02] px-3 py-1 rounded-full">
                Tá»± quáº£n 24/7
              </span>
            </div>

            <div className="flex items-start gap-4 bg-[#F7F7F7] border-2 border-[#E5E5E5] rounded-2xl p-4">
              <div className="w-12 h-12 rounded-2xl bg-[#58CC02] border-b-2 border-[#58A700] flex items-center justify-center text-white flex-shrink-0">
                <span className="material-symbols-outlined text-[24px]">warehouse</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-base font-black text-[#4B4B4B]">
                    {unit.name} ({unit.area} mÂ²)
                  </span>
                  <span className="text-[11px] font-black uppercase bg-[#DDF4FF] border border-[#84D8FF] text-[#1CB0F6] px-2 py-0.5 rounded-full">
                    CÃ²n {unit.availableCount} Ã´ trá»‘ng
                  </span>
                </div>
                <p className="text-xs font-bold text-[#AFAFAF] mt-1">
                  Chi nhÃ¡nh: {unit.branch} ({unit.address})
                </p>
                <p className="text-xs font-bold text-[#AFAFAF]">
                  KÃ­ch thÆ°á»›c: {unit.dimension}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-[11px] font-black text-[#AFAFAF] uppercase">ÄÆ¡n giÃ¡ chuáº©n:</div>
                <div className="text-base font-black text-[#58CC02]">
                  {formatVND(unit.pricePerMonth)}
                  <span className="text-xs text-[#AFAFAF]">/th</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Thá»i háº¡n thuÃª */}
          <div className="duo-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-2xl bg-[#1CB0F6] border-b-2 border-[#1899D6] flex items-center justify-center text-white text-xs font-black">
                  2
                </div>
                <span className="text-base font-black text-[#4B4B4B]">Thá»i háº¡n thuÃª & NgÃ y nháº­n kho</span>
              </div>
              <span className="text-xs font-black uppercase text-[#1CB0F6] bg-[#DDF4FF] border-2 border-[#84D8FF] px-3 py-1 rounded-full">
                Linh hoáº¡t gia háº¡n
              </span>
            </div>

            <p className="text-xs font-black text-[#AFAFAF] uppercase tracking-wider mb-3">
              Thá»i háº¡n cam káº¿t thuÃª tá»‘i thiá»ƒu
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              {DURATION_OPTIONS.map((opt) => (
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
                      Tiáº¿t kiá»‡m 5%
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
                      Giáº£m {formatVND(Math.round(unit.pricePerMonth * opt.months * opt.discount / 100))}
                    </div>
                  )}
                </button>
              ))}
            </div>

            <div>
              <label className="text-xs font-black uppercase tracking-wider text-[#777777] mb-2 block">
                NgÃ y báº¯t Ä‘áº§u nháº­n kho <span className="text-[#FF4B4B]">*</span>
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
                ðŸ• Há»— trá»£ dá»i ngÃ y nháº­n tá»‘i Ä‘a 3 ngÃ y trÆ°á»›c khi kÃ­ch hoáº¡t khÃ´ng phá»¥ phÃ­.
              </p>
            </div>
          </div>

          {/* Section 3: ThÃ´ng tin khÃ¡ch hÃ ng */}
          <div className="duo-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-2xl bg-[#FF9600] border-b-2 border-[#E58800] flex items-center justify-center text-white text-xs font-black">
                  3
                </div>
                <span className="text-base font-black text-[#4B4B4B]">ThÃ´ng tin khÃ¡ch hÃ ng</span>
              </div>
              <span className="text-xs font-black text-[#FF4B4B] uppercase tracking-wider">* Báº¯t buá»™c</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-black uppercase tracking-wider text-[#777777] mb-1 block">
                  Há» vÃ  TÃªn cÃ¡ nhÃ¢n / Doanh nghiá»‡p <span className="text-[#FF4B4B]">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Nguyá»…n Thu Trang"
                  value={customerInfo.fullName}
                  onChange={(e) => setCustomerInfo({ ...customerInfo, fullName: e.target.value })}
                  className="duo-input w-full"
                />
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-wider text-[#777777] mb-1 block">
                  Sá»‘ Ä‘iá»‡n thoáº¡i / Zalo <span className="text-[#FF4B4B]">*</span>
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
                  Sá»‘ CCCD / Passport <span className="text-[#FF4B4B]">*</span>
                </label>
                <input
                  type="text"
                  placeholder="07919800xxxx"
                  value={customerInfo.cccd}
                  onChange={(e) => setCustomerInfo({ ...customerInfo, cccd: e.target.value })}
                  className="duo-input w-full"
                />
                <p className="text-[11px] font-bold text-[#AFAFAF] mt-1">
                  Cáº¥p quyá»n má»Ÿ khÃ³a SmartLock Ä‘iá»‡n tá»­
                </p>
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-wider text-[#777777] mb-1 block">
                  Email nháº­n há»£p Ä‘á»“ng & hÃ³a Ä‘Æ¡n <span className="text-[#FF4B4B]">*</span>
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
                  Äá»‹a chá»‰ thÆ°á»ng trÃº / Trá»¥ sá»Ÿ ghi nháº­n há»£p Ä‘á»“ng <span className="text-[#FF4B4B]">*</span>
                </label>
                <input
                  type="text"
                  placeholder="PhÆ°á»ng 13, Quáº­n TÃ¢n BÃ¬nh, TP. Há»“ ChÃ­ Minh"
                  value={customerInfo.address}
                  onChange={(e) => setCustomerInfo({ ...customerInfo, address: e.target.value })}
                  className="duo-input w-full"
                />
              </div>
            </div>

            {/* Checkbox cam káº¿t */}
            <div className="flex items-start gap-3 mt-4 pt-4 border-t-2 border-[#E5E5E5]">
              <input
                type="checkbox"
                id="agreed"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-1 w-5 h-5 accent-[#58CC02] cursor-pointer"
              />
              <label htmlFor="agreed" className="text-xs font-bold text-[#4B4B4B] cursor-pointer leading-relaxed">
                TÃ´i cam káº¿t{' '}
                <span className="font-black text-[#FF4B4B]">
                  khÃ´ng lÆ°u trá»¯ cháº¥t dá»… chÃ¡y ná»•, hÃ ng láº­u, hÃ³a cháº¥t Ä‘á»™c háº¡i hoáº·c hÃ ng cáº¥m
                </span>{' '}
                theo quy Ä‘á»‹nh cá»§a phÃ¡p luáº­t vÃ  ná»™i quy QueenKho.
              </label>
            </div>
          </div>

          {error && (
            <div className="rounded-2xl border-2 border-b-4 border-[#FFDFDF] bg-[#FFF5F5] text-[#FF4B4B] text-xs font-black p-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Cá»™t pháº£i - Chi tiáº¿t thanh toÃ¡n Duolingo Card */}
        <div className="lg:sticky lg:top-24 h-fit">
          <div className="duo-card overflow-hidden">
            {/* Header Duolingo Green */}
            <div className="bg-[#58CC02] border-b-4 border-[#58A700] px-6 py-5 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-base font-black uppercase tracking-wider">Chi Tiáº¿t Thanh ToÃ¡n</p>
                  <p className="text-xs font-bold text-emerald-100 mt-0.5">
                    MÃ£ Ä‘Æ¡n sáº½ cáº¥p ngay sau khi giá»¯ chá»—
                  </p>
                </div>
                <span className="material-symbols-outlined text-white text-[24px]">receipt_long</span>
              </div>
            </div>

            {/* Breakdown giÃ¡ */}
            <div className="p-6 flex flex-col gap-3.5 bg-white">
              <div className="flex justify-between items-start text-xs font-bold">
                <div>
                  <p className="text-[#4B4B4B]">Tiá»n thuÃª ({selectedMonths} thÃ¡ng)</p>
                  <p className="text-[#AFAFAF]">{formatVND(unit.pricePerMonth)} Ã— {selectedMonths}</p>
                </div>
                <span className="font-black text-[#4B4B4B]">{formatVND(baseTotal)}</span>
              </div>

              {selectedOption.discount > 0 && (
                <div className="flex justify-between items-center text-xs font-bold text-[#58A700] bg-[#D7FFB8] px-3 py-1.5 rounded-xl border border-[#58CC02]">
                  <span>Æ¯u Ä‘Ã£i gÃ³i {selectedMonths}T (-{selectedOption.discount}%)</span>
                  <span className="font-black">-{formatVND(discountAmount)}</span>
                </div>
              )}

              <div className="flex justify-between items-center text-xs font-bold pt-1">
                <span className="text-[#4B4B4B]">Tiá»n cá»c hoÃ n tráº£ 100%</span>
                <span className="font-black text-[#4B4B4B]">{formatVND(deposit)}</span>
              </div>

              {/* Voucher input */}
              <div className="flex flex-col gap-1.5">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Nháº­p mÃ£ voucher..."
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
                    ÃP Dá»¤NG
                  </button>
                </div>
                {voucherError && (
                  <p className="text-[11px] font-bold text-[#FF4B4B]">âš ï¸ {voucherError}</p>
                )}
              </div>

              {/* DÃ²ng voucher Ä‘ang Ã¡p dá»¥ng */}
              <div className="flex justify-between items-center text-xs font-bold text-[#58A700] bg-[#D7FFB8] px-3 py-1.5 rounded-xl border border-[#58CC02]">
                <span>ðŸŽ« Voucher <span className="font-black">{voucherApplied.code}</span></span>
                <span className="font-black">-{formatVND(voucherApplied.discount)}</span>
              </div>

              {/* Tá»•ng tiá»n */}
              <div className="border-t-2 border-[#E5E5E5] pt-4 mt-1">
                <p className="text-xs font-black uppercase tracking-wider text-[#AFAFAF]">
                  Tá»”NG Cá»˜NG THANH TOÃN Äá»¢T 1
                </p>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-2xl font-black text-[#58CC02]">
                    {formatVND(totalPayment)}
                  </span>
                  {selectedOption.discount > 0 && (
                    <span className="text-[11px] font-black uppercase bg-[#D7FFB8] text-[#58A700] px-2.5 py-0.5 rounded-full border border-[#58CC02]">
                      Tiáº¿t kiá»‡m {formatVND(discountAmount + voucherApplied.discount)}
                    </span>
                  )}
                </div>
              </div>

              {/* LÆ°u Ã½ 10 phÃºt */}
              <div className="bg-[#FFE8CC] border-2 border-b-4 border-[#FF9600] rounded-2xl p-3.5 text-xs font-bold text-[#E58800] mt-2">
                <span className="font-black">âš¡ LÆ°u Ã½ giá»¯ chá»—:</span> QuÃ©t mÃ£ QR thanh toÃ¡n trong vÃ²ng <strong>10 phÃºt</strong>.
              </div>

              {/* Giant Green CTA Button */}
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="duo-btn-green w-full py-4 text-sm tracking-wider mt-2 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px] mr-1">lock</span>
                <span>{loading ? 'Äang chuyá»ƒn sang SePay...' : 'THANH TOÃN GIá»® KHO'}</span>
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
