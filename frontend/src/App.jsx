import { Routes, Route } from 'react-router-dom';
import CustomerLayout from './layouts/CustomerLayout';
import HomePage from './pages/home/HomePage';
import LoginPage from './pages/login/LoginPage';
import RegisterPage from './pages/register/RegisterPage';

// Import cho chức năng Đặt chỗ (UC-10)
import CreateReservationPage from './pages/reservation/CreateReservationPage';
import ReservationConfirmationPage from './pages/reservation/ReservationConfirmationPage';

// Import cho chức năng Lịch sử & Quản lý Đặt chỗ (UC-12, UC-13)
import MyReservationsPage from './pages/my_reservation/MyReservationsPage';
import PendingReservationsPage from './pages/my_reservation/PendingReservationsPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      
      {/* ========== Customer Portal ========== */}
      <Route element={<CustomerLayout />}>
        <Route path="/" element={<HomePage />} />
        
        {/* Chức năng Quản lý kho của tôi (UC-12) */}
        <Route path="/kho-cua-toi" element={<MyReservationsPage />} />
        
        {/* Chức năng Tìm và Đặt kho (UC-10) */}
        <Route path="/booking" element={<CreateReservationPage />} />
        <Route path="/tim-va-dat-kho" element={<CreateReservationPage />} />
        <Route path="/booking/confirmation" element={<ReservationConfirmationPage />} />
      </Route>

      {/* ========== UC-13: FM Pending Reservations (tạm standalone, chưa có ManagerLayout) ========== */}
      <Route path="/fm/pending-reservations" element={<PendingReservationsPage />} />

      {/* 
        ========== Các layout khác sẽ thêm sau ==========
        
        <Route element={<StaffLayout />}>
          ...
        </Route>

        <Route element={<ManagerLayout />}>
          ...
        </Route>
      */}
    </Routes>
  );
}
