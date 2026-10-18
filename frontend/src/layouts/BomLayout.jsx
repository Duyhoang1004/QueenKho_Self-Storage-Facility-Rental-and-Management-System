import { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { clearSession, getHomePath } from '../services/authService';

// Menu items cho BOM portal
const bomMenuItems = [
  { path: '/bom/facilities', icon: 'warehouse', label: 'Cơ sở kho bãi' },
  { path: '/bom/unit-types', icon: 'sell', label: 'Bảng giá dịch vụ' },
  { path: '/bom/policies', icon: 'policy', label: 'Chính sách thuê' },
  { path: '/bom/revenue', icon: 'monitoring', label: 'Báo cáo doanh thu' },
];

export default function BomLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const userStr = sessionStorage.getItem('user');
  if (!userStr) return <Navigate to="/login" replace />;
  const currentUser = JSON.parse(userStr);

  // Phân quyền: chỉ role BOM mới được vào
  if (currentUser.role !== 'BOM') {
    return <Navigate to={getHomePath(currentUser.role)} replace />;
  }

  const handleLogout = () => {
    clearSession();
    navigate('/login', { replace: true });
  };

  const sidebarWidth = collapsed ? 'w-[72px]' : 'w-[260px]';
  const mainOffset = collapsed ? 'pl-[72px]' : 'pl-[260px]';
  const headerLeft = collapsed ? 'left-[72px]' : 'left-[260px]';

  return (
    <div className="bg-[#FFFFFF] text-[#4B4B4B] min-h-screen select-none font-sans">

      {/* Sidebar Duolingo theme */}
      <aside className={`fixed left-0 top-0 h-screen bg-white z-50 flex flex-col justify-between border-r-2 border-[#E5E5E5] transition-all duration-300 ${sidebarWidth}`}>
        <div className="flex flex-col">

          {/* Logo + toggle */}
          <div className={`h-20 flex items-center border-b-2 border-[#E5E5E5] ${collapsed ? 'justify-center px-0' : 'gap-3 px-6'}`}>
            <button
              onClick={() => setCollapsed((prev) => !prev)}
              className="h-11 w-11 rounded-2xl bg-[#58CC02] border-b-4 border-[#58A700] flex items-center justify-center text-white shadow-xs cursor-pointer hover:bg-[#4db800] transition-colors shrink-0"
              title={collapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
            >
              <span className="material-symbols-outlined text-[26px]">
                {collapsed ? 'menu_open' : 'corporate_fare'}
              </span>
            </button>

            {!collapsed && (
              <div className="flex flex-col overflow-hidden">
                <span className="text-xl font-black text-[#58CC02] tracking-wider uppercase leading-none">
                  Queen<span className="text-[#1CB0F6]">Kho</span>
                </span>
                <span className="text-[11px] font-extrabold text-[#FF9600] uppercase tracking-widest mt-1">
                  Vận hành BOM
                </span>
              </div>
            )}
          </div>

          {/* Section label */}
          {!collapsed && (
            <div className="px-5 pt-5 pb-2">
              <span className="text-[11px] font-black uppercase tracking-widest text-[#AFAFAF]">
                HỆ THỐNG VẬN HÀNH
              </span>
            </div>
          )}

          {/* Nav Items */}
          <nav className={`flex flex-col gap-2 ${collapsed ? 'px-2 pt-4' : 'px-3'}`}>
            {bomMenuItems.map((item) => {
              const isActive =
                location.pathname === item.path ||
                (item.path === '/bom/facilities' && location.pathname === '/bom');

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  title={collapsed ? item.label : undefined}
                  className={`flex items-center rounded-2xl text-xs uppercase font-black tracking-wide transition-all duration-150 ${
                    collapsed ? 'justify-center px-0 py-3' : 'gap-3 px-4 py-3'
                  } ${
                    isActive
                      ? 'bg-[#DDF4FF] border-2 border-[#84D8FF] text-[#1CB0F6] shadow-xs'
                      : 'border-2 border-transparent text-[#777777] hover:bg-[#F7F7F7] hover:text-[#4B4B4B]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[22px] shrink-0">
                    {item.icon}
                  </span>
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Card at bottom of sidebar */}
        {!collapsed && (
          <div className="p-4 border-t-2 border-[#E5E5E5] m-3 rounded-2xl bg-[#F7F7F7] flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#FF9600] border-b-2 border-[#CC7A00] text-white flex items-center justify-center font-black text-xs shrink-0">
              {currentUser.fullName ? currentUser.fullName.charAt(0).toUpperCase() : 'B'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-[#4B4B4B] truncate leading-tight">
                {currentUser.fullName || 'Hoàng Long'}
              </p>
              <p className="text-[10px] font-extrabold text-[#AFAFAF] uppercase tracking-wider truncate mt-0.5">
                Giám đốc vận hành
              </p>
            </div>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <div className={`${mainOffset} transition-all duration-300`}>

        {/* Header */}
        <header className={`fixed top-0 ${headerLeft} right-0 h-20 bg-white border-b-2 border-[#E5E5E5] z-40 flex items-center justify-between px-8 transition-all duration-300`}>
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#AFAFAF] whitespace-nowrap">
            <span className="text-[#58CC02]">QueenKho</span>
            <span>/</span>
            <span className="text-[#FF9600]">Vận hành trung tâm (BOM)</span>
            <span>/</span>
            <span className="text-[#4B4B4B]">Quản lý cơ sở</span>
          </div>

          <div className="flex items-center gap-3">
            {/* System Status Pill */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#EAF7DD] border-2 border-[#B4E885] text-[#58CC02] text-xs font-black uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-[#58CC02] animate-pulse"></span>
              <span>Hệ thống trực tuyến</span>
            </div>

            <div className="flex items-center gap-2.5 p-1 rounded-2xl">
              <div className="w-10 h-10 rounded-2xl bg-[#FF9600] border-b-2 border-[#CC7A00] text-white flex items-center justify-center font-black text-sm">
                {currentUser.fullName ? currentUser.fullName.charAt(0).toUpperCase() : 'B'}
              </div>
              <div className="hidden md:flex flex-col text-left">
                <span className="text-xs font-black text-[#4B4B4B] leading-tight">
                  {currentUser.fullName || 'Hoàng Long'}
                </span>
                <span className="text-[10px] font-extrabold text-[#AFAFAF] uppercase leading-tight">
                  Quản lý BOM
                </span>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="w-10 h-10 rounded-2xl bg-white border-2 border-b-4 border-[#FFDFDF] text-[#FF4B4B] hover:bg-[#FFDFDF] active:border-b-2 active:translate-y-0.5 flex items-center justify-center transition-all cursor-pointer"
              title="Đăng xuất"
            >
              <span className="material-symbols-outlined text-[19px]">logout</span>
            </button>
          </div>
        </header>

        {/* Main Routed Page Content */}
        <main className="w-full pt-20 bg-[#F7F7F7] min-h-screen">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
