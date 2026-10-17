import { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { clearSession, getHomePath } from '../services/authService';

// Menu items cho Customer portal
const customerMenuItems = [
  { icon: 'home', label: 'Trang chủ', path: '/' },
  { icon: 'search', label: 'Tìm & Đặt Kho', path: '/tim-va-dat-kho' },
  { icon: 'inventory_2', label: 'Kho của tôi', path: '/kho-cua-toi' },
  { icon: 'payments', label: 'Thanh toán', path: '/thanh-toan' },
  { icon: 'contact_support', label: 'Hỗ trợ', path: '/ho-tro' },
];

export default function CustomerLayout() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const userStr = sessionStorage.getItem('user');
    if (!userStr) {
      navigate('/login', { replace: true });
      return;
    }

    const user = JSON.parse(userStr);
    
    // Role nội bộ có portal riêng (Staff, FM, Admin) → chuyển về portal đó
    const homePath = getHomePath(user.role);
    if (user.role !== 'CUSTOMER' && homePath !== '/') {
      navigate(homePath, { replace: true });
      return;
    }

    // Role chưa có portal (BOM) thì đẩy ra đăng nhập
    if (user.role !== 'CUSTOMER') {
      alert('Bạn không có quyền truy cập trang này!');
      clearSession();
      navigate('/login', { replace: true });
      return;
    }

    // Tạo chữ viết tắt từ tên thật
    const names = user.fullName ? user.fullName.split(' ') : ['K', 'H'];
    let initials = '';
    if (names.length >= 2) {
      initials = (names[0][0] + names[names.length - 1][0]).toUpperCase();
    } else if (names.length === 1) {
      initials = names[0][0].toUpperCase();
    }

    setCurrentUser({
      ...user,
      name: user.fullName, // Map từ fullName sang name để Sidebar dùng
      initials: initials || 'KH',
      role: 'Khách Hàng' // Hiển thị tiếng Việt trên UI
    });
  }, [navigate]);

  const handleLogout = () => {
    clearSession();
    navigate('/login', { replace: true });
  };

  if (!currentUser) return null;

  const sidebarWidth = sidebarCollapsed ? 'pl-[72px]' : 'pl-[260px]';

  return (
    <div className="bg-[#FFFFFF] min-h-screen">
      <Sidebar
        menuItems={customerMenuItems}
        role={currentUser.role}
        user={currentUser}
        onLogout={handleLogout}
        onCollapseChange={setSidebarCollapsed}
      />
      <div className={`${sidebarWidth} transition-all duration-300`}>
        <Header
          portalName="Cổng Khách Hàng"
          user={currentUser}
          onLogout={handleLogout}
          sidebarCollapsed={sidebarCollapsed}
        />
        <main className="w-full pt-20 bg-[#FFFFFF] min-h-screen">
          <Outlet />
        </main>
      </div>
    </div>
  );
}