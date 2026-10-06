import { useState } from 'react';
import { NavLink } from 'react-router-dom';

export default function Sidebar({ menuItems, role, user, onLogout, onCollapseChange }) {
  const [collapsed, setCollapsed] = useState(false);

  const handleToggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    if (onCollapseChange) onCollapseChange(next);
  };

  return (
    <aside
      className={`fixed left-0 top-0 h-full bg-white z-50 flex flex-col justify-between border-r-2 border-[#E5E5E5] select-none transition-all duration-300 ${
        collapsed ? 'w-[72px]' : 'w-[260px]'
      }`}
    >
      {/* Top section: Logo + Nav */}
      <div className="flex flex-col">
        {/* Brand Header */}
        <div
          className={`h-20 flex items-center border-b-2 border-[#E5E5E5] ${
            collapsed ? 'justify-center px-0' : 'gap-3 px-6'
          }`}
        >
          {/* Logo icon — bấm để toggle */}
          <button
            onClick={handleToggle}
            className="h-11 w-11 rounded-2xl bg-[#58CC02] border-b-4 border-[#58A700] flex items-center justify-center text-white shadow-xs cursor-pointer hover:bg-[#4db800] transition-colors shrink-0"
            title={collapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
          >
            <span className="material-symbols-outlined text-[26px]">
              {collapsed ? 'menu_open' : 'warehouse'}
            </span>
          </button>

          {/* Brand text — ẩn khi collapsed */}
          {!collapsed && (
            <div className="flex flex-col overflow-hidden">
              <span className="text-xl font-black text-[#58CC02] tracking-wider uppercase leading-none">
                Queen<span className="text-[#1CB0F6]">Kho</span>
              </span>
              <span className="text-[11px] font-extrabold text-[#AFAFAF] uppercase tracking-widest mt-1">
                {role || 'Khách Hàng'}
              </span>
            </div>
          )}
        </div>

        {/* Nav */}
        <div className={`py-6 ${collapsed ? 'px-2' : 'px-4'}`}>
          {/* Section label — ẩn khi collapsed */}
          {!collapsed && (
            <div className="text-[11px] font-black text-[#AFAFAF] uppercase px-3 mb-3 tracking-widest">
              DANH MỤC LƯU TRỮ
            </div>
          )}

          <nav className="flex flex-col gap-2">
            {menuItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                title={collapsed ? item.label : undefined}
                className={({ isActive }) =>
                  `flex items-center gap-3.5 rounded-2xl text-sm transition-all duration-150 font-extrabold uppercase tracking-wide cursor-pointer ${
                    collapsed ? 'justify-center px-0 py-3' : 'px-4 py-3'
                  } ${
                    isActive
                      ? 'bg-[#DDF4FF] border-2 border-[#84D8FF] text-[#1CB0F6] shadow-xs'
                      : 'border-2 border-transparent text-[#777777] hover:bg-[#F7F7F7] hover:text-[#4B4B4B]'
                  }`
                }
              >
                <span className="material-symbols-outlined text-[22px] shrink-0">
                  {item.icon}
                </span>
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>

      {/* Bottom: User card */}
      <div className={`border-t-2 border-[#E5E5E5] bg-[#FAFAFA] ${collapsed ? 'p-2' : 'p-4'}`}>
        {collapsed ? (
          /* Collapsed: chỉ hiện avatar + logout */
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-[#58CC02] border-b-2 border-[#58A700] text-white flex items-center justify-center font-black text-sm">
              {user.initials || 'QK'}
            </div>
            <button
              onClick={onLogout}
              className="w-8 h-8 rounded-xl text-[#AFAFAF] hover:text-[#FF4B4B] hover:bg-[#FFDFDF] flex items-center justify-center transition-colors cursor-pointer"
              title="Đăng xuất"
            >
              <span className="material-symbols-outlined text-[19px]">logout</span>
            </button>
          </div>
        ) : (
          /* Expanded: hiện đầy đủ */
          <div className="flex items-center justify-between p-2.5 rounded-2xl bg-white border-2 border-b-4 border-[#E5E5E5]">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#58CC02] border-b-2 border-[#58A700] text-white flex items-center justify-center font-black text-sm shrink-0">
                {user.initials || 'QK'}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-black text-[#4B4B4B] truncate">
                  {user.name}
                </span>
                <span className="text-[11px] font-extrabold text-[#AFAFAF] uppercase truncate">
                  {role}
                </span>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="w-8 h-8 rounded-xl text-[#AFAFAF] hover:text-[#FF4B4B] hover:bg-[#FFDFDF] flex items-center justify-center transition-colors cursor-pointer shrink-0 ml-1"
              title="Đăng xuất"
            >
              <span className="material-symbols-outlined text-[19px]">logout</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
