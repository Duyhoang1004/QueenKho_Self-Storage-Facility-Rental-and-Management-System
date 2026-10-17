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

  // Tab 2 state: Trả kho & Hoàn cọc
  const [checkoutDate, setCheckoutDate] = useState('')
  const [bankName, setBankName] = useState('')
  const [bankAccountNumber, setBankAccountNumber] = useState('')
  const [bankAccountName, setBankAccountName] = useState('')
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')

  const isTerminationPending = contract?.status === 'TERMINATION_PENDING'
  const today = new Date().toISOString().split('T')[0]
  const isOverdue = contract?.status === 'OVERDUE' || (contract?.endDate && contract.endDate < today)
  const prevScheduledDate = contract?.scheduledCheckoutDate || contract?.endDate

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

      // Tự động gợi ý tên chủ tài khoản từ thông tin khách hàng nếu chưa điền
      if (!bankAccountName) {
        let fallbackName = contract.customerFullName || ''
        if (!fallbackName) {
          try {
            const userStr = localStorage.getItem('user')
            if (userStr) {
              const u = JSON.parse(userStr)
              fallbackName = u.fullName || u.name || ''
            }
          } catch (e) {}
        }
        if (fallbackName) {
          setBankAccountName(fallbackName.toUpperCase())
        }
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

  // UC-22: Xử lý Hẹn ngày trả kho, dời ngày sớm hơn & thông tin hoàn cọc
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

    if (isOverdue && checkoutDate > today) {
      setCheckoutError(`Hợp đồng đã quá hạn (${formatDate(contract.endDate)}). Quý khách chỉ có thể hẹn trả kho trong ngày hôm nay.`)
      return
    }

    if (!isTerminationPending && contract.endDate && checkoutDate > contract.endDate) {
      setCheckoutError(`Không thể hẹn ngày trả kho sau ngày kết thúc hợp đồng (${formatDate(contract.endDate)}). Vui lòng chọn ngày trước hạn hoặc thực hiện gia hạn hợp đồng.`)
      return
    }

    if (isTerminationPending && prevScheduledDate && checkoutDate > prevScheduledDate) {
      setCheckoutError(`Không thể dời ngày qua sau ngày trả kho đã thực hiện trước đó (${formatDate(prevScheduledDate)}).`)
      return
    }

    const depositVal = Number(contract.depositHeldAmount || 0)
    if (depositVal > 0) {
      if (!bankName.trim() || !bankAccountNumber.trim() || !bankAccountName.trim()) {
        setCheckoutError('Vui lòng nhập đầy đủ thông tin tài khoản ngân hàng để nhận hoàn tiền cọc.')
        return
      }
    }

    setCheckoutLoading(true)
    setCheckoutError('')
    try {
      const res = await requestCheckout(contract.contractId, {
        checkoutDate,
        bankName: bankName.trim(),
        bankAccountNumber: bankAccountNumber.trim(),
        bankAccountName: bankAccountName.trim().toUpperCase(),
        notes: `Hẹn trả kho ngày ${checkoutDate}`,
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
                ? 'Hợp đồng đã quá hạn - Chọn ngày trả kho:'
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
                  max={isOverdue ? today : (isTerminationPending ? prevScheduledDate : contract?.endDate || undefined)}
                  onChange={(e) => setCheckoutDate(e.target.value)}
                  className="bg-transparent border-0 p-0 text-slate-800 font-semibold text-sm focus:outline-none w-full cursor-pointer"
                  required
                />
              </div>
              {isOverdue && (
                <span className="text-[11px] text-red-700 bg-red-100 font-semibold px-2 py-0.5 rounded shrink-0">
                  Chỉ trong ngày (Quá hạn)
                </span>
              )}
              {!isOverdue && isTerminationPending && prevScheduledDate && checkoutDate === prevScheduledDate && (
                <span className="text-[11px] text-amber-700 bg-amber-100 font-medium px-2 py-0.5 rounded shrink-0">
                  Ngày hẹn trước đó
                </span>
              )}
              {!isOverdue && !isTerminationPending && isMatchedExpiry && (
                <span className="text-[11px] text-slate-600 font-medium uppercase px-2 py-0.5 rounded bg-slate-200 shrink-0">
                  Khớp hạn HĐ
                </span>
              )}
            </div>

            {/* Warning Box */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 my-3 flex items-start gap-3">
              <span className="material-symbols-outlined text-red-600 text-[22px] shrink-0 mt-0.5">
                {isOverdue ? 'error' : 'warning'}
              </span>
              <div className="flex flex-col">
                {isOverdue ? (
                  <>
                    <span className="text-xs sm:text-sm text-red-700 font-bold mb-0.5">
                      Hợp đồng đã quá hạn trả kho
                    </span>
                    <p className="text-xs sm:text-sm text-red-900 leading-relaxed">
                      Hợp đồng đã hết hạn vào ngày <strong className="text-red-700">{formatDate(contract.endDate)}</strong> ({contract.overdueDays || 1} ngày trễ).
                      Phí phạt trễ hạn là <strong className="text-red-700">{formatVND(contract.lateFeeAmount || 50000)}</strong> (50.000đ/ngày) và sẽ được khấu trừ trực tiếp vào tiền cọc (<strong className="font-semibold text-red-700">{depositAmount}</strong>) khi nhân viên nghiệm thu khoang. Tiền cọc ước tính còn lại: <strong className="text-emerald-700 font-bold">{formatVND(contract.estimatedDepositRefund != null ? contract.estimatedDepositRefund : 0)}</strong>.
                    </p>
                  </>
                ) : isTerminationPending ? (
                  <>
                    <span className="text-xs sm:text-sm text-red-700 font-bold mb-0.5">
                      Có thể dời ngày trả kho sớm hơn
                    </span>
                    <p className="text-xs sm:text-sm text-red-900 leading-relaxed">
                      Hệ thống không cho phép dời ngày qua sau ngày trả kho đã thực hiện trước đó ({formatDate(prevScheduledDate)}). Quý khách vui lòng chọn ngày sớm hơn hoặc bằng ngày đã hẹn và dọn sạch tài sản trước thời gian này để được hoàn 100% tiền cọc (<strong className="font-semibold text-red-700">{depositAmount}</strong>).
                    </p>
                  </>
                ) : (
                  <>
                    <span className="text-xs sm:text-sm text-red-700 font-bold mb-0.5">Quy định bàn giao & Hoàn cọc</span>
                    <p className="text-xs sm:text-sm text-red-900 leading-relaxed">
                      Lưu ý: Ngày hẹn trả kho không được vượt quá ngày hết hạn hợp đồng (<strong className="text-red-700">{formatDate(contract.endDate)}</strong>). Quý khách vui lòng dọn sạch tài sản trước ngày hẹn. Tiền cọc giữ chỗ (<strong className="font-semibold text-red-700">{depositAmount}</strong>) sẽ được hoàn trả 100% vào tài khoản sau khi nhân viên nghiệm thu khoang trống.
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Form thông tin ngân hàng nhận hoàn tiền */}
            {Number(contract.depositHeldAmount || 0) > 0 && (
              <div className="bg-[#DDF4FF] border-2 border-[#84D8FF] rounded-xl p-4 mb-3 flex flex-col gap-3">
                <div className="flex items-center gap-2 text-[#1899D6]">
                  <span className="material-symbols-outlined text-[20px]">
                    account_balance
                  </span>
                  <span className="text-xs font-black uppercase tracking-wider">
                    Thông tin tài khoản nhận hoàn tiền cọc ({depositAmount}) *
                  </span>
                </div>
                <p className="text-[11px] text-[#1899D6]/80 -mt-1 font-medium">
                  Vui lòng cung cấp chính xác thông tin để Quản lý cơ sở chuyển khoản hoàn trả sau khi nghiệm thu khoang.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
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
                      required
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
                      required
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
                      required
                      className="bg-white border-2 border-[#84D8FF] rounded-xl px-3 py-2 text-xs font-bold uppercase text-[#4B4B4B] outline-none focus:border-[#1CB0F6]"
                    />
                  </div>
                </div>
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
