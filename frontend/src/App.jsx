import { Routes, Route } from 'react-router-dom';
import CustomerLayout from './layouts/CustomerLayout';
import HomePage from './pages/home/HomePage';
import LoginPage from './pages/login/LoginPage';
import RegisterPage from './pages/register/RegisterPage';

// Import của bạn frontend_UC12_UC13
import MyReservationsPage from './pages/my_reservation/MyReservationsPage';
import PendingReservationsPage from './pages/my_reservation/PendingReservationsPage';

// Import của bạn nhánh main
import CreateReservationPage from './pages/reservation/CreateReservationPage';
import PaymentQRPage from './pages/reservation/PaymentQRPage';
import ReservationConfirmationPage from './pages/reservation/ReservationConfirmationPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      
      {/* ========== Customer Portal ========== */}
      <Route element={<CustomerLayout />}>
        <Route path="/" element={<HomePage />} />
        
        {/* Route của nhánh frontend_UC12_UC13 */}
        <Route path="/kho-cua-toi" element={<MyReservationsPage />} />
        
        {/* Route của nhánh main */}
        <Route path="/booking" element={<CreateReservationPage />} />
        <Route path="/tim-va-dat-kho" element={<CreateReservationPage />} />
        <Route path="/booking/payment" element={<PaymentQRPage />} />
        <Route path="/booking/confirmation" element={<ReservationConfirmationPage />} />

      </Route>

      {/* ========== UC-13: FM Pending Reservations (tạm standalone, chưa có ManagerLayout) ========== */}
      <Route path="/fm/pending-reservations" element={<PendingReservationsPage />} />

      {/* 
        ========== Các layout khác sẽ thêm sau ==========
      */}
    </Routes>
  );
}