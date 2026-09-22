import UserDropdown from './UserDropdown';
import NotificationDropdown from './NotificationDropdown';

export default function Header({ portalName, user, onLogout }) {
  return (
    <header className="fixed top-0 left-[260px] right-0 h-16 bg-surface-container-lowest border-b border-[#D1D5DB] z-40 px-space-lg flex items-center justify-between">
      {/* Left side: Breadcrumb + Status badge */}
      <div className="flex items-center gap-space-sm">
        <div className="flex items-center gap-1.5 font-body-sm text-body-sm text-on-surface-variant">
          <span className="font-medium text-on-surface">QueenKho</span>
          <span className="text-outline">/</span>
          <span>{portalName}</span>
        </div>
        <div className="h-4 w-[1px] bg-[#D1D5DB] mx-space-xs"></div>
        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-[#10B981]/30 bg-[#ECFDF5] text-[#10B981] font-label-sm text-label-sm font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]"></span>
          Kho Hoạt Động Bình Thường
        </div>
      </div>

      {/* Right side: Notification + User avatar */}
      <div className="flex items-center gap-space-md">
        <NotificationDropdown />
        <UserDropdown user={user} onLogout={onLogout} />
      </div>
    </header>
  );
}
