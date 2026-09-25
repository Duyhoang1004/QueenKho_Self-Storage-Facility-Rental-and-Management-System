import { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { clearSession } from '../services/authService';

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

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      navigate('/login', { replace: true });
      return;
    }

    const user = JSON.parse(userStr);
    
    // Kiểm tra phân quyền, nếu không phải Khách hàng thì đẩy về trang phù hợp
    if (user.role !== 'CUSTOMER') {
      // Giả sử sau này có staff thì đẩy về /staff, admin đẩy về /admin
      // Tạm thời nếu sai quyền thì báo lỗi hoặc đẩy ra đăng nhập
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

  if (!currentUser) return null; // Hoặc hiển thị một spinner loading

  return (
    <div>
      <Sidebar
        menuItems={customerMenuItems}
        role={currentUser.role}
        user={currentUser}
        onLogout={handleLogout}
      />
      <div className="pl-[260px]">
        <Header
          portalName="Cổng Khách Hàng"
          user={currentUser}
          onLogout={handleLogout}
        />
        <main className="w-full pt-16 bg-[#F4F6F8] min-h-screen" style={{ backgroundColor: 'rgb(226, 232, 240)' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
