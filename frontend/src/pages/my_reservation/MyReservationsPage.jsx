import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getMyReservations } from "../../services/reservationService";
import CancelReservationModal from "../../components/CancelReservationModal";

const STATUS_META = {
  PENDING: {
    label: "Chờ thanh toán cọc",
    className: "bg-yellow-100 text-yellow-800",
  },
  DEPOSIT_PAID: {
    label: "Đã đặt cọc - chờ gán ô",
    className: "bg-blue-100 text-blue-800",
  },
  UNIT_ASSIGNED: {
    label: "Đã gán ô kho",
    className: "bg-green-100 text-green-800",
  },
  CANCELLED: { label: "Đã hủy", className: "bg-red-100 text-red-800" },
  EXPIRED: { label: "Hết hạn giữ chỗ", className: "bg-gray-100 text-gray-600" },
  COMPLETED: {
    label: "Hoàn tất",
    className: "bg-emerald-100 text-emerald-800",
  },
};

const FILTERS = [
  { key: "ALL", label: "Tất cả", statuses: null },
  { key: "PENDING", label: "Chờ thanh toán", statuses: ["PENDING"] },
  { key: "DEPOSIT_PAID", label: "Đã đặt cọc", statuses: ["DEPOSIT_PAID"] },
  { key: "UNIT_ASSIGNED", label: "Đã gán ô", statuses: ["UNIT_ASSIGNED"] },
  {
    key: "CLOSED",
    label: "Đã đóng",
    statuses: ["CANCELLED", "EXPIRED", "COMPLETED"],
  },
];

const cardStyle = {
  backgroundColor: "rgb(255, 255, 255)",
  border: "1px solid rgb(203, 213, 225)",
  boxShadow:
    "rgba(0, 0, 0, 0.1) 0px 4px 6px -1px, rgba(0, 0, 0, 0.1) 0px 2px 4px -2px",
};

function formatVND(amount) {
  if (amount === null || amount === undefined) return "—";
  return Number(amount).toLocaleString("vi-VN") + "₫";
}

// startDate từ API có dạng yyyy-MM-dd -> hiển thị dd/MM/yyyy (không qua Date để tránh lệch múi giờ)
function formatDate(value) {
  if (!value) return "—";
  const [y, m, d] = String(value).split("-");
  return `${d}/${m}/${y}`;
}

function formatDateTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("vi-VN");
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

  const countBy = (statuses) =>
    reservations.filter((r) => statuses.includes(r.status)).length;

  const stats = [
    {
      icon: "receipt_long",
      label: "Tổng đơn đặt chỗ",
      value: reservations.length,
      color: "text-primary",
      bgColor: "bg-primary-fixed",
    },
    {
      icon: "hourglass_top",
      label: "Chờ thanh toán cọc",
      value: countBy(["PENDING"]),
      color: "text-[#D97706]",
      bgColor: "bg-[#FFFBEB]",
    },
    {
      icon: "payments",
      label: "Đã đặt cọc, chờ gán ô",
      value: countBy(["DEPOSIT_PAID"]),
      color: "text-secondary",
      bgColor: "bg-secondary-fixed",
    },
    {
      icon: "inventory_2",
      label: "Đã gán ô kho",
      value: countBy(["UNIT_ASSIGNED"]),
      color: "text-[#10B981]",
      bgColor: "bg-[#ECFDF5]",
    },
  ];

  const visibleReservations = useMemo(() => {
    const active = FILTERS.find((f) => f.key === filter);
    if (!active || !active.statuses) return reservations;
    return reservations.filter((r) => active.statuses.includes(r.status));
  }, [reservations, filter]);

  return (
    <div className="max-w-[1180px] w-full mx-auto px-margin py-space-lg flex flex-col gap-space-lg">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 font-code-sm text-code-sm text-outline">
        <Link to="/" className="hover:text-on-surface">
          Trang chủ
        </Link>
        <span>/</span>
        <span className="text-on-surface font-semibold">
          Đơn đặt chỗ của tôi
        </span>
      </div>

      {/* Tiêu đề + nút đặt kho */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-space-sm">
        <div className="flex flex-col gap-1">
          <h1 className="font-headline-md text-headline-md text-on-surface tracking-tight">
            Đơn đặt chỗ của tôi
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Theo dõi trạng thái các đơn đặt chỗ, từ lúc đặt cọc đến khi được gán
            ô kho.
          </p>
        </div>
        <Link
          to="/tim-va-dat-kho"
          className="px-4 py-2 bg-secondary text-on-secondary rounded font-title-md text-title-md hover:opacity-90 transition-opacity self-start sm:self-auto"
        >
          Đặt kho mới
        </Link>
      </div>

      {/* Thẻ thống kê */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-surface-container-lowest rounded-lg p-5 flex items-center gap-4 shadow-sm"
            style={cardStyle}
          >
            <div
              className={`w-12 h-12 rounded-lg ${stat.bgColor} flex items-center justify-center`}
            >
              <span
                className={`material-symbols-outlined text-[24px] ${stat.color}`}
              >
                {stat.icon}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="font-label-sm text-label-sm text-outline uppercase font-semibold tracking-wider">
                {stat.label}
              </span>
              <span
                className={`font-headline-sm text-headline-sm ${stat.color} font-bold mt-0.5`}
              >
                {loading ? "—" : stat.value}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Bảng danh sách */}
      <div
        className="bg-surface-container-lowest rounded-lg overflow-hidden"
        style={cardStyle}
      >
        {/* Bộ lọc trạng thái */}
        <div className="px-space-md py-space-sm border-b border-outline-variant/40 flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-label-sm font-label-sm transition-colors ${
                filter === f.key
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container text-on-surface-variant hover:text-on-surface"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading && (
          <p className="px-space-md py-space-lg text-on-surface-variant">
            Đang tải danh sách...
          </p>
        )}

        {!loading && error && (
          <div className="px-space-md py-space-lg flex flex-col items-start gap-3">
            <p className="text-error">{error}</p>
            <button
              type="button"
              onClick={retry}
              className="px-4 py-2 bg-primary text-on-primary rounded font-label-lg text-label-lg hover:opacity-90"
            >
              Thử lại
            </button>
          </div>
        )}

        {!loading && !error && reservations.length === 0 && (
          <div className="px-space-md py-space-2xl flex flex-col items-center gap-3 text-center">
            <span className="material-symbols-outlined text-[40px] text-outline">
              inventory_2
            </span>
            <p className="text-on-surface-variant">
              Bạn chưa có đơn đặt chỗ nào.
            </p>
            <Link
              to="/tim-va-dat-kho"
              className="px-4 py-2 bg-secondary text-on-secondary rounded font-title-md text-title-md hover:opacity-90"
            >
              Tìm & đặt kho ngay
            </Link>
          </div>
        )}

        {!loading &&
          !error &&
          reservations.length > 0 &&
          visibleReservations.length === 0 && (
            <p className="px-space-md py-space-lg text-on-surface-variant">
              Không có đơn nào ở trạng thái này.
            </p>
          )}

        {!loading && !error && visibleReservations.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[#F4F6F8] text-on-surface-variant text-label-sm font-label-sm uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Mã đơn</th>
                  <th className="px-4 py-3">Cơ sở</th>
                  <th className="px-4 py-3">Loại kho</th>
                  <th className="px-4 py-3">Ô kho</th>
                  <th className="px-4 py-3">Ngày bắt đầu</th>
                  <th className="px-4 py-3">Số tháng</th>
                  <th className="px-4 py-3">Tiền cọc</th>
                  <th className="px-4 py-3">Ngày đặt</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3 text-left font-semibold text-on-surface-variant">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody className="text-body-sm font-body-sm text-on-surface">
                {visibleReservations.map((r) => {
                  const meta = STATUS_META[r.status] || {
                    label: r.status,
                    className: "bg-gray-100 text-gray-600",
                  };
                  return (
                    <tr
                      key={r.id}
                      className="border-t border-outline-variant/40 hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-4 py-3 font-code-md text-code-md font-semibold text-secondary">
                        {r.reservationCode}
                      </td>
                      <td className="px-4 py-3">{r.facilityName}</td>
                      <td className="px-4 py-3">{r.unitTypeName}</td>
                      <td className="px-4 py-3">
                        {r.storageUnitId ?? (
                          <span className="text-outline">Chưa gán</span>
                        )}
                      </td>
                      <td className="px-4 py-3">{formatDate(r.startDate)}</td>
                      <td className="px-4 py-3">{r.durationMonths}</td>
                      <td className="px-4 py-3">
                        {formatVND(r.depositAmount)}
                      </td>
                      <td className="px-4 py-3 text-on-surface-variant">
                        {formatDateTime(r.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${meta.className}`}
                        >
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        {r.status === "UNIT_ASSIGNED" && (
                          <button
                            onClick={() =>
                              navigate(`/kho-cua-toi/hop-dong/${r.id}`)
                            }
                            className="flex items-center gap-1 text-secondary text-label-sm font-label-sm hover:underline cursor-pointer whitespace-nowrap"
                          >
                            <span className="material-symbols-outlined text-[16px]">
                              description
                            </span>
                            Xem HĐ
                          </button>
                        )}
                        {["PENDING", "DEPOSIT_PAID"].includes(r.status) && (
                          <button
                            onClick={() => {
                              setSelectedResToCancel(r);
                              setIsCancelModalOpen(true);
                            }}
                            className="text-[#B91C1C] hover:text-red-800 font-medium text-body-sm flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-[16px]">
                              cancel
                            </span>
                            Hủy đơn
                          </button>
                        )}
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
