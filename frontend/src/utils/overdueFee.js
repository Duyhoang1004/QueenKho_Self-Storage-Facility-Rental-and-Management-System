/**
 * Tách và chuẩn hoá tổng tiền phạt quá hạn cùng 2 khoản thành phần
 * (phí phạt trễ + phí chiếm dụng ô) từ các DTO của QueenKho.
 */
export function getOverdueFeeBreakdown(item) {
  const lateFee = Number(item?.lateFeeAmount ?? item?.lateFee ?? 0) || 0
  const graceFee = Number(item?.graceFee ?? 0) || 0
  const overstayFee = Number(item?.overstayFeeAmount ?? item?.overstayFee ?? 0) || 0
  const combinedLateFee = lateFee + graceFee

  const explicitTotal = item?.totalOverdueCharge ?? item?.totalPenaltyFee
  const totalPenalty = explicitTotal != null
    ? Number(explicitTotal) || 0
    : combinedLateFee + overstayFee

  return {
    lateFee: combinedLateFee,
    overstayFee,
    totalPenalty,
    lateFeeWaived: Boolean(item?.lateFeeWaived),
    overstayFeeWaived: Boolean(item?.overstayFeeWaived),
  }
}
