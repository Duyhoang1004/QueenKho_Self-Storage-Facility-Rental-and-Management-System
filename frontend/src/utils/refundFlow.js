export const DEBT_PAYMENT_PATH = "/thanh-toan";

export function refundPaymentMethodLabel(method) {
  if (method === "CASH") return "Tiền mặt";
  if (method === "BANK_TRANSFER") return "Chuyển khoản";
  return "Không xác định";
}

export function shouldShowContractRefundEvidence(refundStatus, evidence) {
  return refundStatus === "COMPLETED" && Boolean(evidence);
}

export function shouldShowReservationRefundEvidence(status, evidence) {
  return status === "REFUNDED" && Boolean(evidence);
}
