import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMyReservations } from '../../services/reservationService';
import { getMyPayments } from '../../services/paymentService';

const quickActions = [
  {
    icon: 'search',
    title: 'Tìm & Đặt Kho',
    description: 'Tìm kiếm và giữ chỗ khoang lưu trữ mới',
    path: '/tim-va-dat-kho',
    btnColor: 'duo-btn-green',
  },
  {
    icon: 'inventory_2',
    title: 'Kho của tôi',
    description: 'Mở khóa điện tử SmartLock và xem camera',
    path: '/kho-cua-toi',
    btnColor: 'duo-btn-blue',
  },
  {
    icon: 'payments',
    title: 'Thanh toán & Hóa đơn',
    description: 'Thanh toán tự động SePay không mất phí',
    path: '/thanh-toan',
    btnColor: 'duo-btn-orange',
  },
  {
    icon: 'contact_support',
    title: 'Hỗ trợ kỹ thuật 24/7',
    description: 'Hotline điều hành viên xử lý trong 5 phút',
    path: '/ho-tro',
    btnColor: 'duo-btn-white',
  },
];

function formatDate(value) {
  if (!value) return '—';
  const parts = String(value).split('T')[0].split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return String(value);
}

// Số ngày từ hôm nay (giờ máy) tới ngày kết thúc "yyyy-MM-dd"; âm = đã quá hạn
function daysUntil(value) {
  const [y, m, d] = String(value).split('T')[0].split('-').map(Number);
  if (!y || !m || !d) return null;
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((new Date(y, m - 1, d) - startOfToday) / 86400000);
}

// Khớp mốc nhắc gia hạn xa nhất của RenewalReminderService (1, 3, 7 ngày)
const EXPIRING_WITHIN_DAYS = 7;

