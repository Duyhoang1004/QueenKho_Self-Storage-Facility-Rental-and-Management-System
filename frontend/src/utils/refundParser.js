/**
 * Utility parse ghi chú hoàn tiền cọc (Refund Task)
 * Hỗ trợ các định dạng:
 * - Hủy đơn đặt cọc online (Hoàn 100% hoặc Phạt 50% cọc do hủy sát giờ < 24h)
 * - Hủy đơn đặt cọc nhận tiền mặt tại quầy
 * - Nghiệm thu trả kho (Check-out) khấu trừ hư hại
 */
export function parseRefundNote(note) {
  if (!note) return {};
  const res = {
    orderCode: '',
    customerName: '',
    customerPhone: '',
    refundAmount: '',
    refundAmountNum: 0,
    penaltyAmount: '',
    penaltyAmountNum: 0,
    originalTotal: '',
    originalTotalNum: 0,
    penaltyNote: '',
    isPenalty50: false,
    isFull100: false,
    bankName: '',
    bankAccountNumber: '',
    bankAccountName: '',
    reason: '',
    isCash: false,
    raw: note,
  };

  // 1. Mã đơn / Mã hợp đồng
  const mOrder = note.match(/(?:Đơn|HĐ):\s*([A-Za-z0-9_-]+)/i);
  if (mOrder) res.orderCode = mOrder[1].trim();

  // 2. Tên khách & SĐT
  const mCustomer = note.match(/Khách:\s*([^|(]+)(?:\(SĐT:\s*([^)]+)\))?/i);
  if (mCustomer) {
    res.customerName = mCustomer[1]?.trim() || '';
    res.customerPhone = mCustomer[2]?.trim() || '';
  }

  // Kiểm tra loại hoàn tiền: Trả kho (Checkout) vs Hủy đơn đặt cọc (Cancellation)
  const isCheckout = /trả kho|nghiệm thu|cọc gốc|hư hại/i.test(note);
  res.isCheckout = isCheckout;

  // 3. Số tiền hoàn
  const mNetRefund = note.match(/(?:THỰC HOÀN|Tổng hoàn:?)\s*([0-9.,]+)\s*[₫đVND]*/i);
  if (mNetRefund) {
    const rawNet = mNetRefund[1].replace(/,/g, '').replace(/\./g, '');
    const numNet = Number(rawNet);
    res.refundAmountNum = !isNaN(numNet) ? numNet : 0;
    res.refundAmount = !isNaN(numNet) ? `${numNet.toLocaleString('vi-VN')} ₫` : `${mNetRefund[1].trim()} ₫`;
  }

  const mAmount = note.match(/Số tiền hoàn:\s*([0-9.,]+)\s*(?:VND|đ|₫)?/i);
  if (mAmount && !res.refundAmountNum) {
    const rawVal = mAmount[1].replace(/,/g, '').replace(/\./g, '');
    const num = Number(rawVal);
    res.refundAmountNum = !isNaN(num) ? num : 0;
    res.refundAmount = !isNaN(num) ? `${num.toLocaleString('vi-VN')} ₫` : `${mAmount[1]} ₫`;
  }

  // 4. Phân loại chính sách hoàn tiền
  if (isCheckout) {
    // ==================== TRƯỜNG HỢP 1: HOÀN CỌC & TIỀN THUÊ TRẢ SỚM KHI TRẢ KHO ====================
    const mDeposit = note.match(/Cọc gốc:?\s*([0-9.,]+)\s*[₫đVND]*/i);
    if (mDeposit) {
      const rawDep = mDeposit[1].replace(/,/g, '').replace(/\./g, '');
      const numDep = Number(rawDep);
      res.originalTotalNum = !isNaN(numDep) ? numDep : 0;
      res.originalTotal = !isNaN(numDep) ? `${numDep.toLocaleString('vi-VN')} ₫` : `${mDeposit[1].trim()} ₫`;
    }

    const mDepRefund = note.match(/Cọc hoàn:?\s*([0-9.,]+)\s*[₫đVND]*/i);
    if (mDepRefund) {
      const rawDepRef = mDepRefund[1].replace(/,/g, '').replace(/\./g, '');
      const numDepRef = Number(rawDepRef);
      res.depositRefundNum = !isNaN(numDepRef) ? numDepRef : 0;
      res.depositRefund = !isNaN(numDepRef) ? `${numDepRef.toLocaleString('vi-VN')} ₫` : `${mDepRefund[1].trim()} ₫`;
    }

    const mEarlyRent = note.match(/Hoàn tiền thuê trả sớm:?\s*([0-9.,]+)\s*[₫đVND]*/i);
    if (mEarlyRent) {
      const rawEarly = mEarlyRent[1].replace(/,/g, '').replace(/\./g, '');
      const numEarly = Number(rawEarly);
      res.earlyRentRefundNum = !isNaN(numEarly) ? numEarly : 0;
      res.earlyRentRefund = !isNaN(numEarly) ? `${numEarly.toLocaleString('vi-VN')} ₫` : `${mEarlyRent[1].trim()} ₫`;
    }

    const mDamage = note.match(/(?:Phí hư hại|Sự cố:?)\s*([0-9.,]+)\s*[₫đVND]*/i);
    if (mDamage) {
      const rawDam = mDamage[1].replace(/,/g, '').replace(/\./g, '');
      const numDam = Number(rawDam);
      res.penaltyAmountNum = !isNaN(numDam) ? numDam : 0;
      res.penaltyAmount = !isNaN(numDam) ? `${numDam.toLocaleString('vi-VN')} ₫` : `${mDamage[1].trim()} ₫`;
    }

    const mLate = note.match(/Phí trễ(?: hạn)?:?\s*([0-9.,]+)\s*[₫đVND]*(?:\s*\(([0-9]+)\s*ngày\))?/i);
    if (mLate) {
      const rawLate = mLate[1].replace(/,/g, '').replace(/\./g, '');
      const numLate = Number(rawLate);
      res.lateFeeNum = !isNaN(numLate) ? numLate : 0;
      res.lateFee = !isNaN(numLate) ? `${numLate.toLocaleString('vi-VN')} ₫` : `${mLate[1].trim()} ₫`;
      if (mLate[2]) {
        res.overdueDays = Number(mLate[2]);
      }
    }

    if (res.penaltyAmountNum > 0 || res.lateFeeNum > 0) {
      res.isDamagePenalty = res.penaltyAmountNum > 0;
      res.isLatePenalty = res.lateFeeNum > 0;
      res.isFull100 = false;
      if (res.penaltyAmountNum > 0 && res.lateFeeNum > 0) {
        res.policyBadge = 'Khấu trừ hư hại & phí trễ';
        res.policyApplied = 'Khấu trừ chi phí hư hại và phí phạt trễ hạn khi trả kho';
        res.footerNote = '* Đã khấu trừ chi phí sửa chữa / vệ sinh và phí phạt trễ hạn theo biên bản nghiệm thu.';
      } else if (res.lateFeeNum > 0) {
        res.policyBadge = 'Khấu trừ phí trễ hạn';
        res.policyApplied = 'Khấu trừ phí phạt trễ hạn trả kho';
        res.footerNote = '* Đã khấu trừ chi phí phạt quá hạn hợp đồng khi trả kho theo quy định.';
      } else {
        res.policyBadge = 'Khấu trừ phí hư hại';
        res.policyApplied = 'Khấu trừ theo biên bản nghiệm thu trả kho';
        res.penaltyNote = `Khấu trừ phí hư hại khoang: ${res.penaltyAmount}`;
        res.footerNote = '* Đã khấu trừ chi phí sửa chữa / vệ sinh hư hại theo biên bản nghiệm thu của nhân viên.';
      }
    } else {
      res.isDamagePenalty = false;
      res.isLatePenalty = false;
      res.isFull100 = true;
      res.policyBadge = res.earlyRentRefundNum > 0 ? 'Hoàn 100% cọc + Tiền thuê trả sớm' : 'Hoàn 100% cọc giữ chỗ';
      res.policyApplied = res.earlyRentRefundNum > 0
        ? 'Khoang nguyên vẹn (Hoàn 100% cọc + Tiền thuê các tháng còn lại sau phạt trả sớm)'
        : 'Khoang bàn giao nguyên vẹn (Hoàn 100% cọc)';
      res.penaltyNote = 'Khoang nguyên vẹn - Hoàn 100% tiền cọc';
      res.footerNote = res.earlyRentRefundNum > 0
        ? '* Bao gồm 100% tiền cọc giữ chỗ và phần tiền thuê các tháng còn lại sau khi trừ thời gian sử dụng & phí phạt trả sớm 1 tháng (PR-O2).'
        : '* Tiền cọc giữ chỗ được hoàn trả 100% sau khi nhân viên cơ sở hoàn tất nghiệm thu khoang trống.';
    }
  } else {
    // ==================== TRƯỜNG HỢP 2: HOÀN CỌC KHI HỦY ĐƠN ĐẶT CHỖ ====================
    const mPenalty = note.match(/Đã trừ phạt (?:hủy trễ|trễ)?\s*50% cọc:\s*([0-9.,]+)\s*(?:VND|đ|₫)?/i);
    if (mPenalty) {
      res.isPenalty50 = true;
      const rawPen = mPenalty[1].replace(/,/g, '').replace(/\./g, '');
      const numPen = Number(rawPen);
      res.penaltyAmountNum = !isNaN(numPen) ? numPen : 0;
      res.penaltyAmount = !isNaN(numPen) ? `${numPen.toLocaleString('vi-VN')} ₫` : `${mPenalty[1]} ₫`;
      res.policyBadge = 'Khấu trừ 50% tiền cọc';
      res.policyApplied = 'Khấu trừ 50% tiền cọc (hủy sát giờ < 24h)';
      res.penaltyNote = `Đã trừ phạt hủy trễ (50% tiền cọc): ${res.penaltyAmount}`;
      res.footerNote = '* Lưu ý: Hủy trong vòng 24h trước giờ hẹn nhận kho sẽ khấu trừ 50% tiền cọc theo quy định.';
    } else if (note.includes('50%')) {
      res.isPenalty50 = true;
      res.policyBadge = 'Khấu trừ 50% tiền cọc';
      res.policyApplied = 'Khấu trừ 50% tiền cọc (hủy sát giờ < 24h)';
      res.penaltyNote = 'Đã trừ phạt hủy trễ (50% tiền cọc)';
      res.footerNote = '* Lưu ý: Hủy trong vòng 24h trước giờ hẹn nhận kho sẽ khấu trừ 50% tiền cọc theo quy định.';
    } else {
      res.isFull100 = true;
      res.policyBadge = 'Hoàn 100% cọc';
      res.policyApplied = 'Hủy trước giờ hẹn > 24h (Hoàn 100% cọc)';
      res.penaltyNote = 'Hủy trước giờ hẹn > 24h (Hoàn 100%)';
      res.footerNote = '* Khách hàng hủy đơn hợp lệ trước 24h giờ hẹn nhận kho được hoàn trả 100% tiền cọc.';
    }
  }

  // Nếu có cả tiền hoàn và các khoản khấu trừ mà chưa có tổng ban đầu -> Tính tổng ban đầu
  if (!res.originalTotalNum && res.refundAmountNum > 0 && (res.penaltyAmountNum > 0 || res.lateFeeNum > 0)) {
    res.originalTotalNum = res.refundAmountNum - (res.earlyRentRefundNum || 0) + (res.penaltyAmountNum || 0) + (res.lateFeeNum || 0);
    res.originalTotal = `${res.originalTotalNum.toLocaleString('vi-VN')} ₫`;
  }
  // Nếu hoàn 100% mà chưa có originalTotal -> gán bằng refundAmount - earlyRentRefund
  if (!res.originalTotalNum && res.refundAmountNum > 0 && !res.penaltyAmountNum && !res.lateFeeNum) {
    res.originalTotalNum = Math.max(0, res.refundAmountNum - (res.earlyRentRefundNum || 0));
    res.originalTotal = `${res.originalTotalNum.toLocaleString('vi-VN')} ₫`;
  }

  // 5. Thông tin ngân hàng
  const mBankName = note.match(/Ngân hàng:\s*([^|]+)/i);
  if (mBankName) res.bankName = mBankName[1].trim();

  const mStk = note.match(/STK:\s*([A-Za-z0-9_-]+)/i);
  if (mStk) res.bankAccountNumber = mStk[1].trim();

  const mAccountName = note.match(/Chủ TK:\s*([^|]+)/i);
  if (mAccountName) res.bankAccountName = mAccountName[1].trim();

  const mStkAlt = note.match(/Hoàn cọc STK:\s*([A-Za-z0-9_-]+)\s*\(([^)-]+)(?:-\s*([^)]+))?\)/i);
  if (mStkAlt) {
    if (!res.bankAccountNumber) res.bankAccountNumber = mStkAlt[1].trim();
    if (!res.bankName) res.bankName = mStkAlt[2].trim();
    if (!res.bankAccountName && mStkAlt[3]) res.bankAccountName = mStkAlt[3].trim();
  }

  // 6. Kiểm tra hoàn tiền mặt
  if (note.includes('HOÀN CỌC TIỀN MẶT') || note.toLowerCase().includes('tiền mặt trực tiếp')) {
    res.isCash = true;
  }

  // 7. Lý do hoàn / hủy đơn (chỉ lấy phần lý do ngắn gọn)
  const mReason = note.match(/Lý do:\s*([^|]+)/i);
  if (mReason) {
    res.reason = mReason[1].trim();
  } else {
    const mNote = note.match(/Ghi chú:\s*([^|]+)/i);
    if (mNote) res.reason = mNote[1].trim();
  }

  return res;
}
