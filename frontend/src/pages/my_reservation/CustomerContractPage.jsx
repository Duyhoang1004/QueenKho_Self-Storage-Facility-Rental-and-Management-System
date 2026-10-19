import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getContractByReservation, cancelCheckout } from "../../services/contractService";
import { getVnpayStatus } from "../../services/vnpayService";
import ContractOptionsModal from "../../components/ContractOptionsModal";

function formatVND(v) {
  if (v == null) return "—";
  return Number(v).toLocaleString("vi-VN") + "₫";
}

function formatDate(val) {
  if (!val) return "—";
  const [y, m, d] = String(val).split("-");
  return `${d}/${m}/${y}`;
}

// Hàm tính số tháng thuê giữa ngày bắt đầu và kết thúc
function getContractMonths(startDate, endDate) {
  if (!startDate || !endDate) return 1;
  const [y1, m1] = String(startDate).split("-").map(Number);
  const [y2, m2] = String(endDate).split("-").map(Number);
  const diff = (y2 - y1) * 12 + (m2 - m1);
  return diff > 0 ? diff : 1;
}

const STATUS_MAP = {
  PENDING_CHECK_IN: {
    label: "Chờ check-in",
    cls: "bg-[#DDF4FF] text-[#1CB0F6] border-2 border-[#84D8FF]",
    icon: "schedule",
  },
  ACTIVE: {
    label: "Đang hoạt động",
    cls: "bg-[#D7FFB8] text-[#58A700] border-2 border-[#58CC02]",
    icon: "check_circle",
  },
  TERMINATION_PENDING: {
    label: "Chờ trả kho",
    cls: "bg-[#FFE8CC] text-[#E58800] border-2 border-[#FF9600]",
    icon: "schedule",
  },
  OVERDUE: {
    label: "Quá hạn thanh toán",
    cls: "bg-[#FFE8CC] text-[#E58800] border-2 border-[#FF9600]",
    icon: "warning",
  },
  TERMINATED: {
    label: "Đã kết thúc",
    cls: "bg-[#F7F7F7] text-[#777777] border-2 border-[#E5E5E5]",
    icon: "cancel",
  },
  LIQUIDATED: {
    label: "Đã thanh lý hợp đồng",
    cls: "bg-[#FFDFDF] text-[#FF4B4B] border-2 border-[#FFDFDF]",
    icon: "gavel",
  },
};

function InfoRow({ label, value, mono }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-black uppercase tracking-wider text-[#AFAFAF]">
        {label}
      </span>
      <span
        className={`text-sm font-black text-[#4B4B4B] ${mono ? "font-mono" : ""}`}
      >
        {value || "—"}
      </span>
    </div>
  );
}

