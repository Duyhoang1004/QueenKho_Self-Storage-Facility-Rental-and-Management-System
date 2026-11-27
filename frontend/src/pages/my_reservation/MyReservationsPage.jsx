import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { getMyReservations, requestReplacementUnit } from "../../services/reservationService";
import { getMyRefundReceipts } from "../../services/refundReceiptService";
import RefundReceiptList from "../../components/RefundReceiptList";
import api from "../../services/api";
import CancelReservationModal from "../../components/CancelReservationModal";
import UnitIssueRescheduleModal from "../../components/UnitIssueRescheduleModal";
import DateInput from "../../components/DateInput";
import { formatDateVN } from "../../utils/date";
import AssetTermsModal from "../../components/AssetTermsModal";
import BookingPaidModal from "../../components/BookingPaidModal";
import { createVnpayPayment } from "../../services/vnpayService";
import SimulationButton from "../../components/SimulationButton";
import { simulateExpireHold } from "../../services/simulationService";
import PaginationBar, { ListBoxHeader } from "../../components/PaginationBar";
import TimeFilterBar from "../../components/TimeFilterBar";
import { applyTimeFilter, makeTimeFilter } from "../../utils/timeFilter";

// (10/11/2026) Lọc / sắp theo thời gian. Mặc định: đơn sắp hết hạn (≤ 3 ngày) lên đầu như cũ
const TIME_FIELDS = [
  { key: "createdAt", label: "Ngày đặt", get: (r) => r.createdAt },
  { key: "startDate", label: "Ngày nhận kho", get: (r) => r.startDate },
  { key: "endDate", label: "Ngày hết hạn", get: (r) => r.endDate },
];

const PAGE_SIZE = 5;

const STATUS_META = {
  PENDING: {
    label: "Chờ thanh toán",
    className: "bg-[#FFE8CC] text-[#E58800] border-2 border-[#FF9600]",
  },
  DEPOSIT_PAID: {
    label: "Chờ gán ô",
    className: "bg-[#DDF4FF] text-[#1CB0F6] border-2 border-[#84D8FF]",
  },
  UNIT_ASSIGNED: {
    label: "Đã gán ô kho",
    className: "bg-[#D7FFB8] text-[#58A700] border-2 border-[#58CC02]",
  },
  TERMINATION_PENDING: {
    label: "Chờ trả kho",
    className: "bg-[#FFE8CC] text-[#E58800] border-2 border-[#FF9600]",
  },
  // D-21: nghiệm thu xong, chờ khách xác nhận quyết toán
  SETTLEMENT_PENDING: {
    label: "Chờ quyết toán",
    className: "bg-[#DDF4FF] text-[#1899D6] border-2 border-[#84D8FF]",
  },
  CANCELLED: {
    label: "Đã hủy",
    className: "bg-[#FFDFDF] text-[#FF4B4B] border-2 border-[#FF4B4B]",
  },
  REFUND_PENDING: {
    label: "Chờ hoàn tiền",
    className: "bg-[#FFE8CC] text-[#E58800] border-2 border-[#FF9600]",
  },
  REFUNDED: {
    label: "Đã hoàn tiền",
    className: "bg-[#F3E8FF] text-[#A560E8] border-2 border-[#CE82FF]",
  },
  EXPIRED: {
    label: "Hết hạn",
    className: "bg-[#F7F7F7] text-[#777777] border-2 border-[#E5E5E5]",
  },
  COMPLETED: {
    label: "Hoàn tất",
    className: "bg-[#D7FFB8] text-[#58A700] border-2 border-[#58CC02]",
  },
};

const FILTERS = [
  { key: "ALL", label: "Tất cả", statuses: null },
  { key: "PENDING", label: "Chờ thanh toán", statuses: ["PENDING"] },
  { key: "DEPOSIT_PAID", label: "Đã đặt cọc", statuses: ["DEPOSIT_PAID"] },
  {
    key: "UNIT_ASSIGNED",
    label: "Đã gán ô",
    statuses: ["UNIT_ASSIGNED", "TERMINATION_PENDING", "SETTLEMENT_PENDING"],
  },
  // HĐ còn hiệu lực hết hạn trong 15 ngày tới hoặc đã quá hạn (khớp ô "HĐ sắp hết hạn" ở trang chủ)
  { key: "EXPIRING", label: "Sắp hết hạn", statuses: ["UNIT_ASSIGNED"], expiringOnly: true },
  {
    key: "CLOSED",
    label: "Đã đóng",
    statuses: ["CANCELLED", "REFUND_PENDING", "REFUNDED", "EXPIRED", "COMPLETED"],
  },
];

function formatVND(amount) {
  if (amount === null || amount === undefined) return "—";
  return Number(amount).toLocaleString("vi-VN") + "₫";
}

function formatDate(value) {
  if (!value) return "—";
  const [y, m, d] = String(value).split("-");
  return `${d}/${m}/${y}`;
}

