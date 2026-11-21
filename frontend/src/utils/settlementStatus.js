// D-21 / PR-O19: nhãn trạng thái bảng quyết toán trả kho (checkout_settlements.status)
export const SETTLEMENT_STATUS = {
  WAITING_CLAIM: { label: 'Chờ chốt bồi thường', cls: 'bg-[#FFF4D6] text-[#B07A00] border-[#FFD966]', icon: 'pending' },
  WAITING_CUSTOMER: { label: 'Chờ khách xác nhận', cls: 'bg-[#DDF4FF] text-[#1899D6] border-[#84D8FF]', icon: 'how_to_reg' },
  DISPUTED: { label: 'Khách không đồng ý', cls: 'bg-[#FFDFDF] text-[#EA2B2B] border-[#FFB8B8]', icon: 'report' },
  RECHECKING: { label: 'Đang kiểm tra lại', cls: 'bg-[#F3E8FF] text-[#9333EA] border-[#CE82FF]', icon: 'manage_search' },
  AWAITING_PAYMENT: { label: 'Chờ khách thanh toán', cls: 'bg-[#FFE8CC] text-[#E58800] border-[#FF9600]', icon: 'payments' },
  // D-23 / PR-O29: khách đã xác nhận → chờ FM chi tiền → chờ khách xác nhận đã nhận
  REFUNDING: { label: 'Chờ hoàn tiền', cls: 'bg-[#FFF4D6] text-[#B07A00] border-[#FFD966]', icon: 'currency_exchange' },
  REFUND_SENT: { label: 'Chờ khách nhận tiền', cls: 'bg-[#DDF4FF] text-[#1899D6] border-[#84D8FF]', icon: 'mark_email_unread' },
  COMPLETED: { label: 'Đã tất toán', cls: 'bg-[#D7FFB8] text-[#58A700] border-[#58CC02]', icon: 'task_alt' },
  SUPERSEDED: { label: 'Đã thay bằng bảng mới', cls: 'bg-[#F7F7F7] text-[#777777] border-[#E5E5E5]', icon: 'history' },
}
