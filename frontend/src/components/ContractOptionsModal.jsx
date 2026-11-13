import { useEffect, useState } from 'react'
import { getCheckoutRefundPreview, getRenewalEligibility, getRenewalQuote, requestCheckout } from '../services/contractService'
import { createVnpayRenewal } from '../services/vnpayService'
import DateInput from './DateInput'
import { getOverdueFeeBreakdown } from '../utils/overdueFee'

function formatVND(v) {
  if (v == null || isNaN(v)) return '0₫'
  return Number(v).toLocaleString('vi-VN') + '₫'
}

function formatDate(val) {
  if (!val) return '—'
  const [y, m, d] = String(val).split('-')
  return `${d}/${m}/${y}`
}

export default function ContractOptionsModal({ isOpen, onClose, contract, onSuccess, initialTab = 'renew' }) {
  const isTerminationPending = contract?.status === 'TERMINATION_PENDING'
  // Ngày theo giờ máy (không dùng toISOString: giờ UTC làm lệch 1 ngày trước 7h sáng ở VN)
  const toLocalISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const addDays = (dateStr, days) => {
    if (!dateStr) return undefined
    const [y, m, d] = String(dateStr).slice(0, 10).split('-').map(Number)
    return toLocalISO(new Date(y, m - 1, d + days))
  }
  const today = toLocalISO(new Date())
  const tomorrow = addDays(today, 1)
  const isOverdue = contract?.status === 'OVERDUE' || (contract?.endDate && contract.endDate < today)
  const prevScheduledDate = contract?.scheduledCheckoutDate || contract?.endDate

  // PR-O1 (sửa 05/11/2026, D-15 bỏ ân hạn 5 ngày): hẹn từ ngày mai đến hết end_date; HĐ OVERDUE (điều khoản cũ) trong 3 ngày tới
  const maxCheckoutDate = isOverdue
    ? addDays(today, 3)
    : isTerminationPending
    ? (prevScheduledDate || contract?.endDate)
    : contract?.endDate

  const getInitialCheckoutDate = () => {
    const initialDate = contract?.scheduledCheckoutDate || (isOverdue ? tomorrow : contract?.endDate)
    return initialDate && initialDate >= tomorrow ? initialDate : tomorrow
  }

  const getInitialAccountName = () => {
    let fallbackName = contract?.customerFullName || ''
    if (!fallbackName) {
      try {
        const userStr = localStorage.getItem('user')
        if (userStr) {
          const u = JSON.parse(userStr)
          fallbackName = u.fullName || u.name || ''
        }
      } catch {
        // ignore parsing error
      }
    }
    return fallbackName ? fallbackName.toUpperCase() : ''
  }

  const isRenewable = ['ACTIVE', 'TERMINATION_PENDING', 'OVERDUE'].includes(contract?.status)
  const [activeTab, setActiveTab] = useState(isRenewable ? (initialTab || 'renew') : 'checkout')
  const [checkoutDate, setCheckoutDate] = useState(getInitialCheckoutDate)
  const [bankAccountName, setBankAccountName] = useState(getInitialAccountName)

  const [prevContractKey, setPrevContractKey] = useState(contract ? `${contract.contractId}_${initialTab}` : '')

  if (contract && `${contract.contractId}_${initialTab}` !== prevContractKey) {
    setPrevContractKey(`${contract.contractId}_${initialTab}`)
    setActiveTab(isRenewable ? (initialTab || 'renew') : 'checkout')
    setCheckoutDate(getInitialCheckoutDate())
    if (!bankAccountName) {
      setBankAccountName(getInitialAccountName())
    }
  }

  // Tab 1 state: Gia hạn
  const [selectedMonths, setSelectedMonths] = useState(6)
  const [renewLoading, setRenewLoading] = useState(false)
  const [renewError, setRenewError] = useState('')

  // Tab 2 state: Trả kho (PR-O1, PR-O2, PR-O3, PR-O14)
  const [refundMethod, setRefundMethod] = useState('BANK_TRANSFER') // 'BANK_TRANSFER' | 'CASH'
  const [bankName, setBankName] = useState('')
  const [bankAccountNumber, setBankAccountNumber] = useState('')
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')

  const basePrice = Number(contract?.basePriceMonthly || 0)
  const depositAmount = contract?.depositHeldAmount != null ? formatVND(contract.depositHeldAmount) : '—'

  // Tính hạn mới sau gia hạn
  const calculateNewEndDate = (months) => {
    let base = new Date()
    if (!isTerminationPending && contract?.endDate) {
      const [y, m, d] = contract.endDate.split('-').map(Number)
      const endD = new Date(y, m - 1, d)
      if (endD > base) {
        base = endD
      }
    }
    const target = new Date(base.getFullYear(), base.getMonth() + months, base.getDate())
    const y = target.getFullYear()
    const m = String(target.getMonth() + 1).padStart(2, '0')
    const d = String(target.getDate()).padStart(2, '0')
    return `${d}/${m}/${y}`
  }

  // Flow 4 / 6: báo giá 4 gói lấy từ backend — cùng hàm tính với VNPAY (ưu đãi gia hạn của BOM,
  // phí trễ theo chính sách gắn HĐ, = 0 nếu quản lý đã miễn phí trễ)
  const [quotes, setQuotes] = useState([])
  // PR-R10 / PR-R11: hạn chót gia hạn ưu tiên + ô đã có người đặt trước chưa
  const [eligibility, setEligibility] = useState(null)
  const contractId = contract?.contractId
  useEffect(() => {
    if (!isOpen || !contractId || !isRenewable) return undefined
    let cancelled = false
    getRenewalQuote(contractId)
      .then((data) => { if (!cancelled) setQuotes(Array.isArray(data) ? data : []) })
      .catch(() => { if (!cancelled) setQuotes([]) })
    getRenewalEligibility(contractId)
      .then((data) => { if (!cancelled) setEligibility(data) })
      .catch(() => { if (!cancelled) setEligibility(null) })
    return () => { cancelled = true }
  }, [isOpen, contractId, isRenewable])
  const quoteOf = (months) => quotes.find((q) => q.months === months)
  const newEndDateOf = (months) => {
    const pkg = eligibility?.packages?.find((p) => p.months === months)
    return pkg ? formatDate(pkg.newEndDate) : calculateNewEndDate(months)
  }
  const renewBlocked = eligibility?.renewable === false

  // UC-22 (góp ý test 13/11): tiền hoàn dự kiến lấy từ BE theo ngày khách chọn — cùng công thức lúc nghiệm thu
  // (trừ phí bảo hiểm BR-125, kỳ gia hạn gần nhất PR-O2c, tháng cuối kỳ không phạt PR-O2a); FE chỉ tính dự phòng
  const [refundPreview, setRefundPreview] = useState(null)
  useEffect(() => {
    if (!isOpen || !contractId || activeTab !== 'checkout' || !checkoutDate) return undefined
    let cancelled = false
    getCheckoutRefundPreview(contractId, checkoutDate)
      .then((data) => { if (!cancelled) setRefundPreview({ ...data, forDate: checkoutDate }) })
      .catch(() => { if (!cancelled) setRefundPreview(null) })
    return () => { cancelled = true }
  }, [isOpen, contractId, activeTab, checkoutDate])
  const preview = refundPreview?.forDate === checkoutDate ? refundPreview : null

  // Dự phòng khi chưa tải được báo giá (bảng mặc định 0/0/5/10%)
  const getPricing = (months) => {
    const quote = quoteOf(months)
    if (quote) {
      return { subtotal: Number(quote.subtotal), discountPercent: quote.discountPercent, discountAmount: Number(quote.discountAmount), total: Number(quote.rentAmount) }
    }
    const subtotal = basePrice * months
    const discountPercent = months === 12 ? 10 : months === 6 ? 5 : 0
    const discountAmount = Math.round((subtotal * discountPercent) / 100)
    return { subtotal, discountPercent, discountAmount, total: subtotal - discountAmount }
  }

  const currentPricing = getPricing(selectedMonths)
  const currentQuote = quoteOf(selectedMonths)
  const getTerminationGraceFee = () => {
    if (!isTerminationPending || !contract?.endDate) return 0
    const end = new Date(`${contract.endDate}T00:00:00`)
    const now = new Date(`${today}T00:00:00`)
    const daysPast = Math.floor((now - end) / 86400000)
    if (daysPast < 2 || daysPast > 5) return 0
    return Math.round(basePrice / 30) * (daysPast - 1)
  }
  const baseBreakdown = getOverdueFeeBreakdown(contract)
  const lateFee = currentQuote
    ? Number(currentQuote.lateFeeAmount || 0)
    : contract?.status === 'OVERDUE' || isTerminationPending
      ? baseBreakdown.lateFee || getTerminationGraceFee()
      : getTerminationGraceFee()
  const lateFeeWaived = Boolean(currentQuote?.lateFeeWaived ?? contract?.lateFeeWaived)
  const overstayFeeWaived = Boolean(currentQuote?.overstayFeeWaived ?? contract?.overstayFeeWaived)
  // PR-Q14: phí chiếm dụng các ngày đã quá hạn (đã nằm trong totalAmount của báo giá)
  const overstayFee = currentQuote ? Number(currentQuote.overstayFeeAmount || 0) : baseBreakdown.overstayFee
  const totalPenalty = lateFee + overstayFee
  const totalPayment = currentQuote ? Number(currentQuote.totalAmount) : currentPricing.total + totalPenalty
  const maxRenewalDiscount = Math.max(0, ...[1, 3, 6, 12].map((m) => getPricing(m).discountPercent))

  // UC-21: Xử lý Gia hạn hợp đồng qua cổng VNPAY
  const handleRenewSubmit = async (e) => {
    e.preventDefault()
    setRenewLoading(true)
    setRenewError('')
    try {
      const paymentData = await createVnpayRenewal(contract.contractId, selectedMonths)
      
      sessionStorage.setItem('queenkhoRenewalContext', JSON.stringify({
        contractId: contract.contractId,
        contractCode: contract.contractCode,
        reservationId: contract.reservationId || null,
        months: selectedMonths,
        amount: paymentData.amount,
        orderId: paymentData.orderId,
      }))

      window.location.assign(paymentData.payUrl)
    } catch (err) {
      setRenewError(err.response?.data?.message || err.message || 'Có lỗi xảy ra khi tạo giao dịch thanh toán VNPAY.')
      setRenewLoading(false)
    }
  }

  // UC-22: Xử lý Hẹn ngày trả kho & dời ngày sớm hơn (PR-O1, PR-O2, PR-O3, PR-O14)
  const handleCheckoutSubmit = async (e) => {
    e.preventDefault()
    if (!checkoutDate) {
      setCheckoutError('Vui lòng chọn ngày trả kho.')
      return
    }

    if (checkoutDate < tomorrow) {
      setCheckoutError(`Ngày hẹn trả kho phải từ ngày mai (${formatDate(tomorrow)}) trở đi.`)
      return
    }

    if (isOverdue && maxCheckoutDate && checkoutDate > maxCheckoutDate) {
      setCheckoutError(`Hợp đồng đã quá hạn (${formatDate(contract.endDate)}). Quý khách chỉ có thể hẹn trả kho trong tối đa 3 ngày tới (đến ngày ${formatDate(maxCheckoutDate)}).`)
      return
    }

    if (!isTerminationPending && maxCheckoutDate && checkoutDate > maxCheckoutDate) {
      setCheckoutError(`Ngày hẹn trả kho phải trong thời hạn hợp đồng (chậm nhất ${formatDate(maxCheckoutDate)}). Muốn dùng kho lâu hơn vui lòng gia hạn.`)
      return
    }

    if (isTerminationPending && prevScheduledDate && checkoutDate > prevScheduledDate) {
      setCheckoutError(`Không thể dời ngày qua sau ngày trả kho đã thực hiện trước đó (${formatDate(prevScheduledDate)}).`)
      return
    }

    if (refundMethod === 'BANK_TRANSFER' && (!bankName.trim() || !bankAccountNumber.trim() || !bankAccountName.trim())) {
      setCheckoutError('Vui lòng nhập đầy đủ thông tin ngân hàng để nhận hoàn tiền cọc.')
      return
    }
    if (refundMethod === 'BANK_TRANSFER' && !/^\d{6,20}$/.test(bankAccountNumber.trim())) {
      setCheckoutError('Số tài khoản chỉ gồm chữ số, dài 6–20 ký tự.')
      return
    }

    setCheckoutLoading(true)
    setCheckoutError('')
    try {
      // PR-O3: BE ghi cách nhận cọc vào task theo refundMethod
      const res = await requestCheckout(contract.contractId, {
        checkoutDate,
        refundMethod,
        bankName: refundMethod === 'BANK_TRANSFER' ? bankName.trim() : null,
        bankAccountNumber: refundMethod === 'BANK_TRANSFER' ? bankAccountNumber.trim() : null,
        bankAccountName: refundMethod === 'BANK_TRANSFER' ? bankAccountName.trim() : null,
      })
      const successMsg = res.message || (isTerminationPending
        ? `Đã dời ngày trả kho cho hợp đồng ${contract.contractCode} sang ngày ${formatDate(checkoutDate)}.`
        : `Yêu cầu trả kho cho hợp đồng ${contract.contractCode} đã được ghi nhận. Hẹn bàn giao ngày ${formatDate(checkoutDate)}.`
      )
      onSuccess?.(successMsg)
      onClose()
    } catch (err) {
      setCheckoutError(err.response?.data?.message || err.message || 'Có lỗi xảy ra khi gửi yêu cầu trả kho.')
    } finally {
      setCheckoutLoading(false)
    }
  }

  // Bảng tính dự kiến trả sớm (PR-O2) và phí quá hạn (HĐ đã quá hạn — điều khoản cũ)
  const isEarlyCheckout = checkoutDate && contract?.endDate && checkoutDate < contract.endDate
  const isGraceOrOverdue = checkoutDate && contract?.endDate && checkoutDate > contract.endDate

  let earlyRefundCalc = null
  if (isEarlyCheckout) {
    const sDate = new Date(contract.startDate || today)
    const cDate = new Date(checkoutDate)
    let usedMonths = 1
    if (cDate > sDate) {
      let months = (cDate.getFullYear() - sDate.getFullYear()) * 12 + (cDate.getMonth() - sDate.getMonth())
      if (cDate.getDate() > sDate.getDate()) {
        months += 1
      }
      usedMonths = Math.max(1, months)
    }

    let monthsFromDates = 1
    if (contract.startDate && contract.endDate) {
      const [y1, m1] = String(contract.startDate).split('-').map(Number)
      const [y2, m2] = String(contract.endDate).split('-').map(Number)
      const diff = (y2 - y1) * 12 + (m2 - m1)
      if (diff > 0) monthsFromDates = diff
    }
    const cycleMonths = Math.max(Number(contract.billingCycleMonths) || 1, monthsFromDates)

    let discountRate = 0
    if (cycleMonths >= 12) discountRate = 0.15
    else if (cycleMonths >= 6) discountRate = 0.10
    else if (cycleMonths >= 3) discountRate = 0.05

    const formulaRentPaid = Math.round(basePrice * cycleMonths * (1 - discountRate))
    const rentPaid = Number(contract.rentPaid) > 0 ? Number(contract.rentPaid) : formulaRentPaid
    const breakFee = basePrice
    const usedCost = basePrice * usedMonths
    const earlyRentRefund = Math.max(0, rentPaid - usedCost - breakFee)

    earlyRefundCalc = preview?.earlyCheckout
      ? {
          usedMonths: Number(preview.usedMonths || 0),
          cycleMonths: Number(preview.cycleMonths || cycleMonths),
          rentPaid: Number(preview.rentPaid || 0),
          usedCost: Number(preview.baseMonthlyPrice || basePrice) * Number(preview.usedMonths || 0),
          breakFee: Number(preview.breakFee || 0),
          earlyRentRefund: Number(preview.earlyRentRefund || 0),
        }
      : {
          usedMonths,
          cycleMonths,
          rentPaid,
          usedCost,
          breakFee,
          earlyRentRefund,
        }
  }

  // Tổng tiền dự kiến hoàn cho khách (cọc còn lại + tiền thuê trả sớm) — một con số dùng chung cho cả modal
  const depositHeldNum = Number(contract?.depositHeldAmount || 0)
  const expectedDepositRefund = preview ? Number(preview.depositRefund || 0) : depositHeldNum
  const expectedEarlyRefund = earlyRefundCalc ? earlyRefundCalc.earlyRentRefund : 0
  const expectedTotalRefund = preview
    ? Number(preview.totalRefundAmount || 0)
    : depositHeldNum + expectedEarlyRefund

  // D-15: không còn ân hạn — chỉ HĐ đã quá hạn mới có ngày trả sau end_date
  let graceCalc = null
  if (isGraceOrOverdue) {
    const eDate = new Date(contract.endDate)
    const cDate = new Date(checkoutDate)
    const diffDays = Math.ceil(Math.abs(cDate - eDate) / (1000 * 60 * 60 * 24))
    // PR-Q14: phí trễ (trần 50% cọc) + phí chiếm dụng mỗi ngày quá hạn (không trần)
    // Góp ý test 12/11: đã miễn phí trễ → phí trễ = 0; miễn luôn phí chiếm dụng → 0 (BE trả overstayDailyAmount theo đúng mức)
    const deposit = Number(contract.depositHeldAmount || basePrice)
    const rawFee = Math.round(deposit * Math.min(diffDays, 5) * 0.10)
    const cap = Number(contract.maxLateFeeAmount) > 0 ? Number(contract.maxLateFeeAmount) : deposit * 0.5
    const latePart = contract.lateFeeWaived ? 0 : Math.min(rawFee, cap)
    const overstayPart = contract.overstayFeeWaived ? 0 : Number(contract.overstayDailyAmount || 0) * diffDays
    graceCalc = {
      days: diffDays,
      fee: latePart,
      overstay: overstayPart,
      total: latePart + overstayPart,
      lateFeeWaived: Boolean(contract.lateFeeWaived),
      overstayFeeWaived: Boolean(contract.overstayFeeWaived),
    }
  }

  if (!isOpen || !contract) return null

  const isMatchedExpiry = checkoutDate && contract.endDate && checkoutDate === contract.endDate

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-[580px] max-w-xl max-h-[92vh] bg-white rounded-2xl shadow-2xl overflow-y-auto flex flex-col relative transition-all animate-in fade-in zoom-in-95 duration-200 custom-scrollbar">
        
        {/* Modal Header */}
        <div className="px-6 pt-5 pb-4 bg-white flex items-start justify-between border-b border-slate-100">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[22px]">assignment</span>
              <h2 className="font-headline-sm text-base sm:text-lg font-bold text-slate-800">
                Tùy Chọn Hợp Đồng - Khoang {contract.storageUnitId || '—'}
              </h2>
            </div>
            <p className="font-body-sm text-xs sm:text-sm text-slate-500 flex items-center gap-1.5 pl-7">
              <span>Hợp đồng <strong className="text-slate-700 font-semibold font-mono">#{contract.contractCode}</strong></span>
              <span>•</span>
              <span className="text-slate-600 font-medium">Hết hạn ngày {formatDate(contract.endDate)}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Đóng cửa sổ"
            type="button"
            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Strict Segmented Tabs */}
        <div className="px-6 pt-4 pb-2">
          <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1">
            {isRenewable && (
              <button
                type="button"
                onClick={() => setActiveTab('renew')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-title-md text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  activeTab === 'renew'
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">autorenew</span>
                Gia Hạn Thuê
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveTab('checkout')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-title-md text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'checkout'
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">event_available</span>
              Hẹn Ngày Trả Kho
            </button>
          </div>
        </div>

        {/* Tab 1: Gia Hạn Thuê (UC-21 & PR-R1/R3/R6) */}
        {activeTab === 'renew' && isRenewable && (
          <form onSubmit={handleRenewSubmit} className="px-6 pt-2 pb-5 space-y-4">
            {renewError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
                <span className="material-symbols-outlined text-red-600 text-[18px]">error</span>
                <span>{renewError}</span>
              </div>
            )}

            {/* PR-R10 / PR-R11: hạn chót gia hạn ưu tiên */}
            {eligibility?.window === 'PRIORITY' && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-xs flex items-start gap-2">
                <span className="material-symbols-outlined text-blue-600 text-[18px] shrink-0">schedule</span>
                <span>
                  Gia hạn ưu tiên đến hết ngày <strong>{formatDate(eligibility.priorityDeadline)}</strong>
                  {eligibility.daysUntilDeadline > 0 ? ` (còn ${eligibility.daysUntilDeadline} ngày)` : ' (hôm nay là ngày cuối)'}.
                  Sau mốc này, ô kho sẽ mở cho khách khác đặt trước và quý khách chỉ gia hạn được nếu chưa có ai đặt ô.
                </span>
              </div>
            )}
            {eligibility?.window === 'LATE' && !renewBlocked && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-2">
                <span className="material-symbols-outlined text-amber-600 text-[18px] shrink-0">hourglass_bottom</span>
                <span>
                  Đã qua hạn chót gia hạn ưu tiên ({formatDate(eligibility.priorityDeadline)}). Ô kho đang mở cho khách khác đặt trước —
                  hiện vẫn còn gia hạn được, quý khách nên thanh toán ngay.
                </span>
              </div>
            )}
            {renewBlocked && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs flex flex-col gap-2">
                <div className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-red-600 text-[18px] shrink-0">block</span>
                  <span>{eligibility.blockedReason || 'Ô kho đã có khách khác đặt trước, không thể gia hạn.'}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('checkout')}
                  className="self-start px-3 py-1.5 rounded-lg bg-white border border-red-300 text-red-700 font-semibold hover:bg-red-100 cursor-pointer"
                >
                  Chuyển sang Hẹn trả kho
                </button>
              </div>
            )}

            {isTerminationPending && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-600 text-[18px]">info</span>
                <span>Gia hạn sẽ hủy yêu cầu trả kho đang chờ của quý khách.</span>
              </div>
            )}

            {/* Chọn gói gia hạn */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-title-md text-xs sm:text-sm text-slate-800 font-semibold">
                  Chọn gói thời gian gia hạn thêm:
                </span>
                {maxRenewalDiscount > 0 && (
                  <span className="text-xs text-blue-600 font-semibold">Tiết kiệm đến {maxRenewalDiscount}%</span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  { m: 1, label: '+1 Tháng' },
                  { m: 3, label: '+3 Tháng' },
                  { m: 6, label: '+6 Tháng', popular: true },
                  { m: 12, label: '+12 Tháng', best: true },
                ].map((base) => {
                  const discount = getPricing(base.m).discountPercent
                  const item = { ...base, discount, desc: discount > 0 ? `Giảm ${discount}%` : base.m === 1 ? 'Chu kỳ gốc' : 'Không ưu đãi' }
                  const isSelected = selectedMonths === item.m
                  return (
                    <button
                      key={item.m}
                      type="button"
                      onClick={() => setSelectedMonths(item.m)}
                      className={`relative flex flex-col items-center justify-center p-3 rounded-lg border text-center transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50/80 text-primary border-primary font-bold shadow-sm ring-1 ring-primary'
                          : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      {item.popular && (
                        <span className="absolute -top-2.5 px-2 py-0.5 bg-blue-600 text-white rounded-full text-[10px] uppercase font-bold tracking-tight shadow-sm">
                          PHỔ BIẾN
                        </span>
                      )}
                      {item.best && (
                        <span className="absolute -top-2.5 px-2 py-0.5 bg-emerald-600 text-white rounded-full text-[10px] uppercase font-bold tracking-tight shadow-sm">
                          TIẾT KIỆM
                        </span>
                      )}
                      <span className="font-title-md text-sm font-semibold">{item.label}</span>
                      <span className={`text-[11px] mt-0.5 ${item.discount > 0 ? 'text-emerald-600 font-semibold' : 'text-slate-400'}`}>
                        {item.desc}
                      </span>
                      <span className="text-[10px] mt-0.5 text-slate-500 font-mono">→ {newEndDateOf(item.m)}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Bảng tính chi phí */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-2.5 text-xs sm:text-sm">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="text-slate-500 flex items-center gap-1.5 text-xs">
                  <span className="material-symbols-outlined text-[16px] text-primary">event</span>
                  Hạn mới sau gia hạn:
                </span>
                <span className="font-title-md text-slate-800 font-bold font-mono">
                  {newEndDateOf(selectedMonths)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>Đơn giá thuê:</span>
                <span className="text-slate-700">
                  {formatVND(basePrice)} × {selectedMonths} tháng
                </span>
              </div>
              {currentPricing.discountPercent > 0 && (
                <div className="flex items-center justify-between text-xs text-emerald-700 font-semibold">
                  <span>Chiết khấu kỳ hạn dài:</span>
                  <span>-{formatVND(currentPricing.discountAmount)} ({currentPricing.discountPercent}%)</span>
                </div>
              )}
              {(() => {
                const isOverdueLike = contract?.status === 'OVERDUE'
                  || (isTerminationPending && (Number(contract?.overdueDays || 0) > 0 || totalPenalty > 0 || lateFeeWaived || overstayFeeWaived))
                if (!isOverdueLike) return null
                return (
                  <div className="rounded-xl border border-red-200 bg-red-50/60 p-2.5 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-xs font-extrabold text-red-700">
                      <span className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px] text-red-600">payments</span>
                        Tổng tiền phạt quá hạn ({contract?.overdueDays || 0} ngày):
                      </span>
                      <span className="font-mono">
                        {totalPenalty === 0 && lateFeeWaived && overstayFeeWaived ? '0₫ (Đã miễn)' : `+${formatVND(totalPenalty)}`}
                      </span>
                    </div>
                    <div className="pl-5 space-y-1 text-[11px] font-semibold">
                      <div className="flex items-center justify-between text-amber-800">
                        <span>• Phí phạt trễ hạn:</span>
                        {lateFeeWaived ? (
                          <span className="text-emerald-700 font-bold">0₫ (Đã được quản lý miễn)</span>
                        ) : (
                          <span className="font-mono font-bold">+{formatVND(lateFee)}</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-red-800">
                        <span>• Phí chiếm dụng ô:</span>
                        {overstayFeeWaived ? (
                          <span className="text-emerald-700 font-bold">0₫ (Đã được quản lý miễn)</span>
                        ) : (
                          <span className="font-mono font-bold">+{formatVND(overstayFee)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })()}
              {/* BR-125: gia hạn giữ nguyên gói bảo hiểm đã chọn lúc đặt */}
              {Number(currentQuote?.insuranceAmount || 0) > 0 && (
                <div className="flex items-center justify-between text-xs text-[#1899D6] font-semibold bg-[#DDF4FF] p-2.5 rounded-lg border border-[#84D8FF]">
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px]">verified_user</span>
                    Bảo hiểm hàng hoá {contract?.insurancePlanLabel || ''}:
                  </span>
                  <span className="font-mono font-bold">+{formatVND(Number(currentQuote.insuranceAmount))}</span>
                </div>
              )}
              <div className="pt-2.5 border-t border-slate-200 flex items-baseline justify-between">
                <div>
                  <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500 block">
                    TỔNG THANH TOÁN
                  </span>
                  <span className="text-[11px] text-slate-400">Đã bao gồm VAT & phí bảo hiểm kho</span>
                  {(contract?.status === 'OVERDUE' || (isTerminationPending && totalPenalty > 0)) && (
                    <span className="text-[11px] text-amber-600 block mt-1 italic">
                      * Khoản phí được chốt khi tạo liên kết thanh toán và không đổi trong lần thanh toán này
                    </span>
                  )}
                </div>
                <span className="text-lg sm:text-xl font-extrabold text-primary">
                  {formatVND(totalPayment)}
                </span>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={renewLoading || renewBlocked}
              className="w-full py-3 px-6 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold text-sm shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              {renewLoading ? (
                <>
                  <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                  <span>Đang xử lý...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[20px]">credit_card</span>
                  <span>Thanh Toán & Gia Hạn Ngay</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* Tab 2: Hẹn Ngày Trả Kho (UC-22) - Chuẩn 100% Stitch */}
        {activeTab === 'checkout' && (
          <form onSubmit={handleCheckoutSubmit} className="px-6 pt-2 pb-5 flex flex-col">
            {checkoutError && (
              <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
                <span className="material-symbols-outlined text-red-600 text-[18px]">error</span>
                <span>{checkoutError}</span>
              </div>
            )}

            {/* Date Selection Section */}
            <label className="text-xs sm:text-sm text-slate-800 font-semibold mb-2 block" htmlFor="checkoutDateInput">
              {isOverdue
                ? 'Hợp đồng đã quá hạn - Chọn ngày trả kho (trong 3 ngày tới):'
                : isTerminationPending
                ? 'Chọn ngày dời trả kho sớm hơn:'
                : 'Chọn ngày dọn đồ & trả kho:'}
            </label>
            <div className="relative flex items-center bg-slate-100 rounded-lg px-3.5 py-2.5 transition-all border border-slate-200">
              <div className="flex items-center gap-2.5 text-slate-800 text-sm flex-1">
                <span className="material-symbols-outlined text-slate-500 text-[20px]">calendar_today</span>
                <DateInput
                  id="checkoutDateInput"
                  value={checkoutDate}
                  min={tomorrow}
                  max={maxCheckoutDate}
                  onChange={(e) => setCheckoutDate(e.target.value)}
                  className="bg-transparent border-0 p-0 text-slate-800 font-semibold text-sm focus:outline-none w-full cursor-pointer"
                  required
                />
              </div>
              {isOverdue && (
                <span className="text-[11px] text-red-700 bg-red-100 font-semibold px-2 py-0.5 rounded shrink-0">
                  Quá hạn (≤ 3 ngày)
                </span>
              )}
              {!isOverdue && isEarlyCheckout && (
                <span className="text-[11px] text-emerald-700 bg-emerald-100 font-semibold px-2 py-0.5 rounded shrink-0">
                  Trả sớm (PR-O2)
                </span>
              )}
              {!isOverdue && !isTerminationPending && isMatchedExpiry && (
                <span className="text-[11px] text-slate-600 font-medium uppercase px-2 py-0.5 rounded bg-slate-200 shrink-0">
                  Khớp hạn HĐ
                </span>
              )}
            </div>

            {/* Bảng tính dự kiến trả sớm (PR-O2) */}
            {isEarlyCheckout && earlyRefundCalc && (
              <div className="bg-[#EAFBE0] border border-[#D0F8AB] rounded-xl p-3.5 my-3 flex flex-col gap-1.5 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-[#2B5300]">
                  <span className="material-symbols-outlined text-[#58A700] text-[20px]">savings</span>
                  <span className="text-sm font-black text-[#58A700]">Chính sách hoàn tiền thuê trả sớm (PR-O2)</span>
                </div>
                <p className="text-[#2B5300]/90 leading-relaxed text-[11px]">
                  Hợp đồng gói {earlyRefundCalc.cycleMonths} tháng (đã đóng: {formatVND(earlyRefundCalc.rentPaid)}). Quý khách đã sử dụng {earlyRefundCalc.usedMonths} tháng (làm tròn lên).
                </p>
                <div className="bg-white/80 p-2.5 rounded-lg border border-[#D0F8AB] flex flex-col gap-1 text-[11px] font-semibold text-[#4B4B4B]">
                  <div className="flex justify-between">
                    <span>Tiền thuê thực tế ({earlyRefundCalc.usedMonths} tháng × {formatVND(basePrice)}):</span>
                    <span className="font-bold text-red-600">- {formatVND(earlyRefundCalc.usedCost)}</span>
                  </div>
                  {earlyRefundCalc.breakFee > 0 ? (
                    <div className="flex justify-between">
                      <span>Phí phá vỡ hợp đồng sớm (1 tháng giá gốc):</span>
                      <span className="font-bold text-red-600">- {formatVND(earlyRefundCalc.breakFee)}</span>
                    </div>
                  ) : (
                    <div className="flex justify-between text-[#777777]">
                      <span>Trả trong tháng cuối của kỳ (PR-O2a):</span>
                      <span className="font-bold">không phí phá HĐ</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-[#D0F8AB] pt-1 text-xs">
                    <span className="font-black text-[#2B5300]">Tiền thuê còn lại hoàn trả:</span>
                    <span className="font-black text-sm text-[#58A700]">+{formatVND(earlyRefundCalc.earlyRentRefund)}</span>
                  </div>
                  <div className="flex justify-between text-xs pt-0.5">
                    <span className="font-black text-[#2B5300]">Tiền cọc giữ kho hoàn lại (dự kiến):</span>
                    <span className="font-black text-sm text-[#1899D6]">+{formatVND(expectedDepositRefund)}</span>
                  </div>
                  <div className="flex justify-between border-t border-[#D0F8AB] pt-1 text-xs">
                    <span className="font-black uppercase text-[#2B5300]">Tổng dự kiến hoàn trả khách:</span>
                    <span className="font-black text-base text-[#58A700]">
                      {formatVND(expectedTotalRefund)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Phí quá hạn dự kiến (HĐ đã quá hạn) — D-15 đã bỏ ân hạn 5 ngày */}
            {isGraceOrOverdue && graceCalc && (
              <div className="p-3.5 rounded-xl border my-3 text-xs flex flex-col gap-1.5 bg-amber-50 border-amber-200 text-amber-900">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 font-bold">
                    <span className="material-symbols-outlined text-[20px]">warning</span>
                    <span className="font-black text-sm">Tổng tiền phạt dự kiến ({graceCalc.days} ngày)</span>
                  </div>
                  <span className="font-black text-sm text-red-700">{formatVND(graceCalc.total)}</span>
                </div>
                <p className="leading-relaxed text-[11px]">
                  {`Phí phạt trễ: ${graceCalc.lateFeeWaived ? '0₫ (đã được miễn)' : formatVND(graceCalc.fee)} · Phí chiếm dụng ô: ${graceCalc.overstayFeeWaived ? '0₫ (đã được miễn)' : `${formatVND(graceCalc.overstay)}${graceCalc.lateFeeWaived && graceCalc.overstay > 0 ? ' (chỉ tính tiền thuê theo ngày, không phạt)' : ''}`} (trừ vào cọc khi nghiệm thu; vượt cọc sẽ thành khoản nợ cần thanh toán).`}
                </p>
              </div>
            )}

            {/* Hợp đồng quá hạn */}
            {isOverdue && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3.5 my-3 flex items-start gap-2.5 text-xs text-red-900">
                <span className="material-symbols-outlined text-red-600 text-[20px] shrink-0 mt-0.5">error</span>
                <div>
                  <span className="font-bold text-red-700 block mb-0.5">Hợp đồng đã quá hạn trả kho</span>
                  <p className="leading-relaxed text-[11px]">
                    Hạn HĐ kết thúc ngày {formatDate(contract.endDate)}. Tiền phạt quá hạn gồm <strong>phí phạt trễ</strong> (tối đa 50% tiền cọc {depositAmount} theo PR-Q3) và <strong>phí chiếm dụng ô</strong> (tính theo ngày quá hạn theo chính sách hiện hành), khấu trừ vào cọc khi nghiệm thu.
                  </p>
                </div>
              </div>
            )}

            {/* Phương thức nhận tiền hoàn cọc (PR-O3: Chuyển khoản hoặc Tiền mặt tại quầy) */}
            {Number(contract.depositHeldAmount || 0) > 0 && (
              <div className="bg-[#DDF4FF] border-2 border-[#84D8FF] rounded-xl p-4 mb-3 flex flex-col gap-3">
                <div className="flex items-center gap-2 text-[#1899D6]">
                  <span className="material-symbols-outlined text-[20px]">
                    payments
                  </span>
                  <span className="text-xs font-black uppercase tracking-wider">
                    Hình thức nhận tiền hoàn ({formatVND(expectedTotalRefund)}) *
                  </span>
                </div>
                {expectedEarlyRefund > 0 && (
                  <p className="-mt-1.5 text-[11px] font-semibold text-[#1899D6]">
                    Gồm tiền cọc {formatVND(expectedDepositRefund)} + tiền thuê trả sớm {formatVND(expectedEarlyRefund)}. Số chốt cuối cùng theo biên bản nghiệm thu.
                  </p>
                )}

                {/* Radio selection */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <label className={`flex items-start gap-2.5 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                    refundMethod === 'BANK_TRANSFER' 
                      ? 'bg-white border-[#1CB0F6] shadow-xs' 
                      : 'bg-white/60 border-slate-200 hover:bg-white'
                  }`}>
                    <input
                      type="radio"
                      name="refundMethod"
                      value="BANK_TRANSFER"
                      checked={refundMethod === 'BANK_TRANSFER'}
                      onChange={() => setRefundMethod('BANK_TRANSFER')}
                      className="accent-[#1CB0F6] w-4 h-4 mt-0.5 cursor-pointer"
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-[#4B4B4B] flex items-center gap-1">
                        <span className="material-symbols-outlined text-[16px] text-[#1CB0F6]">account_balance</span>
                        Chuyển khoản ngân hàng
                      </span>
                      <span className="text-[10px] text-slate-500 mt-0.5">
                        Quản lý chuyển hoàn vào STK sau khi nghiệm thu
                      </span>
                    </div>
                  </label>

                  <label className={`flex items-start gap-2.5 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                    refundMethod === 'CASH' 
                      ? 'bg-white border-[#1CB0F6] shadow-xs' 
                      : 'bg-white/60 border-slate-200 hover:bg-white'
                  }`}>
                    <input
                      type="radio"
                      name="refundMethod"
                      value="CASH"
                      checked={refundMethod === 'CASH'}
                      onChange={() => setRefundMethod('CASH')}
                      className="accent-[#1CB0F6] w-4 h-4 mt-0.5 cursor-pointer"
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-[#4B4B4B] flex items-center gap-1">
                        <span className="material-symbols-outlined text-[16px] text-[#58CC02]">payments</span>
                        Tiền mặt tại quầy
                      </span>
                      <span className="text-[10px] text-slate-500 mt-0.5">
                        Nhận tiền mặt trực tiếp tại quầy lễ tân cơ sở
                      </span>
                    </div>
                  </label>
                </div>

                {refundMethod === 'BANK_TRANSFER' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-[#84D8FF]/40 mt-1">
                    <div className="flex flex-col gap-1 sm:col-span-2">
                      <label className="text-[10px] font-black uppercase text-[#1899D6]" htmlFor="checkoutBankName">
                        Tên Ngân hàng *
                      </label>
                      <input
                        id="checkoutBankName"
                        list="checkout-bank-options"
                        type="text"
                        placeholder="VD: Vietcombank, MB Bank, Techcombank..."
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        required={refundMethod === 'BANK_TRANSFER'}
                        className="bg-white border-2 border-[#84D8FF] rounded-xl px-3 py-2 text-xs font-bold text-[#4B4B4B] outline-none focus:border-[#1CB0F6]"
                      />
                      <datalist id="checkout-bank-options">
                        <option value="Vietcombank (VCB)" />
                        <option value="MB Bank (MB)" />
                        <option value="Techcombank (TCB)" />
                        <option value="VietinBank (CTG)" />
                        <option value="BIDV" />
                        <option value="VPBank" />
                        <option value="ACB" />
                        <option value="TPBank" />
                        <option value="Agribank" />
                        <option value="Sacombank" />
                        <option value="HDBank" />
                        <option value="VIB" />
                        <option value="OCB" />
                        <option value="MoMo" />
                        <option value="ZaloPay" />
                      </datalist>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-black uppercase text-[#1899D6]" htmlFor="checkoutBankAccountNumber">
                        Số tài khoản (STK) *
                      </label>
                      <input
                        id="checkoutBankAccountNumber"
                        type="text"
                        placeholder="VD: 0367069283"
                        value={bankAccountNumber}
                        onChange={(e) => setBankAccountNumber(e.target.value)}
                        required={refundMethod === 'BANK_TRANSFER'}
                        className="bg-white border-2 border-[#84D8FF] rounded-xl px-3 py-2 text-xs font-bold font-mono text-[#4B4B4B] outline-none focus:border-[#1CB0F6]"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-black uppercase text-[#1899D6]" htmlFor="checkoutBankAccountName">
                        Tên chủ tài khoản *
                      </label>
                      <input
                        id="checkoutBankAccountName"
                        type="text"
                        placeholder="VD: NGUYEN VAN A"
                        value={bankAccountName}
                        onChange={(e) => setBankAccountName(e.target.value.toUpperCase())}
                        required={refundMethod === 'BANK_TRANSFER'}
                        className="bg-white border-2 border-[#84D8FF] rounded-xl px-3 py-2 text-xs font-bold uppercase text-[#4B4B4B] outline-none focus:border-[#1CB0F6]"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-white/80 rounded-xl border border-[#84D8FF] flex items-center gap-2.5 text-xs text-[#2D3748]">
                    <span className="material-symbols-outlined text-[#58CC02] text-[20px]">check_circle</span>
                    <span className="font-semibold">
                      Quý khách sẽ nhận hoàn tiền cọc trực tiếp bằng tiền mặt từ Quản lý cơ sở tại quầy lễ tân sau khi hoàn tất nghiệm thu trả kho.
                    </span>
                  </div>
                )}
              </div>
            )}
            {/* Action Buttons Row */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-lg bg-slate-100 text-slate-700 font-semibold text-xs sm:text-sm hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={checkoutLoading}
                className="px-6 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs sm:text-sm shadow-sm flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
              >
                {checkoutLoading ? (
                  <>
                    <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                    <span>Đang xử lý...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">verified</span>
                    <span>{isTerminationPending ? 'Xác nhận dời ngày' : 'Xác nhận trả kho'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Modal Footer Support Info */}
        <div className="px-6 py-2.5 bg-slate-100 border-t border-slate-200/80 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-1">
            <span className="material-symbols-outlined text-[15px] text-primary">support_agent</span>
            <span>Cần hỗ trợ xe tải chuyển hàng? Hotline: <strong className="text-slate-800 font-semibold">1900 6889</strong></span>
          </div>
          <span className="font-mono text-slate-400">Q-PORTAL v3.4</span>
        </div>

      </div>
    </div>
  )
}
