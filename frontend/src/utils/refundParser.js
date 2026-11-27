export function parseVndAmount(val) {
  if (val == null) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : Math.round(val);
  let str = String(val).trim();
  if (!str) return 0;

  if (/^\d+\.\d{1,2}$/.test(str)) {
    const n = Math.round(Number(str));
    return isNaN(n) ? 0 : n;
  }

  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(str)) {
    const n = Math.round(Number(str.replace(/,/g, '')));
    return isNaN(n) ? 0 : n;
  }

  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(str)) {
    const withoutDec = str.split(',')[0];
    const n = Number(withoutDec.replace(/\./g, ''));
    return isNaN(n) ? 0 : n;
  }

  if (/\.00?$/.test(str)) {
    str = str.replace(/\.00?$/, '');
  }

  const clean = str.replace(/[^\d-]/g, '');
  const num = Number(clean);
  return isNaN(num) ? 0 : num;
}

export const parseMoneyNumber = parseVndAmount;

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
    lateFee: '',
    lateFeeNum: 0,
    overstayFee: '',
    overstayFeeNum: 0,
    totalPenalty: '',
    totalPenaltyNum: 0,
    originalTotal: '',
    originalTotalNum: 0,
    penaltyNote: '',
    isPenalty50: false,
    isFull100: false,
    bankName: '',
    bankAccountNumber: '',
    bankAccountName: '',
    accountNumber: '',
    accountHolder: '',
    reason: '',
    isCash: false,
    raw: note,
  };

  const mOrder = note.match(/(?:Đơn|Don|HĐ|HD):\s*([A-Za-z0-9_-]+)/i);
  if (mOrder) res.orderCode = mOrder[1].trim();

  const mCustomer = note.match(/(?:Khách|Khach):\s*([^|(]+)(?:\((?:SĐT|SDT):\s*([^)]+)\))?/i);
  if (mCustomer) {
    res.customerName = mCustomer[1]?.trim() || '';
    res.customerPhone = mCustomer[2]?.trim() || '';
  }
  if (!res.customerPhone) {
    const mPhone = note.match(/(?:SĐT|SDT):\s*([0-9+\s.-]+)/i);
    if (mPhone) res.customerPhone = mPhone[1].trim();
  }

  const isCheckout = /trả kho|tra kho|nghiệm thu|nghiem thu|cọc gốc|coc goc|hư hại|hu hai/i.test(note);
  res.isCheckout = isCheckout;
  res.isNoShow = /^\[HOÀN TIỀN NO-SHOW\]/i.test(note.trim());
  res.noShowWaived = res.isNoShow && /FM phê duyệt miễn phạt No-Show/i.test(note);

  // 27/11/2026: task hoàn tiền của bảng quyết toán ghi "TỔNG CHI: X" (số chốt theo quyết toán)
  const mNetRefund = note.match(/(?:THỰC HOÀN|THUC HOAN|TỔNG CHI:?|TONG CHI:?|Tổng hoàn:?|Tong hoan:?)\s*([0-9.,]+)\s*[₫đVND]*/i);
  if (mNetRefund) {
    const numNet = parseVndAmount(mNetRefund[1]);
    res.refundAmountNum = numNet;
    res.refundAmount = `${numNet.toLocaleString('vi-VN')} ₫`;
  }

  const mAmount = note.match(/(?:Số tiền hoàn đã chốt|So tien hoan da chot|Số tiền hoàn|So tien hoan|Hoàn tiền|Hoan tien|Số tiền|So tien):\s*([0-9.,]+)\s*(?:VND|đ|₫)?/i);
  if (mAmount && !res.refundAmountNum) {
    const num = parseVndAmount(mAmount[1]);
    res.refundAmountNum = num;
    res.refundAmount = `${num.toLocaleString('vi-VN')} ₫`;
  }

  if (res.isNoShow) {
    const kept = note.match(/Giữ cọc \+ 1 tháng tiền thuê:\s*([0-9.,]+)/i);
    res.noShowKeptAmountNum = kept ? parseVndAmount(kept[1]) : 0;
    res.noShowKeptAmount = `${res.noShowKeptAmountNum.toLocaleString('vi-VN')} ₫`;
    res.policyBadge = res.noShowWaived ? 'Miễn phạt No-Show' : 'Giữ cọc + 1 tháng thuê';
    res.policyApplied = res.noShowWaived ? 'FM miễn phạt No-Show, hoàn toàn bộ tiền đã đóng' : 'Hoàn tiền thuê các tháng còn lại; giữ cọc và 1 tháng thuê';
    res.footerNote = res.noShowWaived ? '* Quản lý đã miễn phạt No-Show.' : '* No-Show: giữ cọc và 1 tháng thuê, hoàn tiền thuê các tháng còn lại.';
    res.isFull100 = res.noShowWaived;
  } else if (isCheckout) {
    const mDeposit = note.match(/(?:Cọc gốc|Coc goc):?\s*([0-9.,]+)\s*[₫đVND]*/i);
    if (mDeposit) {
      const numDep = parseVndAmount(mDeposit[1]);
      res.originalTotalNum = numDep;
      res.originalTotal = `${numDep.toLocaleString('vi-VN')} ₫`;
    }

    const mDepRefund = note.match(/(?:Cọc hoàn|Coc hoan):?\s*([0-9.,]+)\s*[₫đVND]*/i);
    if (mDepRefund) {
      const numDepRef = parseVndAmount(mDepRefund[1]);
      res.depositRefundNum = numDepRef;
      res.depositRefund = `${numDepRef.toLocaleString('vi-VN')} ₫`;
    }

    const mEarlyRent = note.match(/(?:Hoàn tiền thuê trả sớm|Hoan tien thue tra som):?\s*([0-9.,]+)\s*[₫đVND]*/i);
    if (mEarlyRent) {
      const numEarly = parseVndAmount(mEarlyRent[1]);
      res.earlyRentRefundNum = numEarly;
      res.earlyRentRefund = `${numEarly.toLocaleString('vi-VN')} ₫`;
    }

    // Chi tiết trả sớm (PR-O2): "(Đã trả 3T: 2.465.000đ - Đã dùng 1T: 900.000đ - Phí hủy HĐ: 900.000đ)"
    const mRentPaid = note.match(/Đã trả\s*(\d+)T:\s*([0-9.,]+)/i);
    if (mRentPaid) {
      res.rentPaidMonths = Number(mRentPaid[1]);
      res.rentPaidNum = parseVndAmount(mRentPaid[2]);
    }
    const mUsed = note.match(/Đã dùng\s*(\d+)T:\s*([0-9.,]+)/i);
    if (mUsed) {
      res.usedMonths = Number(mUsed[1]);
      res.usedCostNum = parseVndAmount(mUsed[2]);
    }
    const mBreak = note.match(/Phí hủy HĐ:\s*([0-9.,]+)/i);
    if (mBreak) res.breakFeeNum = parseVndAmount(mBreak[1]);

    const mDebt = note.match(/Nợ vượt cọc cần truy thu:\s*([0-9.,]+)/i);
    if (mDebt) res.excessDebtNum = parseVndAmount(mDebt[1]);

    const mUnit = note.match(/\(Ô\s+([^)]+)\)/);
    if (mUnit) res.unitId = mUnit[1].trim();

    const mDamage = note.match(/(?:Phí hư hại|Phi hu hai|Sự cố|Su co):?\s*([0-9.,]+)\s*[₫đVND]*/i);
    if (mDamage) {
      const numDam = parseVndAmount(mDamage[1]);
      res.penaltyAmountNum = numDam;
      res.penaltyAmount = `${numDam.toLocaleString('vi-VN')} ₫`;
    }

    const mLate = note.match(/(?:Phí trễ|Phi tre)(?: hạn| han)?:?\s*([0-9.,]+)\s*[₫đVND]*(?:\s*\(([0-9]+)\s*(?:ngày|ngay)\))?/i);
    if (mLate) {
      const numLate = parseVndAmount(mLate[1]);
      res.lateFeeNum = numLate;
      res.lateFee = `${numLate.toLocaleString('vi-VN')} ₫`;
      if (mLate[2]) {
        res.overdueDays = Number(mLate[2]);
      }
    }

    const mOverstay = note.match(/(?:Phí chiếm dụng|Phi chiem dung)(?:\s*ô|\s*o)?:?\s*([0-9.,]+)\s*[₫đVND]*/i);
    if (mOverstay) {
      const numOverstay = parseVndAmount(mOverstay[1]);
      res.overstayFeeNum = numOverstay;
      res.overstayFee = `${numOverstay.toLocaleString('vi-VN')} ₫`;
    }

    res.totalPenaltyNum = (res.lateFeeNum || 0) + (res.overstayFeeNum || 0);
    if (res.totalPenaltyNum > 0) {
      res.totalPenalty = `${res.totalPenaltyNum.toLocaleString('vi-VN')} ₫`;
    }

    if (res.penaltyAmountNum > 0 || res.totalPenaltyNum > 0) {
      res.isDamagePenalty = res.penaltyAmountNum > 0;
      res.isLatePenalty = res.totalPenaltyNum > 0;
      res.isFull100 = false;
      if (res.penaltyAmountNum > 0 && res.totalPenaltyNum > 0) {
        res.policyBadge = 'Khấu trừ hư hại & phạt quá hạn';
        res.policyApplied = 'Khấu trừ chi phí hư hại và tiền phạt quá hạn khi trả kho';
        res.footerNote = '* Đã khấu trừ chi phí sửa chữa / vệ sinh và tiền phạt quá hạn (phí trễ + phí chiếm dụng) theo biên bản nghiệm thu.';
      } else if (res.totalPenaltyNum > 0) {
        res.policyBadge = 'Khấu trừ phạt quá hạn';
        res.policyApplied = 'Khấu trừ phí phạt trễ và phí chiếm dụng khi trả kho quá hạn';
        res.footerNote = '* Đã khấu trừ chi phí phạt quá hạn hợp đồng (phí trễ + phí chiếm dụng) khi trả kho theo quy định.';
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
    const mPolicy = note.match(/\|\s*Chính sách:\s*([^|]+)/i);
    const policyDesc = mPolicy ? mPolicy[1].trim() : '';
    const mKept = note.match(/\|\s*(?:Cọc giữ lại|Phí giữ lại):\s*([0-9.,]+)\s*(?:VND|đ|₫)?/i);
    const mLegacyPenalty = note.match(/(?:Đã trừ|Da tru) (?:phạt |phat )?(?:hủy trễ|huy tre|phí hủy|phi huy)?(?:\s*50% (?:cọc|coc))?:?\s*([0-9.,]+)\s*(?:VND|đ|₫)?|Phí hủy:?\s*([0-9.,]+)\s*(?:VND|đ|₫)?|Phi huy:?\s*([0-9.,]+)\s*(?:VND|đ|₫)?/i);

    const numPen = mKept
      ? parseVndAmount(mKept[1])
      : mLegacyPenalty
        ? parseVndAmount(mLegacyPenalty[1] || mLegacyPenalty[2] || mLegacyPenalty[3])
        : 0;

    const cancelFooter = '* Chính sách hủy đơn: trong 30 phút sau thanh toán hoặc trước giờ hẹn ≥ 48h hoàn 100%; từ 24h đến dưới 48h giữ 50% cọc; dưới 24h giữ 100% cọc.';

    if (numPen > 0) {
      res.penaltyAmountNum = numPen;
      res.penaltyAmount = `${numPen.toLocaleString('vi-VN')} ₫`;
      res.isPenalty50 = true;
      if (/cọc \+ 1 tháng/i.test(policyDesc)) {
        res.policyBadge = 'Giữ cọc + 1 tháng thuê';
      } else if (/100% cọc/i.test(policyDesc)) {
        res.policyBadge = 'Khấu trừ 100% tiền cọc';
      } else if (/50%/i.test(policyDesc) || note.includes('50%')) {
        res.policyBadge = 'Khấu trừ 50% tiền cọc';
      } else {
        res.policyBadge = 'Khấu trừ phí hủy đơn';
      }
      res.policyApplied = policyDesc || 'Khấu trừ phí hủy đơn theo chính sách';
      res.penaltyNote = `${res.policyApplied} (${res.penaltyAmount})`;
      res.footerNote = cancelFooter;
    } else if (!mKept && note.includes('50%')) {
      res.isPenalty50 = true;
      res.policyBadge = 'Khấu trừ 50% tiền cọc';
      res.policyApplied = policyDesc || 'Hủy từ 24 giờ đến dưới 48 giờ, giữ 50% cọc';
      res.penaltyNote = res.policyApplied;
      res.footerNote = cancelFooter;
    } else {
      res.isFull100 = true;
      res.policyBadge = 'Hoàn 100%';
      res.policyApplied = policyDesc || 'Hủy trước giờ nhận kho từ 48 giờ trở lên (hoàn 100%)';
      res.penaltyNote = res.policyApplied;
      res.footerNote = cancelFooter;
    }
  }

  if (!res.originalTotalNum && res.refundAmountNum > 0 && (res.penaltyAmountNum > 0 || res.totalPenaltyNum > 0)) {
    res.originalTotalNum = res.refundAmountNum - (res.earlyRentRefundNum || 0) + (res.penaltyAmountNum || 0) + (res.totalPenaltyNum || 0);
    res.originalTotal = `${res.originalTotalNum.toLocaleString('vi-VN')} ₫`;
  }
  if (!res.originalTotalNum && res.refundAmountNum > 0 && res.isNoShow && !res.noShowWaived) {
    res.originalTotalNum = res.refundAmountNum + res.noShowKeptAmountNum;
    res.originalTotal = `${res.originalTotalNum.toLocaleString('vi-VN')} ₫`;
  }
  if (!res.originalTotalNum && res.refundAmountNum > 0 && !res.penaltyAmountNum && !res.totalPenaltyNum) {
    res.originalTotalNum = Math.max(0, res.refundAmountNum - (res.earlyRentRefundNum || 0));
    res.originalTotal = `${res.originalTotalNum.toLocaleString('vi-VN')} ₫`;
  }

  const mBankName = note.match(/(?:Ngân hàng|Ngan hang):\s*([^|]+)/i);
  if (mBankName) res.bankName = mBankName[1].trim();

  const mStk = note.match(/STK:\s*([A-Za-z0-9_-]+)/i);
  if (mStk) {
    res.bankAccountNumber = mStk[1].trim();
    res.accountNumber = res.bankAccountNumber;
  }

  const mAccountName = note.match(/(?:Chủ TK|Chu TK):\s*([^|]+)/i);
  if (mAccountName) {
    res.bankAccountName = mAccountName[1].trim();
    res.accountHolder = res.bankAccountName;
  }

  // Ghi chú trả kho: "Hoàn cọc STK: 4567367979 (Techcombank (TCB) - NGUYỄN VĂN AN)" — tên ngân hàng có thể chứa
  // ngoặc nên tách theo đoạn giữa hai dấu "|" và lấy " - " cuối cùng làm ranh giới với tên chủ TK
  const stkSegment = note.split('|').map(s => s.trim()).find(s => /^(?:Hoàn cọc STK|Hoan coc STK):/i.test(s));
  const mStkAlt = stkSegment && stkSegment.match(/^(?:Hoàn cọc STK|Hoan coc STK):\s*([A-Za-z0-9_-]+)\s*(?:\((.*)\))?/i);
  if (mStkAlt) {
    if (!res.bankAccountNumber) {
      res.bankAccountNumber = mStkAlt[1].trim();
      res.accountNumber = res.bankAccountNumber;
    }
    const inner = (mStkAlt[2] || '').trim();
    const cut = inner.lastIndexOf(' - ');
    const bank = cut >= 0 ? inner.slice(0, cut).trim() : inner;
    const holder = cut >= 0 ? inner.slice(cut + 3).trim() : '';
    if (!res.bankName && bank) res.bankName = bank;
    if (!res.bankAccountName && holder) {
      res.bankAccountName = holder;
      res.accountHolder = holder;
    }
  }

  if (note.includes('HOÀN CỌC TIỀN MẶT') || note.includes('HOAN COC TIEN MAT') || note.toLowerCase().includes('tiền mặt trực tiếp') || note.toLowerCase().includes('tien mat truc tiep')) {
    res.isCash = true;
  }

  const mReason = note.match(res.isNoShow
    ? /Lý do No-Show:\s*([^|]+)/i
    : /(?:Lý do|Ly do):\s*([^|]+)/i);
  if (mReason) {
    res.reason = mReason[1].trim();
  } else {
    const mNote = note.match(/(?:Ghi chú|Ghi chu):\s*([^|]+)/i);
    if (mNote) res.reason = mNote[1].trim();
  }

  if (res.reason) {
    if (/hủy đơn sau 24h|huy don sau 24h/i.test(res.reason)) {
      res.reason = 'Hủy đơn trong khoảng 24h–48h trước giờ nhận kho (giữ 50% tiền cọc)';
    } else if (/hủy đơn trong 24h miễn phí|huy don trong 24h mien phi/i.test(res.reason)) {
      res.reason = 'Hủy đơn trong 30 phút sau thanh toán hoặc trước giờ nhận kho từ 48 giờ trở lên (hoàn 100%)';
    }
  }

  return res;
}
