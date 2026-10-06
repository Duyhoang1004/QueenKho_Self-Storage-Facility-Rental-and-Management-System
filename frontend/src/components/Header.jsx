import UserDropdown from './UserDropdown';
import NotificationDropdown from './NotificationDropdown';

export default function Header({ portalName, user, onLogout, sidebarCollapsed }) {
  const leftOffset = sidebarCollapsed ? 'left-[72px]' : 'left-[260px]';
  return (
    <header className={`fixed top-0 ${leftOffset} right-0 h-20 bg-white border-b-2 border-[#E5E5E5] z-40 px-8 flex items-center justify-between select-none transition-all duration-300`}>
      {/* Left side: Duolingo Breadcrumbs & Gamified Status */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#AFAFAF]">
          <span className="text-[#58CC02] hover:text-[#58A700] cursor-pointer">QueenKho</span>
          <span>/</span>
          <span className="text-[#4B4B4B]">{portalName}</span>
        </div>

        {/* Duolingo Gamified Badges */}
        <div className="hidden sm:flex items-center gap-2">
          {/* Streak - green tone */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#D7FFB8] border-2 border-[#58CC02] text-[#58A700] text-xs font-black">
            <span className="text-sm">🔥</span>
            <span>365 ngày an toàn</span>
          </div>

          {/* Shield - green tone nhạt */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EDFFD5] border-2 border-[#7ED94B] text-[#4A9B20] text-xs font-black">
            <span className="text-sm">🛡️</span>
            <span>Kho bảo mật cấp 5</span>
          </div>
        </div>
      </div>

      {/* Right side: Notification + User avatar */}
      <div className="flex items-center gap-3">
        <NotificationDropdown />
        <UserDropdown user={user} onLogout={onLogout} />
      </div>
    </header>
  );
}
