import { Link } from 'react-router-dom';

// Mock data - sáº½ thay báº±ng API tháº­t sau
const stats = [
  {
    icon: 'inventory_2',
    label: 'Kho Ä‘ang thuÃª',
    value: '2',
    unit: 'khoang',
    color: 'text-primary',
    bgColor: 'bg-primary-fixed',
  },
  {
    icon: 'event_upcoming',
    label: 'HÄ sáº¯p háº¿t háº¡n',
    value: '1',
    unit: 'há»£p Ä‘á»“ng',
    color: 'text-[#D97706]',
    bgColor: 'bg-[#FFFBEB]',
  },
  {
    icon: 'receipt_long',
    label: 'Chá» thanh toÃ¡n',
    value: '850.000â‚«',
    unit: '',
    color: 'text-error',
    bgColor: 'bg-error-container',
  },
];

const quickActions = [
  {
    icon: 'search',
    title: 'TÃ¬m & Äáº·t Kho',
    description: 'TÃ¬m kiáº¿m vÃ  thuÃª khoang lÆ°u trá»¯ phÃ¹ há»£p',
    path: '/tim-va-dat-kho',
    color: 'text-secondary',
    bgColor: 'bg-secondary-fixed',
  },
  {
    icon: 'inventory_2',
    title: 'Kho cá»§a tÃ´i',
    description: 'Quáº£n lÃ½ cÃ¡c khoang kho Ä‘ang thuÃª',
    path: '/kho-cua-toi',
    color: 'text-primary',
    bgColor: 'bg-primary-fixed',
  },
  {
    icon: 'payments',
    title: 'Thanh toÃ¡n',
    description: 'Xem vÃ  thanh toÃ¡n hÃ³a Ä‘Æ¡n hÃ ng thÃ¡ng',
    path: '/thanh-toan',
    color: 'text-[#10B981]',
    bgColor: 'bg-[#ECFDF5]',
  },
  {
    icon: 'contact_support',
    title: 'Há»— trá»£',
    description: 'LiÃªn há»‡ tÆ° váº¥n vÃ  há»— trá»£ ká»¹ thuáº­t',
    path: '/ho-tro',
    color: 'text-[#8B5CF6]',
    bgColor: 'bg-[#F5F3FF]',
  },
];

export default function HomePage() {
  // Äá»c thÃ´ng tin user tá»« sessionStorage
  const userStr = sessionStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;
  const displayName = user?.fullName || 'KhÃ¡ch';

  // Láº¥y giá» hiá»‡n táº¡i Ä‘á»ƒ hiá»ƒn thá»‹ lá»i chÃ o phÃ¹ há»£p
  const currentHour = new Date().getHours();
  let greeting = 'Xin chÃ o';
  if (currentHour < 12) greeting = 'ChÃ o buá»•i sÃ¡ng';
  else if (currentHour < 18) greeting = 'ChÃ o buá»•i chiá»u';
  else greeting = 'ChÃ o buá»•i tá»‘i';

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
          <span className="text-on-surface font-semibold">Trang chá»§</span>
        </div>

        {/* Welcome Section */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-space-sm">
          <div className="flex flex-col gap-1">
            <h1 className="font-headline-md text-headline-md text-on-surface tracking-tight">
              {greeting}, {displayName} ðŸ‘‹
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
              Báº£o vá»‡ 3 lá»›p â€¢ GiÃ¡m sÃ¡t CCTV thá»i gian thá»±c
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
            Truy cáº­p nhanh
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
                Æ¯u Ä‘Ã£i Ä‘áº·c biá»‡t thÃ¡ng nÃ y
              </h4>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Chiáº¿t kháº¥u 10% cho ká»³ thanh toÃ¡n tá»« 6 thÃ¡ng trá»Ÿ lÃªn. Ãp dá»¥ng cho táº¥t cáº£ loáº¡i khoang.
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

