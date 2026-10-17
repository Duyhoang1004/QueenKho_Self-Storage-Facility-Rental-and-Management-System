import React, { useState, useEffect } from 'react'
import { requestCheckout } from '../services/contractService'
import { createVnpayRenewal } from '../services/vnpayService'

function formatVND(v) {
  if (v == null || isNaN(v)) return '0₫'
  return Number(v).toLocaleString('vi-VN') + '₫'
}

function formatDate(val) {
  if (!val) return '—'
  const [y, m, d] = String(val).split('-')
  return `${d}/${m}/${y}`
}

export default function ContractOptionsModal({ isOpen, onClose, contract, onSuccess }) {
  const [activeTab, setActiveTab] = useState('renew') // 'renew' | 'checkout'

  // Tab 1 state: Gia hạn
  const [selectedMonths, setSelectedMonths] = useState(6)
  const [renewLoading, setRenewLoading] = useState(false)
  const [renewError, setRenewError] = useState('')

  // Tab 2 state: Trả kho (PR-O1, PR-O2, PR-O3, PR-O14)
  const [checkoutDate, setCheckoutDate] = useState('')
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')
  const [refundMethod, setRefundMethod] = useState('BANK_TRANSFER')
  const [bankName, setBankName] = useState('')
  const [bankAccountNumber, setBankAccountNumber] = useState('')
  const [bankAccountName, setBankAccountName] = useState('')

  const isTerminationPending = contract?.status === 'TERMINATION_PENDING'
  const today = new Date().toISOString().split('T')[0]
  const isOverdue = contract?.status === 'OVERDUE' || (contract?.endDate && contract.endDate < today)
  const prevScheduledDate = contract?.scheduledCheckoutDate || contract?.endDate

  const addDays = (dateStr, days) => {
    if (!dateStr) return undefined
    const d = new Date(dateStr)
    d.setDate(d.getDate() + days)
    return d.toISOString().slice(0, 10)
  }

  // PR-O1: HĐ ACTIVE cho phép hẹn đến end_date + 5 ngày; HĐ OVERDUE hẹn trong 3 ngày tới
  const maxCheckoutDate = isOverdue
    ? addDays(today, 3)
    : isTerminationPending
    ? (prevScheduledDate || addDays(contract?.endDate, 5))
    : addDays(contract?.endDate, 5)

  useEffect(() => {
    if (contract) {
      if (contract.status === 'TERMINATION_PENDING') {
        setActiveTab('checkout')
      }
      const initialDate = contract.scheduledCheckoutDate || (isOverdue ? today : contract.endDate)
      if (initialDate && initialDate >= today) {
        setCheckoutDate(initialDate)
      } else {
        setCheckoutDate(today)
      }
    }
  }, [contract, isOverdue, today])

  const basePrice = Number(contract?.basePriceMonthly || 0)
  const depositAmount = contract?.depositHeldAmount != null ? formatVND(contract.depositHeldAmount) : '—'

  // Tính hạn mới sau gia hạn
  const calculateNewEndDate = (months) => {
    let base = new Date()
    if (contract?.endDate) {
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

  // Tính giá & chiết khấu
  const getPricing = (months) => {
    const subtotal = basePrice * months
    let discountPercent = 0
    if (months === 12) discountPercent = 10
    else if (months === 6) discountPercent = 5

    const discountAmount = Math.round((subtotal * discountPercent) / 100)
    const total = subtotal - discountAmount
    return { subtotal, discountPercent, discountAmount, total }
  }

  const currentPricing = getPricing(selectedMonths)

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

    if (checkoutDate < today) {
      setCheckoutError('Ngày hẹn trả kho không thể là ngày trong quá khứ.')
      return
    }

    if (isOverdue && maxCheckoutDate && checkoutDate > maxCheckoutDate) {
      setCheckoutError(`Hợp đồng đã quá hạn (${formatDate(contract.endDate)}). Quý khách chỉ có thể hẹn trả kho trong tối đa 3 ngày tới (đến ngày ${formatDate(maxCheckoutDate)}).`)
      return
    }

    if (!isTerminationPending && maxCheckoutDate && checkoutDate > maxCheckoutDate) {
      setCheckoutError(`Ngày hẹn trả kho không được vượt quá 5 ngày ân hạn sau khi hết hạn hợp đồng (${formatDate(maxCheckoutDate)}).`)
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

    setCheckoutLoading(true)
    setCheckoutError('')
    try {
      const res = await requestCheckout(contract.contractId, {
        checkoutDate,
        bankName: refundMethod === 'BANK_TRANSFER' ? bankName.trim() : null,
        bankAccountNumber: refundMethod === 'BANK_TRANSFER' ? bankAccountNumber.trim() : null,
        bankAccountName: refundMethod === 'BANK_TRANSFER' ? bankAccountName.trim() : null,
        notes: refundMethod === 'CASH'
          ? 'Khách hàng chọn nhận tiền mặt trực tiếp tại quầy'
          : `Hoàn tiền chuyển khoản qua ${bankName.trim()} - STK: ${bankAccountNumber.trim()} (${bankAccountName.trim()})`,
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

  // Bảng tính dự kiến trả sớm (PR-O2) và phí ân hạn (PR-O14)
  const isEarlyCheckout = checkoutDate && contract?.endDate && checkoutDate < contract.endDate
  const isGraceOrOverdue = checkoutDate && contract?.endDate && checkoutDate > contract.endDate

  let earlyRefundCalc = null
  if (isEarlyCheckout) {
    const sDate = new Date(contract.startDate || today)
    const cDate = new Date(checkoutDate)
    let months = (cDate.getFullYear() - sDate.getFullYear()) * 12 + (cDate.getMonth() - sDate.getMonth())
    if (cDate.getDate() > sDate.getDate()) {
      months += 1
    }
    const usedMonths = Math.max(1, months)
    const cycleMonths = contract.billingCycleMonths || 1
    let discountRate = 0
    if (cycleMonths >= 12) discountRate = 0.15
    else if (cycleMonths >= 6) discountRate = 0.10
    else if (cycleMonths >= 3) discountRate = 0.05

    const rentPaid = Math.round(basePrice * cycleMonths * (1 - discountRate))
    const breakFee = basePrice
    const usedCost = basePrice * usedMonths
    const earlyRentRefund = Math.max(0, rentPaid - usedCost - breakFee)

    earlyRefundCalc = {
      usedMonths,
      cycleMonths,
      rentPaid,
      breakFee,
      earlyRentRefund,
    }
  }

  let graceCalc = null
  if (isGraceOrOverdue) {
    const eDate = new Date(contract.endDate)
    const cDate = new Date(checkoutDate)
    const diffDays = Math.ceil(Math.abs(cDate - eDate) / (1000 * 60 * 60 * 24))
    if (diffDays === 1) {
      graceCalc = { days: diffDays, fee: 0, isFree: true }
    } else if (diffDays >= 2 && diffDays <= 5) {
      graceCalc = { days: diffDays, fee: Math.round((basePrice / 30) * (diffDays - 1)), isFree: false }
    } else {
      graceCalc = { days: diffDays, fee: Math.round((contract.depositHeldAmount || basePrice) * Math.min(diffDays, 5) * 0.10), isOverdue: true }
    }
  }

  if (!isOpen || !contract) return null

  const isMatchedExpiry = checkoutDate && contract.endDate && checkoutDate === contract.endDate

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-[580px] max-w-xl bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col relative transition-all animate-in fade-in zoom-in-95 duration-200">
        
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

        {/* Tab 1: Gia Hạn Thuê (UC-21) */}
        {activeTab === 'renew' && (
          isTerminationPending ? (
            <div className="px-6 py-10 flex flex-col items-center justify-center text-center gap-3">
              <div className="w-14 h-14 rounded-full bg-amber-50 border-2 border-amber-200 flex items-center justify-center text-amber-600">
                <span className="material-symbols-outlined text-[32px]">warning</span>
              </div>
              <h3 className="font-title-md text-base font-bold text-slate-800">
                Không thể gia hạn vì HĐ đã vào trạng thái chờ trả kho.
              </h3>
              <p className="text-xs text-slate-500 max-w-md leading-relaxed">
                Hợp đồng này đang trong tiến trình chờ trả kho và kiểm tra khoang. Quý khách có thể chuyển sang phần <strong className="text-slate-700">"Hẹn Ngày Trả Kho"</strong> để dời ngày trả kho sớm hơn nếu cần.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('checkout')}
                className="mt-2 px-5 py-2.5 rounded-lg bg-primary hover:bg-primary-hover text-white font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <span className="material-symbols-outlined text-[18px]">event_available</span>
                Chuyển sang Hẹn Ngày Trả Kho
              </button>
            </div>
          ) : (
            <form onSubmit={handleRenewSubmit} className="px-6 pt-2 pb-5 space-y-4">
              {renewError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
                  <span className="material-symbols-outlined text-red-600 text-[18px]">error</span>
                  <span>{renewError}</span>
                </div>
              )}

              {/* Chọn gói gia hạn */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-title-md text-xs sm:text-sm text-slate-800 font-semibold">
                    Chọn gói thời gian gia hạn thêm:
                  </span>
                  <span className="text-xs text-blue-600 font-semibold">Tiết kiệm đến 10%</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[
                    { m: 1, label: '+1 Tháng', desc: 'Chu kỳ gốc', discount: 0 },
                    { m: 3, label: '+3 Tháng', desc: 'Không ưu đãi', discount: 0 },
                    { m: 6, label: '+6 Tháng', desc: 'Giảm 5%', popular: true, discount: 5 },
                    { m: 12, label: '+12 Tháng', desc: 'Giảm 10%', best: true, discount: 10 },
                  ].map((item) => {
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
                    {calculateNewEndDate(selectedMonths)}
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
                <div className="pt-2.5 border-t border-slate-200 flex items-baseline justify-between">
                  <div>
                    <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500 block">
                      TỔNG THANH TOÁN
                    </span>
                    <span className="text-[11px] text-slate-400">Đã bao gồm VAT & phí bảo hiểm kho</span>
                  </div>
                  <span className="text-lg sm:text-xl font-extrabold text-primary">
                    {formatVND(currentPricing.total)}
                  </span>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={renewLoading}
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
          )
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
                <input
                  id="checkoutDateInput"
                  type="date"
                  value={checkoutDate}
                  min={today}
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
              {!isOverdue && isGraceOrOverdue && (
                <span className="text-[11px] text-amber-700 bg-amber-100 font-semibold px-2 py-0.5 rounded shrink-0">
                  Ân hạn 5 ngày
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
                    <span className="font-bold text-red-600">- {formatVND(earlyRefundCalc.usedMonths * basePrice)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Phí phá vỡ hợp đồng sớm (1 tháng giá gốc):</span>
                    <span className="font-bold text-red-600">- {formatVND(earlyRefundCalc.breakFee)}</span>
                  </div>
                  <div className="flex justify-between border-t border-[#D0F8AB] pt-1 text-xs">
                    <span className="font-black text-[#2B5300]">Tiền thuê dự kiến hoàn lại:</span>
                    <span className="font-black text-sm text-[#58A700]">+{formatVND(earlyRefundCalc.earlyRentRefund)}</span>
                  </div>
                </div>
                <span className="text-[10px] text-[#2B5300]/80">
                  * Tiền cọc giữ chỗ ({depositAmount}) sẽ được hoàn trả riêng sau khi nhân viên nghiệm thu khoang trống.
                </span>
              </div>
            )}

            {/* Thông tin ân hạn dọn đồ (PR-O14) */}
            {isGraceOrOverdue && graceCalc && (
              <div className={`p-3.5 rounded-xl border my-3 text-xs flex flex-col gap-1 ${graceCalc.isFree ? 'bg-blue-50 border-blue-200 text-blue-900' : 'bg-amber-50 border-amber-200 text-amber-900'}`}>
                <div className="flex items-center gap-1.5 font-bold">
                  <span className="material-symbols-outlined text-[20px]">{graceCalc.isFree ? 'info' : 'warning'}</span>
                  <span className="font-black text-sm">
                    {graceCalc.isFree ? 'Ân hạn dọn đồ miễn phí (PR-O14)' : 'Phí ân hạn dọn đồ (PR-O14)'}
                  </span>
                </div>
                <p className="leading-relaxed text-[11px]">
                  {graceCalc.isFree
                    ? 'Ngày đầu tiên sau khi kết thúc hợp đồng được miễn phí hoàn toàn để quý khách thuận tiện chuyển đồ.'
                    : `Ngày thứ ${graceCalc.days} sau hạn HĐ: Tính tiền thuê theo ngày (${formatVND(Math.round(basePrice / 30))}/ngày). Phí ân hạn dự kiến: ${formatVND(graceCalc.fee)} (sẽ được khấu trừ trực tiếp vào tiền cọc khi nghiệm thu).`}
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
                    Hạn HĐ kết thúc ngày {formatDate(contract.endDate)}. Phí phạt trễ hạn được tính tối đa 50% tiền cọc ({depositAmount}) theo PR-Q3 và khấu trừ khi nghiệm thu.
                  </p>
                </div>
              </div>
            )}

            {/* Chọn phương thức nhận tiền hoàn (PR-O3, L-18) */}
            <div className="flex flex-col gap-2 my-2 pt-2 border-t border-slate-100">
              <label className="text-xs font-bold text-slate-700">Phương thức nhận lại tiền cọc / tiền hoàn:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRefundMethod('BANK_TRANSFER')}
                  className={`p-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                    refundMethod === 'BANK_TRANSFER' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">account_balance</span>
                  Chuyển khoản ngân hàng
                </button>
                <button
                  type="button"
                  onClick={() => setRefundMethod('CASH')}
                  className={`p-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                    refundMethod === 'CASH' ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">payments</span>
                  Tiền mặt tại quầy
                </button>
              </div>

              {refundMethod === 'BANK_TRANSFER' ? (
                <div className="flex flex-col gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">Tên ngân hàng thụ hưởng *:</label>
                    <input
                      type="text"
                      placeholder="VD: Vietcombank, Techcombank, MB Bank..."
                      value={bankName}
                      onChange={e => setBankName(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-primary"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Số tài khoản *:</label>
                      <input
                        type="text"
                        placeholder="Số tài khoản..."
                        value={bankAccountNumber}
                        onChange={e => setBankAccountNumber(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-primary"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Tên chủ tài khoản *:</label>
                      <input
                        type="text"
                        placeholder="NGUYEN VAN A"
                        value={bankAccountName}
                        onChange={e => setBankAccountName(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-primary uppercase"
                        required
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-xs text-emerald-900 leading-relaxed">
                  Quý khách sẽ ký nhận tiền mặt trực tiếp từ Quản lý cơ sở sau khi nhân viên hoàn tất biên bản nghiệm thu trả kho tại quầy.
                </div>
              )}
            </div>

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
