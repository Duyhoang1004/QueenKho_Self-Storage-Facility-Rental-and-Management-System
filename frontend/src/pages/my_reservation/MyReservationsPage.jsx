import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getMyReservations } from "../../services/reservationService";
import api from "../../services/api";
import CancelReservationModal from "../../components/CancelReservationModal";
import AssetTermsModal from "../../components/AssetTermsModal";
import { createVnpayPayment } from "../../services/vnpayService";
import SimulationButton from "../../components/SimulationButton";
import { simulateExpireHold } from "../../services/simulationService";
import PaginationBar, { ListBoxHeader } from "../../components/PaginationBar";

const PAGE_SIZE = 5;

const STATUS_META = {
  PENDING: {
    label: "Chờ thanh toán",
    className: "bg-[#FFE8CC] text-[#E58800] border-2 border-[#FF9600]",
  },
  DEPOSIT_PAID: {
    label: "Đã cọc - chờ gán ô",
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
    statuses: ["UNIT_ASSIGNED", "TERMINATION_PENDING"],
  },
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

function readUserId() {
  const user = JSON.parse(sessionStorage.getItem("user") || "{}");
  return user.userId ?? null;
}

export default function MyReservationsPage() {
  const [selectedResToCancel, setSelectedResToCancel] = useState(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const userId = readUserId();
  const navigate = useNavigate();

  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(Boolean(userId));
  const [error, setError] = useState(
    userId ? "" : "Bạn cần đăng nhập để xem đơn đặt chỗ.",
  );
  const [filter, setFilter] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [retryingId, setRetryingId] = useState(null);
  const [termsOpen, setTermsOpen] = useState(false);

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
    ])
      .then(([resData, contractsData]) => {
        if (cancelled) return;

        // Tạo map hợp đồng theo mã đơn
        const contractsByResCode = {};
        (contractsData || []).forEach((c) => {
          if (c.reservationCode) {
            contractsByResCode[c.reservationCode] = c;
          }
        });

        // Gộp ngày kết thúc thực tế của HĐ và đồng bộ trạng thái vào từng đơn đặt chỗ
        const merged = (resData || []).map((r) => {
          const c = contractsByResCode[r.reservationCode];
          if (c) {
            return {
              ...r,
              status:
                c.status === "TERMINATION_PENDING"
                  ? "TERMINATION_PENDING"
                  : r.status,
              endDate: c.endDate,
              contractId: c.contractId,
              contractCode: c.contractCode,
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
      value: countBy(["UNIT_ASSIGNED", "TERMINATION_PENDING"]),
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
  }, [reservations, filter]);

  const totalPages = Math.max(1, Math.ceil(visibleReservations.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedReservations = visibleReservations.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

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

        {!loading && !error && visibleReservations.length > 0 && (
          <div className="max-w-full overflow-x-auto bg-white custom-scrollbar pb-2">
            <table className="w-full min-w-[1180px] table-fixed text-left border-collapse">
              <colgroup>
                <col className="w-[100px]" />
                <col className="w-[165px]" />
                <col className="w-[135px]" />
                <col className="w-[135px]" />
                <col className="w-[90px]" />
                <col className="w-[58px]" />
                <col className="w-[150px]" />
                <col className="w-[78px]" />
                <col className="w-[155px]" />
                <col className="w-[114px]" />
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
                  const meta = STATUS_META[r.status] || {
                    label: r.status,
                    className:
                      "bg-[#F7F7F7] text-[#777777] border-2 border-[#E5E5E5]",
                  };
                  const diffDays = getDaysUntilExpiry(r);
                  const isExpiringSoon = diffDays !== null && diffDays <= 3;
                  const isLast = index === paginatedReservations.length - 1;
                  const dt = formatDateTimeSplit(r.createdAt);

                  // 1. Số tháng thực tế (đồng bộ theo hợp đồng nếu đã gia hạn)
                  const actualMonths = getActualMonths(r);
                  const isRenewed =
                    r.endDate && actualMonths > Number(r.durationMonths || 0);

                  // 2. Tính tiền: Tiền cọc = 1 tháng, Tiền thuê = cọc * số tháng thực tế
                  const deposit = Number(r.depositAmount || 0);
                  const rentTotal = deposit * actualMonths;
                  const totalPaid = deposit + rentTotal;

                  return (
                    <tr
                      key={r.id}
                      className={`transition-colors hover:bg-[#F7F7F7] ${!isLast ? "border-b-2 border-[#F0F0F0]" : ""} ${isExpiringSoon ? "bg-[#FFFBEB] hover:bg-[#FFF3C7]" : ""}`}
                    >
                      {/* Cột 1: Mã đơn */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="font-mono font-black text-[#1CB0F6] bg-[#DDF4FF] px-1.5 py-0.5 rounded border border-[#84D8FF]">
                          {r.reservationCode}
                        </span>
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

                      {/* Cột 9: Trạng thái (Đứng đúng cột Trạng thái) */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="flex flex-col items-start gap-1">
                          <span
                            className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${meta.className}`}
                          >
                            {meta.label}
                          </span>
                          {isExpiringSoon && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest bg-[#FFE8CC] text-[#FF9600] border-2 border-[#FF9600] animate-pulse">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#FF9600]"></span>
                              Sắp hết hạn{" "}
                              {diffDays <= 0
                                ? "(Hôm nay)"
                                : `(${diffDays} ngày)`}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Cột 10: Thao tác (Đứng đúng cột Thao tác ngoài cùng bên phải) */}
                      <td className="px-3 py-3 text-center align-middle">
                        <div className={`flex items-center justify-center whitespace-nowrap ${r.status === "PENDING" ? "flex-col gap-2" : "gap-1.5"}`}>
                          {(Boolean(r.contractId) || Boolean(r.storageUnitId) || ["UNIT_ASSIGNED", "TERMINATION_PENDING"].includes(r.status)) && (
                            <button
                              onClick={() =>
                                navigate(`/kho-cua-toi/hop-dong/${r.id}`)
                              }
                              className="duo-btn-blue w-[92px] justify-center px-2 py-1 text-[10px] gap-1 shadow-sm whitespace-nowrap"
                            >
                              <span className="material-symbols-outlined text-[14px]">
                                description
                              </span>
                              XEM HĐ
                            </button>
                          )}
                          {["PENDING", "DEPOSIT_PAID"].includes(r.status) && (
                            <>
                            {r.status === "PENDING" && (
                              <button
                                onClick={() => handleRetryPayment(r)}
                                disabled={retryingId === r.id}
                                className="duo-btn-green w-[92px] justify-center px-2 py-1 text-[10px] gap-1 shadow-sm whitespace-nowrap disabled:opacity-60"
                              >
                                {retryingId === r.id && (
                                  <span className="material-symbols-outlined text-[14px]">
                                    progress_activity
                                  </span>
                                )}
                                {retryingId === r.id ? "ĐANG TẠO" : "THANH TOÁN"}
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setSelectedResToCancel(r);
                                setIsCancelModalOpen(true);
                              }}
                              className="duo-btn-red w-[92px] justify-center px-2 py-1 text-[10px] gap-1 shadow-sm whitespace-nowrap"
                            >
                              <span className="material-symbols-outlined text-[14px]">
                                cancel
                              </span>
                              HỦY ĐƠN
                            </button>
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

      <AssetTermsModal
        open={termsOpen}
        onClose={() => setTermsOpen(false)}
      />
    </div>
  );
}
