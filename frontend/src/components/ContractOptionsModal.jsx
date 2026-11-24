import { useEffect, useState } from 'react'
import { getCheckoutRefundPreview, getRenewalEligibility, getRenewalQuote, requestCheckout, requestRenewalReassign } from '../services/contractService'
import { createVnpayRenewal } from '../services/vnpayService'
import { getCustomerSupportTickets } from '../services/supportService'
import DateInput from './DateInput'
import MoneyBreakdownTable from './MoneyBreakdownTable'
import SeparateCompensationBox from './SeparateCompensationBox'
import PaymentConfirmModal from './PaymentConfirmModal'
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

  // Vấn đề 3A & 3B (22/11/2026): khách được hẹn / dời ngày trả kho trễ tối đa 5 ngày sau hạn hợp đồng
  // (sau ngày thứ 5 hàng tự động bị cưỡng chế dọn vào kho tổng)
  const maxGraceCheckoutDate = contract?.endDate ? addDays(contract.endDate, 5) : addDays(today, 5)
  const maxCheckoutDate = isOverdue
    ? (maxGraceCheckoutDate && maxGraceCheckoutDate >= tomorrow ? maxGraceCheckoutDate : addDays(today, 3))
    : isTerminationPending
    ? (prevScheduledDate && prevScheduledDate > maxGraceCheckoutDate ? prevScheduledDate : maxGraceCheckoutDate)
    : maxGraceCheckoutDate

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
  const [renewConfirmOpen, setRenewConfirmOpen] = useState(false) // PR-B12: xác nhận số tiền gia hạn
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
  const [reassignLoading, setReassignLoading] = useState(false)
  const [reassignSuccess, setReassignSuccess] = useState('')
  const contractId = contract?.contractId
  useEffect(() => {
    if (!isOpen || !contractId || !isRenewable) return undefined
    let cancelled = false
    setReassignSuccess('')
    getRenewalQuote(contractId)
      .then((data) => { if (!cancelled) setQuotes(Array.isArray(data) ? data : []) })
      .catch(() => { if (!cancelled) setQuotes([]) })
    getRenewalEligibility(contractId)
      .then((data) => {
        if (!cancelled) {
          setEligibility(data)
          if (data?.reassignRequestedMonths && [1, 3, 6, 12].includes(Number(data.reassignRequestedMonths))) {
            setSelectedMonths(Number(data.reassignRequestedMonths))
          }
        }
      })
      .catch(() => { if (!cancelled) setEligibility(null) })
    return () => { cancelled = true }
  }, [isOpen, contractId, isRenewable])
  const quoteOf = (months) => quotes.find((q) => q.months === months)
  const newEndDateOf = (months) => {
    const pkg = eligibility?.packages?.find((p) => p.months === months)
    return pkg ? formatDate(pkg.newEndDate) : calculateNewEndDate(months)
  }
  const packageNotRenewable = Array.isArray(eligibility?.renewablePackages)
    && !eligibility.renewablePackages.includes(selectedMonths)
  const renewBlocked = eligibility?.renewable === false || packageNotRenewable
  const reassignStatus = eligibility?.reassignRequestStatus || contract?.reassignRequestStatus || null
  const reassignRequestedMonths = Number(eligibility?.reassignRequestedMonths || contract?.reassignRequestedMonths || 0) || null
  const reassignAssignedUnitId = eligibility?.reassignAssignedUnitId || contract?.reassignAssignedUnitId || null
  const reassignNote = eligibility?.reassignNote || contract?.reassignNote || null

  const handleRequestReassign = async () => {
    if (!contractId) return
    setReassignLoading(true)
    setRenewError('')
    setReassignSuccess('')
    try {
      const res = await requestRenewalReassign(contractId, { requestedMonths: selectedMonths })
      const msg = res?.message || `Đã gửi yêu cầu gán lại ô kho mới (gói +${selectedMonths} tháng) cho Quản lý cơ sở.`
      setReassignSuccess(msg)
      const updated = await getRenewalEligibility(contractId)
      setEligibility(updated)
      onSuccess?.(msg)
    } catch (err) {
      setRenewError(err.response?.data?.message || err.message || 'Không thể gửi yêu cầu gán lại ô kho mới.')
    } finally {
      setReassignLoading(false)
    }
  }

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

  // D-21 / PR-O24: ticket hỗ trợ / hồ sơ bồi thường còn mở → cảnh báo (không chặn hẹn trả kho)
  const [openTickets, setOpenTickets] = useState([])
  useEffect(() => {
    if (!isOpen || !contractId || activeTab !== 'checkout') return undefined
    let cancelled = false
    const customerId = JSON.parse(sessionStorage.getItem('user') || '{}').id
    getCustomerSupportTickets(customerId, { contractId })
      .then((list) => {
        if (!cancelled) setOpenTickets((list || []).filter((t) => ['OPEN', 'IN_PROGRESS', 'RESOLVED'].includes(t.status)))
      })
      .catch(() => { if (!cancelled) setOpenTickets([]) })
    return () => { cancelled = true }
  }, [isOpen, contractId, activeTab])

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
  const handleRenewSubmit = (e) => {
    e.preventDefault()
    setRenewError('')
    setRenewConfirmOpen(true)
  }

  // PR-B12: khách xác nhận số tiền trong modal rồi mới tạo link VNPAY
  const doRenew = async () => {
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
      setRenewConfirmOpen(false)
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

    if (maxCheckoutDate && checkoutDate > maxCheckoutDate) {
      setCheckoutError(`Ngày hẹn trả kho chỉ được trễ tối đa 5 ngày sau hạn hợp đồng (chậm nhất ${formatDate(maxCheckoutDate)} — sau ngày thứ 5 hàng sẽ tự động bị cưỡng chế dọn vào kho tổng).`)
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

  // Trả sớm / quá hạn — chỉ để gắn nhãn; mọi số tiền lấy từ API xem trước (cùng công thức lúc nghiệm thu)
  const isEarlyCheckout = checkoutDate && contract?.endDate && checkoutDate < contract.endDate
  const isGraceOrOverdue = checkoutDate && contract?.endDate && checkoutDate > contract.endDate

  // D-22: số tiền dự kiến (> 0 hoàn khách, < 0 khách trả thêm) — một con số dùng chung cho cả modal
  const expectedNet = preview ? Number(preview.netAmount ?? preview.totalRefundAmount ?? 0) : null
  const expectedTotalRefund = expectedNet != null ? Math.max(0, expectedNet) : null

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

            {contract?.emergencyUnit && (
              <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl text-sky-900 text-xs flex items-start gap-2">
                <span className="material-symbols-outlined text-sky-600 text-[18px] shrink-0">shield_with_heart</span>
                <span>
                  Hợp đồng của bạn đang được cơ sở hỗ trợ lưu trữ tạm thời tại khoang sự cố <strong>{contract.storageUnitId}</strong>;
                  mức giá và quyền lợi gia hạn giữ nguyên theo loại kho bạn đã đặt (<strong>{contract.unitTypeName}</strong>).
                  Đội kỹ thuật và Quản lý cơ sở sẽ chủ động điều phối lại ô kho chính thức cho bạn khi hoàn tất bảo trì.
                </span>
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
            {reassignSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2 font-semibold">
                <span className="material-symbols-outlined text-emerald-600 text-[18px]">check_circle</span>
                <span>{reassignSuccess}</span>
              </div>
            )}
            {reassignStatus === 'ASSIGNED' && !renewBlocked && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 text-xs flex flex-col gap-1.5">
                <div className="flex items-start gap-2 font-bold text-emerald-800">
                  <span className="material-symbols-outlined text-emerald-600 text-[18px] shrink-0">check_circle</span>
                  <span>
                    Quản lý đã gán ô kho mới <strong>{reassignAssignedUnitId || contract.storageUnitId}</strong> (cùng loại {contract.unitTypeName}) cho kỳ gia hạn +{reassignRequestedMonths || selectedMonths} tháng của bạn!
                  </span>
                </div>
                {reassignNote && <p className="pl-6 text-emerald-700">Ghi chú từ Quản lý: {reassignNote}</p>}
                <p className="pl-6 text-emerald-800 font-semibold">
                  Quý khách hiện có thể nhấn &quot;Thanh Toán &amp; Gia Hạn Ngay&quot; bên dưới để hoàn tất gia hạn.
                </p>
              </div>
            )}
            {eligibility?.window === 'LATE' && !renewBlocked && reassignStatus !== 'ASSIGNED' && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-2">
                <span className="material-symbols-outlined text-amber-600 text-[18px] shrink-0">hourglass_bottom</span>
                <span>
                  Đã qua hạn chót gia hạn ưu tiên ({formatDate(eligibility.priorityDeadline)}). Ô kho đang mở cho khách khác đặt trước —
                  hiện vẫn còn gia hạn được, quý khách nên thanh toán ngay.
                </span>
              </div>
            )}
            {reassignStatus === 'OUT_OF_STOCK' && (
              <div className="p-3.5 bg-red-50 border border-red-300 rounded-xl text-red-900 text-xs flex flex-col gap-2.5">
                <div className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-red-600 text-[18px] shrink-0">warning</span>
                  <div className="flex flex-col gap-1">
                    <span className="font-bold text-red-800">
                      Không còn ô kho cùng loại ({contract.unitTypeName}) để gán mới{reassignRequestedMonths ? ` cho gói +${reassignRequestedMonths} tháng` : ''}
                    </span>
                    <span>
                      {reassignNote || `Hiện cơ sở đã hết ô kho trống thuộc loại ${contract.unitTypeName} trong khoảng thời gian quý khách yêu cầu gia hạn. Quý khách vui lòng đặt thuê loại kho khác và hẹn ngày trả ô kho hiện tại.`}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href="/tim-kho"
                    className="px-3 py-1.5 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors cursor-pointer"
                  >
                    Đặt loại kho khác
                  </a>
                  {reassignRequestedMonths && selectedMonths < reassignRequestedMonths && (
                    <button
                      type="button"
                      disabled={reassignLoading}
                      onClick={handleRequestReassign}
                      className="px-3 py-1.5 rounded-lg bg-amber-600 text-white font-semibold hover:bg-amber-700 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {reassignLoading ? 'Đang gửi...' : `Yêu cầu gán ô cho gói ngắn hơn (+${selectedMonths} tháng)`}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setActiveTab('checkout')}
                    className="px-3 py-1.5 rounded-lg bg-white border border-red-300 text-red-700 font-semibold hover:bg-red-100 cursor-pointer"
                  >
                    Chuyển sang Hẹn trả kho
                  </button>
                </div>
              </div>
            )}
            {renewBlocked && reassignStatus !== 'OUT_OF_STOCK' && (
              reassignStatus === 'PENDING' ? (
                <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs flex flex-col gap-2.5">
                  <div className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-amber-600 text-[18px] shrink-0">pending_actions</span>
                    <div className="flex flex-col gap-1">
                      <span className="font-bold text-amber-900">
                        Đã gửi yêu cầu gán lại ô kho mới (Gói +{reassignRequestedMonths} tháng) — Đang chờ Quản lý xử lý
                      </span>
                      <span>
                        {eligibility?.blockedReason || 'Ô kho hiện tại đã có khách khác đặt trước, không thể gia hạn trực tiếp.'}
                      </span>
                      <span className="text-amber-800">
                        Quản lý cơ sở sẽ kiểm tra và gán ô kho mới cùng loại ({contract.unitTypeName}) nếu vẫn còn trống trong khoảng thời gian này, hoặc thông báo nếu bạn cần đặt loại kho khác.
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {selectedMonths !== reassignRequestedMonths && (
                      <button
                        type="button"
                        disabled={reassignLoading}
                        onClick={handleRequestReassign}
                        className="px-3 py-1.5 rounded-lg bg-amber-600 text-white font-semibold hover:bg-amber-700 transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-[16px]">swap_horiz</span>
                        <span>{reassignLoading ? 'Đang cập nhật...' : `Cập nhật yêu cầu sang gói +${selectedMonths} tháng`}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setActiveTab('checkout')}
                      className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-800 font-semibold hover:bg-amber-100 cursor-pointer"
                    >
                      Chuyển sang Hẹn trả kho
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs flex flex-col gap-2.5">
                  <div className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-red-600 text-[18px] shrink-0">block</span>
                    <div className="flex flex-col gap-1">
                      <span className="font-bold">Không thể gia hạn trực tiếp trên ô kho {contract.storageUnitId}</span>
                      <span>
                        {eligibility?.blockedReason
                          || (eligibility?.currentUnitFreeUntil
                            ? `Ô kho ${contract.storageUnitId} chỉ trống đến ngày ${formatDate(eligibility.currentUnitFreeUntil)} (đã có khách khác đặt trước), không đủ cho gói +${selectedMonths} tháng. Vui lòng liên hệ Quản lý để gán ô kho mới cùng loại.`
                            : 'Ô kho đã có khách khác đặt trước, không thể gia hạn. Vui lòng liên hệ Quản lý để gán ô kho mới cùng loại.')}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={reassignLoading}
                      onClick={handleRequestReassign}
                      className="px-3.5 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-[16px]">swap_horiz</span>
                      <span>
                        {reassignLoading
                          ? 'Đang gửi yêu cầu...'
                          : `Yêu cầu Quản lý gán lại ô kho mới (+${selectedMonths} tháng)`}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('checkout')}
                      className="px-3 py-2 rounded-lg bg-white border border-red-300 text-red-700 font-semibold hover:bg-red-100 cursor-pointer"
                    >
                      Chuyển sang Hẹn trả kho
                    </button>
                  </div>
                </div>
              )
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

            {/* D-21 / PR-O24: còn yêu cầu hỗ trợ chưa xong — phải xử lý xong trước buổi nghiệm thu */}
            {openTickets.length > 0 && (
              <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex flex-col gap-1.5">
                <span className="font-bold flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px]">support_agent</span>
                  Hợp đồng còn {openTickets.length} yêu cầu hỗ trợ chưa đóng
                </span>
                <ul className="list-disc pl-5">
                  {openTickets.map((t) => (
                    <li key={t.id}>
                      <span className="font-mono">{t.ticketCode}</span> — {t.status === 'RESOLVED' ? 'đã xử lý, chờ bạn xác nhận' : 'đang xử lý'}
                    </li>
                  ))}
                </ul>
                <span>
                  Các yêu cầu này phải xử lý xong trước buổi nghiệm thu. Tiền bồi thường hàng (nếu có) sẽ được cộng vào quyết toán trả kho.
                </span>
              </div>
            )}

            {/* Date Selection Section */}
            <label className="text-xs sm:text-sm text-slate-800 font-semibold mb-2 block" htmlFor="checkoutDateInput">
              {isOverdue
                ? `Hợp đồng đã quá hạn - Chọn ngày trả kho (chậm nhất ${formatDate(maxCheckoutDate)}):`
                : isTerminationPending
                ? `Chọn ngày dời lịch trả kho (trễ tối đa 5 ngày sau hạn HĐ — chậm nhất ${formatDate(maxCheckoutDate)}):`
                : `Chọn ngày dọn đồ & trả kho (trễ tối đa 5 ngày sau hạn HĐ — chậm nhất ${formatDate(maxCheckoutDate)}):`}
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
              {(isOverdue || isGraceOrOverdue) && (
                <span className="text-[11px] text-red-700 bg-red-100 font-semibold px-2 py-0.5 rounded shrink-0">
                  Trả trễ (≤ 5 ngày)
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

            {/* Vấn đề 3A & 3B: Chiết tính chi tiết phí phạt trả kho trễ hạn (tối đa 5 ngày trước khi cưỡng chế dọn kho) */}
            {(isGraceOrOverdue || isOverdue) && (() => {
              const daysLate = preview?.daysPastEndDate != null
                ? Number(preview.daysPastEndDate)
                : (checkoutDate && contract?.endDate
                  ? Math.max(0, Math.round((new Date(`${checkoutDate}T00:00:00`) - new Date(`${contract.endDate}T00:00:00`)) / 86400000))
                  : 0)
              const depositHeldNum = Number(preview?.depositHeld ?? contract?.depositHeldAmount ?? 0)
              const dailyRent = Math.round(basePrice / 30)
              const overstayRatePct = contract?.lateFeeWaived ? (contract?.overstayFeeWaived ? 0 : 100) : 150
              const dailyOverstay = Math.round((basePrice * overstayRatePct) / (30 * 100))
              const previewLateFee = preview?.lateFee != null
                ? Number(preview.lateFee)
                : (contract?.lateFeeWaived ? 0 : Math.min(Math.round(depositHeldNum * 0.5), Math.round(depositHeldNum * 0.1 * Math.min(daysLate, 5))))
              const previewOverstayFee = preview?.overstayFee != null
                ? Number(preview.overstayFee)
                : dailyOverstay * daysLate
              const totalLateDeduction = previewLateFee + previewOverstayFee
              const netAfterLate = depositHeldNum - totalLateDeduction
              return (
                <div className="bg-[#FFF8EE] border-2 border-[#FF9600] rounded-xl p-3.5 my-3 flex flex-col gap-2.5 text-xs text-[#4B4B4B]">
                  <div className="flex items-center justify-between gap-2 border-b border-[#FFD591] pb-2">
                    <span className="font-black uppercase text-[#E58800] flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[18px]">warning</span>
                      Chiết tính phí trả kho trễ hạn ({daysLate} ngày sau hạn HĐ)
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-[#FFDFDF] text-[#EA2B2B] font-black text-[10px]">
                      Trễ tối đa 5 ngày
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-[#777777] font-semibold">
                        Hạn hợp đồng → Ngày hẹn trả:
                      </span>
                      <span className="font-bold text-[#4B4B4B]">
                        {formatDate(contract.endDate)} → {formatDate(checkoutDate)} ({daysLate} ngày trễ)
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#777777] font-semibold">
                        1. Phí phạt trễ hạn (10% cọc/ngày · trần 50% cọc {formatVND(Math.round(depositHeldNum * 0.5))}):
                      </span>
                      <span className="font-black text-[#EA2B2B]">
                        {contract?.lateFeeWaived ? '0₫ (Đã miễn)' : `−${formatVND(previewLateFee)}`}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#777777] font-semibold">
                        2. Phí chiếm dụng ô ({overstayRatePct}% giá thuê ngày · giá ngày = {formatVND(basePrice)}/30 = {formatVND(dailyRent)}):
                      </span>
                      <span className="font-black text-[#EA2B2B]">
                        {overstayRatePct === 0 ? '0₫ (Đã miễn)' : `−${formatVND(previewOverstayFee)}`}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-dashed border-[#FFD591] pt-1.5">
                      <span className="font-bold text-[#4B4B4B]">Tổng phí trễ &amp; chiếm dụng khấu trừ vào cọc:</span>
                      <span className="font-black text-[#EA2B2B]">−{formatVND(totalLateDeduction)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-bold text-[#4B4B4B]">
                        {netAfterLate >= 0 ? 'Dự kiến tiền cọc còn hoàn lại (từ cọc gốc ' + formatVND(depositHeldNum) + '):' : 'Dự kiến khoản nợ vượt cọc cần đóng thêm:'}
                      </span>
                      <span className={`font-black ${netAfterLate >= 0 ? 'text-[#58A700]' : 'text-[#EA2B2B]'}`}>
                        {netAfterLate >= 0 ? formatVND(netAfterLate) : formatVND(Math.abs(netAfterLate))}
                      </span>
                    </div>
                  </div>
                  <div className="rounded-lg bg-white/90 border border-[#FFD591] p-2.5 text-[11px] font-semibold text-[#92400E] leading-relaxed">
                    <strong>Lưu ý quy định 5 ngày:</strong> Quý khách chỉ có thể hẹn trả kho trễ tối đa <strong>5 ngày</strong> sau hạn hợp đồng (chậm nhất ngày <strong>{formatDate(maxGraceCheckoutDate)}</strong>). Sau ngày thứ 5 quá hạn, hàng hóa trong ô sẽ tự động bị cưỡng chế dọn và chuyển vào <strong>kho tổng</strong> — khi đó quý khách phải làm theo luồng nhận lại hàng từ kho tổng.
                  </div>
                </div>
              )
            })()}

            {/* D-22: bảng "Bạn đã đóng − Cơ sở giữ lại = Dự kiến hoàn" — backend tính bằng đúng công thức lúc nghiệm thu,
                dòng "Đã đóng" khớp màn hợp đồng (cọc + tiền thuê kỳ hiện tại + bảo hiểm) */}
            {checkoutDate && (
              <div className="my-3 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-[#4B4B4B] flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[18px] text-[#1CB0F6]">calculate</span>
                    Dự kiến quyết toán nếu trả ngày {formatDate(checkoutDate)}
                  </span>
                  {isEarlyCheckout && <span className="text-[10px] font-black uppercase text-[#58A700]">Trả sớm (PR-O2)</span>}
                  {isGraceOrOverdue && <span className="text-[10px] font-black uppercase text-[#E58800]">Quá hạn</span>}
                </div>
                {preview?.lines ? (
                  <MoneyBreakdownTable lines={preview.lines} viewer="CUSTOMER" estimate />
                ) : (
                  <div className="text-xs font-bold text-[#AFAFAF] border-2 border-dashed border-[#E5E5E5] rounded-xl p-3">
                    Đang tính số tiền theo ngày bạn chọn...
                  </div>
                )}
                {/* PR-O19c: tiền đền bù là khoản riêng FM chi — không cộng vào số dự kiến hoàn trả kho */}
                <SeparateCompensationBox items={preview?.separateCompensations} viewer="CUSTOMER" />
                <p className="text-[11px] font-semibold text-[#777777] leading-relaxed">
                  Số chốt cuối cùng theo biên bản nghiệm thu (phí sự cố lỗi khách nếu có). Sau nghiệm thu bạn nhận bảng quyết toán cùng bố cục này và xác nhận để kết thúc hợp đồng.
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
                    Hình thức nhận tiền hoàn{expectedTotalRefund != null ? ` (dự kiến ${formatVND(expectedTotalRefund)})` : ''} *
                  </span>
                </div>
                {expectedNet != null && expectedNet < 0 && (
                  <p className="-mt-1.5 text-[11px] font-semibold text-[#FF4B4B]">
                    Theo ngày bạn chọn, phí vượt tiền cọc: bạn cần trả thêm {formatVND(Math.abs(expectedNet))} khi xác nhận quyết toán.
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
      <PaymentConfirmModal
        open={renewConfirmOpen}
        title="Xác nhận thanh toán gia hạn"
        subtitle={`Hợp đồng ${contract?.contractCode || ''} · gia hạn ${selectedMonths} tháng`}
        lines={[
          { label: `Tiền thuê ${selectedMonths} tháng`, amount: currentPricing.subtotal },
          { label: `Ưu đãi gia hạn ${currentPricing.discountPercent || 0}%`, amount: currentPricing.discountAmount, minus: true },
          { label: 'Phí bảo hiểm', amount: Number(currentQuote?.insuranceAmount || 0) },
          { label: 'Phí trễ hạn', amount: lateFee },
          { label: 'Phí chiếm dụng ô', amount: overstayFee },
        ]}
        total={totalPayment}
        note={isTerminationPending ? 'Gia hạn sẽ huỷ yêu cầu trả kho đang chờ của bạn.' : undefined}
        submitting={renewLoading}
        onConfirm={doRenew}
        onCancel={() => setRenewConfirmOpen(false)}
      />
    </div>
  )
}
