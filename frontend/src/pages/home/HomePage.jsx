import { Link } from 'react-router-dom';

// Mock data - sẽ thay bằng API thật sau
const stats = [
  {
    icon: 'inventory_2',
    label: 'Kho đang thuê',
    value: '2',
    unit: 'khoang',
    color: 'text-primary',
    bgColor: 'bg-primary-fixed',
  },
  {
    icon: 'event_upcoming',
    label: 'HĐ sắp hết hạn',
    value: '1',
    unit: 'hợp đồng',
    color: 'text-[#D97706]',
    bgColor: 'bg-[#FFFBEB]',
  },
  {
    icon: 'receipt_long',
    label: 'Chờ thanh toán',
    value: '850.000₫',
    unit: '',
    color: 'text-error',
    bgColor: 'bg-error-container',
  },
];

const quickActions = [
  {
    icon: 'search',
    title: 'Tìm & Đặt Kho',
    description: 'Tìm kiếm và thuê khoang lưu trữ phù hợp',
    path: '/tim-va-dat-kho',
    color: 'text-secondary',
    bgColor: 'bg-secondary-fixed',
  },
  {
    icon: 'inventory_2',
    title: 'Kho của tôi',
    description: 'Quản lý các khoang kho đang thuê',
    path: '/kho-cua-toi',
    color: 'text-primary',
    bgColor: 'bg-primary-fixed',
  },
  {
    icon: 'payments',
    title: 'Thanh toán',
    description: 'Xem và thanh toán hóa đơn hàng tháng',
    path: '/thanh-toan',
    color: 'text-[#10B981]',
    bgColor: 'bg-[#ECFDF5]',
  },
  {
    icon: 'contact_support',
    title: 'Hỗ trợ',
    description: 'Liên hệ tư vấn và hỗ trợ kỹ thuật',
    path: '/ho-tro',
    color: 'text-[#8B5CF6]',
    bgColor: 'bg-[#F5F3FF]',
  },
];

export default function HomePage() {
  // Đọc thông tin user từ localStorage
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;
  const displayName = user?.fullName || 'Khách';

  // Lấy giờ hiện tại để hiển thị lời chào phù hợp
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
    <div className="flex flex-col w-full">
      <div className="max-w-[1180px] w-full mx-auto px-margin py-space-lg flex flex-col gap-space-lg">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 font-code-sm text-code-sm text-outline">
          <span className="text-on-surface font-semibold">Trang chủ</span>
        </div>

        {/* Welcome Section */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-space-sm">
          <div className="flex flex-col gap-1">
            <h1 className="font-headline-md text-headline-md text-on-surface tracking-tight">
              {greeting}, {displayName} 👋
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant capitalize">
              {today}
            </p>
          </div>
          <div className="flex items-center gap-3 bg-surface-container-lowest px-3.5 py-1.5 rounded border border-outline-variant/50">
            <span className="material-symbols-outlined text-[18px] text-primary">
              verified_user
            </span>
            <span className="font-body-sm text-body-sm text-on-surface-variant">
              Bảo vệ 3 lớp • Giám sát CCTV thời gian thực
            </span>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-gutter">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="bg-surface-container-lowest rounded-lg border border-outline-variant/60 p-5 flex items-center gap-4 shadow-sm"
              style={{
                backgroundColor: 'rgb(255, 255, 255)',
                border: '1px solid rgb(203, 213, 225)',
                boxShadow: 'rgba(0, 0, 0, 0.1) 0px 4px 6px -1px, rgba(0, 0, 0, 0.1) 0px 2px 4px -2px',
              }}
            >
              <div className={`w-12 h-12 rounded-lg ${stat.bgColor} flex items-center justify-center`}>
                <span className={`material-symbols-outlined text-[24px] ${stat.color}`}>
                  {stat.icon}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm text-outline uppercase font-semibold tracking-wider">
                  {stat.label}
                </span>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className={`font-headline-sm text-headline-sm ${stat.color} font-bold`}>
                    {stat.value}
                  </span>
                  {stat.unit && (
                    <span className="font-body-sm text-body-sm text-on-surface-variant">
                      {stat.unit}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="font-headline-sm text-headline-sm text-on-surface mb-space-md">
            Truy cập nhanh
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter">
            {quickActions.map((action) => (
              <Link
                key={action.path}
                to={action.path}
                className="bg-surface-container-lowest rounded-lg border border-outline-variant/60 p-5 flex flex-col gap-3 hover:border-secondary/40 hover:shadow-md transition-all group"
                style={{
                  backgroundColor: 'rgb(255, 255, 255)',
                  border: '1px solid rgb(203, 213, 225)',
                  boxShadow: 'rgba(0, 0, 0, 0.1) 0px 4px 6px -1px, rgba(0, 0, 0, 0.1) 0px 2px 4px -2px',
                }}
              >
                <div className={`w-11 h-11 rounded-lg ${action.bgColor} flex items-center justify-center`}>
                  <span className={`material-symbols-outlined text-[22px] ${action.color}`}>
                    {action.icon}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="font-title-md text-title-md text-on-surface font-semibold group-hover:text-secondary transition-colors">
                    {action.title}
                  </span>
                  <span className="font-body-sm text-body-sm text-on-surface-variant">
                    {action.description}
                  </span>
                </div>
                <span className="material-symbols-outlined text-[18px] text-outline group-hover:text-secondary group-hover:translate-x-1 transition-all">
                  arrow_forward
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Promo Banner */}
        <div
          className="bg-surface-container-lowest border border-outline-variant/60 rounded-lg p-space-md flex flex-col sm:flex-row items-center justify-between gap-4"
          style={{
            backgroundColor: 'rgb(255, 255, 255)',
            border: '1px solid rgb(203, 213, 225)',
            boxShadow: 'rgba(0, 0, 0, 0.08) 0px 4px 6px -1px, rgba(0, 0, 0, 0.05) 0px 2px 4px -2px',
          }}
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-[#ECFDF5] flex items-center justify-center">
              <span className="material-symbols-outlined text-[24px] text-[#10B981]">
                local_offer
              </span>
            </div>
            <div>
              <h4 className="font-title-md text-title-md text-on-surface">
                Ưu đãi đặc biệt tháng này
              </h4>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Chiết khấu 10% cho kỳ thanh toán từ 6 tháng trở lên. Áp dụng cho tất cả loại khoang.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <Link
              to="/tim-va-dat-kho"
              className="px-4 py-2 bg-secondary text-on-secondary rounded font-title-md text-title-md hover:opacity-90 transition-opacity"
            >
              Xem kho ngay
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
