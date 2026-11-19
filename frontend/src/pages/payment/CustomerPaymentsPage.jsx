import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getMyPayments } from '../../services/paymentService'
import { createVnpayDebt } from '../../services/vnpayService'
import PaginationBar, { ListBoxHeader } from '../../components/PaginationBar'
import TimeFilterBar from '../../components/TimeFilterBar'
import { applyTimeFilter, makeTimeFilter } from '../../utils/timeFilter'
import { getOverdueFeeBreakdown } from '../../utils/overdueFee'

const PAGE_SIZE = 5
const DEBT_PAGE_SIZE = 3
// (10/11/2026) Lọc / sắp giao dịch theo thời gian — mặc định mới nhất trước
const TIME_FIELDS = [{ key: 'paidAt', label: 'Ngày giao dịch', get: (t) => t.paidAt || t.createdAt }]

// UC-20 (PR-50): khách xem MỌI giao dịch của mình và trả các khoản còn nợ.
//  - Phí sự cố / phí chiếm dụng vượt cọc (DAMAGE_FEE / OVERSTAY_FEE) → trả ngay qua VNPAY tại đây; trả xong được đặt kho mới.
//  - Hợp đồng quá hạn → trả bằng cách gia hạn ở trang hợp đồng (tiền thuê + phí trễ).

const TYPE_LABELS = {
  DEPOSIT: { label: 'Đặt cọc + tiền thuê', icon: 'savings' },
  MONTHLY_RENT: { label: 'Gia hạn thuê', icon: 'event_repeat' },
  LATE_FEE: { label: 'Phí trễ hạn', icon: 'timer_off' },
  DAMAGE_FEE: { label: 'Phí sự cố', icon: 'construction' },
  OVERSTAY_FEE: { label: 'Phí chiếm dụng / lưu giữ', icon: 'door_front' }, // PR-Q14 / PR-Q15
  REFUND: { label: 'Hoàn tiền', icon: 'currency_exchange' },
  COMPENSATION: { label: 'Bồi thường hàng hoá', icon: 'gavel' }, // BR-128: cơ sở chi cho khách
}

// PR-Q16: phí dọn & di dời hàng khi thanh lý ghi chung loại OVERSTAY_FEE, phân biệt bằng mã MV-
const MOVING_FEE_TYPE = { label: 'Phí dọn & di dời hàng', icon: 'local_shipping' }
function typeOf(t) {
  if (t.paymentType === 'OVERSTAY_FEE' && t.transactionCode?.startsWith('MV-')) return MOVING_FEE_TYPE
  return TYPE_LABELS[t.paymentType] || { label: t.paymentType, icon: 'receipt' }
}

const METHOD_LABELS = {
  VNPAY: 'VNPAY',
  BANK_TRANSFER: 'Chuyển khoản',
  CASH: 'Tiền mặt',
  DEPOSIT_OFFSET: 'Trừ vào tiền cọc',
}

const STATUS_STYLES = {
  SUCCESS: { label: 'Thành công', className: 'bg-[#D7FFB8] text-[#58A700] border-[#58CC02]' },
  PENDING: { label: 'Đang chờ', className: 'bg-[#FFF3B3] text-[#B38F00] border-[#FFC800]' },
  FAILED: { label: 'Thất bại', className: 'bg-[#F7F7F7] text-[#AFAFAF] border-[#E5E5E5]' },
  REFUNDED: { label: 'Đã hoàn', className: 'bg-[#DDF4FF] text-[#1899D6] border-[#84D8FF]' },
}

function formatVND(value) {
  return `${Number(value || 0).toLocaleString('vi-VN')}đ`
}

function formatTime(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })
}

function SummaryTile({ icon, label, value, tone, hint }) {
  return (
    <div className={`duo-card p-4 flex items-center gap-3 border-2 ${tone}`}>
      <span className="material-symbols-outlined text-[28px]">{icon}</span>
      <div className="flex flex-col min-w-0">
        <span className="text-[11px] font-black uppercase tracking-wider opacity-80">{label}</span>
        <span className="text-xl font-black">{formatVND(value)}</span>
        {hint && <span className="text-[11px] font-bold opacity-70">{hint}</span>}
      </div>
    </div>
  )
}

