import { NavLink } from 'react-router-dom';

export default function Sidebar({ menuItems, role, user, onLogout }) {
  return (
    <aside className="fixed left-0 top-0 h-full w-[260px] bg-primary-container z-50 flex flex-col justify-between border-r border-[#D1D5DB]/20">
      {/* Top section: Logo + Menu */}
      <div className="flex flex-col">
        {/* Logo & Brand */}
        <div className="h-16 px-space-lg flex items-center gap-space-sm border-b border-white/10">
          {/* Text logo placeholder */}
          <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center">
            <span className="material-symbols-outlined text-on-secondary text-[20px]">
              warehouse
            </span>
          </div>
          <div className="flex flex-col">
            <span className="font-title-md text-title-md text-on-primary font-bold tracking-tight">
              QueenKho
            </span>
            <span className="font-label-sm text-label-sm text-on-primary-container uppercase tracking-wider">
              {role}
            </span>
          </div>
        </div>

        {/* Navigation Menu */}
        <div className="px-space-md py-space-lg">
          <div className="font-label-sm text-label-sm text-on-primary-container uppercase px-space-sm mb-space-xs font-semibold tracking-wider">
            Dịch Vụ Lưu Trữ
          </div>
          <nav className="flex flex-col gap-1">
            {menuItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-space-sm px-space-md py-2.5 rounded-lg font-body-md text-body-md transition-colors ${
                    isActive
                      ? 'bg-secondary text-on-secondary font-semibold'
                      : 'text-on-primary/80 hover:bg-white/10 hover:text-on-primary'
                  }`
                }
              >
                <span className="material-symbols-outlined text-[20px]">
                  {item.icon}
                </span>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>

      {/* Bottom section: User info + Logout */}
      <div className="p-space-md border-t border-white/10 bg-primary/40">
        <div className="flex items-center gap-space-sm">
          <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center text-on-secondary font-semibold font-title-md">
            {user.initials}
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="font-title-md text-title-md text-on-primary truncate font-medium">
              {user.name}
            </span>
            <span className="font-label-sm text-label-sm text-on-primary-container truncate">
              {role}
            </span>
          </div>
          <button
            onClick={onLogout}
            className="text-on-primary/60 hover:text-on-primary p-1 transition-colors cursor-pointer"
            title="Đăng xuất"
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