export default function HomePage() {
  const userStr = sessionStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;
  const displayName = user?.fullName || 'Khách hàng';

  const [reservations, setReservations] = useState([]);
  const [payments, setPayments] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      // GET /reservations/my trả thẳng mảng (không bọc trong { data })
      const [resResult, payResult] = await Promise.allSettled([getMyReservations(), getMyPayments()]);
      if (!isMounted) return;
      const list = resResult.status === 'fulfilled' ? resResult.value : null;
      setReservations(Array.isArray(list) ? list : []);
      setPayments(payResult.status === 'fulfilled' ? payResult.value : null);
      setLoading(false);
    }
    loadData();
    return () => { isMounted = false; };
  }, []);

  const activeReservations = useMemo(() => {
    return reservations.filter(r => r.status === 'UNIT_ASSIGNED' || r.status === 'TERMINATION_PENDING');
  }, [reservations]);

  const activeCount = activeReservations.length;

  // Đã cọc nhưng quản lý chưa gán ô → chưa tính là đang thuê, chỉ hiện ghi chú
  const waitingAssignCount = useMemo(
    () => reservations.filter(r => r.status === 'DEPOSIT_PAID').length,
    [reservations],
  );

  // HĐ còn hiệu lực hết hạn trong 7 ngày tới, kể cả HĐ đã quá hạn mà chưa gia hạn / trả kho
  const expiringReservations = useMemo(() => {
    return reservations.filter(r => {
      if (r.status !== 'UNIT_ASSIGNED' || !r.endDate) return false;
      const days = daysUntil(r.endDate);
      return days !== null && days <= EXPIRING_WITHIN_DAYS;
    });
  }, [reservations]);
  const expiringCount = expiringReservations.length;

  // Khoản khách còn phải trả: cọc đơn chưa thanh toán (trả ở Kho của tôi)
  // + nợ phí sự cố / chiếm dụng + phí trễ HĐ quá hạn (trả ở trang Thanh toán)
  const { depositDue, feesDue } = useMemo(() => {
    const deposit = reservations
      .filter(r => r.status === 'PENDING')
      .reduce((sum, r) => sum + (Number(r.depositAmount) || 0), 0);
    const debts = (payments?.debts || []).reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
    const overdueFees = (payments?.overdueContracts || []).reduce(
      (sum, c) => sum + (c.lateFeeWaived ? 0 : Number(c.lateFeeAmount) || 0) + (Number(c.overstayFeeAmount) || 0),
      0,
    );
    return { depositDue: deposit, feesDue: debts + overdueFees };
  }, [reservations, payments]);
  const pendingAmountTotal = depositDue + feesDue;

  const primaryUnit = activeReservations[0] || null;

  // Bấm ô thống kê → nhảy tới đúng trang / đúng bộ lọc
  let activeLink = '/kho-cua-toi';
  if (activeCount > 0) activeLink = '/kho-cua-toi?loc=UNIT_ASSIGNED';
  else if (waitingAssignCount > 0) activeLink = '/kho-cua-toi?loc=DEPOSIT_PAID';

  const expiringLink = expiringCount === 1
    ? `/kho-cua-toi/hop-dong/${expiringReservations[0].id}`
    : '/kho-cua-toi?loc=EXPIRING';

  const paymentLink = feesDue === 0 && depositDue > 0 ? '/kho-cua-toi?loc=PENDING' : '/thanh-toan';

  const dynamicStats = [
    {
      icon: 'inventory_2',
      label: 'Kho đang thuê',
      value: loading ? '—' : String(activeCount),
      unit: 'khoang',
      hint: !loading && waitingAssignCount > 0 ? `+${waitingAssignCount} đơn đã cọc, chờ gán ô` : '',
      to: activeLink,
      color: 'text-[#58CC02]',
      borderColor: 'border-[#58CC02]',
      bgColor: 'bg-[#D7FFB8]',
    },
    {
      icon: 'event_upcoming',
      label: 'HĐ sắp hết hạn',
      value: loading ? '—' : String(expiringCount),
      unit: 'hợp đồng',
      to: expiringLink,
      color: 'text-[#FF9600]',
      borderColor: 'border-[#FF9600]',
      bgColor: 'bg-[#FFE8CC]',
    },
    {
      icon: 'receipt_long',
      label: 'Chờ thanh toán',
      value: loading ? '—' : (pendingAmountTotal > 0 ? `${pendingAmountTotal.toLocaleString('vi-VN')}₫` : '0₫'),
      unit: '',
      to: paymentLink,
      color: 'text-[#FF4B4B]',
      borderColor: 'border-[#FF4B4B]',
      bgColor: 'bg-[#FFDFDF]',
    },
  ];

  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Chào buổi sáng' : currentHour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';

  const today = new Date().toLocaleDateString('vi-VN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const facilitySub = primaryUnit?.facilityName || 'QueenKho SkyCenter Q7';

  return (
    <div className="flex flex-col w-full pb-20 bg-white">
      <div className="max-w-[1040px] w-full mx-auto px-6 pt-8 flex flex-col gap-8">

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b-2 border-[#E5E5E5]">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">👋</span>
              <h1 className="text-3xl font-black text-[#4B4B4B] tracking-tight">
                {greeting}, {displayName}!
              </h1>
            </div>
            <p className="text-xs font-bold text-[#AFAFAF] uppercase tracking-wider">
              {today} • Cơ sở: {facilitySub}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/tim-va-dat-kho"
              className="duo-btn-green px-5 py-3 text-xs tracking-wider flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              <span>THUÊ THÊM KHO</span>
            </Link>
          </div>
        </div>

        <div className="bg-[#DDF4FF] border-2 border-b-4 border-[#84D8FF] rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#1CB0F6] border-b-4 border-[#1899D6] flex items-center justify-center text-white text-2xl shrink-0">
              🔥
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase text-[#1CB0F6] tracking-wider bg-white px-2.5 py-0.5 rounded-full border border-[#84D8FF]">
                  BẢO VỆ 24/7
                </span>
                <span className="text-xs font-black text-[#4B4B4B]">Chuỗi an toàn 100%</span>
              </div>
              <h3 className="text-lg font-black text-[#4B4B4B] mt-1">
                Tất cả đồ đạc của bạn đều được bảo quản ở độ ẩm và nhiệt độ lý tưởng (22°C)!
              </h3>
            </div>
          </div>
          <Link
            to="/kho-cua-toi"
            className="duo-btn-white px-4 py-2.5 text-xs tracking-wider shrink-0"
          >
            KIỂM TRA CẢM BIẾN
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {dynamicStats.map((stat) => (
            <Link
              key={stat.label}
              to={stat.to}
              className="duo-card p-5 flex items-center justify-between hover:border-[#1CB0F6] active:translate-y-[2px] transition-all cursor-pointer"
            >
              <div>
                <span className="text-xs font-black text-[#AFAFAF] uppercase tracking-wider block">
                  {stat.label}
                </span>
                <div className="flex items-baseline gap-1.5 mt-2">
                  <span className="text-3xl font-black text-[#4B4B4B]">
                    {stat.value}
                  </span>
                  {stat.unit && (
                    <span className="text-xs font-black text-[#AFAFAF] uppercase">
                      {stat.unit}
                    </span>
                  )}
                </div>
                {stat.hint && (
                  <span className="text-[11px] font-bold text-[#1CB0F6] mt-1 block">{stat.hint}</span>
                )}
              </div>
              <div className={`w-13 h-13 rounded-2xl ${stat.bgColor} border-2 border-b-4 ${stat.borderColor} flex items-center justify-center shrink-0`}>
                <span className={`material-symbols-outlined text-[26px] ${stat.color}`}>
                  {stat.icon}
                </span>
              </div>
            </Link>
          ))}
        </div>

        {primaryUnit ? (
          <div className="duo-card p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border-2 border-b-4 border-[#E5E5E5]">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 bg-[#D7FFB8] text-[#58A700] border-2 border-[#58CC02] px-3 py-0.5 rounded-full text-xs font-black uppercase">
                <span className="w-2 h-2 rounded-full bg-[#58CC02] animate-pulse"></span>
                Đang hoạt động • Khoang #{primaryUnit.storageUnitId || primaryUnit.reservationCode}
              </div>
              <h3 className="text-xl font-black text-[#4B4B4B]">
                Khoang {primaryUnit.unitTypeName || 'Tiêu chuẩn'}
              </h3>
              <p className="text-xs font-bold text-[#AFAFAF]">
                Cơ sở {primaryUnit.facilityName || 'QueenKho'} • Chu kỳ hợp đồng đến {formatDate(primaryUnit.endDate)}
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0 flex-wrap">
              <Link
                to={primaryUnit.id ? `/kho-cua-toi/hop-dong/${primaryUnit.id}` : '/kho-cua-toi'}
                className="duo-btn-green px-5 py-3 text-xs tracking-wider flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[18px]">key</span>
                <span>MỞ KHÓA ĐIỆN TỬ</span>
              </Link>
              <Link
                to={primaryUnit.id ? `/kho-cua-toi/hop-dong/${primaryUnit.id}` : '/kho-cua-toi'}
                className="duo-btn-white px-5 py-3 text-xs tracking-wider"
              >
                CHI TIẾT HỢP ĐỒNG
              </Link>
            </div>
          </div>
        ) : (
          <div className="duo-card p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border-2 border-b-4 border-[#E5E5E5] bg-[#F7FBF7]">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 bg-[#E8F5E9] text-[#2E7D32] border-2 border-[#81C784] px-3 py-0.5 rounded-full text-xs font-black uppercase">
                <span className="w-2 h-2 rounded-full bg-[#4CAF50]"></span>
                Sẵn sàng phục vụ
              </div>
              <h3 className="text-xl font-black text-[#4B4B4B]">
                Bạn chưa có khoang lưu trữ nào đang hoạt động
              </h3>
              <p className="text-xs font-bold text-[#757575]">
                Khám phá hệ thống khoang thông minh QueenKho với điều hòa 24/7 và khóa điện tử bảo mật cao.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0 flex-wrap">
              <Link
                to="/tim-va-dat-kho"
                className="duo-btn-green px-5 py-3 text-xs tracking-wider flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[18px]">search</span>
                <span>TÌM &amp; ĐẶT KHO NGAY</span>
              </Link>
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-black uppercase tracking-wider text-[#4B4B4B]">
              Dịch vụ & Tiện ích
            </h2>
            <span className="text-xs font-black uppercase text-[#1CB0F6]">Truy cập nhanh</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {quickActions.map((action) => (
              <Link
                key={action.path}
                to={action.path}
                className="duo-card p-5 flex flex-col justify-between hover:border-[#1CB0F6] group transition-all"
              >
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-[#F7F7F7] border-2 border-b-4 border-[#E5E5E5] group-hover:border-[#1CB0F6] group-hover:bg-[#DDF4FF] transition-all flex items-center justify-center mb-4 text-[#4B4B4B] group-hover:text-[#1CB0F6]">
                    <span className="material-symbols-outlined text-[24px]">
                      {action.icon}
                    </span>
                  </div>
                  <h3 className="font-black text-sm text-[#4B4B4B] group-hover:text-[#1CB0F6] transition-colors">
                    {action.title}
                  </h3>
                  <p className="text-xs font-bold text-[#AFAFAF] mt-1 leading-relaxed">
                    {action.description}
                  </p>
                </div>

                <div className="mt-5 pt-3 border-t-2 border-[#E5E5E5] flex items-center justify-between text-xs font-black uppercase text-[#1CB0F6]">
                  <span>Vào trang</span>
                  <span className="material-symbols-outlined text-[16px] group-hover:translate-x-1 transition-transform">
                    arrow_forward
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
