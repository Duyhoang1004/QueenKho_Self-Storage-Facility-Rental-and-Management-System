import { Link } from 'react-router-dom';

const stats = [
  {
    icon: 'inventory_2',
    label: 'Kho đang thuê',
    value: '2',
    unit: 'khoang',
    color: 'text-[#58CC02]',
    borderColor: 'border-[#58CC02]',
    bgColor: 'bg-[#D7FFB8]',
  },
  {
    icon: 'event_upcoming',
    label: 'HĐ sắp hết hạn',
    value: '1',
    unit: 'hợp đồng',
    color: 'text-[#FF9600]',
    borderColor: 'border-[#FF9600]',
    bgColor: 'bg-[#FFE8CC]',
  },
  {
    icon: 'receipt_long',
    label: 'Chờ thanh toán',
    value: '850.000₫',
    unit: '',
    color: 'text-[#FF4B4B]',
    borderColor: 'border-[#FF4B4B]',
    bgColor: 'bg-[#FFDFDF]',
  },
];

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

export default function HomePage() {
  const userStr = sessionStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;
  const displayName = user?.fullName || 'Khách hàng';

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

  return (
    <div className="flex flex-col w-full pb-20 bg-white select-none">
      <div className="max-w-[1040px] w-full mx-auto px-6 pt-8 flex flex-col gap-8">

        {/* 1. DUOLINGO GREETING & STREAK BANNER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b-2 border-[#E5E5E5]">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">👋</span>
              <h1 className="text-3xl font-black text-[#4B4B4B] tracking-tight">
                {greeting}, {displayName}!
              </h1>
            </div>
            <p className="text-xs font-bold text-[#AFAFAF] uppercase tracking-wider">
              {today} • Cơ sở chính: QueenKho SkyCenter Q7
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

        {/* 2. DUOLINGO DAILY MOTIVATION CARD (Streak Gamified Banner) */}
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

        {/* 3. DUOLINGO 2.5D STATS CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {stats.map((stat) => (
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

        {/* 4. ACTIVE STORAGE UNIT CHUNKY CARD */}
        <div className="duo-card p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border-2 border-b-4 border-[#E5E5E5]">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 bg-[#D7FFB8] text-[#58A700] border-2 border-[#58CC02] px-3 py-0.5 rounded-full text-xs font-black uppercase">
              <span className="w-2 h-2 rounded-full bg-[#58CC02] animate-pulse"></span>
              Đang hoạt động • Khoang #KHO-042
            </div>
            <h3 className="text-xl font-black text-[#4B4B4B]">
              Khoang Standard Medium (5m² - 14m³)
            </h3>
            <p className="text-xs font-bold text-[#AFAFAF]">
              Cơ sở QueenKho SkyCenter Q7 • Nhiệt độ 22°C • Chu kỳ hợp đồng đến 25/10/2026
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <Link
              to="/kho-cua-toi"
              className="duo-btn-green px-5 py-3 text-xs tracking-wider flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[18px]">key</span>
              <span>MỞ KHÓA ĐIỆN TỬ</span>
            </Link>
            <Link
              to="/kho-cua-toi"
              className="duo-btn-white px-5 py-3 text-xs tracking-wider"
            >
              CHI TIẾT HỢP ĐỒNG
            </Link>
          </div>
        </div>

        {/* 5. QUICK ACTIONS GRID */}
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