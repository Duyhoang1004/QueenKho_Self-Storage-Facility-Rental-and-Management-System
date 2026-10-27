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

export default function HomePage() {
  const userStr = sessionStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;
  const displayName = user?.fullName || 'Khách hàng';

  const [reservations, setReservations] = useState([]);
  const [debtsTotal, setDebtsTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const res = await getMyReservations();
        if (isMounted) {
          setReservations(Array.isArray(res?.data) ? res.data : []);
        }
      } catch {
        if (isMounted) setReservations([]);
      }

      try {
        const paymentRes = await getMyPayments();
        if (isMounted) {
          let total = 0;
          if (Array.isArray(paymentRes?.debts)) {
            total = paymentRes.debts.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
          } else if (paymentRes?.summary?.totalUnpaid) {
            total = Number(paymentRes.summary.totalUnpaid) || 0;
          }
          setDebtsTotal(total);
        }
      } catch {
        if (isMounted) setDebtsTotal(0);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadData();
    return () => { isMounted = false; };
  }, []);

  const activeReservations = useMemo(() => {
    return reservations.filter(r => r.status === 'UNIT_ASSIGNED' || r.status === 'TERMINATION_PENDING');
  }, [reservations]);

  const activeCount = activeReservations.length;

  const expiringCount = useMemo(() => {
    const now = new Date();
    const next7Days = new Date();
    next7Days.setDate(now.getDate() + 7);
    return activeReservations.filter(r => {
      if (!r.endDate) return false;
      const end = new Date(r.endDate);
      return end >= now && end <= next7Days;
    }).length;
  }, [activeReservations]);

  const pendingAmountTotal = useMemo(() => {
    const pendingReservations = reservations.filter(r => r.status === 'PENDING');
    const resPending = pendingReservations.reduce((sum, r) => sum + (Number(r.depositAmount || r.totalAmount) || 0), 0);
    return debtsTotal > 0 ? debtsTotal : resPending;
  }, [reservations, debtsTotal]);

  const primaryUnit = activeReservations[0] || null;

  const dynamicStats = [
    {
      icon: 'inventory_2',
      label: 'Kho đang thuê',
      value: loading ? '—' : String(activeCount),
      unit: 'khoang',
      color: 'text-[#58CC02]',
      borderColor: 'border-[#58CC02]',
      bgColor: 'bg-[#D7FFB8]',
    },
    {
      icon: 'event_upcoming',
      label: 'HĐ sắp hết hạn',
      value: loading ? '—' : String(expiringCount),
      unit: 'hợp đồng',
      color: 'text-[#FF9600]',
      borderColor: 'border-[#FF9600]',
      bgColor: 'bg-[#FFE8CC]',
    },
    {
      icon: 'receipt_long',
      label: 'Chờ thanh toán',
      value: loading ? '—' : (pendingAmountTotal > 0 ? `${pendingAmountTotal.toLocaleString('vi-VN')}₫` : '0₫'),
      unit: '',
      color: 'text-[#FF4B4B]',
      borderColor: 'border-[#FF4B4B]',
      bgColor: 'bg-[#FFDFDF]',
    },
  ];

  const currentHour = new Date().getHours();
  let greeting = 'Xin chào';
  if (currentHour < 12) greeting = 'Chào buổi sáng';
  else if (currentHour < 18) greeting = 'Chào buổi chiều';
  else greeting = 'Chào buổi tối';

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
            <div
              key={stat.label}
              className="duo-card p-5 flex items-center justify-between hover:border-[#1CB0F6] transition-all"
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
              </div>
              <div className={`w-13 h-13 rounded-2xl ${stat.bgColor} border-2 border-b-4 ${stat.borderColor} flex items-center justify-center shrink-0`}>
                <span className={`material-symbols-outlined text-[26px] ${stat.color}`}>
                  {stat.icon}
                </span>
              </div>
            </div>
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