function formatDateTimeSplit(value) {
  if (!value) return { date: "—", time: "" };
  const d = new Date(value);
  const dateStr = `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getFullYear()}`;
  const timeStr = `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  return { date: dateStr, time: timeStr };
}

// Hàm tính số tháng thuê thực tế giữa ngày bắt đầu và ngày kết thúc
function getActualMonths(r) {
  if (r.endDate && r.startDate) {
    const [y1, m1] = String(r.startDate).split("-").map(Number);
    const [y2, m2] = String(r.endDate).split("-").map(Number);
    const diff = (y2 - y1) * 12 + (m2 - m1);
    if (diff > 0) return diff;
  }
  return Number(r.durationMonths || 1);
}

function getStorageLocation(r) {
  const parts = [
    r.storageUnitFloor,
    r.storageUnitZone ? `Khu ${r.storageUnitZone}` : null,
    r.storageUnitRoomNumber ? `Phòng ${r.storageUnitRoomNumber}` : null,
  ].filter(Boolean);
  return parts.join(" • ");
}

// 22/11/2026 (PR-O32): đơn huỷ / No-Show đã được chuyển tiền nhưng khách chưa xác nhận → nhãn theo bước nhận tiền
const RECEIPT_META = {
  WAITING_CUSTOMER: { label: "Chờ xác nhận tiền", className: "bg-[#DDF4FF] text-[#1899D6] border-2 border-[#84D8FF]" },
  DISPUTED: { label: "Đang kiểm tra hoàn", className: "bg-[#FFE8CC] text-[#E58800] border-2 border-[#FF9600]" },
};

function statusMetaOf(r) {
  if (r.receiptStatus && RECEIPT_META[r.receiptStatus] && ["REFUND_PENDING", "REFUNDED"].includes(r.status)) {
    return RECEIPT_META[r.receiptStatus];
  }
  return STATUS_META[r.status] || { label: r.status, className: "bg-[#F7F7F7] text-[#777777] border-2 border-[#E5E5E5]" };
}

// PR-B13 (23/11/2026): mức huỷ đơn đã áp dụng — khách xem lại số tiền sẽ nhận sau khi gửi huỷ
const CANCEL_TIER_LABELS = {
  BOOKING_GRACE: "Huỷ trong 30 phút sau khi thanh toán — hoàn 100%",
  FULL_REFUND: "Huỷ trước giờ hẹn từ 48 giờ — hoàn 100%",
  HALF_DEPOSIT: "Huỷ trước giờ hẹn 24–48 giờ — giữ 50% tiền cọc",
  FULL_DEPOSIT: "Huỷ dưới 24 giờ trước giờ hẹn — giữ 100% tiền cọc",
  AFTER_APPOINTMENT: "Huỷ sau giờ hẹn nhận kho — giữ cọc + 1 tháng tiền thuê",
  HANDOVER_IN_PROGRESS: "Đã tới nhận kho nhưng chưa bàn giao xong — giữ 100% tiền cọc",
  HANDOVER_FAILED: "Bàn giao không thành sau 2 lần từ chối biên bản — hoàn 100%",
  FACILITY_FAULT: "Cơ sở không bàn giao được ô — hoàn 100%",
  NO_SHOW: "Không đến nhận kho (No-Show) — giữ cọc + 1 tháng tiền thuê",
  NO_SHOW_WAIVED: "No-Show được miễn phạt — hoàn 100%",
  UNPAID: "Đơn chưa thanh toán",
};

function CancellationDetail({ r }) {
  if (!r.cancelledAt) return null;
  const paid = Number(r.totalPaid || 0);
  const penalty = Number(r.cancellationPenaltyAmount || 0);
  const refund = Number(r.cancellationRefundAmount || 0);
  return (
    <div className="border-2 border-[#FFD966] bg-[#FFFBEB] rounded-2xl p-3 flex flex-col gap-1.5 text-xs font-bold text-[#4B4B4B]">
      <p className="text-[11px] font-black uppercase tracking-wider text-[#B07A00]">Chi tiết huỷ đơn</p>
      <span>Huỷ lúc: <strong>{new Date(r.cancelledAt).toLocaleString("vi-VN")}</strong></span>
      {r.cancellationTier && <span>Mức áp dụng: <strong>{CANCEL_TIER_LABELS[r.cancellationTier] || r.cancellationTier}</strong></span>}
      <div className="flex justify-between gap-3 border-t border-[#FFD966] pt-1.5 mt-0.5"><span>Đã thanh toán</span><strong>{formatVND(paid)}</strong></div>
      <div className="flex justify-between gap-3"><span>Cơ sở giữ lại</span><strong className="text-[#FF4B4B]">{penalty > 0 ? "− " : ""}{formatVND(penalty)}</strong></div>
      <div className="flex justify-between gap-3 text-sm"><span className="font-black">Số tiền hoàn cho bạn</span><strong className="text-[#58A700]">{formatVND(refund)}</strong></div>
    </div>
  );
}

// Đơn chưa có hợp đồng (chờ thanh toán / đã cọc chờ gán ô / đã huỷ trước khi gán ô): bấm mã đơn → tóm tắt đơn
function ReservationSummaryModal({ reservation: r, onClose, onOpenTerms, onChanged }) {
  const meta = statusMetaOf(r);
  const waitingUnit = ["PENDING", "DEPOSIT_PAID"].includes(r.status);
  // PR-B14 (24/11/2026): bấm số tiền đã thanh toán → popup bảng tính số tiền đã đóng lúc đặt kho
  const [paidOpen, setPaidOpen] = useState(false);
  const canExplainPaid = Number(r.totalPaid || 0) > 0 && (r.paymentLines || []).length > 0;
  const rows = [
    ["Cơ sở", r.facilityName],
    ["Địa chỉ", r.facilityAddress],
    ["Loại kho", [r.unitTypeName, r.dimensions].filter(Boolean).join(" · ")],
    ["Ngày nhận kho", formatDate(r.startDate)],
    ["Thời hạn", `${r.durationMonths || 1} tháng`],
    ["Tiền cọc", formatVND(r.depositAmount)],
    ["Đã thanh toán", canExplainPaid ? (
      <button type="button" onClick={() => setPaidOpen(true)} title="Xem cách tính số tiền đã đóng"
        className="inline-flex items-center gap-1 text-[#1CB0F6] hover:underline cursor-pointer">
        {formatVND(r.totalPaid)}
        <span className="material-symbols-outlined text-[16px]">receipt_long</span>
      </button>
    ) : formatVND(r.totalPaid)],
  ];
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl border-2 border-[#E5E5E5] w-full max-w-md p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-[#AFAFAF] uppercase tracking-wider">Đơn đặt chỗ</p>
            <h3 className="font-mono font-black text-lg text-[#1CB0F6]">{r.reservationCode}</h3>
          </div>
          <span className={`px-2.5 py-1 rounded-xl text-[11px] font-black ${meta.className}`}>{meta.label}</span>
        </div>
        <div className="flex flex-col divide-y-2 divide-[#F0F0F0] text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 py-2">
              <span className="font-bold text-[#777777] shrink-0">{label}</span>
              <span className="font-black text-[#4B4B4B] text-right">{value || "—"}</span>
            </div>
          ))}
        </div>
        <p className="text-xs font-bold text-[#777777] bg-[#F7F7F7] rounded-2xl px-3 py-2.5 leading-relaxed">
          {waitingUnit
            ? "Đơn chưa có hợp đồng. Hợp đồng được tạo khi cơ sở gán ô kho cho bạn — lúc đó bấm mã đơn sẽ mở trang hợp đồng."
            : "Đơn đã đóng trước khi cơ sở gán ô kho nên không phát sinh hợp đồng."}
        </p>
        <CancellationDetail r={r} />
        {/* PR-O32: khoản hoàn của đơn — khách bấm "Đã nhận được" / "Chưa nhận được" ngay tại đây */}
        {["REFUND_PENDING", "REFUNDED"].includes(r.status) && (
          <RefundReceiptList reservationCode={r.reservationCode} title="Tiền hoàn của đơn" onChanged={onChanged} />
        )}
        {r.status === "REFUNDED" && r.refundEvidence && !r.receiptStatus && (
          <div className="border-2 border-[#84D8FF] bg-[#F0FAFF] rounded-2xl p-3 flex flex-col gap-2">
            <p className="text-[11px] font-black uppercase tracking-wider text-[#1899D6]">Minh chứng hoàn tiền</p>
            <div className="text-xs font-bold text-[#4B4B4B] flex flex-col gap-1">
              <span>Hình thức: <strong>{r.refundEvidence.paymentMethod === "CASH" ? "Tiền mặt" : "Chuyển khoản"}</strong></span>
              {r.refundEvidence.amount != null && <span>Số tiền: <strong className="text-[#58A700]">{formatVND(r.refundEvidence.amount)}</strong></span>}
              {r.refundEvidence.transactionCode && <span>Mã giao dịch: <strong className="break-all">{r.refundEvidence.transactionCode}</strong></span>}
              {r.refundEvidence.bankTransactionCode && <span>Mã ngân hàng/FT: <strong className="break-all">{r.refundEvidence.bankTransactionCode}</strong></span>}
              {r.refundEvidence.completedAt && <span>Hoàn tất lúc: <strong>{new Date(r.refundEvidence.completedAt).toLocaleString("vi-VN")}</strong></span>}
            </div>
            {r.refundEvidence.note && (
              <div className="bg-white border border-[#84D8FF] rounded-xl p-2.5">
                <span className="block text-[10px] font-black uppercase text-[#1899D6] mb-1">Ghi chú của quản lý cơ sở</span>
                <p className="text-xs font-bold text-[#4B4B4B] whitespace-pre-wrap break-words">{r.refundEvidence.note}</p>
              </div>
            )}
            {r.refundEvidence.evidenceImageUrl && (
              <a href={r.refundEvidence.evidenceImageUrl} target="_blank" rel="noreferrer" title="Mở ảnh minh chứng hoàn tiền"
                className="block overflow-hidden rounded-xl border-2 border-[#84D8FF] bg-white">
                <img src={r.refundEvidence.evidenceImageUrl} alt="Minh chứng hoàn tiền do quản lý cơ sở cung cấp"
                  className="w-full max-h-64 object-contain" />
              </a>
            )}
          </div>
        )}
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onOpenTerms} className="duo-btn-white px-4 py-2 text-xs">Điều khoản thuê kho</button>
          <button type="button" onClick={onClose} className="duo-btn-blue px-4 py-2 text-xs">Đóng</button>
        </div>
        {/* Đặt trong khung (đã chặn click lan ra nền) để đóng popup con không đóng luôn popup đơn */}
        <BookingPaidModal open={paidOpen} reservationCode={r.reservationCode} lines={r.paymentLines || []}
          transactions={r.paymentTransactions || []} totalPaid={r.totalPaid} onClose={() => setPaidOpen(false)} />
      </div>
    </div>
  );
}

function readUserId() {
  const user = JSON.parse(sessionStorage.getItem("user") || "{}");
  return user.userId ?? null;
}

function unitIssueChoiceMessage(choice) {
  if (!choice) return null;
  if (choice.option === 'CHANGE_UNIT')
    return 'Bạn đã chọn đổi ô cùng loại. Quản lý cơ sở đang kiểm tra và bố trí ô kho phù hợp cho bạn.';
  if (choice.option === 'RESCHEDULE')
    return `Bạn đã chọn dời ngày nhận kho${choice.newStartDate ? ` sang ${formatDateVN(choice.newStartDate)}` : ''}. Quản lý cơ sở đang cập nhật lịch nhận kho.`;
  if (choice.option === 'CANCEL_100')
    return 'Bạn đã chọn hủy đơn và hoàn 100% số tiền đã thanh toán. Quản lý cơ sở đang xử lý hủy đơn và hồ sơ hoàn tiền.';
  return 'Quản lý cơ sở đang xử lý phương án bạn đã chọn.';
}

export default function MyReservationsPage() {
  const [selectedResToCancel, setSelectedResToCancel] = useState(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  // BR-141: ô đã gán gặp sự cố → khách dời ngày nhận kho
  const [unitIssueTarget, setUnitIssueTarget] = useState(null);
  const [replacementNotes, setReplacementNotes] = useState({});
  const [replacementFeedback, setReplacementFeedback] = useState({});
  const [requestingReplacementId, setRequestingReplacementId] = useState(null);
  const [issueHandovers, setIssueHandovers] = useState({});
  const [issueChoices, setIssueChoices] = useState({});
  const [savingIssueId, setSavingIssueId] = useState(null);
  const userId = readUserId();
  const navigate = useNavigate();

  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(Boolean(userId));
  const [error, setError] = useState(
    userId ? "" : "Bạn cần đăng nhập để xem đơn đặt chỗ.",
  );
  // Bộ lọc lấy từ ?loc= để trang chủ dẫn thẳng tới đúng nhóm đơn (vd. /kho-cua-toi?loc=EXPIRING)
  const [searchParams, setSearchParams] = useSearchParams();
  const locParam = searchParams.get("loc");
  const filter = FILTERS.some((f) => f.key === locParam) ? locParam : "ALL";
  const setFilter = (key) =>
    setSearchParams(key === "ALL" ? {} : { loc: key }, { replace: true });
  const [currentPage, setCurrentPage] = useState(1);
  const [timeFilter, setTimeFilter] = useState(() => makeTimeFilter(TIME_FIELDS, "default"));
  const [reloadKey, setReloadKey] = useState(0);
  const [retryingId, setRetryingId] = useState(null);
  const [termsOpen, setTermsOpen] = useState(false);
  const [summaryRes, setSummaryRes] = useState(null);

  useEffect(() => {
    const affected = reservations.filter(r => r.unitIssue && !r.unitIssueRescheduled && r.contractId);
    if (!affected.length) return;
    let active = true;
    Promise.all(affected.map(async r => {
      try { return [r.id, (await api.get(`/contracts/${r.contractId}/check-in-handover`)).data]; }
      catch { return [r.id, null]; }
    })).then(rows => { if (active) setIssueHandovers(Object.fromEntries(rows)); });
    return () => { active = false; };
  }, [reservations]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    // Lấy song song cả đơn đặt chỗ và hợp đồng để đồng bộ ngày kết thúc chính xác
    Promise.all([
      getMyReservations(userId),
      api
        .get("/contracts", { params: { customerId: userId } })
        .then((res) => res.data)
        .catch(() => []),
      getMyRefundReceipts().catch(() => []),
    ])
      .then(([resData, contractsData, receiptsData]) => {
        if (cancelled) return;

        // PR-O32: trạng thái khách xác nhận nhận tiền hoàn, theo mã đơn (khoản mới nhất)
        const receiptByResCode = {};
        (receiptsData || []).forEach((rc) => {
          if (rc.reservationCode && !receiptByResCode[rc.reservationCode]) receiptByResCode[rc.reservationCode] = rc.receiptStatus;
        });

        // Tạo map hợp đồng theo mã đơn
        const contractsByResCode = {};
        (contractsData || []).forEach((c) => {
          if (c.reservationCode) {
            contractsByResCode[c.reservationCode] = c;
          }
        });

        // Gộp ngày kết thúc thực tế của HĐ và đồng bộ trạng thái vào từng đơn đặt chỗ
        const merged = (resData || []).map((raw) => {
          const r = { ...raw, receiptStatus: receiptByResCode[raw.reservationCode] || null };
          const c = contractsByResCode[r.reservationCode];
          if (c) {
            return {
              ...r,
              status:
                c.status === "TERMINATION_PENDING" || c.status === "SETTLEMENT_PENDING"
                  ? c.status
                  : r.status,
              endDate: c.endDate,
              contractId: c.contractId,
              contractCode: c.contractCode,
              contractStatus: c.status,
              storageUnitId: c.storageUnitId || r.storageUnitId,
              storageUnitFloor: c.floor || r.storageUnitFloor,
              storageUnitZone: c.zone || r.storageUnitZone,
              storageUnitRoomNumber: c.roomNumber || r.storageUnitRoomNumber,
              facilityName: c.facilityName || r.facilityName,
              facilityAddress: c.facilityAddress || r.facilityAddress,
              facilityHotline: c.facilityHotline || r.facilityHotline,
            };
          }
          return r;
        });

        setReservations(merged);
        setError("");
      })
      .catch(() => {
        if (!cancelled)
          setError("Không tải được danh sách đơn đặt chỗ. Vui lòng thử lại.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, reloadKey]);

  const retry = () => {
    setError("");
    setLoading(true);
    setReloadKey((k) => k + 1);
  };

  const handleCancelSuccess = () => {
    setIsCancelModalOpen(false);
    setSelectedResToCancel(null);
    setReloadKey((k) => k + 1);
    alert("Đã hủy đơn đặt chỗ thành công.");
  };

  const handleRetryPayment = async (reservation) => {
    try {
      setRetryingId(reservation.id);
      const paymentData = await createVnpayPayment(reservation.id);
      let sessionUser = {};
      try {
        sessionUser = JSON.parse(sessionStorage.getItem("user") || "{}");
      } catch {
        sessionUser = {};
      }
      sessionStorage.setItem("queenkhoPaymentContext", JSON.stringify({
        reservation,
        customerInfo: {
          fullName: reservation.customerName || sessionUser.fullName || "",
          phone: reservation.customerPhone || sessionUser.phone || "",
          email: reservation.customerEmail || sessionUser.email || "",
          cccd: reservation.customerCccd || sessionUser.cccd || "",
        },
        selectedMonths: reservation.durationMonths,
        startDate: reservation.startDate,
        totalPayment: Number(paymentData.amount || 0),
        deposit: Number(paymentData.depositAmount || reservation.depositAmount || 0),
        storage: {
          branch: reservation.facilityName,
          address: reservation.facilityAddress,
          hotline: reservation.facilityHotline,
          name: reservation.unitTypeName,
          area: Number(reservation.areaSqm || 0),
          dimension: reservation.dimensions,
        },
      }));
      window.location.assign(paymentData.payUrl);
    } catch (err) {
      alert(err.response?.data?.message || "Không thể tạo lại liên kết thanh toán VNPAY.");
      setRetryingId(null);
      setReloadKey((k) => k + 1);
    }
  };

  const countBy = (statuses) =>
    reservations.filter((r) => statuses.includes(r.status)).length;

  const stats = [
    {
      icon: "receipt_long",
      label: "Tổng đơn đặt chỗ",
      value: reservations.length,
      iconColor: "text-[#58A700]",
      iconBg: "bg-[#D7FFB8]",
      cardBorder: "hover:border-[#58CC02]",
    },
    {
      icon: "hourglass_top",
      label: "Chờ thanh toán cọc",
      value: countBy(["PENDING"]),
      iconColor: "text-[#E58800]",
      iconBg: "bg-[#FFE8CC]",
      cardBorder: "hover:border-[#FF9600]",
    },
    {
      icon: "payments",
      label: "Đã cọc, chờ gán ô",
      value: countBy(["DEPOSIT_PAID"]),
      iconColor: "text-[#1CB0F6]",
      iconBg: "bg-[#DDF4FF]",
      cardBorder: "hover:border-[#1CB0F6]",
    },
    {
      icon: "inventory_2",
      label: "Đã gán ô kho",
      value: countBy(["UNIT_ASSIGNED", "TERMINATION_PENDING", "SETTLEMENT_PENDING"]),
      iconColor: "text-[#58A700]",
      iconBg: "bg-[#D7FFB8]",
      cardBorder: "hover:border-[#58CC02]",
    },
  ];

  function getDaysUntilExpiry(r) {
    if (r.status !== "UNIT_ASSIGNED") return null;
    let endStr = r.endDate;
    if (!endStr && r.startDate && r.durationMonths) {
      const [y, m, d] = String(r.startDate).split("-").map(Number);
      const date = new Date(y, m - 1 + Number(r.durationMonths), d);
      const newY = date.getFullYear();
      const newM = String(date.getMonth() + 1).padStart(2, "0");
      const newD = String(date.getDate()).padStart(2, "0");
      endStr = `${newY}-${newM}-${newD}`;
    }
    if (!endStr) return null;
    const [y, m, d] = String(endStr).split("-").map(Number);
    const target = new Date(y, m - 1, d);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((target - today) / 86400000);
  }

  const visibleReservations = useMemo(() => {
    const active = FILTERS.find((f) => f.key === filter);
    let list = reservations;
    if (active && active.statuses) {
      list = reservations.filter((r) => active.statuses.includes(r.status));
    }
    if (active?.expiringOnly) {
      list = list.filter((r) => {
        const days = getDaysUntilExpiry(r);
        return days !== null && days <= 15;
      });
    }
    list = applyTimeFilter(list, timeFilter, TIME_FIELDS);
    if (timeFilter.order !== "default") return list;
    return [...list].sort((a, b) => {
      const diffA = getDaysUntilExpiry(a);
      const diffB = getDaysUntilExpiry(b);
      const isExpiringA = diffA !== null && diffA <= 3;
      const isExpiringB = diffB !== null && diffB <= 3;

      if (isExpiringA && !isExpiringB) return -1;
      if (!isExpiringA && isExpiringB) return 1;
      if (isExpiringA && isExpiringB) {
        return diffA - diffB;
      }
      return 0;
    });
  }, [reservations, filter, timeFilter]);

  const totalPages = Math.max(1, Math.ceil(visibleReservations.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedReservations = visibleReservations.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  // Điều hướng và highlight đơn đặt / hợp đồng khi bấm từ thông báo chuông
  const highlightParam = searchParams.get('highlightCode') || searchParams.get('highlightReservationId') || searchParams.get('reservationId') || searchParams.get('contractCode') || searchParams.get('highlight');
  const [activeHighlightCode, setActiveHighlightCode] = useState(null);

  // Tự động tìm đơn/hợp đồng, đổi tab khi bấm từ thông báo
  useEffect(() => {
    if (!highlightParam || reservations.length === 0) return;

    const target = reservations.find(
      (r) =>
        r.reservationCode === highlightParam ||
        r.contractCode === highlightParam ||
        String(r.id) === String(highlightParam) ||
        String(r.contractId) === String(highlightParam)
    );
    if (!target) return;

    // 1. Chuyển tab phù hợp nếu tab hiện tại không chứa trạng thái của đơn này
    const currentTabObj = FILTERS.find((f) => f.key === filter);
    if (currentTabObj && currentTabObj.statuses && !currentTabObj.statuses.includes(target.status)) {
      const properTab = FILTERS.find((f) => f.statuses?.includes(target.status));
      if (properTab) {
        setFilter(properTab.key);
      } else {
        setFilter('ALL');
      }
    }

    // 2. Đánh dấu highlight
    setActiveHighlightCode(target.reservationCode || target.contractCode || String(target.id));
  }, [highlightParam, reservations]);

  // Tự động lật đúng trang phân trang chứa đơn cần highlight
  useEffect(() => {
    if (!highlightParam || visibleReservations.length === 0) return;
    const targetIdx = visibleReservations.findIndex(
      (r) =>
        r.reservationCode === highlightParam ||
        r.contractCode === highlightParam ||
        String(r.id) === String(highlightParam) ||
        String(r.contractId) === String(highlightParam)
    );
    if (targetIdx !== -1) {
      const targetPage = Math.floor(targetIdx / PAGE_SIZE) + 1;
      if (currentPage !== targetPage) {
        setCurrentPage(targetPage);
      }
    }
  }, [highlightParam, visibleReservations]);

  // Cuộn mượt đến hàng/card và giữ highlight nổi bật 8 giây
  useEffect(() => {
    if (!activeHighlightCode) return;
    const timer = setTimeout(() => {
      const el = document.getElementById("res-row-" + activeHighlightCode);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 300);
    const clearTimer = setTimeout(() => {
      setActiveHighlightCode(null);
    }, 8000);
    return () => {
      clearTimeout(timer);
      clearTimeout(clearTimer);
    };
  }, [activeHighlightCode, currentPage, filter]);

  return (
    <div className="max-w-[1240px] w-full mx-auto px-6 py-6 flex flex-col gap-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-[#AFAFAF]">
        <Link to="/" className="hover:text-[#4B4B4B] transition-colors">
          Trang chủ
        </Link>
        <span>/</span>
        <span className="text-[#4B4B4B]">Đơn đặt chỗ của tôi</span>
      </div>

      {/* Tiêu đề + Nút đặt kho */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl sm:text-3xl font-black text-[#4B4B4B] tracking-tight">
            Đơn đặt chỗ của tôi
          </h1>
          <p className="text-[13px] font-bold text-[#AFAFAF]">
            Theo dõi trạng thái các đơn đặt chỗ, từ lúc đặt cọc đến khi được gán
            ô kho.
          </p>
        </div>
        <div className="flex items-center gap-2.5 self-start sm:self-auto shrink-0 flex-wrap">
          <button
            type="button"
            onClick={() => setTermsOpen(true)}
            className="duo-btn-white px-4 py-3 text-xs tracking-wider flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px] text-[#B78900]">
              gavel
            </span>
            <span>ĐIỀU KHOẢN THUÊ</span>
          </button>
          <Link
            to="/tim-va-dat-kho"
            className="duo-btn-green px-5 py-3 text-xs tracking-wider flex items-center gap-1.5 shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">
              add_circle
            </span>
            <span>ĐẶT KHO MỚI</span>
          </Link>
        </div>
      </div>

      {/* PR-O32: mọi khoản hoàn đang chờ khách xác nhận (huỷ đơn, No-Show, trả kho...) */}
      <RefundReceiptList onlyPending title="Tiền hoàn chờ bạn xác nhận" onChanged={() => setReloadKey((k) => k + 1)} />

      {/* Thẻ thống kê */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={`duo-card p-4 flex flex-col gap-3 transition-all ${stat.cardBorder}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#AFAFAF]">
                {stat.label}
              </span>
              <div
                className={`w-9 h-9 rounded-xl ${stat.iconBg} ${stat.iconColor} flex items-center justify-center border-2 border-b-4 border-black/5`}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {stat.icon}
                </span>
              </div>
            </div>
            <span className="text-3xl font-black text-[#4B4B4B]">
              {loading ? "—" : stat.value}
            </span>
          </div>
        ))}
      </div>

      {/* Bảng danh sách */}
      <div className="duo-card overflow-hidden">
        <ListBoxHeader
          icon="receipt_long"
          title="Danh sách đơn đặt chỗ"
          subtitle="Theo dõi trạng thái đơn đặt chỗ và hợp đồng thuê kho"
          count={visibleReservations.length}
          countLabel="đơn đặt chỗ"
          accentColor="bg-[#D7FFB8] text-[#58A700] border-[#58CC02]"
        />
        {/* Bộ lọc trạng thái */}
        <div className="px-4 py-3 bg-[#FAFAFA] border-b-2 border-[#E5E5E5] flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => {
                setFilter(f.key);
                setCurrentPage(1);
              }}
              className={`px-4 py-1.5 rounded-2xl text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                filter === f.key
                  ? "bg-[#58CC02] border-2 border-b-4 border-[#58A700] text-white shadow-xs"
                  : "bg-white border-2 border-[#E5E5E5] text-[#777777] hover:bg-[#F7F7F7] hover:text-[#4B4B4B] active:border-b-2 active:translate-y-[2px]"
              }`}
            >
              {f.label}
            </button>
          ))}
          <TimeFilterBar
            className="w-full pt-1"
            value={timeFilter}
            onChange={(v) => { setTimeFilter(v); setCurrentPage(1); }}
            fields={TIME_FIELDS}
            defaultLabel="Mặc định"
          />
        </div>

        {loading && (
          <p className="px-6 py-8 text-sm font-bold text-[#AFAFAF]">
            Đang tải danh sách...
          </p>
        )}

        {!loading && error && (
          <div className="px-6 py-8 flex flex-col items-start gap-3">
            <p className="text-[#FF4B4B] font-bold text-sm">{error}</p>
            <button onClick={retry} className="duo-btn-blue px-4 py-2 text-xs">
              Thử lại
            </button>
          </div>
        )}

        {!loading && !error && reservations.length === 0 && (
          <div className="px-6 py-12 flex flex-col items-center gap-4 text-center bg-white">
            <div className="w-16 h-16 rounded-full bg-[#F7F7F7] flex items-center justify-center border-2 border-[#E5E5E5]">
              <span className="material-symbols-outlined text-[32px] text-[#AFAFAF]">
                inventory_2
              </span>
            </div>
            <p className="text-sm font-bold text-[#777777]">
              Bạn chưa có đơn đặt chỗ nào.
            </p>
            <Link
              to="/tim-va-dat-kho"
              className="duo-btn-green px-5 py-3 text-xs mt-1"
            >
              Tìm & đặt kho ngay
            </Link>
          </div>
        )}

        {!loading &&
          !error &&
          reservations.length > 0 &&
          visibleReservations.length === 0 && (
            <p className="px-6 py-8 text-sm font-bold text-[#AFAFAF] bg-white">
              Không có đơn nào ở trạng thái này.
            </p>
          )}

        {/* Sự cố ô: sau khi khách đã dời lịch, hiển thị lịch mới thay cho cảnh báo chưa xử lý. */}
        {!loading && !error && reservations.filter((r) => r.unitIssue && !r.unitIssueRescheduled).map((r) => (
          <div key={`issue-${r.id}`} className="mx-4 my-3 rounded-2xl bg-[#FFF4CC] border-2 border-[#FFC800] px-4 py-3 flex flex-col md:flex-row md:items-center gap-3">
            <span className="material-symbols-outlined text-[#B58900] text-[28px] shrink-0">construction</span>
            <div className="flex-1 text-xs font-bold text-[#777777] leading-relaxed">
              <span className="block text-sm font-black text-[#B58900]">
                Ô kho của đơn {r.reservationCode} đang gặp sự cố
              </span>
              Ô {r.storageUnitId} chưa thể bàn giao theo lịch ngày {formatDateVN(r.startDate)}.
              {issueHandovers[r.id]?.faultNote && <p className="mt-1 text-[#4B4B4B]">Kết luận của quản lý cơ sở: {issueHandovers[r.id].faultNote}</p>}
              {issueHandovers[r.id]?.customerChoice
                ? <p className="mt-1 text-[#4B4B4B]">{unitIssueChoiceMessage(issueHandovers[r.id].customerChoice)}</p>
                : <p className="mt-1">Hãy chọn một phương án bên cạnh. Quản lý cơ sở sẽ thực hiện sau khi nhận được lựa chọn của bạn.</p>}
            </div>
            {issueHandovers[r.id]?.status === 'BLOCKED_FM' && issueHandovers[r.id]?.facilityFaultConfirmed &&
              <div className="flex flex-col gap-2 min-w-[250px] max-w-[330px]">
                <select className="duo-input text-xs" value={issueChoices[r.id]?.option || issueHandovers[r.id]?.customerChoice?.option || ''}
                  disabled={issueHandovers[r.id]?.customerChoiceExecuted}
                  onChange={e => setIssueChoices(prev => ({ ...prev, [r.id]: { ...prev[r.id], option: e.target.value } }))}>
                  <option value="">Chọn phương án</option>
                  <option value="CHANGE_UNIT">Đổi ô cùng loại</option>
                  <option value="RESCHEDULE">Dời ngày nhận kho</option>
                  <option value="CANCEL_100">Hủy và hoàn 100%</option>
                </select>
                {(issueChoices[r.id]?.option || issueHandovers[r.id]?.customerChoice?.option) === 'RESCHEDULE' &&
                  <DateInput min={new Date(Date.now() + 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })} className="duo-input w-full text-xs"
                    value={issueChoices[r.id]?.newStartDate || ''} onChange={e => setIssueChoices(prev => ({ ...prev, [r.id]: { ...prev[r.id], newStartDate: e.target.value } }))} />}
                {(issueChoices[r.id]?.option || issueHandovers[r.id]?.customerChoice?.option) === 'CANCEL_100' && <>
                  <select className="duo-input text-xs" value={issueChoices[r.id]?.refundMethod || ''} onChange={e => setIssueChoices(prev => ({ ...prev, [r.id]: { ...prev[r.id], refundMethod: e.target.value } }))}>
                    <option value="">Chọn cách nhận tiền hoàn</option><option value="CASH">Tiền mặt tại quầy</option><option value="BANK_TRANSFER">Chuyển khoản</option>
                  </select>
                  {issueChoices[r.id]?.refundMethod === 'BANK_TRANSFER' && ['bankName', 'bankAccountNumber', 'bankAccountName'].map((field, index) =>
                    <input key={field} className="duo-input text-xs" maxLength={100} value={issueChoices[r.id]?.[field] || ''}
                      placeholder={['Tên ngân hàng', 'Số tài khoản', 'Tên chủ tài khoản'][index]}
                      onChange={e => setIssueChoices(prev => ({ ...prev, [r.id]: { ...prev[r.id], [field]: e.target.value } }))} />)}
                </>}
                <input className="duo-input text-xs" maxLength={300} placeholder="Ghi chú cho quản lý cơ sở (nếu có)" value={issueChoices[r.id]?.note || ''}
                  onChange={e => setIssueChoices(prev => ({ ...prev, [r.id]: { ...prev[r.id], note: e.target.value } }))} />
                <button type="button" className="duo-btn-blue px-4 py-2 text-xs disabled:opacity-50"
                  disabled={savingIssueId === r.id || !issueChoices[r.id]?.option || issueHandovers[r.id]?.customerChoiceExecuted}
                  onClick={async () => {
                    try {
                      setSavingIssueId(r.id);
                      await api.post(`/contracts/${r.contractId}/check-in-issue-choice`, issueChoices[r.id]);
                      const latest = (await api.get(`/contracts/${r.contractId}/check-in-handover`)).data;
                      setIssueHandovers(prev => ({ ...prev, [r.id]: latest }));
                      setReplacementFeedback(prev => ({ ...prev, [r.id]: '' }));
                    } catch (err) { setReplacementFeedback(prev => ({ ...prev, [r.id]: err.response?.data?.message || 'Không gửi được phương án.' })); }
                    finally { setSavingIssueId(null); }
                  }}>Xác nhận phương án</button>
                {replacementFeedback[r.id] && <p role="alert" className="text-[#C53030]">{replacementFeedback[r.id]}</p>}
              </div>}
          </div>
        ))}
        {!loading && !error && reservations.filter((r) => r.unitIssue && r.unitIssueRescheduled).map((r) => (
          <div key={`rescheduled-issue-${r.id}`} className="mx-4 my-3 rounded-2xl bg-[#F0F9FF] border-2 border-[#84D8FF] px-4 py-3 flex items-center gap-3">
            <span className="material-symbols-outlined text-[#0284C7] text-[28px]">event_available</span>
            <p className="text-xs font-bold text-[#4B4B4B]">
              Đơn {r.reservationCode} đã dời ngày nhận kho sang <b>{formatDateVN(r.startDate)}</b>. Cơ sở sẽ chuẩn bị hoặc bố trí ô phù hợp trước lịch mới. Nếu cần thay đổi phương án, vui lòng liên hệ cơ sở.
            </p>
          </div>
        ))}

        {!loading && !error && visibleReservations.length > 0 && (
          <div
            className="max-w-full overflow-x-auto bg-white custom-scrollbar pb-2"
            role="region"
            aria-label="Danh sách đơn đặt chỗ"
            tabIndex={0}
          >
            <table className="w-full table-fixed text-left border-collapse">
              <colgroup>
                <col className="w-[8.5%]" />
                <col className="w-[13.5%]" />
                <col className="w-[11%]" />
                <col className="w-[11%]" />
                <col className="w-[7.5%]" />
                <col className="w-[5%]" />
                <col className="w-[12.5%]" />
                <col className="w-[7%]" />
                <col className="w-[10%]" />
                <col className="w-[14%]" />
              </colgroup>
              <thead className="bg-[#FAFAFA] text-[#AFAFAF] text-[10px] font-black uppercase tracking-widest border-b-2 border-[#E5E5E5]">
                <tr>
                  <th className="px-3 py-3 whitespace-nowrap">Mã đơn</th>
                  <th className="px-3 py-3 whitespace-nowrap">Cơ sở</th>
                  <th className="px-3 py-3 whitespace-nowrap">Loại kho</th>
                  <th className="px-3 py-3 whitespace-nowrap">Ô kho</th>
                  <th className="px-3 py-3 whitespace-nowrap">Bắt đầu</th>
                  <th className="px-3 py-3 whitespace-nowrap text-center">
                    T/gian
                  </th>
                  <th className="px-3 py-3 whitespace-nowrap">
                    Tổng thanh toán
                  </th>
                  <th className="px-3 py-3 whitespace-nowrap">Ngày đặt</th>
                  <th className="px-3 py-3 whitespace-nowrap">Trạng thái</th>
                  <th className="px-3 py-3 whitespace-nowrap text-center">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody className="text-[13px] font-bold text-[#4B4B4B]">
                {paginatedReservations.map((r, index) => {
                  const meta = statusMetaOf(r);
                  const diffDays = getDaysUntilExpiry(r);
                  const isExpiringSoon = diffDays !== null && diffDays <= 3;
                  const isLast = index === paginatedReservations.length - 1;
                  const dt = formatDateTimeSplit(r.createdAt);

                  // 1. Số tháng thực tế (đồng bộ theo hợp đồng nếu đã gia hạn)
                  const actualMonths = getActualMonths(r);
                  const isRenewed =
                    r.endDate && actualMonths > Number(r.durationMonths || 0);

                  const isHighlighted = Boolean(
                    activeHighlightCode &&
                    (r.reservationCode === activeHighlightCode ||
                     r.contractCode === activeHighlightCode ||
                     String(r.id) === String(activeHighlightCode) ||
                     String(r.contractId) === String(activeHighlightCode))
                  );

                  return (
                    <tr
                      key={r.id}
                      id={`res-row-${r.reservationCode || r.id}`}
                      className={`transition-all ${isHighlighted ? "ring-4 ring-[#58CC02] ring-offset-2 bg-[#F0FDF4] animate-pulse border-[#58CC02] shadow-md " : "hover:bg-[#F7F7F7] "} ${!isLast ? "border-b-2 border-[#F0F0F0]" : ""} ${isExpiringSoon && !isHighlighted ? "bg-[#FFFBEB] hover:bg-[#FFF3C7]" : ""}`}
                    >
                      {/* Cột 1: Mã đơn */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        {/* Bấm mã đơn: đã có hợp đồng → trang hợp đồng; chưa có → tóm tắt đơn */}
                        <button
                          type="button"
                          onClick={() =>
                            r.contractId
                              ? navigate(`/kho-cua-toi/hop-dong/${r.id}`)
                              : setSummaryRes(r)
                          }
                          title={r.contractId ? "Xem hợp đồng" : "Xem chi tiết đơn"}
                          className="font-mono font-black text-[#1CB0F6] bg-[#DDF4FF] px-1.5 py-0.5 rounded border border-[#84D8FF] hover:bg-[#C4EBFF] hover:underline cursor-pointer"
                        >
                          {r.reservationCode}
                        </button>
                      </td>

                      {/* Cột 2: Cơ sở */}
                      <td className="px-3 py-3 align-top">
                        <div className="font-extrabold text-[#4B4B4B]">
                          {(r.facilityName || "Chưa cập nhật").replace("QueenKho ", "")}
                        </div>
                        <div className="mt-1 flex items-start gap-1 text-[10px] font-bold leading-4 text-[#AFAFAF]">
                          <span className="material-symbols-outlined mt-px text-[13px] shrink-0">location_on</span>
                          <span>{r.facilityAddress || "Địa chỉ đang cập nhật"}</span>
                        </div>
                        {r.facilityHotline && (
                          <div className="mt-0.5 text-[10px] font-bold text-[#777777]">Hotline: {r.facilityHotline}</div>
                        )}
                      </td>

                      {/* Cột 3: Loại kho */}
                      <td className="px-3 py-3 align-top text-[#777777]">
                        <div>{r.unitTypeName || "Chưa cập nhật"}</div>
                        <div className="mt-1 text-[10px] font-bold text-[#AFAFAF]">
                          {r.dimensions || "Kích thước đang cập nhật"}
                        </div>
                      </td>

                      {/* Cột 4: Ô kho */}
                      <td className="px-3 py-3 align-top">
                        {r.storageUnitId ? (
                          <div>
                            <span className="font-mono font-black text-[#1CB0F6]">{r.storageUnitId}</span>
                            <span className="mt-1 block text-[10px] font-bold text-[#777777]">
                              {getStorageLocation(r) || "Vị trí đang cập nhật"}
                            </span>
                          </div>
                        ) : (
                          <div className="leading-4">
                            <span className="text-[#AFAFAF] italic">Chưa gán ô</span>
                            <span className="block text-[10px] font-bold text-[#AFAFAF]">Quản lý cơ sở sẽ phân bổ</span>
                          </div>
                        )}
                      </td>

                      {/* Cột 5: Bắt đầu */}
                      <td className="px-3 py-3 whitespace-nowrap font-bold text-[#4B4B4B]">
                        {formatDate(r.startDate)}
                      </td>

                      {/* Cột 6: T/gian (Hiển thị số tháng thực tế của hợp đồng) */}
                      <td className="px-3 py-3 whitespace-nowrap text-center">
                        <span className="font-extrabold">{actualMonths}T</span>
                        {isRenewed && (
                          <span className="block text-[9px] font-black text-[#1CB0F6] bg-[#DDF4FF] rounded px-1 mt-0.5 whitespace-nowrap border border-[#84D8FF]">
                            Đã gia hạn
                          </span>
                        )}
                      </td>

                      {/* Cột 7: Tổng thanh toán (Lấy số tiền thật từ payment_transactions) */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        {(() => {
                          const deposit = Number(r.depositAmount || 0);
                          const months = actualMonths;
                          // Nếu có tiền thật từ payment_transactions (> 0) thì ưu tiên dùng, ngược lại fallback tính tạm
                          const hasRealPayment = Number(r.totalPaid || 0) > 0;
                          const finalAmount = hasRealPayment
                            ? Number(r.totalPaid)
                            : deposit + deposit * months;
                          const isDiscounted =
                            hasRealPayment &&
                            finalAmount !== deposit + deposit * months;

                          return (
                            <div className="flex flex-col leading-tight">
                              <span className="font-black text-[#58CC02] text-sm">
                                {formatVND(finalAmount)}
                              </span>
                              <span className="text-[10px] font-bold text-[#AFAFAF]">
                                Cọc {formatVND(deposit)} + {months}T thuê
                              </span>
                              {isDiscounted && (
                                <span className="mt-0.5 text-[9px] font-bold text-[#777777]">
                                  (Đã áp ưu đãi)
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </td>

                      {/* Cột 8: Ngày đặt  */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="flex flex-col leading-tight">
                          <span className="text-[11px] font-bold text-[#777777]">
                            {dt.time}
                          </span>
                          <span className="text-[11px] font-bold text-[#AFAFAF]">
                            {dt.date}
                          </span>
                        </div>
                      </td>

                      {/* Cột 9: Trạng thái (Đứng đúng cột Trạng thái, tự gói gọn trong ô không tràn sang cột Thao tác) */}
                      <td className="px-3 py-3 align-middle overflow-hidden">
                        <div className="flex flex-col items-start gap-1 max-w-full">
                          <span
                            className={`inline-block max-w-full whitespace-normal text-center leading-tight break-words px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${meta.className}`}
                          >
                            {meta.label}
                          </span>
                          {isExpiringSoon && (
                            <span className="inline-flex items-center gap-1 max-w-full whitespace-normal leading-tight px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-[#FFE8CC] text-[#FF9600] border-2 border-[#FF9600] animate-pulse">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#FF9600] shrink-0"></span>
                              <span>
                                Sắp hết hạn{" "}
                                {diffDays <= 0
                                  ? "(Hôm nay)"
                                  : `(${diffDays} ngày)`}
                              </span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Cột 10: Thao tác (Đứng đúng cột Thao tác ngoài cùng bên phải) */}
                      <td className="px-3 py-3 text-center align-middle">
                        <div className={`flex items-center justify-center ${r.status === "PENDING" ? "flex-col gap-2" : "flex-wrap gap-1.5"}`}>
                          {(Boolean(r.contractId) || Boolean(r.storageUnitId) || ["UNIT_ASSIGNED", "TERMINATION_PENDING", "SETTLEMENT_PENDING"].includes(r.status)) && (
                            <button
                              onClick={() =>
                                navigate(`/kho-cua-toi/hop-dong/${r.id}`)
                              }
                              className="duo-btn-blue w-[92px] justify-center px-2 py-1 text-[10px] gap-1 shadow-sm whitespace-normal text-center leading-tight break-words"
                            >
                              <span className="material-symbols-outlined text-[14px]">
                                description
                              </span>
                              XEM HĐ
                            </button>
                          )}
                          {(["PENDING", "DEPOSIT_PAID"].includes(r.status) ||
                            (r.status === "UNIT_ASSIGNED" && r.contractStatus === "PENDING_CHECK_IN")) && (
                            <>
                            {r.status === "PENDING" && (
                              <button
                                onClick={() => handleRetryPayment(r)}
                                disabled={retryingId === r.id}
                                className="duo-btn-green w-[92px] justify-center px-2 py-1 text-[10px] gap-1 shadow-sm whitespace-normal text-center leading-tight break-words disabled:opacity-60"
                              >
                                {retryingId === r.id && (
                                  <span className="material-symbols-outlined text-[14px]">
                                    progress_activity
                                  </span>
                                )}
                                {retryingId === r.id ? "ĐANG TẠO" : "THANH TOÁN"}
                              </button>
                            )}
                            {!(r.unitIssue && issueHandovers[r.id]?.facilityFaultConfirmed) && <button
                              onClick={() => {
                                setSelectedResToCancel(r);
                                setIsCancelModalOpen(true);
                              }}
                              className="duo-btn-red w-[92px] justify-center px-2 py-1 text-[10px] gap-1 shadow-sm whitespace-normal text-center leading-tight break-words"
                            >
                              <span className="material-symbols-outlined text-[14px]">
                                cancel
                              </span>
                              HỦY ĐƠN
                            </button>}
                            {/* Demo: tua 16 phút để thấy hệ thống tự huỷ đơn chưa cọc */}
                            {r.status === "PENDING" && (
                              <SimulationButton
                                label="Quá 15p"
                                description={`Cho đơn ${r.reservationCode} quá 15 phút giữ chỗ mà chưa thanh toán: hệ thống tự huỷ đơn và nhả suất kho.`}
                                onRun={() => simulateExpireHold(r.id)}
                                onDone={() => setReloadKey((k) => k + 1)}
                              />
                            )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!loading && !error && visibleReservations.length > 0 && (
          <PaginationBar
            currentPage={safePage}
            totalItems={visibleReservations.length}
            pageSize={PAGE_SIZE}
            onPageChange={setCurrentPage}
            itemLabel="đơn đặt chỗ"
          />
        )}
      </div>

      <CancelReservationModal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        reservation={selectedResToCancel}
        onSuccess={handleCancelSuccess}
      />

      {unitIssueTarget && (
        <UnitIssueRescheduleModal
          reservation={unitIssueTarget}
          onClose={() => setUnitIssueTarget(null)}
          onDone={(message) => {
            setUnitIssueTarget(null);
            setReloadKey((k) => k + 1);
            alert(message);
          }}
        />
      )}

      <AssetTermsModal
        open={termsOpen}
        onClose={() => setTermsOpen(false)}
      />

      {summaryRes && (
        <ReservationSummaryModal
          reservation={summaryRes}
          onClose={() => setSummaryRes(null)}
          onOpenTerms={() => setTermsOpen(true)}
          onChanged={() => setReloadKey((k) => k + 1)}
        />
      )}
    </div>
  );
}
