import test from "node:test";
import assert from "node:assert/strict";

import {
  DEBT_PAYMENT_PATH,
  refundPaymentMethodLabel,
  shouldShowContractRefundEvidence,
  shouldShowReservationRefundEvidence,
} from "../src/utils/refundFlow.js";

test("khách bị chặn do nợ được điều hướng tới trang thanh toán", () => {
  assert.equal(DEBT_PAYMENT_PATH, "/thanh-toan");
});

test("hợp đồng chỉ hiện minh chứng khi FM đã hoàn tất refund", () => {
  const evidence = { evidenceImageUrl: "/uploads/refund.jpg" };
  assert.equal(shouldShowContractRefundEvidence("COMPLETED", evidence), true);
  assert.equal(shouldShowContractRefundEvidence("PENDING", evidence), false);
  assert.equal(shouldShowContractRefundEvidence("NONE", evidence), false);
  assert.equal(shouldShowContractRefundEvidence("COMPLETED", null), false);
});

test("đơn hủy chưa có hợp đồng chỉ hiện minh chứng ở trạng thái REFUNDED", () => {
  const evidence = { bankTransactionCode: "FT-123" };
  assert.equal(shouldShowReservationRefundEvidence("REFUNDED", evidence), true);
  assert.equal(shouldShowReservationRefundEvidence("REFUND_PENDING", evidence), false);
  assert.equal(shouldShowReservationRefundEvidence("CANCELLED", evidence), false);
  assert.equal(shouldShowReservationRefundEvidence("REFUNDED", null), false);
});

test("không suy đoán chuyển khoản khi dữ liệu cũ thiếu phương thức", () => {
  assert.equal(refundPaymentMethodLabel("CASH"), "Tiền mặt");
  assert.equal(refundPaymentMethodLabel("BANK_TRANSFER"), "Chuyển khoản");
  assert.equal(refundPaymentMethodLabel(null), "Không xác định");
  assert.equal(refundPaymentMethodLabel("VNPAY"), "Không xác định");
});
