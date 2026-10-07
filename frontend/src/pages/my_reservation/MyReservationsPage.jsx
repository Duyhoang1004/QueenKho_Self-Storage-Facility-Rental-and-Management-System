import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getMyReservations } from "../../services/reservationService";
import CancelReservationModal from "../../components/CancelReservationModal";

const STATUS_META = {
  PENDING: { label: "Chờ thanh toán cọc", className: "bg-[#FFE8CC] text-[#E58800] border-2 border-[#FF9600]" },
  DEPOSIT_PAID: { label: "Đã cọc - chờ gán ô", className: "bg-[#DDF4FF] text-[#1CB0F6] border-2 border-[#84D8FF]" },
  UNIT_ASSIGNED: { label: "Đã gán ô kho", className: "bg-[#D7FFB8] text-[#58A700] border-2 border-[#58CC02]" },
  TERMINATION_PENDING: { label: "Chờ trả kho", className: "bg-[#FFE8CC] text-[#E58800] border-2 border-[#FF9600]" },
  CANCELLED: { label: "Đã hủy", className: "bg-[#FFDFDF] text-[#FF4B4B] border-2 border-[#FF4B4B]" },
  REFUND_PENDING: { label: "Hủy - Chờ hoàn tiền", className: "bg-[#FFE8CC] text-[#E58800] border-2 border-[#FF9600]" },
  EXPIRED: { label: "Hết hạn", className: "bg-[#F7F7F7] text-[#777777] border-2 border-[#E5E5E5]" },
  COMPLETED: { label: "Hoàn tất", className: "bg-[#D7FFB8] text-[#58A700] border-2 border-[#58CC02]" },
};

