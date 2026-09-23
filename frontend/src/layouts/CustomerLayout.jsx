import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

// Menu items cho Customer portal
const customerMenuItems = [
  { icon: 'home', label: 'Trang chủ', path: '/' },
  { icon: 'search', label: 'Tìm & Đặt Kho', path: '/tim-va-dat-kho' },
  { icon: 'inventory_2', label: 'Kho của tôi', path: '/kho-cua-toi' },
  { icon: 'payments', label: 'Thanh toán', path: '/thanh-toan' },
  { icon: 'contact_support', label: 'Hỗ trợ', path: '/ho-tro' },
];

// Mock user data - sẽ thay bằng dữ liệu thật từ API sau khi có Authentication
const mockUser = {
  name: 'Thu Trang',
  initials: 'TT',
  email: 'thutrang@gmail.com',
  role: 'Khách Hàng',
};

export default function CustomerLayout() {
  const handleLogout = () => {
    // TODO: Gọi API logout, xóa token, redirect về trang login
    console.log('Đăng xuất...');
    alert('Chức năng đăng xuất sẽ được kết nối sau.');
  };

  return (
    <div>
      <Sidebar
        menuItems={customerMenuItems}
        role={mockUser.role}
        user={mockUser}
        onLogout={handleLogout}
      />
      <div className="pl-[260px]">
        <Header
          portalName="Cổng Khách Hàng"
          user={mockUser}
          onLogout={handleLogout}
        />
        <main className="w-full pt-16 bg-[#F4F6F8] min-h-screen" style={{ backgroundColor: 'rgb(226, 232, 240)' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