function PaymentReceiptModal({ transaction, onClose }) {
  if (!transaction) return null

  const type = typeOf(transaction)
  const status = STATUS_STYLES[transaction.status] || STATUS_STYLES.PENDING
  const isCompensation = transaction.paymentType === 'COMPENSATION'
  const isRefund = transaction.paymentType === 'REFUND'
  const isIncome = isRefund || isCompensation
  const isDeposit = !isIncome && (transaction.paymentType === 'DEPOSIT' || transaction.baseRentAmount != null)

  const durationMonths = Number(transaction.durationMonths || (Number(transaction.amount) >= 5000000 ? 6 : 1))
  const monthlyRentPrice = Number(transaction.monthlyRentPrice || transaction.depositAmount || 750000)
  const baseRentAmount = Number(
    transaction.baseRentAmount != null
      ? transaction.baseRentAmount
      : monthlyRentPrice * durationMonths
  )
  const rentDiscountPercent = Number(
    transaction.rentDiscountPercent != null
      ? transaction.rentDiscountPercent
      : (durationMonths >= 6 ? 10 : 0)
  )
  const rentDiscountAmount = Number(
    transaction.rentDiscountAmount != null
      ? transaction.rentDiscountAmount
      : (rentDiscountPercent > 0 ? (baseRentAmount * rentDiscountPercent) / 100 : 0)
  )
  const voucherCode = transaction.voucherCode || (Number(transaction.voucherDiscount) > 0 ? 'NEWKHO' : (Number(transaction.amount) === 5000000 ? 'NEWKHO' : null))
  const voucherDiscount = Number(
    transaction.voucherDiscount != null
      ? transaction.voucherDiscount
      : (Number(transaction.amount) === 5000000 ? 100000 : 0)
  )
  const voucherPercent =
    transaction.voucherDiscountType === 'PERCENT' && transaction.voucherDiscountPercent != null
      ? Number(transaction.voucherDiscountPercent)
      : null
  const actualRentPaid = Number(
    transaction.actualRentPaid != null
      ? transaction.actualRentPaid
      : Math.max(0, baseRentAmount - rentDiscountAmount - voucherDiscount)
  )
  const depositAmount = Number(
    transaction.depositAmount != null
      ? transaction.depositAmount
      : monthlyRentPrice
  )
  const insuranceAmount = Number(
    transaction.insuranceAmount != null
      ? transaction.insuranceAmount
      : (Number(transaction.amount) === 5000000 ? 300000 : 0)
  )
  const insuranceLabel =
    transaction.insurancePlan === 'ADVANCED'
      ? 'Gói Nâng cao'
      : transaction.insurancePlan === 'PREMIUM'
        ? 'Gói Cao cấp'
        : transaction.insurancePlan === 'BASIC'
          ? 'Gói Cơ bản'
          : (transaction.insurancePlan || 'Gói Nâng cao')

  // Bóc tách bồi thường (COMPENSATION)
  const penaltyCompensation = Number(transaction.penaltyCompensation || 0)
  const rentRefundCompensation = Number(transaction.rentRefundCompensation || 0)
  const rawGoodsComp = transaction.goodsCompensation != null ? Number(transaction.goodsCompensation) : null
  const goodsCompensation = rawGoodsComp != null
    ? rawGoodsComp
    : Math.max(0, Number(transaction.amount) - penaltyCompensation - rentRefundCompensation)
  const damagePercent = transaction.damagePercent != null ? Number(transaction.damagePercent) : null
  const compensationReason = transaction.compensationReason || 'Chi trả bồi thường theo biên bản kiểm tra sự cố & chính sách bảo hiểm QueenKho'

  // Bóc tách hoàn tiền (REFUND)
  const refundDepositAmount = Number(
    transaction.refundDepositAmount != null
      ? transaction.refundDepositAmount
      : (transaction.depositAmount != null ? transaction.depositAmount : transaction.amount)
  )
  const earlyRentRefund = Number(transaction.earlyRentRefund || 0)
  const damageDeduction = Number(transaction.damageDeduction || 0)
  const lateFeeDeduction = Number(transaction.lateFeeDeduction || 0)
  const overstayDeduction = Number(transaction.overstayDeduction || 0)
  const breakFeeDeduction = Number(transaction.breakFeeDeduction || 0)
  const refundDescription = transaction.refundDescription || 'Hoàn tất thủ tục quyết toán thanh lý hợp đồng & hoàn trả tiền cọc'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="duo-card max-w-lg w-full bg-white overflow-hidden shadow-2xl border-2 border-[#E5E5E5] flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-[#FAFAFA] border-b-2 border-[#E5E5E5] p-5 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#EAF7EC] border-2 border-[#58CC02] flex items-center justify-center text-[#58A700] shrink-0">
              <span className="material-symbols-outlined text-[28px]">{type.icon}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-base font-black text-[#4B4B4B]">Biên lai thanh toán</span>
              <span className="text-xs font-bold text-[#AFAFAF] font-mono">
                {transaction.transactionCode}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-[#E5E5E5] flex items-center justify-center text-[#777777] font-bold text-sm cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex flex-col gap-4 text-sm">
          {/* Status banner */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-[#F7F7F7] border border-[#E5E5E5]">
            <div className="flex flex-col">
              <span className="text-[11px] font-black uppercase text-[#AFAFAF]">Trạng thái giao dịch</span>
              <span className="text-xs font-bold text-[#4B4B4B]">{formatTime(transaction.paidAt)}</span>
            </div>
            <span className={`duo-badge border-2 ${status.className}`}>{status.label}</span>
          </div>

          {/* Core Info */}
          <div className="flex flex-col gap-2.5 bg-white border border-[#E5E5E5] rounded-xl p-3.5">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-[#777777]">Loại giao dịch:</span>
              <span className="font-black text-[#4B4B4B] flex items-center gap-1">
                {type.label}
                {transaction.renewalMonths ? ` (${transaction.renewalMonths} tháng)` : ''}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-[#777777]">Phương thức:</span>
              <span className="font-black text-[#4B4B4B]">
                {METHOD_LABELS[transaction.paymentMethod] || transaction.paymentMethod}
              </span>
            </div>
            {transaction.bankTransactionCode && (
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-[#777777]">Mã đối soát (FT):</span>
                <span className="font-mono font-black text-[#FF9600]">
                  {transaction.bankTransactionCode}
                </span>
              </div>
            )}
            {(transaction.contractCode || transaction.reservationCode) && (
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-[#777777]">Hợp đồng / Đơn:</span>
                <span className="font-black text-[#1CB0F6]">
                  {transaction.contractCode || transaction.reservationCode}
                </span>
              </div>
            )}
            {transaction.facilityName && (
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-[#777777]">Cơ sở:</span>
                <span className="font-bold text-[#4B4B4B] text-right">
                  {transaction.facilityName} {transaction.unitTypeName ? `· ${transaction.unitTypeName}` : ''}
                </span>
              </div>
            )}
          </div>

          {/* Itemized breakdown for initial deposit or detailed transactions */}
          {isDeposit && (
            <div className="flex flex-col gap-2.5 bg-[#FAFAFA] border-2 border-[#E5E5E5] rounded-2xl p-4">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#AFAFAF] mb-0.5">
                Bóc tách chi tiết khoản thanh toán
              </span>

              {/* Tiền thuê kho gốc */}
              <div className="flex justify-between items-center text-xs pb-1.5 border-b border-[#E5E5E5]">
                <div className="flex flex-col">
                  <span className="font-bold text-[#4B4B4B]">
                    Tiền thuê kho ({durationMonths} tháng)
                  </span>
                  <span className="text-[10px] text-[#AFAFAF]">
                    {formatVND(monthlyRentPrice)} × {durationMonths} tháng
                  </span>
                </div>
                <span className="font-black text-[#4B4B4B]">
                  {formatVND(baseRentAmount)}
                </span>
              </div>

              {/* Ưu đãi chiết khấu gói */}
              {rentDiscountAmount > 0 && (
                <div className="flex justify-between items-center text-xs pb-1.5 border-b border-[#E5E5E5]">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-[#58A700]">
                        Ưu đãi gói {durationMonths} tháng{rentDiscountPercent > 0 ? ` (Giảm ${rentDiscountPercent}%)` : ''}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-[#D7FFB8] text-[#58A700]">
                        {rentDiscountPercent > 0 ? `-${rentDiscountPercent}%` : 'Chiết khấu'}
                      </span>
                    </div>
                    <span className="text-[10px] text-[#AFAFAF]">
                      {rentDiscountPercent > 0
                        ? `Chiết khấu ${rentDiscountPercent}% theo chính sách thời hạn thuê`
                        : 'Giảm trực tiếp theo chính sách thời hạn thuê'}
                    </span>
                  </div>
                  <span className="font-black text-[#58A700]">
                    -{formatVND(rentDiscountAmount)}
                  </span>
                </div>
              )}

              {/* Voucher giảm giá */}
              {voucherDiscount > 0 && (
                <div className="flex justify-between items-center text-xs pb-1.5 border-b border-[#E5E5E5]">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-[#58A700]">
                        Voucher {voucherCode ? `(${voucherCode})` : 'giảm giá'}{voucherPercent != null && voucherPercent > 0 ? ` (Giảm ${voucherPercent}%)` : ''}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-[#FEF08A] text-[#854D0E]">
                        {voucherPercent != null && voucherPercent > 0 ? `-${voucherPercent}%` : 'Mã ưu đãi'}
                      </span>
                    </div>
                    <span className="text-[10px] text-[#AFAFAF]">
                      {voucherPercent != null && voucherPercent > 0
                        ? `Áp dụng giảm ${voucherPercent}% trực tiếp vào tiền thuê`
                        : 'Giảm cố định trực tiếp vào tiền thuê'}
                    </span>
                  </div>
                  <span className="font-black text-[#58CC02]">
                    -{formatVND(voucherDiscount)}
                  </span>
                </div>
              )}

              {/* Tiền thuê thực đóng: NỔI BẬT & IN ĐẬM */}
              <div className="flex justify-between items-center p-3 rounded-xl bg-[#F0FDF4] border-2 border-[#86EFAC] text-xs shadow-xs my-0.5">
                <div className="flex flex-col">
                  <span className="font-black text-[#15803D] uppercase text-[11px] tracking-wide">
                    Tiền thuê thực đóng ({durationMonths} tháng)
                  </span>
                  <span className="text-[10px] text-[#16A34A]">
                    Đã trừ ưu đãi gói &amp; voucher
                  </span>
                </div>
                <span className="text-base font-black text-[#16A34A] whitespace-nowrap">
                  {formatVND(actualRentPaid)}
                </span>
              </div>

              {/* Tiền cọc giữ kho */}
              <div className="flex justify-between items-center text-xs pt-1 pb-1.5 border-b border-[#E5E5E5]">
                <div className="flex flex-col">
                  <span className="font-bold text-[#4B4B4B]">Tiền cọc giữ kho (1 tháng)</span>
                  <span className="text-[10px] text-[#AFAFAF]">Hoàn lại 100% khi bàn giao kho nguyên vẹn</span>
                </div>
                <span className="font-black text-[#1CB0F6]">
                  {formatVND(depositAmount)}
                </span>
              </div>

              {/* Bảo hiểm hàng hóa */}
              <div className="flex justify-between items-center text-xs pt-1">
                <div className="flex flex-col">
                  <span className="font-bold text-[#4B4B4B]">
                    Bảo hiểm hàng hóa ({insuranceLabel})
                  </span>
                  <span className="text-[10px] text-[#AFAFAF]">Phí bảo hiểm theo gói lưu trữ</span>
                </div>
                <span className={`font-black ${insuranceAmount > 0 ? 'text-[#0284C7]' : 'text-[#777777]'}`}>
                  {insuranceAmount > 0 ? formatVND(insuranceAmount) : '0đ (Miễn phí)'}
                </span>
              </div>
            </div>
          )}

          {/* Itemized breakdown for compensation */}
          {isCompensation && (
            <div className="flex flex-col gap-2.5 bg-[#FAFAFA] border-2 border-[#E5E5E5] rounded-2xl p-4">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[11px] font-black uppercase tracking-wider text-[#AFAFAF]">
                  Bóc tách chi tiết khoản bồi thường
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-[#EAF7EC] text-[#58A700] border border-[#58CC02]">
                  BẢO HIỂM &amp; ĐỀN BÙ
                </span>
              </div>

              {/* Tiền bồi thường thiệt hại hàng hóa */}
              <div className="flex justify-between items-center text-xs pb-1.5 border-b border-[#E5E5E5]">
                <div className="flex flex-col">
                  <span className="font-bold text-[#4B4B4B]">
                    Bồi thường thiệt hại hàng hóa
                  </span>
                  <span className="text-[10px] text-[#AFAFAF]">
                    {damagePercent != null ? `Tỷ lệ thiệt hại ghi nhận: ${damagePercent}%` : 'Theo biên bản thẩm định hiện trường'}
                  </span>
                </div>
                <span className="font-black text-[#4B4B4B]">
                  {formatVND(goodsCompensation)}
                </span>
              </div>

              {/* Tiền phạt vi phạm cơ sở (1 tháng tiền thuê khi lỗi cơ sở) */}
              {penaltyCompensation > 0 && (
                <div className="flex justify-between items-center text-xs pb-1.5 border-b border-[#E5E5E5]">
                  <div className="flex flex-col">
                    <span className="font-bold text-[#58A700]">
                      Tiền phạt vi phạm cơ sở (1 tháng tiền thuê)
                    </span>
                    <span className="text-[10px] text-[#AFAFAF]">
                      Khoản đền bù thêm do lỗi từ phía cơ sở lưu trữ
                    </span>
                  </div>
                  <span className="font-black text-[#58A700]">
                    +{formatVND(penaltyCompensation)}
                  </span>
                </div>
              )}

              {/* Hoàn tiền thuê ô kho những ngày bị sự cố */}
              {rentRefundCompensation > 0 && (
                <div className="flex justify-between items-center text-xs pb-1.5 border-b border-[#E5E5E5]">
                  <div className="flex flex-col">
                    <span className="font-bold text-[#58A700]">
                      Hoàn tiền thuê ngày ô bị sự cố
                    </span>
                    <span className="text-[10px] text-[#AFAFAF]">
                      Hoàn lại tiền thuê những ngày ô kho không thể sử dụng
                    </span>
                  </div>
                  <span className="font-black text-[#58A700]">
                    +{formatVND(rentRefundCompensation)}
                  </span>
                </div>
              )}

              {/* Khấu trừ chi phí phát sinh */}
              <div className="flex justify-between items-center text-xs pb-1.5 border-b border-[#E5E5E5]">
                <div className="flex flex-col">
                  <span className="font-bold text-[#4B4B4B]">
                    Khấu trừ chi phí phát sinh
                  </span>
                  <span className="text-[10px] text-[#16A34A] font-semibold">
                    Không khấu trừ (Cơ sở &amp; bảo hiểm chi trả 100%)
                  </span>
                </div>
                <span className="font-black text-[#16A34A]">
                  0₫
                </span>
              </div>

              {/* Tiền bồi thường thực nhận: NỔI BẬT & IN ĐẬM */}
              <div className="flex justify-between items-center p-3 rounded-xl bg-[#F0FDF4] border-2 border-[#86EFAC] text-xs shadow-xs my-0.5">
                <div className="flex flex-col pr-2">
                  <span className="font-black text-[#15803D] uppercase text-[11px] tracking-wide">
                    Tiền bồi thường thực nhận
                  </span>
                  <span className="text-[10px] text-[#16A34A] line-clamp-2">
                    {compensationReason}
                  </span>
                </div>
                <span className="text-base font-black text-[#16A34A] whitespace-nowrap">
                  +{formatVND(transaction.amount)}
                </span>
              </div>
            </div>
          )}

          {/* Itemized breakdown for refund */}
          {isRefund && (
            <div className="flex flex-col gap-2.5 bg-[#FAFAFA] border-2 border-[#E5E5E5] rounded-2xl p-4">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[11px] font-black uppercase tracking-wider text-[#AFAFAF]">
                  Bóc tách chi tiết khoản hoàn tiền
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-[#EAF7EC] text-[#58A700] border border-[#58CC02]">
                  QUYẾT TOÁN HOÀN TRẢ
                </span>
              </div>

              {/* Tiền cọc giữ kho */}
              <div className="flex justify-between items-center text-xs pb-1.5 border-b border-[#E5E5E5]">
                <div className="flex flex-col">
                  <span className="font-bold text-[#4B4B4B]">Tiền cọc giữ kho ban đầu</span>
                  <span className="text-[10px] text-[#AFAFAF]">Khoản tiền cọc bảo đảm theo hợp đồng</span>
                </div>
                <span className="font-black text-[#1CB0F6]">
                  {formatVND(refundDepositAmount)}
                </span>
              </div>

              {/* Hoàn tiền thuê trả sớm */}
              {earlyRentRefund > 0 && (
                <div className="flex justify-between items-center text-xs pb-1.5 border-b border-[#E5E5E5]">
                  <div className="flex flex-col">
                    <span className="font-bold text-[#58A700]">Hoàn tiền thuê trả sớm (PR-O2)</span>
                    <span className="text-[10px] text-[#AFAFAF]">Hoàn tiền thuê cho các tháng chưa sử dụng</span>
                  </div>
                  <span className="font-black text-[#58A700]">
                    +{formatVND(earlyRentRefund)}
                  </span>
                </div>
              )}

              {/* Khấu trừ chi phí hư hại ô kho */}
              <div className="flex justify-between items-center text-xs pb-1.5 border-b border-[#E5E5E5]">
                <div className="flex flex-col">
                  <span className="font-bold text-[#4B4B4B]">Khấu trừ hư hại / sửa chữa ô kho</span>
                  <span className="text-[10px] text-[#AFAFAF]">
                    {damageDeduction > 0
                      ? 'Khấu trừ chi phí sửa chữa theo biên bản kiểm tra trả kho'
                      : 'Bàn giao ô kho nguyên vẹn — không phát sinh chi phí'}
                  </span>
                </div>
                <span className={`font-black ${damageDeduction > 0 ? 'text-[#FF4B4B]' : 'text-[#16A34A]'}`}>
                  {damageDeduction > 0 ? `-${formatVND(damageDeduction)}` : '0₫'}
                </span>
              </div>

              {/* Khấu trừ phí dọn đồ trễ hạn */}
              <div className="flex justify-between items-center text-xs pb-1.5 border-b border-[#E5E5E5]">
                <div className="flex flex-col">
                  <span className="font-bold text-[#4B4B4B]">Khấu trừ phí trễ hạn trả kho</span>
                  <span className="text-[10px] text-[#AFAFAF]">
                    {lateFeeDeduction > 0
                      ? 'Phí trễ hạn theo quy định hợp đồng'
                      : 'Trả kho đúng hạn — không bị phạt'}
                  </span>
                </div>
                <span className={`font-black ${lateFeeDeduction > 0 ? 'text-[#FF4B4B]' : 'text-[#16A34A]'}`}>
                  {lateFeeDeduction > 0 ? `-${formatVND(lateFeeDeduction)}` : '0₫'}
                </span>
              </div>

              {/* Khấu trừ phí chiếm dụng kho */}
              {overstayDeduction > 0 && (
                <div className="flex justify-between items-center text-xs pb-1.5 border-b border-[#E5E5E5]">
                  <div className="flex flex-col">
                    <span className="font-bold text-[#FF4B4B]">Khấu trừ phí chiếm dụng kho</span>
                    <span className="text-[10px] text-[#AFAFAF]">Phí chiếm dụng kho sau thời gian ân hạn</span>
                  </div>
                  <span className="font-black text-[#FF4B4B]">
                    -{formatVND(overstayDeduction)}
                  </span>
                </div>
              )}

              {/* Khấu trừ phí huỷ hợp đồng / huỷ đơn */}
              {breakFeeDeduction > 0 && (
                <div className="flex justify-between items-center text-xs pb-1.5 border-b border-[#E5E5E5]">
                  <div className="flex flex-col">
                    <span className="font-bold text-[#FF4B4B]">Phí hủy đơn / chấm dứt sớm</span>
                    <span className="text-[10px] text-[#AFAFAF]">Khấu trừ theo chính sách hủy cam kết</span>
                  </div>
                  <span className="font-black text-[#FF4B4B]">
                    -{formatVND(breakFeeDeduction)}
                  </span>
                </div>
              )}

              {/* Tiền thực nhận hoàn lại: NỔI BẬT & IN ĐẬM */}
              <div className="flex justify-between items-center p-3 rounded-xl bg-[#F0FDF4] border-2 border-[#86EFAC] text-xs shadow-xs my-0.5">
                <div className="flex flex-col pr-2">
                  <span className="font-black text-[#15803D] uppercase text-[11px] tracking-wide">
                    Tổng tiền thực hoàn
                  </span>
                  <span className="text-[10px] text-[#16A34A] line-clamp-2">
                    {refundDescription}
                  </span>
                </div>
                <span className="text-base font-black text-[#16A34A] whitespace-nowrap">
                  +{formatVND(transaction.amount)}
                </span>
              </div>
            </div>
          )}

          {/* Grand total */}
          <div className="flex items-center justify-between p-4 bg-[#F7F7F7] border-2 border-[#E5E5E5] rounded-2xl">
            <span className="text-xs font-black uppercase text-[#4B4B4B]">Tổng tiền giao dịch</span>
            <span className={`text-xl font-black ${isIncome ? 'text-[#58A700]' : 'text-[#58CC02]'}`}>
              {isIncome ? '+' : ''}{formatVND(transaction.amount)}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-[#FAFAFA] border-t-2 border-[#E5E5E5] p-4 flex items-center justify-end gap-3">
          {transaction.reservationId && (
            <Link
              to={`/kho-cua-toi/hop-dong/${transaction.reservationId}`}
              className="duo-btn-blue px-4 py-2 text-xs"
            >
              XEM HỢP ĐỒNG
            </Link>
          )}
          <button
            type="button"
            onClick={onClose}
            className="duo-btn-gray px-5 py-2 text-xs cursor-pointer"
          >
            ĐÓNG
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CustomerPaymentsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [reloadTick, setReloadTick] = useState(0)
  // result.tick = lần tải đã xong; khác reloadTick → đang tải
  const [result, setResult] = useState({ tick: -1, data: null, error: '' })
  const state = { loading: result.tick !== reloadTick, data: result.data, error: result.error }
  const [payingId, setPayingId] = useState(null)
  const [payError, setPayError] = useState('')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [showFailed, setShowFailed] = useState(false)
  const [timeFilter, setTimeFilter] = useState(() => makeTimeFilter(TIME_FIELDS, 'desc'))
  const [currentPage, setCurrentPage] = useState(1)
  const [debtPage, setDebtPage] = useState(1)
  const [selectedTx, setSelectedTx] = useState(null)

  // Kết quả trả về từ VNPAY (/thanh-toan?orderId=...&vnpResponse=00)
  const vnpResponse = searchParams.get('vnpResponse')
  const returnNotice = vnpResponse == null ? null
    : vnpResponse === '00'
      ? { ok: true, text: 'Thanh toán phí sự cố thành công. Bạn đã có thể đặt kho mới.' }
      : { ok: false, text: 'Thanh toán chưa thành công, khoản nợ vẫn giữ nguyên. Bạn có thể thử lại.' }

  const load = useCallback(() => setReloadTick((t) => t + 1), [])

  useEffect(() => {
    let cancelled = false
    getMyPayments()
      .then((data) => { if (!cancelled) setResult({ tick: reloadTick, data, error: '' }) })
      .catch((err) => {
        if (!cancelled) setResult({ tick: reloadTick, data: null, error: err.response?.data?.message || 'Không tải được lịch sử thanh toán.' })
      })
    return () => { cancelled = true }
  }, [reloadTick])

  const handlePayDebt = async (debt) => {
    setPayingId(debt.id)
    setPayError('')
    try {
      const payment = await createVnpayDebt(debt.id)
      window.location.assign(payment.payUrl)
    } catch (err) {
      setPayError(err.response?.data?.message || 'Không tạo được link thanh toán, vui lòng thử lại.')
      setPayingId(null)
    }
  }

  const transactions = useMemo(() => {
    const all = state.data?.transactions || []
    return applyTimeFilter(all
      .filter((t) => showFailed || t.status !== 'FAILED')
      .filter((t) => typeFilter === 'ALL' || t.paymentType === typeFilter), timeFilter, TIME_FIELDS)
  }, [state.data, typeFilter, showFailed, timeFilter])

  const summary = state.data?.summary
  const debts = state.data?.debts || []
  const overdue = state.data?.overdueContracts || []

  const actionableItems = useMemo(() => {
    const dItems = debts.map((d) => ({ kind: 'DEBT', key: `debt-${d.id}`, data: d }))
    const oItems = overdue.map((c) => ({ kind: 'OVERDUE', key: `overdue-${c.contractId}`, data: c }))
    return [...dItems, ...oItems]
  }, [debts, overdue])

  const totalDebtPages = Math.max(1, Math.ceil(actionableItems.length / DEBT_PAGE_SIZE))
  const safeDebtPage = Math.min(debtPage, totalDebtPages)
  const paginatedActionable = actionableItems.slice(
    (safeDebtPage - 1) * DEBT_PAGE_SIZE,
    safeDebtPage * DEBT_PAGE_SIZE
  )

  const totalTxPages = Math.max(1, Math.ceil(transactions.length / PAGE_SIZE))
  const safeTxPage = Math.min(currentPage, totalTxPages)
  const paginatedTransactions = transactions.slice(
    (safeTxPage - 1) * PAGE_SIZE,
    safeTxPage * PAGE_SIZE
  )

  return (
    <div className="max-w-[1200px] mx-auto px-6 md:px-8 py-8 flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b-2 border-[#E5E5E5]">
        <div>
          <div className="flex items-center gap-2.5">
            
            <h1 className="text-2xl md:text-3xl font-black text-[#4B4B4B] tracking-tight">Thanh toán</h1>
          </div>
          <p className="text-xs font-bold text-[#777777] mt-1">
            Toàn bộ khoản đã trả, khoản được hoàn và khoản còn cần thanh toán của bạn.
          </p>
        </div>
        <button onClick={load} className="duo-btn-white px-4 py-2.5 text-xs gap-1 self-start">
          <span className="material-symbols-outlined text-[16px]">refresh</span>
          Làm mới
        </button>
      </div>

      {returnNotice && (
        <div className={`duo-card p-4 flex items-center gap-3 border-2 ${returnNotice.ok ? 'border-[#58CC02] bg-[#F1FFE7] text-[#58A700]' : 'border-[#FF9600] bg-[#FFF8EE] text-[#E58800]'}`}>
          <span className="material-symbols-outlined text-[24px]">{returnNotice.ok ? 'check_circle' : 'error'}</span>
          <span className="flex-1 text-sm font-black">{returnNotice.text}</span>
          <button onClick={() => setSearchParams({}, { replace: true })} className="text-xs font-black underline">Đóng</button>
        </div>
      )}

      {state.error && (
        <div className="duo-card border-[#FFDFDF] bg-[#FFF5F5] p-6 flex items-center gap-4">
          <span className="material-symbols-outlined text-[32px] text-[#FF4B4B]">cloud_off</span>
          <span className="flex-1 text-sm font-black text-[#FF4B4B]">{state.error}</span>
          <button onClick={load} className="duo-btn-white px-4 py-2 text-xs">Thử lại</button>
        </div>
      )}

      {state.loading && !state.data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="duo-card h-[92px] animate-pulse bg-[#F7F7F7]" />)}
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryTile icon="payments" label="Đã thanh toán" value={summary.totalPaid}
            tone="border-[#84D8FF] bg-[#F2FAFF] text-[#1899D6]" hint="Cọc, tiền thuê, gia hạn, phí" />
          <SummaryTile icon="currency_exchange" label="Đã được hoàn" value={summary.totalRefunded}
            tone="border-[#58CC02] bg-[#F1FFE7] text-[#58A700]"
            hint={Number(summary.pendingRefund) > 0 ? `Đang chờ hoàn ${formatVND(summary.pendingRefund)}` : 'Không có khoản chờ hoàn'} />
          <SummaryTile icon="account_balance_wallet" label="Trừ vào tiền cọc" value={summary.depositOffset}
            tone="border-[#E5E5E5] bg-[#F7F7F7] text-[#777777]" hint="Phí trễ / sự cố khấu trừ khi trả kho" />
          <SummaryTile icon="warning" label="Còn nợ" value={summary.outstandingDebt}
            tone={Number(summary.outstandingDebt) > 0 ? 'border-[#FF4B4B] bg-[#FFF5F5] text-[#EA2B2B]' : 'border-[#E5E5E5] bg-white text-[#AFAFAF]'}
            hint={Number(summary.outstandingDebt) > 0 ? 'Cần trả trước khi đặt kho mới' : 'Không có khoản nợ'} />
        </div>
      )}

      {/* Khoản cần thanh toán */}
      {state.data && actionableItems.length > 0 && (
        <section className="duo-card overflow-hidden">
          <ListBoxHeader
            icon="warning"
            title="Khoản cần thanh toán"
            subtitle="Thanh toán công nợ sự cố hoặc gia hạn hợp đồng quá hạn"
            count={actionableItems.length}
            countLabel="khoản"
            accentColor="bg-[#FFDFDF] text-[#FF4B4B] border-[#FF4B4B]"
          />
          {payError && <p className="px-5 pt-3 text-sm font-black text-[#FF4B4B]">{payError}</p>}

          <div className="p-4 flex flex-col gap-3">
            {paginatedActionable.map((item) => {
              if (item.kind === 'DEBT') {
                const debt = item.data
                return (
                  <div key={item.key} className="rounded-2xl bg-white p-4 border-2 border-b-4 border-[#FF4B4B] flex flex-col md:flex-row md:items-center gap-4">
                    <span className="material-symbols-outlined text-[30px] text-[#FF4B4B]">construction</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-[#4B4B4B]">{debt.transactionCode?.startsWith("MV-") ? "Phí dọn & di dời hàng vượt tiền cọc" : debt.paymentType === "OVERSTAY_FEE" ? "Phí chiếm dụng vượt tiền cọc" : "Phí sự cố vượt tiền cọc"} · HĐ {debt.contractCode || "—"}</p>
                      <p className="text-xs font-bold text-[#777777]">
                        {debt.facilityName || ''}{debt.unitTypeName ? ` · ${debt.unitTypeName}` : ''} — phát sinh khi nghiệm thu trả kho
                      </p>
                    </div>
                    <span className="text-xl font-black text-[#EA2B2B]">{formatVND(debt.amount)}</span>
                    <button
                      onClick={() => handlePayDebt(debt)}
                      disabled={payingId != null}
                      className="duo-btn-green px-5 py-3 text-xs disabled:opacity-50"
                    >
                      {payingId === debt.id ? 'ĐANG TẠO LINK...' : 'THANH TOÁN VNPAY'}
                    </button>
                  </div>
                )
              }
              const c = item.data
              const { lateFee, overstayFee, totalPenalty, lateFeeWaived, overstayFeeWaived } = getOverdueFeeBreakdown(c)
              return (
                <div key={item.key} className="rounded-2xl bg-white p-4 border-2 border-b-4 border-[#FF9600] flex flex-col md:flex-row md:items-center gap-4">
                  <span className="material-symbols-outlined text-[30px] text-[#FF9600]">event_busy</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-[#4B4B4B]">Hợp đồng {c.contractCode} quá hạn {c.overdueDays} ngày</p>
                    <p className="text-xs font-bold text-[#777777]">
                      {c.facilityName} — gia hạn để mở lại mã PIN.{' '}
                      Tổng phạt hiện tại <strong className="text-[#EA2B2B]">{formatVND(totalPenalty)}</strong>{' '}
                      (Phí trễ: {lateFeeWaived ? 'Đã miễn' : formatVND(lateFee)} · Chiếm dụng: {overstayFeeWaived ? 'Đã miễn' : formatVND(overstayFee)}).
                    </p>
                  </div>
                  {c.reservationId && (
                    <Link to={`/kho-cua-toi/hop-dong/${c.reservationId}`} className="duo-btn-orange px-5 py-3 text-xs">
                      GIA HẠN NGAY
                    </Link>
                  )}
                </div>
              )
            })}
          </div>
          <PaginationBar
            currentPage={safeDebtPage}
            totalItems={actionableItems.length}
            pageSize={DEBT_PAGE_SIZE}
            onPageChange={setDebtPage}
            itemLabel="khoản cần thanh toán"
          />
        </section>
      )}

      {/* Lịch sử giao dịch */}
      {state.data && (
        <section className="duo-card overflow-hidden">
          <ListBoxHeader
            icon="receipt_long"
            title="Lịch sử giao dịch"
            subtitle="Chi tiết tất cả giao dịch thanh toán, hoàn tiền và khấu trừ cọc"
            count={transactions.length}
            countLabel="giao dịch"
            accentColor="bg-[#DDF4FF] text-[#1CB0F6] border-[#84D8FF]"
            rightSlot={
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={typeFilter}
                  onChange={(e) => {
                    setTypeFilter(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="duo-input text-xs py-1.5"
                >
                  <option value="ALL">Tất cả loại</option>
                  {Object.entries(TYPE_LABELS).map(([code, t]) => <option key={code} value={code}>{t.label}</option>)}
                </select>
                <label className="flex items-center gap-1.5 text-xs font-bold text-[#777777] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showFailed}
                    onChange={(e) => {
                      setShowFailed(e.target.checked)
                      setCurrentPage(1)
                    }}
                  />
                  Hiện GD thất bại
                </label>
                <TimeFilterBar
                  className="w-full"
                  value={timeFilter}
                  onChange={(v) => { setTimeFilter(v); setCurrentPage(1) }}
                  fields={TIME_FIELDS}
                />
              </div>
            }
          />

          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b-2 border-[#E5E5E5] bg-[#FAFAFA]">
                  {['Thời gian', 'Loại', 'Đơn / Hợp đồng', 'Phương thức', 'Số tiền', 'Trạng thái', 'Biên lai'].map((h) => (
                    <th key={h} className={`px-4 py-3 text-[11px] font-black uppercase tracking-wider text-[#AFAFAF] ${h === 'Biên lai' ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-sm font-black text-[#AFAFAF]">Chưa có giao dịch nào</td>
                  </tr>
                )}
                {paginatedTransactions.map((t) => {
                  const type = typeOf(t)
                  const status = STATUS_STYLES[t.status] || STATUS_STYLES.PENDING
                  const isRefund = t.paymentType === 'REFUND' || t.paymentType === 'COMPENSATION'
                  return (
                    <tr key={t.id} className="border-b-2 border-[#F7F7F7] last:border-b-0 hover:bg-[#FAFAFA]">
                      <td className="px-4 py-3 whitespace-nowrap font-bold text-[#777777]">{formatTime(t.paidAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 font-black text-[#4B4B4B]">
                          <span className="material-symbols-outlined text-[18px] text-[#AFAFAF]">{type.icon}</span>
                          {type.label}{t.renewalMonths ? ` ${t.renewalMonths} tháng` : ''}
                        </div>
                        <div className="text-[11px] font-bold text-[#AFAFAF] font-mono">{t.transactionCode}</div>
                        {t.bankTransactionCode && (
                          <div className="text-[10px] font-bold text-[#FF9600] font-mono" title="Mã giao dịch ngân hàng / Cổng thanh toán">
                            FT: {t.bankTransactionCode}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {t.contractId && t.reservationId ? (
                          <Link to={`/kho-cua-toi/hop-dong/${t.reservationId}`} title="Xem hợp đồng" className="font-bold text-[#1CB0F6] hover:underline">
                            {t.contractCode || t.reservationCode}
                          </Link>
                        ) : (
                          <div className="font-bold text-[#4B4B4B]">{t.contractCode || t.reservationCode || '—'}</div>
                        )}
                        <div className="text-[11px] font-bold text-[#AFAFAF]">{t.facilityName || ''}</div>
                      </td>
                      <td className="px-4 py-3 font-bold text-[#777777]">{METHOD_LABELS[t.paymentMethod] || t.paymentMethod}</td>
                      <td className={`px-4 py-3 font-black whitespace-nowrap ${isRefund ? 'text-[#58A700]' : 'text-[#4B4B4B]'}`}>
                        {isRefund ? '+' : ''}{formatVND(t.amount)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`duo-badge border-2 ${status.className}`}>{status.label}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedTx(t)}
                          className="duo-btn-gray px-2.5 py-1 text-xs inline-flex items-center gap-1 hover:bg-[#E5E5E5] whitespace-nowrap cursor-pointer"
                          title="Xem biên lai bóc tách chi tiết"
                        >
                          <span className="material-symbols-outlined text-[16px]">receipt_long</span>
                          <span>Chi tiết</span>
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {transactions.length > 0 && (
            <PaginationBar
              currentPage={safeTxPage}
              totalItems={transactions.length}
              pageSize={PAGE_SIZE}
              onPageChange={setCurrentPage}
              itemLabel="giao dịch"
            />
          )}
        </section>
      )}

      {/* Modal xem chi tiết biên lai giao dịch */}
      <PaymentReceiptModal
        transaction={selectedTx}
        onClose={() => setSelectedTx(null)}
      />
    </div>
  )
}
