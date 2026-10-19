import { useEffect, useState } from "react";
import {
  getCancelPreview,
  cancelReservation,
} from "../services/reservationService";

const CANCEL_REASONS = [
  "Thay đổi kế hoạch cá nhân / Không còn nhu cầu lưu trữ.",
  "Tìm được địa điểm khác phù hợp hơn.",
  "Thời gian hẹn nhận kho không còn thuận tiện.",
  "Đặt nhầm kích thước / loại kho bãi.",
];

function formatVND(v) {
  if (v == null) return "—";
  return Number(v).toLocaleString("vi-VN") + "₫";
}

function formatDateTime(val) {
  if (!val) return "—";
  if (Array.isArray(val)) {
    const [y, m, d, h = 0, min = 0] = val;
    return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")} - ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
  }
  const date = new Date(val);
  if (isNaN(date.getTime())) return "—";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")} - ${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
}

export default function CancelReservationModal({
  isOpen,
  onClose,
  reservation,
  onSuccess,
}) {
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [reason, setReason] = useState(CANCEL_REASONS[0]);
  const [otherReason, setOtherReason] = useState("");

  // Thông tin ngân hàng
  const [bankName, setBankName] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankAccountName, setBankAccountName] = useState("");

  useEffect(() => {
    if (!isOpen || !reservation?.id) return;
    setLoadingPreview(true);
    setError("");
    getCancelPreview(reservation.id)
      .then((res) => {
        // Nhận an toàn cả khi res là object data hoặc axios response
        const data = res?.data ?? res;
        setPreview(data);
      })
      .catch((err) => {
        setError(
          err.response?.data?.message || "Không thể tải chính sách hoàn cọc.",
        );
      })
      .finally(() => {
        setLoadingPreview(false);
      });
  }, [isOpen, reservation]);

  if (!isOpen || !reservation) return null;

  const isDepositPaid = reservation.status === "DEPOSIT_PAID";

  // 1. Tổng tiền đã đóng thực tế
  const totalPaid =
    preview?.depositAmount ?? preview?.totalPaid ?? reservation?.totalPaid ?? 0;
  // 2. Tiền cọc gốc của loại kho
  const depositAmount = reservation?.depositAmount ?? 0;
  // 3. Phí phạt (lấy trực tiếp từ preview)
  const penalty = preview?.penaltyAmount ?? 0;
  // 4. Tiền hoàn thực tế
  const refundAmount = preview?.refundAmount ?? totalPaid - penalty;
  const isLate = Number(penalty) > 0;

  const handleSubmit = async () => {
    if (reason === "Lý do khác" && !otherReason.trim()) {
      alert("Vui lòng nhập lý do cụ thể.");
      return;
    }
    if (isDepositPaid && refundAmount > 0) {
      if (
        !bankName.trim() ||
        !bankAccountNumber.trim() ||
        !bankAccountName.trim()
      ) {
        alert(
          "Vui lòng điền đầy đủ thông tin tài khoản ngân hàng để nhận hoàn tiền.",
        );
        return;
      }
    }

    setSubmitting(true);
    setError("");
    try {
      await cancelReservation(reservation.id, {
        reason: reason === "Lý do khác" ? otherReason.trim() : reason,
        otherReason: reason === "Lý do khác" ? otherReason.trim() : "",
        bankName: bankName.trim(),
        bankAccountNumber: bankAccountNumber.trim(),
        bankAccountName: bankAccountName.trim().toUpperCase(),
      });
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Hủy đơn không thành công. Vui lòng thử lại.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-[620px] w-full max-h-[92vh] flex flex-col shadow-2xl border-2 border-[#E5E5E5] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-6 border-b-2 border-[#F0F0F0] flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-[#FF4B4B]">
            <span className="material-symbols-outlined text-[28px]">
              warning
            </span>
            <h2 className="text-lg font-black tracking-tight uppercase">
              Xác nhận hủy đặt chỗ khoang lưu trữ
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-[#AFAFAF] hover:text-[#4B4B4B] p-1 rounded-xl transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[24px]">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex flex-col gap-5 custom-scrollbar">
          {error && (
            <div className="bg-[#FFDFDF] border-2 border-[#FF4B4B] text-[#EA2B2B] p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">
                error
              </span>
              <span>{error}</span>
            </div>
          )}

          {/* Thông tin đơn */}
          <div className="bg-[#FAFAFA] border-2 border-[#E5E5E5] rounded-2xl p-4 grid grid-cols-2 gap-3 text-xs font-bold text-[#4B4B4B]">
            <div>
              <span className="text-[#AFAFAF] block text-[10px] uppercase font-black">
                Mã đơn:
              </span>
              <span className="font-mono font-black text-[#1CB0F6] text-sm">
                {reservation.reservationCode}
              </span>
            </div>
            <div>
              <span className="text-[#AFAFAF] block text-[10px] uppercase font-black">
                Chi nhánh:
              </span>
              <span>{reservation.facilityName}</span>
            </div>
            <div>
              <span className="text-[#AFAFAF] block text-[10px] uppercase font-black">
                Loại kho:
              </span>
              <span>{reservation.unitTypeName}</span>
            </div>
            <div>
              <span className="text-[#AFAFAF] block text-[10px] uppercase font-black">
                Giờ hẹn nhận:
              </span>
              <span className="font-mono">
                {formatDateTime(
                  preview?.appointmentTime ||
                    reservation.expectedAppointmentTime ||
                    (reservation.startDate
                      ? `${reservation.startDate}T09:00:00`
                      : null),
                )}
              </span>
            </div>
          </div>

          {/* BẢNG CHÍNH SÁCH HOÀN TIỀN & KHẤU TRỪ */}
          {loadingPreview ? (
            <div className="p-6 text-center text-xs font-bold text-[#AFAFAF]">
              Đang tính toán chính sách hoàn tiền...
            </div>
          ) : (
            <div className="bg-[#FFF5F5] border-2 border-[#FFE2E2] rounded-2xl p-4 flex flex-col gap-3">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#FF4B4B]">
                Chính sách hoàn tiền & Khấu trừ
              </span>

              <div className="flex flex-col gap-2 text-xs">
                {/* 1. Tổng tiền đã đóng */}
                <div className="flex justify-between items-center text-[#4B4B4B]">
                  <span className="font-bold">Tổng tiền khách đã đóng:</span>
                  <span className="font-black text-sm">
                    {formatVND(totalPaid)}
                  </span>
                </div>

                {/* 2. Tiền cọc kho quy định */}
                <div className="flex justify-between items-center text-[#777777]">
                  <span>Tiền cọc giữ kho (quy chuẩn 1 tháng):</span>
                  <span className="font-bold">{formatVND(depositAmount)}</span>
                </div>

                {/* 3. Khấu trừ phí phạt cọc */}
                <div className="flex justify-between items-center text-[#FF4B4B]">
                  <span className="flex items-center gap-1">
                    <span>Khấu trừ tiền cọc:</span>
                    <span className="text-[10px] font-bold text-[#AFAFAF]">
                      {isLate
                        ? "(50% tiền cọc do hủy sát giờ < 24h)"
                        : "(0% - Hủy sớm trước 24h)"}
                    </span>
                  </span>
                  <span className="font-black">
                    {penalty > 0 ? `- ${formatVND(penalty)}` : "0₫"}
                  </span>
                </div>

                <div className="h-[1.5px] bg-[#FFE2E2] my-0.5"></div>

                {/* 4. Số tiền thực tế hoàn trả */}
                <div className="flex justify-between items-center pt-0.5">
                  <span className="font-black text-sm text-[#4B4B4B] uppercase">
                    Số tiền thực tế hoàn trả:
                  </span>
                  <span className="text-xl font-black text-[#58CC02]">
                    {formatVND(refundAmount)}
                  </span>
                </div>
              </div>

              <p className="text-[10px] text-[#AFAFAF] italic leading-tight">
                {isLate
                  ? "* Lưu ý: Hủy trong vòng 24h trước giờ hẹn nhận kho sẽ khấu trừ 50% tiền cọc. Toàn bộ tiền thuê các tháng vẫn được hoàn trả 100%."
                  : "* Quý khách hủy hợp lệ trước 24h: Toàn bộ 100% tiền cọc và tiền thuê các tháng sẽ được hoàn trả đầy đủ."}
              </p>
            </div>
          )}

          {/* Lý do hủy */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-black text-[#4B4B4B] uppercase tracking-wider">
              Lý do hủy đặt chỗ <span className="text-[#FF4B4B]">*</span>
            </label>
            <div className="flex flex-col gap-2">
              {CANCEL_REASONS.map((r) => (
                <label
                  key={r}
                  className="flex items-center gap-2.5 p-2.5 rounded-xl border-2 border-[#E5E5E5] hover:bg-[#FAFAFA] cursor-pointer text-xs font-bold text-[#4B4B4B] transition-colors"
                >
                  <input
                    type="radio"
                    name="reason"
                    checked={reason === r}
                    onChange={() => setReason(r)}
                    className="accent-[#FF4B4B] w-4 h-4 cursor-pointer"
                  />
                  <span>{r}</span>
                </label>
              ))}
              <label className="flex items-center gap-2.5 p-2.5 rounded-xl border-2 border-[#E5E5E5] hover:bg-[#FAFAFA] cursor-pointer text-xs font-bold text-[#4B4B4B] transition-colors">
                <input
                  type="radio"
                  name="reason"
                  checked={reason === "Lý do khác"}
                  onChange={() => setReason("Lý do khác")}
                  className="accent-[#FF4B4B] w-4 h-4 cursor-pointer"
                />
                <span>Lý do khác</span>
              </label>

              {reason === "Lý do khác" && (
                <textarea
                  value={otherReason}
                  onChange={(e) => setOtherReason(e.target.value)}
                  placeholder="Vui lòng nêu rõ lý do hủy..."
                  rows={2}
                  className="w-full p-3 rounded-xl border-2 border-[#E5E5E5] focus:border-[#FF4B4B] outline-none text-xs font-bold text-[#4B4B4B] mt-1 bg-[#FAFAFA]"
                />
              )}
            </div>
          </div>

          {/* Form thông tin ngân hàng nhận hoàn tiền */}
          {isDepositPaid && refundAmount > 0 && (
            <div className="bg-[#DDF4FF] border-2 border-[#84D8FF] rounded-2xl p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-[#1899D6]">
                <span className="material-symbols-outlined text-[20px]">
                  account_balance
                </span>
                <span className="text-xs font-black uppercase tracking-wider">
                  Thông tin tài khoản nhận tiền hoàn *
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <label className="text-[10px] font-black uppercase text-[#1899D6]">
                    Tên Ngân hàng *
                  </label>
                  <input
                    type="text"
                    placeholder="VD: Vietcombank, MB Bank, Techcombank..."
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="bg-white border-2 border-[#84D8FF] rounded-xl px-3 py-2 text-xs font-bold text-[#4B4B4B] outline-none focus:border-[#1CB0F6]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black uppercase text-[#1899D6]">
                    Số tài khoản *
                  </label>
                  <input
                    type="text"
                    placeholder="VD: 0367069283"
                    value={bankAccountNumber}
                    onChange={(e) => setBankAccountNumber(e.target.value)}
                    className="bg-white border-2 border-[#84D8FF] rounded-xl px-3 py-2 text-xs font-bold font-mono text-[#4B4B4B] outline-none focus:border-[#1CB0F6]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black uppercase text-[#1899D6]">
                    Tên chủ tài khoản *
                  </label>
                  <input
                    type="text"
                    placeholder="VD: NGUYEN TRONG HIEU"
                    value={bankAccountName}
                    onChange={(e) =>
                      setBankAccountName(e.target.value.toUpperCase())
                    }
                    className="bg-white border-2 border-[#84D8FF] rounded-xl px-3 py-2 text-xs font-bold uppercase text-[#4B4B4B] outline-none focus:border-[#1CB0F6]"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t-2 border-[#F0F0F0] bg-[#FAFAFA] flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="duo-btn-white px-5 py-2.5 text-xs tracking-wider"
          >
            GIỮ LẠI ĐƠN
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || loadingPreview}
            className="duo-btn-red px-5 py-2.5 text-xs tracking-wider flex items-center gap-1.5 shadow-sm"
          >
            {submitting ? (
              <span>ĐANG XỬ LÝ...</span>
            ) : (
              <>
                <span className="material-symbols-outlined text-[16px]">
                  cancel
                </span>
                <span>XÁC NHẬN HỦY</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
