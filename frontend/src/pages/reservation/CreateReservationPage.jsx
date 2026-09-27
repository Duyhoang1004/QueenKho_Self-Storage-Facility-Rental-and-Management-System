import { useState, useEffect } from 'react'
import { createReservation } from '../../services/reservationService'
import { createSepayPayment } from '../../services/sepayService'

// Du lieu mock - thay bang API that sau khi UC-09 hoan thanh
const MOCK_UNIT = {
  code: 'TB-104',
  name: 'Khoang TiÃªu Chuáº©n',
  area: 6.0,
  floor: 'Táº§ng trá»‡t',
  branch: 'QueenKho TÃ¢n BÃ¬nh',
  address: '142 Cá»™ng HÃ²a, P.13',
  dimension: '2.5m Ã— 2.4m Ã— 2.7m (Thá»ƒ tÃ­ch 16.2 mÂ³)',
  pricePerMonth: 1850000,
  facilityId: 1,
  unitTypeId: 1,
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

export default function CreateReservationPage() {
  const [selectedMonths, setSelectedMonths] = useState(3)
  const [startDate, setStartDate] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Pre-fill thong tin khach hang tu session dang nhap
  const sessionUser = JSON.parse(sessionStorage.getItem('user') || '{}')
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

    const paymentResult = new URLSearchParams(window.location.search).get('payment')
    if (paymentResult === 'failed') {
      setError('Thanh toÃ¡n tháº¥t báº¡i hoáº·c Ä‘Ã£ bá»‹ há»§y. Vui lÃ²ng thá»­ láº¡i.')
    }
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
        customerId: sessionUser.userId ?? 1,   // Fallback id=1 khi chua dang nhap (test)
        facilityId: MOCK_UNIT.facilityId,
        unitTypeId: MOCK_UNIT.unitTypeId,
        startDate,
        durationMonths: selectedMonths,
      })
      const payment = await createSepayPayment(response.id)
      sessionStorage.setItem('queenkhoPaymentContext', JSON.stringify({
        reservation: response,
        customerInfo,
        selectedMonths,
        startDate,
        totalPayment: Number(payment.amount || totalPayment),
        deposit: Number(payment.depositAmount || deposit),
        storage: MOCK_UNIT,
      }))
      window.location.href = payment.payUrl
    } catch (err) {
      setError(err.response?.data?.detail || err.response?.data?.message || 'CÃ³ lá»—i xáº£y ra. Vui lÃ²ng thá»­ láº¡i.')
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
          HoÃ n Táº¥t Äáº·t Chá»— & Khai BÃ¡o ThÃ´ng Tin
        </h1>
        <p className="text-body-md font-body-md text-on-surface-variant mt-1">
          XÃ¡c nháº­n thÃ´ng tin há»£p Ä‘á»“ng Ä‘iá»‡n tá»­ vÃ  tiáº¿p tá»¥c thanh toÃ¡n Ä‘áº·t kho.
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
                <span className="text-title-md font-title-md text-on-surface">ThÃ´ng tin Ä‘áº·t kho</span>
              </div>
              <span className="text-label-md font-label-md text-[#10B981] bg-[#ECFDF5] px-2.5 py-1 rounded-full">
                Khoang tá»± quáº£n 24/7
              </span>
            </div>

            <div className="flex items-start gap-4 bg-surface-container-low rounded-xl p-4">
              <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-on-primary text-[22px]">warehouse</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-title-md font-title-md text-on-surface">
                    {MOCK_UNIT.name} ({MOCK_UNIT.area} mÂ²)
                  </span>
                  <span className="text-label-sm font-label-sm bg-secondary-fixed text-on-secondary-fixed-variant px-2 py-0.5 rounded-full">
                    {MOCK_UNIT.floor}
                  </span>
                </div>
                <p className="text-body-sm font-body-sm text-on-surface-variant mt-1">
                  Chi nhÃ¡nh: {MOCK_UNIT.branch} ({MOCK_UNIT.address})
                </p>
                <p className="text-body-sm font-body-sm text-on-surface-variant">
                  KÃ­ch thÆ°á»›c: {MOCK_UNIT.dimension}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-label-sm font-label-sm text-on-surface-variant mb-0.5">ÄÆ¡n giÃ¡ chuáº©n:</div>
                <div className="text-title-md font-title-md text-on-surface">
                  {formatVND(MOCK_UNIT.pricePerMonth)}
                  <span className="text-body-sm text-on-surface-variant">/thÃ¡ng</span>
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
                <span className="text-title-md font-title-md text-on-surface">Thá»i háº¡n thuÃª & NgÃ y nháº­n kho</span>
              </div>
              <span className="text-label-md font-label-md text-secondary bg-secondary-fixed px-2.5 py-1 rounded-full">
                Linh hoáº¡t gia háº¡n
              </span>
            </div>

            <p className="text-label-md font-label-md text-on-surface-variant uppercase tracking-wider mb-3">
              Thá»i háº¡n cam káº¿t thuÃª tá»‘i thiá»ƒu
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
                      Giáº£m 5%
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
                      Tiáº¿t kiá»‡m {formatVND(Math.round(MOCK_UNIT.pricePerMonth * opt.months * opt.discount / 100))}
                    </div>
                  )}
                </button>
              ))}
            </div>

            <div>
              <label className="text-body-md font-body-md text-on-surface mb-2 block">
                NgÃ y báº¯t Ä‘áº§u nháº­n kho <span className="text-error">*</span>
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
                ðŸ• Há»— trá»£ dá»i ngÃ y nháº­n tá»‘i Ä‘a 3 ngÃ y trÆ°á»›c khi kÃ­ch hoáº¡t khÃ´ng phá»¥ phÃ­.
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
                <span className="text-title-md font-title-md text-on-surface">ThÃ´ng tin khÃ¡ch hÃ ng</span>
              </div>
              <span className="text-label-sm font-label-sm text-error">* Báº¯t buá»™c cho há»£p Ä‘á»“ng Ä‘iá»‡n tá»­</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-body-sm font-body-sm text-on-surface-variant mb-1.5 block">
                  Há» vÃ  TÃªn cÃ¡ nhÃ¢n / Doanh nghiá»‡p <span className="text-error">*</span>
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">person</span>
                  <input
                    type="text"
                    placeholder="Nguyá»…n Thu Trang"
                    value={customerInfo.fullName}
                    onChange={(e) => setCustomerInfo({ ...customerInfo, fullName: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 border border-outline-variant rounded-xl text-body-md font-body-md text-on-surface focus:outline-none focus:border-secondary"
                  />
                </div>
              </div>

              <div>
                <label className="text-body-sm font-body-sm text-on-surface-variant mb-1.5 block">
                  Sá»‘ Ä‘iá»‡n thoáº¡i / Zalo <span className="text-error">*</span>
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
                  Sá»‘ CCCD / Passport <span className="text-error">*</span>
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
                  Cáº¥p quyá»n má»Ÿ khÃ³a SmartLock Ä‘iá»‡n tá»­
                </p>
              </div>

              <div>
                <label className="text-body-sm font-body-sm text-on-surface-variant mb-1.5 block">
                  Email nháº­n há»£p Ä‘á»“ng & hÃ³a Ä‘Æ¡n <span className="text-error">*</span>
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
                  Äá»‹a chá»‰ thÆ°á»ng trÃº / Trá»¥ sá»Ÿ ghi nháº­n há»£p Ä‘á»“ng <span className="text-error">*</span>
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">location_on</span>
                  <input
                    type="text"
                    placeholder="PhÆ°á»ng 13, Quáº­n TÃ¢n BÃ¬nh, TP. Há»“ ChÃ­ Minh"
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
                TÃ´i cam káº¿t{' '}
                <span className="font-semibold text-error">
                  khÃ´ng lÆ°u trá»¯ cháº¥t dá»… chÃ¡y ná»•, hÃ ng láº­u, hÃ³a cháº¥t Ä‘á»™c háº¡i hoáº·c hÃ ng cáº¥m
                </span>{' '}
                theo quy Ä‘á»‹nh cá»§a phÃ¡p luáº­t vÃ  ná»™i quy QueenKho.
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
                  <p className="text-title-md font-title-md text-on-primary">Chi Tiáº¿t Thanh ToÃ¡n & Äáº·t Cá»c</p>
                  <p className="text-label-sm font-label-sm text-on-primary/70 mt-0.5">
                    MÃ£ giao dá»‹ch táº¡m: QK-{MOCK_UNIT.code}-8924
                  </p>
                </div>
                <span className="material-symbols-outlined text-on-primary/60 text-[20px]">receipt_long</span>
              </div>
            </div>

            {/* Goi lua chon */}
            <div className="bg-primary/90 px-5 py-2 flex items-center justify-between">
              <span className="text-label-sm font-label-sm text-on-primary/70 uppercase">GÃ³i lá»±a chá»n</span>
              <span className="text-label-sm font-label-sm bg-secondary text-on-secondary px-2 py-0.5 rounded-full">
                {MOCK_UNIT.branch.replace('QueenKho ', '')}
              </span>
            </div>
            <div className="bg-primary/80 px-5 py-2">
              <span className="text-body-sm font-body-sm text-on-primary/90">
                {MOCK_UNIT.name} {MOCK_UNIT.area} mÂ² â€¢ GÃ³i {selectedMonths} ThÃ¡ng
              </span>
            </div>

            {/* Breakdown gia */}
            <div className="bg-white px-5 py-4 flex flex-col gap-3">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-body-sm font-body-sm text-on-surface">Tiá»n thuÃª kho ({selectedMonths} thÃ¡ng)</p>
                  <p className="text-label-sm font-label-sm text-on-surface-variant">
                    {formatVND(MOCK_UNIT.pricePerMonth)} Ã— {selectedMonths}
                  </p>
                </div>
                <span className="text-body-md font-body-md text-on-surface">{formatVND(baseTotal)}</span>
              </div>

              {selectedOption.discount > 0 && (
                <div className="flex justify-between items-center text-[#10B981]">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px]">local_offer</span>
                    <span className="text-body-sm font-body-sm">
                      Chiáº¿t kháº¥u Æ°u Ä‘Ã£i gÃ³i {selectedMonths}T (-{selectedOption.discount}%)
                    </span>
                  </div>
                  <span className="text-body-md font-body-md">-{formatVND(discountAmount)}</span>
                </div>
              )}

              <div className="flex justify-between items-center border-t border-surface-container pt-2">
                <span className="text-body-sm font-body-sm text-on-surface-variant">
                  Tiá»n thuÃª kho thá»±c tráº£ ({selectedMonths} thÃ¡ng):
                </span>
                <span className="text-body-md font-body-md text-on-surface">{formatVND(netRent)}</span>
              </div>

              <div className="flex justify-between items-start">
                <div>
                  <p className="text-body-sm font-body-sm text-on-surface">Tiá»n cá»c an toÃ n (1 thÃ¡ng)</p>
                  <p className="text-label-sm font-label-sm text-on-surface-variant">
                    * HoÃ n tráº£ 100% khi thanh lÃ½ há»£p Ä‘á»“ng.
                  </p>
                </div>
                <span className="text-body-md font-body-md text-on-surface">{formatVND(deposit)}</span>
              </div>

              <div className="flex justify-between items-center text-[#10B981]">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">redeem</span>
                  <span className="text-body-sm font-body-sm">Chiáº¿t kháº¥u voucher khÃ¡ch má»›i</span>
                </div>
                <span className="text-body-md font-body-md">-{formatVND(VOUCHER_DISCOUNT)}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-body-sm font-body-sm text-on-surface-variant">
                  PhÃ­ dá»‹ch vá»¥ & quáº£n lÃ½ pháº§n má»m
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-label-sm font-label-sm text-on-surface-variant line-through">150.000Ä‘</span>
                  <span className="text-label-sm font-label-sm text-[#10B981] font-semibold">Miá»…n phÃ­ (0Ä‘)</span>
                </div>
              </div>

              {/* Tong tien */}
              <div className="border-t-2 border-primary pt-3">
                <p className="text-title-md font-title-md text-on-surface font-bold">
                  Tá»”NG Cá»˜NG THANH TOÃN Äá»¢T 1
                </p>
                <p className="text-label-sm font-label-sm text-on-surface-variant mt-0.5">
                  ({formatVND(netRent)} thuÃª {selectedMonths}T + {formatVND(deposit)} cá»c - {formatVND(VOUCHER_DISCOUNT)} voucher)
                </p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-headline-md font-headline-md text-primary">{formatVND(totalPayment)}</span>
                  {selectedOption.discount > 0 && (
                    <span className="text-label-sm font-label-sm bg-[#ECFDF5] text-[#10B981] px-2 py-1 rounded-full">
                      Tiáº¿t kiá»‡m {formatVND(discountAmount + VOUCHER_DISCOUNT)}
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
                {loading ? 'Äang xá»­ lÃ½...' : `Thanh toÃ¡n Ä‘á»£t 1: ${formatVND(totalPayment)}`}
              </button>

              <p className="text-label-sm font-label-sm text-on-surface-variant text-center">
                Napas 247 â€¢ VietQR â€¢ HoÃ n cá»c tá»± Ä‘á»™ng 100%
              </p>

              <div className="flex justify-between items-center text-label-sm font-label-sm text-on-surface-variant border-t border-surface-container pt-2">
                <span>Cáº§n há»— trá»£ hoÃ¡ Ä‘Æ¡n VAT doanh nghiá»‡p?</span>
                <button className="text-secondary font-semibold cursor-pointer">Gá»i CSKH â†’</button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