const FILTERS = [
  { key: "ALL", label: "Tất cả", statuses: null },
  { key: "PENDING", label: "Chờ thanh toán", statuses: ["PENDING"] },
  { key: "DEPOSIT_PAID", label: "Đã đặt cọc", statuses: ["DEPOSIT_PAID"] },
  { key: "UNIT_ASSIGNED", label: "Đã gán ô", statuses: ["UNIT_ASSIGNED", "TERMINATION_PENDING"] },
  { key: "CLOSED", label: "Đã đóng", statuses: ["CANCELLED", "REFUND_PENDING", "EXPIRED", "COMPLETED"] },
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
  const dateStr = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
  const timeStr = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  return { date: dateStr, time: timeStr };
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
  const [error, setError] = useState(userId ? "" : "Bạn cần đăng nhập để xem đơn đặt chỗ.");
  const [filter, setFilter] = useState("ALL");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    getMyReservations(userId)
      .then((data) => {
        if (cancelled) return;
        setReservations(data);
        setError("");
      })
      .catch(() => {
        if (!cancelled) setError("Không tải được danh sách đơn đặt chỗ. Vui lòng thử lại.");
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

  const countBy = (statuses) => reservations.filter((r) => statuses.includes(r.status)).length;

  const stats = [
    {
      icon: "receipt_long",
      label: "Tổng đơn đặt chỗ",
      value: reservations.length,
      iconColor: "text-[#58A700]",
      iconBg: "bg-[#D7FFB8]",
      cardBorder: "hover:border-[#58CC02]"
    },
    {
      icon: "hourglass_top",
      label: "Chờ thanh toán cọc",
      value: countBy(["PENDING"]),
      iconColor: "text-[#E58800]",
      iconBg: "bg-[#FFE8CC]",
      cardBorder: "hover:border-[#FF9600]"
    },
    {
      icon: "payments",
      label: "Đã cọc, chờ gán ô",
      value: countBy(["DEPOSIT_PAID"]),
      iconColor: "text-[#1CB0F6]",
      iconBg: "bg-[#DDF4FF]",
      cardBorder: "hover:border-[#1CB0F6]"
    },
    {
      icon: "inventory_2",
      label: "Đã gán ô kho",
      value: countBy(["UNIT_ASSIGNED", "TERMINATION_PENDING"]),
      iconColor: "text-[#58A700]",
      iconBg: "bg-[#D7FFB8]",
      cardBorder: "hover:border-[#58CC02]"
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

  return (
    <div className="max-w-[1240px] w-full mx-auto px-6 py-6 flex flex-col gap-6 select-none">
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
          <h1 className="text-2xl sm:text-3xl font-black text-[#4B4B4B] tracking-tight">Đơn đặt chỗ của tôi</h1>
          <p className="text-[13px] font-bold text-[#AFAFAF]">
            Theo dõi trạng thái các đơn đặt chỗ, từ lúc đặt cọc đến khi được gán ô kho.
          </p>
        </div>
        <Link
          to="/tim-va-dat-kho"
          className="duo-btn-green px-5 py-3 text-xs tracking-wider flex items-center gap-1.5 self-start sm:self-auto shadow-sm shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">add_circle</span>
          <span>ĐẶT KHO MỚI</span>
        </Link>
      </div>

      {/* Thẻ thống kê */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className={`duo-card p-4 flex flex-col gap-3 transition-all ${stat.cardBorder}`}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#AFAFAF]">{stat.label}</span>
              <div className={`w-9 h-9 rounded-xl ${stat.iconBg} ${stat.iconColor} flex items-center justify-center border-2 border-b-4 border-black/5`}>
                <span className="material-symbols-outlined text-[18px]">{stat.icon}</span>
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
        {/* Bộ lọc trạng thái */}
        <div className="px-4 py-3 bg-[#FAFAFA] border-b-2 border-[#E5E5E5] flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
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

        {loading && <p className="px-6 py-8 text-sm font-bold text-[#AFAFAF]">Đang tải danh sách...</p>}

        {!loading && error && (
          <div className="px-6 py-8 flex flex-col items-start gap-3">
            <p className="text-[#FF4B4B] font-bold text-sm">{error}</p>
            <button onClick={retry} className="duo-btn-blue px-4 py-2 text-xs">Thử lại</button>
          </div>
        )}

        {!loading && !error && reservations.length === 0 && (
          <div className="px-6 py-12 flex flex-col items-center gap-4 text-center bg-white">
            <div className="w-16 h-16 rounded-full bg-[#F7F7F7] flex items-center justify-center border-2 border-[#E5E5E5]">
              <span className="material-symbols-outlined text-[32px] text-[#AFAFAF]">inventory_2</span>
            </div>
            <p className="text-sm font-bold text-[#777777]">Bạn chưa có đơn đặt chỗ nào.</p>
            <Link to="/tim-va-dat-kho" className="duo-btn-green px-5 py-3 text-xs mt-1">Tìm & đặt kho ngay</Link>
          </div>
        )}

        {!loading && !error && reservations.length > 0 && visibleReservations.length === 0 && (
          <p className="px-6 py-8 text-sm font-bold text-[#AFAFAF] bg-white">Không có đơn nào ở trạng thái này.</p>
        )}

        {!loading && !error && visibleReservations.length > 0 && (
          <div className="overflow-x-auto bg-white custom-scrollbar pb-2">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead className="bg-[#FAFAFA] text-[#AFAFAF] text-[10px] font-black uppercase tracking-widest border-b-2 border-[#E5E5E5]">
                <tr>
                  <th className="px-3 py-3 whitespace-nowrap">Mã đơn</th>
                  <th className="px-3 py-3 whitespace-nowrap">Cơ sở</th>
                  <th className="px-3 py-3 whitespace-nowrap">Loại kho</th>
                  <th className="px-3 py-3 whitespace-nowrap">Ô kho</th>
                  <th className="px-3 py-3 whitespace-nowrap">Bắt đầu</th>
                  <th className="px-3 py-3 whitespace-nowrap text-center">T/gian</th>
                  <th className="px-3 py-3 whitespace-nowrap">Tiền cọc</th>
                  <th className="px-3 py-3 whitespace-nowrap">Ngày đặt</th>
                  <th className="px-3 py-3 whitespace-nowrap">Trạng thái</th>
                  <th className="px-3 py-3 whitespace-nowrap text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="text-[13px] font-bold text-[#4B4B4B]">
                {visibleReservations.map((r, index) => {
                  const meta = STATUS_META[r.status] || { label: r.status, className: "bg-[#F7F7F7] text-[#777777] border-2 border-[#E5E5E5]" };
                  const diffDays = getDaysUntilExpiry(r);
                  const isExpiringSoon = diffDays !== null && diffDays <= 3;
                  const isLast = index === visibleReservations.length - 1;
                  const dt = formatDateTimeSplit(r.createdAt);

                  return (
                    <tr key={r.id} className={`transition-colors hover:bg-[#F7F7F7] ${!isLast ? 'border-b-2 border-[#F0F0F0]' : ''} ${isExpiringSoon ? 'bg-[#FFFBEB] hover:bg-[#FFF3C7]' : ''}`}>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="font-mono font-black text-[#1CB0F6] bg-[#DDF4FF] px-1.5 py-0.5 rounded border border-[#84D8FF]">{r.reservationCode}</span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap font-extrabold text-[#4B4B4B]">
                        {r.facilityName.replace('QueenKho ', '')}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-[#777777]">{r.unitTypeName}</td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {r.storageUnitId ? (
                          <span className="font-mono font-black text-[#4B4B4B]">{r.storageUnitId}</span>
                        ) : (
                          <span className="text-[#AFAFAF] italic">Chưa gán</span>
                        )}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap font-bold text-[#4B4B4B]">{formatDate(r.startDate)}</td>
                      <td className="px-3 py-3 whitespace-nowrap text-center font-extrabold">{r.durationMonths}T</td>
                      <td className="px-3 py-3 whitespace-nowrap font-black text-[#58CC02]">{formatVND(r.depositAmount)}</td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="flex flex-col leading-tight">
                          <span className="text-[11px] font-bold text-[#777777]">{dt.time}</span>
                          <span className="text-[11px] font-bold text-[#AFAFAF]">{dt.date}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="flex flex-col items-start gap-1">
                          <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${meta.className}`}>
                            {meta.label}
                          </span>
                          {isExpiringSoon && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest bg-[#FFE8CC] text-[#FF9600] border-2 border-[#FF9600] animate-pulse">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#FF9600]"></span>
                              Sắp hết hạn {diffDays <= 0 ? '(Hôm nay)' : `(${diffDays} ngày)`}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-2">
                            {["UNIT_ASSIGNED", "TERMINATION_PENDING"].includes(r.status) && (
                              <button
                                onClick={() => navigate(`/kho-cua-toi/hop-dong/${r.id}`)}
                                className="duo-btn-blue px-2.5 py-1 text-[10px] gap-1 shadow-sm"
                              >
                                <span className="material-symbols-outlined text-[14px]">description</span>
                                XEM HĐ
                              </button>
                            )}
                            {["PENDING", "DEPOSIT_PAID"].includes(r.status) && (
                              <button
                                onClick={() => {
                                  setSelectedResToCancel(r);
                                  setIsCancelModalOpen(true);
                                }}
                                className="duo-btn-red px-2.5 py-1 text-[10px] gap-1 shadow-sm"
                              >
                                <span className="material-symbols-outlined text-[14px]">cancel</span>
                                HỦY ĐƠN
                              </button>
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
      </div>

      <CancelReservationModal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        reservation={selectedResToCancel}
        onSuccess={handleCancelSuccess}
      />
    </div>
  );
}
