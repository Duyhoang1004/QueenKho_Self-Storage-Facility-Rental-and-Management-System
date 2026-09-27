import { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { clearSession } from '../services/authService';

// Menu items cho Customer portal
const customerMenuItems = [
  { icon: 'home', label: 'Trang chá»§', path: '/' },
  { icon: 'search', label: 'TÃ¬m & Äáº·t Kho', path: '/tim-va-dat-kho' },
  { icon: 'inventory_2', label: 'Kho cá»§a tÃ´i', path: '/kho-cua-toi' },
  { icon: 'payments', label: 'Thanh toÃ¡n', path: '/thanh-toan' },
  { icon: 'contact_support', label: 'Há»— trá»£', path: '/ho-tro' },
];

export default function CustomerLayout() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const userStr = sessionStorage.getItem('user');
    if (!userStr) {
      navigate('/login', { replace: true });
      return;
    }

    const user = JSON.parse(userStr);
    
    // Kiá»ƒm tra phÃ¢n quyá»n, náº¿u khÃ´ng pháº£i KhÃ¡ch hÃ ng thÃ¬ Ä‘áº©y vá» trang phÃ¹ há»£p
    if (user.role !== 'CUSTOMER') {
      // Giáº£ sá»­ sau nÃ y cÃ³ staff thÃ¬ Ä‘áº©y vá» /staff, admin Ä‘áº©y vá» /admin
      // Táº¡m thá»i náº¿u sai quyá»n thÃ¬ bÃ¡o lá»—i hoáº·c Ä‘áº©y ra Ä‘Äƒng nháº­p
      alert('Báº¡n khÃ´ng cÃ³ quyá»n truy cáº­p trang nÃ y!');
      clearSession();
      navigate('/login', { replace: true });
      return;
    }

    // Táº¡o chá»¯ viáº¿t táº¯t tá»« tÃªn tháº­t
    const names = user.fullName ? user.fullName.split(' ') : ['K', 'H'];
    let initials = '';
    if (names.length >= 2) {
      initials = (names[0][0] + names[names.length - 1][0]).toUpperCase();
    } else if (names.length === 1) {
      initials = names[0][0].toUpperCase();
    }

    setCurrentUser({
      ...user,
      name: user.fullName, // Map tá»« fullName sang name Ä‘á»ƒ Sidebar dÃ¹ng
      initials: initials || 'KH',
      role: 'KhÃ¡ch HÃ ng' // Hiá»ƒn thá»‹ tiáº¿ng Viá»‡t trÃªn UI
    });
  }, [navigate]);

  const handleLogout = () => {
    clearSession();
    navigate('/login', { replace: true });
  };

  if (!currentUser) return null; // Hoáº·c hiá»ƒn thá»‹ má»™t spinner loading

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
          portalName="Cá»•ng KhÃ¡ch HÃ ng"
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