export default function CustomerContractPage() {
  const { reservationId } = useParams();
  const navigate = useNavigate();
  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [toastMessage, setToastMessage] = useState("");
  const [isOptionsModalOpen, setIsOptionsModalOpen] = useState(false);
  const [optionsModalTab, setOptionsModalTab] = useState('renew');

  const fetchContract = () => {
    setLoading(true);
    getContractByReservation(reservationId)
      .then((data) => {
        setContract(data);
        setError("");
      })
      .catch(() => {
        setError("Không thể tải thông tin hợp đồng.");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchContract();
  }, [reservationId]);

  // Xử lý callback sau khi khách thanh toán gia hạn từ VNPAY quay về
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const responseCode = params.get("vnp_ResponseCode");
    const txnRef = params.get("vnp_TxnRef") || params.get("orderId");

    if (responseCode === "00") {
      if (txnRef) {
        getVnpayStatus(txnRef)
          .then(() => {
            setToastMessage(
              "Gia hạn hợp đồng và thanh toán qua VNPAY thành công!",
            );
            fetchContract();
          })
          .catch(() => {
            setToastMessage("Gia hạn hợp đồng thành công!");
            fetchContract();
          });
      } else {
        setToastMessage("Gia hạn hợp đồng thành công!");
        fetchContract();
      }
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (responseCode && responseCode !== "00") {
      setError("Thanh toán gia hạn qua VNPAY không thành công hoặc đã bị hủy.");
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleModalSuccess = (message) => {
    setIsOptionsModalOpen(false);
    if (message) {
      setToastMessage(message);
    }
    fetchContract();
  };

  // State cho modal Xác nhận Hủy chờ trả kho
  const [isCancelCheckoutModalOpen, setIsCancelCheckoutModalOpen] = useState(false);
  const [cancelCheckoutLoading, setCancelCheckoutLoading] = useState(false);
  const [cancelCheckoutError, setCancelCheckoutError] = useState("");

  const handleConfirmCancelCheckout = async () => {
    const targetId = contract?.contractId || contract?.id;
    if (!targetId) {
      setCancelCheckoutError("Không tìm thấy mã hợp đồng.");
      return;
    }
    setCancelCheckoutLoading(true);
    setCancelCheckoutError("");
    try {
      const res = await cancelCheckout(targetId);
      setIsCancelCheckoutModalOpen(false);
      setToastMessage(res.message || "Đã hủy yêu cầu trả kho thành công. Hợp đồng trở lại trạng thái đang hoạt động.");
      fetchContract();
    } catch (err) {
      setCancelCheckoutError(err.response?.data?.message || err.message || "Có lỗi xảy ra khi hủy yêu cầu trả kho.");
    } finally {
      setCancelCheckoutLoading(false);
    }
  };

  if (loading)
    return (
      <div className="p-8 text-sm font-bold text-[#AFAFAF] text-center max-w-[1240px] mx-auto">
        Đang tải hợp đồng...
      </div>
    );
  if (error)
    return (
      <div className="p-8 flex flex-col items-center justify-center gap-4 text-center max-w-[1240px] mx-auto">
        <span className="material-symbols-outlined text-[40px] text-[#FF4B4B]">
          error
        </span>
        <p className="text-sm font-bold text-[#FF4B4B]">{error}</p>
        <button
          onClick={() => navigate(-1)}
          className="duo-btn-gray px-5 py-3 text-xs"
        >
          QUAY LẠI
        </button>
      </div>
    );
  if (!contract) return null;

  const isTerminated = contract.status === "TERMINATED";
  const hasRefunded = isTerminated;

  const statusInfo = isTerminated
    ? {
        label: "Đã kết thúc (Đã hoàn cọc)",
        cls: "bg-[#F3E8FF] text-[#A560E8] border-2 border-[#CE82FF]",
        icon: "payments",
      }
    : (STATUS_MAP[contract.status] || {
        label: contract.status,
        cls: "bg-[#F7F7F7] text-[#777777] border-2 border-[#E5E5E5]",
        icon: "info",
      });

  // Tính toán các khoản chi phí của hợp đồng (ưu tiên originalDeposit nếu hợp đồng đã kết thúc)
  const depositAmount = Number(
    contract.originalDeposit != null
      ? contract.originalDeposit
      : (contract.depositHeldAmount || contract.basePriceMonthly || 0)
  );
  const damageFee = Number(contract.damageFee || 0);
  const lateFee = Number(contract.lateFeeAmount || 0);
  const actualLateFee = lateFee > 0 ? lateFee : 0;
  const actualDamageFee = damageFee > 0 ? damageFee : 0;

  const depositRefund = Number(
    contract.depositRefund != null
      ? contract.depositRefund
      : Math.max(0, depositAmount - actualDamageFee - actualLateFee)
  );
  const earlyRentRefund = Number(contract.earlyRentRefund || 0);
  const refundedDeposit = Number(
    contract.refundAmount != null && Number(contract.refundAmount) > 0
      ? contract.refundAmount
      : (depositRefund + earlyRentRefund)
  );
  const isInspectionDone = Boolean(contract.isInspectionCompleted || actualDamageFee > 0 || actualLateFee > 0);

  // Giá thuê 1 tháng: lấy từ basePriceMonthly (nếu có) hoặc cọc (vì cọc = 1 tháng tiền thuê)
  const monthlyRent = Number(
    contract.basePriceMonthly || contract.depositHeldAmount || 0,
  );
  const totalMonths = getContractMonths(contract.startDate, contract.endDate);
  const rentPaid = monthlyRent * totalMonths;
  const totalPaidAll = depositAmount + rentPaid;

  return (
    <div className="max-w-[1000px] w-full mx-auto px-8 py-8 flex flex-col gap-6 select-none">
      {toastMessage && (
        <div className="bg-[#D7FFB8] border-2 border-[#58CC02] rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2 font-bold text-[#58A700]">
            <span className="material-symbols-outlined text-[24px]">
              check_circle
            </span>
            <span>{toastMessage}</span>
          </div>
          <button
            onClick={() => setToastMessage("")}
            className="text-[#58A700] hover:text-[#58CC02] cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
      )}

      {/* Thông báo hợp đồng đã thanh lý & hoàn tiền nếu TERMINATED */}
      {isTerminated && (
        <div className="bg-[#FAF5FF] border-2 border-[#CE82FF] rounded-2xl p-5 flex items-start gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-[#F3E8FF] flex items-center justify-center shrink-0 border-2 border-[#CE82FF]">
            <span className="material-symbols-outlined text-[#A560E8] text-[28px]">
              payments
            </span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-base font-black text-[#A560E8]">
                Hợp đồng đã kết thúc & Đã hoàn tiền thành công
              </span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-[#A560E8] text-white">
                ĐÃ HOÀN TIỀN
              </span>
            </div>
            <span className="text-xs font-bold text-[#4B4B4B] mt-1 leading-relaxed">
              Bạn đã hoàn tất thủ tục trả kho và nghiệm thu tài sản. Tổng số tiền hoàn trả{" "}
              <strong className="text-[#A560E8] font-black">
                {formatVND(refundedDeposit)}
              </strong>{" "}
              (bao gồm <strong className="text-[#1CB0F6]">{formatVND(depositRefund)}</strong> tiền cọc hoàn lại
              {earlyRentRefund > 0 && (
                <span>
                  {" "}+ <strong className="text-[#58A700]">{formatVND(earlyRentRefund)}</strong> tiền thuê các tháng còn lại sau khi trừ {contract.usedMonths || 1} tháng đã dùng &amp; 1 tháng phí phạt trả sớm
                </span>
              )}
              {(actualDamageFee > 0 || actualLateFee > 0) && (
                <span>
                  , đã khấu trừ{" "}
                  {actualDamageFee > 0 && (
                    <span><strong className="text-[#FF4B4B]">{formatVND(actualDamageFee)}</strong> phí hư hại</span>
                  )}
                  {actualDamageFee > 0 && actualLateFee > 0 && " và "}
                  {actualLateFee > 0 && (
                    <span><strong className="text-[#D97706]">{formatVND(actualLateFee)}</strong> phí trễ hạn</span>
                  )}
                </span>
              )}
              ) đã được quản lý cơ sở chuyển hoàn cho bạn.
            </span>
          </div>
        </div>
      )}

      {/* Thông báo hợp đồng đã thanh lý do quá hạn kéo dài */}
      {contract.status === "LIQUIDATED" && (
        <div className="bg-[#FFF2F2] border-2 border-[#FF4B4B] rounded-2xl p-5 flex items-start gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-[#FFDFDF] flex items-center justify-center shrink-0 border-2 border-[#FF4B4B]">
            <span className="material-symbols-outlined text-[#FF4B4B] text-[28px]">
              gavel
            </span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-base font-black text-[#FF4B4B]">
                Hợp đồng đã bị thanh lý do quá hạn kéo dài
              </span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-[#FF4B4B] text-white">
                ĐÃ THANH LÝ
              </span>
            </div>
            <span className="text-xs font-bold text-[#4B4B4B] mt-1 leading-relaxed">
              Hợp đồng đã bị thanh lý do quá hạn kéo dài; hệ thống đang tạm giữ <strong className="text-[#FF4B4B]">{formatVND(contract.depositHeldAmount || 0)}</strong>; vui lòng đến cơ sở làm việc với quản lý.
            </span>
          </div>
        </div>
      )}

      {/* Banner HD */}
      <div className="bg-[#1CB0F6] border-b-4 border-[#1899D6] rounded-2xl p-6 text-white flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex flex-col">
          <p className="text-[11px] font-black uppercase tracking-wider text-white/80 mb-1">
            Hợp đồng thuê kho
          </p>
          <p className="text-3xl font-black font-mono tracking-wide">
            {contract.contractCode}
          </p>
          <p className="text-sm font-bold text-white/90 mt-2 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[18px]">
              receipt_long
            </span>
            Từ đơn:{" "}
            <span className="font-mono bg-white/20 px-2 py-0.5 rounded-lg ml-1">
              {contract.reservationCode}
            </span>
          </p>
        </div>
        <span
          className={`px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shrink-0 ${statusInfo.cls}`}
        >
          <span className="material-symbols-outlined text-[18px]">
            {statusInfo.icon}
          </span>
          {statusInfo.label}
        </span>
      </div>

      {/* Cảnh báo quá hạn (OVERDUE) theo Business Rule */}
      {contract.status === "OVERDUE" && (
        <div className="bg-[#FFF2F2] border-2 border-[#FFB8B8] rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-[#FF4B4B] text-[32px] shrink-0 mt-0.5">
              warning
            </span>
            <div>
              <h3 className="text-sm font-black text-[#FF4B4B] uppercase tracking-wide">
                Hợp đồng đã quá hạn {contract.overdueDays || 1} ngày
              </h3>
              <p className="text-xs text-[#777777] mt-1 leading-relaxed">
                Hạn hợp đồng đã kết thúc vào ngày <strong className="text-[#4B4B4B]">{formatDate(contract.endDate)}</strong>. Phí phạt trễ tích lũy: <strong className="text-[#FF4B4B]">{formatVND(contract.lateFeeAmount || 0)}</strong>. Tiền cọc ước tính sau khi trừ phí trễ: <strong className="text-[#58A700]">{formatVND(contract.estimatedOverdueDepositRefund != null ? contract.estimatedOverdueDepositRefund : contract.depositHeldAmount || 0)}</strong>.
                {contract.isPinLocked && (
                  <span className="text-[#FF4B4B] font-bold block mt-1">
                    * Mã PIN SmartLock của khoang đã bị khóa.
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
            <button
              onClick={() => {
                setOptionsModalTab('renew');
                setIsOptionsModalOpen(true);
              }}
              className="duo-btn-green px-4 py-2.5 text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">autorenew</span>
              <span>Gia hạn kèm phí trễ</span>
            </button>
            <button
              onClick={() => {
                setOptionsModalTab('checkout');
                setIsOptionsModalOpen(true);
              }}
              className="duo-btn-red px-4 py-2.5 text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">event_available</span>
              <span>Hẹn trả kho trong 3 ngày tới</span>
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Ô kho đã thuê */}
        <div className="duo-card p-6 col-span-full">
          <div className="flex items-center gap-2 mb-6 pb-4 border-b-2 border-[#E5E5E5]">
            <span className="material-symbols-outlined text-[#1CB0F6] text-[28px]">
              warehouse
            </span>
            <h2 className="text-lg font-black text-[#4B4B4B] uppercase">
              Ô kho đã thuê
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
            <InfoRow label="Mã Ô kho" value={contract.storageUnitId} mono />
            <InfoRow label="Loại kho" value={contract.unitTypeName} />
            <InfoRow label="Diện tích" value={`${contract.areaSqm} m²`} />
            <InfoRow label="Tầng" value={`Tầng ${contract.floor}`} />
            <InfoRow label="Khu vực" value={`Khu ${contract.zone}`} />
            <InfoRow label="Phòng số" value={contract.roomNumber} mono />
          </div>
        </div>

        {/* Thời hạn & Chi phí thuê */}
        <div className="duo-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-6 pb-4 border-b-2 border-[#E5E5E5]">
              <span className="material-symbols-outlined text-[#FF9600] text-[28px]">
                calendar_month
              </span>
              <h2 className="text-lg font-black text-[#4B4B4B] uppercase">
                Thời hạn & Chi phí thuê
              </h2>
            </div>

            <div className="flex flex-col gap-5">
              {/* Thông tin ngày tháng */}
              <div className="grid grid-cols-2 gap-4">
                <InfoRow
                  label="Ngày bắt đầu"
                  value={formatDate(contract.startDate)}
                />
                <InfoRow
                  label="Ngày kết thúc"
                  value={formatDate(contract.endDate)}
                />
              </div>

              {/* Bảng phân bổ chi tiết các khoản tiền đã đóng */}
              <div className="bg-[#F7F7F7] border-2 border-[#E5E5E5] rounded-2xl p-4 flex flex-col gap-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#AFAFAF]">
                  Chi tiết các khoản đã thanh toán
                </span>

                {/* 1. Tiền cọc */}
                {(actualDamageFee > 0 || actualLateFee > 0) ? (
                  <>
                    <div className="flex items-center justify-between pb-2 border-b border-[#E5E5E5]">
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-[#4B4B4B]">
                          Tiền cọc giữ kho ban đầu
                        </span>
                        <span className="text-[10px] font-bold text-[#AFAFAF]">
                          Khoản tiền cọc đã đóng khi tạo hợp đồng
                        </span>
                      </div>
                      <span className="text-sm font-black text-[#4B4B4B]">
                        {formatVND(depositAmount)}
                      </span>
                    </div>

                    {/* Khấu trừ phí hư hại */}
                    {actualDamageFee > 0 && (
                      <div className="flex items-center justify-between pb-2 border-b border-[#E5E5E5] bg-red-50/60 -mx-4 px-4 py-2 rounded-lg">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-[#FF4B4B]">
                              Khấu trừ phí hư hại / phát sinh
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-[#FFDFDF] text-[#FF4B4B] border border-[#FF4B4B]/30">
                              Biên bản nghiệm thu
                            </span>
                          </div>
                          <span className="text-[10px] font-bold text-[#FF4B4B]/80">
                            Khấu trừ trực tiếp vào tiền cọc khi trả kho
                          </span>
                        </div>
                        <span className="text-sm font-black text-[#FF4B4B]">
                          -{formatVND(actualDamageFee)}
                        </span>
                      </div>
                    )}

                    {/* Khấu trừ phí phạt trễ hạn */}
                    {actualLateFee > 0 && (
                      <div className="flex items-center justify-between pb-2 border-b border-[#E5E5E5] bg-amber-50/60 -mx-4 px-4 py-2 rounded-lg">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-[#D97706]">
                              Khấu trừ phí phạt trễ hạn {contract.overdueDays ? `(${contract.overdueDays} ngày)` : ""}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-[#FEF3C7] text-[#D97706] border border-[#F59E0B]/30">
                              Quá hạn
                            </span>
                          </div>
                          <span className="text-[10px] font-bold text-[#D97706]/80">
                            Khấu trừ trực tiếp vào tiền cọc khi trả kho trễ
                          </span>
                        </div>
                        <span className="text-sm font-black text-[#D97706]">
                          -{formatVND(actualLateFee)}
                        </span>
                      </div>
                    )}

                    {/* Tiền cọc thực nhận hoàn */}
                    <div className="flex items-center justify-between pb-2 border-b border-[#E5E5E5]">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-[#4B4B4B]">
                            {hasRefunded ? "Tiền cọc hoàn lại" : "Tiền hoàn cọc (dự kiến)"}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold text-[#AFAFAF]">
                          Khoản cọc sau khi trừ khấu trừ hư hại / trễ hạn
                        </span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-sm font-black text-[#1CB0F6]">
                          {formatVND(depositRefund)}
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-between pb-2 border-b border-[#E5E5E5]">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-[#4B4B4B]">
                          Tiền cọc giữ kho
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-[#AFAFAF]">
                        Hoàn lại 100% khi khoang nguyên vẹn
                      </span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-sm font-black text-[#1CB0F6]">
                        {formatVND(depositAmount)}
                      </span>
                    </div>
                  </div>
                )}

                {/* 2. Tiền thuê đã đóng thực tế từ payment_transactions */}
                <div className="flex items-center justify-between pb-2 border-b border-[#E5E5E5]">
                  <div className="flex flex-col">
                    <span className="text-xs font-black text-[#4B4B4B]">
                      Tiền thuê đã đóng
                    </span>
                    <span className="text-[10px] font-bold text-[#58A700]">
                      Đã thanh toán {totalMonths} tháng (sau chiết khấu/voucher)
                    </span>
                  </div>
                  <span className="text-sm font-black text-[#58CC02]">
                    {formatVND(
                      contract.rentPaid != null ? contract.rentPaid : rentPaid,
                    )}
                  </span>
                </div>

                {/* 3. Tổng chi phí thực tế */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs font-black text-[#4B4B4B] uppercase">
                    Tổng tiền đã đóng
                  </span>
                  <span className="text-lg font-black text-[#58CC02]">
                    {formatVND(
                      contract.totalPaid != null
                        ? contract.totalPaid
                        : totalPaidAll,
                    )}
                  </span>
                </div>

                {/* 4. Bảng quyết toán hoàn trả (gồm cả hoàn cọc + hoàn tiền thuê trả sớm PR-O2) */}
                {(hasRefunded || isInspectionDone) && (
                  <div className="mt-1 pt-3 border-t-2 border-dashed border-[#CE82FF] bg-[#FAF5FF] -mx-4 -mb-4 p-4 rounded-b-2xl flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider text-[#A560E8]">
                        Quyết toán hoàn tiền khi trả kho
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-[#F3E8FF] text-[#A560E8] border border-[#CE82FF]">
                        {hasRefunded ? "✓ Đã hoàn tiền" : "Chờ chuyển khoản"}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs font-bold text-[#4B4B4B]">
                      <span>• Hoàn tiền cọc giữ kho:</span>
                      <span className="font-black text-[#1CB0F6]">+{formatVND(depositRefund)}</span>
                    </div>
                    {earlyRentRefund > 0 && (
                      <div className="flex flex-col gap-0.5 bg-[#EAFBE0] border border-[#D0F8AB] rounded-xl p-2.5 text-xs">
                        <div className="flex justify-between font-bold text-[#2B5300]">
                          <span>• Hoàn tiền thuê các tháng còn lại (PR-O2):</span>
                          <span className="font-black text-[#58A700]">+{formatVND(earlyRentRefund)}</span>
                        </div>
                        <span className="text-[10px] font-semibold text-[#2B5300]/80">
                          (Đã trừ {contract.usedMonths || 1} tháng sử dụng × {formatVND(monthlyRent)} và 1 tháng phí phạt trả sớm {formatVND(contract.breakFee || monthlyRent)})
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-1 border-t border-[#E9D8FD]">
                      <span className="text-xs font-black uppercase text-[#A560E8]">
                        {hasRefunded ? "Tổng thực nhận hoàn trả" : "Tổng tiền hoàn trả dự kiến"}
                      </span>
                      <span className="text-lg font-black text-[#A560E8]">
                        {formatVND(refundedDeposit)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* UC-16: chưa check-in thì chưa gia hạn / trả kho được */}
              {contract.status === "PENDING_CHECK_IN" ? (
                <div className="bg-[#DDF4FF] border-2 border-[#84D8FF] rounded-2xl p-4 flex items-start gap-3 mt-1 text-left">
                  <span className="material-symbols-outlined text-[#1CB0F6] text-[22px]">
                    info
                  </span>
                  <span className="text-xs font-bold text-[#4B4B4B]">
                    Hợp đồng sẽ kích hoạt sau khi nhân viên check-in và bàn giao
                    ô kho cho bạn tại cơ sở. Mã PIN mở khoá được cấp ngay khi
                    check-in xong.
                  </span>
                </div>
              ) : contract.status === "LIQUIDATED" ? (
                <div className="bg-[#FFF2F2] border-2 border-[#FFDFDF] rounded-2xl p-4 flex items-start gap-3 mt-1 text-left">
                  <span className="material-symbols-outlined text-[#FF4B4B] text-[22px]">
                    gavel
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-bold text-[#4B4B4B]">
                      Hợp đồng này đã bị thanh lý do quá hạn kéo dài. Hệ thống đang tạm giữ{" "}
                      <strong className="text-[#FF4B4B]">{formatVND(contract.depositHeldAmount || 0)}</strong> tiền cọc. Vui lòng đến cơ sở làm việc với Quản lý.
                    </span>
                  </div>
                </div>
              ) : isTerminated ? (
                <div className="bg-[#FAFAFA] border-2 border-[#E5E5E5] rounded-2xl p-4 flex items-start gap-3 mt-1 text-left">
                  <span className="material-symbols-outlined text-[#58A700] text-[22px]">
                    task_alt
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-bold text-[#4B4B4B]">
                      Hợp đồng này đã kết thúc. Tổng tiền hoàn trả cho bạn là{" "}
                      <strong className="text-[#A560E8]">{formatVND(refundedDeposit)}</strong>.
                    </span>
                    {actualDamageFee > 0 && (
                      <span className="text-[11px] font-medium text-[#FF4B4B]">
                        * Đã khấu trừ {formatVND(actualDamageFee)} chi phí hư hại theo biên bản nghiệm thu.
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                /* Nút tùy chọn hợp đồng / Hủy chờ trả kho */
                <div className="bg-[#FAFAFA] border-2 border-[#E5E5E5] rounded-2xl p-4 flex flex-col items-center gap-3 mt-1 text-center">
                  <span className="text-xs font-bold text-[#AFAFAF]">
                    {contract.status === "TERMINATION_PENDING"
                      ? (isInspectionDone ? "Tiến trình thanh lý & hoàn tất cọc" : "Đã hẹn ngày trả kho. Muốn tiếp tục thuê hoặc đổi ý?")
                      : "Cần thêm thời gian hoặc trả kho sớm?"}
                  </span>
                  {contract.status === "TERMINATION_PENDING" ? (
                    isInspectionDone ? (
                      <div className="w-full bg-[#FAF5FF] border-2 border-[#E9D8FD] rounded-2xl p-4 flex flex-col items-center gap-2 text-center">
                        <div className="flex items-center gap-1.5 text-[#805AD5] font-black text-xs uppercase tracking-wide">
                          <span className="material-symbols-outlined text-[18px]">verified</span>
                          Khoang đã hoàn tất nghiệm thu &amp; bàn giao
                        </div>
                        <p className="text-[11px] font-bold text-[#777777] leading-relaxed">
                          Nhân viên đã hoàn tất kiểm tra khoang. Quản lý cơ sở đang thực hiện đối soát và chuyển khoản hoàn cọc cho bạn (dự kiến trong 24h).
                        </p>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setCancelCheckoutError("");
                          setIsCancelCheckoutModalOpen(true);
                        }}
                        className="duo-btn-red w-full px-5 py-3 text-xs flex items-center justify-center gap-1.5 shadow-sm uppercase font-black tracking-wider cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          cancel
                        </span>
                        HỦY CHỜ TRẢ KHO
                      </button>
                    )
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsOptionsModalOpen(true)}
                      className="duo-btn-blue w-full px-5 py-3 text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        tune
                      </span>
                      TÙY CHỌN HỢP ĐỒNG
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Thông tin truy cập */}
        <div className="duo-card p-6 flex flex-col">
          <div className="flex items-center gap-2 mb-6 pb-4 border-b-2 border-[#E5E5E5]">
            <span className="material-symbols-outlined text-[#FF4B4B] text-[28px]">
              lock
            </span>
            <h2 className="text-lg font-black text-[#4B4B4B] uppercase">
              Truy cập kho
            </h2>
          </div>
          <div className="flex flex-col gap-4 flex-1 justify-center">
            <div className="bg-[#FAFAFA] border-2 border-[#E5E5E5] rounded-2xl p-5 text-center flex flex-col items-center justify-center">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#AFAFAF] mb-2 flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">
                  pin
                </span>{" "}
                Mã PIN SmartLock
              </span>
              {isTerminated ? (
                <span className="text-xs font-black uppercase tracking-wider text-[#AFAFAF] bg-[#F0F0F0] px-3 py-1.5 rounded-lg border border-[#E5E5E5]">
                  Đã vô hiệu hoá (Đã trả kho)
                </span>
              ) : contract.status === "LIQUIDATED" ? (
                <span className="text-xs font-black uppercase tracking-wider text-[#AFAFAF] bg-[#F0F0F0] px-3 py-1.5 rounded-lg border border-[#E5E5E5]">
                  Đã vô hiệu hoá (Đã thanh lý)
                </span>
              ) : contract.isPinLocked ? (
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xl font-mono font-black text-[#FF4B4B] tracking-wider">
                    ĐÃ KHÓA
                  </span>
                  <span className="text-[10px] text-[#FF4B4B] font-bold">
                    (Vui lòng thanh toán gia hạn hoặc liên hệ quản lý)
                  </span>
                </div>
              ) : contract.accessPinCode ? (
                <span className="text-3xl font-mono font-black tracking-[0.3em] text-[#4B4B4B]">
                  {contract.accessPinCode}
                </span>
              ) : (
                <span className="text-sm font-bold text-[#AFAFAF] italic">
                  Chưa được cấp phát
                </span>
              )}
            </div>

            <div className="bg-[#FAFAFA] border-2 border-[#E5E5E5] rounded-2xl p-5 text-center flex flex-col items-center justify-center">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#AFAFAF] mb-2 flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">
                  contactless
                </span>{" "}
                Mã thẻ RFID
              </span>
              {isTerminated ? (
                <span className="text-xs font-black uppercase tracking-wider text-[#AFAFAF] bg-[#F0F0F0] px-3 py-1.5 rounded-lg border border-[#E5E5E5]">
                  Đã thu hồi thẻ
                </span>
              ) : contract.status === "LIQUIDATED" ? (
                <span className="text-xs font-black uppercase tracking-wider text-[#AFAFAF] bg-[#F0F0F0] px-3 py-1.5 rounded-lg border border-[#E5E5E5]">
                  Đã thu hồi thẻ
                </span>
              ) : contract.rfidCardCode ? (
                <span className="text-lg font-mono font-black tracking-widest text-[#4B4B4B]">
                  {contract.rfidCardCode}
                </span>
              ) : (
                <span className="text-sm font-bold text-[#AFAFAF] italic">
                  Chưa được cấp phát
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Nút Quay lại */}
      <div className="mt-4">
        <button
          onClick={() => navigate("/kho-cua-toi")}
          className="flex items-center gap-2 text-sm font-bold text-[#AFAFAF] hover:text-[#4B4B4B] transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-[20px]">
            arrow_back
          </span>
          QUAY LẠI ĐƠN ĐẶT CHỖ
        </button>
      </div>

      <ContractOptionsModal
        isOpen={isOptionsModalOpen}
        onClose={() => setIsOptionsModalOpen(false)}
        contract={contract}
        onSuccess={handleModalSuccess}
        initialTab={optionsModalTab}
      />

      {/* Modal xác nhận Hủy chờ trả kho */}
      {isCancelCheckoutModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-[480px] max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4 text-[#FF4B4B]">
              <div className="w-10 h-10 rounded-full bg-[#FFDFDF] flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[24px]">cancel</span>
              </div>
              <h3 className="text-base font-black text-[#4B4B4B] uppercase tracking-wide">
                Xác nhận hủy chờ trả kho
              </h3>
            </div>
            
            <p className="text-xs text-[#777777] leading-relaxed mb-4">
              Bạn có chắc chắn muốn hủy yêu cầu trả kho cho hợp đồng{" "}
              <strong className="font-mono text-[#4B4B4B]">#{contract.contractCode}</strong>?
            </p>
            <p className="text-xs text-[#777777] leading-relaxed mb-6 bg-slate-50 border border-slate-200 rounded-xl p-3">
              Sau khi hủy, hợp đồng sẽ trở lại trạng thái <strong className="text-[#58A700]">Đang hoạt động</strong>. Bạn có thể tiếp tục thực hiện <strong className="text-[#1CB0F6]">Tùy chọn hợp đồng</strong> để gia hạn thuê kho hoặc hẹn ngày trả kho mới.
            </p>

            {cancelCheckoutError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
                <span className="material-symbols-outlined text-red-600 text-[18px]">error</span>
                <span>{cancelCheckoutError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsCancelCheckoutModalOpen(false);
                  setCancelCheckoutError("");
                }}
                disabled={cancelCheckoutLoading}
                className="duo-btn-gray px-4 py-2 text-xs"
              >
                QUAY LẠI
              </button>
              <button
                type="button"
                onClick={handleConfirmCancelCheckout}
                disabled={cancelCheckoutLoading}
                className="duo-btn-red px-5 py-2 text-xs flex items-center gap-1.5 shadow-sm font-black"
              >
                {cancelCheckoutLoading ? (
                  <>
                    <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                    ĐANG HỦY...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">check</span>
                    XÁC NHẬN HỦY
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
