import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getContractByReservation } from "../../services/contractService";
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
  const hasRefunded = isTerminated || Number(contract.refundAmount || 0) > 0;

  const statusInfo = isTerminated
    ? {
        label: hasRefunded ? "Đã kết thúc (Đã hoàn cọc)" : "Đã kết thúc",
        cls: "bg-[#D7FFB8] text-[#58A700] border-2 border-[#58CC02]",
        icon: "task_alt",
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
  const refundedDeposit = Number(contract.refundAmount || depositAmount);
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

      {/* Thông báo hợp đồng đã thanh lý & hoàn cọc nếu TERMINATED */}
      {isTerminated && (
        <div className="bg-[#EBFBEF] border-2 border-[#58CC02] rounded-2xl p-5 flex items-start gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-[#D7FFB8] flex items-center justify-center shrink-0 border-2 border-[#58CC02]">
            <span className="material-symbols-outlined text-[#58A700] text-[28px]">
              verified
            </span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-base font-black text-[#58A700]">
                Hợp đồng đã kết thúc & Đã hoàn cọc thành công
              </span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-[#58CC02] text-white">
                ĐÃ HOÀN CỌC
              </span>
            </div>
            <span className="text-xs font-bold text-[#4B4B4B] mt-1 leading-relaxed">
              Bạn đã hoàn tất thủ tục trả kho và nghiệm thu tài sản. Số tiền cọc{" "}
              <strong className="text-[#58A700] font-black">
                {formatVND(refundedDeposit)}
              </strong>{" "}
              đã được quản lý cơ sở chuyển hoàn đầy đủ vào tài khoản ngân hàng của bạn.
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
                <div className="flex items-center justify-between pb-2 border-b border-[#E5E5E5]">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-[#4B4B4B]">
                        Tiền cọc giữ kho
                      </span>
                      {hasRefunded ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-[#D7FFB8] text-[#58A700] border border-[#58CC02]">
                          Đã hoàn cọc
                        </span>
                      ) : contract.status === "TERMINATION_PENDING" ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-[#FFE8CC] text-[#E58800] border border-[#FF9600]">
                          Chờ hoàn cọc
                        </span>
                      ) : null}
                    </div>
                    <span className="text-[10px] font-bold text-[#AFAFAF]">
                      {hasRefunded
                        ? `Đã hoàn trả ${formatVND(refundedDeposit)} khi trả kho`
                        : "Hoàn lại 100% khi thanh lý kho"}
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span
                      className={`text-sm font-black ${
                        hasRefunded ? "text-[#58A700]" : "text-[#1CB0F6]"
                      }`}
                    >
                      {formatVND(depositAmount)}
                    </span>
                    {hasRefunded && (
                      <span className="text-[10px] font-black text-[#58A700]">
                        ✓ Đã hoàn cọc
                      </span>
                    )}
                  </div>
                </div>

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
                    {/* Ưu tiên lấy số tiền thuê thực tế từ backend, nếu chưa có thì lấy công thức */}
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
              ) : isTerminated || contract.status === "LIQUIDATED" ? (
                <div className="bg-[#FAFAFA] border-2 border-[#E5E5E5] rounded-2xl p-4 flex items-start gap-3 mt-1 text-left">
                  <span className="material-symbols-outlined text-[#58A700] text-[22px]">
                    task_alt
                  </span>
                  <span className="text-xs font-bold text-[#777777]">
                    Hợp đồng này đã kết thúc. Bạn đã hoàn tất trả kho và nhận lại tiền cọc.
                  </span>
                </div>
              ) : (
                /* Nút tùy chọn hợp đồng */
                <div className="bg-[#FAFAFA] border-2 border-[#E5E5E5] rounded-2xl p-4 flex flex-col items-center gap-3 mt-1 text-center">
                  <span className="text-xs font-bold text-[#AFAFAF]">
                    Cần thêm thời gian hoặc trả kho sớm?
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsOptionsModalOpen(true)}
                    className="duo-btn-blue w-full px-5 py-3 text-xs flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      tune
                    </span>
                    TÙY CHỌN HỢP ĐỒNG
                  </button>
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
      />
    </div>
  );
}
