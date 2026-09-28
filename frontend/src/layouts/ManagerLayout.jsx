import { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { clearSession } from '../services/authService';

const managerMenuItems = [
  { path: '/manager', icon: 'dashboard', label: 'Bảng điều khiển cơ sở' },
  { path: '/manager/assign', icon: 'assignment_turned_in', label: 'Duyệt & Gán ô kho', badge: '3 đơn mới' },
  { path: '/manager/pending', icon: 'pending_actions', label: 'Đơn chờ gán ô' },
  { path: '/manager/storage', icon: 'grid_view', label: 'Quản lý danh mục kho' },
  { path: '/manager/staff', icon: 'badge', label: 'Phân công nhân viên' },
  { path: '/manager/customers', icon: 'history_edu', label: 'Khách hàng & Hợp đồng' },
  { path: '/manager/reports', icon: 'bar_chart', label: 'Báo cáo cơ sở' },
];

export default function ManagerLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  // TODO: Get real user from context/sessionStorage
  const userStr = sessionStorage.getItem('user');
  if (!userStr) return <Navigate to="/login" replace />;
  const currentUser = JSON.parse(userStr);
  if (currentUser.role !== 'MANAGER' && currentUser.role !== 'ADMIN') return <Navigate to="/login" replace />;

  const handleLogout = () => {
    clearSession();
    navigate('/login', { replace: true });
  };

  return (
    <div className="bg-surface font-body-md text-on-surface antialiased min-h-screen">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-screen w-[260px] bg-primary-container z-50 flex flex-col justify-between select-none shadow-md">
        <div className="flex flex-col">
          <div className="p-space-lg flex items-center gap-space-sm border-b border-primary">
            <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center text-on-secondary shadow-sm shrink-0">
              <span className="material-symbols-outlined text-[24px]">warehouse</span>
            </div>
            <div className="flex flex-col">
              <span className="font-title-md text-title-md text-on-primary tracking-tight uppercase leading-none">KHO VIỆT</span>
              <span className="font-label-sm text-label-sm text-on-primary-container tracking-wider uppercase mt-1">HỆ THỐNG KHO TỰ QUẢN</span>
            </div>
          </div>
          
          <div className="px-space-md pt-space-md pb-space-2xs">
            <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-primary-container/70 px-space-sm">Quản trị cơ sở</span>
          </div>
          
          <nav className="flex flex-col gap-1 px-space-sm">
            {managerMenuItems.map((item) => {
              const isActive = location.pathname === item.path || (item.path !== '/manager' && location.pathname.startsWith(item.path));
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center justify-between px-space-sm py-2.5 rounded-lg transition-colors ${
                    isActive 
                      ? 'bg-primary text-on-primary font-title-md shadow-sm' 
                      : 'text-primary-fixed-dim hover:bg-primary/60 hover:text-on-primary'
                  }`}
                >
                  <div className="flex items-center gap-space-sm">
                    <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                    <span className="font-label-lg text-label-lg">{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="bg-secondary text-on-secondary text-label-sm font-label-sm px-2 py-0.5 rounded-full shadow-sm">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
        
        <div className="p-space-md">
          <div className="bg-primary rounded-xl p-space-sm text-on-primary flex flex-col gap-1.5 border border-primary-container">
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-tertiary-fixed animate-pulse"></span>
              <span className="font-label-sm text-label-sm text-primary-fixed">Hệ thống trực tuyến</span>
            </div>
            <div className="font-body-sm text-body-sm text-surface-container-high">Hotline kỹ thuật:</div>
            <div className="font-title-md text-title-md text-on-primary tracking-wide">1900 6868 (Phím 2)</div>
          </div>
        </div>
      </aside>

      <div className="pl-[260px]">
        {/* Header */}
        <header className="fixed top-0 left-[260px] right-0 h-16 bg-surface-container-lowest border-b border-outline-variant/50 z-40 flex items-center justify-between px-space-lg">
          <div className="flex items-center gap-2 text-on-surface-variant font-label-md text-label-md">
            <span className="hover:text-on-surface cursor-pointer">Kho Việt</span>
            <span className="material-symbols-outlined text-[16px] text-outline">chevron_right</span>
            <span className="hover:text-on-surface cursor-pointer">Cơ sở Tân Bình</span>
            <span className="material-symbols-outlined text-[16px] text-outline">chevron_right</span>
            <span className="text-on-surface font-title-md text-title-md">Điều phối vận hành</span>
          </div>
          
          <div className="flex items-center gap-space-md">
            <div className="flex items-center gap-space-xs border-r border-outline-variant/60 pr-space-md">
              <button className="w-9 h-9 rounded-lg hover:bg-surface-container text-on-surface-variant hover:text-on-surface flex items-center justify-center transition-colors">
                <span className="material-symbols-outlined text-[20px]">search</span>
              </button>
              <button className="relative w-9 h-9 rounded-lg hover:bg-surface-container text-on-surface-variant hover:text-on-surface flex items-center justify-center transition-colors">
                <span className="material-symbols-outlined text-[20px]">notifications</span>
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-error"></span>
              </button>
            </div>
            
            <div className="flex items-center gap-space-sm pl-space-xs cursor-pointer" onClick={handleLogout} title="Đăng xuất">
              <div className="w-9 h-9 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-title-md text-title-md">
                {currentUser.fullName ? currentUser.fullName.charAt(0).toUpperCase() : 'M'}
              </div>
              <div className="flex flex-col text-left">
                <span className="font-label-lg text-label-lg text-on-surface leading-tight">{currentUser.fullName}</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant leading-tight">Quản lý Cơ sở Tân Bình</span>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="relative pt-16 bg-surface min-h-screen" style={{ backgroundColor: 'rgb(241, 245, 249)' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}