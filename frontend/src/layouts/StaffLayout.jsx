import { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { clearSession, getHomePath } from '../services/authService';
import NotificationDropdown from '../components/NotificationDropdown';

// UC-16: Layout cho nhân viên cơ sở (STAFF)
const staffMenuItems = [
  { path: '/staff', icon: 'assignment', label: 'Bảng công việc' },
];

export default function StaffLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const userStr = sessionStorage.getItem('user');
  if (!userStr) return <Navigate to="/login" replace />;
  const currentUser = JSON.parse(userStr);
  if (currentUser.role !== 'STAFF') return <Navigate to={getHomePath(currentUser.role)} replace />;

  const facilityName = currentUser.facilityName || 'Chưa gán cơ sở';

  const handleLogout = () => {
    clearSession();
    navigate('/login', { replace: true });
  };

  const sidebarWidth = collapsed ? 'w-[72px]' : 'w-[260px]';
  const mainOffset = collapsed ? 'pl-[72px]' : 'pl-[260px]';
  const headerLeft = collapsed ? 'left-[72px]' : 'left-[260px]';

  return (
    <div className="bg-[#FFFFFF] text-[#4B4B4B] min-h-screen font-sans">

      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 h-screen supports-[height:100dvh]:h-[100dvh] bg-white z-50 flex flex-col border-r-2 border-[#E5E5E5] transition-all duration-300 ${sidebarWidth}`}>

        {/* Logo + toggle */}
        <div className={`h-20 shrink-0 flex items-center border-b-2 border-[#E5E5E5] ${collapsed ? 'justify-center px-0' : 'gap-3 px-6'}`}>
          <button
            onClick={() => setCollapsed((prev) => !prev)}
            className="h-11 w-11 rounded-2xl bg-[#58CC02] border-b-4 border-[#58A700] flex items-center justify-center text-white shadow-xs cursor-pointer hover:bg-[#4db800] transition-colors shrink-0"
            title={collapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
          >
            <span className="material-symbols-outlined text-[26px]">
              {collapsed ? 'menu_open' : 'warehouse'}
            </span>
          </button>

          {!collapsed && (
            <div className="flex flex-col min-w-0 overflow-hidden">
              <span className="text-xl font-black text-[#58CC02] tracking-wider uppercase leading-none">
                Queen<span className="text-[#1CB0F6]">Kho</span>
              </span>
              <span className="text-[11px] font-extrabold text-[#AFAFAF] uppercase tracking-widest mt-1 truncate">
                Nhân viên cơ sở
              </span>
            </div>
          )}
        </div>

        {/* Scrollable nav region */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain custom-scrollbar [scrollbar-gutter:stable] flex flex-col">
          {/* Section label */}
          {!collapsed && (
            <div className="px-5 pt-3 pb-1.5">
              <span className="text-[11px] font-black uppercase tracking-widest text-[#AFAFAF]">
                VẬN HÀNH TẠI CƠ SỞ
              </span>
            </div>
          )}

          {/* Nav Items */}
          <nav className={`flex flex-col gap-1 pb-3 ${collapsed ? 'px-2 pt-3' : 'px-3'}`}>
            {staffMenuItems.map((item) => {
              // Trang biên bản bàn giao (/staff/tasks/...) vẫn sáng mục "Bảng công việc"
              const isActive = location.pathname === item.path
                || (item.path === '/staff' && location.pathname.startsWith('/staff/tasks'));
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  title={item.label}
                  className={`flex items-center rounded-xl text-[11px] uppercase font-black tracking-wide transition-all duration-150 min-w-0 ${
                    collapsed ? 'justify-center px-0 py-2.5' : 'gap-2.5 px-3 py-2'
                  } ${
                    isActive
                      ? 'bg-[#DDF4FF] border-2 border-[#84D8FF] text-[#1CB0F6] shadow-xs'
                      : 'border-2 border-transparent text-[#777777] hover:bg-[#F7F7F7] hover:text-[#4B4B4B]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px] shrink-0">{item.icon}</span>
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className={`${mainOffset} transition-all duration-300`}>
        {/* Header */}
        <header className={`fixed top-0 ${headerLeft} right-0 h-20 bg-white border-b-2 border-[#E5E5E5] z-40 flex items-center justify-between px-8 transition-all duration-300`}>
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#AFAFAF] whitespace-nowrap">
            <span className="text-[#58CC02]">QueenKho</span>
            <span>/</span>
            <span className="text-[#4B4B4B]">Nhân viên</span>
            <span>/</span>
            <span className="flex items-center gap-1 text-[#1CB0F6]">
              <span className="material-symbols-outlined text-[16px]">location_on</span>
              {facilityName}
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Staff Avatar & Logout Button */}
            <div className="flex items-center gap-3">
              <NotificationDropdown />
              <Link
                to="/staff/profile"
                title="Xem & chỉnh sửa hồ sơ cá nhân"
                className="flex items-center gap-2.5 p-1.5 rounded-2xl hover:bg-[#F7F7F7] transition-colors cursor-pointer"
              >
                <div className="w-10 h-10 rounded-2xl bg-[#1CB0F6] border-b-2 border-[#1899D6] text-white flex items-center justify-center font-black text-sm">
                  {currentUser.fullName ? currentUser.fullName.charAt(0).toUpperCase() : 'S'}
                </div>
                <div className="hidden md:flex flex-col text-left">
                  <span className="text-xs font-black text-[#4B4B4B] leading-tight">{currentUser.fullName || 'Nhân viên'}</span>
                  <span className="text-[10px] font-extrabold text-[#AFAFAF] uppercase leading-tight">Nhân viên</span>
                </div>
              </Link>

              <button
                onClick={handleLogout}
                className="w-10 h-10 rounded-2xl bg-white border-2 border-b-4 border-[#FFDFDF] text-[#FF4B4B] hover:bg-[#FFDFDF] active:border-b-2 active:translate-y-0.5 flex items-center justify-center transition-all cursor-pointer"
                title="Đăng xuất"
              >
                <span className="material-symbols-outlined text-[19px]">logout</span>
              </button>
            </div>
          </div>
        </header>

        {/* Main Routed Page Content */}
        <main className="w-full pt-20 bg-[#FFFFFF] min-h-screen">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
