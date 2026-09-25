import { Routes, Route } from 'react-router-dom';
import CustomerLayout from './layouts/CustomerLayout';
import HomePage from './pages/home/HomePage';
import LoginPage from './pages/login/LoginPage';
import RegisterPage from './pages/register/RegisterPage';
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
        <Route path="/kho-cua-toi" element={<MyReservationsPage />} />
        {/* 
          Các thành viên thêm route module của mình ở đây:
          
          <Route path="/tim-va-dat-kho" element={<SearchPage />} />
          <Route path="/kho-cua-toi" element={<MyStoragePage />} />
          <Route path="/thanh-toan" element={<PaymentPage />} />
          <Route path="/ho-tro" element={<SupportPage />} />
        */}
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